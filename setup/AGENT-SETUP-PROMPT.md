# Agent Prompt — Set Up the Forked PHMC Forms Repo

Copy the prompt below and hand it to your AI agent (Claude, Copilot, etc.) when
you want it to configure and run a fresh fork of this repository. It is written
to be **descriptive**: the agent reads the docs first, explains every step as it
goes, asks for the credentials it cannot invent, and never touches production
until you confirm.

---

```
You are setting up a fresh fork of the PHMC Forms repository (a GTA World
medical/emergency role-play toolset: a React + Vite web app that generates phpBB
BBCode forms, a Discord/forum bot driven by Playwright, a key-protected morgue
REST API, and Firebase Cloud Functions).

ESCALATION — CONTACT THE MAINTAINER
  If you hit an unexpected error you cannot recover from, or you are confused
  or unsure what to do at any point, STOP and contact the maintainer,
  **Fr0styDev on Discord**, for assistance. Do not guess your way past an
  error you don't understand, and do not leave the setup in a half-broken
  state. Summarize what you've done, the error, and what you tried, and wait
  for guidance.

OBJECTIVE
  Configure this fork so it runs locally and is ready to deploy. Work
  methodically, explain every step in plain language as you do it, and surface
  exactly what you need from me (credentials, URLs, choices) rather than
  guessing or fabricating values.

MANDATORY FIRST STEP — READ THE DOCUMENTATION
  Before touching anything, read these files in order and use them as your
  source of truth:
    1. setup/SETUP.md            — prerequisites, fork/install, run locally
    2. setup/ARCHITECTURE.md     — how the four components fit + data flow
    3. setup/CONFIGURATION.md    — every env var (web / bot / functions)
    4. setup/AUTHENTICATION.md   — GTA World OAuth + Email/Password login
    5. setup/SECRETS.md          — GCP Secrets Manager schema (PHMC_CONFIG, GTAW tokens)
    6. setup/DEPLOYMENT.md       — gh-pages, VPS + pm2, functions, rules
    7. setup/DATA-MODEL.md       — RTDB layout
    8. setup/SCHEMA.md           — field-level schema
    9. setup/CUSTOMIZATION.md    — forms, commands, forum accounts
   10. setup/TROUBLESHOOTING.md  — common issues + fixes
  Also skim README.md and discord-bot/README.md. Summarize back to me the
  architecture and the setup steps you plan to follow BEFORE executing.

WHAT I WILL PROVIDE (ask for these if I haven't)
  - A Firebase project id + the web config values (apiKey, authDomain,
    databaseURL, projectId, storageBucket, messagingSenderId, appId)
  - A Firebase service-account JSON (bot admin access)
  - A Discord application + bot token, a guild id, and your Discord user id
  - A GTA World API app: Client ID + Client Secret (+ the redirect URI to register)
  - Forum accounts/passwords (PHMC, and LSPD/LSSD/SADCR/DAO if used)
  - A VPS host + SSH key (only needed for the deploy phase)
  - Any existing secret values (PHMC_CONFIG JSON, API keys) if I have them

EXECUTION PLAN (work through these phases; report after each)
  Phase 1 — Inventory & confirm
    - Confirm node/npm versions, the repo state, and that I understand the
      four components.
    - Produce a checklist of every value I need from you (see above) and ask
      for the missing ones up front.
  Phase 2 — Install
    - `npm install` in the repo root, `functions/`, and `discord-bot/`.
    - Note: the bot's browser is installed at deploy time
      (`npx playwright install chromium`) — not needed for a code-only setup.
  Phase 3 — Configure (never commit secrets)
    - Web: create `.env` (root) from the Firebase web config (VITE_FIREBASE_*).
    - Bot: copy `discord-bot/.env.example` → `discord-bot/.env` and fill values.
    - Functions: copy `functions/.env.example` → `functions/.env`
      (MORGUE_API_URL must include the port).
    - Service account: place `firebase-admin-key.json` per
      `FIREBASE_ADMIN_KEY_PATH`, confirm it is gitignored.
    - Secrets: if deploying, set up the PHMC_CONFIG Cloud Secret per
      setup/SECRETS.md and the GTAW OAuth credentials per setup/AUTHENTICATION.md.
  Phase 4 — Run locally & verify
    - Web: `npm run dev` → confirm it loads at http://localhost:3000/forms/ and
      that login works (Email/Password at minimum).
    - Bot: start with DRY_RUN=true / DRY_POST=true so nothing real posts; confirm
      it connects to Discord and Firebase without errors.
    - Functions: run the emulator if practical; otherwise verify config.
  Phase 5 — Deploy (ONLY if I explicitly ask you to deploy)
    - Web → gh-pages via `npm run deploy`.
    - Functions → `firebase deploy --only functions`; remember the
      FIREBASE_CONFIG / GCLOUD_PROJECT env workaround in setup/DEPLOYMENT.md or
      the analysis times out.
    - Bot + morgue-api → VPS via SCP + pm2, then `pm2 restart phmc-bot` /
      `pm2 restart morgue-api`.
    - Rules → `firebase deploy --only database`.
  Phase 6 — Final report
    - What works, what still needs my input, and the exact commands/URLs to use.

BEHAVIOR RULES
  - Be descriptive: narrate each step, the file you're editing, why, and the
    value you're setting (mask secrets in any output you show me).
  - NEVER commit, push, or print secrets (`.env*`, `firebase-admin-key.json`,
    the PHMC_CONFIG JSON, tokens). All are gitignored — leave them that way.
  - Ask before anything destructive or production-facing (real forum posts,
    real deploys, deleting data). Default to dry-run modes.
  - If the docs and reality disagree, tell me — do not silently pick one.
  - IMPORTANT CONTEXT: morgue intake + CCTV data are populated by manual,
    in-game automation (a PowerShell hotkey script) — there is NO official GTA
    World API for them. Explain this to me so I understand those datasets start
    empty until someone runs the intake tooling.
  - When you hit an error, diagnose from setup/TROUBLESHOOTING.md first, then
    investigate code, then report the root cause + fix before moving on.
  - Keep me informed with a short progress summary after every phase and a
    clear "what do you need from me next?" at each stopping point.
```

---

## Notes for the person handing this to an agent

- The prompt assumes the agent already has the repo cloned (it is the fork
  being set up). If you'd rather the agent do the fork/clone too, prepend:
  `Fork the upstream repo on GitHub, then clone your fork locally.`
- Keep secrets available to paste when the agent asks — it will not (and should
  not) invent them.
- For a first run, tell the agent to **stop after Phase 4** (local + dry-run)
  and report back before any deploy.