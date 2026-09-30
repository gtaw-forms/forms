/**
 * massPanelV2.js — PROTOTYPE: Mass Autopsy panel rendered with Discord
 * Components V2 (IsComponentsV2 flag). Staging only, behind
 * /test-mass-panel-v2. Does NOT touch the legacy embed panel.
 *
 * Layout (every V2-only feature exercised):
 *   1. Ping line (Text Display — content/embeds are disabled under V2, so
 *      mentions live here and still ping via allowed_mentions).
 *   2. Header Container (cyan accent): title, case link, status rollup, then
 *      the synopsis as plain text (fictional RP content — no spoiler blur).
 *   3. Bodies Container (cyan accent): usage-hint line first (buttons carry
 *      last names only), then one Section per ME (body list beside its own
 *      button accessory, morgue misses carrying an inline dev-contact note).
 *      At or below INLINE_DETAIL_CAP bodies (and never compact) the sections
 *      instead carry the FULL per-body detail with inline markdown Load
 *      links — no per-ME or Autopsy Information buttons at all. Over-budget
 *      inline builds fall back to buttons automatically.
 *   4. Action Row: Autopsy Information — omitted in inline mode (nothing
 *      left to page to) — + Reassign (only when the caller passes
 *      devReassign:true; every press is supervisor-gated and drives the real
 *      performReassign core) + [Case File] / [PHMC Forms] link buttons. No
 *      Cancel (it only disabled rows in place; completion retires, reassigns
 *      rebuild).
 *   5. Footer Text Display (turnaround note).
 *
 * Budgets (V2 is SMALLER than embeds — 4000 text, 40 components, 10
 * top-level): buildMassPanelV2Payload measures both and trims the synopsis
 * continuation first, then body detail, never the header. Metrics are
 * returned for the test command to display.
 *
 * Raw API JSON (no discord.js builders) so the payload is version-proof.
 * Component types: 1 Action Row, 2 Button, 3 String Select, 9 Section,
 * 10 Text Display, 14 Separator, 17 Container.
 *
 * No webhook URLs in source — destinations come from env / channel map only.
 */

import { MessageFlags, ModalBuilder, LabelBuilder, RadioGroupBuilder, TextDisplayBuilder } from 'discord.js';
import { isDevTestActive } from './devRouting.js';
import { getChannelId, channelSendEnabled } from './phmcChannels.js';
import { buildMeSliceEmbed, buildMeSliceText, resolveMassPanelChannelId } from './massAssignmentPanel.js';
import { readChild, writeChild, removeChild } from './vpsState.js';

export const MASS_V2_PREFIX = 'massv2_';
export const MASS_V2_CANCEL_SLOT = 'cancel';
export const MASS_V2_INFO_SLOT = 'info';
export const MASS_V2_REASSIGN_SLOT = 'reassign';
export const MASS_V2_REASSIGN_MODAL_PREFIX = 'massv2_reasmodal_';
export const MASS_V2_STAGING_CHANNEL_ID = '1538008459445010502';
export const MASS_V2_FORMS_URL = 'https://gtaw-forms.github.io/forms/';

const ACCENT_CYAN = 0x00bcd4;
const ACCENT_GREEN = 0x2ecc71;
// (No red accent: morgue misses render inline under the body, not as a
// separate warning container.)

// Bot-developer contact for per-body morgue misses (same BOT_OWNER_ID +
// fallback convention as infoPanel.js / systemMonitor.js). Renders as a
// mention so staff can tap through to the dev.
const BOT_DEV_MENTION = process.env.BOT_OWNER_ID
    ? `<@${process.env.BOT_OWNER_ID}>`
    : '<@228306972204597248>';
const MISSING_MORGUE_NOTE = `> Unable to find an existing Morgue Case — add it with /morgue-add, or contact ${BOT_DEV_MENTION}`;

// V2 budgets: 4000 text chars across Text Displays, 40 total components,
// 10 top-level. Sections only make sense up to this many MEs before the
// layout falls back to a plain button grid (same as the legacy panel).
export const V2_TEXT_BUDGET = 4000;
export const V2_COMPONENT_BUDGET = 40;
const V2_SECTION_ME_CAP = 8;
// Inline full detail at or below this many bodies (staff call): every
// section carries the complete per-body detail with tappable markdown Load
// links, so the per-ME + Autopsy Information buttons drop away. Above it
// (or compact, or forced) the terse + buttons layout renders instead —
// full detail inline scales linearly and would blow the 4000-char budget on
// real incidents (12 bodies ≈ 2650 chars before header/ping/synopsis).
export const INLINE_DETAIL_CAP = 6;

let v2Counter = 0;
/** Map<panelId, {groups, components, caseUrl, createdAt}> — live panels also persist Firebase refs (see post). */
export const pendingMassV2Panels = new Map();

// ── Bot client registration (mirrors the legacy mass-panel pattern) ──
// Forum-side callers hold no discord.js client; post/refresh/retire fall
// back to the registered client when their per-call arg is null.
let _v2discordClient = null;
export function setMassPanelV2Client(client) {
    _v2discordClient = client || null;
}

/**
 * Shared final build for post/refresh/rebuild/heal: totals + completion
 * derived from the live grouping so every render agrees.
 */
function buildLiveMassV2(panelId, allGroups, discordByMe, { devReassign, compact } = {}) {
    const flat = allGroups.flatMap((g) => g.bodies || []);
    return buildMassPanelV2Payload(panelId, allGroups, discordByMe, {
        totalMeCount: allGroups.length,
        totalBodyCount: flat.length,
        allDone: flat.length > 0 && flat.every((b) => b && b.completed),
        devReassign: devReassign === true,
        compact: compact === true,
    });
}

/** Remove the Firebase traces of a dead V2 panel (registry + entry ref). */
async function cleanupMassV2Records(panelId, basePath, topicIdHint) {
    try {
        const db = await v2Db();
        if (!db) return;
        removeChild('massPanelV2ById', panelId);
        if (topicIdHint) {
            const cur = (await db.ref(`${basePath || 'autopsy-requested'}/${topicIdHint}/massPanelV2`).once('value')).val() || null;
            if (cur && cur.panelId === panelId) {
                await db.ref(`${basePath || 'autopsy-requested'}/${topicIdHint}/massPanelV2`).remove().catch(() => {});
            }
        }
    } catch { /* cleanup must never break the flow */ }
}

function truncate(s, n) {
    const str = String(s ?? '');
    if (str.length <= n) return str;
    return str.slice(0, Math.max(0, n - 3)) + '...';
}

function truncateWords(s, n) {
    const str = String(s ?? '');
    if (str.length <= n) return { head: str, rest: '' };
    let cut = str.lastIndexOf(' ', n - 1);
    if (cut < n * 0.5) cut = n - 1;
    return { head: str.slice(0, cut).trimEnd() + '…', rest: str.slice(cut).trimStart() };
}

const td = (content) => ({ type: 10, content: String(content ?? '') });
const sep = (divider = true) => ({ type: 14, divider, spacing: 1 });

function mentionFor(me, discordByMe, noPing) {
    if (noPing) return `**${me}**`;
    const id = discordByMe ? discordByMe.get(me) : null;
    return id ? `<@${id}>` : `**${me}**`;
}

function morgueTag(morgue) {
    if (!morgue || typeof morgue !== 'object') return '';
    if (morgue.found) return morgue.exactName ? 'morgue: exact' : 'morgue: possible';
    return 'morgue: none';
}

/**
 * Compact per-ME button label: full forum names ("Arthur Blackwood") crowd
 * the button row, so buttons read `Case Info - <Last>` ("Case Info -
 * Blackwood"). The adjacent Section text (or compact list) carries the full
 * name, and customIds stay index-based so duplicate last names can never
 * misroute a press.
 */
export function meButtonLabel(me) {
    const parts = String(me || '').trim().split(/\s+/).filter(Boolean);
    const last = parts.length > 1 ? parts[parts.length - 1] : (parts[0] || 'ME');
    return truncate(`Case Info - ${last}`, 80);
}

/**
 * Attach per-body wait-window countdowns (live-linked panels only).
 * Reads the rotation tracker once (`autopsy-requests/assignments`, keyed by
 * request topic per ME) and stamps each body with `deadlineUnix =
 * assignedAt + CK 72h / PK 120h / default 48h` (same windows + helper as the
 * single-panel resolve). Unresolvable bodies simply get no countdown.
 */
async function attachDeadlineUnix(db, requestTopicId, assignments) {
    if (!db || !requestTopicId) return assignments;
    try {
        const { limitHoursFor } = await import('./outstandingAutopsies.js');
        const asnap = await db.ref('autopsy-requests/assignments').once('value').catch(() => null);
        const adata = (asnap && asnap.val()) || {};
        const byMe = new Map();
        for (const [k, v] of Object.entries(adata)) byMe.set(String(k).toLowerCase(), v);
        const topicKey = String(requestTopicId);
        let stamped = 0;
        const out = (assignments || []).map((b) => {
            if (!b || typeof b.deadlineUnix === 'number') return b;
            const rec = byMe.get(String(b.me || '').toLowerCase());
            const rows = (rec && rec.cases) || {};
            const a = rows[topicKey] ? rows[topicKey].assignedAt : null;
            if (!a) return b;
            const baseMs = new Date(a).getTime();
            if (!Number.isFinite(baseMs)) return b;
            stamped += 1;
            return { ...b, deadlineUnix: Math.floor(baseMs / 1000) + limitHoursFor(b.deathType) * 3600 };
        });
        if (stamped > 0) console.log(`[MASS-V2] Attached ${stamped} countdown(s) for #${requestTopicId}`);
        return out;
    } catch {
        return assignments;
    }
}

/**
 * Attach per-body Load Case deep links (live-linked panels only — fixtures
 * resolve against the live node on web, so dev panels skip). One entry read,
 * OOC-then-name match; unresolvable bodies simply get no link.
 */
async function attachLoadUrls(db, requestTopicId, assignments) {
    if (!db || !requestTopicId) return assignments;
    try {
        const entry = (await db.ref(`autopsy-requested/${requestTopicId}`).once('value')).val() || {};
        const caseRows = (entry && entry.cases) || {};
        const findIdx = (b) => {
            const oocL = String(b.ooc || '').trim().toLowerCase();
            const nameL = String(b.name || '').trim().toLowerCase();
            for (const [idx, c] of Object.entries(caseRows)) {
                if (!c || !/^\d+$/.test(idx)) continue;
                if (oocL && String(c.oocName || '').trim().toLowerCase() === oocL) return idx;
            }
            if (nameL) {
                for (const [idx, c] of Object.entries(caseRows)) {
                    if (!c || !/^\d+$/.test(idx)) continue;
                    if (String(c.name || '').trim().toLowerCase() === nameL) return idx;
                }
            }
            return null;
        };
        return (assignments || []).map((b) => {
            const idx = findIdx(b);
            return idx === null ? b : { ...b, loadUrl: `${MASS_V2_FORMS_URL}#/load/${requestTopicId}/${idx}` };
        });
    } catch {
        return assignments;
    }
}

// ── Budget measurement (pure) ──

/** Recursively count every component incl. nested children + accessories. */
export function countV2Components(components) {
    let n = 0;
    const walk = (c) => {
        if (!c || typeof c !== 'object') return;
        n += 1;
        if (Array.isArray(c.components)) c.components.forEach(walk);
        if (c.accessory) walk(c.accessory);
        if (Array.isArray(c.options)) n += 0; // options are not components
    };
    (components || []).forEach(walk);
    return n;
}

/** Sum of all Text Display contents (the documented 4000-char budget). */
export function measureV2Text(components) {
    let n = 0;
    const walk = (c) => {
        if (!c || typeof c !== 'object') return;
        if (c.type === 10) n += String(c.content || '').length;
        if (Array.isArray(c.components)) c.components.forEach(walk);
        if (c.accessory) walk(c.accessory);
    };
    (components || []).forEach(walk);
    return n;
}

// ── Payload builder (pure) ──

/**
 * Build a Components-V2 mass panel payload.
 * @param {string} panelId — alphanumeric id (no underscores)
 * @param {Array} groups — groupAssignmentsByMe() output (normalized)
 * @param {Map} discordByMe — forum name -> discord user id (or null)
 * @param {object} [opts] — { noPing?, totalMeCount?, totalBodyCount?, allDone?, devReassign?, compact? }
 *   devReassign adds the supervisor-only Reassign button to the bottom row
 *   (dev / staging prototyping; live callers omit it). compact swaps per-ME
 *   Sections for one terse list + a 5-per-row button grid (same customIds).
 *   _forceButtons is internal (over-budget inline fallback, never pass it).
 * @returns {{flags: number, components: Array, metrics: object}}
 */
export function buildMassPanelV2Payload(panelId, groups, discordByMe, { noPing, totalMeCount, totalBodyCount, allDone, devReassign, compact, _forceButtons } = {}) {
    const shown = groups || [];
    const bodyCount = totalBodyCount ?? shown.reduce((n, g) => n + g.bodies.length, 0);
    const meCount = totalMeCount ?? shown.length;
    const overflow = Math.max(0, meCount - shown.length);
    const useCompact = compact === true;
    // Inline mode: small panels carry full per-body detail in the sections
    // (markdown Load links included) and drop the detail buttons entirely.
    // Anything bigger falls back to terse + buttons (see the measure at the
    // end — over-budget inline rebuilds as buttons automatically).
    const inlineMode = !useCompact && !_forceButtons && bodyCount <= INLINE_DETAIL_CAP;

    const accent = allDone ? ACCENT_GREEN : ACCENT_CYAN;
    const stateWord = allDone ? 'Complete' : 'Assigned';

    // Shared case data (single-thread mass = one case topic).
    const allBodies = shown.flatMap((g) => g.bodies || []);
    const doneCount = allBodies.filter((b) => b && b.completed).length;
    const openCount = allBodies.length - doneCount;
    const firstLinked = allBodies.find((b) => b.caseUrl);
    const caseRef = firstLinked ? `[View case thread](<${firstLinked.caseUrl}>)` : '';
    const caseNum = (firstLinked && firstLinked.caseNumber) ? ` — Case #${firstLinked.caseNumber}` : '';

    // Per-ME body lines (Section text). Completed bodies stay listed with
    // the whole line struck through + bold COMPLETED outside it (no Load
    // link, no countdown — nothing left to load or wait out).
    // Each section also resolves its accessory: an ME with exactly ONE
    // outstanding loadable body gets a Load Case link button beside their
    // name (no trip to the bottom rows); everyone else keeps the slice
    // button (multi-body needs the picker, done bodies need info only).
    const sectionBodies = shown.slice(0, V2_SECTION_ME_CAP).map((g) => {
        const lines = (g.bodies || []).map((b, i) => {
            const whoPlain = `**${b.name || 'Unknown'}**` + (b.ooc ? ` ((${b.ooc}))` : '');
            const tagsOpen = [b.deathType || '', morgueTag(b.morgue), ...(!b.completed ? ['OUTSTANDING'] : [])].filter(Boolean).join(' · ');
            // Outstanding only: Load links and countdown chips never dangle
            // off a finished body (nothing left to load or wait out).
            const load = (!b.completed && b.loadUrl) ? ` · [Load Case](<${b.loadUrl}>)` : '';
            // Live countdown chip (relative-only keeps dense lines tight; the
            // absolute time lives on the case thread + single-panel views).
            const dl = (!b.completed && typeof b.deadlineUnix === 'number' ? ` · ⏰ <t:${b.deadlineUnix}:R>` : '');
            // Definitive morgue misses carry the contact note on a new line
            // under the body (no separate warning container — staff asked for
            // it next to the body instead). Unavailable lookups stay silent.
            const missingNote = (b.morgue && b.morgue.found === false) ? `\n${MISSING_MORGUE_NOTE}` : '';
            // Completed: the whole line strikes through, state reads as bold
            // COMPLETED outside it (staff call — no dangling actions/timers).
            if (b.completed) {
                const head = `${i + 1}. ~~${whoPlain}${tagsOpen ? ` — ${tagsOpen}` : ''}~~ · **COMPLETED**`;
                if (!inlineMode) return `${head}${missingNote}`;
                const detC = [
                    b.sex ? `Sex: ${b.sex}` : '',
                    (b.dateOfDeath || b.timeOfDeath)
                        ? `DOD: ${[b.dateOfDeath, b.timeOfDeath].filter(Boolean).join(' ')}`
                        : (b.dod ? `DOD: ${b.dod}` : ''),
                    b.location ? `Loc: ${b.location}` : '',
                    morgueTag(b.morgue) ? `Morgue: ${morgueTag(b.morgue).replace(/^morgue: /, '')}` : '',
                ].filter(Boolean).join(' | ');
                return `${head}` + (detC ? `\n~~${detC}~~` : '') + missingNote;
            }
            if (!inlineMode) return `${i + 1}. ${whoPlain}${tagsOpen ? ` — ${tagsOpen}` : ''}${load}${dl}${missingNote}`;
            // Inline mode: the complete per-body detail lives in the section
            // itself (same fields as the ephemeral slice). Navigation rides
            // inline too — Load when resolvable, else the case thread.
            const nav = b.loadUrl ? ` · [Load Case](<${b.loadUrl}>)` : (b.caseUrl ? ` · [View Case](<${b.caseUrl}>)` : '');
            const det = [
                b.sex ? `Sex: ${b.sex}` : '',
                (b.dateOfDeath || b.timeOfDeath)
                    ? `DOD: ${[b.dateOfDeath, b.timeOfDeath].filter(Boolean).join(' ')}`
                    : (b.dod ? `DOD: ${b.dod}` : ''),
                b.location ? `Loc: ${b.location}` : '',
                morgueTag(b.morgue) ? `Morgue: ${morgueTag(b.morgue).replace(/^morgue: /, '')}` : '',
            ].filter(Boolean).join(' | ');
            return `${i + 1}. ${whoPlain}${tagsOpen ? ` — ${tagsOpen}` : ''}${nav}${dl}` +
                (det ? `\n${det}` : '') + missingNote;
        });
        const loadable = (g.bodies || []).filter((b) => b && !b.completed && b.loadUrl);
        return {
            me: g.me,
            text: `## ${g.me} — ${g.bodies.length} ${g.bodies.length === 1 ? 'body' : 'bodies'}\n${lines.join('\n') || 'No bodies'}`,
            load: loadable.length === 1 ? { url: loadable[0].loadUrl } : null,
        };
    });
    const gridGroups = shown.slice(V2_SECTION_ME_CAP); // overflow MEs -> plain grid
    // Compact layout: no per-ME Sections — one terse list for all MEs plus a
    // 5-per-row button grid (same customIds, so all handlers work unchanged).
    // (useCompact is computed at the top, next to inlineMode.)
    const compactLines = shown.map((g) => {
        const bl = (g.bodies || []).map((b) => {
            const whoPlain = `**${b.name || 'Unknown'}**` + (b.ooc ? ` ((${b.ooc}))` : '');
            const tagsOpen = [b.deathType || '', morgueTag(b.morgue), ...(!b.completed ? ['OUTSTANDING'] : [])].filter(Boolean).join(' · ');
            const load = (!b.completed && b.loadUrl) ? ` · [Load Case](<${b.loadUrl}>)` : '';
            const dl = (!b.completed && typeof b.deadlineUnix === 'number' ? ` · ⏰ <t:${b.deadlineUnix}:R>` : '');
            const missingNote = (b.morgue && b.morgue.found === false) ? `\n${MISSING_MORGUE_NOTE}` : '';
            if (b.completed) {
                return `• ~~${whoPlain}${tagsOpen ? ` — ${tagsOpen}` : ''}~~ · **COMPLETED**${missingNote}`;
            }
            return `• ${whoPlain}${tagsOpen ? ` — ${tagsOpen}` : ''}${load}${dl}${missingNote}`;
        });
        return `**${g.me}** — ${g.bodies.length} ${g.bodies.length === 1 ? 'body' : 'bodies'}:\n${bl.join('\n') || 'No bodies'}`;
    });
    const compactText = `## Assigned Bodies\n${compactLines.join('\n')}`;

    // Synopsis: rendered as ONE block, ellipsized at a word boundary ONLY
    // when it truly exceeds the remaining budget (a mid-text ellipsis with
    // more text after it reads as a cut-off glitch).
    const rawSynopsis = allBodies.map((b) => b.synopsis).find((s) => s) || '';

    const headerText =
        `# Mass Autopsy ${stateWord} — ${bodyCount} ${bodyCount === 1 ? 'body' : 'bodies'} / ${meCount} ${meCount === 1 ? 'ME' : 'MEs'}${caseNum}\n` +
        `${caseRef ? `${caseRef}\n` : ''}` +
        `**Status:** ${openCount} outstanding · ${doneCount} completed.`;
    const footerText = 'PHMC Dept. of Forensic Medicine — mass turnaround 5–7 days. Full detail (dates, times, locations) on your button.';
    // Usage hint (top of panel — buttons carry last names only, so the full
    // ME name can't fit on them; this line explains the pattern instead).
    // Inline mode has no detail buttons, so the hint describes the inline
    // list + Load links instead.
    const usageText = inlineMode
        ? '**How to use this panel:** your assigned autopsies are listed below with full detail — open a case with its Load link. A Supervisor can re-assign your cases for conflict of interest, unavailability, or IRL.'
        : '**How to use this panel:** click the **Case Info** button ' +
            (useCompact ? 'in the grid below to find your name and' : 'beside your name to') +
            ' view your assigned autopsies. A Supervisor can re-assign your cases for conflict of interest, unavailability, or IRL.';

    // Fixed (non-synopsis) text cost, measured from the real strings so the
    // allowance tracks the actual payload instead of a guess.
    const fixedText =
        headerText.length + footerText.length + usageText.length +
        (useCompact
            ? compactText.length
            : sectionBodies.reduce((n, s) => n + s.text.length, 0) +
                gridGroups.reduce((n, g) => n + g.me.length + 32, 0)) +
        400; // ping line + labels + select placeholder/options headroom
    // (Morgue-miss notes live inside the section text above, so they are
    // already measured — no separate allowance needed.)

    let synText = rawSynopsis || '';
    let synCut = false;
    const allowance = V2_TEXT_BUDGET - fixedText - 200; // safety margin
    if (synText && synText.length > allowance) {
        // Pathological or long: cut at a word boundary, ellipsis ONLY at the
        // true end (never mid-text with more following).
        synText = truncateWords(synText, Math.max(100, allowance)).head;
        synCut = true;
    }
    // Merged into the header container below as plain text — fictional RP
    // content, so no spoiler blur (per staff feedback).
    const synopsisInline = synText
        ? `**Synopsis**\n${synText}` +
            (synCut ? `\n*(continued on the case thread)*` : '')
        : '';

    const pings = shown.map((g) => mentionFor(g.me, discordByMe, noPing)).join(' ');
    let pingLine = `${pings} — you have been assigned a **mass autopsy** (${bodyCount} ${bodyCount === 1 ? 'body' : 'bodies'} across ${meCount} ${meCount === 1 ? 'ME' : 'MEs'}). ${inlineMode ? 'Full detail for every case is listed below.' : (useCompact ? 'Find your Case Info button in the grid below.' : 'Your cases sit beside your Case Info button below.')}`;
    if (overflow > 0) pingLine += ` (+${overflow} more ${overflow === 1 ? 'ME' : 'MEs'} in the overflow list, no section: layout limit)`;

    const components = [
        { type: 10, content: truncate(pingLine, 3500) },
    ];

    components.push({
        type: 17,
        accent_color: accent,
        components: rawSynopsis
            ? [td(headerText), sep(), td(truncate(synopsisInline, 3500))]
            : [td(headerText)],
    });

    // Bodies container: usage hint first (it describes the buttons below, so
    // it lives in the same box), then per-ME Sections (text + button
    // accessory), overflow MEs as plain text + grid rows. Compact: one terse
    // list, buttons move to the grid rows below. Morgue misses carry their
    // contact note inline under the body — no separate warning container.
    // (The supervisor Reassign button lives in the bottom row, not here.)
    const bodiesChildren = [td(truncate(usageText, 3500)), sep()];
    if (useCompact) {
        bodiesChildren.push(td(truncate(compactText, 3500)));
    } else {
        sectionBodies.forEach((s, i) => {
            if (i > 0) bodiesChildren.push(sep(false));
            // Inline mode: full detail already in the text — plain Text
            // Display, no Section accessory, no per-ME buttons at all.
            // (Sections require an accessory; nothing meaningful is left to
            // hang beside a complete listing.)
            if (inlineMode) {
                bodiesChildren.push(td(truncate(s.text, 3500)));
                return;
            }
            bodiesChildren.push({
                type: 9,
                components: [td(truncate(s.text, 3500))],
                accessory: s.load
                    ? { type: 2, style: 5, label: 'Load Case', url: s.load.url }
                    : {
                        type: 2,
                        style: 1,
                        label: meButtonLabel(s.me),
                        custom_id: `${MASS_V2_PREFIX}${panelId}_${i}`,
                    },
            });
        });
        if (gridGroups.length > 0) {
            bodiesChildren.push(sep());
            bodiesChildren.push(td(
                `**More MEs (no section — layout limit):**\n` +
                gridGroups.map((g) => `- **${g.me}** — ${g.bodies.length} ${g.bodies.length === 1 ? 'body' : 'bodies'}`).join('\n')
            ));
        }
    }
    // NOTE: no separate reassign row here — the supervisor Reassign button
    // lives in the bottom row (see below), same customId and modal flow.
    components.push({
        type: 17,
        accent_color: accent,
        // Footer lives INSIDE the box (a trailing top-level Text Display
        // renders outside all containers).
        components: [...bodiesChildren, sep(false), td(footerText)],
    });

    // Grid rows for overflow MEs (same customIds as sections would use).
    // Compact layout grids ALL MEs (indices align with groups order, so the
    // ME-button handler resolves them identically), each paired with a Load
    // buddy button when they hold exactly one loadable body.
    const gridRows = [];
    const gridSource = useCompact ? shown.map((g, j) => ({ g, k: j, base: 0 })) : gridGroups.map((g, k) => ({ g, k, base: V2_SECTION_ME_CAP }));
    let buddyLoads = 0;
    if (gridSource.length > 0) {
        const flat = [];
        gridSource.forEach(({ g, k, base }) => {
            flat.push({
                type: 2, style: 1,
                label: meButtonLabel(g.me),
                custom_id: `${MASS_V2_PREFIX}${panelId}_${base + k}`,
            });
            if (useCompact) {
                const loadable = (g.bodies || []).filter((b) => b && !b.completed && b.loadUrl);
                if (loadable.length === 1) {
                    flat.push({ type: 2, style: 5, label: 'Load Case', url: loadable[0].loadUrl });
                    buddyLoads += 1;
                }
            }
        });
        for (let i = 0; i < flat.length; i += 5) {
            gridRows.push({ type: 1, components: flat.slice(i, i + 5) });
        }
    }

    const linkButtons = [];
    if (firstLinked) linkButtons.push({ type: 2, style: 5, label: 'Case File', url: firstLinked.caseUrl });
    linkButtons.push({ type: 2, style: 5, label: 'PHMC Forms', url: MASS_V2_FORMS_URL });
    // ME grid rows sit above Cancel/links (compact) — overflow sections mode
    // has no grid rows, so order is unchanged there.
    components.push(...gridRows);
    // Bottom row (staff-approved order): Autopsy Information opens the
    // all-bodies-at-once detail view (next-page pattern — one tap instead of
    // per-ME granular buttons); Reassign rides here too whenever the caller
    // passes devReassign (same customId and supervisor-gated modal flow as
    // before — only its home moved); Case File / PHMC Forms link out. No
    // Cancel button: it only disabled the rows in place (no visible job),
    // while completion retires panels and reassigns rebuild them — the slot
    // handler stays for already-posted panels.
    components.push({
        type: 1,
        components: [
            // Inline mode lists everything already — no Autopsy Information
            // button (nothing left to page to). Reassign + links stay.
            ...(inlineMode ? [] : [{ type: 2, style: 1, label: 'Autopsy Information', custom_id: `${MASS_V2_PREFIX}${panelId}_${MASS_V2_INFO_SLOT}` }]),
            ...(devReassign ? [{ type: 2, style: 1, label: 'Reassign', custom_id: `${MASS_V2_PREFIX}${panelId}_${MASS_V2_REASSIGN_SLOT}` }] : []),
            ...linkButtons,
        ],
    });

    const metrics = {
        textChars: measureV2Text(components),
        textBudget: V2_TEXT_BUDGET,
        componentCount: countV2Components(components),
        componentBudget: V2_COMPONENT_BUDGET,
        topLevel: components.length,
        synopsisTrimmed: !!synCut,
        layout: useCompact ? 'compact' : 'sections',
        detailMode: inlineMode ? 'inline' : 'buttons',
        inlineFallback: false,
        loadButtons: (useCompact ? buddyLoads : sectionBodies.filter((s) => s.load).length),
        sectionedMEs: sectionBodies.length,
        gridMEs: useCompact ? shown.length : gridGroups.length,
    };
    // Inline-when-it-fits, buttons-when-it-doesn't: an inline build that
    // still breaks a budget (big synopsis + max bodies) rebuilds as the
    // terse + buttons layout rather than failing the post.
    if (inlineMode && (metrics.textChars > V2_TEXT_BUDGET || metrics.componentCount > V2_COMPONENT_BUDGET || metrics.topLevel > 10)) {
        console.log(`[MASS-V2] Inline detail over budget for ${panelId} (text ${metrics.textChars}, comps ${metrics.componentCount}) — falling back to buttons`);
        const fb = buildMassPanelV2Payload(panelId, groups, discordByMe, { noPing, totalMeCount, totalBodyCount, allDone, devReassign, compact, _forceButtons: true });
        fb.metrics.inlineFallback = true;
        return fb;
    }
    return { flags: MessageFlags.IsComponentsV2, components, metrics };
}

// ── Posting (staging-gated, mirrors postMassAssignmentPanel routing) ──

function newV2PanelId() {
    v2Counter += 1;
    return `v${Date.now().toString(36)}${v2Counter.toString(36)}`.replace(/[^a-z0-9]/gi, '').slice(0, 20) || `v${v2Counter}`;
}

async function lookupDiscordId(db, forumName) {
    if (!db || !forumName) return null;
    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const fdb = db || firebase.db;
        if (!fdb) return null;
        const snap = await fdb.ref(`autopsy-requests/discord-members/${String(forumName).toLowerCase()}`).once('value');
        return snap.val() || null;
    } catch {
        return null;
    }
}

/**
 * Post the V2 mass panel. Channel routing mirrors the legacy panel
 * (resolveMassPanelChannelId: dev-test redirects, live #autopsies only with
 * PHMC_CHANNEL_SEND_ENABLED). Linked panels persist Firebase refs
 * (`<base>/<topic>/massPanelV2` + `massPanelV2ById/<panel>`) so refresh /
 * retire / restart-heal find this exact message later.
 * @param {object} [opts] — { channelId?, noPing?, devReassign?, compact?, requestTopicId?, devMode? }
 *   devReassign adds the supervisor-only Reassign button to the bottom row
 *   (live callers pass true; showcase visualization copies omit it).
 *   compact renders the dense list + button-grid layout. requestTopicId
 *   links the panel to a mass collection so reassign executes for real.
 *   devMode marks a fixture-backed panel: Firebase reads/writes go to the
 *   isolated dev node and execution runs dry (no forum/Discord/rotation).
 */
export async function postMassPanelV2(db, client, assignments, { channelId, noPing, devReassign, compact, requestTopicId, devMode } = {}) {
    const { normalizePanelAssignment, groupAssignmentsByMe } = await import('./massAssignmentPanel.js');
    const normalized = (Array.isArray(assignments) ? assignments : []).map(normalizePanelAssignment).filter((a) => a.me);
    if (normalized.length === 0) {
        return { posted: false, reason: 'no-assignments' };
    }
    // Live-linked (non-dev) panels resolve per-body Load links up front so
    // every body line carries one next to the name.
    const linkedForLoad = !!requestTopicId && devMode !== true;
    const withLinks = linkedForLoad ? await attachLoadUrls(db, requestTopicId, normalized) : normalized;
    // Same gating for wait-window countdowns (rotation assignedAt + per-body
    // death-type window, mirroring the single-panel resolve).
    const withTime = linkedForLoad ? await attachDeadlineUnix(db, requestTopicId, withLinks) : withLinks;
    const allGroups = groupAssignmentsByMe(withTime);

    const botClient = client || _v2discordClient;
    if (!botClient) {
        console.warn('[MASS-V2] No client — dropping panel (fail closed)');
        return { posted: false, reason: 'no-client' };
    }
    let target = (channelId || '').trim() || resolveMassPanelChannelId();
    if (!target) {
        console.warn('[MASS-V2] No channel resolved — dropping panel (fail closed)');
        return { posted: false, reason: 'no-channel' };
    }
    const liveAutopsiesId = getChannelId('autopsies');
    if (isDevTestActive() && target === liveAutopsiesId) {
        target = MASS_V2_STAGING_CHANNEL_ID;
        console.log('[MASS-V2] DEV TEST redirect: live channel refused, using staging');
    } else if (target === liveAutopsiesId && !channelSendEnabled()) {
        console.warn('[MASS-V2] Live channel requested without PHMC_CHANNEL_SEND_ENABLED — dropping panel (fail closed)');
        return { posted: false, reason: 'channel-send-disabled' };
    }

    const discordByMe = new Map();
    for (const g of allGroups) {
        discordByMe.set(g.me, noPing ? null : await lookupDiscordId(db, g.me));
    }

    const panelId = newV2PanelId();
    const { flags, components, metrics } = buildLiveMassV2(panelId, allGroups, discordByMe, {
        devReassign: devReassign === true,
        compact: compact === true,
    });
    if (metrics.textChars > V2_TEXT_BUDGET || metrics.componentCount > V2_COMPONENT_BUDGET || metrics.topLevel > 10) {
        console.warn(`[MASS-V2] Panel ${panelId} exceeds V2 budgets (text ${metrics.textChars}/${V2_TEXT_BUDGET}, comps ${metrics.componentCount}/${V2_COMPONENT_BUDGET}, top ${metrics.topLevel}/10) — dropping (fail closed)`);
        return { posted: false, reason: 'over-budget', metrics };
    }

    try {
        const channel = await botClient.channels.fetch(target);
        if (!channel || typeof channel.send !== 'function') {
            return { posted: false, reason: 'channel-not-sendable' };
        }
        const message = await channel.send({
            components,
            flags,
            allowedMentions: noPing ? { parse: [] } : { parse: ['users'] },
        });
        const basePath = devMode === true ? 'dev-autopsy-requested' : 'autopsy-requested';
        pendingMassV2Panels.set(panelId, {
            groups: allGroups, components,
            devReassign: devReassign === true,
            compact: compact === true,
            devMode: devMode === true,
            basePath,
            requestTopicId: requestTopicId || null,
            channelId: target,
            caseUrl: (allGroups.flatMap((g) => g.bodies).find((b) => b.caseUrl) || {}).caseUrl || null,
            messageId: message?.id || null, createdAt: Date.now(), bodyCount: normalized.length,
        });
        // Persist the panel ref so refresh / retire / restart-heal find this
        // exact message later (even after a bot restart). The reverse index
        // lets button presses recover the request too.
        if (db && requestTopicId && message?.id) {
            try {
                const refPayload = {
                    panelId, channelId: target, messageId: message.id,
                    devReassign: devReassign === true, compact: compact === true,
                    updatedAt: Date.now(),
                };
                await db.ref(`${basePath}/${requestTopicId}/massPanelV2`).set(refPayload);
                writeChild('massPanelV2ById', panelId, {
                    requestTopicId, basePath, channelId: target, messageId: message.id,
                    devReassign: devReassign === true, compact: compact === true,
                });
            } catch (e) {
                console.warn(`[MASS-V2] Panel ref persist failed for ${panelId}: ${e.message}`);
            }
        }
        console.log(`[MASS-V2] Posted panel ${panelId} to ${target}: ${normalized.length} bodies / ${allGroups.length} MEs (text ${metrics.textChars}, comps ${metrics.componentCount})`);
        try {
            const auditId = process.env.AUDIT_CHANNEL_ID || null;
            if (auditId) {
                const { sendToChannel } = await import('./logChannel.js');
                sendToChannel(auditId, `[AUDIT] POST mass-panel-v2 | panel ${panelId} | ${normalized.length} bodies / ${allGroups.length} MEs | channel ${target}`).catch(() => {});
            }
        } catch { /* audit must never break sending */ }
        return { posted: true, panelId, channelId: target, messageId: message?.id || null, meCount: allGroups.length, bodyCount: normalized.length, metrics };
    } catch (err) {
        console.warn(`[MASS-V2] Send to ${target} failed: ${err.message}`);
        return { posted: false, reason: 'send-failed', metrics };
    }
}

// ── Full-detail "next page" (pure) ──

/**
 * Build the all-bodies-at-once detail view for the Autopsy Information
 * button: every ME section with FULL per-body detail (dates, times,
 * locations, morgue status, case/load links) in one ephemeral reply —
 * no per-ME granular stepping. Trims trailing ME sections first when over
 * budget, never the header. Returns raw V2 JSON (caller adds Ephemeral).
 */
export function buildMassFullDetailPayload(pending) {
    const groups = (pending && pending.groups) || [];
    const allBodies = groups.flatMap((g) => g.bodies || []);
    const firstLinked = allBodies.find((b) => b.caseUrl);
    const caseRef = firstLinked ? `[View case thread](<${firstLinked.caseUrl}>)` : '';
    const caseNum = (firstLinked && firstLinked.caseNumber) ? ` — Case #${firstLinked.caseNumber}` : '';
    const header =
        `# Autopsy Information${caseNum}\n` +
        `${allBodies.length} ${allBodies.length === 1 ? 'body' : 'bodies'} / ${groups.length} ${groups.length === 1 ? 'ME' : 'MEs'}` +
        `${caseRef ? `\n${caseRef}` : ''}`;

    // Per-ME full-detail blocks (shared slice renderer — zero drift with the
    // granular per-ME views). Link lines are dropped here: tappable Load
    // buttons ride at the bottom instead (one row per 5, max 10).
    const LINK_LINE = /^(\[View Case\]|\[Load Case\]|Case #.*\(link pending\)|Case link pending)/;
    const blocks = groups.map((g) => {
        const { title, body } = buildMeSliceText(g);
        const stripped = body.split('\n\n').map((chunk) => {
            const lines = chunk.split('\n');
            while (lines.length > 1 && LINK_LINE.test(lines[lines.length - 1].trim())) lines.pop();
            return lines.join('\n');
        }).join('\n\n');
        return `## ${title}\n${stripped}`;
    });

    const loadable = [];
    for (const b of allBodies) {
        if (loadable.length >= 10) break;
        if (b && !b.completed && b.loadUrl) loadable.push(b);
    }

    let components = null;
    let dropped = 0;
    for (;;) {
        const kept = blocks.slice(0, blocks.length - dropped);
        const kids = [td(truncate(header, 3500))];
        kept.forEach((bl, i) => {
            if (i > 0) kids.push(sep(false));
            kids.push(td(truncate(bl, 3500)));
        });
        if (dropped > 0) kids.push(td(`*…and ${dropped} more section${dropped === 1 ? '' : 's'} — open the case thread for the rest*`));
        const rows = [];
        for (let i = 0; i < loadable.length; i += 5) {
            rows.push({
                type: 1,
                components: loadable.slice(i, i + 5).map((b) => ({
                    type: 2, style: 5,
                    label: truncate(`Load Case — ${b.ooc || b.name || 'body'}`, 80),
                    url: b.loadUrl,
                })),
            });
        }
        components = [
            { type: 17, accent_color: ACCENT_CYAN, components: kids },
            ...rows,
        ];
        if (measureV2Text(components) <= V2_TEXT_BUDGET && countV2Components(components) <= V2_COMPONENT_BUDGET && components.length <= 10) break;
        if (dropped >= blocks.length) break; // header alone still over — caller fail-closes
        dropped += 1;
    }
    return {
        flags: MessageFlags.IsComponentsV2,
        components,
        metrics: {
            textChars: measureV2Text(components),
            componentCount: countV2Components(components),
            topLevel: components.length,
            droppedSections: dropped,
            loadButtons: loadable.length,
        },
    };
}

// ── Live lifecycle: refresh / retire / watcher / restart-heal ──
// Mirrors the legacy massAssignmentPanel.js lifecycle so the V2 cutover
// keeps the same guarantees: same-message edits, retire-on-complete,
// auto-refresh on Firebase changes, working buttons after a bot restart.

const v2WatcherTimers = new Map();
const V2_WATCHER_DEBOUNCE_MS = 10000;
const V2_WATCHER_RECENCY_MS = 30000;

export function startMassPanelV2Watcher(client) {
    v2Db().then((db) => {
        if (!db) {
            console.warn('[MASS-V2] Watcher not started: no database');
            return;
        }
        db.ref('autopsy-requested').on('child_changed', (snap) => {
            try {
                const v = snap.val() || {};
                if (!v.massPanelV2 || !v.massPanelV2.panelId) return;
                const key = snap.key;
                if (v2WatcherTimers.has(key)) clearTimeout(v2WatcherTimers.get(key));
                v2WatcherTimers.set(key, setTimeout(async () => {
                    v2WatcherTimers.delete(key);
                    try {
                        const cur = (await db.ref(`autopsy-requested/${key}/massPanelV2/updatedAt`).once('value')).val() || 0;
                        if (Date.now() - cur < V2_WATCHER_RECENCY_MS) return;
                        const res = await refreshMassPanelV2(db, client || _v2discordClient, key);
                        if (res.refreshed) console.log(`[MASS-V2] Auto-refreshed panel for #${key} (Firebase change)`);
                    } catch { /* [OK] debounced auto-refresh ignored: best-effort only; refreshMassPanelV2 warns internally and the next Firebase change retries */ }
                }, V2_WATCHER_DEBOUNCE_MS));
            } catch { /* [OK] single watcher event skipped: malformed snapshot; next child_changed event retries */ }
        });
        console.log('[MASS-V2] Watcher active (auto-refresh on case changes).');
    }).catch((err) => {
        console.warn('[MASS-V2] Watcher failed to start:', err.message);
    });
}

/**
 * Refresh a posted V2 mass panel after a reassignment (or any Firebase-side
 * change): rebuilds the ME grouping from the current cases/<idx> assignedTo
 * values and edits the SAME message (same panelId, so live buttons keep
 * working). Best-effort — never throws.
 */
export async function refreshMassPanelV2(db, client, requestTopicId, basePath = 'autopsy-requested') {
    try {
        if (!db || !requestTopicId) return { refreshed: false, reason: 'no-db-or-topic' };
        const entry = (await db.ref(`${basePath}/${requestTopicId}`).once('value')).val() || {};
        const ref = entry.massPanelV2 || null;
        if (!ref || !ref.panelId || !ref.channelId || !ref.messageId) {
            return { refreshed: false, reason: 'no-panel-ref' };
        }
        const { buildPanelAssignmentsFromEntry, groupAssignmentsByMe } = await import('./massAssignmentPanel.js');
        const assignments = await buildPanelAssignmentsFromEntry(db, entry);
        if (assignments.length === 0) return { refreshed: false, reason: 'no-assignments' };
        const live = basePath === 'autopsy-requested';
        const withLinks = live ? await attachLoadUrls(db, requestTopicId, assignments) : assignments;
        const withTime = live ? await attachDeadlineUnix(db, requestTopicId, withLinks) : withLinks;
        const allGroups = groupAssignmentsByMe(withTime);
        const discordByMe = new Map();
        for (const g of allGroups) discordByMe.set(g.me, await lookupDiscordId(db, g.me));
        const rebuilt = buildLiveMassV2(ref.panelId, allGroups, discordByMe, {
            devReassign: ref.devReassign === true,
            compact: ref.compact === true,
        });

        const botClient = client || _v2discordClient;
        if (!botClient) return { refreshed: false, reason: 'no-client' };
        const channel = await botClient.channels.fetch(ref.channelId).catch(() => null);
        if (!channel || typeof channel.send !== 'function') return { refreshed: false, reason: 'channel-not-sendable' };
        const message = await channel.messages.fetch(ref.messageId).catch(() => null);
        if (!message || typeof message.edit !== 'function') return { refreshed: false, reason: 'message-gone' };
        await message.edit({ flags: rebuilt.flags, components: rebuilt.components });

        pendingMassV2Panels.set(ref.panelId, {
            groups: allGroups, components: rebuilt.components,
            devReassign: ref.devReassign === true,
            compact: ref.compact === true,
            devMode: basePath !== 'autopsy-requested',
            basePath,
            requestTopicId,
            channelId: ref.channelId, messageId: ref.messageId,
            caseUrl: (allGroups.flatMap((g) => g.bodies).find((b) => b.caseUrl) || {}).caseUrl || null,
            createdAt: Date.now(), bodyCount: assignments.length,
        });
        try {
            await db.ref(`${basePath}/${requestTopicId}/massPanelV2`).update({ updatedAt: Date.now() });
        } catch { /* [OK] updatedAt stamp ignored: bookkeeping only; panel message already edited above */ }
        console.log(`[MASS-V2] Refreshed panel ${ref.panelId} for #${requestTopicId}: ${assignments.length} bodies / ${allGroups.length} MEs`);
        return { refreshed: true };
    } catch (err) {
        console.warn(`[MASS-V2] Refresh failed for #${requestTopicId}: ${err.message}`);
        return { refreshed: false, reason: err.message };
    }
}

/**
 * Retire a collection's V2 panel when every body completes: disables its
 * rows in place (via a fresh channel/message fetch — the map holds ids, not
 * live objects) plus Firebase cleanup. Best-effort — never throws.
 */
export async function retireMassPanelV2(db, client, requestTopicId, basePath = 'autopsy-requested') {
    try {
        if (!requestTopicId) return false;
        const store = db || await v2Db();
        if (!store) return false;
        const entry = (await store.ref(`${basePath}/${requestTopicId}`).once('value')).val() || {};
        const ref = entry.massPanelV2 || null;
        if (!ref || !ref.panelId) return false;
        const botClient = client || _v2discordClient;
        const pending = pendingMassV2Panels.get(ref.panelId);
        if (pending) {
            pendingMassV2Panels.delete(ref.panelId);
            try {
                if (botClient && pending.channelId && pending.messageId) {
                    const channel = await botClient.channels.fetch(pending.channelId).catch(() => null);
                    const message = channel && typeof channel.messages?.fetch === 'function'
                        ? await channel.messages.fetch(pending.messageId).catch(() => null)
                        : null;
                    if (message && typeof message.edit === 'function') {
                        await message.edit({ components: disableV2Components(pending.components) });
                    }
                }
            } catch (err) {
                console.warn(`[MASS-V2] Retire edit failed for ${ref.panelId}: ${err.message}`);
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
                console.warn(`[MASS-V2] Retire fetch/edit failed for ${ref.panelId}: ${err.message}`);
            }
        }
        await cleanupMassV2Records(ref.panelId, basePath, requestTopicId);
        console.log(`[MASS-V2] Retired panel ${ref.panelId} for completed #${requestTopicId}`);
        return true;
    } catch (err) {
        console.warn(`[MASS-V2] Retire failed for #${requestTopicId}: ${err.message}`);
        return false;
    }
}

/**
 * Restart healing for button presses on panels unknown to this process:
 * look the panelId up in the Firebase registry, rebuild the grouping from
 * the live request, and re-seat the in-memory entry against the pressed
 * message so the press just works. Returns true when healed.
 */
async function healMassV2PanelFromPress(interaction, panelId) {
    try {
        const db = await v2Db();
        if (!db) return false;
        const reg = readChild('massPanelV2ById', panelId);
        if (!reg || !reg.requestTopicId) return false;
        const base = reg.basePath || 'autopsy-requested';
        const entry = (await db.ref(`${base}/${reg.requestTopicId}`).once('value')).val() || {};
        const ref = entry.massPanelV2 || null;
        if (!ref || ref.panelId !== panelId) return false; // superseded by a repost
        if (entry.completedAt) {
            await retireMassPanelV2(db, interaction.client, reg.requestTopicId, base).catch(() => {});
            return false;
        }
        const { buildPanelAssignmentsFromEntry, groupAssignmentsByMe } = await import('./massAssignmentPanel.js');
        const assignments = await buildPanelAssignmentsFromEntry(db, entry);
        if (assignments.length === 0) return false;
        const live = base === 'autopsy-requested';
        const withLinks = live ? await attachLoadUrls(db, reg.requestTopicId, assignments) : assignments;
        const withTime = live ? await attachDeadlineUnix(db, reg.requestTopicId, withLinks) : withLinks;
        const allGroups = groupAssignmentsByMe(withTime);
        const discordByMe = new Map();
        for (const g of allGroups) discordByMe.set(g.me, await lookupDiscordId(db, g.me));
        const built = buildLiveMassV2(panelId, allGroups, discordByMe, {
            devReassign: !!reg.devReassign,
            compact: !!reg.compact,
        });
        pendingMassV2Panels.set(panelId, {
            groups: allGroups, components: built.components,
            devReassign: !!reg.devReassign, compact: !!reg.compact,
            devMode: base !== 'autopsy-requested', basePath: base,
            requestTopicId: reg.requestTopicId,
            channelId: (ref && ref.channelId) || null,
            messageId: (ref && ref.messageId) || (interaction.message && interaction.message.id) || null,
            caseUrl: (allGroups.flatMap((g) => g.bodies).find((b) => b.caseUrl) || {}).caseUrl || null,
            createdAt: Date.now(), bodyCount: assignments.length,
        });
        console.log(`[MASS-V2] Healed panel ${panelId} for #${reg.requestTopicId} after restart`);
        return true;
    } catch (err) {
        console.warn(`[MASS-V2] Heal failed for ${panelId}: ${err.message}`);
        return false;
    }
}

// ── Interactions ──

function disableV2Components(components) {
    const walk = (c) => {
        if (!c || typeof c !== 'object') return c;
        const out = { ...c };
        if (out.type === 2 || out.type === 3) out.disabled = true;
        if (Array.isArray(out.components)) out.components = out.components.map(walk);
        if (out.accessory) out.accessory = walk(out.accessory);
        return out;
    };
    return (components || []).map(walk);
}

/**
 * Handle V2 prototype button presses (massv2_<panelId>_<slot>).
 * ME buttons reply with the ephemeral per-ME slice + Load Case buttons;
 * Autopsy Information replies with the all-bodies-at-once detail view;
 * Cancel disables the panel rows; the supervisor-only Reassign button pops
 * the unified reassign modal.
 */
export async function handleMassPanelV2Button(interaction) {
    if (!interaction || typeof interaction.isButton !== 'function' || !interaction.isButton()) return false;
    const customId = String(interaction.customId || '');
    if (!customId.startsWith(MASS_V2_PREFIX)) return false;
    const rest = customId.slice(MASS_V2_PREFIX.length);
    const sepIdx = rest.lastIndexOf('_');
    if (sepIdx === -1) return false;
    const panelId = rest.slice(0, sepIdx);
    const slot = rest.slice(sepIdx + 1);
    let pending = pendingMassV2Panels.get(panelId);
    if (!pending) {
        // Restart healing: recover the request behind this panelId and
        // rebuild the entry, then handle the press. Only a genuinely gone
        // panel (or finished collection) gets the inactive notice.
        const healed = await healMassV2PanelFromPress(interaction, panelId).catch(() => false);
        if (healed) pending = pendingMassV2Panels.get(panelId) || null;
    }
    if (!pending) {
        try {
            await interaction.reply({ content: 'This panel is no longer active (expired, cancelled, or its collection is complete). Ask a supervisor for a fresh panel.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] expired-panel notice ignored: interaction token already expired or double-acked; nothing left to inform */ }
        return true;
    }
    if (slot === MASS_V2_CANCEL_SLOT) {
        pendingMassV2Panels.delete(panelId);
        try {
            await interaction.update({ components: disableV2Components(pending.components) });
        } catch (err) {
            console.warn(`[MASS-V2] Cancel update failed for ${panelId}: ${err.message}`);
        }
        console.log(`[MASS-V2] Panel ${panelId} cancelled by ${interaction.user?.tag || 'unknown'}`);
        return true;
    }
    if (slot === MASS_V2_REASSIGN_SLOT) {
        return await openReassignModal(interaction, panelId, pending);
    }
    if (slot === MASS_V2_INFO_SLOT) {
        // All-data-at-once next page: one ephemeral reply with every ME's
        // full detail (never edits the shared panel, so other readers keep
        // their place). Granular per-ME buttons below are untouched.
        try {
            const { flags, components, metrics } = buildMassFullDetailPayload(pending);
            if (metrics.textChars > V2_TEXT_BUDGET || metrics.componentCount > V2_COMPONENT_BUDGET || metrics.topLevel > 10) {
                await interaction.reply({ content: 'Full detail is too large to render — open the case thread instead.', flags: MessageFlags.Ephemeral });
                return true;
            }
            await interaction.reply({ flags: flags | MessageFlags.Ephemeral, components });
            console.log(`[MASS-V2] Panel ${panelId}: full-detail view for ${interaction.user?.tag || 'unknown'} (${metrics.droppedSections} dropped)`);
        } catch (err) {
            console.warn(`[MASS-V2] Full-detail view failed for ${panelId}: ${err.message}`);
            try {
                await interaction.reply({ content: 'Could not load the full detail — try again in a moment.', flags: MessageFlags.Ephemeral });
            } catch { /* [OK] fallback error reply ignored: primary reply already failed, interaction likely expired; failure already warned above */ }
        }
        return true;
    }
    const meIdx = parseInt(slot, 10);
    const group = Number.isInteger(meIdx) ? pending.groups[meIdx] : null;
    if (!group) {
        try {
            await interaction.reply({ content: 'Selection not found on this panel.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] stale-selection notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    try {
        // Ephemeral per-ME detail: the ME's full slice (shared renderer —
        // zero drift with the panel and the all-bodies view) plus Load Case
        // link buttons for their outstanding loadable bodies. Private to the
        // clicker, so the shared panel never flips for other readers.
        // Press-time Load healing: bodies usually carry loadUrl from post
        // time, but a post-time race (or an entry changed since posting) can
        // leave them bare — resolve against the live row now when the panel
        // is linked. Dev fixtures stay unlinked (web resolves the live node,
        // so fixture links would 404).
        let bodies = group.bodies || [];
        // (Env gate: firebase.init() fail-fasts the whole process when
        // unconfigured, so never touch it press-time without credentials —
        // post-time links simply stand.)
        if (pending.requestTopicId && pending.devMode !== true && process.env.FIREBASE_DATABASE_URL && bodies.some((b) => b && !b.completed && !b.loadUrl)) {
            try {
                const db = await v2Db();
                const entry = db ? (await db.ref(`autopsy-requested/${pending.requestTopicId}`).once('value')).val() || {} : {};
                const caseRows = (entry && entry.cases) || {};
                const findIdx = (b) => {
                    const oocL = String(b.ooc || '').trim().toLowerCase();
                    const nameL = String(b.name || '').trim().toLowerCase();
                    for (const [idx, c] of Object.entries(caseRows)) {
                        if (!c || !/^\d+$/.test(idx)) continue;
                        if (oocL && String(c.oocName || '').trim().toLowerCase() === oocL) return idx;
                    }
                    if (nameL) {
                        for (const [idx, c] of Object.entries(caseRows)) {
                            if (!c || !/^\d+$/.test(idx)) continue;
                            if (String(c.name || '').trim().toLowerCase() === nameL) return idx;
                        }
                    }
                    return null;
                };
                let healed = 0;
                bodies = bodies.map((b) => {
                    if (!b || b.completed || b.loadUrl) return b;
                    const idx = findIdx(b);
                    if (idx === null) return b;
                    healed += 1;
                    return { ...b, loadUrl: `${MASS_V2_FORMS_URL}#/load/${pending.requestTopicId}/${idx}` };
                });
                if (healed > 0) console.log(`[MASS-V2] Panel ${panelId}: press-time Load healing attached ${healed} link(s) for ${group.me}`);
            } catch { /* post-time links (if any) stand */ }
        }
        const { title, body } = buildMeSliceText({ me: group.me, bodies });
        // Text link lines are redundant next to real buttons — drop them.
        const LINK_LINE = /^(\[View Case\]|\[Load Case\]|Case #.*\(link pending\)|Case link pending)/;
        const detailBody = body.split('\n\n').map((chunk) => {
            const lines = chunk.split('\n');
            while (lines.length > 1 && LINK_LINE.test(lines[lines.length - 1].trim())) lines.pop();
            return lines.join('\n');
        }).join('\n\n');
        const loadBtns = bodies
            .filter((b) => b && !b.completed && b.loadUrl)
            .slice(0, 10)
            .map((b) => ({
                type: 2, style: 5,
                label: truncate(`Load Case — ${b.ooc || b.name || 'body'}`, 80),
                url: b.loadUrl,
            }));
        const rows = [];
        for (let i = 0; i < loadBtns.length; i += 5) {
            rows.push({ type: 1, components: loadBtns.slice(i, i + 5) });
        }
        // Unlinked panels (dummies, fixtures) can never offer Load — but
        // their case thread link must survive the text-line strip above, so
        // it rides as a Case File button instead. Linked slices get it too
        // when the last row has room.
        const caseUrl = bodies.find((b) => b && b.caseUrl)?.caseUrl || pending.caseUrl || null;
        if (caseUrl && !rows.flatMap((r) => r.components).some((c) => c.url === caseUrl)) {
            const last = rows[rows.length - 1];
            const btn = { type: 2, style: 5, label: 'Case File', url: caseUrl };
            if (last && last.components.length < 5) last.components.push(btn);
            else rows.push({ type: 1, components: [btn] });
        }
        const detailComponents = [
            { type: 17, accent_color: ACCENT_CYAN, components: [td(truncate(`## ${title}\n${detailBody}`, 3500))] },
            ...rows,
        ];
        if (measureV2Text(detailComponents) > V2_TEXT_BUDGET || countV2Components(detailComponents) > V2_COMPONENT_BUDGET || detailComponents.length > 10) {
            await interaction.reply({ embeds: [buildMeSliceEmbed(group)], flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral, components: detailComponents });
        }
        console.log(`[MASS-V2] Panel ${panelId}: ephemeral slice + ${loadBtns.length} Load buttons for ${group.me}`);
    } catch (err) {
        console.warn(`[MASS-V2] Slice reply failed for ${panelId}/${group.me}: ${err.message}`);
        try {
            await interaction.reply({ content: 'Could not load your cases — try again in a moment.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] fallback slice reply ignored: primary reply already failed, interaction likely expired; failure already warned above */ }
    }
    return true;
}

/**
 * Resolve a panel body position to its Firebase cases/<idx> for a linked
 * collection (OOC match, name fallback — mirrors resolveMassBodyDetail).
 * basePath lets dev fixtures live outside the monitored live node.
 * Returns { idx, rec } or null.
 */
async function resolvePanelBodyIdx(db, basePath, requestTopicId, body) {
    try {
        const entry = (await db.ref(`${basePath}/${requestTopicId}`).once('value')).val() || {};
        const cases = entry.cases || {};
        const oocL = String(body?.ooc || '').trim().toLowerCase();
        const nameL = String(body?.name || '').trim().toLowerCase();
        for (const [idx, c] of Object.entries(cases)) {
            if (!c || !/^\d+$/.test(idx)) continue;
            if (oocL && String(c.oocName || '').trim().toLowerCase() === oocL) return { idx, rec: c };
        }
        if (nameL) {
            for (const [idx, c] of Object.entries(cases)) {
                if (!c || !/^\d+$/.test(idx)) continue;
                if (String(c.name || '').trim().toLowerCase() === nameL) return { idx, rec: c };
            }
        }
        return null;
    } catch {
        return null;
    }
}

async function v2Db() {
    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        return firebase.db || null;
    } catch {
        return null;
    }
}

/**
 * Open the unified reassign modal for a V2 panel (called from the Reassign
 * button branch of handleMassPanelV2Button — panelId + pending already
 * resolved). DEV ONLY + SUPERVISORS ONLY. One modal, two required radio
 * groups (outstanding body + new ME); submit executes the real core.
 */
export async function openReassignModal(interaction, panelId, pending) {
    const { isSupervisorUp } = await import('./permissions.js');
    if (!isSupervisorUp(interaction)) {
        try {
            await interaction.reply({ content: 'Only Supervisors and up can reassign cases.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] supervisor-gate notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    if (!pending.requestTopicId) {
        try {
            await interaction.reply({ content: 'This prototype panel is not linked to a live case (dummy data) — reassign via /reassign-autopsy. Link it with `/test-mass-panel-v2 request:<topicId>`.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] unlinked-panel notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    const db = await v2Db();
    if (!db) {
        try {
            await interaction.reply({ content: 'Firebase not ready — try again in a moment.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] db-not-ready notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    // Resolve every outstanding panel body to its live Firebase row now, so
    // the modal options carry executable case indices (no stale positions).
    // Dev panels resolve against the isolated fixture node.
    const basePath = pending.basePath || 'autopsy-requested';
    const order = pending.groups.flatMap((g) => (g.bodies || []).map((b) => ({ ...b, _me: g.me })));
    const options = [];
    for (let i = 0; i < order.length && options.length < 10; i++) {
        const b = order[i];
        if (b.completed) continue;
        const resolved = await resolvePanelBodyIdx(db, basePath, pending.requestTopicId, b);
        if (!resolved || resolved.rec.completedAt) continue;
        const who = `${b.name || 'Unknown'}` + (b.ooc ? ` ((${b.ooc}))` : '');
        options.push({
            label: truncate(`Body ${i + 1}: ${b.name || 'Unknown'} → ${resolved.rec.assignedTo || b._me || '?'}`, 100),
            value: String(resolved.idx).slice(0, 100),
            description: truncate(who, 100),
        });
    }
    if (options.length === 0) {
        try {
            await interaction.reply({ content: 'No outstanding bodies left to reassign on this panel.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] empty-panel notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    const { getMeNames } = await import('../commands/reassign-autopsy.js');
    const meNames = (await getMeNames(db).catch(() => [])) || [];
    const meOptions = meNames.slice(0, 10).map((n) => ({ label: String(n).slice(0, 100), value: String(n).slice(0, 100) }));
    if (meOptions.length < 2) {
        try {
            await interaction.reply({ content: 'Not enough MEs on rotation to offer a pick — use /reassign-autopsy instead.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] short-rotation notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    // Radio groups require 2+ options: with a single outstanding body the
    // pick is trivial, so its index rides in the modal id and the modal
    // carries only the ME group.
    const singleIdx = options.length === 1 ? options[0].value : null;
    // Single-outstanding-body shortcut: the body radio is skipped, so name
    // the body in a header line instead — otherwise the modal never says
    // which body is being reassigned.
    const singleBodyOpt = options.length === 1 ? options[0] : null;
    try {
        const labels = [];
        if (singleIdx === null) {
            labels.push(
                new LabelBuilder()
                    .setLabel('Body to reassign')
                    .setDescription(options.length >= 10 ? 'First 10 outstanding — /reassign-autopsy for the rest' : 'Outstanding bodies on this panel')
                    .setRadioGroupComponent(
                        new RadioGroupBuilder()
                            .setCustomId('body_idx')
                            .setRequired(true)
                            .setOptions(options)
                    )
            );
        }
        labels.push(
            new LabelBuilder()
                .setLabel('New medical examiner')
                .setRadioGroupComponent(
                    new RadioGroupBuilder()
                        .setCustomId('new_me')
                        .setRequired(true)
                        .setOptions(meOptions)
                )
        );
        const modal = new ModalBuilder()
            .setCustomId(`${MASS_V2_REASSIGN_MODAL_PREFIX}${panelId}${singleIdx !== null ? `_${singleIdx}` : ''}`)
            .setTitle('Reassign a body');
        if (singleBodyOpt) {
            modal.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `Reassigning **${singleBodyOpt.label}**\n${singleBodyOpt.description || ''}`.trim()
                )
            );
        }
        for (const lb of labels) modal.addLabelComponents(lb);
        await interaction.showModal(modal);
    } catch (err) {
        console.warn(`[MASS-V2] Panel ${panelId}: unified reassign modal failed: ${err.message}`);
        try {
            await interaction.reply({ content: 'Could not open the reassign form — use /reassign-autopsy instead.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] modal-failure fallback ignored: showModal already failed, interaction likely expired; failure already warned above */ }
        return true;
    }
    console.log(`[MASS-V2] Panel ${panelId}: supervisor unified reassign modal opened (${options.length} bodies)`);
    return true;
}

/**
 * Handle the unified V2 reassign modal submit (massv2_reasmodal_<panelId>
 * or massv2_reasmodal_<panelId>_<caseIdx> when a single outstanding body
 * made the body group unnecessary). Reads body_idx (when present) + new_me
 * radios; supervisor re-checked; executes performReassign (deferred first),
 * confirms ephemerally, and rebuilds the panel message in place.
 */
export async function handleMassPanelV2ReassignModal(interaction) {
    if (!interaction || typeof interaction.isModalSubmit !== 'function' || !interaction.isModalSubmit()) return false;
    const customId = String(interaction.customId || '');
    if (!customId.startsWith(MASS_V2_REASSIGN_MODAL_PREFIX)) return false;
    const { isSupervisorUp } = await import('./permissions.js');
    if (!isSupervisorUp(interaction)) {
        try {
            await interaction.reply({ content: 'Only Supervisors and up can reassign cases.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] modal-submit gate notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    // panelId is alphanumeric (no underscores): trailing _<idx> is the
    // single-body shortcut, otherwise the body comes from the radio.
    const rest = customId.slice(MASS_V2_REASSIGN_MODAL_PREFIX.length);
    const restParts = rest.split('_');
    const panelId = restParts[0];
    const idIdx = restParts.length > 1 ? restParts.slice(1).join('_') : '';
    const readRadio = (id) => {
        try {
            return String(interaction.fields?.getRadioGroup?.(id) || interaction.fields?.getString?.(id) || '').trim();
        } catch {
            return '';
        }
    };
    const caseIdx = readRadio('body_idx') || idIdx;
    const newME = readRadio('new_me');
    const pending = pendingMassV2Panels.get(panelId);
    if (!pending || !pending.requestTopicId || !caseIdx || !newME) {
        try {
            await interaction.reply({ content: (!caseIdx || !newME) ? 'Pick a body and a medical examiner first.' : 'Reassign expired — start again from the panel.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] missing-pick notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    const db = await v2Db();
    if (!db) {
        try {
            await interaction.reply({ content: 'Firebase not ready — try again in a moment.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] db-not-ready notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch { /* [OK] defer ignored: already deferred or acked; editReply below targets whichever state holds */ }
    const { performReassign } = await import('../commands/reassign-autopsy.js');
    const basePath = pending.basePath || 'autopsy-requested';
    const res = await performReassign({ db, client: interaction.client, topicId: pending.requestTopicId, caseIdx, newME, basePath, dryRun: pending.devMode === true });
    const dryTag = res.dryRun ? ' *(DRY RUN — forum + Discord writes skipped)*' : '';
    try {
        if (res.already) {
            await interaction.editReply({ content: `Already assigned to **${newME}**.` });
        } else if (!res.ok) {
            await interaction.editReply({ content: `Reassign failed: ${res.error || 'unknown error'}` });
        } else {
            await interaction.editReply({ content: `Reassigned **${res.decedentName}** from **${res.currentAssigned}** to **${res.newME}**. Panel refreshing…${dryTag}` });
        }
    } catch (err) { console.warn(`[WARN] Panel ${panelId}: reassign executed but confirmation editReply failed: ${err.message}`); }
    if (res.ok) {
        // Rebuild the panel message in place from Firebase (same panelId, so
        // live buttons keep working) and refresh the pending entry.
        try {
            const { buildPanelAssignmentsFromEntry, groupAssignmentsByMe } = await import('./massAssignmentPanel.js');
            const entry = (await db.ref(`${pending.basePath || 'autopsy-requested'}/${pending.requestTopicId}`).once('value')).val() || {};
            const fresh = await buildPanelAssignmentsFromEntry(db, entry);
            let assignments = (pending.requestTopicId && pending.devMode !== true)
                ? await attachLoadUrls(db, pending.requestTopicId, fresh)
                : fresh;
            if (pending.requestTopicId && pending.devMode !== true) {
                assignments = await attachDeadlineUnix(db, pending.requestTopicId, assignments);
            }
            const allGroups = groupAssignmentsByMe(assignments);
            const discordByMe = new Map();
            for (const g of allGroups) discordByMe.set(g.me, await lookupDiscordId(db, g.me));
            const rebuilt = buildLiveMassV2(panelId, allGroups, discordByMe, {
                devReassign: pending.devReassign === true,
                compact: pending.compact === true,
            });
            const channel = await interaction.client.channels.fetch(pending.channelId).catch(() => null);
            const message = channel && pending.messageId ? await channel.messages.fetch(pending.messageId).catch(() => null) : null;
            if (message && typeof message.edit === 'function') {
                await message.edit({ flags: rebuilt.flags, components: rebuilt.components });
            }
            pendingMassV2Panels.set(panelId, {
                ...pending, groups: allGroups, components: rebuilt.components,
                bodyCount: assignments.length,
            });
            console.log(`[MASS-V2] Panel ${panelId}: rebuilt after modal reassign (body ${caseIdx} → ${newME})`);
        } catch (err) {
            console.warn(`[MASS-V2] Panel ${panelId} rebuild after modal reassign failed: ${err.message}`);
        }
    }
    return true;
}
