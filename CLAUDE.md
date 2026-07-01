# PHMC Forms — Project Guide

## Some project guidelines

- Avoid the usage of any emojis unless explicitly prompted.
- When performing tasks, changes and/or file modifications, write the change to `changelog.md` to ensure accurate tracking of file changes.
- Discord bot changes MUST be written to `discord-bot/changelog.md`. After editing bot files, upload only the changed files via `gcloud compute scp` (see "Discord Bot: GCP Auto-Deploy" section below), then ask the user to restart the bot via Discord #dashboard channel.

## Key Commands

```bash
# SSH into the bot VM
gcloud compute ssh phmc-bot --zone=us-central1-a

# Kill bot immediately (use when spamming or erratic)
gcloud compute ssh phmc-bot --zone=us-central1-a --command="sudo systemctl kill phmc-bot --signal=SIGKILL"

# Stop bot (prevents systemd auto-restart)
gcloud compute ssh phmc-bot --zone=us-central1-a --command="sudo systemctl stop phmc-bot"

# Restart bot (kill + start sequence for clean xvfb-run restart)
gcloud compute ssh phmc-bot --zone=us-central1-a --command="sudo systemctl kill phmc-bot --signal=SIGKILL; sleep 3; sudo systemctl start phmc-bot"

# Check status
gcloud compute ssh phmc-bot --zone=us-central1-a --command="sudo systemctl status phmc-bot --no-pager | head -5"

# Live log monitor (watch all output in real time)
gcloud compute ssh phmc-bot --zone=us-central1-a --command="sudo journalctl -u phmc-bot -f --output=short-iso"

# Filtered log monitor (errors, crashes, warnings only)
gcloud compute ssh phmc-bot --zone=us-central1-a --command="sudo journalctl -u phmc-bot -f --output=short-iso" 2>&1 | grep -iE --line-buffered 'error|fail|crash|exception|unhandled'

# Tail recent logs (last 50 lines, no follow)
gcloud compute ssh phmc-bot --zone=us-central1-a --command="sudo journalctl -u phmc-bot --no-pager -n 50 --output=short-iso"

# Upload a single file
gcloud compute scp discord-bot/services/someFile.js phmc-bot:/opt/phmc-bot/discord-bot/services/someFile.js --zone=us-central1-a

# Upload all commonly-changed files at once
gcloud compute scp discord-bot/services/deathRecordDraft.js phmc-bot:/opt/phmc-bot/discord-bot/services/deathRecordDraft.js --zone=us-central1-a
gcloud compute scp discord-bot/services/autoDeploy.js phmc-bot:/opt/phmc-bot/discord-bot/services/autoDeploy.js --zone=us-central1-a
gcloud compute scp discord-bot/services/dashboardManager.js phmc-bot:/opt/phmc-bot/discord-bot/services/dashboardManager.js --zone=us-central1-a
gcloud compute scp discord-bot/commands/death-record-check.js phmc-bot:/opt/phmc-bot/discord-bot/commands/death-record-check.js --zone=us-central1-a
gcloud compute scp discord-bot/commands/death-record-pending.js phmc-bot:/opt/phmc-bot/discord-bot/commands/death-record-pending.js --zone=us-central1-a
gcloud compute scp discord-bot/index.js phmc-bot:/opt/phmc-bot/discord-bot/index.js --zone=us-central1-a
```

## Project Overview

**PHMC Forms** is a Form Utility for GTA World (GTA 5 RP) that processes BBCode and form inputs for EMS personnel. It features an EMS Dashboard with medical protocols, a Morgue Lookup tool, Map Modal, Admin Panel, and integrates with GTA World OAuth and Discord webhooks.

> **Note:** The `/functions` directory is gitignored (line 51 of `.gitignore`). This directory contains Firebase Cloud Functions used as API/proxy endpoints. You will NOT be able to read these files via search/glob — if you need context on them, ask the user to provide relevant snippets. The `/discord-bot` directory is also `.gitignored`, should you require it, prompt the user.

## Components Structure

```
src/components/
├── Admin/           # Admin dashboard tools (morgue, LSCC, faction data, CKs, webhooks)
├── Auth/            # Authentication handlers (GTA World OAuth, email)
├── Common/          # Shared/common components (currently empty)
├── ems-dashboard/   # EMS protocols & dashboard
├── form-handler/    # Form processing & BBCode rendering (core feature)
├── Modals/          # Custom modal components (map, bug report, feature request)
└── UI/              # Shared UI components (sidebar nav, morgue lookup, notifications)
```

## Services & Hooks

### Services (`src/services/`)
- `gtaWorldAuth.js` - GTA World OAuth integration
- `firebaseFunctions.js` - Firebase Cloud Functions API/proxy calls
- `firebaseDebug.js` - Firebase debug utilities

### Hooks (`src/hooks/`)
- `useGtaWorldAuth` - GTA World OAuth integration
- `useImageUpload` - Image upload handling
- `useBbcodeGenerator` - BBCode generation
- `useReportLoader` - Loading report data
- `useFormSaver` - Saving report data (client-side writes to Firebase)
- `useReportAttachment` - Report attachment handling
- `useReportActions` - Report actions/dispatch
- `useWebhooks` - Webhook integration
- `useFactionPermissions` - Faction-based permission checks
- `useInactivityReload` - Auto-reload on inactivity

## Code Conventions

- **Do not use `text-muted`** (Bootstrap's muted utility class) unless explicitly asked. It has poor contrast on dark backgrounds. Use CSS variables (`var(--text-muted)`) on a custom class instead.
- Database rules: `".read": true, ".write": "auth != null"` at root. All client-side writes require Firebase Auth (GTA World OAuth). Server-side Cloud Functions (Admin SDK) bypass rules.
- **Bingo, PR Dashboard, Shop, CCTV, Autopsy Diagram, Business Card, EMS AMA, Survey, and Agency Incidents** have been removed. The app is focused solely on core form generation, morgue, EMS dashboard, and admin tools.
- Forms are stored in Firebase as BBCode templates (JSON schema). When debugging form issues, ask the user to provide the Firebase template/schema JSON for the specific form.

## Web App (React Frontend)

After making changes to files inside `src/` or adding new form schemas, rebuild and deploy:

```bash
# Build and deploy to GitHub Pages
npm run deploy
```

**Hosting:** GitHub Pages via `gh-pages` branch (not Firebase Hosting).  
**Firebase usage:** Realtime Database + Cloud Functions only.

## Admin Dashboard — Bot Status Section

`src/components/Admin/BotStatus.jsx` — queries `scheduledReports` from Firebase RTDB to show deploy queue status, failures, and history. Accessible from the Admin sidebar via "PHMC Bot" nav item (requires dev access, rank 11+).

## Discord Bot: GCP Auto-Deploy

After making any changes to files inside `discord-bot/`, auto-upload them to the production GCP VM:

```bash
gcloud compute scp discord-bot/services/deployPMs.js phmc-bot:/opt/phmc-bot/discord-bot/services/deployPMs.js --zone=us-central1-a
gcloud compute scp discord-bot/services/forumClient.js phmc-bot:/opt/phmc-bot/discord-bot/services/forumClient.js --zone=us-central1-a
gcloud compute scp discord-bot/index.js phmc-bot:/opt/phmc-bot/discord-bot/index.js --zone=us-central1-a
# Add any other changed files here
```

Then ask the user to restart the bot via Discord #dashboard channel.

Alternatively, restart manually:
```bash
gcloud compute ssh phmc-bot --zone=us-central1-a --command="sudo systemctl kill phmc-bot --signal=SIGKILL; sleep 3; sudo systemctl start phmc-bot"
```

> **Note:** `xvfb-run` does not propagate SIGTERM cleanly, so `systemctl restart --no-block` can leave the process stuck in `deactivating (final-sigterm)`. The `kill` + `start` sequence above avoids this by sending SIGKILL directly.
>
> `.env` and `firebase-admin-key.json` contain secrets — never commit to git or auto-upload. Update them manually on the VM via `nano` or `gcloud compute scp` when needed.

## Bot File Sync Reference

When changing bot files, these are what to upload:

| File | Purpose |
|---|---|
| `index.js` | Entry point, auto-deploy starter |
| `services/forumClient.js` | Browser automation, forum login, posting |
| `services/deployPMs.js` | Standalone PM deployer (LSPD/LSSD) |
| `services/autoDeploy.js` | Background Firebase listener + queue |
| `commands/report.js` | Discord slash commands |

## Auto-Deploy System

`services/autoDeploy.js` runs as a background listener in the bot:

- **Startup:** Connects to Firebase, lists any pending reports
- **Real-time:** `on('value')` listener picks up new reports within seconds
- **Sequential queue:** Processes one report at a time — never overlaps
- **Forum routing:** Coroner emails → PM via LSPD or LSSD (based on `department` field); other reports → topics via PHMC forum
- **Retry:** Failed deploys retry up to 3 times automatically (written to Firebase as `deployStatus: deploy_failed`)
- **Timeout:** Hard abort at 10 minutes, warning webhook at 3 minutes

Queue is logged every 60s if items are still pending.

## Medical Record Reply System

PHMC forums use a **patientID** system for Medical Records (forum f=97). Each patient thread has a unique numeric ID in the title format:

```
0192 - John Doe
```

The patientID (e.g. `0192`) is the canonical identifier — unlike names, it never changes or duplicates.

### Search by Patient ID

```
https://phmc.gta.world/search.php?keywords=0192&fid[]=97&sf=firstpost
```

### Data Flow

**Web app side (useFormSaver.js):**
- The form needs a `patientID` field so staff can enter/lookup the ID
- When saving a Medical Record report, include `patientID` in the saved data

**Bot side (handleMedicalRecord in autoDeploy.js):**
1. Extract patientID from reportData.data.patientID
2. If patientID exists → search forum f=97 for the ID
3. If topic found → reply to it with the BBCode
4. If not found → error out (requires staff to create thread manually)

### BotDeployOptIn — Opt-In Modal

`src/components/Modals/BotDeployOptInModal.jsx` — a one-time opt-in dialog for Coroner staff.

- Shows when a user selects a form with `accessType === 'Coroner'`
- Only appears if `localStorage.getItem('botDeployOptIn')` is `null` (never shown before)
- On opt-in: sets localStorage to `'true'`, future saves go to `scheduledReports` with `hasdeployed: false`
- On opt-out: sets localStorage to `'false'`, saves go to normal path without deploy flag

## Forum Quirks (phpBB + Cloudflare)

### Cloudflare
- Use **HTTPS** URLs in `.env` — HTTP gets CORS-blocked on the JS challenge
- `xvfb-run` + `HEADLESS=false` passes challenges better than headless
- The `waitForCloudflare()` poll loop resolves within seconds after HTTPS fix
- 522 errors (origin timeout) are intermittent; the bot saves debug HTML and DMs the owner

### PM Flow Per Forum
- **LSPD** (`lspd.gta.world`): First submit → preview page → detect preview elements → second submit → success
- **LSSD** (`lssd.gta.world`): First submit → stays on compose page with `action=post` → check page for "sent successfully" text → success
- **PHMC** (`phmc.gta.world`): Direct submit → `viewtopic` redirect → success

### Browser Config
```javascript
// Must NOT include these flags — they break cookie handling:
// '--disable-web-security',  // breaks Cloudflare cookies
// 'bypassCSP: true'           // makes fingerprint detectable
```

## GCP VM Details

- **Name:** `phmc-bot`
- **Zone:** `us-central1-a`
- **Machine:** `e2-micro` (free tier)
- **Project:** `gtaw-forms`
- **Bot path:** `/opt/phmc-bot/discord-bot/`
- **Service:** `phmc-bot` (systemd) — if installed

## Useful Commands

```bash
# SSH into VM
gcloud compute ssh phmc-bot --zone=us-central1-a

# View bot logs
gcloud compute ssh phmc-bot --zone=us-central1-a --command="sudo journalctl -u phmc-bot -f"

# Restart bot (use kill+start — xvfb-run ignores SIGTERM)
gcloud compute ssh phmc-bot --zone=us-central1-a --command="sudo systemctl kill phmc-bot --signal=SIGKILL; sleep 3; sudo systemctl start phmc-bot"

# Check status
gcloud compute ssh phmc-bot --zone=us-central1-a --command="sudo systemctl status phmc-bot"

# Run PM deployer (standalone)
gcloud compute ssh phmc-bot --zone=us-central1-a --command="cd /opt/phmc-bot/discord-bot && xvfb-run node services/deployPMs.js"

# Build and deploy web app to GitHub Pages
npm run deploy
```
