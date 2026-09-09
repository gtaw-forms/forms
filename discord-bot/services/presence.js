/**
 * presence.js — Discord Rich Presence reflecting what the bot is doing.
 *
 * Baseline: Watching "PHMC reports" (idle status). Long tasks push a label
 * ("Deploying <report> to <forum>") and pop it when done; the most recent
 * active label wins, and the baseline returns when the stack empties.
 *
 * Notes:
 * - Presence is NOT a channel post — the PHMC_CHANNEL_SEND_ENABLED read-only
 *   gate does not apply (nothing is written to any channel).
 * - Updates are debounced (Discord rate-limits presence changes) and labels
 *   auto-expire (default 12 min, past the 10-min deploy abort) so a crashed
 *   task can't wedge the status forever.
 * - Non-blocking and never throws: all failures log and resolve false/void.
 */

import { ActivityType } from 'discord.js';

const IDLE_TEXT = 'PHMC reports';
const APPLY_DEBOUNCE_MS = 2000;
const DEFAULT_EXPIRE_MS = 12 * 60 * 1000;

let _client = null;
let _active = new Map(); // token -> { label, expiresAt }
let _nextToken = 1;
let _debounceTimer = null;
let _sweeper = null;

export function setPresenceClient(client) {
    _client = client || null;
}

/** Current display label (latest active, or the idle baseline). */
function currentLabel() {
    let latest = null;
    for (const entry of _active.values()) latest = entry;
    return latest ? latest.label : null;
}

function applyNow() {
    if (!_client?.user) return;
    const label = currentLabel();
    try {
        if (label) {
            _client.user.setPresence({
                activities: [{ name: label, type: ActivityType.Watching }],
                status: 'online',
            });
        } else {
            _client.user.setPresence({
                activities: [{ name: IDLE_TEXT, type: ActivityType.Watching }],
                status: 'idle',
            });
        }
    } catch (err) {
        console.warn(`[PRESENCE] Apply failed: ${err.message}`);
    }
}

function scheduleApply() {
    if (_debounceTimer) return;
    _debounceTimer = setTimeout(() => {
        _debounceTimer = null;
        sweepExpired();
        applyNow();
    }, APPLY_DEBOUNCE_MS);
}

function sweepExpired() {
    const now = Date.now();
    for (const [token, entry] of _active) {
        if (entry.expiresAt <= now) _active.delete(token);
    }
}

function ensureSweeper() {
    if (_sweeper || typeof setInterval !== 'function') return;
    _sweeper = setInterval(() => {
        const before = _active.size;
        sweepExpired();
        if (_active.size !== before) applyNow();
    }, 60 * 1000);
    if (typeof _sweeper.unref === 'function') _sweeper.unref();
}

/** Set the idle baseline immediately (call once on bot ready). */
export function initPresence() {
    ensureSweeper();
    applyNow();
}

/**
 * Push a busy label. Returns a token for endActivity().
 * @param {string} label e.g. "Deploying Case 486 to LSPD"
 * @param {number} [timeoutMs] auto-clear after this long (default 12 min)
 */
export function startActivity(label, timeoutMs = DEFAULT_EXPIRE_MS) {
    const token = _nextToken++;
    _active.set(token, {
        label: String(label || 'Working').slice(0, 128),
        expiresAt: Date.now() + timeoutMs,
    });
    ensureSweeper();
    scheduleApply();
    return token;
}

/** Pop a busy label by token. No-op for unknown/already-cleared tokens. */
export function endActivity(token) {
    if (_active.delete(token)) scheduleApply();
}
