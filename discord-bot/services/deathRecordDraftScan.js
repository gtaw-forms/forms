/**
 * deathRecordDraftScan.js — Firebase scanning, listeners, and passive CK
 * monitoring for the Death Record draft system.
 */
import { findMorgueRecord, shortId, initMorgueCache, updateMorgueCache, getMorgueCache, isMorgueCacheLoaded, parseDate, morgueMatchDebug, morgueTimeMs, isMorgueRecordIdentified } from './deathRecordDraftCache.js';
import { generateDraft, baseReportKey, decedentFromReport, buildVirtualReportData } from './deathRecordDraftGenerator.js';
import { sendDraft, updateDraftWithMorgue, DRAFT_CHANNEL_ID } from './deathRecordDraftUI.js';
import { sendLogMessage } from './logChannel.js';
import { isFaceConfigured, findFacePostByContent } from './facePost.js';

const DRAFT_TRACK_PATH = 'deathRecordDrafts';

// Statuses that mean an approval fully completed (nothing to recover).
const FINAL_DRAFT_STATUSES = ['approved', 'denied', 'simulated', 'approved_simulated'];

/**
 * Whether a morgue record is an unidentified case ("Unknown (( ... ))") that
 * can't be validated. Pass the report's `decedentOOC` so an unidentified record
 * whose (( )) name matches it counts as identified (that name is the real
 * identity). Drafts matched to genuinely-unidentified records are low-confidence.
 */
function isLowMatch(rec, reportOoc) {
    if (!rec) return false;
    return !isMorgueRecordIdentified(rec, reportOoc);
}

/**
 * Locate the source report for a draft. Mass-fatality drafts store keys with a
 * `_decedentN` suffix; the actual report lives under the base key.
 */
async function findSourceReport(db, authorId, reportKey) {
    const candidates = [...new Set([reportKey, baseReportKey(reportKey)])];
    for (const candidateKey of candidates) {
        for (const path of ['scheduledReports', 'newSavedReports']) {
            const snap = await db.ref(`${path}/${authorId}/${candidateKey}`).once('value').catch(() => null);
            if (snap?.exists()) return { path, reportKey: candidateKey, ...snap.val() };
        }
    }
    return null;
}

/**
 * Wrap a source report in the per-decedent view a draft expects. For a
 * mass-fatality report this merges the `_decedentN` entry over the base data;
 * for regular reports the data is returned as-is.
 */
function viewReportForDraft(reportData, reportKey) {
    if (reportData?.formId === 'mass-ftality-test') {
        const dec = decedentFromReport(reportData, reportKey);
        if (dec) return { ...reportData, data: buildVirtualReportData(reportData, dec) };
    }
    return reportData;
}

/**
 * Recovery sweep for death record approvals interrupted by a crash/restart.
 *
 * handleApprove marks a draft with `deploying: true` before posting. If the
 * bot dies mid-approval, the draft is left with `deploying: true` and a
 * non-final status. This sweep (called at startup) finds those drafts, uses the
 * Facebrowser API to verify whether the auto Face post actually landed, records
 * it if found, clears the flag, and alerts staff so the forum post can be
 * safely re-approved (or confirmed) without duplicating the Face post.
 */
export async function recoverInterruptedDeathRecordApprovals(db) {
    try {
        const snap = await db.ref(DRAFT_TRACK_PATH).orderByChild('deploying').equalTo(true).once('value');
        if (!snap.exists()) {
            console.log('[DRAFT] [OK] No interrupted death record approvals to recover');
            return;
        }

        const entries = [];
        snap.forEach((child) => entries.push({ key: child.key, val: child.val() }));

        let stuck = 0;
        let verifiedFace = 0;

        for (const { key, val } of entries) {
            // Already finished (approval succeeded then crash after the write):
            // just clear the leftover flag.
            if (FINAL_DRAFT_STATUSES.includes(val.status)) {
                await db.ref(`${DRAFT_TRACK_PATH}/${key}/deploying`).set(false).catch(() => {});
                continue;
            }
            stuck++;

            let faceText = 'No Face post found — re-approve when ready.';
            if (isFaceConfigured()) {
                try {
                    const caseNum = val.values?.caseNumber
                        || (val.title?.match(/\[CASE #\d{4}-(\d+)\]/) || [])[1]
                        || '';
                    const searchText = caseNum ? `${new Date().getFullYear()}-${caseNum}` : '';
                    if (searchText) {
                        const hit = await findFacePostByContent(searchText);
                        if (hit) {
                            await db.ref(`facePostDrafts/${key}`).set({
                                reportKey: key,
                                forumUrl: val.deployedUrl || null,
                                forumTitle: val.title || '',
                                decedentName: val.decedentName || '',
                                status: 'approved',
                                deployedUrl: hit.url,
                                fbPostId: hit.postId,
                                deployedAt: Date.now(),
                                createdAt: Date.now(),
                                recovered: true,
                            });
                            try { await db.ref(`facePostDrafts/_ids/${shortId(key)}`).set(key); } catch (e) {}
                            verifiedFace++;
                            faceText = `Face post VERIFIED (${hit.url}). The forum post was interrupted — check f=404 before re-approving.`;
                        }
                    }
                } catch (err) {
                    console.warn(`[DRAFT] [WARN] Face verification failed for ${key}: ${err.message}`);
                }
            }

            await db.ref(`${DRAFT_TRACK_PATH}/${key}/deploying`).set(false).catch(() => {});
            console.log(`[DRAFT] [WARN] ${key} — interrupted approval (${val.status}): ${faceText}`);
            await sendLogMessage(null, {
                title: '[WARN] Death Record Approval Interrupted',
                description: `**${val.title || key}**\nBot restarted mid-approval.\n${faceText}`,
                color: 0xffc107,
            });
        }

        console.log(`[DRAFT] [OK] Recovery scan — ${stuck} interrupted approval(s), ${verifiedFace} Face post(s) verified`);
    } catch (err) {
        console.error('[DRAFT] [ERR] Recovery scan error:', err.message);
    }
}

// ── Main Entry Point ──

/**
 * Process a report for Death Record drafting.
 * Called from autoDeploy when a CK coroner report or mass fatality is detected.
 *
 * @param {object} db - Firebase database ref
 * @param {string} authorId
 * @param {string} reportKey
 * @param {object} reportData - The report data from scheduledReports
 * @returns {Promise<boolean>} true if a draft was sent
 */
export async function processCKReport(db, authorId, reportKey, reportData) {
    if (_draftingInFlight.has(reportKey)) {
        console.log(`[DRAFT] [WARN] ${reportKey} — already drafting this session, skipping duplicate`);
        return false;
    }
    _draftingInFlight.add(reportKey);
    try {
        const data = reportData?.data || {};
        const typeOfDeath = data.typeOfDeath?.value || data.typeOfDeath || '';

        if (typeOfDeath.toUpperCase() !== 'CK') {
            return false;
        }

        const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value').catch(() => null);
        if (draftSnap?.exists()) {
            console.log(`[DRAFT] [WARN] ${reportKey} — draft already sent`);
            return false;
        }

        const decedentName = data.decedentName || '';
        console.log(`[DRAFT] Processing CK report ${reportKey} — ${decedentName}`);

        const morgueRecord = await findMorgueRecord(db, decedentName, data.dateTime || data.dateOfDeath, data.decedentOOC);
        if (morgueRecord) {
            console.log(`[DRAFT] [OK] Found morgue match: Case #${morgueRecord.caseId}`);
        } else {
            console.log(`[DRAFT] [WARN] No morgue record found for "${decedentName}" — using report data only`);
        }

        const draft = generateDraft(reportData, morgueRecord);
        if (!draft) {
            console.error(`[DRAFT] [ERR] Failed to generate draft for ${reportKey}`);
            return false;
        }

        const needsMorgue = !morgueRecord;
        const lowMatch = !!morgueRecord && isLowMatch(morgueRecord, data.decedentOOC);
        const matchInfo = morgueRecord?.matchQuality || null;

        const msg = await sendDraft(draft, reportData, authorId, reportKey, needsMorgue, matchInfo);
        if (!msg) {
            return false;
        }

        await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).set({
            authorId,
            reportKey,
            title: draft.title,
            bbCode: draft.bbCode,
            values: draft.values,
            decedentName,
            decedentOOC: data.decedentOOC || '',
            status: 'pending_review',
            needsMorgue,
            needsBetterMorgue: lowMatch,
            morgueMatch: matchInfo,
            morgueCaseId: morgueRecord?.caseId || null,
            morgueCheckedAt: needsMorgue ? null : Date.now(),
            messageId: msg.id,
            channelId: DRAFT_CHANNEL_ID,
            createdAt: Date.now(),
            formId: reportData.formId,
        });

        try { await db.ref(DRAFT_TRACK_PATH + '/_ids/' + shortId(reportKey)).set(reportKey); } catch(e) {}

        console.log(`[DRAFT] [OK] Draft sent for ${reportKey}${needsMorgue ? ' (awaiting morgue data)' : ''}`);
        return true;
    } finally {
        _draftingInFlight.delete(reportKey);
    }
}

// ── Morgue Listener ──

/**
 * Start a Firebase listener on morgue-records that automatically re-checks
 * pending drafts whenever morgue data changes.
 * Call once at bot startup from autoDeploy.js.
 */
export function startMorgueListener(db) {
    console.log('[DRAFT] Starting morgue record listener...');
    let debounceTimer = null;

    const handleMorgueChange = (snap) => {
        if (getMorgueCache().length > 0) {
            const key = snap.key;
            const val = snap.val();
            if (val) {
                updateMorgueCache(key, val);
            }
        }
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            try {
                const morgueRecord = snap.val();
                const morgueName = (morgueRecord?.name || '').trim().toLowerCase();
                if (!morgueName) return;

                const [pendingSnap, betterSnap] = await Promise.all([
                    db.ref(DRAFT_TRACK_PATH)
                        .orderByChild('needsMorgue')
                        .equalTo(true)
                        .once('value')
                        .catch(() => null),
                    db.ref(DRAFT_TRACK_PATH)
                        .orderByChild('needsBetterMorgue')
                        .equalTo(true)
                        .once('value')
                        .catch(() => null),
                ]);

                const draftsByKey = new Map();
                for (const s of [pendingSnap, betterSnap]) {
                    if (!s?.exists()) continue;
                    s.forEach((child) => {
                        if (!draftsByKey.has(child.key)) draftsByKey.set(child.key, child.val());
                    });
                }
                if (draftsByKey.size === 0) return;

                if (morgueRecord.caseId !== undefined) {
                    console.log(`[DRAFT] Morgue change: Case #${morgueRecord.caseId} — ${morgueRecord.name}`);
                }

                for (const [key, draft] of draftsByKey) {
                    if (draft.status === 'approved' || draft.status === 'denied' || draft.status === 'simulated' || draft.status === 'approved_simulated') continue;
                    if (draft.status !== 'pending_review' && draft.status !== 'edited' && draft.status !== 'morgue_updated') continue;

                    const draftName = (draft.decedentName || '').trim().toLowerCase();
                    const draftOoc = (draft.decedentOOC || '').trim().toLowerCase();
                    if (draftName !== morgueName && draftOoc !== morgueName) continue;

                    recheckMorgueForDraft(db, key).then((found) => {
                        if (found) {
                            db.ref(`${DRAFT_TRACK_PATH}/${key}`).once('value').then((s) => {
                                const updated = s.val();
                                if (updated?.bbCode) {
                                    updateDraftWithMorgue(draft.messageId, updated.bbCode, updated.morgueMatch || null);
                                }
                            });
                            console.log(`[DRAFT] [OK] Auto-matched morgue Case #${morgueRecord.caseId} for ${draft.decedentName}`);
                        }
                    }).catch((err) => console.error('[DRAFT] [ERR] Morgue match error:', err.message));
                }
            } catch (err) {
                console.error('[DRAFT] [ERR] Morgue listener error:', err.message);
            }
        }, 3000);
    };

    db.ref('morgue-records').on('child_added', handleMorgueChange);
    db.ref('morgue-records').on('child_changed', handleMorgueChange);

    console.log('[DRAFT] [OK] Morgue record listener active');
}

// ── Pending Morgue Records Query ──

/**
 * Query all pending drafts that need morgue data.
 * Used by dashboardManager.js to show pending records.
 * @param {object} db - Firebase database ref
 * @returns {Promise<Array<{decedentName, reportKey, title, createdAt}>>}
 */
export async function getPendingMorgueRecords(db) {
    try {
        const snap = await db.ref(DRAFT_TRACK_PATH)
            .orderByChild('needsMorgue')
            .equalTo(true)
            .once('value');
        if (!snap.exists()) return [];

        const pending = [];
        snap.forEach((child) => {
            const val = child.val();
            if (val.status === 'pending_review' || val.status === 'edited') {
                pending.push({
                    decedentName: val.decedentName || 'Unknown',
                    reportKey: child.key,
                    title: val.title || '',
                    createdAt: val.createdAt || 0,
                });
            }
        });
        return pending;
    } catch (err) {
        console.error('[DRAFT] [ERR] getPendingMorgueRecords error:', err.message);
        return [];
    }
}

// ── Re-check Morgue for Draft ──

/**
 * Re-check morgue records for a draft that was created without a match.
 * Called by the "Check Morgue" button or the morgue listener.
 * @param {object} db - Firebase database ref
 * @param {string} reportKey
 * @returns {Promise<boolean>} true if morgue data was found and draft updated
 */
export async function recheckMorgueForDraft(db, reportKey) {
    try {
        const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value');
        const draftInfo = draftSnap.val();
        if (!draftInfo) return false;
        if (!draftInfo.needsMorgue && !draftInfo.needsBetterMorgue) return false;

        if (draftInfo.status === 'approved' || draftInfo.status === 'denied' || draftInfo.status === 'simulated' || draftInfo.status === 'approved_simulated') {
            console.log(`[DRAFT] [WARN] ${reportKey} — draft already ${draftInfo.status}, skipping morgue re-check`);
            return false;
        }

        const source = await findSourceReport(db, draftInfo.authorId, reportKey);
        if (!source) {
            console.log(`[DRAFT] [WARN] ${reportKey} — source coroner report not found in either path`);
            return false;
        }

        const reportData = viewReportForDraft(source, reportKey);

        const typeOfDeath = reportData.data?.typeOfDeath?.value || reportData.data?.typeOfDeath || '';
        if (typeOfDeath.toUpperCase() !== 'CK') {
            console.log(`[DRAFT] [WARN] ${reportKey} — source report is no longer a CK`);
            return false;
        }

        const reportOoc = reportData.data?.decedentOOC || '';
        let morgueRecord = await findMorgueRecord(db, reportData.data.decedentName, reportData.data?.dateTime || reportData.data?.dateOfDeath, reportOoc);
        // Unidentified decedents match the morgue record by OOC name (same fallback
        // used at draft creation) — e.g. "John Doe" (( Stacey Hoover )).
        if (!morgueRecord && reportOoc) {
            morgueRecord = await findMorgueRecord(db, reportOoc, reportData.data?.dateTime || reportData.data?.dateOfDeath, reportOoc);
        }
        if (!morgueRecord) {
            await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).update({
                morgueCheckedAt: Date.now(),
            });
            return false;
        }

        // Only regenerate when the match actually improved (different case, or a
        // low-confidence draft that now has a better candidate). Identical case +
        // already high-confidence means nothing changed.
        const newCase = morgueRecord.caseId || null;
        const wasLow = !!draftInfo.needsBetterMorgue;
        const isLow = isLowMatch(morgueRecord, reportOoc);
        if (draftInfo.morgueCaseId === newCase && !wasLow) return false;

        const newDraft = generateDraft(reportData, morgueRecord);
        if (!newDraft) return false;

        await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).update({
            bbCode: newDraft.bbCode,
            values: newDraft.values,
            needsMorgue: false,
            needsBetterMorgue: isLow,
            morgueMatch: morgueRecord?.matchQuality || null,
            morgueCheckedAt: Date.now(),
            morgueCaseId: newCase,
            status: draftInfo.status === 'pending_review' ? 'morgue_updated' : draftInfo.status,
        });

        try { await db.ref(DRAFT_TRACK_PATH + '/_ids/' + shortId(reportKey)).set(reportKey); } catch(e) {}

        console.log(`[DRAFT] [OK] Morgue data updated for ${reportKey} — Case #${newCase}${isLow ? ' (still low-confidence)' : ''}`);
        return true;
    } catch (err) {
        console.error(`[DRAFT] [ERR] recheckMorgueForDraft error for ${reportKey}:`, err.message);
        return false;
    }
}

// ── Passive CK Monitoring (newSavedReports) ──

const CK_EPOCH = 1782864000000; // 2026-07-01T00:00:00Z
let _knownPassiveCKKeys = null;

// In-memory dedup across the two drafting triggers. Both autoDeploy's
// scheduledReports listener AND the passive newSavedReports listener
// (startCKListener) call passivCKCheck for the same report — if a report is
// present in both paths the two runs race past the Firebase exists-check
// (read-then-write, non-atomic) and each sends a draft. Guarding here
// synchronously (before any await) makes the dedup race-free.
const _draftingInFlight = new Set();

/**
 * Shared helper: silently check if a report is CK, look up morgue database,
 * and create a death record draft ONLY if a morgue match is found.
 */
async function checkAndDraftIfMorgueMatched(db, authorId, reportKey, reportData) {
    if (_draftingInFlight.has(reportKey)) {
        console.log(`[DRAFT] [WARN] ${reportKey} — already drafting this session, skipping duplicate`);
        return false;
    }
    _draftingInFlight.add(reportKey);
    try {
        const data = reportData?.data || {};
        const decedentName = data.decedentName || '';
        if (!decedentName) return false;

        const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value').catch(() => null);
        if (draftSnap?.exists()) return false;

        const refDate = data.dateTime || data.dateOfDeath;
        let morgueRecord = await findMorgueRecord(db, decedentName, refDate, data.decedentOOC);
        // Unidentified decedents (e.g. "John Doe") won't match the morgue record by
        // IC name — the real identity lives in the OOC field (e.g. "(( Stacey Hoover ))"),
        // which the morgue record name contains. Fall back to it before giving up.
        if (!morgueRecord && data.decedentOOC) {
            morgueRecord = await findMorgueRecord(db, data.decedentOOC, refDate, data.decedentOOC);
        }
        if (!morgueRecord) {
            console.log(`[DRAFT] [WARN] ${reportKey} — ${decedentName}: no morgue match yet, waiting silently`);
            return false;
        }

        const draft = generateDraft(reportData, morgueRecord);
        if (!draft) return false;

        const lowMatch = isLowMatch(morgueRecord, data.decedentOOC);
        const msg = await sendDraft(draft, reportData, authorId, reportKey, false, morgueRecord?.matchQuality || null);
        if (!msg) return false;

        await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).set({
            authorId,
            reportKey,
            title: draft.title,
            bbCode: draft.bbCode,
            values: draft.values,
            decedentName,
            decedentOOC: data.decedentOOC || '',
            status: 'pending_review',
            needsMorgue: false,
            needsBetterMorgue: lowMatch,
            morgueMatch: morgueRecord?.matchQuality || null,
            morgueCheckedAt: Date.now(),
            morgueCaseId: morgueRecord.caseId || null,
            messageId: msg.id,
            channelId: DRAFT_CHANNEL_ID,
            createdAt: Date.now(),
            formId: reportData.formId,
        });

        try { await db.ref(DRAFT_TRACK_PATH + '/_ids/' + shortId(reportKey)).set(reportKey); } catch(e) {}

        console.log(`[DRAFT] [OK] Auto-drafted death record for ${reportKey} — ${decedentName} (Case #${morgueRecord.caseId})`);
        return true;
    } finally {
        _draftingInFlight.delete(reportKey);
    }
}

/**
 * Route a report to the passive CK check — handles both coroner-report (single)
 * and mass-ftality-test (array of decedents).
 */
export async function passivCKCheck(db, authorId, reportKey, reportData) {
    if (reportData.formId === 'coroner-report') {
        const typeOfDeath = reportData.data?.typeOfDeath?.value || reportData.data?.typeOfDeath || '';
        if (typeOfDeath.toUpperCase() !== 'CK') return;
        await checkAndDraftIfMorgueMatched(db, authorId, reportKey, reportData);
    }

    if (reportData.formId === 'mass-ftality-test') {
        const decedents = Array.isArray(reportData.data?.decedents) ? reportData.data.decedents : [];
        for (let i = 0; i < decedents.length; i++) {
            const dec = decedents[i];
            const decType = (dec.typeOfDeath || '').toString().toUpperCase();
            if (decType !== 'CK') continue;

            const virtualData = buildVirtualReportData(reportData, dec);

            const virtualReport = { ...reportData, data: virtualData };
            const virtualKey = `${reportKey}_decedent${i}`;
            await checkAndDraftIfMorgueMatched(db, authorId, virtualKey, virtualReport);
        }
    }
}

/**
 * Start a listener on newSavedReports that passively monitors for CK reports.
 * Silently checks each report against the morgue database. Only creates a
 * death record draft if a morgue match is found.
 */
export function startCKListener(db) {
    if (_knownPassiveCKKeys) {
        console.log('[DRAFT] [WARN] Passive CK listener already active');
        return;
    }

    if (!isMorgueCacheLoaded()) {
        initMorgueCache(db).catch(() => {});
    }

    _knownPassiveCKKeys = new Set();

    console.log(`[DRAFT] Passive CK listener active on newSavedReports — skipping reports saved before 01/JUL/2026`);

    db.ref('newSavedReports').on('value', (snap) => {
        snap.forEach((authorSnap) => {
            const authorId = authorSnap.key;
            authorSnap.forEach((reportSnap) => {
                const reportKey = reportSnap.key;
                if (_knownPassiveCKKeys.has(reportKey)) return;
                _knownPassiveCKKeys.add(reportKey);

                const reportData = reportSnap.val();
                if (reportData.timestamp && reportData.timestamp < CK_EPOCH) return;

                if (reportData.formId === 'coroner-report' || reportData.formId === 'mass-ftality-test') {
                    passivCKCheck(db, authorId, reportKey, reportData);
                }
            });
        });
    });

    console.log('[DRAFT] [OK] Passive CK listener active');
}

// ── Manual CK Scan (for /death-record-check command) ──

function parseDateFilter(str) {
    if (!str) return null;
    const m = str.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{4})$/);
    if (!m) return null;
    const months = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
    const month = months[m[2].toUpperCase()];
    if (month === undefined) return null;
    return new Date(Date.UTC(parseInt(m[3]), month, parseInt(m[1])));
}

function toUTCDateKey(date) {
    if (!date || isNaN(date.getTime())) return null;
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Scan CK coroner reports (optionally filtered), match against morgue records,
 * and create death record drafts.
 *
 * @param {object} db - Firebase database ref
 * @param {object} [options]
 * @param {string} [options.date] - Filter by date of death, "DD/MMM/YYYY" format
 * @returns {Promise<{total:number, drafted:number, alreadyExists:number, nameMatched:number, dateMatched:number, noMatch:number, errors:string[]}>}
 */
export async function scanAndDraftCKs(db, options = {}) {
    const results = { total: 0, drafted: 0, alreadyExists: 0, nameMatched: 0, dateMatched: 0, noMatch: 0, errors: [] };
    const ckReports = [];

    const filterDate = parseDateFilter(options.date);
    const filterDateKey = filterDate ? toUTCDateKey(filterDate) : null;

    for (const path of ['scheduledReports', 'newSavedReports']) {
        const snap = await db.ref(path).once('value').catch(() => null);
        if (!snap?.exists()) continue;

        snap.forEach((authorSnap) => {
            const authorId = authorSnap.key;
            authorSnap.forEach((reportSnap) => {
                const reportKey = reportSnap.key;
                const reportData = reportSnap.val();

                if (reportData.formId !== 'coroner-report') return;
                const typeOfDeath = reportData.data?.typeOfDeath?.value || reportData.data?.typeOfDeath || '';
                if (typeOfDeath.toUpperCase() !== 'CK') return;

                if (filterDateKey) {
                    const dod = reportData.data?.dateTime || reportData.data?.dateOfDeath || '';
                    if (!dod) return;
                    const reportDateKey = toUTCDateKey(new Date(dod));
                    if (!reportDateKey || reportDateKey !== filterDateKey) return;
                }

                ckReports.push({ authorId, reportKey, reportData });
            });
        });
    }

    results.total = ckReports.length;

    const morgueSnap = await db.ref('morgue-records').once('value').catch(() => null);
    const allMorgueRecords = [];
    if (morgueSnap?.exists()) {
        morgueSnap.forEach((child) => {
            allMorgueRecords.push({ ...child.val(), firebaseKey: child.key });
        });
    }

    for (const { authorId, reportKey, reportData } of ckReports) {
        try {
            const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value').catch(() => null);
            if (draftSnap?.exists()) {
                results.alreadyExists++;
                continue;
            }

            const decedentName = (reportData.data?.decedentName || '').trim().toLowerCase();
            const reportDod = reportData.data?.dateTime || reportData.data?.dateOfDeath || '';
            const reportTime = parseDate(reportDod);

            let morgueMatch = null;

            // Name matches (exact or partial) — when several records share a name,
            // prefer the one whose death date is closest to the report.
            const nameMatches = allMorgueRecords.filter((m) => {
                const recName = (m.name || '').trim().toLowerCase();
                return recName === decedentName || recName.includes(decedentName) || decedentName.includes(recName);
            });

            if (nameMatches.length > 0) {
                if (nameMatches.length > 1 && !isNaN(reportTime)) {
                    let bestDist = Infinity;
                    for (const m of nameMatches) {
                        let mTime = morgueTimeMs(m);
                        if (isNaN(mTime)) mTime = m.lastUpdated || 0;
                        const dist = Math.abs((mTime || 0) - reportTime);
                        if (dist < bestDist) {
                            bestDist = dist;
                            morgueMatch = m;
                        }
                    }
                } else {
                    morgueMatch = nameMatches[0];
                }
                results.nameMatched++;
                console.log(`[DRAFT] [OK] Name-matched ${reportKey} -> morgue Case #${morgueMatch.caseId || '?'} (${decedentName})`);
            } else if (!isNaN(reportTime) && allMorgueRecords.length > 0) {
                let bestDist = Infinity;
                for (const m of allMorgueRecords) {
                    let mTime = morgueTimeMs(m);
                    if (isNaN(mTime)) mTime = m.lastUpdated || 0;
                    if (!mTime || isNaN(mTime)) continue;

                    const dist = Math.abs(reportTime - mTime);
                    if (dist < bestDist) {
                        bestDist = dist;
                        morgueMatch = m;
                    }
                }

                if (morgueMatch) {
                    results.dateMatched++;
                    console.log(`[DRAFT] [OK] Date-matched ${reportKey} -> morgue Case #${morgueMatch.caseId || '?'} (${decedentName})`);
                } else {
                    results.noMatch++;
                }
            } else {
                results.noMatch++;
            }

            const draft = generateDraft(reportData, morgueMatch || null);
            if (!draft) {
                results.errors.push(`${reportKey}: template error`);
                continue;
            }

            const needsMorgue = !morgueMatch;
            const lowMatch = !!morgueMatch && isLowMatch(morgueMatch, reportData.data?.decedentOOC);
            const matchInfo = morgueMatch
                ? morgueMatchDebug(morgueMatch, decedentName, reportDod || reportData.data?.dateTime || '', nameMatches, !isNaN(reportTime) && nameMatches.length > 1, reportData.data?.decedentOOC || '')
                : null;

            const msg = await sendDraft(draft, reportData, authorId, reportKey, needsMorgue, matchInfo);
            if (!msg) {
                results.errors.push(`${reportKey}: failed to send draft to Discord`);
                continue;
            }

            await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).set({
                authorId,
                reportKey,
                title: draft.title,
                bbCode: draft.bbCode,
                values: draft.values,
                decedentName: reportData.data?.decedentName || '',
                decedentOOC: reportData.data?.decedentOOC || '',
                status: 'pending_review',
                needsMorgue,
                needsBetterMorgue: lowMatch,
                morgueMatch: matchInfo,
                morgueCheckedAt: morgueMatch ? Date.now() : null,
                morgueCaseId: morgueMatch?.caseId || null,
                messageId: msg.id,
                channelId: DRAFT_CHANNEL_ID,
                createdAt: Date.now(),
                formId: reportData.formId,
                scanDate: options.date || null,
            });

            try { await db.ref(DRAFT_TRACK_PATH + '/_ids/' + shortId(reportKey)).set(reportKey); } catch(e) {}

            results.drafted++;
            console.log(`[DRAFT] [OK] Draft created for ${reportKey}${needsMorgue ? ' (awaiting morgue)' : ''}`);
        } catch (err) {
            results.errors.push(`${reportKey}: ${err.message.slice(0, 120)}`);
            console.error(`[DRAFT] [ERR] scanAndDraftCKs error for ${reportKey}:`, err.message);
        }
    }

    return results;
}
