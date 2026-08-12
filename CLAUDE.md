# PHMC Forms — Project Guide

> **PHMC = Pillbox Hill Medical Center** — the faction/organization this app and the bot serve.
>
> **Bot docs:** [`discord-bot/README.md`](discord-bot/README.md) — architecture, Firebase schema, commands, setup
> **Bot env vars:** [`discord-bot/.env.example`](discord-bot/.env.example) — complete reference with descriptions

## Key Facts

- **Bot changes must be UPLOADED to the VPS, then the bot RESTARTED — in that order.** Editing `discord-bot/*.js` (or `.env`) locally only changes the repo; the deployed bot on the VPS (`/opt/phmc-bot/discord-bot/`) keeps running the old code until you (1) `scp` the changed files up and (2) `pm2 restart phmc-bot` (plus `pm2 restart morgue-api` when `morgue-api.js` changed). No upload = no change; no restart after upload = no change either. Restart happens only on the VPS via SSH — a local `pm2`/`node` command on the user's machine does nothing to the deployed bot.

## Deploy Matrix

What changed determines what needs deploying and who does it:

| Changed files | Deploy action | Who runs it |
|---|---|---|
| `discord-bot/*.js` (services, commands) | SCP to VPS + `pm2 restart phmc-bot` | Claude (Bash tool — try SCP/SSH directly first) |
| `discord-bot/morgue-api.js` | SCP to VPS + `pm2 restart morgue-api` | Claude |
| `discord-bot/.env` | SCP to VPS + `pm2 restart phmc-bot` | Claude |
| `src/*` (web app components, hooks) | `npm run build && node tools/deploy.js` | User runs locally |
| `functions/*` (Cloud Functions code) | `firebase deploy --only functions` | Claude (try Bash tool first) |
| `functions/database.rules.json` | `firebase deploy --only database` | User (Firebase CLI auth required) |
| `src/*` + production push | `npm run build && node tools/deploy.js` | User only — may want extra testing first |

**When multiple layers change** (e.g., bot + web app), both changelogs must be updated:
- `changelog.md` (root — web app changes)
- `discord-bot/changelog.md` (bot changes)

**Localhost dev** — the user runs a Vite dev server on localhost while working. Web app changes are hot-reloaded immediately. Only push to production (`npm run build && node tools/deploy.js`) when asked.

SSH key is at `~/.ssh/phmc_vps` — try SCP/SSH via the Bash tool first. If the sandbox blocks interactive auth, tell the user to prefix the command with `! `:

```
! scp -i ~/.ssh/phmc_vps discord-bot/path/file.js root@88.208.243.254:/opt/phmc-bot/discord-bot/path/file.js
```

## Bash Sandbox Quirks

The Bash tool sometimes hangs on long-running commands (e.g. `firebase deploy`, `npm build`, SSH sessions). If a command doesn't return within ~30 seconds, prompt the user to run it themselves by prefixing with `! `:

> `! firebase deploy --only functions`

This sends the command through the user's local terminal instead of the sandboxed Bash tool. SCP/SSH one-liners usually work fine; the hang is most common with interactive CLI tools and long-running builds.

## VPS Commands

```bash
# ── File Transfer ──
scp -i ~/.ssh/phmc_vps discord-bot/path/to/file.js root@88.208.243.254:/opt/phmc-bot/discord-bot/path/to/file.js

# ── Bot Management ──
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "cd /opt/phmc-bot/discord-bot && pm2 restart phmc-bot"
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "pm2 status"
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "pm2 logs phmc-bot --lines 50 --out"
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "pm2 logs phmc-bot --lines 50 --err"

# ── Morgue API ──
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "cd /opt/phmc-bot/discord-bot && pm2 restart morgue-api"
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "pm2 logs morgue-api --lines 50"
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "curl http://localhost:3001/api/health"

# ── Combined Logs (realtime) ──
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 "pm2 logs"
```

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

## Staging Mode (forms_staging)

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

**Deploying:** Upload `morgue-api.js` via SCP, then SSH in to:
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