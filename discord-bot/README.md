# PHMC Discord Bot

Discord bot + Playwright automation for Pillbox Hill Medical Center's forum-based
form system. Monitors Firebase for queued reports, deploys them to phpBB forums
via automated browser sessions, and manages the autopsy request pipeline.

## Quick Start

```bash
# 1. Install dependencies
cd discord-bot
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Discord bot token, Firebase URL, forum credentials

# 3. Start the bot
node index.js

# 4. Start the morgue REST API (separate process)
node morgue-api.js
```

**Requirements:** Node 20+, Chromium (installed via Playwright — `npx playwright install chromium`)

---

## Environment Variables

See [.env.example](.env.example) for the complete reference. Key groups:

| Group | Vars | Purpose |
|---|---|---|
| Discord | `DISCORD_BOT_TOKEN`, `GUILD_ID`, `BOT_LOG_CHANNEL_ID`, etc. | Bot identity, log channel, dashboard |
| Firebase | `FIREBASE_DATABASE_URL`, `FIREBASE_ADMIN_KEY_PATH` | RTDB for report queue, consent, autopsy data |
| PHMC Forum | `FORUM_BASE_URL`, `FORUM_USERNAME`, `FORUM_PASSWORD` | Primary forum (topic/reply posting) |
| Agency Forums | `FORUM_LSPD_*`, `FORUM_LSSD_*`, `FORUM_SADCR_*`, `FORUM_DAO_*` | Cross-post/PM destination forums |
| Dry-run flags | `DRY_RUN`, `DRY_POST`, `DRY_REPLY`, `AUTOPSY_DRY_RUN`, etc. | Per-type dry-run (all default true) |

---

## Architecture

### Service Overview

```
index.js  (entry point — registers commands, starts services)
│
├── autoDeploy.js        ★ Main orchestrator — listens to Firebase, routes reports
│   ├── deployQueue.js       Manages the sequential deploy queue + maintenance mode
│   ├── deployExecutor.js    Runs a single deploy: consent check → action → status
│   ├── deployConsent.js     Checks user-consent/<uid>/<formId> before deploying
│   ├── deployStatus.js      Updates Firebase deployStatus + markReportComplete
│   ├── deployRetry.js       Retry queue manager (3 retries, 6h intervals)
│   │
│   ├── deployTopic.js       Posts new forum topics (PHMC main forum)
│   ├── deployPM.js          Sends Private Messages (LSPD/LSSD/SADCR/DAO)
│   ├── deployPMs.js         Multi-forum PM dispatcher (resolves forum per department)
│   ├── deployMedicalRecord.js  Replies to patient threads with notes/reports
│   ├── deployAutopsyReply.js   Case Management reply + completion workflow
│   ├── deployCoronerEmail.js   Auto-generated coroner email PMs
│   ├── deployLssd.js / deployLspd.js  Cross-post to agency forums
│   │
│   └── deployInteraction.js  Interactive topic picker (multi-match disambiguation)
│
├── autopsyRequestMonitor.js   Scans f=265 every 60s, parses BBCode, stores in Firebase
├── autopsyRotation.js         Round-robin ME assignment (LOA-aware)
├── deathRecordDraft.js        CK listener → draft → Discord approval → post
├── cctvScheduler.js           Runs CCTV fetch every 6 hours
├── factionRosterSync.js       Syncs faction member list from forum
├── dashoardManager.js         Live system status Discord embed
├── systemMonitor.js           60-minute health checks (CPU/RAM/disk)
│
└── forumClient.js           ⭐ Playwright browser automation layer
    ├── login / session management
    ├── postTopic / replyToTopic
    ├── sendPM / searchForum / searchCaseManagement
    └── getTopicPoster / resolveCaseTopic
```

### Deploy Flow (end-to-end)

```
User saves report in web app
       │
       ▼
Firebase: scheduledReports/<uid>/<key> created
       │
       ▼
autoDeploy.js listener fires
       │
       ▼
deployQueue.js — enqueue report (2.5 min defer window)
       │
       ▼
deployQueue.js — sequential gate (one deploy at a time)
       │
       ▼
deployExecutor.js — runs the deploy:
  │
  ├─ deployConsent.js — re-check user-consent/<uid>/<formId>
  │     (consent may have changed during the 2.5 min window)
  │
  ├─ Route by form type:
  │   ├─ coroner_email → deployPM.js       (PM to LSPD/LSSD/SADCR/DAO)
  │   ├─ medical forms → deployMedicalRecord.js  (reply to patient thread)
  │   ├─ autopsy       → deployAutopsyReply.js   (Case Mgmt reply + completion)
  │   └─ other         → deployTopic.js          (new forum topic)
  │
  └─ deployStatus.js — update Firebase deployStatus + markReportComplete
       │
       ▼
If failed: deployRetry.js — up to 3 retries (6h intervals),
           re-checks consent each time
```

### Autopsy Completion Flow

```
Autopsy report is deployed → handleAutopsyReply() runs
       │
       ▼
1. Case Management reply  ── PHMC f=266 (completion notice)
2. LSSD crosspost          ── Dedicated isolated browser client
3. LSPD crosspost          ── Dedicated isolated browser client
4. DM to requester         ── Dedicated isolated browser client (must login first)
       │
       ▼
On failure: retryFailedCompletionSteps() on next bot startup
```

---

## Firebase Realtime Database Schema

### Root Paths

```
scheduledReports/              ← Deploy queue (written by web app)
  └─ <uid>/
       └─ <reportKey>/
            ├─ formId: string
            ├─ formName: string
            ├─ data: { ... }         ── Form field values
            ├─ deployStatus: string  ── "pending" | "queued" | "searching" | "replying" | "deployed" | "error" | "retrying"
            ├─ deployMessage: string ── Human-readable status
            └─ createdAt: timestamp

scheduledReportsBBCode/        ← BBCode content (stored separately to keep scheduledReports lean)
  └─ <uid>/
       └─ <reportKey>/
            ├─ bbCode: string
            └─ title: string

newSavedReports/              ← Drafts (saved but NOT queued for deploy)
  └─ <uid>/
       └─ <reportKey>/
            ├─ formId, formName, data, ...
            └─ bbCode, title

user-consent/                 ← Per-form-type deploy consent
  └─ <uid>/
       └─ <formId>: boolean   ── true=allow deploy, false=block, absent=default(allow)

appMetadata/                  ← Version tracking, data stamps
  ├─ formsDataVersion: timestamp
  ├─ formsDataVersion_staging: timestamp
  ├─ morgueDataVersion: timestamp
  └─ botMaintenance: boolean  ── Maintenance mode flag

retry-queue/                  ← Failed deploys awaiting retry
  └─ <uid>/
       └─ <reportKey>/
            ├─ retryCount: number
            ├─ nextRetryAt: timestamp
            ├─ lastError: string
            └─ ...
```

### Autopsy System Paths

```
autopsy-requested/            ← Central autopsy tracking
  └─ <topicId>/
       ├─ topicId: number           ── f=265 request topic ID
       ├─ name: string              ── Decedent name (IC)
       ├─ oocName: string           ── Decedent OOC name
       ├─ faction: string           ── Requesting faction code
       ├─ requesterName: string     ── Requester's IC name
       ├─ detectedAt: timestamp
       ├─ parsed: { ... }           ── Structured BBCode parse result
       ├─ caseTopicId: number       ── f=266 case topic (created at assignment)
       ├─ caseTitle: string
       ├─ caseUrl: string
       ├─ lssdRequestTopicId: number
       ├─ lspdTopicId: number
       ├─ assignedTo: string        ── ME name
       ├─ wasMatch: boolean
       ├─ completedAt: timestamp    ── Set when autopsy report is deployed
       ├─ completedBbCode: string   ── The posted BBCode
       ├─ completionSteps/          ── Two-phase tracking
       │    └─ <stepName>/
       │         ├─ status: "attempting" | "completed" | "failed"
       │         ├─ startedAt / updatedAt: timestamp
       │         └─ detail: string
       └─ forumPoster: string       ── Forum username who created the request

autopsy-requests/
  ├─ rotation/
  │    ├─ list: [string]            ── Ordered ME list for round-robin
  │    ├─ position: number          ── Current rotation position
  │    └─ lastUpdated: timestamp
  ├─ assignments/
  │    └─ <username>/
  │         └─ lastAssigned: timestamp
  └─ loa/
       └─ <username>: boolean       ── true = on leave (skip in rotation)

deathRecordDrafts/            ← CK death record draft tracking
  └─ <reportKey>/
       ├─ messageId: string         ── Discord message ID
       ├─ status: string            ── "pending" | "approved" | "rejected"
       └─ postedAt: timestamp
```

### Dashoard & Monitoring Paths

```
monitoring/                   ← System health data (published by systemMonitor.js)
  ├─ memory: { usage, free, total }
  ├─ cpu: { load, cores }
  ├─ disk: { usage, free, total }
  ├─ uptime: number
  └─ lastChecked: timestamp

dashboardConfig/              ← Dashboard embed state
  └─ <channelId>/
       ├─ messageId: string        ── Discord message ID to edit
       └─ lastUpdated: timestamp

morgue-records/               ← Morgue intake records
  └─ <caseId>/
       ├─ name, sex, location, timeOfDeath
       ├─ causeOfDeath, adminNote
       ├─ physicalDescription, tattoos
       ├─ estimatedAge, height, weight
       ├─ bac, narcotics, dnaProfile
       ├─ findings: [ { type, part, dist }, ... ]
       ├─ bullets: [ { type, id }, ... ]
       └─ firebaseKey: string
```

---

## Slash Commands

| Command | Description |
|---|---|
| `/force-autopsy-check` | Manually trigger f=265 scan |
| `/sync-autopsy-requests` | Backfill parsed data for existing f=265 entries |
| `/autopsy-loa <username>` | Toggle leave-of-absence for an ME |
| `/assign-autopsy <topicId> <me>` | Manually assign autopsy to an ME |
| `/reassign-autopsy <topicId> <me>` | Reassign an autopsy to a different ME |
| `/fix-autopsy <search>` | Diagnostic/repair tool for stuck autopsy entries |
| `/force-autopsy-complete <search>` | Mark an autopsy as completed manually |
| `/force-autopsy-send <search>` | Force-send a completed autopsy BBCode |
| `/rotation-set <me-list>` | Set the ME rotation order |
| `/sync-autopsy-poster` | Backfill forum poster usernames for existing entries |
| `/autopsy-skip <search>` | Remove an entry from the autopsy queue |
| `/report-skip <uid> <key>` | Remove a scheduled report from the queue |
| `/report-retry [uid]` | Retry all failed scheduled reports |
| `/morgue <search>` | Look up morgue records |
| `/group-morgue-check` | Check faction sync status |

---

## PM2 Commands

```bash
pm2 status                              # List all processes
pm2 restart phmc-bot                    # Restart the bot
pm2 restart morgue-api                  # Restart the morgue API
pm2 logs phmc-bot --lines 50 --out      # View bot stdout logs
pm2 logs phmc-bot --lines 50 --err      # View bot stderr logs
pm2 logs morgue-api --lines 50          # View morgue API logs
pm2 logs                                # Combined real-time log tail
```

## File Transfer

```bash
# Upload a single bot service file
scp -i ~/.ssh/phmc_vps discord-bot/services/file.js \
    root@88.208.243.254:/opt/phmc-bot/discord-bot/services/file.js

# After uploads, restart the affected process
ssh -i ~/.ssh/phmc_vps root@88.208.243.254 \
    "cd /opt/phmc-bot/discord-bot && pm2 restart phmc-bot"
```

---

## Important Notes

- **No emojis in code** — Unicode emojis break the Edit tool on Windows (UTF-16 re-encoding). Use `[OK]`, `[WARN]`, `[ERR]`, `[DONE]` instead.
- **Isolated clients** — The bot uses `createIsolatedClient()` for cross-forum operations (LSSD, LSPD, DM). Each isolated client has its own session file and must call `login()` before use — a fresh context has no cookies.
- **Dry-run by default** — All deploy types default to `true` for their dry-run flag. Set the flag to `false` in `.env` only after confirming the flow works.
- **Consent re-check** — Consent is checked at deploy-time, not just queue-time. Opting out during the 2.5-minute defer window will cancel the deploy.
- **forumClient.js** is the most complex file (~1900 lines). It manages a shared Playwright browser with per-instance isolated contexts. Every public method acquires a mutex lock — only one forum operation runs at a time.
