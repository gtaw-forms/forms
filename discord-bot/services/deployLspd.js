/**
 * deployLspd.js — LSPD crosspost retirement.
 *
 * The LSPD forum crosspost (f=1361 certified-copy topics + completion posts)
 * was retired Nov 2026: the board is dead and LSPD delivery runs via the
 * native ME/coroner liaison forms plus the share links. What remains is the
 * startup sweep that marks historic `failed` crosspost entries `retired` so
 * recovery stops carrying them.
 */

import { logFnCall } from './deployLogger.js';

const LSPD_BASE = 'https://lspd.gta.world';
const LSPD_FORUM_ID = 1361;

/**
 * Normalize the db argument to a Reference for a path.
 * `db` may be a firebase-admin Database (has `.ref`) or the bot's `state.dbRef`,
 * which is a root Reference (has `.child`, no `.ref`) — calling `db.ref()` on it
 * throws "db.ref is not a function", silently skipping the status write.
 */
const refFor = (db, path) => (typeof db.ref === 'function' ? db.ref(path) : db.child(path));

/**
 * Retry failed LSPD cross-posts on startup.
 *
 * Inbox retirement (Nov 2026): LSPD takes no inbox notices, so there is
 * nothing to retry — historic `failed` entries are marked `retired` so this
 * tick goes quiet instead of rescanning them forever. Delivery for LSPD
 * cases runs via the ME liaison form step plus the share link.
 */
export async function retryFailedLspdCrossposts(db) {
    logFnCall('deployLspd', 'retryFailedLspdCrossposts', 'Scanning for failed LSPD cross-posts');
    if (!db) return;
    try {
        const snap = await refFor(db, 'autopsy-requested').orderByChild('lspdCrosspostStatus').equalTo('failed').once('value');
        if (!snap.exists()) {
            console.log('[LSPD-XP] No failed cross-posts to retry');
            return;
        }
        let retired = 0;
        const children = [];
        snap.forEach((child) => children.push(child));
        for (const child of children) {
            console.log('[LSPD-XP] Retiring ' + child.key + ' — LSPD inbox notices removed Nov 2026, nothing to retry');
            try {
                await refFor(db, 'autopsy-requested/' + child.key).update({
                    lspdCrosspostStatus: 'retired',
                    lspdCrosspostUpdatedAt: new Date().toISOString(),
                });
                retired++;
            } catch (err) {
                console.warn('[LSPD-XP] Failed to retire ' + child.key + ':', err.message);
            }
        }
        console.log('[LSPD-XP] Retired ' + retired + ' failed cross-post(s)');
    } catch (err) {
        console.error('[LSPD-XP] Retry scan error:', err.message);
    }
}
