# Configuration Reference

Every environment variable across the three runtime components. Copy the relevant
blocks into your own `.env` files.

---

## Web app — repo-root `.env`

Read by Vite at build time (prefix `VITE_`).

| Variable | Required | Description |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | ✅ | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | `<project>.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | ✅ | RTDB URL, e.g. `https://<project>-default-rtdb.europe-west1.firebasedatabase.app/` |
| `VITE_FIREBASE_PROJECT_ID` | ✅ | Firebase project id |
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ | `<project>.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ | From Firebase console |
| `VITE_FIREBASE_APP_ID` | ✅ | From Firebase console |
| `VITE_SENTRY_AUTH_TOKEN` | optional | Sentry source-map upload token |
| `VITE_ROLLBAR_ACCESS_TOKEN` | optional | Rollbar token (legacy) |
| `SENTRY_AUTH_TOKEN` | optional | Sentry CLI token |
| `VITE_DEV_WEBHOOK` | optional | Dev-only Discord webhook used by a few dev paths (business card, form-save logging) |

> There is no committed `.env.example` for the web app — create `.env` yourself.

---

## Discord bot — `discord-bot/.env`

Full reference from `discord-bot/.env.example`.

### Core

| Variable | Description |
|---|---|
| `DISCORD_BOT_TOKEN` | Discord bot token (discord.com/developers/applications) |
| `DISCORD_TOKEN` | Optional: separate token used for REST-API DMs to the owner (`forumClient` `notifyOwner`) |
| `GUILD_ID` | Guild the bot operates in |
| `BOT_OWNER_ID` | Your Discord user ID (owner-gated commands) |
| `BOT_LOG_CHANNEL_ID` | Channel for general bot logs |
| `DASHBOARD_CHANNEL_ID` | Channel for the live status dashboard embed |
| `DEATH_RECORD_DRAFT_CHANNEL_ID` | Channel for death-record review drafts |
| `FIREBASE_DATABASE_URL` | Same RTDB URL as the web app |
| `FIREBASE_ADMIN_KEY_PATH` | Path to the service-account JSON (default `../firebase-admin-key.json`) |

### Forums (phpBB)

| Variable | Description |
|---|---|
| `FORUM_BASE_URL` | PHMC forum base URL |
| `FORUM_USERNAME` / `FORUM_PASSWORD` | PHMC forum bot account |
| `FORUM_LSPD_URL` / `FORUM_LSPD_USERNAME` / `FORUM_LSPD_PASSWORD` | LSPD forum bot account |
| `FORUM_LSSD_URL` / `FORUM_LSSD_USERNAME` / `FORUM_LSSD_PASSWORD` | LSSD forum bot account |
| `FORUM_SADCR_URL` / `FORUM_SADCR_USERNAME` / `FORUM_SADCR_PASSWORD` | SADCR forum bot account |
| `FORUM_DAO_URL` / `FORUM_DAO_USERNAME` / `FORUM_DAO_PASSWORD` | DAO forum bot account |

Each agency account is stored as an isolated Playwright session
(`forum-session-<name>.json`).

### Safety / dry-run flags

Set any of these to `true` to prevent real posts:

| Variable | Effect |
|---|---|
| `DRY_RUN` | Master dry-run switch |
| `DRY_POST` / `DRY_REPLY` | Dry-run topic posts / replies |
| `AUTOPSY_DRY_RUN` / `MEDICAL_RECORD_DRY_RUN` | Dry-run for those pipelines |
| `CORONER_EMAIL_DRY_RUN` / `AUTOPSY_LSSD_DRY_RUN` | Same for coroner emails / LSSD |
| `CORONER_EMAIL_ALLOWED` | Comma-separated forum URLs whitelisted for **live** coroner email sends (safety gate) |
| `MEDICAL_RECORD_ALLOWED` | Comma-separated forum URLs whitelisted for **live** medical-record sends (safety gate) |
| `HEADLESS` | `false` to show the browser window (debug) |
| `DEBUG` | `true` for verbose browser/page logging |

### Autopsy monitor

| Variable | Description |
|---|---|
| `AUTOPSY_MONITOR_INTERVAL` | ms between f=265 scans (default 15 min) |
| `AUTOPSY_DEV_TEST` / `AUTOPSY_DEV_TEST_ME` | Dev-test autopsy override (assigns a fixed ME) |
| `AUTOPSY_OVERDUE_HOURS` / `_CK` / `_PK` | Overdue thresholds for the dashboard |
| `RECOVERY_HEARTBEAT_INTERVAL_MS` | Recovery/heartbeat sweep cadence in ms (default 600000 / 10 min) |

### Morgue API (used by `morgue-api.js`)

| Variable | Description |
|---|---|
| `MORGUE_API_PORT` | HTTP port (default 3001) |
| `MORGUE_API_KEYS` | Comma-separated **read** keys |
| `MORGUE_WRITE_API_KEYS` | Comma-separated **write** keys (PUT/DELETE) |
| `MORGUE_API_LOG_WEBHOOK` | Discord webhook for API activity logs |
| `MORGUE_API_TRUSTED_IPS` | IPs exempt from ban logic (loopback always trusted) |
| `MORGUE_BAN_THRESHOLD` | Suspicious requests before a permanent IP ban (default 2) |

### Death-record / Facebrowser

| Variable | Description |
|---|---|
| `FACE_API_KEY` / `FACE_PAGE_ID` | Facebrowser posting credentials |
| `FACE_DRAFT_CHANNEL_ID` / `FACE_DRY_RUN` | Draft channel + dry-run |
| `FACE_PUBLISH_DELAY_HOURS` | Delay before publishing a face draft (default 48) |

### Webhooks

| Variable | Description |
|---|---|
| `DEPLOY_WEBHOOK_URL` | Discord webhook for deploy notifications |
| `ASSIGNMENT_WEBHOOK_URL` | Discord webhook for autopsy-assignment pings (tags the assigned ME) |
| `FORWARD_WEBHOOK_URL` | Webhook that autopsy assignments are auto-forwarded to |
| `AUTOPSY_REQUESTER_WEBHOOK_LSPD/LSSD/SADCR/DAO` | Webhooks for autopsy requester pings per agency |
| `AUTOPSY_REQUESTER_WEBHOOK_TEST_MODE` / `_TEST_URL` | Test-mode override for requester webhooks |
| `FORWARD_WEBHOOK_URL` | Auto-forward target for autopsy assignment notifications |
| `AGH_API_URL` / `AGH_USER` / `AGH_PASSWORD` | AdGuard Home metrics (dashboard) |

---

## Cloud Functions — `functions/.env`

There is a `functions/.env.example` — copy it to `.env`. Copied by the Firebase
CLI into the deployed runtime.

| Variable | Description |
|---|---|
| `MORGUE_API_URL` | Base URL of your morgue-api (default `http://88.208.243.254`) — **must include the port** your API listens on, e.g. `http://<vps>:3001` |
| `MORGUE_API_KEY` | A valid morgue-api **read** key (functions proxy reads to the VPS) |
| `MORGUE_WRITE_API_KEY` | A valid morgue-api **write** key (only if a function needs PUT/DELETE) |

### Secrets

All Cloud Function secrets (the `PHMC_CONFIG` schema + the optional GTAW token
secrets) are documented in **[setup/SECRETS.md](SECRETS.md)**. In short:

`sendWebhookProxy` resolves Discord webhook URLs from the **`PHMC_CONFIG`**
Cloud Secret. It is a JSON object with keys matching the webhook map, e.g.:

```json
{
  "admin":  "https://discord.com/api/webhooks/.../...",
  "auth":   "https://discord.com/api/webhooks/.../...",
  "forms":  "https://discord.com/api/webhooks/.../...",
  "error":  "https://discord.com/api/webhooks/.../...",
  "cctv_dev": "...",
  "cctv_leo": "...",
  "coroner": "...",
  "phmc":   "...",
  "dev":    "..."
}
```

Create it with:

```bash
cd functions
firebase functions:secrets:set PHMC_CONFIG
```

---

## Firebase service-account key

The **bot** uses a service-account JSON (path from `FIREBASE_ADMIN_KEY_PATH`) to
talk to RTDB with admin privileges. Download it from Firebase Console →
Project settings → Service accounts → **Generate new private key**. Save it at
the configured path and **never commit it** (it is gitignored).