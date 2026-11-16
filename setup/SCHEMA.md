# Firebase Schema Reference

Field-level reference for the key RTDB nodes. `setup/DATA-MODEL.md` shows the
tree; this is the per-node schema. Notation: `type · required? · description`.

---

## Write model (`functions/database.rules.json`)

Root `.read` is `auth != null`; **root `.write` is `false`** — every client write
is granted per path. The bot, Cloud Functions and `tools/*` use the Admin SDK and
bypass rules entirely.

| Path | Who may write |
|---|---|
| `scheduledReports/$author`, `scheduledReportsBBCode/$author`, `newSavedReports/$author`, `newSavedReportBBCode/$author`, `recoveredReports/$author`, `reportEdits/$author`, `shortLinksByReport/$author` | the owner or staff/admin. **The key is the author's sanitized character name** (`comprehensiveSanitize(getCharacterName(user))`), not the uid, so the rule matches the token's `characterName` / `displayCharacterName` / `gtawUsername` run through the same transformation (space, `.`, `/`, `#` → `_`, runs collapsed), the uid, or the staff claims. Rules `replace()` is a **literal** substring replace here (proven by probe — `[.]` does not match a dot), and `string(...)` is unavailable |
| `user-consent/$uid` | the owner only |
| `shortLinks/$code`, `lspd-portal-form-queue/$key` | create-only (`!data.exists()`) for any signed-in client |
| `autopsy-requests/pending/$id`, `autopsy-requests/private-pending/$id` | create-only, any signed-in client (bot consumes) |
| `autopsy-requested/**`, `autopsy-requests/{rotation,loa,discord-members,web-meta}`, `completionStepRetries`, `deployNotifications`, `forms_staging` seeds, `webhooks` (non-admin) | never (bot writes with the Admin SDK) |
| `forms/$formId`, `forms_staging/$formId`, `selectOptions/$category`, `morgue-records`, `lscc/*`, `factions/$factionId`, `audit/faction_uploads`, `webhooks/$id`, whitelisted `appMetadata` keys | staff/admin |
| `verified_locations`, `unprocessedCKs`, `morgueMatchLogs`, `presence`, `analytics/visitors` | any signed-in client (low-risk reference/telemetry) |

**Staff/admin predicate:** `auth.token.isSuperAdmin === true` (GTA World staff and
superadmins — the token sets `isSuperAdmin` from `isElevated`) or
`auth.token.accessLevel` in `superadmin` / `admin` / `management` (PHMC rank 12+).

> **Known gap:** PHMC rank **11** has `accessLevel: "member"` and no admin claim,
> but the Admin panel gate admits rank 11+ (`AdminDashboard.hasAdminPageAccess`).
> Those two accounts are currently denied admin-panel writes. Fix = add a
> `scriptRank` (or `canAdminPanel`) claim in `processGtaWorldAuth` /
> `refreshGtawUser` and extend the predicate once the refreshed tokens roll out.

> **Read residual:** reads are still granted at the root, so a child `.read: false`
> cannot restrict them (Firebase: a shallower grant cannot be revoked). A
> read-lockdown for `autopsy-requested` and `autopsy-requests/private-pending`
> is a separate phase.

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
| `parsed` | object | `{ requesterName, requesterDept, placeOfDeath, deathType (PK/CK — for a mass request this is the requester's raw Section-4 line, which may name several types; per-body `cases/<idx>/deathType` is authoritative), dateOfDeath, timeOfDeath, synopsis, causeDetail }` |
| `caseState` | string | `me_assigned` → `case_created` → … → `completed` |
| `cases` | object | Multi-decedent / mass: per-decedent sub-entries under `cases/<idx>` (`name`, `oocName`, `sex`, `ethnicity`, `dateOfDeath`, `timeOfDeath`, `placeOfDeath`, **`deathType`** — per-body PK/CK for mass requests, whose single Section-4 PK/CK line can mix types — `assignedTo`, `completedAt`, `replyPostId`) |

---

## `autopsy-requests/`

| Path | Shape |
|---|---|
| `rotation/list` | array<string> — ME rotation order |
| `rotation/position` | number — next-in-line pointer |
| `loa/<name>` | boolean — ME leave of absence |
| `discord-members/<forumName>` | string — ME forum name → Discord user id |
| `pending/<id>` | object — web "Request Autopsy" submissions (see below) |

---

## `appMetadata/infoPanels/<messageId>` (info-panel tracking)

`{ channelId, section, updatedAt }` per posted Information panel. Lets
`/info-panel refresh` re-render every live panel in place (each in the section
its readers last left it). Written only on manual post / button tap / refresh.
Rules deny client writes (bot uses Admin SDK).

## `appMetadata/phmcDashboard` (dedicated PHMC dashboard tracking)

`{ messageId, channelId, updatedAt }` — the live PHMC Discord dashboard message
(all sections except VPS stats, gated by `PHMC_CHANNEL_SEND_ENABLED`).

## `completionStepRetries/<topicId>/<stepName>` (bot-internal retry index)

Tiny marker ({ failedAt, detail }) written by `finishCompletionStep` on failure
and removed on success; (re)seeded at monitor startup. Lets the 10-min recovery
sweep fetch only entries with failed steps instead of the full
`autopsy-requested` node. Rules deny all client access (bot uses Admin SDK).

## `deployNotifications/<id>` (web-deploy → Discord, via bot)

Written by `tools/deploy.js` (local, service-account key); picked up event-driven by the bot's `deployNotifier` service, posted to the log channel with the bot client, then removed. No webhook URLs anywhere.

| Field | Shape |
|---|---|
| `title` / `description` / `color` | embed content |
| `createdAt` | string — ISO timestamp |
| `status` | `pending` (bot removes the node after posting) |
| `source` | `web-deploy` |

### `autopsy-requests/pending/<id>` (web submission)

`caseId, decedentName, oocName, gender, ethnicity, dateOfDeath, timeOfDeath,
placeOfDeath, requesterName, requesterRank, requesterDept, requesterBadge,
guidelinesRead (bool), requesterCell, requesterDiscord, agencyForum, deathType
(PK/CK), synopsis, causeDetail, cexamineImg, cinjuriesImg, topicTitle,
requestBBCode, source:'web-morgue', status:'pending', createdAt, createdBy`

> **Auto-post:** when `AUTOPSY_REQUEST_AUTO_POST=true` on the bot, pending
> entries are posted to PHMC f=265 automatically (`webAutopsyRequestPoster.js`),
> then `status` flips to `posted` with `topicUrl`/`postedAt`. Failures set
> `attempts`/`lastError` and retry up to 3× with `nextRetryAt` backoff.

### `autopsy-requests/private-pending/<id>` (web PRIVATE submission)

`requestType:'private', isPrivate:true, status:'pending', caseId, decedentName,
oocName, gender, ethnicity, dateOfDeath, timeOfDeath, placeOfDeath,
requesterName, requesterRank, requesterDept, requesterBadge, guidelinesRead,
requesterCell, requesterDiscord, agencyForum (LSPD/LSSD/SADCR/DAO),
forumAccountUrl, deathType (PK/CK), synopsis, causeDetail,
privateJustification, cexamineImg, cinjuriesImg, source:'web-morgue-private',
createdAt, createdBy`

> **Never public:** the f=265 poster listens only on `autopsy-requests/pending`
> and refuses `isPrivate` entries, so a private submission can never be posted
> publicly. `privateWebAutopsyIntake.js` consumes this node with
> `PRIVATE_WEB_MODE` = `off` (default) | `dryrun` | `live` and creates the
> confidential f=266 case directly. Bot adds `status` (`creating` / `posted` /
> `rejected` / `duplicate` / `needs-review` / `dryrun`), `attempts`,
> `lastError`, `nextRetryAt`, `caseNum`, `caseTopicId`, `caseUrl`,
> `assignedTo`. The `autopsy-requested/<caseTopicId>` entry carries
> `isPrivate`, `faction` (agency lower-case), `formsAutopsy`, `pmForum`,
> `deliveryDRDB` (LSPD only), `privateJustification` and the parsed request
> fields the completion pipeline reads.

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