# PHMC Forms — Project Guide

> **🚧 ACTIVE WORK — test-strategy plan (`plan/test-strategy-plan.md`, Phases T1+T2).**
> Supervisor: test-strategy session (deepseek). Coordinate file touches with it;
> no out-of-plan refactors, no pushes and no `node tools/deploy.js` without the
> owner's explicit go-ahead. (The eslint-cleanup banner was retired with that plan.)

> **PHMC = Pillbox Hill Medical Center** — the faction/organization this app and the bot serve.
>
> **Bot docs:** [`discord-bot/README.md`](discord-bot/README.md) — architecture, Firebase schema, commands, setup
> **Bot env vars:** [`discord-bot/.env.example`](discord-bot/.env.example) — complete reference with descriptions

## Key Facts

- **`phmc.gta.world` (web app) and the VPS bot are separate deploy targets.** The web app is built + pushed by the user (`npm run build && node tools/deploy.js`). The Discord bot lives on the VPS at `/opt/phmc-bot/discord-bot/` and is deployed with the whole-tree tool below.
- **Bot deploy is WHOLE-TREE, never file-by-file.** The VPS is a **mirror**, not a partial copy: a file there only updates when it is physically copied. Copying "just the files I edited" leaves every other file on its last hand-copied version — that is exactly how the repo and VPS silently drifted apart (2026-09-26 → 2026-09-30) and how autopsy request 10308 lost its acknowledgement. Use the tool; it syncs the entire tree and proves the result.
- **The repo is the single source of truth.** Never edit files on the VPS in place (`nano`, OpenChamber, etc.). If an emergency VPS edit is unavoidable, port it back to the repo the same day and record it in `discord-bot/OPENCHAMBER-VPS-EDITS.md`. A bot is not "changed" until the repo has the change AND it is deployed.

## Bot Deployment (discord-bot/ → VPS)

**The only supported way to deploy the bot:**

```bash
npm run bot:check     # READ-ONLY parity report: what differs / is missing on the VPS
npm run bot:deploy    # mirror the whole discord-bot/ tree + verify + restart
```

`npm run bot:deploy` (`node tools/deploy-bot.mjs --deploy`) does, in order:

1. Runs `tools/check-bot-imports.mjs` — refuses to deploy if any named import across the bot does not resolve (prevents the 2026-09-26 class of bug where a committed call site's implementation was never committed).
2. Refuses to deploy if `discord-bot/` has uncommitted changes (bypass with `--allow-dirty`).
3. Tars the committed (git-tracked) tree — secrets, `node_modules/`, `data/`, `logs/`, `changelog.md`, `debug/` are gitignored and therefore never included — backs up the current VPS tree, uploads, and extracts over `/opt/phmc-bot/discord-bot/`.
4. Runs `npm install` on the VPS only if `package.json` changed.
5. Writes the deployed commit SHA + branch + timestamp to `/opt/phmc-bot/discord-bot/.deploy-revision`.
6. Restarts `phmc-bot` (and `morgue-api` when `morgue-api.js` changed), then re-checks md5 parity and **fails loudly if the tree did not fully sync**.

**Rules for an AI assistant (anti-vagueness — do not skip):**

- **"The changed files" is NOT a deploy unit.** Do not `scp` individual files, and never assume the VPS matches the repo. Always run `npm run bot:check` first, then `npm run bot:deploy`.
- **Review drift before a reconciliation.** If `bot:check` reports many differences, the VPS may hold newer/hotfixed code for some files. Diff first (`git diff`, or pull the VPS copy of a file) so a whole-tree sync does not regress it. After one clean reconciliation, the mirror keeps them aligned.
- **`.env` / credentials are never in the tar.** Edit those on the VPS directly; they are deliberately excluded from both deploy and parity.
- **Assume nothing is live until `bot:deploy` has run.** Editing `discord-bot/*.js` locally changes only the repo.

## Deploy Matrix

| Changed files | Deploy action | Who runs it |
|---|---|---|
| `discord-bot/**` (services, commands, components, templates, index.js) | `npm run bot:check` then `npm run bot:deploy` (whole tree) | Claude (Bash tool) or user |
| `discord-bot/.env` (secrets — excluded from the tool) | Edit on the VPS, then `pm2 restart phmc-bot` | Claude over SSH |
| `src/*` (web app components, hooks) | `npm run build && node tools/deploy.js` | User runs locally |
| `functions/*` (Cloud Functions code) | `firebase deploy --only functions` | Claude (try Bash tool first) |
| `functions/database.rules.json` | `firebase deploy --only database` | User (Firebase CLI auth required) |
| `src/*` + production push | `npm run build && node tools/deploy.js` | User only — may want extra testing first |

**When multiple layers change** (e.g., bot + web app), both changelogs must be updated:
- `changelog.md` (root — web app changes)
- `discord-bot/changelog.md` (bot changes)

**Localhost dev** — the user runs a Vite dev server on localhost while working. Web app changes are hot-reloaded immediately. Only push to production (`npm run build && node tools/deploy.js`) when asked.

SSH key is at `~/.ssh/phmc_vps`. `npm run bot:check` / `npm run bot:deploy` use it automatically (`PHMC_VPS_SSH_KEY` to override). If the sandbox blocks interactive auth, tell the user to prefix the command with `! ` (e.g. `! npm run bot:deploy`).

## Writing Commands — Scripts, Not One-Liners

**Default to a script for anything beyond a trivial one-liner.** PowerShell 5.1
mangles `$`, backticks, `$(...)`, nested quotes and inline `node -e` JS before
they reach the VPS; fighting it wastes turns and causes silent breakage. A script
file is also reviewable, re-runnable, and copy/paste-safe.

Workflow:

1. **Write** the script to `C:\Users\cross\AppData\Local\Temp\opencode\` — a Node
   `.mjs` when it touches Firebase/HTTP/JSON, a `.sh` for pure remote shell.
2. **Run** it (`node <script>.mjs`, or `scp` it up and `ssh … "bash /tmp/<script>.sh"`).
3. **Promote or delete** — every script ends one of two ways:
   - **Reusable** (a repair, probe, or deploy helper you would run again) → move it
     into the repo and commit it. Reusable bot/VPS tooling lives in `tools/` (add a
     `.gitignore` negation under the otherwise-ignored `tools/`, as done for
     `tools/deploy-bot.mjs` and `tools/check-bot-imports.mjs`).
   - **One-shot** → delete it (the local temp copy and any VPS copy). Do not leave
     dead scripts behind.

Inline one-liners stay fine only for trivial, quoting-free commands (`ls`,
`pm2 status`, `git log`). The `!`-prefix escape hatch below is for commands that
must run in the user's own terminal.

## Bash Sandbox Quirks

The Bash tool sometimes hangs on long-running commands (e.g. `firebase deploy`, `npm build`, SSH sessions). If a command doesn't return within ~30 seconds, prompt the user to run it themselves by prefixing with `! `:

> `! firebase deploy --only functions`

This sends the command through the user's local terminal instead of the sandboxed Bash tool. SSH one-liners usually work fine; the hang is most common with interactive CLI tools and long-running builds.

## VPS Commands

```bash
# ── Bot deploy (whole tree — do NOT scp single files) ──
npm run bot:check        # read-only parity: repo vs VPS
npm run bot:deploy       # mirror whole discord-bot/ tree + verify + restart

# ── Bot Management (logs/status are fine to SSH directly) ──
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "cd /opt/phmc-bot/discord-bot && pm2 restart phmc-bot"
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "pm2 status"
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "pm2 logs phmc-bot --lines 50 --out"
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "pm2 logs phmc-bot --lines 50 --err"

# ── Deployed revision ──
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "cat /opt/phmc-bot/discord-bot/.deploy-revision"

# ── Morgue API ──
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "cd /opt/phmc-bot/discord-bot && pm2 restart morgue-api"
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "pm2 logs morgue-api --lines 50"
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "curl http://localhost:3001/api/health"

# ── Combined Logs (realtime) ──
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "pm2 logs"
```

> `.env` edits are the one exception: the deploy tool excludes secrets, so edit
> `.env` on the VPS (or via a one-off `scp` of `.env` only) and then restart.
> Everything under `discord-bot/` goes through `npm run bot:deploy`.

## Project Structure

```
src/
├── components/
│   ├── Admin/          # Admin tools: morgue manager, CK viewer, webhooks,
│   │                   #   form editor, faction data, LSCC, database editor,
│   │                   #   bot status dashboard
│   ├── Auth/           # GTA World OAuth, email login, login splash
│   ├── ems-dashboard/  # EMS protocols, shift dashboard
│   ├── ui-new/         # *Current main UI* (route: /ui-prototype)
│   │                   #   Grid-based form layout, right panel, branded
│   │                   #   sidebar — all new development goes here
│   ├── form-handler/   # ⚠️ Legacy — original form renderer, BBCode gen,
│   │                   #   save flow, CK viewer. Active route still uses
│   │                   #   this code; major logic differences exist from
│   │                   #   the prototype. Useful reference when debugging
│   │                   #   prototype issues.
│   ├── Modals/         # Map, bug report, bot deploy consent,
│   │                   #   assigned autopsies, employee credentials
│   └── UI/             # Sidebar nav, morgue lookup, notifications
├── hooks/
│   ├── useConsent.js           # Bot deploy consent per form type
│   ├── useFormSaver.js         # Save reports to Firebase (+ deploy routing)
│   ├── useBbcodeGenerator.js   # BBCode from form templates
│   ├── useGtaWorldAuth.js      # GTA World OAuth flow
│   ├── useReportLoader.js      # Load saved reports from Firebase
│   ├── useReportActions.js     # Delete / manage saved reports
│   ├── useReportAttachment.js  # Attach reports to coroner email
│   └── useInactivityReload.js  # Auto-reload after idle timeout
├── contexts/
│   ├── DataContext.jsx         # Firebase data cache + lazy morgue loading
│   ├── AuthContext.jsx         # Firebase Auth state
│   ├── GtaWorldAuthContext.jsx # GTA World OAuth + faction membership
│   ├── ModalProvider.jsx       # Image preview modal state
│   └── NotificationContext.jsx # Toast notification system
├── services/
│   └── firebaseFunctions.js    # Callable function wrappers
├── utils/
│   ├── logging.js              # Discord error webhooks, admin logging
│   ├── identityUtils.js        # Character name/ID helpers
│   ├── morgue.js               # Morgue record parser + BBCode generator
│   └── ...more utilities
├── firebase.js                 # Firebase SDK init
└── App.jsx                     # Route definitions + service worker

discord-bot/
├── index.js                    # Bot entry point + slash command registration
├── morgue-api.js               # Standalone Express REST API for morgue records
├── services/
│   ├── autoDeploy.js           # Listener facade + startup orchestration
│   ├── forumClient.js          # Playwright browser automation (phpBB)
│   ├── deployConsent.js        # checkUserConsent, skipDueToConsent
│   ├── deployQueue.js          # enqueue, skipReport, maintenance mode
│   ├── deployExecutor.js       # runDeploy (sequential gate + consent re-check)
│   ├── deployStatus.js         # markDeployed, setDeployStatus
│   ├── deployRetry.js          # retry queue management
│   ├── deployLogger.js         # logFnCall, sendWebhook, DeployProgressEmbed
│   ├── deployState.js          # Shared state + constants
│   ├── deployPM.js             # Forum PM handler (LSPD/LSSD/SADCR/DAO)
│   ├── deployTopic.js          # Forum topic poster
│   ├── deployMedicalRecord.js  # Patient notes / medical record reply
│   ├── deployAutopsyReply.js   # Autopsy completion + case mgmt reply
│   ├── deployCoronerEmail.js   # Auto-generated coroner email PM
│   ├── deployLssd.js           # LSSD forum cross-post
│   ├── deployLspd.js           # LSPD forum cross-post
│   ├── deployInteraction.js    # Interactive topic picker
│   ├── deployTest.js           # Dry-run / test helpers
│   ├── autopsyRequestMonitor.js# Forum f=265 scanner
│   ├── autopsyRotation.js      # ME round-robin assignment
│   ├── deathRecordDraft.js     # CK listener + death record drafting
│   ├── dashboardManager.js     # System status embed
│   ├── queueDashboard.js       # Deploy queue embed
│   ├── systemMonitor.js        # 60-min health checks
│   ├── logChannel.js           # bot-spam channel notifications
│   ├── firebase.js             # Firebase Admin singleton
│   ├── logger.js               # File logger (log.txt rotation)
│   └── meDiscordNotify.js      # Discord PM notifications for MEs
├── commands/                   # Slash commands (auto-registered on restart)
├── templates/                  # BBCode templates (e.g. Coroner-Email.json)
└── debug-testing-scripts/      # Ad-hoc/debug scripts (probes, one-shot tools)

functions/                      # Firebase Cloud Functions (Node 20)
├── index.js                    # Export aggregator
├── src/
│   ├── auth/                   # GTA World OAuth, token exchange
│   ├── webhooks/               # Discord webhook proxy
│   ├── maintenance/            # Daily tasks, faction sync
│   ├── utils/                  # Media proxy, helpers
│   └── reports/                # Report management (legacy)
└── database.rules.json         # Firebase RTDB security rules

tools/                          # Misc scripts (some stale — user tinkers here)
```

## UI Architecture

The app has two parallel UI implementations sharing the same hooks, contexts, and Firebase backend:

### `ui-new/` (Prototype) — **Current primary UI**
- Route: `/ui-prototype`
- Grid-based form layout with branded sidebar, top bar, and tabbed right panel (Profile/Misc)
- All new features and visual changes go here
- Files: `src/components/ui-new/index.jsx` (main entry), `PrototypeFieldRenderer.jsx`, `MorgueBrowser.jsx`, `TimeDisplay.jsx`, `styles.css`, `index.module.css`

### `form-handler/` (Legacy) — **Active production route**
- Used by the original route (`/`) — still serves users
- Contains significant logic differences from the prototype (field rendering, form state management, save flow)
- **Keep as reference** when debugging prototype behavior — if a feature works in the legacy handler but not in the prototype, compare the implementations to find what's missing

### Shared code
- All hooks (`src/hooks/`), contexts (`src/contexts/`), and services (`src/services/`) are shared between both UIs — changes there affect both
- Modals (`src/components/Modals/`) are shared, though prototype may pass different props

## Bot Deploy Queue — scheduledReports Routing

- Listens on `scheduledReports` in Firebase RTDB
- Routes: `coroner_email` → PM (LSPD/LSSD/SADCR), others → PHMC forum topic, `autopsy` → Case Management reply (f=266)
- Checks `user-consent/<uid>/<formId>` before deploying (skips if false). Consent default = deploy when no preferences exist.
- Consent is re-checked at deploy-time (not just queue-time) — opting out during the 2.5-min defer window is respected.
- Retries failed deploys up to 3 times (6h intervals). Retry path also re-checks consent.
- Dry-run flags: `DRY_POST`, `DRY_REPLY`, `AUTOPSY_DRY_RUN` (all default true in .env)

## Autopsy System

**Detection:** `autopsyRequestMonitor.js` scans f=265 every 60min. Parses BBCode to extract structured fields. Stores at `autopsy-requested/<topicId>/parsed/`.

**Case Creation:** Creates new topic in f=266 with auto-incrementing Case NNN. Assigns ME via round-robin (checks LOA and current assignments). Sends acknowledgement reply to the request topic.

**Commands:**
- `/force-autopsy-check` — manual trigger for detection scan
- `/sync-autopsy-requests` — backfill parsed data for existing entries
- `/autopsy-loa <username>` — toggle LOA for an ME

**Cross-Post:** Completed autopsy reports auto-cross-post to LSSD f=2263. Interactive button picker when multiple threads match.

**Web App:** Assigned Autopsies modal auto-opens on autopsy form. Load Case fills from parsed data + morgue record. Completed cases filtered out.

**LOA System:** `autopsy-requests/loa/<username>` in Firebase. Excluded from assignment pool. Dashboard shows ME assignments.

## Consent System

Users set per-form-type auto-deploy preferences via a multi-step modal (BotDeployOptInModal). Stored at `user-consent/<uid>/<formId>` in Firebase as booleans.

- **Default (no data):** deploy allowed (backward compat — user hasn't chosen yet)
- **Opted in (`true`):** report saves to `scheduledReports` → bot deploys
- **Opted out (`false`):** report saves to `newSavedReports` → bot ignores
- **First-time gate:** if user clicks "Save and Queue" without ever setting preferences, the consent modal opens first and must be completed before the save proceeds. After saving preferences, the save re-triggers automatically.
- **Bot re-check:** even after queuing, the bot re-reads consent at deploy-time. Opting out during the 2.5-min window cancels the deploy.
- Autopsy consent is force-enabled (cannot be disabled in the modal).

## Morgue REST API

A standalone Express server (`discord-bot/morgue-api.js`) that exposes morgue records via REST.

- **Endpoint:** `http://88.208.243.254:3001/api/morgue`
- **Auth:** `x-api-key` header or `?key=` query parameter (keys in `MORGUE_API_KEYS` env var)
- **Search:** `?q=name` to filter by name/caseId/location
- **Rate limit:** 60 req/min per API key
- **Health:** `GET /api/health` (no key required)

Managed as a separate PM2 process (`morgue-api`) alongside the bot.

**Deploying:** ship it with the bot (`npm run bot:deploy` — it restarts `morgue-api` automatically when `morgue-api.js` changed). First-time process creation on the VPS:
```bash
ssh root@88.208.243.254 "cd /opt/phmc-bot/discord-bot && npm install express && pm2 start morgue-api.js --name morgue-api"
```

**Generating a new API key:**
```bash
node -e "console.log('pmc_morgue_' + require('crypto').randomBytes(16).toString('hex'))"
```
Add to `MORGUE_API_KEYS` in `.env`, then `pm2 restart morgue-api`.

## Code Conventions

- No `text-muted` — use `var(--text-muted)` on a custom class instead.
- No emojis in code — they break on PowerShell re-save (UTF-8 BOM corruption). Use `[OK]`, `[WARN]`, `[ERR]`, `[DONE]` instead.
- Firebase rules: `".read": true, ".write": "auth != null"` at root.
- Forms stored in Firebase as BBCode templates (JSON schema).
- Bot forum client uses Playwright with stealth plugin — must NOT include `--disable-web-security` or `bypassCSP: true`.
- Secrets (`.env`, `firebase-admin-key.json`, `*credentials.md`) are never committed or read aloud.
- **NEVER commit Discord webhook URLs — no exceptions.** A webhook URL (`discord.com/api/webhooks/<id>/<token>`) IS the secret: anyone holding it can post as the webhook and (via DELETE) destroy it. No webhook URL in tracked source, comments, tests, fixtures, docs, or plan files — not as a "default", "fallback", "example", or "placeholder" (even a fake-looking one trains the pattern). Webhook destinations come ONLY from environment (`process.env.*_WEBHOOK_URL`, gitignored `.env` on the VPS) or the `PHMC_CONFIG` secret / `webhooks/<id>` RTDB node at runtime. Code with no configured URL must fail closed (skip + warn), never fall back to a literal. The pre-commit hook (`.githooks/pre-commit`, enabled via `git config core.hooksPath .githooks`) blocks any staged `discord.com/api/webhooks` literal.

## Observability (Sentry + LaunchDarkly)

Both are web-app only, initialized side-by-side in `src/index.jsx`. Neither may break the app — all init paths are non-fatal no-ops when unconfigured.

- **Sentry — errors + breadcrumbs (authoritative).** DSN is hardcoded in `src/index.jsx`. The per-error breadcrumb trail (console/network/UI) is the primary diagnostic artifact — preserve structured log args (no `[object Object]`). Console interceptor forwards to Discord when Sentry is blocked.
- **LaunchDarkly Observability — session replay + logs/traces.** Module: `src/services/launchdarkly.js`. Prod-only (localhost never records, preserves quota). `privacySetting: 'none'` — forms hold fictional GTA RP data only. Client-side ID via `VITE_LAUNCHDARKLY_CLIENT_ID` in gitignored root `.env` (baked at build time, so it needs a rebuild + `node tools/deploy.js` to take effect). Anonymous context.

## Staging Mode (forms_staging)

A staging database node (`forms_staging`) provides form templates isolated from production. Used by the `/ui-prototype` route.

**Activation:**
- Navigate to `http://localhost:5173/ui-prototype?staging=1`
- Or click the `PROD`/`STAGING` toggle button in the prototype topbar

**How it works:**
- `DataContext.jsx` checks for `?staging=1` query param or `phmc_staging` localStorage flag
- When active, all Firebase reads for `forms` are redirected to `forms_staging`
- Cache keys use `forms_staging` prefix (separate from prod cache)
- Version tracking uses `appMetadata/formsDataVersion_staging` (isolated listener)
- Other data (factions, agencies, morgue, etc.) is unchanged — still reads from prod

**Seed the staging node:**
```bash
node tools/seed-staging-forms.cjs                    # dry-run (shows what would happen)
node tools/seed-staging-forms.cjs --apply --confirm   # copies /forms → /forms_staging
```

**Scope:**
- Only `forms` → `forms_staging` is affected. `scheduledReports`, `morgue-records`, and all other paths remain on production.
- The Discord bot ignores staging mode entirely — it reads from production paths always.