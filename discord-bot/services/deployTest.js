/**
 * Deploy Test — dry-deploy test runner for the autopsy pipeline.
 *
 * Writes mock data to Firebase, then calls handleAutopsyReply() directly
 * with all dry-run flags forced on. Every step logs with a [DRY DEPLOYMENT] prefix.
 * All test data is cleaned up after each run.
 *
 * Usage:
 *   import { runAllDryDeployments } from './deployTest.js';
 *   await runAllDryDeployments();        // run all scenarios
 *   await runAllDryDeployments('LSSD');  // run only LSSD scenario
 */

import firebase from './firebase.js';
import { logFnCall, sendWebhook } from './deployLogger.js';
import { handleAutopsyReply } from './deployAutopsyReply.js';
import { getForumClient } from './forumClient.js';
import { state } from './deployState.js';

const TEST_PREFIX = '[DRY DEPLOYMENT]';
const TEST_AUTHOR_ID = 'test_autopsy_runner';

// ── Mock Data Generators ──

function scenarioLssdAutopsy() {
    const oocName = 'DryTest_LSSD_' + Date.now();
    const key = 'DRYTEST_LSSD_' + Date.now();
    return {
        name: 'LSSD',
        reportData: {
            formId: 'autopsy',
            formName: 'Autopsy Report',
            originalKey: key,
            timestamp: Date.now(),
            authorName: 'Dry Test Runner',
            legacy: false,
            hasdeployed: false,
            data: {
                decedentName: 'John LSSD Test',
                decedentOOC: oocName,
                department: { label: 'LSSD', value: 'LSSD' },
                requestingOfficer: 'Sheriff Test',
                dateTime: new Date().toISOString(),
            },
        },
        bbCode: '[b]Autopsy Report — Dry Run LSSD[/b]\nDecedent: John LSSD Test\nThis is a dry-run test.',
        autopsyRequestedEntry: {
            title: 'Autopsy Request - ' + oocName,
            oocName: oocName,
            faction: 'LSSD',
            topicId: 999999,
            parsed: { requesterName: 'Sheriff Test' },
            wasMatch: true,
            lssdRequestTopicId: 999991,
        },
    };
}

function scenarioPhmcAutopsy() {
    const oocName = 'DryTest_PHMC_' + Date.now();
    const key = 'DRYTEST_PHMC_' + Date.now();
    return {
        name: 'PHMC',
        reportData: {
            formId: 'autopsy',
            formName: 'Autopsy Report',
            originalKey: key,
            timestamp: Date.now(),
            authorName: 'Dry Test Runner',
            legacy: false,
            hasdeployed: false,
            data: {
                decedentName: 'Jane PHMC Test',
                decedentOOC: oocName,
                department: { label: 'PHMC', value: 'PHMC' },
                requestingOfficer: 'Officer Test',
                dateTime: new Date().toISOString(),
            },
        },
        bbCode: '[b]Autopsy Report — Dry Run PHMC[/b]\nDecedent: Jane PHMC Test\nThis is a dry-run test.',
        autopsyRequestedEntry: {
            title: 'Autopsy Request - ' + oocName,
            oocName: oocName,
            faction: 'PHMC',
            topicId: 999998,
            parsed: { requesterName: 'Officer Test' },
            wasMatch: true,
        },
    };
}

function scenarioNoOocName() {
    const key = 'DRYTEST_NOOOC_' + Date.now();
    return {
        name: 'NoOOC',
        reportData: {
            formId: 'autopsy',
            formName: 'Autopsy Report',
            originalKey: key,
            timestamp: Date.now(),
            authorName: 'Dry Test Runner',
            legacy: false,
            hasdeployed: false,
            data: {
                decedentName: 'No OOC Name Test',
                decedentOOC: '',
                department: { label: 'PHMC', value: 'PHMC' },
                requestingOfficer: 'Detective Test',
                dateTime: new Date().toISOString(),
            },
        },
        bbCode: '[b]Autopsy Report — Dry Run No OOC[/b]\nDecedent: No OOC Name Test\nThis is a dry-run test with no OOC name.',
        autopsyRequestedEntry: null,
    };
}

// ── Core Runner ──

/**
 * Run a single dry-deploy test scenario.
 * Writes data to Firebase, monkey-patches forumClient to force dry-run,
 * calls handleAutopsyReply directly, then cleans up.
 */
async function runDryDeploy(scenario) {
    const { name, reportData, bbCode, autopsyRequestedEntry } = scenario;
    const key = reportData.originalKey;
    const steps = [];
    let ok = false;

    function dryLog(msg) {
        const line = TEST_PREFIX + ' [' + name + '] ' + msg;
        console.log(line);
        steps.push(line);
    }

    dryLog('Starting dry deployment test...');

    const db = firebase.db;

    // Phase 1: Write test data to Firebase
    // Must suppress the real listener BEFORE writing to avoid a race where the listener
    // fires between the write and the suppress call
    if (state.knownReportKeys) {
        state.knownReportKeys.add(key);
    }
    dryLog('Writing report data to scheduledReports/' + TEST_AUTHOR_ID + '/' + key + '...');
    await db.ref('scheduledReports/' + TEST_AUTHOR_ID + '/' + key).set(reportData);

    dryLog('Writing BBCode to scheduledReportsBBCode/' + TEST_AUTHOR_ID + '/' + key + '...');
    await db.ref('scheduledReportsBBCode/' + TEST_AUTHOR_ID + '/' + key).set({ bbCode });

    let autopsyRequestedKey = null;
    if (autopsyRequestedEntry) {
        autopsyRequestedKey = 'drytest_' + key;
        dryLog('Writing autopsy-requested stub to autopsy-requested/' + autopsyRequestedKey + '...');
        await db.ref('autopsy-requested/' + autopsyRequestedKey).set(autopsyRequestedEntry);
    }

    // Phase 2: Construct the report object (matches what the Firebase listener builds)
    const report = {
        authorId: TEST_AUTHOR_ID,
        key: key,
        report: reportData,
        db: db,
    };

    // Phase 3: Monkey-patch forum client to force dry-run on all operations
    const client = getForumClient();
    const origReplyToTopic = client.replyToTopic ? client.replyToTopic.bind(client) : null;
    const origSendPM = client.sendPM ? client.sendPM.bind(client) : null;

    if (client.replyToTopic) {
        client.replyToTopic = async (topicId, forumId, bbCode, opts) => {
            dryLog('[INTERCEPT] replyToTopic(#' + topicId + ', f=' + forumId + ') — forcing dryRun=true');
            return origReplyToTopic(topicId, forumId, bbCode, { ...(opts || {}), dryRun: true });
        };
    }
    if (client.sendPM) {
        client.sendPM = async (recipient, subject, message, opts) => {
            dryLog('[INTERCEPT] sendPM(to=' + recipient + ') — forcing dryRun=true');
            return origSendPM(recipient, subject, message, { ...(opts || {}), dryRun: true });
        };
    }

    dryLog('Forum client patched — all operations forced to dryRun=true');

    // Phase 4: Execute
    dryLog('Calling handleAutopsyReply()...');
    try {
        await handleAutopsyReply(report);
        ok = true;
        dryLog('handleAutopsyReply completed successfully.');
    } catch (err) {
        dryLog('handleAutopsyReply threw: ' + err.message);
        dryLog('Stack: ' + (err.stack || ''));
    } finally {
        // Restore forum client
        if (origReplyToTopic) client.replyToTopic = origReplyToTopic;
        if (origSendPM) client.sendPM = origSendPM;
        dryLog('Forum client restored.');
    }

    // Phase 5: Cleanup
    dryLog('Cleaning up test data...');
    try {
        await db.ref('scheduledReports/' + TEST_AUTHOR_ID + '/' + key).remove();
        await db.ref('scheduledReportsBBCode/' + TEST_AUTHOR_ID + '/' + key).remove();
        if (autopsyRequestedKey) {
            await db.ref('autopsy-requested/' + autopsyRequestedKey).remove();
            await db.ref('autopsy-requested/' + autopsyRequestedKey + '/completionSteps').remove();
        }
        dryLog('Cleanup complete.');
    } catch (cleanErr) {
        dryLog('Cleanup error (non-fatal): ' + cleanErr.message);
    }

    return { ok: ok, key: key, steps: steps };
}

// ── Orchestrator ──

/**
 * Run all dry-deploy test scenarios (or a filtered subset).
 * @param {string} [scenarioFilter] - Optional: run only scenarios whose name contains this string
 * @returns {Promise<{ok: boolean, results: Array, runId: string}>}
 */
export async function runAllDryDeployments(scenarioFilter) {
    const runId = 'drytest_' + Date.now();
    logFnCall('deployTest', 'runAllDryDeployments', 'Starting dry deployment run', { runId, filter: scenarioFilter || 'all' });

    const scenarios = [
        scenarioLssdAutopsy(),
        scenarioPhmcAutopsy(),
        scenarioNoOocName(),
    ];

    const results = [];

    for (const scenario of scenarios) {
        if (scenarioFilter && !scenario.name.toLowerCase().includes(scenarioFilter.toLowerCase())) {
            results.push({ name: scenario.name, ok: false, skipped: true });
            continue;
        }

        try {
            const result = await runDryDeploy(scenario);
            results.push({ name: scenario.name, ok: result.ok, key: result.key });
        } catch (err) {
            results.push({ name: scenario.name, ok: false, error: err.message });
        }
    }

    // Brief delay for async completion steps to log before summary
    await new Promise(r => setTimeout(r, 2000));

    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;

    const summaryLines = results.map(function (r) {
        if (r.skipped) return '⏭️ ' + r.name + ' — skipped';
        return (r.ok ? '✅' : '❌') + ' ' + r.name + ' — ' + (r.ok ? 'Passed' : 'Failed' + (r.error ? ': ' + r.error : ''));
    });

    await sendWebhook(null, {
        title: TEST_PREFIX + ' Test Run Complete',
        description: [
            '**Run ID:** `' + runId + '`',
            '**Passed:** ' + passed + ' | **Failed:** ' + failed + ' | **Skipped:** ' + skipped,
            '',
            ...summaryLines,
        ].join('\n'),
        color: failed === 0 ? 0x28a745 : 0xffc107,
    });

    console.log(TEST_PREFIX + ' Run ' + runId + ' complete: ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');

    return { ok: failed === 0, results: results, runId: runId };
}
