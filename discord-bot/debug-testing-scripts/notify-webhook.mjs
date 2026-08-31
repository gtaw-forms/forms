#!/usr/bin/env node
/**
 * notify-webhook.mjs — Discord webhook notifier with Medical Examiner assignment mode.
 *
 * Modes:
 * 1) ME assignment (pings the assigned ME with a case-info embed):
 *      node notify-webhook.mjs --me "Alyson Frost" \
 *        --case-title "Case 486 - John Doe ((Dylan Bongo)) [LSPD]" \
 *        --case-url "https://phmc.gta.world/viewtopic.php?t=9956"
 * 2) Generic payload template — single case or MULTI-DECEDENT (array of cases):
 *      node notify-webhook.mjs --payload sample-multi-assignment.json
 * 3) Generic message (original behaviour):
 *      node notify-webhook.mjs "Deploy finished — please review"
 *
 * Ping behaviour: every decedent whose Discord id is known (per-case `discordId`,
 * `--discord-id`, or the mapping file) gets <@id> in the content and is pinged.
 * Unmapped MEs fall back to a bold name (no ping). Each decedent renders as its own
 * embed block, so a multi-decedent request shows one block per case.
 *
 * Flags:
 *   --no-ping           don't @mention (bold-name fallback)
 *   --dry-run           print the payload without sending
 *   --wait              wait for Discord and print the created message (verifies
 *                       that buttons rendered — the send uses ?with_components=true,
 *                       required for incoming webhooks to respect the components field)
 *   --username <n>      override the webhook display name
 *   --avatar <url>      override the webhook avatar
 *   --mapping <file>    JSON map of "<ME name>" -> "<discordId>"
 *   --discord-id <id>   explicit Discord ID (single-case mode / override)
 *   --payload <file>    JSON template: { content?, case? | cases: [{ me?, discordId?, ...case }] }
 *   --me <name>         ME assignment mode (inline case fields below)
 *   --case-title / --case-number / --decedent / --ooc / --case-url /
 *   --deadline / --note
 *
 * Env overrides: NOTIFY_WEBHOOK_URL, NOTIFY_USER_ID, NOTIFY_USERNAME
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WEBHOOK_URL = process.env.NOTIFY_WEBHOOK_URL
    || 'https://discord.com/api/webhooks/1519081030248825042/8LbmOtHokVwklRXvnDWrbNHNvTQoi2A0Y-czLLoDGnuy_x7YYLsapfsokvnLq5Yi62zq';
const DEFAULT_USER_ID = process.env.NOTIFY_USER_ID || '228306972204597248';
const USERNAME = process.env.NOTIFY_USERNAME || 'PHMC Notify';
const DEFAULT_MAPPING = fileURLToPath(new URL('./discord-mappings.json', import.meta.url));

function parseArgs(argv) {
    const out = {
        ping: true, dryRun: false, wait: false, username: null, avatar: null,
        mapping: null, discordId: null, payloadFile: null,
        me: null, case: {}, message: [],
    };
    const flagMap = {
        '--case-title': 'title', '--case-number': 'number', '--decedent': 'decedent',
        '--ooc': 'ooc', '--case-url': 'url', '--deadline': 'deadline', '--note': 'note',
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--no-ping') out.ping = false;
        else if (a === '--dry-run') out.dryRun = true;
        else if (a === '--wait') out.wait = true;
        else if (a === '--username') out.username = argv[++i] || null;
        else if (a === '--avatar') out.avatar = argv[++i] || null;
        else if (a === '--mapping') out.mapping = argv[++i] || null;
        else if (a === '--discord-id') out.discordId = argv[++i] || null;
        else if (a === '--payload') out.payloadFile = argv[++i] || null;
        else if (a === '--me') out.me = argv[++i] || null;
        else if (flagMap[a]) out.case[flagMap[a]] = argv[++i] || '';
        else out.message.push(a);
    }
    return out;
}

function loadJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

async function resolveDiscordId(o, meName) {
    if (o.discordId) return o.discordId;
    if (!meName) return null;
    const mapPath = o.mapping || DEFAULT_MAPPING;
    if (existsSync(mapPath)) {
        try {
            const map = loadJson(mapPath);
            const id = map[meName] || map[meName.toLowerCase()];
            if (id != null) return String(id);
        } catch (e) {
            console.warn(`[NOTIFY] Could not read mapping file ${mapPath}: ${e.message}`);
        }
    }
    return null;
}

function buildCaseEmbed(c) {
    const fields = [];
    if (c.me) fields.push({ name: '👤 Medical Examiner', value: `**${c.me}**`, inline: true });
    if (c.number) fields.push({ name: '🆔 Case Number', value: String(c.number), inline: true });
    if (c.decedent) fields.push({
        name: '🧍 Decedent',
        value: c.decedent + (c.ooc ? ` ((${c.ooc}))` : ''),
        inline: false,
    });
    if (c.title) fields.push({ name: '📋 Case', value: c.title, inline: false });
    if (c.url) fields.push({ name: '🔗 Thread', value: `[View Case](<${c.url}>)`, inline: false });
    if (c.deadline) fields.push({ name: '⏰ Deadline / Wait', value: String(c.deadline), inline: true });
    if (c.note) fields.push({ name: '📝 Note', value: String(c.note), inline: false });
    return {
        title: '🔬 Autopsy Case Assigned' + (c.decedent ? ` — ${c.decedent}` : ''),
        color: 0x00bcd4,
        fields,
        timestamp: new Date().toISOString(),
    };
}

function buildContent(cases, { ping }) {
    const ids = cases.map((c) => c._discordId).filter(Boolean);
    const pings = ping && ids.length ? ids.map((id) => `<@${id}>`).join(' ') + ' ' : '';
    const names = cases.map((c) => c.me).filter(Boolean);
    const label = names.length > 1
        ? `Medical Examiners: **${names.join('**, **')}**`
        : (names[0] ? `Medical Examiner: **${names[0]}**` : '');
    return (pings + label).trim();
}

// Link buttons (style 5) render on webhook messages and open URLs — no interaction
// handler needed. One "View Case" per decedent with a thread URL, plus PHMC Forms.
function buildComponents(cases) {
    const buttons = [];
    cases.forEach((c, i) => {
        if (!c.url) return;
        buttons.push({
            type: 2,
            style: 5,
            label: cases.length > 1 ? (c.number ? `Case ${c.number}` : `Case ${i + 1}`) : 'View Case',
            url: c.url,
        });
    });
    buttons.push({ type: 2, style: 5, label: 'PHMC Forms', url: 'https://gtaw-forms.github.io/forms/' });
    if (buttons.length === 0) return null;
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) rows.push({ type: 1, components: buttons.slice(i, i + 5) });
    return rows;
}

async function sendWebhook(payload, { dryRun, wait }) {
    if (dryRun) {
        console.log('[DRY RUN]', JSON.stringify(payload, null, 2));
        return;
    }
    // Incoming webhooks need ?with_components=true for the components field to be
    // respected (link buttons are non-interactive, so they render). ?wait=true
    // returns the created message so we can confirm components landed.
    const url = WEBHOOK_URL + '?with_components=true' + (wait ? '&wait=true' : '');
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(`[NOTIFY] Webhook failed: HTTP ${res.status} ${res.statusText}`);
        if (body) console.error(body);
        process.exitCode = 1;
        return;
    }
    if (wait) {
        const msg = await res.json().catch(() => null);
        if (msg) {
            const comps = Array.isArray(msg.components) ? msg.components : [];
            const btnCount = comps.reduce((n, row) => n + (row.components ? row.components.length : 0), 0);
            console.log(`[NOTIFY] message id ${msg.id} — rendered ${btnCount} button(s) across ${comps.length} row(s)`);
            if (comps.length) console.log(JSON.stringify(comps));
        }
    } else {
        console.log(`[NOTIFY] Sent${payload.content ? ' — ' + payload.content.slice(0, 100) : ''} (${(payload.embeds || []).length} embed(s))`);
    }
}

async function main() {
    const o = parseArgs(process.argv.slice(2));
    let payload;

    // ── Generic payload template (single case or multi-decedent) ──
    if (o.payloadFile) {
        const data = loadJson(o.payloadFile);
        const rawCases = Array.isArray(data.cases)
            ? data.cases
            : (data.case ? [data.case] : []);
        const cases = [];
        for (const c of rawCases) {
            const merged = { ...c, ...o.case }; // inline case overrides
            const id = merged.discordId || await resolveDiscordId(o, merged.me || o.me);
            cases.push({ ...merged, _discordId: id });
        }
        const ping = o.ping !== false && data.ping !== false;
        payload = {
            username: o.username || USERNAME,
            content: buildContent(cases, { ping }),
            allowed_mentions: { parse: ['users'] },
            embeds: cases.map(buildCaseEmbed),
            components: buildComponents(cases),
        };
        if (data.content) payload.content = (payload.content + '\n\n' + data.content).trim();

    // ── ME assignment mode (inline, single case) ──
    } else if (o.me) {
        const discordId = await resolveDiscordId(o, o.me);
        const ping = o.ping !== false && discordId;
        const content = (ping ? `<@${discordId}> ` : '') + `Medical Examiner: **${o.me}**`;
        const caseObj = { ...o.case, me: o.me };
        payload = {
            username: o.username || USERNAME,
            content: content.trim(),
            allowed_mentions: { parse: ['users'] },
            embeds: [buildCaseEmbed(caseObj)],
            components: buildComponents([caseObj]),
        };

    // ── Generic message mode ──
    } else {
        const message = o.message.join(' ').trim() || 'Test notification';
        const ping = o.ping !== false;
        const content = ping ? `<@${DEFAULT_USER_ID}> ${message}` : message;
        payload = {
            username: o.username || USERNAME,
            content,
            allowed_mentions: { parse: ['users'] },
            components: buildComponents([]),
        };
        if (o.case.title || o.case.decedent) payload.embeds = [buildCaseEmbed(o.case)];
    }

    if (o.avatar) payload.avatar_url = o.avatar;
    await sendWebhook(payload, { dryRun: o.dryRun, wait: o.wait });
}

main().catch((e) => { console.error('[NOTIFY] Error:', e.message); process.exit(1); });
