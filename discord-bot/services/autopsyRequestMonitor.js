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
import { selectME, initializeRotationFromGroup } from './autopsyRotation.js';

// ── Constants ──

const PHMC_FORUM_ID = 265;
const PHMC_BASE = 'https://phmc.gta.world';
const CHECK_INTERVAL_MS = parseInt(process.env.AUTOPSY_MONITOR_INTERVAL || '', 10) || 60 * 60 * 1000;

// Autopsy Request - Name ((OOC Name)) - [LSPD/LSSD]  OR  [Autopsy Request] Name [Faction]
// Supports: various dash chars, with/without brackets, with/without ((OOC))
const TITLE_REGEX = /^(?:\[)?Autopsy\s+Request(?:\])?\s*[-–—]?\s*(.+?)(?:\s*\(\((.+?)\)\))?\s*[-–—]?\s*\[?(LSPD|LSSD)\]?/i;

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
 * Send a notification to bot-spam channel via sendLogMessage.
 */
async function sendWebhookSummary(message) {
    try {
        await sendLogMessage(message, null);
    } catch (err) {
        console.error('[AUTOPSY-MON] Failed to send notification:', err.message);
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
        name: (match[1] || '').trim(),
        oocName: (match[2] || '').trim(),
        faction: match[3] ? match[3].toUpperCase() : '',
    };
}

// ── Forum Check ──

/**
 * Check the forum for new autopsy request topics.
 * Matches titles, saves new ones to Firebase, increments counters, and notifies.
 */
export async function checkForNewRequests() {
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

        // Debug: log all topic titles to see what the forum returns
        console.log(`[AUTOPSY-MON] Topics in f=265: ${topics.map(t => `"${t.title}"`).join(', ')}`);

        // Load already-processed topics from Firebase (dedup)
        let processedSnapshot;
        try {
            processedSnapshot = await _db.ref('autopsy-requested').once('value');
        } catch (err) {
            console.error('[AUTOPSY-MON] Failed to read processed topics:', err.message);
            return;
        }
        const processed = processedSnapshot.val() || {};

        // Load current faction counters and LOA list
        let lspdCount = 0;
        let lssdCount = 0;
        let loaSet = new Set();
        try {
            const countersSnap = await _db.ref('autopsy-requests').once('value');
            const counters = countersSnap.val() || {};
            lspdCount = counters.LSPD?.count || 0;
            lssdCount = counters.LSSD?.count || 0;
            // Extract LOA list from the same snapshot (avoids separate read later)
            if (counters.loa && typeof counters.loa === 'object') {
                Object.entries(counters.loa).forEach(([name, val]) => {
                    if (val === true) loaSet.add(name.toLowerCase());
                });
            }
        } catch (err) {
            console.error('[AUTOPSY-MON] Failed to read counters:', err.message);
        }

        let newLspd = 0;
        let newLssd = 0;
        const newRequests = [];

        for (const topic of topics) {
            // Skip topics already being processed by the state machine
            // (has caseState = actively being worked on)
            // This allows re-processing of entries saved during the first cycle
            // (which have wasMatch=true but no caseState set)
            const prevEntry = processed[topic.topicId];
            if (prevEntry && prevEntry.caseState) continue;

            const parsed = parseTopicTitle(topic.title);
            let parsedBbFields = {};
            let requestBbCode = '';

            if (!parsed) {
                console.log(`[AUTOPSY-MON] Topic did not match regex: topicId=${topic.topicId} title="${topic.title}"`);
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

            // Parse and store structured fields from the request post
            try {
                console.log(`[AUTOPSY-MON] Fetching BBCode for #${topic.topicId}...`);
                const client = getForumClient();
                const bbcode = await client.getTopicBbcode(topic.topicId, 265, { baseUrl: PHMC_BASE });
                if (bbcode) {
                    parsedBbFields = parseAutopsyRequestBbcode(bbcode);
                    requestBbCode = bbcode;
                    if (Object.keys(parsedBbFields).length > 0) {
                        await _db.ref(`autopsy-requested/${topic.topicId}/parsed`).set(parsedBbFields);
                        console.log(`[AUTOPSY-MON] Parsed ${Object.keys(parsedBbFields).length} fields from request`);
                    }
                }
            } catch (err) {
                console.warn(`[AUTOPSY-MON] Parse error for #${topic.topicId}: ${err.message}`);
            }

            // ── Create Case Management entry (state machine — resumes on restart) ──
            try {
                const caseRef = _db.ref(`autopsy-requested/${topic.topicId}`);
                const existingEntry = processed[topic.topicId] || {};
                let state = existingEntry.caseState || '';

                const setState = async (s) => {
                    state = s;
                    await caseRef.child('caseState').set(s);
                    console.log(`[AUTOPSY-MON] State #${topic.topicId}: ${s}`);
                };

                // Determine case number (skip if resuming)
                let caseNum = existingEntry.caseNum || '';
                if (!caseNum && !['case_created','me_assigned','ack_sent','complete'].includes(state)) {
                    try {
                        const cc = getForumClient();
                        await cc.ensureBrowser();
                        const existingTopics = await cc.getForumTopics(266, { baseUrl: PHMC_BASE });
                        let highest = 0;
                        for (const t of existingTopics) {
                            const m = t.title.match(/Case\s*(\d+)/i);
                            if (m) { const n = parseInt(m[1], 10); if (n > highest) highest = n; }
                        }
                        caseNum = String(highest + 1);
                        await caseRef.child('caseNum').set(caseNum);
                        console.log(`[AUTOPSY-MON] Highest case: #${highest} -> new: #${caseNum}`);
                    } catch (err) {
                        console.warn(`[AUTOPSY-MON] Case number lookup: ${err.message}`);
                    }
                }

                const caseNumStr = caseNum ? ` ${caseNum}` : '';
                const factionTag = parsed.faction ? ` [${parsed.faction}]` : '';
                const oocPart = parsed.oocName ? ` ((${parsed.oocName}))` : '';
                const caseTitle = `Case${caseNumStr} - ${parsed.name}${oocPart}${factionTag} - UNASSIGNED`;
                const isDryRun = process.env.AUTOPSY_DRY_RUN !== 'false';

                if (isDryRun) {
                    console.log(`[AUTOPSY-MON] DRY RUN — would create case for #${topic.topicId}`);
                    await sendWebhookSummary(`**[DRY RUN] Autopsy Case Would Be Created**\n${caseTitle}\nTopic: ${topic.href}`);
                    // Set caseState to prevent re-processing on the next cycle
                    await caseRef.child('caseState').set('dry_run').catch(() => {});
                    newRequests.push(entry);
                    if (parsed.faction === 'LSPD') newLspd++;
                    else if (parsed.faction === 'LSSD') newLssd++;
                    continue;
                }

                // Step 1: Create case topic in f=266
                if (state === '') {
                    console.log(`[AUTOPSY-MON] Creating case: "${caseTitle}"`);
                    const cc = getForumClient();
                    const result = await cc.quoteAndPost(topic.topicId, 265, 266, caseTitle, { baseUrl: PHMC_BASE });
                    if (!result.ok) {
                        console.warn(`[AUTOPSY-MON] Case creation failed: ${result.reason || 'unknown'}`);
                        newRequests.push(entry);
                        if (parsed.faction === 'LSPD') newLspd++;
                        else if (parsed.faction === 'LSSD') newLssd++;
                        continue;
                    }
                    console.log(`[AUTOPSY-MON] Case created: ${result.url}`);
                    await caseRef.child('caseUrl').set(result.url);
                    const tMatch = result.url.match(/[?&]t=(\d+)/);
                    if (tMatch) await caseRef.child('caseTopicId').set(tMatch[1]);
                    await caseRef.child('caseTitle').set(caseTitle);
                    await setState('case_created');

                    await sendWebhookSummary(`**Autopsy Case Created**\n${caseTitle}\n${result.url}`);
                    const ownerId = process.env.BOT_OWNER_ID || '';
                    if (ownerId) await sendLogMessage(`<@${ownerId}> Autopsy case posted: ${caseTitle}`, null);
                }

                const caseUrl = existingEntry.caseUrl || (await caseRef.child('caseUrl').once('value')).val() || '';

                // Step 2: Assign ME via fair rotation
                if (state === 'case_created') {
                    await setState('me_assigned');
                    const cc = getForumClient();
                    try {
                        // Fetch group members (needed for user IDs in BBCode and to optionally init rotation)
                        const memberList = await cc.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'] });

                        // Auto-init rotation list from forum group on first run (no-op if already set)
                        await initializeRotationFromGroup(_db, memberList);

                        // Use the new rotation-based selection (handles recency, load balance, surge)
                        const assignedName = await selectME(_db, topic.topicId, caseNum);

                        if (assignedName) {
                            const tMatch = caseUrl.match(/[?&]t=(\d+)/);
                            if (tMatch) {
                                const member = memberList.find(m => m.name.toLowerCase() === assignedName.toLowerCase());
                                const uid = member?.userId || '0';
                                const assignBBCode = `[quote="${assignedName}" user_id=${uid}]\n[/quote]\n\n[b]${assignedName}[/b] - You have been assigned this autopsy case file.`;
                                const replyResult = await cc.replyToTopic(tMatch[1], 266, assignBBCode, { dryRun: false, baseUrl: PHMC_BASE });
                                await caseRef.child('assignedTo').set(assignedName);
                                if (replyResult.ok) {
                                    console.log(`[AUTOPSY-MON] Assigned ${assignedName} to case #${tMatch[1]}`);
                                    const newTitle = caseTitle.replace('- UNASSIGNED', `- ${assignedName}`);
                                    await cc.editTopicTitle(tMatch[1], 266, newTitle, { baseUrl: PHMC_BASE });
                                    // Save the updated title to Firebase so the completion flow uses the clean title
                                    await caseRef.child('caseTitle').set(newTitle).catch(() => {});
                                    await caseRef.child('assignmentReplyStatus').set('completed').catch(() => {});
                                } else {
                                    console.warn(`[AUTOPSY-MON] Assignment reply failed for ${assignedName} — saved to Firebase`);
                                    await caseRef.child('assignmentReplyStatus').set('failed').catch(() => {});
                                }
                            }
                        } else {
                            console.log('[AUTOPSY-MON] No ME available to assign — check rotation list and LOA status');
                        }
                    } catch (err) {
                        console.error(`[AUTOPSY-MON] Assignment error: ${err.message}`);
                    }
                }

                // Step 3: Send acknowledgement reply
                if (state === 'me_assigned') {
                    try {
                        const requesterName = parsedBbFields.requesterName || parsed.name || '';
                        let lssdAckTopicId = null;
                        let lspdTopicId = null;  // declared here for access in the ack call below

                        // --- LSSD: Search for existing request topic for acknowledgement reply ---
                        if (parsed.faction === 'LSSD' && parsed.oocName) {
                            try {
                                const lssdClient = getForumClient();
                                await lssdClient.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: 'https://lssd.gta.world' });
                                const lssdResults = await lssdClient.searchForum(`(( ${parsed.oocName} ))`, null, { baseUrl: 'https://lssd.gta.world' });
                                if (lssdResults.length > 0) {
                                    lssdAckTopicId = lssdResults[0].topicId;
                                    console.log('[AUTOPSY-MON] Found LSSD topic #' + lssdAckTopicId + ' for acknowledgement');
                                    _db.ref('autopsy-requested/' + topic.topicId + '/lssdRequestTopicId').set(lssdAckTopicId).catch(() => {});
                                } else {
                                    console.log('[AUTOPSY-MON] Step 3 — LSSD topic search returned no results for (( ' + parsed.oocName + ' ))');
                                }
                            } catch (err) {
                                console.warn('[AUTOPSY-MON] LSSD ack search error: ' + err.message);
                            }
                        } else {
                            console.log('[AUTOPSY-MON] Step 3 — LSSD topic search skipped (faction=' + (parsed.faction || 'none') + ', oocName=' + (parsed.oocName || 'none') + ')');
                        }

                        // --- LSPD: Create topic on LSPD forum f=1361 immediately on detection ---
                        if (parsed.faction === 'LSPD') {
                            try {
                                const lspdClient = getForumClient();
                                await lspdClient.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: true, baseUrl: 'https://lspd.gta.world' });
                                const lspdTopicTitle = 'Autopsy Request - ' + parsed.name + (parsed.oocName ? ' ((' + parsed.oocName + '))' : '') + ' [LSPD]';
                                const lspdTopicBody = requestBbCode
                                    ? '[divbox=white][center][b][size=170]AUTOPSY REQUEST — CERIFIED COPY [/size][/b][/center][hr][/hr]\n' + requestBbCode + '\n[hr][/hr][b]Case:[/b] ' + caseTitle + '\n[b]Status:[/b] Under Investigation\n[/divbox]'
                                    : '[divbox=white][b]Autopsy Request[/b]\n[b]Decedent:[/b] ' + parsed.name + (parsed.oocName ? ' ((' + parsed.oocName + '))' : '') + '\n[b]Case:[/b] ' + caseTitle + '\n[b]Status:[/b] Under Investigation\n[/divbox]';
                                const lspdResult = await lspdClient.postTopic(1361, lspdTopicTitle, lspdTopicBody, 'https://lspd.gta.world/posting.php?mode=post&f=1361');
                                if (lspdResult.ok) {
                                    const tM = lspdResult.url.match(/[?&]t=(\d+)/);
                                    if (tM) {
                                        lspdTopicId = tM[1];  // was: const lspdTopicId
                                        console.log('[AUTOPSY-MON] Created LSPD topic #' + lspdTopicId + ' for request');
                                        _db.ref('autopsy-requested/' + topic.topicId + '/lspdTopicId').set(lspdTopicId).catch(() => {});
                                        _db.ref('autopsy-requested/' + topic.topicId + '/lspdCrosspostStatus').set('pending').catch(() => {});
                                    } else {
                                        console.warn('[AUTOPSY-MON] Step 3 — LSPD topic created but could not extract topic ID from URL: ' + lspdResult.url);
                                    }
                                } else {
                                    console.warn('[AUTOPSY-MON] Step 3 — Failed to create LSPD topic: ' + (lspdResult.reason || 'unknown'));
                                }
                            } catch (err) {
                                console.warn('[AUTOPSY-MON] Step 3 — LSPD topic creation error: ' + err.message);
                            }
                        } else {
                            console.log('[AUTOPSY-MON] Step 3 — LSPD topic creation skipped (faction=' + (parsed.faction || 'none') + ')');
                        }

                        // --- Send acknowledgement reply to PHMC + crosspost to LSSD/LSPD forums ---
                        const ackResult = await sendAutopsyAcknowledgement(topic.topicId, requesterName, null, {
                            baseUrl: PHMC_BASE,
                            lssdTopicId: lssdAckTopicId,
                            lspdTopicId: lspdTopicId
                        });

                        // Log which ack targets were hit
                        if (ackResult.phmc) console.log('[AUTOPSY-MON] Acknowledgement sent to PHMC #' + topic.topicId);
                        if (ackResult.lssd) console.log('[AUTOPSY-MON] Acknowledgement sent to LSSD #' + lssdAckTopicId);
                        if (ackResult.lspd) console.log('[AUTOPSY-MON] Acknowledgement sent to LSPD #' + lspdTopicId);

                        // Save ack status to Firebase for retry tracking
                        const ackStatus = {};
                        for (const [target, ok] of Object.entries(ackResult)) {
                            if (ok === true) ackStatus[target + 'Ack'] = 'completed';
                            else if (ok === false) ackStatus[target + 'Ack'] = 'failed';
                        }
                        if (Object.keys(ackStatus).length > 0) {
                            _db.ref('autopsy-requested/' + topic.topicId).update(ackStatus).catch(() => {});
                        }

                        await setState('ack_sent');
                    } catch (err) {
                        console.warn('[AUTOPSY-MON] Acknowledgement error: ' + err.message);
                    }
                }

                // Step 4: Update counters
                if (state === 'ack_sent') {
                    try {
                        const countKey = parsed.faction === 'LSPD' ? 'LSPD' : 'LSSD';
                        const countRef = _db.ref(`autopsy-requests/${countKey}/count`);
                        const countSnap = await countRef.once('value');
                        const newCount = (countSnap.val() || 0) + 1;
                        await countRef.set(newCount);
                        await _db.ref(`autopsy-requests/${countKey}/lastUpdated`).set(Date.now());
                        console.log(`[AUTOPSY-MON] Counters updated — ${countKey}: ${newCount}`);
                    } catch (err) {
                        console.warn(`[AUTOPSY-MON] Counter update: ${err.message}`);
                    }
                    await setState('complete');
                }

            } catch (err) {
                console.error(`[AUTOPSY-MON] Case creation error: ${err.message}`);
            }

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
                    updates['autopsy-requests/LSPD/count'] = lspdCount + newLspd;
                    updates['autopsy-requests/LSPD/lastUpdated'] = new Date().toISOString();
                }
                if (newLssd > 0) {
                    updates['autopsy-requests/LSSD/count'] = lssdCount + newLssd;
                    updates['autopsy-requests/LSSD/lastUpdated'] = new Date().toISOString();
                }
                await _db.ref().update(updates);
                console.log(`[AUTOPSY-MON] Counters updated — LSPD: ${lspdCount + newLspd}, LSSD: ${lssdCount + newLssd}`);
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

// ── Autopsy Request Field Parser ──

/**
 * Parse structured fields from an autopsy request post's BBCode.
 * The request template has labeled sections like "1.) Name: ANSWER".
 * Returns a flat object of extracted fields.
 */
export function parseAutopsyRequestBbcode(bbcode) {
    const fields = {};
    if (!bbcode) return fields;

    // Section 2: Decedent info
    const patterns = {
        decedentName: /1\.\)\s*Name:\s*(.+)/i,
        sex: /2\.\)\s*Gender:\s*(.+)/i,
        ethnicity: /3\.\)\s*Ethnicity:\s*(.+)/i,
        dateOfDeath: /4\.\)\s*Date of Death:\s*(.+)/i,
        timeOfDeath: /5\.\)\s*Time of Death:\s*(.+)/i,
        placeOfDeath: /6\.\)\s*Location:\s*(.+)/i,
        // Requester info (Section 1)
        requesterName: /1\.\)\s*Name:\s*(.+)/i,
        requesterDept: /3\.\)\s*Department\s*\/\s*Assignment:\s*(.+)/i,
        // Details (Section 3)
        synopsis: /1\.\)\s*Synopsis:\s*(.+)/i,
        causeDetail: /2\.\)\s*Reason for Autopsy:\s*(.+)/i,
        // OOC (Section 4)
        deathType: /1\.\)\s*PK\/CK:\s*(.+)/i,
    };

    // Simple line-by-line extraction
    const lines = bbcode.split('\n');
    let currentSection = null;

    for (const line of lines) {
        const trimmed = line.replace(/\[.*?\]/g, '').trim();
        if (trimmed.includes('SECTION 1')) { currentSection = 'requester'; continue; }
        if (trimmed.includes('SECTION 2')) { currentSection = 'decedent'; continue; }
        if (trimmed.includes('SECTION 3')) { currentSection = 'details'; continue; }
        if (trimmed.includes('SECTION 4') || trimmed.includes('OOC INFORMATION')) { currentSection = 'ooc'; continue; }

        if (currentSection === 'decedent') {
            const m1 = trimmed.match(/1\.\)\s*Name:\s*(.+)/i);
            if (m1) fields.decedentName = m1[1].trim();
            const m2 = trimmed.match(/2\.\)\s*Gender:\s*(.+)/i);
            if (m2) {
                let val = m2[1].trim();
                if (/^M$/i.test(val)) val = 'Male';
                else if (/^F$/i.test(val)) val = 'Female';
                fields.sex = val;
            }
            const m3 = trimmed.match(/3\.\)\s*Ethnicity:\s*(.+)/i);
            if (m3) fields.ethnicity = m3[1].trim();
            const m4 = trimmed.match(/4\.\)\s*Date of Death:\s*(.+)/i);
            if (m4) fields.dateOfDeath = m4[1].trim();
            const m5 = trimmed.match(/5\.\)\s*Time of Death:\s*(.+)/i);
            if (m5) fields.timeOfDeath = m5[1].trim();
            const m6 = trimmed.match(/6\.\)\s*Location:\s*(.+)/i);
            if (m6) fields.placeOfDeath = m6[1].trim();
        }

        if (currentSection === 'requester') {
            const m1 = trimmed.match(/1\.\)\s*Name:\s*(.+)/i);
            if (m1) fields.requesterName = m1[1].trim();
            const m3 = trimmed.match(/3\.\)\s*Department\s*\/\s*Assignment:\s*(.+)/i);
            if (m3) fields.requesterDept = m3[1].trim();
        }

        if (currentSection === 'details') {
            const s1 = trimmed.match(/1\.\)\s*Synopsis:\s*(.+)/i);
            if (s1) fields.synopsis = s1[1].trim();
            const s2 = trimmed.match(/2\.\)\s*Reason for Autopsy:\s*(.+)/i);
            if (s2) fields.causeDetail = s2[1].trim();
        }

        if (currentSection === 'ooc') {
            const o1 = trimmed.match(/1\.\)\s*PK\/CK:\s*(.+)/i);
            if (o1) fields.deathType = o1[1].trim();
        }
    }

    return fields;
}

// ── Acknowledgement Template ──

const ACK_TEMPLATE = `[divbox=white][center][img]https://i.imgur.com/Hxjt4M2.png[/img][/center]
[hr][/hr]
[bold][br][/br]Autopsy Request - Under Investigation[/bold]

Dear REQUESTING_NAME,

We have received your autopsy request and it is currently under thorough investigation. Our team is diligently reviewing all pertinent information and conducting the necessary examinations to ensure a comprehensive and accurate analysis.

During this investigation, we will schedule the decedent for autopsy, which can take up to 5 working days, unless deemed a critically urgent autopsy, if urgent, you must inform the Department in advance.

[i]Kind regards,[/i]
[hr][/hr]
[bold]Office of the Forensic Medicine Division[/bold]
Department of Forensic Medicine and Pathology

[bold]Pillbox Hill Medical Center[/bold]
[size=85]Elgin Avenue/Strawberry Avenue, Pillbox Hill, Los Santos, SA
Phone: 61122335
Mail:[url=https://phmc.gta.world/ucp.php?i=pm&mode=compose][color=#808080]medical.examiners@phmc.health[/color][/url]
Website: [url][color=#808080]www.phmc.health[/color][/url][/size]
[br][/br]
[center][img]https://imgur.com/vztjYpe.png[/img][/center]
[br][/br][/divbox]`;

/**
 * Send an acknowledgement reply to the autopsy request topic (and LSSD/LSPD if applicable).
 * Called after case creation + assignment in the detection flow.
 */
export async function sendAutopsyAcknowledgement(topicId, requesterName, bbCode, { baseUrl, lssdTopicId, lspdTopicId } = {}) {
    const client = getForumClient();
    const name = requesterName || 'Requesting Party';
    const ackBbcode = ACK_TEMPLATE.replace('REQUESTING_NAME', name);
    const results = { phmc: null, lssd: null, lspd: null };

    // Reply to PHMC autopsy request topic
    try {
        const r = await client.replyToTopic(topicId, 265, ackBbcode, { dryRun: false, baseUrl: baseUrl || PHMC_BASE });
        results.phmc = r.ok;
        console.log(`[AUTOPSY-MON] Ack reply to PHMC #${topicId}: ${r.ok ? 'OK' : 'FAIL'}`);
    } catch (err) {
        console.error(`[AUTOPSY-MON] Ack PHMC reply failed: ${err.message}`);
    }

    // Reply to LSSD forum if a topic ID was provided
    if (lssdTopicId) {
        try {
            const client_lssd = getForumClient();
            await client_lssd.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: 'https://lssd.gta.world' });
            const r = await client_lssd.replyToTopic(lssdTopicId, 2263, ackBbcode, { dryRun: false, baseUrl: 'https://lssd.gta.world' });
            results.lssd = r.ok;
            console.log(`[AUTOPSY-MON] Ack reply to LSSD #${lssdTopicId}: ${r.ok ? 'OK' : 'FAIL'}`);
        } catch (err) {
            console.error(`[AUTOPSY-MON] Ack LSSD reply failed: ${err.message}`);
        }
    } else {
        console.log('[AUTOPSY-MON] Step 3 — LSSD ack reply skipped (no LSSD topic ID)');
    }

    // Reply to LSPD forum if a topic ID was provided
    if (lspdTopicId) {
        try {
            const client_lspd = getForumClient();
            await client_lspd.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: true, baseUrl: 'https://lspd.gta.world' });
            const r = await client_lspd.replyToTopic(lspdTopicId, 1361, ackBbcode, { dryRun: false, baseUrl: 'https://lspd.gta.world' });
            results.lspd = r.ok;
            console.log(`[AUTOPSY-MON] Ack reply to LSPD #${lspdTopicId}: ${r.ok ? 'OK' : 'FAIL'}`);
        } catch (err) {
            console.error(`[AUTOPSY-MON] Ack LSPD reply failed: ${err.message}`);
        }
    } else {
        console.log('[AUTOPSY-MON] Step 3 — LSPD ack reply skipped (no LSPD topic ID)');
    }

    return results;
}

// ── Lifecycle ──

/**
 * Initialize the rotation list from the forum ME group at startup.
 * Fire-and-forget — never blocks or throws.
 */
async function initializeRotationAtStartup() {
    try {
        const { getRotationStatus, initializeRotationFromGroup } = await import('./autopsyRotation.js');
        const status = await getRotationStatus(_db);
        if (!status.configured) {
            const client = getForumClient();
            const memberList = await client.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'] });
            await initializeRotationFromGroup(_db, memberList);
            if (memberList.length > 0) {
                console.log(`[AUTOPSY-MON] Auto-initialized rotation list: ${memberList.map(m => m.name).join(', ')}`);
            }
        }
    } catch (err) {
        console.warn(`[AUTOPSY-MON] Rotation auto-init skipped (non-fatal): ${err.message}`);
    }

    // Rebuild active case counts from scratch every startup.
    // This picks up legacy assignments + catches any drift between restarts.
    // Uses set() (not increment) so it's always correct regardless of how many
    // times it runs — no double-counting.
    try {
        const snap = await _db.ref('autopsy-requested').once('value');
        const entries = snap.val() || {};

        // Build per-ME assignment data from scratch
        const assignments = {};
        for (const [topicId, entry] of Object.entries(entries)) {
            if (entry.assignedTo && !entry.completedAt) {
                const key = entry.assignedTo.toLowerCase();
                if (!assignments[key]) {
                    assignments[key] = { active: 0, cases: {}, lastAssigned: 0 };
                }
                assignments[key].active++;
                assignments[key].cases[topicId] = {
                    assignedAt: entry.detectedAt ? new Date(entry.detectedAt).getTime() : Date.now(),
                    caseNum: entry.caseNum || '',
                };
                // Track the most recent assignment timestamp
                const ts = entry.detectedAt ? new Date(entry.detectedAt).getTime() : 0;
                if (ts > assignments[key].lastAssigned) {
                    assignments[key].lastAssigned = ts;
                }
            }
        }

        await _db.ref('autopsy-requests/assignments').set(assignments);
        const total = Object.keys(assignments).length;
        const totalCases = Object.values(assignments).reduce((s, a) => s + a.active, 0);
        if (totalCases > 0) {
            console.log(`[AUTOPSY-MON] Rebuilt assignment counts: ${total} ME(s) with ${totalCases} active case(s)`);
        }
        // Retry any failed assignment replies from previous sessions
        try {
            // Load member list for user_id lookup in quote tags
            const cc = getForumClient();
            let memberList = [];
            try {
                memberList = await cc.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'] });
            } catch (e) {
                console.warn(`[AUTOPSY-MON] Could not load member list for retry: ${e.message}`);
            }

            let retried = 0;
            for (const [topicId, entry] of Object.entries(entries)) {
                if (entry.assignedTo && entry.assignmentReplyStatus !== 'completed' && !entry.completedAt) {
                    const caseTopicId = entry.caseTopicId;
                    if (!caseTopicId) continue;

                    // Look up user ID for the quote tag
                    const member = memberList.find(m => m.name.toLowerCase() === entry.assignedTo.toLowerCase());
                    const uid = member?.userId || '0';
                    const assignBBCode = `[quote="${entry.assignedTo}" user_id=${uid}]\n[/quote]\n\n[b]${entry.assignedTo}[/b] - You have been assigned this autopsy case file.`;

                    const r = await cc.replyToTopic(caseTopicId, 266, assignBBCode, { dryRun: false, baseUrl: PHMC_BASE });
                    if (r.ok) {
                        await _db.ref(`autopsy-requested/${topicId}/assignmentReplyStatus`).set('completed').catch(() => {});
                        console.log(`[AUTOPSY-MON] Retried assignment reply for ${entry.assignedTo} on #${caseTopicId} — OK`);

                        // Also update the topic title if it still has UNASSIGNED
                        if (entry.caseTitle && entry.caseTitle.includes('UNASSIGNED')) {
                            const newTitle = entry.caseTitle.replace('- UNASSIGNED', `- ${entry.assignedTo}`);
                            try {
                                await cc.editTopicTitle(caseTopicId, 266, newTitle, { baseUrl: PHMC_BASE });
                                await _db.ref(`autopsy-requested/${topicId}/caseTitle`).set(newTitle).catch(() => {});
                                console.log(`[AUTOPSY-MON] Retry also updated case title: "${newTitle}"`);
                            } catch (e) {
                                console.warn(`[AUTOPSY-MON] Retry title update failed: ${e.message}`);
                            }
                        }

                        retried++;
                    } else {
                        console.warn(`[AUTOPSY-MON] Retry assignment reply failed for ${entry.assignedTo} on #${caseTopicId}: ${r.reason || 'Unknown'}`);
                    }
                }
            }
            if (retried > 0) console.log(`[AUTOPSY-MON] Retried ${retried} failed assignment reply/ies`);
        } catch (err) {
            console.warn(`[AUTOPSY-MON] Assignment reply retry skipped: ${err.message}`);
        }
    } catch (err) {
        console.warn(`[AUTOPSY-MON] Assignment rebuild skipped: ${err.message}`);
    }
}

// ── PHMC Forum PM Monitor ──

const PM_CHECK_INTERVAL_MS = 5 * 60 * 1000;
let _seenPmIds = new Set();
let _pmTimer = null;

/**
 * Passively check the PHMC forum PM inbox for new messages.
 * Logs new PMs to bot-spam for observation — takes no other action.
 * Fire-and-forget, never throws.
 */
async function checkPrivateMessages() {
    try {
        const client = getForumClient();
        const pms = await client.getPrivateMessages({ baseUrl: PHMC_BASE });

        const newPms = pms.filter((pm) => !_seenPmIds.has(pm.msgId));
        if (newPms.length === 0) return;

        for (const pm of pms) _seenPmIds.add(pm.msgId);

        for (const pm of newPms) {
            console.log(`[PM-MON] New PM: "${pm.subject}" from ${pm.sender} (${pm.date})`);
            try {
                await sendLogMessage(null, {
                    title: 'New Forum PM Received',
                    description: [
                        `**Subject:** ${pm.subject}`,
                        `**From:** ${pm.sender}`,
                        `**Date:** ${pm.date}`,
                        `**Status:** ${pm.isNew ? 'Unread' : 'Read'}`,
                        `**PM ID:** \`${pm.msgId}\``,
                    ].join('\n'),
                    color: 0x9b59b6,
                    footer: { text: 'Passive PM monitor — no action taken' },
                    timestamp: new Date().toISOString(),
                });
            } catch (err) {
                console.warn(`[PM-MON] Send failed: ${err.message}`);
            }
        }
    } catch (err) {
        if (!err.message.includes('lock')) {
            console.log(`[PM-MON] Check skipped: ${err.message}`);
        }
    }
}

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

    // Pre-load existing counters from Firebase so the dashboard shows accurate data immediately
    _db.ref('autopsy-requests').once('value').then((snap) => {
        const counters = snap.val() || {};
        _cachedLspdCount = counters.LSPD?.count || 0;
        _cachedLssdCount = counters.LSSD?.count || 0;
    }).catch(() => {});

    // Initialize rotation list from forum group on startup (no-op if already configured)
    // This runs async — doesn't block the first check cycle
    initializeRotationAtStartup();

    // Run the first check immediately.
    // On restart, pending cases with partial state will resume from where they left off.
    checkForNewRequests();

    _monitorTimer = setInterval(() => {
        checkForNewRequests();
    }, CHECK_INTERVAL_MS);

    // Passive PM inbox monitor — disabled by default.
    // Enable by removing the return below. Checks inbox every 5min and logs new PMs to bot-spam.
    // See getPrivateMessages() in forumClient.js and checkPrivateMessages() above.
    if (1) return; // TEMP: disabled — re-enable by removing this line
    const pmIntervalMin = Math.round(PM_CHECK_INTERVAL_MS / 60000);
    setTimeout(async () => {
        try {
            const cc = getForumClient();
            await cc.login(null, null, { force: true, baseUrl: PHMC_BASE });
            console.log('[PM-MON] Startup login complete');
        } catch (e) {
            console.log(`[PM-MON] Startup login: ${e.message}`);
        }
        checkPrivateMessages();
        _pmTimer = setInterval(() => checkPrivateMessages(), PM_CHECK_INTERVAL_MS);
    }, 3000);
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
