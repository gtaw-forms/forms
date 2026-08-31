# Firebase Schema Reference

Field-level reference for the key RTDB nodes. `setup/DATA-MODEL.md` shows the
tree; this is the per-node schema. Notation: `type · required? · description`.

---

## `forms/<formKey>`

A form definition. The web app renders `fields` and substitutes `{{name}}`
placeholders in `template`.

| Field | Type | Description |
|---|---|---|
| `name` | string · ✅ | Display name (e.g. "Surgical") |
| `firebaseKey` | string · ✅ | Unique id; must match the node key |
| `category` | string | Grouping (e.g. "PHMC Staff", "Coroner") |
| `accessType` | string | "PHMC" / "Coroner" / … — drives employee-credential resolution |
| `fields` | array<Field> | Ordered field definitions rendered as inputs |
| `template` | string · ✅ | BBCode with `{{placeholder}}` substitution |

### `fields[]` item (Field)

| Key | Type | Description |
|---|---|---|
| `name` | string · ✅ | Placeholder key (`{{name}}`) + saved value key |
| `label` | string · ✅ | Shown label |
| `type` | string · ✅ | `text`, `textarea`, `select`, `employee_select`, `multi_employee_select`, `image_upload`, `dateTime`, `checkbox`, `medicine_block`, `dynamic_text_list`, `caseNumber`, `section`, `fake_line`, `body_tampered`, `multi_select`, … |
| `layout` | string | `"full"` spans both columns (default is half) |
| `options` | array<string> | Options for `select`/`multi_select` |
| `optionsKey` | string | Named option set (`agencies`, roster-backed lists, …) |
| `icon` | string | FontAwesome icon shown next to the label |
| `required` | boolean | Marks a field required |

---

## `morgue-records/<caseId>`

Populated manually in-game by `setup/morgue-logger.ps1` (no official API).

| Field | Type | Description |
|---|---|---|
| `caseId` | string · ✅ | Unique intake id (also the node key) |
| `name` | string · ✅ | "John Doe ((OOC Name))" |
| `sex` | string | Male / Female |
| `ethnicity` | string | |
| `timeOfDeath` | string | "Monday, 24 August 2026 09:39:11" |
| `timeOfDeathISO` | string | ISO timestamp |
| `location` | string | "Pacific Bluffs - Great Ocean Hwy" |
| `causeOfDeath` | string | |
| `bac` | string | "0.00%" |
| `narcotics` | string | "None" / list |
| `identified` | string | "Yes"/"No" |
| `bullets` | array<{type}> | Evidence slugs |
| `dnaProfile` | string | e.g. "DNA-0002D2AF" |
| `lastUpdated` | number · ✅ | epoch ms (indexed — `orderByChild('lastUpdated')`) |
| `firebaseKey` | string | set by mirroring/tooling = caseId |

---

## `scheduledReports/<authorId>/<reportKey>` (deploy queue)

A deploy-tracked, consented report waiting for the bot.

| Field | Type | Description |
|---|---|---|
| `formId` | string · ✅ | `forms/<key>` id — **renamed keys break routing** |
| `data` | object | The form values (spread of `formValues`) |
| `bbCode` | string | Report BBCode (also mirrored in `scheduledReportsBBCode`) |
| `originalKey` | string | Human/forum title |
| `timestamp` | number · ✅ | epoch ms (indexed) |
| `appBuild` | string | Client bundle id that produced it (`window.__PHMC_BUILD__.index`) |
| `isCK` | boolean | Set for coroner CK reports |
| `processed` | boolean | CK-processing flag |
| `decedentName` | string | (medical) patient/subject name |
| `authorName` | string | Submitter display name |
| `deployStatus` | string | `pending` / `attempting` / `completed` / `blocked_empty_employee` / … (bot) |
| `hasdeployed` | boolean | Set `true` by the bot on success |

Re-queue: set `hasdeployed:false` + `deployStatus:'pending'`, restart the bot.

---

## `newSavedReports/<authorId>/<reportKey>`

All other saved reports (list source for the Saved Reports modal). Same report
shape as `scheduledReports` above; the **BBCode is stored on the VPS** (via the
`saveReportBBCode` Cloud Function → `/api/report-bbcode`), not RTDB.

Legacy `newSavedReportBBCode/<authorId>/<reportKey>` = `{ bbCode }` still exists
for reports saved before the migration; reads fall back to it.

---

## `autopsy-requested/<topicId>`

A detected autopsy request being processed.

| Field | Type | Description |
|---|---|---|
| `name` | string | Decedent IC name |
| `oocName` | string | Decedent OOC name |
| `faction` | string | LSPD / LSSD / SADCR / DAO |
| `assignedTo` | string | Assigned ME name |
| `topicUrl` / `caseUrl` | string | Forum request / case topic URLs |
| `detectedAt` | string | ISO |
| `parsed` | object | `{ requesterName, requesterDept, placeOfDeath, deathType (PK/CK), dateOfDeath, timeOfDeath, synopsis, causeDetail }` |
| `caseState` | string | `me_assigned` → `case_created` → … → `completed` |
| `cases` | object | Multi-decedent: per-decedent sub-entries under `cases/<idx>` |

---

## `autopsy-requests/`

| Path | Shape |
|---|---|
| `rotation/list` | array<string> — ME rotation order |
| `rotation/position` | number — next-in-line pointer |
| `loa/<name>` | boolean — ME leave of absence |
| `discord-members/<forumName>` | string — ME forum name → Discord user id |
| `pending/<id>` | object — web "Request Autopsy" submissions (see below) |

### `autopsy-requests/pending/<id>` (web submission)

`caseId, decedentName, oocName, gender, ethnicity, dateOfDeath, timeOfDeath,
placeOfDeath, requesterName, requesterRank, requesterDept, requesterBadge,
guidelinesRead (bool), requesterCell, requesterDiscord, agencyForum, deathType
(PK/CK), synopsis, causeDetail, cexamineImg, cinjuriesImg, topicTitle,
requestBBCode, source:'web-morgue', status:'pending', createdAt, createdBy`

---

## `unprocessedCKs/<reportKey>`

Slim CK index written by the web app on every CK save — the bot's passive
detector watches this (not the full reports node).

| Field | Type | Description |
|---|---|---|
| `reportPath` | string | `scheduledReports` or `newSavedReports` |
| `authorId` | string | report owner |
| `reportKey` | string | report node key |
| `decedentName` / `decedentOOC` | string | CK decedent |
| `dateOfDeath` | string | |
| `timestamp` | number | epoch ms |
| `decedentIndex` | number | mass-fatality only |
| `isMassFatality` | boolean | mass-fatality only |

---

## `deathRecordDrafts/<reportKey>`

| Field | Type | Description |
|---|---|---|
| `status` | string | `pending_review` / `edited` / … |
| `decedentName` | string | |
| `title` | string | forum title |
| `createdAt` | number | epoch ms |
| `needsMorgue` | boolean | waiting on a morgue match (indexed) |
| `deploying` | boolean | being posted (indexed) |

---

## `webhooks/<id>` / `appMetadata`

| Path | Shape |
|---|---|
| `webhooks/<id>` | `{ url }` — custom Discord webhook for `sendWebhookProxy({ webhookId })` |
| `appMetadata/formsDataVersion` | number — bump to force clients to refetch forms |
| `appMetadata/lsccDataVersion` | number — same for LSCC |
| `appMetadata/factionsDataVersion` | number — same for factions |
| `appMetadata/maintenance` | `{ active, message, splash, deployQueuePaused }` |
| `appMetadata/morgueBanner` | `{ text }` |
| `facePostDrafts/<key>` | `{ status:'scheduled', decedentName, publishAt }` |

---

## Notes

- **Indexed fields** (`.indexOn` in `functions/database.rules.json`): report
  `timestamp`, morgue `lastUpdated`, deathRecordDrafts `needsMorgue`/`deploying`,
  autopsy-requested `name`/`oocName`/crosspost statuses. Queries on unindexed
  fields download the whole node.
- **Keys are identifiers** — renaming a `forms/<key>` breaks queued reports
  (their `formId` no longer routes). Migrate data + keep a legacy alias (see
  `setup/CUSTOMIZATION.md`).