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

// Autopsy Request - Name ((OOC Name)) - [LSPD/LSSD] OR - LSPD/LSSD (brackets optional)
// Handles various dash characters and flexible spacing
const TITLE_REGEX = /^Autopsy\s+Request\s*[-–—]\s*(.+?)\s*\(\((.+?)\)\)\s*[-–—]?\s*\[?(LSPD|LSSD)\]?/i;

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
            // Skip already-processed topics
            if (processed[topic.topicId]) continue;

            const parsed = parseTopicTitle(topic.title);
            let parsedBbFields = {}; // will hold BBCode-parsed fields (requester name, etc.)

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
                const caseTitle = `Case${caseNumStr} - ${parsed.name} ((${parsed.oocName}))${factionTag} - UNASSIGNED`;
                const isDryRun = process.env.AUTOPSY_DRY_RUN !== 'false';

                if (isDryRun) {
                    console.log(`[AUTOPSY-MON] DRY RUN — would create case for #${topic.topicId}`);
                    await sendWebhookSummary(`**[DRY RUN] Autopsy Case Would Be Created**\n${caseTitle}\nTopic: ${topic.href}`);
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
                    await caseRef.child('caseTitle').set(caseTitle);
                    await setState('case_created');

                    await sendWebhookSummary(`**Autopsy Case Created**\n${caseTitle}\n${result.url}`);
                    const ownerId = process.env.BOT_OWNER_ID || '';
                    if (ownerId) await sendLogMessage(`<@${ownerId}> Autopsy case posted: ${caseTitle}`, null);
                }

                const caseUrl = existingEntry.caseUrl || (await caseRef.child('caseUrl').once('value')).val() || '';

                // Step 2: Assign ME via round-robin
                if (state === 'case_created') {
                    await setState('me_assigned');
                    const cc = getForumClient();
                    try {
                        const memberList = await cc.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'] });
                        if (memberList.length > 0) {
                            const busyNames = new Set();
                            Object.values(processed).forEach((c) => {
                                if (c.assignedTo && !c.completedAt) busyNames.add(c.assignedTo.toLowerCase());
                            });
                            let available = memberList.filter(
                                (m) => !busyNames.has(m.name.toLowerCase()) && !loaSet.has(m.name.toLowerCase())
                            );
                            if (available.length === 0) {
                                console.log('[AUTOPSY-MON] All MEs have cases — resetting pool');
                                available = [...memberList];
                            }
                            if (process.env.AUTOPSY_DEV_TEST === 'true') {
                                const devTarget = available.find((m) => m.name.toLowerCase().includes('alyson'));
                                if (devTarget) available = [devTarget];
                            }
                            const idxSnap = await _db.ref('autopsy-requests/lastAssignedIndex').once('value');
                            let lastIdx = idxSnap.val() || 0;
                            const assigned = available[lastIdx % available.length];
                            await _db.ref('autopsy-requests/lastAssignedIndex').set(lastIdx + 1);

                            const tMatch = caseUrl.match(/[?&]t=(\d+)/);
                            if (tMatch) {
                                const uid = assigned.userId || '0';
                                const assignBBCode = `[quote="${assigned.name}" user_id=${uid}]\n[/quote]\n\n[b]${assigned.name}[/b] - You have been assigned this autopsy case file.`;
                                const replyResult = await cc.replyToTopic(tMatch[1], 266, assignBBCode, { dryRun: false, baseUrl: PHMC_BASE });
                                await caseRef.child('assignedTo').set(assigned.name);
                                if (replyResult.ok) {
                                    console.log(`[AUTOPSY-MON] Assigned ${assigned.name} to case #${tMatch[1]} (${available.length} available)`);
                                    const newTitle = caseTitle.replace('- UNASSIGNED', `- ${assigned.name}`);
                                    await cc.editTopicTitle(tMatch[1], 266, newTitle, { baseUrl: PHMC_BASE });
                                } else {
                                    console.warn(`[AUTOPSY-MON] Assignment reply failed for ${assigned.name} — saved to Firebase`);
                                }
                            }
                        } else {
                            console.log('[AUTOPSY-MON] No ME members available to assign');
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
                        if (parsed.faction === 'LSSD') {
                            try {
                                const lssdClient = getForumClient();
                                await lssdClient.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: 'https://lssd.gta.world' });
                                const lssdResults = await lssdClient.searchForum(`(( ${parsed.oocName} ))`, null, { baseUrl: 'https://lssd.gta.world' });
                                if (lssdResults.length > 0) {
                                    lssdAckTopicId = lssdResults[0].topicId;
                                    console.log(`[AUTOPSY-MON] Found LSSD topic #${lssdAckTopicId} for acknowledgement`);
                                    // Store for later use by the completion flow
                                    _db.ref(`autopsy-requested/${topic.topicId}/lssdRequestTopicId`).set(lssdAckTopicId).catch(() => {});
                                }
                            } catch (err) {
                                console.warn(`[AUTOPSY-MON] LSSD ack search error: ${err.message}`);
                            }
                        }
                        const ackResult = await sendAutopsyAcknowledgement(topic.topicId, requesterName, null, { baseUrl: PHMC_BASE, lssdTopicId: lssdAckTopicId });
                        if (ackResult.phmc) console.log('[AUTOPSY-MON] Acknowledgement sent to PHMC #' + topic.topicId);
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
 * Send an acknowledgement reply to the autopsy request topic (and LSSD if applicable).
 * Called after case creation + assignment in the detection flow.
 */
export async function sendAutopsyAcknowledgement(topicId, requesterName, bbCode, { baseUrl, lssdTopicId } = {}) {
    const client = getForumClient();
    const name = requesterName || 'Requesting Party';
    const ackBbcode = ACK_TEMPLATE.replace('REQUESTING_NAME', name);
    const results = { phmc: null, lssd: null };

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
    }

    return results;
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

    // Pre-load existing counters from Firebase so the dashboard shows accurate data immediately
    _db.ref('autopsy-requests').once('value').then((snap) => {
        const counters = snap.val() || {};
        _cachedLspdCount = counters.LSPD?.count || 0;
        _cachedLssdCount = counters.LSSD?.count || 0;
    }).catch(() => {});

    // Run the first check immediately.
    // On restart, pending cases with partial state will resume from where they left off.
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
