/**
 * massAssignmentPanel.js — Mass Autopsy ME panel (Mass Autopsy Rework, Task 4).
 *
 * Posts ONE panel message for a mass-autopsy batch instead of one ping per
 * body. The panel tags every assigned ME once, with one button per ME name.
 * Pressing an ME button updates the message to show that ME's body slice
 * (decedent name, OOC, sex, DOD/location, case link).
 *
 * Data in (per assignment — field aliases accepted):
 *   me|assignedTo, name|decedent, ooc|oocName, sex|gender,
 *   dod|dateOfDeath (+ timeOfDeath), dateOfDeath, timeOfDeath,
 *   deathType|pkck|pk_ck, synopsis|synopsisText, location|placeOfDeath,
 *   caseUrl|topicUrl, caseNumber|caseNum, caseTitle,
 *   morgue (object: { found, caseId, name, level, exactName, candidateCount })
 *   — morgue omitted/null = lookup unavailable (line hidden); { found:false }
 *   = searched, no match.
 *
 * Channel routing (Maintenance Mode ON):
 *   - DEV TEST active -> dev log channel, else MASS_PANEL_CHANNEL_ID, else the
 *     staging fallback below. NEVER the live #autopsies channel.
 *   - Prod (dev-test off) + PHMC_CHANNEL_SEND_ENABLED=true -> live #autopsies
 *     channel via the bot client (same gate as postAutopsyNotice).
 *   - Prod without that gate -> MASS_PANEL_CHANNEL_ID / staging fallback via
 *     the bot client (fail closed: no client or no channel => skip + warn).
 *   The panel never uses ASSIGNMENT_WEBHOOK_URL itself (interactive buttons
 *   need a bot-authored message); when the panel posts, callers must skip the
 *   per-body webhook pings so each ME is tagged exactly once.
 *
 * Discord mapping: autopsy-requests/discord-members/<forum_name_lower> holds
 * the Discord user id; mapped MEs are tagged <@id>, unmapped fall back to a
 * bold forum name (**Name**).
 *
 * Buttons: customId `mass_<panelId>_<meIdx>` (one per ME, bodies aggregated
 * under their ME — never one button per body) plus `mass_<panelId>_cancel`.
 * Cap MASS_PANEL_MAX_ME_BUTTONS_WITH_LINKS ME buttons so the 5 action rows
 * always fit; extra MEs are named in text with no button. Panels never expire
 * on their own: rows disable on Cancel or when the collection completes
 * (retired), and presses rebuild state after bot restarts.
 *
 * No webhook URLs in source — destinations come from env / channel map only.
 */

import { MessageFlags } from 'discord.js';
import { isDevTestActive, devLogChannelId } from './devRouting.js';
import { getChannelId, channelSendEnabled } from './phmcChannels.js';
import { sendToChannel } from './logChannel.js';
import firebase from './firebase.js';

// ── Auto-refresh watcher ──
// Watches autopsy-requested for changes on mass collections that have a live
// panel and edits the panel message in place (mass edit, never a repost):
// reassignments, completions (finished bodies drop off), name fixes, LOA-time
// edits — anything that touches the entry. Debounced per request (10s) so a
// burst of writes settles into one edit; skips when the entry was refreshed
// <30s ago (the direct reassign call already handled it). Retire-on-complete
// still owns the finished state. Never throws; never posts new messages.
const watcherTimers = new Map();
const WATCHER_DEBOUNCE_MS = 10000;
const WATCHER_RECENCY_MS = 30000;

export function startMassPanelWatcher(client) {
    try {
        firebase.init();
        const db = firebase.db;
        if (!db) {
            console.warn('[MASS-PANEL] Watcher not started: no database');
            return;
        }
        db.ref('autopsy-requested').on('child_changed', (snap) => {
            try {
                const v = snap.val() || {};
                if (v.isMassSingleThread !== true || !v.massPanel?.panelId) return;
                const key = snap.key;
                if (watcherTimers.has(key)) clearTimeout(watcherTimers.get(key));
                watcherTimers.set(key, setTimeout(async () => {
                    watcherTimers.delete(key);
                    try {
                        const cur = (await db.ref(`autopsy-requested/${key}/massPanel/updatedAt`).once('value')).val() || 0;
                        if (Date.now() - cur < WATCHER_RECENCY_MS) return;
                        const res = await refreshMassPanel(db, client || _discordClient, key);
                        if (res.refreshed) console.log(`[MASS-PANEL] Auto-refreshed panel for #${key} (Firebase change)`);
                    } catch { /* auto-refresh best-effort ignored: refreshMassPanel warns internally, next change retries */ }
                }, WATCHER_DEBOUNCE_MS));
            } catch { /* watcher event best-effort ignored: next Firebase change re-fires the handler */ }
        });
        console.log('[MASS-PANEL] Watcher active (auto-refresh on case changes).');
    } catch (err) {
        console.warn('[MASS-PANEL] Watcher failed to start:', err.message);
    }
}

export const MASS_PANEL_PREFIX = 'mass_';
// No time-to-live: a posted panel stays live until the collection completes
// (retired by the completion flow), is Cancelled, or its message is deleted.
// There is deliberately no expiry timer — restart healing rebuilds state for
// presses on panels the current process never posted.
export const MASS_PANEL_MAX_ME_BUTTONS = 24;
export const MASS_PANEL_CANCEL_SLOT = 'cancel';
export const MASS_PANEL_BACK_SLOT = 'back';
// ME-button cap when the link row is present: 4 rows of ME/Cancel buttons +
// 1 link row = Discord's 5-row limit. The rest fall into the overflow note.
export const MASS_PANEL_MAX_ME_BUTTONS_WITH_LINKS = 19;
// Public links, same as the per-assignment webhook (assignmentWebhook.js).
export const MASS_PANEL_FORMS_URL = 'https://gtaw-forms.github.io/forms/';
// Staging channel id (committable — channel ids are not secrets, see
// phmcChannels.js). Overridable via MASS_PANEL_CHANNEL_ID in .env.
export const MASS_PANEL_STAGING_CHANNEL_ID = '1538008459445010502';

const PANEL_COLOR = 0x00bcd4;

/** Map<panelId, {groups, content, embeds, components, caseUrl, requestTopicId, message, channelId, messageId, timer, createdAt, bodyCount}> */
export const pendingMassPanels = new Map();

// Lazy Firebase access for record cleanup + restart healing (dynamic import:
// firebase.js itself is side-effect free, but this keeps the module's import
// graph identical for existing consumers).
async function panelDb() {
    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        return firebase.db || null;
    } catch {
        return null;
    }
}

// Remove the Firebase traces of a dead panel (registry + entry ref) so a
// later press can't resurrect it and refresh targets the live message.
async function cleanupPanelRecords(panelId, topicIdHint) {
    try {
        const db = await panelDb();
        if (!db) return;
        await db.ref(`massPanelById/${panelId}`).remove().catch(() => {});
        if (topicIdHint) {
            const cur = (await db.ref(`autopsy-requested/${topicIdHint}/massPanel`).once('value')).val() || null;
            if (cur && cur.panelId === panelId) {
                await db.ref(`autopsy-requested/${topicIdHint}/massPanel`).remove().catch(() => {});
            }
        }
    } catch { /* cleanup must never break the flow */ }
}

let massPanelCounter = 0;

// ── Discord client registration ──
// Forum-side callers (autopsyRequestMonitor) hold no discord.js client, so the
// bot registers its client once at startup (index.js, next to setPhmcClient)
// and postMassAssignmentPanel falls back to it when the per-call client arg
// is null. Mirrors the logChannel/phmcChannels set*Client pattern.
let _discordClient = null;
export function setMassPanelClient(client) {
    _discordClient = client || null;
}

// ── Channel routing ──

/**
 * Resolve the destination channel for the panel. Never returns the live
 * #autopsies channel while DEV TEST mode is active.
 * @returns {string} channel id ('' when nothing resolves)
 */
export function resolveMassPanelChannelId() {
    const override = (process.env.MASS_PANEL_CHANNEL_ID || '').trim();
    if (isDevTestActive()) {
        const devTarget = devLogChannelId() || override || MASS_PANEL_STAGING_CHANNEL_ID;
        return devTarget;
    }
    if (channelSendEnabled()) {
        return getChannelId('autopsies');
    }
    return override || MASS_PANEL_STAGING_CHANNEL_ID;
}

// ── Normalization / grouping (pure) ──

function cleanStr(v) {
    return String(v ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Normalize one assignment entry (accepts field aliases from massAutopsy
 * results and monitor-shaped records).
 */
export function normalizePanelAssignment(a = {}) {
    const me = cleanStr(a.me || a.assignedTo || a.assigned || a.medicalExaminer);
    const name = cleanStr(a.name || a.decedent || a.decedentName);
    const ooc = cleanStr(a.ooc || a.oocName);
    const sex = cleanStr(a.sex || a.gender);
    const dateOfDeath = cleanStr(a.dateOfDeath);
    const timeOfDeath = cleanStr(a.timeOfDeath);
    const dod = [cleanStr(a.dod || a.dateOfDeath), cleanStr(a.timeOfDeath)].filter(Boolean).join(' ').trim();
    const deathType = cleanStr(a.deathType || a.pkck || a.pk_ck || a.pkCk).toUpperCase();
    const synopsis = cleanStr(a.synopsis || a.synopsisText || a.details);
    const location = cleanStr(a.location || a.placeOfDeath || a.deathLocation);
    const caseUrl = cleanStr(a.caseUrl || a.topicUrl || a.caseLink || a.url);
    const loadUrl = cleanStr(a.loadUrl || a.loadCaseUrl);
    const caseNumber = cleanStr(a.caseNumber ?? a.caseNum ?? a.caseNo);
    const caseTitle = cleanStr(a.caseTitle || a.title);
    const morgue = (a.morgue && typeof a.morgue === 'object') ? a.morgue : null;
    const completed = a.completedAt ? true : a.completed === true;
    const deadlineUnix = (typeof a.deadlineUnix === 'number' && Number.isFinite(a.deadlineUnix)) ? a.deadlineUnix : null;
    return { me, name, ooc, sex, dod, dateOfDeath, timeOfDeath, deathType, synopsis, location, caseUrl, loadUrl, caseNumber, caseTitle, morgue, completed, deadlineUnix };
}

/**
 * Group normalized assignments by ME, preserving first-seen ME order.
 * @param {Array} list — normalized assignments (entries without `me` dropped)
 * @returns {Array<{me: string, bodies: Array}>}
 */
export function groupAssignmentsByMe(list) {
    const order = [];
    const byMe = new Map();
    for (const a of list || []) {
        if (!a || !a.me) continue;
        if (!byMe.has(a.me)) {
            byMe.set(a.me, { me: a.me, bodies: [] });
            order.push(a.me);
        }
        byMe.get(a.me).bodies.push(a);
    }
    return order.map((me) => byMe.get(me));
}

function truncate(s, n) {
    const str = String(s ?? '');
    if (str.length <= n) return str;
    return str.slice(0, Math.max(0, n - 3)) + '...';
}

/**
 * Truncate at a word boundary so narratives never cut mid-word. Appends an
 * ellipsis marker when truncated. Returns { head, rest } — rest is '' when
 * the input fits.
 */
export function truncateWords(s, n) {
    const str = String(s ?? '');
    if (str.length <= n) return { head: str, rest: '' };
    let cut = str.lastIndexOf(' ', n - 1);
    if (cut < n * 0.5) cut = n - 1; // no nearby space (long token) — hard cut
    return { head: str.slice(0, cut).trimEnd() + '…', rest: str.slice(cut).trimStart() };
}

function mentionFor(me, discordByMe) {
    const id = discordByMe ? discordByMe.get(me) : null;
    return id ? `<@${id}>` : `**${me}**`;
}

/**
 * One-line morgue-record status for a slice body. Returns '' when no lookup
 * ran (line hidden) so a failed/unavailable lookup never reads as "no match".
 */
export function formatMorgueLine(morgue) {
    if (!morgue || typeof morgue !== 'object') return '';
    if (morgue.found) {
        const id = morgue.caseId ? `CASE-${morgue.caseId}` : 'morgue record';
        const confidence = morgue.exactName ? 'exact name match'
            : (morgue.level === 'high' ? 'high confidence' : 'possible match');
        const extra = (!morgue.exactName && morgue.candidateCount > 1) ? ` (${morgue.candidateCount} candidates)` : '';
        const recName = morgue.name ? ` — ${morgue.name}` : '';
        return `Morgue record: ${id}${recName} (${confidence}${extra})`;
    }
    return 'Morgue record: none found matching this name';
}

function bodyShortLine(b) {
    const who = `**${b.name || 'Unknown'}**` + (b.ooc ? ` ((${b.ooc}))` : '');
    const tags = [
        b.deathType ? b.deathType : '',
        b.morgue && b.morgue.found
            ? (b.morgue.exactName ? 'morgue: exact' : 'morgue: possible')
            : (b.morgue && b.morgue.found === false ? 'morgue: none' : ''),
        b.completed ? 'COMPLETED' : 'OUTSTANDING',
    ].filter(Boolean).join(' · ');
    return tags ? `${who} — ${tags}` : who;
}

// ── Payload builders (pure) ──

/**
 * Build the panel payload (content + summary embed + ME buttons).
 * @param {string} panelId — alphanumeric id (no underscores)
 * @param {Array} groups — groupAssignmentsByMe() output (already capped by caller for buttons)
 * @param {Map} discordByMe — forum name -> discord user id (or null)
 * @param {object} [opts]
 * @param {number} [opts.totalMeCount] — pre-cap ME count (for overflow note)
 * @param {number} [opts.totalBodyCount] — total bodies (defaults to grouped sum)
 */
export function buildMassPanelPayload(panelId, groups, discordByMe, { totalMeCount, totalBodyCount } = {}) {
    const shown = groups || [];
    const bodyCount = totalBodyCount ?? shown.reduce((n, g) => n + g.bodies.length, 0);
    const meCount = totalMeCount ?? shown.length;
    const overflow = Math.max(0, meCount - shown.length);

    const pings = shown.map((g) => mentionFor(g.me, discordByMe)).join(' ');
    let content = `${pings} — you have been assigned a **mass autopsy** (${bodyCount} ${bodyCount === 1 ? 'body' : 'bodies'} across ${meCount} ${meCount === 1 ? 'ME' : 'MEs'}). Press your name below to view your cases.`;
    if (overflow > 0) {
        content += ` (+${overflow} more ${overflow === 1 ? 'ME' : 'MEs'} named in the panel, no button: row limit)`;
    }
    content = truncate(content, 2000);

    // Status rollup: X outstanding · Y completed (uniformity at a glance).
    const allBodies = shown.flatMap((g) => g.bodies || []);
    const doneCount = allBodies.filter((b) => b && b.completed).length;
    const openCount = allBodies.length - doneCount;
    // Shared case link (single-thread mass = one case topic for all bodies).
    const firstLinked = shown.flatMap((g) => g.bodies).find((b) => b.caseUrl);
    const caseRef = firstLinked ? `[View case thread](<${firstLinked.caseUrl}>)` : '';
    const caseNum = (firstLinked && firstLinked.caseNumber) ? ` — Case #${firstLinked.caseNumber}` : '';
    // Shared synopsis (one Section 3 per request) under the case link. Long
    // narratives split across a continuation embed instead of cutting
    // mid-word — the whole description still respects the 4096-char cap and
    // the message stays within Discord's 6000-char total.
    const rawSynopsis = shown.flatMap((g) => g.bodies).map((b) => b.synopsis).find((s) => s) || '';
    const synSplit = truncateWords(rawSynopsis, 600);
    const synopsisLine = rawSynopsis ? `\n*Synopsis:*\n*"${synSplit.head}"*` : '';
    const fields = shown.map((g) => ({
        name: truncate(`${g.me} — ${g.bodies.length} ${g.bodies.length === 1 ? 'body' : 'bodies'}`, 256),
        value: truncate(g.bodies.map((b) => bodyShortLine(b)).join('\n') || 'No bodies', 1024),
        inline: false,
    }));
    // Discord cap: 25 fields — ME buttons already cap at 19, so this fits.
    // Layout: header/synopsis block(s) first, then the body assignments as
    // their own closing block (never buried at the bottom of the header).
    const embeds = [{
        title: truncate(`Mass Autopsy Assigned — ${bodyCount} ${bodyCount === 1 ? 'body' : 'bodies'} / ${meCount} ${meCount === 1 ? 'ME' : 'MEs'}${caseNum}`, 256),
        description: truncate(`${caseRef ? `${caseRef}\n` : ''}${synopsisLine ? `${synopsisLine}\n` : ''}Status: ${openCount} outstanding · ${doneCount} completed.\nEach body below lists type and morgue-record status. Full detail (dates, times, locations) on your name button.`, 4096),
        color: PANEL_COLOR,
        timestamp: new Date().toISOString(),
    }];
    if (synSplit.rest) {
        embeds.push({
            title: truncate('Synopsis (continued)', 256),
            description: truncate(`*"${synSplit.rest}"*`, 4096),
            color: PANEL_COLOR,
        });
    }
    // Bodies without a morgue record get a dedicated warning block BEFORE the
    // assignment fields — staff asked for this to be unmissable (a "morgue:
    // none" suffix on a body line is too easy to skim past). Only definitive
    // misses (found:false); unavailable lookups stay silent, never alarming.
    const order = [];
    shown.forEach((g) => (g.bodies || []).forEach((b) => order.push(b)));
    const missing = order.filter((b) => b && b.morgue && b.morgue.found === false);
    if (missing.length > 0) {
        const missingLines = missing.map((b) => {
            const pos = order.indexOf(b) + 1;
            const who = `${b.name || 'Unknown'}` + (b.ooc ? ` ((${b.ooc}))` : '');
            return `Body ${pos}/${order.length}: ${who} — ${b.me || 'unassigned'}`;
        });
        embeds.push({
            title: truncate(`No Morgue Record — ${missing.length} ${missing.length === 1 ? 'body' : 'bodies'} need attention`, 256),
            description: truncate(
                `These bodies matched NO morgue record. Assigned MEs: import manually or confirm identity before examining.\n` +
                missingLines.map((l) => `• ${l}`).join('\n'),
                4096
            ),
            color: 0xe74c3c,
        });
    }
    embeds.push({
        title: truncate(`Assigned Bodies — ${bodyCount} ${bodyCount === 1 ? 'body' : 'bodies'} across ${meCount} ${meCount === 1 ? 'ME' : 'MEs'}`, 256),
        color: PANEL_COLOR,
        fields,
        footer: { text: 'PHMC Dept. of Forensic Medicine — mass turnaround 5–7 days' },
    });

    const components = buildMassPanelComponents(panelId, shown.map((g) => g.me), { caseUrl: firstLinked?.caseUrl || '' });
    return { content, embeds, components };
}

/**
 * Build button rows: one button per ME (label = ME name) + Cancel fitted
 * into the last row when space allows, then the usual link row
 * ([Case File] + [PHMC Forms], style 5 = link buttons with the link icon).
 * Callers must cap meNames at MASS_PANEL_MAX_ME_BUTTONS_WITH_LINKS so ME
 * rows (≤4 incl. Cancel) + link row never exceed Discord's 5-row limit.
 */
export function buildMassPanelComponents(panelId, meNames, { caseUrl } = {}) {
    const rows = [];
    let current = [];
    for (let i = 0; i < (meNames || []).length; i++) {
        current.push({
            type: 2,
            style: 1,
            label: truncate(String(meNames[i]), 80) || `ME ${i + 1}`,
            custom_id: `${MASS_PANEL_PREFIX}${panelId}_${i}`,
        });
        if (current.length === 5) {
            rows.push({ type: 1, components: current });
            current = [];
        }
    }
    const cancel = { type: 2, style: 2, label: 'Cancel', custom_id: `${MASS_PANEL_PREFIX}${panelId}_${MASS_PANEL_CANCEL_SLOT}` };
    if (current.length > 0 && current.length < 5) {
        current.push(cancel);
        rows.push({ type: 1, components: current });
    } else {
        if (current.length === 5) rows.push({ type: 1, components: current });
        rows.push({ type: 1, components: [cancel] });
    }
    rows.push(buildLinkRow(caseUrl));
    return rows;
}

/**
 * The usual link row: [Case File] (shared case thread) + [PHMC Forms].
 * Style 5 renders with Discord's link icon. Always posted — PHMC Forms has
 * no case dependency; Case File is omitted only when no URL is known.
 */
export function buildLinkRow(caseUrl) {
    const components = [];
    if (cleanStr(caseUrl)) {
        components.push({ type: 2, style: 5, label: 'Case File', url: cleanStr(caseUrl) });
    }
    components.push({ type: 2, style: 5, label: 'PHMC Forms', url: MASS_PANEL_FORMS_URL });
    return { type: 1, components };
}

/**
 * Button rows for the per-ME slice view: Back (return to the main panel) +
 * Cancel, then the usual link row (kept on every view). The main ME rows are
 * restored from the pending entry on Back.
 */
export function buildSliceComponents(panelId, { caseUrl } = {}) {
    return [
        {
            type: 1,
            components: [
                { type: 2, style: 2, label: 'Back', custom_id: `${MASS_PANEL_PREFIX}${panelId}_${MASS_PANEL_BACK_SLOT}` },
                { type: 2, style: 2, label: 'Cancel', custom_id: `${MASS_PANEL_PREFIX}${panelId}_${MASS_PANEL_CANCEL_SLOT}` },
            ],
        },
        buildLinkRow(caseUrl),
    ];
}

/**
 * Build the per-ME body-slice TEXT (shared by the legacy slice embed and the
 * V2 slice modal — one renderer, zero drift). Returns { title, body }.
 */
export function buildMeSliceText(group) {
    const lines = group.bodies.map((b, i) => {
        const who = `**${i + 1}. ${b.name || 'Unknown'}**` + (b.ooc ? ` ((${b.ooc}))` : '');
        const meta = [
            b.sex ? `Sex: ${b.sex}` : '',
            b.deathType ? `Type: ${b.deathType}` : '',
            b.completed ? 'COMPLETED' : 'OUTSTANDING',
        ].filter(Boolean).join(' | ');
        // Date + time split when both are known; combined DOD fallback.
        const when = (b.dateOfDeath || b.timeOfDeath)
            ? [b.dateOfDeath ? `Date: ${b.dateOfDeath}` : '', b.timeOfDeath ? `Time: ${b.timeOfDeath}` : ''].filter(Boolean).join(' | ')
            : (b.dod ? `DOD: ${b.dod}` : '');
        const where = b.location ? `Location: ${b.location}` : '';
        const morgueLine = formatMorgueLine(b.morgue);
        const link = b.caseUrl ? `[View Case](<${b.caseUrl}>)` : (b.caseNumber ? `Case #${b.caseNumber} (link pending)` : 'Case link pending');
        return [who, meta, when, where, morgueLine, link].filter(Boolean).join('\n');
    });
    return {
        title: `Cases for ${group.me} — ${group.bodies.length} ${group.bodies.length === 1 ? 'body' : 'bodies'}`,
        body: lines.join('\n\n') || 'No bodies assigned.',
    };
}

/**
 * Build the per-ME body-slice embed: FULL per-body detail (name, OOC, sex,
 * PK/CK type, date + time of death, location, morgue-record status, case link).
 * Slice fields per body: name, OOC, sex, DOD/location, case link.
 */
export function buildMeSliceEmbed(group) {
    const { title, body } = buildMeSliceText(group);
    return {
        title: truncate(title, 256),
        color: PANEL_COLOR,
        description: truncate(body, 4096),
        footer: { text: 'Use Back to return to the full assignment panel' },
        timestamp: new Date().toISOString(),
    };
}

function disabledRows(rows) {
    return (rows || []).map((row) => ({
        type: 1,
        components: (row.components || []).map((b) => ({ ...b, disabled: true })),
    }));
}

function newPanelId() {
    massPanelCounter += 1;
    return `m${Date.now().toString(36)}${massPanelCounter.toString(36)}`.replace(/[^a-z0-9]/gi, '').slice(0, 20) || `m${massPanelCounter}`;
}

async function lookupDiscordId(db, forumName) {
    if (!db || !forumName) return null;
    try {
        const snap = await db.ref(`autopsy-requests/discord-members/${String(forumName).toLowerCase()}`).once('value');
        return snap.val() || null;
    } catch {
        return null;
    }
}

// ── Posting ──

/**
 * Post the mass-assignment panel via the bot client.
 *
 * @param {object|null} db — Firebase database (for discord-members lookup; null = bold-name fallback for all)
 * @param {object} client — logged-in discord.js Client
 * @param {Array} assignments — raw assignment entries (aliases accepted, see header)
 * @param {object} [opts]
 * @param {string} [opts.channelId] — explicit destination (still gated: the live
 *   #autopsies id requires PHMC_CHANNEL_SEND_ENABLED, dev-test never goes live)
 * @param {string} [opts.requestTopicId] — autopsy-requested/<id> key; when set
 *   (and db present) the panel ref {panelId, channelId, messageId} is persisted
 *   under massPanel so reassign/completion can refresh the message later
 * @param {boolean} [opts.noPing] — suppress all user mentions (bold-name
 *   fallback for every ME + allowedMentions parse:[]). For reposts where the
 *   MEs were already pinged by the original panel.
 * @returns {Promise<{posted: boolean, panelId?: string, channelId?: string, messageId?: string, meCount?: number, bodyCount?: number, reason?: string}>}
 */
export async function postMassAssignmentPanel(db, client, assignments, { channelId, requestTopicId, noPing } = {}) {
    const normalized = (Array.isArray(assignments) ? assignments : []).map(normalizePanelAssignment).filter((a) => a.me);
    if (normalized.length === 0) {
        console.warn('[MASS-PANEL] Nothing to post: no assignments with an ME');
        return { posted: false, reason: 'no-assignments' };
    }
    const allGroups = groupAssignmentsByMe(normalized);
    // Link row reserves the 5th action row: cap ME buttons so ME/Cancel rows
    // (≤4) + link row never exceed Discord's limit. The rest fall into the
    // overflow note via totalMeCount.
    const shownGroups = allGroups.slice(0, MASS_PANEL_MAX_ME_BUTTONS_WITH_LINKS);
    const bodyCount = normalized.length;

    const botClient = client || _discordClient;
    if (!botClient) {
        console.warn('[MASS-PANEL] No client — dropping panel (fail closed)');
        return { posted: false, reason: 'no-client' };
    }

    let target = (channelId || '').trim() || resolveMassPanelChannelId();
    if (!target) {
        console.warn('[MASS-PANEL] No channel resolved — dropping panel (fail closed)');
        return { posted: false, reason: 'no-channel' };
    }

    const liveAutopsiesId = getChannelId('autopsies');
    if (isDevTestActive() && target === liveAutopsiesId) {
        // Maintenance Mode: tests must never touch live #autopsies.
        target = (process.env.MASS_PANEL_CHANNEL_ID || '').trim() || devLogChannelId() || MASS_PANEL_STAGING_CHANNEL_ID;
        console.log(`[MASS-PANEL] DEV TEST redirect: live channel refused, using ${target}`);
    } else if (target === liveAutopsiesId && !channelSendEnabled()) {
        console.warn('[MASS-PANEL] Live channel requested without PHMC_CHANNEL_SEND_ENABLED — dropping panel (fail closed)');
        return { posted: false, reason: 'channel-send-disabled' };
    }

    const discordByMe = new Map();
    for (const g of allGroups) {
        // noPing reposts: skip the mapping lookup entirely so every ME renders
        // as a bold name and no mention is ever constructed.
        discordByMe.set(g.me, noPing ? null : await lookupDiscordId(db, g.me));
    }

    const panelId = newPanelId();
    const { content, embeds, components } = buildMassPanelPayload(panelId, shownGroups, discordByMe, {
        totalMeCount: allGroups.length,
        totalBodyCount: bodyCount,
    });

    try {
        const channel = await botClient.channels.fetch(target);
        if (!channel || typeof channel.send !== 'function') {
            console.warn(`[MASS-PANEL] Channel ${target} is not sendable — dropping panel`);
            return { posted: false, reason: 'channel-not-sendable' };
        }
        const message = await channel.send({
            content,
            embeds,
            components,
            allowedMentions: noPing ? { parse: [] } : { parse: ['users'] },
        });

        // No expiry timer by design: the message stays live until the
        // collection completes (retired), is Cancelled, or is deleted.
        pendingMassPanels.set(panelId, {
            groups: shownGroups,
            content,
            embeds,
            components,
            caseUrl: (shownGroups.flatMap((g) => g.bodies).find((b) => b.caseUrl) || {}).caseUrl || null,
            message,
            channelId: target,
            messageId: message?.id || null,
            timer: null,
            createdAt: Date.now(),
            bodyCount,
        });

        console.log(`[MASS-PANEL] Posted panel ${panelId} to ${target}: ${bodyCount} bodies / ${allGroups.length} MEs`);
        try {
            const auditId = process.env.AUDIT_CHANNEL_ID || null;
            if (auditId) {
                sendToChannel(auditId, `[AUDIT] POST mass-panel | panel ${panelId} | ${bodyCount} bodies / ${allGroups.length} MEs | channel ${target}`).catch(() => {});
            }
        } catch { /* audit must never break sending */ }

        // Persist the panel ref so reassign/completion flows can refresh this
        // exact message later (even after a bot restart — refresh rebuilds the
        // in-memory entry from Firebase + the fetched message). The reverse
        // index lets button presses recover the request after a restart too.
        if (db && requestTopicId && message?.id) {
            try {
                await db.ref(`autopsy-requested/${requestTopicId}/massPanel`).set({
                    panelId, channelId: target, messageId: message.id, updatedAt: Date.now(),
                });
                await db.ref(`massPanelById/${panelId}`).set({
                    requestTopicId, channelId: target, messageId: message.id,
                });
            } catch (e) {
                console.warn(`[MASS-PANEL] Panel ref persist failed: ${e.message}`);
            }
        }

        return { posted: true, panelId, channelId: target, messageId: message?.id || null, meCount: allGroups.length, bodyCount };
    } catch (err) {
        console.warn(`[MASS-PANEL] Send to ${target} failed: ${err.message}`);
        return { posted: false, reason: 'send-failed' };
    }
}

/**
 * Expire a panel manually: remove from the map, disable its rows, and clear its
 * Firebase traces so a later press can't resurrect it. (No timer calls this —
 * panels have no TTL. Kept as a manual utility.)
 * @returns {Promise<boolean>} true when an entry was expired
 */
export async function expireMassPanel(panelId) {
    const pending = pendingMassPanels.get(panelId);
    if (!pending) return false;
    pendingMassPanels.delete(panelId);
    try {
        if (pending.message && typeof pending.message.edit === 'function') {
            await pending.message.edit({ components: disabledRows(pending.components) });
        }
        console.log(`[MASS-PANEL] Panel ${panelId} expired manually (rows disabled)`);
    } catch (err) {
        console.warn(`[MASS-PANEL] Expiry edit failed for ${panelId}: ${err.message}`);
    }
    await cleanupPanelRecords(panelId, pending.requestTopicId || null);
    return true;
}

/**
 * Retire a collection's panel when every body completes: same row-disabling
 * as expiry (no misleading "expired" rewrite of the message), plus Firebase
 * cleanup. Best-effort — never throws. Called from the completion flow.
 * @returns {Promise<boolean>} true when a panel was retired
 */
export async function retireMassPanel(db, client, requestTopicId) {
    try {
        if (!requestTopicId) return false;
        const store = db || await panelDb();
        if (!store) return false;
        const entry = (await store.ref(`autopsy-requested/${requestTopicId}`).once('value')).val() || {};
        const ref = entry.massPanel || null;
        if (!ref || !ref.panelId) return false;
        const botClient = client || _discordClient;
        const pending = pendingMassPanels.get(ref.panelId);
        if (pending) {
            pendingMassPanels.delete(ref.panelId);
            if (pending.timer) clearTimeout(pending.timer);
            try {
                if (pending.message && typeof pending.message.edit === 'function') {
                    await pending.message.edit({ components: disabledRows(pending.components) });
                }
            } catch (err) {
                console.warn(`[MASS-PANEL] Retire edit failed for ${ref.panelId}: ${err.message}`);
            }
        } else if (botClient && ref.channelId && ref.messageId) {
            try {
                const channel = await botClient.channels.fetch(ref.channelId).catch(() => null);
                const message = channel && typeof channel.messages?.fetch === 'function'
                    ? await channel.messages.fetch(ref.messageId).catch(() => null)
                    : null;
                if (message && typeof message.edit === 'function') {
                    const rows = (message.components || []).map((row) => ({
                        type: 1,
                        components: (row.components || []).map((b) => ({ ...b.toJSON(), disabled: true })),
                    }));
                    await message.edit({ components: rows });
                }
            } catch (err) {
                console.warn(`[MASS-PANEL] Retire fetch/edit failed for ${ref.panelId}: ${err.message}`);
            }
        }
        await cleanupPanelRecords(ref.panelId, requestTopicId);
        console.log(`[MASS-PANEL] Retired panel ${ref.panelId} for completed #${requestTopicId}`);
        return true;
    } catch (err) {
        console.warn(`[MASS-PANEL] Retire failed for #${requestTopicId}: ${err.message}`);
        return false;
    }
}

/**
 * Build normalized panel assignments from a Firebase mass-collection entry
 * (cases/<idx> rows + shared parsed fields). Completed bodies STAY listed
 * (uniformity: every ME keeps their button) and carry completed:true so every
 * view renders an explicit COMPLETED / OUTSTANDING tag. Morgue re-matching is
 * best-effort per body; failures hide the line. Shared by post-refresh and
 * repost flows so both render identical data.
 * @param {object|null} db — Firebase database (morgue lookup; null = skip)
 * @param {object} entry — autopsy-requested record
 * @returns {Promise<Array>} normalized assignments (ME-bearing only)
 */
export async function buildPanelAssignmentsFromEntry(db, entry) {
    const cases = (entry && entry.cases) || {};
    const idxs = Object.keys(cases).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
    const shared = (entry && entry.parsed) || {};
    const caseUrl = (entry && entry.caseUrl) || '';
    let morgueByIdx = {};
    try {
        if (!db) throw new Error('no-db');
        const { findMorgueRecord } = await import('./deathRecordDraftCache.js');
        for (const i of idxs) {
            const c = cases[String(i)] || {};
            if (!c.assignedTo) continue;
            try {
                const rec = await findMorgueRecord(db, c.name, c.dateOfDeath, c.oocName);
                if (!rec && c.oocName && String(c.oocName).toLowerCase() !== String(c.name || '').toLowerCase()) {
                    const rec2 = await findMorgueRecord(db, c.oocName, c.dateOfDeath, c.oocName).catch(() => null);
                    if (rec2) {
                        const q2 = rec2.matchQuality || {};
                        morgueByIdx[i] = { found: true, caseId: rec2.caseId || '', name: rec2.name || '', level: q2.level || '', exactName: !!q2.exactName, candidateCount: typeof q2.candidateCount === 'number' ? q2.candidateCount : null };
                        continue;
                    }
                }
                if (rec) {
                    const q = rec.matchQuality || {};
                    morgueByIdx[i] = { found: true, caseId: rec.caseId || '', name: rec.name || '', level: q.level || '', exactName: !!q.exactName, candidateCount: typeof q.candidateCount === 'number' ? q.candidateCount : null };
                } else {
                    morgueByIdx[i] = { found: false };
                }
            } catch {
                morgueByIdx[i] = null;
            }
        }
    } catch {
        morgueByIdx = {};
    }
    return idxs
        .map((i) => {
            const c = cases[String(i)] || {};
            // Completed bodies stay listed (uniformity) with completed:true so
            // every view tags them COMPLETED instead of dropping them.
            return normalizePanelAssignment({
                me: c.assignedTo,
                name: c.name,
                ooc: c.oocName,
                sex: c.sex,
                dateOfDeath: c.dateOfDeath,
                timeOfDeath: c.timeOfDeath,
                deathType: shared.deathType,
                synopsis: shared.synopsis,
                placeOfDeath: c.placeOfDeath,
                morgue: morgueByIdx[i] ?? null,
                caseUrl,
                caseNum: entry.caseNum,
                caseTitle: entry.caseTitle,
                completed: !!c.completedAt,
            });
        })
        .filter((a) => a && a.me);
}

/**
 * Refresh a posted mass panel after a reassignment (or any Firebase-side
 * change): rebuilds the ME grouping from the current cases/<idx> assignedTo
 * values and edits the SAME message (same panelId, so live buttons keep
 * working). Heals post-restart panels too by rebuilding the in-memory entry
 * from the fetched message. Best-effort — never throws.
 *
 * @param {object|null} db — Firebase database (required: source of truth)
 * @param {object|null} client — discord.js Client (falls back to registered)
 * @param {string} requestTopicId — autopsy-requested/<id> key
 * @returns {Promise<{refreshed: boolean, reason?: string}>}
 */
export async function refreshMassPanel(db, client, requestTopicId) {
    try {
        if (!db || !requestTopicId) return { refreshed: false, reason: 'no-db-or-topic' };
        const entry = (await db.ref(`autopsy-requested/${requestTopicId}`).once('value')).val() || {};
        const ref = entry.massPanel || null;
        if (!ref || !ref.panelId || !ref.channelId || !ref.messageId) {
            return { refreshed: false, reason: 'no-panel-ref' };
        }
        const assignments = await buildPanelAssignmentsFromEntry(db, entry);
        if (assignments.length === 0) return { refreshed: false, reason: 'no-assignments' };
        const allGroups = groupAssignmentsByMe(assignments);
        const shownGroups = allGroups.slice(0, MASS_PANEL_MAX_ME_BUTTONS_WITH_LINKS);
        const discordByMe = new Map();
        for (const g of allGroups) discordByMe.set(g.me, await lookupDiscordId(db, g.me));
        const { content, embeds, components } = buildMassPanelPayload(ref.panelId, shownGroups, discordByMe, {
            totalMeCount: allGroups.length,
            totalBodyCount: assignments.length,
        });

        const botClient = client || _discordClient;
        if (!botClient) return { refreshed: false, reason: 'no-client' };
        const channel = await botClient.channels.fetch(ref.channelId).catch(() => null);
        if (!channel || typeof channel.send !== 'function') return { refreshed: false, reason: 'channel-not-sendable' };
        const message = await channel.messages.fetch(ref.messageId).catch(() => null);
        if (!message || typeof message.edit !== 'function') return { refreshed: false, reason: 'message-gone' };
        await message.edit({ content, embeds, components, allowedMentions: { parse: ['users'] } });

        const prev = pendingMassPanels.get(ref.panelId);
        if (prev && prev.timer) clearTimeout(prev.timer);
        pendingMassPanels.set(ref.panelId, {
            groups: shownGroups, content, embeds, components,
            caseUrl: (shownGroups.flatMap((g) => g.bodies).find((b) => b.caseUrl) || {}).caseUrl || null,
            requestTopicId,
            message, channelId: ref.channelId, messageId: ref.messageId,
            timer: null, createdAt: Date.now(), bodyCount: assignments.length,
        });
        try {
            await db.ref(`autopsy-requested/${requestTopicId}/massPanel`).update({ updatedAt: Date.now() });
        } catch { /* recency-marker write best-effort ignored: panel message already edited, marker is cosmetic */ }
        console.log(`[MASS-PANEL] Refreshed panel ${ref.panelId} for #${requestTopicId}: ${assignments.length} bodies / ${allGroups.length} MEs`);
        return { refreshed: true };
    } catch (err) {
        console.warn(`[MASS-PANEL] Refresh failed for #${requestTopicId}: ${err.message}`);
        return { refreshed: false, reason: err.message };
    }
}

/**
 * Re-post a mass panel as a FRESH message (new panelId, fresh 5-min timer).
 * For dead panels (expired, or orphaned by a bot restart): the old message
 * stays as history and the new message carries live buttons. Persists the new
 * ref over the old one so future refreshes target the live message.
 * noPing suppresses all mentions (reposts where MEs were already pinged).
 *
 * @returns {Promise<{posted: boolean, panelId?: string, channelId?: string, messageId?: string, meCount?: number, bodyCount?: number, reason?: string}>}
 */
export async function repostMassPanel(db, client, requestTopicId, { channelId, noPing } = {}) {
    try {
        if (!db || !requestTopicId) return { posted: false, reason: 'no-db-or-topic' };
        const entry = (await db.ref(`autopsy-requested/${requestTopicId}`).once('value')).val() || {};
        if (entry.isMassSingleThread !== true || !entry.cases) {
            return { posted: false, reason: 'not-a-mass-collection' };
        }
        const assignments = await buildPanelAssignmentsFromEntry(db, entry);
        if (assignments.length === 0) return { posted: false, reason: 'no-assignments' };
        return await postMassAssignmentPanel(db, client, assignments, {
            channelId,
            requestTopicId,
            noPing: noPing !== false,
        });
    } catch (err) {
        console.warn(`[MASS-PANEL] Repost failed for #${requestTopicId}: ${err.message}`);
        return { posted: false, reason: err.message };
    }
}

/**
 * Restart healing for button presses on panels unknown to this process: look
 * the panelId up in the Firebase registry, rebuild the grouping from the
 * live request, and re-seat the in-memory entry against the pressed message
 * so the press below just works. Returns true when healed.
 */
async function healPanelFromPress(interaction, panelId) {
    try {
        const db = await panelDb();
        if (!db) return false;
        const reg = (await db.ref(`massPanelById/${panelId}`).once('value')).val() || null;
        if (!reg || !reg.requestTopicId) return false;
        const entry = (await db.ref(`autopsy-requested/${reg.requestTopicId}`).once('value')).val() || {};
        const ref = entry.massPanel || null;
        if (!ref || ref.panelId !== panelId) {
            // Superseded by a repost — don't resurrect the old message.
            return false;
        }
        if (entry.completedAt) {
            // Finished while the bot was away — retire instead of healing.
            await retireMassPanel(db, interaction.client, reg.requestTopicId).catch(() => {});
            return false;
        }
        const assignments = await buildPanelAssignmentsFromEntry(db, entry);
        if (assignments.length === 0) return false;
        const allGroups = groupAssignmentsByMe(assignments);
        const shownGroups = allGroups.slice(0, MASS_PANEL_MAX_ME_BUTTONS_WITH_LINKS);
        const discordByMe = new Map();
        for (const g of allGroups) discordByMe.set(g.me, await lookupDiscordId(db, g.me));
        const built = buildMassPanelPayload(panelId, shownGroups, discordByMe, {
            totalMeCount: allGroups.length,
            totalBodyCount: assignments.length,
        });
        const message = interaction.message || null;
        pendingMassPanels.set(panelId, {
            groups: shownGroups,
            content: built.content,
            embeds: built.embeds,
            components: built.components,
            caseUrl: (shownGroups.flatMap((g) => g.bodies).find((b) => b.caseUrl) || {}).caseUrl || null,
            requestTopicId: reg.requestTopicId,
            message,
            channelId: (ref && ref.channelId) || null,
            messageId: (ref && ref.messageId) || (message && message.id) || null,
            timer: null,
            createdAt: Date.now(),
            bodyCount: assignments.length,
        });
        console.log(`[MASS-PANEL] Healed panel ${panelId} for #${reg.requestTopicId} after restart`);
        return true;
    } catch (err) {
        console.warn(`[MASS-PANEL] Heal failed for ${panelId}: ${err.message}`);
        return false;
    }
}

// ── Button handler (registered from index.js: customId `mass_*`) ──

/**
 * Handle ME / Back / Cancel button presses on a mass-assignment panel.
 * ME press -> interaction.update() showing that ME's body slice (rows stay
 * live until the collection completes or is Cancelled — there is no timeout).
 * A press on a panel unknown to this process (e.g. after a bot restart)
 * rebuilds state from Firebase via the panel registry and then handles the
 * press — only a genuinely gone panel (or finished collection) gets the
 * inactive notice. Returns true when the interaction was consumed.
 */
export async function handleMassPanelButton(interaction) {
    if (!interaction || typeof interaction.isButton !== 'function' || !interaction.isButton()) return false;
    const customId = String(interaction.customId || '');
    if (!customId.startsWith(MASS_PANEL_PREFIX)) return false;

    const rest = customId.slice(MASS_PANEL_PREFIX.length);
    const sep = rest.lastIndexOf('_');
    if (sep === -1) return false;
    const panelId = rest.slice(0, sep);
    const slot = rest.slice(sep + 1);

    let pending = pendingMassPanels.get(panelId);
    if (!pending) {
        // Restart healing: recover the request behind this panelId and rebuild
        // the entry from the pressed message itself, then handle the press.
        const healed = await healPanelFromPress(interaction, panelId).catch(() => null);
        if (healed) {
            pending = pendingMassPanels.get(panelId) || null;
        }
    }
    if (!pending) {
        try {
            await interaction.update({ content: 'This panel is no longer active (expired, cancelled, or its collection is complete). Ask a supervisor for a fresh panel via /repost-mass-panel.', embeds: [], components: [] });
        } catch (err) {
            console.warn(`[MASS-PANEL] Inactive-panel update failed: ${err.message}`);
        }
        return true;
    }

    if (slot === MASS_PANEL_CANCEL_SLOT) {
        pendingMassPanels.delete(panelId);
        if (pending.timer) clearTimeout(pending.timer);
        await cleanupPanelRecords(panelId, pending.requestTopicId || null);
        try {
            await interaction.update({
                content: `${pending.content}\n\nCancelled — no further selections.`,
                embeds: [],
                components: disabledRows(pending.components),
            });
        } catch (err) {
            console.warn(`[MASS-PANEL] Cancel update failed for ${panelId}: ${err.message}`);
        }
        console.log(`[MASS-PANEL] Panel ${panelId} cancelled by ${interaction.user?.tag || 'unknown'}`);
        return true;
    }

    const meIdx = parseInt(slot, 10);
    const group = Number.isInteger(meIdx) ? pending.groups[meIdx] : null;
    if (!group) {
        // Back returns to the main panel view (summary embed + ME rows).
        if (slot === MASS_PANEL_BACK_SLOT) {
            try {
                await interaction.update({
                    content: pending.content,
                    embeds: pending.embeds,
                    components: pending.components,
                });
                console.log(`[MASS-PANEL] Panel ${panelId}: returned to main view`);
            } catch (err) {
                console.warn(`[MASS-PANEL] Back update failed for ${panelId}: ${err.message}`);
            }
            return true;
        }
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Selection not found on this panel.', flags: MessageFlags.Ephemeral });
            }
        } catch (err) {
            console.warn(`[MASS-PANEL] Unknown-slot reply failed for ${panelId}: ${err.message}`);
        }
        return true;
    }

    try {
        await interaction.update({
            content: pending.content,
            embeds: [buildMeSliceEmbed(group)],
            components: buildSliceComponents(panelId, { caseUrl: pending.caseUrl }),
        });
        console.log(`[MASS-PANEL] Panel ${panelId}: showed ${group.bodies.length} bodies for ${group.me}`);
    } catch (err) {
        console.warn(`[MASS-PANEL] Slice update failed for ${panelId}/${group.me}: ${err.message}`);
    }
    return true;
}
