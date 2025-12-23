import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as functions from "firebase-functions";
import { db } from '../utils/firebase.js';
import { sendWebhook } from '../utils/helpers.js';

/**
 * Helper to process reports and aggregate statistics
 */
async function aggregateCoronerStats(startOfMonth, endOfMonth) {
    const reportsPaths = ['newSavedReports', 'savedReports'];
    let totalDeathReports = 0;
    const stats = {
        mannerOfDeath: {},
        placeOfDeath: {},
        coronerRank: {},
        topCoroners: {},
        departments: {}
    };

    for (const path of reportsPaths) {
        const reportsRef = db.ref(path);
        const snapshot = await reportsRef.once('value');

        if (!snapshot.exists()) continue;

        const allUsersReports = snapshot.val();

        for (const userId in allUsersReports) {
            const userReports = allUsersReports[userId];
            if (!userReports || typeof userReports !== 'object') continue;

            for (const reportId in userReports) {
                const report = userReports[reportId];
                
                // Filter by Date
                if (!report.timestamp || report.timestamp < startOfMonth || report.timestamp > endOfMonth) {
                    continue;
                }

                // Check for Death Report (Coroner Report)
                // Use formId if available, or fall back to mannerOfDeath field existence
                const formId = report.formId || report.data?.formId;
                const data = report.data || report; // Handle both old and new structures

                if (formId !== 'coroner-report' && !data.mannerOfDeath) {
                    continue; 
                }

                totalDeathReports++;

                // Aggregate Manner of Death
                const manner = data.mannerOfDeath || 'Undetermined';
                stats.mannerOfDeath[manner] = (stats.mannerOfDeath[manner] || 0) + 1;

                // Aggregate Place of Death
                const place = data.placeOfDeath || 'Unknown';
                stats.placeOfDeath[place] = (stats.placeOfDeath[place] || 0) + 1;

                // Aggregate Coroner Rank
                const rank = data.coronerRank || 'Unknown';
                stats.coronerRank[rank] = (stats.coronerRank[rank] || 0) + 1;

                // Aggregate Top Coroners
                const coroner = report.coronerEmployee || report.authorName || 'Unknown';
                stats.topCoroners[coroner] = (stats.topCoroners[coroner] || 0) + 1;

                // Aggregate Departments
                const dept = data.department || 'Unknown';
                stats.departments[dept] = (stats.departments[dept] || 0) + 1;
            }
        }
    }

    // Sort stats
    const sortObj = (obj) => Object.entries(obj)
        .sort(([,a], [,b]) => b - a)
        .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});
    
    return {
        totalReports: totalDeathReports,
        stats: {
            mannerOfDeath: sortObj(stats.mannerOfDeath),
            placeOfDeath: sortObj(stats.placeOfDeath),
            coronerRank: sortObj(stats.coronerRank),
            topCoroners: sortObj(stats.topCoroners),
            departments: sortObj(stats.departments)
        }
    };
}

export const generateMonthlyCoronerReport = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Monthly Coroner Report] Manually generating report...');

    const { month, year } = request.data || {};
    
    let targetDate = new Date();
    if (month !== undefined && year !== undefined) {
        targetDate = new Date(year, month, 1);
    } else {
        targetDate.setMonth(targetDate.getMonth() - 1); // Previous month
        targetDate.setDate(1);
    }
    
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1).getTime();
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    try {
        const reportData = await aggregateCoronerStats(startOfMonth, endOfMonth);
        
        return {
            success: true,
            data: {
                ...reportData,
                period: { 
                    start: startOfMonth, 
                    end: endOfMonth,
                    monthName: targetDate.toLocaleString('default', { month: 'long' }),
                    year: targetDate.getFullYear()
                }
            },
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[Monthly Coroner Report] Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Scheduled task to run on the 1st of every month
 * TESTING: Changed from '1 of month 10:00' to 'every hour' for verification.
 * TO RESTORE: Change schedule back to '1 of month 10:00'
 */
export const monthlyCoronerSummary = onSchedule({
    schedule: "every hour",
    timeZone: "UTC",
    secrets: ["ADMIN_ACTION_WEBHOOK_URL"],
}, async (event) => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - 1); // Previous month
    
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1).getTime();
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    const monthName = targetDate.toLocaleString('default', { month: 'long' });
    const year = targetDate.getFullYear();

    console.log(`[Monthly Summary] Generating summary for ${monthName} ${year}`);

    try {
        const reportData = await aggregateCoronerStats(startOfMonth, endOfMonth);
        
        if (reportData.totalReports === 0) {
            console.log('[Monthly Summary] No reports found for this period.');
            return null;
        }

        const topManners = Object.entries(reportData.stats.mannerOfDeath).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join('\n');
        const topAreas = Object.entries(reportData.stats.placeOfDeath).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join('\n');
        const topCoroners = Object.entries(reportData.stats.topCoroners).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join('\n');

        const embed = {
            title: `📊 Monthly Coroner Report: ${monthName} ${year}`,
            color: 0x9B59B6, // Purple
            fields: [
                { name: "📋 Total Reports", value: `**${reportData.totalReports}** death investigations filed.`, inline: false },
                { name: "💀 Manners of Death (Top 5)", value: topManners || 'None', inline: true },
                { name: "📍 Top Regions (Top 5)", value: topAreas || 'None', inline: true },
                { name: "👨‍⚕️ Top Coroners (Top 5)", value: topCoroners || 'None', inline: false },
            ],
            footer: { text: "PHMC Tools - Automated Monthly Historical Report" },
            timestamp: new Date().toISOString()
        };

        await sendWebhook({ embeds: [embed] });
        console.log('[Monthly Summary] Webhook sent successfully.');

    } catch (error) {
        console.error('[Monthly Summary] Error:', error);
    }

    return null;
});