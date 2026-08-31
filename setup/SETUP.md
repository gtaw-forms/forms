# Setup Guide

This guide walks a fresh fork of the PHMC Forms repository from zero to a
running local dev environment and, in the next docs, to production.

> **In short:** this project is three pieces — a **web app** (React + Vite +
> Firebase), a **Discord/forum bot** (Playwright automation), and a **morgue REST
> API** — plus **Firebase Cloud Functions**. You need a Firebase project, a
> Discord bot, and forum (phpBB) accounts before anything works end to end.

---

## 1. What you need before you start

| Requirement | Purpose | Where to get it |
|---|---|---|
| **Node.js 20+** | Run web app, bot, functions | https://nodejs.org |
| **Git** | Clone/fork the repo | https://git-scm.com |
| **A Firebase project** | Auth, Realtime Database, Cloud Functions, (optional) Storage | https://console.firebase.google.com |
| **A Discord application + bot token** | The bot runs as a Discord bot | https://discord.com/developers/applications |
| **phpBB forum accounts** | The bot logs into forums to post/scan | Your faction's forum (PHMC/LSPD/LSSD/SADCR/DAO) |
| **A GTA World API app** *(for OAuth login)* | Primary sign-in for the web app (Email/Password is the fallback) | GTA World developer portal — see `setup/AUTHENTICATION.md` |
| **A VPS (Linux, 2GB+ RAM)** *(for production only)* | Hosts the bot + morgue-api | Any VPS provider |

You can develop the **web app** alone with just a Firebase project. The bot +
morgue-api need the VPS for the full experience.

> ### ⚠️ Important — morgue & CCTV data are manual
>
> There is **no official GTA World API** feeding the morgue or CCTV datasets.
> They rely on **manual automation**:
> - **Morgue intake:** a Windows **hotkey PowerShell script**
>   (`setup/morgue-logger.ps1`) that a coroner runs in-game — it captures the
>   `/morgue` console output, parses it, and uploads each record to the morgue-api.
> - **CCTV:** the bot scrapes **in-game camera-log output**.
>
> A fork needs a maintainer **with in-game access** to populate these. Expect to
> adapt `setup/morgue-logger.ps1` (paths, API URL, key) to your own setup.

---

## 2. Fork & clone

1. Fork the repo on GitHub: `https://github.com/<upstream>/phmc-forms`
2. Clone your fork:

```bash
git clone https://github.com/<your-org>/phmc-forms.git
cd phmc-forms
```

3. Install dependencies:

```bash
npm install                 # web app
cd functions && npm install # Cloud Functions
cd ../discord-bot && npm install  # bot + morgue-api
```

---

## 3. Set up your Firebase project

1. Create a project in the [Firebase Console](https://console.firebase.google.com).
2. Enable **Realtime Database** (create it in `europe-west1` or your preferred region).
3. Enable **Authentication** — at minimum **Email/Password**; GTA World OAuth is
   handled by a Cloud Function + your GTA World app.
4. Enable **Cloud Functions** (billing on the Blaze plan is required for
   functions).
5. From **Project settings → Your apps → Web app**, copy the Firebase web config
   (apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId,
   appId).

---

## 4. Configure the web app

Create a `.env` file in the **repo root** with your Firebase web config:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Optional:

```bash
VITE_SENTRY_AUTH_TOKEN=   # Sentry source-map upload
SENTRY_AUTH_TOKEN=        # Sentry CLI token
```

> The exact Firebase web config values come from the Firebase console. There is
> no committed `.env.example` for the web app — `vite.config.js` reads these
> `VITE_*` vars at build time.

### Run the web app locally

```bash
npm run dev
```

- Vite serves on **http://localhost:3000** (configured in `vite.config.js`) at
  the **`/forms/`** base path and opens a browser automatically.
- You can log in via Email/Password or (if configured) GTA World OAuth.
- Some data (forms, factions) is read from RTDB — make sure your database rules
  allow reads for authenticated users (see `setup/DEPLOYMENT.md`).

> **Known local-dev quirk:** on `localhost` the RTDB rules may deny unauthenticated
> reads. Log in first, and if data still won't load, check the browser console —
> a `Permission denied` error means your rules are too strict.

---

## 5. Configure the Discord bot + morgue-api

Change into the bot directory and copy the example env:

```bash
cd discord-bot
cp .env.example .env
```

Fill in at least the core values (see `setup/CONFIGURATION.md` for the full
reference):

```bash
DISCORD_BOT_TOKEN=...                 # your Discord bot token
GUILD_ID=...                          # the guild the bot runs in
BOT_OWNER_ID=...                      # your Discord user ID
FIREBASE_DATABASE_URL=...             # same databaseURL as the web app
FIREBASE_ADMIN_KEY_PATH=../firebase-admin-key.json  # service-account key
FORUM_BASE_URL=...                    # PHMC forum base URL
FORUM_USERNAME=...
FORUM_PASSWORD=...
```

### Service-account key

Download a **service-account key** for your Firebase project (Project settings →
Service accounts → Generate new private key) and save it. Put it at the path in
`FIREBASE_ADMIN_KEY_PATH` (default `../firebase-admin-key.json`, i.e. in the repo
root). **Never commit this file** — it is in `.gitignore`.

### Run the bot locally (dry-run)

```bash
cd discord-bot
npm start            # runs index.js (bot) 
node morgue-api.js   # runs the morgue API separately
```

The bot has extensive `DRY_RUN` / `DRY_POST` / `DRY_REPLY` flags in the `.env`
that make it log what it *would* post instead of actually posting. Use these
while testing. See `discord-bot/README.md` for details.

---

## 6. Run the Cloud Functions locally

```bash
cd functions
firebase login
firebase emulators:start
```

The functions rely on the `MORGUE_API_KEY` / `MORGUE_API_URL` env vars (in
`functions/.env`) to reach your morgue-api, and on a `PHMC_CONFIG` secret for
Discord webhook URLs (see `setup/CONFIGURATION.md`).

---

## 7. Next steps

- Understand how the pieces fit: `setup/ARCHITECTURE.md`
- Configure every variable: `setup/CONFIGURATION.md`
- Set up login: `setup/AUTHENTICATION.md`
- Deploy to production: `setup/DEPLOYMENT.md`
- Learn the database layout: `setup/DATA-MODEL.md`
- Add your own forms / bot behavior: `setup/CUSTOMIZATION.md`
- When something breaks: `setup/TROUBLESHOOTING.md`