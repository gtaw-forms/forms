/**
 * Autopsy Rotation — Fair rotation-based ME assignment system.
 *
 * Replaces the old modulo counter (`lastAssignedIndex`) with a fixed
 * rotation list and per-ME active case tracking. This ensures:
 *   - Predictable order (everyone knows their position)
 *   - No double-booking until all MEs have at least one active case
 *   - Recency filter (avoids assigning the same person twice within 24h)
 *   - Manual assignments track counts without disrupting the pointer
 *
 * Data model (Firebase RTDB under autopsy-requests/):
 *   rotation/
 *     list: ["Anne Carter", ...]     — fixed ordered list
 *     position: 0                     — index of NEXT eligible ME
 *   assignments/<username_lower>/
 *     active: N                       — count of non-completed cases
 *     lastAssigned: epochMs           — for recency filter
 *     cases/<topicId>/{ assignedAt, caseNum }
 *   loa/<username_lower>: true        — existing, read for exclusions
 */

const RECENCY_MS = 48 * 60 * 60 * 1000; // 48 hours

// ── Helpers ──

/**
 * Load the rotation list + position from Firebase.
 * @returns {{ list: string[], position: number } | null}
 */
async function getRotation(db) {
    const snap = await db.ref('autopsy-requests/rotation').once('value');
    const val = snap.val();
    if (!val || !Array.isArray(val.list) || val.list.length === 0) return null;
    return {
        list: val.list,
        position: typeof val.position === 'number' ? val.position : 0,
    };
}

/**
 * Build a map of active case counts from the assignments subtree.
 * @returns {Promise<Record<string, number>>} keyed by lowercased username
 */
async function getActiveCaseCounts(db) {
    const snap = await db.ref('autopsy-requests/assignments').once('value');
    const data = snap.val() || {};
    const counts = {};
    for (const [name, entry] of Object.entries(data)) {
        counts[name] = entry.active || 0;
    }
    return counts;
}

/**
 * Build a Set of lowercased usernames currently on LOA.
 * @returns {Promise<Set<string>>}
 */
async function getLoaSet(db) {
    const snap = await db.ref('autopsy-requests/loa').once('value');
    const loa = snap.val() || {};
    const set = new Set();
    for (const [name, val] of Object.entries(loa)) {
        if (val === true) set.add(name.toLowerCase());
    }
    return set;
}

/**
 * Check whether a different eligible ME exists further ahead in the rotation.
 * Skips both LOA MEs and MEs with active cases.
 */
function hasAlternativeInRotation(rotation, position, skipSteps, activeCounts, loaSet) {
    const { list } = rotation;
    for (let j = 1; j < list.length; j++) {
        const other = list[(position + skipSteps + j) % list.length];
        const ol = other.toLowerCase();
        if (loaSet.has(ol)) continue;
        if ((activeCounts[ol] || 0) > 0) continue;
        return true;
    }
    return false;
}

// ── Core ──

/**
 * Select the next ME in rotation for a new case.
 *
 * Normal mode — walks the rotation list from `position` forward, wrapping,
 * skipping MEs who are on LOA, have active cases, or were recently assigned
 * (recency). Advances the position pointer past the selected ME.
 *
 * Surge mode — when every non-LOA ME has ≥1 active case, picks the
 * least-loaded ME and does NOT advance the position pointer (so the next
 * eligible ME in the rotation gets the next case when someone finishes).
 *
 * @param {import('firebase-admin').database.Database} db
 * @param {string} topicId — the autopsy-requested/<topicId> key
 * @param {string} caseNum — case number string
 * @returns {Promise<string|null>} assigned ME username, or null if none available
 */
export async function selectME(db, topicId, caseNum) {
    // DEV TEST MODE: force all assignments to Alyson Frost
    if (process.env.AUTOPSY_DEV_TEST === 'true') {
        const devName = 'Alyson Frost';
        console.log('[ROTATION] DEV TEST — assigning to ' + devName);
        await recordAssignment(db, devName, topicId, caseNum);
        return devName;
    }

    const rotation = await getRotation(db);
    if (!rotation) {
        console.warn('[ROTATION] No rotation list configured — use /rotation-set to create one');
        return null;
    }

    const { list, position } = rotation;
    const activeCounts = await getActiveCaseCounts(db);
    const loaSet = await getLoaSet(db);
    const now = Date.now();

    // ── Phase 1: Normal mode — first eligible in rotation ──
    for (let i = 0; i < list.length; i++) {
        const meName = list[(position + i) % list.length];
        const ml = meName.toLowerCase();

        // Skip LOA
        if (loaSet.has(ml)) continue;

        // Skip if they already have an active case
        if ((activeCounts[ml] || 0) > 0) continue;

        // Recency check: assigned within last 24h? skip if another eligible ME exists
        const assignSnap = await db.ref(`autopsy-requests/assignments/${ml}/lastAssigned`).once('value');
        const lastAssigned = assignSnap.val() || 0;
        if (now - lastAssigned < RECENCY_MS && hasAlternativeInRotation(rotation, position, i, activeCounts, loaSet)) {
            console.log(`[ROTATION] Skipping ${meName} (assigned <24h ago), checking next...`);
            continue;
        }

        // Assign this ME
        await recordAssignment(db, meName, topicId, caseNum);

        const newPosition = (position + i + 1) % list.length;
        await db.ref('autopsy-requests/rotation/position').set(newPosition);

        // Log full assignment landscape for tracking
        const allCounts = list.map(m => `${m}=${activeCounts[m.toLowerCase()] || 0}${m.toLowerCase() === meName.toLowerCase() ? '+1' : ''}`).join(', ');
        console.log(`[ROTATION] Assigned ${meName} (positions walked: ${i + 1}, new pos: ${newPosition})`);
        console.log(`[ROTATION] Assignment counts: ${allCounts}`);

        return meName;
    }

    // ── Phase 2: Surge mode — everyone has active cases ──
    // Filter to non-LOA MEs only
    const eligible = list.filter(me => !loaSet.has(me.toLowerCase()));
    if (eligible.length === 0) {
        console.warn('[ROTATION] All MEs are on LOA — cannot assign');
        return null;
    }

    // Sort by active case count ascending, tie-break by lastAssigned (oldest first)
    eligible.sort((a, b) => {
        const aCount = activeCounts[a.toLowerCase()] || 0;
        const bCount = activeCounts[b.toLowerCase()] || 0;
        if (aCount !== bCount) return aCount - bCount;
        // Retrieve lastAssigned for tie-break — fetch lazily (only when needed)
        return 0; // keep stable order for equal counts
    });

    // For tie-break on lastAssigned, do a second pass if counts are equal
    // Simple approach: just pick the first with lowest count
    const best = eligible[0];
    const bestCount = activeCounts[best.toLowerCase()] || 0;

    // If there are ties, pick the one who went longest without an assignment
    // (more than 1 with same count — prefer oldest lastAssigned)
    const tied = eligible.filter(m => (activeCounts[m.toLowerCase()] || 0) === bestCount);
    if (tied.length > 1) {
        const withTimestamps = await Promise.all(
            tied.map(async (m) => {
                const snap = await db.ref(`autopsy-requests/assignments/${m.toLowerCase()}/lastAssigned`).once('value');
                return { name: m, lastAssigned: snap.val() || 0 };
            })
        );
        withTimestamps.sort((a, b) => a.lastAssigned - b.lastAssigned);
        const chosen = withTimestamps[0].name;

        await recordAssignment(db, chosen, topicId, caseNum);
        // Do NOT advance position pointer in surge mode
        console.log(`[ROTATION] SURGE — assigned ${chosen} (${bestCount} active cases, position unchanged)`);
        return chosen;
    }

    await recordAssignment(db, best, topicId, caseNum);
    console.log(`[ROTATION] SURGE — assigned ${best} (${bestCount} active cases, position unchanged)`);
    return best;
}

/**
 * Record an assignment in the assignments subtree.
 * Increments active count, stores case metadata, updates lastAssigned.
 */
export async function recordAssignment(db, meName, topicId, caseNum) {
    const key = meName.toLowerCase();
    const now = Date.now();
    const updates = {};
    updates[`autopsy-requests/assignments/${key}/active`] = { '.sv': { 'increment': 1 } };
    updates[`autopsy-requests/assignments/${key}/cases/${topicId}`] = {
        assignedAt: now,
        caseNum: caseNum || '',
    };
    updates[`autopsy-requests/assignments/${key}/lastAssigned`] = now;
    await db.ref().update(updates);
}

/**
 * Clear an assignment (decrement active count, remove case record).
 * Called when a case is completed or failed.
 */
export async function clearAssignment(db, meName, topicId) {
    if (!meName) return;
    const key = meName.toLowerCase();
    const updates = {};
    updates[`autopsy-requests/assignments/${key}/active`] = { '.sv': { 'increment': -1 } };
    updates[`autopsy-requests/assignments/${key}/cases/${topicId}`] = null;
    await db.ref().update(updates);
    console.log(`[ROTATION] Cleared assignment: ${meName} / #${topicId}`);
}

/**
 * Reassign from one ME to another — decrements old, increments new.
 */
export async function reassignME(db, oldName, newName, topicId) {
    if (oldName && oldName.toLowerCase() !== newName.toLowerCase()) {
        await clearAssignment(db, oldName, topicId);
    }
    await recordAssignment(db, newName, topicId, '');
    console.log(`[ROTATION] Reassigned #${topicId}: ${oldName || '?'} -> ${newName}`);
}

/**
 * Get a full snapshot of the rotation state for display.
 * @returns {Promise<object>}
 */
export async function getRotationStatus(db) {
    const rotation = await getRotation(db);
    const assignments = (await db.ref('autopsy-requests/assignments').once('value')).val() || {};
    const loaSet = await getLoaSet(db);

    const list = rotation?.list || [];
    const position = rotation?.position ?? 0;

    // Find the effective next — the first eligible person in rotation order
    // Walk from position forward, skipping LOA and active-case MEs
    let effectiveNextName = null;
    let effectiveNextIdx = -1;
    if (list.length > 0) {
        for (let i = 0; i < list.length; i++) {
            const idx = (position + i) % list.length;
            const name = list[idx];
            const ml = name.toLowerCase();
            if (loaSet.has(ml)) continue;
            if ((assignments[ml]?.active || 0) > 0) continue;
            effectiveNextName = name;
            effectiveNextIdx = idx;
            break;
        }
        // If everyone's busy/LOA, no effective next
    }

    const meStatus = list.map((name, idx) => {
        const ml = name.toLowerCase();
        const assignData = assignments[ml] || {};
        return {
            name,
            index: idx,
            isPositionPointer: idx === position,
            isEffectiveNext: idx === effectiveNextIdx && effectiveNextIdx >= 0,
            activeCases: assignData.active || 0,
            lastAssigned: assignData.lastAssigned || null,
            onLoa: loaSet.has(ml),
        };
    });

    return {
        list,
        position,
        effectiveNext: effectiveNextName,
        effectiveNextIdx,
        meStatus,
        configured: rotation !== null,
    };
}

/**
 * Initialize the rotation list from the forum group members if it doesn't exist.
 * Called once on first run after migration. Does NOT overwrite an existing list.
 */
export async function initializeRotationFromGroup(db, groupMembers) {
    const rotation = await getRotation(db);
    if (rotation) return; // already configured

    const names = groupMembers
        .map(m => m.name.trim())
        .filter(n => n && n !== 'PHMC Forms Bot');

    if (names.length === 0) {
        console.warn('[ROTATION] No group members to initialize rotation from');
        return;
    }

    await db.ref('autopsy-requests/rotation').set({
        list: names,
        position: 0,
    });
    console.log(`[ROTATION] Initialized rotation list from forum group: ${names.join(', ')}`);
}

/**
 * Check for new MEs in the forum group that aren't in the rotation list yet.
 * If found, inserts them at a random position so the rotation stays fair.
 * Also removes departed MEs (in group rotation but no longer in forum group).
 * Returns { added: string[], removed: string[] } or null if no changes.
 */
export async function syncRotationFromGroup(db, groupMembers) {
    const rotation = await getRotation(db);
    if (!rotation) {
        await initializeRotationFromGroup(db, groupMembers);
        return null;
    }

    // Detect corruption: duplicates in the list reset to a fresh random order
    const unique = new Set(rotation.list.map(n => n.trim().toLowerCase()));
    if (unique.size !== rotation.list.length) {
        console.warn(`[ROTATION] Corruption detected — ${rotation.list.length} entries with ${unique.size} unique names. Resetting to random order.`);
        return await resetRotationRandom(db, groupMembers);
    }

    const forumNames = groupMembers
        .map(m => m.name.trim())
        .filter(n => n && n !== 'PHMC Forms Bot');

    if (forumNames.length === 0) return null;

    const currentLower = new Set(rotation.list.map(n => n.trim().toLowerCase()));
    const forumLower = new Set(forumNames.map(n => n.toLowerCase()));

    // Find new MEs (in forum group but not in rotation)
    const toAdd = forumNames.filter(n => !currentLower.has(n.toLowerCase()));
    // Find departed MEs (in rotation but not in forum group)
    const toRemove = rotation.list.filter(n => !forumLower.has(n.toLowerCase()) && !n.toLowerCase().includes('phmc'));

    if (toAdd.length === 0 && toRemove.length === 0) return null;

    // Build updated list — remove departed first, then add new at random positions
    let updated = rotation.list.filter(n => !toRemove.includes(n));
    for (const name of toAdd) {
        const insertAt = Math.floor(Math.random() * (updated.length + 1));
        updated.splice(insertAt, 0, name);
    }

    // Write updated list, reset position to current index if it would be out of bounds
    const newPosition = rotation.position < updated.length ? rotation.position : 0;
    await db.ref('autopsy-requests/rotation').set({
        list: updated,
        position: newPosition,
    });

    const result = { added: toAdd, removed: toRemove };
    if (toAdd.length > 0) {
        console.log(`[ROTATION] New MEs auto-added to rotation: ${toAdd.join(', ')}`);
    }
    if (toRemove.length > 0) {
        console.log(`[ROTATION] Departed MEs removed from rotation: ${toRemove.join(', ')}`);
    }
    return result;
}

/**
 * Reset the rotation list from the forum group members in random order.
 * This fixes any corruption (duplicates, missing MEs) caused by the old
 * splice bug where new entries were replacing existing ones instead of inserting.
 *
 * Call this once to repair, or wire into a slash command for on-demand use.
 */
export async function resetRotationRandom(db, groupMembers) {
    const names = groupMembers
        .map(m => m.name.trim())
        .filter(n => n && n !== 'PHMC Forms Bot');

    if (names.length === 0) {
        console.warn('[ROTATION] No group members to reset rotation from');
        return null;
    }

    // Fisher-Yates shuffle for true randomness
    const shuffled = [...names];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    await db.ref('autopsy-requests/rotation').set({
        list: shuffled,
        position: 0,
    });

    console.log(`[ROTATION] Reset rotation to random order: ${shuffled.join(', ')}`);
    return { list: shuffled, count: shuffled.length };
}
