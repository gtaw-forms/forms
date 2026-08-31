# Customization

How to adapt the project to your faction without changing its core.

---

## 1. Add / edit a form

Forms are **data**, not code. Everything is in RTDB under `forms/<key>`.

### Add a new form

```js
// from a Node script with firebase-admin (or the Firebase console)
await db.ref('forms/my-form').set({
  name: 'My Form',
  category: 'PHMC Staff',
  accessType: 'PHMC',
  firebaseKey: 'my-form',
  fields: [
    { name: 'decedentName', label: 'Patient Name', type: 'text', layout: 'full' },
    { name: 'date', label: 'Date', type: 'dateTime' },
    { name: 'phmcEmployee', label: 'PHMC Employee', type: 'employee_select' },
  ],
  template: "[divbox=white][center][b]MY FORM[/b][/center]\nPatient: {{decedentName}}\nDate: {{date}}\nSigned: {{phmcEmployee}}[/divbox]",
});
```

Then **bump the version** so clients pick it up:

```bash
# increment appMetadata/formsDataVersion
```

### Placeholder substitution

The BBCode generator replaces `{{fieldName}}` with the form value. Special
handling:

- `{{patientID}}` / `{{PatientName}}` — preserved when empty so the bot can fill
  them (medical records).
- `{{phmcSignature}}` / `{{coronerSignature}}` — an approved signature URL is
  rendered as `[img]…[/img]` in the sign-off line.
- Employee fields (`phmcEmployee`, `coronerEmployee`, …) are auto-formatted as
  `Rank Name (SN: Badge)` from the roster/OAuth.
- Expressions like `{{getDepartmentFullName(department)}}` are evaluated.
- `{{decedents_array_bbcode}}` — injected by the mass-fatality generator.

> The field `type` matters: `employee_select` resolves the employee identity,
> `image_upload` uploads + renders `[img]`, `dynamic_text_list` renders a
> `[list]`, etc.

### Wire a form into deploy + access control

The web app and bot keep hard-coded lists of deploy-tracked form keys
(`MEDICAL_FORM_IDS`, `DEPLOY_TRACKED_FORMS`, bot `deployQueue`/`deployExecutor`
arrays). If your new form should auto-deploy to a forum, add its key to those
lists and to the forum label map (`forumClient.js`).

---

## 2. Change the morgue intake

- Records are **not pulled from any official GTA World API** — a coroner captures
  them **in-game** with the hotkey script `setup/morgue-logger.ps1`, which parses
  the `/morgue` console output and uploads each record to the morgue-api (RTDB
  `morgue-records/<caseId>` + VPS mirror `morgue-data.json`).
- Record fields drive the web browser, the autopsy-request prefill, and the
  death-record matcher. See `setup/DATA-MODEL.md` for the shape.
- To change intake fields, update the logger's regex parsing + the record shape,
  then re-sync. CCTV is similarly manual — the bot scrapes **in-game camera-log
  output** (no external API).

---

## 3. Bot commands

Commands live in `discord-bot/commands/` and register via `SlashCommandBuilder`.

Add a command:

```js
// discord-bot/commands/my-command.js
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('my-command')
  .setDescription('Does something');

export async function execute(interaction) {
  await interaction.reply('hi');
}
```

Register it in `discord-bot/index.js` where commands are imported/loaded, then
restart the bot. Deploy commands to the guild with the dev/register script if
your fork uses one (or `/command register` via the bot).

---

## 4. Agency / forum accounts

The bot posts to agency forums (LSPD/LSSD/SADCR/DAO) using **isolated Playwright
sessions**, one per agency (`forum-session-<name>.json`).

- Credentials come from `FORUM_<AGENCY>_USERNAME/PASSWORD` in the bot `.env`.
- Sessions are persisted so the bot stays logged in across restarts.
- To add an agency: add the `FORUM_*` env vars, a session name in
  `createIsolatedClient('name')`, and a webhook (`AUTOPSY_REQUESTER_WEBHOOK_*`).

---

## 5. Discord webhooks (custom)

`sendWebhookProxy` can send to a **custom webhook id** stored at
`webhooks/<id> = { "url": "https://discord.com/api/webhooks/…" }`. The web app /
bot call it with `{ webhookId }`. Useful for per-agency or per-channel pings.

---

## 6. Maintenance / downtime

Set `appMetadata/maintenance` in RTDB:

```json
{
  "active": true,
  "message": "System down for maintenance",
  "splash": true,
  "deployQueuePaused": true
}
```

- `splash:true` shows a maintenance screen in the web app (cached briefly).
- `deployQueuePaused:true` pauses the bot's deploy queue.

---

## 7. Styling / UI

- The app uses CSS variables (`--teal`, `--bg-elevated`, …) defined globally —
  re-theme by overriding them.
- Form field rendering lives in `src/components/ui-new/PrototypeFieldRenderer.jsx`.
- The sidebar, notifications, and modals are in `src/components/ui-new/`.