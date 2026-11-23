# PHMC Discord Bot — Changelog

## UNDEPLOYED — Mass collections: "((PK))" is a death type, not an OOC; identity-less reports get attributed (2026-11-23)

### Fixed
- **Request templates that write `Jane Doe ((PK))` no longer store `"PK"` as the body's OOC name.** `parseDecedentNameLine` now recognises a PK/CK parenthetical as the death type (kept as a per-body fallback when no "Type of Death" line exists) and leaves `oocName` empty. This is what let Sarah Bell's report for **Cristian Ricci** (#10493) be saved as `Unknown ((PK))` — Load Case copied the marker into the OOC field and the body had no usable identity.
- **Identity-less reports no longer post without completing anything.** `pickIdentitylessCollectionBody` attributes a report with no usable identity (placeholder name + PK/CK OOC) to the reporting ME's **only** incomplete body in the resolved shared collection (two candidates ⇒ null, never a guess). Live: Ricci's report was already posted to t=10494 (p=25923) but no body was marked complete; the fallback prevents that class.
- **Data repair applied** to #10493 body 1 (Ricci): `completedAt`, `replyPostId 25923`, `replyUrl` recorded; the collection is complete and its panel refreshed (3/3 COMPLETED).
- Tests: `parseMassRequestBbcode` keeps `((PK))` out of `oocName` and files the type; `pickIdentitylessCollectionBody` (single candidate, ambiguous, wrong author/topic).

## UNDEPLOYED — Mass collection: PK/CK marker in the OOC slot no longer blocks completion (2026-11-20)

### Fixed
- **Mass Autopsy Assignment panels kept bodies OUTSTANDING after the ME filed the report.** Request templates write `Jane Doe ((PK))`, which the mass parser stores as `oocName: "PK"`, `name: "Jane Doe"`. `matchCollectionCase` treated `"PK"` as a real OOC identity, so a report filed as `Jane Doe ((Genevieve Kennedy))` could not match its body (report OOC held the name, body OOC held the death type). The deploy fell through to a forum search, found two threads (an old Case #212 and the live collection), and waited for a staff thread pick that never came — the report was never posted, `cases/<idx>/completedAt` was never set, and the panel (correctly, from stale data) stayed outstanding.
- `matchCollectionCase` now treats `PK`/`CK` in the body OOC slot as "no OOC" (never an identity, and never a match target), so the body name is compared against the report's OOC. Live case #10493 body 2 (Genevieve Kennedy) filed to shared thread 10494 and the panel auto-refreshed to 1/3 completed after the fix.
- Tests: +1 in `tests/matchCollectionCase.test.js` (typed bodies match by name; a literal "PK" OOC never matches).

## UNDEPLOYED — LSPD ME form: Decedent block carries IC + OOC (2026-11-17)

### Changed
- **The medical-examiner case submission's "Decedent" field now reads `IC ((OOC))`** — e.g. `Unknown ((Charles Brigante))` — because that form has no separate "Player OOC name" field (the coroner and mass-fatality forms do). An existing `((…))` suffix in the IC name is never doubled, and a blank IC name with an OOC falls back to `Unknown ((OOC))` instead of aborting.
- Tests: +1 in `tests/lspd-portal-forms.test.js` (IC+OOC, IC only, already-suffixed). Mass-fatality/coroner payloads unchanged.

## UNDEPLOYED — LSPD DRDB Mass Fatality Report support (2026-11-17)

### Added
- **Mass-fatality reports now file the native DRDB Mass Fatality form** (`/portal/records/mass-fatality-report`) instead of skipping the portal leg. `buildMassFatalityPayload` maps incident fields (BBCode-stripped `placeOfDeath` fallback when `placeOfDeath_display` is missing), the two fixed required decedent sections, and decedents 3..N into the 15-column "Additional decedents" rows via a new `keyedRows` driver kind (`div[data-record-rows]` → `div[data-record-row-entry]` → `div[data-record-row-cell="<key>"]`, grown with `button[data-record-rows-add]`). Evidence locker is derived (`evidenceLockerID` non-empty → `Used`, else `Not used`).
- Fail-closed contract: aborts (never invents) on <2 decedents ("refusing to duplicate"), unparseable time of death, unmapped manner/type, or empty probable cause / injuries — every error names the 1-based decedent index. Dynamic rows cap scene/OOC images at 3 each (fixed sections grow unbounded); overflow is a logged warning, never prose-mixed.
- Wiring: `PORTAL_FORMS['mass-fatality']` + `FIELD_ANCHORS`/`ROW_ANCHORS` entries (labels unique per section — portal labels repeat), `enqueuePortalForm` accepts `mass-fatality`, the form queue delivers it via `deliverMassFatalityForm`, and `deployCoronerEmail` routes mass reports there (replacing the temporary skip). `isLspdPortalReport` also covers the canonical `mass-fatality` formId.
- Receipt detection for this form is still unverified (never live-submitted) — dry runs only until the first approved live filing captures the receipt shape.
- Tests: payload mapping, keyedRows shaping, locker derivation, <2-decedent abort, real-sample time parsing (`15/11/2026 20:05` → `20:05`, `23/JAN/2026 - 19:41` → `19:41`). Dry-run verified row add/fill/read-back against the live form (own context, nothing submitted).

## UNDEPLOYED — Panel "Reassign" no longer times out (missing `performReassign`) (2026-11-17)

### Fixed
- **Every V2 panel "Reassign (Supervisors)" press failed with "application didn't respond in time".** `singlePanelV2.js` and `massPanelV2.js` import `performReassign` from `commands/reassign-autopsy.js`, but that function was **never implemented or exported** — and `getMeNames` (used to build the ME picker) wasn't exported either. The single-panel handler threw a TypeError before acknowledging the interaction, so Discord reported the 3-second timeout; the mass panel had the same latent failure.
- Extracted the reassignment core from the slash command into **`export async function performReassign({ db, client, topicId, caseIdx, newME, basePath, dryRun })`**, returning `{ ok, already, dryRun, error, currentAssigned, newME, decedentName, caseUrl }`. It handles single cases and per-body `cases/<idx>` records, retitles the f=266 topic, posts the reassignment notice, syncs `assignedTo`/`caseTitle`, moves the rotation count, pings the new ME, and **never throws** (errors come back as `{ok:false}` so a deferred interaction can always answer).
- `getMeNames` is exported; `openSingleReassignModal` loads it defensively and replies with a clear message if the rotation can't be read.
- Ack-first hardening: `/reassign-autopsy`'s case menu now `deferUpdate()`s before its DB read (the menu previously acked only after building itself), and the single panel's modal submit defers before any I/O.
- **Reassignment now EDITS the original assignment panel instead of posting a minimal new card.** The panel already carries decedent, case number, deadline, morgue status and links; `refreshSinglePanelAssignment` rebuilds it from the live row (new ME, fresh morgue resolution) and edits the message in place. Only when no panel ref exists (or the message is gone) does it post a full assignment card via `notifyAssignment` — with decedent/OOC/case number/death type filled in, not the old "Decedent — Unknown" placeholder.
- **The new ME is notified with a reply on the panel** — `<@ME> You have been re-assigned an autopsy, the information is here.` Editing a message cannot ping, so the edit is followed by exactly one reply with an explicit user mention (no ping is possible when no Discord mapping exists; the reply then names the ME in bold).
- Tests: new `tests/reassign-autopsy.test.js` (5) — single case, already-assigned, per-body `caseIdx`, dry run, unresolved-topic error. Suite 48 files / 415 green; imports clean.
- **Not yet deployed** — the working tree also carries the concurrent mass-fatality session's in-progress portal changes, and a whole-tree bot deploy would ship those too.

## UNDEPLOYED — Metal Objects Extracted no longer de-duplicates (2026-11-17)

### Fixed
- **Recovered metal objects were collapsed to their distinct descriptions.** `buildMedicalExaminerPayload` built "Metal Objects Extracted" with `normalizeTextList(data.casings)`, which de-duplicates lines. Live case #10492 (Anthony Sorrentino → Joyce Pawironadi, MER-26-0005) had **9 recovered projectiles carrying only 2 distinct serials** (4× 9mm #290284483, 5× 5.56mm #290684439): Radiology correctly said "9 projectiles/slugs", but the portal listed only 2.
- `normalizeTextList` now takes `{ dedupe: false }`; the ME builder passes it for casings, so every recovered object is listed. Causes/findings keep their de-duplication.
- Regression test asserts 9 casings → 9 lines (4 of them 9mm).
- The already-filed MER-26-0005 keeps 2 lines — correcting it needs a re-filing or a manual portal amendment.

## UNDEPLOYED — LSPD time parser + mass-fatality routing hotfixes (2026-11-17)

### Fixed
- **`extractTime()` no longer files a bare 4-digit time as midnight.** `extractTime('2134')` fell through to `new Date('2134')` — the *year* 2134 — and returned `00:00`; 15 of 21 historical bare values would have been filed as midnight, and overall coverage was 320/464. Rewritten: bare `HHmm` → `HH:mm` (range-validated, never a year), `HH:mm`/`HH.mm`/`H am|pm` (`8.20pm`, `7:41 PM`, `8pm`, `12am`), and for longer strings the **last** time-like token (`23/JAN/2026 - 19:41`, ISO, `15 Nov 2026 20:27`). Placeholders (`DD/MM/YYYY - HH:mm`) and out-of-range values abort instead of guessing. `splitDateTime()` also refuses a bare 4-digit token rather than parsing it as a year.
- **Mass-fatality coroner emails no longer hit the single-decedent portal builder.** `deployCoronerEmail.js` queued `coroner-report` for every LSPD portal target, so a mass report aborted with "Place of death is empty" and retried forever. Added `isMassFatalityFormId()` (covers `mass-fatality` and the legacy `mass-ftality-test`) and a visible skip for that portal leg (`Mass Fatality → DRDB not supported yet — see plan`). The multi-decedent email subject check uses the same predicate.
- Tests: `tests/lspd-portal-forms.test.js` +4 (34 total in that file). No receipt or mass-fatality builder work yet — see `plan/lspd-mass-fatality-portal-plan.md`.

## UNDEPLOYED — LSPD ME form: portal field-length truncation (2026-11-17)

### Fixed
- **DRDB medical-examiner filings aborted on long free-text fields.** The portal caps Physical Description at 400 chars and silently truncates; worse, the report text was CRLF and the browser normalises textareas to LF, so the read-back was both shorter and different. The guard aborted with `Field "Physical Description" did not stick (wrote 403 chars, read 400)` — a permanent retry loop (live: private case #10492 / topic 10492).
- `fillField` now (a) normalises CRLF/CR → LF for textareas before filling (`normalizePortalText`, exported + unit-tested), (b) respects an explicit `limit` on the field declaration — Physical Description carries `limit: 400` — truncating to it first (`applyPortalFieldLimit`), and (c) ignores the HTML textarea default `maxLength` (524288 / -1) which never reflects the portal's JS-side cap.
- Read-back gained a tolerant fallback for controls that slice in JS: an exact prefix of the written text is accepted as a portal truncation (loud warning) instead of aborting the filing. Text/textarea only, never date/time masks, so real mismatches still fail — and a genuine mismatch now logs the first divergent character plus the control's attr/prop maxlength.
- Verified with a fill-only dry run against case #10492: 25 fields filled, `ok: true, dryRun: true` (no submission). The failed completion step retries on the next recovery sweep and files normally.
- Applies to both portal forms (medical-examiner and coroner-report).

## UNDEPLOYED — Private cases: duplicate ME assignment reply fixed (2026-11-16)

### Fixed
- **Private f=266 cases posted the "You have been assigned this autopsy case file" reply twice.** `privateCaseCreation.js` posted the reply but never recorded `assignmentReplyStatus`, which `autopsyRequestMonitor.retryFailedAssignmentReplies` uses to decide whether a case is missing its reply. The 30-minute self-heal sweep therefore saw every new private case as un-acknowledged and posted the reply again (live evidence: three cases created 2026-11-16 17:57–18:00 each got the initial reply from `createPrivateCase` and a second from `[AUTOPSY-MON] Retried assignment reply ... — OK`).
- `createPrivateCase` now writes `assignmentReplyStatus: 'completed'` when the reply posts (or `'failed'` when it does not, so the sweep still self-heals a genuine failure). The field is only set when an ME was actually assigned.
- Regression covered in `tests/privateAutopsyWeb.test.js` (asserts the entry carries `assignmentReplyStatus: 'completed'`).
- The three affected topics already carry the field (set by the sweep when it reposted), so no further duplicates will be posted. The extra replies themselves need a manual/forum delete.

## UNDEPLOYED — LSPD PM intake deleted (2026-11-15)

### Removed
- **`services/privateAutopsyPmMonitor.js` deleted** — the LSPD phpBB board is permanently retired, so the 30-minute inbox poll, the Approve/Deny approval drafts, the `pmintake_*` button handler and the `private-pm-intake/*` processed/created records have no purpose. Private autopsies arrive exclusively through the web modal (`services/privateWebAutopsyIntake.js`, `PRIVATE_WEB_MODE`).
- **`commands/pm-intake-dryrun.js` deleted** and unregistered from both command lists; the `pmintake_*` interaction handler is gone from `index.js`. Historical Discord approval cards now fall through to the unknown-button path.
- **Wiring removed from `index.js`**: the `setPmIntakeClient` registration and the `pm-intake` phased-boot-queue entry.
- **`.env.example`**: the `PRIVATE_PM_INTAKE_*` / `LSPD_PM_INTAKE_GROUP_ID` block replaced with a removal note. The vars are inert; remove them from the VPS `.env` at leisure.
- Kept: `services/privateCaseCreation.js` (the shared case-creation core) and its use by the web intake. `private-pm-intake/*` RTDB data is left untouched (historical record) and no longer read.

## UNDEPLOYED — Autopsy completion notice: debug line removed (2026-11-15)

### Fixed
- **`Forms Autopsy: True` leaked into public completion notices.** `COMPLETION_TEMPLATE` carried an internal diagnostic line (`[b]Forms Autopsy:[/b] FORMS_AUTOPSY`) that every requester-facing completion notice rendered — the f=265 reply, the LSSD/SADCR/DAO combined completion + report reply, and `/force-autopsy-send`. Removed from the template and from `buildCompletionBb` (the `formsAutopsy` context flag is still accepted for caller compatibility but is no longer rendered). Nothing else in the template changed: requester name, Gov Intranet link line, signature and footer are byte-identical.
- Posts already on the forums keep the line (the bot never retro-edits); they need a manual edit or a re-render of the stored completion reply.

## UNDEPLOYED — Web PRIVATE autopsy intake + LSPD DRDB delivery (2026-11-14)

### Added
- **`services/privateWebAutopsyIntake.js`** — web "Private Autopsy" requests (`autopsy-requests/private-pending`) become a confidential f=266 case (`[PRIVATE]` title, rotation ME assignment, title edit, assignment reply, staff notification). No f=265 topic, no acknowledgement reply, no agency crosspost. Modes via `PRIVATE_WEB_MODE` = `off` (default) | `dryrun` | `live`, toggled by the new owner command **`/private-web-autopsy`**; mode persists to `.env`.
- **`services/privateCaseCreation.js`** — one case-creation core for both private intakes (`createPrivateCase`, `nextCaseNumber`, `buildPrivateCaseTitle`), now shared by `privateAutopsyPmMonitor.js` (behaviour-preserving refactor; its `private-pm-intake/created/<msgId>/<label>` idempotency records are untouched).
- **Private submission notifications** (`webAutopsyRequestEmbed.js`): `buildPrivateSubmittedNotification` / `buildPrivateCreatedNotification` — purple "no public forum post" embed, justification/authority field, dry-run variant.
- **Stats**: `bumpFactionCounter` exported from `autopsyRequestMonitor.js`; the private intake bumps the same faction totals so private requests are not missing from the intake counters.

### Fixed
- **Private LSPD cases now file to DRDB** (they were skipping the LSPD portal ME-liaison form, and LSPD inbox notices are retired — so private LSPD reports had no automated delivery). The completion step runs for private cases whose agency is LSPD (`entry.deliveryDRDB`/LSPD faction); other private agencies still skip it. Failures stay in the completion-step retry sweep, which no longer skips `lspdMedicalExaminerForm` for private entries.
- **Private completion no longer replies into f=265**: the PHMC completion notice is now explicitly skipped for private cases (it previously fired at the case topic id with forum 265). The full report is still the f=266 case-thread reply.
- **Manual completion path** (`deployInteraction.js`) also files the DRDB ME form for private LSPD cases (or records the step failed when no report data is available, instead of silently skipping).
- **Belt and braces**: `webAutopsyRequestPoster.postOne` refuses and parks any entry carrying `isPrivate`/`requestType: private`, so a private request can never be published by the public poster.

### Validation / safety
- Fail-closed intake: LE agency required (explicit selector cross-checked against the department string), decedent/requester fields required, justification >= 10 chars, forum account URL required except LSPD.
- `creating` claim before any forum write; a claim older than 1h is parked `needs-review` with a Discord alert (never auto-retried — no duplicate cases). Duplicate guard on `caseId|decedent|agency` within 24h. Failed creations retry on a 5-min backoff with alerts.

### Hardening (post-build audit, 2026-11-14)
- **No duplicate cases from a stale queue entry**: the intake re-reads the queue node before every attempt, and any entry that already carries a `caseTopicId` is parked `needs-review` instead of being reposted. `createPrivateCase` calls `onPosted` immediately after the topic post so the id is persisted before any wiring step can fail.
- **Claim before duplicate check**: two submissions of the same request can no longer both pass dedupe and create cases.
- **Mode-change resume**: entries submitted while `PRIVATE_WEB_MODE=off` were queued but dormant; `/private-web-autopsy` now rescans and processes them when switched to `dryrun`/`live`.
- **Assignment notification accuracy**: `createPrivateCase` returns `notified`; the PM intake only marks `notified:true` when the ping actually succeeded, and logs an UNASSIGNED case instead of failing silently.
- **No double DRDB filing** from the manual completion path: `deployInteraction` skips the ME form when the step is already `completed`/`attempting`.
- **Dependencies**: root `npm audit` highs (dev-only `undici`/`zod`) cleared via `npm audit fix`; 6 moderate remain in build tooling (no runtime exposure). Bot deps: 0 high / 0 critical.
- **Rules note**: `functions/database.rules.json` adds a `private-pending` child rule (no client read; create-only write). Under the current root `.read/.write: "auth != null"` this is **defence-in-depth only** — Firebase rules cascade, so a shallower grant cannot be revoked by a child. See the audit report: root-level rules lockdown is a separate task.

## UNDEPLOYED — Feedback bot: waiting state + instant button acks (2026-11-11, code live 09:30 UTC)

### Fixed
- **`/feedback` no longer jumps to "Feedback noted / Reviewing" before you have said anything.** It now posts a "Please send your feedback" waiting embed (View Full Log only) and creates the OpenCode session only when your first DM arrives — that message is the request, and it carries the mandatory CLAUDE.md-first Phase 1 instruction (the old code created the session eagerly with placeholder text and the live first-DM branch could never run).
- **Buttons no longer time out.** Every `fb:*` press is now acknowledged immediately (`deferUpdate` for message edits, `deferReply` for the log/cancel ephemerals) before any slow work (OpenCode abort, message fetches, git ops). All follow-ups in the acknowledged path use `editReply`/`followUp`, and the nested pause-from-permission path no longer double-acks. Root cause of the "didn't respond in time" failures: `abortSession` and friends ran before `interaction.update`.
- Anything pressed while still waiting (except View Full Log) gets an instant ephemeral "Send your request in this DM first".
- **Stale pre-execution sessions no longer strand the slot — and are no longer silent.** `/feedback` auto-replaces an active session that never got going (pre-execution state, no plan items, no progress), aborting its orphan OpenCode session. The old DM message is re-rendered as a grey "Session closed" marker echoing back your last message, and the outcome (`superseded`) is recorded. Sessions with real work keep the one-slot guard.
- **`/feedback-list` (new, owner-only):** live session with stage/step detail (state, phase, steps done, plan items, questions, deploy tag) plus terminal history (last 20): `deployed` / `closed` / `failed` / `superseded` with summary, tag, and relative time. History is recorded on complete, fail (once-guarded), and supersede; nothing expires on timers.
- **Event stream actually attached (09:44).** The live review path created the OpenCode session and sent the prompt but never subscribed to `event.subscribe` (only the restart path did) — the plan agent worked unseen and the embed froze at "Feedback noted". The stream now attaches right after the Phase 1 prompt, and restart recovery replays missed plan text from `session.messages` (revived the live `f99ff7` test session this way). Also set `FEEDBACK_REPO_DIR`/`FEEDBACK_DEPLOY_BRANCH`/`OPENCODE_URL` in the VPS `.env` — the first session ran with the bot dir as cwd by fallback.
- **View Full Log timeout (09:47): double `fb:` prefix in button IDs.** Session records stored `sessionId` as `fb:<sid>`, so buttons rendered as `fb:log:fb:f99ff7` (4 parts) while the parser only accepts `fb:<action>:<sid>` (3 parts) — the press was received, rejected silently, and Discord timed out with no ack. Fixed at the source (plain sid), added a legacy-prefix strip so the live session's buttons heal on next render, tightened the render test to reject the double form, and made unparseable `fb:` presses answer instantly instead of falling through.
- **Stream attaches before the prompt (09:54).** `session.prompt` long-polls until the run completes, so attaching the event stream after it meant the embed missed the entire run. The stream now attaches first and the prompt is fire-and-forget (completion/failure/backfill settle in the background); the one-off backfill became a shared helper used by both restore and prompt completion.
- **Chat narration in the DM thread.** The embed stays the state dashboard; the DM thread is now the readable record: completed assistant prose posts as plain-text messages (chunked, idempotent via a watermark), plus one-line milestone notes (approved, testing, deployed, failed, paused, resumed, permission asked/resolved, no-action, complete). The bot still never edits chat history — only appends.
- **/feedback paused until further notice (owner request).** `FEEDBACK_ENABLED=false` in the VPS `.env` + a code gate: the command replies "paused until further notice" and starts nothing. The live session keeps working; re-enable by true-ing the var + `pm2 restart phmc-bot`.
- **Event serialization.** Stream events are processed strictly in order through a per-process promise chain — concurrent read-modify-write cycles used to clobber progress lines and freeze stale buttons (e.g. review buttons on a WORKING session) into the embed.
- **Mostly-live agent prose (Latest field).** The SSE stream carries tool/permission events but not the agent's words, so a 5s ticker polls `session.messages` while a session runs and renders the tail of the latest assistant message into a "Latest" embed field; new prose is also appended to the session log as `agent:` lines, so View Full Log reads like a transcript.
- **No Action Needed button (review states).** The owner judges — pressing it closes the session immediately as green "No action needed" (nothing committed, nothing to revert). History records it, the slot frees at once, and the message stays as a button-less tombstone — no separate Complete press needed. The status hint only mentions Answer questions when questions exist.
- **/feedback opens with a proper prompt.** The ephemeral reply now reads as an invitation ("Ask your feedback, question, or query — this opens an inbox (DM) with the PHMC Bot…") instead of the terse "Opening a DM…"; command description updated to match.
- **Answer questions modal + held-DM queue + Retry review + abandon offer.** Questions can be answered via a modal (one field each, compiled into a plan revision prompt) or plain DM replies — both forward into the live session and reset the embed to "Processing new input…" first. A DM arriving mid-run is held and auto-forwarded when the step finishes instead of failing the session; unattributable server errors are logged, never charged against the live session. FAILED gains **Retry review**. /feedback with a live slot offers Abandon & start fresh (marked superseded, history `closed`).
- **Questions get direct answers, not forced plans.** The review prompt now ends conditionally: a change gets PLAN:/QUESTIONS: sections, a pure question gets a direct answer ending in NO-CHANGE-NEEDED — surfaced as an "Answered" status with the prose in Latest, closable via No Action. Answered questions clear on revision; junk fragments are filtered.
- **Latest reads cleanly + self-checks.** Machine markers stripped, degenerate spans unwrapped, lone ticks dropped (fences untouched), tail clips on line (else word) boundaries at ~1000 of the 1024 budget — the cut happens in the ticker where the full text is known. The agent prompt enforces embed-friendly prose, a uniform markdown contract, a ~900-char reply budget, and a pre-send self-check (length, paired ticks, exact machine lines); revision prompts repeat the format reminder.
- **"User has asked" box.** The owner's original request is quoted verbatim as the first embed field (all states except waiting/superseded/completed/no-action, which already carry it or have nothing to quote).
- **/feedback opens an ask modal.** The command now pops a question box (one paragraph field) instead of printing instructions — submitting it opens the DM, creates the session with the text in hand, and starts the review immediately. A stray owner DM with no session gets a "run /feedback" pointer instead of silence.
- **Embed declutter.** The raw Latest tail hides once structured plan/questions render (it was echoing them verbatim); revisions replace plan/questions from the trailing window so answered questions clear instead of lingering; question parsing drops thinking-aloud fragments (min length + complete-sentence rule, agent instructed accordingly).
- **Fresh context on new input.** Any new DM or modal answer resets the embed to "Processing new input…" — old plan/questions/prose/verdict flags clear instead of lingering next to the fresh context. Stale NO-ACTION verdicts arriving after newer input are ignored rather than closing the session.
- **Assessment honesty + exits.** No Action presses are visibly acknowledged (ephemeral note + Assessing status in the embed), repeat presses are refused while one runs, and a verdict-less finish hands the prose back instead of hanging. Review descriptions now surface the live phase label, so Processing/Assessing states are visible. /feedback with a live slot offers Abandon & start fresh (marked superseded, history `closed`) instead of dead-ending; FAILED gains Retry review.
- **Execution-phase embed honesty.** Approving now clears the review-era prose/plan text so Latest starts fresh instead of echoing the stale plan; the Allow button label and "waiting on permission" line stringify safely (no more `[object Object]` — the server sends a `{messageID, callID}` object there); resolving a permission rewrites the waiting line to `Permission allowed/denied`. Event handling is serialized through a per-process chain — concurrent stream events used to read-modify-write the store out of order, clobbering progress lines and freezing stale buttons into the embed.
- **Prompt sends retry transient failures.** `session.prompt` now retries up to 3x with backoff on `fetch failed`/conn-refused-style errors (the 15:41 "Execution failed to start · fetch failed" was a loopback blip with a healthy server) and names the systemd unit in the final error; busy/concurrency rejections still fail fast into the hold-DM path, never retried.

## UNDEPLOYED — Feedback bot: owner-only OpenCode sessions via /feedback (2026-11-11)

### Added
- **`/feedback` (owner only):** opens a DM; that DM is one OpenCode session on the PHMC Forms repo. One active session at a time; state persists to `data/bot-state/feedback.json` (survives `bot:deploy`) and reattaches on restart.
- **Two-phase flow:** review (Plan agent, read-only, questions in the embed, DM answers revise it) then execute (Build agent on Approve). Pause/Resume, Allow/Deny permission gate, tests → `pre-feedback-<timestamp>` tag → commit → push to `source` (repo has no `main`; branch is `FEEDBACK_DEPLOY_BRANCH`), two-confirm Revert, Complete Session.
- **Mandatory CLAUDE.md gate:** the initial prompt requires reading `agent/CLAUDE.md` first; the controller aborts visibly if an edit/shell event precedes the observed read.
- **One-message UI:** `services/feedback/render.js` renders `{state,data}` → `{embed,components}` (limits-enforced, isolation-tested); `samples-output.json` holds per-state samples vs the reference images. `FEEDBACK_DRY_RUN=true` simulates streams without the model.
- **Wiring:** `DirectMessages` + `MessageContent` intents (+ `Channel` partial), `fb:<action>:<sessionId>` buttons, owner-checked everywhere.
- **Ops:** `discord-bot/opencode-serve.service` (loopback `opencode serve`), `.env.example` `FEEDBACK_*`/`OPENCODE_URL` vars, `README-feedback.md`, `tools/feedback-{verify,render-test,samples,dryrun}.mjs`.
- **Verified:** `check-bot-imports` clean (169 modules); render tests green; samples + dry-run outputs match the reference images. SDK surface verified against `@opencode-ai/sdk` 1.19.5 docs (v1 `createOpencodeClient`, `session.*`, `app.agents`, `config.providers`, `event.subscribe`); `--live` agent/model check + `opencode models` pinning still to run on the VPS.
- **Not yet (VPS side, owner call):** Message Content Intent flip in the portal (user confirmed); then `node tools/feedback-verify.mjs --live` + `opencode models` pin. Code is live but `/feedback` fails closed until then.
- Deployed via `npm run bot:check` (exactly the 14 intended diffs) + `npm run bot:deploy` — mirror clean except the expected `package-lock.json` rewrite from the VPS `npm install` (which installed `@opencode-ai/sdk`); `phmc-bot` restarted online, SDK present, boot log clean (only pre-existing AGH fetch errors).
- **VPS setup DONE 2026-11-11:** `opencode` 1.19.5 installed (matches SDK), full repo cloned at `/opt/phmc-feedback/phmc-forms` (`source` @8da3dab), `opencode-serve.service` installed/enabled/active on 127.0.0.1:4096, `opencode-go` key merged into `/root/.local/share/opencode/auth.json` (600, other entries preserved), `opencode models` confirms `opencode-go/muse-spark-1.3-contributor`, `--live` verify all green (session/app/config/event surface, plan+build agents, provider).

## DEPLOYED 2026-11-10 — `drdb-sent` flag on LEO reports

### Added
- **New `services/drdbAudit.js`** (dependency-free, import-checker safe): the `drdb-sent` audit trail. The automatic LSPD send (opted-in coroner report → `lspdPortalFormQueue` live filing) appends one `source=portal-send` line to `data/leo-report-access.log`; the flag is **derived from that log at read time, never persisted** — pre-DRDB reports (e.g. the 10/29 Wayne Stryker filing) correctly read `false`, and officer views never set it.
- **LEO API responses gain top-level `drdb-sent`**: list rows (`leoReportRows`), single-report read, and cached-view audit — all via an mtime-cached, tail-bounded log scan (`getDrdbSentSet`).
- **`lspdPortalFormQueue` success path** appends the send line (recipient, form URL/reference included). Best-effort: logging can never fail the send.
- **Docs:** `setup/DEVELOPER-API.md` §5.1/§5.5 document the flag.
- **Tests:** new `tests/drdb-audit.test.js` (11 tests: line format, log-injection stripping, derivation rules, file set + cache).
- Deployed via `npm run bot:check` (exactly the 3 intended diffs) + `npm run bot:deploy` — mirror clean, `phmc-bot` + `morgue-api` restarted, LEO responses verified live with `drdb-sent` present. Pre-deploy sends (incl. the 10/29 Stryker filing) correctly read `false`; no resends — `sent` entities are terminal and the writer only fires on future sends.

## UNDEPLOYED — Quoted API keys broke bot loopback reads / false morgue-overdue alerts (2026-11-09)

### Fixed
- **Root cause of the false "Morgue Database Update Overdue" alerts:** the VPS `.env` quotes `MORGUE_API_KEYS` (`"label:key,..."`), the bot's naive `.env` loader keeps the quotes, and `firstApiKey` never stripped them — so every bot-side loopback call sent `"label:key` as the key, got 401, and the morgue monitor silently fell back to the RTDB copy (stale since dual-write off, latest 9/21) while the VPS file was hours fresh. Proven live: same fetch 401 before / 200 after stripping.
- **`stripKeyLabel` / `firstApiKey` (`services/apiKeyUtil.js`)** now strip surrounding quotes (mirrors the server's own parser). Fixes all 7 callers at once (morgue monitor, dashboard, morgue-add, death-record scan, stats commands).
- **Same tolerance** in `vpsReportMirror.js`'s local copy (trailing-quote case on single-entry values).
- **`systemMonitor.getVpsMorgueLatest` no longer fails silently:** warns on non-200 and on fetch exceptions instead of quietly taking the stale RTDB path.
- **Tests:** new `tests/apiKeyUtil.test.js` (7 tests: labels, bare keys, quoted values, empties).
- Deploy with `npm run bot:check` then `npm run bot:deploy` (whole tree) + `pm2 restart phmc-bot` is covered by the deploy.

## UNDEPLOYED — CASELINK retired and stripped (2026-11-09)

### Removed
- **CASELINK logic removed bot-wide** (owner removed from LSSD, bot deauthorized, portal non-operable; last CASELINK-posted request Oct 30). No web-app references existed.
- `autopsyRequestMonitor.js`: CASELINK poster branch, race-window re-search, and `postedByCaselink` flag writes gone. Fail-closed poster resolution stays (unresolvable poster still skips agency-topic creation).
- `deployAutopsyReply.js`: DM fallback to the CASELINK account replaced with honest skip; requester-webhook auto-step retired (always skips; manual sends via `/forward-autopsy-complete` unchanged).
- `requesterWebhook.js`: CASELINK copy/button/origin flag removed — neutral "Autopsy Records" payload only. Module retained for manual sends.
- `autopsyCompletionGuards.js`: `CASELINK_ACCOUNT` + `isCaselinkAccount` deleted; `isUnusableDmTarget` keeps the remaining template guards.
- `completionTemplate.js`: LSSD gov line no longer references the CASELINK portal. Comment touch-ups in `agencyForums.js`, `lspdAutopsyNotice.js`, `.env.example`.
- Historical records keep their `postedByCaselink`/`requesterPoster` values; all reads stay graceful. Verified: no in-flight `requesterWebhook` steps anywhere.
- Tests: `autopsyCompletionGuards.test.js` rewritten (caselink cases out); full suite 38 files / 322 green.

## UNDEPLOYED — LSSD crosspost placeholder-name fix (2026-11-09)

### Fixed
- **`searchLssdRequestTopic` no longer matches on placeholder names** (`discord-bot/services/deployLssd.js`): "Unknown" (and Doe variants, via `isNonIdentityPlaceholder`) can no longer seed the bare-name search term or verify a title match. A request identified only by a placeholder now fails closed (no thread, manual handling) instead of adopting a stranger's thread.
- **Root cause (LSSD #84490):** the Sep-30 Marchetti/Bates request thread collected 8 unrelated bot replies (Oct 24 – Nov 7) for four later "Unknown" cases (10425/10426/10438/10463). Each search fell back to the bare term "Unknown" and title-matched #84490; the wrong id was then persisted as those entries' `lssdRequestTopicId`, funneling every later ack/completion there.
- **Data repair:** cleared the wrong `lssdRequestTopicId: 84490` on 10425/10426/10438/10463 (all four fully complete, nothing pending — purely defensive). Posted replies stay as-is (bot cannot un-post; thread needs a manual cleanup if wanted).
- **Tests:** new `tests/lssd-request-search.test.js` (6 tests: stranger-thread rejection, own-thread hit, usable-name regression, John Doe parity, no-search empty case). Full suite: 38 files / 323 tests green. Covers LSSD/SADCR/DAO (all funnel through the one function).

## UNDEPLOYED — Multi-recipient fan-out (2026-11-08)

### Added
- **NEW `services/recipients.js`** (dependency-free mirror of `src/utils/recipients.js` — `src/` is not shipped to the VPS): `normalizeRecipients` (trim, drop empties, dedupe vs primary, cap 5), `MAX_EXTRA_RECIPIENTS = 4`.
- **`deployPM` fan-out**: one personalized PM per recipient (per-recipient BBCode variant from `scheduledReportsBBCode/.../variants`, base copy as fallback), grouped by forum (one login each). Per-leg status in `deployTargets`; retries skip already-`sent` legs. No-recipient / no-BBCode / single-recipient-no-credentials paths behave exactly as before.
- **`handleCoronerEmail` fan-out**: one queue entity per leg (`enqueueCoronerEmail` / `enqueuePortalForm` accept `idx`; idx 0 keeps legacy keys). LSPD legs file the native portal form with per-leg data; other legs get per-leg filled email templates.
- `check-bot-imports` OK (159 modules). Deploy with `npm run bot:check` then `npm run bot:deploy` after a staging fan-out test.

## DEPLOYED 2026-11-07 — CCTV restored (panel + API + scheduler + rebuilt fetcher)

### Restored
- **morgue-api CCTV routes** (`GET /api/cctv/cameras|search|cameras/:id|stats`, `POST /api/cctv/fetch`) — byte-faithful to the pre-retirement code, re-inserted between the roster routes and the saved-report store. Fail closed (`503`) until the fetcher writes its first data.
- **`services/cctvScheduler.js` + `index.js` wiring** — daily fetch tick back (5-min boot delay, 24h cadence, whole-tree SIGKILL on timeout — the 2026-07 OOM lesson kept).
- **Functions `getCctvData` + `triggerCctvFetch`** redeployed (both listed live in `europe-west2`).

### New fetcher (`cctv-script/fetch-all.cjs`)
- The Oct retirement deleted `/opt/phmc-bot/cctv-script/` (never in git, no backup). Rebuilt from a live authenticated capture: the site serves logs as DataTables server-side JSON (`GET /logs/populate?...&Type=Normal&fetch=<cameraId>&...` → `{draw, recordsTotal, recordsFiltered, data:[{id,message,date}]}`), so the new script is **pure HTTPS, no browser** (a few MB RAM vs the old headless Chromium that once OOM'd the box).
- **Auth = stored login session**: UCP SSO (password + recaptcha + OTP) can't fresh-login headless, so the script sends `CCTV_SESSION` (the `gta_world_cctv_english_session` cookie value) from `discord-bot/.env`. Expiry → exit 2 with `AUTH_EXPIRED`, scheduler posts the tail to bot-spam, owner refreshes the cookie. Same shapes out (`cameras.json`, `output/cctv-data.json` with `{name, latestId, logs}` + `metadata.lastFetched`), same scheduler-parseable stdout (`Cameras fetched: X/Y`, `Failed: N`, `New Total lines: N`, `#id name: n new entries, m stored`).
- **Deploy note**: `cctv-script/` lives OUTSIDE the `bot:deploy` mirror — synced by hand (`scp`, see `cctv-script/README.md`), whole directory only.

### Verified
- `check-bot-imports` OK (158 modules), `bot:check` showed exactly the 3 intended diffs, mirror clean, `phmc-bot` + `morgue-api` restarted online, `/api/health` ok, CCTV routes 401 without a key.
- **Pending (owner)**: install `CCTV_SESSION` in the VPS `.env` (3 steps in `cctv-script/README.md`), then run one `node fetch-all.cjs --headless` on the VPS — first run backfills full history (the site retains it).

## DEPLOYED 2026-11-06 — LSSD API access revoked with explicit 403 reason

### Changed
- **LSSD key (`lssd-pengu`) blocked, not deleted**: valid requests with that consumer label now get `403 Forbidden` + `Contact PHMC CORONER LEADERSHIP - ALYSON FROST / FR0STYDEV to restore access | BLOCKED: 02958e - This application is not authorized to use PHMC Tools` (LSSD staff request). New `services/apiConsumerBlock.js` (label matching, unit-tested); hooked into all three morgue-api key validators after the validity check, so forged keys still get the generic 401 and the block list never leaks. Env-overridable via `MORGUE_BLOCKED_KEY_LABELS` (default `lssd-pengu`).
- **Verified live**: no key → 401, bogus key → 401, real LSSD key → 403 + exact message on two routes. morgue-api restarted by the deploy.

## DEPLOYED 2026-11-06 — LSPD crosspost killed, portal filings re-enabled

### Removed
- **Dead-board LSPD forum surface**: completion crosspost (`crosspostAutopsyToLspd` + caller, vars, completion-text `lspdUrl` in 4 call sites), detection-time f=1361 topic creation in all 3 monitor paths (reuse-only removed — nothing reads the ids at intake anymore), LSPD ack replies in `sendAutopsyAcknowledgement`, both dead-board recovery sweeps + their heartbeat entries, LSPD logins from the DM retry paths. Completion text for LSPD now points at the records portal (no dead links).
- **Kept**: historic `lspdTopicId` values on entries (untouched), the `lspdTopicId || isLspdCase` completion gate (still routes the ME form), `ACK_FIELD_NAMES.lspd` (historical data), non-LSPD forum features using `FORUM_LSPD_*` creds (roster, PM monitors — separate scope).

### Changed
- **`LSPD_PORTAL_ENABLED=true` on the VPS** (was absent = paused): native coroner + ME form filings resume; queues were empty so nothing burst on restart. Verified live: bot online, new heartbeat runs without the retired checks, workers started, no errors (AGH dashboard errors are the known-dead VPS instance, unrelated).

### Audit
- Repo-wide grep: zero crosspost/inbox remnants outside tombstone comments; full suite 300/300, `check-bot-imports` OK, VPS mirror clean.

## DEPLOYED 2026-11-06 — LSPD inbox sends retired (forms + share links only)

### Removed
- **All three LSPD portal-mail sends**: coroner/mass-fatality notice queue (`deployCoronerEmail.js` LSPD path now files the native coroner-report form only), autopsy `lspdCrosspost` live step + retry sweep (resolve as retired/skipped, step names kept for dashboards), and the LSPD-targeted `dmSent` live + retry branches (skip before any dead-board login).
- **`sendPortalMessage` deleted** from `services/lspdPortal.js` (module keeps the session machinery the form driver files through); `LSPD_PORTAL_DRY_RUN` + `LSPD_PORTAL_GROUP_ID` env retired; `buildPortalNotice`/`portalSubject` removed from `lspdReportRoute.js`; `buildAutopsyNotice`/`buildAutopsySubject` removed from `lspdAutopsyNotice.js` (target predicate + recipient kept for the ME form); `coronerEmailQueue` portal channel dropped (forum PM only); startup `retryFailedLspdCrossposts` marks historic `failed` entries `retired` so the tick goes quiet.
- **Kept untouched**: native coroner-report + ME form filings (still kill-switch gated), share links, LSSD/SADCR/DAO forum PMs, legacy forum crosspost to LSPD f=1361 (dead board, out of scope).

### Audit
- Repo-wide grep: zero references to any removed symbol outside intentional tombstone comments; full suite 300/300, `check-bot-imports` OK, VPS mirror clean.

## DEPLOYED 2026-11-06 — Before/after snapshots on portal deliveries + receipt detection

### Added
- **`services/deployLogger.js` `DeployProgressEmbed.snapshot(caption, imagePath)`** — posts a captioned screenshot as a separate follow-up message (never an embed edit — Discord drops attachments on embed-only edits). Best-effort: missing/oversize files are skipped with a log line, never thrown.
- **Form queue (`services/lspdPortalFormQueue.js`)** posts before-submit + after-submit snapshots on success, before-only on dry-run/failure. **Coroner-email portal branch (`services/deployCoronerEmail.js`)** posts before/after snapshots the same way.
- **Mail driver (`services/lspdPortal.js`)** and **form driver (`services/lspdPortalForms.js`)** now return `beforeScreenshot` (+ `screenshot` after submit) so the queue/worker layers have both moments. Verified live with a TEST snapshot pair in the log channel (no portal send).
- **`services/lspdPortalForms.js` `detectReceipt()`** — post-submit confirmation keys on receipt markers (`STATUS Received` + `FILED`, CR-style or request-ID reference) instead of URL-prefix matching, which read every at-path receipt as "still on the form" (false-negatives; a retrying queue would file duplicates). Reference returned for traceability.

### Tests
- **`tests/lspd-portal-forms.test.js`** — receipt detection: exact ME receipt URL + body from the live TEST filing, coroner receipt strings, negatives (blank form, validation errors, empty input). Full suite 309/309, `check-bot-imports` OK, VPS mirror clean.

## UNDEPLOYED — `/forms-stats` replaces `/autopsy-stats` (per-staffer report image)

### Added
- **`commands/forms-stats.js`** (new, owner-only) — per-staffer saved-report breakdown with a generated summary image (table + totals + monthly chart, attached + fail-open ImgLink URL like `/card`). Options: `type` (all coroner reports by default; autopsy / coroner-report / death_record / coroner_email / mass-fatality), `period` (last-3 / last-6 / last-12 / year-to-date / all-time) and explicit `from`/`to` (YYYY-MM, overrides period). Old `/autopsy-stats` request-pipeline view removed per leadership call (1a).
- **`services/formsStatsImage.js`** (new) — SVG + sharp PNG renderer (no browser needed); caps at 24 months and top-15 staff + Other row.
- **`morgue-api.js` `GET /api/reports/attribution`** (new, above `/:author/:key`) — server-side per-person per-month aggregation over the VPS store (`forms`/`from`/`to` query; examiner = coronerEmployee/phmcEmployee, fallback author). Includes ALL authors (no leadership exclusions — owner-only leadership breakdown).

### Changed
- **`index.js`** — registers `forms-stats` instead of `autopsy-stats` (slash-command PUT replaces the old command on next restart). `PHMC_COMMANDS` trim list untouched.
- **`services/autopsyRequestMonitor.js`** — comment only (drop `autopsy-stats` from the `caseState` readers list).

### Removed
- **`commands/autopsy-stats.js`** deleted (request received/processed stats + ME assignments view gone with it).

## DEPLOYED — LSPD portal delivery PAUSED (verified live: sends hold in retry)

### Changed
- **`LSPD_PORTAL_ENABLED` kill-switch (default OFF):** the LSPD portal can't add new users, so automated delivery is paused until further notice. Sends fail retryably into `retry_queued` (no Discord spam, no session alerts); the first sweep after re-enable delivers everything held. Web preview/guide/share-links untouched (manual sends to existing members still work).

### Changed
- **New `services/reportLink.js`** — `portalReportUrl` prefers short `#/r/` links via `shortLinksByReport`, falling back to long links (never fails closed on shortening). Wired into coroner-email + all autopsy portal branches (live + retries).
- All 1,745 stored reports backfilled (`tools/backfill-share-codes.mjs`, VPS debug scratch, since removed).

## UNDEPLOYED — LSPD autopsy completion via the Community Portal

### Added
- **`services/lspdAutopsyNotice.js`** (new, dependency-free, unit-tested) — `isLspdAutopsyTarget` (request faction/title-tag wins, report dept is a hint), strict `autopsyNoticeRecipient` (character name or fail-closed), `buildAutopsySubject` (private-safe) and `buildAutopsyNotice` (one notice per completion, batch case numbers listed).
- **`tests/lspd-autopsy-notice.test.js`** — 5 tests green.

### Changed
- **`services/deployAutopsyReply.js`** — the `lspdCrosspost` step and the LSPD-targeted `dmSent` branches (private `pmForum=lspd`, web-forms `agencyForum=lspd`) now send portal notices as the group instead of phpBB topic/reply/PM. Step names, progress labels, two-phase tracking, deferral rules and the CASELINK skip are unchanged; recipient mismatches and unlinkable reports fail (retryable), never guess. Completion records now persist `reportAuthorId`/`reportKey` so retries can build deep links.
- **`services/deployLspd.js`** — `retryFailedLspdCrossposts` converts to portal notices (recipient + identity resolved from the entry; pre-portal failures without either stay failed for manual review).
- Interactive picker path (`deployInteraction.js`) intentionally untouched — operator-driven, out of scope.

### Ops notes
- Same `LSPD_PORTAL_DRY_RUN` gate and session-alerting as coroner notices. NOT YET DEPLOYED (dirty tree).

## UNDEPLOYED — LSPD coroner/mass-fatality reports via the Community Portal

### Added
- **`services/lspdReportRoute.js`** (new, dependency-free, unit-tested) — the single "is this an LSPD Coroner or Mass Fatality report?" home: `isLspdPortalReport` (formId `coroner-report`/`mass-ftality-test` + department normalising to `lspd`), `buildReportUrl` (fail-closed `#/report/<author>/<key>`), `portalSubject`, `buildPortalNotice` (markdown-lite notice, no BBCode).
- **`services/lspdPortal.js`** (new) — portal delivery driver over the daemon browser (CDP): sends AS the PHMC Forensic Medicine liaison group (`LSPD_PORTAL_GROUP_ID`), exact-single-match recipient resolution (never guesses), `checkPortalSession` health probe, throttled Discord session-renewal alert (6 h) with the re-capture runbook.
- **`tools/capture-lspd-session.mjs`** (new, local-only) — manual re-capture helper: headed Chrome, snapshots until you type `done`, prints the VPS install command.
- **`tests/lspd-report-route.test.js`** — 7 tests green; `bot:imports` OK (151 modules).

### Changed
- **`services/deployCoronerEmail.js`** — `handleCoronerEmail` routes LSPD coroner/mass reports to a portal notice entity (fail-closed when the link can't be built); `deliverCoronerEmail` accepts `channel:'portal'` and drives `lspdPortal.sendPortalMessage` (dry-run aware). All other departments keep the legacy phpBB path untouched.
- **`services/coronerEmailQueue.js`** — entities carry `channel`/`notice`/`reportUrl`; enqueue validates per-channel bodies; worker passes them through. Sent portal threads mirror to `coronerEmailUrl` as before.
- **`.env.example`** — `LSPD_PORTAL_DRY_RUN` (default true), `LSPD_PORTAL_GROUP_ID`, `LSPD_PORTAL_SESSION`, `PHMC_SITE_URL`.

### Ops notes (read before enabling)
- Session lives at `/opt/phmc-bot/lspd-portal-session.json` (chmod 600, outside the bot mirror — `bot:deploy` never touches it, never in git). Seeded 2026-10-29 from a manual login.
- Rollout: deploy with `LSPD_PORTAL_DRY_RUN=true` first — entities resolve + fill and land terminal `dry_run`, proving the path without submitting. Then set `LSPD_PORTAL_DRY_RUN=false` on the VPS `.env` + restart for live sends.
- Session expiry → throttled Discord ping to the developer with renewal steps; entities retry on backoff until renewed.
- NOT YET DEPLOYED — the working tree has pre-existing unrelated changes; `bot:deploy` refuses a dirty tree. Reconcile, then `bot:check` + `bot:deploy`.

## 2026-10-29 — `/card` image URLs via ImgLink (`Coroners` album)

### Changed
- **`services/imageProxy.js`** now uploads through the `uploadImageProxy` callable to **ImgLink.cc**; `service` is sent as `imglink` and ignored server-side. The API key stays in the Cloud Secret (`PHMC_CONFIG → IMGLINK_API_KEY`) — no new bot env var.
- **`services/cardGenerator.js`** — `uploadCardImage()` passes `imglink`; fail-open unchanged (native attachment always delivered).
- **`commands/card.js`** — log label is now "(+ImgLink URL)".
- **`.env.example`** — comment block updated; ImgBB/Imgur are retired.

### Deployed
- Whole-tree `npm run bot:deploy` — `[bot-parity] [OK] tree mirrored; VPS matches the repo.` `npm run bot:imports` passes (149 modules). The mirror also published the tree's pre-existing in-flight bot work, on owner approval.
- `/card` now returns an ImgLink URL (or the native attachment when the proxy fails).

## 2026-10-24 — morgue-api: scoped developer keys (LSPD DRDB)

### Added — morgue-api (deployed via `npm run bot:deploy`)
- **`MORGUE_REPORTS_API_KEYS`** — morgue-only read keys, accepted by `/api/morgue`, `/api/morgue/drug` and `/api/morgue/:caseId` only; `401` on LEO, agency credentials, rosters, saved reports and every write route.
- **LEO department scopes** — `LEO_REPORTS_API_KEYS` entries may be `label:agency:key` (`lspd`, `lssd`, `sadcr`, `dao`, `lsfd`, `saaa`). A scoped key forces the list to that department (ignores `?agency=`, returns `agency`/`agencyLocked`), and opening/auditing another department's report returns `404`. Unscoped LEO keys are unchanged.
- **Issued LSPD DRDB keys** (values live only in the VPS + local `.env`):
  - `lspd-drdb-morgue` in `MORGUE_REPORTS_API_KEYS`
  - `lspd-drdb-leo:lspd` in `LEO_REPORTS_API_KEYS`
- Developer reference: `setup/DEVELOPER-API.md` (API consumers only; no key-management section).

### Key management (maintainers)
- **Location:** `/opt/phmc-bot/discord-bot/.env` on the VPS, then `pm2 restart morgue-api`.
- **Generate:**
  - morgue: `node -e "console.log('pmc_morgue_' + require('crypto').randomBytes(16).toString('hex'))"`
  - LEO: `node -e "console.log('pmc_leo_' + require('crypto').randomBytes(16).toString('hex'))"`
- **Add morgue-only:** `MORGUE_REPORTS_API_KEYS="label:pmc_morgue_xxx"` (comma-separate multiple).
- **Add LEO:** `LEO_REPORTS_API_KEYS="label:pmc_leo_xxx"` for all departments, or `label:agency:pmc_leo_xxx` (e.g. `lspd-drdb-leo:lspd:…`) for one.
- **Rotate:** append the new key → restart → migrate the consumer → remove the old key → restart.
- **Revoke:** remove the entry → restart; in-flight requests fail with `401`.
- Keys are never committed or shipped to a client. LEO keys are rejected on morgue/roster/agency/write routes; morgue-only keys are rejected on LEO.


## 2026-10-24 — Dependency + runtime patch pass (Node 22, npm advisories, Chromium, OS)

### Security
- **Node.js 22.23.4 confirmed current** for the 2026-10-21 coordinated release (CVE-2026-111497 Brotli RCE, CVE-2026-105482 DNS NUL truncation, CVE-2026-106069/106072 TLS hostname bypasses, CVE-2026-105481, CVE-2026-106074, CVE-2026-106073). No runtime change needed.
- **`npm audit` on production deps: 2 high → 0.** `body-parser` 1.20.7 → 1.20.9 (GHSA-27r3-jxmh-p828, DoS via trailing bytes after a compressed body, reachable through morgue-api's `express.json()`); `undici` 6.28.1 → 6.29.1 (GHSA-4qv8-2p9j-2685, GHSA-xjj6-f33q-929c, pulled in by discord.js / @discordjs/rest).
- **Playwright 1.61.1 → 1.64.1 and Chromium 149.0.7827.55 → 156.0.8078.4.** The forum browser had drifted six Chrome majors behind while rendering forum content under `--no-sandbox`. Profile backed up before the restart; bot reattached via CDP, logged in on Chrome 156 and saved the session.
- **Cloud Functions:** `body-parser` 2.3.0 → 2.4.0 (same advisory), `firebase deploy --only functions` complete.
- **OS:** 72 pending Ubuntu updates applied; kernel 7.0.0-31 → 7.0.0-38 and glibc activated by reboot; `pm2 save` refreshed first.
- **nginx 1.28.3** is in upstream's affected range for CVE-2026-15176 / CVE-2026-97205, but Ubuntu has no fixed package yet and the config uses none of the vulnerable directives (`alias`+`rewrite`, AIO+SSI, `map`, HTTP/3, TLS) — documented, monitored.
- Full matrix: `docs/vps-vulnerability-review-2026-10-24.md`.

## 2026-10-24 — morgue-api: forwarded-header IP spoofing fixed (scanner sweep)

### Security (deployed via `npm run bot:deploy`)
- **`X-Forwarded-For` is no longer trusted from the left.** `getClientIp()` took the leftmost hop, which the client controls, so a scanner sending `X-Forwarded-For: 127.0.0.1` was treated as loopback — a trusted IP — and skipped the keyless-404 instant ban, the strike counter and the suspicious alert. On 2026-10-24 one host (`185.177.72.29`) made 747 requests in 25 s through nginx and was never banned; 418 distinct paths and 118 suspicious detections were logged against `127.0.0.1`. Nothing was accessed (only `/api/health` returned 200).
- **New `discord-bot/services/clientIp.js`** (unit-tested, 12 cases): honours forwarded headers only from a trusted proxy (loopback/nginx, plus `MORGUE_API_TRUSTED_PROXIES`), prefers `X-Real-IP` (nginx overwrites it), and reads XFF chains right-to-left. A direct peer sending either header is now an **instant permanent ban** (`SPOOF-forwarded-header`) plus a Discord alert; valid API keys stay exempt (Cloud Functions egress from shared GCP IPs).
- `tests/clientIp.test.js` added; full suite 222/222.
- **Infrastructure (same day):** public `ufw` allow for 3001 removed (loopback + `tailscale0` only — nginx serves `/api/` on 80); nginx `limit_req` on `/api/`; fail2ban installed with an sshd jail; SSH password auth disabled and root limited to key auth; firewall denies for `185.177.72.29` and `195.178.110.137`. Off-box callers (`functions/.env.example`, `tools/report-view-log.mjs`, `setup/morgue-logger.ps1`, PoC docs) now use port 80.
- Full write-up: `docs/morgue-api-ip-spoofing-2026-10-24.md`.

## 2026-10-22 — October 2026 Node.js security patch + dependency audit

### Runtime
- **VPS Node.js 22.23.1 → 22.23.4**; `phmc-bot` and `morgue-api` restarted and verified on 22.23.4. This covers CVE-2026-111497 (Brotli RCE), the TLS hostname bypasses, DNS NUL, and the bundled undici/OpenSSL/c-ares updates.

### Dependencies (bot)
- `sharp@0.35.4 → 0.35.5` (librsvg CVE-2026-96889).
- `express@4.22.2 → 4.22.3` + `proxy-addr@2.0.8` override (IP-spoofing critical).
- `firebase-admin@14.2.0 → 14.5.0`; `@fastify/busboy@3.2.4`; `brace-expansion@1.1.21`.
- `npm audit`: **0 vulnerabilities**. Bot tree redeployed; VPS `npm install --omit=dev`; services healthy.

## 2026-10-21 — Saved form/report view embeds

### Added — morgue-api (deployed via `npm run bot:deploy`)
- **Saved form/report opens now post a bot-native embed** (PHMC Bot) to `NOTIFY_CHANNEL_FORM_VIEWS` (default `1455291752327024721`; the report-saving-log fallback was removed). Covers generic `/api/reports/:author/:key/view` and LEO live/cache views.
- Embed: Form, Author, Character, OAuth, Source, IP, UID; title `Form Viewed` / `LEO Form Viewed`. Two-minute dedupe per viewer+report; audit files remain one line per open.
- Generic view endpoint now accepts the client character hint and records `viewerSource`/`verifiedViewer`, matching the LEO audit identity rules.

## 2026-10-21 — LEO panel access audit (Discord embed + file)

### Added — morgue-api (deployed via `npm run bot:deploy`)
- **`POST /api/reports/leo/access`** — records one panel-open event and posts a **bot-native Discord embed** (same PHMC Bot client as `/api/notify`, no webhook URL) to `NOTIFY_CHANNEL_LEO` (fallback `NOTIFY_CHANNEL_ADMIN`). Embed shows Character, OAuth, Source, IP, UID and timestamp; footer `PHMC Bot • LEO access audit`.
- **`data/leo-panel-access.log`** — JSONL, 5 MB rotation + one spare. Metadata only; identity comes from the Auth-derived `x-phmc-requester-*` headers set by the `logLeoPanelAccess` callable, never from the request body.
- **Non-PHMC character names**: the Auth claim only carries a PHMC character; LEO users commonly have none. The callable forwards the client's active character as a sanitized display hint (`characterName` body field / `viewer` query parameter for live opens), **and the Auth custom token now carries `displayCharacterName`** (active → PHMC faction → first OAuth character) which `morgueRequesterHeaders` prefers. Audit lines record `viewer`, `viewerSource` (`client`/`claim`/`none`) and `verifiedViewer`; UID/OAuth remain server-derived and authoritative. This covers both panel opens and per-report views.
- Per-report opens remain in `data/leo-report-access.log`; panel access is a separate event. The notify transport is fail-closed: if Discord is offline the audit line is still written and `notified:false` is returned.

## 2026-10-21 — Saved-report store version signal for live feeds

### Added — morgue-api (deployed via `npm run bot:deploy`)
- **`appMetadata/reportsDataVersion`** is now bumped whenever the VPS saved-report store changes: single write, delete, bulk write (one bump per batch) and restore. The migration UI listens to this node and drops its IndexedDB feed cache, so a report saved by one user appears for everyone without waiting for the 5-minute TTL. The bump is best-effort and never fails the report operation.
- **Post-deploy VPS mirror** (`services/vpsReportMirror.js`, called from `deployStatus.markReportComplete`): after a real topic/PM/autopsy deploy succeeds, the bot re-reads the final queue record + `scheduledReportsBBCode` and POSTs the authoritative copy to `/api/reports`. Dry-run/simulated and skipped deploys are excluded. The web app's save-time mirror remains for instant feed updates; this is the durable post-success copy and covers old builds or a failed client mirror.
- Deployed with the whole-tree bot deploy; `morgue-api` restarted (uptime confirmed). Verified: the node is present and the Thayse Klenner mass report is now served by `/api/reports/recent`.

### Why
- Deployment-tracked saves live in RTDB `scheduledReports` (bot queue) and were never copied to the VPS feed store. The web side now mirrors queued saves to `/api/reports` on save; this version node is what tells other open clients to refetch. See the web `changelog.md` entry for the full root cause.

## 2026-10-19 — Mass completion matcher: report OOC ↔ body IC-name cross-match

### Fixed
- **A body filed without `((OOC))` can now be completed by a report that puts its IC name in the OOC slot** (`services/deployAutopsyReply.js` → `matchCollectionCase`). Mass intake accepts a real IC name with no brackets and stores it as `cases/<i>/name` with `oocName: ""` (the 2026-10-15 change). The MEs then file the report the normal way — `John Doe ((Luis Angel))`, `Unknown ((Ryan Kennedy))` — so the report's OOC holds what the body stored as its NAME. The matcher only compared OOC→OOC and name→name, found nothing, and quarantined **every** report: `Shared collection #10392: report OOC="Luis Angel" name="John Doe" matches no body — quarantined`. No body ever got `completedAt`, so the overdue monitor kept alerting (t=10392 HUA3 Brawl — all four reports were submitted).
  - Pass 1 (report OOC) now also matches the body's **name** when the body has no usable OOC; pass 2 (report name) symmetrically matches the body's **OOC** when the body has no usable name.
  - Placeholder identities never participate either way (`isNonIdentityPlaceholder`: DOE/`Unknown`/`N/A`), and the existing prefer-uncompleted → highest-caseNum tie-break is unchanged.
- Checks: `npx vitest run` 178 passed (new `tests/matchCollectionCase.test.js`, 8 cases: the HUA3 shape, legacy OOC/IC matches, placeholder guard, uncompleted-twin preference, multi-entry lookup).

### Recovered
- **t=10392 (Case 545, HUA3 Brawl) closed.** The four bodies' reports were already posted in the case thread (`p=25720/25733/25734/25739`), but completion was quarantined by the matcher above. Marked `cases/0..3/completedAt` + stored the report BBCode (`completedBbCode`) for the three reports still in RTDB, set the collection-level `completedAt`, and released the four ME rotation slots. The overdue alert clears on the next monitor pass.
- **Gap noted:** the deferred SADCR completion + combined report was never posted (the completion never ran; `sadcrCrosspostStatus` stays `pending`), and **Hector Angel's saved report no longer exists in RTDB** (only its posted reply `p=25720`), so his body has no `completedBbCode`. Sending the agency batch needs his report recovered from the forum first.

## 2026-10-18 — LEO forwarded-report feed + audited opens

### Added — morgue-api (deployed 2026-10-20 via `npm run bot:deploy`)
- **`GET /api/reports/leo`** — forwarded-report feed for the new platform: scans `data/saved-reports`, keeps only reports whose values carry `ReportRequested: true`, newest first. Paginated (default 50, max 100), optional `agency` + `q` filters. Returns lightweight rows with `department`, `requestingOfficer`, `decedentName`, `timestamp`, `updatedAt`.
- **`GET /api/reports/leo/:author/:key`** — reads one forwarded report **and writes the access audit line before returning the payload**, so a live open is always attributed.
- **`POST /api/reports/leo/:author/:key/view`** — audit-only path for cache hits (the client serves the IndexedDB copy instantly and still records the view).
- **`data/leo-report-access.log`** — append-only, 5 MB rotation + one spare: `time | viewer | oauth | uid | report | title | agency | source=live|cache | ip`. Identity comes from the Firebase callable's `x-phmc-requester-*` headers (verified Auth claims), never client input; the same line is written to console/pm2.
- **Deployed 2026-10-20** with the whole-tree bot deploy (parity `0` pending after sync; `morgue-api` restarted). Verified live: `GET /api/reports/leo` → 200 / 466 forwarded rows, audited read + cache-view lines both appended to `data/leo-report-access.log`.

## 2026-10-18 — Morgue dates: day-first month names parse (same-name tie-break)

### Fixed
- **`parseDate()` now understands the autopsy request template's DATE OF DEATH format** (`14/OCT/2026`, `14-Oct-2026 22:25`, `14 OCT 2026`) and a bare `YYYY-MM-DD` (time optional), in `services/deathRecordDraftCache.js`. It previously returned `NaN` for all of them, so `findMorgueRecord()`'s **closest-date tie-break was skipped** and the FIRST same-named record in the store won. Live effect (t=10392 HUA3 Brawl): the `Unknown (( Ryan Kennedy ))` body resolved to the oldest of the seven same-named records (May `#75003`) even after the correct Oct 14 record existed. With the reference date parsed, the tie-break selects the record nearest the request date (`#85282`).
- Impact is not limited to mass requests: every autopsy request stores its date as `DD/MMM/YYYY`, so any decedent sharing a name with an older morgue entry could match the wrong record (and therefore the wrong injury set / age / location in the web "Load Case" fill and the assignment panel).
- Checks: `npx vitest run` 158 passed (new `tests/morgueDateParse.test.js`, 6 cases covering the new formats, the legacy formats, and the same-name tie-break end-to-end).

### Data
- Added three `morgue-records` entries for the HUA3 Brawl decedents through the VPS morgue API (write path; the VPS `morgue-data.json` is canonical): `#85280 Unknown (( Luis Angel ))`, `#85281 Unknown (( Thiago Ferguson ))`, `#85282 Unknown (( Ryan Kennedy ))`. `morgueDataVersion` bumped so the web app refetches; bot restarted to reload the in-memory morgue cache.

## 2026-10-15 — Mass request intake: missing ((OOC)) no longer parks the whole request

### Fixed
- **A mass request whose bodies omit `((OOC))` is no longer parked whole** (`services/autopsyRequestMonitor.js` → `parseMassRequestBbcode`). t=10392 `[Mass autopsy Request] HUA3 Brawl [SADCR]` (4 real IC names — Luis Angel / Ryan Kennedy / Thiago Ferguson / Hector Angel — no `((OOC))` anywhere) was detected, then rejected per body ("missing ((OOC)) name — skipped"), so **0 bodies parsed and the request was written `caseState: 'skipped'`** — which also makes the detection loop skip it forever. That hard skip contradicted the legacy multi-decedent path, which already files these bodies and only records a `bodyWarning`. Now a body with a real IC name and no `((OOC))` is **filed on the IC name** with a `BODY n … ((OOC)) name missing — filed on IC name` warning; only genuinely unidentifiable names (DOE/UNKNOWN-style, via `isNonIdentityPlaceholder`) still need the OOC and are skipped. The morgue pre-match already resolves these from the IC name (t=10392 body 2 matches `Unknown (( Ryan Kennedy ))`).
- **A parked mass request is no longer silent.** The park path wrote Firebase + a stderr `[WARN]` and nothing else — no forum ack, no alert — which is why nobody knew about t=10392. It now also sends a `[Mass Autopsy Request PARKED — needs a fix]` notification to the bot-spam log channel with the topic link and reason.
- **`MASS_NAME_LINE_RE` no longer crosses a newline** — an EMPTY `1.) Decedent Name:` line was adopting the next field (`"2.) Gender: Male"`) as the decedent name. Same-line value only (`[ \t]*:[ \t]*([^\n]+)`).

### Added
- **Per-body `Type of Death: PK`/`Type of Death: CK`** is recognised inside a `--- BODY n ---` block and **takes precedence over the shared Section-4 sentence** (which stays the fallback for older posts). The line is being added to the forum template by staff; intake just reads it, so a body's type no longer depends on `((OOC))` or on `deriveBodyDeathTypes()` name-matching. An ambiguous value naming both ("PK/CK" — the template's own hint text) stays unresolved rather than guessing at one.
- **Body slices are capped at `SECTION 3`/`SECTION 4`** so an unnumbered `Type of Death:` (or any Section-3/4 line) can never be read as the **last** body's value.
- **A placeholder Section-4 `1.) PK/CK` value ("ANSWER") is dropped** (`shared.deathType = ''`), so ME panels/countdowns never render `Type: ANSWER`.
- **`tools/redrive-mass-request.mjs`** — re-arm a parked (`caseState: 'skipped'`) request for intake after its source post is fixed (dry-run by default; `--apply`). Refuses a live/terminal non-parked state so it can't re-file a duplicate.
- Checks: `check-bot-imports` OK; `npx vitest run` 149 passed (new `tests/massRequestBodyIntake.test.js`, 9 cases).

### Recovered
- **t=10392 HUA3 Brawl re-armed** after deploying this fix; the four bodies now file as one mass collection (Case Management topic + grouped assignment + SADCR crosspost + ack).

## 2026-10-14 — Autopsy completion: placeholder name match + CASELINK DM target

### Fixed
- **The completion flow's last-resort NAME match no longer accepts placeholders, and no longer completes more than one request.** A report filed as `decedentName: "Unknown"` (the morgue's unidentified/PK convention) missed the caseTopicId and OOC matches, so it fell through to the name lookup — and `isDoePlaceholder("Unknown")` was false, so the lookup matched **every** "Unknown" entry and the loop completed *all* of the open ones. Live effect (Hawick, 02:18–02:20): one body's report was written onto two unrelated stale duplicates (t=10076/t=10083), each created an LSPD crosspost (lspd 130085/130086), and their DM steps then failed hourly. New `nameFallbackVerdict()` (`services/autopsyCompletionGuards.js`) requires a non-placeholder name AND **exactly one OPEN** matching request; anything else is quarantined for supervisor triage (the report stays posted, the request is not completed).
- **The CASELINK DM target can no longer wedge the Recovery Sweep.** The fallback target was the literal `'CASELINK [BOT]'` while the guard that skips that account tested `'CASELINK [Bot]'` — a case-sensitive mismatch, so the bot really composed a PM to a username phpBB rejects ("not accepted by the forum"), the step stayed `failed`, and the sweep retried it forever (`t=10076/t=10083`). One canonical `CASELINK_ACCOUNT` constant plus case-insensitive `isCaselinkAccount()` / `isUnusableDmTarget()`, wired into **both** the live completion path and the retry path; an unusable target is recorded as a **completed/skipped** step (`Automated request — DM not needed` / `No valid DM target — skipped`), never a failure — so the sweep clears its marker and the hourly WARN stops.
- **Every placeholder-name gate in the reply path now uses the stricter predicate** (`doePlaceholders.isNonIdentityPlaceholder`): the reply-target lookup, the Case-Management search term, and the shared-collection per-body router (`matchCollectionCase`) all refuse a name that is a DOE marker *or* "Unknown" — a placeholder name is never a match key. Previously `t=10390` ("Akil Yazz ((PK))") had the flow searching Case Management for the literal `"PK"`.
- Checks: `check-bot-imports` OK (146 modules); `npx vitest run` 140 passed (new `tests/autopsyCompletionGuards.test.js`, 10 cases).

## 2026-10-13 — Mass PK/CK resolves per body (panel tags + wait windows)

### Fixed
- **A mass request's single Section-4 "PK/CK" line no longer applies one type to every body.** Requesters write sentences — `CK FOR ISABELA SALAZAR, PK FOR THE OTHER TWO` (Hawick, 3 bodies) — and that whole string was stored as `parsed.deathType` and read for every body, so the two PK bodies rendered as CK on the ME panel AND got the CK 72h wait window (`limitHoursFor()` keys off the first "ck" substring). New `deriveBodyDeathTypes()` (`services/autopsyRequestMonitor.js`) resolves ONE type per body — explicitly named bodies first, then catch-all phrases ("the other two" / "the rest" / "all"), then the leading token as the default — and intake now writes it to `cases/<i>/deathType`. Bodies it cannot attribute stay unresolved and fall back to the shared value (never a dropped field); a partial attribution adds a `BODY n … PK/CK unresolved` warning.
- **Per-body `deathType` is now the first read wherever a type tag or wait window is derived:** ME panel rows + countdown chips (`massAssignmentPanel.buildPanelAssignmentsFromEntry` → V2/legacy panels), `/outstanding-autopsies` rows and the dashboard rows (`outstandingAutopsies.js`, `dashboardManager.js`), single-panel refresh/heal of mass sub-cases (`singlePanelV2.js`), and the per-ME fallback assignment ping (joins the distinct codes a ME owns). Rows staged before this fix keep the shared sentence — no data loss.
- **Overdue monitor uses the tightest window across a mass batch** (`systemMonitor.js`): a CK body can no longer hide behind its PK siblings' 120h, and the alert lists the batch's types (`CK/PK`) instead of the shared sentence. Unattributed bodies fall back to the collection value, never the generic 48h default.
- `normalizeDeathType()` (`services/outstandingAutopsies.js`) collapses free text to CK/PK (and to `''` when it names both), so a sentence can never render as a badge/label.
- Checks: `check-bot-imports` OK (145 modules); `npx vitest run` 130 passed (new `tests/massPkckDeathType.test.js` covers the resolver, the windows and the panel rows).

### Migrated
- **Backfilled per-body `deathType` on the 8 mass collections staged before the fix** (20 rows across t=9951, 9974, 10161, 10167, 10174, 10308, 10328, 10383) — without this, existing rows had no per-body value, so every reader kept falling back to the shared sentence and the panel kept showing the old type *and* the old countdowns. Done with the new reusable `tools/backfill-mass-deathtype.mjs` (dry-run by default, `--apply` to write, `--topic <id>` to scope; writes only `cases/<idx>/deathType`, never anything else). Live panels fix themselves: the mass-panel watcher sees the Firebase change and edits the message in place (`#10383` refreshed to `PK / PK / CK` with 120h / 120h / 72h).

## 2026-10-10 — Autopsy decedent OOC dropped for hand-written titles (Case 538)

### Fixed
- **Single-body intake now fills the ((OOC)) from the request body when the title omits it.** A hand-written title ("Autopsy Request - John Doe - LSPD") parsed to name `"John Doe -"` / OOC `""` while Section 2 still held `John Doe ((Ilya Baranov))`; the case filed from the title alone, so the assignment panel showed `Decedent — John Doe -`, the morgue record `Unknown (( Ilya Baranov ))` (#84785) never matched (`NOT FOUND`), and the case title lost the identity. `autopsyRequestMonitor.js` single path now derives `caseName`/`caseOoc` with the body's one parsed decedent filling gaps the title left (never overwriting a title that already parsed), persists the corrected `name`/`oocName`, and uses them for the assignment embed + LSPD/agency crosspost titles.
- **`parseTopicTitle` strips the trailing separator** the greedy title regex captured (`"John Doe - "` → `"John Doe"`), so a title-only fallback never files a name ending in `-` (same shape seen on Case 536, `"Joe Russo-"`).
- Web app recovers the same OOC from `parsed.decedentName` defensively (see root `changelog.md`).
- Checks: `check-bot-imports` OK (145 modules).

## 2026-10-08 — Retire client telemetry + dead commands

### Removed
- **Telemetry intake + rollup deleted**: `POST /api/telemetry` + JSONL store removed from morgue-api; `services/telemetryRollup.js` + `commands/telemetry-now.js` deleted; startup wiring removed from `index.js` (both registration blocks). Hourly admin-channel rollup stops. Follow-up on the VPS after deploy: delete `data/telemetry.jsonl` (+`.1` spare).
- **Dead commands deleted**: `commands/autopsy.js`, `commands/user.js` (retired 2026-09-10, files kept until now), `commands/phmc-dashboard.js` (never wired). Stale commented import blocks removed from `index.js`. Ships with the normal whole-tree `npm run bot:deploy`.

## 2026-10-08 — Retire CCTV + dev protocols

### Removed
- **CCTV routes deleted from morgue-api** (`GET /api/cctv/cameras|search|cameras/:id|stats`, `POST /api/cctv/fetch`) + **`/api/protocols-dev`**. **Deleted `services/cctvScheduler.js`** (daily fetch + bot-spam posts) and its startup wiring in `index.js`. Follow-up on the VPS after deploy: delete `data/protocols-dev.json` + the whole `/opt/phmc-bot/cctv-script/` tree (data + fetcher). Ships with the normal whole-tree `npm run bot:deploy`.

## 2026-10-08 — Persistent morgue access audit

### Added
- **`data/morgue-access.log` (morgue-api):** one line per authenticated `/api/morgue*` access (`time method path → status (ms) requestedBy="character | oauth | uid" ip q`), appended in the request-finish middleware, rotated at 5 MB with one spare. Console/pm2 logs + the 200-entry in-memory activity log age out within days (which lost the 2026-10-01 burst attribution); this file is the durable who-accessed record. Anonymous/loopback probes stay in console/activity only. Audit writes are best-effort and never break responses. Ships with the normal whole-tree `npm run bot:deploy`.

## 2026-10-07 — /api/reports/recent for the migration UI

### Added
- **`GET /api/reports/recent` (morgue-api):** global newest-first feed across ALL report authors for the new `/migration-ui` records list. Always paginated (default 25, max 100; `limit`/`offset`/`formId`/`q` params), listing rows only (key/author/titles/timestamps — full payloads stay on `GET /api/reports/:author/:key`). Placed above `/:author/:key` so Express never parses "recent" as an author. Deploy with the normal whole-tree `npm run bot:deploy`.
- Checks: `check-bot-imports` OK (151 modules), full suite 134 green, `vite build` green.

## 2026-10-06 — CodeQL findings hygiene sweep (dead code)

### Fixed
- **62 `no-unused-vars` warnings cleared across 34 bot modules** (unused imports, dead helpers incl. `buildRefreshingEmbed`/`sendFaceDraftMessage`/`sadcrUrl`, write-only timers/flags, unused catch params → bare `catch`) + 3 tail `return;` removals (`autopsy-request.js`, `devPanel.js`, `testRunReporter.js`). Every deletion grep-verified to zero other references; exports and handler registrations untouched.
- **Checks:** `check-bot-imports` OK (151 modules), full suite 130 green. No behavior change intended — redeploy with the normal whole-tree `npm run bot:deploy` when convenient.

## 2026-10-06 — Retire Medical Records + Patient Files (new platform owns them)

### Removed
- **Deleted `services/deployMedicalRecord.js`, `services/patientIndex.js`, `commands/patient-search.js`.** No new medical forum deploys (f=97 entries out of `FORUM_MAP`), no new patient-index entries (3-day f=97 rebuild + deploy write-through gone, `patient-index` boot job removed), no `GET /api/patients` (morgue/roster/reports/forms endpoints untouched). Medical routing branches removed from `autoDeploy.js` / `deployExecutor.js` / `deployQueue.js` (coroner/topic/pm/autopsy routing intact); ER + Mental Health blocks out of `manage-forms.js` and `global-stats.js`; `MEDICAL_RECORD_*` env + boot validation removed. `data/medical-records-index.json` verified absent from disk — nothing to archive.
- **Functions:** `getPatientNames` callable removed (`functions/index.js`); `MORGUE_API_URL/KEY` kept for morgue + saved-reports proxies.
- **Checks:** `check-bot-imports` OK (151 modules), full suite 130 green. Existing `scheduledReports` medical rows drain via normal 24h cleanup; f=97 topics stay as read-only archive.

## 2026-10-06 — Autopsy-reply matched placeholder name to test collection

### Fixed
- **Anne Carter's "Jane Doe ((Trinity Dalton))" report tried to EDIT a Sept test reply in case #10166 instead of posting to real case #10329 (`deployAutopsyReply.js`).** The shared-thread fast path matched IC name "Jane Doe" against test collection #10161's body — every "John Doe" guard in the file was John-only, so Jane sailed through. All seven guards now use shared `isDoePlaceholder` (new leaf module `services/doePlaceholders.js`; monitor + panels refactored onto it, no more tripled regexes). With the fix the report falls through to forum search for "Trinity Dalton" → #10329 → fresh reply.
- **The "No form" edit failure was the fail-closed path working:** phpBB served no edit form for the stranger's old post, so the bot refused to overwrite a test reply with a real report. No code change needed there.

### Tests
- **Headless `matchCollectionCase` on incident fixtures:** (Trinity Dalton/Jane Doe) → null, (Jane Doe) → null, (John Doe) → null, real OOC "Test Account" → still hits 10161/1, real "Trinity Dalton" → still hits its own case. Deployed; the queued retry will resolve correctly on its next attempt.

### Fixed (follow-up, same incident)
- **Trinity Dalton never crossposted because its *completion* matched the same test body (`deployInteraction.js` staff-pick path).** After you picked #10329, the completion matcher hit #10161 case 1 on IC name "Jane Doe" (John-only guard again) and skipped as "already completed" — so no `completedAt`, no LSSD crosspost, no panel flip, no request-topic reply for case 533. Same one-line guard generalization. Alfonso's completion worked because his reply target resolved first and the caseTopicId scan is exact. Trinity's completion now needs a manual run (report is deployed-terminal, nothing re-triggers it) — see `/fix-autopsy refreshpanels` note below or ask for a `/complete-case`.
- **Recovered via one-shot (deleted after):** case 533 marked completed + rotation cleared, LSSD combined crosspost posted ([p=402508](https://lssd.gta.world/viewtopic.php?p=402508#p402508)), PHMC request-topic completion reply posted ([p=25602](https://phmc.gta.world/viewtopic.php?p=25602#p25602)), forum DM sent to topic poster Gregory Masario ("Benjamin Schiff" is not a forum user — the normal flow's poster fallback covers this), entry closed. First PHMC-reply attempt silently dry-ran (`replyToTopic` defaults to env dry-run; LSSD path posts live) — re-ran with `dryRun:false`.
- **`/fix-autopsy` gains `flippanels`:** flips posted panels of completed cases to their completed summary in place (reads Firebase truth at call time; registry refs cleaned on flip). Covers cases whose completion ran outside the normal flow (e.g. 10328/0, whose panel still showed outstanding after the manual completion above) — `/fix-autopsy name:10328 flippanels:true`.
- **`/fix-autopsy` topicId search crashed before doing anything:** the numeric-search wrapper faked a child snapshot without `ref`, so `child.ref.update(...)` threw `Cannot read properties of undefined (reading 'update')` — for name searches AND the new refresh/flip passes. Wrapper now provides the real ref.

## 2026-10-04 — Autopsy naming mangled by DOE placeholders (t=10328)

### Fixed
- **Requesters writing `(J. DOE)` instead of `((OOC name))` filed cases like "Trinity Dalton J. DOE ((DOE and DOE))" (`autopsyRequestMonitor.js`).** Two guards: `parseDecedentNameLine` now strips unidentified-person parentheticals (`(J. DOE)`/`(John Doe)`/`(Jane Doe)`) instead of gluing them into the case name, and the title-OOC fallback rejects DOE-ish candidates (`DOE`, `J. DOE`, `DOE and DOE`) via new exported `isDoePlaceholder` — unknown stays empty instead of adopting the placeholder. Multi-decedent requests now record `bodyWarnings` when a body has no OOC identity (same convention as the mass path).
- **Assignment itself was correct** (Anne Carter + Alyson Frost, neither on LOA) — only the naming was mangled, for both MEs' cases.

### Corrected live
- **`autopsy-requested/10328`:** display-only repair (names → "Trinity Dalton"/"Alfonso Murphy", `oocName` cleared, `bodyWarnings` set; assignment/ME/panels/completion untouched). **Forum case topics 10329/10330 still carry "J. DOE" in their titles — needs a manual forum rename** (bot never retro-fixes posted topics, per standing rule).

### Tests
- **Headless repro on the real 10328 BBCode:** before → `Trinity Dalton J. DOE`/ooc `""`; after → `Trinity Dalton`/ooc `""`, placeholder matrix (DOE/J. DOE/John/Jane Doe vs real names) all correct. Deployed via `bot:deploy`, bot clean.

## 2026-10-04 — Morgue match: name→OOC exact matching, placeholders excluded

### Fixed
- **Assignment embeds showed "POSSIBLY FOUND (low confidence)" for matchable cases (`singlePanelV2.js resolveMorgueStatus`).** The intake matcher never looked at morgue OOC names and let placeholder tokens (`john`, `jane`) count — "John Doe" could match "Unknown (( John Weber ))", while real "Trinity Dalton → Unknown (( Trinity Dalton ))" (#84217) only scored token-overlap. Now: DOE-aware normalization both sides, exact IC-name ↔ morgue-OOC hit returns FOUND, placeholder iterations (John/Jane/J/Doe/Unknown, incl. pre-fix glued "X J. DOE" names) never count. Verified live on VPS: Trinity Dalton → FOUND #84217, legacy "Trinity Dalton J. DOE" → FOUND #84217, Alfonso Murphy → FOUND #84216 (same-incident record, Rancho/Jamestown, +10s), "John Doe" → no match (line omitted).
- **`/fix-autopsy` gains `refreshpanels`** — re-resolves morgue for open paneled cases and upgrades posted panels to FOUND in place (upgrade-only, never downgrades/reposts/re-pings), e.g. `/fix-autopsy name:10328 refreshpanels:true`.
- Fixed a `decendent` typo that nulled every resolve (caught live by the VPS harness, not by syntax check — the try/catch converts it to silent null).

### Changed
- **New shared `services/statsExclusions.js`** (normalized name matching) — Roger Rose + Roger McFarlane are out of all stats.
- **`morgue-api.js` `/api/reports/stats` skips their report dirs at the source**, so byForm/byAuthor/byMonth/heat/total stay mutually consistent (McFarlane alone had 192 reports — server-side filtering was required; client-side alone would have left months/heatmap inflated ~11%).
- **`global-stats.js`:** "By Month (last 6)" → **"By Month (all time)"** (was `slice(-6)`); RTDB queue leg skips excluded authors too; footers note the exclusions.

### Tests
- **VPS mock-interaction run:** 1,491 reports (1,687 files − 202 excluded + 4 queued — exact), 75 users (77 − 2), no Roger in any Top list, 10 all-time months, exclusion footer present. `morgue-api` restarted on deploy.

### Fixed
- **Per-section Top lists showed one form type's count, not the author's total (`global-stats.js`).** The VPS leg did `sectionAuthors[section].set(author, count)` per form type, so the last-processed form won — Alyson Frost showed 51 (her Mass Fatality count) against 403 actual reports. Now accumulates (`+=`). Verified live: Alyson 392 (her exact coroner-section sum), Sadie Voss 234. Section subtotals were always correct; only the Top-attribution was wrong.

### Added
- **Automatic goodbye sync:** non-silent `/manage-forms disable` sets `appMetadata/goodbye` active naming that block; `enable` lifts the block (inactive when none remain). Derived from live managed-key states, so the excluded dev-only `physical_evaluation` can never trigger it. New `silent` boolean on enable/disable skips the goodbye update (tests/maintenance). `status` now also reports goodbye state.
- Audit pushes and the log-channel line record the `silent` flag.

### Tests
- **Live cycle (mock interaction, state restored):** disable mental-health → forms hidden + goodbye `{active:true, blocks:{mental-health:true}}`; enable → restored + goodbye lifted; version 175 → 177. Reply embeds carry the goodbye line ("ACTIVE (naming Mental Health)" / "lifted").

## 2026-10-04 — `/manage-forms`: Senior Leadership form-block toggles

### Added
- **New owner-only slash command `/manage-forms`** (`commands/manage-forms.js`) — enables/disables website form blocks from the PHMC Discord by flipping the per-form `isHidden` flag in RTDB. Three blocks: `er` (5 PHMC Staff forms; `physical_evaluation` deliberately excluded — it stays dev-only), `mental-health` (3), `coroner` (5). Subcommands `status` (all three blocks, live read), `enable <block>`, `disable <block>`.
- Writes use field-level `update({ isHidden })` (never whole-node `set`), then transaction-bump `appMetadata/formsDataVersion` so live site clients refresh. Missing form nodes abort before any write. Audit: `appMetadata/formVisibilityLog` push + best-effort bot-spam log embed.
- Registered in `index.js` (REST push + dispatcher) and added to the PHMC-guild trimmed set default; VPS `.env` `PHMC_COMMANDS` extended with `manage-forms` (env edit, restart — secrets-excluded path per deploy rules).

### Tests
- **Mock-interaction harness against live RTDB (one-shot, removed after):** `status` returned all 13 forms ENABLED with correct display names (incl. `patient_notes` = Commentary Notes); disable+enable cycle on `mental-health` wrote `isHidden=true` on all 3 then restored all to `false`, version 173 → 175 (+2), audit entries present, sibling form fields untouched.

## 2026-10-03 — Double-save race: identical reports both deployed (Emilio Ochoa)

### Fixed
- **Same report posted twice despite the 2026-10-02 dedup key (`Emilio_Ochoa_1791056250024` created topic #10325, `...2091` replied to it 30s later).** Both saves had byte-identical dedup identity, but `enqueue()` (`services/deployQueue.js`) checked `pendingDeployments.has(entityKey)` and called `set()` with three awaits in between (maintenance check, status write, progress embed). Two saves landing together both saw an empty map, armed two live timers under one map entry (queue dashboard showed 1 queued), and both fired. The slot is now **claimed synchronously** before the first await, with a monotonic sequence token: a concurrent save replaces the reservation (old timer cleared, old row trashed) instead of slipping past it; after the awaits, a superseded enqueue stands down without arming a timer, and timer callbacks verify ownership before firing. Same-key re-queues (e.g. maintenance-off rescan) no longer trash their own row.
- **Deploy-time duplicate guard no longer rewrites history (`services/deployMedicalRecord.js`).** The `recentPatientRecords` backstop ran ~3 min after queueing and trashed the OLDER row after it had already posted — `...0024` read `trashed_duplicate` even though it created #10325, while the duplicate reply stood. It now reads the older row first: if that copy already deployed, THIS copy retires itself (`trashed_duplicate`, no post) and the deployed row is left untouched; the trash write is also skipped when the older row is already gone.

### Corrected live
- **`scheduledReports/Jayden_Edelman/Emilio_Ochoa_1791056250024`:** status restored to `deployed` (it created #10325; the guard's post-deploy trash write had flipped it). Forum cleanup was done manually; no bot re-posts involved.

## 2026-10-02 — Duplicate deploy when a report is re-saved with a changed date

### Fixed
- **Same report posted twice (topics t=10319 & t=10320, John Doe / Ryan Schmidt).** The web app mints a new report key on every save, so a re-save is a second `scheduledReports` node; `enqueue()` is the only thing that collapses the two into one deploy, keyed by `getEntityKey()`. That key included `dateTime`/`dateOfDeath`, so a report queued first without a date (title `… - NO_DATE`) and re-saved with the date (`… 10/02/2026`) produced two different keys — neither replaced the other and both fired on their own 3-min timers.
- **New `services/deployEntityKey.js`** builds the key from the report's *stable* identity only: `author | formId | decedent/patient name | OOC | patientID | PM recipient | department`. Volatile fields a user edits between saves (`dateTime`, `dateOfDeath`, `caseNumber`) are excluded; `authorId` is added so two staff members saving the same decedent don't collide. Falls back to the report key only when there is no subject/routing identity at all.
- `deployQueue.js` now imports this pure helper (removed the inline copy). The replace-oldest path (`trashed_duplicate`) is unchanged — it now actually matches on re-save instead of missing.

### Tests
- **`tests/deployEntityKey.test.js`** — 11 dry-run scenarios (no network/Firebase/forum): the exact NO_DATE→dated regression collapses to one queue entry; changed case number still dedups; different decedent/OOC/author/recipient/patient stay distinct; empty-identity fallback; long-key hashing; malformed input. Full suite 111 passed.

## 2026-10-01 — Per-topic multi agency crosspost no longer overwrites body 1

### Fixed
- **Per-topic multi autopsies (`caseState: 'multi'` with distinct `cases/<idx>/caseTopicId`) now keep agency crosspost state per body.** `postLssdCombinedReply` accepts `caseIdx`; for non-shared collections it reads/writes `<fx>CrosspostReplyPostId/Url/BbCode/Ooc/Status` under `cases/<idx>` and tracks `lssdCombinedReply@<idx>` instead of the shared request-level `lssdCombinedReply`. This stops body 2 from editing body 1's LSSD/SADCR/DAO reply in place. Shared-thread mass collections keep their single collection-level reply.
- **Retry sweep understands `@<caseIdx>` steps.** It resolves the base step name plus that body's `completedBbCode` and stored reply id, and persists retry results back under the same case.

### Corrected live
- **t=10308 / LSSD #84490:** Jamarion Bates's completed report was missing after Stefano Marchetti's later completion edited the shared LSSD reply. Posted Jamarion's completion + report as a new LSSD reply and backfilled Stefano's existing reply under its own case (`cases/0` = p=401168, `cases/1` = p=401435).
- **t=10308 / PHMC DM:** also forwarded Jamarion's completion + report to the requester, Iris Winter, by PHMC forum PM (recorded under `cases/1/dmResend`).

### Deployed
- 2026-10-01 live: `npm run bot:imports` OK, `npm run bot:check` showed only `services/deployAutopsyReply.js` pending, `npm run bot:deploy` mirrored + verified with 0 pending; `phmc-bot` restarted clean.

## 2026-09-26 — Passive CK listener cold-start prime (kills boot fetch storm)

### Fixed
- **`startCKListener` replayed the entire `unprocessedCKs` backlog on every restart** — each backlog entry cost an RTDB point read + up to 2 VPS API point reads (reportKey, then baseReportKey fallback), re-running morgue matching for long-settled drafts (the 10-call burst at every boot). Now primes the known set from one indexed read; only genuinely new children fall through (same pattern as the scheduledReports cold-load guard). Gap arrivals during priming are buffered and drained, never skipped. The index still has no TTL (deletion unsafe) — backlog growth itself is unchanged, just no longer re-fetched.

### Added
- **`singlePanelV2.js` `resolveMorgueStatus`**: intake-time match rendered as `🧬 Morgue Record: FOUND (#caseId)` / `POSSIBLY FOUND (low confidence — cannot match date/name)` / `NOT FOUND`, on the summary panel and the full-detail view. Reads VPS-local `morgue-data.json` first (same source as web Load-Case), RTDB fallback, fail-closed omit on error. Verified headless against live data (Ruggiero→83649, Flowers→83687, Stryker→74955, unknown→NOT FOUND). Exposed a real gap: RTDB `morgue-records` is missing cases present locally (e.g. #83649) — sync to investigate separately.

### Fixed
- **`notifyAssignment` received `parsed.deathType` from the title parse — which never has that field.** Every single/multi intake panel computed `deadlineUnix` with the 48h default and omitted the Type line (Anne Carter's PK Case 528 showed a 2-day countdown). Now prefers `parsedBbFields.deathType` with the old value as fallback. Anne's live message repaired in place (deadline Sep 30 = assigned + 120h, Type: PK added).

### Fixed
- **`cctvScheduler.js` attaches exit code + output tail** whenever a fetch yields no parseable summary (crash/empty/non-zero exit) or hits the 150s timeout — previously these posted bare `?/? cameras` with the evidence discarded. Success path unchanged.

### Fixed
- **Any keyless 404 under `/api/*` now bans instantly** (`morgue-api.js` 404 handler). All real endpoints live under `/api/*` and the only keyless 200s are `/api/health` + `/api/version`, so keyless traffic to an unmapped API route is never legitimate. Keyed callers (version drift, bad IDs), loopback/trusted IPs, and non-`/api/*` junk (`/`, favicon — uptime monitors can't self-ban) stay exempt. The 12-distinct-path enumerator remains as backstop.

### Fixed
- **Version-discovery scanners now banned on first hit.** New `SCAN-api-version-probe` (`/api/vN*`) + `SCAN-api-discovery` (`/api/<status|info|meta|about|system|cluster|vip|environment|hoverfly>`) patterns in `morgue-api.js` — covers the observed 13-path spray (`/api/v2/about`, `/api/v1/check-version`, `/api/vip/…`, …), all keyless 404s. Verified headless: all spray paths match, all 14 real routes (incl. keyless `/api/version`, `/api/health`) clean. Existing guards unchanged: keyed callers + loopback/trusted IPs exempt, bans persist to `data/ban-state.json`, 12-distinct-path enumerator still backstops novel shapes.

### Changed
- **`C.DEFER_MS` 10 min → 3 min** (`services/deployState.js`). New saves auto-deploy ~3 min after queueing instead of ~10. Queue/progress messages derive their "(X min)" text from the constant, so they update automatically. Consent re-check still runs at deploy-time (2.5-min opt-out window preserved). Restart re-queues in-flight reports on the fresh 3-min timer.

## 2026-09-23 — Full-page dumps on every missing-element failure (diagnostics round)

### Changed
- **Every "cannot find X" failure now saves full page HTML.** New `dumpPageState()` helper (per-flow overwrite, never throws): `posting-page`, `reply-page`, `reply-retry-page`, `reply-submit-page`, `pm-submit-page`, `edit-title-page`, `edit-content-page` join the existing `pm-page`/`login-page` dumps. Next vague failure ships its own evidence.

## 2026-09-23 — Session checks verify forms, not URLs (login-truth round)

### Fixed
- **Killed the false "already logged in".** phpBB serves its login form AT `ucp.php` without redirecting, so URL-only checks declared dead sessions valid — then compose rendered its own login page and recipient setup failed deterministically. New `_sessionLooksAlive()` (URL + title + username field), used by `login()` reuse, `ensureLoggedIn()`, and post-submit verify. Proven by manual daemon walkthrough (stored LSSD session dead → force login works → compose + ID-addressing all pass).
- **Auth events tracked per forum** (`recordAuthEvent` → `monitoring/session`, transition-only) rendered as a `Sessions` dashboard section. Follow-up fix: login successes no longer reset the breaker (reads clear while writes stay walled — that hole let one report reach attempt 49).

## 2026-09-23 — Cross-forum relogin guard (credential round)

### Fixed
- **Inline re-login no longer submits PHMC credentials to foreign forums.** All 7 relogin sites gated by `_credsMatchDomain()` — foreign expiry throws a clear retryable error instead of guaranteed-fail fills that poisoned logs and sessions.

## 2026-09-23 — Trusted-input submits (fingerprint round 2)

### Changed
- **`postTopic`/`replyToTopic`/`sendPM` fill via `page.fill()` and click via `page.click()`** (real `isTrusted` events instead of synthetic injections), with injection fallback and exact `No form found` / `No submit button` diagnostics preserved. New helpers `trustedFill`/`trustedFillMessage`/`trustedSubmitClick`.

## 2026-09-23 — UA aligned to real engine (fingerprint round)

### Fixed
- Announced `Chrome/120` while running headless-shell 149 (TLS/JA3/hints mismatch = first-order bot signal). Now sends genuine frozen-format `Chrome/149.0.0.0` with a comment tying UA to engine version. Deliberately NOT adding a bot token to the UA (would hand Cloudflare a perfect signature).

## 2026-09-23 — Persistent headed browser daemon (restart-resilience round)

### Added
- **VPS-exclusive Chromium surviving bot restarts**: `browser-daemon.mjs` supervisor launches the Playwright-bundled build (never drifts) with stable profile (`/opt/phmc-bot/browser-profile`) + loopback-only CDP; `phmc-browser.service` (`Restart=always`). Bot attaches via `connectOverCDP` with launch fallback; ownership rules (shutdown/idle never kill what they didn't launch); orphan reaper skips daemon trees; dead-handle guard (`isConnected` probe + `disconnected` event) so daemon swaps never strand the bot.
- **Headed under Xvfb** (`BROWSER_HEADED=true`): real window system + compositing; screenshot-verified (full GTAW homepage render). Same profile across mode switches.

## 2026-09-23 — Review Phases 0–5 (supervised subagent builds)

### Phase 0 (quick wins)
- Dead code deleted (disabled PM monitor, `RETRY_CHECK_INTERVAL_MS`, `validateSession`, locked `resolveMemberUserId` wrapper); queue double-tick guard; CCTV stop leak; pick-expiry handles; monitor reentrancy guard. `checkHealth` polls its own page lock-free. VPS updater 5s→60s (~17k→1.4k edits/day). Write churn trimmed (verify-read removed, maintenance cached 60s, atomic patient counter, `unprocessedCKs` warning).
### Phase 1 (correctness)
- Stranded reports eliminated (handlers throw `RETRYABLE`/`DATA_TERMINAL`, `runDeploy` decides centrally via `markDeployTerminal`); single retry-counter ownership; real timeout guard; collision-proof entity keys; dry-run honesty; working `/restart` + `/report-retry` (known-key deletion actually performed).
### Phase 2 (scheduler)
- New `services/scheduler.js` (30s evaluator, reentrancy guard, status API); 11 systems migrated (dashboard/AGH/email/face/queue/monitor/intake/system-monitor/roster/patient/CCTV) with intervals preserved.
### Phases 3–5 (data, browser, notify)
- Event-driven queue pickup (no more full-subtree re-downloads); batched autopsy writes; reads on `domcontentloaded`/60s; single CF gate; quote fusion point; flood pacing; 29 logins to session-reuse; single failure embed; cooldown-gated slow alerts.

## 2026-09-23 — PM recipient field recognized on all themes (compose round)

### Fixed
- **Recipient setup no longer bypasses the address field on textarea themes.** The state check only looked for `input[name="username_list"]`, but LSSD renders a `<textarea>` — so it always fell through to the roster→ID round-trip (extra navigations, extra challenge exposure, and the fragile present-check). Both detection and fill now accept either element; the ID path remains for genuinely field-less themes. Proven by manual daemon walkthrough (fill + Add verified live, no submit).

## 2026-09-23 — Earlier stability rounds (memory, breaker, retries, mail)

### Changed
- **VPS memory rescue:** swap 1.65GB→~650MB, RAM free 119MB→~750MB (killed hung one-shots + stale opencode session, removed OpenChamber stack, AdGuard querylog 90d→30d, reference-sync `process.exit` fix). Idle browser shutdown (45m) + renderer media blocking; `waitForCloudflare(120s)` on posting/reply/compose entry.
- **Posting Status split + write-path circuit breaker** (`postingHealth.js`, mirrored): 3 consecutive wall-signals block a host; half-open probes escalate 30m→4h; pauses preserve retry budget; login outcomes feed it (successes no longer reset it — that hole let one report reach attempt 49). Dashboard split (Website vs Posting vs Sessions) + red accent + open/resume alerts.
- **Retries never expire** (executor, retry sweeps, bulk PMs, web intake, email queue): transport failures retry forever; only data-terminal states end reports. Cadence: 1h retries, 10-min defer. Listener respects future `retryAt` (fixed ~10-min fail loop at attempt 52). Queue dashboard shows retry-waiting entries.
- **Agency mail fixes:** login success verified via round-trip (was URL-shape only); PM compose-by-ID waits for Cloudflare; timeout guard spares daemon-attached browsers; shutdown teardown excluded from health tracking; `/restart` uses pm2.
- **Monitor negative cache honored** (guideline topics no longer re-fetched every 15 min); **CCTV daily cadence** + slowdown-proofed waits (VPS-only script).
- **Forum verdict (documented):** posting outage was forum-side Turnstile policy (reads pass, writes stuck) — exonerated media blocking (A/B), patience (30-min observation), DNS/proxy/egress; full Chrome + aligned UA + trusted input + headed daemon shipped as fingerprint improvements.

## 2026-09-14 — Task 3b-6: CK-scan saved-reports VPS cutover (bot)

### Changed
- **`services/deathRecordDraftScan.js`**: `findSourceReport` point-reads normal reports from the VPS (`GET /api/reports/:author/:key`) instead of RTDB `newSavedReports` (`scheduledReports` RTDB read kept); passive CK listener falls through to the same VPS point read when the RTDB read misses a `newSavedReports`-pathed entry; manual `scanAndDraftCKs` keeps the `scheduledReports` RTDB scan but enumerates normal reports via VPS (`/api/reports/stats` author list + per-author `GET /api/reports?author=`) — zero full-node `newSavedReports` reads. VPS failures warn + skip, never touch `scheduledReports`.
- **`services/deathRecordDraftFace.js`**: `resolveFacePostValues` source-report lookup uses the VPS point read for non-scheduled reports (scheduled RTDB read kept).
- **`commands/global-stats.js`**: unchanged — RTDB fallback KEPT as outage-only path per owner Q4.
- **`morgue-api.js`**: unchanged — no new endpoints needed (`/api/reports?author=`, `/api/reports/:author/:key`, `/api/reports/stats` already cover the bot paths; per-author stats filter / coroner-stats aggregation not required for this step, cut per Q5).

### Deployed
- 2026-09-14 live: 2 files SCP'd (md5-verified: Scan `bb23c94b…`, Face `bdcf3bc7…`), `pm2 restart phmc-bot` clean — phased boot verified (browser-warmup 25s → roster-sync running, forum locks serializing, Cloudflare passed), heartbeat sweep clean (0.2s, all ok), CK auto-draft firing post-restart (2 Gary Hicks drafts, distinct report keys — no dupes), error log shows only pre-existing issues (dashboard Missing Access, coroner-email recipient misses). morgue-api untouched (still pid from earlier boot).

## 2026-09-13 — Coroner emails decoupled into their own queue entity

### Added
- **`services/coronerEmailQueue.js`** — `coroner-email-queue/<authorId>|<reportKey>` entities with own status/attempts/backoff (30m, 2h, 6h; stuck-sending reset; 7-day sent prune). Worker processes sequentially + 10-min sweep. A failed email can never disturb its already-deployed topic again.
- **Refactored `handleCoronerEmail`** into prep/enqueue + exported `deliverCoronerEmail` (worker-driven send core with the fuzzy self-heal intact). `deployTopic` passes the topic URL through. Report record only ever receives delivery *results* (coronerEmailUrl/SentAt/To), never email state.
- **Dashboard "Coroner Emails" field** — non-terminal entities with status/countdown/failure detail.

### Deployed
- 2026-09-14 live: 5 files SCP'd (hash-checked), restarts clean, phased boot verified. Safe lifecycle test with a fake recipient: enqueue → deliver → exact-reject → fuzzy-miss → `retry_queued` with the true reason, zero sends, probe entity removed. Test caught a real bug first pass: `sentTo` shorthand referenced a nonexistent variable (would have masked every delivery result) — fixed and re-verified.
- 2026-09-14 Firebase optimization pass: audited every RTDB touch added this session — intake empty polls read nothing, bookkeeping writes fire on state change only, numbering is per-new-patient, sweeps read tiny nodes. The one trim: dashboard Firebase reads (`retry-queue` + `coroner-email-queue`) cached 5 min (≈600 tiny reads/day vs ≈5,760), manual Refresh bypasses the cache.

## 2026-09-13 — Queue dashboard shows failed retries with countdowns

### Added
- **Failed Queued Forms section**: the dashboard now reads the tiny `retry-queue` index each tick (no scheduledReports scan) and lists every failed form with attempt count, last error, and a live "starting <relative>" retry countdown. Legacy index rows without labels resolve via a single cached report read.
- **`retryIndexEntry()`** in deployRetry: backfill + requeue writes now carry label/formId/detail so the dashboard never needs the full node.
- Queued section renamed to "Queued Forms — INFO" with per-form type + fire time.

### Deployed
- (pending — SCP queueDashboard.js + deployRetry.js + changelog, restart, verify both sections render)

## 2026-09-13 — Phased startup + global forum gate

### Changed
- **New `services/startupQueue.js`**: forum-heavy starters now boot strictly in order — browser warmup (15s, single PHMC session check) → roster sync → autopsy first scan → patient index → PM intake first poll — each awaited with timeout, failures skip forward. Recovery heartbeat keeps its 30s timer (failed work first, unchanged). Discord/Firebase-only starters still fire immediately.
- **Global forum semaphore** (`FORUM_GLOBAL_CONCURRENCY`, default 2): per-instance locks never actually serialized across clients — now every forum op also takes a shared slot, bounding boot storms and steady-state overlap. Same acquire order everywhere (global, then instance), so no new deadlock shape.
- **Reuse-first logins** at roster sync + PM intake polls (form fallback preserved — strictly fewer full logins).
- **Interval retunes (defaults, env-overridable):** recovery heartbeat 10m→60m, PM intake 10m→30m, Face sweep 60s→5m. f=265 detection stays 15m.

### Deployed
- 2026-09-13 live: 8 files SCP'd (md5-verified after catching a misdirected upload before restart), restart clean. Boot log proves the sequence: warmup 24s → roster (cooldown, 0s) → autopsy scan 13s → patient → PM poll 12s, zero overlap, no FLOOD/Cloudflare/startup errors. Heartbeat confirms 60-min cadence; PM intake logs 30-min. Note: `startAutopsyRequestMonitor`/`startPrivateAutopsyPmMonitor` accept `{ immediate: false }` (queue runs first work directly); `startFactionRosterSync` returns the in-flight sync for awaiting.

## 2026-09-13 — Medical record numbers: highest-owned + 1

### Fixed
- **New-patient record numbers** no longer come from the blind Firebase counter (which had drifted to 36 while real files reach 1970 — the next new file would have been issued #37, a likely collision). `getNextPatientId` now takes the max numeric id from the patient index (1025 patients, full f=97 history + write-through), floors at the Firebase counter so it never goes backwards, syncs the counter forward, and reserves the id in the index immediately against concurrent creates (a failed create leaves a harmless gap). Forum scan remains as last-resort fallback only.

### Deployed
- 2026-09-13 live: SCP `services/deployMedicalRecord.js` + restart; boot verified below. Kelly Rhodes has no index entry (confirmed) — her file will take the next computed number.

## 2026-09-13 — Private autopsy PM intake (LSPD inbox, TEST MODE)

### Added
- **`services/privateAutopsyPmMonitor.js`** — polls the LSPD inbox every 10 min for `[Private Autopsy]` PMs; sender gate (allowlist, else LSPD group when configured); spoiler addenda expanded + parsed per body (requester, decedent/OOC-or-unknown, PK/CK, location, reason); approval draft with Approve/Deny to the log channel; Firebase dedupe survives restarts. Approving while `PRIVATE_PM_INTAKE_LIVE` is unset posts a TEST simulation report only.
- **`forumClient.readPrivateMessage(msgId)`** — PM view reader with spoiler-toggle expansion (read-only).
- **Wiring in `index.js`** (monitor start + `pmintake_*` buttons) and `.env.example` docs.

### Deployed
- 2026-09-13 live (TEST MODE): all files SCP'd, VPS `.env` `PRIVATE_PM_INTAKE_ALLOWED=Marcus Ward,Chris Wright`, restarts clean. First cycles verified against real PM p=145194: view-page identity (`Marcus Ward (Chris Wright)`, multi-alias gate PASS), clean subject extraction (banner/quotes pitfalls fixed), approval draft with 4 bodies posted to the dev log channel, TEST-APPROVE confirmed with zero forum posts. Probe scripts + probe session removed.
- 2026-09-13 dry-run command: `/pm-intake-dryrun pm_id:<n>` (owner-only, ephemeral) replays intake read-only and attaches one case-BBCode `.txt` per body plus the ME each would get from live rotation. Superseded drafts deleted via API (3). Simulation on p=145194: 4/4 bodies, MEs Brandy Smith / Anne Carter / Sarah Bell / Arthur Blackwood. Parser lookahead fix for label-on-own-line fields (Contact). False alarm noted: a grep filter once hid BBCode content lines — no code regression.
- 2026-09-13 incident: `/pm-intake-dryrun` shipped with a 101-char description (limit 100) — discord.js builders throw `RangeError: Invalid string length` at import, crash-looping the bot (~65 restarts before the stop was issued). Fixed (75 chars), redeployed, boot verified. Lesson: keep slash-command descriptions short; `node --check` does NOT catch builder validation errors.
- 2026-09-13 intake LIVE: Approve now creates the private f=266 cases (rotation ME, title edit, assignment reply, Firebase entry + completion PM routing to the sender) followed by the standard `notifyAssignment` staff notification (ME ping + PHMC #autopsies post), matching the normal flow.
- 2026-09-13 live-run recovery (p=145194): the maiden run posted A/B/C (Cases #511-513, topics #10131-33) then the process died mid-run (~19:11:55 UTC, single crash, cause undetermined — no error logged; bot stable since) before D. Recovered via the idempotent path: A/B/C auto-skipped as already recorded, D posted as Case #517/topic #10134 (number gap 514-516, harmless), C's title fixed to Sarah Bell (reply had already landed despite the logged error), `notifyAssignment` sent once per case (the crashed run never reached notifications), node marked completed. No duplicates: exactly one topic per addendum. Duplicate protection: PM-level processed records (polls never re-handle) + read-check-set claim with immediate button strip + serialized live runs (single pm2 instance) + per-addendum created-records (retries/replays skip posted cases) + fail-closed crash guard (`creating` alerts instead of auto-retrying).
- 2026-09-13 double-fix on the Approve path: (1) node is now claimed BEFORE the draft posts (an instant click could see a null node); (2) Firebase RTDB transactions proven unusable as claim primitives here — this admin SDK invokes the update fn once with a cold null and aborts without retry (verified live), so read-check-set + serialization replaces it. Abort branch now logs the observed status.
- 2026-09-13 intake BBCode trimmed to the original: case content is now Sections 1-4 only (requester/decedent/details/OOC as sent, guidelines parsed not hardcoded, OOC inline on the name line). Removed the invented CONFIDENTIAL header block and Origin footer — provenance stays in Firebase + Discord. Also hardened addendum splitting (V8 drops zero-width-lookahead splits at index 0; filter by content instead of blind slice).
- 2026-09-13 notification audit: A/B/C received exactly 1 webhook ping each; D received 2 (recovery script called notify both inside the live path and in its own loop — overlap, now understood). Hardened with a `notified:true` flag on created records (set after each notify; reuse path notifies only when the flag is absent); all four records flagged. #autopsies channel posts were dropped during standalone-script recovery (no Discord client) — the live path posts normally.
- 2026-09-13 stranded-retry fix: a report with `deployStatus=queued` but `hasdeployed=true` (the Isabela Sato coroner email) is primed as done on cold-load and skipped by the listener forever — invisible on the dashboard, no retry fires. Both retry-write paths (`checkRetryQueue` re-enqueue, `requeueReport`) now force `hasdeployed=false`; the stranded report was reset and requeued.
- 2026-09-13 intake account rule + first delivery: intake now resolves the sender's forum ACCOUNT via memberlist search (candidates: parenthetical first, then base) and stores it from poll time (draft shows "Forum account"); delivery refuses without one. Proved necessary: `Marcus Ward` resolves to nothing — the account is `Chris Wright` (u=14385, his alt); 4 live entries patched. First completion DM (#10133 → Chris Wright) delivered 21:04:52 UTC after the retry-sweep fix picked up the marker; step completed, marker cleared.
- 2026-09-13 LSPD PM recipient fix: first completion DM (#10133 → Marcus Ward) failed with bare "Unknown" — the `username_list` URL param is ignored on the LSPD theme (recipient field renders EMPTY, send stalls on compose with no error). `sendPM` now fills the field + runs phpBB's Add flow and verifies the recipient stuck (clear error otherwise). Failure reasons are now returned (no more "Unknown") and error-element selectors widened.
- 2026-09-13 SADCR recipient fix (coroner email → Isabela Sato failed "No recipient defined."): SADCR compose has NO username_list input at all ("Find a member" popup only), so the URL param path silently addressed nobody. `sendPM` now has three theme shapes: preset → proceed; visible input → Add flow; no input → resolve user ID via memberlist search and re-open compose with `&u=<id>`. Also fixed a would-be self-deadlock (resolver split into locking wrapper + lock-free core for the already-locked sendPM path).
- 2026-09-13 fuzzy recipient self-heal: `resolveMemberUserIdFuzzy` (Levenshtein, 0.85 threshold) checks the LOCAL roster files first (instant, flood-free — proven: "Isabela Sato" → Isabella Sato u=1954 at 92% from sadcr-roster.json), live memberlist search as fallback; coroner-email narrates Sending → fail → Best Match → re-send. Live SADCR memberlist search itself returns nothing (form never submits via GET), which is why roster-first matters.
- 2026-09-13 sendPM roster-exact fallback + Isabela delivery: the no-field branch now tries the roster file (exact only — fuzzy stays an orchestrator decision) before live search. Stranded-report root cause also fixed above; the resend to Isabella Sato delivered live (SADCR p=5082, record updated).
- 2026-09-13 finally-block bug (coroner email → Catalina Romero): the wrapper split left a stray `finally { lock.release(); }` referencing a nonexistent `lock` inside the lock-free resolver — every successful resolve threw ReferenceError *after* logging success, surfacing as the misleading "not found" error. Removed; dry-run proof + live re-send to Catalina Romero completed (LSSD p=86685, report record updated). Lesson: log-then-return across a finally is fragile — review split points for orphaned references.
- 2026-09-13 retry-sweep blind spot: the heartbeat passes an INCOMPLETE-only snapshot to `retryFailedCompletionSteps`, which skipped the marker-index branch entirely — failed steps on completed cases (like #10133's dmSent) were never retried despite having markers, contradicting the code's own comment. The function now merges marker-listed entries the caller omitted.
- 2026-09-13 intake robustness: per-addendum continue-on-error (one bad addendum yields `completed-partial` + alert instead of aborting the batch); Discord alerts (not just logs) for unreadable/unparseable PMs and failed drafts.
- 2026-09-13 intake recipient fix: `pmRecipient` stored the full view string `Marcus Ward (Chris Wright)`, which phpBB `username_list` never resolves — completion PMs would have failed delivery. Now stripped to the bare forum account (`Marcus Ward`); the 4 live entries patched the same way. Verified the completion path otherwise: full report PM via isolated LSPD client to the recipient, LSPD/LSSD crossposts + CASELINK requester webhook all correctly skipped for private entries.

## 2026-09-13 — /mass-autopsy private delivery (bulk confidential cases)

### Added
- **`/mass-autopsy` `pm_forum` option** (LSPD/LSSD/PHMC) — each completed report is PM'd to the batch `requester` on the chosen forum instead of any public post. Entries store `pmForum`/`pmRecipient`, which the existing completion flow (`deployAutopsyReply` DM step) already consumes for private cases — no completion-side changes. `pm_forum` without `requester` is rejected up front; the summary embed shows a Delivery line (visible in dry-run too).

### Deployed
- 2026-09-13 live: SCP `commands/mass-autopsy.js` + `services/massAutopsy.js` + `changelog.md`, `pm2 restart phmc-bot`; boot clean, registrations confirmed. Parser export smoke-tested locally.

## 2026-09-13 — Morgue API bulk upload 413 fix (343-record logger run)

### Fixed
- **Bulk body limit**: the global `express.json({ limit: '1mb' })` 413'd the logger's 343-record bulk POST before any handler ran. Bulk paths (`/api/morgue/bulk`, `/api/reports/bulk`) now get a scoped 25mb parser; every other route keeps the 1mb cap (DoS posture unchanged).
- **Record-count guard**: `/api/morgue/bulk` rejects >5000 records with a 400 telling the caller to split batches.
- **`setup/morgue-logger.ps1`**: uploads in batches of 100 (per-batch results, one failed batch no longer loses the run). Re-run the script locally to pick this up — no VPS step needed for it.

### Deployed
- 2026-09-13 live: SCP `morgue-api.js` + `pm2 restart morgue-api`; health OK, both processes online. Verified with a 1.7MB synthetic bulk payload + junk key: both bulk routes return 401 (parsed, auth-rejected) instead of 413 — zero side effects. /tmp check script removed.

## 2026-09-13 — /check-background: read-only LSPD background-check lookup

### Added
- **`/check-background name:<applicant>`** (supervisors+, ephemeral) — searches LSPD topic t=73256 ("Criminal Record Request Form — PHMC") via a scoped `search.php?t=` query and classifies: completed (LSPD reply quotes the request + summary markers) / pending (request only) / not found. Narrates progress (browser → login → search → reading → verdict) and links every match with per-post `p=` anchors.
- **`services/lspdBackground.js`** — read-only lookup (never posts); isolated client `lspd-bgcheck` (own session file, shared Chromium reused); LSPD-theme selectors (`div.postbody`/`dl.postprofile`); caps detail-fetch at 6 newest matches.

### Deployed
- 2026-09-13 live: SCP `services/lspdBackground.js` (new), `commands/check-background.js` (new), `index.js`, `changelog.md` + `pm2 restart phmc-bot`; boot clean, full-guild registration confirmed. Service-level verify: "Ren Cooper" → completed (2 summaries: Elizabeth Nixon with all three record lines, Danica Ashford license VALID + no derogatory; 2 requests by Jade Stewart #69245), "Alyson Frost" → not_found (negative control). Two probe-round fixes shipped: force-login for the isolated client (guest search silently returns 0) and whole-page match extraction (first name hit is the request, summary sits posts later). /tmp probes + probe session removed; production `forum-session-lspd-bgcheck.json` retained.
- 2026-09-13 follow-up (same deploy): every match block now leads with **Applicant:** (parsed from the request/quote, falls back to the searched name) so blocks can't be misread; `cite` strip fixed to remove the quoted date (`wrote:[\s\S]*` — `.` missed the newline); progress steps accumulate in ONE message (each step edits the reply to append its line: Step 1 / Step 1+2 / …), final edit appends `[DONE]` plus the verdict embed — no message spam.
- 2026-09-13 rename: `/check-background` → `/background` (`commands/background.js`; old file removed both sides). Same behavior, same options.
- 2026-09-13 PHMC guild access: `/background` added to the trimmed PHMC-guild set (VPS `.env` `PHMC_COMMANDS=reassign-autopsy,autopsy-loa,card,background` + restart; boot confirms "Registering 4 trimmed commands"). Supervisors+ gate unchanged. Background: Thiago Larranaga reported "no perms" — audit showed the bot never received an interaction (command wasn't registered in the PHMC guild).
- 2026-09-13 queue + dates: lookups run through a module-level FIFO (shared Chromium + one LSPD account + one session file made concurrent runs thrash the login); waiters see `Queued — N lookup(s) ahead...`. Post dates parse from the sibling `DIV.pull-left` "by X - date" line (verified: concurrent 2x Ren Cooper → both completed, all 4 dates present). /tmp test scripts removed.

## 2026-09-11 — RCE-semicolon pattern + manual IP ban endpoints + RootEvidence banned

### Added
- **`RCE-semicolon-shell` suspicious pattern** (`;\s*(touch|curl|wget|chmod|rm|bash|sh|python|perl)`) — the Airflow `; touch test #` canary class now counts toward bans like other RCE shapes.
- **`POST /api/admin/ban` + `/api/admin/unban`** (write-key only; loopback/trusted IPs refused) — instant permanent bans with Discord alert + disk persistence, plus a safety-valve unban.
- **Banned `66.175.215.31`** (RootEvidence: Kibana fingerprinting → Airflow RCE canary) via the new endpoint; persisted in `ban-state.json`. Note: VPS `.env` already carried a write key (local copy lacked it) — no new secrets minted.

### Deployed
- 2026-09-11 live: file was md5-identical pre-edit, full SCP + `pm2 restart morgue-api`; health OK.

## 2026-09-11 — Discord API logs always show the user agent

### Changed
- **`morgue-api.js` `flushWebhookBatch`**: every batched request line now ends with `ua="…"` (first 60 chars; `ua="-"` when absent — itself a scanner signal). UA was already in console/file/activity logs but missing from the Discord batch. Suspicious-request alerts already carried the full UA; unchanged.

### Deployed
- 2026-09-11 live: file was md5-identical pre-edit, full SCP + `pm2 restart morgue-api`; health OK. Bot untouched.

## 2026-09-11 — Security patches: qs, undici, sharp (Dependabot triage)

### Fixed
- **Bot `qs@6.15.3` → 6.16.0** (DoS via attacker-controlled `isBuffer`) — the one genuinely reachable advisory: Express parses every inbound query string on the public morgue-api. Pinned via `overrides` (express wants `~6.15.1`). Verified `qs@6.16.0 overridden` in tree.
- **Bot `undici` 6.27.0 → 6.28.1** (cookie injection, discord.js chain) and **`sharp` 0.35.1 → 0.35.4** (libheif CVEs; `/card` inputs are committed PNG + staff text, so exposure was nil) — cheap opportunistic bumps.
- Triage verdict on the other ~30 open alerts: dev/build-only or inapplicable (brace-expansion/js-yaml/browserslist/postcss/nanoid/humanfs in eslint/vite/jest chains; fast-xml-parser on Google's own responses; protobufjs on bundled protos; react-router RSC advisory vs our plain HashRouter SPA; esbuild localhost dev only). Remaining `npm audit` highs are exactly that accepted-noise set.

### Deployed
- 2026-09-11 live: SCP `package.json` + `package-lock.json`, VPS `npm install`, versions confirmed on disk (qs 6.16.0 / undici 6.28.1 / sharp 0.35.4), restarted **both** processes (morgue-api shares the modules); bot logged in, API healthy, no new boot errors.

## 2026-09-11 — /card appends a shareable ImgBB URL

### Added
- **`uploadBufferToImgBB()` in `services/cardGenerator.js`** — mirrors the web `uploadImageProxy` (base64 `image` field), key read from `IMGBB_API_KEY` at send time. `/card` keeps the native attachment and appends `Your image URL: \`…\`` when the upload succeeds; fail-open otherwise (no key / error → attachment only, warn in logs).
- `.env.example` documents the proxy env (`FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`); VPS `IMGBB_API_KEY` (fresh key) left in place, currently unused.
- Key handoff 2026-09-11: first key was double-pasted (rejected, removed) — genuinely invalid (code 100), that finding stands.
- **Correction — ImgBB was never broken.** All "blocked" verdicts came from a degenerate 70-byte 1px probe image that ImgBB 400s. Proof: (a) 20 DISTINCT fresh `i.ibb.co` photo URLs in this week's saves — real user uploads through the same proxy+key; (b) live 16KB probe via the new proxy chain returned `i.ibb.co` OK. Direct-VPS 103s were likely the same degenerate payload, not an IP/account block — that theory is withdrawn.
- **New `services/imageProxy.js`** (mint custom token → ID token → `uploadImageProxy` callable) + `/card` uses it with **ImgBB** (reverted from the Imgur detour once proven). `uploadBufferToImgBB` renamed to `uploadCardImage`. One 16KB probe image (repo logo) remains on the account — deletable from the imgbb dashboard if wanted. Temp scripts destroyed both sides.

### Deployed
- 2026-09-11 live: SCP `services/imageProxy.js` (new), `services/cardGenerator.js`, `commands/card.js` (both md5-identical pre-edit) + `pm2 restart phmc-bot`; boot clean, login + trimmed registration confirmed, error count steady.

### Deployed
- 2026-09-11 live: SCP `commands/card.js` + `services/cardGenerator.js` (both md5-identical pre-edit) + `pm2 restart phmc-bot`; boot clean (no new errors; the `getDevTestME` lines in the tail were stale from 11:14 — count steady at 17, fresh login + trimmed registration confirmed).

## 2026-09-11 — Trimmed slash-command set for the PHMC guild

### Added
- **`registerCommands()` now registers a trimmed set to the PHMC guild** (`PHMC_GUILD_ID`, default `860254678653992992`; list via `PHMC_COMMANDS`, default `reassign-autopsy,autopsy-loa,card`) while the primary guild keeps the full arsenal. Unknown names warn-and-skip. Verified read-only via API: staging 45 commands unchanged, PHMC exactly the 3.

### Deployed
- 2026-09-11 live: surgical insert into VPS `index.js` (full-file SCP skipped — local drift) + `pm2 restart phmc-bot`; boot log confirms `Registering 3 trimmed commands for PHMC guild`. VPS backup at `/tmp/index.js.phmccmd.bak`.

## 2026-09-11 — CASE_STATES documented; first live post to PHMC #fmp-autopsies

### Added
- **`CASE_STATES` constants + lifecycle doc block** in `services/autopsyRequestMonitor.js`: `complete` = intake pipeline done (NOT autopsy done; that's `completedAt` + report). Mirrored to VPS surgically (comment-only, no restart). No renames — readers + existing RTDB records stay compatible.

### Verified live
- **Case 508 test post to PHMC `#fmp-autopsies`** (one-shot approved send, 2026-09-11): message `1547924500103036988` — content, all 6 embed fields, both link buttons confirmed via read-only fetch; mention resolved to `ralof.from.riverwood` (Anne Carter's Discord — ping fired). Audit line posted to `#audit-log-spam`. Author shows as the bot itself (bot-client sends can't set the `PHMC Autopsy Assignments` webhook username — cosmetic only).

## 2026-09-11 — Audit trail on every external assignment post

### Added
- **`assignmentWebhook.js` now logs a token-free `[AUDIT] POST <assignment-ping|forward> | ME … | case #… …` line** to the dedicated audit channel (`AUDIT_CHANNEL_ID` → #audit-log-spam) via the bot client after every successful external send — so any post that reaches the PHMC Discord has a matching trail. Singular per post, best-effort, never breaks sending. Uses the already-deployed `sendToChannel` primitive; local file was md5-identical to VPS, so full-file SCP was exact.

### Deployed
- 2026-09-11 live: SCP `services/assignmentWebhook.js` + `pm2 restart phmc-bot`; boot clean, roster/forum pipelines nominal. (Note: `pm2 logs` tail shows stale `Cannot find module …/test-ping.js` "Failed to start" lines — verified pre-existing from 2026-09-10; error log untouched since, file exists on VPS.)

## 2026-09-11 — Morgue-match monitor: Load attempts posted to bot-spam

### Added
- **New `services/morgueMatchLogger.js`** — watches `morgueMatchLogs/` (same RTDB-node pattern as `deployNotifier`) and posts a "who loaded what + confidence table" embed to the bot-spam channel (`BOT_LOG_CHANNEL_ID`) with the bot's own client. Colors: green = clean load, amber = tie-break decided it, red = no match (best < 50). Nodes removed after posting; pending nodes replay on boot.
- Registered in `index.js` next to `startDeployNotifier` (non-fatal start).

### Root cause it watches
- Same-name repeat decedents (e.g. Lukas Adomaitis ×4) can tie on match score; the web modal iterated records oldest-first (DataContext object-keying reorders numeric keys ascending) so the oldest tied record won — Case 501 loaded #74896 (N/A) instead of #82864. Web side now sorts newest-first before scoring.

### Deployed
- 2026-09-11 live: SCP `services/morgueMatchLogger.js` (new file) + surgical 8-line registration insert into the VPS `index.js` after the deploy-notifier block (full-file SCP skipped — local `index.js` carries unrelated uncommitted features) + `pm2 restart phmc-bot`. Verified `[MORGUE-MATCH] Watching morgueMatchLogs...` in pm2 logs. VPS `index.js` backup at `/tmp/index.js.morguematch.bak`.

## 2026-09-10 — Server join/leave flags (owner-paged on surprise joins)

### Added
- **`guildCreate` handler**: the moment the bot joins any server, the owner gets paged in the log channel — `<@owner> Priority Note: Server Joined: <name, id, member count, owner id>` — plus a red embed with join timestamp. Also file-logged as `[BOT] [AUDIT]`.
- **`guildDelete` handler**: quiet log-channel + file note when the bot is removed from a server (no ping).

### Deployed
- SCP `index.js` + `pm2 restart phmc-bot`.

## 2026-09-10 — Overdue autopsy alert: suppress handled duplicates, add topic links

### Fixed
- **False "Unknown (unassigned)" overdue flags**: the check flagged every non-final entry past its window, including stale zombie twins of already-handled cases (e.g. t=10076/Case #504 and t=10083/Case #506 — unassigned, unparsed test duplicates whose siblings were completed/assigned). Now a per-caseNum best-progress map (complete > assigned > detected) suppresses entries whose sibling is further along. Verified live: both zombies suppressed, "No overdue autopsies".
- **`[?] limit 48h` explained**: entries with no parsed `deathType` (BBCode never fetched) fall back to the 48h default — correct behavior for genuinely untyped entries; the dup-suppression removes the reported instances.
- **Alert lines now show OOC name + topic id** (`Name ((OOC)) … — t=10076`) so staff can triage without guessing which post it is.
- `checkOverdueAutopsies` exported for one-shot debug probing.

### Deployed
- SCP `services/systemMonitor.js` + `pm2 restart phmc-bot`. Probe scripts removed from VPS after verification.

## 2026-09-10 — Command permissions: staff card, owner dev, supervisor reassign, retire autopsy/user

### Changed
- **`/card` is PHMC Staff only** (role `860595219472842753`, env-overridable via `PHMC_STAFF_ROLE_ID`; owner bypasses). New `isPhmcStaff()` in `services/permissions.js`.
- **`/dev` is owner-gated at the slash command** (was only enforced inside the panel/buttons — now denied up front too).
- **`/reassign-autopsy` is Supervisors+** (role `860257102324301864`, env-overridable via `PHMC_SUPERVISOR_ROLE_ID`; owner/leadership bypass). Both `execute` and `onMePick` gates changed. New `isSupervisorUp()`.
- **Retired `/autopsy` + `/user`**: unregistered from Discord (import + register + loader blocks removed in `index.js`); files kept on disk, restore by uncommenting.
- Env: `PHMC_STAFF_ROLE_ID` / `PHMC_SUPERVISOR_ROLE_ID` documented in `.env.example`.

### Deployed
- SCP `services/permissions.js` + `commands/card.js` + `commands/dev.js` + `commands/reassign-autopsy.js` + `index.js` + `pm2 restart phmc-bot`.

## 2026-09-10 — Autopsy request required fields + D.N.A parsing

### Added
- **Parser extracts Rank, Badge, Cell, Forum Account URL** (`parseAutopsyRequestBbcode`): new `requesterRank` / `requesterBadge` / `requesterCell` / `forumAccountUrl` fields (forum line prefers the `[url=]` href over link text).
- **Missing/blank/`ANSWER`-style requester fields normalize to `D.N.A (Did Not Answer)`** (new `DNA_VALUE` / `dna()` / `isDna()`); absent fields backfilled post-parse. Decedent/details/OOC parsing untouched.
- **DNA-aware guards**: `requesterDiscordTag` never written from DNA (both write paths), ack greeting falls back to "Requesting Party", completion salutation (`requesterWebhook.js`) never greets "D.N.A".
- Web side (needs owner deploy): Request Autopsy modal requires Name/Rank/Department/Forum URL at submit (cell optional); BBCode blanks render D.N.A; Forum Account line now posted to f=265.

### Deployed
- SCP `services/autopsyRequestMonitor.js` + `services/requesterWebhook.js` + `pm2 restart phmc-bot`.

## 2026-09-10 — Interaction audit log (abuse observation)

### Added
- **New `services/auditLog.js`**: every slash command, button, modal, and select menu is logged to the session file as `[AUDIT] ...` (who, what + options, channel, outcome + duration). Autocomplete excluded (keystroke noise).
- **Discord-visible trail**: sensitive/mutating commands (restarts, skips, retries, reassigns, morgue/patient/user lookups, autopsy tools, dev, …) also post to the log channel, plus command errors on those.
- **Flood alert**: >25 interactions/5 min from one user posts a `[WARN]` to the log channel (once per window). Tunables: `AUDIT_FLOOD_THRESHOLD`, `AUDIT_FLOOD_WINDOW_MS` (see `.env.example`).

### Changed
- **Dedicated audit channel + bulk sends**: set `AUDIT_CHANNEL_ID` (e.g. `#audit-log-spam`) and ALL audit lines go there in bundled messages (flush every `AUDIT_FLUSH_MS`, or early at `AUDIT_BATCH_MAX` lines). Under flood demand the buffer collapses into per-user/per-command summary counts instead of singular lines. Flood WARNs stay singular + immediate. Unset = legacy sensitive-only posts to the main log channel. `AUDIT_DISCORD_ALL` removed (superseded).
- `services/logChannel.js`: shared delivery core + new `sendToChannel(channelId, content)` (no pings, no dev-redirect) for the audit batch sender.

### Deployed
- SCP `services/auditLog.js` + `services/logChannel.js` + `index.js` + `pm2 restart phmc-bot`. Then set `AUDIT_CHANNEL_ID` in the VPS `.env`.

## 2026-09-10 — /card migrated to website Business Card layout

### Fixed
- **`/card` now mirrors the PHMC Tools website layout exactly** (`src/components/UI/BusinessCard.jsx`): name 2.75%/23.44% black 35px, rank 3.31%/31.92% red `#cb1212` 15px, phone 12.56%/52.77% black 15px (percentages of card size, fonts scaled from the website's 750px reference width). Old hardcoded px values (name y=450 off-canvas, grey rank) removed.
- **Added optional `phone` parameter** — the bot previously had no phone field at all.
- **Bundled `LufgaMedium.ttf`** (`templates/`) so the bot renders the same typeface as the website (Arial fallback when missing).

### Deployed
- SCP `services/cardGenerator.js` + `commands/card.js` + `templates/LufgaMedium.ttf` + `pm2 restart phmc-bot`.
- Follow-up: `/card` failed live with "Template not found" — `business-card.png` was never on the VPS. SCP'd `templates/business-card.png` up + restarted.
- Follow-up: phone text rendered ~22px above the phone icon's center (canvas `top` baseline vs SVG `hanging` baseline). Phone `topPct` 52.77% → 54.60%, verified pixel-exact (text ink center = icon center y=667/1200). Name/rank untouched.

## 2026-09-10 — Dedicated PHMC dashboard (gated)

### Added
- **🏥 PHMC Dashboard** for channel `1456793208125264014` (mapped in `PHMC_CHANNELS.dashboard`, env-overridable via `PHMC_DASHBOARD_CHANNEL_ID`): every main-dashboard section **except VPS stats**, Refresh-only buttons (no Restart on the PHMC server).
- Piggybacks the main 10-min gather (zero extra RTDB reads; falls back to its own gather only when the main board is unconfigured AND sends are authorized).
- **Gate enforced**: posts AND edits drop while `PHMC_CHANNEL_SEND_ENABLED` isn't `true` — verified live (cycle logs suppression, nothing posted).
- Owner-only **`/phmc-dashboard status`** (mapping proof, fetch-only) and **`post`** (live gather + gated post).

### Deployed
- SCP service + command + `dashboardManager.js` + `phmcChannels.js` + `index.js` + `pm2 restart phmc-bot`; rules unchanged (tracking node under existing `appMetadata` perms).

## 2026-09-10 — Information panel push-refresh + tracking

### Added
- **`/info-panel refresh`** re-renders every posted panel in place from current code (each kept in the section its readers last left it). Panels self-track at `appMetadata/infoPanels/<messageId>` (rules deny client writes); deleted messages/channels are untracked silently. `/info-panel` is now `setup` + `refresh` subcommands.
- Rules deployed (`infoPanels` write-locked).

## 2026-09-10 — Information panel trim (Leadership + Support rework)

### Changed
- **Leadership section cut to the basics** (`/dashboard`, `/rotation-list`, `/autopsy-loa`, `/reassign-autopsy`, `/pending-reports`) — everything else routes to the owner, by request.
- **Support section rebuilt around a goal**: live Maintenance Status line (🟢 All Systems Normal / 🔴 Outage, read from the bot's maintenance flag on every view), "Having an issue? Contact Fr0styDev" with owner mention, and 3 troubleshooting steps. No overload.

### Deployed
- SCP `services/infoPanel.js` + `pm2 restart phmc-bot`.

## 2026-09-10 — Leadership Information panel (`/info-panel`)

### Added
- **Owner-only `/info-panel [channel]`** posts a button-navigated embed: Overview (what the bot automates), Leadership (essential commands reference), ME & Staff (daily use + assignment flow), Support (outages, maintenance mode, how to report). Static content — zero RTDB reads.
- New `services/infoPanel.js` + `commands/info-panel.js`; `info_*` button route in `index.js`.

### Deployed
- SCP service + command + `index.js` + `pm2 restart phmc-bot` (guild commands re-registered).

## 2026-09-10 — duplicate-reply guard false-positive fix

### Fixed
- **`handleAutopsyReply` completion guard could skip a live case**: it skipped when `!anyPending && guardSnap.exists()`, but `guardSnap` only proves the OOC exists — with a different decedent name (or no name match at all) nothing matched, yet it still skipped. Now requires `matched > 0 && !anyPending`. Live case: report "John Doe ((Gabriel Ontiveros))" was skipped while case 10103 was still open; after the fix + re-queue the reply posted ([post](https://phmc.gta.world/viewtopic.php?p=25005#p25005)) and #10102 completed.

### Deployed
- SCP `services/deployAutopsyReply.js` + re-queued the report + `pm2 restart phmc-bot`.

## 2026-09-10 — Morgue API hourly poll metrics (noise reduction)

### Changed
- **Routine `GET /api/morgue?limit=1` loopback polls no longer spam Discord** — dashboard (10-min refresh) + system monitor health checks are aggregated into one hourly **`[MORGUE-API] Poll metrics (last 1h)`** summary (`Nx GET /api/morgue [key] avg Nms max Nms`). Only sent when count > 0.
- **Full audit trail kept** — every poll is still in console/file logs + in-memory `/api/activity`. Only the Discord webhook batch is rolled up. Errors, real searches (`q=`), attributed calls, and non-loopback traffic still log immediately.
- **Tunable via `MORGUE_POLL_METRICS_INTERVAL_MS`** (default `3600000`, min 60s) — documented in `.env.example`.
- Files: `morgue-api.js` (poll rollup), `.env.example` (new var). Restart `morgue-api` via pm2 to apply.

## 2026-09-10 — deploy notices actually ping (mention in content)

### Fixed
- **`deployNotifier` lifts `<@user>`/`<@&role>` tags from the embed description into the message content.** Mentions inside embeds never trigger notifications; content mentions do (allowedMentions already parses users/roles). Embed itself unchanged. Applies to all `deployNotifications` relays (web-deploy, rtdb-monitor, …).

### Deployed
- SCP `services/deployNotifier.js` + `pm2 restart phmc-bot`.

## 2026-09-10 — verify due-set sentinel (follow-up #2)

### Changed
- **Verified/failed/denied death-record drafts no longer re-download every 10 min**: terminal states stamp `verifyAfter = 2100-01-01` sentinel (`VERIFY_DONE_AFTER`), dropping them out of the `endAt(now)` due query (clearing can't work — `endAt` matches nulls too). Approval still stamps a fresh `verifyAfter`, so re-armed entries re-enter.
- One-time backfill: 8/32 backlog entries sentineled. Next sweep confirmed the collapse: `0 verified, 0 flagged, 1 skipped` (was ~95KB due set).

### Deployed
- SCP `services/deathRecordDraftScan.js` + `pm2 restart phmc-bot`.

## 2026-09-09 — RTDB cost pass (heartbeat/sweep/bell narrowing)

### Changed (all reads, no behavior change)
- **Heartbeat shared snapshot → pending-only query** (`autoDeploy.js`): `orderByChild('completedAt').equalTo(null)` instead of the full 400KB+ `autopsy-requested` node every 10 min (~2.5 MB/hr → ~0). All consumers already skip completed entries.
- **Completion-step retries via `completionStepRetries/` marker index** (`deployAutopsyReply.js` + monitor startup reseed): failures write a tiny marker, successes remove it; the sweep fetches only listed entries (zero entry reads when clean). Covers failed steps on already-completed cases, which the pending query would otherwise miss.
- **FACE sweep → in-memory due-map** (`deathRecordDraftFace.js`): child events track scheduled keys; the 60s sweep reads only due entries (was a full `facePostDrafts` download ×1,440/day). Falls back to a scheduled-only query if watchers fail.
- **Dashboard Face list → scheduled-only query** (`dashboardManager.js`) + **`facePostDrafts.status` index** in `database.rules.json` (approved history no longer ships every 10 min).
- **Queue dashboard config cached in memory** (`queueDashboard.js`): was a re-read every 30s tick.
- **Web bell → pending query** (`src/components/ui-new/index.jsx`): every connected tab no longer re-downloads the full node on each status write (ships with next web rebuild).

### Deployed
- `firebase deploy --only database` (rules) + SCP services + `pm2 restart phmc-bot`.

## 2026-09-09 — deploy notifications via bot (no webhooks)

### Added
- **New `services/deployNotifier.js`** — watches `deployNotifications/` and posts entries to the log channel with the bot's own client, then removes them. Pending nodes left over from downtime are picked up on next boot (listener replay). No webhook URLs anywhere by policy.
- `tools/deploy.js` now hands its Pages-build/live-bundle verdict to the bot through that node (admin SDK, local gitignored key) instead of a Discord webhook.

### Deployed
- SCP `services/deployNotifier.js`, `index.js` + `pm2 restart phmc-bot`.

## 2026-09-09 - VPS report deletes restored (write key)

### Fixed
- **Report/morgue deletes via functions now send the write key.** `callSavedReportsApi` and `deleteMorgueRecord` used the read key for PUT/DELETE, which the VPS rejects (403) — surfacing as 500 "Saved report service failed" (users couldn't delete reports since the RTDB→VPS migration). Mutating calls now use `MORGUE_WRITE_API_KEY`; GET/POST keep the read key. Provisioned `functions-write` in VPS `MORGUE_WRITE_API_KEYS`.
- Verified live: POST 200 (read key) → DELETE 403 (read key, gate holds) → DELETE 200 (write key) → GET 404 (gone).

### Deployed
- VPS `.env` + `pm2 restart morgue-api`; functions redeploy (picks up `MORGUE_WRITE_API_KEY` env).

## 2026-09-09 — webhooks to bot-native delivery (morgue-api /api/notify)

### Changed
- **morgue-api owns Discord delivery now.** New `POST /api/notify` (`{ channel, content, embeds }`, any valid API key + rate limit) posts through the bot's own Discord client (Guilds intent, second gateway session). Delivery is allowlist-only: `NOTIFY_CHANNELS` keys (admin/auth/forms/error/dev/coroner/phmc/autopsies/apilogs, env-overridable, staging defaults) — unknown keys rejected, payloads size-capped, fail-closed when Discord is offline.
- **morgue-api's own logging migrated too.** Request-batch logs, suspicious-request alerts, IP-ban alerts, and write-attempt notices previously POSTed to `MORGUE_API_LOG_WEBHOOK` — all now go to the `apilogs` channel via the client. `MORGUE_API_LOG_WEBHOOK` is fully unreferenced (delete the webhook at Discord + drop the env var).
- **Fixed types flow through the bot.** `sendWebhookProxy` maps webhookType → channel key and POSTs to `/api/notify` — no Discord URL is touched for fixed types. The legacy `webhookId` (RTDB `{url}`) path is unchanged but deprecated, pending the admin-UI migration to channel IDs. Web app calls are untouched (same `triggerWebhookProxy` API).

### Deployed
- SCP `morgue-api.js` + `pm2 restart morgue-api`; `firebase deploy --only functions:sendWebhookProxy`.

### Fixed
- **System monitor never started (`Identifier 'latest' has already been declared`).** `checkMorgueOverdue` in `systemMonitor.js` declared `let latest` twice in one scope — a SyntaxError that killed the whole module at import, so health checks/morgue-overdue/data cleanup silently never ran. Merged into a single binding; also fixed two latent bugs in the same function: `snapshot` referenced outside its block (would have thrown whenever the VPS path succeeded) and the RTDB fallback overwriting the VPS-primary value.
- **Dashboard VPS-stats updater spammed an error every 5s on transient Discord REST blips** (Connect Timeout). Now logs the first failure, then trips a 5-min cooldown after ~30s of consecutive failures instead of logging per cycle.

### Deployed
- SCP `services/systemMonitor.js`, `services/dashboardManager.js` + `pm2 restart phmc-bot`.

### Added
- **`services/presence.js`** — presence reflects what the bot is doing: idle baseline `Watching PHMC reports`, busy labels pushed per task (`startActivity`/`endActivity` token API, latest wins, 2s debounce, 12-min stale expiry, never throws). Not a channel post, so the read-only migration gate doesn't apply.
- **Wired:** boot sets the baseline (`index.js` ready); `runDeploy` shows `Deploying <report> to <forum>` and clears on settle (success/fail/abort) in `deployExecutor.js`. Monitor scans can adopt the same two calls later.

### Deployed
- SCP `services/presence.js`, `services/deployExecutor.js`, `index.js` + `pm2 restart phmc-bot`.

### Added
- **`services/phmcChannels.js`** — committed channel-ID map + `sendChannelMessage(client, channelId, payload)` transport helper. Channel IDs are safe to commit (not credentials); mapped so far: `autopsies` → PHMC Discord #autopsies (`AUTOPSIES_CHANNEL_ID` overrides). Nothing sends through it yet — senders flip off webhooks one by one once the bot joins the PHMC guild.
- **Read-only migration gate:** `sendChannelMessage` drops every send (logged, never throws) unless `PHMC_CHANNEL_SEND_ENABLED=true` is set in the VPS `.env`. The bot can join the guild and resolve channels without ever posting until verification passes.

### Deployed
- File committed + SCP'd to VPS (no restart — nothing imports it yet).

### Security
- **Leaked tokens revoked.** `assignmentWebhook.js` carried the live PHMC "Autopsy Bot" webhook as a hardcoded `PHMC_FORWARD_WEBHOOK_DEFAULT`, and `debug-testing-scripts/notify-webhook.mjs` carried the live "Admin Webhook v3" as a fallback — both committed to the public repo on 2026-08-31 and abused for spam. Both literals deleted; git history purged across all branches; both webhooks deleted at Discord.
- **Env-only from here on.** Forward/assignment sends resolve `FORWARD_WEBHOOK_URL` / `ASSIGNMENT_WEBHOOK_URL` from `.env` (VPS) with NO literal fallback — unconfigured means skip-with-warning, and `/forward-autopsy-notify` refuses cleanly instead of failing on HTTP. Debug script `notify-webhook.mjs` exits unless `NOTIFY_WEBHOOK_URL` is set.
- **Recreate on the VPS:** create two new webhooks in Discord (autopsy channel + admin channel), set `FORWARD_WEBHOOK_URL`, `ASSIGNMENT_WEBHOOK_URL` (and `NOTIFY_WEBHOOK_URL` if the debug script is used) in `/opt/phmc-bot/discord-bot/.env`, then SCP the changed files up + `pm2 restart phmc-bot`.

### Deployed
- SCP `services/assignmentWebhook.js`, `commands/forward-autopsy-notify.js` + `pm2 restart phmc-bot` (owner/VPS step, after the new webhook URLs are in `.env`).

### Fixed
- **"Forum Slow to Respond" false alarms** (`deployExecutor.js`) — the 1-min tripwire fired on healthy multi-step autopsy runs (login + post + crosspost + DM routinely take 1-3 min). Raised to 3 min; the 10-min abort is unchanged. No timer leak existed (both guards clear on settle).

## 2026-09-08 — autopsy replies edit-in-place instead of duplicating

### Added
- **Shared `postOrEditReply` helper (`deployAutopsyReply.js`)** — posts a forum reply, or EDITS the existing reply when the exact post was already made in a prior run (re-queue / retry / restart after a successful post). The reply post id is captured from the reply URL (`p=`) at post time and persisted for future runs. Edit failures never fall back to a new post (that would duplicate); they surface for retry, which attempts the edit again. Dry-run mode never edits.
- **Deploy-queue PHMC case reply**: re-runs of an already-posted `scheduledReports` entry (stored `deployPostId`) now edit the live reply in place. Fixes the re-queue duplicate scenario (post succeeded but entry re-queued).
- **Agency crosspost (LSSD/SADCR/DAO)**: persists `<fx>CrosspostReplyPostId` (+ URL) on success; main, fallback, and retry paths edit the stored reply instead of posting a duplicate.
- **PHMC completion reply (f=265 notice)**: persists `phmcCompletionReplyPostId` (+ URL) on success; the retry path edits instead of duplicating.

### Deployed
- SCP `deployAutopsyReply.js` + `pm2 restart phmc-bot`.

## 2026-09-08 — dashboard ME Assignments now live-update

### Added
- **Assignment watcher in `dashboardManager.js`** — watches the tiny `autopsy-requests/assignments` node (touched by `recordAssignment`/`clearAssignment` on every assign, reassign, and completion) and triggers an out-of-cycle dashboard rebuild within ~5s, so the ME Assignments field reflects changes immediately instead of waiting for the 10-min cycle. Debounced to coalesce bursts; the initial listener fire is ignored. The 10-min cycle + manual Refresh button are unchanged.

### Deployed
- SCP `dashboardManager.js` + `pm2 restart phmc-bot` (restart also rebuilt the dashboard once with current data).

## 2026-09-08 — labeled morgue API keys for abuse attribution

### Added
- **`MORGUE_API_KEYS` / `MORGUE_WRITE_API_KEYS` now support `label:key` entries** (e.g. `forms-functions:pmc_morgue_xxx`). Logs, the in-memory activity record, and Discord webhook lines show `[key_<label>]` instead of an anonymous truncated prefix, and `/api/activity` now includes a per-key summary (`byKey`: count, lastSeen, lastIp, lastStatus, suspicious). Unlabeled keys log as `key_<sha256 fingerprint>` — never raw key material.
- New shared `services/apiKeyUtil.js` (`stripKeyLabel` / `firstApiKey`); the bot's own health checks (`dashboardManager`, `systemMonitor`, `global-stats`) and the debug scripts now strip labels so labeling the VPS env can't break internal calls.

### Deployed
- SCP `morgue-api.js`, `services/apiKeyUtil.js`, `services/dashboardManager.js`, `services/systemMonitor.js`, `commands/global-stats.js` + restart `morgue-api` and `phmc-bot`.

## 2026-09-08 — morgue API requester attribution

### Added
- **Morgue API audit logs now identify PHMC Forms callers** when requests arrive through the Firebase callable proxy: `requestedBy="characterName | oauthName | uid=..."`. The identity is derived server-side from Firebase Auth claims and forwarded in trusted headers; direct API clients remain `external/unknown`.
- Applied to the morgue-record and agency-credentials proxy calls, including console, in-memory activity, and batched Discord webhook logs.
- GTAW auth custom tokens now carry `oauthName` and the resolved PHMC `characterName` for future callable attribution.

### Deployed
- SCP `morgue-api.js` + restart `morgue-api`; deploy updated Firebase Functions (`getMorgueRecords`, `getAgencyCredentials`, auth token claims).

## 2026-09-08 — web autopsy requests: deliver-to PM + Forms Autopsy flag

### Added
- **Web "Request Autopsy" completion PM now reaches the real requester.** `webAutopsyRequestPoster` writes an `autopsy-requests/web-meta/<topicId>` stub (source/agencyForum/forumAccountUrl) after posting; the monitor merges it onto the `autopsy-requested/<topicId>` entry (`formsAutopsy:true`, `agencyForum`, `forumAccountUrl`). The completion "DM Requester" step (main + retry paths in `deployAutopsyReply.js`) now has a forms branch: it resolves the requester's forum username from the profile URL (new `forumClient.resolveProfileUsername`) and PMs them on the agency forum (LSSD/SADCR/DAO share the lssd domain, LSPD its own, PHMC default) — previously web submissions were skipped because the topic poster was the bot.
- **`Forms Autopsy: True / False` line in the completion notice** (`completionTemplate.js`) — rendered from `entry.formsAutopsy`; appears in the f=265 completion reply and the LSSD/SADCR/DAO crosspost. Threaded through all `buildCompletionBb` callers (`deployAutopsyReply`, `deployInteraction`, `force-autopsy-send`).
- Applies to new web submissions (meta is written at post time); existing entries are unaffected.

### Deployed
- SCP `completionTemplate.js`, `forumClient.js`, `webAutopsyRequestPoster.js`, `autopsyRequestMonitor.js`, `deployAutopsyReply.js`, `deployInteraction.js`, `force-autopsy-send.js` + `pm2 restart phmc-bot`.

## 2026-09-08 — assignment embed: decedent cleanup + OOC in title

### Fixed
- **Assignment/forward webhook embed (`assignmentWebhook.js`)** — stray `()` parser artifacts are stripped from the decedent ("Unknown () ((Jaliek Myers))" → "Unknown ((Jaliek Myers))") and the embed title now includes the OOC name ("🔬 Autopsy Case Assigned — Unknown ((Jaliek Myers))" instead of "… — Unknown ()"). Applies to the assignment ping + forward + `/forward-autopsy-notify`.
- **Request parser (`autopsyRequestMonitor.js` body fallback)** — the "Decedent Name" clean-up only stripped the inner `(OOC)` of a `((OOC))` pair, leaving `"Unknown ()"`. It now strips full `((…))` pairs (and any residual empty `()`) so stored names / case titles stay clean going forward.

### Deployed
- SCP `assignmentWebhook.js`, `autopsyRequestMonitor.js` + `pm2 restart phmc-bot`.

## 2026-09-08 — web autopsy request: real-time RTDB listener (no polling)

### Changed
- **`services/webAutopsyRequestPoster.js` no longer polls the queue.** It now uses real-time `child_added` / `child_changed` listeners on `autopsy-requests/pending` — the VPS is pushed changes (WebSocket) instead of re-reading the node every 30s (~2880 reads/day → ~0 steady-state; retries cost one targeted read each). Startup recovery comes from the listener's initial replay.
- Submitted alerts now fire **immediately** on submit (listener push), not up to one poll later.

### Deployed
- SCP `services/webAutopsyRequestPoster.js` + `pm2 restart phmc-bot`.

## 2026-09-08 — web autopsy request: immediate submit notification

### Added
- **`services/webAutopsyRequestPoster.js` now alerts as soon as a request is queued**, not just after the forum post. On first sight of a pending entry (~one poll after the user submits, `AUTOPSY_REQUEST_POLL_MS`), it posts a "New autopsy request submitted" alert (decedent, morgue case, requester) and stamps `submittedNotifiedAt` so it fires once. After the topic posts, a second alert carries the forum link; post failures alert after giving up.
- Notifications go to `AUTOPSY_REQUEST_WEBHOOK_URL` and are **dev-routed** while DEV TEST mode is active (→ `DEV_WEBHOOK_URL`), replacing the previous log-channel `sendWebhook` (which leaked to the live PHMC bot-spam during dev-test).
- Also fixed `logChannel.js`: during dev-test with no `DEV_LOG_CHANNEL_ID`, log-channel messages are now dropped instead of falling back to the live channel.

### Deployed
- SCP `webAutopsyRequestPoster.js`, `logChannel.js` + `pm2 restart phmc-bot`.

## 2026-09-08 — DEV TEST webhook routing (no PHMC spam while dev-testing)

### Added
- **New `services/devRouting.js`** — while DEV TEST autopsy mode is active (`AUTOPSY_DEV_TEST=true` via `/enable-dev-autopsy`), autopsy notifications route to a DEV Discord instead of the live PHMC/faction Discords. Per-webhook `<KEY>_DEV` override wins, else the global `DEV_WEBHOOK_URL`; log-channel messages use `DEV_LOG_CHANNEL_ID`. No dev target configured => the message is dropped (never sent live).
- Routing applied at **send time** (a runtime `/enable-dev-autopsy` toggle takes effect immediately, no restart): assignment pings (`ASSIGNMENT_WEBHOOK_URL`), auto-forward (`FORWARD_WEBHOOK_URL`, replacing the exported `PHMC_FORWARD_WEBHOOK_URL` const with `getForwardWebhookUrl()`), requester completion webhooks (`AUTOPSY_REQUESTER_WEBHOOK_*` now also route to dev while dev-test is on, alongside the existing `AUTOPSY_REQUESTER_WEBHOOK_TEST_MODE` flag), and the log channel (`sendLogMessage`).
- Files: `devRouting.js` (new), `assignmentWebhook.js`, `requesterWebhook.js`, `logChannel.js`, `meDiscordNotify.js`, `commands/forward-autopsy-notify.js`. `.env.example` documents `DEV_WEBHOOK_URL` / `DEV_LOG_CHANNEL_ID`.

### Deployed
- SCP above + `pm2 restart phmc-bot`.

## 2026-09-08 — web autopsy request auto-poster (pending -> f=265)

### Added
- **New service `services/webAutopsyRequestPoster.js`** — watches `autopsy-requests/pending` (web app "Request Autopsy" submissions) and posts each entry as a topic to **PHMC f=265** using the existing `forumClient.postTopic()` path (login-redirect, flood, and preview handling included). After a successful post the entry flips to `status:'posted'` with `topicUrl`/`postedAt`; failures track `attempts`/`lastError` and retry up to 3× with a 5-min backoff before giving up. The standard autopsy monitor then creates the case + assigns an ME as usual (DEV TEST mode routes to the forced ME).
- **New owner command `/web-autopsy-autopost`** (`on`/`off`/`status`) — runtime toggle that persists `AUTOPSY_REQUEST_AUTO_POST` to `.env` (no restart needed), mirroring `/enable-dev-autopsy`.
- **Safety gate:** auto-posting is OFF by default (`AUTOPSY_REQUEST_AUTO_POST=false`); it only runs when enabled. Sweep cadence configurable via `AUTOPSY_REQUEST_POLL_MS` (default 30s).
- Wired into `index.js` startup (after the autopsy monitor) + slash-command registration.

### Deployed
- SCP `services/webAutopsyRequestPoster.js`, `commands/web-autopsy-autopost.js`, `index.js` + `pm2 restart phmc-bot`.

## 2026-09-06 — VPS report store and reference snapshots

### Added
- Added authenticated `/api/reports` storage and aggregate endpoints for normal saved reports, plus a daily read-only duplicate/retention check.
- Migrated normal saved reports to `data/saved-reports`; scheduled deployment reports remain in RTDB.
- Added daily VPS snapshots for `agencies`, `locationData`, and `verified_locations`; coroner Functions prefer the VPS snapshots with RTDB fallback during rollback.
- Added request-size-safe bulk migration and deterministic filenames for long Firebase keys.

## 2026-09-06 — share autopsy recovery snapshot

### Changed
- **Recovery heartbeat now reads `autopsy-requested` once per tick** and passes the same snapshot to LSPD crosspost recovery, PHMC acknowledgement recovery, completion-step recovery, and assignment-reply recovery. Existing fallback reads remain available if the shared read fails.
- This removes four redundant ~400 KB RTDB downloads from the normal 10-minute heartbeat without changing recovery filters or retry behavior.

## 2026-09-05 — AGH dashboard stats window comment fix

### Changed
- **Corrected a stale comment in `services/aghMetrics.js`** — it claimed AGH stats are "1-day aggregates"; verified against the live control API that `num_*` totals equal the sum of the full 30-day daily buckets, so the dashboard's headline numbers are the full stats window (30d), not 24h.
- Deployed: SCP `services/aghMetrics.js` + `pm2 restart phmc-bot`.

## 2026-09-03 — owner-role whitelist for all owner commands + /debug-channels

### Added
- **New shared permission gate `isOwnerOrWhitelisted()`** (`services/permissions.js`): a user passes as owner if their Discord ID matches `BOT_OWNER_ID` **or** they hold one of the whitelisted leadership roles (`860257102324301864`, `860257063182925874`). Overridable via comma-separated `BOT_OWNER_ROLE_IDS` in `.env`.
- **Every owner-flagged command, button, select menu, and the dev panel now use the shared gate** — previously each command had its own inline `BOT_OWNER_ID` check that ignored roles. Covers all ~35 commands, `/dev` panel buttons, report-retry/skip menus, autopsy-request approve/edit/deny, reassign menus, and the restart confirmation button.
- **`/debug-channels` (owner+roles)**: lists every channel ID in the server, grouped by type (text/voice/category/forum/stage/threads), shown ephemeral. Uses the Discord API's guild channel listing (`guild.channels.fetch()`). (Fix: threads live in `guild.channels.cache` on discord.js 14.27 — `guild.threads` does not exist and was removed from the reader.)

### Deployed
- SCP `index.js`, `commands/*.js`, `services/permissions.js`, `services/devPanel.js` + `pm2 restart phmc-bot`.

## 2026-09-03 (2) — LSPD crosspost recovery only logs in when there's a candidate

### Changed
- **`retryMissingLspdCrossposts` (`autoDeploy.js`) now filters RTDB candidates BEFORE logging into LSPD.** Previously it force-logged in to `lspd.gta.world` on every startup/10-min sweep, then scanned `autopsy-requested` — so when LSPD was down (e.g. Cloudflare 522) the sweep aborted with a noisy "login page has no username field" error even though there was nothing to recover. Now: scan + filter first, and only create the browser client + login when ≥1 candidate exists. No candidates → `[AUTO] LSPD recovery: no candidates missing the crosspost (N entries scanned) — skipping LSPD login`.
- Verified live: 51 `autopsy-requested` entries, 15 LSPD (2 private / 4 no caseTopicId / 9 completed), 0 candidates missing a crosspost.
- Deployed: SCP `services/autoDeploy.js` + `pm2 restart phmc-bot`.

## 2026-09-02 (4) — fix dashboard "regenerate instead of edit" + REFRESHING field state

### Fixed
- **Dashboard auto-refresh was posting a NEW dashboard every cycle instead of patching the existing one.** `patchDashboardEmbed()` passed `components` as a single `ActionRowBuilder`, but `msg.edit()` expects an **array** → `TypeError: this.options.components?.map is not a function`, which the silent catch swallowed → fell through to `channel.send()`, then the orphan-cleanup deleted the old message next cycle → endless regenerate loop. Fixed: `components: [components]`.
- Root cause confirmed via a standalone repro against the live message (`components: row` threw; `components: [row]` edited OK).
- The patch-failure catch now logs the error instead of silently posting new.

### Changed
- **VPS Resources field now shows a transient `🔄 REFRESHING…` state** during the 5-min auto-refresh gather (`buildRefreshingEmbed` + `refreshing` flag), so the field never sits on stale data while updating. The flag also makes the 5s VPS updater render REFRESHING instead of clobbering the placeholder mid-gather.
- Deployed: SCP `dashboardManager.js` + `pm2 restart phmc-bot`.

## 2026-09-02 (3) — dashboard auto-refresh patches in place (no pending-flash / full rebuild)

### Changed
- **The 5-min dashboard auto-refresh no longer flashes a yellow "Forum checks in progress" state or rebuilds the whole embed from scratch** (`dashboardManager.js`). It now patches the existing message in place via a new `patchDashboardEmbed()` helper — `EmbedBuilder.from(old)` + `spliceFields` — swapping only the changed fields. Auto-refresh reads cached data (no browser checks), so the pending flash was pure churn. The manual "Refresh Now" button keeps its live one-by-one progress flow.
- Also corrected the stale VPS-updater comment (it refreshes every 5s, not 30s).
- Deployed: SCP `dashboardManager.js` + `pm2 restart phmc-bot`.

## 2026-09-02 (2) — dashboard shows browser Active/Idle status

### Changed
- **VPS Resources field now shows the forum browser's real state** (`dashboardManager.js` + `activityLog.js` + `forumClient.js`): a `🟢 Active` / `⚪ Idle` indicator plus a `Last activity` line, replacing the old ambiguous "Currently" line. Active = a navigation is in-flight OR one happened within the last 60s (multi-step ops like login don't flicker). Uses the existing per-navigation activity hook; `page.goto` now balances an in-flight counter via `markActivityDone()`.
- Deployed: SCP `activityLog.js`, `forumClient.js`, `dashboardManager.js` + `pm2 restart phmc-bot`.

## 2026-09-02 — fix infinite roster-sync pagination (crash-loop/CPU incident)

### Fixed
- **`getGroupMembers` could loop forever when a forum memberlist page ignores `start`.** The LSPD `g=44` page always returned 26 username links regardless of the `start` offset, so the `pageMembers.length < PAGE_SIZE` last-page check never fired — the loop kept incrementing `start` and scraping (reached start=173,725, ~6,950 page loads), yielding 0 new members per page. Each iteration navigated via Playwright, pegging CPU to ~303% (load avg 6.06 on a 2-core VPS) and effectively starving the bot until it was restarted (SIGINT) at 06:13 UTC.
- **Fix:** loop now also stops when a full page produces **0 new members** after dedup (`pageNewCount === 0` → `isLastPage`), guarding against stalled/ignored pagination regardless of page length.
- Deployed: SCP `services/forumClient.js` + `pm2 restart phmc-bot`.

## 2026-08-31 (2) — morgue-api request logging now shows what was sent

### Changed
- **Per-request logs include the request detail** (`morgue-api.js`) — the log line (and the Discord API-log batch) now appends `body={...}` for POST/PUT/PATCH (key=value, values >40 chars summarized as `<N chars>` instead of dumped) or `query={...}` for GET/DELETE. Example:
  `POST /api/report-bbcode → 200 (1ms) [key_...] ip=... ua="node" body={author="tester" key="detail-probe" bbCode=<460 chars>}`
- Helps identify exactly what each API call sent (which report, which record) without flooding logs with full payloads.
- Deployed: SCP `morgue-api.js` + `pm2 restart morgue-api`.

## 2026-08-31 — AGH integration made optional (kept out of public forks)

### Changed
- **AdGuard Home metrics integration is now optional** — the AGH files
  (`services/aghMetrics.js`, `commands/agh-dashboard.js`, root `aghMetrics.js`)
  are **personal and gitignored**; they are not part of a public fork. `index.js`
  now guards every AGH import (`agh-dashboard` command data, `startAghMetrics`,
  `agh_refresh` button, command registration) with try/catch, so the bot boots
  cleanly when the files are absent. On this VPS they're still present → AGH
  dashboard unaffected (verified: `[AGH] ✅ metrics manager active`).
- VPS: created `/opt/phmc-bot/discord-bot/.private/` (hidden) and moved the
  redundant root `aghMetrics.js` duplicate there (`aghMetrics-root-copy.js`);
  the live `services/` + `commands/` copies remain.
- Deployed: SCP `index.js` + `pm2 restart phmc-bot` (↺51, online).

## 2026-08-30 (2) — RTDB egress reduction (P1 + P2 stage 1)

### Changed (RTDB download, ~300-500MB/day investigation)
- **P1 — bot morgue reads → VPS-local mirror** (`services/localMorgueData.js` + `deathRecordDraftCache.js` + `deathRecordDraftScan.js`): `initMorgueCache`, the `findMorgueRecord` fallback, and `scanAndDraftCKs` now load from the VPS `morgue-data.json` (same `{ caseId }` shape as RTDB) instead of full `db.ref('morgue-records')` reads (~5.5MB each). RTDB is the fallback if the mirror is missing.
- **P2 stage 1 — passive-CK listener no longer holds a full `newSavedReports` subscription** (`deathRecordDraftScan.js`): the old `on('value')` downloaded the whole 5.7MB `newSavedReports` node on every connect and streamed every user save. It now watches the **slim `unprocessedCKs` index** (written by the web app on every CK save) via `child_added`, and reads each matching report scoped (`newSavedReports/<author>/<key>`).

### Notes
- RTDB inventory: `newSavedReportBBCode` 11.2MB, `newSavedReports` 5.7MB, `morgue-records` 5.5MB (mirrored to VPS). Remaining P2 stages: migrate `newSavedReportBBCode` off RTDB (VPS + Cloud Function), paginate the admin full-node reads (`EmployeeManager`/`DatabaseEditor`).
- Deployed: SCP `localMorgueData.js`, `deathRecordDraftCache.js`, `deathRecordDraftScan.js` + `pm2 restart phmc-bot`.

## 2026-08-30 — morgue-api: valid API keys exempt from IP bans

### Fixed
- **Cloud Function `getMorgueRecords` intermittently failing with `functions/internal`.** The morgue-api had permanently banned 21 Google-range IPs (34.x/35.x) as "SCAN-*"; Cloud Functions egresses from **rotating shared Google IPs**, so when the function's egress landed on a banned IP it got 403 → the callable threw `internal` → the web app logged the error on every login → Discord error-webhook flood.
- **Requests carrying a valid `x-api-key` are now exempt from IP-ban + suspicious-block + 404-strike logic** (`morgue-api.js` security middleware, `req.hasValidApiKey`). Authorized clients are never IP-reputation blocked; keyless scanners still get 403/banned. Verified: banned-IP + valid key → 200, banned-IP + no key → 401.
- Cleared the 21 Google-range bans from `data/ban-state.json` (50 scanner IPs remain). Deployed + `pm2 restart morgue-api`.

## 2026-08-28 — per-session log files + dashboard "what is it doing"

### Added
- **Per-session log files** (`services/logger.js`) — each process start now opens a fresh `logs/bot-<timestamp>.log` (index.js) / `logs/api-<timestamp>.log` (morgue-api.js) instead of one shared `log.txt`. Old sessions auto-pruned (keeps the newest 12); 25MB safety cap rolls a runaway session to `<name>.1`. morgue-api.js now uses the file logger too (was console-only → pm2).
- **Activity log** (`services/activityLog.js`) — in-memory ring buffer of the last browser navigation, fed by a `page.goto` hook in `forumClient.js` `ensureBrowser` (single shared page, so one hook covers all scanning/posting/login activity).
- **Dashboard VPS Resources breakdown** (`services/vpsStats.js` + `dashboardManager.js`) —
  - Chrome now classified by Chromium `--type` (main/renderer/gpu/zygote/network/utility/broker) so `chrome ×7` reads as `main 1 · renderer 2 · gpu 1 · zygote 1 · …` — i.e. **one** Playwright browser, not 7.
  - Node classified by script (bot / morgue-api / pm2 / other).
  - New **`Currently`** line shows the last activity + how long ago (e.g. `scanning forum (phmc.gta.world/viewforum.php) · 2m ago`).

### Notes
- Verified on VPS: chrome ×6 → `main 1 · zygote 2 · gpu 1 · utility 1 · renderer 1`; node shows bot + morgue-api (+ generic `node` for pm2 daemon/helper processes — self-counting inflates this slightly while a diagnostic script runs).
- Deployed: SCP `logger.js`, `activityLog.js`, `vpsStats.js`, `dashboardManager.js`, `forumClient.js`, `morgue-api.js` + `pm2 restart phmc-bot` / `pm2 restart morgue-api`.

## 2026-08-28 (2) — orphan browser reap guard

### Fixed
- **Orphaned Chromium reaping** (`forumClient.js`) — `getSharedBrowser()` now kills any `chrome-headless-shell` whose parent is dead (PPID 1) before launching, so abrupt bot deaths (`uncaughtException` → `exit(1)`, SIGKILL) can no longer leave zombie browser trees behind. This was the cause of a transient `chrome ×12 (main 2)` on the dashboard: a restart overlap where the old process's browser lingered beside the new one. Only one browser is ever created in code (all ForumClient instances — including isolated agency clients — share `getSharedBrowser`); there is intentionally no "second Currently" line. Verified post-restart: chrome ×6 (one tree).
- Deployed: SCP `forumClient.js` + `pm2 restart phmc-bot`.

## 2026-08-28 (3) — browser lifecycle logs + lazy ME-roster fetch

### Added
- **Browser lifecycle logging** (`forumClient.js`) — the shared browser now logs `[LOG] Spawning BROWSER for <reason>` (first external caller on the stack, e.g. `checkForNewRequests (autopsyRequestMonitor.js)`) and `[LOG] Destroying browser for <reason>` via new exported `closeSharedBrowser()`. `index.js` now handles SIGTERM/SIGINT: closes the browser gracefully before exiting, so pm2 restarts stop orphaning Chromium (verified: `🛑 SIGINT received` → `Destroying browser for shutdown`).

### Changed
- **ME roster (`memberlist.php?g=50`) no longer fetched every 10-min heartbeat** (`autopsyRequestMonitor.js` `retryFailedAssignmentReplies`) — it now scans `autopsy-requested` *first* and only forces a PHMC login + paginates the ME group when at least one assignment reply genuinely needs a retry. A quiet heartbeat does zero forum work. The roster is still fetched on: new-request ME assignment, startup rotation init, and the assign/reassign/mass commands.
- Deployed: SCP `forumClient.js`, `index.js`, `autopsyRequestMonitor.js` + `pm2 restart phmc-bot`.

## 2026-08-28 (5) — form key rename: `testing-compact-mode` → `general_consultation`

### Changed
- Renamed the General Consultation form key `testing-compact-mode` → `general_consultation` in `global-stats.js`, `autoDeploy.js`, `deployExecutor.js`, `deployQueue.js`. Deployed + `pm2 restart phmc-bot`.
- **Legacy aliases added** so any report still carrying the old `formId` routes/deploys correctly (deployQueue normalizes on load; autoDeploy normalizes in both enqueue + dev-report paths; deployExecutor employee-field map keeps the old key).

## 2026-08-28 (4) — dashboard activity refresh every 5s

### Changed
- **VPS Resources field refresh 30s → 5s** (`dashboardManager.js`) — the `Currently — …` line (and CPU/MEM/procs) now update every 5s. Discord's docs rate-limit message endpoints (edit included) to **5 requests/5s per channel**; 1 edit per 5s uses ~20% of that bucket, so it's safe. Verified running.
- Deployed: SCP `dashboardManager.js` + `pm2 restart phmc-bot`.

## 2026-08-27 (2) — roster sync interval + startup health-check reduction + VPS infra

### Changed
- **Roster sync 4h → 12h** (`factionRosterSync.js`) — `COOLDOWN_MS` now 12h (+ up to 30min random offset); dashboard label and startup logic updated. Rosters update twice a day instead of six.
- **Startup health checks skip healthy forums** (`systemMonitor.js`) — on boot, `runHealthCheck` no longer runs the 3 Playwright forum checks if the cached `monitoring/forums` status is all `Good`. A restart doesn't mean the forums changed, and boot previously opened several browser pages needlessly (contributing to the renderer churn). Forums are still re-checked every 2h cycle, and still re-checked at boot if any forum was flagged down.

### Infrastructure
- **VPS firewall enabled (ufw)** — allow 22/80/3001/tcp + 41641/udp + `tailscale0`; default-deny inbound. CUPS snap disabled (was listening publicly on :631).
- **AdGuard Home v0.107.79 installed on the VPS** (`/opt/AdGuardHome`, GPG-verified, systemd service) — DNS served over a private **Tailscale** tunnel only (bind `100.84.161.69` + `127.0.0.1`, never public IP), access allowlisted to tailnet/loopback, Quad9 DoH upstream, AdGuard DNS + AdAway blocklists. See `plan/adguard-home-vps.md` for the runbook.

## 2026-08-27 — live VPS CPU/MEM stats on dashboard + Playwright context leak fixes

### Added
- **VPS Resources field on the dashboard** (`dashboardManager.js` + new `vpsStats.js`) — the system dashboard embed now shows CPU%, load, MEM/swap usage, uptime, and node/chrome process counts. Refreshed every **30s** via a lightweight in-place message edit (Discord's ~5 edits/5s per channel limit means 1 edit/30s is trivially safe); the heavy forums/queue data stays on the 5-min cycle. Chrome proc count doubles as a live leak monitor for the context fix below.

### Fixed
- **LSSD/DM isolated clients now close their context** (`deployAutopsyReply.js`) — the `finally` blocks on the LSSD completion client and the DM client deliberately skipped `close()` ("GC will handle cleanup"), which left one Chromium **renderer process (~150–240MB) alive per autopsy completion indefinitely**. Live VPS inspection showed 4 stale renderers totalling ~1.09GB RSS (bot up 21h) — the main driver of the 1.8GB VPS being memory-saturated. Both blocks now `try { await client.close(); } catch {}`, matching the already-correct fallback path. `close()` (forumClient.js) already delays 1s for health-check page creation and suppresses errors, so the original stealth-race concern no longer applies.
- **Removed dead duplicate `close()` in `ForumClient`** (`forumClient.js`) — two `close()` methods existed; the first was shadowed by the second and referenced a non-existent `this.browser`. Left only the context/page-closing implementation.
- **Immediate relief on VPS:** `pm2 restart phmc-bot` reclaims all leaked renderer memory (single shared browser process torn down and relaunched).

### Notes
- Files: SCP `services/dashboardManager.js`, `services/vpsStats.js`, `services/deployAutopsyReply.js`, `services/forumClient.js` + `pm2 restart phmc-bot`.
- VPS stats module smoke-tested on the host (CPU/mem/swap/uptime/proc counts all sane).

## 2026-08-26 (3) — completion webhook refinements, DAO live, `/forward-autopsy-complete`, morgue hardening

### Added
- **`/forward-autopsy-complete`** (owner-only) — manual send/re-send of the requester completion notification through the **REAL** faction webhook (`ignoreTestMode` bypass on `getFactionWebhookUrl`). Destination precedence: explicit `webhook:` option > real faction var; blank faction var = refused with guidance before anything sends. Same payload as the automatic flow (origin-aware copy, intranet links, CASELINK/Records button deep-link). Roles post-cutover: recovery of failed sends, retro-fit notifications for pre-feature cases, corrections via `faction:` override. Registered in both the REST payload and handler map.
- **DAO webhook wired** — `AUTOPSY_REQUESTER_WEBHOOK_DAO` now set on VPS + mirrored locally; all three registry factions live. Verified by `/forward-autopsy-complete case:10025` → real DAO channel (`OK`), plus an automatic test-routed send to dev.
- **Morgue API scanner defense expansion** (`morgue-api.js`) — after live junk-probe logs (`hassio` double-encoded traversal, Cognito/JMeter/mesh probes): new instant-ban patterns `SCAN-hassio/cognito/jmeter/runscript/supervisor/mesh-probe` + `SCAN-traversal-encoded` (`%252e`-class encodings missed before); generic **path-enumeration ban** — ≥12 DISTINCT unknown API paths in 10 min = instant permanent ban (`SCAN-path-enumeration`), repeat-hammering one path stays un-punished; **trust guard** — loopback always trusted + optional `MORGUE_API_TRUSTED_IPS`, so our own probes can never self-ban. Live-verified: loopback probes stay clean 404s; enumeration probe #13 → `403 permanently banned`; hassio single probe → instant ban. Test tools shipped: `scanner-ban-test.mjs`, `banstate-remove.mjs`.
- **Morgue search typo-tolerance (API)** — `searchLocalRecords()` is now per-word tolerant: adjacent-transposition swaps + one-char deletions ("autospy" resolves "Autopsy"). Root-caused a CASELINK "Not in morgue" false negative to their own typo + IC-vs-OOC name mismatch (records store `Unknown (( OOC ))`); documented query semantics for their dev.

### Fixed
- **Assigned Autopsies modal morgue matching** (`AssignedAutopsiesModal.jsx`) — same root cause on the web side: strict substring match missed typo'd OOC terms entirely ("john doe" can never match an anonymized record). Added word-level fuzzy fallback (`haystackMatchesTerm`) feeding the existing location/date/time scorer at slightly lower weight; error copy changed from misleading "Not in morgue — contact an ME." to "No morgue match — intake may not exist yet."
- **PHMC Inbox button URL** — `ucp.php?i=pm&mode=inbox` → correct `?i=pm&folder=inbox` (shared constant `PHMC_INBOX_URL`; applies to every payload path).
- **RTDB data repair (one-shot)** — `tools/fix-autospy-typo.cjs` fixed CASELINK's "Autospy Test" typo inside `autopsy-requested/10025` (title, oocName, caseTitle, parsed tree, requestBbCode). Forum topics intentionally untouched so CASELINK tracking stays consistent with what they posted.

### Changed
- **Completion payload copy is channel-aware** (CASELINK dev feedback) — only CASELINK-posted requests may say "CASELINK": automatic flow fires solely for those today (gate unchanged), but human-origin payloads render "**…**A full copy has been sent to your PHMC inbox, and it is available under your [agency intranet](<…>)" with an "Autopsy Records" button instead; unknown-faction edge degrades to plain-text phrasing rather than dead `[link](<null>)`. Flag rides persisted `postedByCaselink`; `mimic-requester-webhook.mjs --human` previews the branch. CASELINK wording additionally gained "[your SD Intranet](<…>)" inline link (same recordUrl backing the button — text and action never disagree).

### Notes
- Files: SCP `services/requesterWebhook.js`, `commands/forward-autopsy-complete.js`, `morgue-api.js`, `index.js`, `.env.example` (+ restart `phmc-bot` and `morgue-api`).
- Validator from this session: `node debug-testing-scripts/list-guild-commands.mjs` proves registration against Discord's API directly (41→42 commands).
- Key rotation reminder outstanding (token, forum passwords ×4 sharing one value, FACE key, morgue keys, webhook URLs seen in session transcripts).
- Status: dev-test assignment OFF; `AUTOPSY_REQUESTER_WEBHOOK_TEST_MODE=true` pending final flip → then automatic completions land in real LSSD/SADCR/DAO channels with zero manual steps.

## 2026-08-26 (2) — `/enable-dev-autopsy` forced-ME dev mode

### Added
- **`/enable-dev-autopsy`** (owner-only) — flips DEV TEST assignment mode without SSH/restart: every **new** autopsy case is assigned to the configured ME (**default Alyson Frost**; optional `me` option / `AUTOPSY_DEV_TEST_ME`), while the entire rest of the pipeline runs normally — detection, case creation, certified-copy crossposts (LSSD/SADCR/DAO), acknowledgements, requester completion webhooks, retries. Already-assigned cases are untouched. Actions: `Enable` / `Disable` / `Status`; runtime takes effect immediately and both vars persist to the bot's `.env` so the mode survives restarts. LOA rules and supervised `ASSIGNED:` markers are bypassed while active; a loud `[DEV TEST]` banner posts to the log channel at startup when on.
- **`services/envFile.js`** — comment-preserving `.env` upsert util (`AUTOPSY_DEV_TEST`/`AUTOPSY_DEV_TEST_ME`): replaces in place, uncomments commented keys, collapses duplicates, preserves CRLF/LF + everything else byte-for-byte, idempotent no-op when unchanged.
- The pre-existing hardcoded dev branch in `selectME` now reads the configurable ME (`getDevTestME()` in `autopsyRotation.js`) — same default Alyson Frost.

### Notes
- Both monitor paths (single + multi-decedent) check the flag BEFORE rotation AND before supervised-override resolution, so "always" truly means always.
- On-disk state diverges from real OS env vars only if someone sets them outside .env (boot loader already prefers process.env).
- Deploy: SCP `commands/enable-dev-autopsy.js`, `services/envFile.js`, `services/autopsyRotation.js`, `services/autopsyRequestMonitor.js` + `pm2 restart phmc-bot`. Test coverage: `debug-testing-scripts/envfile-test.mjs`.

## 2026-08-26 — CASELINK completion webhooks + SADCR/DAO agency crossposting

### Added
- **Requester completion webhooks (CASELINK)** — new `services/requesterWebhook.js`. When an autopsy completes for a `postedByCaselink` request, the requesting faction's Discord webhook posts: `<@ID>` ping when the officer's numeric Discord ID resolves, else a name salutation ("Katherine Olsen, your autopsy request has been completed, you can view it in CASELINK or via DMs."); embed with Case NR/title + Medical Examiner / ME Discord; link buttons **CASELINK** (deep link to the faction forum reply, else the records forum), **PHMC Inbox**, **PHMC Discord** (`https://discord.gg/zYdhJvHvUa`). Fully gated: private cases and non-CASELINK requests never fire; multi-decedent defers until every case completes.
- **Faction webhook env vars** — `AUTOPSY_REQUESTER_WEBHOOK_LSSD/_SADCR/_DAO/_LSPD` (blank = silently skipped; DAO/LSPD ship blank but fully coded) plus test routing: `AUTOPSY_REQUESTER_WEBHOOK_TEST_MODE=true` sends EVERY faction to `AUTOPSY_REQUESTER_WEBHOOK_TEST_URL` with `[TEST-OVERRIDE]` logging. See `.env.example`.
- **SADCR/DAO agency crossposting** — the LSSD-only pipeline is now registry-driven (`services/agencyForums.js`: LSSD f=2263, SADCR f=2328, DAO f=2331 — all subforums of lssd.gta.world sharing FORUM_LSSD_* credentials). Monitor Step 3 searches the requesting faction's OWN forum for an existing request topic (CASELINK duplication guard: search-first, create only for positively-human posters with the raw request BBCode in a certified-copy shell), stores faction-keyed topic ids (`sadcrRequestTopicId`/`daoRequestTopicId`; LSSD field unchanged), acks there, and completion replies the combined notice+report to the same topic. Counters now route per faction (previously SADCR fell into the LSSD bucket); faction regex/parser accept SADCR+DAO tags in titles and Department fields.
- **Requester identity persisted at detection** — `requesterPoster`, `postedByCaselink`, `requesterDiscordTag` saved on `autopsy-requested/<topicId>`; parsed from Section 1 Contact Information (`(( Discord Name: ... ))` or numeric ID). Preserved across resets/reprocessing.
- **New tracked completion step** `requesterWebhook` (two-phase, recovery-sweep retryable via `retryFailedCompletionSteps`) + progress-embed step "Requester Discord Notification". Agency ack retries gained their own sweep (`retryFailedAgencyAcknowledgements`) for SADCR/DAO.

### Commands & tooling
- `/test-requester-webhook <case> [faction]` (owner-only) — pulls a real `autopsy-requested` record, sends the live payload through current config, reports ping resolution + routing. Optional faction override previews SADCR/DAO routing regardless of the record's faction.
- `debug-testing-scripts/mimic-requester-webhook.mjs` — offline/local mimicry of completions using the real payload builder (`--entry <key>` read-only pull, `--synthetic`, `--as <FACTION>`, `--multi`, `--no-me`, `--unassigned`, `--send <url>` / `--print`). All testing stages post to the dev-discord webhook configured on the VPS.
- `tools/stage0-parser-test.mjs` — parser regression for the new requesterDiscord field.
- `tools/reset-autopsy-request.mjs` now preserves the new identity/topic-id fields.

### Notes
- Web app unchanged — no redeploy needed. Deploy: SCP `services/agencyForums.js`, `services/requesterWebhook.js`, `services/completionTemplate.js`, `services/deployAutopsyReply.js`, `services/deployLssd.js`, `services/autopsyRequestMonitor.js`, `services/autoDeploy.js`, `commands/test-requester-webhook.js` + `.env` additions + `pm2 restart phmc-bot`.
- Staging checklist: fill LSSD/SADCR webhook URLs + TEST_URL on the VPS `.env`, set `AUTOPSY_REQUESTER_WEBHOOK_TEST_MODE=true` for validation, flip off before cutover. DAO intentionally left blank.

## 2026-08-25 — Auto-forward assigned autopsies to the PHMC Discord webhook

### Added
- **Assigned autopsies are now auto-forwarded** — `notifyAssignment` (`meDiscordNotify.js`) posts to the forwarding webhook (`PHMC_FORWARD_WEBHOOK_URL`, same template/target as `/forward-autopsy-notify`) on every assignment, so no manual command is needed. Covers single + multi-decedent assignments and reassignments. The webhook is now centralized as `PHMC_FORWARD_WEBHOOK_URL` in `assignmentWebhook.js` (configurable via `FORWARD_WEBHOOK_URL` in `.env`), and `/forward-autopsy-notify` uses it too (with the `/webhook` override retained).
- **Tag validation** — the forward includes the resolved `<@discordId>` ping (6/8 rotation MEs mapped; Yuri Zhou + Eun Jae fall back to a bold name until mapped via `/me-discord`). Live-tested: `[FORWARD-WEBHOOK] Forwarded assignment for Edward Baskin (case TEST) [ping]`.

### Notes
- Deploy: SCP `services/assignmentWebhook.js`, `services/meDiscordNotify.js`, `commands/forward-autopsy-notify.js` + `pm2 restart phmc-bot`.

## 2026-08-23 — Death Record post-posting forum verification (30-min delay)

### Added
- **`verifyPostedDeathRecords`** (`deathRecordDraftScan.js`) — after an approved death record, waits **30 minutes** (`verifyAfter` = approve time + 30 min, so either the bot's auto-post *or* a staff manual post can land), then scans the Death Records forum (f=404) for the topic by title/case number. Found → marks the draft `verified` + `verifiedAt` + `verifiedTopicId`. Not found → marks `verificationFailed` + posts a `⚠️ Death Record Not Verified` alert to the log channel (human check, no auto re-post).
- **Wired into the recovery heartbeat** (`autoDeploy.js`) as a `death-record-verify` sweep, alongside the existing interrupted-approval recovery.
- `verifyAfter` is stamped on the draft in `handleApprove` (`deathRecordDraftActions.js`).

### Notes
- Simulated/DRY approvals are skipped (no real forum topic to verify).
- Death Records (CK posts) are **f=404** — the post target and verify sweep both scan f=404 (f=267 is the separate Coroner Reports / Mass Fatality forum).
- Deploy: SCP `services/deathRecordDraftScan.js`, `deathRecordDraftActions.js`, `deathRecordDraft.js`, `autoDeploy.js` + `pm2 restart phmc-bot`.

## 2026-08-21 — Client build stamp on deploy embeds

### Added
- **Deploy progress embeds now show the client build** — `DeployProgressEmbed` accepts an optional `buildLabel` (threaded from `reportData.appBuild` in `deployPM`, `deployCoronerEmail`, `deployMedicalRecord`, `deployAutopsyReply`, `deployTopic`, `deployQueue`), appended to the footer as `· client build <index>`. Combined with the web-side `appBuild` stamp, this surfaces which client bundle produced each report (stale-vs-current diagnostics). Reports saved by older clients simply omit the label.

### Notes
- Deploy: SCP `services/deployLogger.js`, `deployPM.js`, `deployCoronerEmail.js`, `deployMedicalRecord.js`, `deployAutopsyReply.js`, `deployTopic.js`, `deployQueue.js` + `pm2 restart phmc-bot`.

## 2026-08-17 — Assignment notification refinements: forward command + friendlier wording

### Added
- **`/forward-autopsy-notify`** (owner) — forwards a real autopsy assignment to the community **"Autopsy Bot" webhook** (`1538007200188997672`, guild `860254678653992992`). Resolves a case by number/topic/title fragment from `autopsy-requested`, resolves the ME's Discord mapping, and posts the full webhook embed (ME, case number, decedent, thread link, wait-window). Optional `/webhook` override destination. Backed by a new reusable `forwardAssignmentWebhook()` in `assignmentWebhook.js`.

### Changed
- **Webhook `content` wording** — `buildContent` now renders a friendlier line: `@<discordId> Dr. <ME>, you've been assigned an autopsy — here's the case file and links.` (instead of `@Ralof Medical Examiner: Anne Carter`). Supports an optional `label` (e.g. "reassigned an autopsy") threaded through `notifyAssignmentWebhook` / `forwardAssignmentWebhook`.

### Notes
- Deploy: SCP `index.js`, `commands/forward-autopsy-notify.js`, `services/assignmentWebhook.js` + `pm2 restart phmc-bot`.

## 2026-08-17 — Autopsy reassignment: fix case filter + notify new ME

### Fixed
- **`/reassign-autopsy` case filter** — the active-case list required `title.includes('autopsy request')`, which excluded *report*-titled cases like `[Autopsy Report] Bradley Kellerman [SADCR]` (the one assigned+incomplete case → "No active assigned cases found" despite 39 assigned). Now shows **any assigned, not-yet-completed** case.
- **Reassigned ME is now notified** — `/reassign-autopsy` previously edited the forum title + posted a forum notice but sent **no Discord/webhook ping** to the newly-assigned ME. It now calls `notifyAssignment` (same path as initial assignment) with the wording **"Autopsy Case Reassigned"**: webhook `<@me>` ping + embed (title `🔬 Autopsy Case Reassigned`), plus the log-channel mention. `notifyAssignment`/`assignmentWebhook` gained optional `label`/`embedTitle`/`title` overrides.

### Notes
- Deploy: SCP `commands/reassign-autopsy.js`, `services/meDiscordNotify.js`, `services/assignmentWebhook.js` + `pm2 restart phmc-bot`.

## 2026-08-17 — VPS crash recovery + memory-hardening (18th July 2026 incident)

### Incident
- VPS (1.8GB RAM, **no swap**) froze at ~23:27 UTC after a Discord websocket `Opening handshake has timed out` crash (22:15 UTC). Root cause: memory exhaustion — the CCTV `fetch-all.js --headless` child timed out (20:54) and `child.kill()` (SIGTERM) **orphaned the headless-chromium grandchild**, leaking RAM on a box already at ~74% baseline. With no swap, the kernel couldn't OOM-kill; the box just starved/froze (no `oom-killed` events in the log confirms this).

### Fixed
- **CCTV process-tree kill** (`services/cctvScheduler.js`) — the fetch child now spawns `detached: true` (own process group) and on timeout *or* close the whole tree is swept with `process.kill(-child.pid, 'SIGKILL')`, so leaked headless browsers die instead of accumulating RAM.
- **Fail-fast crash handling** (`index.js`) — `uncaughtException` now logs + sends the crash report and then `process.exit(1)` so pm2 does a clean restart, instead of the bot limping along with a half-connected Discord websocket.
- **Earlier RAM alert** (`services/systemMonitor.js`) — high-memory alert threshold lowered 85% → **70%** (the box was at 74% before it died, so the old threshold never fired).
- **2GB swap added on the VPS** — `/swapfile` persisted in `/etc/fstab`, `vm.swappiness=10` via `/etc/sysctl.d/99-swappiness.conf`. Gives the kernel room to OOM-kill the leaker instead of freezing the box.

### Notes
- Deploy: SCP `services/cctvScheduler.js`, `index.js`, `services/systemMonitor.js` + `pm2 restart phmc-bot`; swap was applied directly on the VPS.

## 2026-08-16 — `/maintenance splash` + pause all queues during outages

### Added
- **`/maintenance splash` subcommand (owner only)** — `on <title> <message> [eta]` shows the web app's full-screen splash **and** pauses all deploy queues (`appMetadata/botMaintenance = true`); `off` lifts the splash and resumes; `status` shows both. Writes `appMetadata/maintenance/splash` with `updatedBy`/`updatedAt` audit.
- **Maintenance gate now covers ALL outbound work** — added `isMaintenanceMode()` early-return guards to `handlePM`, `handleMedicalRecord`, `handleAutopsyReply`, `retryFailedCompletionSteps`, `processReportEdits`, and `checkRetryQueue` (previously only the auto-deploy queue + coroner emails paused).

### Notes
- Deploy: SCP `commands/maintenance.js`, `services/deployPM.js`, `services/deployMedicalRecord.js`, `services/reportEdits.js`, `services/deployAutopsyReply.js`, `services/deployRetry.js` + `pm2 restart phmc-bot`.

## 2026-08-15 — SADCR roster sync + roster-check API

### Added
- **SADCR in `factionRosterSync.js`** — new config scrapes the SADCR forum (`FORUM_SADCR_URL`, group `g=11`) with the existing `FORUM_SADCR_USERNAME`/`PASSWORD` into `data/sadcr-roster.json` (32 members on first sync). Credential selection generalized to per-config env keys (`usernameEnv`/`passwordEnv`); sync summary + log-channel message now iterate all factions. `getRosterSyncStatus()` also returns `sadcrCount`.
- **SADCR in `morgue-api.js` roster endpoints** — `/api/roster/check` now accepts `dept=sadcr` and includes SADCR in auto-detect; `/api/roster/sadcr` serves the full roster.

### Notes
- SADCR forum credentials already existed on the VPS (`data/agency-credentials.json`, `FORUM_SADCR_*`). Verified live: `check?name=Dante&dept=sadcr` → found; auto-detect finds SADCR members. Deploy: SCP `services/factionRosterSync.js`, `morgue-api.js` + `pm2 restart phmc-bot morgue-api` + one-off `syncFactionRosters()`.

## 2026-08-15 — Webhook ME assignment notifications

### Added
- **Webhook-based assignment pings** (`services/assignmentWebhook.js`) — when `ASSIGNMENT_WEBHOOK_URL` is set, newly assigned autopsy cases post to that webhook with `<@me> Medical Examiner: **Name**` + an `🔬 Autopsy Case Assigned` embed (ME, case #, decedent/OOC, thread, CK/PK wait window) + `View Case` / `PHMC Forms` **link buttons** (`?with_components=true` + `allowed_mentions: { parse: ['users'] }`). Fully non-blocking (10s timeout) so it can never stall an assignment.
- **Wired into `autopsyRequestMonitor.js`** (single + multi-decedent assignment points) passing `decedent`/`ooc`/`caseNumber`/`deathType`; `notifyAssignment` pings via the webhook when configured and posts to the log channel **without** the mention (no double-ping). Unmapped MEs degrade to a bold name (no ping) — the forum assignment reply still tags them in-game.

### Notes
- Config: `ASSIGNMENT_WEBHOOK_URL` in `.env`. Deploy: SCP `services/assignmentWebhook.js`, `services/meDiscordNotify.js`, `services/autopsyRequestMonitor.js` + `pm2 restart phmc-bot`.

## 2026-08-15 — Interactive `/me-discord` mapping panel

### Changed
- **`/me-discord` is now a button-driven panel** (`commands/set-me-discord.js`) — lists MEs on the rotation who lack a Discord mapping with an `Add: <name>` button per ME; clicking opens a modal to paste the Discord user ID / @mention; on submit the mapping is saved and the panel re-renders (ME moves to ✅ Mapped). `me_map_*` button + `me_modal_*` submit handlers wired into `interactionCreate`.

## 2026-08-15 — Test ping + explicit mention handling

### Added
- **`/test-ping` (owner)** — sends an @mention test notification to the log channel.
- **`logChannel.js` now sends `allowed_mentions`** — `{ parse: ['users', 'roles'] }` (plus `here` for crash reports) so `<@id>` pings are guaranteed and `@everyone`/`@here` are never accidentally triggered.

## 2026-08-15 — Standalone webhook notifier + buttons

### Added
- **`debug-testing-scripts/notify-webhook.mjs`** — standalone webhook notifier: ME assignment mode (`--me` + case fields), generic JSON payload template (single case or multi-decedent `cases[]`), `View Case` / `PHMC Forms` link buttons, `--wait` (verify buttons rendered), `--dry-run`, `--mapping` file. Samples: `sample-assignment.json`, `sample-multi-assignment.json`, `discord-mappings.json`.
- **Webhook buttons require `?with_components=true`** on incoming (non-application-owned) webhooks — the `components` field is ignored otherwise. Link buttons (style 5) render; interactive buttons (custom_id) need an application-owned webhook.

### Housekeeping
- **Ops fix:** the bot crash-looped after `index.js` referenced `commands/test-ping.js` that wasn't uploaded to the VPS — file added, clean restart, `/me-discord` re-registered without options.

## 2026-08-15 — `/global-stats` PHMC Forms usage stats

### Added
- **`/global-stats` (owner)** — paginated stats with three pages reachable via buttons on the embed (`📊 Overview` / `📋 Full Breakdown` / `🔥 Activity Heatmap`):
  - **Overview** — total reports & users, Report Volume by Section (Coroners / ER &amp; Clinical / Mental Health + other, with bars, subtotals, % and per-form counts), By Month (last 6), and top 5 users per section.
  - **Full Breakdown** — every form type with counts, top 10 users overall, and top 8 per section.
  - **Activity Heatmap** — a 7-day × 24-hour (UTC) intensity grid (`·░▒▓█`) of report submissions, with a legend and peak stats (busiest day + peak hour).
- Button handler wired into `interactionCreate` (`handleStatsPage`); each page recomputes from the live stores.

### Changed
- Dropped the "Deploy Queue" and "Legacy / Recovery" fields per product feedback.

### Notes
- Deploy to VPS: SCP `commands/global-stats.js`, `index.js` + `pm2 restart phmc-bot` (registers the slash command + button handler).

## 2026-08-15 — Report edit worker: full paper trail

### Changed
- **`reportEdits` worker now has a visible paper trail** (`reportEdits.js`):
  - Posts a `📝 Report Edit Requested` notice to the log channel when it picks up a request (report + target topic), then a green `✏️ Report Edited` with a topic link on success, or a red `⚠️ Report Edit Failed` with the reason on failure.
  - Appends every attempt to the report's `editHistory` array (`{ at, status, url?, error? }`) and sets `lastEditStatus` / `lastEditUrl` / `lastEditError` on the record — a durable audit trail visible to the UI.

### Notes
- Deploy to VPS: SCP `services/reportEdits.js` + `pm2 restart phmc-bot`.

## 2026-08-15 — Auto coroner email no longer overwrites the topic deploy target

### Fixed
- **Auto-coroner-email PM was clobbering the report's deploy target** (`deployCoronerEmail.js`) — when a coroner-report/mass-fatality deploy posts a topic (`deployUrl` = PHMC topic) and then auto-sends the coroner email as a side-effect on the SAME record key, the email's `markReportComplete(..., 'pm', pmUrl)` overwrote `deployUrl` with the LSSD PM URL. "View post ↗" and Edit & Repost then pointed at the PM instead of the PHMC topic. The side-effect email now writes its URL to `coronerEmailUrl`/`coronerEmailSentAt`/`coronerEmailTo` and leaves the topic's `deployUrl`/`deployType`/`deployTopicId` intact. Standalone `coroner_email` reports still deploy normally via `markReportComplete('pm', …)`.
- **Repaired the existing Alfonso Tanilon record** (topic `t=9982` restored as `deployUrl`, PM URL preserved under `coronerEmailUrl`).

### Notes
- Deploy to VPS: SCP `services/deployCoronerEmail.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — Self-serve "Edit & Repost" for deployed reports

### Added
- **Deploy target persisted on every report** (`deployStatus.js`) — `markReportComplete` now stores `deployUrl` (+ parsed `deployTopicId`/`deployPostId`) on the report record, so the system knows WHERE each report was posted (required for in-place editing and for the "View post ↗" links in the web app).
- **`forumClient.editPostContent(topicId, forumId, postId, newBbCode, { title })`** — edits a post's content (and optional subject) in place via the `posting.php?mode=edit` flow (login handling included); resolves the topic's first post when no postId is given.
- **`reportEdits` worker** (`reportEdits.js`, run from the recovery heartbeat) — applies `reportEdits/<author>/<key> = { status: 'requested' }` requests: loads the regenerated BBCode + the stored deploy target, edits the post in place, then marks the report `deployStatus: 'edited'`. **Autopsy and coroner_email are excluded** from edit-eligibility (heavily automated / PM-based — must not be touched). Failed edits are recorded (`lastEditStatus: 'failed'` + reason) for the UI to retry.

### Notes
- Requires the matching web-app change (`changelog.md`) for the Misc → "Fix Deployed Report" UI.
- Deploy to VPS: SCP `services/deployStatus.js`, `services/forumClient.js`, `services/reportEdits.js`, `services/autoDeploy.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — Fix LSPD/LSSD status write on a root Reference

### Fixed
- **`db.ref is not a function` on crosspost status writes** (`deployLspd.js` + `deployLssd.js`) — the completion flow passes `state.dbRef`, which is a **root Reference** (`db.ref()`; has `.child`, no `.ref`), so `writeStatus`/the retry sweeps calling `db.ref(...)` threw and silently skipped `lspdCrosspostStatus`/`lssdCrosspostStatus` (left stuck at `pending`/unset while the actual forum crosspost posted fine). Both files now route all status writes/queries through a `refFor(db, path)` helper that handles a Database (`.ref`) or a Reference (`.child`).
- **Ledger corrected** — `9951` and `9974` set to `lspdCrosspostStatus: completed` (their reports were already posted to #128223 / #128346); verified the fix path works with both db shapes.

### Notes
- Deploy to VPS: SCP `services/deployLspd.js`, `services/deployLssd.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — Faction-specific "Gov Intranet" link in completion notices

### Changed
- **The completion notice's Gov-Intranet line is now faction-specific** (`completionTemplate.js` + all 5 `buildCompletionBb` call sites) — instead of the hardcoded "For LSPD… and for LSSD…" text it now renders one of:
  - **LSSD crossposted** → direct link to the posted LSSD completion reply (`lssdUrl`).
  - **LSPD** → direct link to the LSPD certified-copy topic (`lspdUrl`, from the tracked `lspdTopicId`), or the f=1361 viewforum when no topic id exists.
  - **Neither (private / no crosspost)** → "The completed report has been delivered to your PHMC Intranet Inbox."
- `buildCompletionBb` now takes a `{ faction, lssdUrl, lspdUrl }` context (a plain string is still accepted as the LSSD URL for backward compat). Faction is derived from `entry.faction` / the request `[LSPD]`/`[LSSD]` title tag, falling back to `private`.
- Applied across the main completion flow, the picker path (`deployInteraction.js`), the recovery retry (`retryFailedCompletionSteps`), and `/force-autopsy-send`.

### Notes
- Deploy to VPS: SCP `services/completionTemplate.js`, `services/deployAutopsyReply.js`, `services/deployInteraction.js`, `commands/force-autopsy-send.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — Picker path fixed + stuck multi cases repaired + COMPLETED gated for multi

### Fixed
- **The staff-pick completion path (`deployInteraction.js`) now handles multi-decedent records** — it only matched top-level `oocName` and never did the LSPD crosspost, so any multi (or manually-picked) case that deployed through it was never marked completed and never crossposted. It now matches by the replied `caseTopicId` (top-level + per-case `cases/<idx>`), marks per-case `completedAt` (+ request-level when all decedents done), and fires the LSPD crosspost (`crosspostAutopsyToLspd`).
- **COMPLETED replies are deferred until the whole multi request is done** (`deployAutopsyReply.js` + `deployInteraction.js`) — the PHMC f=265 completion notice and the requester DM no longer post "We have completed the autopsy investigation" per decedent; for multi records they post only once, when `allCasesDone`. Per-decedent report deliveries (LSPD/LSSD crossposts) still happen as each case completes, so no report is lost.

### Repair (manual, applied via a one-off DB script + recovery heartbeat)
- **Retro-completed the two stuck multi cases** that deployed via the picker path and never completed:
  - `9951/case0` (Anne Carter / Marvion Futrell) → LSPD #128223 report posted, f=265 completion reply posted.
  - `9974/case0` (Brandy Smith / Roman Kuznetsov) → LSPD #128346 report posted, f=265 completion reply posted.
- **Re-queued the Vuk Dragovich report** (was `skipped_manual`) — cold-load redeployed it via the multi direct-lookup to `caseTopicId 9976`, posted the reply, completed `9974/case1`, and crossposted Vuk's report to LSPD #128346. `9974` is now fully complete (both decedents).

### Notes
- `9951` stays open until Dylan Bongo's autopsy is submitted (correct — one decedent still pending).
- The premature f=265 completion replies already posted during the repair (Roman @22:49, Marvion @22:48) are on the forum and not retro-fixed; the new gating prevents this going forward.
- Minor ledger quirk: the LSPD crosspost status write logs `db.ref is not a function` for the passed db object (status field stays `pending`), but the crosspost itself posts fine — flagged for a follow-up.
- Deploy to VPS: SCP `services/deployInteraction.js`, `services/deployAutopsyReply.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — Autopsy deploy uses the tracked case topic for multi-decedent cases

### Fixed
- **Autopsy report deploys no longer prompt staff to pick a case thread for multi-decedent requests** (`deployAutopsyReply.js`) — the direct lookup only matched TOP-LEVEL `oocName`/`name`/`caseTopicId`, but multi records store those per-case under `cases/<idx>` (top level has none), so e.g. a "John Doe ((Marvion Futrell))" report fell through to the forum search and asked staff to pick. The direct lookup now also scans multi records' per-case data (OOC match takes priority; name match as fallback with the "john doe" guard; active case preferred over completed, then newer `caseNum`) and uses the tracked `caseTopicId` directly. Verified against live data: Marvion Futrell → #9955, Dylan Bongo → #9956, Roman Kuznetsov → #9975, Vuk Dragovich → #9976 — no search, no picker.
- This also closes the original "Vuk Dragovich pick expired" class: a tracked multi case never needs a manual pick.

### Notes
- Reports for cases that were never tracked (manually-created threads) still fall back to the search + picker, as before.
- Deploy to VPS: SCP `services/deployAutopsyReply.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — Dashboard/startup-scan split multi-decedent ME rows

### Fixed
- **The dashboard "🔬 ME Assignments" section no longer comma-merges multi-decedent MEs** (`dashboardManager.js`) — it keyed off the top-level `assignedTo`/`title` (the dashboard aggregate), rendering `**Anne Carter, Alyson Frost** — *Dylan Bongo, Marvion Futrell*`. It now expands multi records per-case (`cases/<idx>/assignedTo`), showing one row per ME with their own decedent (`oocName`) and their own case URL. Verified against live data (9951 → Anne Carter @9955 / Alyson Frost @9956; 9974 → Brandy Smith @9975 / Arthur Blackwood @9976).
- **The startup "Autopsy Status" scan lists multi-decedent cases per ME too** (`autoDeploy.js`) — same expansion, so the `• Decedent → ME` lines never show a comma-joined ME.
- (Together with the `autopsy-stats` split, no surface merges multi names anymore.)

### Notes
- The overdue monitor (`systemMonitor.js`) still reports multi requests at request level with the aggregate ME — flagged as a possible follow-up if per-case overdue reporting is wanted.
- Deploy to VPS: SCP `services/dashboardManager.js`, `services/autoDeploy.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — autopsy-stats splits multi-decedent ME rows

### Fixed
- **`/autopsy-stats` no longer merges multi-decedent MEs** (`commands/autopsy-stats.js`) — the "By ME (assignments)" section keyed off the top-level `assignedTo`, which for multi records is the comma-joined dashboard aggregate (e.g. "Anne Carter, Alyson Frost: 1 assigned / 0 done"). It now iterates the per-case assignments (`cases/<idx>/assignedTo`), counting each decedent's case against its own ME (per-case `completedAt` for the done count), with a legacy fallback that splits the aggregate string when no per-case records exist. Verified against live data: 9951/9974 now contribute to the correct individual MEs instead of merged rows.

### Notes
- Deploy to VPS: SCP `commands/autopsy-stats.js` + `pm2 restart phmc-bot`.

## 2026-08-14 — Surge mode surfaced in rotation UI

### Changed
- **`getRotationStatus` now reports surge state** (`autopsyRotation.js`) — returns `surgeMode` (every non-LOA ME has ≥1 active case) and `surgePick` (the deterministic next surge assignment: least-loaded ME, ties → oldest `lastAssigned`, preserving rotation order for exact ties). Mirrors `selectME` Phase 2 exactly.
- **`/rotation-list` shows a surge banner** — when surge is active the embed prints `🔀 SURGE MODE ACTIVE` with the least-loaded/oldest tie-break rule and the concrete next pick, and `Next Up` reflects the surge pick instead of "all busy".
- **`/autopsy-request` preview embed shows rotation status** — when no explicit `me:` override is given (auto-assign), the preview adds a `Rotation Status` field: `🔀 Surge mode active — … → next up: <name>` in surge, or `Rotation next up: <name>` in normal mode.

### Notes
- Deploy to VPS: SCP `services/autopsyRotation.js`, `commands/autopsy-request.js`, `commands/rotation-list.js` + `pm2 restart phmc-bot`.

## 2026-08-13 — Autopsy detection: single live progress embed

### Changed
- **Autopsy detection now posts ONE live-updating progress embed per request** (`autopsyRequestMonitor.js`) instead of 4 separate messages ("Autopsy Case Created" webhook, `@owner` case-posted ping, "New Autopsy Request Detected" embed, batch summary). The embed walks through the same sections used by report deploys:
  - `Autopsy Case Detected — Fetching Information` → `FOUND: CASE` → `POSTED TO CASE MANAGEMENT` → `ASSIGNED MEDICAL EXAMINER` → `CROSSPOSTED TO LSPD/LSSD`, then finalizes green/red.
  - The **ME assignment ping is unchanged** (`notifyAssignment` still tags the assigned ME on Discord).
- **Embed survives reprocessing + bot restarts** — the Discord message id, channel, and step history are persisted on the request entry (`progressMessageId`/`progressChannelId`/`progressSteps`), so the state machine resumes the SAME message across monitor cycles instead of duplicating embeds.
- Per-request and batch "New Autopsy Request Detected" notifications removed; the restart-time Initial Scan summary is kept.

### Notes
- Deploy to VPS: SCP `services/autopsyRequestMonitor.js` + `pm2 restart phmc-bot`.

## 2026-08-11 — Multi-decedent autopsy completions (LSPD/LSSD crossposts per case)

### Fixed
- **Autopsy completion flow now handles multi-decedent requests** (`deployAutopsyReply.js`) — the completion matcher previously only looked up top-level `caseTopicId`/`oocName`/`name`, so a split request (e.g. `John Doe ((Dylan Bongo, Marvion Futrell))` → cases 485/486) could never be matched when a case completed: no LSPD/LSSD completion reply, no DM, no rotation decrement. Now:
  - **Match step 4** scans `autopsy-requested/*/cases/<idx>/caseTopicId` and matches the specific decedent case.
  - Completion state is written **per case** (`cases/<idx>/completedAt`); the request is only marked fully completed when every decedent case is done.
  - `clearAssignment` uses the per-case ME; the LSPD completion reply uses the per-case decedent name/OOC, case title, and case topic id.
  - The LSPD thread is treated like a normal request thread: the completion reply goes to the same preserved `lspdTopicId` (128223) once per case.

### Notes
- Deploy to VPS: SCP `services/deployAutopsyReply.js` + `pm2 restart phmc-bot`.

## 2026-08-11 — Patient index: search by ID too

### Changed
- **`GET /api/patients?q=` now matches by patient ID as well as name** (`morgue-api.js`) — `q` matches name-substring **or** numeric-ID substring, so the web app can resolve/validate a patient name from the ID the ME typed (bidirectional lookup for the Paolina Russo / patient 1919 patient-name leak).

### Notes
- Deploy to VPS: SCP `morgue-api.js` + `pm2 restart morgue-api` (already live).

## 2026-08-11 — Multi-decedent autopsy requests split into separate cases

### Fixed
- **Autopsy requests with multiple decedents now create one case per decedent** (`autopsyRequestMonitor.js`) — previously a request like `John Doe ((Dylan Bongo, Marvion Futrell))` (or a Section 2 body with numbered decedents `John Doe[1]((OOC A))` / `John Doe[2]((OOC B))`) produced ONE case with the names merged. Now:
  - The request **body is the authoritative split source** — every `Decedent Name:` line in Section 2 is parsed (`parseDecedentNameLine`: name, `[N]` marker, `((OOC))`), with the title's comma-split as fallback when the body isn't parseable.
  - Each decedent gets its own f=266 case topic, sequential case number, fair-rotation ME assignment, and per-case state under `autopsy-requested/<topicId>/cases/<idx>/`.
  - LSSD/LSPD crossposts + the acknowledgement reply run once per request (after all cases).
  - Startup assignment rebuild and `retryFailedAssignmentReplies` count/retry per-case assignments for multi records; top-level gets `caseState:'multi'`, `decedentCount`, aggregated `assignedTo` for dashboards.
  - Single-decedent requests are untouched (original inline state machine preserved).

### Notes
- Deploy to VPS: SCP `services/autopsyRequestMonitor.js` + `pm2 restart phmc-bot`.

## 2026-08-11 — Emergency deploy handbrake: blank employee identity

### Added
- **`runDeploy` now hard-stops any deploy whose report has an empty `coronerEmployee`/`phmcEmployee`** (`deployExecutor.js`) — the critical gate for the Sarah Bell / Xavier Bogdanovic blank-credentials incident. Before any handler runs (topic, PM, medical record, autopsy reply), the report's expected employee field is validated per form (`coroner-report`/`coroner_email`/`death_record`/`mass-ftality-test`/`autopsy` → `coronerEmployee`; medical forms → `phmcEmployee`; unknown forms block only when both are empty). On failure the report is marked `deployStatus: 'blocked_empty_employee'` (never retried), removed from the retry queue, a red **DEPLOY BLOCKED** webhook pings the developer, and the progress embed is updated.

### Notes
- Recovery: fix the report data (re-save in the app or `node tools/fix-empty-coroner.mjs --include-scheduled --apply`), set `hasdeployed:false` + `deployStatus:'pending'`, restart the bot.
- Deploy to VPS: SCP `deployExecutor.js` + `pm2 restart phmc-bot`.

## 2026-08-11 — morgue-api serves dev EMS protocols

### Added
- **`GET /api/protocols-dev`** — serves `data/protocols-dev.json` (the dev EMS protocols dataset with embedded base64 images, ~1.8 MB) to the `getProtocolsDev` Firebase function. Key-protected via `validateApiKey`, same pattern as `/api/agency-credentials`. Keeps the heavy dataset off RTDB.

## 2026-08-10 — Reassign notice quotes the new ME + bold not strikethrough

### Fixed
- **`/reassign-autopsy` reassignment reply now pings the new ME** — the notice was posted without a `[quote]`, so phpBB never notified the reassigned user. It now opens with `[quote="<newME>" user_id=<forum uid>]` (uid resolved from the group member list, matching the monitor's assignment pattern).
- **Old ME rendered in `[b]` instead of `[s]`** — the previous assignee was struck through; it's now bold alongside the new assignee.

## 2026-08-09 — Overdue autopsy alert + autopsy stats

### Added
- **Overdue autopsy monitor** — the system monitor (2h cycle) now flags autopsy requests stuck in a non-final state (`detected`/`case_created`/`me_assigned`/`ack_sent`, no `completedAt`) past their wait window and pings the bot owner with a list of the overdue cases (name, PK/CK type, assignee, state, since, limit, case #). Limits are **type-aware** via `parsed.deathType`: **CK = 72h (3 days)**, **PK = 120h (5 days)**, untyped falls back to `AUTOPSY_OVERDUE_HOURS` (48h). Configurable via `AUTOPSY_OVERDUE_HOURS_CK`/`AUTOPSY_OVERDUE_HOURS_PK`. Cooldown of 6h between alerts (tracked at `monitoring/autopsyOverdue`), mirroring the morgue-overdue check.
- **New `/autopsy-stats` command** (owner) — reads all `autopsy-requested` entries and summarizes **received / processed** by **month (last 6)**, **week (last 4, Mon-start)**, **last 30 days**, **faction**, and **assigned ME** (assignments vs done), plus the current **pending** list with days outstanding. `detectedAt` = submission time; `completedAt`/`caseState=complete` = processed.
- **New `/autopsy-request` command** — MEs (or the bot owner) submit an autopsy request for supervised final exams. Optional `case:<morgueCaseId>` prefills Section 2 (decedent name/OOC/gender/date+time of death/location) from the morgue record; `me:<name>` (autocomplete over the rotation) picks the supervising ME.
- **3 chained Discord modals** collect the template fields (Decedent 1/3, Decedent+OOC 2/3, Requester 3/3) with the standard Section 3 defaults ("This body has been donated by Los Santos County for research and education purposes..." / "Authorized training by Los Santos County.").
- **Dry-run preview embed** — the full request BBCode renders in Discord (truncated preview + `.txt` attachment) with **Approve & Post / Edit / Deny** buttons; nothing posts until Approve. Drafts persist in `autopsy-request-drafts/`; Edit retires the old draft so a stale preview can't be approved.
- **On Approve** the request posts to **f=265** in the standard `Autopsy Request - Name ((OOC)) [LSPD/LSSD]` format, carrying an **`ASSIGNED: <ME> for Final Autopsy Exams`** marker in Section 3.
- **Monitor honors the marker** — `parseAutopsyRequestBbcode` now extracts `assignedOverride`, and Step 2 assigns that ME instead of rotation (falling back to rotation if the ME is on LOA). The assigned ME is now also **tagged on Discord** (`notifyAssignment`) when a mapping exists.
- **Fixed a pre-existing parser bug** — `parseAutopsyRequestBbcode`'s decedent-name regex `Name\(s?\)?` required a literal `(` (only matched "Name(s):"), so the standard "1.) Decedent Name:" never extracted; now matches both forms.

### Notes
- Runs for the bot owner or any Discord user mapped to a rotation ME (`autopsy-requests/discord-members`).
- Requires a bot restart; `/autopsy-request` is registered on startup.

## 2026-08-09 — Facebrowser posts: 48h publish delay + next-of-kin disclaimer

### Added
- **Face posts are now scheduled instead of published instantly** — approving a death record writes a `scheduled` entry in `facePostDrafts` with `publishAt = approval + FACE_PUBLISH_DELAY_HOURS` (default **48h**, `0` = next sweep). A new `startFacePublishSweep` (registered in `index.js`) sweeps `facePostDrafts` every 60s and publishes due posts (real or simulated per `FACE_DRY_RUN`), then updates the death record draft embed's `Facebrowser Post` field with the published/simulated link. Schedule survives restarts (persisted in RTDB, not an in-memory timer). `FACE_PUBLISH_DELAY_HOURS` documented in `.env.example`.
- **Scheduled Face posts appear on the system dashboard** — a `📅 Scheduled Face Posts` field lists each pending post (decedent + relative publish countdown via Discord timestamp), capped at 5 with a `...and N more` overflow, or `✅ None scheduled` when clear. Staff can see what will go public and when.
- **Next-of-kin disclaimer appended to every Face post** — `generateFacePostContent` now ends each post with: *"We utilize social media only when all other avenues of locating a next of kin have been exhausted, typically waiting up to 48 hours of extensive searching before publication."* (shows in the draft's `Face Post Preview` too).
- **Deny cancels a pending schedule** — denying a death record draft marks its scheduled Face post `cancelled` so it never publishes.
- **Approval embed/log reflect the schedule** — the draft's `Facebrowser Post` field shows `Scheduled to publish <UTC time> (+48h delay)` instead of a URL, and the `[OK] Death Record Posted` log includes the scheduled time. `/face-redraft` reports the scheduled time too.

## 2026-08-09 — Draft embed shows Facebrowser post preview

### Added
- **Death Record drafts now include a `Face Post Preview` field** (when Face is configured) — the exact content `generateFacePostContent` will publish on Approve, rendered before review so staff can verify the automated post. It uses the same generator as publish time (the forum link, appended at publish, is the only absent piece); the content is short so it stays well under Discord's 1024-char field cap (capped at 850 defensively). Field is appended last so the edit modals' index-based field splices are unaffected.

### Fixed
- **Face post URLs use the correct public path** — `postToFace`/`findFacePostByContent` and the dry-run SIM URLs built `https://face.gta.world/posts/<id>`, but Face's public URL is singular `https://face.gta.world/post/<id>`. All URL builders (including the `face-post-test.mjs` debug log) now emit `/post/`.
- **Face post content no longer leaks raw BBCode** — values like `placeOfDeath` (e.g. `[url=https://...]Autopia Parkway[/url]`) were emitted verbatim into the plain-text Face post, so the literal `[url=` tag showed in the preview *and* on the published post. `generateFacePostContent` now runs every detail value through a new `stripBbcode` helper (collapses `[url=...]`/`[quote]` wrappers to their label, drops `[img]` blocks, removes remaining tags, collapses whitespace). Fixes both the draft preview and the auto-published post.

## 2026-08-09 — Death Record drafts validate the (( )) OOC name on unidentified morgue records

### Changed
- **An unidentified morgue record whose `(( ))` name matches the report's `decedentOOC` now counts as a confirmed (HIGH-confidence) match** — since every uploaded record stores the real identity as `NAME: Unknown (( <OOC name> ))`, matching that `(( ))` name against the report's OOC field validates the decedent. `findMorgueRecord`/`isLowMatch`/`isMorgueRecordIdentified` now accept the report's `decedentOOC` and extract the `(( ))` name via the new `extractMorgueOocName` (also stripping `(( ))`-style parentheses on the report side). No more spurious LOW warnings / `needsBetterMorgue` flags / "Check Morgue" prompts for decedents whose identity is confirmed this way.
- **The `Match Confidence` embed field explains the validation** — validated matches show `[OK] HIGH — unidentified case #X` plus a note: `record is "Unknown (( ... ))" — OOC (( <name> )) validated against report decedentOOC`. Only genuinely-unidentified records (no OOC match) stay LOW with the existing warning + Check Morgue flow.
- Applied across all draft paths: autoDeploy, passive CK listener, `recheckMorgueForDraft`, the manual scan, and Face post value resolution.

## 2026-08-08 — Patient index service (medical-records-index.json)

### Added
- **New `services/patientIndex.js`** builds `data/medical-records-index.json` on the VPS (`/opt/phmc-bot/discord-bot/data/medical-records-index.json`) — a name → patient lookup powering the web app's Patient Name autocomplete. Entries: `{ name, id, threadId, lastSeen, pri }`.
  - **Forum is the canonical source** — full rebuild parses phpBB's **"Page X of Y"** footer for the true page count and iterates all pages deterministically (start += pageSize, with `rel="next"` as a fallback; relying on the next button alone stopped at ~page 18 of 42 and captured only 225/1000+ topics). Broad `topictitle` selector + topicId dedupe. Title parsing covers `1424 - Name`, `Patient #1424 - Name`, `1459 Name`, `1053 Name (ooc)`, and `[709] Name`; `[FORM]` stickies are skipped.
  - **Write-through on medical-record deploy** — `deployMedicalRecord.js` upserts the exact `{ name, id, threadId }` right after it resolves or creates the f=97 thread, so the index is current immediately with no forum re-scan.
  - **Deploy resolves the thread from the index first** — exact (case-insensitive) name lookup → reply directly to the stored `threadId`, skipping the forum search for known patients. Non-exact matches still search then create. Stale-index protection: an index-sourced reply that fails re-searches once and retries; if the thread is truly gone it removes the entry so the next deploy creates a new thread.
  - **New-patient creation never reuses a stale form `patientID`** — when no thread matches the name, the bot always auto-assigns a fresh patient id (a leftover ID from a previous autocomplete selection, e.g. 1424, was previously reused for a new patient's thread).
  - **Rapid-re-save guard narrowed** — the same-author + same-form 60s "Rapid re-save" net now only applies when a report has NO patient name/id; a named patient is never trashed just because a *different* patient was saved on the same form within the window (the patient-name dedup already handles same-patient re-saves).

## 2026-08-08 — morgue-api patient-index rebuild hardening + /api/patients

### Changed
- **Concurrency hardening** — all mutations are synchronous on a single in-memory index; a burst of concurrent saves/deploys coalesces into ONE trailing debounced write; all writes serialize the full index through a promise chain and hit the file atomically (tmp+rename), so the morgue-api reader never sees a partial file. Full rebuilds are single-flight (`_rebuildInFlight`) and the 3-day sweep is a single interval, so rescans can't double-fire.
  - **Cadence** — full rebuild every 3 days at 03:00 UTC (startup only if the last build is > 3 days stale, delayed 45s so the shared browser settles).
  - **ID priority** — forum/deploy-sourced ids (pri 2) are never clobbered by lower-priority ids.
  - *(Design note: per-save scanning of `scheduledReports`/`newSavedReports` was dropped — f=97 is the ground truth; only opted-out/dry-run drafts that never thread are excluded until a thread exists.)*
- **morgue-api** — new key-protected endpoints `GET /api/patients` (full index) and `GET /api/patients?q=<name>` (min 2 chars, case-insensitive, newest-seen first, limit 10).

## 2026-08-08 — Morgue date tie-break uses normalized timeOfDeathISO

### Changed
- **Bot now prefers the new normalized `timeOfDeathISO` field on morgue records** (written by `docs/morgue-logger.ps1` and `src/utils/morgue.js`) for the closest-date tie-break (`morgueTimeMs` in `deathRecordDraftCache.js`, also used by `scanAndDraftCKs` and the match-debug candidate distances). Falls back to parsing the display `timeOfDeath` string when the ISO field is absent, so the date resolution no longer depends on the game's display format. `generateDraft` also uses `timeOfDeathISO` for the record's Date of Death fallback.

### Notes
- Requires the parser change to be live: the PS1/JS now emit `timeOfDeathISO` (`YYYY-MM-DDTHH:MM:SS`) on every upload/import. Existing records without it still work via the display-string fallback.

## 2026-08-08 — Death Record drafting: reliable morgue matching + confidence gating

### Fixed
- **Public death records could pull the wrong (oldest) morgue case.** `findMorgueRecord` used `new Date(referenceDate)` for its closest-date tie-break; the mass-fatality form's `pronouncedTimeOfDeath` is `"MM/DD/YYYY - HH:MM"`, which parses to `Invalid Date` → `NaN`. The tie-break was silently skipped and the lexicographically-first name match (an old unidentified case) won, producing wrong age/race/location (e.g. Thomas Mills → case #77114 age Unknown/Rancho instead of the identified case; Jacob Watson → #75699 La Mesa instead of #79460/#81080). `parseDate()` now handles ISO, slash (`MM/DD/YYYY - HH:MM`, day-first), and morgue `"Weekday, DD Month YYYY HH:MM:SS"` formats, and is used for the reference date and every morgue `timeOfDeath` in the tie-breaks (`deathRecordDraftCache.js`, `scanAndDraftCKs`).
- **Mass-fatality drafts fed an unparseable date down the whole pipeline.** `passivCKCheck` copied `dec.pronouncedTimeOfDeath` straight into `dateTime`/`dateOfDeath`. It now normalizes to ISO via `toIsoDate()` (preferring the report's ISO `dateTime` as fallback), so the reference date, the tie-break, and the displayed `Date of Death` are all reliable (no more `05/08/2026 -` residue).
- **Morgue re-checks couldn't find the source report for mass-fatality drafts** (draft keys carry a `_decedentN` suffix; the report lives under the base key). `findSourceReport`/`viewReportForDraft` now strip the suffix and re-merge the per-decedent data before regenerating; the same fix applies to `resolveFacePostValues` in the Face flow.
- **Low-confidence matches were approved as if verified.** Drafts now carry a `Match Confidence` field on the embed with the score (HIGH/LOW), the matched case, why it was chosen (reference date used/skipped), and the competing candidates with distance-from-reference — plus a `morgueMatch` debug object persisted on the draft for later isolation.
- **Placeholders removed from the public record** — `((Morgue Script Bug))` / `((Unknown due to Morgue Bug))` render as plain `Unknown` (these forced manual edits, e.g. the wrong "Age: 19" on Thomas Mills).

### Added
- **Low-confidence gate + delayed re-match:** drafts matched to an unidentified case (`Unknown (( ... ))` / `identified: No`) are flagged `needsBetterMorgue: true`, get an amber warning + `Check Morgue` button, and are **re-evaluated automatically** when morgue data changes (`startMorgueListener` now also queries `needsBetterMorgue`). `recheckMorgueForDraft` regenerates only when the match improved (different case or a low→high upgrade) and also handles OOC-name matching.

### Notes
- Already-approved forum posts (t=9932/t=9933) are NOT retro-fixed by this — they need a manual forum edit per the "no retro-fix for posted reports" convention.

## 2026-08-08 — `scripts/` renamed to `debug-testing-scripts/`

### Changed
- **Ad-hoc/debug scripts directory renamed** `scripts/` → `debug-testing-scripts/` for clarity (these are probes/one-shot tools, not runtime code). Updated all references: `force-lssd-crossposts.sh` runner, `.env.example` FACE_PAGE_ID hint, `FB-API.MD`, `facePost.js` error message, and in-file usage comments.
- **Deploy note:** when syncing to the VPS, rename the directory there too (`mv /opt/phmc-bot/discord-bot/scripts /opt/phmc-bot/discord-bot/debug-testing-scripts`) or the `.sh` runner path will 404.

## 2026-08-08 — Medical record deploy searches the real patient name

### Fixed
- **`deployMedicalRecord.js` searched `patientName || decedentName`, but `patientName` could be polluted with the author's name** (legacy credential-sync wrote the OAuth character name into it, which leaked via form progression). That made the bot search for — and thread-title — the poster instead of the patient (e.g. "Aisha Rose" instead of "Sophie Imani"). The search now prefers **`decedentName`** (the field the medical Patient Name input actually writes), falling back to `patientName` only when it's absent.

### Notes
- Re-scheduling a mis-deployed report: set `hasdeployed:false` + `deployStatus:'pending'` in `scheduledReports/<author>/<key>`, then restart the bot — cold-load treats it as pending and re-queues.

## 2026-08-07 — Recovery heartbeat startup sweep delayed

### Fixed
- **Startup recovery sweep no longer races the browser init** — `startRecoveryHeartbeat` ran the first sweep immediately at boot, concurrently with the shared browser's startup tasks (roster sync, forum logins, group-member fetches), intermittently throwing `Target page, context or browser has been closed` and skipping that tick. The startup sweep is now delayed 30s so browser startup settles first; the 10-minute cadence is unchanged. (Self-healing either way — each sweep re-scans missing work — this just removes the noise.)

## 2026-08-07 — LSSD request topic auto-creation for non-caselink requests

### Added
- **The bot now creates the LSSD request topic for non-caselink LSSD autopsy requests.** Previously the bot only *searched* f=2263 for an existing LSSD topic (relying on CASELINK to auto-post), so a request from a human officer that only existed on the PHMC forum had no LSSD topic and the completion crosspost (`lssdCombinedReply`) failed with "LSSD request topic not found via search". In `autopsyRequestMonitor.js` Step 3, when the f=2263 search returns nothing the bot now:
  - Resolves the PHMC request poster via `getTopicPoster`.
  - **CASELINK requests** (`CASELINK [Bot]`) → skips creation entirely — CASELINK creates its own topic, never duplicate it.
  - **Human requests** → re-searches f=2263 once more to close the CASELINK race window, then creates the topic on f=2263 (`Autopsy Request - <name> (( OOC )) [LSSD]`), saves `lssdRequestTopicId`, marks `lssdRequestCreatedByBot: true` and `lssdCrosspostStatus: pending`.
  - **Unresolvable poster** → skips creation (conservative, guarantees no CASELINK duplication) and logs a warning for manual/recovery-sweep handling.
- The newly-created topic ID feeds straight into the existing acknowledgement reply and the completion `lssdCombinedReply`, so the completion report lands on LSSD for every non-caselink case.

## 2026-08-07 — /dev panel: Autopsy & Death Records sub-menu

### Added
- **`/dev` → "Autopsy & Death Records"** button opens a sub-panel with:
  - **Run-now buttons** (no args): Rotation List, Force Autopsy Check, Sync Autopsy Requests, Sync Autopsy Poster, Death Records Pending — they invoke the existing command logic directly.
  - **Prompt buttons** (open a modal for arguments): Force Autopsy Send (OOC), Face Redraft (report key), Death Record Check (date) — the modal feeds the existing command's `execute()` via a patched options resolver.
  - **Back** button returns to the main panel.
- `/dev` panel construction moved into `services/devPanel.js` (`showDevPanel`), with `handleDevActionModal` for the arg-driven commands. The legacy `/autopsy` command remains a redirect (superseded by these shortcuts).

## 2026-08-07 — Agency credentials management commands

### Added
- **`/agency-creds` (owner)** — manage the shared faction-forum credentials file (`data/agency-credentials.json`) directly from Discord. Subcommands: `list` (show configured domains), `set <domain> <username> <password>`, `remove <domain>`. Updates apply immediately (the morgue-api reads the file per request — no restart).
- **`/dev` (owner) — Developer Tools panel** — a button-panel launcher to reduce slash-command clutter. Buttons:
  - **Restart Bot** — `pm2 restart phmc-bot`
  - **Agency Credentials** — opens a modal to set or remove a credential
  - **List Credentials** — shows configured domains
- New shared service `services/agencyCredentials.js` (load/set/remove) used by both `/agency-creds` and the `/dev` modal; `services/devPanel.js` holds the button/modal handlers.

## 2026-08-07 — Hardened morgue-api IP banning

### Changed
- **Bans are now PERMANENT** — an IP that triggers a suspicious-request ban stays banned indefinitely (previously 1 hour).
- **Bans + strike counts persist to disk** (`data/ban-state.json`, atomic write) and are reloaded on startup, so a banned scanner does **not** get a fresh slate after a server restart.
- **Obvious scanner/CVE probes ban on FIRST hit** — labels starting `CVE-`/`SCAN-` (phpunit eval, `.env`, wp-admin, git-config, etc.) instantly permanently ban the IP.
- **Ambiguous attempts use a 2-strike rule** — RCE/SQLi/path-traversal/SSTI/etc. count toward `MORGUE_BAN_THRESHOLD` (default 2) before a permanent ban.
- **Webhook confirmation** now reads: `IP <ip> was banned for <reason>` (e.g. `CVE-phpunit-eval`), including threshold/duration/permanent marker. Banned-IP request responses now report the ban reason too.
- `MORGUE_BAN_DURATION_MS` removed (no more temporary bans); `.env.example` updated.

## 2026-08-07 — Agency credentials endpoint (morgue-api)

### Added
- **`GET /api/agency-credentials`** (key-protected) — serves the shared faction-forum account credentials from `data/agency-credentials.json` on the VPS. Used by the new `getAgencyCredentials` Firebase function so the web client never ships credentials. Read live per request (no restart needed to update the JSON).

## 2026-08-06 — Facebrowser posts automated + crash recovery

### Changed
- **Facebrowser post is now fully automated** — approving a death record posts to f=404 and immediately publishes the Facebrowser post via the Face page API (`postToFace`), no separate Discord review step. `FACE_DRY_RUN` still controls live vs simulated. The death record's `[OK] Death Record Posted` embed now includes both the forum link and the Facebrowser post link, and the death record draft embed's "Facebrowser Post" field shows `Published: <url>` (or simulated).
- **Crash/restart recovery for interrupted death record approvals** — `handleApprove` marks drafts `deploying: true` before posting. On startup, `recoverInterruptedDeathRecordApprovals` finds drafts left mid-approval by a crash, uses the Facebrowser API (`findFacePostByContent`) to verify whether the auto Face post actually landed, records it if found (so it won't be duplicated), clears the flag, and posts a `[WARN] Death Record Approval Interrupted` alert telling staff whether the f=404 post needs re-approving. New Face helpers: `getFacePost`, `findFacePostByContent`.
- **`/face-redraft` now re-publishes instead of sending a review draft** — reports the published Face URL (skips if already published).

### Notes
- Requires `".indexOn": ["needsMorgue", "deploying"]` at `/deathRecordDrafts` in `functions/database.rules.json` — deploy with `firebase deploy --only database`.

## 2026-08-06 — Duplicate death-record drafts on mass fatalities

### Fixed
- **Mass fatality with multiple CKs could send two draft messages for the same decedent** — a report that landed in both `scheduledReports` and `newSavedReports` was drafted twice because two listeners run the death-record check (`autoDeploy`'s `scheduledReports` listener and the passive `newSavedReports` listener), and the Firebase exists-guard in `checkAndDraftIfMorgueMatched`/`processCKReport` is a non-atomic read-then-write that races when both fire concurrently. Both functions now guard with a synchronous module-level in-flight set first, so the second concurrent run skips and only one draft message is sent per decedent.

## 2026-08-06 — Facebrowser death-record integration deployed + live

### Fixed
- **Facebrowser post flow was never wired up on the bot** — `facePost.js` was missing from the VPS and `deathRecordDraft.js` / `deathRecordDraftActions.js` / `index.js` were running old versions, so approving a death record posted to f=404 but never kicked off the Facebrowser post draft. All four files are now deployed: the death record approval flow auto-creates a "Facebrowser Post Draft" review embed, and the `face_approve_`/`face_edit_`/`face_deny_` buttons work.
- **`FACE_DRY_RUN` set to `false` on the VPS** — approving a Face draft now publishes a real Facebrowser post via the Face page API instead of simulating.

### Added
- **Death record embed now shows Facebrowser status** — the original death record embed gains a "Facebrowser Post" field: "Draft sent for review" right after forum approval, updated to "Published: <url>" once the Face post goes live (and "Simulated (FACE_DRY_RUN)" when dry-run).
- **`/face-redraft` (owner)** — re-kick the Facebrowser post draft for an already-approved death record (e.g. records approved before this deploy). Usage: `/face-redraft reportkey:_Mass_Fatality_..._decedent1`.

### Notes
- There is **no automated retry/heartbeat sweep for failed Face posts** — if the Face API rejects an approval, the draft stays `pending_review` with `lastError` recorded and staff re-click "Approve & Post to Face".

## 2026-08-06 — Centralized autopsy completion template

### Changed
- **`COMPLETION_TEMPLATE` + `buildCompletionBb()` moved to a single shared module** (`services/completionTemplate.js`). Previously the template was duplicated in three places (`deployAutopsyReply.js`, `deployInteraction.js`, `force-autopsy-send.js`), each with drift — the picker/force copies still had an older header + static CASELINK text while the main flow had the `LSSD_COMPLETION_LINK` feature. All three now import from the shared module, so the completion notice is identical everywhere. `deployAutopsyReply.js` re-exports `COMPLETION_TEMPLATE` for backwards compatibility.

## 2026-08-06 — LSSD autopsy completion posts first + direct link in PHMC reply

### Changed
- **LSSD completion reply now posts BEFORE the PHMC completion reply** — for LSSD requests the combined reply (completion notice + full report) is posted to f=2263 first, then the PHMC completion notice goes to f=265. Non-LSSD and private cases keep the previous order.
- **LSSD reply URL saved to Firebase** — on success the bot writes `lssdCompletionUrl` (plus `lssdCrosspostStatus: completed` / `lssdCrosspostedAt`) to `autopsy-requested/<key>`, so the posted LSSD reply can be linked from the PHMC completion notice.
- **PHMC completion notice links straight to the LSSD post** — `COMPLETION_TEMPLATE` line now contains a `LSSD_COMPLETION_LINK` placeholder (replacing the static "CASELINK PORTAL or LSSD Autopsy Records" text). When the LSSD post URL is available it renders a direct `[url]` link; if the LSSD crosspost fails the original static text is used as a fallback. `buildCompletionBb()` centralizes the template substitution.
- **Retry sweep** — `phmcCompletionReply` retries reuse the stored `lssdCompletionUrl` so re-posted f=265 replies still carry the link; `lssdCombinedReply` retries re-save the new URL on success.

## 2026-08-05 — Medical record thread search by patient name

### Changed
- **`handleMedicalRecord` searches by the real patient name** — medical forms populate `patientName`, not `decedentName`, so `patientName` was falling back to `originalKey` (the report title, e.g. the old `Patient_Lucas Shade`). It now prefers `data.patientName` → `data.decedentName` → `originalKey`, so the f=97 thread search matches the actual patient name.

## 2026-08-05 — Morgue matcher prefers closest date of death

### Changed
- **`findMorgueRecord` tie-breaks by date-of-death** — when several morgue records share a decedent's name (e.g. a character CK'd more than once), the record whose `timeOfDeath` is closest to the report's date now wins, instead of the first name-partial-match. Callers pass the report's `dateTime`/`dateOfDeath` as a reference date (`processCKReport`, `checkAndDraftIfMorgueMatched`, `recheckMorgueForDraft`, Face post value reconstruction). `scanAndDraftCKs` now filters to name-matching records first (exact or partial) and picks the closest date among them, falling back to the time-based search only when no name matches.
- Without a reference date the matcher keeps its old first-match behavior, so non-death-record lookups are unaffected.

## 2026-08-05 — Face post values fix

### Fixed
- **Face posts were publishing bare (decedent name only)** — `generateFacePostContent` builds the post from the draft's `values`, but drafts created by the passive CK listener (`checkAndDraftIfMorgueMatched`) and the manual scan (`scanAndDraftCKs`) never persisted a `values` object, so the social post rendered just "Decedent: <name>". Both paths now store `values: draft.values` (matching `processCKReport`).
- **`createFaceDraft` self-heals old drafts** — if a draft has no `values`, it now reconstructs them from the source coroner report (`scheduledReports`/`newSavedReports`) + morgue record via `generateDraft`, persists them back to `deathRecordDrafts/<reportKey>`, then builds the full post. Existing already-approved drafts get the full content on any future Face regeneration.

## 2026-08-05 — Facebrowser Public Death Record posts

### Added
- **Facebrowser (Face) automation for CK Death Records** — once a Death Record is approved & posted to the forum (f=404), the bot now auto-generates a social-media style Facebrowser post draft ("A Public Death Record has been posted, the details are: ...") and sends it to Discord for a separate **review & approve** step before it touches the Face page.
- **`services/facePost.js`** — Face Page API client (`POST /posts` with Bearer `FACE_API_KEY` + `FACE_PAGE_ID`), plus `generateFacePostContent` (plain text: decedent, case #, date of death, manner, location, investigator + forum link) and `deleteFacePost` for corrections. Gated by `FACE_DRY_RUN` (default `true` — approving simulates the post).
- **`services/deathRecordDraftFace.js`** — Face draft review embed with `Approve & Post to Face` / `Edit` / `Deny` buttons and an edit modal, wired into `interactionCreate` alongside the existing `dr_*` handlers. Drafts tracked at `facePostDrafts/<reportKey>` (status, content, `fbPostId`/`fbPostUrl`, approvedBy, dry-run notes).
- **`scripts/face-find-page.mjs`** — helper to locate the PHMC Public Death Records page owned by the API key account (`GET /pages/mine`), filter by keyword (`--name`), and write it to `.env` (`--set` → `FACE_PAGE_ID`).
- **New env vars** — `FACE_API_KEY`, `FACE_PAGE_ID`, `FACE_DRAFT_CHANNEL_ID` (falls back to `DEATH_RECORD_DRAFT_CHANNEL_ID`), `FACE_DRY_RUN`.

### Notes
- The Face post only auto-drafts **after** a real (or dry-run-simulated) forum approval in `handleApprove`. Denied death records never reach Face. Face posts are IC-only (no OOC name on public social media).

## 2026-08-03 — LSSD completion combined into a single post

### Changed
- **LSSD autopsy completion is now ONE post** — the completion workflow previously posted two separate replies to the LSSD request topic (f=2263): a confirmation notice (`COMPLETION_TEMPLATE`) followed by the full autopsy report. These are now merged into a single reply (completion notice, `[hr]` divider, then the full report) — both in the direct-path (`lssdRequestTopicId` saved) and the search-fallback path. PHMC (report → f=266, completion → f=265) and the LSPD crosspost are unchanged.
- **Completion step tracking** — the two legacy LSSD steps (`lssdCompletionReply`, `lssdAutopsyReport`) are replaced by one `lssdCombinedReply` step (progress embed now shows a single "LSSD Completion + Report" step). `retryFailedCompletionSteps` retries the combined content for new entries; the legacy per-step retry handlers are kept so in-flight pre-change cases still recover correctly.

## 2026-08-03 — Psych Evaluation form ID fix

### Fixed
- **Psych Evaluation routing** — the form's Firebase key is `psych-eval` (hyphen), but the bot's medical-record lists used `psych_eval` (underscore), so psych-eval reports were never routed to the Medical Record handler (f=97). Corrected in `forumClient.js` FORUM_MAP, `autoDeploy.js` (listener + dev-reports), and `deployQueue.js` (re-queue scan + queue dashboard label). Psych-eval reports now deploy as medical-record replies.

## 2026-08-02 — Debug output folder + VPS cleanup

### Changed
- **All debug/scan output moved to `debug/`** — forum page HTML dumps (`forumClient.js`: login, PM compose, reply submit), coroner-email and medical-record BBCode dumps (`deployCoronerEmail.js` / `deployMedicalRecord.js`), and `/group-morgue-check` JSON scans (`commands/group-morgue-check.js`) now write into `discord-bot/debug/` (auto-created via `mkdirSync recursive`) instead of the bot root. Existing stray files were relocated there.

### Housekeeping
- **Removed orphaned leftovers from the VPS** — the pre-`services/` refactor stale root copies (`autoDeploy.js`, `deployQueue.js`, `firebase.js`, `autopsy-skip.js`, `death-record-check.js`, `deathRecordDraft.js`, `fix-autopsy.js`, `rotation-set.js`), plus `cleanup-test.js`, `diag-topics.mjs`, a truncated `morgue-` duplicate, and a stray root `force-autopsy-complete.js` (the registered command lives in `commands/`). Registered test commands, log archives, session/roster files, and `morgue-data.json` are retained.

## 2026-08-02 — LSSD crosspost fixes

### Added
- **`searchLssdRequestTopic` (`deployLssd.js`)** — shared, scoped LSSD request lookup against the dedicated autopsy forum **f=2263**. Tries `"Name (( OOC ))"` → OOC name → plain decedent name, and only accepts a result whose title references the decedent (phpBB recency search surfaces unrelated topics). Used by the completion-flow fallback, the retry scanner, the detection-time ack, and the force script.
- **`scripts/force-lssd-crossposts.sh` / `.mjs`** — operator utility to force-publish pending LSSD crossposts. Defaults to dry-run (preview + title-verification); `--post` publishes, `--only "<name>"` filters, `--topic <id>` overrides the target, `--all` bypasses the hard-coded allowlist (`9889` Edwin Fimbres, `9898` Terrell Hylton). Recovers report BBCode from the entry or the report stores when available.
- **Failure notifications across ALL deploy types** — a unified `notifyDeployFailure` (`deployLogger.js`) posts a red `DEPLOY FAILED` embed to the log channel whenever a topic post, forum PM, medical-record reply, LSPD crosspost, LSSD crosspost, or any handler-level deploy fails. Autopsy completion steps get their own `Autopsy Completion Step Failed` alert (`finishCompletionStep`). Failures are now visible to staff in bot-spam immediately, while the self-healing/retry sweeps still handle the actual repair.

### Fixed
- **Autopsy completion faction logic** (`deployAutopsyReply.js`) — the completion flow now derives the target faction from the **request record** (`entry.faction` / `[LSSD]` tag) instead of trusting the ME's report `department` field. A report filled with the wrong agency (e.g. LSPD on an LSSD case) no longer causes the LSSD crosspost to be skipped ("not an LSSD case") or an LSPD post to be created. A console warning flags request/report faction mismatches.
- **Silent `postTopic` failure** (`deployTopic.js`) — a failed topic post previously left the progress embed stuck at "pending" with no status write; it now marks `reply_failed`, finalizes the embed, and alerts the log channel.
- **LSSD skip no longer false-OK** — when an LSSD-tagged entry can't be crossposted (no topic found / no searchable name), the flow now writes `lssdCrosspostStatus: failed` (+ `lssdCrosspostBbCode`) so the recovery scanner retries instead of silently dropping it.
- **`retryFailedLssdCrossposts` self-heals** — when no LSSD topic ID was saved, it now performs a scoped f=2263 search (via `searchLssdRequestTopic`) using the stored OOC/name before skipping, and saves the found topic ID.
- **Detection-time LSSD ack search scoped to f=2263** (`autopsyRequestMonitor.js`) — previously searched all forums; now uses the shared scoped lookup and also runs for requests with no OOC name (plain name match).

## 2026-08-01 — Unified recovery heartbeat

### Added
- **`runRecoveryHeartbeat` (`autoDeploy.js`)** — a single 10-minute recovery sweep (plus startup) that runs ALL self-healing checks in sequence: retry queue, LSSD crossposts, LSPD crossposts, LSPD crosspost recovery, LSPD acks, PHMC acks, completion steps, and assignment replies. Reentrancy-guarded (no overlapping sweeps), per-check error isolation, and a per-check timing summary (`[HEARTBEAT] Sweep complete in Xs — ...`). Cadence configurable via `RECOVERY_HEARTBEAT_INTERVAL_MS`.
- **Uniform SELF HEALING logging** — `notifySelfHeal` moved to `logChannel.js` and now used by ALL recovery sweeps (previously only PHMC ack + LSPD crosspost recovery). Every recovery action — success or failure — posts `SELF HEALING - <topic> / <reason> / <info>` to the log channel.

### Changed
- **Fragmented intervals collapsed** — the separate `checkRetryQueue` (30 min) and three retry intervals (10/10/30 min) are replaced by the single heartbeat. `cleanupOldDeployed` stays at 6 h.
- **`retryFailedLspdCrossposts` now actually runs** — it was defined in `deployLspd.js` but never called; the heartbeat wires it up.
- **Assignment-reply retry extracted** (`retryFailedAssignmentReplies` in `autopsyRequestMonitor.js`) so it runs every heartbeat instead of only at restart; now force-logs-in to PHMC first (the default client may be left on LSPD/LSSD by earlier checks).
- **`retryFailedCompletionSteps` gets a 30-min cooldown** so a persistently-stuck step doesn't spam the sweep every 10 min; summary embeds now say "Recovery Sweep".

### Fixed
- **LSPD ack retry double-post** — `sendAutopsyAcknowledgement` also posts the PHMC ack; the retry now marks `phmc-acknowledge-reply=completed` so the PHMC retry can't re-post in the same sweep.
- **Firebase index warning** — `functions/database.rules.json` now indexes `lspd-acknowledge-reply` / `lssd-acknowledge-reply` / `phmc-acknowledge-reply` (the renamed ack fields) and `lspdCrosspostStatus` on `/autopsy-requested` (removed the obsolete `lspdAck`/`lssdAck`/`phmcAck`), so the `orderByChild` queries in the heartbeat sweeps no longer download-and-filter the whole node. Requires `firebase deploy --only database`.

## 2026-07-31 — flood-aware retry extended to topic creation

### Changed
- **`forumClient.js` `postTopic`** — now has the same flood/stale-token recovery as `replyToTopic`. Topic creation previously had no flood handling, so the 2nd+ topic in a recovery sweep (or any rapid consecutive posts) could be rejected by phpBB flood control and fail with `create failed: unknown`, silently delaying the crosspost to a later sweep. `postTopic` now detects the flood/invalid-form error, waits 25s, reloads the posting form (fresh token), refills subject + message, and resubmits (up to 3 attempts).

## 2026-07-31 — Discord send timeout hotfix + LSPD crosspost self-healing

### Fixed
- **`logChannel.js` `sendLogMessage`** — a stalled Discord `channel.send` had no timeout and could freeze an entire `checkForNewRequests` run mid-step. On 2026-07-31 two LSPD requests (Gregory Saetern, Dedrick Purnell) were created + assigned but never acked or cross-posted because the run hung on the "Autopsy Case Created" notification before step 3. The send is now wrapped in a 10s `Promise.race` timeout, so a stuck send logs a warning and the pipeline continues.

### Added
- **`retryMissingLspdCrossposts` (`autoDeploy.js`)** — LSPD cases whose LSPD crosspost (f=1361) was never created now self-heal: scans all entries at startup + every 10 min, creates the LSPD request topic + posts the LSPD acknowledgement, and persists `lspdTopicId` / `lspd-acknowledge-reply`. Both recovery functions (`retryFailedPhmcAcknowledgements`, `retryMissingLspdCrossposts`) accept `{ force }` to skip the staleness guard for manual recovery runs.
  - **Parallel-close race fixed** — the first version created one isolated LSPD client per entry and ran them in parallel. Since all isolated clients share one Chromium browser, one entry's `client.close()` tore down the page another was mid-navigation on (`Target page, context or browser has been closed`), silently killing the crosspost. Now uses a single shared client, processes entries sequentially, closes once. (This is what prevented the two test cases' topics from being created.)
  - **No pre-search** — the crosspost topic is created here, so searching the LSPD forum for it was a no-op (and could match unrelated prior-case topics); removed.
  - **Uses the shared default client + force-login** — switched from an isolated LSPD client (which kept failing to re-login to the LSPD forum with `No form found`) to `getForumClient()`, and now calls `login(FORUM_LSPD_USERNAME, FORUM_LSPD_PASSWORD, { force: true })` first. `postTopic`'s internal login fallback submits `this.username/password` (the **PHMC** creds), so if the LSPD posting page redirected to login mid-post it submitted the wrong credentials and got stuck. Pre-forcing an LSPD login with the correct creds avoids that (same pattern the monitor's step 3 uses).
- **Self-healing webhook** — every recovery action now posts `SELF HEALING - <topic> / <reason> / <info>` to the log channel (e.g. `SELF HEALING - 9892 / lspd crosspost missing / LSPD topic #12345 + ack posted`), via `sendLogMessage` (timeout-protected). So you see when the bot repairs a stuck step.
- **Recovery cadence tightened** — staleness guard and sweep interval lowered from 30 min to 10 min, so a stuck ack/crosspost recovers within ~10 minutes.

## 2026-07-31 — Quiet queue-snapshot logging

### Changed
- **`deployQueue.js` `getQueuedDeployments`** — no longer logs on every call. The queue dashboard polls it every 30s, so it was emitting ~2,900 `[FUNC deployQueue/getQueuedDeployments]` lines/day for a pure in-memory read. It now logs only when the queue is non-empty (`Queue snapshot (N queued/processing)`), keeping the signal when there's real work while staying silent when idle. `isMaintenanceMode`/`getStuckReports` verified off hot loops — left as-is.

## 2026-07-31 — Ack visibility + self-healing PHMC acknowledgement retry

### Changed
- **Ack status fields renamed for visibility** — `autopsyRequestMonitor.js` now writes `phmc-acknowledge-reply` / `lssd-acknowledge-reply` / `lspd-acknowledge-reply` (was `phmcAck`/`lssdAck`/`lspdAck`) plus a `<field>-at` timestamp on every ack attempt. Consolidated ack status log line + a `[AUTOPSY-MON] Ack FAILED ... flagged for automatic retry` warning when any ack target fails. Field names are exported from `ACK_FIELD_NAMES` so writers/retries can't drift.
- **`autoDeploy.js` LSPD ack retry** now queries/writes the renamed `lspd-acknowledge-reply` field.

### Added
- **`retryFailedPhmcAcknowledgements` (`autoDeploy.js`)** — the PHMC ack now has self-healing recovery like the LSPD ack: runs at startup and every 30 minutes. Scans ALL `autopsy-requested` entries (not just `status='failed'`) so it also catches the crash-before-status-write case (no status field at all — exactly what happened to Case 474), with a 30-minute staleness guard so it never races the active detection flow. On success it writes `phmc-acknowledge-reply=completed` + timestamp.

### Fixed
- **Incident: Case 474 (John Doe / Edwin Fimbres, LSSD)** — ack reply to the request topic was never sent because the detection flow died after the assignment reply hit phpBB flood control. The assignment reply was recovered by the monitor's startup rebuild on restart; the ack is backfilled manually (`scripts/backfill-ack.js`).

## 2026-07-31 — phpBB flood-aware reply retry

### Fixed
- **`forumClient.js` `replyToTopic`** — A reply could silently fail when phpBB rejected a rapid consecutive post with *"You cannot make another post so soon after your last"* (flood control), and the stale-form re-click then bounced with *"The submitted form was invalid"* (expired token). The bot logged `Reply ⚠️ Unknown` and dumped debug HTML with no recovery. `replyToTopic` now detects both errors after submit, logs `FLOOD ENCOUNTERED, WAITING 25s before retry`, waits out the flood window, **reloads the reply form** (fresh token), refills the message, and resubmits (up to 3 attempts). Stale-token bounces reload immediately without the wait. Falls back to the existing HTML-dump + `Unknown` path only if it's still stuck after retries.
- **Incident:** Case 474 (John Doe / Edwin Fimbres, LSSD) — the ME assignment reply to the case topic hit the flood limit because the same forum account posts the case topic + assignment reply back-to-back in one detection cycle. The assignment reply was recovered automatically by the monitor's startup rebuild on the next bot restart.

## 2026-07-31 — Morgue overdue threshold 24h -> 48h

### Changed
- **Morgue overdue alert** — `systemMonitor.js` now only flags the morgue as overdue after **48 hours** (was 24h); embed text and `MORGUE_OVERDUE_HOURS` constant updated. Dashboard's red "overdue" tier in `dashboardManager.js` bumped to 48h to stay consistent.

### Fixed
- **Death record draft crash** — Bot was crashing with `Invalid string length` from `ButtonBuilder.setCustomId` on long (mass fatality) report keys exceeding Discord's 100-char custom-ID limit. Deployed the split `deathRecordDraft*` modules where draft buttons already use `shortId()` hashes. Also hardened the two edit modals (BBCode + Fields): their custom IDs now use `shortId()` too (with a `_ids` index write on open + resolve on submit), and fixed `updateDraftWithMorgue` so the "Check Morgue" button is actually removed once morgue data is matched.
- **Draft buttons "Draft info not found"** — Drafts created by the manual `/death-record-check` scan or the passive path weren't writing the `_ids` shortId→reportKey index, so their buttons couldn't resolve back to the report key. All draft-creation/update paths now write the index, and the button handler falls back to scanning `deathRecordDrafts` by hash when `_ids` misses, so existing/legacy drafts work immediately without a backfill.
- **Passive CK detection for unidentified decedents** — The passive monitor only matched morgue records by IC name, so `John Doe` (unidentified CK) never matched `Unknown (( Stacey Hoover ))` and the draft was skipped until a forced date scan. `checkAndDraftIfMorgueMatched` now falls back to matching the report's OOC name, so these CKs auto-draft without manual intervention.

## 2026-07-30 — DM login fix, death record field editing, pending commands

### Fixed
- **`deployAutopsyReply.js`** — DM isolated client now calls `login()` before `sendPM()`. Was failing with "Page: Login" because the fresh isolated context had no phpBB session cookies. LSSD crosspost already handled this correctly; DM step was the only one missing it.
- **`deathRecordDraft.js`** — Button custom IDs now use `shortId()` hash to avoid Discord's 100-char limit crash on long report keys (e.g. mass fatality drafts). Added `_ids` Firebase index + resolver for round-trip.
- **`index.js`** — Added modal dispatch for `dr_editfld_modal_` prefix (field editing submission).

### Added
- **`commands/pending-reports.js`** — New `/pending-reports` command: scans all `scheduledReports` for non-deployed entries, grouped by status (pending/searching/replying/error/timeout). Shows age and deploy message. Requires owner-only confirmation button before executing.
- **`commands/purge-death-drafts.js`** — New `/purge-death-drafts` command: deletes ALL death record drafts from Firebase + Discord messages. Requires `DELETE ALL` confirmation string.
- **`deathRecordDraft.js`** — Field-based editing via "Edit Fields" button: individual modals for Cause of Death, Place of Death, Decedent Name, OOC. Re-generates BBCode from template on save. Split from single "Edit" button into "Edit Fields" + "Edit BBCode" (full raw editor, shows error if >4000 chars).
- **`death-record-check.js`** — New `from:` date option: `from:20/JUL/2026` scans from that date through today instead of exact match.
- **`deathRecordDraft.js`** — Duplicate draft detection: `scanAndDraftCKs` now tracks seen morgue case IDs to prevent double-drafting when the same report exists in both `scheduledReports` and `newSavedReports`.

## 2026-07-26 — Bug fixes: rotation corruption, LSPD crosspost fallback, CPU monitoring, reassign reply

### Fixed
- **`autopsyRotation.js`** — Fixed `splice` bug (`1` → `0` delete count) that was replacing existing MEs instead of inserting new ones, causing duplicate entries and corrupted rotation lists. Added name trimming to prevent whitespace-based false mismatches. Added auto-corruption detection: if duplicates are found, the list is reset to a fresh random order from the forum group.
- **`autopsyRequestMonitor.js`** — `getGroupMembers(50)` calls now use `paginate: true` so all MEs are fetched, not just the first 25. Previously MEs past page 1 got `user_id=0` in quote tags. Also saves `requestBbCode` to Firebase during detection so the original request content survives restarts.
- **`deployAutopsyReply.js`** — LSPD crosspost step now detects LSPD cases even when `lspdTopicId` wasn't saved during detection (state machine race). Falls back to creating the LSPD topic at completion time instead of silently skipping.
- **`reassign-autopsy.js`** — Embed now shows "Samuel Cerniglia — reassigned from Alyson Frost to James Salter" instead of backwards wording. Posts a reassignment notice reply in the case topic so the post body reflects the change.
- **`systemMonitor.js`** — Added CPU/RAM/disk resource checks (80%/85%/90% thresholds) with Discord alerts. High-severity alerts now actually send to Discord (were only logged to console).
- **`cctvScheduler.js`** — First CCTV fetch now waits 5 minutes after startup so it doesn't overlap with health check Playwright sessions, preventing 4+ concurrent browser instances.

## 2026-07-22 — Security: morgue API hardening, roster sync, firebase-admin v14

### Added
- **`morgue-api.js`** — Suspicious pattern detection (RCE, path traversal, SQLi, SSTI, prototype pollution). Write method restriction (`MORGUE_WRITE_API_KEYS`). Comprehensive IP/User-Agent request logging. `?key=` query param removed
- **`factionRosterSync.js`** — Cooldown 24h → 4h. Bot-spam notification on sync. Exported `getRosterSyncStatus()` for dashboard
- **`dashboardManager.js`** — Roster sync status in Scheduled Tasks section
- **`autopsyRotation.js`** — `syncRotationFromGroup()` for dynamic new ME detection

### Changed
- **firebase-admin v14 migration** — All services/commands updated to modular imports (`getAuth`, `getDatabase`, `getApps`, `cert`). Dynamic imports in force/fix commands
- **`factionRosterSync.js`** — Auto-detect mode (department optional, `.filter()` instead of `.find()`)

## 2026-07-24 — CCTV Scheduler: bot-managed 6-hour fetch cycle

### Added
- **`services/cctvScheduler.js`** — New service that runs `fetch-all.js --headless` every 6 hours. Spawns the script as a child process, captures stdout, parses the summary (new entries, cameras fetched, elapsed time), and posts results to the bot-spam channel. Only shows cameras with new entries in the Discord message (max 5) to avoid spam. Handles timeouts (2.5 min), startup fetch immediately on bot start, and error logging.
- **`index.js`** — Registers the CCTV scheduler on bot ready alongside other services.

### Removed
- **Cron job** — Removed from crontab (replaced by bot-managed `setInterval`). The bot handles scheduling natively now, with proper Discord logging.

---

## 2026-07-19 — Fix: Medical Records duplicate detection refined

### Fixed
- **`deployMedicalRecord.js`** — Duplicate detection now uses **patient name** as the primary dedup key (not just numeric patientID), so it catches rapid re-saves even when the form has no patient ID filled. Also added a **broad safety net**: same author + same formId within 60s is treated as a duplicate. This catches rapid double-saves like the ER Protocol case where the second save had a blank title and no patient name/ID.

---

## 2026-07-19 — Fix: Medical Records creating duplicate posts on new patient topic

### Fixed
- **`deployMedicalRecord.js`** — When no existing patient thread was found, the handler was creating a new topic and then falling through to also post a reply with the same content, producing a duplicate. Now when a new topic is created, the handler returns early with `markReportComplete` — the topic content IS the post, no reply needed. Progress embed now shows "Topic Created" instead of "Posting Reply" for this path.

---

## 2026-07-18 — Added: LSPD crosspost completion step + PM debug dump

### Added
- **`deployAutopsyReply.js`** — Added LSPD crosspost as a proper completion step in the progress embed, mirroring the LSSD pattern. When an LSPD case completes (`entry.lspdTopicId` exists), a new "LSPD Crosspost" step appears in the embed that replies to the certified copy topic on LSPD f=1361 with the completed report. Retry logic also added for the `lspdCrosspost` step name.
- **`forumClient.js` — `sendPM()`** — When the message textarea is not found, now saves the **full page HTML** to `debug-pm-page.html` (was only logging a 3000-char snippet). The error message also includes page title + URL for faster triage.

### Fixed
- The LSPD crosspost function (`crosspostAutopsyToLspd` in `deployLspd.js`) was imported but never called in the completion flow — the autopsy progress embed showed no indication that LSPD posting was happening. It now runs as a tracked step.

---

## 2026-07-18 — Fix: PM failure now saves full HTML dump for debugging

### Changed
- **`forumClient.js` — `sendPM()`** — When the message textarea/editor is not found on the PM compose page, the bot now saves the **full page HTML** to `debug-pm-page.html` (in the bot root directory) before throwing. Previously it only logged a 3000-char snippet to console, making it impossible to diagnose what the page actually rendered (login redirect, Cloudflare challenge, different layout, etc.). The error message now also includes the page title and URL for faster triage.

---

## 2026-07-17 — Fix: consent race condition — users opting out after save

### Fixed
- **`FormHandler.jsx` (web app)** — Added consent gate in `copyAndSaveReport()`. When a user clicks "Save and Queue" on a deploy-tracked form and has never set auto-deploy preferences, the consent modal opens first. The user must complete their preferences before the report is saved. This prevents the race where a report gets queued before the user has a chance to opt out.
- **`deployExecutor.js` (bot)** — Added consent re-check at deploy-time. Even after a report is queued, the bot now re-reads Firebase consent data right before executing. If the user revoked consent during the 2.5-minute defer window (or via retry), the deploy is skipped and marked as `skipped_no_consent`.

Web app also needs rebuild + deploy:
```
npm run build && node tools/deploy.js
```

---

## 2026-07-17 — Morgue API expansion: bulk name lookup + group scraper

### Added
- **`morgue-api.js` — `POST /api/morgue/lookup-by-names`** — New endpoint that accepts `{ names: [...], exact: bool }` and returns matching morgue records per query name. Supports substring (default) or exact case-insensitive matching. Auth + rate limited like all other endpoints.
- **`commands/group-morgue-check.js`** — New `/group-morgue-check` Discord command. Scrapes a faction group roster (LSPD/LSSD/SADCR/DAO/PHMC) across all pages, then checks each member name against local morgue records. Returns an embed with deceased/alive counts and a JSON file attachment with full results. Optional `save_file` flag to persist to VPS disk.
- **`index.js`** — Registered the new `/group-morgue-check` command.

### Changed
- **`forumClient.js` — `getGroupMembers()`** — Added `paginate: false` option. When true, loops through `start=0, 25, 50, ...` URL parameter to scrape all pages of a phpBB member list. Detects last page when fewer than 25 members returned. Default `false` for backward compatibility with existing callers (ME group 50).

Then restart both processes:
```
ssh root@88.208.243.254 "cd /opt/phmc-bot/discord-bot && pm2 restart phmc-bot"
ssh root@88.208.243.254 "cd /opt/phmc-bot/discord-bot && pm2 restart morgue-api"
```

---

## 2026-07-17 — Dashboard: removed payment references + added Restart Bot button

### Changed
- **`dashboardManager.js`** — Removed the `* 2000` revenue calculation that multiplied LSPD/LSSD autopsy request counts by $2,000. The dashboard embed now shows plain request counts only (e.g. `LSPD: 5 requests | LSSD: 3 requests`) instead of fabricated revenue figures.
- **`dashboardManager.js`** — Added a 🔁 **Restart Bot** button (Danger style) alongside the existing Refresh Now button. When clicked, it posts an ephemeral confirmation then calls `process.exit(0)` — PM2 auto-restarts the process within seconds.
- **`index.js`** — Wired up the `dashboard_restart` button interaction to the new `handleDashboardRestart` handler.

---

## 2026-07-16 — Forum client refactor: isolated per-faction contexts + longer waits

### Changed
- **`forumClient.js`** — Refactored to support isolated browser contexts. The Chromium browser process is now a module-level singleton shared by all `ForumClient` instances, but each instance gets its own browser context (separate cookies, localStorage, Cloudflare state) and session file. This prevents LSSD login from invalidating PHMC session state and vice versa.
- **`forumClient.js` — `ensureBrowser()`** — No longer launches a browser per instance. Calls `getSharedBrowser()` which creates the browser once module-wide, returns it for all subsequent calls.
- **`forumClient.js` — `saveSession()` / `hasSession()`** — Use instance-specific `this.sessionFile` instead of the old global `SESSION_FILE`.
- **`forumClient.js` — `close()`** — New method. Closes the instance's browser context + page without shutting down the shared browser. Cleanup for temporary isolated clients.
- **`forumClient.js` — `constructor({ sessionFile, isIsolated, sessionDir })`** — New options for per-instance session isolation.

### Added
- **`forumClient.js` — `createIsolatedClient(name)`** — New export. Creates a `ForumClient` with its own context, page, and session file (`forum-session-{name}.json`). Used for cross-forum operations so LSSD/LSPD/DM steps don't share session state with the main PHMC client.
- **`forumClient.js` — `getSharedBrowser()`** — Internal: launches one Chromium process for all instances. Subsequent calls return the existing browser.
- **`deployAutopsyReply.js` — LSSD operations now use `createIsolatedClient('lssd-complete')`** — Both LSSD posts (confirmation + report) share one dedicated client with a fresh LSSD login. No longer calls `client.login(FORUM_LSSD_...)` on the shared PHMC client.
- **`deployAutopsyReply.js` — DM step now uses `createIsolatedClient('dm')`** — Has its own PHMC session for `sendPM`, independent of the main client.
- **`forumClient.js` — Reply `waitForLoadState('networkidle', { timeout: 25000 })` after submit** — Gives Cloudflare challenges and slow forum responses time to resolve before entering preview-recovery logic. Added 10-second wait in Strategy 3 before giving up on success text.
- **`forumClient.js` — Debug HTML dumps now save full page via `this.page.content()`** — Was truncating at 5000 chars (`innerHTML.slice(0, 5000)`), making debug files useless (the last dump was only the navbar). Now saves complete HTML.

### Fixed
- **`forumClient.js` — `this.sessionDir` was undefined** — Line 1101 referenced `this.sessionDir` which was never set in the constructor. Debug HTML was written to `process.cwd()` instead of a consistent path. Now uses `this._sessionDir` set in constructor (defaults to `__dirname`).

---

## 2026-07-16 — Fix: Medical Record search not finding existing patient topics

### Fixed
- **`forumClient.js` — `searchForPatientTopic()`** — Search URL used `sf=firstpost` which restricted phpBB search to only the first post body of each topic. When the first post content wasn't indexed for the patient name, the search returned "No suitable matches" even though the topic existed. Changed to `sf=all` so the search covers all post content. For Mauro Garcia, the existing topic "1911 - Mauro Garcia" was not found, causing the bot to auto-assign a new patient ID (22) and create a duplicate topic.

## 2026-07-15 — Fix: startup flood — cold-load guard on scheduledReports listener

### Fixed
- **`autoDeploy.js`** — The Firebase `on('value')` listener fires immediately on startup with ALL existing `scheduledReports` data. Previously, every report where `hasdeployed` wasn't `true` got queued for deploy, causing a flood of stale entries (duplicate medical records, re-processed coroner emails, etc.). Now the first callback is a cold-load phase that primes only already-deployed reports (`hasdeployed === true`) into `knownReportKeys`. Pending reports (including those with `deployStatus === "queued"` from a prior session) fall through to normal processing so they get queued and deployed, not silently dropped.
- **`autoDeploy.js` — dev-reports listener** — Same cold-load guard applied to the dev-reports listener for consistency.

## 2026-07-15 — Fix: replyToTopic login detection

### Fixed
- **`forumClient.js` — `replyToTopic()`** — Navigation `ERR_ABORTED` when phpBB redirects (e.g. login page, error page) would throw before the login handling code ran. Now wraps `page.goto` in try/catch — if navigation aborts, it waits for the page to settle and checks where it landed (handles login redirects, error pages, etc.). Affects LSSD (f=2263) and LSPD cross-post replies.
- **`deployAutopsyReply.js` — completion flow** — `anyFailed` only checked for promise rejections, but every step handler catches its own errors, so failures were silently swallowed and the embed always showed "Complete." Now tracks actual step success/failure via a `stepFailed` object. Failed steps show a `⚠️ Retry Scheduled` row with the failing step names and the embed finalizes as "Failed" instead of "Complete."
- **`deployLogger.js` — `DeployProgressEmbed._build()`** — Added `⚠️` icon mapping for `'warn'` status (used by the retry notification step).
- **`deployAutopsyReply.js` — LSSD steps added with clear logging** — Re-added both LSSD posts as separate completion steps. Step 2: `LSSD Confirmation Reply` posts the COMPLETION_TEMPLATE ("We have completed..."). Step 3: `LSSD Autopsy Report` posts the full autopsy report (`bbCode`). Console logs clearly distinguish them (`LSSD confirmation reply` vs `LSSD autopsy report`). Old fire-and-forget `crosspostAutopsyToLssd` call removed since it's now a proper step. Retry handler updated for both step names.
- **`deployMedicalRecord.js` — Patient ID regex fix** — The regex `/^d+$/` matched literal `"d"` characters instead of digits `\d`, causing auto-assignment to fire for every report regardless of whether the user filled in a patient ID. Changed to `/^\d+$/` so valid numeric IDs are recognized and preserved.
- **`deployMedicalRecord.js` — Existing patient ID extraction** — When patientID is left blank and auto-assignment fires, but the patient already has an existing thread, the bot now parses the real patient ID from the found topic's title (e.g. "2034 - John Doe") and uses that instead of a newly incremented value.
- **`deployMedicalRecord.js` — Debug logging** — Added `[MEDICAL-RECORD-DEBUG]` logs at each decision point: raw field values, auto-assignment trigger, BBCode placeholder presence, replacement success, and existing-topic ID extraction.
- **`deployMedicalRecord.js` — Restructured ID flow** — Moved `getNextPatientId()` (f=97 scan) AFTER the search. Previously it scanned every topic to find the highest ID before even knowing if a topic existed, wasting an expensive forum scan. Now: search first → if topic found, extract ID from title → only if no topic found, auto-assign a new ID.

## 2026-07-15 — Fix: maintenance mode not blocking coroner emails

### Fixed
- **`deployCoronerEmail.js`** — Now checks maintenance mode at the top of `handleCoronerEmail()` regardless of which code path calls it. Previously, any direct call (from `handleTopic`, dev-reports listener, etc.) bypassed the queue's maintenance check and would deploy during maintenance mode.

## 2026-07-15 — Fix: reassign-autopsy topic lookup

### Fixed
- **`reassign-autopsy.js`** — Now uses stored `caseTopicId` from Firebase instead of relying on forum title text search. If the case thread title was edited (e.g. OOC name removed), reassignment still works because it reads the topic ID directly from the `autopsy-requested` entry. Falls back to forum search only if `caseTopicId` is missing.

## 2026-07-14 — Refactor: Split autoDeploy.js into focused handler modules

### Changed
- **`autoDeploy.js`** reduced from ~1420 to ~300 lines. Now acts as a pure facade: imports, re-exports, `setAutoDeployClient()`, `startAutoDeploy()` listener wiring. All handler code extracted.

### Added
- **`deployPM.js`** (new) — `handlePM()` extracted from autoDeploy.js. Forum PM dispatch (LSPD/LSSD/SADCR/DAO routing).
- **`deployTopic.js`** (new) — `handleTopic()` extracted. Forum topic posting with dry-run support.
- **`deployMedicalRecord.js`** (new) — `handleMedicalRecord()`, `getNextPatientId()`, `pruneRecentPatientRecords()`. Patient notes and medical record replies.
- **`deployAutopsyReply.js`** (new) — `handleAutopsyReply()`, completion flow (`startCompletionStep`, `finishCompletionStep`), `retryFailedCompletionSteps()`, `COMPLETION_TEMPLATE`. All autopsy/case-management logic.

### Updated
- **`deployExecutor.js`** — Lazy imports now load from dedicated handler modules instead of autoDeploy.js, breaking the circular dependency chain.
- **`deployTest.js`** — Imports `handleAutopsyReply` from `deployAutopsyReply.js`.

No behavioral changes — pure refactor.

## 2026-07-13 — Auto-generated Coroner Emails (dry-run only)

### Added

- **`deployCoronerEmail.js`** (new) — Dedicated handler for auto-generated Coroner Emails. When a Coroner Report is saved with `ReportRequested=true` (or Mass Fatality with `requestingOfficer` filled), the bot automatically fills the `Coroner-Email.json` template, wraps attached report BBCodes as `{{deathReport}}`, and queues a PM to the requesting officer on their department's forum (LSPD/LSSD/SADCR).

- **Safety — `CORONER_EMAIL_DRY_RUN=true`** — Default `true` on production. In dry-run mode, the handler fully renders the BBCode, logs it to console and `debug-coroner-email-bbcode.txt`, and sets Firebase `deployStatus: 'dry_run'`. No forum login, no PM send.

- **Dual safety — `CORONER_EMAIL_ALLOWED`** — Even with `DRY_RUN=false`, live sends are blocked unless the target forum URL is in the `CORONER_EMAIL_ALLOWED` comma-separated whitelist.

- **`autoDeploy.js`** — Listener now checks `ReportRequested` field on coroner-report and mass-ftality-test saves. If true, fires `handleCoronerEmail()` alongside the normal topic post.

- **`.env.example`** — Added `CORONER_EMAIL_DRY_RUN` and `CORONER_EMAIL_ALLOWED` config vars.

## 2026-07-11 — Notification consolidation: unified progress embed for all deploy types

### Added

- **Autopsy startup status embed** — On bot restart, sends a single embed showing:
  - All currently assigned autopsies (name, OOC, assigned ME, age in hours)
  - Staff on LOA (in training / on break)
  - Next ME in rotation
  - Yellow if cases pending, green if all clear

- **Consolidated completion embed** — The three individual completion webhooks (PHMC reply, LSSD reply, DM sent) are now replaced by a single `DeployProgressEmbed` that posts once and edits itself as each step completes. Channel sees one clean message per entry instead of 3+ spam messages.

### Changed

- **`autoDeploy.js`** — Split `trackCompletionStep()` into two-phase tracking:
  - `startCompletionStep()` writes `{status: "attempting"}` to Firebase BEFORE the operation
  - `finishCompletionStep()` updates to `{status: "completed"}` or `{status: "failed"}` AFTER
  - Three completion steps (phmcCompletionReply, lssdCompletionReply, dmSent) now use this pattern

- **`autoDeploy.js` — `finishCompletionStep()`** — Removed individual `sendWebhook()` call. Live Discord updates now go through the consolidated progress embed instead.

- **`autoDeploy.js` — Completion loop** — Changed from `arSnap.forEach` (fire-and-forget IIFEs) to async `for...of` with `Promise.allSettled`. Each entry gets one `DeployProgressEmbed` that posts once and edits as steps complete: `⏳ PHMC Reply → ✅ PHMC Reply #12345`, `⏳ LSSD Reply → ⏭️ No LSSD`, `⏳ DM Requester → ✅ DM sent`. Finalized as green "Complete" or red "Failed" when all steps settle.

- **`autoDeploy.js` — `retryFailedCompletionSteps()`** — Now actually **retries** failed steps instead of just warning:
  - `"failed"` → genuine failure → auto-retries by re-posting the completion reply / re-sending the DM
  - `"attempting"` → crash mid-op → skipped to prevent duplicate forum posts
  - `"completed"` → already done → skipped
  - Creates a forum client at startup, logs into PHMC (and LSSD if needed), performs retries
  - Updates Firebase status to `completed` on success, keeps `failed` if retry fails
  - Sends a summary webhook: green "All Resolved" or yellow "X Still Failed" with case details
  - Logs include decedent name (`"Marcus Johnson" (#firebaseKey)`) and step name for clear PM2 debugging
  - DM retries use stored `completedBbCode` from the Firebase entry

### Removed (redundant standalone webhooks — now covered by progress embed)

- **`deployQueue.js`** — Removed "⏳ Report Queued" standalone webhook. Queue status shown by the `DeployProgressEmbed` posted at queue time.
- **`deployExecutor.js`** — Removed "🚀 Deploying Report" standalone webhook. The progress embed is resumed from the queue embed and shows deploy progress.
- **`deployStatus.js`** — Removed "✅ Report Complete" standalone webhook. The progress embed finalizes with green/red status.
- **`autoDeploy.js`** — Removed duplicate "Bot Online" startup webhook (was already sent from `index.js`). Merged `Auto-deploy listener active.` into the index.js startup message.

### Changed

- **`autoDeploy.js` — `handlePM()`** — Added `DeployProgressEmbed` with steps: Logging in, Sending PM. Finalizes on success/failure. Picks up queue embed if available.
- **`autoDeploy.js` — `handleTopic()`** — Added `DeployProgressEmbed` with steps: Login, Posting Topic. Finalizes on success/failure. Picks up queue embed if available.
- **`autoDeploy.js` — `handleMedicalRecord()`** — Added `DeployProgressEmbed` with steps: Login, Searching, Posting Reply. Handles duplicates, dry-runs, and failures. Picks up queue embed if available.
- **`index.js`** — Merged auto-deploy status into the single "Bot Online" startup message.

### Files to upload

```
pscp discord-bot/services/autoDeploy.js root@88.208.243.254:/opt/phmc-bot/discord-bot/services/autoDeploy.js
pscp discord-bot/services/deployQueue.js root@88.208.243.254:/opt/phmc-bot/discord-bot/services/deployQueue.js
pscp discord-bot/services/deployExecutor.js root@88.208.243.254:/opt/phmc-bot/discord-bot/services/deployExecutor.js
pscp discord-bot/services/deployStatus.js root@88.208.243.254:/opt/phmc-bot/discord-bot/services/deployStatus.js
pscp discord-bot/index.js root@88.208.243.254:/opt/phmc-bot/discord-bot/index.js
```

---
