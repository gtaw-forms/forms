/**
 * deployMedicalRecord.js — Medical Record Handler
 *
 * Handles patient_notes, er_protocol, physical_evaluation, staff-patient-file,
 * surgical, session_notes, intensive_treatment, and psych-eval form types.
 *
 * Searches for an existing patient thread by name/ID and replies to it.
 * ONLY replies to existing topics — never creates new ones.
 * Dry-run by default for safety — set DRY_REPLY=false in .env to enable live replies.
 */

import { getForumClient } from './forumClient.js';
import { logFnCall, DeployProgressEmbed, notifyDeployFailure } from './deployLogger.js';
import { state } from './deployState.js';
import { setDeployStatus, markReportComplete } from './deployStatus.js';
import { upsertPatient, findPatientIndexEntry, removePatientIndexEntry } from './patientIndex.js';
import { isMaintenanceMode } from './deployQueue.js';

// ── Safety env vars ──
const MEDICAL_RECORD_DRY_RUN = process.env.MEDICAL_RECORD_DRY_RUN !== 'false';
const MEDICAL_RECORD_ALLOWED = (process.env.MEDICAL_RECORD_ALLOWED || '').split(',').map(s => s.trim()).filter(Boolean);

/**
 * Clean up stale entries from the recent patient records cache.
 * Called periodically and on each new entry.
 */
function pruneRecentPatientRecords() {
    const cutoff = Date.now() - (5 * 60 * 1000);
    for (const [pid, entry] of state.recentPatientRecords) {
        if (entry.timestamp < cutoff) state.recentPatientRecords.delete(pid);
    }
}

/**
 * Scan f=97 for the highest existing patient ID, return next ID + 1.
 * Caches the result in Firebase appMetadata/nextPatientId to avoid re-scanning.
 * Falls back to a forum scan if cache is missing.
 */
async function getNextPatientId(client, db) {
    try {
        // Check Firebase cache first
        const cacheSnap = await db.ref('appMetadata/nextPatientId').once('value').catch(() => null);
        if (cacheSnap?.exists()) {
            const next = cacheSnap.val() + 1;
            await db.ref('appMetadata/nextPatientId').set(next).catch(() => {});
            return next;
        }
    } catch (e) { /* fall through to scan */ }

    // Scan f=97 for all topic titles, extract highest patient ID
    try {
        const topics = await client.getForumTopics(97);
        let highest = 0;
        for (const t of topics || []) {
            const m = t.title.match(/Patient\s*#?(\d+)/i);
            if (m) {
                const num = parseInt(m[1], 10);
                if (num > highest) highest = num;
            }
        }
        const next = highest + 1;
        await db.ref('appMetadata/nextPatientId').set(next).catch(() => {});
        console.log(`[MEDICAL-RECORD] Scanned f=97 — highest ID: ${highest}, next: ${next}`);
        return next;
    } catch (e) {
        console.warn(`[MEDICAL-RECORD] Failed to scan f=97 for patient IDs: ${e.message}`);
        return null;
    }
}

/**
 * Handle a Patient Note — search for existing patient thread by patientID/name and reply.
 */
export async function handleMedicalRecord(report) {
    const { authorId, key, report: reportData, db } = report;

    // Respect maintenance mode — skip regardless of caller path
    if (await isMaintenanceMode().catch(() => false)) {
        console.log(`[AUTO]  ${key}  maintenance mode — skipping medical record`);
        return;
    }

    const DRY_REPLY = process.env.DRY_REPLY !== 'false';
    const isDryRun = MEDICAL_RECORD_DRY_RUN;

    // ── Progress embed ──
    const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID, reportData.appBuild);
    if (report._progressMessageId) {
        await progress.resume(report._progressMessageId, report._progressChannelId || process.env.BOT_LOG_CHANNEL_ID, `Medical Record — ${reportData.originalKey || key}`);
    } else {
        await progress.start(`Medical Record — ${reportData.originalKey || key}`);
    }

    console.log(`[AUTO]  handleMedicalRecord called for ${key}  patientID: "${reportData.data?.patientID}", formId: "${reportData.formId}"`);
    const rawPatientID = (reportData.data?.patientID || '').trim();
    // The medical Patient Name input writes `decedentName` (the real patient), so
    // prefer it over `patientName` — `patientName` can be polluted with the OAuth
    // author's character name by older credential-sync code, which made the bot
    // search for (and thread-title) the poster instead of the patient.
    const patientName = reportData.data?.decedentName || reportData.data?.patientName || reportData.originalKey || '';
    console.log(`[MEDICAL-RECORD-DEBUG] rawPatientID="${rawPatientID}" patientName="${patientName}"`);

    // Require at least patientID OR patientName to proceed
    if (!rawPatientID && !patientName) {
        console.log(`[AUTO]  ${key}  no patientID or patientName`);
        await progress.addStep('Missing Fields', 'fail', 'No patient ID or name');
        await progress.finalize('failed');
        await setDeployStatus(db, authorId, key, 'error', 'Missing patient ID or name. Please add one and save again.');
        return;
    }

    // Try production BBCode path first, then dev-reports-bbcode (for localhost testing)
    let bbCode;
    const prodSnap = await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value');
    bbCode = prodSnap.val()?.bbCode;
    if (!bbCode) {
        const devSnap = await db.ref(`dev-reports-bbcode/${authorId}/${key}`).once('value');
        bbCode = devSnap.val()?.bbCode;
    }
    if (!bbCode) {
        console.log(`[AUTO]  ${key}  no BBCode, marking as deployed`);
        await progress.addStep('No BBCode', 'skip', 'No BBCode content found');
        await progress.finalize('complete');
        await setDeployStatus(db, authorId, key, 'error', 'No BBCode content found in report. Please regenerate and save again.');
        return;
    }

    // ── BBCode validation logging (dry-run or live, always write for inspection) ──
    console.log(`[MEDICAL-RECORD] Rendered BBCode preview (first 500 chars):`);
    console.log(bbCode.substring(0, 500));
    try {
        const { writeFileSync, mkdirSync } = await import('fs');
        const { resolve, dirname } = await import('path');
        const { fileURLToPath } = await import('url');
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const debugDir = resolve(__dirname, '..', 'debug');
        mkdirSync(debugDir, { recursive: true });
        writeFileSync(resolve(debugDir, 'debug-medical-record-bbcode.txt'), bbCode, 'utf-8');
        console.log('[MEDICAL-RECORD] Full BBCode written to debug/debug-medical-record-bbcode.txt');
    } catch (e) {
        console.warn('[MEDICAL-RECORD] Could not write debug file:', e.message);
    }

    // ── Near-duplicate guard ──
    // Checks for rapid re-saves using both patient name and form identity.
    // The in-memory cache has a 5-min TTL (pruned by pruneRecentPatientRecords).
    // Falls back to a broad same-author + same-formId check within 60s.
    if (reportData.timestamp) {
        pruneRecentPatientRecords();

        // Prefer patient name as dedup key (more reliable than numeric patientID)
        const dedupKey = patientName || rawPatientID || `${authorId}|${reportData.formId}`;
        const dedupScope = patientName ? `patient "${patientName}"` : `key "${dedupKey}"`;

        if (dedupKey) {
            const existing = state.recentPatientRecords.get(dedupKey);
            if (existing) {
                if (existing.timestamp > reportData.timestamp) {
                    console.log(`[AUTO]  ${key}  trashing — newer report exists for ${dedupScope}`);
                    await db.ref(`scheduledReports/${authorId}/${key}`).update({
                        hasdeployed: true,
                        deployStatus: 'trashed_duplicate',
                        deployMessage: `A newer version of this report was saved. This older copy was trashed.`,
                        deployedAt: new Date().toISOString(),
                        deployedBy: 'autoDeploy',
                    });
                    await progress.addStep('Duplicate', 'skip', 'Newer report exists');
                    await progress.finalize('complete');
                    return;
                }
                console.log(`[AUTO]  ${existing.key}  trashing older duplicate for ${dedupScope}, keeping ${key}`);
                await db.ref(`scheduledReports/${existing.authorId}/${existing.key}`).update({
                    hasdeployed: true,
                    deployStatus: 'trashed_duplicate',
                    deployMessage: `Replaced by newer report ${key}.`,
                    deployedAt: new Date().toISOString(),
                    deployedBy: 'autoDeploy',
                });
                state.recentPatientRecords.delete(dedupKey);
                console.log(`[AUTO]  ${key}  is the newest for ${dedupScope}, proceeding`);
            }
        }

        // Broad safety net: same author + same formId within 60s.
        // ONLY applies when the report has no patient identity (no name/id) — the
        // primary dedup above already handles same-patient rapid re-saves, and a
        // named patient must never be trashed just because a DIFFERENT patient was
        // saved on the same form within the window (e.g. two ME's/forms back-to-back).
        if (!dedupKey) {
            const broadKey = `${authorId}|${reportData.formId}`;
            const existing = state.recentPatientRecords.get(broadKey);
            if (existing) {
                const timeSince = reportData.timestamp - existing.timestamp;
                if (timeSince >= 0 && timeSince < 60000) {
                    console.log(`[AUTO]  ${key}  trashing — rapid re-save (${timeSince}ms) by same author on ${reportData.formId}`);
                    await db.ref(`scheduledReports/${authorId}/${key}`).update({
                        hasdeployed: true,
                        deployStatus: 'trashed_duplicate',
                        deployMessage: `Rapid re-save detected (${Math.round(timeSince / 1000)}s). Earlier version kept.`,
                        deployedAt: new Date().toISOString(),
                        deployedBy: 'autoDeploy',
                    });
                    await progress.addStep('Duplicate', 'skip', 'Rapid re-save');
                    await progress.finalize('complete');
                    return;
                }
            }
            state.recentPatientRecords.set(broadKey, { authorId, key, timestamp: reportData.timestamp, isBroad: true });
        }

        // Store under the primary dedup key
        if (dedupKey) {
            state.recentPatientRecords.set(dedupKey, { authorId, key, timestamp: reportData.timestamp });
        }
    }

    const client = getForumClient();
    await progress.addStep('Login', 'pending');
    await client.login(null, null, { force: false, baseUrl: process.env.FORUM_BASE_URL });
    await progress.addStep('Login', 'ok');

    let workingBbCode = bbCode;

    // Search by patient name — patient IDs are unreliable for search.
    const searchTerm = patientName;
    console.log(`[MEDICAL-RECORD] Searching by name: "${searchTerm}"`);

    await progress.addStep('Searching', 'pending', `Looking for \`${searchTerm}\``);
    await setDeployStatus(db, authorId, key, 'searching', `Looking for patient: ${searchTerm}...`);
    let candidates = [];
    let topicId = null;
    let foundTitle = null;
    let resolvedPatientId = null;
    let resolvedFromIndex = false;

    // ── Fast path: resolve the patient's thread DIRECTLY from the local index ──
    // No forum search. The index is built from f=97 itself (3-day rebuild) and
    // kept current by the write-through on every deploy, so an exact name match
    // gives us the exact thread id. Only exact (case-insensitive) matches count —
    // fuzzy/partial names fall through to the forum search as before.
    const idxEntry = findPatientIndexEntry(searchTerm);
    if (idxEntry?.threadId) {
        resolvedFromIndex = true;
        topicId = idxEntry.threadId;
        resolvedPatientId = idxEntry.id || null;
        foundTitle = resolvedPatientId ? `${resolvedPatientId} - ${idxEntry.name}` : idxEntry.name;
        console.log(`[MEDICAL-RECORD] INDEX match — "${searchTerm}" → topic #${topicId} (patient ${resolvedPatientId || '?'}) — skipped forum search`);
        if (resolvedPatientId) {
            workingBbCode = workingBbCode
                .replace(/{{patientID}}/gi, String(resolvedPatientId))
                .replace(/{{PATIENT_ID}}/g, String(resolvedPatientId))
                .replace(/{{patientId}}/g, String(resolvedPatientId));
        }
    } else {
        // ── Fallback path: forum search (partial/fuzzy names, unknown patients) ──
        console.log(`[MEDICAL-RECORD] No exact index match for "${searchTerm}" — searching forum`);
        const searchRes = await client.searchForPatientTopic(searchTerm);
        topicId = searchRes.topicId;
        foundTitle = searchRes.title;
        candidates = searchRes.candidates || [];
        console.log(`[MEDICAL-RECORD-DEBUG] Search result: topicId=${topicId}, foundTitle="${foundTitle}"`);

        // If an existing topic was found, extract the patient ID from the title
        // (e.g. "1424 - Alyson Frost" → "1424") and use it in the BBCode.
        if (topicId && (!rawPatientID || !/^\d+$/.test(rawPatientID))) {
            const titleMatch = foundTitle?.match(/^(\d+)\s*[-–—]/);
            console.log(`[MEDICAL-RECORD-DEBUG] Checking title for existing ID: titleMatch=${!!titleMatch}`);
            if (titleMatch) {
                resolvedPatientId = titleMatch[1];
                console.log(`[MEDICAL-RECORD] Found existing topic #${topicId} with patient ID "${resolvedPatientId}"`);
                workingBbCode = workingBbCode
                    .replace(/{{patientID}}/gi, String(resolvedPatientId))
                    .replace(/{{PATIENT_ID}}/g, String(resolvedPatientId))
                    .replace(/{{patientId}}/g, String(resolvedPatientId));
                const stillHasPlaceholder = workingBbCode.includes('{{patientID}}') || workingBbCode.includes('{{PATIENT_ID}}') || workingBbCode.includes('{{patientId}}');
                console.log(`[MEDICAL-RECORD-DEBUG] Still has patientID placeholder after existing ID replacement: ${stillHasPlaceholder}`);
                console.log(`[MEDICAL-RECORD-DEBUG] BBCode snippet (first 300): ${workingBbCode.substring(0, 300)}`);
            }
        }
    }

    // No thread found for this name → we're creating a NEW patient. Always
    // auto-assign a fresh ID: a form `patientID` (e.g. a leftover from a previous
    // autocomplete selection) belongs to another patient and must NOT be reused.
    // Doing this AFTER the search avoids an expensive f=97 scan when we don't need it.
    if (!topicId) {
        console.log(`[MEDICAL-RECORD] No existing thread — assigning next patient ID...`);
        const newId = await getNextPatientId(client, db);
        if (newId) {
            resolvedPatientId = String(newId);
            console.log(`[MEDICAL-RECORD] Auto-assigned patient ID: ${resolvedPatientId}`);
            workingBbCode = workingBbCode
                .replace(/{{patientID}}/gi, resolvedPatientId)
                .replace(/{{PATIENT_ID}}/g, resolvedPatientId)
                .replace(/{{patientId}}/g, resolvedPatientId);
            console.log(`[MEDICAL-RECORD-DEBUG] BBCode snippet after auto-assign (first 300): ${workingBbCode.substring(0, 300)}`);
        } else {
            console.log(`[MEDICAL-RECORD-DEBUG] getNextPatientId returned null — using "NEW" as fallback`);
        }
    }

    if (!topicId) {
        console.log(`[AUTO] No existing thread found for "${searchTerm}"`);
        const noMatchDetail = candidates?.length > 0 ? ` (${candidates.length} candidates — none matched all words)` : '';
        await progress.addStep("Searching", "fail", "No thread found" + noMatchDetail);
        // Fresh id (auto-assigned above) or "NEW" — never a stale form patientID.
        const patientIdStr = resolvedPatientId || "NEW";
        const topicTitle = `${patientIdStr} - ${searchTerm}`;
        if (isDryRun) {
            console.log(`[MEDICAL-RECORD] DRY RUN -- would create topic: "${topicTitle}"`);
            await setDeployStatus(db, authorId, key, "dry_run", `No existing thread. Would create: ${topicTitle}. Set DRY_RUN=false to enable.`);
            await progress.finalize("complete");
            return;
        }
        const topicResult = await client.postTopic(97, topicTitle, workingBbCode, `https://phmc.gta.world/posting.php?mode=post&f=97`).catch(e => {
            console.error(`[MEDICAL-RECORD] Failed to create topic: ${e.message}`);
            return null;
        });
        if (topicResult?.ok) {
            const tMatch = topicResult.url.match(/[?&]t=(\d+)/);
            const newId = tMatch ? parseInt(tMatch[1], 10) : null;
            console.log(`[MEDICAL-RECORD] Created new topic #${newId || "?"}: "${topicTitle}"`);
            await progress.addStep("Searching", "ok", `Created #${newId || ""} ${topicTitle}`);
            topicId = newId;
            foundTitle = topicTitle;
            // Write-through: the bot just created the patient's thread — record the
            // exact name/id in the patient index (no forum re-scan needed).
            upsertPatient({
                name: searchTerm,
                id: /^\d+$/.test(String(patientIdStr)) ? patientIdStr : null,
                threadId: topicId,
                lastSeen: Date.now(),
                source: 'deploy:medical-record',
            });
            if (!topicId) {
                await setDeployStatus(db, authorId, key, "error", "Created topic but could not parse ID");
                await progress.finalize("failed");
                return;
            }
            // Topic was created with the report content — no reply needed, that would be a duplicate.
            const label = reportData.originalKey || key;
            const completed = await markReportComplete(db, authorId, key, label, 'medical-record', topicResult.url);
            await progress.addStep('Topic Created', completed ? 'ok' : 'fail', completed ? `[View Topic](<${topicResult.url}>)` : 'Status update failed');
            await progress.finalize(completed ? 'complete' : 'failed');
            return;
        } else {
            await setDeployStatus(db, authorId, key, "topic_not_found", `No thread found for ${searchTerm}. Please create one manually.`);
            await progress.finalize("failed");
            return;
        }
    }

    console.log(`[AUTO]  Topic found: #${topicId}  "${foundTitle}"  (${resolvedFromIndex ? 'from patient index' : 'via forum search'})`);

    // Write-through: the bot resolved this patient's existing thread — record the
    // exact name/id/threadId in the patient index (no forum re-scan needed).
    upsertPatient({
        name: searchTerm,
        id: /^\d+$/.test(String(resolvedPatientId || rawPatientID || '')) ? String(resolvedPatientId || rawPatientID) : null,
        threadId: topicId,
        lastSeen: Date.now(),
        source: 'deploy:medical-record',
    });

    // ── Dual-safety check for live post ──
    if (!isDryRun && MEDICAL_RECORD_ALLOWED.length > 0) {
        const baseUrl = process.env.FORUM_BASE_URL || 'https://phmc.gta.world';
        const allowed = MEDICAL_RECORD_ALLOWED.some(a => baseUrl.includes(a));
        if (!allowed) {
            console.warn(`[MEDICAL-RECORD] BLOCKED — ${baseUrl} not in MEDICAL_RECORD_ALLOWED`);
            await progress.addStep('Blocked', 'fail', `${baseUrl} not in ALLOWED list`);
            await progress.finalize('failed');
            await setDeployStatus(db, authorId, key, 'dry_run', `Blocked — PHMC forum not in MEDICAL_RECORD_ALLOWED`);
            return;
        }
    }

    const foundLabel = resolvedFromIndex
        ? `FOUND IN INDEX — #${topicId} ${foundTitle}`
        : `FOUND VIA SEARCH — #${topicId} ${foundTitle}${candidates?.length > 1 ? ` (from ${candidates.length}: ${candidates.filter(c => c.topicId !== topicId).map(c => '#' + c.topicId).join(', ')})` : ''}`;
    await progress.addStep('Searching', 'ok', foundLabel);
    await setDeployStatus(db, authorId, key, 'replying', `Found topic #${topicId} (${resolvedFromIndex ? 'from patient index' : 'via forum search'}). ${isDryRun ? 'Filling form (dry run)' : 'Posting reply...'}`);

    await progress.addStep('Posting Reply', 'pending');
    let result;
    try {
        result = await client.replyToTopic(topicId, 97, workingBbCode, { dryRun: isDryRun });

        // Stale-index fallback: an index-sourced thread may have been deleted or
        // renamed since the last build. Re-resolve via the forum search ONCE and
        // retry. Safe to retry — a failed/errored reply means nothing was posted.
        if (!result.ok && resolvedFromIndex) {
            console.warn(`[MEDICAL-RECORD] Index topic #${topicId} reply failed (${result.reason || 'unknown'}) — falling back to forum search`);
            const res = await client.searchForPatientTopic(searchTerm);
            if (res.topicId) {
                topicId = res.topicId;
                foundTitle = res.title || foundTitle;
                console.log(`[MEDICAL-RECORD] Search fallback found topic #${topicId} — retrying reply`);
                await progress.addStep('Posting Reply', 'pending', 'Retrying after search fallback');
                result = await client.replyToTopic(topicId, 97, workingBbCode, { dryRun: isDryRun });
            } else {
                removePatientIndexEntry(searchTerm);
                await setDeployStatus(db, authorId, key, 'reply_failed',
                    `Indexed thread #${topicId} for "${searchTerm}" no longer exists and no replacement was found. Re-save to create a new thread.`);
                await progress.addStep('Posting Reply', 'fail', 'Thread no longer exists');
                await progress.finalize('failed');
                return;
            }
        }
    } catch (e) {
        if (resolvedFromIndex) {
            // Same fallback for a thrown reply on an index-sourced thread.
            console.warn(`[MEDICAL-RECORD] Index reply threw (${e.message}) — falling back to forum search`);
            try {
                const res = await client.searchForPatientTopic(searchTerm);
                if (res.topicId) {
                    topicId = res.topicId;
                    foundTitle = res.title || foundTitle;
                    result = await client.replyToTopic(topicId, 97, workingBbCode, { dryRun: isDryRun });
                } else {
                    removePatientIndexEntry(searchTerm);
                    await setDeployStatus(db, authorId, key, 'reply_failed', `Indexed thread no longer exists: ${e.message}`);
                    await progress.addStep('Posting Reply', 'fail', 'Thread no longer exists');
                    await progress.finalize('failed');
                    return;
                }
            } catch (e2) {
                console.error(`[MEDICAL-RECORD] Fallback search/reply also failed: ${e2.message}`);
                result = { ok: false, reason: e2.message };
            }
        } else {
            console.error(`[MEDICAL-RECORD] replyToTopic threw: ${e.message}`);
            await notifyDeployFailure(reportData.originalKey || key, 'medical-record', key, 'Forum error: ' + e.message);
            await progress.addStep('Posting Reply', 'fail', `Forum error: ${e.message}`);
            await progress.finalize('failed');
            await setDeployStatus(db, authorId, key, 'reply_failed', `Forum error: ${e.message}`);
            return;
        }
    }

    if (result.ok && !result.dryRun) {
        const label = reportData.originalKey || key;
        const completed = await markReportComplete(db, authorId, key, label, 'medical-record', result.url);
        await progress.addStep('Posting Reply', completed ? 'ok' : 'fail', completed ? `[View Reply](<${result.url}>)` : 'Status update failed');
        await progress.finalize(completed ? 'complete' : 'failed');
    } else if (result.dryRun) {
        await setDeployStatus(db, authorId, key, 'dry_run',
            `Medical Record dry run — form filled for topic #${topicId}. Not submitted. ` +
            `Set MEDICAL_RECORD_DRY_RUN=false to enable.`
        );
        console.log(`[MEDICAL-RECORD] DRY RUN — form filled for topic #${topicId}`);
        await progress.addStep('Posting Reply', 'ok', `Dry run — not submitted`);
        await progress.finalize('complete');
    } else {
        const reason = result.reason || 'Unknown error replying to topic';
        await setDeployStatus(db, authorId, key, 'reply_failed', reason);
        console.error(`[MEDICAL-RECORD]  Failed to reply to topic #${topicId}: ${reason}`);
        await notifyDeployFailure(reportData.originalKey || key, 'medical-record', key, reason);
        await progress.addStep('Posting Reply', 'fail', reason);
        await progress.finalize('failed');
    }
}
