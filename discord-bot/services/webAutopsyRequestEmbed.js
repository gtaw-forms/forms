/**
 * webAutopsyRequestEmbed.js — Discord payloads for the web autopsy request
 * webhook (autopsy-requests/pending → AUTOPSY_REQUEST_WEBHOOK_URL).
 *
 * Pure builders so the notification shape is testable without discord.js,
 * Firebase, or a running bot. The poster (webAutopsyRequestPoster.js) only
 * sends what these return.
 *
 * Singular submissions keep their original embed exactly. Batch ("mass")
 * submissions render a distinct amber embed: body count, morgue cases, a
 * per-body list with PK/CK + case id, requester and department — instead of
 * the misleading "Decedent: N bodies" / "Morgue Case #: —".
 */

const WEBHOOK_USERNAME = 'PHMC Autopsy Requests';
const SINGLE_CONTENT = '**New autopsy request submitted**';
const SINGLE_COLOR = 0x00bcd4; // teal
const MASS_COLOR = 0xe8a33d; // amber
const POSTED_COLOR = 0x28a745; // green
const MAX_BODY_LINES = 12;

const clip = (value, max) => {
    const s = String(value ?? '').trim();
    return s.length > max ? `${s.slice(0, Math.max(0, max - 1))}…` : s;
};

/** Mass detection for a web submission. Singular entries never set these. */
export const isMassSubmission = (entry = {}) => (
    entry.isMass === true
    || entry.isMassRequest === true
    || (Array.isArray(entry.bodies) && entry.bodies.length > 1)
);

export const bodyCountOf = (entry = {}) => {
    const n = Number(entry.decedentCount || entry.bodyCount || (Array.isArray(entry.bodies) ? entry.bodies.length : 0));
    return Number.isFinite(n) && n > 0 ? n : 0;
};

const caseListOf = (entry = {}) => {
    const ids = (Array.isArray(entry.bodyCaseIds) ? entry.bodyCaseIds : [])
        .concat(Array.isArray(entry.bodies) ? entry.bodies.map((b) => b?.caseId) : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean);
    const unique = [...new Set(ids)];
    if (unique.length === 0) return '—';
    const shown = unique.slice(0, 8).map((id) => `#${id}`);
    return unique.length > 8 ? `${shown.join(', ')} +${unique.length - 8} more` : shown.join(', ');
};

const pkckSummaryOf = (bodies = []) => {
    let pk = 0;
    let ck = 0;
    for (const b of bodies) {
        if (b?.deathType === 'CK') ck += 1;
        else if (b?.deathType === 'PK') pk += 1;
    }
    if (pk === 0 && ck === 0) return '';
    return `${pk} PK · ${ck} CK`;
};

const bodyLinesOf = (bodies = []) => {
    const lines = bodies.slice(0, MAX_BODY_LINES).map((b, i) => {
        const who = `${b?.name || 'Unknown'}${b?.oocName ? ` ((${b.oocName}))` : ''}`;
        const type = b?.deathType === 'CK' ? 'CK' : b?.deathType === 'PK' ? 'PK' : '';
        const caseId = String(b?.caseId || '').trim();
        return `**${i + 1}.** ${clip(who, 90)}${type ? ` — ${type}` : ''}${caseId ? ` · #${caseId}` : ''}`;
    });
    if (bodies.length > MAX_BODY_LINES) {
        lines.push(`…and ${bodies.length - MAX_BODY_LINES} more`);
    }
    return lines;
};

/**
 * "New autopsy request submitted" webhook payload.
 * @param {object} entry — an autopsy-requests/pending entry
 */
export function buildSubmittedNotification(entry = {}) {
    if (!isMassSubmission(entry)) {
        // Singular: byte-for-byte the previous shape (t=85230-style embed).
        return {
            username: WEBHOOK_USERNAME,
            content: SINGLE_CONTENT,
            embeds: [{
                title: clip(entry.topicTitle || 'Autopsy Request', 250),
                color: SINGLE_COLOR,
                fields: [
                    { name: 'Decedent', value: clip(`${entry.decedentName || 'Unknown'}${entry.oocName ? ` ((${entry.oocName}))` : ''}`, 200), inline: true },
                    { name: 'Morgue Case #', value: clip(entry.caseId || '—', 100), inline: true },
                    { name: 'Requester', value: clip(entry.requesterName || 'Unknown', 200), inline: true },
                    ...(entry.requesterDept ? [{ name: 'Department', value: clip(entry.requesterDept, 200), inline: true }] : []),
                ],
                timestamp: new Date().toISOString(),
            }],
        };
    }

    const bodies = Array.isArray(entry.bodies) ? entry.bodies : [];
    const n = bodyCountOf(entry) || bodies.length;
    const lines = bodyLinesOf(bodies);
    const pkck = pkckSummaryOf(bodies);
    const fields = [
        { name: 'Bodies', value: String(n || '?'), inline: true },
        { name: 'Morgue Cases', value: clip(caseListOf(entry), 1024), inline: true },
        { name: 'Requester', value: clip(entry.requesterName || 'Unknown', 200), inline: true },
        ...(entry.requesterDept ? [{ name: 'Department', value: clip(entry.requesterDept, 200), inline: true }] : []),
        ...(pkck ? [{ name: 'PK / CK', value: pkck, inline: true }] : []),
    ];

    return {
        username: WEBHOOK_USERNAME,
        content: `**New mass autopsy request submitted — ${n || '?'} ${n === 1 ? 'body' : 'bodies'}**`,
        embeds: [{
            title: clip(entry.topicTitle || `Mass Autopsy Request${entry.incidentLabel ? ` — ${entry.incidentLabel}` : ''}`, 250),
            color: MASS_COLOR,
            ...(lines.length ? { description: lines.join('\n') } : {}),
            fields,
            timestamp: new Date().toISOString(),
        }],
    };
}

/**
 * "Request posted to the forum" webhook payload.
 * @param {object} entry — the pending entry that was posted
 * @param {string} topicUrl — the new f=265 topic URL (may be empty)
 */
export function buildPostedNotification(entry = {}, topicUrl = '') {
    const isMass = isMassSubmission(entry);
    const n = bodyCountOf(entry);
    const link = topicUrl ? ` — <${topicUrl}>` : '';
    return {
        username: WEBHOOK_USERNAME,
        content: isMass
            ? `**Mass autopsy request posted to the forum — ${n || '?'} ${n === 1 ? 'body' : 'bodies'}**${link}`
            : `**Autopsy request posted to the forum**${link}`,
        embeds: [{
            title: clip(entry.topicTitle || 'Autopsy Request', 250),
            color: POSTED_COLOR,
            timestamp: new Date().toISOString(),
        }],
    };
}

// ── Private (confidential) web requests ───────────────────────────────────
// These never reach a public forum, so the internal Discord notice is the only
// trace outside the confidential f=266 case. The IC decedent name stays in the
// internal notice (same as the LSPD PM intake drafts); nothing here is public.
const PRIVATE_COLOR = 0x9b59b6; // purple — matches the PM intake draft

/**
 * "New PRIVATE autopsy request submitted" webhook payload.
 * @param {object} entry — an autopsy-requests/private-pending entry
 */
export function buildPrivateSubmittedNotification(entry = {}) {
    return {
        username: WEBHOOK_USERNAME,
        content: '**New PRIVATE autopsy request submitted — no public forum post**',
        embeds: [{
            title: clip(entry.topicTitle || `Private Autopsy Request — ${entry.decedentName || 'Unknown'}`, 250),
            color: PRIVATE_COLOR,
            fields: [
                { name: 'Decedent', value: clip(`${entry.decedentName || 'Unknown'}${entry.oocName ? ` ((${entry.oocName}))` : ''}`, 200), inline: true },
                { name: 'Morgue Case #', value: clip(entry.caseId || '—', 100), inline: true },
                { name: 'Requester', value: clip(entry.requesterName || 'Unknown', 200), inline: true },
                ...(entry.requesterDept ? [{ name: 'Department', value: clip(entry.requesterDept, 200), inline: true }] : []),
                ...(entry.agencyForum ? [{ name: 'Agency', value: clip(entry.agencyForum, 100), inline: true }] : []),
                ...(entry.privateJustification ? [{ name: 'Justification / authority', value: clip(entry.privateJustification, 400), inline: false }] : []),
            ],
            timestamp: new Date().toISOString(),
        }],
    };
}

/**
 * "PRIVATE case created" webhook payload.
 * @param {object} entry — the pending entry (or a dry-run preview)
 * @param {string} caseUrl — the f=266 case topic URL (empty for dry runs)
 */
export function buildPrivateCreatedNotification(entry = {}, caseUrl = '') {
    const link = caseUrl ? ` — <${caseUrl}>` : '';
    const dry = !caseUrl;
    return {
        username: WEBHOOK_USERNAME,
        content: dry
            ? '**[DRY RUN] PRIVATE case would be created — nothing posted**'
            : `**PRIVATE case created (confidential)**${link}`,
        embeds: [{
            title: clip(entry.topicTitle || 'Private Autopsy Case', 250),
            color: dry ? MASS_COLOR : POSTED_COLOR,
            fields: [
                { name: 'Agency', value: clip(entry.agencyForum || '—', 100), inline: true },
                ...(entry.caseNum ? [{ name: 'Case', value: clip(`#${entry.caseNum}`, 100), inline: true }] : []),
                { name: 'Assigned ME', value: clip(entry.assignedTo || 'Rotation pending', 150), inline: true },
            ],
            timestamp: new Date().toISOString(),
        }],
    };
}
