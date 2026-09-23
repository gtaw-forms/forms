/**
 * deployCoronerEmail.js — Auto-generated Coroner Emails from Report Requested flag.
 *
 * When a Coroner Report or Mass Fatality report is saved with the "Report
 * Requested" field set to true, this handler auto-generates and sends a
 * Coroner Email PM to the requesting officer on their department's forum.
 *
 * Completely separate from handlePM() — zero risk to existing PM flow.
 * CORONER_EMAIL_DRY_RUN=true by default — never sends live until explicitly enabled.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { logFnCall, sendWebhook, DeployProgressEmbed } from './deployLogger.js';
import { state, C } from './deployState.js';
import { getForumClient } from './forumClient.js';
import { isMaintenanceMode } from './deployQueue.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Safety env vars ──
const CORONER_EMAIL_DRY_RUN = process.env.CORONER_EMAIL_DRY_RUN !== 'false';
const CORONER_EMAIL_ALLOWED = (process.env.CORONER_EMAIL_ALLOWED || '').split(',').map(s => s.trim()).filter(Boolean);

// ── Department name mapping (replaces getDepartmentFullName — bot doesn't have agencyDataStore) ──
const DEPARTMENT_NAMES = {
    lspd: 'Los Santos Police Department',
    lssd: 'Los Santos Sheriff\'s Department',
    sadcr: 'San Andreas Department of Corrections and Rehabilitation',
    dao: 'District Attorney\'s Office',
    'district attorney': 'District Attorney\'s Office',
    'district attorney\'s office': 'District Attorney\'s Office',
    'los santos police department': 'Los Santos Police Department',
    'los santos sheriff\'s department': 'Los Santos Sheriff\'s Department',
    'san andreas department of corrections and rehabilitation': 'San Andreas Department of Corrections and Rehabilitation',
};

function formatDepartment(raw) {
    if (!raw) return 'Unknown Department';
    const str = (typeof raw === 'object' ? (raw.label || raw.value || '') : String(raw)).toLowerCase().trim();
    return DEPARTMENT_NAMES[str] || raw.label || raw.value || raw;
}

// ── Template filler (replaces {{variables}} and function calls) ──
function fillEmailTemplate(template, values) {
    let bbcode = template;
    for (const [key, val] of Object.entries(values)) {
        const placeholder = `{{${key}}}`;
        if (bbcode.includes(placeholder)) {
            bbcode = bbcode.replaceAll(placeholder, String(val ?? ''));
        }
    }
    // Handle function-call placeholders that simple replace can't resolve
    // {{getDepartmentFullName(department)}}  and  {{getDepartmentFullName(formData.department, agencyDataStore)}}
    const deptName = formatDepartment(values.department || values.formData?.department);
    bbcode = bbcode.replaceAll('{{getDepartmentFullName(department)}}', deptName);
    bbcode = bbcode.replaceAll('{{getDepartmentFullName(formData.department, agencyDataStore)}}', deptName);
    return bbcode;
}

/**
 * Build the deathReport BBCode from additionalReports (attached report BBCodes).
 * Wraps each in [spoiler=Title]...[/spoiler], matching useBbcodeGenerator.js behavior.
 */
/**
 * Sanitize BBCode for cross-forum compatibility.
 * Replaces PHMC-specific tags with standard phpBB equivalents.
 */
function sanitizeBbCode(bbcode) {
    if (!bbcode) return '';
    return bbcode
        .replace(/\[bold\]/gi, '[b]')
        .replace(/\[\/bold\]/gi, '[/b]');
}

function buildDeathReport(additionalReports) {
    if (!Array.isArray(additionalReports) || additionalReports.length === 0) {
        return 'No attached reports.';
    }
    return additionalReports.map((report) => {
        const rawTitle = report.originalKey || report.title || 'Attached Report';
        // Strip [brackets] from the title to prevent BBCode parsing breakage
        const title = rawTitle.replace(/[[\]]/g, '');
        const bbcode = sanitizeBbCode(report.bbCode || '');
        return `[spoiler=${title}]${bbcode}[/spoiler]`;
    }).join('\n\n');
}

/**
 * Resolve the target forum from the department value.
 * Returns { forumUrl, username, password, forumLabel } or null.
 */
function resolveForum(department) {
    const raw = (typeof department === 'object' ? (department.label || department.value || '') : String(department)).toLowerCase();
    if (raw.includes('sadcr') || raw.includes('corrections')) {
        return {
            forumUrl: process.env.FORUM_SADCR_URL || 'http://sadcr.gta.world',
            username: process.env.FORUM_SADCR_USERNAME,
            password: process.env.FORUM_SADCR_PASSWORD,
            forumLabel: 'SADCR',
        };
    }
    if (raw.includes('dao') || raw.includes('atlantic') || raw.includes('district attorney')) {
        return {
            forumUrl: process.env.FORUM_DAO_URL || 'https://lsda.gta.world',
            username: process.env.FORUM_DAO_USERNAME,
            password: process.env.FORUM_DAO_PASSWORD,
            forumLabel: 'DAO',
        };
    }
    if (raw.includes('lssd') || raw.includes('sheriff') || raw.includes('lasd')) {
        return {
            forumUrl: process.env.FORUM_LSSD_URL || 'http://lssd.gta.world',
            username: process.env.FORUM_LSSD_USERNAME,
            password: process.env.FORUM_LSSD_PASSWORD,
            forumLabel: 'LSSD',
        };
    }
    // Default: LSPD
    return {
        forumUrl: process.env.FORUM_LSPD_URL || 'http://lspd.gta.world',
        username: process.env.FORUM_LSPD_USERNAME,
        password: process.env.FORUM_LSPD_PASSWORD,
        forumLabel: 'LSPD',
    };
}

/**
 * Handle auto-generated Coroner Email from a Report Requested flag.
 *
 * @param {object} report - { authorId, key, report: reportData, db }
 */
export async function handleCoronerEmail(report) {
    const { authorId, key, report: reportData, db } = report;
    logFnCall('deployCoronerEmail', 'handleCoronerEmail', 'Processing coroner email request', { key });

    // Respect maintenance mode — skip regardless of caller path
    if (await isMaintenanceMode().catch(() => false)) {
        console.log(`[CORONER-EMAIL] Maintenance mode — skipping ${key}`);
        return;
    }

    const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID, reportData.appBuild);
    if (report._progressMessageId) {
        await progress.resume(report._progressMessageId, report._progressChannelId || process.env.BOT_LOG_CHANNEL_ID, `Coroner Email — ${reportData.originalKey || key}`);
    } else {
        await progress.start(`Coroner Email — ${reportData.originalKey || key}`);
    }

    // ── Extract form data ──
    const data = reportData.data || {};
    let recipient = (data.requestingOfficer || data.requesting_officer || data.officerName || '').trim();
    const department = data.department || '';
    const coronerEmployee = data.coronerEmployee || 'PHMC Coroner';
    const additionalReports = data.additionalReports || [];

    if (!recipient) {
        console.log('[CORONER-EMAIL] No requesting officer — skipping');
        await progress.addStep('No Recipient', 'skip', 'requestingOfficer is empty');
        await progress.finalize('complete');
        return;
    }

    // ── Resolve forum ──
    const forum = resolveForum(department);
    if (!forum.username || !forum.password) {
        console.warn(`[CORONER-EMAIL] No credentials for ${forum.forumLabel} — skipping`);
        await progress.addStep('No Credentials', 'skip', `${forum.forumLabel} not configured`);
        await progress.finalize('complete');
        return;
    }

    // ── Load and fill template ──
    let templateStr;
    try {
        templateStr = readFileSync(resolve(__dirname, '../templates/Coroner-Email.json'), 'utf-8');
    } catch (e) {
        console.error('[CORONER-EMAIL] Failed to load template:', e.message);
        await progress.addStep('Template Error', 'fail', e.message);
        await progress.finalize('failed');
        return;
    }

    let template;
    try {
        template = JSON.parse(templateStr);
    } catch (e) {
        console.error('[CORONER-EMAIL] Failed to parse template JSON:', e.message);
        await progress.addStep('Template Error', 'fail', e.message);
        await progress.finalize('failed');
        return;
    }

    // Build subject line — use decedent name(s), not the coroner report's raw title
    let subject;
    if (reportData.formId === 'mass-ftality-test' && Array.isArray(data.decedents)) {
        // Mass fatality: list decedent names
        const names = data.decedents
            .map(d => d.decedentName || '')
            .filter(Boolean)
            .join(', ');
        subject = names ? `Coroner Report - ${names} (Mass Fatality)` : (reportData.originalKey || key);
    } else {
        const decName = data.decedentName || '';
        const decOOC = data.decedentOOC || '';
        subject = decName && decOOC
            ? `Coroner Report - ${decName} (( ${decOOC} ))`
            : decName
            ? `Coroner Report - ${decName}`
            : (reportData.originalKey || key);
    }

    // If no reports were attached (auto-generated from coroner report), fetch this report's BBCode
    let deathReport = buildDeathReport(additionalReports);
    if (!additionalReports || additionalReports.length === 0) {
        console.log('[CORONER-EMAIL] No attached reports — fetching own BBCode for deathReport');
        try {
            const bbSnap = await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value');
            if (bbSnap.exists()) {
                const ownBbCode = sanitizeBbCode(bbSnap.val()?.bbCode || '');
                const cleanTitle = (reportData.originalKey || key).replace(/[[\]]/g, '');
                deathReport = `[spoiler=${cleanTitle}]${ownBbCode}[/spoiler]`;
            }
        } catch (e) {
            console.warn('[CORONER-EMAIL] Could not fetch own BBCode:', e.message);
        }
        // Also try dev-reports-bbcode if not found in scheduledReportsBBCode
        if (deathReport === 'No attached reports.') {
            try {
                const devSnap = await db.ref(`dev-reports-bbcode/${authorId}/${key}`).once('value');
                if (devSnap.exists()) {
                    const devBbCode = sanitizeBbCode(devSnap.val()?.bbCode || '');
                    const cleanTitle = (reportData.originalKey || key).replace(/[[\]]/g, '');
                    deathReport = `[spoiler=${cleanTitle}]${devBbCode}[/spoiler]`;
                }
            } catch (e) {
                console.warn('[CORONER-EMAIL] Could not fetch dev BBCode:', e.message);
            }
        }
    }
    const values = {
        requestingOfficer: recipient,
        coronerEmployee,
        department,
        deathReport,
        formData: { department },
    };

    let bbCode;
    try {
        bbCode = fillEmailTemplate(template.bbcodeTemplate || template.template, values);
    } catch (e) {
        console.error('[CORONER-EMAIL] Template fill error:', e.message);
        await progress.addStep('Template Error', 'fail', e.message);
        await progress.finalize('failed');
        return;
    }

    // ── Log the rendered BBCode for validation ──
    console.log('[CORONER-EMAIL] Rendered BBCode preview (first 500 chars):');
    console.log(bbCode.substring(0, 500));
    try {
        const { writeFileSync, mkdirSync } = await import('fs');
        const debugDir = resolve(__dirname, '..', 'debug');
        mkdirSync(debugDir, { recursive: true });
        writeFileSync(resolve(debugDir, 'debug-coroner-email-bbcode.txt'), bbCode, 'utf-8');
        console.log('[CORONER-EMAIL] Full BBCode written to debug/debug-coroner-email-bbcode.txt');
    } catch (e) {
        console.warn('[CORONER-EMAIL] Could not write debug file:', e.message);
    }

    // ── Hand off to the dedicated email queue ──
    // The topic deploy owns the report record; from here email delivery state
    // lives on its own entity (own status, attempts, backoff). The worker
    // delivers; nothing here touches the forum or the report status.
    const topicUrl = report.topicUrl || null;
    const topicId = topicUrl ? ((topicUrl.match(/[?&]t=(\d+)/) || [])[1] || null) : null;
    const { enqueueCoronerEmail } = await import('./coronerEmailQueue.js');
    const emailKey = await enqueueCoronerEmail(db, {
        authorId, reportKey: key, topicId, topicUrl,
        recipient, department, forumLabel: forum.forumLabel,
        subject, bbCode,
    });
    if (emailKey) {
        await progress.addStep('Queued', 'ok', `Email queued (${forum.forumLabel} → ${recipient})`);
        await progress.finalize('complete');
    } else {
        await progress.addStep('Queued', 'fail', 'Could not queue email');
        await progress.finalize('failed');
    }
    return emailKey;
}

/**
 * Deliver one coroner email end-to-end (used by the queue worker).
 * Owns its progress embed; writes nothing to the report record (the worker
 * mirrors delivery results). Returns { ok, url?, reason?, sentTo?, dryRun? }.
 */
export async function deliverCoronerEmail({ recipient, subject, bbCode, department, progressTitle }) {
    let target = (recipient || '').trim();
    const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID);
    await progress.start(progressTitle || `Coroner Email — ${subject}`);
    if (!target) {
        await progress.addStep('No Recipient', 'fail', 'Empty recipient');
        await progress.finalize('failed');
        return { ok: false, reason: 'Empty recipient' };
    }

    const forum = resolveForum(department);
    if (!forum.username || !forum.password) {
        console.warn(`[CORONER-EMAIL] No credentials for ${forum.forumLabel} — skipping`);
        await progress.addStep('No Credentials', 'fail', `${forum.forumLabel} not configured`);
        await progress.finalize('failed');
        return { ok: false, reason: `${forum.forumLabel} not configured` };
    }

    // ── Login to forum (both dry-run and live need this) ──
    await progress.addStep(`Logging in (${forum.forumLabel})`, 'pending');
    console.log(`[CORONER-EMAIL] Logging into ${forum.forumLabel} (${forum.forumUrl})...`);
    const client = getForumClient();
    await client.login(forum.username, forum.password, { force: true, baseUrl: forum.forumUrl });
    await progress.addStep(`Logging in (${forum.forumLabel})`, 'ok');

    // ── Dry run: fill the form but don't submit ──
    if (CORONER_EMAIL_DRY_RUN) {
        await progress.addStep('Filling PM Form', 'pending', `To: ${target}`);
        console.log(`[CORONER-EMAIL] DRY RUN — filling PM form for "${target}" via ${forum.forumLabel}...`);
        const dryResult = await client.sendPM(target, subject, bbCode, { baseUrl: forum.forumUrl, dryRun: true });
        if (dryResult.ok) {
            console.log(`[CORONER-EMAIL] ✅ DRY RUN — form filled successfully for ${target} via ${forum.forumLabel}`);
            await progress.addStep('Filling PM Form', 'ok', `Form filled — not submitted`);
        } else {
            console.warn(`[CORONER-EMAIL] ⚠️ DRY RUN — form fill issue: ${dryResult.reason || 'Unknown'}`);
            await progress.addStep('Filling PM Form', 'fail', dryResult.reason || 'Form fill failed');
        }
        await progress.finalize('complete');
        try { client.close(); } catch (e) { /* ignore */ }
        return { ok: true, dryRun: true };
    }

    // Dual safety: even with DRY_RUN=false, check ALLOWED list
    if (CORONER_EMAIL_ALLOWED.length > 0 && !CORONER_EMAIL_ALLOWED.some(a => forum.forumUrl.includes(a))) {
        console.warn(`[CORONER-EMAIL] BLOCKED — ${forum.forumUrl} not in CORONER_EMAIL_ALLOWED`);
        await progress.addStep('Blocked', 'fail', `${forum.forumLabel} not in ALLOWED list`);
        await progress.finalize('failed');
        try { client.close(); } catch (e) { /* ignore */ }
        return { ok: false, reason: `${forum.forumLabel} not in ALLOWED list` };
    }

    // ── LIVE: Send the PM (with best-match self-heal) ──
    // Delivery state belongs to the queue entity (the worker updates it) —
    // nothing here writes the report record, so a failed email can never
    // disturb the already-deployed topic again.
    let sendTo = recipient;
    const attemptSend = async (to) => {
        console.log(`[CORONER-EMAIL] Sending PM to "${to}" via ${forum.forumLabel}...`);
        try {
            return await client.sendPM(to, subject, bbCode, { baseUrl: forum.forumUrl });
        } catch (err) {
            return { ok: false, reason: err.message, recipient: to, subject };
        }
    };
    const isRecipientFailure = (r) => !r.ok && /not found|not accepted|no recipient|did not stick/i.test(r.reason || '');

    await progress.addStep('Sending PM', 'pending', `To: ${sendTo}`);
    let result = await attemptSend(sendTo);

    // Self-heal: exact recipient rejected → fuzzy-match the closest forum
    // account and re-send once, narrating every step. Anything else (or a
    // second failure) returns the failure for the worker to schedule.
    if (isRecipientFailure(result)) {
        await progress.addStep('Sending PM', 'fail', `To: ${sendTo} — ${result.reason}`);
        await progress.addStep('Best Match', 'pending', `Checking forum for names like "${sendTo}"...`);
        console.log(`[CORONER-EMAIL] Recipient failed — fuzzy-matching "${sendTo}" on ${forum.forumLabel}...`);
        const match = await client.resolveMemberUserIdFuzzy(sendTo, { baseUrl: forum.forumUrl }).catch(() => null);
        if (match) {
            const pct = Math.round(match.score * 100);
            await progress.addStep('Best Match', 'ok', `${match.username} (${pct}% match) — re-sending`);
            console.log(`[CORONER-EMAIL] Best match: "${match.username}" (${pct}%) — re-sending PM...`);
            result = await attemptSend(match.username);
            if (result.ok) sendTo = match.username;
        } else {
            await progress.addStep('Best Match', 'fail', 'No close match — manual handling needed');
            console.warn(`[CORONER-EMAIL] No fuzzy match for "${sendTo}" — giving up`);
        }
    }

    if (result.ok) {
        await progress.addStep('Sending PM', 'ok', result.url || sendTo);
        await progress.finalize('complete');
        console.log(`[CORONER-EMAIL] ✅ PM sent to ${sendTo} via ${forum.forumLabel}: ${result.url || 'OK'}`);
    } else {
        console.error(`[CORONER-EMAIL] ❌ PM send failed to ${sendTo}: ${result.reason || 'Unknown'}`);
        await progress.addStep('Sending PM', 'fail', result.reason || 'Unknown');
        await progress.addStep('Retry Scheduled', 'warn', 'Worker will retry with backoff');
        await progress.finalize('failed');
    }
    try { client.close(); } catch (e) { /* ignore */ }
    return { ok: result.ok, url: result.url || null, reason: result.reason || null, sentTo: sendTo };
}