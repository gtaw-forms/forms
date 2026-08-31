# Deployment

This project has four deploy targets. Each is independent.

| Target | What | Command / method |
|---|---|---|
| Web app | React SPA | `npm run deploy` (build → gh-pages) |
| Discord bot | `phmc-bot` on the VPS | SCP files → `pm2 restart phmc-bot` |
| Morgue API | `morgue-api` on the VPS | SCP `morgue-api.js` → `pm2 restart morgue-api` |
| Cloud Functions | Firebase callables | `firebase deploy --only functions` |

---

## 1. Web app → GitHub Pages

```bash
npm run build
node tools/deploy.js
# or just:
npm run deploy
```

`tools/deploy.js`:
1. Builds the app (`npm run build`).
2. Stamps `window.__PHMC_BUILD__` into `build/index.html` (for build-version
   diagnostics on saved reports).
3. Commits + **force-pushes** the `build/` folder to the **`gh-pages`** branch.

The app is served at the **`/forms/`** base path (from `vite.config.js`). Your
repo settings must have **Pages → Deploy from branch: `gh-pages`**.

> gh-pages is best-effort only. Any member with push access can deploy; there is
> no CI gate.

---

## 2. VPS provisioning (bot + morgue-api)

Recommended: a Linux VPS with **2GB+ RAM** (the bot runs a full Chrome instance).
Add swap if you're tight on RAM.

### Base setup

```bash
# as root
apt update && apt install -y nodejs npm git
npm install -g pm2
node --version   # 20+
```

### Deploy the bot code

```bash
# from your local repo
scp -i ~/.ssh/key discord-bot/* root@<vps>:/opt/phmc-bot/discord-bot/
scp -i ~/.ssh/key discord-bot/services/* root@<vps>:/opt/phmc-bot/discord-bot/services/
scp -i ~/.ssh/key discord-bot/commands/* root@<vps>:/opt/phmc-bot/discord-bot/commands/
```

On the VPS:

```bash
cd /opt/phmc-bot/discord-bot
npm install --omit=dev      # playwright-extra, discord.js, firebase-admin, express
npx playwright install chromium  # one-time: downloads the browser
pm2 start index.js --name phmc-bot
pm2 start morgue-api.js --name morgue-api
pm2 save && pm2 startup     # survives reboots
```

### Update a file

```bash
scp -i ~/.ssh/key discord-bot/services/deployQueue.js root@<vps>:/opt/phmc-bot/discord-bot/services/
ssh root@<vps> "pm2 restart phmc-bot"
```

> **Rule:** upload first, restart after. Editing locally does nothing to the
> deployed bot until you SCP the file and restart the process.

### The morgue dataset mirror

The morgue-api serves from `morgue-data.json` (next to `morgue-api.js`), not
RTDB. There is **no official GTA World API** — records are captured **manually
in-game** by a coroner running the hotkey script:

```powershell
# from a Windows machine with the repo + Firebase admin key
powershell -File setup/morgue-logger.ps1   # in-game hotkey → parse → POST to morgue-api
```

The script captures the `/morgue` in-game console output via a global hotkey,
parses each case, and uploads it to the morgue-api (which writes RTDB +
`morgue-data.json`). Adapt the script's paths / API URL / key for your fork.

After a sync, `pm2 restart morgue-api`.

---

## 3. Cloud Functions

```bash
cd functions
npm install
firebase login
firebase deploy --only functions
```

**Known gotcha:** the source-analysis step can time out (`User code failed to
load … Timeout after 10000`) because the module initializes Firebase at import.
Set these in your shell first:

```bash
export GCLOUD_PROJECT=<project-id>
export FIREBASE_CONFIG='{"projectId":"<project-id>","databaseURL":"https://<project-id>-default-rtdb.europe-west1.firebasedatabase.app/"}'
firebase deploy --only functions
```

To deploy a single function: `firebase deploy --only functions:getMorgueRecords`.

### Realtime Database rules

Rules are in `functions/database.rules.json`. Deploy them separately:

```bash
firebase deploy --only database
```

> Default posture: authenticated reads/writes at the root, with public-read
> exceptions for `appMetadata`, `forms`, `verified_locations`, `lscc`,
> `presence`, `analytics`. The bot's admin SDK bypasses rules.

---

## 4. Environment for production

- Web `.env` (Firebase web config) → `VITE_FIREBASE_*`
- Bot `.env` → `discord-bot/.env` (see `setup/CONFIGURATION.md`)
- Functions `.env` → `functions/.env` (`MORGUE_API_URL`, `MORGUE_API_KEY`)
- Secret → `firebase functions:secrets:set PHMC_CONFIG`
- Service account → `firebase-admin-key.json` (gitignored)

---

## Rolling-back / quick recovery

- **Web:** deploy an older `gh-pages` commit, or force-push a known-good `build/`.
- **Bot:** `pm2 logs phmc-bot --lines 200` to diagnose; restart clears most
  transient states. Per-restart logs are in `logs/bot-*.log`.
- **Morgue API:** logs in `logs/api-*.log`; the ban-state file is
  `data/ban-state.json` (delete banned entries + restart to unblock an IP).