/**
 * Deploy Executor — sequential deploy orchestrator with timeout guard.
 * Runs one deploy at a time. Handles errors, retries, and forum routing.
 */

import { getForumClient } from './forumClient.js';
import { logFnCall, sendWebhook, notifyDeployFailure } from './deployLogger.js';
import { state, C } from './deployState.js';
import { requeueReport } from './deployRetry.js';
import { checkUserConsent, skipDueToConsent } from './deployConsent.js';
import { checkBbcodeSanity } from './bbcodeSanity.js';

// Lazy import handlers from the dedicated handler modules
let _handlers = null;
async function getHandlers() {
    if (!_handlers) {
        const [pm, topic, med, autopsy] = await Promise.all([
            import('./deployPM.js'),
            import('./deployTopic.js'),
            import('./deployMedicalRecord.js'),
            import('./deployAutopsyReply.js'),
        ]);
        _handlers = {
            handlePM: pm.handlePM,
            handleTopic: topic.handleTopic,
            handleMedicalRecord: med.handleMedicalRecord,
            handleAutopsyReply: autopsy.handleAutopsyReply,
        };
    }
    return _handlers;
}

export async function runDeploy(type, data) {
    logFnCall('deployExecutor', 'runDeploy', 'Running deploy', { type, key: data.key });

    if (state.processing) {
        setTimeout(() => runDeploy(type, data), 5000);
        return;
    }
    state.processing = true;

    // Validate PHMC session before any deploy — force re-login if expired
    try {
        const client = getForumClient();
        await client.ensureLoggedIn();
    } catch (sessionErr) {
        console.warn(`[AUTO] Session check failed, continuing anyway: ${sessionErr.message}`);
    }

    const label = data.report?.originalKey || data.key;

    // ── Consent re-check ──
    // User may have opted out since the report was queued (or never set preferences).
    // If consent was revoked, skip the deploy and mark it in Firebase.
    const formId = data.report?.formId;
    if (formId) {
        const consented = await checkUserConsent(data.db, data.authorId, formId);
        if (!consented) {
            console.log(`[AUTO] ${label} skipped — user has not consented to ${formId}`);

            // Update progress embed if one exists
            if (data._progressMessageId && state.discordClient) {
                try {
                    const channel = await state.discordClient.channels.fetch(data._progressChannelId);
                    const msg = await channel.messages.fetch(data._progressMessageId);
                    await msg.edit({ content: `[SKIPPED] ${label} — user revoked consent for ${formId}`, embeds: [], components: [] });
                } catch { /* progress embed is optional */ }
            }

            await skipDueToConsent(data.db, data.authorId, data.key, formId, label);
            state.processing = false;
            return;
        }
    }

    const d = data.report?.data || {};

    // ── 🛑 CRITICAL GATE: empty employee identity (emergency handbrake) ──
    // A report with an empty coronerEmployee / phmcEmployee must NEVER be
    // deployed — it ships blanks to the forum (Sarah Bell / Xavier Bogdanovic
    // incident, 2026-08-11). Hard-stop here, mark the report, notify the
    // developer, and do NOT retry — the data must be fixed first.
    const EMPLOYEE_FIELD_BY_FORM = {
        'coroner-report': 'coronerEmployee',
        'coroner_email': 'coronerEmployee',
        'death_record': 'coronerEmployee',
        'mass-ftality-test': 'coronerEmployee',
        'autopsy': 'coronerEmployee',
        'patient_notes': 'phmcEmployee',
        'er_protocol': 'phmcEmployee',
        'physical_evaluation': 'phmcEmployee',
        'staff-patient-file': 'phmcEmployee',
        'surgical': 'phmcEmployee',
        'session_notes': 'phmcEmployee',
        'intensive_treatment': 'phmcEmployee',
        'psych-eval': 'phmcEmployee',
        'general_consultation': 'phmcEmployee',
        'testing-compact-mode': 'phmcEmployee', // legacy rename alias
    };
    const expectedField = EMPLOYEE_FIELD_BY_FORM[formId] || null;
    let employeeMissing = false;
    if (expectedField) {
        const val = d[expectedField];
        employeeMissing = !val || !String(val).trim();
    } else if (type === 'topic' || type === 'pm') {
        // Unknown form id on a PHMC deploy: block only if BOTH employee
        // fields are missing/empty (never false-positive a legit form).
        const cVal = d.coronerEmployee;
        const pVal = d.phmcEmployee;
        employeeMissing = (!cVal || !String(cVal).trim()) && (!pVal || !String(pVal).trim());
    }

    if (employeeMissing) {
        const missingField = expectedField || 'coronerEmployee/phmcEmployee';
        console.error(`[AUTO] 🛑 BLOCKED ${label} — ${missingField} is empty. Not deploying.`);
        try {
            await data.db.ref(`scheduledReports/${data.authorId}/${data.key}`).update({
                hasdeployed: false,
                deployStatus: 'blocked_empty_employee',
                deployMessage: `BLOCKED: ${missingField} is empty. Fix the report data (re-save in the app or run tools/fix-empty-coroner.mjs), then set hasdeployed:false + deployStatus:"pending" and restart the bot.`,
                deployCheckedAt: new Date().toISOString(),
            });
            await data.db.ref(`retry-queue/${data.authorId}|${data.key}`).remove().catch(() => {});
        } catch (statusErr) {
            console.error('[AUTO] Failed to mark blocked status:', statusErr.message);
        }

        await sendWebhook(null, {
            title: '🛑 DEPLOY BLOCKED — Empty Employee Identity',
            description: [
                '**Report:** ' + label,
                '**Key:** `' + data.key + '`',
                '**Type:** ' + type,
                '**Form:** ' + (formId || 'unknown'),
                '**Missing field:** `' + missingField + '`',
                '',
                '🛠 <@228306972204597248> — fix the report data first (re-save in the app, or `node tools/fix-empty-coroner.mjs --include-scheduled --apply`), then set `hasdeployed:false` + `deployStatus:"pending"` and restart the bot.',
            ].join('\n'),
            color: 0xdc3545,
            footer: { text: 'PHMC Bot — Auto Deploy (emergency handbrake)' },
            timestamp: new Date().toISOString(),
        });

        if (data._progressMessageId && state.discordClient) {
            try {
                const channel = await state.discordClient.channels.fetch(data._progressChannelId);
                const msg = await channel.messages.fetch(data._progressMessageId);
                await msg.edit({ content: `[BLOCKED] ${label} — empty employee identity, deploy halted`, embeds: [], components: [] });
            } catch { /* progress embed is optional */ }
        }
        state.processing = false;
        return;
    }

    // ── 🛑 TEST GATE: BBCode sanity (golden invariants) ──
    // The golden tests (tests/golden-core.test.js) pin two invariants for the
    // coroner/mass forms: no leftover {{...}} placeholders in the rendered
    // BBCode, and a known department short code rendered as its FULL name. The
    // bot deploys the WEB-generated BBCode (scheduledReportsBBCode/<authorId>/
    // <key>/bbCode), so re-check it here right before dispatch. A failing
    // report is hard-blocked, marked deployStatus:'blocked_test_failed', and
    // NEVER retried (mirror of blocked_empty_employee). Override: set env
    // BYPASS_BBCODE_GATE=1 or forceDeploy:true on the report — the override is
    // logged loudly, never silent. Missing BBCode is skipped here: the topic
    // handler's "No BBCode" path owns that case.
    const TEST_GATED_FORMS = ['coroner-report', 'coroner_email', 'mass-ftality-test', 'death_record'];
    const forceOverride = process.env.BYPASS_BBCODE_GATE === '1' || data.report?.forceDeploy === true;
    if (TEST_GATED_FORMS.includes(formId) && !forceOverride) {
        const bbSnap = await data.db.ref(`scheduledReportsBBCode/${data.authorId}/${data.key}`).once('value');
        const bbCode = bbSnap.val()?.bbCode;
        if (bbCode) {
            const { ok, problems } = checkBbcodeSanity(bbCode, d.department);
            if (!ok) {
                console.error('[AUTO] 🛑 BLOCKED (test gate) ' + label + ' — ' + problems.join('; '));
                try {
                    await data.db.ref(`scheduledReports/${data.authorId}/${data.key}`).update({
                        hasdeployed: false,
                        deployStatus: 'blocked_test_failed',
                        deployMessage: 'BLOCKED: BBCode test gate failed. Fix the report data (re-save in the app), or set `forceDeploy:true` on the report, then set hasdeployed:false + deployStatus:"pending" and restart the bot.',
                        deployCheckedAt: new Date().toISOString(),
                    });
                    await data.db.ref(`retry-queue/${data.authorId}|${data.key}`).remove().catch(() => {});
                } catch (statusErr) {
                    console.error('[AUTO] Failed to mark blocked status:', statusErr.message);
                }

                await sendWebhook(null, {
                    title: '🛑 DEPLOY BLOCKED — BBCode Test Gate',
                    description: [
                        '**Report:** ' + label,
                        '**Key:** `' + data.key + '`',
                        '**Type:** ' + type,
                        '**Form:** ' + (formId || 'unknown'),
                        '',
                        '**Problems:**',
                        ...problems.map((p) => '• ' + p),
                        '',
                        '🛠 <@228306972204597248> — fix the report data first (re-save in the app, or set `forceDeploy:true` on the report), then set `hasdeployed:false` + `deployStatus:"pending"` and restart the bot.',
                    ].join('\n'),
                    color: 0xdc3545,
                    footer: { text: 'PHMC Bot — Auto Deploy (BBCode test gate)' },
                    timestamp: new Date().toISOString(),
                });

                if (data._progressMessageId && state.discordClient) {
                    try {
                        const channel = await state.discordClient.channels.fetch(data._progressChannelId);
                        const msg = await channel.messages.fetch(data._progressMessageId);
                        await msg.edit({ content: `[BLOCKED] ${label} — BBCode test gate failed, deploy halted`, embeds: [], components: [] });
                    } catch { /* progress embed is optional */ }
                }
                state.processing = false;
                return;
            }
        }
    } else if (forceOverride && TEST_GATED_FORMS.includes(formId)) {
        // Forced override: surface it when the gate WOULD have blocked — the
        // override is never silent. Best-effort only; a read hiccup here must
        // not break a forced deploy.
        try {
            const bbSnap = await data.db.ref(`scheduledReportsBBCode/${data.authorId}/${data.key}`).once('value');
            const bbCode = bbSnap.val()?.bbCode;
            if (bbCode) {
                const { ok } = checkBbcodeSanity(bbCode, d.department);
                if (!ok) console.warn('[AUTO] [WARN] BBCode test gate BYPASSED (forced) for ' + label);
            }
        } catch { /* best-effort warning only */ }
    }

    // Determine forum label based on deploy type
    let forumLabel;
    if (type === 'topic' || type === 'medical-record' || type === 'patient_notes') {
        const fInfo = getForumClient().constructor.FORUM_MAP[data.report?.formId];
        forumLabel = fInfo?.name || 'PHMC Forum';
    } else if (type === 'autopsy-reply') {
        forumLabel = 'Case Management';
    } else {
        const rawDept = d.department || '';
        const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)).toLowerCase();
        if (deptStr.includes('dao') || deptStr.includes('atlantic') || deptStr.includes('district attorney')) forumLabel = 'DAO';
        else if (deptStr.includes('sadcr')) forumLabel = 'SADCR';
        else if (deptStr.includes('lssd') || deptStr.includes('sheriff')) forumLabel = 'LSSD';
        else forumLabel = 'LSPD';
        console.log(`[AUTO] PM forum resolved: "${forumLabel}" from department "${rawDept}"`);
    }
    state.currentProcessing = { label, type, forum: forumLabel };

    console.log('[AUTO] Deploying ' + label + ' (' + data.key + ') to ' + forumLabel + '...');

    // Rich presence: show the active deploy, clear it when the run settles
    // (outer finally covers success, failure, and the 10-min abort).
    let presenceToken = null;
    try {
        const { startActivity } = await import('./presence.js');
        presenceToken = startActivity('Deploying ' + label + ' to ' + forumLabel);
    } catch { /* presence is cosmetic */ }

    try {
        // Timeout guard: warn at 3 min, abort at 10 min. Autopsy deploys
        // legitimately run 1-3+ min (login + search + post + crosspost + DM +
        // ack), so a 1-min tripwire false-alarms on healthy runs.
        const slowWarning = setTimeout(() => {
            console.warn('[AUTO] ' + data.key + ' deploy taking longer than usual (>3 min)');
            // Cooldown-gated (30 min per report) so a long-stuck deploy doesn't
            // re-alert every cycle. Message shape unchanged.
            import('./logChannel.js').then(
                ({ notifyOnce }) => notifyOnce('slow:' + data.key, 30 * 60 * 1000, () => ({
                    content: null,
                    embed: {
                        title: ' Forum Slow to Respond',
                        description: '**Key:** `' + data.key + '`\n**Type:** ' + type + '\n**Report:** ' + label,
                        color: 0xffc107,
                        footer: { text: 'PHMC Bot — Auto Deploy' },
                        timestamp: new Date().toISOString(),
                    },
                })).catch(() => {}),
                () => {}
            );
        }, 3 * 60 * 1000);

        const timeout = setTimeout(() => {
            try {
                clearTimeout(slowWarning);
                console.error('[AUTO] ' + data.key + ' deploy timed out after 10 minutes');
                // Cooldown-gated (60 min per report) so a long-stuck deploy
                // doesn't re-alert every cycle. Message shape unchanged.
                import('./logChannel.js').then(
                    ({ notifyOnce }) => notifyOnce('unresponsive:' + data.key, 60 * 60 * 1000, () => ({
                        content: null,
                        embed: {
                            title: ' Forum Unresponsive',
                            description: '**Key:** `' + data.key + '`\n**Type:** ' + type + '\n**Report:** ' + label,
                            color: 0xdc3545,
                            footer: { text: 'PHMC Bot — Auto Deploy' },
                            timestamp: new Date().toISOString(),
                        },
                    })).catch(() => {}),
                    () => {}
                );
                // Real abort: closing the shared browser rejects in-flight
                // Playwright waits promptly, so the hung handler settles and
                // the normal catch path below requeues the report instead of
                // overlapping with the next deploy. Best-effort: failures here
                // must never strand state.processing.
                // Daemon-attached browsers are SPARED: destroying shared pages
                // out from under concurrent flows (the coroner-email worker
                // shares the default client) breaks them with 'target closed'
                // — worse than the overlap. Hung daemon ops fail on their own
                // Playwright timeouts instead.
                import('./forumClient.js').then(
                    ({ closeSharedBrowser, isBrowserOwnedByUs }) => {
                        try {
                            if (isBrowserOwnedByUs && isBrowserOwnedByUs()) closeSharedBrowser('deploy-timeout').catch(() => {});
                            else console.log('[AUTO] Daemon-attached browser left alone on deploy timeout');
                        } catch { /* ignore */ }
                    },
                    () => {}
                );
            } catch {
                // Timeout-handler internals must never throw outward.
            } finally {
                state.processing = false;
            }
        }, 10 * 60 * 1000);

        try {
            const h = await getHandlers();
            if (type === 'pm') await h.handlePM(data);
            else if (type === 'topic') await h.handleTopic(data);
            else if (type === 'patient_notes' || type === 'medical-record') await h.handleMedicalRecord(data);
            else if (type === 'autopsy-reply') await h.handleAutopsyReply(data);
        } finally {
            clearTimeout(slowWarning);
            clearTimeout(timeout);
        }
    } catch (err) {
        if (err && err.code === 'POSTING_PAUSED') {
            // Circuit breaker open — pause without burning the retry budget.
            // The report is rescheduled for a half-open probe; consecutive
            // failures keep it paused, one success re-opens everything.
            console.warn(`[AUTO] ${data.key} paused — ${err.message}`);
            try {
                const { rescheduleReportProbe } = await import('./deployRetry.js');
                await rescheduleReportProbe(data.db, data.authorId, data.key, data.report, err.postingHost);
            } catch (probeErr) {
                console.error('[AUTO] Probe reschedule error:', probeErr.message);
            }
            if (data._progressMessageId && state.discordClient) {
                try {
                    const channel = await state.discordClient.channels.fetch(data._progressChannelId);
                    const msg = await channel.messages.fetch(data._progressMessageId);
                    await msg.edit({ content: `[PAUSED] ${label} — forum posting blocked, retrying automatically`, embeds: [], components: [] });
                } catch { /* progress embed is optional */ }
            }
            return;
        }
        // Typed handler errors: DATA_TERMINAL carries a pre-validated
        // err.terminalStatus (data problem — settled, never retried).
        // RETRYABLE and unknown/no-code errors fall through to the requeue
        // path below (today's behavior).
        if (err && err.code === 'DATA_TERMINAL') {
            const terminalStatus = err.terminalStatus || 'failed_permanent';
            const terminalMessage = err.message || 'Terminal deploy failure';
            console.error('[AUTO] ' + data.key + ' terminal failure (' + terminalStatus + '):', terminalMessage);
            await notifyDeployFailure(label, type, data.key, terminalMessage);
            try {
                const { markDeployTerminal } = await import('./deployRetry.js');
                await markDeployTerminal(data.db, data.authorId, data.key, terminalStatus, terminalMessage);
            } catch (markErr) {
                console.error('[AUTO] Terminal-mark error:', markErr.message);
            }
            return;
        }
        console.error('[AUTO] ' + data.key + ' Failed:', err.message);
        console.error('[AUTO] Stack:', err.stack);

        // Display-only count: requeueReport owns the single deployRetries
        // increment, so pass data.report UNCHANGED (pre-incrementing here
        // would double-count, +2 per failure).
        const displayRetries = (data.report?.deployRetries || 0) + 1;

        // No exhaustion: transport failures retry forever (a significant
        // outage can need many attempts). Terminal states are reserved for
        // data problems (blocked_empty_employee, trashed_duplicate, consent).
        // Single failure embed (merged 2026-09-23): one DEPLOY FAILED post
        // carrying both the error and the retry schedule — previously this
        // path posted a DEPLOY FAILED embed AND a Re-queued embed per failure.
        let retryAtText = 'requeue failed — will retry next sweep';
        try {
            const retryTime = Date.now() + C.RETRY_DELAY_MS;
            await requeueReport(data.db, data.authorId, data.key, data.report);
            retryAtText = new Date(retryTime).toLocaleString();
        } catch (retryErr) {
            console.error('[AUTO] Retry error:', retryErr.message);
        }
        await sendWebhook(null, {
            title: 'DEPLOY FAILED',
            description: '**Report:** ' + label + '\n**Key:** `' + data.key + '`\n**Type:** ' + type + '\n**Error:** ' + err.message.slice(0, 300) + '\n\nRetry scheduled **' + retryAtText + '** (attempt ' + displayRetries + ' — retrying until posted)',
            color: 0xdc3545,
            footer: { text: 'PHMC Bot — Auto Deploy' },
            timestamp: new Date().toISOString(),
        });
    } finally {
        if (presenceToken !== null) {
            try {
                const { endActivity } = await import('./presence.js');
                endActivity(presenceToken);
            } catch { /* presence is cosmetic */ }
        }
        state.processing = false;
        state.currentProcessing = null;
    }
}
