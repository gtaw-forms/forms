/**
 * patientIndex.js — Medical Records Patient Index.
 *
 * Builds and maintains `data/medical-records-index.json` on the VPS
 * (`/opt/phmc-bot/discord-bot/data/medical-records-index.json`) — a name →
 * patient lookup powering the web app's Patient Name autocomplete.
 *
 * Entries: { name, id, threadId, lastSeen }
 *   - name     — patient name (from the f=97 topic title / deploy)
 *   - id       — f=97 patient thread id (numeric, from topic titles) or null
 *   - threadId — phpBB topic id (when known from the forum/deploy) or null
 *   - lastSeen — ms timestamp of the newest source that mentioned the patient
 *
 * Two sources feed it (f=97 is the ground truth — every deployed medical record
 * has a thread there):
 *   A. f=97 forum threads (canonical) — full rebuild via paginated scan
 *      (follows phpBB's rel="next" button), every 3 days at 03:00 UTC (and on
 *      startup if the last build is stale).
 *   C. Write-through from `deployMedicalRecord.js` — after the bot resolves or
 *      creates the f=97 thread, upsert the exact { name, id, threadId } so the
 *      index is current immediately, with no forum re-scan.
 */

import { writeFileSync, renameSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getForumClient } from './forumClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──

const DATA_DIR = resolve(__dirname, '..', 'data');
const INDEX_PATH = resolve(DATA_DIR, 'medical-records-index.json');
const FORUM_ID = 97;
const FULL_BUILD_MS = 3 * 24 * 60 * 60 * 1000;     // 3 days
const FULL_BUILD_UTC_HOUR = 3;                     // 03:00 UTC
const STARTUP_REBUILD_DELAY_MS = 45 * 1000;        // let the shared browser settle first
const MAX_PAGINATION_PAGES = 200;                  // safety cap against infinite loops
// Title formats observed in f=97:
//   "1424 - Alyson Frost", "Patient #1424 - Name", "1459 Ignacio Abraham Gørvell"
//   (no separator), "1053 John Doe (therealkenny96)", "[709] Kelso Smythe".
// The "[FORM] ..." sticky threads never match (letters, not digits).
const TOPIC_TITLE_RE = /^(?:Patient\s*#?)?(\d{2,})\s*(?:[-–—]\s*)?(.+)$/i;
const BRACKET_TITLE_RE = /^\[(\d{2,})\]\s*(.+)$/i;

// ── State ──

let _index = null;               // { version, lastUpdated, lastFullBuild, count, patients: [] }
let _saveDebounce = null;
let _sweepTimer = null;
let _startupRebuildTimer = null;
let _db = null;
let _rebuildInFlight = false;

// Concurrency model:
//  - All mutations (upsertPatient/removePatientIndexEntry) are SYNCHRONOUS and
//    mutate the single in-memory `_index` object — JS is single-threaded, so
//    concurrent saves from multiple deploys serialize naturally.
//  - Writes are coalesced: a burst of upserts schedules ONE trailing debounced
//    disk write; every write serializes the FULL current index (last writer
//    wins with complete state — nothing is lost).
//  - All disk writes run through `_writeChain`, so a trailing debounced write
//    and an immediate write (full rebuild) can never interleave on the file.
//  - The file itself is written atomically (tmp + rename) so the morgue-api
//    reader never sees a partial index.
//  - Only one full rebuild runs at a time (`_rebuildInFlight`), and the 3-day
//    sweep is a single interval, so startup + scheduled rebuilds can't double-fire.
let _writeChain = Promise.resolve();
let _pendingChanges = 0;

// ── Index load / persist ──

function emptyIndex() {
    return { version: 1, lastUpdated: 0, lastFullBuild: 0, count: 0, patients: [] };
}

function ensureDataDir() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function readIndex() {
    if (_index) return _index;
    try {
        ensureDataDir();
        if (existsSync(INDEX_PATH)) {
            const raw = JSON.parse(readFileSync(INDEX_PATH, 'utf-8'));
            if (raw && Array.isArray(raw.patients)) {
                _index = raw;
                console.log(`[PATIENT-INDEX] [OK] Loaded index — ${raw.patients.length} patients (lastFullBuild=${raw.lastFullBuild ? new Date(raw.lastFullBuild).toISOString() : 'never'})`);
                return _index;
            }
        }
    } catch (err) {
        console.warn(`[PATIENT-INDEX] [WARN] Could not load index from disk (${err.message}) — starting empty`);
    }
    _index = emptyIndex();
    return _index;
}

export function writeIndex(immediate = false) {
    const idx = readIndex();
    idx.lastUpdated = Date.now();
    idx.count = idx.patients.length;
    const changes = _pendingChanges;
    const persist = () => {
        _writeChain = _writeChain.then(() => {
            try {
                ensureDataDir();
                const tmp = INDEX_PATH + '.tmp';
                writeFileSync(tmp, JSON.stringify(idx, null, 2), 'utf-8');
                renameSync(tmp, INDEX_PATH);
                _pendingChanges = 0;
                console.log(`[PATIENT-INDEX] [OK] Saved ${idx.patients.length} patients → data/medical-records-index.json${changes > 0 ? ` (${changes} change${changes === 1 ? '' : 's'} since last write)` : ''}`);
            } catch (err) {
                console.error(`[PATIENT-INDEX] [ERR] Failed to write index: ${err.message}`);
            }
        });
    };
    if (immediate) {
        if (_saveDebounce) { clearTimeout(_saveDebounce); _saveDebounce = null; }
        persist();
    } else {
        if (_saveDebounce) clearTimeout(_saveDebounce);
        _saveDebounce = setTimeout(persist, 1500);
    }
}

// ── Entry merge / upsert ──

function normalizeName(name) {
    return String(name || '').trim().toLowerCase();
}

/**
 * Upsert one patient entry. Newest `lastSeen` wins for the name; id/threadId
 * are preserved from whichever side has them. Forum/deploy-sourced ids
 * (priority 2) are never clobbered by a report-sourced patientID (priority 1).
 * Persists via a debounced write.
 */
export function upsertPatient({ name, id = null, threadId = null, lastSeen = Date.now(), source = 'unknown' }) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return null;

    // Forum + write-through sources carry canonical ids; saved-report patientIDs
    // can be stale/test values and must not overwrite them.
    const srcPriority = String(source || '').startsWith('report:') ? 1 : 2;

    const idx = readIndex();
    const key = normalizeName(cleanName);
    const existing = idx.patients.find((p) => normalizeName(p.name) === key);

    const numericId = id != null && /^\d+$/.test(String(id)) ? String(id) : null;

    if (!existing) {
        const entry = { name: cleanName, id: numericId, threadId: threadId || null, lastSeen: lastSeen || Date.now(), pri: srcPriority };
        idx.patients.push(entry);
        _pendingChanges++;
        console.log(`[PATIENT-INDEX] [NEW] ${cleanName}${entry.id ? ` (id ${entry.id})` : ''} — via ${source}`);
        writeIndex();
        return entry;
    }

    const updated = {
        name: (lastSeen || 0) >= (existing.lastSeen || 0) ? cleanName : existing.name,
        id: (numericId && srcPriority >= (existing.pri || 1)) ? numericId : (existing.id || numericId || null),
        threadId: threadId || existing.threadId || null,
        lastSeen: Math.max(existing.lastSeen || 0, lastSeen || 0),
        pri: Math.max(existing.pri || 1, srcPriority),
    };
    const changed = updated.name !== existing.name
        || updated.id !== existing.id
        || updated.threadId !== existing.threadId
        || updated.lastSeen !== existing.lastSeen;

    if (changed) {
        Object.assign(existing, updated);
        _pendingChanges++;
        console.log(`[PATIENT-INDEX] [UPD] ${existing.name} (id ${existing.id || '?'}) lastSeen=${new Date(existing.lastSeen).toISOString()} — via ${source}`);
        writeIndex();
    }
    return existing;
}

/**
 * Exact (case-insensitive) name lookup — used by deployMedicalRecord to resolve
 * the patient's thread DIRECTLY from the index instead of searching the forum.
 * Returns the index entry ({ name, id, threadId, lastSeen }) or null.
 */
export function findPatientIndexEntry(name) {
    const idx = readIndex();
    const key = normalizeName(name);
    return idx.patients.find((p) => normalizeName(p.name) === key) || null;
}

/**
 * Remove a patient entry from the index. Used when an indexed thread turns out
 * to be gone, so future deploys fall back to the forum search/create path.
 */
export function removePatientIndexEntry(name) {
    const idx = readIndex();
    const key = normalizeName(name);
    const before = idx.patients.length;
    idx.patients = idx.patients.filter((p) => normalizeName(p.name) !== key);
    if (idx.patients.length < before) {
        _pendingChanges++;
        console.log(`[PATIENT-INDEX] [DEL] Removed "${name}" from index`);
        writeIndex(true);
        return true;
    }
    return false;
}

// ── Source A: full rebuild from f=97 (paginated) ──

async function scrapeForumTopics() {
    const client = getForumClient();
    await client.ensureBrowser();
    const domain = process.env.FORUM_BASE_URL || 'https://phmc.gta.world';
    await client.login(null, null, { force: false, baseUrl: domain }).catch((e) => {
        console.warn(`[PATIENT-INDEX] [WARN] Forum login (best-effort) failed: ${e.message}`);
    });

    // phpBB pagination: trust the "Page X of Y" footer for the TRUE page count and
    // the rel="next" button for the next start (falling back to start + pageSize
    // when the button is transiently missing). The rel="next"-only approach stopped
    // at ~page 18 of 42. Topics use the broad topictitle selector (as getForumTopics
    // does) with topicId dedupe — the narrower li.row selector under-captured rows.
    const allTopics = [];
    const seenIds = new Set();
    let start = 0;
    let pageSize = 25;
    let pages = 0;
    let emptyStreak = 0;
    let totalPages = null;

    while (pages < MAX_PAGINATION_PAGES) {
        pages++;
        const url = `${domain}/viewforum.php?f=${FORUM_ID}&start=${start}`;
        console.log(`[PATIENT-INDEX] Scanning f=97 page ${pages} (start=${start})...`);
        const page = await client.context.newPage();
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(2000);
            // Quick Cloudflare poll (20s max)
            const cfStart = Date.now();
            while (Date.now() - cfStart < 20000) {
                const isCf = await page.evaluate(() =>
                    document.body?.innerHTML?.includes('cf-wrapper') ||
                    document.title?.includes('Just a moment')
                ).catch(() => false);
                if (!isCf) break;
                await page.waitForTimeout(1500);
            }

            const d = await page.evaluate(() => {
                const topics = [];
                document.querySelectorAll('a.topictitle, a.topictitle2, a[href*="viewtopic.php"]').forEach((link) => {
                    const href = link.getAttribute('href') || '';
                    const title = link.textContent?.trim();
                    const tMatch = href.match(/[?&]t=(\d+)/);
                    if (tMatch && title) topics.push({ topicId: parseInt(tMatch[1], 10), title });
                });
                const pag = document.querySelector('.pagination');
                const pageText = pag?.textContent || '';
                const totalM = pageText.match(/of\s+(\d+)/i);
                const next = document.querySelector('a[rel="next"]');
                return {
                    topics,
                    totalPages: totalM ? parseInt(totalM[1], 10) : null,
                    nextHref: next ? next.getAttribute('href') : null,
                };
            }).catch(() => ({ topics: [], totalPages: null, nextHref: null }));

            if (d.totalPages && d.totalPages > 1) totalPages = d.totalPages;

            let newTopics = 0;
            for (const t of d.topics) {
                if (seenIds.has(t.topicId)) continue;
                seenIds.add(t.topicId);
                allTopics.push(t);
                newTopics++;
            }
            console.log(`[PATIENT-INDEX] Page ${pages}: ${newTopics} new topics (${d.topics.length} on page)${d.totalPages ? ` of ${d.totalPages}` : ''}`);

            // Decide next start — prefer the next button, else advance by page size
            let nextStart = null;
            if (d.nextHref) {
                const m = d.nextHref.match(/[?&]start=(\d+)/);
                nextStart = m ? parseInt(m[1], 10) : start + pageSize;
            } else if (d.totalPages && pages < d.totalPages) {
                nextStart = start + pageSize;
            }

            if (nextStart == null) break;
            if (d.totalPages && pages >= d.totalPages) break;

            if (newTopics === 0) emptyStreak++;
            else emptyStreak = 0;
            if (emptyStreak >= 2) {
                console.warn(`[PATIENT-INDEX] [WARN] 2 consecutive empty pages — stopping`);
                break;
            }

            pageSize = (nextStart - start) || pageSize;
            start = nextStart;
        } finally {
            await page.close().catch(() => {});
        }
    }
    if (pages >= MAX_PAGINATION_PAGES) {
        console.warn(`[PATIENT-INDEX] [WARN] Hit MAX_PAGINATION_PAGES (${MAX_PAGINATION_PAGES}) — possible pagination loop`);
    }
    console.log(`[PATIENT-INDEX] Scan finished — ${pages} page(s) traversed, ${allTopics.length} topics fetched${totalPages ? ` (forum reported ${totalPages} pages)` : ''}`);
    return allTopics;
}

/**
 * Full rebuild — paginate the whole f=97 forum, parse titles, merge into the
 * index, and stamp `lastFullBuild`. Reconciliation for forum-side drift
 * (renames, manual title edits, threads not created by the bot).
 */
export async function fullRebuild() {
    if (_rebuildInFlight) {
        console.log('[PATIENT-INDEX] [WARN] Full rebuild already in progress, skipping');
        return false;
    }
    _rebuildInFlight = true;
    try {
        const t0 = Date.now();
        console.log('[PATIENT-INDEX] Starting full f=97 rebuild...');
        const topics = await scrapeForumTopics();
        console.log(`[PATIENT-INDEX] f=97 scan complete — ${topics.length} topics fetched (${Date.now() - t0}ms)`);

        let parsed = 0;
        for (const t of topics) {
            let m = TOPIC_TITLE_RE.exec(t.title);
            if (!m) m = BRACKET_TITLE_RE.exec(t.title);
            if (!m) continue;
            parsed++;
            upsertPatient({
                name: m[2].trim(),
                id: m[1],
                threadId: t.topicId,
                lastSeen: Date.now(),
                source: 'forum:f97',
            });
        }

        const idx = readIndex();
        idx.lastFullBuild = Date.now();
        writeIndex(true);
        console.log(`[PATIENT-INDEX] [DONE] Full rebuild — ${parsed} topics matched titles, ${idx.patients.length} patients in index (${Date.now() - t0}ms)`);
        return true;
    } catch (err) {
        console.error(`[PATIENT-INDEX] [ERR] Full rebuild failed: ${err.message}`);
        return false;
    } finally {
        _rebuildInFlight = false;
    }
}

// ── Startup + scheduling ──

function scheduleFullRebuild() {
    if (_sweepTimer) clearInterval(_sweepTimer);
    _sweepTimer = setInterval(async () => {
        const idx = readIndex();
        const now = Date.now();
        const d = new Date();
        const inBuildWindow = d.getUTCHours() === FULL_BUILD_UTC_HOUR && d.getUTCMinutes() < 10;
        const stale = now - (idx.lastFullBuild || 0) > FULL_BUILD_MS;
        if (inBuildWindow && stale) {
            console.log('[PATIENT-INDEX] 03:00 UTC build window + last build stale — running full rebuild');
            await fullRebuild();
        }
    }, 60 * 60 * 1000);
}

/**
 * Start the patient index service. Call once at bot startup.
 *  1. Load the index from disk.
 *  2. Run a full f=97 rebuild ONLY if the last build is > 3 days old (delayed
 *     45s so the shared Playwright browser's startup tasks settle first).
 *  3. Schedule the 3-day 03:00 UTC build window.
 * The index is kept current between rebuilds by the write-through upsert in
 * deployMedicalRecord.js (no per-save scanning).
 */
export async function startPatientIndex(db) {
    _db = db;
    console.log('[PATIENT-INDEX] Starting patient index service...');
    const idx = readIndex();

    const stale = Date.now() - (idx.lastFullBuild || 0) > FULL_BUILD_MS;
    if (stale) {
        const last = idx.lastFullBuild ? new Date(idx.lastFullBuild).toISOString() : 'never';
        console.log(`[PATIENT-INDEX] Last full build ${last} — > 3 days old, scheduling startup rebuild in ${Math.round(STARTUP_REBUILD_DELAY_MS / 1000)}s`);
        if (_startupRebuildTimer) clearTimeout(_startupRebuildTimer);
        _startupRebuildTimer = setTimeout(() => {
            fullRebuild().catch(() => {});
        }, STARTUP_REBUILD_DELAY_MS);
    } else {
        console.log(`[PATIENT-INDEX] Last full build ${new Date(idx.lastFullBuild).toISOString()} — fresh, skipping startup rebuild`);
    }

    scheduleFullRebuild();
    console.log(`[PATIENT-INDEX] [OK] Patient index service active — ${idx.patients.length} patients, 3-day full rebuild scheduled (03:00 UTC)`);
    return true;
}

/**
 * Read the current index (for dashboard/monitoring tooling).
 */
export function getPatientIndex() {
    return readIndex();
}
