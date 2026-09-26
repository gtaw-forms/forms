/**
 * massPostChunker.js — Mass Autopsy Rework (Task 6): OP index post fallback + chunking.
 *
 * A mass collection posts ONE shared case topic: the OP holds a compact index
 * (see compactCards) and the full per-body reports follow as replies. phpBB
 * reply bodies have a practical size ceiling, so the full BBCode is packed
 * into reply-sized chunks.
 *
 * Chunking rule: split ONLY at `--- BODY ---` boundary lines. A chunk is never
 * cut mid-body. Packing is greedy (fill each chunk up to maxChars with whole
 * bodies). A single body that alone exceeds maxChars is kept whole in its own
 * chunk — the caller posts it as-is and logs the overrun (fallback path).
 *
 * This module is pure: no imports, no Firebase, no Discord, no env access, no
 * top-level side effects. Consumers (e.g. massAssignmentPanel.js) must still
 * load it defensively via try/catch so this file can never break their startup.
 */

/** Canonical per-body boundary line inside a mass-collection BBCode blob. */
export const BODY_SEPARATOR = '--- BODY ---';

/** Default per-reply ceiling in characters (phpBB-safe headroom). */
export const DEFAULT_MAX_CHARS = 55000;

/**
 * Match a full `--- BODY ---` boundary line, numbered (`--- BODY 1 ---`, the
 * mass-request template contract) or bare (surrounding whitespace tolerated).
 */
export const SEPARATOR_LINE_RE = /^[ \t]*--- BODY(?:\s+\d+)? ---[ \t]*$/;

/**
 * Split a mass BBCode blob into its individual body sections.
 * Separator lines stay attached to the TOP of the section they introduce
 * (so numbered `--- BODY n ---` headers survive chunking); preamble text
 * before the first separator becomes the leading section. Empty sections
 * (leading/trailing/doubled separators) are dropped.
 *
 * @param {string} fullBbcode
 * @returns {string[]} trimmed, non-empty body sections in order.
 */
export function splitBodies(fullBbcode) {
    if (typeof fullBbcode !== 'string' || !fullBbcode) return [];
    const sections = [];
    let current = '';
    let pendingHeader = '';
    for (const line of fullBbcode.split(/\r?\n/)) {
        if (SEPARATOR_LINE_RE.test(line)) {
            if (current.trim()) sections.push(current.trim());
            current = '';
            pendingHeader = line.trim();
        } else {
            if (pendingHeader && !current) {
                current = pendingHeader;
                pendingHeader = '';
            }
            current += (current ? '\n' : '') + line;
        }
    }
    if (current.trim()) sections.push(current.trim());
    return sections.filter((s) => s.length > 0);
}

/**
 * Pack a mass BBCode blob into reply-sized chunks, splitting ONLY at
 * `--- BODY ---` boundaries (numbered `--- BODY n ---` or bare). Sections
 * keep their own header lines, so chunks rejoin losslessly with newlines.
 *
 * Guarantees:
 * - No chunk (except a lone oversized body) exceeds maxChars.
 * - Bodies are never split: a body moves whole to the next chunk.
 * - Order is preserved; every input body appears in exactly one chunk.
 * - No separator present (singular / legacy-multi blob) -> single chunk
 *   with the input as-is (trimmed), even if it exceeds maxChars.
 * - Empty / non-string input -> [].
 *
 * @param {string} fullBbcode
 * @param {number} [maxChars=55000]
 * @returns {string[]} chunks ready to post as sequential replies.
 */
export function splitAtBodyBoundaries(fullBbcode, maxChars = DEFAULT_MAX_CHARS) {
    if (typeof fullBbcode !== 'string' || !fullBbcode.trim()) return [];
    let limit = Number(maxChars);
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_MAX_CHARS;

    const bodies = splitBodies(fullBbcode);
    if (bodies.length <= 1) {
        // Zero bodies handled above; a single body (singular / legacy-multi
        // blob, or lone body with stray separators) ships whole — even over
        // the ceiling, since there is no safe boundary to split at.
        return bodies;
    }

    const sep = `\n${BODY_SEPARATOR}\n`;
    const joiner = '\n';
    const chunks = [];
    let current = [];
    let currentLen = 0;

    const flush = () => {
        if (current.length > 0) {
            // Sections carry their own --- BODY n --- headers (see
            // splitBodies), so chunks rejoin with a plain newline — no
            // injected separator lines.
            chunks.push(current.join(joiner));
            current = [];
            currentLen = 0;
        }
    };

    for (const body of bodies) {
        // Length this body would add to the open chunk (newline included
        // when the chunk already holds a section).
        const add = (current.length === 0 ? 0 : joiner.length) + body.length;
        if (current.length > 0 && currentLen + add > limit) flush();
        // A lone body over the ceiling still ships whole in its own chunk
        // (documented fallback — caller logs the overrun).
        current.push(body);
        currentLen += (current.length === 1 ? body.length : add);
    }
    flush();
    return chunks;
}

/**
 * Render one compact index card line for the OP post of a shared case topic.
 * Accepts parser-style body objects ({name, oocName, caseNum, assignedTo,
 * caseUrl}) or plain strings (used as the display name).
 *
 * @param {object|string} body
 * @param {number} index 0-based position
 * @param {number} total total body count
 * @returns {string} single BBCode line, e.g.
 *   `[b]Body 1/3:[/b] John Doe ((johndoe)) — [url=...]Case 101[/url] — Anne Carter`
 */
function cardLine(body, index, total) {
    const n = index + 1;
    const rec = (body && typeof body === 'object') ? body : {};
    const fallbackName = typeof body === 'string' ? body : '';
    const name = String(rec.name || rec.rawName || fallbackName || 'Unknown').trim() || 'Unknown';
    const ooc = String(rec.oocName || '').trim();
    const who = ooc ? `${name} ((${ooc}))` : name;
    const caseNum = String(rec.caseNum || '').trim();
    const caseLabel = caseNum ? `Case ${caseNum}` : 'Case TBD';
    const casePart = rec.caseUrl ? `[url=${rec.caseUrl}]${caseLabel}[/url]` : caseLabel;
    const me = String(rec.assignedTo || '').trim() || 'UNASSIGNED';
    return `[b]Body ${n}/${total}:[/b] ${who} — ${casePart} — ${me}`;
}

/**
 * Build the OP index post BBCode for a shared mass-collection case topic:
 * one compact card per body. Bodies keep their input order (Body i/N).
 *
 * @param {Array<object|string>} bodies parser-style body records or names.
 * @returns {string} BBCode for the OP index post.
 */
export function compactCards(bodies) {
    const header = '[b]MASS AUTOPSY — CASE INDEX[/b]';
    if (!Array.isArray(bodies) || bodies.length === 0) {
        return `${header}\n[i]No bodies recorded.[/i]`;
    }
    const total = bodies.length;
    const noun = total === 1 ? 'body' : 'bodies';
    const lines = bodies.map((b, i) => cardLine(b, i, total));
    return [
        header,
        `[i]${total} ${noun} — full reports follow in the replies below.[/i]`,
        '',
        ...lines,
    ].join('\n');
}
