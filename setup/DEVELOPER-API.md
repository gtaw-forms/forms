# PHMC Developer API — Morgue Records & LEO Reports

One host, one auth header, two read-only endpoint families:

- **Morgue Records** — decedent intake records (cause of death, wounds, toxicology, casings, …).
- **LEO Reports** — saved reports explicitly flagged for law-enforcement forwarding (`ReportRequested === true`).

This is the integration guide for the `morgue-api` service.

> Verified live on 2026-10-24 against `morgue-api` on the VPS. Where this guide
> and a live response disagree, the live response wins — update this file.

---

## 1. Base URL and transport

```
http://88.208.243.254
```

Public traffic enters on port **80** (nginx) and is proxied to the service on
loopback. Port `3001` is not internet-facing. Responses are JSON.

Two endpoints need **no key**:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness + maintenance state |
| `GET` | `/api/version` | Current `morgueDataVersion` |

> Use these exact paths. A **keyless** request to any other `/api/*` path is
> treated as scanning and permanently bans the caller's IP. `/api/`, `/health`
> and `:3001` are not health endpoints.

**Transport:** this host speaks plain HTTP. Treat the key like a password and
call only from a trusted server. Never embed it in a client application.

---

## 2. Authentication and key scopes

Send the key in the **`x-api-key` header** on every request except health/version:

```http
x-api-key: pmc_leo_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`?key=` in the query string is **not** supported (returns `401`).

Your integration receives **one key and its scope** from the PHMC API
maintainers. The env-var names below are server-side key classes — you do not
set them yourself. Keep the key on your server; never ship it to a browser.

Keys are grouped by scope:

| Env var | What the key can call | Typical holder |
|---|---|---|
| `MORGUE_API_KEYS` | Every read route: morgue, LEO, rosters, forms, saved reports, … | Internal tools and services |
| `MORGUE_WRITE_API_KEYS` | The above **plus** `PUT`/`DELETE` write routes | Internal maintenance |
| `MORGUE_REPORTS_API_KEYS` | **`/api/morgue*` GET routes only** | External morgue consumers |
| `LEO_REPORTS_API_KEYS` | **`/api/reports/leo*` only**, optionally locked to one department | External LEO report consumers |

**A scoped key is rejected with `401` on every route outside its family** — a
LEO key cannot read morgue records/agency credentials, and a morgue-only key
cannot read LEO reports or rosters. Internal read/write keys work on both
families.

Keys may be **labeled** for attribution:

```
LEO_REPORTS_API_KEYS="acme-dashboard:pmc_leo_xxx,dev-sandbox:pmc_leo_yyy"
```

Send only the part **after the colon**. The label appears in logs/activity as
`key_acme-dashboard`; unlabeled keys appear as `key_<sha256 fingerprint>`. The
label is attribution, not a permission boundary — the env var decides scope.

The forwarded-reports key is locked to LSPD: the list only returns `lspd`
reports (`LSPD` and `Los Santos Police Department` both normalize to `lspd`),
`?agency=` is ignored, and opening another department's report returns `404`.

### Direct-caller rules

- **Do not send `X-Real-IP` or `X-Forwarded-For`.** Those headers are trusted
  only from loopback/nginx; a direct caller sending either is treated as
  `SPOOF-forwarded-header` and can be banned.
- **Do not send `x-phmc-requester-*` headers.** They are reserved. Direct calls
  are attributed by key label + source IP. The optional `viewer`/`characterName`
  values in LEO calls are display hints, never auth.

---

## 3. Rate limits and errors

**60 requests per minute per key** (in-memory, shared by every client using
that key). Exceeding it returns `429`; the window resets after 60 s. On `429`,
wait at least 60 s before retrying — the response has no `Retry-After` header.

| Status | Body | When |
|---|---|---|
| `400` | `{ "success": false, "error": "…" }` | Bad parameters/identity |
| `401` | `{ "error": "Unauthorized", "message": "Missing API key. …" }` | No key |
| `401` | `{ "error": "Unauthorized", "message": "Invalid API key." }` | Unknown key, or a LEO key on a non-LEO route |
| `404` | `{ "success": false, "error": "Not found", … }` | Unknown case/report |
| `429` | `{ "error": "Too many requests", "message": "Rate limit of 60 requests per minute exceeded." }` | Per-key limit |
| `500` | `{ "success": false, "error": "…" }` | Server-side failure |

---

## 4. Morgue Records

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/morgue` | List/search records |
| `GET` | `/api/morgue/:caseIdOrRecordKey` | One record |
| `GET` | `/api/morgue/drug` | Records with narcotics |

### 4.1 List / search

```http
GET /api/morgue?q=<search>&limit=<n>
```

| Param | Notes |
|---|---|
| `q` | Word-tolerant search over name, caseId and location (e.g. `autospy` matches `Autopsy`). Omit to list everything. |
| `limit` | Default and maximum `10000`. |

Records are sorted by `lastUpdated`, newest first. `count` is this page,
`total` is every match.

```bash
curl -H "x-api-key: $MORGUE_API_KEY" \
  "http://88.208.243.254/api/morgue?q=Ryan%20Kennedy&limit=1"
```

```json
{
  "success": true,
  "count": 1,
  "total": 8,
  "query": "Ryan Kennedy",
  "morgueDataVersion": 1792282429308,
  "records": [
    {
      "name": "Unknown (( Ryan Kennedy ))",
      "sex": "Male",
      "identified": "No",
      "location": "SASP, LSC",
      "timeOfDeath": "Wednesday, 14 October 2026 21:56:00",
      "timeOfDeathISO": "2026-10-14T21:56:00",
      "causeOfDeath": "Stabbing",
      "dnaProfile": "N/A",
      "estimatedAge": "Unknown",
      "physicalDescription": "None recorded.",
      "tattoos": "None",
      "bac": "0.00%",
      "narcotics": "N/A",
      "bullets": [],
      "findings": [
        { "time": "21:56:00", "type": "Stab wound", "part": "Left Upper Arm", "dist": "-" },
        { "time": "21:56:00", "type": "Stab wound", "part": "Chest", "dist": "-" }
      ],
      "lastUpdated": 1792282428984,
      "source": "Manual-Entry",
      "caseId": "85282",
      "firebaseKey": "85282"
    }
  ]
}
```

Use `morgueDataVersion` (also on `/api/version`) to skip refetches when nothing
changed.

### 4.2 One record

```http
GET /api/morgue/:caseIdOrRecordKey
```

```json
{ "success": true, "record": { "caseId": "85282", "name": "Unknown (( Ryan Kennedy ))", "...": "..." } }
```

`404` if neither the case id nor the record key (`firebaseKey`) matches.

### 4.3 Records with narcotics

```http
GET /api/morgue/drug?q=<search>&limit=<n>
```

Same shape as 4.1; `limit` defaults to `100`, max `500`. Only records with
non-empty narcotics data are returned.

### 4.4 Record schema

| Field | Type | Notes |
|---|---|---|
| `caseId` / `firebaseKey` | string | Numeric case number |
| `name` | string | `Unknown (( OOC Name ))` for unidentified bodies |
| `sex` | string | `Male` / `Female` |
| `identified` | string | `Yes` / `No` |
| `location` | string | e.g. `SASP, LSC` |
| `timeOfDeath` | string | Display form: `Wednesday, 14 October 2026 21:56:00` |
| `timeOfDeathISO` | string | `2026-10-14T21:56:00` (use for date matching) |
| `causeOfDeath` | string | Free text, e.g. `Gunshot Wounds` |
| `dnaProfile` | string | Hex profile or `N/A` |
| `estimatedAge` | string | e.g. `21 to 23`, `Unknown` |
| `physicalDescription` / `tattoos` | string | Free text |
| `bac` | string | e.g. `0.00%` |
| `narcotics` | string | e.g. `Cocaine, Heroin`, or `N/A` |
| `bullets[]` | `{ type, id }[]` | `id` is the striation id; `type` the caliber |
| `findings[]` | `{ time, type, part, dist }[]` | One row per wound |
| `lastUpdated` | number | Epoch ms |
| `source` | string | Entry source, e.g. `Manual-Entry` |

`findings[].type` is the wound type (`Gunshot wound`, `Stab wound`,
`Blunt force trauma — Fist`, …), not the weapon. `dist` is a range string
(`9.6m`) or `-`.

> `bullets[].id` is OOC-sensitive (striation id). Do not republish it.

---

## 5. LEO Reports

A **forwarded report** is a saved form where the requester explicitly asked for
it to be forwarded (`ReportRequested === true`; for Mass Fatality, a non-empty
`requestingOfficer`). The list endpoint only returns forwarded reports.

Every open is **audited**. Call the audit endpoints when you serve reports so
your integration's views are attributable.

| Method | Path | Purpose | Audited |
|---|---|---|---|
| `GET` | `/api/reports/leo` | List forwarded reports | No |
| `GET` | `/api/reports/leo/:author/:key` | Open one report | Yes (live) |
| `POST` | `/api/reports/leo/:author/:key/view` | Log a cached open | Yes |
| `POST` | `/api/reports/leo/access` | Log a panel open | Yes |

### 5.1 List forwarded reports

```http
GET /api/reports/leo?limit=<n>&offset=<n>&agency=<key>&q=<search>
```

| Param | Notes |
|---|---|
| `limit` | Default `50`, max `100` |
| `offset` | Default `0` |
| `agency` | Ignored — the forwarded-reports key is LSPD-locked. |
| `q` | Case-insensitive search over title, author, author name, department, requesting officer, decedent |

```bash
curl -H "x-api-key: $LEO_API_KEY" \
  "http://88.208.243.254/api/reports/leo?agency=lspd&limit=10"
```

```json
{
  "success": true,
  "reports": [
    {
      "key": "coroner-report-1a2b3c",
      "author": "GTAW_Dev",
      "authorName": "Sarah Bell",
      "formId": "coroner-report",
      "formName": "Coroner Report",
      "title": "coroner-report-1a2b3c",
      "timestamp": 1792282428984,
      "updatedAt": 1792282429308,
      "department": "lspd",
      "requestingOfficer": "E. Quinones",
      "decedentName": "Unknown (( Ryan Kennedy ))",
      "forwarded": true,
      "hasBbCode": true
    }
  ],
  "total": 42,
  "limit": 10,
  "offset": 0,
  "agency": "lspd",
  "agencyLocked": "lspd",
  "cachedWindow": 50
}
```

`agencyLocked` is the key's fixed department. It is `null` only for an unscoped
LEO key; the forwarded-reports key always reports `lspd`, even if the caller
sent another `?agency=`.

`total` is the number of matching forwarded reports; page with `limit`/`offset`.
`cachedWindow` is informational (the feeder's cache size), not a result limit.
The list's `department` is normalized; the report's `data.department` keeps the
stored value.

The list itself does **not** write an audit line. Log a panel open (5.4) when a
user opens your report viewer.

### 5.2 Read one report (live — audited)

```http
GET /api/reports/leo/:author/:key?viewer=<displayName>
```

URL-encode both path segments. The response contains the saved report and its
stored BBCode:

```json
{
  "success": true,
  "report": {
    "formId": "coroner-report",
    "formName": "Coroner Report",
    "originalKey": "coroner-report-20261014-001",
    "authorName": "Jane Doe",
    "timestamp": 1792282428984,
    "data": {
      "ReportRequested": true,
      "typeOfDeath": "PK",
      "mannerOfDeath": "Homicide",
      "probableCauseOfDeath": "Gunshot Wounds",
      "decedentName": "John Doe",
      "decedentOOC": "John_Doe_OOC",
      "dateTime": "2026-10-14 21:56",
      "pronouncedTimeOfDeath": "21:56",
      "placeOfDeath": "Davis - Davis Ave, Los Santos",
      "placeOfDeath_display": "Davis Ave",
      "placeOfDeath_isFromMap": true,
      "department": "LSPD",
      "requestingOfficer": "E. Quinones",
      "requestingOfficerDepartment": "LSPD",
      "synopsis": "Officers responded to a report of shots fired and found the decedent unresponsive.",
      "additionalPhotos": ["https://example.com/photo-1.jpg"],
      "scenePhotosBBCode": ["[img]https://example.com/scene-1.jpg[/img]"],
      "coronerEmployee": "Jane Doe",
      "coronerFirstName": "Jane",
      "coronerLastName": "Doe",
      "coronerRank": "Coroner II",
      "coronerBadge": "4412",
      "coronerDiscord": "jdoe",
      "coronerPHNumber": "55501",
      "appBuild": "assets/index-abc123.js"
    },
    "hasdeployed": true,
    "deployStatus": "deployed",
    "deployType": "topic",
    "deployTopicId": "12345",
    "deployUrl": "https://phmc.gta.world/viewtopic.php?t=12345",
    "deployMessage": "Posted to autopsy thread.",
    "deployedAt": "2026-10-14T22:05:00.000Z",
    "deployedBy": "phmc-bot",
    "processed": true,
    "isCK": false,
    "legacy": false,
    "gtawCharacterId": "1234",
    "gtawCharacterName": "Jane Doe",
    "gtawUsername": "jdoe",
    "gtawSyncTimestamp": "2026-10-14T21:57:00.000Z",
    "progressChannelId": "123456789012345678",
    "progressMessageId": "123456789012345678"
  },
  "bbCode": "[divbox=white][b]CORONER REPORT[/b][/divbox]"
}
```

Notes:
- `data` is the saved form's raw field map. **Its keys vary by `formId`** —
  coroner, mass-fatality and other forwarded forms expose different fields.
  Treat every field as optional; missing or empty means it was not captured.
- `deploy*`, `gtaw*`, `progress*`, `processed`, `hasdeployed`, `isCK` and
  `legacy` are report-pipeline metadata; consumers can ignore them.
- `timestamp` is epoch milliseconds; `deployedAt` and `gtawSyncTimestamp` are
  ISO-8601 strings.
- `bbCode` is always a string (empty when none). The list's `hasBbCode`
  indicates whether it is non-empty; the example is truncated.
- The route identity (`author` + `key`) is not repeated inside `report`.
- Values above are fictional.

The server records a **live view** before returning. Use `viewer` as your
integration's display label (e.g. `acme-dashboard`); it is a hint, not auth.
`404` if the report is missing, not forwarded, or — for the LSPD-locked key —
belongs to another department.

### 5.3 Audit a cached open

```http
POST /api/reports/leo/:author/:key/view
Content-Type: application/json

{ "source": "cache", "characterName": "acme-dashboard" }
```

Use this **instead of** 5.2 when you served a report from your own cache — the
payload must not be re-fetched, but the open must still be attributable. Do not
call both for the same open.

Response: `{ "success": true, "logged": true, "source": "cache" }`.

### 5.4 Audit a panel open

```http
POST /api/reports/leo/access
Content-Type: application/json

{ "source": "panel", "characterName": "acme-dashboard", "appBuild": "acme-1.4.0" }
```

| `source` | Use |
|---|---|
| `panel` | Any external report panel (default) |

Use `panel` for external integrations. Omitting `source` also records `panel`.

Response: `{ "success": true, "logged": true, "notified": true }`. `notified`
is `false` if the audit notification could not be delivered; the audit line is
still written.

### 5.5 LEO row schema

| Field | Type | Notes |
|---|---|---|
| `key` / `author` | string | Report identity; URL-encode when opening |
| `authorName` | string | Display author |
| `formId` / `formName` | string | Source form |
| `title` | string | Original report key/title |
| `timestamp` | number | Report timestamp (epoch ms) |
| `updatedAt` | number | Last saved (epoch ms) |
| `department` | string | Normalized key (`lspd`, `lssd`, …) |
| `requestingOfficer` | string | Requester name |
| `decedentName` | string | Decedent (single, or comma-joined from `decedents[]`) |
| `forwarded` | boolean | Always `true` in this feed |
| `hasBbCode` | boolean | Whether `bbCode` is stored |

---

## 6. Quick start (Node 18+)

```js
const BASE = 'http://88.208.243.254';

async function get(path, key) {
  const res = await fetch(BASE + path, { headers: { 'x-api-key': key } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

const MORGUE_KEY = process.env.MORGUE_API_KEY;   // morgue read key (full or morgue-only)
const LEO_KEY = process.env.LEO_REPORTS_API_KEY; // /api/reports/leo* only

// One recent morgue record
const morgue = await get('/api/morgue?limit=1', MORGUE_KEY);
console.log(morgue.records[0].caseId, morgue.records[0].causeOfDeath);

// Recent forwarded LEO reports
const feed = await get('/api/reports/leo?limit=5', LEO_KEY);
for (const row of feed.reports) console.log(row.department, row.decedentName, row.key);
```

For a full morgue walk-through (health → version → list → search → one record →
404 → 401) run the existing probe:

```bash
MORGUE_API_KEY=pmc_morgue_xxx node setup/morgue-api-poc/poc.mjs
```

---

## Support

Issues or questions about the API? Contact the PHMC Forms maintainer
**Alyson Frost** (`Fr0styDev` on Discord).
