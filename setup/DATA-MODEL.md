# Data Model (Firebase Realtime Database)

> **Field-level schema:** see **[SCHEMA.md](SCHEMA.md)** for the per-node field
> reference. This file is the layout overview.

Everything lives under the RTDB root. Cloud Functions + the bot use the Admin
SDK (rules bypassed); the web app reads through rules (mostly authenticated).

```
/forms/<key>
    name, category, accessType, firebaseKey, fields[], template
/forms_staging/...
/factions/364/members/<charId>     # roster: character id = record KEY
/factions/<id>/metadata
/lscc/...                          # cached protocols/records (versioned)
/selectOptions/...                 # autocomplete options (roster-backed)
/morgue-records/<caseId>           # intake records — MIRRORED to the VPS
                                   # (morgue-data.json); web reads via API
/scheduledReports/<authorId>/<key> # deploy-tracked + consented reports
/scheduledReportsBBCode/<authorId>/<key>
/newSavedReports/<authorId>/<key>  # all other saved reports (list source)
/newSavedReportBBCode/<authorId>/<key>  # LEGACY — BBCode now on the VPS
/unprocessedCKs/<key>              # slim CK index (coroner + mass-fatality)
/deathRecordDrafts/<key>           # death-record review drafts
/verified_locations/...            # canonical location names
/untracked_locations_log/...
/facePostDrafts/<key>              # scheduled Facebrowser posts
/autopsy-requested/<topicId>       # autopsy requests being processed
/autopsy-requests/
    rotation/{list, position}
    loa/<name>                     # ME leave-of-absence
    pending/<id>                   # web "Request Autopsy" submissions
    discord-members/<forumName>    # ME forum-name → Discord id
/webhooks/<id>                     # custom Discord webhooks
/userReportCounts/<uid>/total
/appMetadata/
    formsDataVersion               # bump → clients refetch form templates
    lsccDataVersion
    maintenance/{active, message, splash, deployQueuePaused}
    morgueBanner/{text}
    factionsDataVersion
/analytics/...                     # webhook/usage counters
/presence/...
```

---

## Key nodes in detail

### `forms/<key>`

A form definition rendered by the web app:

```json
{
  "name": "Surgical",
  "category": "PHMC Staff",
  "accessType": "PHMC",
  "firebaseKey": "surgical",
  "fields": [ { "name": "decedentName", "label": "Patient Name", "type": "text", "layout": "full" } ],
  "template": "[divbox=white]… {{phmcEmployee}} …[/divbox]"
}
```

- `template` is BBCode with `{{placeholder}}` substitution.
- `fields` drives the rendered inputs; field types include `text`, `select`,
  `employee_select`, `multi_employee_select`, `image_upload`, `dateTime`,
  `checkbox`, `medicine_block`, `dynamic_text_list`, `caseNumber`, etc.
- When you change a template, **bump `appMetadata/formsDataVersion`** so clients
  refetch instead of serving a stale cached template.

### `morgue-records/<caseId>`

Intake record shape (also mirrored to the VPS). Records are **populated
manually in-game** by `setup/morgue-logger.ps1` (a hotkey script that captures
`/morgue` console output and uploads it to the morgue-api) — there is no
official GTA World API source:

```json
{
  "caseId": "2026-0001",
  "name": "John Doe ((OOC Name))",
  "sex": "Male",
  "ethnicity": "Caucasian",
  "timeOfDeath": "Monday, 24 August 2026 09:39:11",
  "timeOfDeathISO": "2026-08-24T09:39:11",
  "location": "Pacific Bluffs - Great Ocean Hwy",
  "causeOfDeath": "…",
  "bac": "0.00%",
  "narcotics": "None",
  "identified": "No",
  "bullets": [ { "type": "9mm" } ],
  "dnaProfile": "DNA-0002D2AF",
  "lastUpdated": 1787857051747
}
```

### `scheduledReports/<authorId>/<key>`

A queued report:

```json
{
  "formId": "surgical",
  "data": { "decedentName": "…", "…": "…" },
  "bbCode": "…",            // or read from scheduledReportsBBCode / the bot
  "originalKey": "…",
  "timestamp": 1787857051747,
  "appBuild": "index-abc123.js",
  "deployStatus": "pending",
  "hasdeployed": false
}
```

The bot's `deployQueue` watches this node; on success it sets `hasdeployed:true`
and `deployStatus`. To re-queue a report: set `hasdeployed:false` +
`deployStatus:'pending'`, then restart the bot (its cold-load treats it pending).

### `autopsy-requested/<topicId>`

An autopsy request being processed:

```json
{
  "name": "Marcus Johnson",
  "oocName": "DevTest_Player",
  "faction": "LSPD",
  "assignedTo": "Dr. Alyson Frost",
  "topicUrl": "…",
  "caseUrl": "…",
  "detectedAt": "2026-08-24T…",
  "parsed": { "requesterName": "Sgt. Riley", "placeOfDeath": "Davis Avenue", "deathType": "PK", "dateOfDeath": "10/JUL/2026", "timeOfDeath": "22:45" }
}
```

`caseState` transitions drive the flow: `me_assigned` → `case_created` → … →
`completed`.

---

## Version stamps that force client refetch

| Key | Bump when |
|---|---|
| `appMetadata/formsDataVersion` | Any `forms/<key>/template` or field change |
| `appMetadata/lsccDataVersion` | LSCC dataset change |
| `appMetadata/factionsDataVersion` | Faction roster/metadata change |

The web app caches these segments in IndexedDB/localStorage and re-downloads
when the stored version mismatches the server version.