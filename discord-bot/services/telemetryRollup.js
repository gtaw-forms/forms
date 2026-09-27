/**
 * telemetryRollup.js — hourly client-telemetry rollup (Components V2).
 *
 * Browser clients flush an hourly aggregate beacon through the appendTelemetry
 * Cloud Function into data/telemetry.jsonl (VPS). This tick reads the file,
 * posts ONE V2 rollup to the admin channel, and truncates. No per-client
 * Discord posts, no pings, no RTDB.
 *
 * Wiring (index.js): setTelemetryClient(client) + startTelemetryRollup()
 * (registers an hourly central-scheduler tick). Manual: /telemetry-now.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MessageFlags } from 'discord.js';
import { registerTick } from './scheduler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TELEMETRY_PATH = resolve(__dirname, '..', 'data', 'telemetry.jsonl');

const V2_FLAG = 32768;
const ACCENT_GREEN = 0x2ecc71;
const ACCENT_AMBER = 0xe67e22;
const POST_TIMEOUT_MS = 10000;
const MAX_USERS_SHOWN = 20;
const MAX_ERROR_SAMPLES = 3;

let _client = null;

export function setTelemetryClient(client) {
    _client = client;
}

function channelId() {
    // Mirrors morgue-api NOTIFY_CHANNELS.admin (env or staging default) so the
    // rollup lands exactly where /api/notify admin posts go.
    return process.env.NOTIFY_CHANNEL_ADMIN || '1455291752327024721';
}

function readLines() {
    let text = '';
    try {
        text = readFileSync(TELEMETRY_PATH, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }
    const lines = [];
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            const obj = JSON.parse(trimmed);
            if (obj && typeof obj === 'object') lines.push(obj);
        } catch {
            // Skip corrupt lines — never fail the rollup on one bad row.
        }
    }
    return lines;
}

function aggregate(lines) {
    const total = {
        events: 0, cacheHits: 0, network: 0, errors: 0, inactive: 0,
        totalKb: 0, netKb: 0, byTrigger: {}, routes: new Set(),
        users: new Set(), errorSamples: [],
    };
    let minAt = null;
    let maxAt = null;
    for (const line of lines) {
        const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
        total.events += num(line.events);
        total.cacheHits += num(line.cacheHits);
        total.network += num(line.network);
        total.errors += num(line.errors);
        total.inactive += num(line.inactive);
        total.totalKb += num(line.totalKb);
        total.netKb += num(line.netKb);
        if (line.byTrigger && typeof line.byTrigger === 'object') {
            for (const [key, val] of Object.entries(line.byTrigger)) {
                total.byTrigger[String(key).slice(0, 80)] = (total.byTrigger[String(key).slice(0, 80)] || 0) + num(val);
            }
        }
        for (const r of line.routes || []) {
            if (typeof r === 'string' && r) total.routes.add(r.slice(0, 80));
        }
        for (const u of line.users || []) {
            if (typeof u === 'string' && u) total.users.add(u.slice(0, 80));
        }
        for (const e of line.errorSamples || []) {
            if (typeof e === 'string' && e && total.errorSamples.length < 50) {
                total.errorSamples.push(e.slice(0, 200));
            }
        }
        const at = Number(line.at);
        if (Number.isFinite(at)) {
            if (minAt === null || at < minAt) minAt = at;
            if (maxAt === null || at > maxAt) maxAt = at;
        }
    }
    return { total, minAt, maxAt };
}

function buildV2(total, minAt, maxAt) {
    const windowMin = minAt && maxAt ? Math.max(1, Math.round((maxAt - minAt) / 60000)) : 60;
    const hitPct = total.events ? Math.round((total.cacheHits / total.events) * 100) : 0;
    const accent = total.errors > 0 ? ACCENT_AMBER : ACCENT_GREEN;
    const blocks = [
        {
            type: 10,
            content: `## Client Telemetry — hourly rollup\nAggregated client telemetry · window \`~${windowMin} min\``,
        },
        {
            type: 10,
            content:
                `**Cache hits** \`${hitPct}%\` · ` +
                `**Size** \`${total.totalKb.toFixed(1)} KB total\` · \`${total.netKb.toFixed(1)} KB network\``,
        },
    ];
    const triggerLines = Object.entries(total.byTrigger)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([trigger, count]) => `${trigger}: ${count}`)
        .join(' · ');
    if (triggerLines) {
        blocks.push({ type: 10, content: `**Triggers**\n\`${triggerLines.slice(0, 900)}\`` });
    }
    const users = [...total.users];
    if (users.length > 0) {
        const shown = users.slice(0, MAX_USERS_SHOWN).join(', ');
        const extra = users.length > MAX_USERS_SHOWN ? ` (+${users.length - MAX_USERS_SHOWN} more)` : '';
        blocks.push({
            type: 10,
            content: `**Visited (${users.length})**\n${shown.slice(0, 1500)}${extra}`,
        });
    } else {
        blocks.push({ type: 10, content: '**Visited**\nNo identified sessions' });
    }
    if (total.errors > 0) {
        const samples = [...new Set(total.errorSamples)].slice(0, MAX_ERROR_SAMPLES);
        blocks.push({
            type: 10,
            content:
                `**Errors (${total.errors})**\n` +
                (samples.length > 0 ? samples.map((s) => `\`${s.slice(0, 300)}\``).join('\n') : 'n/a'),
        });
    }
    blocks.push({ type: 10, content: '-# phmc telemetry' });
    return [{ type: 17, accent_color: accent, components: blocks }];
}

/**
 * Read, aggregate, post, truncate. Returns a summary for the manual command.
 * Skips silently when there is nothing to report (no noise on quiet hours).
 */
export async function runTelemetryRollup() {
    if (!_client) return { posted: false, reason: 'no-client' };
    const id = channelId();
    const lines = readLines();
    if (lines.length === 0) return { posted: false, reason: 'empty' };
    const { total, minAt, maxAt } = aggregate(lines);
    if (total.events === 0) {
        writeFileSync(TELEMETRY_PATH, '');
        return { posted: false, reason: 'no-events' };
    }
    const components = buildV2(total, minAt, maxAt);
    try {
        const channel = await _client.channels.fetch(id);
        if (!channel?.isTextBased()) {
            console.warn('[TELEMETRY] Admin channel is not sendable.');
            return { posted: false, reason: 'not-sendable' };
        }
        const sent = await Promise.race([
            channel.send({ flags: MessageFlags.IsComponentsV2, components, allowedMentions: { parse: [] } }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('send timed out after 10s')), POST_TIMEOUT_MS)),
        ]);
        writeFileSync(TELEMETRY_PATH, '');
        const at = new Date().toISOString();
        console.log(`[TELEMETRY] ${at} Posted hourly rollup (${total.events} events, ${total.users.size} users, ${total.errors} errors) messageId=${sent.id}.`);
        return { posted: true, messageId: sent.id, events: total.events, users: total.users.size, errors: total.errors };
    } catch (err) {
        // Keep the file on failure — next tick retries. Rotation caps growth.
        console.warn(`[TELEMETRY] Rollup post failed (kept ${lines.length} lines):`, err.message);
        return { posted: false, reason: 'send-failed' };
    }
}

/**
 * Wall-clock hourly schedule (fires at xx:00, not 1h-after-restart).
 *
 * Deliberately NOT on the central scheduler: registerTick anchors to
 * process start (nextRunAt = now + interval), which drifts the fire time to
 * whenever the bot last restarted. Recursive setTimeout re-anchors to the
 * wall clock every hour, so posts land on xx:00 consistently. Reentrancy is
 * guarded locally (skip if the previous run is still going — same semantics
 * as the central scheduler, minus the drift).
 */

let wallTimer = null;
let wallRunning = false;

function msToNextHour() {
    const now = new Date();
    return (60 - now.getMinutes()) * 60000 - now.getSeconds() * 1000 - now.getMilliseconds();
}

function armWallClock() {
    wallTimer = setTimeout(async () => {
        if (!wallRunning) {
            wallRunning = true;
            try {
                await runTelemetryRollup();
            } catch (err) {
                console.warn('[TELEMETRY] Hourly run failed:', err?.message || err);
            } finally {
                wallRunning = false;
            }
        } else {
            console.warn('[TELEMETRY] Skipping xx:00 run — previous run still in progress.');
        }
        armWallClock();
    }, Math.max(msToNextHour(), 1000));
    // Kept ref'd on purpose (repo convention — scheduler.js): ticks are heartbeat.
}

/**
 * Start wall-clock hourly posting + register a scheduler entry for
 * observability (getTickStatus). The scheduler entry is a passive marker —
 * the wall-clock chain above does the actual firing.
 */
export function startTelemetryRollup() {
    armWallClock();
    registerTick('telemetry-rollup', {
        intervalMs: 3600000,
        jitterMs: 0,
        runAtStart: false,
        fn: async () => {},
    });
    const next = new Date(Date.now() + msToNextHour());
    console.log(`[TELEMETRY] Wall-clock hourly rollup armed — first post at ${next.toISOString()}.`);
}
