# PHMC Forms — Project Guide

## Key Rules

- After editing any bot file, upload to VPS via `scp` (pscp on Windows) and write to `discord-bot/changelog.md`. Then ask the user to restart via Discord `#dashboard`.
- Files to upload: `pscp -pw PASSWORD local/path/file.js root@88.208.243.254:/opt/phmc-bot/discord-bot/path/file.js`
- New files: `morgue-api.js`, `morgue-api-README.md` — upload to `/opt/phmc-bot/discord-bot/`
- After uploading `morgue-api.js`, SSH in and run: `cd /opt/phmc-bot/discord-bot && npm install express && pm2 start morgue-api.js --name morgue-api`
- `.env`, `firebase-admin-key.json`, and `*credentials.md` contain secrets — never commit or read aloud. Upload via `gcloud compute scp` when the user provides them.
- `/functions` and `/discord-bot` are `.gitignored` — prompt the user for context if needed.
- No emojis unless explicitly prompted. They break on PowerShell re-save (UTF-8 BOM corruption). Use plain text fallbacks like `[OK]`, `[WARN]`, `[ERR]`, `[DONE]` instead.

## VPS


### Bot Commands

```bash
# SSH
ssh root@88.208.243.254

# Upload a file
scp discord-bot/path/to/file.js root@88.208.243.254:/opt/phmc-bot/discord-bot/path/to/file.js

# View logs
ssh root@88.208.243.254 "pm2 logs phmc-bot --lines 50"

# Restart bot
ssh root@88.208.243.254 "cd /opt/phmc-bot/discord-bot && pm2 restart phmc-bot"

# Check status
ssh root@88.208.243.254 "pm2 status phmc-bot"

# Monitor in real-time
ssh root@88.208.243.254 "pm2 logs phmc-bot"

# Morgue REST API
ssh root@88.208.243.254 "cd /opt/phmc-bot/discord-bot && pm2 start morgue-api.js --name morgue-api"
ssh root@88.208.243.254 "cd /opt/phmc-bot/discord-bot && pm2 restart morgue-api"
ssh root@88.208.243.254 "pm2 logs morgue-api --lines 50"
```

### Web App Deploy

```bash
npm run build && node tools/deploy.js
```

## Project Structure

```
src/components/
├── Admin/        # Admin tools (morgue, CKs, webhooks, LSCC, factions)
├── Auth/         # GTA World OAuth, email login
├── ems-dashboard/# EMS protocols & dashboard
├── form-handler/ # Form processing & BBCode rendering (core)
├── Modals/       # Map, bug report, consent modal
└── UI/           # Sidebar nav, morgue lookup, notifications

src/hooks/
├── useConsent.js        # Per-form-type bot deploy consent (Firebase)
├── useFormSaver.js      # Save reports to Firebase
├── useBbcodeGenerator.js# BBCode generation from form templates
├── useGtaWorldAuth.js   # GTA World OAuth
└── ...other hooks

discord-bot/services/
├── autoDeploy.js           # Facade — imports + re-exports from deploy modules
├── forumClient.js          # Playwright browser automation
├── deathRecordDraft.js     # Death record draft approval workflow
├── autopsyRequestMonitor.js# Checks forum f=265 for autopsy requests
├── dashboardManager.js     # System status dashboard embed
├── queueDashboard.js       # Lightweight deploy queue embed
├── deployPMs.js            # Standalone PM deployer
├── systemMonitor.js        # 60-min health cycle checks
├── logChannel.js           # Bot-spam channel notifications
├── firebase.js             # Firebase Admin SDK singleton
├── logger.js               # File logger
├── deployLogger.js         # logFnCall, sendWebhook, logStep (standardized logging)
├── deployState.js          # Shared state + constants for deploy sub-modules
├── deployStatus.js         # markDeployed, setDeployStatus, markReportComplete
├── deployConsent.js        # checkUserConsent, skipDueToConsent
├── deployQueue.js          # enqueue, skipReport, isMaintenanceMode, getQueuedDeployments
├── deployRetry.js          # backfillRetryQueue, checkRetryQueue, requeueReport
├── deployExecutor.js       # runDeploy (sequential gate + timeout guard)
├── deployLssd.js           # crosspostAutopsyToLssd (LSSD forum cross-post)
└── deployInteraction.js    # resolveAutopsyTopic (interactive topic picker + completion)

discord-bot/
├── index.js                # Discord bot entry
├── morgue-api.js           # Standalone REST API for morgue records (Express)
```

## Bot Auto-Deploy System

- Listens on `scheduledReports` in Firebase RTDB
- Routes: `coroner_email` → PM (LSPD/LSSD/SADCR), others → PHMC forum topic, `autopsy` → Case Management reply (f=266)
- Checks `user-consent/<uid>/<formId>` before deploying (skips if false)
- Retries failed deploys up to 3 times (6h intervals)
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
- Firebase rules: `".read": true, ".write": "auth != null"` at root.
- Forms stored in Firebase as BBCode templates (JSON schema).
- Bot forum client uses Playwright with stealth plugin — must NOT include `--disable-web-security` or `bypassCSP: true`.
