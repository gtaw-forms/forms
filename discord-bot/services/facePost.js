/**
 * facePost.js — Facebrowser (Face) Page API client + social post generation
 * for PHMC Public Death Records.
 *
 * API reference: FB-API.MD (verified 2026-08-04)
 *   POST /posts  { page_id, content }  ->  201 { "post": { "id": ... } }
 * Auth: Authorization: Bearer <FACE_API_KEY>
 */

const FACE_BASE = 'https://face.gta.world/api/v1/page-api';

// ── Config ──

export function isFaceConfigured() {
    return !!(process.env.FACE_API_KEY && process.env.FACE_PAGE_ID);
}

export function isFaceDryRun() {
    return process.env.FACE_DRY_RUN !== 'false';
}

// ── API Client ──

async function call(path, opts = {}) {
    const res = await fetch(FACE_BASE + path, {
        ...opts,
        headers: {
            'Authorization': `Bearer ${process.env.FACE_API_KEY}`,
            'Content-Type': 'application/json',
            ...(opts.headers || {}),
        },
    });
    let body = null;
    try { body = await res.json(); } catch { body = await res.text(); }
    return { status: res.status, ok: res.ok, body };
}

/**
 * Post content to the configured Face page.
 * @param {string} content - Plain-text post body
 * @returns {Promise<{postId: number, url: string|null}>}
 * @throws Error with API response detail on failure
 */
export async function postToFace(content) {
    if (!process.env.FACE_API_KEY) throw new Error('FACE_API_KEY is not set in .env');
    if (!process.env.FACE_PAGE_ID) throw new Error('FACE_PAGE_ID is not set in .env — run debug-testing-scripts/face-find-page.mjs --set');

    const res = await call('/posts', {
        method: 'POST',
        body: JSON.stringify({ page_id: Number(process.env.FACE_PAGE_ID), content }),
    });

    if (!res.ok) {
        const detail = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
        throw new Error(`Face API POST /posts failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const post = res.body?.post || res.body?.data || res.body || {};
    const postId = post.id ?? null;
    if (!postId) {
        throw new Error('Face API returned success but no post id was extractable');
    }
    return { postId, url: `https://face.gta.world/post/${postId}` };
}

/**
 * Delete a Face post by id (used for corrections / testing cleanup).
 * @param {number} postId
 */
export async function deleteFacePost(postId) {
    if (!postId) return;
    const res = await call(`/posts/${postId}?page_id=${process.env.FACE_PAGE_ID}`, { method: 'DELETE' });
    if (!res.ok) {
        const detail = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
        throw new Error(`Face API DELETE /posts/${postId} failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    return res.body;
}

/**
 * Fetch a single Face post by id (used to verify a post still exists after
 * an interrupted publish).
 * @param {number|string} postId
 * @returns {Promise<object|null>} the post object, or null if missing/error
 */
export async function getFacePost(postId) {
    if (!postId) return null;
    const qs = new URLSearchParams({ page_id: String(process.env.FACE_PAGE_ID) });
    const res = await call(`/posts/${postId}?${qs.toString()}`);
    if (!res.ok) return null;
    return res.body?.post || null;
}

/**
 * Search the page's recent posts for one whose content includes searchText.
 * Used by the death-record recovery sweep to confirm whether an interrupted
 * auto-publish actually created a Face post (GET /posts is cursor-paginated).
 * @param {string} searchText
 * @param {number} [maxPages=5]
 * @returns {Promise<{postId: number, url: string, post: object}|null>}
 */
export async function findFacePostByContent(searchText, maxPages = 5) {
    if (!searchText) return null;
    const pageId = process.env.FACE_PAGE_ID;
    let cursor = null;
    for (let i = 0; i < maxPages; i++) {
        const qs = new URLSearchParams({ page_id: String(pageId) });
        if (cursor) qs.set('cursor', cursor);
        const res = await call(`/posts?${qs.toString()}`);
        if (!res.ok) {
            const detail = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
            throw new Error(`Face API GET /posts failed (${res.status}): ${detail.slice(0, 300)}`);
        }
        const data = res.body?.data || [];
        const hit = data.find((p) => (p.content || '').includes(searchText));
        if (hit) return { postId: hit.id, url: `https://face.gta.world/post/${hit.id}`, post: hit };
        cursor = res.body?.meta?.next_cursor || null;
        if (!cursor) break;
    }
    return null;
}

// ── Content Generation ──

/**
 * Reduce BBCode to plain text for the Face post (Face stores content verbatim,
 * so tags like [url=...] would otherwise render literally). Collapses the URL
 * wrapper to its label ("[url=X]Autopia Parkway[/url]" -> "Autopia Parkway"),
 * drops [img] blocks entirely (raw URLs aren't useful as text), and removes any
 * remaining tags before collapsing whitespace.
 * @param {string} text
 * @returns {string}
 */
function stripBbcode(text) {
    if (!text) return '';
    let s = String(text);
    s = s.replace(/\[(?:url|quote)(?:=[^\]]*)?\]/gi, ' ').replace(/\[\/(?:url|quote)\]/gi, ' ');
    s = s.replace(/\[img(?:=[^\]]*)?\][\s\S]*?\[\/img\]/gi, ' ');
    s = s.replace(/\[[a-z0-9]+(?:=[^\]]*)?\]|\[\/[a-z0-9]+\]/gi, ' ');
    return s.replace(/\s+/g, ' ').trim();
}

/**
 * Build the social-media style post body for a Public Death Record.
 *
 * Output (plain text — Face stores content verbatim, BBCode rendering unverified):
 *   A Public Death Record has been posted, the details are:
 *
 *   • Decedent: <name>
 *   • Case Number: #2026-<case>
 *   • Date of Death: <date>
 *   • Manner of Death: <manner>
 *   • Location: <place>
 *   • Investigator: <employee>
 *
 *   Full record: <forumUrl>
 *
 * @param {object} draftInfo - deathRecordDrafts/<reportKey> entry
 * @param {object} [opts]
 * @param {string} [opts.forumUrl] - Link to the public forum death record
 * @returns {string}
 */
export function generateFacePostContent(draftInfo, { forumUrl } = {}) {
    const v = draftInfo?.values || {};
    const year = new Date().getFullYear();

    let caseNumber = String(v.caseNumber || '');
    if (caseNumber && !/^\d{4}-/.test(caseNumber)) {
        caseNumber = `${year}-${caseNumber}`;
    }
    const caseLine = caseNumber ? `#${caseNumber}` : '';

    const lines = [
        'A Public Death Record has been posted, the details are:',
        '',
    ];

    const details = [
        { label: 'Decedent', value: draftInfo?.decedentName || v.decedentName },
        { label: 'Case Number', value: caseLine },
        { label: 'Date of Death', value: v.dateOfDeath },
        { label: 'Manner of Death', value: v.Manner || v.mannerOfDeath },
        { label: 'Location', value: v.placeOfDeath },
        { label: 'Investigator', value: v.selectEmployee || v.coronerEmployee || v.phmcEmployee },
    ];

    for (const d of details) {
        if (d.value) lines.push(`• ${d.label}: ${stripBbcode(d.value)}`);
    }

    if (forumUrl) {
        lines.push('');
        lines.push(`Full record: ${forumUrl}`);
    }

    lines.push('');
    lines.push('We utilize social media only when all other avenues of locating a next of kin have been exhausted, typically waiting up to 48 hours of extensive searching before publication.');

    return lines.join('\n');
}
