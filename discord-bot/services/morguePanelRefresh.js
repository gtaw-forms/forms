/**
 * morguePanelRefresh.js — upgrade stale autopsy assignment panels when a
 * morgue record is created/updated.
 *
 * Assignment panels bake their morgue line at intake. When a morgue record
 * later lands that definitively matches a decedent, the panel stays stuck on
 * "POSSIBLY FOUND" / "NOT FOUND". This trigger re-resolves open assignments
 * and edits ONLY upgrades to a definitive FOUND in place (never downgrades,
 * never reposts, never re-pings).
 *
 * Triggered (debounced) from the existing morgue listener in
 * deathRecordDraftScan.js after the draft-cache work, fire-and-forget.
 * Mass collections reuse the existing mass refresh (which already re-resolves
 * per-body morgue fresh on every rebuild); singles use refreshSinglePanelV2.
 */
import { resolveMorgueStatus, refreshSinglePanelV2 } from './singlePanelV2.js';
import { refreshMassPanelV2 } from './massPanelV2.js';
import { refreshMassPanel } from './massAssignmentPanel.js';

const TERMINAL_CASE_STATES = new Set(['skipped', 'cancelled', 'denied', 'dry_run']);

function isOpenEntry(entry) {
    if (!entry || typeof entry !== 'object') return false;
    if (!entry.wasMatch) return false;
    if (entry.completedAt) return false;
    if (TERMINAL_CASE_STATES.has(String(entry.caseState || '').toLowerCase())) return false;
    return true;
}

async function refreshSingleForMorgue(db, client, rkey, caseIdx, name, oocName) {
    const fresh = await resolveMorgueStatus(db, { ooc: oocName, decedent: name });
    if (!fresh || fresh.status !== 'FOUND') return false;
    const path = caseIdx === null
        ? `autopsy-requested/${rkey}/morgue`
        : `autopsy-requested/${rkey}/cases/${caseIdx}/morgue`;
    let stored = null;
    try { stored = (await db.ref(path).once('value')).val() || null; } catch { stored = null; }
    if (stored && stored.status === 'FOUND' && String(stored.caseId || '') === String(fresh.caseId || '')) return false;
    const res = await refreshSinglePanelV2(db, client, rkey, caseIdx, fresh);
    if (!res.refreshed) return false;
    try {
        await db.ref(path).set({ status: 'FOUND', caseId: fresh.caseId || null, checkedAt: new Date().toISOString() });
    } catch { /* best effort */ }
    return true;
}

async function refreshMassForMorgue(db, client, rkey, entry) {
    // Per-body exact-match check with the mass intake's own matcher. Collects
    // newly-definitive bodies first; persists their guards and runs the
    // existing mass refresh ONLY on success (a failed edit stays retryable).
    const toUpgrade = [];
    try {
        const { findMorgueRecord } = await import('./deathRecordDraftCache.js');
        const cases = entry.cases || {};
        for (const [ci, c] of Object.entries(cases)) {
            if (!/^\d+$/.test(ci) || !c || !c.assignedTo || c.completedAt) continue;
            let rec = null;
            try { rec = await findMorgueRecord(db, c.name, c.dateOfDeath, c.oocName); } catch { rec = null; }
            if (!rec && c.oocName && String(c.oocName).toLowerCase() !== String(c.name || '').toLowerCase()) {
                try { rec = await findMorgueRecord(db, c.oocName, c.dateOfDeath, c.oocName).catch(() => null); } catch { rec = null; }
            }
            const q = rec?.matchQuality || {};
            if (!rec || q.exactName !== true) continue;
            const caseId = String(rec.caseId || '');
            let stored = null;
            try { stored = (await db.ref(`autopsy-requested/${rkey}/cases/${ci}/morgue`).once('value')).val() || null; } catch { stored = null; }
            if (stored && stored.status === 'FOUND' && String(stored.caseId || '') === caseId) continue;
            toUpgrade.push({ ci, caseId });
        }
    } catch (e) {
        console.warn(`[MORGUE-REFRESH] mass match failed for #${rkey}: ${e.message}`);
        return false;
    }
    if (toUpgrade.length === 0) return false;
    let refreshed = false;
    try {
        if (entry.massPanelV2 && entry.massPanelV2.panelId) {
            const res = await refreshMassPanelV2(db, client, rkey);
            refreshed = !!res.refreshed;
        } else if (entry.massPanel && entry.massPanel.panelId) {
            const res = await refreshMassPanel(db, client, rkey);
            refreshed = !!(res && res.refreshed);
        }
    } catch (e) {
        console.warn(`[MORGUE-REFRESH] mass refresh failed for #${rkey}: ${e.message}`);
    }
    if (!refreshed) return false;
    for (const { ci, caseId } of toUpgrade) {
        try {
            await db.ref(`autopsy-requested/${rkey}/cases/${ci}/morgue`).set({ status: 'FOUND', caseId: caseId || null, checkedAt: new Date().toISOString() });
        } catch { /* best effort */ }
    }
    return true;
}

/**
 * Scan open autopsy assignments and upgrade any panel whose morgue match is
 * now definitively FOUND. Called on (debounced) morgue-record changes.
 * Best-effort — never throws.
 * @returns {Promise<{checked:number, upgraded:number}>}
 */
export async function refreshAutopsyPanelsForMorgue(db, client, morgueRecord) {
    if (!db) return { checked: 0, upgraded: 0 };
    let checked = 0;
    let upgraded = 0;
    try {
        const snap = await db.ref('autopsy-requested').once('value');
        const all = snap.val() || {};
        for (const [rkey, entry] of Object.entries(all)) {
            if (!isOpenEntry(entry)) continue;
            try {
                // Mass collection (shared thread, one grouped panel message).
                if ((entry.massPanelV2 && entry.massPanelV2.panelId) || (entry.massPanel && entry.massPanel.panelId)) {
                    checked++;
                    if (await refreshMassForMorgue(db, client, rkey, entry)) upgraded++;
                    continue;
                }
                // Singles: per-case rows for multis, top-level for singulars.
                if (entry.caseState === 'multi' && entry.cases && typeof entry.cases === 'object') {
                    for (const [ci, c] of Object.entries(entry.cases)) {
                        if (!/^\d+$/.test(ci) || !c || !c.assignedTo || c.completedAt) continue;
                        const hasPanel = (c.singlePanel && c.singlePanel.panelId)
                            || (entry.singlePanel && entry.singlePanel.panelId);
                        if (!hasPanel) continue;
                        checked++;
                        if (await refreshSingleForMorgue(db, client, rkey, parseInt(ci, 10), c.name, c.oocName)) upgraded++;
                    }
                } else {
                    if (!entry.assignedTo) continue;
                    if (!entry.singlePanel || !entry.singlePanel.panelId) continue;
                    checked++;
                    if (await refreshSingleForMorgue(db, client, rkey, null, entry.name, entry.oocName)) upgraded++;
                }
            } catch (e) {
                console.warn(`[MORGUE-REFRESH] #${rkey}: ${e.message}`);
            }
        }
    } catch (e) {
        console.warn(`[MORGUE-REFRESH] scan failed: ${e.message}`);
    }
    if (upgraded > 0) console.log(`[MORGUE-REFRESH] Upgraded ${upgraded}/${checked} panel(s) to definitive morgue matches.`);
    return { checked, upgraded };
}