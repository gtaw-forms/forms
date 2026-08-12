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
import { searchLssdRequestTopic } from './deployLssd.js';
import { sendLogMessage, notifySelfHeal } from './logChannel.js';
import { selectME, initializeRotationFromGroup, syncRotationFromGroup } from './autopsyRotation.js';

// ── Constants ──

const PHMC_FORUM_ID = 265;
const PHMC_BASE = 'https://phmc.gta.world';
const LSSD_FORUM_ID = 2263;
const LSSD_BASE = 'https://lssd.gta.world';
const LSSD_AUTOPSY_POST_URL = 'https://lssd.gta.world/posting.php?mode=post&f=2263';
const CHECK_INTERVAL_MS = parseInt(process.env.AUTOPSY_MONITOR_INTERVAL || '', 10) || 15 * 60 * 1000;

// Ack status field names in Firebase. Kebab-case for visibility when browsing
// the DB — used by the ack step here and by the auto-recovery retry in autoDeploy.js.
export const ACK_FIELD_NAMES = {
    phmc: 'phmc-acknowledge-reply',
    lssd: 'lssd-acknowledge-reply',
    lspd: 'lspd-acknowledge-reply',
};

// Autopsy Request - Name ((OOC Name)) - [LSPD/LSSD]  OR  [Autopsy Request] Name [Faction]
// Supports: various dash chars, with/without brackets, with/without ((OOC)).
// The name group is a non-empty string WITHOUT parens, so it stops at the first
// ((...)) pair. Extra ((...)) groups (e.g. "((Discord Name: ...))") after the
// OOC are skipped by (?:\(\([^)]*\)\)[\s\S]*?)? before the faction tag.
const TITLE_REGEX = /^(?:\[)?Autopsy\s+Request(?:\])?\s*[-–—]?\s*([^()[\]"']+)(?:\s*\(\(([^()]*)\)\))?[\s\S]*?\[?(LSPD|LSSD)\]?/i;

// ── State ──

let _monitorTimer = null;
let _db = null;
let _isFirstCycle = true;
let _lastCheckTime = null;
let _lastCheckSuccess = false;

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
 * Split a parsed request into individual decedents.
 *
 * Multi-decedent requests appear in three shapes:
 *   "John Doe ((Dylan Bongo, Marvion Futrell))" — 1 IC name, N OOC names
 *   "John Doe, Jane Doe ((OOC Name))"           — N IC names, 1 OOC name
 *   "John Doe, Jane Doe ((A, B))"               — N of both (paired by index)
 *
 * Single-name requests return one decedent with the original values, so the
 * existing single-case flow is untouched.
 *
 * @param {{ name: string, oocName: string }} parsed
 * @returns {Array<{ name: string, oocName: string }>}
 */
function splitDecedents(parsed) {
    const nameParts = String(parsed.name || '').split(',').map(s => s.trim()).filter(Boolean);
    const oocParts = String(parsed.oocName || '').split(',').map(s => s.trim()).filter(Boolean);

    let decedents;
    if (nameParts.length <= 1 && oocParts.length <= 1) {
        decedents = [{ name: parsed.name, oocName: parsed.oocName }];
    } else if (nameParts.length <= 1) {
        decedents = oocParts.map(o => ({ name: parsed.name, oocName: o }));
    } else if (oocParts.length <= 1) {
        decedents = nameParts.map(n => ({ name: n, oocName: parsed.oocName }));
    } else {
        // Both sides have multiple names — pair by index, trailing extras reuse
        // the last OOC name so no decedent is ever dropped.
        decedents = nameParts.map((n, i) => ({
            name: n,
            oocName: oocParts[i] || oocParts[oocParts.length - 1],
        }));
    }
    parsed.decedents = decedents;
    return decedents;
}

/**
 * Parse a forum topic title to extract autopsy request details.
 * @param {string} title
 * @returns {{ name: string, oocName: string, faction: string, decedents: Array<{ name: string, oocName: string }> } | null}
 */
function parseTopicTitle(title) {
    const match = title.trim().match(TITLE_REGEX);
    if (!match) return null;
    const parsed = {
        name: (match[1] || '').trim(),
        oocName: (match[2] || '').trim(),
        faction: match[3] ? match[3].toUpperCase() : '',
    };
    splitDecedents(parsed);
    return parsed;
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

        // Load current LOA list from Firebase
        let loaSet = new Set();
        try {
            const loaSnap = await _db.ref('autopsy-requests/loa').once('value');
            const loa = loaSnap.val() || {};
            Object.entries(loa).forEach(([name, val]) => {
                if (val === true) loaSet.add(name.toLowerCase());
            });
        } catch (err) {
            console.error('[AUTOPSY-MON] Failed to read LOA list:', err.message);
        }

        const newRequests = [];

        for (const topic of topics) {
            // Skip topics already being processed by the state machine
            // (has caseState = actively being worked on)
            // This allows re-processing of entries saved during the first cycle
            // (which have wasMatch=true but no caseState set)
            const prevEntry = processed[topic.topicId];
            if (prevEntry && prevEntry.caseState) continue;

            let parsed = parseTopicTitle(topic.title);
            let parsedBbFields = {};
            let requestBbCode = '';

            if (!parsed) {
                // ── Body-based fallback ──
                // The title didn't match the standard format (e.g. "[Autopsy Request]
                // Jane Doe (Abigail Hills)" with no [LSPD]/[LSSD] tag). Fetch the topic
                // body and check whether it actually looks like a REAL autopsy request
                // (with a real decedent name + department) before treating it as a match.
                // Guard against the pinned guidelines/template topic, whose body contains
                // placeholder values like "ANSWER", "EX: LSPD - Homicide", "[NAME]", etc.
                const titleLower = (topic.title || '').toLowerCase();
                const isTemplateTitle = /guideline|template|instructions|example|info\b|\[form\]/.test(titleLower);
                const PLACEHOLDER_RE = /answer|example|ex:\s|ex\.|placeholder|\[name\]|\[ooc\]|xxxx|insert|n\/a\b/i;

                console.log(`[AUTOPSY-MON] Title did not match regex: #${topic.topicId} "${topic.title}" — checking body...`);
                try {
                    const client = getForumClient();
                    const bbcode = await client.getTopicBbcode(topic.topicId, 265, { baseUrl: PHMC_BASE });
                    if (bbcode) {
                        const bodyFields = parseAutopsyRequestBbcode(bbcode);
                        const deptRaw = (bodyFields.requesterDept || '').trim();
                        const nameRaw = (bodyFields.decedentName || '').trim();
                        const hasDept = deptRaw.toLowerCase().includes('lssd') || deptRaw.toLowerCase().includes('lspd');
                        const hasName = !!nameRaw;

                        // Reject template/placeholder bodies — not real requests.
                        const nameLooksReal = hasName && !PLACEHOLDER_RE.test(nameRaw);
                        const deptLooksReal = hasDept && !PLACEHOLDER_RE.test(deptRaw);

                        if (isTemplateTitle) {
                            console.log(`[AUTOPSY-MON] #${topic.topicId} looks like a template/guideline — not a request`);
                        } else if ((hasDept && deptLooksReal) || (hasName && nameLooksReal)) {
                            console.log(`[AUTOPSY-MON] Body confirmed autopsy request for #${topic.topicId} (dept="${deptRaw}", name="${nameRaw}")`);
                            const oocMatch = topic.title.match(/\(\(\s*(.*?)\s*\)\)/) || topic.title.match(/\(\s*(.*?)\s*\)/);
                            // The body's Name field sometimes already includes "(OOC)" —
                            // strip it so the case title doesn't show a duplicate.
                            let cleanName = (nameLooksReal ? nameRaw : '');
                            if (oocMatch && oocMatch[1]) {
                                cleanName = cleanName.replace(/\(\s*[\w.'\-\s]+\)/g, '').trim();
                            }
                            if (!cleanName) {
                                cleanName = topic.title.replace(/^(?:\[)?Autopsy\s+Request(?:\])?\s*[-–—]?\s*/i, '').replace(/\(\(.*?\)\)/g, '').replace(/\(.*?\)/g, '').trim() || topic.title;
                            }
                            parsed = {
                                name: cleanName,
                                oocName: (oocMatch && oocMatch[1] ? oocMatch[1].trim() : ''),
                                faction: deptRaw.toLowerCase().includes('lssd') ? 'LSSD'
                                    : deptRaw.toLowerCase().includes('lspd') ? 'LSPD'
                                    : '',
                            };
                            splitDecedents(parsed);
                            parsedBbFields = bodyFields;
                            requestBbCode = bbcode;
                            // NOTE: do NOT pre-save requestBbCode/parsed as child nodes here —
                            // the main flow's `set(entry)` below replaces the whole node and
                            // would wipe them. They're attached to `entry` instead (below).
                            // Fall through to the normal match-processing path below.
                        }
                    }
                } catch (err) {
                    console.warn(`[AUTOPSY-MON] Body fallback error for #${topic.topicId}: ${err.message}`);
                }

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
                // If the body fallback already parsed the request, persist those fields
                // with the entry (a later `set` here would otherwise overwrite them).
                ...(requestBbCode ? { requestBbCode, parsed: parsedBbFields } : {}),
                // Preserve crosspost topic ids across reprocessing so a re-run
                // REUSES the existing LSPD/LSSD topics instead of duplicating them
                // (e.g. resetting a botched request to re-run with a fixed parser).
                ...(prevEntry?.lspdTopicId ? { lspdTopicId: prevEntry.lspdTopicId } : {}),
                ...(prevEntry?.lssdRequestTopicId ? { lssdRequestTopicId: prevEntry.lssdRequestTopicId } : {}),
                ...(prevEntry?.lssdRequestCreatedByBot ? { lssdRequestCreatedByBot: true } : {}),
            };

            await _db.ref(`autopsy-requested/${topic.topicId}`).set(entry);

            console.log(`[AUTOPSY-MON] Saved: ${topic.title}`);

            // Parse and store structured fields from the request post.
            // Skipped when the body-based fallback already populated them above.
            if (!requestBbCode) {
            try {
                console.log(`[AUTOPSY-MON] Fetching BBCode for #${topic.topicId}...`);
                const client = getForumClient();
                const bbcode = await client.getTopicBbcode(topic.topicId, 265, { baseUrl: PHMC_BASE });
                if (bbcode) {
                    parsedBbFields = parseAutopsyRequestBbcode(bbcode);
                    requestBbCode = bbcode;
                    // Save the raw request BBCode for later crosspost use (LSPD/LSSD forum topics)
                    await _db.ref(`autopsy-requested/${topic.topicId}/requestBbCode`).set(bbcode).catch(() => {});
                    if (Object.keys(parsedBbFields).length > 0) {
                        await _db.ref(`autopsy-requested/${topic.topicId}/parsed`).set(parsedBbFields);
                        console.log(`[AUTOPSY-MON] Parsed ${Object.keys(parsedBbFields).length} fields from request`);
                    }
                }
            } catch (err) {
                console.warn(`[AUTOPSY-MON] Parse error for #${topic.topicId}: ${err.message}`);
            }
            }

            // ── Create Case Management entry (state machine — resumes on restart) ──
            // Multi-decedent requests ("Name ((A, B))" or numbered Section 2
            // bodies: "John Doe[1]((OOC A))", "John Doe[2]((OOC B))") are split
            // into one case per decedent, each with its own ME assignment.
            // Single-decedent requests keep the original top-level state
            // machine unchanged.
            //
            // The request BODY is the authoritative source (the template
            // explicitly numbers multiple bodies); fall back to the title's
            // comma split when the body wasn't parseable.
            const bodyDecedents = parsedBbFields.decedentNames && parsedBbFields.decedentNames.length > 1
                ? parsedBbFields.decedentNames.map(d => ({ name: d.name, oocName: d.oocName, marker: d.marker }))
                : null;
            const decedents = bodyDecedents
                || ((parsed.decedents && parsed.decedents.length > 0) ? parsed.decedents : [{ name: parsed.name, oocName: parsed.oocName }]);

            if (decedents.length > 1) {
                try {
                    await processMultiDecedentRequest({
                        db: _db, topic, parsed, decedents, requestBbCode, parsedBbFields, loaSet, processed,
                    });
                } catch (err) {
                    console.error(`[AUTOPSY-MON] Multi-decedent case creation error: ${err.message}`);
                }
            } else {
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
                        continue;
                    }
                    console.log(`[AUTOPSY-MON] Case created: ${result.url}`);
                    await caseRef.child('caseUrl').set(result.url);
                    const tMatch = result.url.match(/[?&]t=(\d+)/);
                    if (tMatch) await caseRef.child('caseTopicId').set(tMatch[1]);
                    await caseRef.child('caseTitle').set(caseTitle);
                    await setState('case_created');
                }

                const caseUrl = existingEntry.caseUrl || (await caseRef.child('caseUrl').once('value')).val() || '';

                // Step 2: Assign ME via fair rotation
                // assignedName is declared here (loop scope) so the notification
                // block and Step 3 below can read it regardless of the state path.
                let assignedName = null;
                if (state === 'case_created') {
                    await setState('me_assigned');
                    const cc = getForumClient();
                    try {
                        // Fetch group members (needed for user IDs in BBCode and to optionally init rotation)
                        const memberList = await cc.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'], paginate: true });

                        // Auto-init rotation list from forum group on first run (no-op if already set)
                        await initializeRotationFromGroup(_db, memberList);

                        // Check for new/departed MEs and update rotation dynamically
                        const syncResult = await syncRotationFromGroup(_db, memberList);
                        if (syncResult && (syncResult.added.length > 0 || syncResult.removed.length > 0)) {
                            const msg = [
                                syncResult.added.length > 0 ? `New MEs added to rotation: ${syncResult.added.join(', ')}` : '',
                                syncResult.removed.length > 0 ? `Removed from rotation: ${syncResult.removed.join(', ')}` : '',
                            ].filter(Boolean).join(' | ');
                            console.log(`[ROTATION] ${msg}`);
                            try { await sendLogMessage(`[ROTATION] ${msg}`); } catch { /* ignore */ }
                        }

                        // Supervised final-autopsy requests carry an explicit
                        // "ASSIGNED: <ME> for Final Autopsy Exams" marker — honor it
                        // (unless that ME is on LOA), otherwise use the fair rotation.
                        const overrideRaw = (parsedBbFields.assignedOverride || '').trim();
                        const overrideName = overrideRaw.replace(/\s+for\s+Final\s+Autopsy\s+Exams.*$/i, '').trim();
                        const overrideLoa = overrideName ? loaSet.has(overrideName.toLowerCase()) : false;
                        if (overrideName && !overrideLoa) {
                            assignedName = overrideName;
                            console.log(`[AUTOPSY-MON] Assigned-override ME for #${topic.topicId}: ${assignedName}`);
                        } else {
                            if (overrideName && overrideLoa) {
                                console.warn(`[AUTOPSY-MON] Assigned-override ME "${overrideName}" is on LOA — falling back to rotation`);
                            }
                            // Use the rotation-based selection (handles recency, load balance, surge)
                            assignedName = await selectME(_db, topic.topicId, caseNum);
                        }

                        if (assignedName) {
                            const tMatch = caseUrl.match(/[?&]t=(\d+)/);
                            if (tMatch) {
                                const member = memberList.find(m => m.name.toLowerCase() === assignedName.toLowerCase());
                                const uid = member?.userId || '0';
                                const assignBBCode = `[quote="${assignedName}" user_id=${uid}]\n[/quote]\n\n[b]${assignedName}[/b] - You have been assigned this autopsy case file.`;
                                // Mark 'attempting' BEFORE posting so the recovery sweep
                                // doesn't double-post while this reply is mid-flight.
                                await caseRef.child('assignmentReplyStatus').set('attempting').catch(() => {});
                                const replyResult = await cc.replyToTopic(tMatch[1], 266, assignBBCode, { dryRun: false, baseUrl: PHMC_BASE });
                                await caseRef.child('assignedTo').set(assignedName);
                                if (replyResult.ok) {
                                    console.log(`[AUTOPSY-MON] Assigned ${assignedName} to case #${tMatch[1]}`);
                                    const newTitle = caseTitle.replace('- UNASSIGNED', `- ${assignedName}`);
                                    await cc.editTopicTitle(tMatch[1], 266, newTitle, { baseUrl: PHMC_BASE });
                                    // Save the updated title to Firebase so the completion flow uses the clean title
                                    await caseRef.child('caseTitle').set(newTitle).catch(() => {});
                                    await caseRef.child('assignmentReplyStatus').set('completed').catch(() => {});
                                    // Tag the assigned ME on Discord (if a mapping exists)
                                    try {
                                        const { notifyAssignment } = await import('./meDiscordNotify.js');
                                        await notifyAssignment(_db, assignedName, newTitle || caseTitle, caseUrl);
                                    } catch (err) {
                                        console.warn(`[AUTOPSY-MON] ME Discord notify failed: ${err.message}`);
                                    }
                                } else {
                                    const reason = replyResult.reason || replyResult.url || 'unknown';
                                    console.warn(`[AUTOPSY-MON] Assignment reply failed for ${assignedName} — reason: ${reason} — will retry next cycle`);
                                    await caseRef.child('assignmentReplyStatus').set('failed').catch(() => {});
                                    // Reset caseState so the state machine retries this on the next cycle
                                    await caseRef.child('caseState').set('case_created').catch(() => {});
                                }
                            }
                        } else {
                            console.log('[AUTOPSY-MON] No ME available to assign — check rotation list and LOA status');
                        }
                    } catch (err) {
                        console.error(`[AUTOPSY-MON] Assignment error: ${err.message}`);
                    }
                }

                // ── Consolidated notification (fires once after assignment completes) ──
                const assignedLabel = assignedName ? `- ${assignedName}` : '- UNASSIGNED';
                const notifTitle = caseTitle
                    ? caseTitle.replace('- UNASSIGNED', assignedLabel)
                    : `Case ${caseNumStr} - ${parsed.name}${oocPart}${factionTag} ${assignedLabel}`;
                const finalCaseUrl = caseUrl || (await caseRef.child('caseUrl').once('value')).val() || '';
                await sendWebhookSummary(`**Autopsy Case Created**\n${notifTitle}\n${finalCaseUrl}`);
                const ownerId = process.env.BOT_OWNER_ID || '';
                if (ownerId) {
                    const ping = assignedName ? `Assigned to: ${assignedName}` : 'No ME available — still UNASSIGNED';
                    await sendLogMessage(`<@${ownerId}> Autopsy case posted: ${notifTitle} — ${ping}`, null);
                }

                // Step 3: Send acknowledgement reply
                if (state === 'me_assigned') {
                    try {
                        const requesterName = parsedBbFields.requesterName || parsed.name || '';
                        let lssdAckTopicId = null;
                        let lspdTopicId = null;  // declared here for access in the ack call below

                        // --- LSSD: Search for existing request topic for acknowledgement reply ---
                        // LSSD auto-crossposts their own requests (CASELINK), so we search the
                        // dedicated LSSD autopsy forum (f=2263) — "Name (( OOC ))" first, then plain name.
                        // If no topic exists AND the request is NOT from CASELINK (a human officer
                        // who only posted on the PHMC forum), create the LSSD topic ourselves so the
                        // completion crosspost always has a target. We NEVER create one for CASELINK
                        // requests — CASELINK creates its own topic, and duplicating it would break
                        // the LSSD tracking.
                        if (parsed.faction === 'LSSD' && (parsed.oocName || parsed.name)) {
                            try {
                                const lssdClient = getForumClient();
                                await lssdClient.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: LSSD_BASE });
                                const lssdResult = await searchLssdRequestTopic(lssdClient, { oocName: parsed.oocName, name: parsed.name });
                                if (lssdResult) {
                                    lssdAckTopicId = lssdResult.topicId;
                                    console.log('[AUTOPSY-MON] Found LSSD topic #' + lssdAckTopicId + ' for acknowledgement');
                                    _db.ref('autopsy-requested/' + topic.topicId + '/lssdRequestTopicId').set(lssdAckTopicId).catch(() => {});
                                } else {
                                    console.log('[AUTOPSY-MON] Step 3 — LSSD topic search returned no results for ' + (parsed.oocName || parsed.name) + '; checking poster for CASELINK...');
                                    // Only create the topic when we can POSITIVELY confirm the PHMC
                                    // request poster is a human (not CASELINK). If the poster can't be
                                    // resolved, skip creation to guarantee we never duplicate a
                                    // CASELINK topic — the recovery sweep / manual handling covers it.
                                    try {
                                        const phmcClient = getForumClient();
                                        const poster = await phmcClient.getTopicPoster(topic.topicId, { baseUrl: PHMC_BASE });
                                        const isCaselink = !!(poster && /caselink/i.test(poster));
                                        console.log('[AUTOPSY-MON] Step 3 — PHMC request poster: "' + (poster || 'unknown') + '" (caselink: ' + isCaselink + ')');

                                        if (isCaselink) {
                                            console.log('[AUTOPSY-MON] Step 3 — CASELINK request — LSSD creates its own topic; skipping creation to avoid duplication');
                                        } else if (!poster) {
                                            console.warn('[AUTOPSY-MON] Step 3 — Could not resolve request poster — skipping LSSD topic creation to avoid duplicating a potential CASELINK topic. Handle manually or via recovery sweep.');
                                        } else {
                                            // Non-caselink (human) request. Re-search once more right
                                            // before creating to close any CASELINK race window.
                                            const recheck = await searchLssdRequestTopic(lssdClient, { oocName: parsed.oocName, name: parsed.name });
                                            if (recheck) {
                                                lssdAckTopicId = recheck.topicId;
                                                console.log('[AUTOPSY-MON] Step 3 — LSSD topic appeared during recheck: #' + lssdAckTopicId);
                                                _db.ref('autopsy-requested/' + topic.topicId + '/lssdRequestTopicId').set(lssdAckTopicId).catch(() => {});
                                            } else {
                                                const lssdTopicTitle = 'Autopsy Request - ' + parsed.name + (parsed.oocName ? ' ((' + parsed.oocName + '))' : '') + ' [LSSD]';
                                                const lssdTopicBody = requestBbCode
                                                    ? '[divbox=white][center][b][size=170]AUTOPSY REQUEST — CERTIFIED COPY [/size][/b][/center][hr][/hr]\n' + requestBbCode + '\n[hr][/hr][b]Case:[/b] ' + caseTitle + '\n[b]Status:[/b] Under Investigation\n[/divbox]'
                                                    : '[divbox=white][b]Autopsy Request[/b]\n[b]Decedent:[/b] ' + parsed.name + (parsed.oocName ? ' ((' + parsed.oocName + '))' : '') + '\n[b]Case:[/b] ' + caseTitle + '\n[b]Status:[/b] Under Investigation\n[/divbox]';
                                                const lssdPostResult = await lssdClient.postTopic(LSSD_FORUM_ID, lssdTopicTitle, lssdTopicBody, LSSD_AUTOPSY_POST_URL);
                                                if (lssdPostResult.ok) {
                                                    const tM = lssdPostResult.url.match(/[?&]t=(\d+)/);
                                                    if (tM) {
                                                        lssdAckTopicId = tM[1];
                                                        console.log('[AUTOPSY-MON] Created LSSD topic #' + lssdAckTopicId + ' for non-caselink request');
                                                        _db.ref('autopsy-requested/' + topic.topicId + '/lssdRequestTopicId').set(lssdAckTopicId).catch(() => {});
                                                        _db.ref('autopsy-requested/' + topic.topicId + '/lssdRequestCreatedByBot').set(true).catch(() => {});
                                                        _db.ref('autopsy-requested/' + topic.topicId + '/lssdCrosspostStatus').set('pending').catch(() => {});
                                                    } else {
                                                        console.warn('[AUTOPSY-MON] Step 3 — LSSD topic created but could not extract topic ID from URL: ' + lssdPostResult.url);
                                                    }
                                                } else {
                                                    console.warn('[AUTOPSY-MON] Step 3 — LSSD topic creation failed: ' + (lssdPostResult.reason || 'unknown'));
                                                }
                                            }
                                        }
                                    } catch (err) {
                                        console.warn('[AUTOPSY-MON] Step 3 — LSSD topic creation error: ' + err.message);
                                    }
                                }
                            } catch (err) {
                                console.warn('[AUTOPSY-MON] LSSD ack search error: ' + err.message);
                            }
                        } else {
                            console.log('[AUTOPSY-MON] Step 3 — LSSD topic search skipped (faction=' + (parsed.faction || 'none') + ', oocName=' + (parsed.oocName || 'none') + ', name=' + (parsed.name || 'none') + ')');
                        }

                        // --- LSPD: Create topic on LSPD forum f=1361 immediately on detection ---
                        if (parsed.faction === 'LSPD') {
                            // Reuse a preserved LSPD topic id (reprocessing after a
                            // reset) instead of creating a duplicate.
                            const existingLspd = existingEntry.lspdTopicId || (await caseRef.child('lspdTopicId').once('value')).val() || '';
                            if (existingLspd) {
                                lspdTopicId = String(existingLspd);
                                console.log('[AUTOPSY-MON] Reusing existing LSPD topic #' + lspdTopicId + ' for request');
                            } else {
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

                        // Save ack status to Firebase for retry tracking.
                        // Visible field names (ACK_FIELD_NAMES) + timestamps, so a
                        // failed/missing ack is easy to spot and auto-retried later.
                        const ackStatus = {};
                        const ackAt = {};
                        const nowIso = new Date().toISOString();
                        for (const [target, ok] of Object.entries(ackResult)) {
                            const field = ACK_FIELD_NAMES[target];
                            if (!field) continue;
                            if (ok === true) ackStatus[field] = 'completed';
                            else if (ok === false) ackStatus[field] = 'failed';
                            if (ok === true || ok === false) ackAt[field + '-at'] = nowIso;
                        }
                        if (Object.keys(ackStatus).length > 0) {
                            _db.ref('autopsy-requested/' + topic.topicId).update({ ...ackStatus, ...ackAt }).catch(() => {});
                            const failedAcks = Object.entries(ackStatus).filter(([, s]) => s === 'failed').map(([f]) => f);
                            if (failedAcks.length > 0) {
                                console.warn(`[AUTOPSY-MON] ⚠️ Ack FAILED for #${topic.topicId}: ${failedAcks.join(', ')} — flagged for automatic retry`);
                            }
                            console.log(`[AUTOPSY-MON] ACK status saved for #${topic.topicId}: ` + Object.entries(ackStatus).map(([f, s]) => `${f}=${s}`).join(', '));
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
            }

            newRequests.push(entry);
        }

        // ── Discord Notifications ──
        if (_isFirstCycle) {
            _lastCheckTime = Date.now();
            _lastCheckSuccess = true;
            if (newRequests.length > 0) {
                await sendNotification(
                    'Autopsy Request Monitor — Initial Scan Complete',
                    `Found **${newRequests.length}** existing request(s) saved to Firebase. New requests will be notified as they appear.`,
                    0x00bcd4
                );
                await sendWebhookSummary(
                    `**Autopsy Monitor — Initial Scan** — ${newRequests.length} existing request(s) registered`
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

/**
 * Case state machine for MULTI-decedent autopsy requests.
 *
 * One request topic with N decedents ("John Doe[1]((OOC A))", "John Doe[2]
 * ((OOC B))") gets N case topics in f=266, each with its own case number,
 * its own fair-rotation ME assignment, and its own per-decedent state under
 * `autopsy-requested/<topicId>/cases/<idx>/`. Crossposts + acknowledgement
 * run ONCE per request after the cases are handled.
 *
 * The top-level record gets `caseState: 'multi'` so detection skips it, plus
 * `decedentCount` and an aggregated `assignedTo` for dashboards.
 */
async function processMultiDecedentRequest({ db, topic, parsed, decedents, requestBbCode, parsedBbFields, loaSet, processed }) {
    const topicId = topic.topicId;
    const rootRef = db.ref(`autopsy-requested/${topicId}`);
    const existing = processed[topicId] || {};
    const isDryRun = process.env.AUTOPSY_DRY_RUN !== 'false';

    // Marker so the detection loop skips this topic on later cycles.
    await rootRef.child('caseState').set('multi').catch(() => {});
    await rootRef.child('decedentCount').set(decedents.length).catch(() => {});

    // ── Shared case-number base (one lookup, sequential per decedent) ──
    let caseBase = existing.caseNum ? parseInt(String(existing.caseNum), 10) : 0;
    if (!existing.caseNum) {
        try {
            const cc = getForumClient();
            await cc.ensureBrowser();
            const existingTopics = await cc.getForumTopics(266, { baseUrl: PHMC_BASE });
            let highest = 0;
            for (const t of existingTopics) {
                const m = t.title.match(/Case\s*(\d+)/i);
                if (m) { const n = parseInt(m[1], 10); if (n > highest) highest = n; }
            }
            caseBase = highest;
            await rootRef.child('caseNum').set(String(caseBase)).catch(() => {});
            console.log(`[AUTOPSY-MON] Highest case: #${caseBase} -> new cases #${caseBase + 1}..${caseBase + decedents.length}`);
        } catch (err) {
            console.warn(`[AUTOPSY-MON] Case number lookup: ${err.message}`);
        }
    }

    const assignedNames = [];
    const caseTitles = [];

    for (let i = 0; i < decedents.length; i++) {
        const decedent = decedents[i];
        const caseRef = db.ref(`autopsy-requested/${topicId}/cases/${i}`);
        const caseNum = String(caseBase + 1 + i);
        const marker = decedent.marker ? `[${decedent.marker}]` : '';
        const oocPart = decedent.oocName ? ` ((${decedent.oocName}))` : '';
        const factionTag = parsed.faction ? ` [${parsed.faction}]` : '';
        const caseTitle = `Case ${caseNum} - ${decedent.name}${marker}${oocPart}${factionTag} - UNASSIGNED`;
        caseTitles.push(caseTitle);

        // Per-case decedent identity — consumed by the web Assigned Autopsies
        // modal so each case shows under its own assigned ME.
        await caseRef.child('name').set(decedent.name).catch(() => {});
        await caseRef.child('oocName').set(decedent.oocName || '').catch(() => {});

        const existingCase = (await caseRef.once('value')).val() || {};
        const caseState = existingCase.caseState || '';
        if (caseState === 'complete' || caseState === 'dry_run') continue;

        if (isDryRun) {
            console.log(`[AUTOPSY-MON] DRY RUN — would create case for ${decedent.name}${marker}${oocPart}`);
            await sendWebhookSummary(`**[DRY RUN] Autopsy Case Would Be Created**\n${caseTitle}\nTopic: ${topic.href}`);
            await caseRef.child('caseState').set('dry_run').catch(() => {});
            continue;
        }

        // ── Step 1: Create the case topic in f=266 ──
        if (caseState === '') {
            console.log(`[AUTOPSY-MON] Creating case: "${caseTitle}"`);
            const cc = getForumClient();
            const result = await cc.quoteAndPost(topic.topicId, 265, 266, caseTitle, { baseUrl: PHMC_BASE });
            if (!result.ok) {
                console.warn(`[AUTOPSY-MON] Case creation failed: ${result.reason || 'unknown'}`);
                continue;
            }
            console.log(`[AUTOPSY-MON] Case created: ${result.url}`);
            await caseRef.child('caseUrl').set(result.url);
            const tMatch = result.url.match(/[?&]t=(\d+)/);
            if (tMatch) await caseRef.child('caseTopicId').set(tMatch[1]);
            await caseRef.child('caseTitle').set(caseTitle);
            await caseRef.child('caseNum').set(caseNum);
            await caseRef.child('caseState').set('case_created');
        }

        const caseUrl = existingCase.caseUrl || (await caseRef.child('caseUrl').once('value')).val() || '';

        // ── Step 2: Assign ME via fair rotation (per decedent) ──
        let assignedName = null;
        if (caseState === 'case_created' || (!existingCase.caseState && caseUrl)) {
            await caseRef.child('caseState').set('me_assigned');
            const cc = getForumClient();
            try {
                const memberList = await cc.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'], paginate: true });
                await initializeRotationFromGroup(db, memberList);
                const syncResult = await syncRotationFromGroup(db, memberList);
                if (syncResult && (syncResult.added.length > 0 || syncResult.removed.length > 0)) {
                    const msg = [
                        syncResult.added.length > 0 ? `New MEs added to rotation: ${syncResult.added.join(', ')}` : '',
                        syncResult.removed.length > 0 ? `Removed from rotation: ${syncResult.removed.join(', ')}` : '',
                    ].filter(Boolean).join(' | ');
                    console.log(`[ROTATION] ${msg}`);
                    try { await sendLogMessage(`[ROTATION] ${msg}`); } catch { /* ignore */ }
                }

                const overrideRaw = (parsedBbFields.assignedOverride || '').trim();
                const overrideName = overrideRaw.replace(/\s+for\s+Final\s+Autopsy\s+Exams.*$/i, '').trim();
                const overrideLoa = overrideName ? loaSet.has(overrideName.toLowerCase()) : false;
                if (overrideName && !overrideLoa) {
                    assignedName = overrideName;
                    console.log(`[AUTOPSY-MON] Assigned-override ME for #${topicId}/${i}: ${assignedName}`);
                } else {
                    if (overrideName && overrideLoa) {
                        console.warn(`[AUTOPSY-MON] Assigned-override ME "${overrideName}" is on LOA — falling back to rotation`);
                    }
                    assignedName = await selectME(db, topicId, caseNum);
                }

                if (assignedName) {
                    const tMatch = caseUrl.match(/[?&]t=(\d+)/);
                    if (tMatch) {
                        const member = memberList.find(m => m.name.toLowerCase() === assignedName.toLowerCase());
                        const uid = member?.userId || '0';
                        const assignBBCode = `[quote="${assignedName}" user_id=${uid}]\n[/quote]\n\n[b]${assignedName}[/b] - You have been assigned this autopsy case file.`;
                        await caseRef.child('assignmentReplyStatus').set('attempting').catch(() => {});
                        const replyResult = await cc.replyToTopic(tMatch[1], 266, assignBBCode, { dryRun: false, baseUrl: PHMC_BASE });
                        await caseRef.child('assignedTo').set(assignedName);
                        if (replyResult.ok) {
                            console.log(`[AUTOPSY-MON] Assigned ${assignedName} to case #${tMatch[1]}`);
                            const newTitle = caseTitle.replace('- UNASSIGNED', `- ${assignedName}`);
                            await cc.editTopicTitle(tMatch[1], 266, newTitle, { baseUrl: PHMC_BASE });
                            await caseRef.child('caseTitle').set(newTitle).catch(() => {});
                            await caseRef.child('assignmentReplyStatus').set('completed').catch(() => {});
                            assignedNames.push(assignedName);
                            try {
                                const { notifyAssignment } = await import('./meDiscordNotify.js');
                                await notifyAssignment(db, assignedName, newTitle || caseTitle, caseUrl);
                            } catch (err) {
                                console.warn(`[AUTOPSY-MON] ME Discord notify failed: ${err.message}`);
                            }
                        } else {
                            const reason = replyResult.reason || replyResult.url || 'unknown';
                            console.warn(`[AUTOPSY-MON] Assignment reply failed for ${assignedName} — reason: ${reason} — will retry next cycle`);
                            await caseRef.child('assignmentReplyStatus').set('failed').catch(() => {});
                            await caseRef.child('caseState').set('case_created').catch(() => {});
                        }
                    }
                } else {
                    console.log('[AUTOPSY-MON] No ME available to assign — check rotation list and LOA status');
                }
            } catch (err) {
                console.error(`[AUTOPSY-MON] Assignment error: ${err.message}`);
            }
        }

        // ── Per-case notification ──
        const caseAssigned = (await caseRef.child('assignedTo').once('value')).val() || null;
        const assignedLabel = caseAssigned ? `- ${caseAssigned}` : '- UNASSIGNED';
        const notifTitle = caseTitle.replace('- UNASSIGNED', assignedLabel);
        await sendWebhookSummary(`**Autopsy Case Created**\n${notifTitle}\n${caseUrl}`);
        const ownerId = process.env.BOT_OWNER_ID || '';
        if (ownerId) {
            const ping = caseAssigned ? `Assigned to: ${caseAssigned}` : 'No ME available — still UNASSIGNED';
            await sendLogMessage(`<@${ownerId}> Autopsy case posted: ${notifTitle} — ${ping}`, null);
        }
    }

    // Aggregated top-level fields for dashboards/recovery that read the
    // request record (per-decedent detail lives under cases/<idx>).
    if (assignedNames.length > 0) {
        await rootRef.child('assignedTo').set(assignedNames.join(', ')).catch(() => {});
    }
    await rootRef.child('caseCount').set(decedents.length).catch(() => {});

    // ── Step 3 (once per request): crossposts + acknowledgement ──
    if (!isDryRun) {
        const multiAckState = existing.multiAckState || (await rootRef.child('multiAckState').once('value')).val() || '';
        if (multiAckState !== 'ack_sent') {
            try {
                const requesterName = parsedBbFields.requesterName || parsed.name || '';
                const displayTitle = caseTitles[0] || `Case - ${parsed.name} ((${parsed.oocName}))`;
                let lssdAckTopicId = null;
                let lspdTopicId = null;

                // --- LSSD: search for existing request topic for acknowledgement reply ---
                if (parsed.faction === 'LSSD' && (parsed.oocName || parsed.name)) {
                    try {
                        const lssdClient = getForumClient();
                        await lssdClient.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: LSSD_BASE });
                        const lssdResult = await searchLssdRequestTopic(lssdClient, { oocName: parsed.oocName, name: parsed.name });
                        if (lssdResult) {
                            lssdAckTopicId = lssdResult.topicId;
                            console.log('[AUTOPSY-MON] Found LSSD topic #' + lssdAckTopicId + ' for acknowledgement');
                            db.ref(`autopsy-requested/${topicId}/lssdRequestTopicId`).set(lssdAckTopicId).catch(() => {});
                        } else {
                            console.log('[AUTOPSY-MON] Step 3 — LSSD topic search returned no results; checking poster for CASELINK...');
                            try {
                                const phmcClient = getForumClient();
                                const poster = await phmcClient.getTopicPoster(topic.topicId, { baseUrl: PHMC_BASE });
                                const isCaselink = !!(poster && /caselink/i.test(poster));
                                if (isCaselink) {
                                    console.log('[AUTOPSY-MON] Step 3 — CASELINK request — skipping LSSD topic creation to avoid duplication');
                                } else if (!poster) {
                                    console.warn('[AUTOPSY-MON] Step 3 — Could not resolve request poster — skipping LSSD topic creation');
                                } else {
                                    const recheck = await searchLssdRequestTopic(lssdClient, { oocName: parsed.oocName, name: parsed.name });
                                    if (recheck) {
                                        lssdAckTopicId = recheck.topicId;
                                        db.ref(`autopsy-requested/${topicId}/lssdRequestTopicId`).set(lssdAckTopicId).catch(() => {});
                                    } else {
                                        const lssdTopicTitle = 'Autopsy Request - ' + parsed.name + (parsed.oocName ? ' ((' + parsed.oocName + '))' : '') + ' [LSSD]';
                                        const lssdTopicBody = requestBbCode
                                            ? '[divbox=white][center][b][size=170]AUTOPSY REQUEST — CERTIFIED COPY [/size][/b][/center][hr][/hr]\n' + requestBbCode + '\n[hr][/hr][b]Cases:[/b] ' + caseTitles.join(' | ') + '\n[b]Status:[/b] Under Investigation\n[/divbox]'
                                            : '[divbox=white][b]Autopsy Request[/b]\n[b]Decedent:[/b] ' + parsed.name + (parsed.oocName ? ' ((' + parsed.oocName + '))' : '') + '\n[b]Cases:[/b] ' + caseTitles.join(' | ') + '\n[b]Status:[/b] Under Investigation\n[/divbox]';
                                        const lssdPostResult = await lssdClient.postTopic(LSSD_FORUM_ID, lssdTopicTitle, lssdTopicBody, LSSD_AUTOPSY_POST_URL);
                                        if (lssdPostResult.ok) {
                                            const tM = lssdPostResult.url.match(/[?&]t=(\d+)/);
                                            if (tM) {
                                                lssdAckTopicId = tM[1];
                                                db.ref(`autopsy-requested/${topicId}/lssdRequestTopicId`).set(lssdAckTopicId).catch(() => {});
                                                db.ref(`autopsy-requested/${topicId}/lssdRequestCreatedByBot`).set(true).catch(() => {});
                                                db.ref(`autopsy-requested/${topicId}/lssdCrosspostStatus`).set('pending').catch(() => {});
                                            }
                                        } else {
                                            console.warn('[AUTOPSY-MON] Step 3 — LSSD topic creation failed: ' + (lssdPostResult.reason || 'unknown'));
                                        }
                                    }
                                }
                            } catch (err) {
                                console.warn('[AUTOPSY-MON] Step 3 — LSSD topic creation error: ' + err.message);
                            }
                        }
                    } catch (err) {
                        console.warn('[AUTOPSY-MON] LSSD ack search error: ' + err.message);
                    }
                } else {
                    console.log('[AUTOPSY-MON] Step 3 — LSSD topic search skipped (faction=' + (parsed.faction || 'none') + ')');
                }

                // --- LSPD: Create topic on LSPD forum f=1361 ---
                if (parsed.faction === 'LSPD') {
                    // Reuse a preserved LSPD topic id (reprocessing after a
                    // reset) instead of creating a duplicate.
                    const existingLspd = existing.lspdTopicId || (await rootRef.child('lspdTopicId').once('value')).val() || '';
                    if (existingLspd) {
                        lspdTopicId = String(existingLspd);
                        console.log('[AUTOPSY-MON] Reusing existing LSPD topic #' + lspdTopicId + ' for request');
                    } else {
                    try {
                        const lspdClient = getForumClient();
                        await lspdClient.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: true, baseUrl: 'https://lspd.gta.world' });
                        const lspdTopicTitle = 'Autopsy Request - ' + parsed.name + (parsed.oocName ? ' ((' + parsed.oocName + '))' : '') + ' [LSPD]';
                        const lspdTopicBody = requestBbCode
                            ? '[divbox=white][center][b][size=170]AUTOPSY REQUEST — CERIFIED COPY [/size][/b][/center][hr][/hr]\n' + requestBbCode + '\n[hr][/hr][b]Cases:[/b] ' + caseTitles.join(' | ') + '\n[b]Status:[/b] Under Investigation\n[/divbox]'
                            : '[divbox=white][b]Autopsy Request[/b]\n[b]Decedent:[/b] ' + parsed.name + (parsed.oocName ? ' ((' + parsed.oocName + '))' : '') + '\n[b]Cases:[/b] ' + caseTitles.join(' | ') + '\n[b]Status:[/b] Under Investigation\n[/divbox]';
                        const lspdResult = await lspdClient.postTopic(1361, lspdTopicTitle, lspdTopicBody, 'https://lspd.gta.world/posting.php?mode=post&f=1361');
                        if (lspdResult.ok) {
                            const tM = lspdResult.url.match(/[?&]t=(\d+)/);
                            if (tM) {
                                lspdTopicId = tM[1];
                                db.ref(`autopsy-requested/${topicId}/lspdTopicId`).set(lspdTopicId).catch(() => {});
                                db.ref(`autopsy-requested/${topicId}/lspdCrosspostStatus`).set('pending').catch(() => {});
                            }
                        } else {
                            console.warn('[AUTOPSY-MON] Step 3 — Failed to create LSPD topic: ' + (lspdResult.reason || 'unknown'));
                        }
                    } catch (err) {
                        console.warn('[AUTOPSY-MON] Step 3 — LSPD topic creation error: ' + err.message);
                    }
                    }
                } else {
                    console.log('[AUTOPSY-MON] Step 3 — LSPD topic creation skipped (faction=' + (parsed.faction || 'none') + ')');
                }

                // --- Send acknowledgement reply to PHMC + crosspost to LSSD/LSPD forums ---
                const ackResult = await sendAutopsyAcknowledgement(topic.topicId, requesterName, null, {
                    baseUrl: PHMC_BASE,
                    lssdTopicId: lssdAckTopicId,
                    lspdTopicId: lspdTopicId,
                });

                if (ackResult.phmc) console.log('[AUTOPSY-MON] Acknowledgement sent to PHMC #' + topic.topicId);
                if (ackResult.lssd) console.log('[AUTOPSY-MON] Acknowledgement sent to LSSD #' + lssdAckTopicId);
                if (ackResult.lspd) console.log('[AUTOPSY-MON] Acknowledgement sent to LSPD #' + lspdTopicId);

                const ackStatus = {};
                const ackAt = {};
                const nowIso = new Date().toISOString();
                for (const [target, ok] of Object.entries(ackResult)) {
                    const field = ACK_FIELD_NAMES[target];
                    if (!field) continue;
                    if (ok === true) ackStatus[field] = 'completed';
                    else if (ok === false) ackStatus[field] = 'failed';
                    if (ok === true || ok === false) ackAt[field + '-at'] = nowIso;
                }
                if (Object.keys(ackStatus).length > 0) {
                    db.ref(`autopsy-requested/${topicId}`).update({ ...ackStatus, ...ackAt }).catch(() => {});
                    const failedAcks = Object.entries(ackStatus).filter(([, s]) => s === 'failed').map(([f]) => f);
                    if (failedAcks.length > 0) {
                        console.warn(`[AUTOPSY-MON] ⚠️ Ack FAILED for #${topicId}: ${failedAcks.join(', ')} — flagged for automatic retry`);
                    }
                }

                await rootRef.child('multiAckState').set('ack_sent').catch(() => {});
            } catch (err) {
                console.warn('[AUTOPSY-MON] Acknowledgement error: ' + err.message);
            }
        }

        // ── Step 4 (once per request): update counters ──
        if (multiAckState === 'ack_sent' || (await rootRef.child('multiAckState').once('value')).val() === 'ack_sent') {
            try {
                const countKey = parsed.faction === 'LSPD' ? 'LSPD' : 'LSSD';
                const countRef = db.ref(`autopsy-requests/${countKey}/count`);
                const countSnap = await countRef.once('value');
                const newCount = (countSnap.val() || 0) + 1;
                await countRef.set(newCount);
                await db.ref(`autopsy-requests/${countKey}/lastUpdated`).set(Date.now());
                console.log(`[AUTOPSY-MON] Counters updated — ${countKey}: ${newCount}`);
            } catch (err) {
                console.warn(`[AUTOPSY-MON] Counter update: ${err.message}`);
            }
            await rootRef.child('multiComplete').set(true).catch(() => {});
        }
    }
}

// ── Autopsy Request Field Parser ──

/**
 * Parse one decedent line from Section 2 of an autopsy request.
 * Template format (multi-decedent bodies are numbered):
 *   "1.) Decedent Name: John Doe[1]((Marvion Futrell))"
 *   "1.) Decedent Name: John Doe (2) ((Dylan Bongo))"
 *   "1.) Decedent Name: John Doe ((OOC Name))"
 *
 * @param {string} raw — the value after "Decedent Name:" (already trimmed)
 * @returns {{ raw: string, name: string, marker: string, oocName: string } | null}
 */
function parseDecedentNameLine(raw) {
    if (!raw) return null;
    let rest = String(raw).trim();
    let oocName = '';
    const oocMatch = rest.match(/\(\(\s*([^()]*)\s*\)\)/);
    if (oocMatch) {
        oocName = oocMatch[1].trim();
        rest = rest.replace(oocMatch[0], '').trim();
    }
    let marker = '';
    const markerMatch = rest.match(/\[(\d+)\]|\((\d+)\)\s*$/);
    if (markerMatch) {
        marker = markerMatch[1] || markerMatch[2] || '';
        rest = rest.replace(markerMatch[0], '').trim();
    }
    const name = rest.replace(/[\[\]()]/g, '').trim();
    if (!name) return null;
    return { raw: String(raw).trim(), name, marker, oocName };
}

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
            const m1 = trimmed.match(/Decedent\s+Name(?:\(s?\))?:\s*(.+)/i) || trimmed.match(/1\.\)\s*Name:\s*(.+)/i);
            if (m1) {
                fields.decedentName = m1[1].trim();
                // Multi-decedent requests number each body in Section 2
                // ("John Doe[1]((OOC A))", "John Doe[2]((OOC B))"). Collect ALL
                // decedent lines so each gets its own autopsy case.
                const parsedLine = parseDecedentNameLine(m1[1].trim());
                if (parsedLine) {
                    fields.decedentNames = fields.decedentNames || [];
                    fields.decedentNames.push(parsedLine);
                }
            }
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
            // Supervised final-autopsy requests carry an explicit assignee marker.
            const as = trimmed.match(/ASSIGNED:\s*(.+)/i);
            if (as) fields.assignedOverride = as[1].trim();
        }

        if (currentSection === 'ooc') {
            const o1 = trimmed.match(/1\.\)\s*PK\/CK:\s*(.+)/i);
            if (o1) fields.deathType = o1[1].trim();
        }
    }

    return fields;
}

// ── Acknowledgement Template ──

export const ACK_TEMPLATE = `[divbox=white][center][img]https://i.imgur.com/Hxjt4M2.png[/img][/center]
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
        const { getRotationStatus, initializeRotationFromGroup, syncRotationFromGroup } = await import('./autopsyRotation.js');
        const status = await getRotationStatus(_db);
        const client = getForumClient();
        let memberList = [];
        try {
            memberList = await client.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'], paginate: true });
        } catch (e) {
            console.warn(`[AUTOPSY-MON] Could not load forum group members: ${e.message}`);
        }
        if (!status.configured && memberList.length > 0) {
            await initializeRotationFromGroup(_db, memberList);
            console.log(`[AUTOPSY-MON] Auto-initialized rotation list: ${memberList.map(m => m.name).join(', ')}`);
        } else if (memberList.length > 0) {
            const syncResult = await syncRotationFromGroup(_db, memberList);
            if (syncResult && (syncResult.added.length > 0 || syncResult.removed.length > 0)) {
                const msg = [
                    syncResult.added.length > 0 ? `New MEs added to rotation: ${syncResult.added.join(', ')}` : '',
                    syncResult.removed.length > 0 ? `Removed from rotation: ${syncResult.removed.join(', ')}` : '',
                ].filter(Boolean).join(' | ');
                console.log(`[ROTATION] ${msg}`);
                try { await sendLogMessage(`[ROTATION] ${msg}`); } catch { /* ignore */ }
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
        const countAssignment = (meName, topicId, caseNum, detectedAt) => {
            if (!meName) return;
            const key = meName.toLowerCase();
            if (!assignments[key]) {
                assignments[key] = { active: 0, cases: {}, lastAssigned: 0 };
            }
            assignments[key].active++;
            assignments[key].cases[`${topicId}`] = {
                assignedAt: detectedAt ? new Date(detectedAt).getTime() : Date.now(),
                caseNum: caseNum || '',
            };
            const ts = detectedAt ? new Date(detectedAt).getTime() : 0;
            if (ts > assignments[key].lastAssigned) {
                assignments[key].lastAssigned = ts;
            }
        };
        for (const [topicId, entry] of Object.entries(entries)) {
            if (entry.completedAt) continue;
            // Multi-decedent requests hold per-case assignments under cases/<idx>
            if (entry.caseState === 'multi' && entry.cases) {
                for (const c of Object.values(entry.cases)) {
                    countAssignment(c.assignedTo, topicId, c.caseNum, entry.detectedAt);
                }
            } else {
                countAssignment(entry.assignedTo, topicId, entry.caseNum, entry.detectedAt);
            }
        }

        await _db.ref('autopsy-requests/assignments').set(assignments);
        const total = Object.keys(assignments).length;
        const totalCases = Object.values(assignments).reduce((s, a) => s + a.active, 0);
        if (totalCases > 0) {
            console.log(`[AUTOPSY-MON] Rebuilt assignment counts: ${total} ME(s) with ${totalCases} active case(s)`);
        }
        // Retry any failed assignment replies from previous sessions
        // (also runs as part of the recovery heartbeat via retryFailedAssignmentReplies)
        await retryFailedAssignmentReplies(_db, { entries });
    } catch (err) {
        console.warn(`[AUTOPSY-MON] Assignment rebuild skipped: ${err.message}`);
    }
}

/**
 * Retry failed/missing assignment replies (ME assignment quote on the f=266 case topic).
 * Runs as part of the recovery heartbeat (startup + every 10 min) and at monitor startup.
 *
 * @param {object} db — Firebase RTDB (defaults to the module _db)
 * @param {object} [opts] — { entries, memberList } to avoid re-fetching when the caller already has them
 */
export async function retryFailedAssignmentReplies(db, { entries, memberList } = {}) {
    const ref = db || _db;
    if (!ref) return;
    try {
        const cc = getForumClient();
        // Force a PHMC session — the default client may have been left on LSPD/LSSD
        // by earlier heartbeat checks (retryMissingLspdCrossposts force-logs it to LSPD).
        await cc.login(null, null, { force: true, baseUrl: PHMC_BASE });

        if (!entries) {
            const snap = await ref.ref('autopsy-requested').once('value');
            entries = snap.val() || {};
        }
        if (!memberList) {
            try {
                memberList = await cc.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'], paginate: true });
            } catch (e) {
                console.warn(`[AUTOPSY-MON] Could not load member list for retry: ${e.message}`);
                memberList = [];
            }
        }

        let retried = 0;
        for (const [topicId, entry] of Object.entries(entries)) {
            // Multi-decedent requests keep per-case state under cases/<idx>
            if (entry.caseState === 'multi' && entry.cases) {
                for (const [ci, c] of Object.entries(entry.cases)) {
                    if (c.assignedTo && c.assignmentReplyStatus !== 'completed' && !entry.completedAt) {
                        const caseTopicId = c.caseTopicId;
                        if (!caseTopicId) continue;
                        if (c.assignmentReplyStatus === 'attempting') {
                            console.log(`[AUTOPSY-MON] Assignment reply for #${topicId}/case${ci} is in progress ('attempting') — skipping retry`);
                            continue;
                        }
                        const member = memberList.find(m => m.name.toLowerCase() === c.assignedTo.toLowerCase());
                        const uid = member?.userId || '0';
                        const assignBBCode = `[quote="${c.assignedTo}" user_id=${uid}]\n[/quote]\n\n[b]${c.assignedTo}[/b] - You have been assigned this autopsy case file.`;
                        const basePath = `autopsy-requested/${topicId}/cases/${ci}`;
                        try {
                            const r = await cc.replyToTopic(caseTopicId, 266, assignBBCode, { dryRun: false, baseUrl: PHMC_BASE });
                            if (r.ok) {
                                await ref.ref(`${basePath}/assignmentReplyStatus`).set('completed').catch(() => {});
                                console.log(`[AUTOPSY-MON] Retried assignment reply for ${c.assignedTo} on #${caseTopicId} — OK`);
                                notifySelfHeal(topicId, 'assignment reply failed', 'Assignment reply posted to case topic');
                                if (c.caseTitle && c.caseTitle.includes('UNASSIGNED')) {
                                    const newTitle = c.caseTitle.replace('- UNASSIGNED', `- ${c.assignedTo}`);
                                    try {
                                        await cc.editTopicTitle(caseTopicId, 266, newTitle, { baseUrl: PHMC_BASE });
                                        await ref.ref(`${basePath}/caseTitle`).set(newTitle).catch(() => {});
                                        console.log(`[AUTOPSY-MON] Retry also updated case title: "${newTitle}"`);
                                    } catch (e) {
                                        console.warn(`[AUTOPSY-MON] Retry title update failed: ${e.message}`);
                                    }
                                }
                                retried++;
                            } else {
                                console.warn(`[AUTOPSY-MON] Retry assignment reply failed for ${c.assignedTo} on #${caseTopicId}: ${r.reason || 'Unknown'}`);
                                notifySelfHeal(topicId, 'assignment reply failed', `Retry FAILED: ${r.reason || 'Unknown'}`);
                            }
                        } catch (err) {
                            console.error(`[AUTOPSY-MON] Assignment reply retry error for ${topicId}/case${ci}: ${err.message}`);
                            notifySelfHeal(topicId, 'assignment reply failed', `ERROR: ${err.message}`);
                        }
                    }
                }
                continue;
            }
            if (entry.assignedTo && entry.assignmentReplyStatus !== 'completed' && !entry.completedAt) {
                const caseTopicId = entry.caseTopicId;
                if (!caseTopicId) continue;

                // Skip entries whose reply is currently being posted ('attempting').
                // The main monitor sets this before posting, so a concurrent sweep
                // won't double-post. Only retry 'failed' or genuinely missing replies.
                if (entry.assignmentReplyStatus === 'attempting') {
                    console.log(`[AUTOPSY-MON] Assignment reply for #${topicId} is in progress ('attempting') — skipping retry`);
                    continue;
                }

                // Look up user ID for the quote tag
                const member = memberList.find(m => m.name.toLowerCase() === entry.assignedTo.toLowerCase());
                const uid = member?.userId || '0';
                const assignBBCode = `[quote="${entry.assignedTo}" user_id=${uid}]\n[/quote]\n\n[b]${entry.assignedTo}[/b] - You have been assigned this autopsy case file.`;

                try {
                    const r = await cc.replyToTopic(caseTopicId, 266, assignBBCode, { dryRun: false, baseUrl: PHMC_BASE });
                    if (r.ok) {
                        await ref.ref(`autopsy-requested/${topicId}/assignmentReplyStatus`).set('completed').catch(() => {});
                        console.log(`[AUTOPSY-MON] Retried assignment reply for ${entry.assignedTo} on #${caseTopicId} — OK`);
                        notifySelfHeal(topicId, 'assignment reply failed', 'Assignment reply posted to case topic');

                        // Also update the topic title if it still has UNASSIGNED
                        if (entry.caseTitle && entry.caseTitle.includes('UNASSIGNED')) {
                            const newTitle = entry.caseTitle.replace('- UNASSIGNED', `- ${entry.assignedTo}`);
                            try {
                                await cc.editTopicTitle(caseTopicId, 266, newTitle, { baseUrl: PHMC_BASE });
                                await ref.ref(`autopsy-requested/${topicId}/caseTitle`).set(newTitle).catch(() => {});
                                console.log(`[AUTOPSY-MON] Retry also updated case title: "${newTitle}"`);
                            } catch (e) {
                                console.warn(`[AUTOPSY-MON] Retry title update failed: ${e.message}`);
                            }
                        }

                        retried++;
                    } else {
                        console.warn(`[AUTOPSY-MON] Retry assignment reply failed for ${entry.assignedTo} on #${caseTopicId}: ${r.reason || 'Unknown'}`);
                        notifySelfHeal(topicId, 'assignment reply failed', `Retry FAILED: ${r.reason || 'Unknown'}`);
                    }
                } catch (err) {
                    console.error(`[AUTOPSY-MON] Assignment reply retry error for ${topicId}: ${err.message}`);
                    notifySelfHeal(topicId, 'assignment reply failed', `ERROR: ${err.message}`);
                }
            }
        }
        if (retried > 0) console.log(`[AUTOPSY-MON] Retried ${retried} failed assignment reply/ies`);
    } catch (err) {
        console.warn(`[AUTOPSY-MON] Assignment reply retry skipped: ${err.message}`);
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
 * @returns {{ active: boolean, intervalMs: number, lastCheckTime: number|null, lastCheckSuccess: boolean }}
 */
export function getMonitorStatus() {
    return {
        active: _monitorTimer !== null,
        intervalMs: CHECK_INTERVAL_MS,
        lastCheckTime: _lastCheckTime,
        lastCheckSuccess: _lastCheckSuccess,
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
