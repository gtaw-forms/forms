# Feedback Bot — owner-only OpenCode sessions via Discord

`/feedback` pops an ask modal; submitting it opens a DM with the bot. That DM is **one OpenCode session** working
on the PHMC Forms repo (bug reports + feature requests). One active session at
a time; everything renders into **one message + one embed**, edited in place.

The bot waits for your first message before doing anything: `/feedback`
pops an ask modal (one paragraph field) — submitting it opens your DM inbox,
creates the session with your text already in hand, and starts Phase 1
immediately. No prompt text here, no extra DM step.

The owner answers by pressing **Answer questions** (a modal, one field per
question) or by replying in the DM — both forward into the live OpenCode
session, which sees the full history and revises the plan. A DM sent while
the agent is mid-run is held and auto-forwarded when the step finishes
instead of failing the session. A wrongly-failed session gets a **Retry
review** button that restarts the review from the stored request.

The status message shows a rolling "Latest" tail of the agent's actual words
while it investigates (hidden once the structured plan/questions render, to
avoid echoing them twice), plus Investigated/Progress lines. The full prose
also lands in the session log, so View Full Log reads like a transcript.

Completed runs also post their prose to the DM thread itself as plain-text
messages (chunked, de-duplicated), plus one-line milestone notes (approved,
testing, deployed, failed, paused, resumed, permission asked/resolved,
no-action, complete) — the embed is the state dashboard, the thread is the
readable record.

If a newer `/feedback` replaces a session that never got going, the old DM
message is re-rendered as a grey "Session closed" marker (with your last
message echoed back) and the outcome lands in history — never silently
destroyed. Sessions with real work keep the one-slot guard.

`/feedback-list` shows the live session with its stage/step detail (state,
phase, steps done, plan items, questions, deploy tag) plus the last 20
terminal sessions: `deployed` / `closed` / `failed` / `superseded`, each with
summary, tag, and relative time.

## How it works (two phases)

1. **Review (read-only):** the Plan agent restates the request, investigates,
   lists changes, and asks questions. No file edits or state-changing commands.
   A pure question gets a direct answer instead of a forced plan ("Answered"
   status, prose in Latest). The owner answers in the DM or via **Answer
   questions** (a modal, one field per question); the revision clears answered
   questions. The owner presses **Approve & Execute** to run the plan — or **No
   Action Needed** to close immediately with no changes: history records it,
   the slot frees at once, and the message stays as a button-less tombstone.
2. **Execute:** the Build agent runs the approved plan. On completion the bot
   runs tests, tags `pre-feedback-<timestamp>`, commits, and pushes to the
   deploy branch (`FEEDBACK_DEPLOY_BRANCH`, `source` — the repo has no `main`). **Revert** resets main to the tag and
   pushes (after a second Confirm press). **Complete Session** archives the
   session and frees the single-session slot.

Pause/Resume via buttons (or just keep typing — the next DM continues).
Shell commands are pre-approved but scope-limited: anything outside the
request (unrelated files, other repos, system-level changes, global installs)
surfaces an **Allow/Deny** request instead of proceeding.

## Required first step (every session)

Before any repo action, the agent must read the global `agent/CLAUDE.md` and
follow it. The initial prompt mandates this; the controller watches the event
stream and aborts (FAILED, visible in the embed) if an edit/shell event arrives
before the CLAUDE.md read.

## Setup

```bash
cd discord-bot
npm install            # adds @opencode-ai/sdk
cp .env.example .env   # fill in BOT_OWNER_ID + FEEDBACK_* below
```

`.env` additions (see `.env.example`):

| Var | Purpose | Default |
|---|---|---|
| `OPENCODE_URL` | OpenCode server base URL | `http://127.0.0.1:4096` |
| `FEEDBACK_REPO_DIR` | Full repo checkout the agent edits | `/opt/phmc-feedback/phmc-forms` |
| `FEEDBACK_DEPLOY_BRANCH` | Branch the agent tags, commits + pushes | `source` (repo has no `main`) |
| `FEEDBACK_MODEL_PROVIDER` / `FEEDBACK_MODEL` | Pinned model (verify with `opencode models`) | `opencode-go` / `muse-spark-1.3-contributor` |
| `FEEDBACK_PLAN_AGENT` / `FEEDBACK_BUILD_AGENT` | Agent names (verify via SDK `app.agents`) | `plan` / `build` |
| `FEEDBACK_DRY_RUN` | `true` = simulate streams, no model | `false` |

Verify before first use (on the VPS, where `opencode serve` runs):

```bash
node tools/feedback-verify.mjs         # static SDK surface
node tools/feedback-verify.mjs --live  # agents + model against the server
node tools/feedback-render-test.mjs    # render.js isolation tests
node tools/feedback-dryrun.mjs         # simulated streams, no model
```

## `opencode serve` (systemd)

`discord-bot/opencode-serve.service` runs `opencode serve` bound to
`127.0.0.1:4096` (loopback only). Install it on the VPS — it lives outside
the bot mirror, so copy it by hand:

```bash
sudo cp discord-bot/opencode-serve.service /etc/systemd/system/opencode-serve.service
sudo systemctl daemon-reload
sudo systemctl enable --now opencode-serve
```

`WorkingDirectory` must be a **full clone** of the PHMC Forms repo (agent edits
+ `git tag/commit/push` happen there), e.g. `/opt/phmc-feedback/phmc-forms` —
not `/opt/phmc-bot/discord-bot` (bot mirror, no web-app history).

## Discord wiring

- **Privileged intents:** `DirectMessages` + `MessageContent` (plus the
  `Channel` partial) — the owner answers plan questions by DM, which requires
  reading message content. Enable **Message Content Intent** in the Discord
  Developer Portal for this bot.
- **Slash command:** `/feedback` (owner only) — registered alongside the rest
  in `index.js` `registerCommands()` + `start()`; guild propagation as usual.
- **Buttons:** `fb:<action>:<sessionId>` (`approve|pause|resume|log|revert|`
  `revert-confirm|revert-cancel|complete|allow|deny`). Owner-checked on every
  button/interaction; everyone else gets an ephemeral rejection.
- **Restore on restart:** `{channelId, opencodeSessionId, state, messageIds,
  preDeployTag}` persists to `data/bot-state/feedback.json` (survives
  `bot:deploy`, which excludes `data/`). On `clientReady` the bot reattaches to
  the live OpenCode session and re-subscribes to events.

## State machine

`IDLE → REVIEWING → AWAITING_ANSWERS → READY → WORKING → TESTING → DEPLOYING → DONE → COMPLETED`,
with `PAUSED` reachable from `REVIEWING/WORKING(+TESTING/DEPLOYING)` and
`FAILED` from `WORKING/TESTING/DEPLOYING`. Rendered from state, never ad hoc —
see `services/feedback/render.js` (the single `{state,data} → {embed,components}`
renderer) and `services/feedback/store.js` (transitions + persistence).

## Files

- `services/feedback/constants.js` — colors, markers, limits, states, IDs
- `services/feedback/store.js` — single-session persistence + guard
- `services/feedback/render.js` — pure renderer (isolation-tested)
- `services/feedback/opencode.js` — SDK client, setup verification, prompts
- `services/feedback/controller.js` — turns, throttle, gate, tests/deploy
- `services/feedback/log.js` — redacted per-session log + `.txt` attachment
- `services/feedback/dryrun.js` — simulated streams (no model)
- `services/feedback/samples.js` — sample outputs per state
- `commands/feedback.js` — `/feedback`
