# PHMC Morgue API — proof of concept

The canonical, merged developer reference is now
**[`../DEVELOPER-API.md`](../DEVELOPER-API.md)**. It covers authentication and
key scopes plus both endpoint families — Morgue Records and LEO Reports — with
response schemas, audit rules and examples.

This folder keeps the runnable quick-start:

```bash
# zero-dependency Node 18+ script: health -> version -> list -> search ->
# get-one -> 404 -> 401
MORGUE_API_KEY=pmc_morgue_xxx node poc.mjs

# or read the key straight out of the VPS .env
node poc.mjs --env /opt/phmc-bot/discord-bot/.env

# against another host
node poc.mjs --base http://88.208.243.254
```

- **Base URL:** `http://88.208.243.254` (on the VPS itself: `http://localhost:3001`)
- **Auth:** `x-api-key` header on every call except health/version
- **Morgue read key:** `MORGUE_API_KEYS` (all read routes) or a morgue-only
  `MORGUE_REPORTS_API_KEYS` key (morgue routes only)
- **LEO key:** `LEO_REPORTS_API_KEYS`; add a second segment to lock it to one
  department (e.g. `lspd-drdb-leo:lspd:pmc_leo_xxx`)

A LEO-only key gets `401` on `/api/morgue*`; use a morgue read key for the
calls in `poc.mjs`.
