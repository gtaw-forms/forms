/**
 * privateCaseCreation.js — one confidential autopsy case, created in f=266.
 *
 * Used by the web private autopsy intake
 * (services/privateWebAutopsyIntake.js). The retired LSPD inbox intake used
 * the same core.
 *
 * A private case is: one f=266 topic titled
 *   "Case N - NAME ((OOC)) [PRIVATE] - UNASSIGNED"
 * rotated to an available ME, retitled with the assignee, given the standard
 * assignment reply, recorded in `autopsy-requested/<topicId>` and counted in
 * the rotation tracker. It never touches f=265 and never crossposts.
 *
 * Callers own idempotency (a repeating marker per source) — this helper posts
 * exactly what it is asked to post.
 *
 * The rotation + Discord-notification modules are imported lazily so importing
 * this file never needs discord.js or a browser.
 */

export const PRIVATE_CASE_MGMT_FORUM_ID = 266;
export const PHMC_BASE = 'https://phmc.gta.world';

/** Highest `Case N` in Case Management + 1 (fail-closed caller keeps errors). */
export async function nextCaseNumber(client) {
    let highest = 0;
    const topics = await client.getForumTopics(PRIVATE_CASE_MGMT_FORUM_ID, { baseUrl: PHMC_BASE });
    for (const t of topics) {
        const m = (t.title || '').match(/Case\s*(\d+)/i);
        if (m) highest = Math.max(highest, parseInt(m[1], 10));
    }
    return highest + 1;
}

export function buildPrivateCaseTitle({ caseNum, name, oocName, assignedTo = '' } = {}) {
    const who = oocName ? ` ((${oocName}))` : '';
    return `Case ${caseNum} - ${name || 'Unknown'}${who} [PRIVATE] - ${assignedTo || 'UNASSIGNED'}`;
}

/**
 * Post one private case and wire it into the pipeline.
 *
 * @param {object} opts
 * @param {object} opts.db                firebase Admin RTDB handle
 * @param {object} opts.client            PHMC forum client (logged in)
 * @param {string|number} opts.caseNum    case number allocated by the caller
 * @param {string} opts.name              decedent IC name
 * @param {string} opts.oocName           decedent OOC name
 * @param {string} opts.bbCode            case topic body (already built)
 * @param {string} [opts.source]          'web-private'
 * @param {object} [opts.entryExtras]     extra `autopsy-requested` fields
 * @param {(step: string) => Promise<void>} [opts.onStep] progress callback
 * @returns {Promise<{caseNum:string, topicId:string, url:string, assignedTo:string|null, caseTitle:string, notified:boolean}>}
 */
export async function createPrivateCase({
    db,
    client,
    caseNum,
    name,
    oocName,
    bbCode,
    source = 'private',
    entryExtras = {},
    onStep = async () => {},
    onPosted = async () => {},
}) {
    const { selectME, recordAssignment } = await import('./autopsyRotation.js');
    const caseTitle = buildPrivateCaseTitle({ caseNum, name, oocName });

    await onStep(`Posting Case #${caseNum} (${name || 'Unknown'})...`);
    const postResult = await client.postTopic(PRIVATE_CASE_MGMT_FORUM_ID, caseTitle, bbCode, undefined);
    if (!postResult.ok) throw new Error(`Case #${caseNum}: topic post failed (${postResult.reason || 'unknown'})`);
    const tMatch = (postResult.url || '').match(/[?&]t=(\d+)/);
    if (!tMatch) throw new Error(`Case #${caseNum}: no topic ID in ${postResult.url}`);
    const topicId = tMatch[1];

    // Caller-visible immediately: if anything below throws, the topic already
    // exists and must be recorded so a retry can never post it a second time.
    await onPosted({ topicId, url: postResult.url, caseTitle });

    // Rotation decides live (any preview was advisory only).
    const assignedName = await selectME(db, topicId, caseNum);
    const assignedTitle = buildPrivateCaseTitle({ caseNum, name, oocName, assignedTo: assignedName || '' });
    if (assignedName) {
        try {
            await client.editTopicTitle(topicId, PRIVATE_CASE_MGMT_FORUM_ID, assignedTitle, { baseUrl: PHMC_BASE });
        } catch (e) { console.warn(`[PRIVATE-CASE] Title edit failed #${caseNum}: ${e.message}`); }
        try {
            const memberList = await client.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'] });
            const uid = memberList.find((m) => m.name.toLowerCase() === assignedName.toLowerCase())?.userId || '0';
            await client.replyToTopic(topicId, PRIVATE_CASE_MGMT_FORUM_ID,
                `[quote="${assignedName}" user_id=${uid}]\n[/quote]\n\n[b]${assignedName}[/b] - You have been assigned this autopsy case file.`,
                { dryRun: false, baseUrl: PHMC_BASE });
        } catch (e) { console.warn(`[PRIVATE-CASE] Assignment reply failed #${caseNum}: ${e.message}`); }
    }

    const entry = {
        title: assignedTitle,
        name: name || 'Unknown',
        oocName: oocName || '',
        faction: entryExtras.faction || 'PRIVATE',
        topicUrl: null,
        caseUrl: postResult.url,
        topicId,
        caseTopicId: topicId,
        caseNum: String(caseNum),
        detectedAt: new Date().toISOString(),
        wasMatch: true,
        assignedTo: assignedName || null,
        isPrivate: true,
        source,
        ...entryExtras,
    };
    await db.ref(`autopsy-requested/${topicId}`).set(entry);

    let notified = false;
    if (assignedName) {
        await recordAssignment(db, assignedName, topicId, caseNum).catch((e) => console.warn(`[PRIVATE-CASE] Rotation record failed: ${e.message}`));
        try {
            const { notifyAssignment } = await import('./meDiscordNotify.js');
            await notifyAssignment(db, assignedName, assignedTitle, postResult.url, {
                decedent: name || 'Unknown',
                ooc: oocName || '',
                caseNumber: String(caseNum),
                deathType: entryExtras.parsed?.deathType === 'CK' ? 'CK' : 'PK',
                requestTopicId: topicId,
            });
            notified = true;
        } catch (e) { console.warn(`[PRIVATE-CASE] ME notify failed #${caseNum}: ${e.message}`); }
    } else {
        console.warn(`[PRIVATE-CASE] Case #${caseNum} created UNASSIGNED — rotation returned no ME`);
    }

    console.log(`[PRIVATE-CASE] Case #${caseNum} -> topic #${topicId} (${assignedName || 'UNASSIGNED'}) source=${source}`);
    return { caseNum: String(caseNum), topicId, url: postResult.url, assignedTo: assignedName || null, caseTitle: assignedTitle, notified };
}
