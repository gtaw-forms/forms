/**
 * Autopsy Request Monitor — periodically checks PHMC Forum f=265
 * for new Autopsy / Death Certificate Requests, logs them to Firebase,
 * maintains faction counters, and sends Discord notifications.
 *
 * Title format:  Autopsy Request - Character Name ((Player Name)) - [LSPD]
 * Faction identifiers: LSPD, LSSD
 *
 * Firestore paths:
 *   autopsy-requested/<topicId>  — { title, name, oocName, faction, topicUrl, topicId, detectedAt }
 *   autopsy-requests/<faction>/count  — incrementing counter
 *
 * Wired into index.js on bot startup.
 */

import firebase from './firebase.js';
import { getForumClient } from './forumClient.js';
import { sendLogMessage } from './logChannel.js';

// ── Constants ──

const PHMC_FORUM_ID = 265;
const PHMC_BASE = 'https://phmc.gta.world';
const CHECK_INTERVAL_MS = parseInt(process.env.AUTOPSY_MONITOR_INTERVAL || '', 10) || 60 * 60 * 1000;

// Autopsy Request - Name ((OOC Name)) - [LSPD/LSSD]
// Handles various dash characters and flexible spacing
const TITLE_REGEX = /^Autopsy\s+Request\s*[-–—]\s*(.+?)\s*\(\((.+?)\)\)\s*[-–—]\s*\[(LSPD|LSSD)\]/i;

// ── State ──

let _monitorTimer = null;
let _db = null;
let _isFirstCycle = true;
let _lastCheckTime = null;
let _lastCheckSuccess = false;
let _cachedLspdCount = 0;
let _cachedLssdCount = 0;

// ── Discord Notification ──

/**
 * Send a notification embed to the log channel.
 */
async function sendNotification(title, description, color = 0x00bcd4) {
    try {
        await sendLogMessage(null, {
            title,
            description,
            color,
            footer: { text: 'PHMC Bot — Autopsy Monitor' },
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[AUTOPSY-MON] Failed to send notification:', err.message);
    }
}

/**
 * Send a plain-text summary to the deploy webhook (spam channel).
 */
async function sendWebhookSummary(message) {
    const webhookUrl = process.env.DEPLOY_WEBHOOK_URL;
    if (!webhookUrl) return;
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message }),
        });
    } catch (err) {
        console.error('[AUTOPSY-MON] Failed to send webhook summary:', err.message);
    }
}

// ── Title Parsing ──

/**
 * Parse a forum topic title to extract autopsy request details.
 * @param {string} title
 * @returns {{ name: string, oocName: string, faction: string } | null}
 */
function parseTopicTitle(title) {
    const match = title.trim().match(TITLE_REGEX);
    if (!match) return null;
    return {
        name: match[1].trim(),
        oocName: match[2].trim(),
        faction: match[3].toUpperCase(),
    };
}

// ── Forum Check ──

/**
 * Check the forum for new autopsy request topics.
 * Matches titles, saves new ones to Firebase, increments counters, and notifies.
 */
async function checkForNewRequests() {
    if (!_db) {
        _db = firebase.db;
    }

    console.log('[AUTOPSY-MON] Checking for new autopsy requests...');

    try {
        const client = getForumClient();

        // Ensure the browser is launched (uses stored session cookies automatically)
        await client.ensureBrowser();

        // Fetch topics from the forum listing page — uses its own disposable page
        // and does NOT hold the mutex lock, so it won't block deploys.
        const topics = await client.getForumTopics(PHMC_FORUM_ID, { baseUrl: PHMC_BASE });

        if (topics.length === 0) {
            console.log('[AUTOPSY-MON] No topics found on the page');
            return;
        }

        // Load already-processed topics from Firebase (dedup)
        let processedSnapshot;
        try {
            processedSnapshot = await _db.ref('autopsy-requested').once('value');
        } catch (err) {
            console.error('[AUTOPSY-MON] Failed to read processed topics:', err.message);
            return;
        }
        const processed = processedSnapshot.val() || {};

        // Load current faction counters
        let lspdCount = 0;
        let lssdCount = 0;
        try {
            const countersSnap = await _db.ref('autopsy-requests').once('value');
            const counters = countersSnap.val() || {};
            lspdCount = counters.LSPD?.count || 0;
            lssdCount = counters.LSSD?.count || 0;
        } catch (err) {
            console.error('[AUTOPSY-MON] Failed to read counters:', err.message);
        }

        let newLspd = 0;
        let newLssd = 0;
        const newRequests = [];

        for (const topic of topics) {
            // Skip already-processed topics
            if (processed[topic.topicId]) continue;

            const parsed = parseTopicTitle(topic.title);

            if (!parsed) {
                // Save non-matching topics as processed (negative cache)
                // so we never re-check them
                await _db.ref(`autopsy-requested/${topic.topicId}`).set({
                    title: topic.title,
                    topicId: topic.topicId,
                    detectedAt: new Date().toISOString(),
                    wasMatch: false,
                }).catch((err) => {
                    console.error(`[AUTOPSY-MON] Failed to save non-match: ${err.message}`);
                });
                continue;
            }

            // --- New matching request found ---

            const entry = {
                title: topic.title,
                name: parsed.name,
                oocName: parsed.oocName,
                faction: parsed.faction,
                topicUrl: topic.href,
                topicId: topic.topicId,
                detectedAt: new Date().toISOString(),
                wasMatch: true,
            };

            await _db.ref(`autopsy-requested/${topic.topicId}`).set(entry);

            console.log(`[AUTOPSY-MON] Saved: ${topic.title}`);

            newRequests.push(entry);

            if (parsed.faction === 'LSPD') newLspd++;
            else if (parsed.faction === 'LSSD') newLssd++;
        }

        // Cache latest counts for dashboard visibility
        _cachedLspdCount = lspdCount + newLspd;
        _cachedLssdCount = lssdCount + newLssd;

        // Update faction counters in Firebase if we found anything new
        if (newLspd > 0 || newLssd > 0) {

            try {
                const updates = {};
                if (newLspd > 0) {
                    updates['autopsy-requests/LSPD/count'] = updatedLspd;
                    updates['autopsy-requests/LSPD/lastUpdated'] = new Date().toISOString();
                }
                if (newLssd > 0) {
                    updates['autopsy-requests/LSSD/count'] = updatedLssd;
                    updates['autopsy-requests/LSSD/lastUpdated'] = new Date().toISOString();
                }
                await _db.ref().update(updates);
                console.log(`[AUTOPSY-MON] Counters updated — LSPD: ${updatedLspd}, LSSD: ${updatedLssd}`);
            } catch (err) {
                console.error('[AUTOPSY-MON] Failed to update counters:', err.message);
            }
        }

        // ── Discord Notifications ──
        // Skip individual notifications on the very first cycle (startup),
        // since those are historical requests. Only send a summary.
        if (_isFirstCycle) {
            _lastCheckTime = Date.now();
            _lastCheckSuccess = true;
            if (newRequests.length > 0) {
                await sendNotification(
                    'Autopsy Request Monitor — Initial Scan Complete',
                    `Found **${newRequests.length}** existing request(s):\n` +
                    `**LSPD:** ${lspdCount + newLspd} total (+${newLspd} new)\n` +
                    `**LSSD:** ${lssdCount + newLssd} total (+${newLssd} new)\n\n` +
                    `All saved to Firebase. New requests will be notified as they appear.`,
                    0x00bcd4
                );
                await sendWebhookSummary(
                    `**Autopsy Monitor — Initial Scan**\n` +
                    `Registered ${newRequests.length} existing request(s): LSPD: ${lspdCount + newLspd}, LSSD: ${lssdCount + newLssd}`
                );
            } else {
                console.log('[AUTOPSY-MON] No existing requests found on initial scan');
            }
            _isFirstCycle = false;
            return;
        }

        // Subsequent cycles — notify for each new request
        for (const req of newRequests) {
            await sendNotification(
                'New Autopsy Request Detected',
                `**Name:** ${req.name} ((${req.oocName}))\n` +
                `**Faction:** ${req.faction}\n` +
                `**Topic:** [${req.title}](<${req.topicUrl}>)`,
                0x00bcd4
            );
        }

        // Send summary to the deploy webhook (spam channel)
        if (newRequests.length > 0) {
            await sendWebhookSummary(
                `**Autopsy Request Monitor — New Requests**\n` +
                `**LSPD:** ${lspdCount + newLspd} total (+${newLspd})\n` +
                `**LSSD:** ${lssdCount + newLssd} total (+${newLssd})\n` +
                `_${newRequests.length} new request(s) saved to Firebase_`
            );
        } else {
            console.log('[AUTOPSY-MON] No new autopsy requests found');
        }

        _lastCheckTime = Date.now();
        _lastCheckSuccess = true;

    } catch (err) {
        _lastCheckTime = Date.now();
        _lastCheckSuccess = false;
        console.error('[AUTOPSY-MON] Error during forum check:', err.message);
        console.error(err.stack);
    }
}

// ── Lifecycle ──

/**
 * Start the autopsy request monitor.
 * Called once on bot startup from index.js.
 */
export function startAutopsyRequestMonitor() {
    console.log('[AUTOPSY-MON] Starting autopsy request monitor...');

    firebase.init();
    _db = firebase.db;
    _isFirstCycle = true;

    // Broadcast activation to the deploy webhook (bot-spam channel)
    const intervalMin = Math.round(CHECK_INTERVAL_MS / 60000);
    const webhookUrl = process.env.DEPLOY_WEBHOOK_URL;
    if (webhookUrl) {
        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `**Autopsy Request Monitor** — Active (checking f=265 every ${intervalMin}min)`,
            }),
        }).catch(() => {});
    }

    // Run the first check immediately (finds all historical requests silently,
    // only logs a summary to Discord). Then check at regular intervals.
    checkForNewRequests();

    _monitorTimer = setInterval(() => {
        checkForNewRequests();
    }, CHECK_INTERVAL_MS);

    console.log(`[AUTOPSY-MON] Monitor active (interval: ${Math.round(CHECK_INTERVAL_MS / 1000)}s)`);
}

/**
 * Get the current status of the autopsy request monitor for the dashboard.
 * @returns {{ active: boolean, intervalMs: number, lastCheckTime: number|null, lastCheckSuccess: boolean, lspdCount: number, lssdCount: number }}
 */
export function getMonitorStatus() {
    return {
        active: _monitorTimer !== null,
        intervalMs: CHECK_INTERVAL_MS,
        lastCheckTime: _lastCheckTime,
        lastCheckSuccess: _lastCheckSuccess,
        lspdCount: _cachedLspdCount,
        lssdCount: _cachedLssdCount,
    };
}

/**
 * Stop the monitor (for testing / graceful shutdown).
 */
export function stopAutopsyRequestMonitor() {
    if (_monitorTimer) {
        clearInterval(_monitorTimer);
        _monitorTimer = null;
        console.log('[AUTOPSY-MON] Monitor stopped');
    }
}
