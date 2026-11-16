/**
 * privateWebAutopsyIntake.js — web "Private Autopsy" requests.
 *
 * The web app writes these to `autopsy-requests/private-pending` (never to the
 * public `autopsy-requests/pending` queue, so the f=265 poster can never
 * publish them, even if this service is off or stale).
 *
 * With PRIVATE_WEB_MODE=live this service opens the confidential f=266 case
 * directly: rotation ME assignment, title edit, assignment reply, staff
 * notification, and the `autopsy-requested/<topicId>` entry the completion
 * pipeline reads. No public request topic, no acknowledgement reply, no
 * agency crosspost — delivery is the completion step (DRDB for LSPD, forum PM
 * for LSSD/SADCR/DAO).
 *
 * Modes (env PRIVATE_WEB_MODE, owner command /private-web-autopsy):
 *   off    — queue only (default; nothing is posted)
 *   dryrun — validate + post a Discord "would create" notice, never the forum
 *   live   — create the case
 *
 * Safety:
 *   - status claim (pending -> creating) before any forum write; a `creating`
 *     entry older than an hour is parked for a human as `needs-review` and is
 *     never auto-retried (a partial post must not be duplicated).
 *   - duplicate guard: the same caseId|decedent|agency within 24h is parked.
 *   - validation fails closed (LE agency only, justification required).
 */

import firebase from './firebase.js';
import { getForumClient } from './forumClient.js';
import { isDevTestActive, devWebhookUrl } from './devRouting.js';
import { createPrivateCase, nextCaseNumber } from './privateCaseCreation.js';
import {
    buildPrivateSubmittedNotification,
    buildPrivateCreatedNotification,
} from './webAutopsyRequestEmbed.js';

const PENDING_PATH = 'autopsy-requests/private-pending';
const PHMC_BASE = 'https://phmc.gta.world';
const NOTIFY_WEBHOOK_ENV = 'AUTOPSY_REQUEST_WEBHOOK_URL';
const RETRY_BACKOFF_MS = 5 * 60 * 1000;
const STUCK_MS = 60 * 60 * 1000;
const SEND_TIMEOUT_MS = 10000;

const LE_AGENCIES = ['LSPD', 'LSSD', 'SADCR', 'DAO'];
const JUSTIFICATION_MIN = 10;

let _listenerRef = null;
const _queue = [];
let _draining = false;
const _retryTimers = new Map();

export function privateWebMode() {
    const m = String(process.env.PRIVATE_WEB_MODE || 'off').trim().toLowerCase();
    return ['off', 'dryrun', 'live'].includes(m) ? m : 'off';
}

export const isPrivateWebLive = () => privateWebMode() === 'live';

/** LE agency from the explicit selector and/or the department string. */
export function detectLeAgency(entry = {}) {
    const explicit = String(entry.agencyForum || '').trim().toUpperCase();
    const dept = String(entry.requesterDept || '').trim();
    const fromDept = /^lspd\b/i.test(dept) || /los santos police|police department/i.test(dept) ? 'LSPD'
        : /^lssd\b/i.test(dept) || /sheriff/i.test(dept) ? 'LSSD'
            : /^sadcr\b/i.test(dept) || /correction|parole/i.test(dept) ? 'SADCR'
                : /^dao\b/i.test(dept) || /district attorney/i.test(dept) ? 'DAO'
                    : '';
    if (explicit && LE_AGENCIES.includes(explicit)) {
        if (fromDept && fromDept !== explicit) {
            return { ok: false, agency: explicit, reason: `agency forum ${explicit} does not match department "${dept}"` };
        }
        return { ok: true, agency: explicit };
    }
    if (!explicit && fromDept) return { ok: true, agency: fromDept };
    return { ok: false, agency: '', reason: 'a law enforcement agency forum (LSPD, LSSD, SADCR or DAO) is required' };
}

/**
 * Fail-closed validation for a private-pending entry.
 * @returns {string[]} problems (empty when the entry may be created)
 */
export function validatePrivateWebEntry(entry = {}) {
    const problems = [];
    const le = detectLeAgency(entry);
    if (!le.ok) problems.push(le.reason || 'not a law enforcement agency');
    if (!String(entry.decedentName || '').trim()) problems.push('decedent name missing');
    if (!String(entry.requesterName || '').trim()) problems.push('requester name missing');
    if (!String(entry.requesterRank || '').trim()) problems.push('requester rank missing');
    if (!String(entry.requesterDept || '').trim()) problems.push('requester department missing');
    if (String(entry.privateJustification || '').trim().length < JUSTIFICATION_MIN) {
        problems.push(`private justification missing (min ${JUSTIFICATION_MIN} chars)`);
    }
    const isLspd = le.agency === 'LSPD';
    if (!isLspd && !String(entry.forumAccountUrl || '').trim()) {
        problems.push('forum account URL missing (delivery target)');
    }
    return problems;
}

/**
 * Confidential f=266 case body. Mirrors
 * src/utils/autopsyRequest.js -> buildPrivateAutopsyCaseBBCode (the modal
 * preview); this build is the authoritative post.
 */
export function buildPrivateWebCaseBbcode(entry = {}) {
    const raw = (v) => String(v ?? '').trim();
    const ans = (v) => raw(v) || 'D.N.A (Did Not Answer)';
    const ooc = raw(entry.oocName);
    const nameLine = `${raw(entry.decedentName) || 'Unknown'}${ooc ? ` ((${ooc}))` : ''}`;
    return `[divbox=white][center][b][size=150]CONFIDENTIAL AUTOPSY REQUEST[/size][/b][/center]
[center][size=65]LOS SANTOS DEPARTMENT OF MEDICAL EXAMINER-CORONER[/size][/center]
[center][b][color=#800000]NOT FOR PUBLIC RELEASE[/color][/b][/center][/divbox]
[divbox=white]
[b]SECTION 1: REQUESTER'S INFORMATION[/b]
[b]1.) Name:[/b] ${ans(entry.requesterName)}
[b]2.) Rank:[/b] ${ans(entry.requesterRank)}
[b]3.) Department / Assignment:[/b] ${ans(entry.requesterDept)}
[b]4.) Badge/Serial Number:[/b] ${ans(entry.requesterBadge)}
[b]5.) Read and understood Autopsy Guidelines:[/b] ${entry.guidelinesRead ? 'YES' : 'NO'}
[b]6.) Contact Information:[/b] Cell ${ans(entry.requesterCell)} | Forum ${ans(entry.forumAccountUrl)} | (( Discord ${ans(entry.requesterDiscord)} ))
[b]PRIVATE REQUEST - JUSTIFICATION / AUTHORITY:[/b] ${ans(entry.privateJustification)}
[/divbox]
[divbox=white]
[b]SECTION 2: DECEDENT'S INFORMATION[/b]
[b]1.) Decedent Name:[/b] ${nameLine}
[b]2.) Gender:[/b] ${ans(entry.gender)}
[b]3.) Ethnicity:[/b] ${ans(entry.ethnicity)}
[b]4.) Date of Death:[/b] ${ans(entry.dateOfDeath)}
[b]5.) Time of Death:[/b] ${ans(entry.timeOfDeath)}
[b]6.) Location:[/b] ${ans(entry.placeOfDeath)}
[/divbox]
[divbox=white]
[b]SECTION 3: DETAILS[/b]
[b]1.) Synopsis:[/b] ${ans(entry.synopsis)}
[b]2.) Reason for Autopsy:[/b] ${ans(entry.causeDetail)}
[/divbox]
[divbox=white]
[b]SECTION 4: OOC INFORMATION[/b]
[b]1.) PK/CK:[/b] ${entry.deathType === 'CK' ? 'CK' : 'PK'}
[b]2.) /cexamine:[/b] ${raw(entry.cexamineImg) ? `[img]${raw(entry.cexamineImg)}[/img]` : 'Image not provided'}
[b]3.) /cinjuries:[/b] ${raw(entry.cinjuriesImg) ? `[img]${raw(entry.cinjuriesImg)}[/img]` : 'Image not provided'}
[/divbox]`;
}

/** Stable duplicate key for a submission. */
export const privateDedupeKey = (entry = {}) => [
    String(entry.caseId || '').trim(),
    String(entry.decedentName || '').trim().toLowerCase(),
    String(entry.agencyForum || '').trim().toUpperCase(),
].join('|');

function getNotifyWebhookUrl() {
    if (isDevTestActive()) return devWebhookUrl(NOTIFY_WEBHOOK_ENV);
    return process.env[NOTIFY_WEBHOOK_ENV] || '';
}

async function postNotification(payload) {
    const url = getNotifyWebhookUrl();
    if (!url) return false;
    try {
        const res = await Promise.race([
            fetch(url + '?with_components=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('webhook send timed out')), SEND_TIMEOUT_MS)),
        ]);
        if (!res.ok) {
            console.warn(`[WEB-PRIVATE] Notification failed (HTTP ${res.status})`);
            return false;
        }
        return true;
    } catch (err) {
        console.warn(`[WEB-PRIVATE] Notification send error: ${err.message}`);
        return false;
    }
}

const notifySubmitted = (entry) => postNotification(buildPrivateSubmittedNotification(entry));
const notifyCreated = (entry, url) => postNotification(buildPrivateCreatedNotification(entry, url));

export function startPrivateWebAutopsyIntake() {
    firebase.init();
    console.log(`[WEB-PRIVATE] Starting web private autopsy intake (mode=${privateWebMode()})`);
    const ref = firebase.db.ref(PENDING_PATH);
    _listenerRef = ref;

    ref.on('child_added', (snap) => {
        if (!snap.exists()) return;
        const entry = snap.val();
        if (!entry || typeof entry !== 'object') return;
        if (String(entry.status || 'pending') !== 'pending') return;
        _queue.push({ id: snap.key, entry });
        drain();
    });

    ref.on('child_changed', (snap) => {
        if (!snap.exists()) return;
        const entry = snap.val();
        if (!entry || typeof entry !== 'object') return;
        if ((entry.attempts || 0) > 0 && String(entry.status || 'pending') === 'pending' && entry.nextRetryAt) {
            scheduleRetry(snap.key, entry);
        }
    });

    // Crash guard: a `creating` entry that never finished is parked for a human
    // (never retried — the topic may already exist).
    ref.once('value').then((snap) => {
        const all = snap.val() || {};
        for (const [id, entry] of Object.entries(all)) {
            if (!entry || String(entry.status) !== 'creating') continue;
            const claimed = Number(entry.claimedAt || 0);
            if (claimed && Date.now() - claimed < STUCK_MS) continue;
            ref.child(id).update({ status: 'needs-review', stuckFlaggedAt: Date.now() })
                .then(() => notifyStuck(id, entry))
                .catch(() => {});
        }
    }).catch(() => {});
}

export function stopPrivateWebAutopsyIntake() {
    if (_listenerRef) {
        _listenerRef.off('child_added');
        _listenerRef.off('child_changed');
        _listenerRef = null;
    }
    for (const t of _retryTimers.values()) clearTimeout(t);
    _retryTimers.clear();
    _queue.length = 0;
}

/**
 * Re-scan `private-pending` and process whatever is queued. Called after the
 * owner switches the mode on (submissions that arrived while off are still
 * queued — the drain would otherwise only run on the next RTDB event).
 */
export async function resumePrivateWebIntake() {
    try {
        const snap = await firebase.db.ref(PENDING_PATH).once('value');
        const all = snap.val() || {};
        for (const [id, entry] of Object.entries(all)) {
            if (!entry || typeof entry !== 'object') continue;
            if (String(entry.status || 'pending') !== 'pending') continue;
            if (_queue.some((q) => q.id === id)) continue;
            _queue.push({ id, entry });
        }
    } catch (err) {
        console.warn(`[WEB-PRIVATE] rescan failed: ${err.message}`);
    }
    drain();
}

async function notifyStuck(id, entry) {
    await postNotification({
        username: 'PHMC Autopsy Requests',
        content: `**[PRIVATE] Web request ${id} is stuck in "creating" — needs review**`,
        embeds: [{
            title: 'Private autopsy intake stuck',
            color: 0xe74c3c,
            description: `Decedent: ${entry?.decedentName || 'Unknown'} · claimed ${entry?.claimedAt ? new Date(Number(entry.claimedAt)).toISOString() : 'unknown'}. Check f=266 for a partial case topic before handling manually — auto-retry is disabled to prevent a duplicate.`,
            timestamp: new Date().toISOString(),
        }],
    });
}

function scheduleRetry(id, entry) {
    const wait = Math.max(0, (entry.nextRetryAt || 0) - Date.now());
    if (_retryTimers.has(id)) clearTimeout(_retryTimers.get(id));
    const t = setTimeout(async () => {
        _retryTimers.delete(id);
        try {
            const snap = await firebase.db.ref(`${PENDING_PATH}/${id}`).once('value');
            if (!snap.exists()) return;
            const cur = snap.val();
            if (!cur || String(cur.status || 'pending') !== 'pending') return;
            if (cur.nextRetryAt && Date.now() < cur.nextRetryAt) { scheduleRetry(id, cur); return; }
            _queue.push({ id, entry: cur });
            drain();
        } catch (err) {
            console.error(`[WEB-PRIVATE] #${id} retry re-check error: ${err.message}`);
        }
    }, wait);
    _retryTimers.set(id, t);
}

async function drain() {
    if (_draining) return;
    if (privateWebMode() === 'off') return;
    _draining = true;
    try {
        while (_queue.length > 0) {
            const { id, entry } = _queue.shift();
            if (String(entry.status || 'pending') !== 'pending') continue;
            try {
                await processEntry(id, entry);
            } catch (err) {
                console.error(`[WEB-PRIVATE] #${id} failed: ${err.message}`);
                await markRetry(id, entry, err.message);
            }
        }
    } finally {
        _draining = false;
    }
}

async function processEntry(id, entry) {
    const db = firebase.db;
    const mode = privateWebMode();
    if (mode === 'off') return;

    // Re-read before acting: the queued copy can be stale (a retry timer and a
    // child_changed can enqueue the same id). Never create a case from stale
    // state — a second pass must see `posted`/`creating` and stop.
    const freshSnap = await db.ref(`${PENDING_PATH}/${id}`).once('value');
    if (!freshSnap.exists()) return;
    entry = freshSnap.val() || {};
    if (String(entry.status || 'pending') !== 'pending') return;

    // A topic was already posted but the run did not finish. Reposting would
    // duplicate the case, so park it for a human instead.
    if (entry.caseTopicId) {
        await db.ref(`${PENDING_PATH}/${id}`).update({
            status: 'needs-review',
            lastError: `Case topic ${entry.caseTopicId} already posted but the run did not finish — finish or delete it manually (never reposted)`,
        });
        await notifyStuck(id, entry);
        return;
    }

    const problems = validatePrivateWebEntry(entry);
    if (problems.length) {
        console.warn(`[WEB-PRIVATE] #${id} rejected: ${problems.join('; ')}`);
        await db.ref(`${PENDING_PATH}/${id}`).update({
            status: 'rejected',
            lastError: problems.join('; ').slice(0, 500),
            rejectedAt: Date.now(),
        });
        await postNotification({
            username: 'PHMC Autopsy Requests',
            content: '**[PRIVATE] Web request rejected — nothing was posted**',
            embeds: [{
                title: entry?.decedentName ? `Private request — ${entry.decedentName}` : 'Private request',
                color: 0xe74c3c,
                fields: [{ name: 'Problems', value: problems.join('\n').slice(0, 1000) }],
                timestamp: new Date().toISOString(),
            }],
        });
        return;
    }

    const le = detectLeAgency(entry);

    // Dry run: validate + notify, never claim or post.
    if (mode === 'dryrun') {
        const client = getForumClient();
        await client.ensureBrowser();
        await client.login(null, null, { force: false, baseUrl: PHMC_BASE });
        const caseNum = await nextCaseNumber(client);
        const title = `Case ${caseNum} - ${entry.decedentName || 'Unknown'}${entry.oocName ? ` ((${entry.oocName}))` : ''} [PRIVATE] - UNASSIGNED`;
        console.log(`[WEB-PRIVATE] #${id} DRY RUN — would create "${title}" (${le.agency})`);
        await db.ref(`${PENDING_PATH}/${id}`).update({
            status: 'dryrun',
            lastError: `${title} | ${le.agency} | justification: ${String(entry.privateJustification || '').slice(0, 200)}`,
            dryrunAt: Date.now(),
        });
        await notifyCreated({ ...entry, topicTitle: title, agencyForum: le.agency }, '');
        return;
    }

    // Claim FIRST, then de-duplicate: two submissions of the same request can
    // never both pass the duplicate check and both create a case.
    await db.ref(`${PENDING_PATH}/${id}`).update({ status: 'creating', claimedAt: Date.now() });

    const dup = await findDuplicate(id, entry, le.agency);
    if (dup) {
        console.warn(`[WEB-PRIVATE] #${id} duplicate of #${dup} — parked`);
        await db.ref(`${PENDING_PATH}/${id}`).update({
            status: 'duplicate',
            duplicateOf: dup,
            lastError: `Duplicate of ${dup} (same case/decedent/agency within 24h)`,
            rejectedAt: Date.now(),
        });
        return;
    }

    if (!entry.submittedNotifiedAt) {
        await notifySubmitted(entry);
        await db.ref(`${PENDING_PATH}/${id}`).update({ submittedNotifiedAt: Date.now() }).catch(() => {});
    }

    const client = getForumClient();
    await client.ensureBrowser();
    await client.login(null, null, { force: false, baseUrl: PHMC_BASE });

    const caseNum = await nextCaseNumber(client);
    const agency = le.agency;
    const created = await createPrivateCase({
        db,
        client,
        caseNum,
        name: entry.decedentName || 'Unknown',
        oocName: entry.oocName || '',
        bbCode: buildPrivateWebCaseBbcode(entry),
        source: 'web-private',
        onPosted: async ({ topicId, url }) => {
            // Persist the topic BEFORE any wiring continues — a crash after the
            // post must never let a retry create a second case.
            await db.ref(`${PENDING_PATH}/${id}`).update({
                caseTopicId: topicId,
                caseUrl: url,
                caseNum: String(caseNum),
            });
        },
        entryExtras: {
            agencyForum: agency,
            faction: agency.toLowerCase(),
            formsAutopsy: true,
            forumAccountUrl: String(entry.forumAccountUrl || '').trim(),
            pmForum: agency.toLowerCase(),
            deliveryDRDB: agency === 'LSPD',
            webRequestId: id,
            privateJustification: String(entry.privateJustification || '').trim(),
            parsed: {
                requesterName: entry.requesterName || '',
                requesterRank: entry.requesterRank || '',
                requesterDept: entry.requesterDept || '',
                requesterBadge: entry.requesterBadge || '',
                requesterCell: entry.requesterCell || '',
                requesterDiscord: entry.requesterDiscord || '',
                deathType: entry.deathType === 'CK' ? 'CK' : 'PK',
                dateOfDeath: entry.dateOfDeath || '',
                timeOfDeath: entry.timeOfDeath || '',
                placeOfDeath: entry.placeOfDeath || '',
                decedentName: entry.decedentName || '',
                oocName: entry.oocName || '',
                gender: entry.gender || '',
                ethnicity: entry.ethnicity || '',
                synopsis: entry.synopsis || '',
                causeDetail: entry.causeDetail || '',
            },
        },
    });

    await db.ref(`${PENDING_PATH}/${id}`).update({
        status: 'posted',
        caseNum: created.caseNum,
        caseTopicId: created.topicId,
        caseUrl: created.url,
        assignedTo: created.assignedTo,
        postedAt: Date.now(),
    });
    await notifyCreated({ ...entry, topicTitle: created.caseTitle, agencyForum: agency, caseNum: created.caseNum, assignedTo: created.assignedTo }, created.url);
    // Same faction intake total the f=265 monitor bumps, so autopsy statistics
    // do not silently drop private requests.
    try {
        const { bumpFactionCounter } = await import('./autopsyRequestMonitor.js');
        bumpFactionCounter(agency);
    } catch { /* stats are best-effort */ }
    console.log(`[WEB-PRIVATE] #${id} [OK] Case #${created.caseNum} -> ${created.url}`);
}

async function findDuplicate(id, entry, agency) {
    try {
        const key = privateDedupeKey({ ...entry, agencyForum: agency || entry.agencyForum });
        if (!key || key.split('|').filter(Boolean).length < 2) return null;
        const snap = await firebase.db.ref(PENDING_PATH).once('value');
        const all = snap.val() || {};
        for (const [otherId, other] of Object.entries(all)) {
            if (otherId === id || !other || typeof other !== 'object') continue;
            const status = String(other.status || 'pending');
            if (!['pending', 'creating', 'posted', 'dryrun', 'needs-review'].includes(status)) continue;
            const age = Date.now() - Number(other.createdAt || other.postedAt || 0);
            if (!(age < 24 * 60 * 60 * 1000)) continue;
            if (privateDedupeKey({ ...other, agencyForum: agency || other.agencyForum }) === key) return otherId;
        }
        return null;
    } catch {
        return null;
    }
}

async function markRetry(id, entry, message) {
    let attempts = (entry.attempts || 0) + 1;
    try {
        const snap = await firebase.db.ref(`${PENDING_PATH}/${id}`).once('value');
        const cur = snap.exists() ? snap.val() : null;
        if (cur && typeof cur === 'object') attempts = (cur.attempts || 0) + 1;
    } catch { /* count is telemetry only */ }
    await firebase.db.ref(`${PENDING_PATH}/${id}`).update({
        status: 'pending',
        attempts,
        lastError: String(message || 'Unknown error').slice(0, 500),
        lastAttemptAt: Date.now(),
        nextRetryAt: Date.now() + RETRY_BACKOFF_MS,
    }).catch(() => {});
    if (attempts === 1) {
        await postNotification({
            username: 'PHMC Autopsy Requests',
            content: `**[PRIVATE] Web request ${id} could not create its case — will keep retrying**`,
            embeds: [{
                title: entry?.decedentName ? `Private request — ${entry.decedentName}` : 'Private request',
                color: 0xdc3545,
                fields: [{ name: 'Reason', value: String(message || 'Unknown error').slice(0, 1000) }],
                timestamp: new Date().toISOString(),
            }],
        });
    }
}
