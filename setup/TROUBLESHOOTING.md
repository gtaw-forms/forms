# Troubleshooting

Common issues and how to diagnose them.

---

## Web app

### "Permission denied" when loading data (local dev)

The RTDB rules require authentication. Log in (Email/Password or GTAW OAuth)
first. If data still won't load:

- Open the browser console and check the exact error path.
- Confirm your rules allow `auth != null` reads at the root and the public
  exceptions listed in `setup/DEPLOYMENT.md`.
- Clear stale caches: `localStorage` keys `firebaseCache_*`, `form_progression_*`.

### Forms are showing OLD templates / my changes don't appear

Clients cache form templates keyed by `appMetadata/formsDataVersion`. After
editing a template you must **bump that version** (see `setup/DATA-MODEL.md`).
If a specific browser still shows stale data, clear `firebaseCache_forms*` in
localStorage and reload.

### A form was cleared and the work is gone

Clears now back up the draft for 48h. In the form, use the **"Restore progress"**
dropdown at the top to recover a cleared draft (including pasted-image URLs).
Backups auto-delete after 48h or after a successful save.

### "Use employee signature" does nothing / signature blank in BBCode

- Confirm the form template actually contains `{{phmcSignature}}` (not every
  form has it — DMEC-coroner forms don't).
- The signature URL must be a direct `https://….(png|jpg|gif|webp)` image URL.
- After approve, the toggle row should show the image; then **re-generate** the
  BBCode (Preview).

### Error-webhook spam in Discord

If `sendWebhookProxy` errors appear repeatedly:
- Check the function logs for `Status: …` — a **400** usually means an embed
  field exceeded 1024 chars (fixed by clamping in `logging.js`). A **429** means
  Discord rate-limited the webhook — the app dedups errors, so wait it out.
- The webhook URL may be dead/revoked (404) — check the `PHMC_CONFIG` secret.

---

## Discord bot

### Bot online but nothing happens

- `pm2 logs phmc-bot --lines 200` — look for startup errors.
- Confirm the bot `.env` has `FIREBASE_DATABASE_URL` + a valid service-account
  key (`FIREBASE_ADMIN_KEY_PATH`).
- Confirm the deploy queue node exists: `scheduledReports` should get entries
  when a user saves a consented, deploy-tracked form.

### Reports stuck in queue

- Check the report's `deployStatus` / `hasdeployed`.
- Re-queue: set `hasdeployed:false` + `deployStatus:'pending'`, then restart the
  bot — its cold-load treats it as pending.
- If `blocked_empty_employee`: the report had a blank employee identity; fix the
  data (or the OAuth mapping) and re-queue.

### "7 chrome processes / 2 browsers" on the dashboard

One Playwright browser spawns multiple OS processes (main/renderer/gpu/zygote/
network/utility). `chrome ×N (main 1 …)` = **one** browser. A second `main`
usually means a browser was orphaned by an abrupt crash; the bot reaps orphans
on startup. `pm2 restart phmc-bot` also cleans up.

### Cloudflare "Just a moment" pages / login failures

The bot waits for Cloudflare challenges automatically. If it can't get past:
- Confirm the stored session (`forum-session.json`) is valid (log in once
  manually with `HEADLESS=false`).
- Check forum credentials in `.env`.

### Morgue API returns 403 Forbidden

The morgue-api bans suspicious IPs (persisted in `data/ban-state.json`).
- Requests with a valid `x-api-key` are exempt from bans.
- To unblock a wrongfully banned IP: delete its entry from `ban-state.json`,
  then `pm2 restart morgue-api`.

---

## Cloud Functions / deploy

### `firebase deploy --only functions` → "User code failed to load … Timeout"

The module initializes Firebase at import and the source-analysis sandbox lacks
config. Set these in your shell before deploying:

```bash
export GCLOUD_PROJECT=<project-id>
export FIREBASE_CONFIG='{"projectId":"<project-id>","databaseURL":"https://<project-id>-default-rtdb.europe-west1.firebasedatabase.app/"}'
firebase deploy --only functions
```

### `sendWebhookProxy` → `functions/internal`

Check the function logs for the underlying cause:
- `Error sending webhook. Status: 400` → the payload embed was rejected
  (oversized field / bad structure) — fix the embed builder on the caller.
- `Error sending webhook. Status: 429` → Discord rate limit — retry later.
- `Webhook URL not configured` → the `PHMC_CONFIG` secret is missing the key.

### gh-pages 404s

The app is served at `/forms/`. If you get 404s, make sure Pages serves the
`gh-pages` branch and the repo's Pages base is the root. `vite.config.js` sets
`base: '/forms/'` — keep it consistent with how you host.

---

## RTDB egress / performance

- Big datasets are kept off RTDB (morgue records → VPS mirror, report BBCode →
  VPS store). If egress is high, look for full-node listeners or admin tools
  reading whole nodes (`newSavedReports`, `morgue-records`).
- The bot uses slim indexes (`unprocessedCKs`) instead of full-node
  subscriptions for passive detection.
- `appMetadata/*DataVersion` bumps force clients to refetch — don't bump them
  casually (each bump re-downloads that segment for every client).