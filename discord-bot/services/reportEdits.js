/**
 * reportEdits.js — Self-serve "Edit & Repost" worker.
 *
 * The web app lets an ME fix a deployed report and write an edit request under
 * `reportEdits/<author>/<key> = { status: 'requested' }`. This worker (run from
 * the recovery heartbeat) applies the edit in place: it loads the regenerated
 * BBCode + the stored deploy target, edits the forum post, and updates the
 * report status.
 *
 * Product scope: only topic/reply-posted forms (coroner-report, death_record,
 * mass-ftality-test, medical-record forms). Autopsy and coroner_email are
 * excluded — their flows are heavily automated / PM-based and must not be touched.
 */

import ForumClient, { getForumClient } from './forumClient.js';
import { logFnCall, sendWebhook } from './deployLogger.js';
import { isMaintenanceMode } from './deployQueue.js';

// Forms whose posts can be edited in place (everything in FORUM_MAP except autopsy;
// coroner_email is PM-based and not in FORUM_MAP).
const EDIT_ELIGIBLE = new Set(
    Object.keys(ForumClient.FORUM_MAP || {}).filter((f) => f !== 'autopsy')
);

async function appendHistory(db, author, key, entry) {
    try {
        const ref = db.ref(`scheduledReports/${author}/${key}/editHistory`);
        const existing = (await ref.once('value')).val() || [];
        await ref.set([...existing, entry]);
    } catch (e) {
        console.warn(`[REPORT-EDIT] Failed to append edit history for ${author}/${key}: ${e.message}`);
    }
}

async function markFailed(db, author, key, reason) {
    await db.ref(`reportEdits/${author}/${key}`).update({
        status: 'failed',
        lastError: reason,
        checkedAt: new Date().toISOString(),
    }).catch(() => {});
    await db.ref(`scheduledReports/${author}/${key}`).update({
        lastEditStatus: 'failed',
        lastEditError: reason,
        deployMessage: `Edit failed: ${reason}`,
    }).catch(() => {});
    await appendHistory(db, author, key, { at: new Date().toISOString(), status: 'failed', error: reason });
    console.warn(`[REPORT-EDIT] Failed ${author}/${key}: ${reason}`);
    sendWebhook(null, {
        title: '⚠️ Report Edit Failed',
        description: `**Report:** ${key}\n**Key:** \`${key}\`\n**Reason:** ${reason}\n\nRe-trigger from Fix Deployed Report after fixing the issue.`,
        color: 0xdc3545,
    }).catch(() => {});
}

export async function processReportEdits(db) {
    logFnCall('reportEdits', 'processReportEdits', 'Scanning report edit requests');
    if (!db) return;

    // Respect maintenance mode — skip edits during an outage
    if (await isMaintenanceMode().catch(() => false)) {
        console.log('[REPORT-EDIT] Maintenance mode — skipping report edit scan');
        return;
    }

    const snap = await db.ref('reportEdits').once('value');
    if (!snap.exists()) return;

    const requests = [];
    snap.forEach((authorChild) => {
        const author = authorChild.key;
        authorChild.forEach((reportChild) => {
            const req = reportChild.val() || {};
            if (String(req.status) === 'requested') {
                requests.push({ author, key: reportChild.key, req });
            }
        });
    });
    if (requests.length === 0) {
        console.log('[REPORT-EDIT] No pending edit requests');
        return;
    }

    let client = null;
    try {
        client = getForumClient();
        await client.login(null, null, { force: false, baseUrl: process.env.FORUM_BASE_URL });
    } catch (e) {
        console.error(`[REPORT-EDIT] Failed to init forum client: ${e.message}`);
        return;
    }

    for (const { author, key, req } of requests) {
        try {
            await db.ref(`reportEdits/${author}/${key}`).update({ checkedAt: new Date().toISOString() }).catch(() => {});

            const report = (await db.ref(`scheduledReports/${author}/${key}`).once('value')).val();
            const bbSnap = await db.ref(`scheduledReportsBBCode/${author}/${key}`).once('value');
            const bbCode = bbSnap.val()?.bbCode;
            if (!report || !bbCode) {
                await markFailed(db, author, key, 'Missing report or BBCode');
                continue;
            }

            const formId = report.formId;
            if (!formId || !EDIT_ELIGIBLE.has(formId)) {
                await markFailed(db, author, key, `Form not editable (${formId || 'unknown'})`);
                continue;
            }

            const forumInfo = ForumClient.FORUM_MAP[formId];
            if (!forumInfo) {
                await markFailed(db, author, key, `No forum mapping for ${formId}`);
                continue;
            }

            const deployUrl = report.deployUrl || '';
            const topicId = report.deployTopicId || (String(deployUrl).match(/[?&]t=(\d+)/) || [])[1] || null;
            if (!topicId) {
                await markFailed(db, author, key, 'No deployTopicId — report not deployed (or was manually posted)');
                continue;
            }
            const postId = report.deployPostId || (String(deployUrl).match(/[?&]p=(\d+)/) || [])[1] || null;

            // Paper trail: acknowledge receipt so there's a visible trail before the edit lands.
            sendWebhook(null, {
                title: '📝 Report Edit Requested',
                description: `**${report.originalKey || key}** — queued edit to [topic](<${deployUrl}>) (t=${topicId}). Applying…`,
                color: 0xf0b429,
            }).catch(() => {});

            console.log(`[REPORT-EDIT] Editing ${author}/${key} → t=${topicId} f=${forumInfo.forumId} p=${postId || '(first post)'}`);
            const r = await client.editPostContent(topicId, forumInfo.forumId, postId, bbCode, { title: report.originalKey });

            if (r.ok) {
                const appliedAt = new Date().toISOString();
                await db.ref(`reportEdits/${author}/${key}`).set({
                    status: 'done',
                    appliedAt,
                }).catch(() => {});
                await db.ref(`scheduledReports/${author}/${key}`).update({
                    deployStatus: 'edited',
                    deployEditedAt: appliedAt,
                    lastEditStatus: 'ok',
                    lastEditUrl: deployUrl,
                    deployMessage: 'Forum post edited in place.',
                }).catch(() => {});
                await appendHistory(db, author, key, { at: appliedAt, status: 'edited', url: deployUrl });
                console.log(`[REPORT-EDIT] ✅ Edited ${author}/${key} (t=${topicId})`);
                sendWebhook(null, {
                    title: '✏️ Report Edited',
                    description: `**${report.originalKey || key}** — forum post updated in place.\n[View topic](<${deployUrl}>)`,
                    color: 0x33d6c0,
                }).catch(() => {});
            } else {
                await markFailed(db, author, key, r.reason || 'Edit failed');
            }
        } catch (e) {
            console.error(`[REPORT-EDIT] Error for ${author}/${key}: ${e.message}`);
            await markFailed(db, author, key, e.message);
        }
    }
}
