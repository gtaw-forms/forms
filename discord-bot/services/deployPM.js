/**
 * deployPM.js — Forum PM Handler
 *
 * Sends reports (coroner emails, requested reports) as forum private messages.
 * Routes to LSPD/LSSD/SADCR/DAO based on department metadata.
 *
 * Multi-recipient: one report can carry up to 5 recipients
 * (requestingOfficer + data.additionalRecipients). Each officer gets their own
 * personalized copy (per-recipient BBCode variants rendered at save time) on
 * their own department's forum. Per-leg status lives in deployTargets so a
 * retry resumes with the unsent legs instead of re-sending to everyone.
 */

import { getForumClient } from './forumClient.js';
import { DeployProgressEmbed, notifyDeployFailure } from './deployLogger.js';
import { state } from './deployState.js';
import { markDeployed, markReportComplete } from './deployStatus.js';
import { requeueReport } from './deployRetry.js';
import { isMaintenanceMode } from './deployQueue.js';
import { normalizeRecipients } from './recipients.js';

/**
 * Resolve the target forum from a department value.
 * Same mapping as before (unknown departments default to LSPD).
 */
function forumFor(department) {
    const rawDept = department || '';
    const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)).toLowerCase();

    const isDao = deptStr.includes('dao') || deptStr.includes('atlantic') || deptStr.includes('district attorney');
    const isSadcr = !isDao && (deptStr.includes('sadcr') || deptStr.includes('corrections'));
    const isLssd = !isDao && !isSadcr && (deptStr.includes('lssd') || deptStr.includes('sheriff') || deptStr.includes('lasd'));

    if (isDao) {
        return {
            forumUrl: process.env.FORUM_DAO_URL || 'https://lsda.gta.world',
            username: process.env.FORUM_DAO_USERNAME,
            password: process.env.FORUM_DAO_PASSWORD,
            forumLabel: 'DAO',
        };
    }
    if (isSadcr) {
        return {
            forumUrl: process.env.FORUM_SADCR_URL || 'http://sadcr.gta.world',
            username: process.env.FORUM_SADCR_USERNAME,
            password: process.env.FORUM_SADCR_PASSWORD,
            forumLabel: 'SADCR',
        };
    }
    if (isLssd) {
        return {
            forumUrl: process.env.FORUM_LSSD_URL || 'http://lssd.gta.world',
            username: process.env.FORUM_LSSD_USERNAME,
            password: process.env.FORUM_LSSD_PASSWORD,
            forumLabel: 'LSSD',
        };
    }
    return {
        forumUrl: process.env.FORUM_LSPD_URL || 'http://lspd.gta.world',
        username: process.env.FORUM_LSPD_USERNAME,
        password: process.env.FORUM_LSPD_PASSWORD,
        forumLabel: 'LSPD',
    };
}

/**
 * Send a report as forum PM(s) — one personalized copy per recipient.
 * Determines the target forum per recipient from department metadata.
 */
export async function handlePM(report) {
    const { authorId, key, report: reportData, db } = report;

    // Respect maintenance mode — skip regardless of caller path
    if (await isMaintenanceMode().catch(() => false)) {
        console.log(`[AUTO]  ${key}  maintenance mode — skipping PM`);
        return;
    }

    // ── Progress embed ──
    const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID, reportData.appBuild);
    if (report._progressMessageId) {
        await progress.resume(report._progressMessageId, report._progressChannelId || process.env.BOT_LOG_CHANNEL_ID, `PM — ${reportData.originalKey || key}`);
    } else {
        await progress.start(`PM — ${reportData.originalKey || key}`);
    }

    // ── Recipients (primary + additionalRecipients, capped at 5) ──
    const data = reportData.data || {};
    const recipients = normalizeRecipients(data);
    if (recipients.length === 0) {
        const legacy = (data.requestingOfficer
            || data.requesting_officer
            || data.officerName
            || data.recipient
            || '').trim() || null;
        if (!legacy) {
            console.log(`[AUTO]  ${key}  no recipient, marking as deployed`);
            await progress.addStep('No Recipient', 'skip', 'No recipient specified');
            await progress.finalize('complete');
            await markDeployed(db, authorId, key, true, { deployNote: 'No recipient' });
            return;
        }
        recipients.push({ officer: legacy, department: '' });
    }

    const bbSnap = await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value');
    const bbNode = bbSnap.val() || {};
    const baseBbCode = bbNode?.bbCode;
    const variants = Array.isArray(bbNode?.variants) ? bbNode.variants : [];
    if (!baseBbCode && variants.length === 0) {
        console.log(`[AUTO]  ${key}  no BBCode, marking as deployed`);
        await progress.addStep('No BBCode', 'skip', 'No BBCode content found');
        await progress.finalize('complete');
        await markDeployed(db, authorId, key, true, { deployNote: 'No BBCode' });
        return;
    }
    const bbCodeFor = (officer) => {
        const hit = variants.find((v) => String(v?.officer || '').toLowerCase() === String(officer || '').toLowerCase());
        return (hit?.bbCode) || baseBbCode;
    };

    // ── Resume: legs already sent on a previous attempt are skipped ──
    const priorTargets = Array.isArray(reportData.deployTargets) ? reportData.deployTargets : [];
    const sentOfficers = new Set(
        priorTargets.filter((t) => t && t.status === 'sent').map((t) => String(t.officer || '').toLowerCase())
    );
    const targets = recipients.map((r) => {
        const prior = priorTargets.find((t) => t && String(t.officer || '').toLowerCase() === r.officer.toLowerCase());
        return {
            officer: r.officer,
            department: r.department || '',
            forum: prior?.forum || forumFor(r.department || data.department || '').forumLabel,
            status: prior?.status === 'sent' ? 'sent' : 'pending',
            url: prior?.url || null,
            error: null,
        };
    });
    const saveTargets = () => db.ref(`scheduledReports/${authorId}/${key}`).update({ deployTargets: targets }).catch((e) =>
        console.warn(`[AUTO]  ${key}  failed to persist deployTargets: ${e.message}`)
    );

    const subject = reportData.originalKey || key;
    const loggedIn = new Set();
    const client = getForumClient();
    // Master dry-run (.env DRY_RUN=true): fill the PM form per leg but NEVER
    // submit — mirrors the DRY_POST / CORONER_EMAIL_DRY_RUN contract. Legs
    // record dry_run URLs (excluded from the VPS live-record mirror), and the
    // report is consumed as simulated, exactly like a DRY_POST topic.
    const MASTER_DRY_RUN = process.env.DRY_RUN === 'true';
    if (MASTER_DRY_RUN) console.log(`[AUTO]  ${key}  DRY_RUN master flag is on — PM forms will be filled, never sent`);
    let lastUrl = null;
    let failures = 0;

    for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i];
        const leg = targets[i];
        const tag = recipients.length > 1 ? ` (${i + 1}/${recipients.length})` : '';

        if (sentOfficers.has(r.officer.toLowerCase())) {
            console.log(`[AUTO]  ${key}  leg ${i + 1} already sent to ${r.officer} — skipping`);
            await progress.addStep(`Sending PM${tag}`, 'skip', `Already sent to ${r.officer}`);
            lastUrl = leg.url || lastUrl;
            continue;
        }

        const copy = bbCodeFor(r.officer);
        if (!copy) {
            console.log(`[AUTO]  ${key}  leg ${i + 1} no BBCode variant for ${r.officer}`);
            leg.status = 'failed';
            leg.error = 'No BBCode variant';
            failures++;
            await progress.addStep(`Sending PM${tag}`, 'fail', `No copy for ${r.officer}`);
            continue;
        }

        const forum = forumFor(r.department || data.department || '');
        leg.forum = forum.forumLabel;
        const copySource = variants.some((v) => String(v?.officer || '').toLowerCase() === String(r.officer || '').toLowerCase())
            ? `variant (${copy.length}ch)` : `base (${(baseBbCode || '').length}ch)`;
        console.log(`[AUTO] leg ${i + 1}/${recipients.length}: ${r.officer} [${r.department || data.department || 'no-dept'}] via ${forum.forumLabel}, copy=${copySource}${MASTER_DRY_RUN ? ' (dry-run fill only)' : ''}`);

        // Skip if credentials aren't configured for this forum
        if (!forum.username || !forum.password) {
            console.log(`[AUTO]  ${key}  no credentials for ${forum.forumUrl}, will retry`);
            await progress.addStep(`No Credentials (${forum.forumLabel})`, 'skip', `${forum.forumLabel} credentials not configured`);
            if (recipients.length === 1) {
                // Single-recipient legacy path: throw so the executor owns the
                // requeue + failure embed, exactly as before.
                await progress.finalize('failed');
                const e = new Error(`${forum.forumLabel} forum credentials not configured — set them, then the deploy will retry`);
                e.code = 'RETRYABLE';
                throw e;
            }
            leg.status = 'failed';
            leg.error = `${forum.forumLabel} credentials not configured`;
            failures++;
            continue;
        }

        if (!loggedIn.has(forum.forumUrl)) {
            await progress.addStep(`Logging in (${forum.forumLabel})`, 'pending');
            console.log(`[AUTO]  Sending PM to ${r.officer} via ${forum.forumUrl}...`);
            await client.login(forum.username, forum.password, { force: true, baseUrl: forum.forumUrl });
            await progress.addStep(`Logging in (${forum.forumLabel})`, 'ok');
            loggedIn.add(forum.forumUrl);
        }

        await progress.addStep(`Sending PM${tag}`, 'pending', `To: ${r.officer}${MASTER_DRY_RUN ? ' (dry run — fill only)' : ''}`);
        const result = MASTER_DRY_RUN
            ? await client.sendPM(r.officer, subject, copy, { baseUrl: forum.forumUrl, dryRun: true })
            : await client.sendPM(r.officer, subject, copy, { baseUrl: forum.forumUrl });
        if (result.ok) {
            leg.status = 'sent';
            leg.url = result.url || (MASTER_DRY_RUN ? `dry_run=${Date.now()}` : null);
            leg.error = null;
            lastUrl = result.url || leg.url || lastUrl;
            await progress.addStep(`Sending PM${tag}`, 'ok', MASTER_DRY_RUN ? `form filled, not sent (${r.officer})` : (result.url || r.officer));
            console.log(`[AUTO]  ${key}  PM ${MASTER_DRY_RUN ? 'dry-run filled (not sent)' : 'sent'} to ${r.officer}`);
        } else {
            const reason = result.reason || 'Unknown error sending PM';
            console.log(`[AUTO]  ${key}  PM send to ${r.officer} returned failure`);
            leg.status = 'failed';
            leg.error = reason;
            failures++;
            await notifyDeployFailure(reportData.originalKey || key, 'pm', key, `${r.officer}: ${reason}`);
            await progress.addStep(`Sending PM${tag}`, 'fail', `${r.officer}: ${reason}`);
        }
        await saveTargets();
    }

    if (failures === 0) {
        const label = reportData.originalKey || key;
        await progress.finalize('complete');
        await markReportComplete(db, authorId, key, label, 'pm', lastUrl);
        console.log(`[AUTO]  ${key}  all ${recipients.length} PM leg(s) sent`);
    } else {
        await saveTargets();
        const failed = targets.filter((t) => t.status !== 'sent').map((t) => t.officer).join(', ');
        await requeueReport(db, authorId, key, { ...reportData, deployMessage: 'PM send failed: ' + failed }).catch((err) =>
            console.warn(`[AUTO]  ${key}  Failed to requeue PM: ${err.message}`)
        );
        await progress.addStep('Retry Scheduled', 'warn', 'Will auto-retry unsent legs on next cycle');
        await progress.finalize('failed');
    }
}
