# Architecture

PHMC Forms is a role-play toolset for medical/emergency factions on **GTA World**.
It generates phpBB **BBCode** reports from web forms and auto-posts them to
faction forums. Four components cooperate:

```
┌─────────────────────────────┐        ┌──────────────────────────────────┐
│         WEB APP             │        │          FIREBASE                │
│  React + Vite + Firebase    │◄──────►│  Realtime Database (RTDB)        │
│  (gh-pages / Vite dev)      │        │  Auth · Cloud Functions         │
└────────────┬────────────────┘        └──────────┬───────────────────────┘
             │  httpsCallable                      │  Admin SDK
             ▼                                     ▼
┌─────────────────────────────┐        ┌──────────────────────────────────┐
│      CLOUD FUNCTIONS        │        │        VPS (Linux + pm2)         │
│  OAuth · webhook proxy      │◄──────►│  phmc-bot (Discord.js + Playwright│
│  morgue proxy · report-BBCode│       │  morgue-api (Express, :3001)     │
└─────────────────────────────┘        │  local data files + sessions    │
                                       └──────────────────────────────────┘
```

---

## 1. The web app (`src/`)

- **React + Vite** SPA served at the **`/forms/`** base path (gh-pages or Vite dev
  on port 3000).
- Reads **form templates, factions, and LSCC data** from RTDB, cached in
  IndexedDB/localStorage keyed by a version stamp (`formsDataVersion`).
- **`src/components/ui-new/`** is the current UI: form renderer
  (`PrototypeFieldRenderer`), Morgue browser, patient search, autopsy request
  modal, admin panels.
- **`src/hooks/useBbcodeGenerator.js`** renders a selected form template by
  substituting `{{placeholder}}` fields → BBCode. Signatures / uploaded images
  become `[img]` tags.
- **`src/hooks/useFormSaver.js`** writes the report + BBCode when a user saves:
  - consented, deploy-tracked forms → **`scheduledReports`** (+`scheduledReportsBBCode`)
  - everything else → **`newSavedReports`** (BBCode now stored on the VPS via the
    `saveReportBBCode` Cloud Function)
- **Morgue records** are fetched through a Cloud Function that proxies the VPS
  `morgue-api` (the 4,000+ record dataset is kept off RTDB).
- **Auth** is GTA World OAuth (handled by a Cloud Function) or Email/Password,
  with role-based access.

## 2. The Discord bot (`discord-bot/`, runs on the VPS as `phmc-bot`)

- **Discord.js** command/event handling + **Playwright** (a single shared Chrome
  instance) to automate phpBB forums (Cloudflare challenges, logins, posting).
- **Deploy pipeline** (`services/deployQueue.js` → `services/deployExecutor.js`):
  watches `scheduledReports`, then posts each queued report to the correct forum
  (Medical Records f=97, Autopsy Requests f=265, PMs for coroner emails, agency
  forums for LSPD/LSSD/SADCR/DAO via isolated browser sessions).
- **Autopsy monitor** (`services/autopsyRequestMonitor.js`): scans f=265 for
  autopsy requests, runs a Medical Examiner rotation, assigns cases, and replies.
- **Death record pipeline** (`services/deathRecordDraftScan.js`): detects CK
  reports (via the slim `unprocessedCKs` index), matches them against the morgue
  cache, and creates review drafts + forum/Facebrowser posts.
- **Dashboard** (`services/dashboardManager.js`): a Discord embed with live
  forum/morgue status + VPS resource stats.
- **Logging** writes per-restart files in `logs/` (bot-*.log, api-*.log).

## 3. The morgue REST API (`discord-bot/morgue-api.js`, runs on the VPS as `morgue-api`)

- **Express** on port **3001**, key-protected (`x-api-key`).
- Serves the morgue dataset from a **local JSON mirror** (`morgue-data.json`) —
  the web app reads it through a Cloud Function, so RTDB isn't hit for the big
  dataset. The mirror is kept in sync by the intake tooling (`setup/morgue-logger.ps1`).
- Also serves: agency credentials, dev EMS protocols, the saved-report BBCode
  store (`/api/report-bbcode`), and CCTV data.
- Has an **IP-ban layer** that blocks scanner patterns; requests carrying a valid
  `x-api-key` are exempt (so the Cloud Function is never blocked by its shared
  Google egress IP).

> ### ⚠️ Manual automation — no official GTA World API
>
> **Morgue intake and CCTV data are not fed by any official GTA World API.** They
> are maintained by **manual automation**:
>
> - **Morgue intake:** an in-game hotkey PowerShell script
>   (`setup/morgue-logger.ps1`) captures the **in-game morgue console output**
>   (the `/morgue`/case text as the coroner reads it in-game), parses it into
>   record fields, and uploads each record to the morgue-api
>   (`POST /api/morgue/records/:caseId`). The API writes RTDB
>   `morgue-records/<caseId>` and the VPS mirror.
> - **CCTV:** the bot's CCTV panel scrapes **in-game camera-log output** (a
>   scheduled/manual scrape on the VPS), not an external API.
>
> This means a fork needs a **human maintainer with in-game access** (a coroner
> running the hotkey script while reading morgue output, or someone pulling CCTV
> logs) to keep these datasets populated. There is no "just connect to the
> server" source.

## 4. Cloud Functions (`functions/`)

Firebase v2 callables, region **europe-west2**:

| Function | Purpose |
|---|---|
| `processGtaWorldAuth` / `validateGtaWorldToken` | GTA World OAuth flow |
| `sendWebhookProxy` | Forwards Discord webhook payloads (log/error/auth) |
| `getMorgueRecords` | Proxies the VPS morgue-api for the web app |
| `saveReportBBCode` / `getReportBBCode` | Store/read saved-report BBCode on the VPS |
| `getProtocolsDev` | Dev EMS protocols from the VPS |
| `getPublicConfig`, `triggerFactionSync`, `getAgencyCredentials`, `getCctvData`, … | Assorted |

Functions read `MORGUE_API_KEY` / `MORGUE_API_URL` from `functions/.env` and
Discord webhook URLs from the `PHMC_CONFIG` secret.

---

## Data flow — one saved report

1. User fills a form → `generateBBCode()` produces the BBCode.
2. `useFormSaver` writes the report to RTDB:
   - **deploy-tracked + consent** → `scheduledReports/<author>/<key>`
     (+`scheduledReportsBBCode`)
   - **otherwise** → `newSavedReports/<author>/<key>` (BBCode → VPS)
3. The bot's `deployQueue` listener sees the new `scheduledReports` entry and
   gates it on consent → `deployExecutor` opens the forum via Playwright and
   posts the BBCode to the correct topic/forum/PM.
4. The bot marks `deployStatus` and logs the outcome.

## Data flow — morgue records

1. A coroner runs the **in-game hotkey script** (`setup/morgue-logger.ps1`) while
   reading morgue output — there is no official API to pull from.
2. The script parses each case into fields and uploads it to the morgue-api
   (`POST /api/morgue/records/:caseId`), which writes RTDB `morgue-records/<caseId>`
   and the VPS mirror (`morgue-data.json`).
3. The web app calls `getMorgueRecords` (Cloud Function) → VPS `/api/morgue`.
4. The bot reads the **local mirror file** (not RTDB) for death-record matching.

---

## Key design decisions

- **Keep big datasets off RTDB** (morgue records, report BBCode) to control
  RTDB egress and growth. The VPS serves them from local files.
- **One shared Playwright browser** for all forum automation (avoids
  Cloudflare/phpBB session conflicts and browser churn).
- **Slim RTDB indexes** (e.g. `unprocessedCKs`) instead of full-node listeners
  keep RTDB reads small.
- **Backups on clear** — cleared form drafts are recoverable for 48h via a
  per-form restore stack in localStorage.