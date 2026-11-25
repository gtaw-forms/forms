/**
 * autopsyDevTesting.js — "Autopsy Dev Testing" mode: simulate the autopsy
 * pipeline end to end without touching the outside world.
 *
 * When enabled (owner-only `/autopsy-dev-testing`, persisted to .env):
 * - f=265 intake (singular, legacy-multi and mass) parses + validates, computes
 *   the ME pick WITHOUT writing it, posts a Discord "would do" summary, and
 *   marks the entry dry_run so rescans skip it. No forum posts/replies, no ME
 *   Discord DMs, no crossposts, no progress embeds.
 * - Completion (deployAutopsyReply.handleAutopsyReply) takes its existing DRY
 *   path via the dynamic flag below: no f=266 reply, no crossposts/PMs, no
 *   completion marking — deployStatus goes to dry_run instead.
 * - Private intake keeps its own PRIVATE_WEB_MODE; completions already posted
 *   are never touched; retries of failed steps only run live.
 *
 * Reads process.env at call time (never cached) so the toggle takes effect
 * without a restart. Additive only: with the mode off, every call site
 * behaves exactly as before.
 */

export function isAutopsyDevTesting() {
    return String(process.env.AUTOPSY_DEV_TESTING || '').toLowerCase() === 'true';
}

/**
 * Effective dry-run for intake + completion paths. Preserves the legacy
 * AUTOPSY_DRY_RUN semantics (anything but an explicit 'false' counts as dry)
 * and ORs in the runtime dev-testing toggle.
 */
export function effectiveAutopsyDryRun() {
    return isAutopsyDevTesting() || process.env.AUTOPSY_DRY_RUN !== 'false';
}

/** Notice prefix: [DEV-TEST SIMULATION] for the new mode, [DRY RUN] legacy. */
export function simNoticeTag() {
    return isAutopsyDevTesting() ? '[DEV-TEST SIMULATION]' : '[DRY RUN]';
}
