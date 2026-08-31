# PHMC Forms

Toolset for Pillbox Hill Medical Center (PHMC) on GTA World — a BBCode form
generation web app, a Discord/forum automation bot, and Firebase Cloud
Functions. Built with React + Vite + Firebase, with a Playwright-driven Discord
bot that auto-deploys reports to phpBB forums.

Developed with agentic coding; changes are manually reviewed by a developer and
tested to sufficient standards.

## Documentation

Forking or deploying this project? Start here:

- **[Setup Guide](setup/SETUP.md)** — prerequisites, fork, install, configure, run locally
- **[Agent Setup Prompt](setup/AGENT-SETUP-PROMPT.md)** — a ready-to-paste prompt for an AI agent to configure + run the fork
- **[Architecture](setup/ARCHITECTURE.md)** — how the web app, bot, morgue-api, and Cloud Functions fit together
- **[Configuration](setup/CONFIGURATION.md)** — every env var across web / bot / functions
- **[Secrets](setup/SECRETS.md)** — the GCP Secrets Manager schema (`PHMC_CONFIG` + GTAW tokens)
- **[Authentication](setup/AUTHENTICATION.md)** — GTA World OAuth + Email/Password login setup
- **[Deployment](setup/DEPLOYMENT.md)** — VPS + pm2, gh-pages, functions, rules
- **[Data Model](setup/DATA-MODEL.md)** — the Realtime Database layout
- **[Schema](setup/SCHEMA.md)** — field-level reference for the key RTDB nodes
- **[Customization](setup/CUSTOMIZATION.md)** — adding forms, commands, forum accounts
- **[Troubleshooting](setup/TROUBLESHOOTING.md)** — common issues and fixes

## Repo Layout

```
src/                 # Web app (React + Vite + Firebase)
├── components/
│   ├── ui-new/          # Current UI (prototype): form renderer, Morgue browser, patient search
│   ├── form-handler/    # Legacy form renderer (kept as reference)
│   ├── Admin/           # Admin panel: morgue manager, forms manager, webhooks, factions, LSCC, CCTV, dev console
│   ├── Auth/            # GTA World OAuth + email sign-in
│   ├── Modals/          # Map, bug report, autopsy, saved reports, deploy consent
│   └── UI/              # Sidebar nav, notifications, business card
├── contexts/         # Auth, data, notification providers
├── hooks/            # Form saving, BBCode generation, report loading, consent
├── services/         # Firebase function proxies, auth helpers
├── utils/            # Morgue parser/BBCode, staging paths, identity helpers
└── firebase.js       # Firebase app initialization
discord-bot/         # Discord bot + morgue REST API + Playwright forum automation (see its README)
functions/           # Firebase Cloud Functions (auth, webhooks, maintenance)
tools/               # Deploy + maintenance scripts
```

## Features

- **Dynamic BBCode forms** — Firebase-hosted form templates rendered into BBCode for medical, coroner, autopsy, and report workflows, with patient-name autocomplete
- **Auto-deploy to forums** — the bot picks up queued reports and posts/PMs them to the PHMC / LSPD / LSSD / SADCR / DAO forums
- **Death Record pipeline** — CK detection, morgue matching (with OOC-name validation), review drafts, forum + Facebrowser auto-posting
- **Morgue** — record browser, intake BBCode generation (casings redacted in the UI), and a key-protected morgue REST API
- **CCTV panel** — camera log scraper + viewer in the admin panel
- **Admin panel** — morgue manager, forms manager, webhooks, faction data, LSCC protocols, CK viewer, developer console
- **GTA World OAuth** — role-based access control backed by Firebase Auth
- **Webhooks + Sentry** — Discord broadcast on saves/admin actions, error diagnostics

## Getting Started (web app)

**Prerequisites:** Node.js 20+, a Firebase project (Realtime Database, Auth, Functions), and a GTA World API app for OAuth.

```bash
git clone https://github.com/cross/phmc-forms.git
cd phmc-forms
npm install
```

**Environment:** create `.env` in the repo root with your Firebase web config:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

There is no committed `.env.example` for the web app — create your own. The bot's environment variables are documented in `discord-bot/.env.example`.

**Run / build / deploy:**

```bash
npm run dev           # Vite dev server on http://localhost:3000 (opens automatically)
npm run build         # production build → build/
npm run deploy        # build + force-push build/ to the gh-pages branch
```

`tools/deploy.js` (also wired as `npm run deploy`) builds the app, then commits
and force-pushes the `build/` folder to the `gh-pages` branch, which serves the
app at its `/forms/` base path.

## Cloud Functions

Firebase Functions handle GTA World OAuth, Discord webhook proxying, and
scheduled maintenance:

```bash
cd functions && npm install
firebase deploy --only functions
```

Deploying the Realtime Database rules is a separate step: `firebase deploy --only database`.

## Firebase Database Rules

RTDB requires auth at the root — reads and writes need a signed-in user (GTA
World OAuth or email):

```json
{ "rules": { ".read": "auth != null", ".write": "auth != null" } }
```

Public-read exceptions exist for `appMetadata`, `forms`, `verified_locations`,
`lscc`, `presence`, and `analytics`. Cloud Functions use the Admin SDK and
bypass these rules. See `functions/database.rules.json`.
