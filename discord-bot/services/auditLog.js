/**
 * Audit Log — abuse-observable trail of every bot interaction.
 *
 * Two sinks:
 *   - Session log FILE (via console.log, picked up by services/logger.js):
 *     EVERY interaction, always on. This is the forensic source of truth.
 *   - Dedicated AUDIT Discord channel (AUDIT_CHANNEL_ID, e.g. #audit-log-spam):
 *     EVERY audit line too, but sent in BULK — lines are buffered and flushed
 *     as bundled messages every AUDIT_FLUSH_MS (or when AUDIT_BATCH_MAX lines
 *     pile up). During a flood the buffer collapses into per-user/per-command
 *     summary counts instead of thousands of singular lines.
 *   - No AUDIT_CHANNEL_ID set -> legacy fallback: only sensitive commands +
 *     their errors go to the main log channel (BOT_LOG_CHANNEL_ID).
 *   - Autocomplete interactions are never logged (keystroke-level noise).
 *   - Flood WARNs are always singular + immediate (rare, important).
 *
 * Wiring: index.js calls auditReceive() at the top of interactionCreate and
 * auditCommandDone() around command.execute().
 */

import { sendLogMessage, sendToChannel } from './logChannel.js';

// Commands worth a Discord-visible trail in legacy (no audit channel) mode:
// state mutations, owner-only tools, and PII lookups.
const DISCORD_COMMANDS = new Set([
    'restart',
    'maintenance',
    'report-skip',
    'report-retry',
    'reassign-autopsy',
    'rotation-set',
    'dev',
    'mass-autopsy',
    'force-autopsy-check',
    'force-autopsy-send',
    'force-autopsy-complete',
    'assign-autopsy',
    'autopsy-skip',
    'purge-death-drafts',
    'enable-dev-autopsy',
    'web-autopsy-autopost',
    'sync-autopsy-requests',
    'sync-autopsy-poster',
    'fix-autopsy',
    'patient-search',
    'morgue',
    'user',
    'autopsy-request',
    'agency-creds',
]);

const auditChannelId = () => process.env.AUDIT_CHANNEL_ID || null;
const floodThreshold = () => parseInt(process.env.AUDIT_FLOOD_THRESHOLD || '25', 10);
const floodWindowMs = () => parseInt(process.env.AUDIT_FLOOD_WINDOW_MS || '300000', 10);
const flushMs = () => parseInt(process.env.AUDIT_FLUSH_MS || '10000', 10);
const batchMax = () => parseInt(process.env.AUDIT_BATCH_MAX || '25', 10);

// ── Bulk sender ──────────────────────────────────────────────
// Buffer audit lines, flush bundled. Bounds: Discord caps messages at 2000
// chars, so the buffer is packed into <=1900-char chunks. If the buffer grows
// past SUMMARY_AFTER lines/chars (flood demand), it collapses into counts.
const CHUNK_LIMIT = 1900;
const SUMMARY_AFTER_LINES = 60;
const SUMMARY_AFTER_CHARS = 8000;

const pending = []; // { line, ts }
let flushTimer = null;
let flushing = false;

function ensureTimer() {
    if (flushTimer) return;
    flushTimer = setInterval(() => {
        flushAudit().catch(() => { /* best effort */ });
    }, flushMs());
    // Don't hold the process open for the audit timer alone.
    if (typeof flushTimer.unref === 'function') flushTimer.unref();
}

function enqueueAudit(line) {
    const channelId = auditChannelId();
    if (!channelId) return false;
    pending.push({ line, ts: Date.now() });
    ensureTimer();
    if (pending.length >= batchMax()) {
        flushAudit().catch(() => { /* best effort */ });
    }
    return true;
}

function packChunks(lines) {
    const chunks = [];
    let cur = '';
    for (const line of lines) {
        if ((cur + line + '\n').length > CHUNK_LIMIT) {
            if (cur) chunks.push(cur);
            cur = '';
        }
        cur += line + '\n';
    }
    if (cur) chunks.push(cur);
    return chunks;
}

function summarize(batch) {
    // Collapse a flood buffer into per-user/per-action counts.
    const counts = new Map(); // key -> { n, first, last }
    for (const { line, ts } of batch) {
        const m = line.match(/^\[AUDIT\] (?:(CMD|BTN|MODAL|SELECT|OTHER) (\S+)|DONE (\S+)).*\| ([^|]+?) \|/);
        const key = m ? `${m[1] || 'DONE'} ${m[2] || m[3]} — ${m[4].trim()}` : line.slice(0, 80);
        const rec = counts.get(key) || { n: 0, first: ts, last: ts };
        rec.n += 1;
        rec.last = ts;
        counts.set(key, rec);
    }
    const fmt = (ts) => new Date(ts).toISOString().slice(11, 19);
    const out = [
        `[AUDIT] BULK summary: ${batch.length} interactions ` +
        `(${fmt(batch[0].ts)}–${fmt(batch[batch.length - 1].ts)} UTC), collapsed by demand:`,
    ];
    for (const [key, rec] of [...counts.entries()].sort((a, b) => b[1].n - a[1].n)) {
        out.push(`  ${rec.n}x ${key}`);
    }
    return out;
}

async function flushAudit() {
    if (flushing || !pending.length) return;
    const channelId = auditChannelId();
    if (!channelId) {
        pending.length = 0;
        return;
    }
    flushing = true;
    try {
        const batch = pending.splice(0, pending.length);
        const totalChars = batch.reduce((n, e) => n + e.line.length, 0);
        const lines =
            batch.length > SUMMARY_AFTER_LINES || totalChars > SUMMARY_AFTER_CHARS
                ? summarize(batch)
                : batch.map((e) => e.line);
        for (const chunk of packChunks(lines)) {
            const ok = await sendToChannel(channelId, chunk);
            if (!ok) break; // delivery failing — file log still has everything
        }
    } finally {
        flushing = false;
    }
}

// ── Flood detection ──────────────────────────────────────────
// Per-user sliding-window counters (in-memory; best effort).
const hits = new Map(); // userId -> { count, windowStart, alerted }
function checkFlood(userId, userTag) {
    const now = Date.now();
    const windowMs = floodWindowMs();
    let rec = hits.get(userId);
    if (!rec || now - rec.windowStart > windowMs) {
        rec = { count: 0, windowStart: now, alerted: false };
        hits.set(userId, rec);
    }
    rec.count += 1;
    if (rec.count >= floodThreshold() && !rec.alerted) {
        rec.alerted = true;
        const msg =
            `[AUDIT] [WARN] Flood: ${userTag} (${userId}) fired ${rec.count} ` +
            `interactions within ${Math.round(windowMs / 60000)} min — possible abuse/spam.`;
        console.warn(msg);
        // Singular + immediate: alerts are rare and must not wait for a flush.
        const auditId = auditChannelId();
        if (auditId) {
            sendToChannel(auditId, msg);
        } else {
            sendLogMessage(msg);
        }
    }
    // Opportunistic cleanup so the map can't grow unbounded.
    if (hits.size > 5000) {
        for (const [id, r] of hits) {
            if (now - r.windowStart > windowMs) hits.delete(id);
        }
    }
}

function truncate(value, max = 80) {
    const s = String(value ?? '');
    return s.length > max ? s.slice(0, max) + '...' : s;
}

function where(interaction) {
    const guild = interaction.guild?.name ?? 'DM';
    const channel = interaction.channel?.name ? `#${interaction.channel.name}` : (interaction.channelId ?? 'unknown-channel');
    return `${channel} (${guild})`;
}

function optionsSummary(interaction) {
    try {
        const data = interaction.options?.data ?? [];
        if (!data.length) return '';
        const parts = [];
        for (const opt of data) {
            if (opt.type === 1) { // subcommand
                const sub = (opt.options ?? []).map(o => `${o.name}=${truncate(o.value)}`).join(' ');
                parts.push(`${opt.name}${sub ? ' ' + sub : ''}`);
            } else if (opt.type === 2) { // subcommand group
                parts.push(opt.name);
            } else {
                parts.push(`${opt.name}=${truncate(opt.value)}`);
            }
        }
        return ' ' + parts.join(' ');
    } catch {
        return '';
    }
}

/**
 * Route one audit line to Discord: bulk-enqueue for the audit channel when
 * configured, else legacy sensitive-only post to the main log channel.
 */
function routeToDiscord(line, isSensitive) {
    if (auditChannelId()) {
        enqueueAudit(line);
    } else if (isSensitive) {
        sendLogMessage(line);
    }
}

/**
 * Log receipt of any interaction. Returns a context object for auditCommandDone,
 * or null for interactions we deliberately skip (autocomplete).
 */
export function auditReceive(interaction) {
    if (interaction.isAutocomplete?.()) return null;

    const user = interaction.user;
    const who = `${user?.tag ?? 'unknown'} (${user?.id ?? '?'})`;
    const loc = where(interaction);

    let kind, target, detail = '';
    if (interaction.isChatInputCommand?.()) {
        kind = 'CMD';
        target = `/${interaction.commandName}`;
        detail = optionsSummary(interaction);
        checkFlood(user.id, user.tag);
    } else if (interaction.isButton?.()) {
        kind = 'BTN';
        target = interaction.customId;
    } else if (interaction.isModalSubmit?.()) {
        kind = 'MODAL';
        target = interaction.customId;
    } else if (interaction.isAnySelectMenu?.()) {
        kind = 'SELECT';
        target = interaction.customId;
    } else {
        kind = 'OTHER';
        target = interaction.constructor?.name ?? '?';
    }

    const line = `[AUDIT] ${kind} ${target}${detail} | ${who} | ${loc}`;
    console.log(line);

    const ctx = { kind, target: `${target}${detail}`, who, loc, start: Date.now() };

    routeToDiscord(
        line,
        kind === 'CMD' && DISCORD_COMMANDS.has(interaction.commandName),
    );
    return ctx;
}

/**
 * Log the outcome of a slash command execution.
 */
export function auditCommandDone(ctx, { ok, error } = {}) {
    if (!ctx) return;
    const ms = Date.now() - ctx.start;
    const status = ok ? '[OK]' : `[ERR] ${truncate(error?.message || error || 'unknown', 200)}`;
    const line = `[AUDIT] DONE ${ctx.target} | ${ctx.who} | ${ctx.loc} | ${status} (${ms}ms)`;
    if (ok) {
        console.log(line);
    } else {
        console.error(line);
    }

    const isSensitive = ctx.kind === 'CMD' && DISCORD_COMMANDS.has(ctx.target.split(' ')[0].slice(1));
    // DONE lines go to the audit channel in bulk; in legacy mode only errors
    // on sensitive commands are worth the main channel's attention.
    if (auditChannelId()) {
        enqueueAudit(line);
    } else if (!ok && isSensitive) {
        sendLogMessage(line);
    }
}
