/**
 * Mass Autopsy — Parse multi-body BBCode and distribute cases across the
 * ME rotation in round-robin fashion.
 *
 * Each body gets its own case topic in f=266. The topic body preserves
 * the full requester BBCode (quote wrapper, all sections) but only
 * includes the current body's fields in SECTION 2 — other bodies are
 * stripped out so each ME only sees what they need.
 */

import { selectME } from './autopsyRotation.js';

const PHMC_BASE = 'https://phmc.gta.world';
const CASE_MGMT_FORUM_ID = 266;

// ── BBCode Parser ──

function extractField(text, regex) {
    const m = text.match(regex);
    return m ? m[1].trim() : '';
}

/**
 * Find the boundaries of SECTION 2's body divbox in raw BBCode.
 * Returns the prefix (everything before the first body field),
 * suffix (everything after SECTION 2 closes), and the raw body
 * area text so we can split individual bodies out of it.
 */
function findSection2Bounds(bbcode) {
    // Locate SECTION 2 marker
    const sec2Idx = bbcode.search(/(?:SECTION\s*2|DECEDENT'?S?\s*INFORMATION)/i);
    if (sec2Idx === -1) return null;

    // From SECTION 2, find the opening [divbox (the body container)
    const afterSec2 = bbcode.slice(sec2Idx);
    const divboxMatch = afterSec2.match(/\[divbox[^\]]*\]/);
    if (!divboxMatch) return null;

    const divboxOpenStart = sec2Idx + divboxMatch.index;
    const divboxOpenTag = divboxMatch[0];

    // Find matching [/divbox] by counting nesting
    const rest = bbcode.slice(divboxOpenStart + divboxOpenTag.length);
    let depth = 1;
    let cursor = 0;
    while (depth > 0 && cursor < rest.length) {
        const nextOpen = rest.indexOf('[divbox', cursor);
        const nextClose = rest.indexOf('[/divbox]', cursor);

        if (nextClose === -1) break;

        if (nextOpen !== -1 && nextOpen < nextClose) {
            depth++;
            cursor = nextOpen + 7;
        } else {
            depth--;
            cursor = nextClose + 9;
        }
    }

    if (depth !== 0) return null; // Unmatched divbox

    const divboxCloseEnd = divboxOpenStart + divboxOpenTag.length + cursor;
    const bodyContent = bbcode.slice(divboxOpenStart + divboxOpenTag.length, divboxCloseEnd - '[/divbox]'.length);

    // Find the first body section (1.) Name:) within the body content
    const firstBodyMatch = bodyContent.match(/(?:\[.*?\])*1\.\)\s*Name\s*:/i);
    if (!firstBodyMatch) return null;

    const bodyFieldsStart = divboxOpenStart + divboxOpenTag.length + firstBodyMatch.index;

    // Prefix: everything BEFORE the first body field (includes SECTION 2 header + intro)
    // Suffix: the closing [/divbox] of SECTION 2 + everything after (SECTION 3, 4, etc.)
    return {
        prefix: bbcode.slice(0, bodyFieldsStart),
        suffix: bbcode.slice(divboxCloseEnd - '[/divbox]'.length),
        bodyContent,
        bodyFieldsStart,
    };
}

/**
 * Parse raw BBCode text into an array of individual body records,
 * each with its own reconstructed BBCode (full requester info, but
 * only this body's fields in SECTION 2).
 *
 * @param {string} bbcode
 * @returns {Array<{name: string, oocName: string, gender: string, ethnicity: string, dateOfDeath: string, timeOfDeath: string, location: string, fullBbcode: string}>}
 */
export function parseMassAutopsyBbcode(bbcode) {
    if (!bbcode) return [];

    // Step 1: Find SECTION 2 boundaries and isolate body sections
    const bounds = findSection2Bounds(bbcode);
    if (!bounds) return [];

    const { prefix, suffix, bodyContent } = bounds;

    // Step 2: Find each body section within the body content
    const bodyStartRegex = /(?:\[.*?\])*1\.\)\s*Name\s*:/gi;
    const boundaries = [];
    let match;
    while ((match = bodyStartRegex.exec(bodyContent)) !== null) {
        boundaries.push(match.index);
    }

    if (boundaries.length === 0) return [];

    // Step 3: Extract each body's raw section + parsed fields, build full BBCode
    const bodies = [];
    for (let i = 0; i < boundaries.length; i++) {
        const start = boundaries[i];
        const end = boundaries[i + 1] || bodyContent.length;

        const rawSection = bodyContent.slice(start, end).trim();
        if (!rawSection) continue;

        // Parse fields from cleaned text
        const clean = rawSection.replace(/\[.*?\]/g, '').trim();
        const nameMatch = clean.match(/1\.\)\s*Name\s*:\s*(.+)/i);
        if (!nameMatch) continue;

        const rawName = nameMatch[1].trim();
        const oocMatch = rawName.match(/\(\((.+?)\)\)/);
        const oocName = oocMatch ? oocMatch[1].trim() : '';
        const displayName = rawName.replace(/\s*\(\(.+?\)\)\s*/, '').trim() || rawName;

        // Build the full BBCode for this body's topic:
        //   prefix (everything before SECTION 2's body fields)
        //   + this body's raw section only (no other bodies)
        //   + suffix (rest of the BBCode after SECTION 2)
        const fullBbcode = prefix + rawSection + suffix;

        bodies.push({
            name: displayName,
            oocName,
            rawName,
            gender: extractField(clean, /2\.\)\s*Gender\s*:\s*(.+)/i),
            ethnicity: extractField(clean, /3\.\)\s*Ethnicity\s*:\s*(.+)/i),
            dateOfDeath: extractField(clean, /4\.\)\s*Date of Death\s*:\s*(.+)/i),
            timeOfDeath: extractField(clean, /5\.\)\s*Time of Death\s*:\s*(.+)/i),
            location: extractField(clean, /6\.\)\s*Location\s*:\s*(.+)/i),
            fullBbcode,
        });
    }

    return bodies;
}

// ── Execution ──

/**
 * Execute a mass autopsy: create case topics, assign via rotation,
 * post assignment replies, and write to Firebase.
 *
 * Each body gets its own topic in f=266 with the full requester BBCode
 * but only that body's SECTION 2 fields. Round-robin distribution.
 *
 * @param {import('firebase-admin').database.Database} db
 * @param {import('../services/forumClient.js').ForumClient} client
 * @param {Array} bodies — output of parseMassAutopsyBbcode()
 * @param {object} [options]
 * @param {boolean} [options.dryRun=true]
 * @param {string} [options.requesterName='']
 * @param {string} [options.baseUrl='https://phmc.gta.world']
 * @returns {Promise<MassAutopsyResult[]>}
 */
export async function executeMassAutopsy(db, client, bodies, { dryRun = true, requesterName = '', baseUrl = PHMC_BASE } = {}) {
    const results = [];

    if (bodies.length === 0) {
        return [{ index: 0, name: '', oocName: '', caseNum: 0, success: false, error: 'No bodies to process', assignedTo: null, topicUrl: null, caseTitle: '', initialContent: '' }];
    }

    // ── Step 1: Scan f=266 for highest case number ──
    // Ensure logged in so the disposable page has session cookies
    try { await client.login(null, null, { force: false, baseUrl }); } catch (e) {}

    let highest = 0;
    try {
        const existingTopics = await client.getForumTopics(CASE_MGMT_FORUM_ID, { baseUrl });
        for (const t of existingTopics) {
            const m = t.title.match(/Case\s*(\d+)/i);
            if (m) {
                const n = parseInt(m[1], 10);
                if (n > highest) highest = n;
            }
        }
        console.log(`[MASS-AUTOPSY] Highest existing case: #${highest}`);
    } catch (err) {
        console.warn(`[MASS-AUTOPSY] Case number scan failed (continuing): ${err.message}`);
    }

    // ── Step 2: Dry-run assignment preview ──
    let assignmentPreview = null;
    if (dryRun) {
        const { getRotationStatus } = await import('./autopsyRotation.js');
        const status = await getRotationStatus(db);
        if (status.configured && status.list.length > 0) {
            const { list, position } = status;
            const activeCounts = {};
            const loaSet = new Set();
            for (const m of status.meStatus) {
                activeCounts[m.name.toLowerCase()] = m.activeCases;
                if (m.onLoa) loaSet.add(m.name.toLowerCase());
            }
            const preview = [];
            let pos = position;
            for (let i = 0; i < bodies.length; i++) {
                let assigned = null;
                for (let j = 0; j < list.length; j++) {
                    const candidate = list[(pos + j) % list.length];
                    const cl = candidate.toLowerCase();
                    if (loaSet.has(cl)) continue;
                    if ((activeCounts[cl] || 0) > 0) continue;
                    assigned = candidate;
                    pos = (pos + j + 1) % list.length;
                    // Track simulated assignment for subsequent bodies in this batch
                    activeCounts[cl] = (activeCounts[cl] || 0) + 1;
                    break;
                }
                if (!assigned) {
                    const eligible = list.filter(m => !loaSet.has(m.toLowerCase()));
                    if (eligible.length > 0) {
                        eligible.sort((a, b) => (activeCounts[a.toLowerCase()] || 0) - (activeCounts[b.toLowerCase()] || 0));
                        assigned = eligible[0];
                    }
                }
                preview.push(assigned || '(none available)');
            }
            assignmentPreview = preview;
        }
    }

    if (!dryRun) {
        try {
            await client.login(null, null, { force: false, baseUrl });
        } catch (err) {
            console.warn(`[MASS-AUTOPSY] Login check: ${err.message}`);
        }
    }

    // ── Step 3: Process each body ──
    for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        const caseNum = highest + i + 1;
        const caseTitle = `Case ${caseNum} - ${body.name} ((${body.oocName})) - UNASSIGNED`;
        const initialContent = body.fullBbcode; // Full requester BBCode, only this body's SECTION 2
        const result = {
            index: i + 1,
            name: body.name,
            oocName: body.oocName,
            caseNum,
            success: false,
            error: null,
            assignedTo: null,
            topicUrl: null,
            caseTitle,
            initialContent,
        };

        try {
            let assignedName = null;
            if (dryRun) {
                assignedName = assignmentPreview && i < assignmentPreview.length ? assignmentPreview[i] : null;
                result.assignedTo = assignedName && assignedName !== '(none available)' ? assignedName : '(would assign based on rotation)';
                result.topicUrl = '[DRY]';
                result.success = true;
                console.log(`[MASS-AUTOPSY] [DRY] [${i + 1}/${bodies.length}] ${body.name} -> ${assignedName || 'TBD'}`);
            } else {
                console.log(`[MASS-AUTOPSY] [${i + 1}/${bodies.length}] Creating case #${caseNum} for ${body.name} ((${body.oocName}))`);
                const postResult = await client.postTopic(CASE_MGMT_FORUM_ID, caseTitle, initialContent);
                if (!postResult.ok) {
                    throw new Error(`Topic creation failed: ${postResult.reason || 'unknown'}`);
                }
                result.topicUrl = postResult.url;

                const tMatch = postResult.url.match(/[?&]t=(\d+)/);
                const topicId = tMatch ? tMatch[1] : null;
                if (!topicId) throw new Error('Could not extract topic ID');

                assignedName = await selectME(db, topicId, String(caseNum));
                if (!assignedName) throw new Error('No eligible ME available in rotation');
                result.assignedTo = assignedName;

                try {
                    // Navigate to forum index to reset browser state after postTopic
                    await client.page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                    await client.page.waitForTimeout(2000);

                    const memberList = await client.getGroupMembers(50, { baseUrl, exclude: ['PHMC Forms Bot'] });
                    const member = memberList.find((m) => m.name.toLowerCase() === assignedName.toLowerCase());
                    const uid = member?.userId || '0';
                    const assignBBCode = `[quote="${assignedName}" user_id=${uid}]\n[/quote]\n\n[b]${assignedName}[/b] - You have been assigned this autopsy case file.`;

                    const replyResult = await client.replyToTopic(topicId, CASE_MGMT_FORUM_ID, assignBBCode, { dryRun: false, baseUrl });
                    if (!replyResult.ok) {
                        console.warn(`[MASS-AUTOPSY] Assignment reply failed: ${replyResult.reason}`);
                    }

                    const newTitle = caseTitle.replace('- UNASSIGNED', `- ${assignedName}`);
                    await client.editTopicTitle(topicId, CASE_MGMT_FORUM_ID, newTitle, { baseUrl }).catch((err) => {
                        console.warn(`[MASS-AUTOPSY] Title edit failed: ${err.message}`);
                    });
                } catch (err) {
                    console.warn(`[MASS-AUTOPSY] Reply/title error (non-fatal): ${err.message}`);
                }

                const entry = {
                    title: caseTitle,
                    name: body.name,
                    oocName: body.oocName,
                    faction: 'PRIVATE',
                    topicUrl: null,
                    caseUrl: postResult.url,
                    topicId,
                    caseNum: String(caseNum),
                    detectedAt: new Date().toISOString(),
                    wasMatch: true,
                    assignedTo: assignedName,
                    isPrivate: true,
                    massAutopsy: true,
                    massAutopsyGroup: `${Date.now()}`,
                    parsed: {
                        decedentName: body.name,
                        requesterName: requesterName || '',
                        deathType: 'CK',
                        dateOfDeath: body.dateOfDeath || '',
                        timeOfDeath: body.timeOfDeath || '',
                        placeOfDeath: body.location || '',
                        gender: body.gender || '',
                        ethnicity: body.ethnicity || '',
                    },
                };

                await db.ref(`autopsy-requested/${topicId}`).set(entry);
                result.success = true;
                console.log(`[MASS-AUTOPSY] [${i + 1}/${bodies.length}] Done — ${body.name} -> ${assignedName}`);
            }
        } catch (err) {
            result.error = err.message;
            console.error(`[MASS-AUTOPSY] [${i + 1}/${bodies.length}] Failed: ${err.message}`);
        }

        results.push(result);
    }

    return results;
}
