# Plan — Patient Name Autocomplete for Medical Records

**Status:** Approved — decisions locked 2026-08-08 · **Owner:** PHMC Tools · **Date:** 2026-08-08
**Related bug (RESOLVED 2026-08-08):** medical-record deploy searched the *author* name (`patientName` polluted) instead of the patient (`decedentName`) — fixed in `deployMedicalRecord.js` (search now uses `decedentName || patientName`) and the web app (both fields kept in sync). This feature is now **UX consistency + explicit patient verification**, not a bug fix.

---

## Goal

When a user types a patient name into a medical record form (session notes, ER protocol, patient notes, etc.), show an autocomplete dropdown of known patients — mirroring the existing **requesting-officer** flow — so the correct patient is selected consistently across the form, the BBCode, and the bot's forum-thread search.

## Why it matches our stack

The officer flow already proves the pipeline:

1. **Bot** syncs rosters → `data/{lspd,lssd}-roster.json` on the VPS (`factionRosterSync.js`).
2. **morgue-api** reads the JSON and serves `GET /api/roster/check?name=...` (`morgue-api.js:1463`).
3. **Firebase function** `checkOfficerName` proxies the client call.
4. **`OfficerSearch`** (`PrototypeFieldRenderer.jsx`) debounces, calls, and renders a dropdown + no-match banner.

A patient-name index follows the identical architecture — a small cached JSON file instead of scanning Firebase (~2.7MB morgue/`newSavedReports`) per keystroke.

## Data source (decide)

| Option | Pros | Cons |
|---|---|---|
| **A. f=97 patient threads** (`1424 - Alyson Frost`) | Canonical; already scanned by `getNextPatientId`; gives **ID + name** | Only patients who already have a thread |
| **B. Saved medical records** (`scheduledReports`/`newSavedReports`, `decedentName`/`patientName`) | Covers new reports before a thread exists | No IDs; duplicates to dedupe |
| **C. Both merged** | Most complete | Slightly more logic |

**Recommendation (approved):** C — merge B into A (A wins for ID; B fills gaps), deduped by name (case-insensitive), newest wins. `id` is the **f=97 patient thread id** (auto-assigned sequential), *not* a character/UCP identity key — treat it as an opaque lookup token, never as a stable person id.

## Implementation

### 1. Bot — patient index builder (new `services/patientIndex.js`)

**Design decision (2026-08-08):** f=97 is the ground truth — every deployed medical record has a thread there, so the index is built from the **forum** (canonical source) plus a **write-through on deploy** (instant freshness). Saved-report scanning is dropped: it only added marginal coverage for opted-out/dry-run drafts that never thread (the doctor types the name and the bot creates the thread as today).

- **Write-through on medical-record deploy (exact, zero forum traffic):** in `deployMedicalRecord.js`, after the bot resolves an existing thread or creates a new one, upsert `{ name, id: resolvedPatientId, threadId, lastSeen }` into `data/medical-records-index.json` (debounced write). This keeps the index current the moment a thread is created/found — no post-deploy forum re-scan.
- **Deploy resolves the thread FROM the index first:** `deployMedicalRecord.js` does an exact (case-insensitive) name lookup in the index and replies directly to the stored `threadId` — **no forum search** for known patients. Only non-exact/fuzzy matches fall through to the forum search, then the create-new-topic path. **Stale-index protection:** if an index-sourced reply fails, it re-searches the forum once and retries; if the thread is truly gone it removes the entry so future deploys create normally.
- **Full rebuild (canonical):** paginate the whole f=97 forum by parsing phpBB's **"Page X of Y"** footer for the true page count and iterating all pages deterministically (start += pageSize, `rel="next"` button as fallback when present — do NOT trust the next button alone; it vanished at ~page 18 of 42 and left only 225/1000+ topics). Broad `topictitle` selector with topicId dedupe. Parse titles with `/^(?:Patient\s*#?)?(\d{2,})\s*(?:[-–—]\s*)?(.+)$/i` or `/^\[(\d{2,})\]\s*(.+)$/i` — covers `1424 - Name`, `Patient #1424 - Name`, `1459 Name` (no separator), `1053 Name (ooc)`, `[709] Name`; the `[FORM] ...` sticky threads never match.
- Write `data/medical-records-index.json` atomically (like roster/ban-state writes) — VPS path `/opt/phmc-bot/discord-bot/data/medical-records-index.json`.
- **Cadence:** full rebuild every 3 days at 03:00 AM UTC, and on startup only if the last full build is > 3 days old (delayed 45s so the shared browser settles); gate on `lastFullBuild`. Between rebuilds, the write-through keeps the index current.
- **ID priority:** forum/deploy-sourced ids (pri 2) are never clobbered by lower-priority ids.

### 2. morgue-api — endpoint

- `GET /api/patients?q=<name>` (min 2 chars, `validateApiKey`, `rateLimiter`): case-insensitive `includes` match, return `[{ name, id, lastSeen }]`, limit ~10.
- `GET /api/patients` — optional full dump for admin/tooling.

### 3. Firebase function

- `getPatientNames` callable (like `checkOfficerName`), auth-gated (PHMC employee), proxies to `/api/patients`, 10s timeout, CORS matching `checkOfficerName`.

### 4. Client — autocomplete in the Patient Name field

- Replace the plain `<input>` in **`ui-new/index.jsx:1033`** with an `OfficerSearch`-style component (**prototype `ui-new` only — the legacy `form-handler` is deprecated and slated for deletion this major update, do not touch it**).
- On select: set **both** `decedentName` **and** `patientName` (kept in sync per current design), and set `patientID` when the match has a numeric ID.
- Keep manual typing allowed (no match → plain name still works, as today).
- Reuse the "No matches found" amber banner pattern.

### 5. Fallbacks

- If the API/function fails: silently fall back to the current free-text input (never block saving).

## Acceptance criteria

1. Typing ≥2 chars in a medical Patient Name field shows matching known patients.
2. Selecting a patient fills `decedentName` + `patientName` (and `patientID` when known).
3. Bot deploy search uses the selected name and finds/creates the correct thread.
4. `data/medical-records-index.json` exists on the VPS and refreshes on new saves.
5. Manual typing (no match) still saves.

## Out of scope (for now)

- Fuzzy/phonetic matching.
- Cross-referencing morgue records (decedents ≠ living patients).
- Editing/removing patient names from the index.

## Files touched (estimate)

- `discord-bot/services/patientIndex.js` (new)
- `discord-bot/services/deployMedicalRecord.js` (write-through upsert after thread resolve/create)
- `discord-bot/morgue-api.js` (+ `/api/patients`, `/api/patients?q=`)
- `discord-bot/index.js` (wire startup + save hook)
- `functions/index.js` (+ `getPatientNames`)
- `src/services/firebaseFunctions.js` (+ `triggerGetPatientNames`)
- `src/components/ui-new/index.jsx` + `PrototypeFieldRenderer.jsx` (autocomplete input)

## Deploy steps

1. Upload bot changes → `pm2 restart phmc-bot`.
2. Upload `morgue-api.js` → `pm2 restart morgue-api`.
3. `firebase deploy --only functions` for `getPatientNames`.
4. Update `changelog.md` + `discord-bot/changelog.md`.
5. Web app deploy (`npm run build && node tools/deploy.js`) — **handled by owner**.
