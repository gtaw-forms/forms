/**
 * Auto-Deploy Service  monitors Firebase for new reports and deploys them
 * one at a time through a sequential queue.
 *
 * Wired into index.js on bot startup. Never runs more than one deploy at a time.
 */

import firebase from './firebase.js';
import { getForumClient } from './forumClient.js';
import { sendLogMessage } from './logChannel.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { logFnCall, sendWebhook, logStep, DeployProgressEmbed } from './deployLogger.js';
import { state, C } from './deployState.js';
import { markDeployed, setDeployStatus, markReportComplete } from './deployStatus.js';
import { checkUserConsent, skipDueToConsent } from './deployConsent.js';
import { consentGateAndEnqueue, enqueue, skipReport, getQueuedDeployments, getStuckReports, isMaintenanceMode, setMaintenanceMode } from './deployQueue.js';
import { backfillRetryQueue, cleanupOldDeployed, checkRetryQueue, requeueReport } from './deployRetry.js';
import { resolveAutopsyTopic } from './deployInteraction.js';
import { crosspostAutopsyToLssd, retryFailedLssdCrossposts } from './deployLssd.js';

//  Discord Client (for interactive messages)
// Set via setAutoDeployClient() from index.js on startup.



// Re-exports for external consumers
export { isMaintenanceMode, setMaintenanceMode, enqueue, skipReport, getQueuedDeployments, getStuckReports } from './deployQueue.js';
export { backfillRetryQueue, cleanupOldDeployed, checkRetryQueue, requeueReport } from './deployRetry.js';
export { markDeployed, setDeployStatus, markReportComplete } from './deployStatus.js';
export { resolveAutopsyTopic } from './deployInteraction.js';
export { crosspostAutopsyToLssd } from './deployLssd.js';
export function setAutoDeployClient(client) {
        logFnCall('autoDeploy', 'setAutoDeployClient', 'Registering Discord client');
    state.discordClient = client;
}

//  Pending Autopsy Topic Selections 
// When multiple case threads match a decedent name, we ask staff to pick.
// Map<customId, { db, authorId, key, reportData, bbCode, topics }>



//  Recent Patient Records Cache (avoids full-table scan for duplicate detection) 
// Tracks recently deployed patient_notes by patientID within a 5-minute window.
// Map<patientID, { authorId, key, timestamp }>


/**
 * Clean up stale entries from the recent patient records cache.
 * Called periodically and on each new entry.
 */
function pruneRecentPatientRecords() {
    const cutoff = Date.now() - (5 * 60 * 1000);
    for (const [pid, entry] of state.recentPatientRecords) {
        if (entry.timestamp < cutoff) state.recentPatientRecords.delete(pid);
    }
}

/**
 * Track what's currently being processed (for /form-queued status display).
 */

/**
 * Actually deploy a report (runs after the 5-min delay clears).
 * Processes sequentially  only one deploy at a time.
 */

//  Handlers 

/**
 * Send a coroner email as a PM.
 * Determines the target forum based on report metadata.
 */
export async function handlePM(report) {
    const { authorId, key, report: reportData, db } = report;
    const recipient = reportData.data?.requestingOfficer
        || reportData.data?.requesting_officer
        || reportData.data?.officerName
        || reportData.data?.recipient
        || null;

    if (!recipient) {
        console.log(`[AUTO]  ${key}  no recipient, marking as deployed`);
        await markDeployed(db, authorId, key, true, { deployNote: 'No recipient' });
        return;
    }

    const bbSnap = await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value');
    const bbCode = bbSnap.val()?.bbCode;
    if (!bbCode) {
        console.log(`[AUTO]  ${key}  no BBCode, marking as deployed`);
        await markDeployed(db, authorId, key, true, { deployNote: 'No BBCode' });
        return;
    }

    // Determine forum from the report data
    const rawDept = reportData.data?.department || '';
    const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)).toLowerCase();
    console.log(`[AUTO]  Resolving forum  raw department value: "${rawDept}"  parsed: "${deptStr}"`);

    const isSadcr = deptStr.includes('sadcr') || deptStr.includes('corrections');
    const isLssd = !isSadcr && (deptStr.includes('lssd') || deptStr.includes('sheriff') || deptStr.includes('lasd'));

    let forumUrl, username, password;
    if (isSadcr) {
        forumUrl = process.env.FORUM_SADCR_URL || 'http://sadcr.gta.world';
        username = process.env.FORUM_SADCR_USERNAME;
        password = process.env.FORUM_SADCR_PASSWORD;
    } else if (isLssd) {
        forumUrl = process.env.FORUM_LSSD_URL || 'http://lssd.gta.world';
        username = process.env.FORUM_LSSD_USERNAME;
        password = process.env.FORUM_LSSD_PASSWORD;
    } else {
        forumUrl = process.env.FORUM_LSPD_URL || 'http://lspd.gta.world';
        username = process.env.FORUM_LSPD_USERNAME;
        password = process.env.FORUM_LSPD_PASSWORD;
    }

    // Skip if credentials aren't configured for this forum
    if (!username || !password) {
        console.log(`[AUTO]  ${key}  no credentials for ${forumUrl}, leaving for manual deploy`);
        return;
    }

    console.log(`[AUTO]  Sending PM to ${recipient} via ${forumUrl}...`);
    const client = getForumClient();
    await client.login(username, password, { force: true, baseUrl: forumUrl });
    const result = await client.sendPM(recipient, reportData.originalKey || key, bbCode, { baseUrl: forumUrl });
    if (result.ok) {
        const label = reportData.originalKey || key;
        await markReportComplete(db, authorId, key, label, 'pm', result.url);
        console.log(`[AUTO]  ${key}  PM sent to ${recipient}`);
    } else {
        console.log(`[AUTO]  ${key}  PM send returned failure`);
        await sendWebhook(null, {
            title: ' Deploy Returned Unknown',
            description: `**Key:** \`${key}\`\n**Forum:** ${forumUrl}\n**Response:** Page returned empty after submit`,
            color: 0xffc107,
            footer: { text: 'PHMC Bot  Auto Deploy' },
            timestamp: new Date().toISOString(),
        });
    }
}

/**
 * Post a report as a forum topic (death_record, mass-fatality, coroner-report).
 */
export async function handleTopic(report) {
    const { authorId, key, report: reportData, db } = report;

    const bbSnap = await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value');
    const bbCode = bbSnap.val()?.bbCode;
    if (!bbCode) {
        console.log(`[AUTO]  ${key}  no BBCode, marking as deployed`);
        await markDeployed(db, authorId, key, true, { deployNote: 'No BBCode' });
        return;
    }

    // Resolve forum from the mapping
    const forumInfo = getForumClient().constructor.FORUM_MAP[reportData.formId];
    if (!forumInfo) {
        console.log(`[AUTO]  ${key}  no forum mapping for ${reportData.formId}`);
        return;
    }

    const DRY_POST = process.env.DRY_POST !== 'false';

    if (DRY_POST) {
        const simUrl = `${forumInfo.url}&dry_run=SIM_${Date.now()}`;
        const label = reportData.originalKey || key;
        await markReportComplete(db, authorId, key, label, 'topic_simulated', simUrl);
        console.log(`[AUTO]  ${key}  Simulated topic post to ${forumInfo.name} (DRY_POST)`);
        return;
    }

    console.log(`[AUTO] °Å¸â€œÂ° Posting topic to ${forumInfo.name} (f=${forumInfo.forumId})...`);
    const client = getForumClient();
    // Force login on PHMC forum  only if session expired
    await client.login(null, null, { force: false, baseUrl: process.env.FORUM_BASE_URL });
    const result = await client.postTopic(forumInfo.forumId, reportData.originalKey || key, bbCode, forumInfo.url);
    if (result.ok) {
        const label = reportData.originalKey || key;
        await markReportComplete(db, authorId, key, label, 'topic', result.url);
        console.log(`[AUTO]  ${key}  Topic posted: ${result.url}`);
    }
}

//  Medical Record Handler (reply to existing patient thread, or create new) 

/**
 * Handle a Patient Note  search for existing patient thread by patientID/name and reply to it.
 * ONLY replies to existing topics  never creates new ones.
 * Dry-run by default for safety  set DRY_REPLY=false in .env to enable live replies.
 */
export async function handleMedicalRecord(report) {
    const { authorId, key, report: reportData, db } = report;
    const DRY_REPLY = process.env.DRY_REPLY !== 'false';

    console.log(`[AUTO] °Å¸â€œâ€¹ handleMedicalRecord called for ${key}  patientID: "${reportData.data?.patientID}", formId: "${reportData.formId}"`);
    const rawPatientID = (reportData.data?.patientID || '').trim();
    const patientName = reportData.data?.decedentName || reportData.originalKey || '';

    // Require at least patientID OR patientName to proceed
    if (!rawPatientID && !patientName) {
        console.log(`[AUTO]  ${key}  no patientID or patientName`);
        await setDeployStatus(db, authorId, key, 'error', 'Missing patient ID or name. Please add one and save again.');
        await logStep(' Cannot Process', 'Add a **Patient ID** or **Patient Name** to the report, then save again.', { color: 0xdc3545, isFinal: true });
        return;
    }

    const bbSnap = await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value');
    const bbCode = bbSnap.val()?.bbCode;
    if (!bbCode) {
        console.log(`[AUTO]  ${key}  no BBCode, marking as deployed`);
        await setDeployStatus(db, authorId, key, 'error', 'No BBCode content found in report. Please regenerate and save again.');
        await logStep(' No BBCode', 'The report has no BBCode content. Regenerate the BBCode and save again.', { color: 0xdc3545, isFinal: true });
        return;
    }

    //  Near-duplicate check: within the last 5 min, keep only the newest report per patient 
    // Uses an in-memory cache (no Firebase read) to avoid a full-table scan of scheduledReports.
    if (rawPatientID && reportData.timestamp) {
        pruneRecentPatientRecords();
        const currentTime = reportData.timestamp;
        const existing = state.recentPatientRecords.get(rawPatientID);

        if (existing) {
            if (existing.timestamp > currentTime) {
                // A newer report already exists for this patient  this one is stale
                console.log(`[AUTO] °Å¸â€”â€˜¯Â¸ ${key}  trashing old duplicate, a newer report exists for patient ${rawPatientID}`);
                await db.ref(`scheduledReports/${authorId}/${key}`).update({
                    hasdeployed: true,
                    deployStatus: 'trashed_duplicate',
                    deployMessage: `A newer version of this report was saved. This older copy was trashed.`,
                    deployedAt: new Date().toISOString(),
                    deployedBy: 'autoDeploy',
                });
                await logStep('°Å¸â€”â€˜¯Â¸ Removed  Duplicate', `A **newer** report exists for patient **#${rawPatientID}**. This older copy was automatically trashed.`, { color: 0xffc107, isFinal: true });
                return;
            }
            // This report is newer than the cached one  trash the older one
            console.log(`[AUTO] °Å¸â€”â€˜¯Â¸ ${existing.key}  trashing older duplicate for patient ${rawPatientID}, keeping ${key}`);
            await db.ref(`scheduledReports/${existing.authorId}/${existing.key}`).update({
                hasdeployed: true,
                deployStatus: 'trashed_duplicate',
                deployMessage: `Replaced by newer report ${key}.`,
                deployedAt: new Date().toISOString(),
                deployedBy: 'autoDeploy',
            });
            state.recentPatientRecords.delete(rawPatientID);
            console.log(`[AUTO]  ${key}  is the newest report for patient ${rawPatientID}, proceeding with deploy`);
        } else {
            console.log(`[AUTO]  No recent duplicates found for patientID "${rawPatientID}"  proceeding`);
        }
    }

    // Populate in-memory cache for future duplicate checks
    if (rawPatientID && reportData.timestamp) {
        state.recentPatientRecords.set(rawPatientID, { authorId, key, timestamp: reportData.timestamp });
    }

    // Determine search term: numeric = ID search, text = name search
    const isNumericId = /^\d+$/.test(rawPatientID);
    const searchTerm = isNumericId ? rawPatientID : patientName;
    const searchIcon = isNumericId ? `°Å¸â€Â¢` : ``;
    console.log(`[AUTO] ${searchIcon} Searching by ${isNumericId ? 'patientID' : 'name'}: "${searchTerm}"`);

    const client = getForumClient();
    await logStep('°Å¸Å’Â Opening browser...', `Logging into PHMC forum...`);
    await client.login(null, null, { force: false, baseUrl: process.env.FORUM_BASE_URL });

    await logStep(' Searching...', `Looking for thread by **${isNumericId ? 'patient ID' : 'name'}**: \`${searchTerm}\``);

    // Step 1: Search for existing patient thread
    await setDeployStatus(db, authorId, key, 'searching', `Looking for thread by ${isNumericId ? 'ID' : 'name'}: ${searchTerm}...`);
    const { topicId, title: foundTitle } = await client.searchForPatientTopic(searchTerm);

    if (!topicId) {
        console.log(`[AUTO] °Å¸â€œÂ­ No existing thread found for "${searchTerm}"`);
        await setDeployStatus(db, authorId, key, 'topic_not_found', `No thread found for ${searchTerm}. Please create one manually on the forum, then re-save.`);
        await logStep('°Å¸â€œÂ­ Topic Not Found', `**\`${searchTerm}\`**  no matching thread exists.\nCreate the patient thread manually on the forum, then save the report again.`, { color: 0xffc107, isFinal: true });
        return;
    }

    // Step 2: Topic found  reply
    console.log(`[AUTO]  Topic found: #${topicId}  "${foundTitle}"`);
    await setDeployStatus(db, authorId, key, 'replying', `Found topic #${topicId}. ${DRY_REPLY ? 'Filling form (dry run  will not submit)' : 'Posting reply...'}`);
    await logStep(' Topic Found', `**#${topicId}:** ${foundTitle}\n${DRY_REPLY ? ' Dry run  form will not be submitted' : ' Submitting reply...'}`, { color: DRY_REPLY ? 0xffc107 : 0x28a745 });

    const result = await client.replyToTopic(topicId, 97, bbCode, { dryRun: DRY_REPLY });

    if (result.ok && !result.dryRun) {
        const label = reportData.originalKey || key;
        const completed = await markReportComplete(db, authorId, key, label, 'medical-record', result.url);
        if (completed) {
            await logStep(' Reply Posted', `[View Reply](<${result.url}>)`, { color: 0x28a745, isFinal: true });
        } else {
            await logStep(' Reply Posted But Status Update Failed', `Reply was posted at [View Reply](<${result.url}>) but the Firebase status update did not verify. The report may be retried on next restart.`, { color: 0xffc107, isFinal: true });
        }
    } else if (result.dryRun) {
        await setDeployStatus(db, authorId, key, 'dry_run', `Form filled for topic #${topicId} but NOT submitted. Set DRY_REPLY=false to enable.`);
        console.log(`[AUTO]  Dry run  form filled for topic #${topicId}`);
        await logStep(' Dry Run Complete', `**#${topicId}:** ${foundTitle}\nForm filled but **not submitted**. Set \`DRY_REPLY=false\` in .env to enable.`, { color: 0xffc107, isFinal: true });
    } else {
        await setDeployStatus(db, authorId, key, 'reply_failed', result.reason || 'Unknown error replying to topic');
        console.error(`[AUTO]  Failed to reply to topic #${topicId}: ${result.reason || 'Unknown'}`);
        await logStep(' Reply Failed', `**Topic #${topicId}:** ${result.reason || 'Unknown error'}`, { color: 0xdc3545, isFinal: true });
    }
}

//  Autopsy Reply Handler 

export const CASE_MGMT_FORUM_ID = 266;
export const AUTOPSY_DRY_RUN = process.env.AUTOPSY_DRY_RUN !== 'false'; // default dry-run
export const AUTOPSY_REQUEST_FORUM_ID = 265;

/**
 * Completion reply template for the original autopsy request topic.
 * Posted when the autopsy report is completed.
 */
export const COMPLETION_TEMPLATE = `[divbox=white][center][img]https://i.imgur.com/Hxjt4M2.png[/img][/center][/divbox]

[divbox=white]
Dear REQUESTER_NAME

We have completed the autopsy investigation, and the detailed report has been sent out. I have thoroughly reviewed all findings and compiled the results into a comprehensive document. Please review the report at your earliest convenience, and feel free to reach out if you have any questions or require further information.

[i]Best regards,[/i]
[hr][/hr]
[b]Office of Forensic Medicine Division[/b]
Department of Forensic Medicine and Pathology

[b]Pillbox Hill Medical Center[/b]
[size=85]Elgin Ave/Strawberry Ave, Los Santos, SA
Ph: 50056
Mail: [url=https://phmc.gta.world/ucp.php?i=pm&mode=compose&u=your_id]medical.examiners@phmc.health[/url]
Website: [url]www.phmc.health[/url][/size]

[center][img]https://i.imgur.com/vztjYpe.png[/img][/center]`;

/**
 * Track a completion step result in Firebase + send a Discord webhook.
 * Stores status at autopsy-requested/<topicId>/completionSteps/<stepName>
 * so failed steps can be retried on restart.
 */
async function trackCompletionStep(topicId, stepName, ok, detail = '') {
    const status = ok ? 'completed' : 'failed';
    const icon = ok ? '✅' : '⚠️';
    const label = stepName.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    console.log(`[AUTO-COMPLETE] ${icon} ${stepName}: ${ok ? 'OK' : 'FAIL'} ${detail}`);

    // Discord webhook
    sendWebhook(null, {
        title: `${icon} Autopsy Completion — ${label}`,
        description: `${detail || (ok ? 'Completed successfully' : 'Failed')}`,
        color: ok ? 0x28a745 : 0xffc107,
        footer: { text: `Topic #${topicId}` },
        timestamp: new Date().toISOString(),
    });

    // Firebase status (best-effort, never throws)
    if (topicId && state.dbRef) {
        try {
            await state.dbRef
                .child(`autopsy-requested/${topicId}/completionSteps/${stepName}`)
                .set({ status, updatedAt: new Date().toISOString(), detail });
        } catch (e) {
            // Fire-and-forget — don't let tracking failures block anything
        }
    }
}

/**
 * Handle an Autopsy report  search Case Management forum (f=266) by decedent name
 * and reply to the case thread with the autopsy BBCode.
 * Dry-run by default for safety  set AUTOPSY_DRY_RUN=false in .env to enable live posting.
 */
export async function handleAutopsyReply(report) {
    const { authorId, key, report: reportData, db } = report;
    const DRY = AUTOPSY_DRY_RUN;

    console.log(`[AUTO]  handleAutopsyReply called for ${key}  name: "${reportData.data?.decedentName}"`);

    // Determine search terms from report data
    const decedentName = (reportData.data?.decedentName || '').trim();
    const decedentOOC = (reportData.data?.decedentOOC || '').trim();
    const searchTerm = decedentOOC || decedentName || reportData.originalKey || '';

    if (!searchTerm) {
        console.log(`[AUTO]  ${key}  no decedent name to search for`);
        await setDeployStatus(db, authorId, key, 'error', 'Missing decedent name. Add a name to the report and save again.');
        await logStep(' Cannot Process', 'Add a **Decedent Name** to the autopsy report, then save again.', { color: 0xdc3545, isFinal: true });
        return;
    }

    // Guard: skip reply if already completed in autopsy-requested (prevents duplicate on retry)
    const oocGuard = (reportData.data?.decedentOOC || "").trim();
    if (oocGuard) {
        try {
            const guardSnap = await db.ref("autopsy-requested").orderByChild("oocName").equalTo(oocGuard).once("value");
            let alreadyDone = false;
            if (guardSnap.exists()) guardSnap.forEach(c => { if (c.val().completedAt) alreadyDone = true; });
            if (alreadyDone) {
                console.log(`[AUTO] ${key} already completed — skipping duplicate reply`);
                await setDeployStatus(db, authorId, key, "already_completed", "Skipped duplicate reply.");
                await markReportComplete(db, authorId, key, reportData.originalKey || key, "autopsy-reply-skip", null);
                return;
            }
        } catch (e) { console.warn(`[AUTO] completion guard error: ${e.message}`); }
    }

    const bbSnap = await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value');
    const bbCode = bbSnap.val()?.bbCode;
    if (!bbCode) {
        console.log(`[AUTO]  ${key}  no BBCode, marking as deployed`);
        await setDeployStatus(db, authorId, key, 'error', 'No BBCode content found in report. Regenerate and save again.');
        await logStep(' No BBCode', 'The report has no BBCode content. Regenerate and save again.', { color: 0xdc3545, isFinal: true });
        return;
    }

    const client = getForumClient();
    const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID);
    await progress.start(`Autopsy Report — ${reportData.originalKey || key}`);

    await progress.addStep('PHMC Login', 'pending');
    await client.login(null, null, { force: false, baseUrl: process.env.FORUM_BASE_URL });
    await progress.addStep('PHMC Login', 'ok');

    await progress.addStep('Searching Case Mgmt', 'pending', `Looking for "${searchTerm}"`);

    await setDeployStatus(db, authorId, key, 'searching', `Searching for "${searchTerm}" in Case Management...`);
    const caseThreads = await client.searchCaseManagement(searchTerm);

    if (caseThreads.length === 0) {
        console.log(`[AUTO] No PHMC case thread found for "${searchTerm}"`);
        await progress.addStep('Case Not Found', 'fail', searchTerm);
        const rawDept = reportData.data?.department || '';
        const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)).toLowerCase();
        if (deptStr.includes('lssd') || deptStr.includes('sheriff')) {
            console.log('[AUTO-COMPLETE] LSSD cross-post triggered');
            const lssdResult = await crosspostAutopsyToLssd(reportData, bbCode, null, db);
            if (lssdResult.awaitingPick) {
                return;
            }
            if (lssdResult.ok && !lssdResult.skipped) {
                const label = reportData.originalKey || key;
                await markReportComplete(db, authorId, key, label, 'autopsy-lssd', lssdResult.url);
                await progress.addStep('Posted to LSSD', 'ok');
                await progress.finalize('complete');
                return;
            }
        }

        await setDeployStatus(db, authorId, key, 'topic_not_found', `No case thread found for "${searchTerm}". Create one manually, then re-save.`);
        await progress.addStep('Case Not Found', 'fail', 'No matching PHMC or LSSD thread exists');
        await progress.finalize('failed');
        return;
    }

    let topicId, foundTitle;

    if (caseThreads.length > 1 && state.discordClient) {
        //  Multiple matches  let staff pick 
        const pickId = `autopsy_pick_${++state.autopsyPickCounter}`;
        state.pendingAutopsyPicks.set(pickId, { db, authorId, key, reportData, bbCode, topics: caseThreads });

        console.log(`[AUTO]  ${caseThreads.length} case threads found for "${searchTerm}"  prompting staff`);

        // Build the embed and buttons
        const embed = new EmbedBuilder()
            .setColor(0xffc107)
            .setTitle('Multiple Case Threads Found')
            .setDescription([
                `**Report:** ${reportData.originalKey || key}`,
                `**Search:** \`${searchTerm}\``,
                '',
                'Multiple matching threads found. Pick the correct one:',
            ].join('\n'))
            .setFooter({ text: `Expires in 5 min | ${pickId}` })
            .setTimestamp();

        const rows = [];
        // Split into rows of up to 3 buttons each (Discord limit: 5 per row)
        for (let i = 0; i < caseThreads.length; i += 3) {
            const chunk = caseThreads.slice(i, i + 3);
            const row = new ActionRowBuilder().addComponents(
                chunk.map((t, j) =>
                    new ButtonBuilder()
                        .setCustomId(`${pickId}_${t.topicId}`)
                        .setLabel(`#${t.topicId}`)
                        .setStyle(ButtonStyle.Primary)
                )
            );
            rows.push(row);
        }

        // Add a "None of these" cancel button
        rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${pickId}_cancel`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        ));

        try {
            const channelId = process.env.BOT_LOG_CHANNEL_ID;
            if (!channelId) throw new Error('No BOT_LOG_CHANNEL_ID configured');
            const channel = await state.discordClient.channels.fetch(channelId);
            await channel.send({ embeds: [embed], components: rows });

            // Cancel pending pick after 5 minutes and re-queue the report
            setTimeout(async () => {
                const expired = state.pendingAutopsyPicks.get(pickId);
                if (expired) {
                    state.pendingAutopsyPicks.delete(pickId);
                    console.log(`[AUTO] ’â€º Autopsy pick ${pickId} expired  re-queuing ${expired.key}`);

                    // Remove from state.knownReportKeys so it gets picked up by the listener again
                    if (state.knownReportKeys) state.knownReportKeys.delete(expired.key);

                    // Mark in Firebase so the web app shows why it's stuck
                    try {
                        await expired.db.ref(`scheduledReports/${expired.authorId}/${expired.key}`).update({
                            deployStatus: 'pick_timed_out',
                            deployMessage: 'Topic pick timed out (5 min). The report will be re-attempted on the next save.',
                            deployCheckedAt: new Date().toISOString(),
                        });
                    } catch (err) {
                        console.error(`[AUTO]  Failed to update timeout status: ${err.message}`);
                    }
                }
            }, 5 * 60 * 1000);

            console.log(`[AUTO]  Waiting for staff to pick a thread for "${searchTerm}"`);
            return;
        } catch (err) {
            console.error(`[AUTO]  Failed to prompt staff for topic pick: ${err.message}`);
            // Fall through to auto-pick the first result
        }
        state.pendingAutopsyPicks.delete(pickId);
    }

    // Auto-pick: use the most recent/relevant match
    topicId = caseThreads[0].topicId;
    foundTitle = caseThreads[0].title;
    if (caseThreads.length > 1) {
        console.log(`[AUTO]  ${caseThreads.length} case threads found  auto-picked most recent: #${topicId} "${foundTitle}"`);
    }

    // Topic found  reply
    console.log(`[AUTO]  Case thread found: #${topicId}  "${foundTitle}"`);
    await setDeployStatus(db, authorId, key, 'replying', `Found case #${topicId}. ${DRY ? 'Filling form (dry run)' : 'Posting reply...'}`);
    await progress.addStep('Case Found', 'ok', `#${topicId} ${foundTitle}`);
    await progress.addStep('Posting Reply', 'pending');

    const result = await client.replyToTopic(topicId, CASE_MGMT_FORUM_ID, bbCode, { dryRun: DRY });

    if (result.ok && !result.dryRun) {
        await progress.addStep('Autopsy Posted', 'ok', result.url || '');
        const label = reportData.originalKey || key;
        const completed = await markReportComplete(db, authorId, key, label, 'autopsy-reply', result.url);
        if (completed) {
            let completedTopicId = null;
            try {
                const ooc = (reportData.data?.decedentOOC || "").trim();
                console.log('[AUTO-COMPLETE] Parsed OOC name from report');
                if (ooc) {
                    const arSnap = await db.ref("autopsy-requested").orderByChild("oocName").equalTo(ooc).once("value");
                    if (arSnap.exists()) {
                        arSnap.forEach((child) => {
                            const entry = child.val();
                            completedTopicId = child.key;
                            if (entry.completedAt) return;

                            console.log('[AUTO-COMPLETE] Marking autopsy request as completed in Firebase');
                            child.ref.update({ completedAt: new Date().toISOString(), completedBbCode: bbCode });
                            console.log("[AUTO] ✅ Marked autopsy-requested #" + child.key + " as completed");

                            // Reply to original request topic with completion template
                            const requesterName = entry.parsed?.requesterName || "Requesting Party";
                            const caseTitle = entry.caseUrl || entry.title || "Autopsy Case";
                            const completionBb = COMPLETION_TEMPLATE
                                .replace("CASE_TITLE", caseTitle)
                                .replace("REQUESTER_NAME", requesterName);

                            console.log('[AUTO-COMPLETE] Sending completion reply to request topic #' + entry.topicId);
                            (async () => {
                                try {
                                    const r = await client.replyToTopic(entry.topicId, AUTOPSY_REQUEST_FORUM_ID, completionBb, { dryRun: false });
                                    await trackCompletionStep(child.key, 'phmcCompletionReply', r.ok, r.ok ? '#' + entry.topicId : (r.reason || 'Unknown'));
                                } catch (e) {
                                    await trackCompletionStep(child.key, 'phmcCompletionReply', false, e.message);
                                }
                            })();

                            // Post completion template to LSSD request topic if this was an LSSD case
                            const lssdRequestTopicId = entry.lssdRequestTopicId;
                            if (lssdRequestTopicId) {
                                console.log('[AUTO-COMPLETE] Sending completion reply to LSSD request topic #' + lssdRequestTopicId);
                                (async () => {
                                    try {
                                        await client.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: 'https://lssd.gta.world' });
                                        const r = await client.replyToTopic(lssdRequestTopicId, 2263, completionBb, { dryRun: false, baseUrl: 'https://lssd.gta.world' });
                                        await trackCompletionStep(child.key, 'lssdCompletionReply', r.ok, r.ok ? '#' + lssdRequestTopicId : (r.reason || 'Unknown'));
                                    } catch (e) {
                                        await trackCompletionStep(child.key, 'lssdCompletionReply', false, e.message);
                                    }
                                })();
                            } else {
                                (async () => {
                                    await trackCompletionStep(child.key, 'lssdCompletionReply', true, 'No LSSD request topic (not an LSSD case)');
                                })();
                            }

                            // DM the requester the completed autopsy report
                            (async () => {
                                try {
                                    const forumUser = await client.getTopicPoster(entry.topicId, { baseUrl: process.env.FORUM_BASE_URL });
                                    const dmTarget = forumUser || requesterName;
                                    if (!dmTarget || dmTarget === "Requesting Party") {
                                        await trackCompletionStep(child.key, 'dmSent', true, 'No valid DM target — skipped');
                                        return;
                                    }
                                    const dmSubject = "Autopsy Request - " + (entry.title || "Completed");
                                    console.log("[AUTO-COMPLETE] Sending DM to " + dmTarget);
                                    const r = await client.sendPM(dmTarget, dmSubject, bbCode);
                                    await trackCompletionStep(child.key, 'dmSent', r.ok, r.ok ? dmTarget : (r.reason || 'Unknown'));
                                } catch (e) {
                                    await trackCompletionStep(child.key, 'dmSent', false, e.message);
                                }
                            })();
                        });
                    }
                }
            } catch (e) { console.warn("[AUTO] Completion marker error:", e.message); }
            console.log('[AUTO-COMPLETE] LSSD cross-post triggered');
            console.log('[AUTO-COMPLETE] Triggering LSSD cross-post'); crosspostAutopsyToLssd(reportData, bbCode, completedTopicId, db).catch(() => { });
            progress.finalize('complete').catch(() => {});
        } else {
                await logStep(' Autopsy Posted But Status Update Failed', `Reply was posted at [View Reply](<${result.url}>) but the Firebase status update did not verify.`, { color: 0xffc107, isFinal: true });
            await progress.addStep('Status Update Failed', 'fail', result.url || '');
            await progress.finalize('failed');
            }
        } else if (result.dryRun) {
            await setDeployStatus(db, authorId, key, 'dry_run', `Form filled for case #${topicId} but NOT submitted. Set AUTOPSY_DRY_RUN=false to enable.`);
            console.log(`[AUTO]  Dry run  form filled for case #${topicId}`);
            await progress.addStep('Dry Run Complete', 'ok', `#${topicId} ${foundTitle}`);
            await progress.finalize('complete');
        } else {
            await setDeployStatus(db, authorId, key, 'reply_failed', result.reason || 'Unknown error replying to case thread');
            console.error(`[AUTO]  Failed to reply to case #${topicId}: ${result.reason || 'Unknown'}`);
            await progress.addStep('Reply Failed', 'fail', result.reason || 'Unknown');
            await progress.finalize('failed');
        }
    }

    //  Interactive Autopsy Topic Picker 

    /**
     * Handle a staff member's button click picking which case thread to reply to.
     * Called from index.js when an autopsy_pick_* button is clicked.
     *
     * @param {import('discord.js').ButtonInteraction} interaction
     */

    //  Firebase Listener 

/**
 * On startup, scan for autopsy completions with failed steps and notify via Discord.
 * Does NOT auto-retry (re-posting a reply that actually succeeded but had a status write
 * failure would create a duplicate). An operator can manually re-send if needed.
 */
async function retryFailedCompletionSteps(db) {
    logFnCall('autoDeploy', 'retryFailedCompletionSteps', 'Scanning for failed completion steps');
    try {
        const snap = await db.ref('autopsy-requested').once('value');
        if (!snap.exists()) return;
        let failures = 0;
        snap.forEach((child) => {
            const entry = child.val();
            const steps = entry.completionSteps;
            if (!steps) return;
            for (const [stepName, stepData] of Object.entries(steps)) {
                if (stepData?.status === 'failed') {
                    failures++;
                    console.warn(`[AUTO-COMPLETE] Previous session left ${stepName} FAILED for #${child.key}: ${stepData.detail || ''}`);
                }
            }
        });
        if (failures > 0) {
            sendWebhook(null, {
                title: ' Autopsy Completion Failures Detected',
                description: `${failures} completion step(s) failed in a previous session. Check PM2 logs for details — you may need to manually re-send the failed replies/DMs.`,
                color: 0xffc107,
                footer: { text: 'PHMC Bot — Startup Scan' },
            });
        }
    } catch (err) {
        console.warn('[AUTO-COMPLETE] Completion step retry scan error:', err.message);
    }
}

    /**
     * Start listening to Firebase for new undeployed reports.
     * Called once on bot startup.
     */
    export function startAutoDeploy() {
        logFnCall('autoDeploy', 'startAutoDeploy', 'Starting auto-deploy system');
        firebase.init();
        const db = firebase.db;
        state.dbRef = db.ref(); // root Reference so .child() and .ref() both work

        console.log('[AUTO]  Starting auto-deploy listener...');

        //  Check persisted maintenance state 
        db.ref(C.MAINTENANCE_PATH).once('value', (snap) => {
            state.maintenanceMode = snap.val() === true;
            if (state.maintenanceMode) {
                console.log('[AUTO]  Maintenance mode was ON (persisted)  queue paused');
                sendWebhook(null, {
                    title: ' Bot Started in Maintenance Mode',
                    description: 'Auto-deploy queue is paused. Use `/maintenance off` to resume.',
                    color: 0xffc107,
                });
            } else {
                console.log('[AUTO]  No maintenance flag  queue active');
            }
        });

        //  Startup notification 
        sendWebhook(null, {
            title: ' Bot Online',
            description: state.maintenanceMode ? 'Maintenance mode active  queue paused.' : 'Auto-deploy listener active.',
            color: state.maintenanceMode ? 0xffc107 : 0x28a745,
            footer: { text: `PHMC Bot  ${new Date().toLocaleString()}` },
        });

        //  Backfill any existing retry_queued entries into retry-queue index 
        backfillRetryQueue(db);

        //  Cleanup old deployed reports (startup + every 6 hours) 
        cleanupOldDeployed(db);
        setInterval(() => cleanupOldDeployed(db), 6 * 60 * 60 * 1000);

        //  Check retry queue on startup and every 30 minutes
        // Picks up reports with retry_queued status whose retryAt has passed
        checkRetryQueue();
        setInterval(() => checkRetryQueue(), C.RETRY_CHECK_INTERVAL_MS);

        //  Retry any failed LSSD cross-posts from previous sessions
        retryFailedLssdCrossposts(db);

        //  Retry any failed autopsy completion steps from previous sessions
        retryFailedCompletionSteps(db);

        //  Start passive CK listener on newSavedReports
        // Monitors opted-out users' reports for CKs and drafts death records
        // when a morgue match is found.
        try {
            import('./deathRecordDraft.js').then(({ startCKListener }) => {
                startCKListener(db);
            }).catch((err) => console.warn('[AUTO]  Failed to start CK listener:', err.message));
        } catch (err) {
            console.warn('[AUTO]  Could not start CK listener:', err.message);
        }

        //  Start morgue listener (auto-match pending drafts) 
        try {
            import('./deathRecordDraft.js').then(({ initMorgueCache, startMorgueListener }) => {
                initMorgueCache(db);
                startMorgueListener(db);
            }).catch((err) => console.warn('[AUTO]  Failed to start morgue listener:', err.message));
        } catch (err) {
            console.warn('[AUTO]  Could not start morgue listener:', err.message);
        }

        //  Listen for new reports at scheduledReports 
        // Using on('value') because child_added only fires for NEW top-level children (authors),
        // not for reports added under EXISTING authors. value fires on any change.
        state.knownReportKeys = new Set();
        const _autoDeployStartupTime = Date.now();
        const CK_EPOCH = 1782864000000; // 2026-07-01T00:00:00Z  reports saved before this are skipped for CK drafting
        console.log(`[AUTO]  CK drafting: skipping reports saved before 01/JUL/2026`);
        db.ref('scheduledReports').on('value', (snap) => {
            snap.forEach((authorSnap) => {
                const authorId = authorSnap.key;
                authorSnap.forEach((reportSnap) => {
                    const reportKey = reportSnap.key;
                    if (state.knownReportKeys.has(reportKey)) return;

                    const reportData = reportSnap.val();
                    if (reportData.hasdeployed !== false) {
                        state.knownReportKeys.add(reportKey);
                        return;
                    }

                    state.knownReportKeys.add(reportKey);
                    console.log(`[AUTO]  ${reportData.originalKey || reportKey}`);

                    const item = {
                        authorId,
                        key: reportKey,
                        report: reportData,
                        db,
                    };

                    if (reportData.formId === 'coroner_email') {
                        consentGateAndEnqueue('pm', item, reportData.formId);
                    } else if (['death_record', 'mass-ftality-test', 'coroner-report'].includes(reportData.formId)) {
                        consentGateAndEnqueue('topic', item, reportData.formId);
                    } else if (reportData.formId === 'patient_notes') {
                        consentGateAndEnqueue('medical-record', item, reportData.formId);
                    } else if (reportData.formId === 'autopsy') {
                        consentGateAndEnqueue('autopsy-reply', item, reportData.formId);
                    }

                    //  Passive CK check (death record drafting) 
                    // Only for NEW reports (saved after bot startup) to avoid re-processing
                    // legacy records. Silently checks morgue and drafts if matched.
                    if (reportData.timestamp && reportData.timestamp >= _autoDeployStartupTime) {
                        if (reportData.formId === 'coroner-report' || reportData.formId === 'mass-ftality-test') {
                            import('./deathRecordDraft.js').then(({ passivCKCheck }) => {
                                passivCKCheck(db, authorId, reportKey, reportData)
                                    .catch((err) => console.error(`[AUTO]  Passive CK error for ${reportKey}:`, err.message));
                            }).catch(() => { });
                        }
                    }
                });
            });
        });

        //  Retry queue index cleanup  remove stale entries 
        db.ref('retry-queue').once('value').then((rqSnap) => {
            if (rqSnap?.exists()) {
                const rqCleanup = {};
                rqSnap.forEach((child) => {
                    const entry = child.val();
                    if (!entry) { rqCleanup[child.key] = null; return; }
                    if (!entry.retryAt) { rqCleanup[child.key] = null; }
                });
                if (Object.keys(rqCleanup).length > 0) {
                    db.ref('retry-queue').update(rqCleanup);
                    console.log(`[AUTO]  Cleaned up ${Object.keys(rqCleanup).length} empty retry-queue entries`);
                }
            }
        }).catch(() => { });

        console.log('[AUTO]  Auto-deploy listener active.');
    }
//  Discord Notifications — imported from deployLogger.js