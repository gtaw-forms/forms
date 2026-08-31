/**
 * requesterWebhook.js — Faction completion notifications for autopsy requests.
 *
 * When an autopsy completes for a CASELINK-posted request, posts a notification
 * to the requesting faction's Discord webhook:
 *
 *   content   <@ID> ping when a numeric Discord ID resolves (from the request's
 *             Contact Information or the officer-discord mapping), otherwise a
 *             bold-name salutation: "Katherine Olsen, your autopsy request ..."
 *   embed     Case NR/title, Medical Examiner name, ME Discord mention
 *   buttons   CASELINK (faction's autopsy-record forum — deep link when the bot
 *             replied there), PHMC Inbox, PHMC Discord invite
 *
 * Faction routing mirrors AGENCY_FORUMS in the monitor/completion pipeline.
 * NOTE: LSSD/SADCR/DAO forums all live on lssd.gta.world — link constants share
 * one domain, matching how crossposting reuses the LSSD forum credentials.
 *
 * Blank webhook var = faction silently skipped (DAO/LSPD ship blank until each
 * faction gets a notification channel; the code path is live either way).
 *
 * Test mode: AUTOPSY_REQUESTER_WEBHOOK_TEST_MODE=true routes EVERY faction to
 * AUTOPSY_REQUESTER_WEBHOOK_TEST_URL and logs [TEST-OVERRIDE] per send.
 *
 * Webhook env vars:
 *   AUTOPSY_REQUESTER_WEBHOOK_LSSD
 *   AUTOPSY_REQUESTER_WEBHOOK_SADCR
 *   AUTOPSY_REQUESTER_WEBHOOK_DAO      (blank by default)
 *   AUTOPSY_REQUESTER_WEBHOOK_LSPD     (blank by default)
 *   AUTOPSY_REQUESTER_WEBHOOK_TEST_MODE
 *   AUTOPSY_REQUESTER_WEBHOOK_TEST_URL
 *
 * Firebase paths:
 *   autopsy-requests/officer-discord/<discord-tag-or-name> = numeric discord id
 *     (owner-maintained mapping, same pattern as autopsy-requests/discord-members)
 */

import { getDiscordId } from './meDiscordNotify.js';
import { FORUM_FALLBACK_URLS, getAgencyForum } from './agencyForums.js';

// ── Constants ──

export const PHMC_INBOX_URL = 'https://phmc.gta.world/ucp.php?i=pm&folder=inbox';
export const PHMC_DISCORD_INVITE = 'https://discord.gg/zYdhJvHvUa';

const FACTION_WEBHOOK_ENV = {
    LSSD: 'AUTOPSY_REQUESTER_WEBHOOK_LSSD',
    SADCR: 'AUTOPSY_REQUESTER_WEBHOOK_SADCR',
    DAO: 'AUTOPSY_REQUESTER_WEBHOOK_DAO',
    LSPD: 'AUTOPSY_REQUESTER_WEBHOOK_LSPD',
};

const TEST_MODE_ENV = 'AUTOPSY_REQUESTER_WEBHOOK_TEST_MODE';
const TEST_URL_ENV = 'AUTOPSY_REQUESTER_WEBHOOK_TEST_URL';

const OFFICER_DISCORD_PATH = 'autopsy-requests/officer-discord';

const SEND_TIMEOUT_MS = 10000;

/** Discord snowflakes are 15-21 digit numbers; anything shorter is a
 *  discriminator/phone/etc., not a mentionable ID. */
const SNOWFLAKE_RE = /\b(\d{15,21})\b/;

// ── Config resolution ──

/** True when every faction should route to the test webhook instead. */
export function isTestMode() {
    return String(process.env[TEST_MODE_ENV] || '').toLowerCase() === 'true';
}

/**
 * Resolve the destination webhook URL for a faction key.
 * Test mode overrides everything; blank/unset vars return null (faction is
 * intentionally unconfigured — DAO/LSPD).
 *
 * @param {string} factionKey — e.g. 'LSSD' | 'SADCR' | 'DAO'
 * @param {{ ignoreTestMode?: boolean }} [opts] — when true, resolves the REAL
 *   faction webhook even while TEST_MODE is active (used by the manual
 *   /forward-autopsy-complete command; the automatic flow never bypasses).
 * @returns {{ url: string|null, envVar: string }}
 */
export function getFactionWebhookUrl(factionKey, { ignoreTestMode = false } = {}) {
    const key = String(factionKey || '').toUpperCase();
    const envVar = FACTION_WEBHOOK_ENV[key];

    if (!ignoreTestMode && isTestMode()) {
        const testUrl = (process.env[TEST_URL_ENV] || '').trim();
        if (!testUrl) {
            // Fail loud: a silent skip here is indistinguishable from an
            // intentionally-blank faction and hides staging misconfig.
            console.warn(`[REQ-WEBHOOK][TEST-OVERRIDE] ${TEST_MODE_ENV}=true but ${TEST_URL_ENV} is empty — message NOT sent`);
        }
        return { url: testUrl || null, envVar: TEST_URL_ENV };
    }
    if (!envVar) return { url: null, envVar: '' };

    const raw = process.env[envVar];
    // Treat whitespace-only values as unset so a stale config never half-fires.
    return { url: (raw || '').trim() || null, envVar };
}

// ── Requester identity resolution ──

/**
 * Pull a mentionable numeric Discord ID out of a raw contact string.
 * Handles "._diaaa", "@SLOTH66", "123456789012345678", "Name#1234" (rejected —
 * 4 digits is not a snowflake).
 * @param {string} raw
 * @returns {string|null}
 */
function extractSnowflake(raw) {
    const m = String(raw || '').match(SNOWFLAKE_RE);
    return m ? m[1] : null;
}

/**
 * Resolve how to address the requester on completion.
 *
 * Chain: numeric ID found in the request's Discord contact field -> the
 * officer-discord mapping node -> salutation fallback (never fails — an
 * unmapped requester still gets a name-greeted message, just no ping).
 *
 * @param {object} db — Firebase Admin RTDB
 * @param {object} entry — autopsy-requested record
 * @returns {Promise<{ discordId: string|null, salutation: string }>}
 */
export async function resolveRequesterPing(db, entry) {
    const tagRaw = String(entry?.requesterDiscordTag || '').trim();

    // 1. Explicit numeric ID embedded at detection time wins outright.
    const inline = extractSnowflake(tagRaw);
    if (inline) return { discordId: inline, salutation: '' };

    // 2. Owner-maintained mapping keyed by the Discord tag as written.
    if (db && tagRaw) {
        try {
            const snap = await db.ref(`${OFFICER_DISCORD_PATH}/${tagRaw.toLowerCase()}`).once('value');
            const mapped = (snap.val() || '').toString().trim();
            if (/^\d{15,21}$/.test(mapped)) return { discordId: mapped, salutation: '' };
        } catch { /* best effort */ }
    }

    // 3. Salutation fallback — prefer the requesting officer's IC name from the
    // form body; entry.name is the DECEDENT, never use it to greet the officer.
    const salutation = String(entry?.parsed?.requesterName || '').trim()
        || tagRaw
        || 'Requesting Officer';
    return { discordId: null, salutation };
}

// ── Payload construction (pure — shared with debug/mimic tooling) ──

/** Strip the trailing "- UNASSIGNED" state suffix (same rule as completion flow). */
function cleanCaseTitle(title) {
    return String(title || '').replace(/\s*[-–—]\s*UNASSIGNED\s*$/i, '').trim();
}

/**
 * Build the full Discord webhook payload for a completed request.
 * Exported for byte-identical rendering in test tooling.
 *
 * Copy is channel-aware per CASELINK dev feedback: only requests actually
 * posted BY CASELINK may say "CASELINK". Human-posted requests get a viable
 * alternative instead (PHMC inbox copy + the agency's Autopsy Records),
 * never a system they didn't use.
 *
 * @param {object} p
 * @param {string} [p.caseTitle]
 * @param {string|number} [p.caseNumber]
 * @param {string} [p.meName]
 * @param {string|null} [p.meDiscordId]
 * @param {string} p.requesterSalutation — fallback greeting when no ping
 * @param {string|null} p.requesterDiscordId — ping target when resolved
 * @param {string} p.factionKey — LSSD | SADCR | DAO | LSPD | other
 * @param {string|null} [p.agencyTopicUrl] — deep link to the faction forum reply
 * @param {boolean} [p.postedByCaselink=true] — request origin; flips copy + button label
 * @returns {object} fetch-ready payload
 */
export function buildCompletionPayload({
    caseTitle, caseNumber, meName, meDiscordId,
    requesterSalutation, requesterDiscordId, factionKey, agencyTopicUrl,
    postedByCaselink = true,
}) {
    const key = String(factionKey || '').toUpperCase();
    const isCaselinkOrigin = postedByCaselink !== false;
    const ping = requesterDiscordId ? `<@${requesterDiscordId}>` : '';
    const greeting = ping || `**${(requesterSalutation || 'Requesting Officer').trim()}**`;

    const cleanedTitle = cleanCaseTitle(caseTitle);
    const embedTitle = cleanedTitle || (caseNumber ? `Case ${caseNumber}` : 'Autopsy Request Completed');

    const fields = [
        { name: 'Medical Examiner', value: meName ? `Dr. ${meName}` : 'Unassigned', inline: true },
        {
            name: 'Medical Examiner Discord',
            value: (meName && meDiscordId) ? `<@${meDiscordId}>` : 'Not linked',
            inline: true,
        },
    ];

    // Agency record button: deep link when the bot replied into the faction's
    // own forum, otherwise the forum listing. Label mirrors the request origin —
    // "CASELINK" only for CASELINK-submitted requests; humans get a neutral,
    // equally-clickable "Autopsy Records" (DAO keeps its record forum even
    // while its webhook stays blank).
    const buttons = [];
    const forumFallback = FORUM_FALLBACK_URLS[key];
    // Same target backs the inline copy link ("your SD Intranet"/"agency
    // intranet") and the button, so text and action never disagree.
    const recordUrl = agencyTopicUrl || forumFallback || null;
    if (forumFallback) {
        buttons.push({
            type: 2,
            style: 5,
            label: isCaselinkOrigin ? 'CASELINK' : 'Autopsy Records',
            url: recordUrl,
        });
    }
    buttons.push(
        { type: 2, style: 5, label: 'PHMC Inbox', url: PHMC_INBOX_URL },
        { type: 2, style: 5, label: 'PHMC Discord', url: PHMC_DISCORD_INVITE },
    );

    // Content line — one phrase per origin so every requester sees a valid path
    // to their report. Both paths hyperlink the intranet mention (<url> wrapper
    // guards against stray punctuation breaking Discord's markdown parsing).
    // Factions outside the registry have no URL to link — fall back to the
    // plain-text phrasing rather than emitting a dead [link](<null>).
    let content;
    if (isCaselinkOrigin && recordUrl) {
        content = `${greeting}, your autopsy request has been completed, you can view it in CASELINK or via [your SD Intranet](<${recordUrl}>).`;
    } else if (isCaselinkOrigin) {
        content = `${greeting}, your autopsy request has been completed, you can view it in CASELINK or via your SD Intranet.`;
    } else if (recordUrl) {
        content = `${greeting}, your autopsy request has been completed. A full copy has been sent to your PHMC inbox, and it is available under your [agency intranet](<${recordUrl}>).`;
    } else {
        content = `${greeting}, your autopsy request has been completed. A full copy has been sent to your PHMC inbox.`;
    }

    return {
        username: 'PHMC Autopsy Requests',
        content,
        allowed_mentions: { parse: ['users'] },
        embeds: [{
            title: embedTitle,
            color: 0x00bcd4,
            fields,
            timestamp: new Date().toISOString(),
        }],
        components: [{ type: 1, components: buttons }],
    };
}

// ── Send ──

/**
 * POST a payload to a Discord webhook. Non-blocking failure contract:
 * returns false and logs — never throws to the caller.
 * @param {string} url
 * @param {object} payload
 * @param {string} [context] — log label (faction/test)
 * @returns {Promise<boolean>}
 */
export async function sendRequesterWebhook(url, payload, context = '') {
    if (!url) return false;
    const label = context ? `[REQ-WEBHOOK:${context}]` : '[REQ-WEBHOOK]';
    try {
        const res = await Promise.race([
            fetch(url + '?with_components=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('webhook send timed out')), SEND_TIMEOUT_MS)),
        ]);
        if (!res.ok) {
            console.warn(`${label} Failed (HTTP ${res.status})`);
            return false;
        }
        console.log(`${label} Sent requester completion notification`);
        return true;
    } catch (err) {
        console.warn(`${label} Send error: ${err.message}`);
        return false;
    }
}

// ── Orchestrator (called from the completion flow) ──

/**
 * Notify the requesting faction that an autopsy request completed.
 * Gating (postedByCaselink / private cases / multi-decedent deferral) lives in
 * deployAutopsyReply.js — this only builds and delivers.
 *
 * @param {object} db — Firebase Admin RTDB
 * @param {object} entry — autopsy-requested record
 * @param {object} [opts]
 * @param {string|number} [opts.caseNumber]
 * @param {string} [opts.caseTitle]
 * @param {string} [opts.faction] — override (defaults to entry.faction)
 * @param {string} [opts.agencyTopicUrl] — deep link override for the button
 * @param {string} [opts.meName] — overrides entry.assignedTo
 * @returns {Promise<{ok: boolean, skipped?: boolean, reason?: string, target?: string, testMode?: boolean}>}
 */
export async function notifyRequesterOfCompletion(db, entry, opts = {}) {
    const factionKey = String(opts.faction || entry?.faction || '').toUpperCase();
    const { url } = getFactionWebhookUrl(factionKey);

    if (!url) {
        // A configured-but-blank faction (DAO/LSPD default) is an intentional
        // skip; TEST_MODE with a missing URL is a config error worth failing.
        const isConfigError = isTestMode();
        if (isConfigError) console.warn(`[REQ-WEBHOOK] FAILED for ${factionKey || '?'} — test mode active but no test webhook URL`);
        else console.log(`[REQ-WEBHOOK] Skipped — no webhook configured for ${factionKey || '(unknown faction)'}`);
        return { ok: false, skipped: !isConfigError, reason: isConfigError ? 'test_url_missing' : 'no_webhook_configured' };
    }

    const { discordId, salutation } = await resolveRequesterPing(db, entry);

    const meName = opts.meName || entry?.assignedTo || '';
    let meDiscordId = null;
    if (meName && db) {
        try { meDiscordId = await getDiscordId(db, meName); } catch { /* best effort */ }
    }

    const payload = buildCompletionPayload({
        caseTitle: opts.caseTitle || entry?.caseTitle || entry?.title || '',
        caseNumber: opts.caseNumber ?? entry?.caseNum ?? '',
        meName,
        meDiscordId,
        requesterSalutation: salutation,
        requesterDiscordId: discordId,
        factionKey,
        postedByCaselink: entry?.postedByCaselink === true,
        // Deep link preference: explicit override > this entry's saved faction
        // topic id (covers retry sweeps, which pass no context).
        agencyTopicUrl: opts.agencyTopicUrl
            || (() => {
                const cfg = getAgencyForum(factionKey);
                const tid = cfg ? entry?.[cfg.topicField] : null;
                return (cfg && tid) ? `${cfg.baseUrl}/viewtopic.php?t=${tid}` : null;
            })(),
    });

    const ok = await sendRequesterWebhook(url, payload, isTestMode() ? `test->${factionKey}` : factionKey);
    return { ok, target: factionKey, testMode: isTestMode() };
}
