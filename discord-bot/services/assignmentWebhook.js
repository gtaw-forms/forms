/**
 * assignmentWebhook.js — Webhook-based ME assignment notification.
 *
 * When ASSIGNMENT_WEBHOOK_URL is set, newly assigned autopsy cases post a tagged
 * notification there (ping + "Autopsy Case Assigned" embed + View Case / PHMC Forms
 * buttons) instead of pinging the ME in the log channel. Fully non-blocking: a
 * failure here never affects the assignment pipeline.
 */

const WEBHOOK_URL = process.env.ASSIGNMENT_WEBHOOK_URL || '';
const FORMS_URL = 'https://gtaw-forms.github.io/forms/';
const SEND_TIMEOUT_MS = 10000;

// Destination for auto-forwarding assigned autopsies (same target /forward-
// autopsy-notify uses). Configurable via FORWARD_WEBHOOK_URL in .env.
export const PHMC_FORWARD_WEBHOOK_URL = process.env.FORWARD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1538007200188997672/05Z1PFOKU8oyYX8e8LYoWtj0PjVOdKe2e7Kowne_yypMZNX5LtNPt-1XMAmJkJ5v4Mtj';

/** True when an assignment webhook is configured (used to switch ping channels). */
export function assignmentWebhookConfigured() {
    return !!WEBHOOK_URL;
}

/**
 * Derive a wait-window label from the death type (mirrors the overdue monitor).
 * @param {string} [deathType] e.g. "CK" / "PK"
 * @returns {string|null}
 */
export function deathTypeWindow(deathType) {
    const t = String(deathType || '').toUpperCase().trim();
    if (t.includes('CK')) return 'CK — 72h wait window';
    if (t.includes('PK')) return 'PK — 120h wait window';
    return null;
}

function buildContent({ me, discordId, label }) {
    const ping = discordId ? `<@${discordId}>` : (me ? `**${me}**` : '');
    const action = label || 'assigned an autopsy';
    // e.g. "@Ralof Dr. Anne Carter, you've been assigned an autopsy — here's the case file and links."
    const who = me ? `Dr. ${me}` : (ping || 'A medical examiner');
    return `${ping} ${who}, you've been ${action} — here's the case file and links.`.replace(/\s+/g, ' ').trim();
}

function buildCaseEmbed(c) {
    const fields = [];
    if (c.me) fields.push({ name: '👤 Medical Examiner', value: `**${c.me}**`, inline: true });
    if (c.caseNumber) fields.push({ name: '🆔 Case Number', value: String(c.caseNumber), inline: true });
    if (c.decedent) fields.push({
        name: '🧍 Decedent',
        value: c.decedent + (c.ooc ? ` ((${c.ooc}))` : ''),
        inline: false,
    });
    if (c.caseTitle) fields.push({ name: '📋 Case', value: c.caseTitle, inline: false });
    if (c.caseUrl) fields.push({ name: '🔗 Thread', value: `[View Case](<${c.caseUrl}>)`, inline: false });
    if (c.deadline) fields.push({ name: '⏰ Deadline / Wait', value: String(c.deadline), inline: true });
    if (c.note) fields.push({ name: '📝 Note', value: String(c.note), inline: false });
    const base = c.title || '🔬 Autopsy Case Assigned';
    return {
        title: base + (c.decedent ? ` — ${c.decedent}` : ''),
        color: 0x00bcd4,
        fields,
        timestamp: new Date().toISOString(),
    };
}

// Link buttons (style 5) render on incoming webhooks with ?with_components=true and
// need no interaction handler.
function buildComponents({ caseUrl }) {
    const buttons = [];
    if (caseUrl) buttons.push({ type: 2, style: 5, label: 'View Case', url: caseUrl });
    buttons.push({ type: 2, style: 5, label: 'PHMC Forms', url: FORMS_URL });
    return [{ type: 1, components: buttons }];
}

/**
 * Post an autopsy assignment notification to the configured webhook.
 * Non-blocking — failures are logged and never thrown to the caller.
 *
 * @param {object} opts
 * @param {string} opts.me — assigned ME forum name
 * @param {string} [opts.discordId] — resolved Discord ID (ping when present)
 * @param {string} [opts.caseTitle]
 * @param {string|number} [opts.caseNumber]
 * @param {string} [opts.decedent]
 * @param {string} [opts.ooc]
 * @param {string} [opts.caseUrl]
 * @param {string} [opts.deathType]
 * @param {string} [opts.note]
 * @returns {Promise<boolean>} true when posted
 */
export async function notifyAssignmentWebhook({
    me, discordId, caseTitle, caseNumber, decedent, ooc, caseUrl, deathType, note, title, label,
} = {}) {
    if (!WEBHOOK_URL) return false;

    const payload = {
        username: 'PHMC Autopsy Assignments',
        content: buildContent({ me, discordId, label }),
        allowed_mentions: { parse: ['users'] },
        embeds: [buildCaseEmbed({
            me, caseTitle, caseNumber, decedent, ooc, caseUrl,
            deadline: deathTypeWindow(deathType),
            note, title,
        })],
        components: buildComponents({ caseUrl }),
    };

    try {
        const res = await Promise.race([
            fetch(WEBHOOK_URL + '?with_components=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('webhook send timed out')), SEND_TIMEOUT_MS)),
        ]);
        if (!res.ok) {
            console.warn(`[ASSIGN-WEBHOOK] Failed (HTTP ${res.status}) for ${me}/${caseNumber || '?'}`);
            return false;
        }
        console.log(`[ASSIGN-WEBHOOK] Sent assignment ping for ${me} (case ${caseNumber || '?'})${discordId ? ' [ping]' : ' [no mapping]'}`);
        return true;
    } catch (err) {
        console.warn(`[ASSIGN-WEBHOOK] Send error for ${me}/${caseNumber || '?'}: ${err.message}`);
        return false;
    }
}

/**
 * Post an autopsy-assignment-style notification to an ARBITRARY webhook URL.
 * Same embed/buttons as notifyAssignmentWebhook but targeting a provided
 * destination (e.g. a community/forwarding webhook) instead of the configured
 * ASSIGNMENT_WEBHOOK_URL. Non-blocking; failures are logged and never thrown.
 *
 * @param {string} webhookUrl — destination webhook URL
 * @param {object} opts — same fields as notifyAssignmentWebhook
 * @returns {Promise<boolean>}
 */
export async function forwardAssignmentWebhook(webhookUrl, {
    me, discordId, caseTitle, caseNumber, decedent, ooc, caseUrl, deathType, note, title, label,
} = {}) {
    if (!webhookUrl) return false;
    const payload = {
        username: 'PHMC Autopsy Assignments',
        content: buildContent({ me, discordId, label }),
        allowed_mentions: { parse: ['users'] },
        embeds: [buildCaseEmbed({
            me, caseTitle, caseNumber, decedent, ooc, caseUrl,
            deadline: deathTypeWindow(deathType),
            note, title,
        })],
        components: buildComponents({ caseUrl }),
    };
    try {
        const res = await Promise.race([
            fetch(webhookUrl + '?with_components=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('forward send timed out')), SEND_TIMEOUT_MS)),
        ]);
        if (!res.ok) {
            console.warn(`[FORWARD-WEBHOOK] Failed (HTTP ${res.status}) for ${me}/${caseNumber || '?'}`);
            return false;
        }
        console.log(`[FORWARD-WEBHOOK] Forwarded assignment for ${me} (case ${caseNumber || '?'})${discordId ? ' [ping]' : ' [no mapping]'}`);
        return true;
    } catch (err) {
        console.warn(`[FORWARD-WEBHOOK] Send error for ${me}/${caseNumber || '?'}: ${err.message}`);
        return false;
    }
}
