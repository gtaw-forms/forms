/**
 * singlePanelV2.js — Single Autopsy assignment rendered with Discord
 * Components V2 (IsComponentsV2 flag). Revamp of the legacy single-assignment
 * embed (assignmentWebhook.js) with two fixes baked in:
 *
 *   1. Decedent + Case share ONE aligned line
 *      (`Decedent — Name ((OOC)) · Case #N`) instead of stacking on two
 *      separate lines.
 *   2. The supervisor Reassign button (blue Primary, same as the mass
 *      panel) — supervisor-gated ME picker driving the shared
 *      performReassign core. (An Autopsy Information next-page button was
 *      removed: the summary box already carries everything it showed. Its
 *      press handler stays so already-posted panels don't error.)
 *
 * Layout (summary page — terse by design, detail lives behind the button):
 *   1. Ping line (Text Display — mentions still ping via allowed_mentions).
 *   2. Header Container (cyan accent): title + aligned Decedent · Case line
 *      + ME + deadline + Synopsis, plus a Load Case Section accessory (same
 *      in-box pattern as the mass panel) whenever a load URL is known.
 *   3. Action row: Reassign (Supervisors, blue Primary like the mass
 *      panel) + the [Case File] / [PHMC Forms] link buttons (mirrors the
 *      mass-panel order). No Autopsy Information button — the box above
 *      already carries the full summary, so it was redundant (the press
 *      handler stays for already-posted panels). No Cancel row (see
 *      massPanelV2.js — same reason).
 *
 * Raw API JSON (no discord.js builders for the message itself) so the payload
 * is version-proof. Component types: 1 Action Row, 2 Button, 10 Text Display,
 * 14 Separator, 17 Container.
 *
 * No webhook URLs in source — destinations come from env / channel map only.
 */

import { MessageFlags, ModalBuilder, LabelBuilder, RadioGroupBuilder, TextDisplayBuilder } from 'discord.js';
import { readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isDevTestActive, devLogChannelId } from './devRouting.js';
import { getChannelId, channelSendEnabled } from './phmcChannels.js';
import { deathTypeWindow } from './assignmentWebhook.js';
import { measureV2Text, countV2Components, V2_TEXT_BUDGET, V2_COMPONENT_BUDGET } from './massPanelV2.js';

export const SINGLE_V2_PREFIX = 'singlev2_';
export const SINGLE_V2_INFO_SLOT = 'info';
export const SINGLE_V2_REASSIGN_SLOT = 'reassign';
export const SINGLE_V2_CANCEL_SLOT = 'cancel';
export const SINGLE_V2_REASSIGN_MODAL_PREFIX = 'singlev2_reasmodal_';
export const SINGLE_V2_STAGING_CHANNEL_ID = '1538008459445010502';
export const SINGLE_V2_FORMS_URL = 'https://gtaw-forms.github.io/forms/';

const ACCENT_CYAN = 0x00bcd4;
const ACCENT_GREEN = 0x2ecc71;

let singleV2Counter = 0;
/** Map<panelId, snapshot> — snapshot holds everything the Info/Reassign handlers need. */
export const pendingSingleV2Panels = new Map();

// ── Bot client registration (mirrors the mass-panel pattern) ──
let _discordClient = null;
export function setSinglePanelClient(client) {
    _discordClient = client || null;
}

function truncate(s, n) {
    const str = String(s ?? '');
    if (str.length <= n) return str;
    return str.slice(0, Math.max(0, n - 3)) + '...';
}

function cleanDecedent(name) {
    return String(name || '').replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').trim();
}

const td = (content) => ({ type: 10, content: String(content ?? '') });
const sep = (divider = true) => ({ type: 14, divider, spacing: 1 });

/**
 * Intake-time morgue match for single panels: FOUND (exact OOC-name hit),
 * POSSIBLY FOUND (name tokens overlap but nothing conclusive — low
 * confidence, cannot match date/name), or NOT FOUND. Reads the VPS-local
 * morgue-data.json first (same source the web Load-Case matcher uses via
 * morgue-api), falling back to RTDB when the file is missing. One read per
 * intake (low volume); fail-closed null (line omitted) on any error so a
 * sick morgue node never blocks the assignment ping.
 * @returns {Promise<{status:string, caseId:string|null}|null>}
 */
let _morgueCache = null;
let _morgueCacheMtime = 0;
function loadLocalMorgueRecords() {
    try {
        const fp = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'morgue-data.json');
        const mt = statSync(fp).mtimeMs;
        if (!_morgueCache || mt !== _morgueCacheMtime) {
            _morgueCache = Object.values(JSON.parse(readFileSync(fp, 'utf-8')) || {});
            _morgueCacheMtime = mt;
        }
        return _morgueCache && _morgueCache.length > 0 ? _morgueCache : null;
    } catch {
        return null;
    }
}
export async function resolveMorgueStatus(db, { ooc = '', decedent = '' } = {}) {
    try {
        const oocL = String(ooc || '').toLowerCase().trim();
        const decL = String(decedent || '').toLowerCase().trim();
        if (!oocL && !decL) return null;
        let recs = loadLocalMorgueRecords();
        if (!recs && db) {
            const snap = await db.ref('morgue-records').once('value').catch(() => null);
            if (!snap || !snap.exists()) return null;
            recs = Object.values(snap.val() || {});
        }
        if (!recs || recs.length === 0) return null;
        // Exact OOC-name hit (strongest signal — mirrors the web matcher).
        if (oocL) {
            const hit = recs.find((r) => String(r.name || '').toLowerCase().includes(oocL));
            if (hit) return { status: 'FOUND', caseId: String(hit.caseId ?? hit.firebaseKey ?? '') || null };
        }
        // Token overlap on either name (weak signal).
        const toks = `${oocL} ${decL}`.split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && t !== 'unknown' && t !== 'doe');
        if (toks.length > 0) {
            const hit = recs.find((r) => {
                const hay = String(r.name || '').toLowerCase();
                return toks.some((t) => hay.includes(t));
            });
            if (hit) return { status: 'POSSIBLY FOUND', caseId: String(hit.caseId ?? hit.firebaseKey ?? '') || null };
        }
        return { status: 'NOT FOUND', caseId: null };
    } catch {
        return null;
    }
}

/** Render the morgue-status line (empty when unresolved). */
function morgueStatusLine(morgueStatus, morgueCaseId) {
    if (morgueStatus === 'FOUND') return `🧬 **Morgue Record:** FOUND${morgueCaseId ? ` (#${morgueCaseId})` : ''}`;
    if (morgueStatus === 'POSSIBLY FOUND') return '🧬 **Morgue Record:** POSSIBLY FOUND (low confidence — cannot match date/name)';
    if (morgueStatus === 'NOT FOUND') return '🧬 **Morgue Record:** NOT FOUND';
    return '';
}

/**
 * ONE aligned line for the decedent (the legacy embed stacked Decedent +
 * Case vertically; the Case half is gone — every view already shows the
 * case number in its title). Icons reused from the legacy embed (🧍
 * decedent, 📋 case title, 👤 ME, ⏰ deadline, 🔗 thread, 📝 note).
 * Shared by the summary page, the full-detail view, and the completed
 * summary so all three render identically.
 */
export function alignedDecedentCaseLine({ decedent, ooc } = {}) {
    const name = cleanDecedent(decedent);
    const who = name ? `**${name}**` + (ooc ? ` ((${ooc}))` : '') : '*Unknown*';
    return `🧍 Decedent — ${who}`;
}

/**
 * Resolve a live wait-window deadline as a unix timestamp for Discord's
 * `<t:R>` countdown (`assignedAt` + CK 72h / PK 120h / default 48h, same
 * windows as the overdue monitor). Returns null when unresolvable — callers
 * fall back to the static `deadline` label.
 */
export async function resolveDeadlineUnix(db, me, requestTopicId, deathType) {
    try {
        if (!db || !me || !requestTopicId) return null;
        const asnap = await db.ref('autopsy-requests/assignments').once('value').catch(() => null);
        const adata = (asnap && asnap.val()) || {};
        const meL = String(me).toLowerCase();
        const key = Object.keys(adata).find((k) => String(k).toLowerCase() === meL);
        const rec = (key && adata[key] && adata[key].cases) ? adata[key].cases[requestTopicId] : null;
        const assignedAt = rec && rec.assignedAt ? rec.assignedAt : null;
        if (!assignedAt) return null;
        const baseMs = new Date(assignedAt).getTime();
        if (!Number.isFinite(baseMs)) return null;
        const { limitHoursFor } = await import('./outstandingAutopsies.js');
        return Math.floor(baseMs / 1000) + limitHoursFor(deathType) * 3600;
    } catch {
        return null;
    }
}

// ── Payload builders (pure) ──

/**
 * Build the terse V2 summary page for one assignment.
 * @param {string} panelId — alphanumeric id (no underscores)
 * @param {object} data — { me, caseNumber, caseTitle, decedent, ooc, caseUrl, loadUrl?, deathType, deadline?, deadlineUnix?, note?, synopsis?, title?, morgueStatus?, morgueCaseId? }
 *   deadlineUnix (unix seconds) renders a live Discord countdown
 *   (`<t:F>` + `<t:R>`); plain `deadline` is the static fallback.
 *   morgueStatus FOUND | POSSIBLY FOUND | NOT FOUND renders the 🧬 line.
 * @param {object} [opts] — { discordId?, noPing? }
 */
export function buildSinglePanelV2Payload(panelId, data = {}, { discordId, noPing } = {}) {
    const d = data || {};
    const ping = noPing ? `**${d.me || 'ME'}**` : (discordId ? `<@${discordId}>` : `**${d.me || 'ME'}**`);
    const verb = d.action || 'assigned an autopsy';
    const pingLine = `${ping} Dr. ${d.me || 'ME'}, you've been ${verb} — here's the case file and links.`;

    const title = d.title || 'Autopsy Case Assigned';
    const headerText =
        `# ${title}\n` +
        `${alignedDecedentCaseLine(d)}\n` +
        `👤 **Medical Examiner:** ${d.me || '?'}` +
        (d.deadlineUnix
            ? `\n⏰ **Deadline:** <t:${d.deadlineUnix}:F> (<t:${d.deadlineUnix}:R>)`
            : (d.deadline ? `\n⏰ **Deadline:** ${d.deadline}` : '')) +
        `${d.caseTitle ? `\n📋 *${truncate(d.caseTitle, 200)}*` : ''}` +
        `${morgueStatusLine(d.morgueStatus, d.morgueCaseId) ? `\n${morgueStatusLine(d.morgueStatus, d.morgueCaseId)}` : ''}` +
        `${d.synopsis ? `\n📝 **Synopsis**\n${truncate(d.synopsis, 500)}` : ''}`;

    // Button order mirrors the mass panel: action row (Info + Reassign +
    // thread/forms links), no Cancel row anywhere. Load Case rides INSIDE
    // the box as a Section accessory (same in-box pattern as the mass
    // panel) instead of on the button row.
    const headerKids = [td(truncate(headerText, 3500))];
    if (d.loadUrl) {
        headerKids.push(sep());
        headerKids.push({
            type: 9,
            components: [td('Open this case in PHMC Forms — loads the autopsy form with the morgue match filled.')],
            accessory: { type: 2, style: 5, label: 'Load Case', url: d.loadUrl },
        });
    }
    const links = [];
    if (d.caseUrl) links.push({ type: 2, style: 5, label: 'Case File', url: d.caseUrl });
    links.push({ type: 2, style: 5, label: 'PHMC Forms', url: SINGLE_V2_FORMS_URL });
    const components = [
        td(truncate(pingLine, 3500)),
        {
            type: 17,
            accent_color: ACCENT_CYAN,
            components: headerKids,
        },
        {
            type: 1,
            components: [
                { type: 2, style: 1, label: 'Reassign (Supervisors)', custom_id: `${SINGLE_V2_PREFIX}${panelId}_${SINGLE_V2_REASSIGN_SLOT}` },
                ...links,
            ],
        },
    ];

    return {
        flags: MessageFlags.IsComponentsV2,
        components,
        metrics: {
            textChars: measureV2Text(components),
            textBudget: V2_TEXT_BUDGET,
            componentCount: countV2Components(components),
            componentBudget: V2_COMPONENT_BUDGET,
            topLevel: components.length,
        },
    };
}

/**
 * Build the all-data-at-once detail view (ephemeral reply to the Autopsy
 * Information button). Prefers the live Firebase entry when the panel is
 * linked (requestTopicId) so DOD/TOD/location/sex/synopsis resolve; falls
 * back to the post-time snapshot otherwise.
 */
export function buildSingleFullDetailPayload(snapshot, live = null) {
    const s = snapshot || {};
    const e = live || {};
    const p = (e && e.parsed) || {};
    const decedent = cleanDecedent(e.name || e.decedent || s.decedent);
    const ooc = e.oocName || s.ooc;
    const caseNumber = e.caseNum || e.caseNumber || s.caseNumber;
    const caseTitle = e.caseTitle || e.title || s.caseTitle;
    const me = e.assignedTo || s.me;
    const deathType = p.deathType || e.deathType || s.deathType;
    const sex = p.gender || p.sex || e.sex || '';
    const dod = [p.dateOfDeath || e.dateOfDeath, p.timeOfDeath || e.timeOfDeath].filter(Boolean).join(' ').trim();
    const location = p.placeOfDeath || p.location || e.placeOfDeath || '';
    const synopsis = p.synopsis || e.synopsis || '';
    const caseUrl = e.caseUrl || s.caseUrl;
    const loadUrl = s.loadUrl;
    const deadline = deathTypeWindow(deathType) || s.deadline || '';

    const deadlineUnix = s.deadlineUnix || null;
    const lines = [
        `# Autopsy Information${caseNumber ? ` — Case #${caseNumber}` : ''}`,
        alignedDecedentCaseLine({ decedent, ooc }),
    ];
    if (caseTitle) lines.push(`📋 *${truncate(caseTitle, 300)}*`);
    const fullMorgue = morgueStatusLine(s.morgueStatus, s.morgueCaseId);
    if (fullMorgue) lines.push(fullMorgue);
    lines.push(
        '',
        `👤 **Medical Examiner:** ${me || '?'}`,
        deathType ? `**Type:** ${deathType}` : '',
        sex ? `**Sex:** ${sex}` : '',
        dod ? `**DOD:** ${dod}` : '',
        location ? `**Location:** ${location}` : '',
        deadlineUnix
            ? `⏰ **Deadline:** <t:${deadlineUnix}:F> (<t:${deadlineUnix}:R>)`
            : (deadline ? `⏰ **Deadline:** ${deadline}` : ''),
        caseUrl ? `🔗 **Thread:** [View Case](<${caseUrl}>)` : '',
    );
    if (synopsis) lines.push('', `📝 **Synopsis**\n${truncate(synopsis, 1500)}`);
    if (s.note) lines.push('', `📝 **Note**\n${truncate(s.note, 500)}`);
    const detailText = lines.filter((l) => l !== '').join('\n');

    const rows = [];
    const links = [];
    if (caseUrl) links.push({ type: 2, style: 5, label: 'Case File', url: caseUrl });
    if (loadUrl) links.push({ type: 2, style: 5, label: 'Load Case', url: loadUrl });
    if (links.length > 0) rows.push({ type: 1, components: links });

    const components = [
        { type: 17, accent_color: ACCENT_CYAN, components: [td(truncate(detailText, 3500))] },
        ...rows,
    ];
    return {
        flags: MessageFlags.IsComponentsV2,
        components,
        metrics: {
            textChars: measureV2Text(components),
            componentCount: countV2Components(components),
            topLevel: components.length,
        },
    };
}

// ── Posting ──

function newSingleV2PanelId() {
    singleV2Counter += 1;
    return `s${Date.now().toString(36)}${singleV2Counter.toString(36)}`.replace(/[^a-z0-9]/gi, '').slice(0, 20) || `s${singleV2Counter}`;
}

async function singleV2Db() {
    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        return firebase.db || null;
    } catch {
        return null;
    }
}

/**
 * Post the V2 single-assignment panel via the bot client. Best-effort and
 * fail-closed: no client / gated channel / send error returns posted:false
 * and NEVER throws — callers keep their legacy embed/webhook paths.
 * @param {object|null} db — Firebase database (discord-members lookup + snapshot resolve)
 * @param {object|null} client — logged-in discord.js Client (falls back to registered)
 * @param {object} data — same shape as buildSinglePanelV2Payload
 * @param {object} [opts] — { channelId?, noPing?, requestTopicId?, caseIdx?, loadUrl? }
 */
export async function postSinglePanelV2(db, client, data = {}, { channelId, noPing, requestTopicId, caseIdx, loadUrl } = {}) {
    const botClient = client || _discordClient;
    if (!botClient) return { posted: false, reason: 'no-client' };

    let target = (channelId || '').trim();
    if (!target) {
        const liveAutopsiesId = getChannelId('autopsies');
        if (isDevTestActive()) {
            const { devLogChannelId: devChan } = await import('./devRouting.js');
            target = devChan() || SINGLE_V2_STAGING_CHANNEL_ID;
        } else if (channelSendEnabled()) {
            target = liveAutopsiesId;
        } else {
            return { posted: false, reason: 'channel-send-disabled' };
        }
    }
    const liveAutopsiesId = getChannelId('autopsies');
    if (isDevTestActive() && target === liveAutopsiesId) {
        const { devLogChannelId: devChan } = await import('./devRouting.js');
        target = devChan() || SINGLE_V2_STAGING_CHANNEL_ID;
    } else if (target === liveAutopsiesId && !channelSendEnabled() && !isDevTestActive()) {
        return { posted: false, reason: 'channel-send-disabled' };
    }

    let discordId = null;
    if (db && data.me && !noPing) {
        try {
            const snap = await db.ref(`autopsy-requests/discord-members/${String(data.me).toLowerCase()}`).once('value');
            discordId = snap.val() || null;
        } catch { /* bold-name fallback */ }
    }

    // Effective Load URL: explicit override first, then the linked deep
    // link (singles load index 0, grouped sub-cases their own index).
    // Synopsis resolves live when the caller didn't pass one (one keyed
    // point-read — assignment volume is low). Both land in the snapshot so
    // the Info fallback renders them without another read.
    const idx = (caseIdx === null || caseIdx === undefined) ? 0 : caseIdx;
    let effLoad = loadUrl || data.loadUrl || '';
    if (requestTopicId && !effLoad) effLoad = `${SINGLE_V2_FORMS_URL}#/load/${requestTopicId}/${idx}`;
    let synopsis = data.synopsis || '';
    if (!synopsis && db && requestTopicId) {
        try {
            const esnap = await db.ref(`autopsy-requested/${requestTopicId}`).once('value');
            const e = esnap.val() || {};
            const rec = (caseIdx !== null && caseIdx !== undefined && e.cases && typeof e.cases === 'object')
                ? (e.cases[caseIdx] || {})
                : null;
            synopsis = (rec && rec.synopsis) || (e.parsed && e.parsed.synopsis) || e.synopsis || '';
        } catch { /* snapshot stands without it */ }
    }

    const deadlineUnix = await resolveDeadlineUnix(db, data.me, requestTopicId, data.deathType);
    // Intake-time morgue match (skipped when the caller already resolved one).
    let morgueStatus = data.morgueStatus || null;
    let morgueCaseId = data.morgueCaseId || null;
    if (!morgueStatus) {
        const m = await resolveMorgueStatus(db, { ooc: data.ooc, decedent: data.decedent });
        if (m) { morgueStatus = m.status; morgueCaseId = m.caseId; }
    }
    const panelId = newSingleV2PanelId();
    const payload = buildSinglePanelV2Payload(panelId, { ...data, synopsis, loadUrl: effLoad, deadlineUnix, morgueStatus, morgueCaseId }, { discordId, noPing });
    if (payload.metrics.textChars > V2_TEXT_BUDGET || payload.metrics.componentCount > V2_COMPONENT_BUDGET || payload.metrics.topLevel > 10) {
        return { posted: false, reason: 'over-budget', metrics: payload.metrics };
    }
    const finalComponents = payload.components;

    try {
        const channel = await botClient.channels.fetch(target);
        if (!channel || typeof channel.send !== 'function') return { posted: false, reason: 'channel-not-sendable' };
        const message = await channel.send({
            components: finalComponents,
            flags: payload.flags,
            allowedMentions: noPing ? { parse: [] } : { parse: ['users'] },
        });
        pendingSingleV2Panels.set(panelId, {
            snapshot: { ...data, synopsis, loadUrl: effLoad, deadlineUnix, morgueStatus, morgueCaseId },
            requestTopicId: requestTopicId || null,
            caseIdx: caseIdx ?? null,
            channelId: target,
            messageId: message?.id || null,
            components: finalComponents,
            createdAt: Date.now(),
        });
        console.log(`[SINGLE-V2] Posted panel ${panelId} to ${target} for ${data.me || '?'} (case ${data.caseNumber || '?'})`);
        // Persist the panel ref so the completion flow can flip this exact
        // message later (even after a bot restart — completeSinglePanel reads
        // Firebase, not the in-memory map). Singles live on the entry itself;
        // grouped sub-cases on their cases/<idx> row.
        if (db && requestTopicId && message?.id) {
            try {
                const refPayload = { panelId, channelId: target, messageId: message.id, updatedAt: Date.now() };
                const nodePath = (caseIdx === null || caseIdx === undefined)
                    ? `autopsy-requested/${requestTopicId}/singlePanel`
                    : `autopsy-requested/${requestTopicId}/cases/${caseIdx}/singlePanel`;
                await db.ref(nodePath).set(refPayload);
                await db.ref(`singlePanelById/${panelId}`).set({
                    requestTopicId, caseIdx: caseIdx ?? null, channelId: target, messageId: message.id,
                });
            } catch (e) {
                console.warn(`[SINGLE-V2] Panel ref persist failed for ${panelId}: ${e.message}`);
            }
        }
        try {
            const auditId = process.env.AUDIT_CHANNEL_ID || null;
            if (auditId) {
                const { sendToChannel } = await import('./logChannel.js');
                sendToChannel(auditId, `[AUDIT] POST single-panel-v2 | panel ${panelId} | ME ${data.me || '?'} | case #${data.caseNumber ?? '?'} | channel ${target}`).catch(() => {});
            }
        } catch { /* audit must never break sending */ }
        return { posted: true, panelId, channelId: target, messageId: message?.id || null, metrics: payload.metrics };
    } catch (err) {
        console.warn(`[SINGLE-V2] Send to ${target} failed: ${err.message}`);
        return { posted: false, reason: 'send-failed' };
    }
}

// ── Completion flip (pure builder + effectful flip) ──

/**
 * Build the basic completed summary that replaces the assignment panel once
 * the autopsy is marked completed / sent:
 *   "{ME} has completed {caseInfo} on {date/time}"
 *   "- Sent to {FACTION}"
 *   "- Posted on PHMC Forums"
 * No interactive buttons remain — nothing left to press for. When the sends
 * have not been recorded yet (open multi collection), the delivery lines
 * render as a pending note instead of asserting sends that never happened.
 */
export function buildSingleCompletedPayload({ me, caseNumber, decedentLine, caseTitle, completedUnix, delivered, sentLine, forumUrl, caseUrl } = {}) {
    const when = completedUnix ? `<t:${completedUnix}:F>` : 'recently';
    const head = `# ✅ Autopsy Completed${caseNumber ? ` — Case #${caseNumber}` : ''}\n` +
        `**${me || 'ME'}** has completed ${decedentLine || 'the case'} on ${when}` +
        `${caseTitle ? `\n📋 *${truncate(caseTitle, 200)}*` : ''}`;
    const delivery = delivered
        ? `- Sent to ${sentLine || 'requester'}\n` +
            (forumUrl ? `- [Posted on PHMC Forums](<${forumUrl}>)` : `- Posted on PHMC Forums`)
        : `- Delivery pending — collection still open`;
    const components = [
        { type: 17, accent_color: ACCENT_GREEN, components: [td(truncate(`${head}\n${delivery}`, 3500))] },
    ];
    const links = [];
    if (caseUrl) links.push({ type: 2, style: 5, label: 'Case File', url: caseUrl });
    if (forumUrl && forumUrl !== caseUrl) links.push({ type: 2, style: 5, label: 'Completion Reply', url: forumUrl });
    links.push({ type: 2, style: 5, label: 'PHMC Forms', url: SINGLE_V2_FORMS_URL });
    components.push({ type: 1, components: links });
    return {
        flags: MessageFlags.IsComponentsV2,
        components,
        metrics: {
            textChars: measureV2Text(components),
            componentCount: countV2Components(components),
            topLevel: components.length,
        },
    };
}

async function cleanupSinglePanelRecords(panelId, requestTopicId, caseIdx) {
    try {
        const db = await singleV2Db();
        if (!db) return;
        await db.ref(`singlePanelById/${panelId}`).remove().catch(() => {});
        if (requestTopicId) {
            const nodePath = (caseIdx === null || caseIdx === undefined)
                ? `autopsy-requested/${requestTopicId}/singlePanel`
                : `autopsy-requested/${requestTopicId}/cases/${caseIdx}/singlePanel`;
            const cur = (await db.ref(nodePath).once('value')).val() || null;
            if (cur && cur.panelId === panelId) {
                await db.ref(nodePath).remove().catch(() => {});
            }
        }
    } catch { /* cleanup must never break the flow */ }
}

/**
 * Flip a posted single panel to its completed summary. Reads Firebase truth
 * at call time (completedAt, recorded sends) so the lines never assert
 * deliveries that have not happened. Best-effort — never throws; returns
 * { flipped } for caller logs.
 * @param {object|null} db — Firebase database
 * @param {object|null} client — discord.js Client (falls back to registered)
 * @param {object} [opts] — { requestTopicId, caseIdx }
 */
export async function completeSinglePanel(db, client, { requestTopicId, caseIdx } = {}) {
    try {
        if (!db || !requestTopicId) return { flipped: false, reason: 'no-db-or-topic' };
        const idx = (caseIdx === null || caseIdx === undefined) ? null : caseIdx;
        const nodePath = idx === null
            ? `autopsy-requested/${requestTopicId}/singlePanel`
            : `autopsy-requested/${requestTopicId}/cases/${idx}/singlePanel`;
        const ref = (await db.ref(nodePath).once('value')).val() || null;
        if (!ref || !ref.panelId || !ref.channelId || !ref.messageId) {
            return { flipped: false, reason: 'no-panel-ref' };
        }
        const entry = (await db.ref(`autopsy-requested/${requestTopicId}`).once('value')).val() || {};
        const caseRec = (idx !== null && entry.cases && typeof entry.cases === 'object') ? (entry.cases[idx] || {}) : null;
        const rec = caseRec || {};
        const mem = pendingSingleV2Panels.get(ref.panelId);
        const snap = (mem && mem.snapshot) || {};

        const decedent = cleanDecedent(rec.name || entry.name || snap.decedent);
        const ooc = rec.oocName || entry.oocName || snap.ooc;
        const caseNumber = rec.caseNum || entry.caseNum || entry.caseNumber || snap.caseNumber;
        const me = rec.assignedTo || entry.assignedTo || snap.me;
        const caseTitle = rec.caseTitle || entry.caseTitle || entry.title || snap.caseTitle;
        const completedRaw = rec.completedAt || entry.completedAt || null;
        const completedUnix = completedRaw ? Math.floor(new Date(completedRaw).getTime() / 1000) : null;

        const isPrivate = entry.isPrivate === true;
        const factionRaw = String(entry.faction || '').toLowerCase()
            || ((/\[(lssd|lspd|sadcr|dao)\]/i.exec(entry.title || '') || [])[1]?.toLowerCase())
            || '';
        let agencyUrl = null;
        for (const fx of ['lssd', 'sadcr', 'dao']) {
            if (entry[`${fx}CompletionUrl`]) { agencyUrl = entry[`${fx}CompletionUrl`]; break; }
        }
        const steps = entry.completionSteps || {};
        const dmDone = steps.dmSent && steps.dmSent.status === 'completed';
        const forumUrl = entry.phmcCompletionReplyUrl || rec.replyUrl || null;
        const caseUrl = entry.caseUrl || rec.caseUrl || snap.caseUrl || null;
        const delivered = !!(agencyUrl || forumUrl || dmDone);
        const sentLine = isPrivate
            ? `Private PM to ${entry.pmRecipient || 'requester'}`
            : (factionRaw ? factionRaw.toUpperCase() : 'Requester');

        const { flags, components, metrics } = buildSingleCompletedPayload({
            me,
            caseNumber,
            decedentLine: alignedDecedentCaseLine({ decedent, ooc }).replace(/^🧍 Decedent — /, ''),
            caseTitle,
            completedUnix,
            delivered,
            sentLine,
            forumUrl,
            caseUrl,
        });
        if (metrics.textChars > V2_TEXT_BUDGET || metrics.componentCount > V2_COMPONENT_BUDGET || metrics.topLevel > 10) {
            return { flipped: false, reason: 'over-budget' };
        }

        const botClient = client || _discordClient;
        if (!botClient) return { flipped: false, reason: 'no-client' };
        const channel = await botClient.channels.fetch(ref.channelId).catch(() => null);
        if (!channel || typeof channel.messages?.fetch !== 'function') return { flipped: false, reason: 'channel-not-sendable' };
        const message = await channel.messages.fetch(ref.messageId).catch(() => null);
        if (!message || typeof message.edit !== 'function') {
            await cleanupSinglePanelRecords(ref.panelId, requestTopicId, idx);
            return { flipped: false, reason: 'message-gone' };
        }
        await message.edit({ flags, components });
        pendingSingleV2Panels.delete(ref.panelId);
        await cleanupSinglePanelRecords(ref.panelId, requestTopicId, idx);
        console.log(`[SINGLE-V2] Panel ${ref.panelId} flipped to completed for #${requestTopicId}${idx !== null ? `/${idx}` : ''} (${me || '?'})`);
        return { flipped: true };
    } catch (err) {
        console.warn(`[SINGLE-V2] Completion flip failed for #${requestTopicId}: ${err.message}`);
        return { flipped: false, reason: err.message };
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
 * Restart healing for button presses on panels unknown to this process:
 * look the panelId up in the Firebase registry, rebuild the snapshot from
 * the live row, and re-seat the in-memory entry against the pressed message
 * so the press just works. Returns true when healed.
 */
async function healSinglePanelFromPress(interaction, panelId) {
    try {
        const db = await singleV2Db();
        if (!db) return false;
        const reg = (await db.ref(`singlePanelById/${panelId}`).once('value')).val() || null;
        if (!reg || !reg.requestTopicId) return false;
        // Never resurrect a superseded panel onto the wrong message.
        if (reg.messageId && interaction.message?.id && reg.messageId !== interaction.message.id) return false;
        const entry = (await db.ref(`autopsy-requested/${reg.requestTopicId}`).once('value')).val() || {};
        const idx = (reg.caseIdx === null || reg.caseIdx === undefined) ? null : reg.caseIdx;
        const rec = (idx !== null && entry.cases && typeof entry.cases === 'object') ? (entry.cases[idx] || {}) : null;
        const r = rec || {};
        const snapshot = {
            me: r.assignedTo || entry.assignedTo || '',
            caseNumber: r.caseNum || entry.caseNum || entry.caseNumber || '',
            caseTitle: r.caseTitle || entry.caseTitle || entry.title || '',
            decedent: r.name || entry.name || '',
            ooc: r.oocName || entry.oocName || '',
            caseUrl: entry.caseUrl || r.caseUrl || '',
            deathType: (entry.parsed && entry.parsed.deathType) || entry.deathType || '',
            deadline: '',
            synopsis: (entry.parsed && entry.parsed.synopsis) || '',
            title: 'Autopsy Case Assigned',
        };
        snapshot.deadline = (await import('./assignmentWebhook.js')).deathTypeWindow(snapshot.deathType) || '';
        snapshot.deadlineUnix = await resolveDeadlineUnix(db, snapshot.me, reg.requestTopicId, snapshot.deathType);
        let discordId = null;
        if (snapshot.me) {
            try {
                const snap = await db.ref(`autopsy-requests/discord-members/${String(snapshot.me).toLowerCase()}`).once('value');
                discordId = snap.val() || null;
            } catch { /* bold-name fallback */ }
        }
        const rebuilt = buildSinglePanelV2Payload(panelId, {
            ...snapshot,
            loadUrl: `${SINGLE_V2_FORMS_URL}#/load/${reg.requestTopicId}/${idx === null ? 0 : idx}`,
        }, { discordId });
        pendingSingleV2Panels.set(panelId, {
            snapshot,
            requestTopicId: reg.requestTopicId,
            caseIdx: idx,
            channelId: reg.channelId || null,
            messageId: reg.messageId || interaction.message?.id || null,
            components: rebuilt.components,
            createdAt: Date.now(),
        });
        console.log(`[SINGLE-V2] Healed panel ${panelId} for #${reg.requestTopicId} after restart`);
        return true;
    } catch (err) {
        console.warn(`[SINGLE-V2] Heal failed for ${panelId}: ${err.message}`);
        return false;
    }
}

/**
 * Handle single-panel button presses (singlev2_<panelId>_<slot>).
 * Info replies with the all-data-at-once detail view; Reassign is
 * supervisor-gated and pops the ME picker modal; Cancel disables the rows.
 * A press on a panel unknown to this process (e.g. after a bot restart)
 * heals from the Firebase registry first — only a genuinely gone panel gets
 * the inactive notice.
 */
export async function handleSinglePanelV2Button(interaction) {
    if (!interaction || typeof interaction.isButton !== 'function' || !interaction.isButton()) return false;
    const customId = String(interaction.customId || '');
    if (!customId.startsWith(SINGLE_V2_PREFIX)) return false;
    const rest = customId.slice(SINGLE_V2_PREFIX.length);
    const sepIdx = rest.lastIndexOf('_');
    if (sepIdx === -1) return false;
    const panelId = rest.slice(0, sepIdx);
    const slot = rest.slice(sepIdx + 1);
    let pending = pendingSingleV2Panels.get(panelId);
    if (!pending) {
        const healed = await healSinglePanelFromPress(interaction, panelId).catch(() => false);
        if (healed) pending = pendingSingleV2Panels.get(panelId) || null;
    }
    if (!pending) {
        try {
            await interaction.reply({ content: 'This assignment panel is no longer active (bot restarted). The case thread still holds the full file.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] expired-panel notice ignored: interaction token already expired or double-acked; nothing left to inform */ }
        return true;
    }

    if (slot === SINGLE_V2_CANCEL_SLOT) {
        pendingSingleV2Panels.delete(panelId);
        try {
            await interaction.update({ components: disableV2Components(pending.components) });
        } catch (err) {
            console.warn(`[SINGLE-V2] Cancel update failed for ${panelId}: ${err.message}`);
        }
        return true;
    }

    if (slot === SINGLE_V2_INFO_SLOT) {
        try {
            let live = null;
            if (pending.requestTopicId) {
                const db = await singleV2Db();
                if (db) {
                    const snap = await db.ref(`autopsy-requested/${pending.requestTopicId}`).once('value').catch(() => null);
                    const entry = (snap && snap.val()) || {};
                    live = pending.caseIdx !== null && pending.caseIdx !== undefined && entry.cases
                        ? { ...(entry.cases[pending.caseIdx] || {}), caseUrl: entry.caseUrl || entry.cases[pending.caseIdx]?.caseUrl }
                        : entry;
                }
            }
            const { flags, components, metrics } = buildSingleFullDetailPayload(pending.snapshot, live);
            if (metrics.textChars > V2_TEXT_BUDGET || metrics.componentCount > V2_COMPONENT_BUDGET || metrics.topLevel > 10) {
                await interaction.reply({ content: 'Full detail is too large to render — open the case thread instead.', flags: MessageFlags.Ephemeral });
                return true;
            }
            await interaction.reply({ flags: flags | MessageFlags.Ephemeral, components });
            console.log(`[SINGLE-V2] Panel ${panelId}: full-detail view for ${interaction.user?.tag || 'unknown'}`);
        } catch (err) {
            console.warn(`[SINGLE-V2] Full-detail view failed for ${panelId}: ${err.message}`);
            try {
                await interaction.reply({ content: 'Could not load the full detail — try again in a moment.', flags: MessageFlags.Ephemeral });
            } catch { /* [OK] fallback error reply ignored: primary reply already failed, interaction likely expired; failure already warned above */ }
        }
        return true;
    }

    if (slot === SINGLE_V2_REASSIGN_SLOT) {
        return await openSingleReassignModal(interaction, panelId, pending);
    }

    try {
        await interaction.reply({ content: 'Selection not found on this panel.', flags: MessageFlags.Ephemeral });
    } catch { /* [OK] stale-selection notice ignored: interaction token already expired or double-acked */ }
    return true;
}

/**
 * Supervisor-gated Reassign picker for a single panel: one modal with the
 * live rotation as a required radio group. Unlinked panels fall back to
 * /reassign-autopsy (no Firebase row to execute against).
 */
export async function openSingleReassignModal(interaction, panelId, pending) {
    const { isSupervisorUp } = await import('./permissions.js');
    if (!isSupervisorUp(interaction)) {
        try {
            await interaction.reply({ content: 'Only Supervisors and up can reassign cases.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] supervisor-gate notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    if (!pending.requestTopicId) {
        try {
            await interaction.reply({ content: 'This panel is not linked to a live case — reassign via /reassign-autopsy.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] unlinked-panel notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    const db = await singleV2Db();
    if (!db) {
        try {
            await interaction.reply({ content: 'Firebase not ready — try again in a moment.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] db-not-ready notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    // Completed cases can't be reassigned (matters for healed panels whose
    // message outlived the completion flip).
    try {
        const rowPath = (pending.caseIdx === null || pending.caseIdx === undefined)
            ? `autopsy-requested/${pending.requestTopicId}/completedAt`
            : `autopsy-requested/${pending.requestTopicId}/cases/${pending.caseIdx}/completedAt`;
        const doneSnap = await db.ref(rowPath).once('value').catch(() => null);
        if (doneSnap && doneSnap.val()) {
            try {
                await interaction.reply({ content: 'This case is already completed — it cannot be reassigned.', flags: MessageFlags.Ephemeral });
            } catch { /* [OK] completed-case notice ignored: interaction token already expired or double-acked */ }
            return true;
        }
    } catch { /* check is best-effort; the core re-checks state anyway */ }
    const { getMeNames } = await import('../commands/reassign-autopsy.js');
    const meNames = (await getMeNames(db).catch(() => [])) || [];
    const meOptions = meNames.slice(0, 10).map((n) => ({ label: String(n).slice(0, 100), value: String(n).slice(0, 100) }));
    if (meOptions.length < 2) {
        try {
            await interaction.reply({ content: 'Not enough MEs on rotation to offer a pick — use /reassign-autopsy instead.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] short-rotation notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    try {
        const modal = new ModalBuilder()
            .setCustomId(`${SINGLE_V2_REASSIGN_MODAL_PREFIX}${panelId}`)
            .setTitle('Reassign this case');
        // Name the case being reassigned — without this the modal is just a
        // bare ME picker with zero body context (staff call).
        const snap = pending.snapshot || {};
        modal.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `Reassigning **${snap.decedent || 'Unknown'}**` +
                (snap.ooc ? ` ((${snap.ooc}))` : '') +
                (snap.caseNumber ? ` — Case #${snap.caseNumber}` : '') +
                (snap.me ? ` (currently **${snap.me}**)` : '')
            )
        );
        modal.addLabelComponents(
            new LabelBuilder()
                .setLabel('New medical examiner')
                .setRadioGroupComponent(
                    new RadioGroupBuilder()
                        .setCustomId('new_me')
                        .setRequired(true)
                        .setOptions(meOptions)
                )
        );
        await interaction.showModal(modal);
    } catch (err) {
        console.warn(`[SINGLE-V2] Panel ${panelId}: reassign modal failed: ${err.message}`);
        try {
            await interaction.reply({ content: 'Could not open the reassign form — use /reassign-autopsy instead.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] modal-failure fallback ignored: showModal already failed, interaction likely expired; failure already warned above */ }
    }
    return true;
}

/**
 * Handle the single-panel reassign modal submit
 * (singlev2_reasmodal_<panelId>). Supervisor re-checked; executes the shared
 * performReassign core (deferred first), confirms ephemerally.
 */
export async function handleSinglePanelV2ReassignModal(interaction) {
    if (!interaction || typeof interaction.isModalSubmit !== 'function' || !interaction.isModalSubmit()) return false;
    const customId = String(interaction.customId || '');
    if (!customId.startsWith(SINGLE_V2_REASSIGN_MODAL_PREFIX)) return false;
    const { isSupervisorUp } = await import('./permissions.js');
    if (!isSupervisorUp(interaction)) {
        try {
            await interaction.reply({ content: 'Only Supervisors and up can reassign cases.', flags: MessageFlags.Ephemeral });
        } catch { /* [OK] modal-submit gate notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    const panelId = customId.slice(SINGLE_V2_REASSIGN_MODAL_PREFIX.length);
    let newME = '';
    try {
        newME = String(interaction.fields?.getRadioGroup?.('new_me') || interaction.fields?.getString?.('new_me') || '').trim();
    } catch {
        newME = '';
    }
    const pending = pendingSingleV2Panels.get(panelId);
    if (!pending || !pending.requestTopicId || !newME) {
        try {
            await interaction.reply({ content: (!newME ? 'Pick a medical examiner first.' : 'Reassign expired — start again from the panel.'), flags: MessageFlags.Ephemeral });
        } catch { /* [OK] missing-pick notice ignored: interaction token already expired or double-acked */ }
        return true;
    }
    const db = await singleV2Db();
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
    const res = await performReassign({
        db,
        client: interaction.client,
        topicId: pending.requestTopicId,
        caseIdx: pending.caseIdx,
        newME,
    });
    try {
        if (res.already) {
            await interaction.editReply({ content: `Already assigned to **${newME}**.` });
        } else if (!res.ok) {
            await interaction.editReply({ content: `Reassign failed: ${res.error || 'unknown error'}` });
        } else {
            await interaction.editReply({ content: `Reassigned **${res.decedentName}** from **${res.currentAssigned}** to **${res.newME}**.` });
        }
    } catch (err) { console.warn(`[WARN] Panel ${panelId}: reassign executed but confirmation editReply failed: ${err.message}`); }
    return true;
}
