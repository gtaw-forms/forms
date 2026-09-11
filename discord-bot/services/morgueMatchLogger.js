/**
 * morgueMatchLogger.js — posts web morgue-match results to the bot-spam channel.
 *
 * The web app (AssignedAutopsiesModal > Load) pushes a notice node per Load
 * attempt — hit AND miss — and this watcher picks it up event-driven and posts
 * a "who loaded what + confidence table" embed with the bot's own client
 * (same pattern as deployNotifier; no webhook URLs anywhere).
 *
 * Node shape: morgueMatchLogs/<pushId> = {
 *   status: 'pending', source: 'assigned-autopsies-modal', createdAt,
 *   loaded, bestScore, tie,
 *   loadedBy: { username, characterName, characterId },
 *   entry: { name, oocName, faction, assignedTo, topicUrl,
 *            dateOfDeath, timeOfDeath, placeOfDeath },
 *   winner: { caseId, name, score, narcotics, bac, location, timeOfDeath } | null,
 *   candidates: [{ caseId, name, score, loaded }]  (top 5)
 * }
 * Nodes are removed after posting. A pending node left over from downtime is
 * picked up on next boot (listener replay), so match reports survive outages.
 */

import firebase from './firebase.js';
import { sendLogMessage } from './logChannel.js';

let _ref = null;

// Client payload is authenticated-user input — clamp everything and coerce
// numbers so a malformed node can never break the embed send.
const clamp = (v, max = 1024) => {
    const s = String(v ?? '');
    return s.length > max ? s.slice(0, max - 3) + '...' : s;
};
const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function startMorgueMatchLogger() {
    firebase.init();
    const ref = firebase.db.ref('morgueMatchLogs');
    _ref = ref;
    console.log('[MORGUE-MATCH] Watching morgueMatchLogs...');
    ref.on('child_added', async (snap) => {
        if (!snap.exists()) return;
        const v = snap.val() || {};
        if (v.status && v.status !== 'pending') return;
        try {
            const loaded = v.loaded === true;
            const tie = v.tie === true;
            const bestScore = num(v.bestScore);
            const by = v.loadedBy || {};
            const e = v.entry || {};
            const w = v.winner || {};
            const cands = Array.isArray(v.candidates) ? v.candidates : [];

            const topLines = cands.slice(0, 5).map((c, i) => {
                const mark = c && c.loaded ? ' ← LOADED' : '';
                return `${i + 1}. \`#${c?.caseId ?? '?'}\` ${String(c?.name || '?').slice(0, 40)} — **${num(c?.score)}**${mark}`;
            });

            const color = !loaded ? 0xde354c : (tie ? 0xffa500 : 0x2ecc71);
            await sendLogMessage(null, {
                title: loaded ? 'Morgue Match — Case Loaded' : 'Morgue Match — No Match',
                description: [
                    `**Loaded by:** ${by.characterName || by.username || 'Unknown'}${by.username && by.characterName ? ` (${by.username})` : ''}`,
                    `**Assignment:** ${e.name || '?'}${e.oocName ? ` ((${e.oocName}))` : ''}${e.faction ? ` [${e.faction}]` : ''}${e.assignedTo ? ` → ${e.assignedTo}` : ''}`,
                    `**Request:** ${e.dateOfDeath || '?'} ${String(e.timeOfDeath || '').trim()} · ${e.placeOfDeath || '?'}`,
                ].join('\n'),
                color,
                fields: [
                    loaded ? {
                        name: 'Winner',
                        value: clamp(
                            `#${w.caseId ?? '?'} · ${w.name || '?'}\n` +
                            `Score ${bestScore}${tie ? ' (TIE — newest-first won)' : ''}` +
                            ` · Narcotics: ${w.narcotics || 'N/A'} · BAC: ${w.bac || 'N/A'}\n` +
                            `${w.location || ''} · ${w.timeOfDeath || ''}`
                        ),
                        inline: false,
                    } : null,
                    {
                        name: `Confidence (top ${Math.min(topLines.length, 5)} of ${cands.length})`,
                        value: clamp(topLines.join('\n') || 'No candidates scored'),
                        inline: false,
                    },
                    !loaded ? { name: 'Gate', value: `best ${bestScore} < 50 — nothing loaded`, inline: true } : null,
                    e.topicUrl ? { name: 'Request topic', value: clamp(e.topicUrl), inline: false } : null,
                ].filter(Boolean),
                timestamp: new Date(num(v.createdAt, Date.now())).toISOString(),
                footer: { text: 'PHMC Forms — Morgue Match Monitor' },
            });
            await snap.ref.remove().catch(() => {});
            console.log(`[MORGUE-MATCH] Posted + cleared ${snap.key}`);
        } catch (err) {
            console.warn(`[MORGUE-MATCH] Failed for ${snap.key}: ${err.message}`);
        }
    });
}

export function stopMorgueMatchLogger() {
    if (_ref) {
        _ref.off('child_added');
        _ref = null;
    }
}
