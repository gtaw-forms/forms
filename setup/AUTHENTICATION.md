# Authentication

Two sign-in methods: **GTA World OAuth** (primary, role-based) and
**Email/Password** (fallback). Auth is handled by Firebase Auth + a Cloud
Function that talks to the GTA World UCP.

```
User clicks "Login"
   │
   ▼
Web app → https://ucp.gta.world/oauth/authorize
   (client_id = your public GTAW Client ID, redirect_uri = your callback)
   │  user approves
   ▼
Redirect back to  <your-origin>/#/auth/gta/callback  (hash route)
   │  with a ?code=
   ▼
processGtaWorldAuth (Cloud Function) exchanges the code at
   https://ucp.gta.world/oauth/token  using GTAWORLD_CLIENT_ID + _SECRET
   ▼
validateGtaWorldToken → links the session to Firebase Auth
   ▼
App loads your character/faction/rank and applies access rules
```

---

## 1. Create a GTA World API application

1. Go to the **GTA World developer portal** (UCP) and create an application.
2. Note your **Client ID** (public) and **Client Secret** (private — keep it
   server-side).

## 2. Configure the OAuth credentials

Both values go into the **`PHMC_CONFIG`** Cloud Secret (same secret as the
Discord webhook URLs — see `CONFIGURATION.md`):

```json
{
  "GTAWORLD_CLIENT_ID": "your-public-client-id",
  "GTAWORLD_CLIENT_SECRET": "your-private-client-secret",
  "...": "existing keys (webhooks, etc.)"
}
```

Set it with:

```bash
cd functions
firebase functions:secrets:set PHMC_CONFIG
```

- The **Client ID** is also returned to the web app by `getPublicConfig` (the
  browser only ever sees the ID, never the secret).
- If either credential is missing, `processGtaWorldAuth` throws
  `Server OAuth misconfiguration` — check `PHMC_CONFIG`.

## 3. Register the redirect URI

Register the callback in your GTAW application's redirect-URI allowlist. The
app builds it from `window.location.origin` + `/#/auth/gta/callback`:

| Environment | Redirect URI |
|---|---|
| Production (gh-pages) | `https://<your-host>/forms/#/auth/gta/callback` |
| Local dev | `http://localhost:3000/#/auth/gta/callback` |

> The `#` matters — it is a hash route, not a server path. Register the exact
> string (with the hash) or the provider will reject the redirect
> (`invalid redirect_uri`).

## 4. Enable Firebase Authentication

1. Firebase Console → Authentication → Sign-in method.
2. Enable **Email/Password** (the fallback login).
3. GTA World OAuth has no native Firebase provider — it arrives through the
   Cloud Function and links a Firebase auth session.

## 5. Role-based access

After auth, the app resolves your **character + faction + rank** from the
OAuth payload and the faction roster (`factions/<id>/members`):

- **Faction members** get the employee identity used in reports
  (`phmcEmployee` / `coronerEmployee`, resolved to `Rank Name (SN: Badge)`).
- **Access type** (`forms/<key>.accessType`) gates which forms are visible
  (PHMC staff vs Coroner vs guest-visible).
- Non-employees / guests see a restricted set (some forms are hidden).

> The roster record key is the **character id** — always match on the roster
> key, never a stored `characterId` field (a UCP **account** id can leak in and
> break credential resolution, e.g. Sarah Bell's `50230` is her account id, her
> character is `156863`).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Server OAuth misconfiguration` | `GTAWORLD_CLIENT_ID`/`_SECRET` missing from `PHMC_CONFIG` |
| Redirect rejected (`invalid redirect_uri`) | The exact hash callback isn't allowlisted in your GTAW app |
| Login succeeds but faction/rank blank | Roster lookup missed — check `factions/<id>/members/<charId>` + OAuth character id |
| Email login works, OAuth doesn't | Firebase Email/Password enabled but OAuth config incomplete (steps 2–3) |