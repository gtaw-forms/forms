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
import { setDeployStatus, markReportComplete } from './deployStatus.js';
import { isMaintenanceMode } from './deployQueue.js';
import { requeueReport } from './deployRetry.js';

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

    const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID);
    if (report._progressMessageId) {
        await progress.resume(report._progressMessageId, report._progressChannelId || process.env.BOT_LOG_CHANNEL_ID, `Coroner Email — ${reportData.originalKey || key}`);
    } else {
        await progress.start(`Coroner Email — ${reportData.originalKey || key}`);
    }

    // ── Extract form data ──
    const data = reportData.data || {};
    const recipient = (data.requestingOfficer || data.requesting_officer || data.officerName || '').trim();
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
        const { writeFileSync } = await import('fs');
        writeFileSync(resolve(__dirname, '../debug-coroner-email-bbcode.txt'), bbCode, 'utf-8');
        console.log('[CORONER-EMAIL] Full BBCode written to debug-coroner-email-bbcode.txt');
    } catch (e) {
        console.warn('[CORONER-EMAIL] Could not write debug file:', e.message);
    }

    // ── Login to forum (both dry-run and live need this) ──
    await progress.addStep(`Logging in (${forum.forumLabel})`, 'pending');
    console.log(`[CORONER-EMAIL] Logging into ${forum.forumLabel} (${forum.forumUrl})...`);
    const client = getForumClient();
    await client.login(forum.username, forum.password, { force: true, baseUrl: forum.forumUrl });
    await progress.addStep(`Logging in (${forum.forumLabel})`, 'ok');

    // ── Dry run: fill the form but don't submit ──
    if (CORONER_EMAIL_DRY_RUN) {
        await progress.addStep('Filling PM Form', 'pending', `To: ${recipient}`);
        console.log(`[CORONER-EMAIL] DRY RUN — filling PM form for "${recipient}" via ${forum.forumLabel}...`);
        const dryResult = await client.sendPM(recipient, subject, bbCode, { baseUrl: forum.forumUrl, dryRun: true });
        if (dryResult.ok) {
            console.log(`[CORONER-EMAIL] ✅ DRY RUN — form filled successfully for ${recipient} via ${forum.forumLabel}`);
            await progress.addStep('Filling PM Form', 'ok', `Form filled — not submitted`);
        } else {
            console.warn(`[CORONER-EMAIL] ⚠️ DRY RUN — form fill issue: ${dryResult.reason || 'Unknown'}`);
            await progress.addStep('Filling PM Form', 'fail', dryResult.reason || 'Form fill failed');
        }
        await progress.finalize('complete');
        await setDeployStatus(db, authorId, key, 'dry_run',
            `Coroner Email dry run — form filled for ${recipient} via ${forum.forumLabel}. Not submitted.`
        );
        try { client.close(); } catch (e) { /* ignore */ }
        return;
    }

    // Dual safety: even with DRY_RUN=false, check ALLOWED list
    if (CORONER_EMAIL_ALLOWED.length > 0 && !CORONER_EMAIL_ALLOWED.some(a => forum.forumUrl.includes(a))) {
        console.warn(`[CORONER-EMAIL] BLOCKED — ${forum.forumUrl} not in CORONER_EMAIL_ALLOWED`);
        await progress.addStep('Blocked', 'fail', `${forum.forumLabel} not in ALLOWED list`);
        await progress.finalize('failed');
        await setDeployStatus(db, authorId, key, 'dry_run',
            `Blocked — ${forum.forumLabel} not in CORONER_EMAIL_ALLOWED list`
        );
        try { client.close(); } catch (e) { /* ignore */ }
        return;
    }

    // ── LIVE: Send the PM ──
    await progress.addStep('Sending PM', 'pending', `To: ${recipient}`);
    console.log(`[CORONER-EMAIL] Sending PM to "${recipient}" via ${forum.forumLabel}...`);
    const result = await client.sendPM(recipient, subject, bbCode, { baseUrl: forum.forumUrl });

    if (result.ok) {
        const label = reportData.originalKey || key;
        await progress.addStep('Sending PM', 'ok', result.url || recipient);
        await progress.finalize('complete');
        await markReportComplete(db, authorId, key, label, 'pm', result.url);
        console.log(`[CORONER-EMAIL] ✅ PM sent to ${recipient} via ${forum.forumLabel}: ${result.url || 'OK'}`);
    } else {
        console.error(`[CORONER-EMAIL] ❌ PM send failed to ${recipient}: ${result.reason || 'Unknown'}`);
        await requeueReport(db, authorId, key, 'PM send failed: ' + (result.reason || 'Unknown')).catch(err =>
            console.warn('[CORONER-EMAIL] Failed to requeue: ' + err.message)
        );
        await progress.addStep('Sending PM', 'fail', result.reason || 'Unknown');
        await progress.addStep('Retry Scheduled', 'warn', 'Will auto-retry on next cycle');
        await progress.finalize('failed');
    }
    try { client.close(); } catch (e) { /* ignore */ }
}