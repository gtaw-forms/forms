/**
 * Deploy Entity Key — stable identity for the in-memory pending-deploy queue.
 *
 * Why this exists (2026-10-02 duplicate deploy): the web app mints a brand-new
 * report key on every save (`title + '_' + Date.now()`), so a re-save produces a
 * second `scheduledReports` node rather than overwriting the first. `enqueue()`
 * is the only thing that collapses two saves into one deploy, by looking up
 * `state.pendingDeployments` with this key. The previous key included
 * `dateTime`/`dateOfDeath`, so a user who queued a coroner report and then
 * filled in the death date (title went `...- NO_DATE` -> `... 10/02/2026`)
 * produced TWO different keys: neither replaced the other, and both posted.
 *
 * The key is therefore built from the report's STABLE identity only:
 *   author + form + subject (decedent/patient name, OOC, patient id)
 *   + PM routing (recipient + department).
 * Volatile fields a user edits between saves (dateTime, case number, free
 * text) are deliberately excluded. Author is included so two different staff
 * members saving the same decedent do not collide in the global queue map.
 *
 * Pure and dependency-free so it can be unit-tested without loading the bot's
 * Playwright/Firebase modules.
 */

/**
 * @param {{ authorId?: string, key?: string, report?: object }} data
 * @returns {string} stable entity key (or the report key when there is no
 *                   identity at all)
 */
export function getEntityKey(data) {
    const r = data?.report || {};
    const d = r.data || {};
    const recipient = d.requestingOfficer || d.requesting_officer || d.officerName || d.recipient || '';
    const deptRaw = d.department;
    const dept = deptRaw && typeof deptRaw === 'object' ? (deptRaw.label || deptRaw.value || '') : (deptRaw || '');
    const patientId = d.patientID || d.patientId || '';

    const identity = [
        d.decedentName || d.patientName || '',
        d.decedentOOC || d.decendentOOC || d.decedent_ooc || '',
        patientId,
        recipient,
        dept,
    ].map((p) => String(p ?? '').trim());

    // Fall back to the unique report key when there is NO subject/routing
    // identity at all. This deliberately ignores `formId`: a form whose subject
    // field we don't know would otherwise collapse every one of its reports onto
    // a single key. Same content still yields the same key.
    if (!identity.some(Boolean)) return data?.key;

    const raw = [String(data?.authorId || '').trim(), r.formId || '', ...identity].join('|');
    if (raw.length > 90) {
        let hash = 0;
        for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash |= 0; }
        return `sk_${Math.abs(hash).toString(36)}`;
    }
    return raw;
}
