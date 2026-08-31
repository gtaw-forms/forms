# PHMC Discord Bot — Changelog

## 2026-08-31 — AGH integration made optional (kept out of public forks)

### Changed
- **AdGuard Home metrics integration is now optional** — the AGH files
  (`services/aghMetrics.js`, `commands/agh-dashboard.js`, root `aghMetrics.js`)
  are **personal and gitignored**; they are not part of a public fork. `index.js`
  now guards every AGH import (`agh-dashboard` command data, `startAghMetrics`,
  `agh_refresh` button, command registration) with try/catch, so the bot boots
  cleanly when the files are absent. On this VPS they're still present → AGH
  dashboard unaffected (verified: `[AGH] ✅ metrics manager active`).
- VPS: created `/opt/phmc-bot/discord-bot/.private/` (hidden) and moved the
  redundant root `aghMetrics.js` duplicate there (`aghMetrics-root-copy.js`);
  the live `services/` + `commands/` copies remain.
- Deployed: SCP `index.js` + `pm2 restart phmc-bot` (↺51, online).

## 2026-08-30 (2) — RTDB egress reduction (P1 + P2 stage 1)

### Changed (RTDB download, ~300-500MB/day investigation)
- **P1 — bot morgue reads → VPS-local mirror** (`services/localMorgueData.js` + `deathRecordDraftCache.js` + `deathRecordDraftScan.js`): `initMorgueCache`, the `findMorgueRecord` fallback, and `scanAndDraftCKs` now load from the VPS `morgue-data.json` (same `{ caseId }` shape as RTDB) instead of full `db.ref('morgue-records')` reads (~5.5MB each). RTDB is the fallback if the mirror is missing.
- **P2 stage 1 — passive-CK listener no longer holds a full `newSavedReports` subscription** (`deathRecordDraftScan.js`): the old `on('value')` downloaded the whole 5.7MB `newSavedReports` node on every connect and streamed every user save. It now watches the **slim `unprocessedCKs` index** (written by the web app on every CK save) via `child_added`, and reads each matching report scoped (`newSavedReports/<author>/<key>`).

### Notes
- RTDB inventory: `newSavedReportBBCode` 11.2MB, `newSavedReports` 5.7MB, `morgue-records` 5.5MB (mirrored to VPS). Remaining P2 stages: migrate `newSavedReportBBCode` off RTDB (VPS + Cloud Function), paginate the admin full-node reads (`EmployeeManager`/`DatabaseEditor`).
- Deployed: SCP `localMorgueData.js`, `deathRecordDraftCache.js`, `deathRecordDraftScan.js` + `pm2 restart phmc-bot`.

## 2026-08-30 — morgue-api: valid API keys exempt from IP bans

### Fixed
- **Cloud Function `getMorgueRecords` intermittently failing with `functions/internal`.** The morgue-api had permanently banned 21 Google-range IPs (34.x/35.x) as "SCAN-*"; Cloud Functions egresses from **rotating shared Google IPs**, so when the function's egress landed on a banned IP it got 403 → the callable threw `internal` → the web app logged the error on every login → Discord error-webhook flood.
- **Requests carrying a valid `x-api-key` are now exempt from IP-ban + suspicious-block + 404-strike logic** (`morgue-api.js` security middleware, `req.hasValidApiKey`). Authorized clients are never IP-reputation blocked; keyless scanners still get 403/banned. Verified: banned-IP + valid key → 200, banned-IP + no key → 401.
- Cleared the 21 Google-range bans from `data/ban-state.json` (50 scanner IPs remain). Deployed + `pm2 restart morgue-api`.

## 2026-08-28 — per-session log files + dashboard "what is it doing"

### Added
- **Per-session log files** (`services/logger.js`) — each process start now opens a fresh `logs/bot-<timestamp>.log` (index.js) / `logs/api-<timestamp>.log` (morgue-api.js) instead of one shared `log.txt`. Old sessions auto-pruned (keeps the newest 12); 25MB safety cap rolls a runaway session to `<name>.1`. morgue-api.js now uses the file logger too (was console-only → pm2).
- **Activity log** (`services/activityLog.js`) — in-memory ring buffer of the last browser navigation, fed by a `page.goto` hook in `forumClient.js` `ensureBrowser` (single shared page, so one hook covers all scanning/posting/login activity).
- **Dashboard VPS Resources breakdown** (`services/vpsStats.js` + `dashboardManager.js`) —
  - Chrome now classified by Chromium `--type` (main/renderer/gpu/zygote/network/utility/broker) so `chrome ×7` reads as `main 1 · renderer 2 · gpu 1 · zygote 1 · …` — i.e. **one** Playwright browser, not 7.
  - Node classified by script (bot / morgue-api / pm2 / other).
  - New **`Currently`** line shows the last activity + how long ago (e.g. `scanning forum (phmc.gta.world/viewforum.php) · 2m ago`).

### Notes
- Verified on VPS: chrome ×6 → `main 1 · zygote 2 · gpu 1 · utility 1 · renderer 1`; node shows bot + morgue-api (+ generic `node` for pm2 daemon/helper processes — self-counting inflates this slightly while a diagnostic script runs).
- Deployed: SCP `logger.js`, `activityLog.js`, `vpsStats.js`, `dashboardManager.js`, `forumClient.js`, `morgue-api.js` + `pm2 restart phmc-bot` / `pm2 restart morgue-api`.

## 2026-08-28 (2) — orphan browser reap guard

### Fixed
- **Orphaned Chromium reaping** (`forumClient.js`) — `getSharedBrowser()` now kills any `chrome-headless-shell` whose parent is dead (PPID 1) before launching, so abrupt bot deaths (`uncaughtException` → `exit(1)`, SIGKILL) can no longer leave zombie browser trees behind. This was the cause of a transient `chrome ×12 (main 2)` on the dashboard: a restart overlap where the old process's browser lingered beside the new one. Only one browser is ever created in code (all ForumClient instances — including isolated agency clients — share `getSharedBrowser`); there is intentionally no "second Currently" line. Verified post-restart: chrome ×6 (one tree).
- Deployed: SCP `forumClient.js` + `pm2 restart phmc-bot`.

## 2026-08-28 (3) — browser lifecycle logs + lazy ME-roster fetch

### Added
- **Browser lifecycle logging** (`forumClient.js`) — the shared browser now logs `[LOG] Spawning BROWSER for <reason>` (first external caller on the stack, e.g. `checkForNewRequests (autopsyRequestMonitor.js)`) and `[LOG] Destroying browser for <reason>` via new exported `closeSharedBrowser()`. `index.js` now handles SIGTERM/SIGINT: closes the browser gracefully before exiting, so pm2 restarts stop orphaning Chromium (verified: `🛑 SIGINT received` → `Destroying browser for shutdown`).

### Changed
- **ME roster (`memberlist.php?g=50`) no longer fetched every 10-min heartbeat** (`autopsyRequestMonitor.js` `retryFailedAssignmentReplies`) — it now scans `autopsy-requested` *first* and only forces a PHMC login + paginates the ME group when at least one assignment reply genuinely needs a retry. A quiet heartbeat does zero forum work. The roster is still fetched on: new-request ME assignment, startup rotation init, and the assign/reassign/mass commands.
- Deployed: SCP `forumClient.js`, `index.js`, `autopsyRequestMonitor.js` + `pm2 restart phmc-bot`.

## 2026-08-28 (5) — form key rename: `testing-compact-mode` → `general_consultation`

### Changed
- Renamed the General Consultation form key `testing-compact-mode` → `general_consultation` in `global-stats.js`, `autoDeploy.js`, `deployExecutor.js`, `deployQueue.js`. Deployed + `pm2 restart phmc-bot`.
- **Legacy aliases added** so any report still carrying the old `formId` routes/deploys correctly (deployQueue normalizes on load; autoDeploy normalizes in both enqueue + dev-report paths; deployExecutor employee-field map keeps the old key).

## 2026-08-28 (4) — dashboard activity refresh every 5s

### Changed
- **VPS Resources field refresh 30s → 5s** (`dashboardManager.js`) — the `Currently — …` line (and CPU/MEM/procs) now update every 5s. Discord's docs rate-limit message endpoints (edit included) to **5 requests/5s per channel**; 1 edit per 5s uses ~20% of that bucket, so it's safe. Verified running.
- Deployed: SCP `dashboardManager.js` + `pm2 restart phmc-bot`.

## 2026-08-27 (2) — roster sync interval + startup health-check reduction + VPS infra

### Changed
- **Roster sync 4h → 12h** (`factionRosterSync.js`) — `COOLDOWN_MS` now 12h (+ up to 30min random offset); dashboard label and startup logic updated. Rosters update twice a day instead of six.
- **Startup health checks skip healthy forums** (`systemMonitor.js`) — on boot, `runHealthCheck` no longer runs the 3 Playwright forum checks if the cached `monitoring/forums` status is all `Good`. A restart doesn't mean the forums changed, and boot previously opened several browser pages needlessly (contributing to the renderer churn). Forums are still re-checked every 2h cycle, and still re-checked at boot if any forum was flagged down.

### Infrastructure
- **VPS firewall enabled (ufw)** — allow 22/80/3001/tcp + 41641/udp + `tailscale0`; default-deny inbound. CUPS snap disabled (was listening publicly on :631).
- **AdGuard Home v0.107.79 installed on the VPS** (`/opt/AdGuardHome`, GPG-verified, systemd service) — DNS served over a private **Tailscale** tunnel only (bind `100.84.161.69` + `127.0.0.1`, never public IP), access allowlisted to tailnet/loopback, Quad9 DoH upstream, AdGuard DNS + AdAway blocklists. See `plan/adguard-home-vps.md` for the runbook.

## 2026-08-27 — live VPS CPU/MEM stats on dashboard + Playwright context leak fixes

### Added
- **VPS Resources field on the dashboard** (`dashboardManager.js` + new `vpsStats.js`) — the system dashboard embed now shows CPU%, load, MEM/swap usage, uptime, and node/chrome process counts. Refreshed every **30s** via a lightweight in-place message edit (Discord's ~5 edits/5s per channel limit means 1 edit/30s is trivially safe); the heavy forums/queue data stays on the 5-min cycle. Chrome proc count doubles as a live leak monitor for the context fix below.

### Fixed
- **LSSD/DM isolated clients now close their context** (`deployAutopsyReply.js`) — the `finally` blocks on the LSSD completion client and the DM client deliberately skipped `close()` ("GC will handle cleanup"), which left one Chromium **renderer process (~150–240MB) alive per autopsy completion indefinitely**. Live VPS inspection showed 4 stale renderers totalling ~1.09GB RSS (bot up 21h) — the main driver of the 1.8GB VPS being memory-saturated. Both blocks now `try { await client.close(); } catch {}`, matching the already-correct fallback path. `close()` (forumClient.js) already delays 1s for health-check page creation and suppresses errors, so the original stealth-race concern no longer applies.
- **Removed dead duplicate `close()` in `ForumClient`** (`forumClient.js`) — two `close()` methods existed; the first was shadowed by the second and referenced a non-existent `this.browser`. Left only the context/page-closing implementation.
- **Immediate relief on VPS:** `pm2 restart phmc-bot` reclaims all leaked renderer memory (single shared browser process torn down and relaunched).

### Notes
- Files: SCP `services/dashboardManager.js`, `services/vpsStats.js`, `services/deployAutopsyReply.js`, `services/forumClient.js` + `pm2 restart phmc-bot`.
- VPS stats module smoke-tested on the host (CPU/mem/swap/uptime/proc counts all sane).

## 2026-08-26 (3) — completion webhook refinements, DAO live, `/forward-autopsy-complete`, morgue hardening

### Added
- **`/forward-autopsy-complete`** (owner-only) — manual send/re-send of the requester completion notification through the **REAL** faction webhook (`ignoreTestMode` bypass on `getFactionWebhookUrl`). Destination precedence: explicit `webhook:` option > real faction var; blank faction var = refused with guidance before anything sends. Same payload as the automatic flow (origin-aware copy, intranet links, CASELINK/Records button deep-link). Roles post-cutover: recovery of failed sends, retro-fit notifications for pre-feature cases, corrections via `faction:` override. Registered in both the REST payload and handler map.
- **DAO webhook wired** — `AUTOPSY_REQUESTER_WEBHOOK_DAO` now set on VPS + mirrored locally; all three registry factions live. Verified by `/forward-autopsy-complete case:10025` → real DAO channel (`OK`), plus an automatic test-routed send to dev.
- **Morgue API scanner defense expansion** (`morgue-api.js`) — after live junk-probe logs (`hassio` double-encoded traversal, Cognito/JMeter/mesh probes): new instant-ban patterns `SCAN-hassio/cognito/jmeter/runscript/supervisor/mesh-probe` + `SCAN-traversal-encoded` (`%252e`-class encodings missed before); generic **path-enumeration ban** — ≥12 DISTINCT unknown API paths in 10 min = instant permanent ban (`SCAN-path-enumeration`), repeat-hammering one path stays un-punished; **trust guard** — loopback always trusted + optional `MORGUE_API_TRUSTED_IPS`, so our own probes can never self-ban. Live-verified: loopback probes stay clean 404s; enumeration probe #13 → `403 permanently banned`; hassio single probe → instant ban. Test tools shipped: `scanner-ban-test.mjs`, `banstate-remove.mjs`.
- **Morgue search typo-tolerance (API)** — `searchLocalRecords()` is now per-word tolerant: adjacent-transposition swaps + one-char deletions ("autospy" resolves "Autopsy"). Root-caused a CASELINK "Not in morgue" false negative to their own typo + IC-vs-OOC name mismatch (records store `Unknown (( OOC ))`); documented query semantics for their dev.

### Fixed
- **Assigned Autopsies modal morgue matching** (`AssignedAutopsiesModal.jsx`) — same root cause on the web side: strict substring match missed typo'd OOC terms entirely ("john doe" can never match an anonymized record). Added word-level fuzzy fallback (`haystackMatchesTerm`) feeding the existing location/date/time scorer at slightly lower weight; error copy changed from misleading "Not in morgue — contact an ME." to "No morgue match — intake may not exist yet."
- **PHMC Inbox button URL** — `ucp.php?i=pm&mode=inbox` → correct `?i=pm&folder=inbox` (shared constant `PHMC_INBOX_URL`; applies to every payload path).
- **RTDB data repair (one-shot)** — `tools/fix-autospy-typo.cjs` fixed CASELINK's "Autospy Test" typo inside `autopsy-requested/10025` (title, oocName, caseTitle, parsed tree, requestBbCode). Forum topics intentionally untouched so CASELINK tracking stays consistent with what they posted.

### Changed
- **Completion payload copy is channel-aware** (CASELINK dev feedback) — only CASELINK-posted requests may say "CASELINK": automatic flow fires solely for those today (gate unchanged), but human-origin payloads render "**…**A full copy has been sent to your PHMC inbox, and it is available under your [agency intranet](<…>)" with an "Autopsy Records" button instead; unknown-faction edge degrades to plain-text phrasing rather than dead `[link](<null>)`. Flag rides persisted `postedByCaselink`; `mimic-requester-webhook.mjs --human` previews the branch. CASELINK wording additionally gained "[your SD Intranet](<…>)" inline link (same recordUrl backing the button — text and action never disagree).

### Notes
- Files: SCP `services/requesterWebhook.js`, `commands/forward-autopsy-complete.js`, `morgue-api.js`, `index.js`, `.env.example` (+ restart `phmc-bot` and `morgue-api`).
- Validator from this session: `node debug-testing-scripts/list-guild-commands.mjs` proves registration against Discord's API directly (41→42 commands).
- Key rotation reminder outstanding (token, forum passwords ×4 sharing one value, FACE key, morgue keys, webhook URLs seen in session transcripts).
- Status: dev-test assignment OFF; `AUTOPSY_REQUESTER_WEBHOOK_TEST_MODE=true` pending final flip → then automatic completions land in real LSSD/SADCR/DAO channels with zero manual steps.

## 2026-08-26 (2) — `/enable-dev-autopsy` forced-ME dev mode

### Added
- **`/enable-dev-autopsy`** (owner-only) — flips DEV TEST assignment mode without SSH/restart: every **new** autopsy case is assigned to the configured ME (**default Alyson Frost**; optional `me` option / `AUTOPSY_DEV_TEST_ME`), while the entire rest of the pipeline runs normally — detection, case creation, certified-copy crossposts (LSSD/SADCR/DAO), acknowledgements, requester completion webhooks, retries. Already-assigned cases are untouched. Actions: `Enable` / `Disable` / `Status`; runtime takes effect immediately and both vars persist to the bot's `.env` so the mode survives restarts. LOA rules and supervised `ASSIGNED:` markers are bypassed while active; a loud `[DEV TEST]` banner posts to the log channel at startup when on.
- **`services/envFile.js`** — comment-preserving `.env` upsert util (`AUTOPSY_DEV_TEST`/`AUTOPSY_DEV_TEST_ME`): replaces in place, uncomments commented keys, collapses duplicates, preserves CRLF/LF + everything else byte-for-byte, idempotent no-op when unchanged.
- The pre-existing hardcoded dev branch in `selectME` now reads the configurable ME (`getDevTestME()` in `autopsyRotation.js`) — same default Alyson Frost.

### Notes
- Both monitor paths (single + multi-decedent) check the flag BEFORE rotation AND before supervised-override resolution, so "always" truly means always.
- On-disk state diverges from real OS env vars only if someone sets them outside .env (boot loader already prefers process.env).
- Deploy: SCP `commands/enable-dev-autopsy.js`, `services/envFile.js`, `services/autopsyRotation.js`, `services/autopsyRequestMonitor.js` + `pm2 restart phmc-bot`. Test coverage: `debug-testing-scripts/envfile-test.mjs`.

## 2026-08-26 — CASELINK completion webhooks + SADCR/DAO agency crossposting

### Added
- **Requester completion webhooks (CASELINK)** — new `services/requesterWebhook.js`. When an autopsy completes for a `postedByCaselink` request, the requesting faction's Discord webhook posts: `<@ID>` ping when the officer's numeric Discord ID resolves, else a name salutation ("Katherine Olsen, your autopsy request has been completed, you can view it in CASELINK or via DMs."); embed with Case NR/title + Medical Examiner / ME Discord; link buttons **CASELINK** (deep link to the faction forum reply, else the records forum), **PHMC Inbox**, **PHMC Discord** (`https://discord.gg/zYdhJvHvUa`). Fully gated: private cases and non-CASELINK requests never fire; multi-decedent defers until every case completes.
- **Faction webhook env vars** — `AUTOPSY_REQUESTER_WEBHOOK_LSSD/_SADCR/_DAO/_LSPD` (blank = silently skipped; DAO/LSPD ship blank but fully coded) plus test routing: `AUTOPSY_REQUESTER_WEBHOOK_TEST_MODE=true` sends EVERY faction to `AUTOPSY_REQUESTER_WEBHOOK_TEST_URL` with `[TEST-OVERRIDE]` logging. See `.env.example`.
- **SADCR/DAO agency crossposting** — the LSSD-only pipeline is now registry-driven (`services/agencyForums.js`: LSSD f=2263, SADCR f=2328, DAO f=2331 — all subforums of lssd.gta.world sharing FORUM_LSSD_* credentials). Monitor Step 3 searches the requesting faction's OWN forum for an existing request topic (CASELINK duplication guard: search-first, create only for positively-human posters with the raw request BBCode in a certified-copy shell), stores faction-keyed topic ids (`sadcrRequestTopicId`/`daoRequestTopicId`; LSSD field unchanged), acks there, and completion replies the combined notice+report to the same topic. Counters now route per faction (previously SADCR fell into the LSSD bucket); faction regex/parser accept SADCR+DAO tags in titles and Department fields.
- **Requester identity persisted at detection** — `requesterPoster`, `postedByCaselink`, `requesterDiscordTag` saved on `autopsy-requested/<topicId>`; parsed from Section 1 Contact Information (`(( Discord Name: ... ))` or numeric ID). Preserved across resets/reprocessing.
- **New tracked completion step** `requesterWebhook` (two-phase, recovery-sweep retryable via `retryFailedCompletionSteps`) + progress-embed step "Requester Discord Notification". Agency ack retries gained their own sweep (`retryFailedAgencyAcknowledgements`) for SADCR/DAO.

### Commands & tooling
- `/test-requester-webhook <case> [faction]` (owner-only) — pulls a real `autopsy-requested` record, sends the live payload through current config, reports ping resolution + routing. Optional faction override previews SADCR/DAO routing regardless of the record's faction.
- `debug-testing-scripts/mimic-requester-webhook.mjs` — offline/local mimicry of completions using the real payload builder (`--entry <key>` read-only pull, `--synthetic`, `--as <FACTION>`, `--multi`, `--no-me`, `--unassigned`, `--send <url>` / `--print`). All testing stages post to the dev-discord webhook configured on the VPS.
- `tools/stage0-parser-test.mjs` — parser regression for the new requesterDiscord field.
- `tools/reset-autopsy-request.mjs` now preserves the new identity/topic-id fields.

### Notes
- Web app unchanged — no redeploy needed. Deploy: SCP `services/agencyForums.js`, `services/requesterWebhook.js`, `services/completionTemplate.js`, `services/deployAutopsyReply.js`, `services/deployLssd.js`, `services/autopsyRequestMonitor.js`, `services/autoDeploy.js`, `commands/test-requester-webhook.js` + `.env` additions + `pm2 restart phmc-bot`.
- Staging checklist: fill LSSD/SADCR webhook URLs + TEST_URL on the VPS `.env`, set `AUTOPSY_REQUESTER_WEBHOOK_TEST_MODE=true` for validation, flip off before cutover. DAO intentionally left blank.

## 2026-08-25 — Auto-forward assigned autopsies to the PHMC Discord webhook

### Added
- **Assigned autopsies are now auto-forwarded** — `notifyAssignment` (`meDiscordNotify.js`) posts to the forwarding webhook (`PHMC_FORWARD_WEBHOOK_URL`, same template/target as `/forward-autopsy-notify`) on every assignment, so no manual command is needed. Covers single + multi-decedent assignments and reassignments. The webhook is now centralized as `PHMC_FORWARD_WEBHOOK_URL` in `assignmentWebhook.js` (configurable via `FORWARD_WEBHOOK_URL` in `.env`), and `/forward-autopsy-notify` uses it too (with the `/webhook` override retained).
- **Tag validation** — the forward includes the resolved `<@discordId>` ping (6/8 rotation MEs mapped; Yuri Zhou + Eun Jae fall back to a bold name until mapped via `/me-discord`). Live-tested: `[FORWARD-WEBHOOK] Forwarded assignment for Edward Baskin (case TEST) [ping]`.

### Notes
- Deploy: SCP `services/assignmentWebhook.js`, `services/meDiscordNotify.js`, `commands/forward-autopsy-notify.js` + `pm2 restart phmc-bot`.

## 2026-08-23 — Death Record post-posting forum verification (30-min delay)

### Added
- **`verifyPostedDeathRecords`** (`deathRecordDraftScan.js`) — after an approved death record, waits **30 minutes** (`verifyAfter` = approve time + 30 min, so either the bot's auto-post *or* a staff manual post can land), then scans the Death Records forum (f=404) for the topic by title/case number. Found → marks the draft `verified` + `verifiedAt` + `verifiedTopicId`. Not found → marks `verificationFailed` + posts a `⚠️ Death Record Not Verified` alert to the log channel (human check, no auto re-post).
- **Wired into the recovery heartbeat** (`autoDeploy.js`) as a `death-record-verify` sweep, alongside the existing interrupted-approval recovery.
- `verifyAfter` is stamped on the draft in `handleApprove` (`deathRecordDraftActions.js`).

### Notes
- Simulated/DRY approvals are skipped (no real forum topic to verify).
- Death Records (CK posts) are **f=404** — the post target and verify sweep both scan f=404 (f=267 is the separate Coroner Reports / Mass Fatality forum).
- Deploy: SCP `services/deathRecordDraftScan.js`, `deathRecordDraftActions.js`, `deathRecordDraft.js`, `autoDeploy.js` + `pm2 restart phmc-bot`.

## 2026-08-21 — Client build stamp on deploy embeds

### Added
- **Deploy progress embeds now show the client build** — `DeployProgressEmbed` accepts an optional `buildLabel` (threaded from `reportData.appBuild` in `deployPM`, `deployCoronerEmail`, `deployMedicalRecord`, `deployAutopsyReply`, `deployTopic`, `deployQueue`), appended to the footer as `· client build <index>`. Combined with the web-side `appBuild` stamp, this surfaces which client bundle produced each report (stale-vs-current diagnostics). Reports saved by older clients simply omit the label.

### Notes
- Deploy: SCP `services/deployLogger.js`, `deployPM.js`, `deployCoronerEmail.js`, `deployMedicalRecord.js`, `deployAutopsyReply.js`, `deployTopic.js`, `deployQueue.js` + `pm2 restart phmc-bot`.

## 2026-08-17 — Assignment notification refinements: forward command + friendlier wording

### Added
- **`/forward-autopsy-notify`** (owner) — forwards a real autopsy assignment to the community **"Autopsy Bot" webhook** (`1538007200188997672`, guild `860254678653992992`). Resolves a case by number/topic/title fragment from `autopsy-requested`, resolves the ME's Discord mapping, and posts the full webhook embed (ME, case number, decedent, thread link, wait-window). Optional `/webhook` override destination. Backed by a new reusable `forwardAssignmentWebhook()` in `assignmentWebhook.js`.

### Changed
- **Webhook `content` wording** — `buildContent` now renders a friendlier line: `@<discordId> Dr. <ME>, you've been assigned an autopsy — here's the case file and links.` (instead of `@Ralof Medical Examiner: Anne Carter`). Supports an optional `label` (e.g. "reassigned an autopsy") threaded through `notifyAssignmentWebhook` / `forwardAssignmentWebhook`.

### Notes
- Deploy: SCP `index.js`, `commands/forward-autopsy-notify.js`, `services/assignmentWebhook.js` + `pm2 restart phmc-bot`.

## 2026-08-17 — Autopsy reassignment: fix case filter + notify new ME

### Fixed
- **`/reassign-autopsy` case filter** — the active-case list required `title.includes('autopsy request')`, which excluded *report*-titled cases like `[Autopsy Report] Bradley Kellerman [SADCR]` (the one assigned+incomplete case → "No active assigned cases found" despite 39 assigned). Now shows **any assigned, not-yet-completed** case.
- **Reassigned ME is now notified** — `/reassign-autopsy` previously edited the forum title + posted a forum notice but sent **no Discord/webhook ping** to the newly-assigned ME. It now calls `notifyAssignment` (same path as initial assignment) with the wording **"Autopsy Case Reassigned"**: webhook `<@me>` ping + embed (title `🔬 Autopsy Case Reassigned`), plus the log-channel mention. `notifyAssignment`/`assignmentWebhook` gained optional `label`/`embedTitle`/`title` overrides.

### Notes
- Deploy: SCP `commands/reassign-autopsy.js`, `services/meDiscordNotify.js`, `services/assignmentWebhook.js` + `pm2 restart phmc-bot`.

## 2026-08-17 — VPS crash recovery + memory-hardening (18th July 2026 incident)

### Incident
- VPS (1.8GB RAM, **no swap**) froze at ~23:27 UTC after a Discord websocket `Opening handshake has timed out` crash (22:15 UTC). Root cause: memory exhaustion — the CCTV `fetch-all.js --headless` child timed out (20:54) and `child.kill()` (SIGTERM) **orphaned the headless-chromium grandchild**, leaking RAM on a box already at ~74% baseline. With no swap, the kernel couldn't OOM-kill; the box just starved/froze (no `oom-killed` events in the log confirms this).

### Fixed
- **CCTV process-tree kill** (`services/cctvScheduler.js`) — the fetch child now spawns `detached: true` (own process group) and on timeout *or* close the whole tree is swept with `process.kill(-child.pid, 'SIGKILL')`, so leaked headless browsers die instead of accumulating RAM.
- **Fail-fast crash handling** (`index.js`) — `uncaughtException` now logs + sends the crash report and then `process.exit(1)` so pm2 does a clean restart, instead of the bot limping along with a half-connected Discord websocket.
- **Earlier RAM alert** (`services/systemMonitor.js`) — high-memory alert threshold lowered 85% → **70%** (the box was at 74% before it died, so the old threshold never fired).
- **2GB swap added on the VPS** — `/swapfile` persisted in `/etc/fstab`, `vm.swappiness=10` via `/etc/sysctl.d/99-swappiness.conf`. Gives the kernel room to OOM-kill the leaker instead of freezing the box.

### Notes
- Deploy: SCP `services/cctvScheduler.js`, `index.js`, `services/systemMonitor.js` + `pm2 restart phmc-bot`; swap was applied directly on the VPS.

## 2026-08-16 — `/maintenance splash` + pause all queues during outages

### Added
- **`/maintenance splash` subcommand (owner only)** — `on <title> <message> [eta]` shows the web app's full-screen splash **and** pauses all deploy queues (`appMetadata/botMaintenance = true`); `off` lifts the splash and resumes; `status` shows both. Writes `appMetadata/maintenance/splash` with `updatedBy`/`updatedAt` audit.
- **Maintenance gate now covers ALL outbound work** — added `isMaintenanceMode()` early-return guards to `handlePM`, `handleMedicalRecord`, `handleAutopsyReply`, `retryFailedCompletionSteps`, `processReportEdits`, and `checkRetryQueue` (previously only the auto-deploy queue + coroner emails paused).

### Notes
- Deploy: SCP `commands/maintenance.js`, `services/deployPM.js`, `services/deployMedicalRecord.js`, `services/reportEdits.js`, `services/deployAutopsyReply.js`, `services/deployRetry.js` + `pm2 restart phmc-bot`.

## 2026-08-15 — SADCR roster sync + roster-check API

### Added
- **SADCR in `factionRosterSync.js`** — new config scrapes the SADCR forum (`FORUM_SADCR_URL`, group `g=11`) with the existing `FORUM_SADCR_USERNAME`/`PASSWORD` into `data/sadcr-roster.json` (32 members on first sync). Credential selection generalized to per-config env keys (`usernameEnv`/`passwordEnv`); sync summary + log-channel message now iterate all factions. `getRosterSyncStatus()` also returns `sadcrCount`.
- **SADCR in `morgue-api.js` roster endpoints** — `/api/roster/check` now accepts `dept=sadcr` and includes SADCR in auto-detect; `/api/roster/sadcr` serves the full roster.

### Notes
- SADCR forum credentials already existed on the VPS (`data/agency-credentials.json`, `FORUM_SADCR_*`). Verified live: `check?name=Dante&dept=sadcr` → found; auto-detect finds SADCR members. Deploy: SCP `services/factionRosterSync.js`, `morgue-api.js` + `pm2 restart phmc-bot morgue-api` + one-off `syncFactionRosters()`.

## 2026-08-15 — Webhook ME assignment notifications

### Added
- **Webhook-based assignment pings** (`services/assignmentWebhook.js`) — when `ASSIGNMENT_WEBHOOK_URL` is set, newly assigned autopsy cases post to that webhook with `<@me> Medical Examiner: **Name**` + an `🔬 Autopsy Case Assigned` embed (ME, case #, decedent/OOC, thread, CK/PK wait window) + `View Case` / `PHMC Forms` **link buttons** (`?with_components=true` + `allowed_mentions: { parse: ['users'] }`). Fully non-blocking (10s timeout) so it can never stall an assignment.
- **Wired into `autopsyRequestMonitor.js`** (single + multi-decedent assignment points) passing `decedent`/`ooc`/`caseNumber`/`deathType`; `notifyAssignment` pings via the webhook when configured and posts to the log channel **without** the mention (no double-ping). Unmapped MEs degrade to a bold name (no ping) — the forum assignment reply still tags them in-game.

### Notes
- Config: `ASSIGNMENT_WEBHOOK_URL` in `.env`. Deploy: SCP `services/assignmentWebhook.js`, `services/meDiscordNotify.js`, `services/autopsyRequestMonitor.js` + `pm2 restart phmc-bot`.

## 2026-08-15 — Interactive `/me-discord` mapping panel

### Changed
- **`/me-discord` is now a button-driven panel** (`commands/set-me-discord.js`) — lists MEs on the rotation who lack a Discord mapping with an `Add: <name>` button per ME; clicking opens a modal to paste the Discord user ID / @mention; on submit the mapping is saved and the panel re-renders (ME moves to ✅ Mapped). `me_map_*` button + `me_modal_*` submit handlers wired into `interactionCreate`.

## 2026-08-15 — Test ping + explicit mention handling

### Added
- **`/test-ping` (owner)** — sends an @mention test notification to the log channel.
- **`logChannel.js` now sends `allowed_mentions`** — `{ parse: ['users', 'roles'] }` (plus `here` for crash reports) so `<@id>` pings are guaranteed and `@everyone`/`@here` are never accidentally triggered.

## 2026-08-15 — Standalone webhook notifier + buttons

### Added
- **`debug-testing-scripts/notify-webhook.mjs`** — standalone webhook notifier: ME assignment mode (`--me` + case fields), generic JSON payload template (single case or multi-decedent `cases[]`), `View Case` / `PHMC Forms` link buttons, `--wait` (verify buttons rendered), `--dry-run`, `--mapping` file. Samples: `sample-assignment.json`, `sample-multi-assignment.json`, `discord-mappings.json`.
- **Webhook buttons require `?with_components=true`** on incoming (non-application-owned) webhooks — the `components` field is ignored otherwise. Link buttons (style 5) render; interactive buttons (custom_id) need an application-owned webhook.

### Housekeeping
- **Ops fix:** the bot crash-looped after `index.js` referenced `commands/test-ping.js` that wasn't uploaded to the VPS — file added, clean restart, `/me-discord` re-registered without options.

## 2026-08-15 — `/global-stats` PHMC Forms usage stats

### Added
- **`/global-stats` (owner)** — paginated stats with three pages reachable via buttons on the embed (`📊 Overview` / `📋 Full Breakdown` / `🔥 Activity Heatmap`):
  - **Overview** — total reports & users, Report Volume by Section (Coroners / ER &amp; Clinical / Mental Health + other, with bars, subtotals, % and per-form counts), By Month (last 6), and top 5 users per section.
  - **Full Breakdown** — every form type with counts, top 10 users overall, and top 8 per section.
  - **Activity Heatmap** — a 7-day × 24-hour (UTC) intensity grid (`·░▒▓█`) of report submissions, with a legend and peak stats (busiest day + peak hour).
- Button handler wired into `interactionCreate` (`handleStatsPage`); each page recomputes from the live stores.

### Changed
- Dropped the "Deploy Queue" and "Legacy / Recovery" fields per product feedback.

### Notes
- Deploy to VPS: SCP `commands/global-stats.js`, `index.js` + `pm2 restart phmc-bot` (registers the slash command + button handler).

## 2026-08-15 — Report edit worker: full paper trail

### Changed
- **`reportEdits` worker now has a visible paper trail** (`reportEdits.js`):
  - Posts a `📝 Report Edit Requested` notice to the log channel when it picks up a request (report + target topic), then a green `✏️ Report Edited` with a topic link on success, or a red `⚠️ Report Edit Failed` with the reason on failure.
  - Appends every attempt to the report's `editHistory` array (`{ at, status, url?, error? }`) and sets `lastEditStatus` / `lastEditUrl` / `lastEditError` on the record — a durable audit trail visible to the UI.

### Notes
- Deploy to VPS: SCP `services/reportEdits.js` + `pm2 restart phmc-bot`.

## 2026-08-15 — Auto coroner email no longer overwrites the topic deploy target

### Fixed
- **Auto-coroner-email PM was clobbering the report's deploy target** (`deployCoronerEmail.js`) — when a coroner-report/mass-fatality deploy posts a topic (`deployUrl` = PHMC topic) and then auto-sends the coroner email as a side-effect on the SAME record key, the email's `markReportComplete(..., 'pm', pmUrl)` overwrote `deployUrl` with the LSSD PM URL. "View post ↗" and Edit & Repost then pointed at the PM instead of the PHMC topic. The side-effect email now writes its URL to `coronerEmailUrl`/`coronerEmailSentAt`/`coronerEmailTo` and leaves the topic's `deployUrl`/`deployType`/`deployTopicId` intact. Standalone `coroner_email` reports still deploy normally via `markReportComplete('pm', …)`.
- **Repaired the existing Alfonso Tanilon record** (topic `t=9982` restored as `deployUrl`, PM URL preserved under `coronerEmailUrl`).

### Notes
- Deploy to VPS: SCP `services/deployCoronerEmail.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — Self-serve "Edit & Repost" for deployed reports

### Added
- **Deploy target persisted on every report** (`deployStatus.js`) — `markReportComplete` now stores `deployUrl` (+ parsed `deployTopicId`/`deployPostId`) on the report record, so the system knows WHERE each report was posted (required for in-place editing and for the "View post ↗" links in the web app).
- **`forumClient.editPostContent(topicId, forumId, postId, newBbCode, { title })`** — edits a post's content (and optional subject) in place via the `posting.php?mode=edit` flow (login handling included); resolves the topic's first post when no postId is given.
- **`reportEdits` worker** (`reportEdits.js`, run from the recovery heartbeat) — applies `reportEdits/<author>/<key> = { status: 'requested' }` requests: loads the regenerated BBCode + the stored deploy target, edits the post in place, then marks the report `deployStatus: 'edited'`. **Autopsy and coroner_email are excluded** from edit-eligibility (heavily automated / PM-based — must not be touched). Failed edits are recorded (`lastEditStatus: 'failed'` + reason) for the UI to retry.

### Notes
- Requires the matching web-app change (`changelog.md`) for the Misc → "Fix Deployed Report" UI.
- Deploy to VPS: SCP `services/deployStatus.js`, `services/forumClient.js`, `services/reportEdits.js`, `services/autoDeploy.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — Fix LSPD/LSSD status write on a root Reference

### Fixed
- **`db.ref is not a function` on crosspost status writes** (`deployLspd.js` + `deployLssd.js`) — the completion flow passes `state.dbRef`, which is a **root Reference** (`db.ref()`; has `.child`, no `.ref`), so `writeStatus`/the retry sweeps calling `db.ref(...)` threw and silently skipped `lspdCrosspostStatus`/`lssdCrosspostStatus` (left stuck at `pending`/unset while the actual forum crosspost posted fine). Both files now route all status writes/queries through a `refFor(db, path)` helper that handles a Database (`.ref`) or a Reference (`.child`).
- **Ledger corrected** — `9951` and `9974` set to `lspdCrosspostStatus: completed` (their reports were already posted to #128223 / #128346); verified the fix path works with both db shapes.

### Notes
- Deploy to VPS: SCP `services/deployLspd.js`, `services/deployLssd.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — Faction-specific "Gov Intranet" link in completion notices

### Changed
- **The completion notice's Gov-Intranet line is now faction-specific** (`completionTemplate.js` + all 5 `buildCompletionBb` call sites) — instead of the hardcoded "For LSPD… and for LSSD…" text it now renders one of:
  - **LSSD crossposted** → direct link to the posted LSSD completion reply (`lssdUrl`).
  - **LSPD** → direct link to the LSPD certified-copy topic (`lspdUrl`, from the tracked `lspdTopicId`), or the f=1361 viewforum when no topic id exists.
  - **Neither (private / no crosspost)** → "The completed report has been delivered to your PHMC Intranet Inbox."
- `buildCompletionBb` now takes a `{ faction, lssdUrl, lspdUrl }` context (a plain string is still accepted as the LSSD URL for backward compat). Faction is derived from `entry.faction` / the request `[LSPD]`/`[LSSD]` title tag, falling back to `private`.
- Applied across the main completion flow, the picker path (`deployInteraction.js`), the recovery retry (`retryFailedCompletionSteps`), and `/force-autopsy-send`.

### Notes
- Deploy to VPS: SCP `services/completionTemplate.js`, `services/deployAutopsyReply.js`, `services/deployInteraction.js`, `commands/force-autopsy-send.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — Picker path fixed + stuck multi cases repaired + COMPLETED gated for multi

### Fixed
- **The staff-pick completion path (`deployInteraction.js`) now handles multi-decedent records** — it only matched top-level `oocName` and never did the LSPD crosspost, so any multi (or manually-picked) case that deployed through it was never marked completed and never crossposted. It now matches by the replied `caseTopicId` (top-level + per-case `cases/<idx>`), marks per-case `completedAt` (+ request-level when all decedents done), and fires the LSPD crosspost (`crosspostAutopsyToLspd`).
- **COMPLETED replies are deferred until the whole multi request is done** (`deployAutopsyReply.js` + `deployInteraction.js`) — the PHMC f=265 completion notice and the requester DM no longer post "We have completed the autopsy investigation" per decedent; for multi records they post only once, when `allCasesDone`. Per-decedent report deliveries (LSPD/LSSD crossposts) still happen as each case completes, so no report is lost.

### Repair (manual, applied via a one-off DB script + recovery heartbeat)
- **Retro-completed the two stuck multi cases** that deployed via the picker path and never completed:
  - `9951/case0` (Anne Carter / Marvion Futrell) → LSPD #128223 report posted, f=265 completion reply posted.
  - `9974/case0` (Brandy Smith / Roman Kuznetsov) → LSPD #128346 report posted, f=265 completion reply posted.
- **Re-queued the Vuk Dragovich report** (was `skipped_manual`) — cold-load redeployed it via the multi direct-lookup to `caseTopicId 9976`, posted the reply, completed `9974/case1`, and crossposted Vuk's report to LSPD #128346. `9974` is now fully complete (both decedents).

### Notes
- `9951` stays open until Dylan Bongo's autopsy is submitted (correct — one decedent still pending).
- The premature f=265 completion replies already posted during the repair (Roman @22:49, Marvion @22:48) are on the forum and not retro-fixed; the new gating prevents this going forward.
- Minor ledger quirk: the LSPD crosspost status write logs `db.ref is not a function` for the passed db object (status field stays `pending`), but the crosspost itself posts fine — flagged for a follow-up.
- Deploy to VPS: SCP `services/deployInteraction.js`, `services/deployAutopsyReply.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — Autopsy deploy uses the tracked case topic for multi-decedent cases

### Fixed
- **Autopsy report deploys no longer prompt staff to pick a case thread for multi-decedent requests** (`deployAutopsyReply.js`) — the direct lookup only matched TOP-LEVEL `oocName`/`name`/`caseTopicId`, but multi records store those per-case under `cases/<idx>` (top level has none), so e.g. a "John Doe ((Marvion Futrell))" report fell through to the forum search and asked staff to pick. The direct lookup now also scans multi records' per-case data (OOC match takes priority; name match as fallback with the "john doe" guard; active case preferred over completed, then newer `caseNum`) and uses the tracked `caseTopicId` directly. Verified against live data: Marvion Futrell → #9955, Dylan Bongo → #9956, Roman Kuznetsov → #9975, Vuk Dragovich → #9976 — no search, no picker.
- This also closes the original "Vuk Dragovich pick expired" class: a tracked multi case never needs a manual pick.

### Notes
- Reports for cases that were never tracked (manually-created threads) still fall back to the search + picker, as before.
- Deploy to VPS: SCP `services/deployAutopsyReply.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — Dashboard/startup-scan split multi-decedent ME rows

### Fixed
- **The dashboard "🔬 ME Assignments" section no longer comma-merges multi-decedent MEs** (`dashboardManager.js`) — it keyed off the top-level `assignedTo`/`title` (the dashboard aggregate), rendering `**Anne Carter, Alyson Frost** — *Dylan Bongo, Marvion Futrell*`. It now expands multi records per-case (`cases/<idx>/assignedTo`), showing one row per ME with their own decedent (`oocName`) and their own case URL. Verified against live data (9951 → Anne Carter @9955 / Alyson Frost @9956; 9974 → Brandy Smith @9975 / Arthur Blackwood @9976).
- **The startup "Autopsy Status" scan lists multi-decedent cases per ME too** (`autoDeploy.js`) — same expansion, so the `• Decedent → ME` lines never show a comma-joined ME.
- (Together with the `autopsy-stats` split, no surface merges multi names anymore.)

### Notes
- The overdue monitor (`systemMonitor.js`) still reports multi requests at request level with the aggregate ME — flagged as a possible follow-up if per-case overdue reporting is wanted.
- Deploy to VPS: SCP `services/dashboardManager.js`, `services/autoDeploy.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — autopsy-stats splits multi-decedent ME rows

### Fixed
- **`/autopsy-stats` no longer merges multi-decedent MEs** (`commands/autopsy-stats.js`) — the "By ME (assignments)" section keyed off the top-level `assignedTo`, which for multi records is the comma-joined dashboard aggregate (e.g. "Anne Carter, Alyson Frost: 1 assigned / 0 done"). It now iterates the per-case assignments (`cases/<idx>/assignedTo`), counting each decedent's case against its own ME (per-case `completedAt` for the done count), with a legacy fallback that splits the aggregate string when no per-case records exist. Verified against live data: 9951/9974 now contribute to the correct individual MEs instead of merged rows.

### Notes
- Deploy to VPS: SCP `commands/autopsy-stats.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — Surge mode surfaced in rotation UI

### Changed
- **`getRotationStatus` now reports surge state** (`autopsyRotation.js`) — returns `surgeMode` (every non-LOA ME has ≥1 active case) and `surgePick` (the deterministic next surge assignment: least-loaded ME, ties → oldest `lastAssigned`, preserving rotation order for exact ties). Mirrors `selectME` Phase 2 exactly.
- **`/rotation-list` shows a surge banner** — when surge is active the embed prints `🔀 SURGE MODE ACTIVE` with the least-loaded/oldest tie-break rule and the concrete next pick, and `Next Up` reflects the surge pick instead of "all busy".
- **`/autopsy-request` preview embed shows rotation status** — when no explicit `me:` override is given (auto-assign), the preview adds a `Rotation Status` field: `🔀 Surge mode active — … → next up: <name>` in surge, or `Rotation next up: <name>` in normal mode.

### Notes
- Deploy to VPS: SCP `services/autopsyRotation.js`, `commands/autopsy-request.js`, `commands/rotation-list.js` + `pm2 restart phmc-bot`.

## 2026-08-13 — Autopsy detection: single live progress embed

### Changed
- **Autopsy detection now posts ONE live-updating progress embed per request** (`autopsyRequestMonitor.js`) instead of 4 separate messages ("Autopsy Case Created" webhook, `@owner` case-posted ping, "New Autopsy Request Detected" embed, batch summary). The embed walks through the same sections used by report deploys:
  - `Autopsy Case Detected — Fetching Information` → `FOUND: CASE` → `POSTED TO CASE MANAGEMENT` → `ASSIGNED MEDICAL EXAMINER` → `CROSSPOSTED TO LSPD/LSSD`, then finalizes green/red.
  - The **ME assignment ping is unchanged** (`notifyAssignment` still tags the assigned ME on Discord).
- **Embed survives reprocessing + bot restarts** — the Discord message id, channel, and step history are persisted on the request entry (`progressMessageId`/`progressChannelId`/`progressSteps`), so the state machine resumes the SAME message across monitor cycles instead of duplicating embeds.
- Per-request and batch "New Autopsy Request Detected" notifications removed; the restart-time Initial Scan summary is kept.

### Notes
- Deploy to VPS: SCP `services/autopsyRequestMonitor.js` + `pm2 restart phmc-bot`.

## 2026-08-11 — Multi-decedent autopsy completions (LSPD/LSSD crossposts per case)

### Fixed
- **Autopsy completion flow now handles multi-decedent requests** (`deployAutopsyReply.js`) — the completion matcher previously only looked up top-level `caseTopicId`/`oocName`/`name`, so a split request (e.g. `John Doe ((Dylan Bongo, Marvion Futrell))` → cases 485/486) could never be matched when a case completed: no LSPD/LSSD completion reply, no DM, no rotation decrement. Now:
  - **Match step 4** scans `autopsy-requested/*/cases/<idx>/caseTopicId` and matches the specific decedent case.
  - Completion state is written **per case** (`cases/<idx>/completedAt`); the request is only marked fully completed when every decedent case is done.
  - `clearAssignment` uses the per-case ME; the LSPD completion reply uses the per-case decedent name/OOC, case title, and case topic id.
  - The LSPD thread is treated like a normal request thread: the completion reply goes to the same preserved `lspdTopicId` (128223) once per case.

### Notes
- Deploy to VPS: SCP `services/deployAutopsyReply.js` + `pm2 restart phmc-bot`.

## 2026-08-11 — Patient index: search by ID too

### Changed
- **`GET /api/patients?q=` now matches by patient ID as well as name** (`morgue-api.js`) — `q` matches name-substring **or** numeric-ID substring, so the web app can resolve/validate a patient name from the ID the ME typed (bidirectional lookup for the Paolina Russo / patient 1919 patient-name leak).

### Notes
- Deploy to VPS: SCP `morgue-api.js` + `pm2 restart morgue-api` (already live).

## 2026-08-11 — Multi-decedent autopsy requests split into separate cases

### Fixed
- **Autopsy requests with multiple decedents now create one case per decedent** (`autopsyRequestMonitor.js`) — previously a request like `John Doe ((Dylan Bongo, Marvion Futrell))` (or a Section 2 body with numbered decedents `John Doe[1]((OOC A))` / `John Doe[2]((OOC B))`) produced ONE case with the names merged. Now:
  - The request **body is the authoritative split source** — every `Decedent Name:` line in Section 2 is parsed (`parseDecedentNameLine`: name, `[N]` marker, `((OOC))`), with the title's comma-split as fallback when the body isn't parseable.
  - Each decedent gets its own f=266 case topic, sequential case number, fair-rotation ME assignment, and per-case state under `autopsy-requested/<topicId>/cases/<idx>/`.
  - LSSD/LSPD crossposts + the acknowledgement reply run once per request (after all cases).
  - Startup assignment rebuild and `retryFailedAssignmentReplies` count/retry per-case assignments for multi records; top-level gets `caseState:'multi'`, `decedentCount`, aggregated `assignedTo` for dashboards.
  - Single-decedent requests are untouched (original inline state machine preserved).

### Notes
- Deploy to VPS: SCP `services/autopsyRequestMonitor.js` + `pm2 restart phmc-bot`.

## 2026-08-11 — Emergency deploy handbrake: blank employee identity

### Added
- **`runDeploy` now hard-stops any deploy whose report has an empty `coronerEmployee`/`phmcEmployee`** (`deployExecutor.js`) — the critical gate for the Sarah Bell / Xavier Bogdanovic blank-credentials incident. Before any handler runs (topic, PM, medical record, autopsy reply), the report's expected employee field is validated per form (`coroner-report`/`coroner_email`/`death_record`/`mass-ftality-test`/`autopsy` → `coronerEmployee`; medical forms → `phmcEmployee`; unknown forms block only when both are empty). On failure the report is marked `deployStatus: 'blocked_empty_employee'` (never retried), removed from the retry queue, a red **DEPLOY BLOCKED** webhook pings the developer, and the progress embed is updated.

### Notes
- Recovery: fix the report data (re-save in the app or `node tools/fix-empty-coroner.mjs --include-scheduled --apply`), set `hasdeployed:false` + `deployStatus:'pending'`, restart the bot.
- Deploy to VPS: SCP `deployExecutor.js` + `pm2 restart phmc-bot`.

## 2026-08-11 — morgue-api serves dev EMS protocols

### Added
- **`GET /api/protocols-dev`** — serves `data/protocols-dev.json` (the dev EMS protocols dataset with embedded base64 images, ~1.8 MB) to the `getProtocolsDev` Firebase function. Key-protected via `validateApiKey`, same pattern as `/api/agency-credentials`. Keeps the heavy dataset off RTDB.

## 2026-08-10 — Reassign notice quotes the new ME + bold not strikethrough

### Fixed
- **`/reassign-autopsy` reassignment reply now pings the new ME** — the notice was posted without a `[quote]`, so phpBB never notified the reassigned user. It now opens with `[quote="<newME>" user_id=<forum uid>]` (uid resolved from the group member list, matching the monitor's assignment pattern).
- **Old ME rendered in `[b]` instead of `[s]`** — the previous assignee was struck through; it's now bold alongside the new assignee.

## 2026-08-09 — Overdue autopsy alert + autopsy stats

### Added
- **Overdue autopsy monitor** — the system monitor (2h cycle) now flags autopsy requests stuck in a non-final state (`detected`/`case_created`/`me_assigned`/`ack_sent`, no `completedAt`) past their wait window and pings the bot owner with a list of the overdue cases (name, PK/CK type, assignee, state, since, limit, case #). Limits are **type-aware** via `parsed.deathType`: **CK = 72h (3 days)**, **PK = 120h (5 days)**, untyped falls back to `AUTOPSY_OVERDUE_HOURS` (48h). Configurable via `AUTOPSY_OVERDUE_HOURS_CK`/`AUTOPSY_OVERDUE_HOURS_PK`. Cooldown of 6h between alerts (tracked at `monitoring/autopsyOverdue`), mirroring the morgue-overdue check.
- **New `/autopsy-stats` command** (owner) — reads all `autopsy-requested` entries and summarizes **received / processed** by **month (last 6)**, **week (last 4, Mon-start)**, **last 30 days**, **faction**, and **assigned ME** (assignments vs done), plus the current **pending** list with days outstanding. `detectedAt` = submission time; `completedAt`/`caseState=complete` = processed.
- **New `/autopsy-request` command** — MEs (or the bot owner) submit an autopsy request for supervised final exams. Optional `case:<morgueCaseId>` prefills Section 2 (decedent name/OOC/gender/date+time of death/location) from the morgue record; `me:<name>` (autocomplete over the rotation) picks the supervising ME.
- **3 chained Discord modals** collect the template fields (Decedent 1/3, Decedent+OOC 2/3, Requester 3/3) with the standard Section 3 defaults ("This body has been donated by Los Santos County for research and education purposes..." / "Authorized training by Los Santos County.").
- **Dry-run preview embed** — the full request BBCode renders in Discord (truncated preview + `.txt` attachment) with **Approve & Post / Edit / Deny** buttons; nothing posts until Approve. Drafts persist in `autopsy-request-drafts/`; Edit retires the old draft so a stale preview can't be approved.
- **On Approve** the request posts to **f=265** in the standard `Autopsy Request - Name ((OOC)) [LSPD/LSSD]` format, carrying an **`ASSIGNED: <ME> for Final Autopsy Exams`** marker in Section 3.
- **Monitor honors the marker** — `parseAutopsyRequestBbcode` now extracts `assignedOverride`, and Step 2 assigns that ME instead of rotation (falling back to rotation if the ME is on LOA). The assigned ME is now also **tagged on Discord** (`notifyAssignment`) when a mapping exists.
- **Fixed a pre-existing parser bug** — `parseAutopsyRequestBbcode`'s decedent-name regex `Name\(s?\)?` required a literal `(` (only matched "Name(s):"), so the standard "1.) Decedent Name:" never extracted; now matches both forms.

### Notes
- Runs for the bot owner or any Discord user mapped to a rotation ME (`autopsy-requests/discord-members`).
- Requires a bot restart; `/autopsy-request` is registered on startup.

## 2026-08-09 — Facebrowser posts: 48h publish delay + next-of-kin disclaimer

### Added
- **Face posts are now scheduled instead of published instantly** — approving a death record writes a `scheduled` entry in `facePostDrafts` with `publishAt = approval + FACE_PUBLISH_DELAY_HOURS` (default **48h**, `0` = next sweep). A new `startFacePublishSweep` (registered in `index.js`) sweeps `facePostDrafts` every 60s and publishes due posts (real or simulated per `FACE_DRY_RUN`), then updates the death record draft embed's `Facebrowser Post` field with the published/simulated link. Schedule survives restarts (persisted in RTDB, not an in-memory timer). `FACE_PUBLISH_DELAY_HOURS` documented in `.env.example`.
- **Scheduled Face posts appear on the system dashboard** — a `📅 Scheduled Face Posts` field lists each pending post (decedent + relative publish countdown via Discord timestamp), capped at 5 with a `...and N more` overflow, or `✅ None scheduled` when clear. Staff can see what will go public and when.
- **Next-of-kin disclaimer appended to every Face post** — `generateFacePostContent` now ends each post with: *"We utilize social media only when all other avenues of locating a next of kin have been exhausted, typically waiting up to 48 hours of extensive searching before publication."* (shows in the draft's `Face Post Preview` too).
- **Deny cancels a pending schedule** — denying a death record draft marks its scheduled Face post `cancelled` so it never publishes.
- **Approval embed/log reflect the schedule** — the draft's `Facebrowser Post` field shows `Scheduled to publish <UTC time> (+48h delay)` instead of a URL, and the `[OK] Death Record Posted` log includes the scheduled time. `/face-redraft` reports the scheduled time too.

## 2026-08-09 — Draft embed shows Facebrowser post preview

### Added
- **Death Record drafts now include a `Face Post Preview` field** (when Face is configured) — the exact content `generateFacePostContent` will publish on Approve, rendered before review so staff can verify the automated post. It uses the same generator as publish time (the forum link, appended at publish, is the only absent piece); the content is short so it stays well under Discord's 1024-char field cap (capped at 850 defensively). Field is appended last so the edit modals' index-based field splices are unaffected.

### Fixed
- **Face post URLs use the correct public path** — `postToFace`/`findFacePostByContent` and the dry-run SIM URLs built `https://face.gta.world/posts/<id>`, but Face's public URL is singular `https://face.gta.world/post/<id>`. All URL builders (including the `face-post-test.mjs` debug log) now emit `/post/`.
- **Face post content no longer leaks raw BBCode** — values like `placeOfDeath` (e.g. `[url=https://...]Autopia Parkway[/url]`) were emitted verbatim into the plain-text Face post, so the literal `[url=` tag showed in the preview *and* on the published post. `generateFacePostContent` now runs every detail value through a new `stripBbcode` helper (collapses `[url=...]`/`[quote]` wrappers to their label, drops `[img]` blocks, removes remaining tags, collapses whitespace). Fixes both the draft preview and the auto-published post.

## 2026-08-09 — Death Record drafts validate the (( )) OOC name on unidentified morgue records

### Changed
- **An unidentified morgue record whose `(( ))` name matches the report's `decedentOOC` now counts as a confirmed (HIGH-confidence) match** — since every uploaded record stores the real identity as `NAME: Unknown (( <OOC name> ))`, matching that `(( ))` name against the report's OOC field validates the decedent. `findMorgueRecord`/`isLowMatch`/`isMorgueRecordIdentified` now accept the report's `decedentOOC` and extract the `(( ))` name via the new `extractMorgueOocName` (also stripping `(( ))`-style parentheses on the report side). No more spurious LOW warnings / `needsBetterMorgue` flags / "Check Morgue" prompts for decedents whose identity is confirmed this way.
- **The `Match Confidence` embed field explains the validation** — validated matches show `[OK] HIGH — unidentified case #X` plus a note: `record is "Unknown (( ... ))" — OOC (( <name> )) validated against report decedentOOC`. Only genuinely-unidentified records (no OOC match) stay LOW with the existing warning + Check Morgue flow.
- Applied across all draft paths: autoDeploy, passive CK listener, `recheckMorgueForDraft`, the manual scan, and Face post value resolution.

## 2026-08-08 — Patient index service (medical-records-index.json)

### Added
- **New `services/patientIndex.js`** builds `data/medical-records-index.json` on the VPS (`/opt/phmc-bot/discord-bot/data/medical-records-index.json`) — a name → patient lookup powering the web app's Patient Name autocomplete. Entries: `{ name, id, threadId, lastSeen, pri }`.
  - **Forum is the canonical source** — full rebuild parses phpBB's **"Page X of Y"** footer for the true page count and iterates all pages deterministically (start += pageSize, with `rel="next"` as a fallback; relying on the next button alone stopped at ~page 18 of 42 and captured only 225/1000+ topics). Broad `topictitle` selector + topicId dedupe. Title parsing covers `1424 - Name`, `Patient #1424 - Name`, `1459 Name`, `1053 Name (ooc)`, and `[709] Name`; `[FORM]` stickies are skipped.
  - **Write-through on medical-record deploy** — `deployMedicalRecord.js` upserts the exact `{ name, id, threadId }` right after it resolves or creates the f=97 thread, so the index is current immediately with no forum re-scan.
  - **Deploy resolves the thread from the index first** — exact (case-insensitive) name lookup → reply directly to the stored `threadId`, skipping the forum search for known patients. Non-exact matches still search then create. Stale-index protection: an index-sourced reply that fails re-searches once and retries; if the thread is truly gone it removes the entry so the next deploy creates a new thread.
  - **New-patient creation never reuses a stale form `patientID`** — when no thread matches the name, the bot always auto-assigns a fresh patient id (a leftover ID from a previous autocomplete selection, e.g. 1424, was previously reused for a new patient's thread).
  - **Rapid-re-save guard narrowed** — the same-author + same-form 60s "Rapid re-save" net now only applies when a report has NO patient name/id; a named patient is never trashed just because a *different* patient was saved on the same form within the window (the patient-name dedup already handles same-patient re-saves).

## 2026-08-08 — morgue-api patient-index rebuild hardening + /api/patients

### Changed
- **Concurrency hardening** — all mutations are synchronous on a single in-memory index; a burst of concurrent saves/deploys coalesces into ONE trailing debounced write; all writes serialize the full index through a promise chain and hit the file atomically (tmp+rename), so the morgue-api reader never sees a partial file. Full rebuilds are single-flight (`_rebuildInFlight`) and the 3-day sweep is a single interval, so rescans can't double-fire.
  - **Cadence** — full rebuild every 3 days at 03:00 UTC (startup only if the last build is > 3 days stale, delayed 45s so the shared browser settles).
  - **ID priority** — forum/deploy-sourced ids (pri 2) are never clobbered by lower-priority ids.
  - *(Design note: per-save scanning of `scheduledReports`/`newSavedReports` was dropped — f=97 is the ground truth; only opted-out/dry-run drafts that never thread are excluded until a thread exists.)*
- **morgue-api** — new key-protected endpoints `GET /api/patients` (full index) and `GET /api/patients?q=<name>` (min 2 chars, case-insensitive, newest-seen first, limit 10).

## 2026-08-08 — Morgue date tie-break uses normalized timeOfDeathISO

### Changed
- **Bot now prefers the new normalized `timeOfDeathISO` field on morgue records** (written by `docs/morgue-logger.ps1` and `src/utils/morgue.js`) for the closest-date tie-break (`morgueTimeMs` in `deathRecordDraftCache.js`, also used by `scanAndDraftCKs` and the match-debug candidate distances). Falls back to parsing the display `timeOfDeath` string when the ISO field is absent, so the date resolution no longer depends on the game's display format. `generateDraft` also uses `timeOfDeathISO` for the record's Date of Death fallback.

### Notes
- Requires the parser change to be live: the PS1/JS now emit `timeOfDeathISO` (`YYYY-MM-DDTHH:MM:SS`) on every upload/import. Existing records without it still work via the display-string fallback.

## 2026-08-08 — Death Record drafting: reliable morgue matching + confidence gating

### Fixed
- **Public death records could pull the wrong (oldest) morgue case.** `findMorgueRecord` used `new Date(referenceDate)` for its closest-date tie-break; the mass-fatality form's `pronouncedTimeOfDeath` is `"MM/DD/YYYY - HH:MM"`, which parses to `Invalid Date` → `NaN`. The tie-break was silently skipped and the lexicographically-first name match (an old unidentified case) won, producing wrong age/race/location (e.g. Thomas Mills → case #77114 age Unknown/Rancho instead of the identified case; Jacob Watson → #75699 La Mesa instead of #79460/#81080). `parseDate()` now handles ISO, slash (`MM/DD/YYYY - HH:MM`, day-first), and morgue `"Weekday, DD Month YYYY HH:MM:SS"` formats, and is used for the reference date and every morgue `timeOfDeath` in the tie-breaks (`deathRecordDraftCache.js`, `scanAndDraftCKs`).
- **Mass-fatality drafts fed an unparseable date down the whole pipeline.** `passivCKCheck` copied `dec.pronouncedTimeOfDeath` straight into `dateTime`/`dateOfDeath`. It now normalizes to ISO via `toIsoDate()` (preferring the report's ISO `dateTime` as fallback), so the reference date, the tie-break, and the displayed `Date of Death` are all reliable (no more `05/08/2026 -` residue).
- **Morgue re-checks couldn't find the source report for mass-fatality drafts** (draft keys carry a `_decedentN` suffix; the report lives under the base key). `findSourceReport`/`viewReportForDraft` now strip the suffix and re-merge the per-decedent data before regenerating; the same fix applies to `resolveFacePostValues` in the Face flow.
- **Low-confidence matches were approved as if verified.** Drafts now carry a `Match Confidence` field on the embed with the score (HIGH/LOW), the matched case, why it was chosen (reference date used/skipped), and the competing candidates with distance-from-reference — plus a `morgueMatch` debug object persisted on the draft for later isolation.
- **Placeholders removed from the public record** — `((Morgue Script Bug))` / `((Unknown due to Morgue Bug))` render as plain `Unknown` (these forced manual edits, e.g. the wrong "Age: 19" on Thomas Mills).

### Added
- **Low-confidence gate + delayed re-match:** drafts matched to an unidentified case (`Unknown (( ... ))` / `identified: No`) are flagged `needsBetterMorgue: true`, get an amber warning + `Check Morgue` button, and are **re-evaluated automatically** when morgue data changes (`startMorgueListener` now also queries `needsBetterMorgue`). `recheckMorgueForDraft` regenerates only when the match improved (different case or a low→high upgrade) and also handles OOC-name matching.

### Notes
- Already-approved forum posts (t=9932/t=9933) are NOT retro-fixed by this — they need a manual forum edit per the "no retro-fix for posted reports" convention.

## 2026-08-08 — `scripts/` renamed to `debug-testing-scripts/`

### Changed
- **Ad-hoc/debug scripts directory renamed** `scripts/` → `debug-testing-scripts/` for clarity (these are probes/one-shot tools, not runtime code). Updated all references: `force-lssd-crossposts.sh` runner, `.env.example` FACE_PAGE_ID hint, `FB-API.MD`, `facePost.js` error message, and in-file usage comments.
- **Deploy note:** when syncing to the VPS, rename the directory there too (`mv /opt/phmc-bot/discord-bot/scripts /opt/phmc-bot/discord-bot/debug-testing-scripts`) or the `.sh` runner path will 404.

## 2026-08-08 — Medical record deploy searches the real patient name

### Fixed
- **`deployMedicalRecord.js` searched `patientName || decedentName`, but `patientName` could be polluted with the author's name** (legacy credential-sync wrote the OAuth character name into it, which leaked via form progression). That made the bot search for — and thread-title — the poster instead of the patient (e.g. "Aisha Rose" instead of "Sophie Imani"). The search now prefers **`decedentName`** (the field the medical Patient Name input actually writes), falling back to `patientName` only when it's absent.

### Notes
- Re-scheduling a mis-deployed report: set `hasdeployed:false` + `deployStatus:'pending'` in `scheduledReports/<author>/<key>`, then restart the bot — cold-load treats it as pending and re-queues.

## 2026-08-07 — Recovery heartbeat startup sweep delayed

### Fixed
- **Startup recovery sweep no longer races the browser init** — `startRecoveryHeartbeat` ran the first sweep immediately at boot, concurrently with the shared browser's startup tasks (roster sync, forum logins, group-member fetches), intermittently throwing `Target page, context or browser has been closed` and skipping that tick. The startup sweep is now delayed 30s so browser startup settles first; the 10-minute cadence is unchanged. (Self-healing either way — each sweep re-scans missing work — this just removes the noise.)

## 2026-08-07 — LSSD request topic auto-creation for non-caselink requests

### Added
- **The bot now creates the LSSD request topic for non-caselink LSSD autopsy requests.** Previously the bot only *searched* f=2263 for an existing LSSD topic (relying on CASELINK to auto-post), so a request from a human officer that only existed on the PHMC forum had no LSSD topic and the completion crosspost (`lssdCombinedReply`) failed with "LSSD request topic not found via search". In `autopsyRequestMonitor.js` Step 3, when the f=2263 search returns nothing the bot now:
  - Resolves the PHMC request poster via `getTopicPoster`.
  - **CASELINK requests** (`CASELINK [Bot]`) → skips creation entirely — CASELINK creates its own topic, never duplicate it.
  - **Human requests** → re-searches f=2263 once more to close the CASELINK race window, then creates the topic on f=2263 (`Autopsy Request - <name> (( OOC )) [LSSD]`), saves `lssdRequestTopicId`, marks `lssdRequestCreatedByBot: true` and `lssdCrosspostStatus: pending`.
  - **Unresolvable poster** → skips creation (conservative, guarantees no CASELINK duplication) and logs a warning for manual/recovery-sweep handling.
- The newly-created topic ID feeds straight into the existing acknowledgement reply and the completion `lssdCombinedReply`, so the completion report lands on LSSD for every non-caselink case.

## 2026-08-07 — /dev panel: Autopsy & Death Records sub-menu

### Added
- **`/dev` → "Autopsy & Death Records"** button opens a sub-panel with:
  - **Run-now buttons** (no args): Rotation List, Force Autopsy Check, Sync Autopsy Requests, Sync Autopsy Poster, Death Records Pending — they invoke the existing command logic directly.
  - **Prompt buttons** (open a modal for arguments): Force Autopsy Send (OOC), Face Redraft (report key), Death Record Check (date) — the modal feeds the existing command's `execute()` via a patched options resolver.
  - **Back** button returns to the main panel.
- `/dev` panel construction moved into `services/devPanel.js` (`showDevPanel`), with `handleDevActionModal` for the arg-driven commands. The legacy `/autopsy` command remains a redirect (superseded by these shortcuts).

## 2026-08-07 — Agency credentials management commands

### Added
- **`/agency-creds` (owner)** — manage the shared faction-forum credentials file (`data/agency-credentials.json`) directly from Discord. Subcommands: `list` (show configured domains), `set <domain> <username> <password>`, `remove <domain>`. Updates apply immediately (the morgue-api reads the file per request — no restart).
- **`/dev` (owner) — Developer Tools panel** — a button-panel launcher to reduce slash-command clutter. Buttons:
  - **Restart Bot** — `pm2 restart phmc-bot`
  - **Agency Credentials** — opens a modal to set or remove a credential
  - **List Credentials** — shows configured domains
- New shared service `services/agencyCredentials.js` (load/set/remove) used by both `/agency-creds` and the `/dev` modal; `services/devPanel.js` holds the button/modal handlers.

## 2026-08-07 — Hardened morgue-api IP banning

### Changed
- **Bans are now PERMANENT** — an IP that triggers a suspicious-request ban stays banned indefinitely (previously 1 hour).
- **Bans + strike counts persist to disk** (`data/ban-state.json`, atomic write) and are reloaded on startup, so a banned scanner does **not** get a fresh slate after a server restart.
- **Obvious scanner/CVE probes ban on FIRST hit** — labels starting `CVE-`/`SCAN-` (phpunit eval, `.env`, wp-admin, git-config, etc.) instantly permanently ban the IP.
- **Ambiguous attempts use a 2-strike rule** — RCE/SQLi/path-traversal/SSTI/etc. count toward `MORGUE_BAN_THRESHOLD` (default 2) before a permanent ban.
- **Webhook confirmation** now reads: `IP <ip> was banned for <reason>` (e.g. `CVE-phpunit-eval`), including threshold/duration/permanent marker. Banned-IP request responses now report the ban reason too.
- `MORGUE_BAN_DURATION_MS` removed (no more temporary bans); `.env.example` updated.

## 2026-08-07 — Agency credentials endpoint (morgue-api)

### Added
- **`GET /api/agency-credentials`** (key-protected) — serves the shared faction-forum account credentials from `data/agency-credentials.json` on the VPS. Used by the new `getAgencyCredentials` Firebase function so the web client never ships credentials. Read live per request (no restart needed to update the JSON).

## 2026-08-06 — Facebrowser posts automated + crash recovery

### Changed
- **Facebrowser post is now fully automated** — approving a death record posts to f=404 and immediately publishes the Facebrowser post via the Face page API (`postToFace`), no separate Discord review step. `FACE_DRY_RUN` still controls live vs simulated. The death record's `[OK] Death Record Posted` embed now includes both the forum link and the Facebrowser post link, and the death record draft embed's "Facebrowser Post" field shows `Published: <url>` (or simulated).
- **Crash/restart recovery for interrupted death record approvals** — `handleApprove` marks drafts `deploying: true` before posting. On startup, `recoverInterruptedDeathRecordApprovals` finds drafts left mid-approval by a crash, uses the Facebrowser API (`findFacePostByContent`) to verify whether the auto Face post actually landed, records it if found (so it won't be duplicated), clears the flag, and posts a `[WARN] Death Record Approval Interrupted` alert telling staff whether the f=404 post needs re-approving. New Face helpers: `getFacePost`, `findFacePostByContent`.
- **`/face-redraft` now re-publishes instead of sending a review draft** — reports the published Face URL (skips if already published).

### Notes
- Requires `".indexOn": ["needsMorgue", "deploying"]` at `/deathRecordDrafts` in `functions/database.rules.json` — deploy with `firebase deploy --only database`.

## 2026-08-06 — Duplicate death-record drafts on mass fatalities

### Fixed
- **Mass fatality with multiple CKs could send two draft messages for the same decedent** — a report that landed in both `scheduledReports` and `newSavedReports` was drafted twice because two listeners run the death-record check (`autoDeploy`'s `scheduledReports` listener and the passive `newSavedReports` listener), and the Firebase exists-guard in `checkAndDraftIfMorgueMatched`/`processCKReport` is a non-atomic read-then-write that races when both fire concurrently. Both functions now guard with a synchronous module-level in-flight set first, so the second concurrent run skips and only one draft message is sent per decedent.

## 2026-08-06 — Facebrowser death-record integration deployed + live

### Fixed
- **Facebrowser post flow was never wired up on the bot** — `facePost.js` was missing from the VPS and `deathRecordDraft.js` / `deathRecordDraftActions.js` / `index.js` were running old versions, so approving a death record posted to f=404 but never kicked off the Facebrowser post draft. All four files are now deployed: the death record approval flow auto-creates a "Facebrowser Post Draft" review embed, and the `face_approve_`/`face_edit_`/`face_deny_` buttons work.
- **`FACE_DRY_RUN` set to `false` on the VPS** — approving a Face draft now publishes a real Facebrowser post via the Face page API instead of simulating.

### Added
- **Death record embed now shows Facebrowser status** — the original death record embed gains a "Facebrowser Post" field: "Draft sent for review" right after forum approval, updated to "Published: <url>" once the Face post goes live (and "Simulated (FACE_DRY_RUN)" when dry-run).
- **`/face-redraft` (owner)** — re-kick the Facebrowser post draft for an already-approved death record (e.g. records approved before this deploy). Usage: `/face-redraft reportkey:_Mass_Fatality_..._decedent1`.

### Notes
- There is **no automated retry/heartbeat sweep for failed Face posts** — if the Face API rejects an approval, the draft stays `pending_review` with `lastError` recorded and staff re-click "Approve & Post to Face".

## 2026-08-06 — Centralized autopsy completion template

### Changed
- **`COMPLETION_TEMPLATE` + `buildCompletionBb()` moved to a single shared module** (`services/completionTemplate.js`). Previously the template was duplicated in three places (`deployAutopsyReply.js`, `deployInteraction.js`, `force-autopsy-send.js`), each with drift — the picker/force copies still had an older header + static CASELINK text while the main flow had the `LSSD_COMPLETION_LINK` feature. All three now import from the shared module, so the completion notice is identical everywhere. `deployAutopsyReply.js` re-exports `COMPLETION_TEMPLATE` for backwards compatibility.

## 2026-08-06 — LSSD autopsy completion posts first + direct link in PHMC reply

### Changed
- **LSSD completion reply now posts BEFORE the PHMC completion reply** — for LSSD requests the combined reply (completion notice + full report) is posted to f=2263 first, then the PHMC completion notice goes to f=265. Non-LSSD and private cases keep the previous order.
- **LSSD reply URL saved to Firebase** — on success the bot writes `lssdCompletionUrl` (plus `lssdCrosspostStatus: completed` / `lssdCrosspostedAt`) to `autopsy-requested/<key>`, so the posted LSSD reply can be linked from the PHMC completion notice.
- **PHMC completion notice links straight to the LSSD post** — `COMPLETION_TEMPLATE` line now contains a `LSSD_COMPLETION_LINK` placeholder (replacing the static "CASELINK PORTAL or LSSD Autopsy Records" text). When the LSSD post URL is available it renders a direct `[url]` link; if the LSSD crosspost fails the original static text is used as a fallback. `buildCompletionBb()` centralizes the template substitution.
- **Retry sweep** — `phmcCompletionReply` retries reuse the stored `lssdCompletionUrl` so re-posted f=265 replies still carry the link; `lssdCombinedReply` retries re-save the new URL on success.

## 2026-08-05 — Medical record thread search by patient name

### Changed
- **`handleMedicalRecord` searches by the real patient name** — medical forms populate `patientName`, not `decedentName`, so `patientName` was falling back to `originalKey` (the report title, e.g. the old `Patient_Lucas Shade`). It now prefers `data.patientName` → `data.decedentName` → `originalKey`, so the f=97 thread search matches the actual patient name.

## 2026-08-05 — Morgue matcher prefers closest date of death

### Changed
- **`findMorgueRecord` tie-breaks by date-of-death** — when several morgue records share a decedent's name (e.g. a character CK'd more than once), the record whose `timeOfDeath` is closest to the report's date now wins, instead of the first name-partial-match. Callers pass the report's `dateTime`/`dateOfDeath` as a reference date (`processCKReport`, `checkAndDraftIfMorgueMatched`, `recheckMorgueForDraft`, Face post value reconstruction). `scanAndDraftCKs` now filters to name-matching records first (exact or partial) and picks the closest date among them, falling back to the time-based search only when no name matches.
- Without a reference date the matcher keeps its old first-match behavior, so non-death-record lookups are unaffected.

## 2026-08-05 — Face post values fix

### Fixed
- **Face posts were publishing bare (decedent name only)** — `generateFacePostContent` builds the post from the draft's `values`, but drafts created by the passive CK listener (`checkAndDraftIfMorgueMatched`) and the manual scan (`scanAndDraftCKs`) never persisted a `values` object, so the social post rendered just "Decedent: <name>". Both paths now store `values: draft.values` (matching `processCKReport`).
- **`createFaceDraft` self-heals old drafts** — if a draft has no `values`, it now reconstructs them from the source coroner report (`scheduledReports`/`newSavedReports`) + morgue record via `generateDraft`, persists them back to `deathRecordDrafts/<reportKey>`, then builds the full post. Existing already-approved drafts get the full content on any future Face regeneration.

## 2026-08-05 — Facebrowser Public Death Record posts

### Added
- **Facebrowser (Face) automation for CK Death Records** — once a Death Record is approved & posted to the forum (f=404), the bot now auto-generates a social-media style Facebrowser post draft ("A Public Death Record has been posted, the details are: ...") and sends it to Discord for a separate **review & approve** step before it touches the Face page.
- **`services/facePost.js`** — Face Page API client (`POST /posts` with Bearer `FACE_API_KEY` + `FACE_PAGE_ID`), plus `generateFacePostContent` (plain text: decedent, case #, date of death, manner, location, investigator + forum link) and `deleteFacePost` for corrections. Gated by `FACE_DRY_RUN` (default `true` — approving simulates the post).
- **`services/deathRecordDraftFace.js`** — Face draft review embed with `Approve & Post to Face` / `Edit` / `Deny` buttons and an edit modal, wired into `interactionCreate` alongside the existing `dr_*` handlers. Drafts tracked at `facePostDrafts/<reportKey>` (status, content, `fbPostId`/`fbPostUrl`, approvedBy, dry-run notes).
- **`scripts/face-find-page.mjs`** — helper to locate the PHMC Public Death Records page owned by the API key account (`GET /pages/mine`), filter by keyword (`--name`), and write it to `.env` (`--set` → `FACE_PAGE_ID`).
- **New env vars** — `FACE_API_KEY`, `FACE_PAGE_ID`, `FACE_DRAFT_CHANNEL_ID` (falls back to `DEATH_RECORD_DRAFT_CHANNEL_ID`), `FACE_DRY_RUN`.

### Notes
- The Face post only auto-drafts **after** a real (or dry-run-simulated) forum approval in `handleApprove`. Denied death records never reach Face. Face posts are IC-only (no OOC name on public social media).

## 2026-08-03 — LSSD completion combined into a single post

### Changed
- **LSSD autopsy completion is now ONE post** — the completion workflow previously posted two separate replies to the LSSD request topic (f=2263): a confirmation notice (`COMPLETION_TEMPLATE`) followed by the full autopsy report. These are now merged into a single reply (completion notice, `[hr]` divider, then the full report) — both in the direct-path (`lssdRequestTopicId` saved) and the search-fallback path. PHMC (report → f=266, completion → f=265) and the LSPD crosspost are unchanged.
- **Completion step tracking** — the two legacy LSSD steps (`lssdCompletionReply`, `lssdAutopsyReport`) are replaced by one `lssdCombinedReply` step (progress embed now shows a single "LSSD Completion + Report" step). `retryFailedCompletionSteps` retries the combined content for new entries; the legacy per-step retry handlers are kept so in-flight pre-change cases still recover correctly.

## 2026-08-03 — Psych Evaluation form ID fix

### Fixed
- **Psych Evaluation routing** — the form's Firebase key is `psych-eval` (hyphen), but the bot's medical-record lists used `psych_eval` (underscore), so psych-eval reports were never routed to the Medical Record handler (f=97). Corrected in `forumClient.js` FORUM_MAP, `autoDeploy.js` (listener + dev-reports), and `deployQueue.js` (re-queue scan + queue dashboard label). Psych-eval reports now deploy as medical-record replies.

## 2026-08-02 — Debug output folder + VPS cleanup

### Changed
- **All debug/scan output moved to `debug/`** — forum page HTML dumps (`forumClient.js`: login, PM compose, reply submit), coroner-email and medical-record BBCode dumps (`deployCoronerEmail.js` / `deployMedicalRecord.js`), and `/group-morgue-check` JSON scans (`commands/group-morgue-check.js`) now write into `discord-bot/debug/` (auto-created via `mkdirSync recursive`) instead of the bot root. Existing stray files were relocated there.

### Housekeeping
- **Removed orphaned leftovers from the VPS** — the pre-`services/` refactor stale root copies (`autoDeploy.js`, `deployQueue.js`, `firebase.js`, `autopsy-skip.js`, `death-record-check.js`, `deathRecordDraft.js`, `fix-autopsy.js`, `rotation-set.js`), plus `cleanup-test.js`, `diag-topics.mjs`, a truncated `morgue-` duplicate, and a stray root `force-autopsy-complete.js` (the registered command lives in `commands/`). Registered test commands, log archives, session/roster files, and `morgue-data.json` are retained.

## 2026-08-02 — LSSD crosspost fixes

### Added
- **`searchLssdRequestTopic` (`deployLssd.js`)** — shared, scoped LSSD request lookup against the dedicated autopsy forum **f=2263**. Tries `"Name (( OOC ))"` → OOC name → plain decedent name, and only accepts a result whose title references the decedent (phpBB recency search surfaces unrelated topics). Used by the completion-flow fallback, the retry scanner, the detection-time ack, and the force script.
- **`scripts/force-lssd-crossposts.sh` / `.mjs`** — operator utility to force-publish pending LSSD crossposts. Defaults to dry-run (preview + title-verification); `--post` publishes, `--only "<name>"` filters, `--topic <id>` overrides the target, `--all` bypasses the hard-coded allowlist (`9889` Edwin Fimbres, `9898` Terrell Hylton). Recovers report BBCode from the entry or the report stores when available.
- **Failure notifications across ALL deploy types** — a unified `notifyDeployFailure` (`deployLogger.js`) posts a red `DEPLOY FAILED` embed to the log channel whenever a topic post, forum PM, medical-record reply, LSPD crosspost, LSSD crosspost, or any handler-level deploy fails. Autopsy completion steps get their own `Autopsy Completion Step Failed` alert (`finishCompletionStep`). Failures are now visible to staff in bot-spam immediately, while the self-healing/retry sweeps still handle the actual repair.

### Fixed
- **Autopsy completion faction logic** (`deployAutopsyReply.js`) — the completion flow now derives the target faction from the **request record** (`entry.faction` / `[LSSD]` tag) instead of trusting the ME's report `department` field. A report filled with the wrong agency (e.g. LSPD on an LSSD case) no longer causes the LSSD crosspost to be skipped ("not an LSSD case") or an LSPD post to be created. A console warning flags request/report faction mismatches.
- **Silent `postTopic` failure** (`deployTopic.js`) — a failed topic post previously left the progress embed stuck at "pending" with no status write; it now marks `reply_failed`, finalizes the embed, and alerts the log channel.
- **LSSD skip no longer false-OK** — when an LSSD-tagged entry can't be crossposted (no topic found / no searchable name), the flow now writes `lssdCrosspostStatus: failed` (+ `lssdCrosspostBbCode`) so the recovery scanner retries instead of silently dropping it.
- **`retryFailedLssdCrossposts` self-heals** — when no LSSD topic ID was saved, it now performs a scoped f=2263 search (via `searchLssdRequestTopic`) using the stored OOC/name before skipping, and saves the found topic ID.
- **Detection-time LSSD ack search scoped to f=2263** (`autopsyRequestMonitor.js`) — previously searched all forums; now uses the shared scoped lookup and also runs for requests with no OOC name (plain name match).

## 2026-08-01 — Unified recovery heartbeat

### Added
- **`runRecoveryHeartbeat` (`autoDeploy.js`)** — a single 10-minute recovery sweep (plus startup) that runs ALL self-healing checks in sequence: retry queue, LSSD crossposts, LSPD crossposts, LSPD crosspost recovery, LSPD acks, PHMC acks, completion steps, and assignment replies. Reentrancy-guarded (no overlapping sweeps), per-check error isolation, and a per-check timing summary (`[HEARTBEAT] Sweep complete in Xs — ...`). Cadence configurable via `RECOVERY_HEARTBEAT_INTERVAL_MS`.
- **Uniform SELF HEALING logging** — `notifySelfHeal` moved to `logChannel.js` and now used by ALL recovery sweeps (previously only PHMC ack + LSPD crosspost recovery). Every recovery action — success or failure — posts `SELF HEALING - <topic> / <reason> / <info>` to the log channel.

### Changed
- **Fragmented intervals collapsed** — the separate `checkRetryQueue` (30 min) and three retry intervals (10/10/30 min) are replaced by the single heartbeat. `cleanupOldDeployed` stays at 6 h.
- **`retryFailedLspdCrossposts` now actually runs** — it was defined in `deployLspd.js` but never called; the heartbeat wires it up.
- **Assignment-reply retry extracted** (`retryFailedAssignmentReplies` in `autopsyRequestMonitor.js`) so it runs every heartbeat instead of only at restart; now force-logs-in to PHMC first (the default client may be left on LSPD/LSSD by earlier checks).
- **`retryFailedCompletionSteps` gets a 30-min cooldown** so a persistently-stuck step doesn't spam the sweep every 10 min; summary embeds now say "Recovery Sweep".

### Fixed
- **LSPD ack retry double-post** — `sendAutopsyAcknowledgement` also posts the PHMC ack; the retry now marks `phmc-acknowledge-reply=completed` so the PHMC retry can't re-post in the same sweep.
- **Firebase index warning** — `functions/database.rules.json` now indexes `lspd-acknowledge-reply` / `lssd-acknowledge-reply` / `phmc-acknowledge-reply` (the renamed ack fields) and `lspdCrosspostStatus` on `/autopsy-requested` (removed the obsolete `lspdAck`/`lssdAck`/`phmcAck`), so the `orderByChild` queries in the heartbeat sweeps no longer download-and-filter the whole node. Requires `firebase deploy --only database`.

## 2026-07-31 — flood-aware retry extended to topic creation

### Changed
- **`forumClient.js` `postTopic`** — now has the same flood/stale-token recovery as `replyToTopic`. Topic creation previously had no flood handling, so the 2nd+ topic in a recovery sweep (or any rapid consecutive posts) could be rejected by phpBB flood control and fail with `create failed: unknown`, silently delaying the crosspost to a later sweep. `postTopic` now detects the flood/invalid-form error, waits 25s, reloads the posting form (fresh token), refills subject + message, and resubmits (up to 3 attempts).

## 2026-07-31 — Discord send timeout hotfix + LSPD crosspost self-healing

### Fixed
- **`logChannel.js` `sendLogMessage`** — a stalled Discord `channel.send` had no timeout and could freeze an entire `checkForNewRequests` run mid-step. On 2026-07-31 two LSPD requests (Gregory Saetern, Dedrick Purnell) were created + assigned but never acked or cross-posted because the run hung on the "Autopsy Case Created" notification before step 3. The send is now wrapped in a 10s `Promise.race` timeout, so a stuck send logs a warning and the pipeline continues.

### Added
- **`retryMissingLspdCrossposts` (`autoDeploy.js`)** — LSPD cases whose LSPD crosspost (f=1361) was never created now self-heal: scans all entries at startup + every 10 min, creates the LSPD request topic + posts the LSPD acknowledgement, and persists `lspdTopicId` / `lspd-acknowledge-reply`. Both recovery functions (`retryFailedPhmcAcknowledgements`, `retryMissingLspdCrossposts`) accept `{ force }` to skip the staleness guard for manual recovery runs.
  - **Parallel-close race fixed** — the first version created one isolated LSPD client per entry and ran them in parallel. Since all isolated clients share one Chromium browser, one entry's `client.close()` tore down the page another was mid-navigation on (`Target page, context or browser has been closed`), silently killing the crosspost. Now uses a single shared client, processes entries sequentially, closes once. (This is what prevented the two test cases' topics from being created.)
  - **No pre-search** — the crosspost topic is created here, so searching the LSPD forum for it was a no-op (and could match unrelated prior-case topics); removed.
  - **Uses the shared default client + force-login** — switched from an isolated LSPD client (which kept failing to re-login to the LSPD forum with `No form found`) to `getForumClient()`, and now calls `login(FORUM_LSPD_USERNAME, FORUM_LSPD_PASSWORD, { force: true })` first. `postTopic`'s internal login fallback submits `this.username/password` (the **PHMC** creds), so if the LSPD posting page redirected to login mid-post it submitted the wrong credentials and got stuck. Pre-forcing an LSPD login with the correct creds avoids that (same pattern the monitor's step 3 uses).
- **Self-healing webhook** — every recovery action now posts `SELF HEALING - <topic> / <reason> / <info>` to the log channel (e.g. `SELF HEALING - 9892 / lspd crosspost missing / LSPD topic #12345 + ack posted`), via `sendLogMessage` (timeout-protected). So you see when the bot repairs a stuck step.
- **Recovery cadence tightened** — staleness guard and sweep interval lowered from 30 min to 10 min, so a stuck ack/crosspost recovers within ~10 minutes.

## 2026-07-31 — Quiet queue-snapshot logging

### Changed
- **`deployQueue.js` `getQueuedDeployments`** — no longer logs on every call. The queue dashboard polls it every 30s, so it was emitting ~2,900 `[FUNC deployQueue/getQueuedDeployments]` lines/day for a pure in-memory read. It now logs only when the queue is non-empty (`Queue snapshot (N queued/processing)`), keeping the signal when there's real work while staying silent when idle. `isMaintenanceMode`/`getStuckReports` verified off hot loops — left as-is.

## 2026-07-31 — Ack visibility + self-healing PHMC acknowledgement retry

### Changed
- **Ack status fields renamed for visibility** — `autopsyRequestMonitor.js` now writes `phmc-acknowledge-reply` / `lssd-acknowledge-reply` / `lspd-acknowledge-reply` (was `phmcAck`/`lssdAck`/`lspdAck`) plus a `<field>-at` timestamp on every ack attempt. Consolidated ack status log line + a `[AUTOPSY-MON] Ack FAILED ... flagged for automatic retry` warning when any ack target fails. Field names are exported from `ACK_FIELD_NAMES` so writers/retries can't drift.
- **`autoDeploy.js` LSPD ack retry** now queries/writes the renamed `lspd-acknowledge-reply` field.

### Added
- **`retryFailedPhmcAcknowledgements` (`autoDeploy.js`)** — the PHMC ack now has self-healing recovery like the LSPD ack: runs at startup and every 30 minutes. Scans ALL `autopsy-requested` entries (not just `status='failed'`) so it also catches the crash-before-status-write case (no status field at all — exactly what happened to Case 474), with a 30-minute staleness guard so it never races the active detection flow. On success it writes `phmc-acknowledge-reply=completed` + timestamp.

### Fixed
- **Incident: Case 474 (John Doe / Edwin Fimbres, LSSD)** — ack reply to the request topic was never sent because the detection flow died after the assignment reply hit phpBB flood control. The assignment reply was recovered by the monitor's startup rebuild on restart; the ack is backfilled manually (`scripts/backfill-ack.js`).

## 2026-07-31 — phpBB flood-aware reply retry

### Fixed
- **`forumClient.js` `replyToTopic`** — A reply could silently fail when phpBB rejected a rapid consecutive post with *"You cannot make another post so soon after your last"* (flood control), and the stale-form re-click then bounced with *"The submitted form was invalid"* (expired token). The bot logged `Reply ⚠️ Unknown` and dumped debug HTML with no recovery. `replyToTopic` now detects both errors after submit, logs `FLOOD ENCOUNTERED, WAITING 25s before retry`, waits out the flood window, **reloads the reply form** (fresh token), refills the message, and resubmits (up to 3 attempts). Stale-token bounces reload immediately without the wait. Falls back to the existing HTML-dump + `Unknown` path only if it's still stuck after retries.
- **Incident:** Case 474 (John Doe / Edwin Fimbres, LSSD) — the ME assignment reply to the case topic hit the flood limit because the same forum account posts the case topic + assignment reply back-to-back in one detection cycle. The assignment reply was recovered automatically by the monitor's startup rebuild on the next bot restart.

## 2026-07-31 — Morgue overdue threshold 24h -> 48h

### Changed
- **Morgue overdue alert** — `systemMonitor.js` now only flags the morgue as overdue after **48 hours** (was 24h); embed text and `MORGUE_OVERDUE_HOURS` constant updated. Dashboard's red "overdue" tier in `dashboardManager.js` bumped to 48h to stay consistent.

### Fixed
- **Death record draft crash** — Bot was crashing with `Invalid string length` from `ButtonBuilder.setCustomId` on long (mass fatality) report keys exceeding Discord's 100-char custom-ID limit. Deployed the split `deathRecordDraft*` modules where draft buttons already use `shortId()` hashes. Also hardened the two edit modals (BBCode + Fields): their custom IDs now use `shortId()` too (with a `_ids` index write on open + resolve on submit), and fixed `updateDraftWithMorgue` so the "Check Morgue" button is actually removed once morgue data is matched.
- **Draft buttons "Draft info not found"** — Drafts created by the manual `/death-record-check` scan or the passive path weren't writing the `_ids` shortId→reportKey index, so their buttons couldn't resolve back to the report key. All draft-creation/update paths now write the index, and the button handler falls back to scanning `deathRecordDrafts` by hash when `_ids` misses, so existing/legacy drafts work immediately without a backfill.
- **Passive CK detection for unidentified decedents** — The passive monitor only matched morgue records by IC name, so `John Doe` (unidentified CK) never matched `Unknown (( Stacey Hoover ))` and the draft was skipped until a forced date scan. `checkAndDraftIfMorgueMatched` now falls back to matching the report's OOC name, so these CKs auto-draft without manual intervention.

## 2026-07-30 — DM login fix, death record field editing, pending commands

### Fixed
- **`deployAutopsyReply.js`** — DM isolated client now calls `login()` before `sendPM()`. Was failing with "Page: Login" because the fresh isolated context had no phpBB session cookies. LSSD crosspost already handled this correctly; DM step was the only one missing it.
- **`deathRecordDraft.js`** — Button custom IDs now use `shortId()` hash to avoid Discord's 100-char limit crash on long report keys (e.g. mass fatality drafts). Added `_ids` Firebase index + resolver for round-trip.
- **`index.js`** — Added modal dispatch for `dr_editfld_modal_` prefix (field editing submission).

### Added
- **`commands/pending-reports.js`** — New `/pending-reports` command: scans all `scheduledReports` for non-deployed entries, grouped by status (pending/searching/replying/error/timeout). Shows age and deploy message. Requires owner-only confirmation button before executing.
- **`commands/purge-death-drafts.js`** — New `/purge-death-drafts` command: deletes ALL death record drafts from Firebase + Discord messages. Requires `DELETE ALL` confirmation string.
- **`deathRecordDraft.js`** — Field-based editing via "Edit Fields" button: individual modals for Cause of Death, Place of Death, Decedent Name, OOC. Re-generates BBCode from template on save. Split from single "Edit" button into "Edit Fields" + "Edit BBCode" (full raw editor, shows error if >4000 chars).
- **`death-record-check.js`** — New `from:` date option: `from:20/JUL/2026` scans from that date through today instead of exact match.
- **`deathRecordDraft.js`** — Duplicate draft detection: `scanAndDraftCKs` now tracks seen morgue case IDs to prevent double-drafting when the same report exists in both `scheduledReports` and `newSavedReports`.

## 2026-07-26 — Bug fixes: rotation corruption, LSPD crosspost fallback, CPU monitoring, reassign reply

### Fixed
- **`autopsyRotation.js`** — Fixed `splice` bug (`1` → `0` delete count) that was replacing existing MEs instead of inserting new ones, causing duplicate entries and corrupted rotation lists. Added name trimming to prevent whitespace-based false mismatches. Added auto-corruption detection: if duplicates are found, the list is reset to a fresh random order from the forum group.
- **`autopsyRequestMonitor.js`** — `getGroupMembers(50)` calls now use `paginate: true` so all MEs are fetched, not just the first 25. Previously MEs past page 1 got `user_id=0` in quote tags. Also saves `requestBbCode` to Firebase during detection so the original request content survives restarts.
- **`deployAutopsyReply.js`** — LSPD crosspost step now detects LSPD cases even when `lspdTopicId` wasn't saved during detection (state machine race). Falls back to creating the LSPD topic at completion time instead of silently skipping.
- **`reassign-autopsy.js`** — Embed now shows "Samuel Cerniglia — reassigned from Alyson Frost to James Salter" instead of backwards wording. Posts a reassignment notice reply in the case topic so the post body reflects the change.
- **`systemMonitor.js`** — Added CPU/RAM/disk resource checks (80%/85%/90% thresholds) with Discord alerts. High-severity alerts now actually send to Discord (were only logged to console).
- **`cctvScheduler.js`** — First CCTV fetch now waits 5 minutes after startup so it doesn't overlap with health check Playwright sessions, preventing 4+ concurrent browser instances.

## 2026-07-22 — Security: morgue API hardening, roster sync, firebase-admin v14

### Added
- **`morgue-api.js`** — Suspicious pattern detection (RCE, path traversal, SQLi, SSTI, prototype pollution). Write method restriction (`MORGUE_WRITE_API_KEYS`). Comprehensive IP/User-Agent request logging. `?key=` query param removed
- **`factionRosterSync.js`** — Cooldown 24h → 4h. Bot-spam notification on sync. Exported `getRosterSyncStatus()` for dashboard
- **`dashboardManager.js`** — Roster sync status in Scheduled Tasks section
- **`autopsyRotation.js`** — `syncRotationFromGroup()` for dynamic new ME detection

### Changed
- **firebase-admin v14 migration** — All services/commands updated to modular imports (`getAuth`, `getDatabase`, `getApps`, `cert`). Dynamic imports in force/fix commands
- **`factionRosterSync.js`** — Auto-detect mode (department optional, `.filter()` instead of `.find()`)

## 2026-07-24 — CCTV Scheduler: bot-managed 6-hour fetch cycle

### Added
- **`services/cctvScheduler.js`** — New service that runs `fetch-all.js --headless` every 6 hours. Spawns the script as a child process, captures stdout, parses the summary (new entries, cameras fetched, elapsed time), and posts results to the bot-spam channel. Only shows cameras with new entries in the Discord message (max 5) to avoid spam. Handles timeouts (2.5 min), startup fetch immediately on bot start, and error logging.
- **`index.js`** — Registers the CCTV scheduler on bot ready alongside other services.

### Removed
- **Cron job** — Removed from crontab (replaced by bot-managed `setInterval`). The bot handles scheduling natively now, with proper Discord logging.

---

## 2026-07-19 — Fix: Medical Records duplicate detection refined

### Fixed
- **`deployMedicalRecord.js`** — Duplicate detection now uses **patient name** as the primary dedup key (not just numeric patientID), so it catches rapid re-saves even when the form has no patient ID filled. Also added a **broad safety net**: same author + same formId within 60s is treated as a duplicate. This catches rapid double-saves like the ER Protocol case where the second save had a blank title and no patient name/ID.

---

## 2026-07-19 — Fix: Medical Records creating duplicate posts on new patient topic

### Fixed
- **`deployMedicalRecord.js`** — When no existing patient thread was found, the handler was creating a new topic and then falling through to also post a reply with the same content, producing a duplicate. Now when a new topic is created, the handler returns early with `markReportComplete` — the topic content IS the post, no reply needed. Progress embed now shows "Topic Created" instead of "Posting Reply" for this path.

---

## 2026-07-18 — Added: LSPD crosspost completion step + PM debug dump

### Added
- **`deployAutopsyReply.js`** — Added LSPD crosspost as a proper completion step in the progress embed, mirroring the LSSD pattern. When an LSPD case completes (`entry.lspdTopicId` exists), a new "LSPD Crosspost" step appears in the embed that replies to the certified copy topic on LSPD f=1361 with the completed report. Retry logic also added for the `lspdCrosspost` step name.
- **`forumClient.js` — `sendPM()`** — When the message textarea is not found, now saves the **full page HTML** to `debug-pm-page.html` (was only logging a 3000-char snippet). The error message also includes page title + URL for faster triage.

### Fixed
- The LSPD crosspost function (`crosspostAutopsyToLspd` in `deployLspd.js`) was imported but never called in the completion flow — the autopsy progress embed showed no indication that LSPD posting was happening. It now runs as a tracked step.

---

## 2026-07-18 — Fix: PM failure now saves full HTML dump for debugging

### Changed
- **`forumClient.js` — `sendPM()`** — When the message textarea/editor is not found on the PM compose page, the bot now saves the **full page HTML** to `debug-pm-page.html` (in the bot root directory) before throwing. Previously it only logged a 3000-char snippet to console, making it impossible to diagnose what the page actually rendered (login redirect, Cloudflare challenge, different layout, etc.). The error message now also includes the page title and URL for faster triage.

---

## 2026-07-17 — Fix: consent race condition — users opting out after save

### Fixed
- **`FormHandler.jsx` (web app)** — Added consent gate in `copyAndSaveReport()`. When a user clicks "Save and Queue" on a deploy-tracked form and has never set auto-deploy preferences, the consent modal opens first. The user must complete their preferences before the report is saved. This prevents the race where a report gets queued before the user has a chance to opt out.
- **`deployExecutor.js` (bot)** — Added consent re-check at deploy-time. Even after a report is queued, the bot now re-reads Firebase consent data right before executing. If the user revoked consent during the 2.5-minute defer window (or via retry), the deploy is skipped and marked as `skipped_no_consent`.

Web app also needs rebuild + deploy:
```
npm run build && node tools/deploy.js
```

---

## 2026-07-17 — Morgue API expansion: bulk name lookup + group scraper

### Added
- **`morgue-api.js` — `POST /api/morgue/lookup-by-names`** — New endpoint that accepts `{ names: [...], exact: bool }` and returns matching morgue records per query name. Supports substring (default) or exact case-insensitive matching. Auth + rate limited like all other endpoints.
- **`commands/group-morgue-check.js`** — New `/group-morgue-check` Discord command. Scrapes a faction group roster (LSPD/LSSD/SADCR/DAO/PHMC) across all pages, then checks each member name against local morgue records. Returns an embed with deceased/alive counts and a JSON file attachment with full results. Optional `save_file` flag to persist to VPS disk.
- **`index.js`** — Registered the new `/group-morgue-check` command.

### Changed
- **`forumClient.js` — `getGroupMembers()`** — Added `paginate: false` option. When true, loops through `start=0, 25, 50, ...` URL parameter to scrape all pages of a phpBB member list. Detects last page when fewer than 25 members returned. Default `false` for backward compatibility with existing callers (ME group 50).

Then restart both processes:
```
ssh root@88.208.243.254 "cd /opt/phmc-bot/discord-bot && pm2 restart phmc-bot"
ssh root@88.208.243.254 "cd /opt/phmc-bot/discord-bot && pm2 restart morgue-api"
```

---

## 2026-07-17 — Dashboard: removed payment references + added Restart Bot button

### Changed
- **`dashboardManager.js`** — Removed the `* 2000` revenue calculation that multiplied LSPD/LSSD autopsy request counts by $2,000. The dashboard embed now shows plain request counts only (e.g. `LSPD: 5 requests | LSSD: 3 requests`) instead of fabricated revenue figures.
- **`dashboardManager.js`** — Added a 🔁 **Restart Bot** button (Danger style) alongside the existing Refresh Now button. When clicked, it posts an ephemeral confirmation then calls `process.exit(0)` — PM2 auto-restarts the process within seconds.
- **`index.js`** — Wired up the `dashboard_restart` button interaction to the new `handleDashboardRestart` handler.

---

## 2026-07-16 — Forum client refactor: isolated per-faction contexts + longer waits

### Changed
- **`forumClient.js`** — Refactored to support isolated browser contexts. The Chromium browser process is now a module-level singleton shared by all `ForumClient` instances, but each instance gets its own browser context (separate cookies, localStorage, Cloudflare state) and session file. This prevents LSSD login from invalidating PHMC session state and vice versa.
- **`forumClient.js` — `ensureBrowser()`** — No longer launches a browser per instance. Calls `getSharedBrowser()` which creates the browser once module-wide, returns it for all subsequent calls.
- **`forumClient.js` — `saveSession()` / `hasSession()`** — Use instance-specific `this.sessionFile` instead of the old global `SESSION_FILE`.
- **`forumClient.js` — `close()`** — New method. Closes the instance's browser context + page without shutting down the shared browser. Cleanup for temporary isolated clients.
- **`forumClient.js` — `constructor({ sessionFile, isIsolated, sessionDir })`** — New options for per-instance session isolation.

### Added
- **`forumClient.js` — `createIsolatedClient(name)`** — New export. Creates a `ForumClient` with its own context, page, and session file (`forum-session-{name}.json`). Used for cross-forum operations so LSSD/LSPD/DM steps don't share session state with the main PHMC client.
- **`forumClient.js` — `getSharedBrowser()`** — Internal: launches one Chromium process for all instances. Subsequent calls return the existing browser.
- **`deployAutopsyReply.js` — LSSD operations now use `createIsolatedClient('lssd-complete')`** — Both LSSD posts (confirmation + report) share one dedicated client with a fresh LSSD login. No longer calls `client.login(FORUM_LSSD_...)` on the shared PHMC client.
- **`deployAutopsyReply.js` — DM step now uses `createIsolatedClient('dm')`** — Has its own PHMC session for `sendPM`, independent of the main client.
- **`forumClient.js` — Reply `waitForLoadState('networkidle', { timeout: 25000 })` after submit** — Gives Cloudflare challenges and slow forum responses time to resolve before entering preview-recovery logic. Added 10-second wait in Strategy 3 before giving up on success text.
- **`forumClient.js` — Debug HTML dumps now save full page via `this.page.content()`** — Was truncating at 5000 chars (`innerHTML.slice(0, 5000)`), making debug files useless (the last dump was only the navbar). Now saves complete HTML.

### Fixed
- **`forumClient.js` — `this.sessionDir` was undefined** — Line 1101 referenced `this.sessionDir` which was never set in the constructor. Debug HTML was written to `process.cwd()` instead of a consistent path. Now uses `this._sessionDir` set in constructor (defaults to `__dirname`).

---

## 2026-07-16 — Fix: Medical Record search not finding existing patient topics

### Fixed
- **`forumClient.js` — `searchForPatientTopic()`** — Search URL used `sf=firstpost` which restricted phpBB search to only the first post body of each topic. When the first post content wasn't indexed for the patient name, the search returned "No suitable matches" even though the topic existed. Changed to `sf=all` so the search covers all post content. For Mauro Garcia, the existing topic "1911 - Mauro Garcia" was not found, causing the bot to auto-assign a new patient ID (22) and create a duplicate topic.

## 2026-07-15 — Fix: startup flood — cold-load guard on scheduledReports listener

### Fixed
- **`autoDeploy.js`** — The Firebase `on('value')` listener fires immediately on startup with ALL existing `scheduledReports` data. Previously, every report where `hasdeployed` wasn't `true` got queued for deploy, causing a flood of stale entries (duplicate medical records, re-processed coroner emails, etc.). Now the first callback is a cold-load phase that primes only already-deployed reports (`hasdeployed === true`) into `knownReportKeys`. Pending reports (including those with `deployStatus === "queued"` from a prior session) fall through to normal processing so they get queued and deployed, not silently dropped.
- **`autoDeploy.js` — dev-reports listener** — Same cold-load guard applied to the dev-reports listener for consistency.

## 2026-07-15 — Fix: replyToTopic login detection

### Fixed
- **`forumClient.js` — `replyToTopic()`** — Navigation `ERR_ABORTED` when phpBB redirects (e.g. login page, error page) would throw before the login handling code ran. Now wraps `page.goto` in try/catch — if navigation aborts, it waits for the page to settle and checks where it landed (handles login redirects, error pages, etc.). Affects LSSD (f=2263) and LSPD cross-post replies.
- **`deployAutopsyReply.js` — completion flow** — `anyFailed` only checked for promise rejections, but every step handler catches its own errors, so failures were silently swallowed and the embed always showed "Complete." Now tracks actual step success/failure via a `stepFailed` object. Failed steps show a `⚠️ Retry Scheduled` row with the failing step names and the embed finalizes as "Failed" instead of "Complete."
- **`deployLogger.js` — `DeployProgressEmbed._build()`** — Added `⚠️` icon mapping for `'warn'` status (used by the retry notification step).
- **`deployAutopsyReply.js` — LSSD steps added with clear logging** — Re-added both LSSD posts as separate completion steps. Step 2: `LSSD Confirmation Reply` posts the COMPLETION_TEMPLATE ("We have completed..."). Step 3: `LSSD Autopsy Report` posts the full autopsy report (`bbCode`). Console logs clearly distinguish them (`LSSD confirmation reply` vs `LSSD autopsy report`). Old fire-and-forget `crosspostAutopsyToLssd` call removed since it's now a proper step. Retry handler updated for both step names.
- **`deployMedicalRecord.js` — Patient ID regex fix** — The regex `/^d+$/` matched literal `"d"` characters instead of digits `\d`, causing auto-assignment to fire for every report regardless of whether the user filled in a patient ID. Changed to `/^\d+$/` so valid numeric IDs are recognized and preserved.
- **`deployMedicalRecord.js` — Existing patient ID extraction** — When patientID is left blank and auto-assignment fires, but the patient already has an existing thread, the bot now parses the real patient ID from the found topic's title (e.g. "2034 - John Doe") and uses that instead of a newly incremented value.
- **`deployMedicalRecord.js` — Debug logging** — Added `[MEDICAL-RECORD-DEBUG]` logs at each decision point: raw field values, auto-assignment trigger, BBCode placeholder presence, replacement success, and existing-topic ID extraction.
- **`deployMedicalRecord.js` — Restructured ID flow** — Moved `getNextPatientId()` (f=97 scan) AFTER the search. Previously it scanned every topic to find the highest ID before even knowing if a topic existed, wasting an expensive forum scan. Now: search first → if topic found, extract ID from title → only if no topic found, auto-assign a new ID.

## 2026-07-15 — Fix: maintenance mode not blocking coroner emails

### Fixed
- **`deployCoronerEmail.js`** — Now checks maintenance mode at the top of `handleCoronerEmail()` regardless of which code path calls it. Previously, any direct call (from `handleTopic`, dev-reports listener, etc.) bypassed the queue's maintenance check and would deploy during maintenance mode.

## 2026-07-15 — Fix: reassign-autopsy topic lookup

### Fixed
- **`reassign-autopsy.js`** — Now uses stored `caseTopicId` from Firebase instead of relying on forum title text search. If the case thread title was edited (e.g. OOC name removed), reassignment still works because it reads the topic ID directly from the `autopsy-requested` entry. Falls back to forum search only if `caseTopicId` is missing.

## 2026-07-14 — Refactor: Split autoDeploy.js into focused handler modules

### Changed
- **`autoDeploy.js`** reduced from ~1420 to ~300 lines. Now acts as a pure facade: imports, re-exports, `setAutoDeployClient()`, `startAutoDeploy()` listener wiring. All handler code extracted.

### Added
- **`deployPM.js`** (new) — `handlePM()` extracted from autoDeploy.js. Forum PM dispatch (LSPD/LSSD/SADCR/DAO routing).
- **`deployTopic.js`** (new) — `handleTopic()` extracted. Forum topic posting with dry-run support.
- **`deployMedicalRecord.js`** (new) — `handleMedicalRecord()`, `getNextPatientId()`, `pruneRecentPatientRecords()`. Patient notes and medical record replies.
- **`deployAutopsyReply.js`** (new) — `handleAutopsyReply()`, completion flow (`startCompletionStep`, `finishCompletionStep`), `retryFailedCompletionSteps()`, `COMPLETION_TEMPLATE`. All autopsy/case-management logic.

### Updated
- **`deployExecutor.js`** — Lazy imports now load from dedicated handler modules instead of autoDeploy.js, breaking the circular dependency chain.
- **`deployTest.js`** — Imports `handleAutopsyReply` from `deployAutopsyReply.js`.

No behavioral changes — pure refactor.

## 2026-07-13 — Auto-generated Coroner Emails (dry-run only)

### Added

- **`deployCoronerEmail.js`** (new) — Dedicated handler for auto-generated Coroner Emails. When a Coroner Report is saved with `ReportRequested=true` (or Mass Fatality with `requestingOfficer` filled), the bot automatically fills the `Coroner-Email.json` template, wraps attached report BBCodes as `{{deathReport}}`, and queues a PM to the requesting officer on their department's forum (LSPD/LSSD/SADCR).

- **Safety — `CORONER_EMAIL_DRY_RUN=true`** — Default `true` on production. In dry-run mode, the handler fully renders the BBCode, logs it to console and `debug-coroner-email-bbcode.txt`, and sets Firebase `deployStatus: 'dry_run'`. No forum login, no PM send.

- **Dual safety — `CORONER_EMAIL_ALLOWED`** — Even with `DRY_RUN=false`, live sends are blocked unless the target forum URL is in the `CORONER_EMAIL_ALLOWED` comma-separated whitelist.

- **`autoDeploy.js`** — Listener now checks `ReportRequested` field on coroner-report and mass-ftality-test saves. If true, fires `handleCoronerEmail()` alongside the normal topic post.

- **`.env.example`** — Added `CORONER_EMAIL_DRY_RUN` and `CORONER_EMAIL_ALLOWED` config vars.

## 2026-07-11 — Notification consolidation: unified progress embed for all deploy types

### Added

- **Autopsy startup status embed** — On bot restart, sends a single embed showing:
  - All currently assigned autopsies (name, OOC, assigned ME, age in hours)
  - Staff on LOA (in training / on break)
  - Next ME in rotation
  - Yellow if cases pending, green if all clear

- **Consolidated completion embed** — The three individual completion webhooks (PHMC reply, LSSD reply, DM sent) are now replaced by a single `DeployProgressEmbed` that posts once and edits itself as each step completes. Channel sees one clean message per entry instead of 3+ spam messages.

### Changed

- **`autoDeploy.js`** — Split `trackCompletionStep()` into two-phase tracking:
  - `startCompletionStep()` writes `{status: "attempting"}` to Firebase BEFORE the operation
  - `finishCompletionStep()` updates to `{status: "completed"}` or `{status: "failed"}` AFTER
  - Three completion steps (phmcCompletionReply, lssdCompletionReply, dmSent) now use this pattern

- **`autoDeploy.js` — `finishCompletionStep()`** — Removed individual `sendWebhook()` call. Live Discord updates now go through the consolidated progress embed instead.

- **`autoDeploy.js` — Completion loop** — Changed from `arSnap.forEach` (fire-and-forget IIFEs) to async `for...of` with `Promise.allSettled`. Each entry gets one `DeployProgressEmbed` that posts once and edits as steps complete: `⏳ PHMC Reply → ✅ PHMC Reply #12345`, `⏳ LSSD Reply → ⏭️ No LSSD`, `⏳ DM Requester → ✅ DM sent`. Finalized as green "Complete" or red "Failed" when all steps settle.

- **`autoDeploy.js` — `retryFailedCompletionSteps()`** — Now actually **retries** failed steps instead of just warning:
  - `"failed"` → genuine failure → auto-retries by re-posting the completion reply / re-sending the DM
  - `"attempting"` → crash mid-op → skipped to prevent duplicate forum posts
  - `"completed"` → already done → skipped
  - Creates a forum client at startup, logs into PHMC (and LSSD if needed), performs retries
  - Updates Firebase status to `completed` on success, keeps `failed` if retry fails
  - Sends a summary webhook: green "All Resolved" or yellow "X Still Failed" with case details
  - Logs include decedent name (`"Marcus Johnson" (#firebaseKey)`) and step name for clear PM2 debugging
  - DM retries use stored `completedBbCode` from the Firebase entry

### Removed (redundant standalone webhooks — now covered by progress embed)

- **`deployQueue.js`** — Removed "⏳ Report Queued" standalone webhook. Queue status shown by the `DeployProgressEmbed` posted at queue time.
- **`deployExecutor.js`** — Removed "🚀 Deploying Report" standalone webhook. The progress embed is resumed from the queue embed and shows deploy progress.
- **`deployStatus.js`** — Removed "✅ Report Complete" standalone webhook. The progress embed finalizes with green/red status.
- **`autoDeploy.js`** — Removed duplicate "Bot Online" startup webhook (was already sent from `index.js`). Merged `Auto-deploy listener active.` into the index.js startup message.

### Changed

- **`autoDeploy.js` — `handlePM()`** — Added `DeployProgressEmbed` with steps: Logging in, Sending PM. Finalizes on success/failure. Picks up queue embed if available.
- **`autoDeploy.js` — `handleTopic()`** — Added `DeployProgressEmbed` with steps: Login, Posting Topic. Finalizes on success/failure. Picks up queue embed if available.
- **`autoDeploy.js` — `handleMedicalRecord()`** — Added `DeployProgressEmbed` with steps: Login, Searching, Posting Reply. Handles duplicates, dry-runs, and failures. Picks up queue embed if available.
- **`index.js`** — Merged auto-deploy status into the single "Bot Online" startup message.

### Files to upload

```
pscp discord-bot/services/autoDeploy.js root@88.208.243.254:/opt/phmc-bot/discord-bot/services/autoDeploy.js
pscp discord-bot/services/deployQueue.js root@88.208.243.254:/opt/phmc-bot/discord-bot/services/deployQueue.js
pscp discord-bot/services/deployExecutor.js root@88.208.243.254:/opt/phmc-bot/discord-bot/services/deployExecutor.js
pscp discord-bot/services/deployStatus.js root@88.208.243.254:/opt/phmc-bot/discord-bot/services/deployStatus.js
pscp discord-bot/index.js root@88.208.243.254:/opt/phmc-bot/discord-bot/index.js
```

---
