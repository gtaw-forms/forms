# OpenChamber VPS Edits (discord-bot)

Edits made from the VPS emergency OpenChamber instance that must be migrated
to the canonical PC repo. Full diffs live in `/root/HOTFIX-LOG.md`.
Migration = copy the listed files from ubuntu `100.84.161.69` over Tailscale,
then tick the checkbox. Only tick after the PC repo actually has the change.

## Pending

(none)

## Migrated

- [x] **2026-09-10 — Morgue API hourly poll metrics (noise reduction)**
  - Files: `morgue-api.js`, `.env.example`, `changelog.md`
  - What: routine `GET /api/morgue?limit=1` loopback polls roll up into one
    hourly `[MORGUE-API] Poll metrics (last 1h)` Discord summary instead of
    one `1 call(s)` message every ~10 min. New opt var
    `MORGUE_POLL_METRICS_INTERVAL_MS` (default 1h).
  - VPS: live (`pm2 restart morgue-api`, health ok).
  - PC: ported 2026-09-10 (poll-rollup hunk + env doc + changelog entry).
