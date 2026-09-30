# PHMC Forms — Project Memory

> **Read `CLAUDE.md` for the project overview and workflows** — deploy matrix, VPS commands, project structure, UI architecture, and code conventions.
> **Read the changelogs for what changed:** `changelog.md` (web app + Cloud Functions) and `discord-bot/changelog.md` (bot + VPS APIs). Keep this file as lean memory — **point, don't restate**.

## Hard rule — no Discord webhook URLs in git (2026-09-09)

- **Never commit a `discord.com/api/webhooks/…` URL anywhere** — source, comments, tests, fixtures, docs, plans. The URL *is* the token (post + delete). Env/`PHMC_CONFIG`/RTDB at runtime only; fail closed when unset. Full rule in `CLAUDE.md` Code Conventions. Enforced by `.githooks/pre-commit`.
- **History:** the 2026-08-31 "main deploy" committed two live webhook tokens to the public repo (`gtaw-forms/forms`); both were abused (spam posts as "Autopsy Bot"). Purged from history + rotated — see `discord-bot/changelog.md`. The old `.env`-only wording of the secrets rule is why the review missed it: hardcoded literals in `.js` looked like "defaults", not secrets.

## Hard rule — bot deploys are whole-tree, never single-file (2026-09-30)

- **Deploy the bot with `npm run bot:check` then `npm run bot:deploy`** (whole `discord-bot/` tree, md5-verified). Do **not** `scp` individual files. The VPS is a mirror, not a partial copy — single-file copies are what let the repo and VPS drift apart (2026-09-26 → 2026-09-30) and cost autopsy request 10308 its acknowledgement. (One exception: `.env` secrets, which the tool deliberately excludes.)
- **The repo is the source of truth.** Never edit the VPS in place; if forced, port the change back the same day and tick `discord-bot/OPENCHAMBER-VPS-EDITS.md`.
- **`bot:deploy` refuses** a dirty `discord-bot/` tree and unresolved named imports (`tools/check-bot-imports.mjs`). A first deploy after a drift period is a reconciliation — review `bot:check` output before syncing. Full detail in `CLAUDE.md` → "Bot Deployment".

## Plans & planning docs

- **Rule — plans live in `plan/`:** all plans and plan files go in a dedicated `plan/` folder at the repo root (e.g. `plan/plan.md`, `plan/<topic>-plan.md`). The whole `plan/` folder is **gitignored by default** — never commit plan files. Keep them local-only, or mirror the ones the bot needs to the VPS under `discord-bot/debug/`.

## Open plan

- **`plan/plan.md`** — Patient Name Autocomplete for Medical Records. VPS copy at `/opt/phmc-bot/discord-bot/debug/patient-name-autocomplete-plan.md`.
- **`plan/autopsy-caselink-webhook-plan.md`** — CASELINK requester completion webhooks + SADCR/DAO registry crossposting. SHIPPED & live (2026-08-26); plan file retained for the staging-runbook history + build checklist.

## Historical — pending deploys (2026-08-11, superseded)

- Shipped long ago; kept only for the reusable pointer: **EMS dev protocols live on the VPS, not RTDB** — `data/protocols-dev.json` → morgue-api `GET /api/protocols-dev` → `getProtocolsDev` function. Re-seed a doc change: `node tools/seed-protocols-dev.mjs` → upload `protocols_dev.json` to VPS `data/protocols-dev.json` → `pm2 restart morgue-api`. No Firebase writes, no `lsccDataVersion` bump.

## Field semantics (why certain fields exist)

- **Medical records use `decedentName` as the authoritative patient/subject name** — the medical "Patient Name" input writes both `decedentName` and `patientName` (kept in sync). The bot's `handleMedicalRecord` searches `decedentName || patientName`; the BBCode `{{patientName}}`/`{{PatientName}}` placeholders resolve `patientName || decedentName`.
- **The OAuth `faction` object never carries `firstname`** — it only has `characterId`/`characterName`/`rank`/`scriptRank`. Code must not key off `faction.firstname`.
- **Faction roster records store the character id as the record KEY** (`factions/364/members/<charId>`), not as a field. Always use the key, never `memberData.characterId`.
- **`gtawCharacterId` of e.g. `50230` may be a UCP **account** id, not a character id** (Sarah Bell's character is `156863`; `50230` is her account).

## Observability

- **Sentry (errors/breadcrumbs, authoritative) + LaunchDarkly Observability (session replay/logs/traces)** — both web-app only, inited in `src/index.jsx` (`src/services/launchdarkly.js`). Details in CLAUDE.md. LD is prod-only, privacy `none` (fictional RP data), key via `VITE_LAUNCHDARKLY_CLIENT_ID` (rebuild to apply).

## Recurring gotchas

- **Web deploys are test-gated**: `tools/deploy.js` (and therefore `npm run deploy`) runs the test suite before building/pushing — a failure blocks the deploy. `--force`/`--skip-tests` bypasses (logged). Prefer `node tools/deploy-with-gate.mjs` for the full flow. Tests report to Discord via `node tools/run-tests.mjs` (bot embeds the result). See `plan/refinements-plan.md` for the re-pin runbook — the BBCode goldens are fixture-pinned, so a live template edit must be re-pinned or deploys false-block by design.
- **Re-scheduling a bot report**: set `hasdeployed:false` + `deployStatus:'pending'` in `scheduledReports`, then restart the bot — its cold-load treats it as pending and re-queues.
- **Bot recovery sweeps** run sequentially via `runRecoveryHeartbeat`; the startup sweep is delayed 30s so the shared Playwright browser's startup tasks settle.
- **Reports already posted to the forum by the bot are not retro-fixed** by DB/script repairs — those need a manual forum edit.
- **Web app, bot and functions are agent-deployable** (`npm run build && node tools/deploy.js`, `npm run bot:deploy`, `firebase deploy`); hold off only when explicitly told not to (see CLAUDE.md).
- **Legacy `/form-handler` is decommissioned (2026-08-11)** — the route redirects to `/ui-prototype` and the component is no longer bundled. Don't re-add it; global CSS (`App.css`, `buttons.css`, bootstrap) now lives in `src/index.jsx`.

## Recent fixes — blank coroner credentials (2026-08-11)

- **Full RCA + fix doc:** `docs/coroner-credentials-blank-bug.md` (Fixes A–H, all shipped). Root cause: credential sync used a narrower OAuth name path than author resolution; Sarah Bell's OAuth payload surfaces her UCP **account** id (`50230`) where her character id (`156863`) is expected, so `user.faction` can be null → `coronerEmployee`/`Rank`/`Badge` saved blank.
- **Bot emergency handbrake:** `discord-bot/services/deployExecutor.js` `runDeploy` hard-stops any report with empty `coronerEmployee`/`phmcEmployee` — marks `deployStatus:'blocked_empty_employee'`, pings developer via webhook, never retries. Recovery: fix data (re-save or `node tools/fix-empty-coroner.mjs --include-scheduled --apply`), set `hasdeployed:false` + `deployStatus:'pending'`, restart bot.
- **Repair tool:** `tools/fix-empty-coroner.mjs` (dry-run default; `--apply` to write). `tools/pull-report.mjs <key>` pulls one report + BBCode for inspection.
- **Follow-up (deferred, not a fix for this):** OAuth profile response gives the account id per character as `user.id` + `character[].memberid` (character[].id is the real char id). Future option: store account ids on roster records or add a server-side name-match fallback in `processGtaWorldAuth`/`refreshGtawUser` (`allMembers[charId]` misses when the OAuth id is an account id) — never emit the account id as `characterId`/badge (regresses the 2026-08-07 fix).

## Key auth identity facts (for debugging OAuth sessions)

- `user.faction.characterName` is the reliable employee name source; fall back to `activeCharacter` then the OAuth `character[]` array.
- `refreshGtawUser` must use the roster record key as `characterId` — a mismatch there leaks the account id and wipes badges.
