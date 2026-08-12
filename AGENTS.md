# PHMC Forms — Project Memory

> **Read `CLAUDE.md` for the project overview and workflows** — deploy matrix, VPS commands, project structure, UI architecture, and code conventions.
> **Read the changelogs for what changed:** `changelog.md` (web app + Cloud Functions) and `discord-bot/changelog.md` (bot + VPS APIs). Keep this file as lean memory — **point, don't restate**.

## Open plan

- **`plan.md`** — Patient Name Autocomplete for Medical Records. VPS copy at `/opt/phmc-bot/discord-bot/debug/patient-name-autocomplete-plan.md`.

## Next session — pending deploys (2026-08-11)

- **Web app rebuild + deploy needed (`npm run build && node tools/deploy.js`, owner action)** to ship the last batch: EMS dev-protocols VPS hosting (`DataContext` fetches via `getProtocolsDev`), agency-credentials non-employee gate, Business Card modal, morgue "Request Update" ping, BaseModal display fix, Discord-Integration removal, legacy morgue/EMS/SidebarNav retirement.
- **After deploy, clear the localhost LSCC cache once** (`firebaseCache_lscc*` keys) so the dev EMS protocols show.
- **EMS dev protocols live on the VPS, not RTDB** — `data/protocols-dev.json` → morgue-api `GET /api/protocols-dev` → `getProtocolsDev` function. Re-seed any doc changes: `node tools/seed-protocols-dev.mjs` → SCP `protocols_dev.json` to VPS `data/protocols-dev.json` → `pm2 restart morgue-api`. No Firebase writes, no `lsccDataVersion` bump.

## Field semantics (why certain fields exist)

- **Medical records use `decedentName` as the authoritative patient/subject name** — the medical "Patient Name" input writes both `decedentName` and `patientName` (kept in sync). The bot's `handleMedicalRecord` searches `decedentName || patientName`; the BBCode `{{patientName}}`/`{{PatientName}}` placeholders resolve `patientName || decedentName`.
- **The OAuth `faction` object never carries `firstname`** — it only has `characterId`/`characterName`/`rank`/`scriptRank`. Code must not key off `faction.firstname`.
- **Faction roster records store the character id as the record KEY** (`factions/364/members/<charId>`), not as a field. Always use the key, never `memberData.characterId`.
- **`gtawCharacterId` of e.g. `50230` may be a UCP **account** id, not a character id** (Sarah Bell's character is `156863`; `50230` is her account).

## Recurring gotchas

- **Re-scheduling a bot report**: set `hasdeployed:false` + `deployStatus:'pending'` in `scheduledReports`, then restart the bot — its cold-load treats it as pending and re-queues.
- **Bot recovery sweeps** run sequentially via `runRecoveryHeartbeat`; the startup sweep is delayed 30s so the shared Playwright browser's startup tasks settle.
- **Reports already posted to the forum by the bot are not retro-fixed** by DB/script repairs — those need a manual forum edit.
- **Deploying the web app is a user action** (`npm run build && node tools/deploy.js`); bot + functions are agent-deployable via SCP/`firebase deploy` (see CLAUDE.md).
- **Legacy `/form-handler` is decommissioned (2026-08-11)** — the route redirects to `/ui-prototype` and the component is no longer bundled. Don't re-add it; global CSS (`App.css`, `buttons.css`, bootstrap) now lives in `src/index.jsx`.

## Recent fixes — blank coroner credentials (2026-08-11)

- **Full RCA + fix doc:** `docs/coroner-credentials-blank-bug.md` (Fixes A–H, all shipped). Root cause: credential sync used a narrower OAuth name path than author resolution; Sarah Bell's OAuth payload surfaces her UCP **account** id (`50230`) where her character id (`156863`) is expected, so `user.faction` can be null → `coronerEmployee`/`Rank`/`Badge` saved blank.
- **Bot emergency handbrake:** `discord-bot/services/deployExecutor.js` `runDeploy` hard-stops any report with empty `coronerEmployee`/`phmcEmployee` — marks `deployStatus:'blocked_empty_employee'`, pings developer via webhook, never retries. Recovery: fix data (re-save or `node tools/fix-empty-coroner.mjs --include-scheduled --apply`), set `hasdeployed:false` + `deployStatus:'pending'`, restart bot.
- **Repair tool:** `tools/fix-empty-coroner.mjs` (dry-run default; `--apply` to write). `tools/pull-report.mjs <key>` pulls one report + BBCode for inspection.
- **Follow-up (deferred, not a fix for this):** OAuth profile response gives the account id per character as `user.id` + `character[].memberid` (character[].id is the real char id). Future option: store account ids on roster records or add a server-side name-match fallback in `processGtaWorldAuth`/`refreshGtawUser` (`allMembers[charId]` misses when the OAuth id is an account id) — never emit the account id as `characterId`/badge (regresses the 2026-08-07 fix).

## Key auth identity facts (for debugging OAuth sessions)

- `user.faction.characterName` is the reliable employee name source; fall back to `activeCharacter` then the OAuth `character[]` array.
- `refreshGtawUser` must use the roster record key as `characterId` — a mismatch there leaks the account id and wipes badges.
