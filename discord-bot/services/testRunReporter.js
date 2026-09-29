/**
 * testRunReporter.js — Watches the RTDB `testRun/active` node written by the
 * local test runner (tools/run-tests.mjs) and drives a SINGLE DeployProgressEmbed
 * in the bot-spam log channel: posts "Test suite started" on a new run, then
 * edits that one embed to PASS/FAIL with failing-test names and, for golden
 * BBCode failures, a truncated bbcode + input-fields repro.
 *
 * A NEW runId (vs the last one this process saw) starts a new run; a stale node
 * is harmless because lastRunId is tracked in memory. A bot restart that never
 * saw the current run WILL post for it — acceptable per the plan.
 *
 * RTDB writes: ONLY `testRun/active/messageId` (the embed pointer). Never logs
 * secrets or webhook URLs.
 */
import { EmbedBuilder } from 'discord.js';
import { DeployProgressEmbed } from './deployLogger.js';

const TAG = 'TESTRUN';

// Last runId this process has seen, so a stale node does not re-trigger after
// it already handled that run (a restart that never saw it will post — ok).
let lastRunId = null;

// Live DeployProgressEmbed instances keyed by runId, so the finalize path can
// edit the SAME message the start path posted.
const activeProgress = new Map();

const DEPARTMENT_CODES = ['lspd', 'lssd', 'sadcr', 'dao', 'lsfd', 'unknown', 'legacy-full-name'];

/**
 * Build the failing-tests summary text for the detail embed.
 * One line per failure: "<test> — <message (150 chars)>", capped at 4000 chars.
 */
function buildFailureList(failures) {
    const lines = (failures || [])
        .filter((f) => f && f.test)
        .map((f) => `${f.test} — ${(f.message || '').slice(0, 150)}`);
    const joined = lines.join('\n');
    return joined.slice(0, 4000) || 'No failure details reported.';
}

/**
 * Append one "BBCode / inputs" field per golden (BBCode) failure, truncated to
 * 1000 chars total: code=..., inputs=<JSON slice>, bbcode=<slice>.
 */
function addBbcodeFields(embed, failures) {
    for (const f of (failures || []).slice(0, 5)) {
        if (!f || !f.bbcode) continue;
        const code = DEPARTMENT_CODES.find((c) => (f.test || '').includes(c)) || '?';
        const inputs = JSON.stringify(f.inputs ?? {});
        const bbcode = String(f.bbcode || '');
        const fieldValue = `code=${code}, inputs=${inputs.slice(0, 400)}, bbcode=${bbcode.slice(0, 400)}`.slice(0, 1000);
        embed.addFields({ name: 'BBCode / inputs', value: fieldValue || 'n/a' });
    }
}

/**
 * Start the test-run reporter. Attaches a value listener on `testRun/active`
 * and never throws out of the listener (best-effort embed posting).
 *
 * @param {object} db — Firebase Admin RTDB instance
 * @param {object} client — Discord client
 */
export async function startTestRunReporter(db, client) {
    const CHANNEL_ID = process.env.BOT_LOG_CHANNEL_ID;
    if (!CHANNEL_ID) {
        console.warn(`[${TAG}] [WARN] BOT_LOG_CHANNEL_ID not set — skipping embed posting`);
        return;
    }

    db.ref('testRun/active').on('value', async (snap) => {
        try {
            const data = snap.val();
            if (!data || !data.runId || !data.status) return;

            // ── New run: post the "started" embed ──
            if (data.status === 'running' && data.runId !== lastRunId) {
                lastRunId = data.runId;
                const progress = new DeployProgressEmbed(client, data.channelId || CHANNEL_ID);
                await progress.start('Test suite');
                await progress.addStep('Vitest started', 'pending', data.runId);
                activeProgress.set(data.runId, progress);
                if (progress.messageId) {
                    await db.ref('testRun/active/messageId').set(progress.messageId);
                }
                console.log(`[${TAG}] [OK] embed posted for run ${data.runId}`);
                return;
            }

            // ── Run finished (the one we started) — edit the SAME embed ──
            if ((data.status === 'passed' || data.status === 'failed') && data.runId === lastRunId) {
                let progress = activeProgress.get(data.runId);
                if (!progress && data.messageId) {
                    // Rehydrate after a restart mid-run from the node pointer.
                    progress = new DeployProgressEmbed(client, data.channelId || CHANNEL_ID);
                    await progress.resume(data.messageId, data.channelId || CHANNEL_ID, 'Test suite');
                }
                if (!progress || !progress.messageId) {
                    console.warn(`[${TAG}] [WARN] no live progress embed to update for ${data.runId}`);
                    return;
                }

                const passed = data.summary?.testsPassed ?? 0;
                const failed = data.summary?.testsFailed ?? 0;
                const total = passed + failed;

                if (data.status === 'passed') {
                    await progress.addStep('Vitest suite', 'ok', `${passed}/${total} passed \u00B7 ${data.summary?.testFiles ?? 0} files`);
                    await progress.finalize('complete');
                    console.log(`[${TAG}] [OK] run ${data.runId} finalized as passed`);
                } else {
                    await progress.addStep('Vitest suite', 'fail', `${failed} of ${total} failed`);

                    // Second embed: the failing tests + golden BBCode repro.
                    const detailEmbed = new EmbedBuilder()
                        .setColor(0xdc3545)
                        .setTitle(`Test Suite FAILED — ${failed} of ${total}`)
                        .setDescription(buildFailureList(data.failures));
                    addBbcodeFields(detailEmbed, data.failures);

                    const channel = await client.channels.fetch(progress.channelId);
                    // Finalize FIRST (progress embed shows the red failed step),
                    // then overwrite with the detail embed so the bbcode/inputs
                    // repro is the FINAL visible state — finalize() re-renders the
                    // progress embed, so it must come before the detail write.
                    await progress.finalize('failed');
                    await channel.messages.edit(progress.messageId, { embeds: [detailEmbed] });
                    console.log(`[${TAG}] [OK] run ${data.runId} finalized as failed`);
                }

                activeProgress.delete(data.runId);

                // Full-fill BBCode validation output (FULL_BBCODE_OUTPUT=1 runs):
                // post the COMPLETE rendered form as embedded code blocks so it
                // reads inline (no .txt download step). Discord caps embed
                // descriptions at 4096 chars — chunk by line (3900 ceiling with
                // fences), one embed per chunk, max 10 embeds per message
                // (~39KB ceiling; the coroner full-fill is ~4.3KB = 2 embeds).
                // Best-effort; never fails the run reporting.
                try {
                    if (data.fullBbcode && data.fullBbcode.bbcode) {
                        const full = String(data.fullBbcode.bbcode);
                        const title = String(data.fullBbcode.title || 'full-fill coroner').slice(0, 80);
                        const chunks = [];
                        let current = '';
                        for (const line of full.split('\n')) {
                            if ((current + '\n' + line).length > 3900 && current) {
                                chunks.push(current);
                                current = '';
                                if (chunks.length >= 10) break;
                            }
                            current += (current ? '\n' : '') + line;
                        }
                        if (current && chunks.length < 10) chunks.push(current);
                        if (chunks.length > 0) {
                            const channel = await client.channels.fetch(progress.channelId);
                            if (channel?.isTextBased()) {
                                const embeds = chunks.map((chunk, i) => new EmbedBuilder()
                                    .setColor(0x3498db)
                                    .setTitle(i === 0 ? `Full-fill validation output — ${title}` : `continued (${i + 1}/${chunks.length})`)
                                    .setDescription('```\n' + chunk.slice(0, 3900) + '\n```')
                                    .setFooter({ text: `run ${data.runId}` }));
                                await channel.send({ embeds });
                                console.log(`[${TAG}] [OK] full-fill BBCode embedded in ${embeds.length} block(s) for run ${data.runId}`);
                            }
                        }
                    }
                } catch (err) {
                    console.warn(`[${TAG}] [WARN] full-fill embed post failed: ${err?.message || err}`);
                }
                return;
            }

            // Anything else (stale node with a different runId, or a duplicate
            // value event for a run we already finished) — harmless, skip.
        } catch (err) {
            console.error(`[${TAG}] [ERR] listener error: ${err?.message || err}`);
        }
    });

    console.log(`[${TAG}] [OK] started — watching testRun/active`);
}