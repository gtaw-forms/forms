# GCP Secrets Schema

The Cloud Functions read configuration from **Google Cloud Secrets Manager**.
There is **one consolidated JSON secret** (`PHMC_CONFIG`) plus two optional GTAW
token secrets.

> `getConfigValue(key)` reads the key from the `PHMC_CONFIG` JSON first, then
> falls back to a plain `process.env[key]` — so every key below can also be set
> as a normal env var in `functions/.env` if you prefer.

---

## 1. `PHMC_CONFIG` — the consolidated JSON secret

Created with:

```bash
cd functions
firebase functions:secrets:set PHMC_CONFIG
```

Declared on the callables that need it (`secrets: ["PHMC_CONFIG"]`). The runtime
injects it as `process.env.PHMC_CONFIG` (a JSON string).

### Schema

```json
{
  "admin":   "https://discord.com/api/webhooks/...",
  "auth":    "https://discord.com/api/webhooks/...",
  "forms":   "https://discord.com/api/webhooks/...",
  "error":   "https://discord.com/api/webhooks/...",
  "cctv_dev": "https://discord.com/api/webhooks/...",
  "cctv_leo": "https://discord.com/api/webhooks/...",
  "coroner": "https://discord.com/api/webhooks/...",
  "phmc":    "https://discord.com/api/webhooks/...",
  "dev":     "https://discord.com/api/webhooks/...",

  "DISCORD_WEBHOOK_FUNCTIONS": "https://discord.com/api/webhooks/...",
  "ADMIN_ACTION_WEBHOOK_URL":  "https://discord.com/api/webhooks/...",

  "GTAWORLD_CLIENT_ID":     "your-gta-world-client-id",
  "GTAWORLD_CLIENT_SECRET": "your-gta-world-client-secret",

  "IMGUR_CLIENT_ID":   "...",
  "IMGUR_ACCESS_TOKEN": "...",
  "IMGBB_API_KEY":     "..."
}
```

| Key | Type | Used by | Purpose |
|---|---|---|---|
| `admin`, `auth`, `forms`, `error`, `cctv_dev`, `cctv_leo`, `coroner`, `phmc`, `dev` | string (webhook URL) | `sendWebhookProxy` | Discord webhook per webhook-type (the `WEBHOOK_URL_MAP`) |
| `DISCORD_WEBHOOK_FUNCTIONS` | string | `sendWebhook` fallback | Default webhook when no type URL is passed |
| `ADMIN_ACTION_WEBHOOK_URL` | string | `sendWebhook` fallback | Secondary default webhook |
| `GTAWORLD_CLIENT_ID` | string | `processGtaWorldAuth` / `validateGtaWorldToken` / `getPublicConfig` | GTA World OAuth — **public** id (returned to the client) |
| `GTAWORLD_CLIENT_SECRET` | string | OAuth token exchange | GTA World OAuth — **private**, never leaves the function |
| `IMGUR_CLIENT_ID` | string | media proxy (`media.js`) | Imgur uploads |
| `IMGUR_ACCESS_TOKEN` | string | media proxy | Imgur uploads (user token) |
| `IMGBB_API_KEY` | string | media proxy | ImgBB uploads (alternative host) |

---

## 2. GTAW persistent tokens (optional)

Two **separate** secrets for persistent GTA World API access (background/maintenance
calls as the app, not per-user OAuth):

- `GTAWORLD_PERSISTENT_TOKEN`
- `GTAWORLD_REFRESH_TOKEN`

Provisioned after a one-time token exchange — the helper prints the exact
commands:

```bash
firebase functions:secrets:set GTAWORLD_PERSISTENT_TOKEN --data="<access_token>"
firebase functions:secrets:set GTAWORLD_REFRESH_TOKEN  --data="<refresh_token>"
```

These are optional and only needed if you enable the background GTAW API feature.

---

## 3. Non-secret env for functions

Not secrets — plain env in `functions/.env` (see `setup/CONFIGURATION.md`):

| Variable | Purpose |
|---|---|
| `MORGUE_API_URL` | VPS morgue-api base URL (**must include the port**) |
| `MORGUE_API_KEY` | VPS morgue-api read key |
| `MORGUE_WRITE_API_KEY` | VPS morgue-api write key (only if a function needs PUT/DELETE) |

---

## Rotation / hygiene

- Never put the `PHMC_CONFIG` JSON (or any secret value) in the repo, commit
  messages, or the public docs — they live only in Secrets Manager.
- To rotate: `firebase functions:secrets:access PHMC_CONFIG` (download) → update →
  `firebase functions:secrets:set PHMC_CONFIG` → redeploy functions.