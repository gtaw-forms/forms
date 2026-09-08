/**
 * assignmentWebhook.js — Webhook-based ME assignment notification.
 *
 * When ASSIGNMENT_WEBHOOK_URL is set, newly assigned autopsy cases post a tagged
 * notification there (ping + "Autopsy Case Assigned" embed + View Case / PHMC Forms
 * buttons) instead of pinging the ME in the log channel. Fully non-blocking: a
 * failure here never affects the assignment pipeline.
 */

import { isDevTestActive, devWebhookUrl } from './devRouting.js';

const FORMS_URL = 'https://gtaw-forms.github.io/forms/';
const SEND_TIMEOUT_MS = 10000;

// Default forwarding destination when FORWARD_WEBHOOK_URL is unset (used by
// /forward-autopsy-notify + auto-forward in meDiscordNotify).
const PHMC_FORWARD_WEBHOOK_DEFAULT = 'https://discord.com/api/webhooks/REDACTED';

// Resolved at SEND time so a runtime /enable-dev-autopsy toggle takes effect
// immediately. DEV TEST mode routes to the dev webhook (or drops the message
// when none is configured) instead of the live PHMC Discord.
function getAssignmentWebhookUrl() {
    if (isDevTestActive()) return devWebhookUrl('ASSIGNMENT_WEBHOOK_URL');
    return process.env.ASSIGNMENT_WEBHOOK_URL || '';
}

export function getForwardWebhookUrl() {
    if (isDevTestActive()) return devWebhookUrl('FORWARD_WEBHOOK_URL');
    return process.env.FORWARD_WEBHOOK_URL || PHMC_FORWARD_WEBHOOK_DEFAULT;
}

/** True when an assignment webhook is configured (used to switch ping channels). */
export function assignmentWebhookConfigured() {
    return !!getAssignmentWebhookUrl();
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

// Strip stray empty parens from parsed decedent names (e.g. "Unknown ()" —
// parser artifact) and collapse whitespace.
function cleanDecedent(name) {
    return String(name || '').replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').trim();
}

function buildCaseEmbed(c) {
    const fields = [];
    const decedent = cleanDecedent(c.decedent);
    const decedentLine = decedent + (c.ooc ? ` ((${c.ooc}))` : '');
    if (c.me) fields.push({ name: '👤 Medical Examiner', value: `**${c.me}**`, inline: true });
    if (c.caseNumber) fields.push({ name: '🆔 Case Number', value: String(c.caseNumber), inline: true });
    if (decedent) fields.push({
        name: '🧍 Decedent',
        value: decedentLine,
        inline: false,
    });
    if (c.caseTitle) fields.push({ name: '📋 Case', value: c.caseTitle, inline: false });
    if (c.caseUrl) fields.push({ name: '🔗 Thread', value: `[View Case](<${c.caseUrl}>)`, inline: false });
    if (c.deadline) fields.push({ name: '⏰ Deadline / Wait', value: String(c.deadline), inline: true });
    if (c.note) fields.push({ name: '📝 Note', value: String(c.note), inline: false });
    const base = c.title || '🔬 Autopsy Case Assigned';
    return {
        title: base + (decedent ? ` — ${decedentLine}` : ''),
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
    const WEBHOOK_URL = getAssignmentWebhookUrl();
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
