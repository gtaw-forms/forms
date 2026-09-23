/**
 * privateAutopsyPmMonitor.js — LSPD inbox intake for "[Private Autopsy]" PMs.
 *
 * TEST MODE (current): the full pipeline runs — inbox poll, subject match,
 * sender gate, addendum parse, approval embed with Approve/Deny — but live
 * case creation is locked behind PRIVATE_PM_INTAKE_LIVE=true (default false).
 * Approving while the flag is off posts a dry-run report of what WOULD be
 * created. Nothing is ever posted to any forum by this service while testing.
 *
 * Flow per new matching PM:
 *   1. List LSPD inbox, match subject tag, skip Firebase-processed IDs.
 *   2. Read + expand the PM body (spoiler addenda).
 *   3. Gate the sender: PRIVATE_PM_INTAKE_ALLOWED csv wins; else LSPD forum
 *      group membership when LSPD_PM_INTAKE_GROUP_ID is set; else deny+log.
 *   4. Post an approval draft (one field per decedent: name/OOC/PK-CK) with
 *      Approve/Deny buttons. Record Firebase processed status at each step so
 *      restarts never double-handle a PM.
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createIsolatedClient, getForumClient } from './forumClient.js';
import firebase from './firebase.js';

const SUBJECT_TAG = '[Private Autopsy]';
const POLL_MS = parseInt(process.env.PRIVATE_PM_INTAKE_INTERVAL_MS || `${30 * 60 * 1000}`, 10);
const FIRST_DELAY_MS = 60_000;
const LIVE = process.env.PRIVATE_PM_INTAKE_LIVE === 'true';

let _client = null;
let _timer = null;
let _running = false;

export function setPmIntakeClient(client) { _client = client; }

function intakeChannelId() {
    return (process.env.PRIVATE_PM_INTAKE_CHANNEL_ID || '').trim() || process.env.BOT_LOG_CHANNEL_ID || null;
}

function lspdCfg() {
    return {
        baseUrl: (process.env.FORUM_LSPD_URL || 'https://lspd.gta.world').replace(/\/$/, ''),
        username: process.env.FORUM_LSPD_USERNAME || '',
        password: process.env.FORUM_LSPD_PASSWORD || '',
    };
}

function allowlist() {
    return (process.env.PRIVATE_PM_INTAKE_ALLOWED || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** Strip "(OOC name)" suffixes from forum display names for comparison. */
function baseName(name) {
    return String(name || '').replace(/\s*\(.+\)\s*$/, '').trim().toLowerCase();
}

/**
 * All aliases a sender string claims: the base name plus every parenthetical,
 * e.g. "Marcus Ward (Chris Wright)" -> ["marcus ward", "chris wright"].
 * People operate multiple LSPD forum names — the gate trusts the origin
 * person, so ANY listed alias passing is sufficient.
 */
function senderCandidates(sender) {
    const s = String(sender || '');
    const out = new Set();
    const base = baseName(s);
    if (base) out.add(base);
    const pm = s.match(/\(([^)]+)\)/);
    if (pm) {
        for (const part of pm[1].split(/[,/&]/)) {
            const t = part.trim().toLowerCase();
            if (t) out.add(t);
        }
    }
    return [...out];
}

// ── Addendum parser (rendered PM text) ──

/**
 * Split an expanded PM body into cover + per-addendum chunks, then parse
 * Sections 1-4 of each addendum from the rendered text.
 */
export function parsePrivateAutopsyPm(bodyText) {
    const text = String(bodyText || '');
    const cfM = text.match(/CF\s*No\.\s*([^\n]+)/i);
    const cover = { cfNo: cfM ? cfM[1].trim().slice(0, 40) : null };

    // NOTE: V8 split() drops the segment when a zero-width lookahead matches
    // at index 0, so a blind slice(1) would eat a leading addendum. Filter by
    // content instead — correct whether or not cover text precedes ADDENDUM A.
    const chunks = text
        .split(/(?=ADDENDUM\s+[A-Z]\s*:)/i)
        .map((s) => s.trim())
        .filter((s) => /^ADDENDUM\s+[A-Z]\s*:/i.test(s));
    const bodies = [];
    for (const chunk of chunks) {
        const labelM = chunk.match(/ADDENDUM\s+([A-Z])\s*:/i);
        const label = labelM ? labelM[1].toUpperCase() : '?';
        const sec2i = chunk.search(/SECTION\s*2/i);
        const sec3i = chunk.search(/SECTION\s*3/i);
        const sec4i = chunk.search(/SECTION\s*4/i);
        if (sec2i === -1) continue;

        const sec1 = chunk.slice(0, sec2i);
        const sec2 = chunk.slice(sec2i, sec3i === -1 ? undefined : sec3i);
        const sec3 = sec3i === -1 ? '' : chunk.slice(sec3i, sec4i === -1 ? undefined : sec4i);
        const sec4 = sec4i === -1 ? '' : chunk.slice(sec4i);

        // Rendered text may run fields together on one line — force each
        // "N.)" marker onto its own line first so line-anchored matching works.
        // labelRe must not contain a top-level alternation (wrap in (?:...)).
        const grab = (section, n, labelRe) => {
            const norm = String(section).replace(/(\d+\.?\))/g, '\n$1');
            const lines = norm.split('\n');
            for (let li = 0; li < lines.length; li++) {
                const m = lines[li].match(new RegExp(`^\\s*${n}\\.?\\)\\s*(?:${labelRe})\\s*:?\\s*(.*)$`, 'i'));
                if (!m) continue;
                let value = (m[1] || '').replace(/^:\s*/, '').trim();
                if (value) return value;
                // Label on its own line with the value on the next line(s).
                for (let lj = li + 1; lj < Math.min(li + 3, lines.length); lj++) {
                    const nxt = lines[lj].trim();
                    if (!nxt) continue;
                    if (/^\d+\.?\)/.test(nxt) || /^SECTION\s*\d/i.test(nxt)) break;
                    return nxt;
                }
                return '';
            }
            return '';
        };

        const requesterName = grab(sec1, 1, 'Name');
        const decedentRaw = grab(sec2, 1, 'Name');
        const oocM = decedentRaw.match(/\(\(\s*(.+?)\s*\)\)/);
        const pkckM = sec4.match(/PK\s*\/\s*CK\s*:?\s*([A-Za-z]+)/i);

        bodies.push({
            label,
            requester: {
                name: requesterName,
                rank: grab(sec1, 2, 'Rank'),
                assignment: grab(sec1, 3, 'Department\\s*/\\s*Assignment'),
                badge: grab(sec1, 4, 'Badge(?:\\/Serial Number| Number)?|Serial'),
                guidelines: grab(sec1, 5, 'Read and understood Autopsy Guidelines'),
                contact: grab(sec1, 6, 'Contact Information'),
            },
            decedent: {
                raw: decedentRaw,
                name: decedentRaw.replace(/\s*\(\(.+?\)\)\s*/g, '').trim() || decedentRaw,
                oocName: oocM ? oocM[1].trim() : '',
                gender: grab(sec2, 2, 'Gender'),
                ethnicity: grab(sec2, 3, 'Ethnicity'),
                dateOfDeath: grab(sec2, 4, 'Date of Death'),
                timeOfDeath: grab(sec2, 5, 'Time of Death'),
                location: grab(sec2, 6, 'Location'),
            },
            synopsis: grab(sec3, 1, 'Synopsis'),
            reason: grab(sec3, 2, 'Reason for Autopsy'),
            pkck: pkckM ? pkckM[1].toUpperCase().slice(0, 10) : '',
        });
    }
    return { cover, bodies };
}

// ── Dry-run: case BBCode builder + assignment preview ──
// buildIntakeCaseBbcode reproduces the ORIGINAL request sections as the case
// topic content — no invented headers/footers. Provenance (source PM, CF,
// delivery target) lives in the Firebase entry + Discord embeds, not in the
// forum post. This is EXACTLY what the future live path will post.

export function buildIntakeCaseBbcode(pm, body, cfNo) {
    const d = body.decedent;
    const r = body.requester;
    const ooc = d.oocName ? `((${d.oocName}))` : '';
    const nameLine = ooc ? `1.) Name: ${d.name} ${ooc}` : `1.) Name: ${d.name}`;
    return [
        '[divbox=white]',
        '[b]SECTION 1: REQUESTER\'S INFORMATION[/b]',
        `1.) Name: ${r.name || 'Unknown'}`,
        `2.) Rank: ${r.rank || 'Unknown'}`,
        `3.) Department / Assignment: ${r.assignment || 'Unknown'}`,
        `4.) Badge/Serial Number: ${r.badge || 'Unknown'}`,
        ...(r.guidelines ? [`5.) Read and understood Autopsy Guidelines: ${r.guidelines}`] : []),
        `6.) Contact Information: ${r.contact || 'Unknown'}`,
        '[/divbox]',
        '[divbox=white]',
        '[b]SECTION 2: DECEDENT\'S INFORMATION[/b]',
        nameLine,
        `2.) Gender: ${d.gender || 'Unknown'}`,
        `3.) Ethnicity: ${d.ethnicity || 'Unknown'}`,
        `4.) Date of Death: ${d.dateOfDeath || 'Unknown'}`,
        `5.) Time of Death: ${d.timeOfDeath || 'Unknown'}`,
        `6.) Location: ${d.location || 'Unknown'}`,
        '[/divbox]',
        '[divbox=white]',
        '[b]SECTION 3: DETAILS[/b]',
        `1.) Synopsis: ${body.synopsis || 'Unknown'}`,
        `2.) Reason for Autopsy: ${body.reason || 'Unknown'}`,
        '[/divbox]',
        '[divbox=white]',
        '[b]SECTION 4: OOC INFORMATION[/b]',
        `1.) PK/CK: ${body.pkck || 'Unknown'}`,
        '[/divbox]',
    ].join('\n');
}

/**
 * Simulate ME assignment for N bodies using the live rotation state.
 * Read-only: mirrors the mass-autopsy dry-run preview, never writes.
 * @returns {Promise<string[]>} ME name per body ('(none available)' fallback)
 */
export async function previewIntakeAssignments(db, count) {
    const { getRotationStatus } = await import('./autopsyRotation.js');
    const status = await getRotationStatus(db);
    if (!status.configured || !status.list.length) return Array(count).fill('(rotation not configured)');
    const { list, position } = status;
    const activeCounts = {};
    const loaSet = new Set();
    for (const m of status.meStatus || []) {
        activeCounts[m.name.toLowerCase()] = m.activeCases;
        if (m.onLoa) loaSet.add(m.name.toLowerCase());
    }
    const out = [];
    let pos = position;
    for (let i = 0; i < count; i++) {
        let assigned = null;
        for (let j = 0; j < list.length; j++) {
            const candidate = list[(pos + j) % list.length];
            const cl = candidate.toLowerCase();
            if (loaSet.has(cl)) continue;
            if ((activeCounts[cl] || 0) > 0) continue;
            assigned = candidate;
            pos = (pos + j + 1) % list.length;
            activeCounts[cl] = (activeCounts[cl] || 0) + 1;
            break;
        }
        if (!assigned) {
            const eligible = list.filter((m) => !loaSet.has(m.toLowerCase()));
            if (eligible.length > 0) {
                eligible.sort((a, b) => (activeCounts[a.toLowerCase()] || 0) - (activeCounts[b.toLowerCase()] || 0));
                assigned = eligible[0];
            }
        }
        out.push(assigned || '(none available)');
    }
    return out;
}

// ── Sender gate ──

async function senderPassesGate(isolatedClient, sender, baseUrl) {
    const candidates = senderCandidates(sender);
    const allowed = allowlist();
    if (allowed.length > 0) {
        const ok = candidates.some((c) => allowed.includes(c));
        console.log(`[PM-INTAKE] Allowlist check "${sender}" [${candidates.join('|')}] -> ${ok ? 'PASS' : 'DENY'}`);
        return { ok, via: 'allowlist' };
    }
    const groupId = (process.env.LSPD_PM_INTAKE_GROUP_ID || '').trim();
    if (groupId) {
        try {
            const members = await isolatedClient.getGroupMembers(groupId, { baseUrl, paginate: true });
            const roster = new Set(members.flatMap((m) => senderCandidates(m.name)));
            const ok = candidates.some((c) => roster.has(c));
            console.log(`[PM-INTAKE] LSPD group g=${groupId} check "${sender}" -> ${ok ? 'PASS' : 'DENY'} (${members.length} members)`);
            return { ok, via: `lspd-group-g${groupId}` };
        } catch (err) {
            console.warn(`[PM-INTAKE] Group check failed: ${err.message}`);
            return { ok: false, via: 'group-check-error' };
        }
    }
    console.log(`[PM-INTAKE] No gate configured (no allowlist, no group ID) — DENY "${sender}"`);
    return { ok: false, via: 'no-gate-configured' };
}

// ── Sender account resolution ──
// Rule: always log and deliver by the forum ACCOUNT the PM came from — never
// character names from the body or signature ("Marcus Ward (Chris Wright)"
// resolves to account "Chris Wright"; "Marcus Ward" alone resolves nothing).
// Candidates: parenthetical first (proven account position), then base name.
function senderAccountCandidates(sender) {
    const s = String(sender || '');
    const out = [];
    const pm = s.match(/\(([^)]+)\)/);
    if (pm) {
        for (const part of pm[1].split(/[,/&]/)) {
            const t = part.trim();
            if (t) out.push(t);
        }
    }
    const base = baseName(s);
    if (base) out.push(base);
    const full = s.trim();
    if (full) out.push(full);
    return [...new Set(out)];
}

async function resolveSenderAccount(isolatedClient, sender, baseUrl) {
    const candidates = senderAccountCandidates(sender);
    const account = await isolatedClient.resolveMemberUsername(candidates, { baseUrl }).catch(() => null);
    return { account, candidates, verified: !!account };
}

// ── Poll cycle ──

export async function pollOnce() {
    if (_running) return;
    _running = true;
    try {
        const { baseUrl, username, password } = lspdCfg();
        if (!username || !password) {
            console.warn('[PM-INTAKE] LSPD credentials not configured — skipping cycle');
            return;
        }
        firebase.init();
        const db = firebase.db;

        const client = createIsolatedClient('lspd-pm-intake');
        try {
            // Reuse-first: login() falls back to the credential form when the
            // stored session is dead, so steady polls skip redundant logins.
            await client.login(username, password, { force: false, baseUrl });
            const pms = await client.getPrivateMessages({ baseUrl });
            // Inbox link text is multiline on this theme — flatten before matching.
            const flat = (s) => String(s || '').replace(/\s+/g, ' ').trim();
            const hits = pms.filter((pm) => flat(pm.subject).toLowerCase().includes(SUBJECT_TAG.toLowerCase()));
            if (hits.length === 0) return;

            for (const pm of hits) {
                const nodeRef = db.ref(`private-pm-intake/processed/${pm.msgId}`);
                const existing = (await nodeRef.once('value')).val();
                if (existing) {
                    // Fail-closed crash guard: a node stuck in 'creating' means the
                    // process died mid-post. Never auto-retry (that reposts) —
                    // alert once and leave it for a human.
                    if (existing.status === 'creating' && !existing.stuckWarned
                        && Date.now() - new Date(existing.claimedAt || 0).getTime() > 3600_000) {
                        await nodeRef.update({ stuckWarned: true });
                        await alertIntake(`PM Intake Stuck — p=${pm.msgId}`,
                            `Creation started by **${existing.claimedBy || '?'}** over an hour ago and never finished. Check f=266 for partial posts before handling manually — auto-retry is disabled to prevent duplicates.`,
                            0xe74c3c);
                    }
                    continue; // approved / denied / pending / creating — never re-handle
                }

                const read = await client.readPrivateMessage(pm.msgId, { baseUrl });
                // Prefer the view page's authoritative identity over the inbox row.
                // Inbox fallback: flatten + strip the theme's "Private Message from X:" prefix.
                const sender = read?.sender || pm.sender;
                const subject = read?.subject || flat(pm.subject).replace(/^private message from[^:]+:\s*/i, '').replace(/^["\s]+|["\s]+$/g, '');
                if (!read) {
                    await nodeRef.set({ status: 'unreadable', subject, sender, at: new Date().toISOString() });
                    await alertIntake(`PM Intake Unreadable — p=${pm.msgId}`,
                        `Matched "${subject}" from **${sender}**, but the PM body came back empty. Inspect [the PM](https://lspd.gta.world/ucp.php?i=pm&mode=view&f=0&p=${pm.msgId}) manually.`);
                    continue;
                }

                console.log(`[PM-INTAKE] New match: p=${pm.msgId} "${subject}" from ${sender}`);
                const parsed = parsePrivateAutopsyPm(read.bodyText);
                if (parsed.bodies.length === 0) {
                    await nodeRef.set({ status: 'no-addenda', subject, sender, at: new Date().toISOString() });
                    await alertIntake(`PM Intake Unparseable — p=${pm.msgId}`,
                        `Matched "${subject}" from **${sender}**, but no "ADDENDUM X:" sections parsed (new format?). Inspect [the PM](https://lspd.gta.world/ucp.php?i=pm&mode=view&f=0&p=${pm.msgId}) and adapt the parser.`);
                    continue;
                }

                const gate = await senderPassesGate(client, sender, baseUrl);
                if (!gate.ok) {
                    await notifyGateDeny({ ...pm, subject, sender }, gate.via);
                    await nodeRef.set({ status: 'denied-gate', via: gate.via, subject, sender, at: new Date().toISOString() });
                    continue;
                }

                // Resolve the SENDER ACCOUNT now (not at delivery time) so the
                // draft itself records who this came from. Signatures and
                // character names never resolve — only the forum account does.
                const { account, verified } = await resolveSenderAccount(client, sender, baseUrl);
                console.log(`[PM-INTAKE] Sender account for "${sender}" -> ${account || '(unresolved)'}`);

                // Claim the node BEFORE posting the draft so an instant Approve
                // click can never see a null node (post-then-set race).
                await nodeRef.set({
                    status: 'pending-approval', subject, sender,
                    account: account || null, accountUnverified: !verified,
                    cfNo: parsed.cover.cfNo, bodies: parsed.bodies.length,
                    url: read.url, draftId: null, at: new Date().toISOString(),
                });
                try {
                    const draftMsg = await postApprovalDraft({ ...pm, subject, sender, account }, parsed, read.url);
                    await nodeRef.update({ draftId: draftMsg?.id || null });
                } catch (draftErr) {
                    await nodeRef.set({
                        status: 'draft-failed', subject, sender, error: String(draftErr.message || draftErr).slice(0, 200),
                        at: new Date().toISOString(),
                    });
                    console.warn(`[PM-INTAKE] Draft post failed p=${pm.msgId}: ${draftErr.message}`);
                    await alertIntake(`PM Intake Draft Failed — p=${pm.msgId}`,
                        `Matched "${subject}" from **${sender}**, but the approval draft could not post: \`${String(draftErr.message || draftErr).slice(0, 200)}\``);
                    continue;
                }
            }
        } finally {
            await client.close().catch(() => {});
        }
    } catch (err) {
        console.warn(`[PM-INTAKE] Cycle skipped: ${err.message}`);
    } finally {
        _running = false;
    }
}

async function sendToIntakeChannel(payload) {
    if (!_client) { console.warn('[PM-INTAKE] No Discord client registered'); return null; }
    const channelId = intakeChannelId();
    if (!channelId) { console.warn('[PM-INTAKE] No intake channel configured'); return null; }
    const channel = await _client.channels.fetch(channelId).catch(() => null);
    if (!channel) { console.warn(`[PM-INTAKE] Cannot fetch channel ${channelId}`); return null; }
    return channel.send(payload);
}

/** One-line Discord alert to the intake channel (never throws). */
async function alertIntake(title, description, color = 0xe67e22) {
    await sendToIntakeChannel({
        embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp()],
    }).catch(() => {});
}

async function notifyGateDeny(pm, via) {
    console.log(`[PM-INTAKE] Gate DENY p=${pm.msgId} sender="${pm.sender}" via=${via}`);
    await sendToIntakeChannel({
        embeds: [new EmbedBuilder()
            .setColor(0x6c757d)
            .setTitle(`PM Intake Denied — ${pm.subject || '(no subject)'}`)
            .setDescription(`Sender **${pm.sender}** failed the intake gate (\`${via}\`). No case created.`)
            .setTimestamp()],
    }).catch(() => {});
}

async function postApprovalDraft(pm, parsed, pmUrl) {
    const fields = parsed.bodies.map((b) => ({
        name: `${b.label} — ${b.decedent.name}${b.decedent.oocName ? ` ((${b.decedent.oocName}))` : ' (OOC unknown)'}`,
        value: [
            `**PK/CK:** ${b.pkck || 'unknown'}`,
            `**Location:** ${b.decedent.location || 'unknown'}`,
            `**DOD:** ${b.decedent.dateOfDeath || '?'} ${b.decedent.timeOfDeath || ''}`.trim(),
            `**Reason:** ${b.reason || 'unknown'}`.slice(0, 200),
        ].join('\n').slice(0, 1024),
        inline: false,
    }));
    const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`Private Autopsy Request — ${parsed.bodies.length} bod${parsed.bodies.length > 1 ? 'ies' : 'y'}`)
        .setDescription([
            `**From:** ${pm.sender}`,
            `**Forum account:** ${pm.account || '(unresolved — delivery blocked until resolved)'}`,
            `**Subject:** ${pm.subject}`,
            parsed.cover.cfNo ? `**CF No:** ${parsed.cover.cfNo}` : null,
            `**PM:** [Open in LSPD inbox](${pmUrl})`,
            LIVE ? '' : '_TEST MODE — approving simulates only; no forum posts._',
        ].filter(Boolean).join('\n'))
        .addFields(fields)
        .setFooter({ text: `PM p=${pm.msgId} · approve to ${LIVE ? 'create private cases' : 'SIMULATE (live posting disabled)'}` })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`pmintake_ok_${pm.msgId}`).setLabel('Approve').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`pmintake_no_${pm.msgId}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
    );
    const sent = await sendToIntakeChannel({ embeds: [embed], components: [row] });
    console.log(`[PM-INTAKE] Approval draft posted for p=${pm.msgId} (${parsed.bodies.length} bodies)`);
    return sent;
}

// ── Live creation (go-live only) ──

const PHMC_BASE = 'https://phmc.gta.world';
const CASE_MGMT_FORUM_ID = 266;

// Serializes live runs inside this process (pm2 runs a single instance).
// A second Approve that slips past the status check waits here, then finds
// every addendum already recorded and posts nothing.
let _liveTail = Promise.resolve();
function runLiveExclusive(fn) {
    const prev = _liveTail;
    let release;
    _liveTail = new Promise((resolve) => { release = resolve; });
    return prev.then(fn).finally(() => release());
}

/**
 * Create one private f=266 case per addendum body. Idempotent per body:
 * `private-pm-intake/created/<msgId>/<label>` records every posted topic, so
 * a retried run skips addenda that already have a case instead of reposting.
 * Mirrors the /assign-autopsy creation flow (title convention, ME assignment,
 * title edit, assignment reply, Firebase entry, rotation record).
 *
 * @returns {Promise<Array<{label,name,oocName,caseNum,topicId,url,assignedTo,reused}>>}
 */
export async function executeLiveIntake(pm, parsed, onStep = () => {}) {
    const { selectME, recordAssignment } = await import('./autopsyRotation.js');
    firebase.init();
    const db = firebase.db;
    const client = getForumClient();
    await client.ensureBrowser();
    await client.login(null, null, { force: false, baseUrl: PHMC_BASE });

    // Next case numbers from the live f=266 topic list (fail-closed on error).
    let highest = 0;
    const existingTopics = await client.getForumTopics(CASE_MGMT_FORUM_ID, { baseUrl: PHMC_BASE });
    for (const t of existingTopics) {
        const m = (t.title || '').match(/Case\s*(\d+)/i);
        if (m) highest = Math.max(highest, parseInt(m[1], 10));
    }
    console.log(`[PM-INTAKE] f=266 highest case #${highest} — creating ${parsed.bodies.length} case(s)`);

    const cases = [];
    for (let i = 0; i < parsed.bodies.length; i++) {
        const body = parsed.bodies[i];
        const createdRef = db.ref(`private-pm-intake/created/${pm.msgId}/${body.label}`);
        const already = (await createdRef.once('value')).val();
        if (already?.topicId) {
            console.log(`[PM-INTAKE] Addendum ${body.label} already has topic #${already.topicId} — skipping (no repost)`);
            // A recovered case may have a topic but no staff notification yet
            // (crashed between post and notify). Notify exactly once, then flag.
            if (already.assignedTo && !already.notified) {
                try {
                    const { notifyAssignment } = await import('./meDiscordNotify.js');
                    await notifyAssignment(db, already.assignedTo,
                        `Case ${already.caseNum} - ${already.name}${already.oocName ? ` ((${already.oocName}))` : ''} [PRIVATE] - ${already.assignedTo}`,
                        already.url, { decedent: already.name, ooc: already.oocName, caseNumber: already.caseNum, deathType: body.pkck === 'PK' ? 'PK' : 'CK' });
                    await createdRef.update({ notified: true });
                    console.log(`[PM-INTAKE] Late notify sent for reused Case #${already.caseNum}`);
                } catch (e) { console.warn(`[PM-INTAKE] Late notify failed #${already.caseNum}: ${e.message}`); }
            }
            cases.push({ ...already, label: body.label, reused: true });
            continue;
        }

        // One bad addendum must not kill the rest: failures are collected and
        // reported, the loop continues, and the node lands 'completed-partial'.
        try {
        const caseNum = String(highest + i + 1);
        const name = body.decedent.name || 'Unknown';
        const ooc = body.decedent.oocName || '';
        const caseTitle = `Case ${caseNum} - ${name}${ooc ? ` ((${ooc}))` : ''} [PRIVATE] - UNASSIGNED`;
        const bbcode = buildIntakeCaseBbcode(pm, body, parsed.cover.cfNo);

        await onStep(`Posting Addendum ${body.label} as Case #${caseNum}...`);
        const postResult = await client.postTopic(CASE_MGMT_FORUM_ID, caseTitle, bbcode);
        if (!postResult.ok) throw new Error(`Addendum ${body.label}: topic post failed (${postResult.reason || 'unknown'})`);
        const tMatch = (postResult.url || '').match(/[?&]t=(\d+)/);
        if (!tMatch) throw new Error(`Addendum ${body.label}: no topic ID in ${postResult.url}`);
        const topicId = tMatch[1];

        // Assign ME (explicit preview was advisory; rotation decides live).
        const assignedName = await selectME(db, topicId, caseNum);
        if (assignedName) {
            try {
                await client.editTopicTitle(topicId, CASE_MGMT_FORUM_ID, caseTitle.replace('- UNASSIGNED', `- ${assignedName}`), { baseUrl: PHMC_BASE });
            } catch (e) { console.warn(`[PM-INTAKE] Title edit failed #${caseNum}: ${e.message}`); }
            try {
                const memberList = await client.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'] });
                const uid = memberList.find((m) => m.name.toLowerCase() === assignedName.toLowerCase())?.userId || '0';
                await client.replyToTopic(topicId, CASE_MGMT_FORUM_ID,
                    `[quote="${assignedName}" user_id=${uid}]\n[/quote]\n\n[b]${assignedName}[/b] - You have been assigned this autopsy case file.`,
                    { dryRun: false, baseUrl: PHMC_BASE });
            } catch (e) { console.warn(`[PM-INTAKE] Assignment reply failed #${caseNum}: ${e.message}`); }
        }

        // pmRecipient is the resolved forum ACCOUNT (never a signature or
        // character name). Refuse rather than guess — an undeliverable
        // recipient fails the whole batch loudly instead of silently.
        const pmRecipient = String(pm.account || '').trim();
        if (!pmRecipient) throw new Error('no resolved forum account for delivery (sender could not be matched to a forum account)');
        const entry = {
            title: `Confidential Autopsy - ${name}${ooc ? ` ((${ooc}))` : ''} [PRIVATE]`,
            name, oocName: ooc, faction: 'PRIVATE',
            topicUrl: null, caseUrl: postResult.url, topicId, caseTopicId: topicId,
            caseNum, detectedAt: new Date().toISOString(), wasMatch: true,
            assignedTo: assignedName || null, isPrivate: true,
            pmForum: 'lspd', pmRecipient,
            pmMsgId: String(pm.msgId), pmLabel: body.label, pmCfNo: parsed.cover.cfNo || null,
            pmGroup: String(pm.msgId), intakeLive: true,
            parsed: {
                requesterName: pm.sender, deathType: body.pkck === 'PK' ? 'PK' : 'CK',
                dateOfDeath: body.decedent.dateOfDeath || '', timeOfDeath: body.decedent.timeOfDeath || '',
                placeOfDeath: body.decedent.location || '', decedentName: body.decedent.raw || name,
                oocName: ooc, gender: body.decedent.gender || '', ethnicity: body.decedent.ethnicity || '',
            },
        };
        await db.ref(`autopsy-requested/${topicId}`).set(entry);
        const record = { label: body.label, name, oocName: ooc, caseNum, topicId, url: postResult.url, assignedTo: assignedName || null };
        await createdRef.set({ ...record, at: new Date().toISOString() });
        if (assignedName) {
            await recordAssignment(db, assignedName, topicId, caseNum).catch((e) => console.warn(`[PM-INTAKE] Rotation record failed: ${e.message}`));
            // Standard staff notification (ME ping + PHMC #autopsies post), same
            // as the normal flow. Runs only here (post-approval live path),
            // exactly once — flagged on the created record (see reuse branch).
            try {
                const { notifyAssignment } = await import('./meDiscordNotify.js');
                await notifyAssignment(db, assignedName, caseTitle.replace('- UNASSIGNED', `- ${assignedName}`), postResult.url, {
                    decedent: name,
                    ooc,
                    caseNumber: caseNum,
                    deathType: body.pkck === 'PK' ? 'PK' : 'CK',
                });
                await createdRef.update({ notified: true });
            } catch (e) { console.warn(`[PM-INTAKE] ME notify failed #${caseNum}: ${e.message}`); }
        }
        cases.push({ ...record, reused: false });
        console.log(`[PM-INTAKE] Addendum ${body.label} -> Case #${caseNum} topic #${topicId} (${assignedName || 'UNASSIGNED'})`);
        } catch (err) {
            console.error(`[PM-INTAKE] Addendum ${body.label} FAILED: ${err.message} — continuing with the rest`);
            cases.push({ label: body.label, name: body.decedent.name || 'Unknown', failed: true, error: String(err.message || err).slice(0, 200) });
            try { await onStep(`Addendum ${body.label} failed (${String(err.message || err).slice(0, 120)}) — continuing...`); } catch { /* best effort */ }
        }
    }
    return cases;
}

// ── Button handling ──

export async function handlePmIntakeButton(interaction) {
    const deny = interaction.customId.startsWith('pmintake_no_');
    const msgId = interaction.customId.replace(/^pmintake_(ok|no)_/, '');
    try {
        const { isSupervisorUp } = await import('./permissions.js');
        if (!isSupervisorUp(interaction)) {
            await interaction.reply({ content: 'Only Supervisors and up can approve private autopsy intake.', flags: MessageFlags.Ephemeral });
            return;
        }
        firebase.init();
        const nodeRef = firebase.db.ref(`private-pm-intake/processed/${msgId}`);
        // Read-check-set claim (NOT a transaction — proven live that this admin
        // SDK runs the update fn once with a cold null and aborts without
        // retry, so every transaction-claim bounced). Double handling is
        // prevented by this check + immediate button strip + serialized live
        // runs + per-addendum created-records.
        const node = (await nodeRef.once('value')).val();
        if (!node || node.status !== 'pending-approval') {
            console.log(`[PM-INTAKE] Button ignored p=${msgId} (status=${node?.status || 'missing'})`);
            await interaction.reply({ content: 'This request is no longer pending.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (deny) {
            await nodeRef.update({ status: 'denied', deniedBy: interaction.user.tag, deniedAt: new Date().toISOString() });
            await interaction.update({ components: [] });
            await interaction.followUp({ content: `[DENIED] PM p=${msgId} intake denied by ${interaction.user.tag}. No cases created.`, flags: MessageFlags.Ephemeral });
            console.log(`[PM-INTAKE] p=${msgId} DENIED by ${interaction.user.tag}`);
            return;
        }

        // Approve — claim the node. NOTE: RTDB transactions are NOT usable as
        // a claim primitive here: this admin SDK invokes the update fn once
        // with a cold null and aborts without retry (proven live), so every
        // Approve bounced. Instead: read-check-set (the read above) + strip
        // buttons immediately + serialize live runs below. A ms-scale double
        // click resolves via the per-addendum created-records (second runner
        // skips everything) and the stripped buttons.
        await nodeRef.update({ status: 'creating', claimedBy: interaction.user.tag, claimedAt: new Date().toISOString() });
        await interaction.update({ components: [] }); // ack + strip buttons immediately

        if (!LIVE) {
            await nodeRef.update({ status: 'approved-test', approvedBy: interaction.user.tag, approvedAt: new Date().toISOString() });
            await interaction.followUp({
                content: [
                    `[TEST APPROVE] PM p=${msgId} — would create **${node.bodies || '?'}** private case(s) (f=266, rotation assignment, completion PMs to **${node.sender}** on LSPD).`,
                    'Live posting is disabled (`PRIVATE_PM_INTAKE_LIVE` not true) — nothing was posted.',
                ].join('\n'),
                flags: MessageFlags.Ephemeral,
            });
            console.log(`[PM-INTAKE] p=${msgId} TEST-APPROVED by ${interaction.user.tag} (no forum posts)`);
            return;
        }

        // ── LIVE creation (serialized: one live run at a time per process) ──
        await interaction.followUp({ content: `[LIVE] Creating **${node.bodies || '?'}** private case(s) for PM p=${msgId}...`, flags: MessageFlags.Ephemeral });
        try {
            const cases = await runLiveExclusive(async () => {
                const { createIsolatedClient } = await import('./forumClient.js');
                const lspdClient = createIsolatedClient('lspd-pm-intake-live');
                let parsed;
                try {
                    const { baseUrl } = lspdCfg();
                    await lspdClient.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: true, baseUrl });
                    const read = await lspdClient.readPrivateMessage(msgId, { baseUrl });
                    if (!read) throw new Error('could not re-read PM body');
                    parsed = parsePrivateAutopsyPm(read.bodyText);
                    if (parsed.bodies.length === 0) throw new Error('no addenda parsed on re-read');
                } finally {
                    await lspdClient.close().catch(() => {});
                }
                const pm = { msgId, subject: node.subject, sender: node.sender, account: node.account || null };
                return executeLiveIntake(pm, parsed, async (step) => {
                    try { await interaction.followUp({ content: `[LIVE] ${step}`, flags: MessageFlags.Ephemeral }); }
                    catch { /* best effort */ }
                });
            });
            const failed = cases.filter((c) => c.failed);
            const partial = failed.length > 0;
            await nodeRef.update({
                status: partial ? 'completed-partial' : 'completed',
                completedBy: interaction.user.tag, completedAt: new Date().toISOString(),
                cases: cases.map((c) => ({ label: c.label, caseNum: c.caseNum, topicId: c.topicId, assignedTo: c.assignedTo, failed: !!c.failed, error: c.error || null })),
            });
            const allReused = cases.length > 0 && cases.every((c) => c.reused);
            await interaction.followUp({
                content: [`[DONE] PM p=${msgId} — **${cases.length}** private case(s)${allReused ? ' (all already existed — nothing reposted)' : partial ? ' (PARTIAL — see failures)' : ':'}`,
                    ...cases.map((c) => c.failed
                        ? `[FAIL] Addendum ${c.label} (${c.name}): ${c.error}`
                        : `${c.reused ? '[SKIPPED duplicate]' : '[OK]'} Addendum ${c.label}: Case #${c.caseNum} → ${c.assignedTo || 'UNASSIGNED'} — ${c.url}`),
                ].join('\n'),
                flags: MessageFlags.Ephemeral,
            });
            console.log(`[PM-INTAKE] p=${msgId} ${partial ? 'COMPLETED-PARTIAL' : 'COMPLETED'} live by ${interaction.user.tag} (${cases.length} cases, ${failed.length} failed)`);
            if (partial) {
                await alertIntake(`PM Intake Partial — p=${msgId}`,
                    `**${failed.length}** addendum/a failed: ${failed.map((c) => `${c.label} (${c.error})`).join('; ')}. Completed cases are recorded — retry or handle manually.`,
                    0xe74c3c);
            }
        } catch (err) {
            await nodeRef.update({ status: 'failed', error: err.message, failedAt: new Date().toISOString() });
            try { await interaction.followUp({ content: `[ERR] Live creation failed: ${err.message} — node marked failed (check f=266 before retrying; per-addendum records prevent reposts).`, flags: MessageFlags.Ephemeral }); }
            catch { /* best effort */ }
            console.error(`[PM-INTAKE] p=${msgId} LIVE FAILED: ${err.message}`);
        }
    } catch (err) {
        console.error(`[PM-INTAKE] Button error p=${msgId}: ${err.message}`);
        try {
            await interaction.reply({ content: `Error: ${err.message}`, flags: MessageFlags.Ephemeral });
        } catch { /* already acked */ }
    }
}

// ── Startup ──

export function startPrivateAutopsyPmMonitor({ immediate = true } = {}) {
    if (_timer) return;
    console.log(`[PM-INTAKE] Starting LSPD PM intake (every ${Math.round(POLL_MS / 60000)}min, live=${LIVE}, tag="${SUBJECT_TAG}")`);
    // The phased boot queue runs the first poll itself — pass
    // { immediate: false } there to avoid a double first poll.
    if (immediate) {
        setTimeout(() => pollOnce().catch(() => {}), FIRST_DELAY_MS);
    }
    _timer = setInterval(() => pollOnce().catch(() => {}), POLL_MS);
}
