import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as functions from "firebase-functions";
import { getFunctions } from 'firebase-admin/functions';
import { db } from '../utils/firebase.js';
import { sendWebhook } from '../utils/helpers.js';
import { processUntrackedLocation } from '../utils/locationReporting.js';

async function getProcessedLocations() {
    try {
        const snapshot = await db.ref('locationData').once('value');
        const locations = snapshot.val();
        
        const streetToAreaMap = new Map();
        const allAreas = new Set();
        const allStreets = new Set();

        if (!locations) {
            console.warn("[Location Match] No locationData found in database. Using empty defaults.");
            return { streetToAreaMap, allAreas, allStreets };
        }

        // Renamed blaine_county to los_santos_county for unity
        const regions = [...(locations.los_santos_city || []), ...(locations.los_santos_county || [])];
        
        regions.forEach(region => {
            const areaLower = region.area.toLowerCase();
            allAreas.add(areaLower);
            region.streets.forEach(street => {
                const streetLower = street.toLowerCase();
                allStreets.add(streetLower);
                streetToAreaMap.set(streetLower, areaLower);
            });
        });

        (locations.major_highways || []).forEach(highway => {
            const highwayLower = highway.toLowerCase();
            allStreets.add(highwayLower);
            streetToAreaMap.set(highwayLower, 'highway');
        });
        allAreas.add('highway');

        return { streetToAreaMap, allAreas, allStreets };
    } catch (error) {
        console.error("[Location Match] Error fetching location data:", error);
        return { streetToAreaMap: new Map(), allAreas: new Set(), allStreets: new Set() };
    }
}

async function matchLocation(place, processedLocations, reportKey = null) {
    if (!place || typeof place !== 'string') {
        return { area: 'Unknown', street: null, confidence: 0 };
    }

    const { streetToAreaMap, allAreas, allStreets } = processedLocations;
    const cleanedPlace = place.toLowerCase().trim();
    const candidates = [];

    allStreets.forEach(street => {
        if (cleanedPlace.includes(street)) {
            candidates.push({ type: 'street', name: street, area: streetToAreaMap.get(street) });
        }
    });
    allAreas.forEach(area => {
        if (cleanedPlace.includes(area)) {
            candidates.push({ type: 'area', name: area, area: area });
        }
    });

    if (candidates.length === 0) {
        console.log(`[Location Match] No candidates found for '${place}'.`);
        await processUntrackedLocation(place, null, null, reportKey);
        return { area: place, street: null, confidence: 0 };
    }

    let bestCandidate = null;
    let highestScore = -1;

    candidates.forEach(candidate => {
        let score = 0;
        if (candidate.type === 'street') {
            score = 50 + candidate.name.length;
            if (cleanedPlace.includes(candidate.area)) {
                score += 40;
            }
        } else {
            score = 40 + candidate.name.length;
        }

        if (score > highestScore) {
            highestScore = score;
            bestCandidate = candidate;
        }
    });

    const confidence = Math.min(Math.round(highestScore), 100);

    if (bestCandidate && confidence > 40) { // Confidence threshold
        const result = {
            area: bestCandidate.area,
            street: bestCandidate.type === 'street' ? bestCandidate.name : null,
            confidence: confidence
        };
        console.log(`[Location Match] For '${place}', best match is Area: '${result.area}' (Street: ${result.street || 'N/A'}) with score ${highestScore}.`);
        return result;
    }

    // Reported if low confidence
    await processUntrackedLocation(place, bestCandidate?.type === 'street' ? bestCandidate.name : null, bestCandidate?.area, reportKey);
    return { area: place, street: null, confidence: 0 };
}


async function aggregateCoronerStats(startOfMonth, endOfMonth) {
    const reportsPaths = ['newSavedReports', 'savedReports'];
    
    const agencyDataStore = (await db.ref('/agencies').once('value')).val() || {};
    const processedLocations = await getProcessedLocations();

    const stats = {
        coronerReports: { total: 0, mannerOfDeath: {}, placeOfDeath: {}, topCoroners: {} },
        coronerEmails: { total: 0, departments: {} },
        massFatalities: { total: 0, locations: {}, totalDecedents: 0, reports: [] }
    };

    for (const path of reportsPaths) {
        const reportsRef = db.ref(path);
        const snapshot = await reportsRef.once('value');
        if (!snapshot.exists()) continue;

        const allUsersReports = snapshot.val();
        for (const userId in allUsersReports) {
            // Only process 'CIVILIAN' reports from the legacy savedReports path
            if (path === 'savedReports' && userId !== 'CIVILIAN') continue;

            const userReports = allUsersReports[userId];
            if (!userReports || typeof userReports !== 'object') continue;

            for (const reportId in userReports) {
                const report = userReports[reportId];
                if (!report.timestamp || report.timestamp < startOfMonth || report.timestamp > endOfMonth) continue;

                const formId = report.formId || report.data?.formId;
                const data = report.data || report;

                let reportType = 'unknown';
                if (formId === 'coroner-report' || (!formId && data.mannerOfDeath)) {
                    reportType = 'coroner-report';
                } else if (formId === 'coroner_email') {
                    reportType = 'coroner_email';
                } else if (formId === 'mass-ftality-test') {
                    reportType = 'mass-fatality';
                }

                switch (reportType) {
                    case 'coroner-report':
                        stats.coronerReports.total++;
                        const manner = data.mannerOfDeath || 'Undetermined';
                        stats.coronerReports.mannerOfDeath[manner] = (stats.coronerReports.mannerOfDeath[manner] || 0) + 1;
                        const placeInput = data.placeOfDeath || 'Unknown';
                        const matched = await matchLocation(placeInput, processedLocations, reportId);
                        if (!stats.coronerReports.placeOfDeath[matched.area]) {
                            stats.coronerReports.placeOfDeath[matched.area] = { total: 0, streets: {} };
                        }
                        stats.coronerReports.placeOfDeath[matched.area].total++;
                        if (matched.street) {
                            stats.coronerReports.placeOfDeath[matched.area].streets[matched.street] = (stats.coronerReports.placeOfDeath[matched.area].streets[matched.street] || 0) + 1;
                        }
                        const coroner = data.coronerEmployee || report.authorName || 'Unknown';
                        stats.coronerReports.topCoroners[coroner] = (stats.coronerReports.topCoroners[coroner] || 0) + 1;
                        break;

                    case 'coroner_email':
                        stats.coronerEmails.total++;
                        const deptValue = (typeof data.department === 'object' && data.department !== null) ? data.department.value : data.department;
                        const dept = deptValue || 'Unknown';
                        if (!stats.coronerEmails.departments[dept]) {
                            stats.coronerEmails.departments[dept] = { count: 0, url: null };
                        }
                        stats.coronerEmails.departments[dept].count++;
                        const agency = Object.values(agencyDataStore).find(a => a.fullName === dept);
                        if (agency && agency.url) {
                            stats.coronerEmails.departments[dept].url = agency.url;
                        }
                        break;
                    
                    case 'mass-fatality':
                        stats.massFatalities.total++;
                        const location = data.location || report.originalKey || 'Unknown Location';
                        stats.massFatalities.locations[location] = (stats.massFatalities.locations[location] || 0) + 1;

                        let decedentCount = 0;
                        if (data.decedentCount) {
                            decedentCount = Number(data.decedentCount);
                        } else if (report.originalKey) {
                            const match = report.originalKey.match(/\(x(\d+)\)/);
                            if (match && match[1]) {
                               decedentCount = Number(match[1]);
                            }
                        }
                        stats.massFatalities.totalDecedents += decedentCount;
                        
                        stats.massFatalities.reports.push({
                            key: reportId,
                            originalKey: report.originalKey || 'Untitled', // Use originalKey for URL
                            title: report.originalKey || 'Untitled',
                            decedents: decedentCount,
                            author: userId
                        });
                        break;
                }
            }
        }
    }
    
    return stats;
}


export const generateMonthlyCoronerReport = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[MonthlyCoroner Report] Manually generating report...');
    const { month, year } = request.data || {};
    let targetDate = new Date();
    if (month !== undefined && year !== undefined) {
        targetDate = new Date(year, month, 1);
    } else {
        targetDate.setMonth(targetDate.getMonth() - 1);
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
        console.error('[MonthlyCoroner Report] Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

export const weeklyCoronerSummary = onSchedule({
    schedule: "every monday 09:00",
    timeZone: "UTC",
    secrets: ["ADMIN_ACTION_WEBHOOK_URL", "DISCORD_WEBHOOK_FUNCTIONS"],
}, async (event) => {
    const now = new Date();
    const endOfWeek = now.getTime();
    const startOfWeek = endOfWeek - (7 * 24 * 60 * 60 * 1000); // Last 7 days

    console.log(`[Weekly Summary] Generating summary for the past week.`);

    try {
        const fullStats = await aggregateCoronerStats(startOfWeek, endOfWeek);
        const { coronerReports, coronerEmails, massFatalities } = fullStats;

        if (coronerReports.total === 0 && coronerEmails.total === 0 && massFatalities.total === 0) {
            console.log('[Weekly Summary] No coroner activity found for this period.');
            return null;
        }

        let coronerReportSummary = `**${coronerReports.total}** death investigations filed.`;
        if (coronerReports.total > 0) {
            const topAreasData = Object.entries(coronerReports.placeOfDeath).sort(([, a], [, b]) => b.total - a.total).slice(0, 3);
            let topAreasDescription = topAreasData.map(([area, data]) => {
                const topStreets = Object.entries(data.streets).sort(([, a], [, b]) => b - a).slice(0, 2).map(([street, count]) => `${street} (${count})`).join(', ');
                return `**${area}** (${data.total}) - _Top Streets: ${topStreets || 'N/A'}_`;
            }).join('\n');
            if (topAreasDescription) {
                coronerReportSummary += `\n**Top Regions**:\n${topAreasDescription}`;
            }
        }

        const topCoroners = Object.entries(coronerReports.topCoroners).sort(([, a], [, b]) => b - a).slice(0, 3).map(([name, count]) => `${name} (${count})`).join(', ');
        if (topCoroners) {
            coronerReportSummary += `\n**Top Coroners**: ${topCoroners}`;
        }

        let emailSummary = `**${coronerEmails.total}** emails sent.`;
        if (coronerEmails.total > 0) {
            const topDepts = Object.entries(coronerEmails.departments).sort(([, a], [, b]) => b.count - a.count).slice(0, 3).map(([dept, data]) => {
                if (data.url) {
                    return `[${dept}](${data.url}) (${data.count})`;
                }
                return `${dept} (${data.count})`;
            }).join(', ');
            emailSummary += `\n**Top Departments**: ${topDepts}`;
        }

        let massFatalitySummary = `**${massFatalities.total}** events, **${massFatalities.totalDecedents}** total decedents.`;
        if (massFatalities.total > 0) {
            const reportLinks = massFatalities.reports.slice(0, 5).map(r => {
                const safeOriginalKey = encodeURIComponent(r.originalKey.replace(/\//g, '_'));
                const reportUrl = `https://phmc-tools.gta.world/#/view-report/${r.author}/${safeOriginalKey}`;
                return `[${r.title || 'View Report'}](${reportUrl}) (${r.decedents} decedents)`;
            }).join('\n');
            massFatalitySummary += `\n**Recent Events**:\n${reportLinks}`;
        }

        const embed = {
            title: `📊 Weekly Coroner's Office Summary`,
            color: 0x9B59B6,
            fields: [
                { name: "__Coroner Reports__", value: coronerReportSummary, inline: false },
                { name: "__Coroner Emails__", value: emailSummary, inline: false },
                { name: "__Mass Fatality Reports__", value: massFatalitySummary, inline: false }
            ],
            footer: { text: "PHMC Tools - Automated Weekly Historical Report" },
            timestamp: new Date().toISOString()
        };

        await sendWebhook({ embeds: [embed] });
        console.log('[Weekly Summary] Webhook sent successfully.');

    } catch (error) {
        console.error('[Weekly Summary] Error:', error);
    }
    return null;
});

export const yearlyCoronerSummary = onSchedule({
    schedule: "5 0 1 1 *", // January 1st at 00:05
    timeZone: "UTC",
    secrets: ["ADMIN_ACTION_WEBHOOK_URL", "DISCORD_WEBHOOK_FUNCTIONS"],
}, async (event) => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
    const endOfYear = now.getTime();
    const year = now.getFullYear();

    console.log(`[Yearly Summary] Generating summary for the year ${year}`);

    try {
        const fullStats = await aggregateCoronerStats(startOfYear, endOfYear);
        const { coronerReports, coronerEmails, massFatalities } = fullStats;

        if (coronerReports.total === 0 && coronerEmails.total === 0 && massFatalities.total === 0) {
            console.log('[Yearly Summary] No coroner activity found for this period.');
            return null;
        }

        let coronerReportSummary = `**${coronerReports.total}** death investigations filed this year.`;
        if (coronerReports.total > 0) {
            const topAreasData = Object.entries(coronerReports.placeOfDeath).sort(([, a], [, b]) => b.total - a.total).slice(0, 5);
            let topAreasDescription = topAreasData.map(([area, data]) => {
                const topStreets = Object.entries(data.streets).sort(([, a], [, b]) => b - a).slice(0, 3).map(([street, count]) => `${street} (${count})`).join(', ');
                return `**${area}** (${data.total}) - _Top Streets: ${topStreets || 'N/A'}_`;
            }).join('\n');
            if (topAreasDescription) {
                coronerReportSummary += `\n**Top Regions (Annual)**:\n${topAreasDescription}`;
            }
        }

        const topCoroners = Object.entries(coronerReports.topCoroners).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, count]) => `${name} (${count})`).join(', ');
        if (topCoroners) {
            coronerReportSummary += `\n**Top Coroners of ${year}**: ${topCoroners}`;
        }

        let emailSummary = `**${coronerEmails.total}** emails sent.`;
        if (coronerEmails.total > 0) {
            const topDepts = Object.entries(coronerEmails.departments).sort(([, a], [, b]) => b.count - a.count).slice(0, 5).map(([dept, data]) => {
                return `${dept} (${data.count})`;
            }).join(', ');
            emailSummary += `\n**Top Departments**: ${topDepts}`;
        }

        let massFatalitySummary = `**${massFatalities.total}** events, **${massFatalities.totalDecedents}** total decedents.`;

        const embed = {
            title: `🗓️ Yearly Coroner's Office Summary: ${year}`,
            description: "Annual performance and statistics overview.",
            color: 0xE67E22, // Orange
            fields: [
                { name: "__Annual Coroner Reports__", value: coronerReportSummary, inline: false },
                { name: "__Annual Coroner Emails__", value: emailSummary, inline: false },
                { name: "__Annual Mass Fatality Stats__", value: massFatalitySummary, inline: false }
            ],
            footer: { text: "PHMC Tools - Automated Yearly Historical Report" },
            timestamp: new Date().toISOString()
        };

        await sendWebhook({ embeds: [embed] });
        console.log('[Yearly Summary] Webhook sent successfully.');

    } catch (error) {
        console.error('[Yearly Summary] Error:', error);
    }
    return null;
});

/**
 * Manually trigger a coroner report summary to be sent to the webhook.
 */
export const triggerCoronerReport = onCall({
    secrets: ["ADMIN_ACTION_WEBHOOK_URL", "DISCORD_WEBHOOK_FUNCTIONS"],
}, async (request) => {
    const { type } = request.data;
    const now = new Date();
    let startTime, endTime, title, periodLabel, color;

    switch (type) {
        case 'weekly':
            endTime = now.getTime();
            startTime = endTime - (7 * 24 * 60 * 60 * 1000);
            title = "📊 Weekly Coroner's Office Summary (Manual)";
            periodLabel = "Past 7 Days";
            color = 0x9B59B6;
            break;
        case 'monthly':
            const targetDate = new Date();
            targetDate.setMonth(targetDate.getMonth() - 1);
            startTime = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1).getTime();
            endTime = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
            const monthName = targetDate.toLocaleString('default', { month: 'long' });
            title = `📊 Monthly Coroner's Office Summary: ${monthName} ${targetDate.getFullYear()} (Manual)`;
            periodLabel = `${monthName} ${targetDate.getFullYear()}`;
            color = 0x9B59B6;
            break;
        case 'yearly':
            startTime = new Date(now.getFullYear(), 0, 1).getTime();
            endTime = now.getTime();
            title = `🗓️ Yearly Coroner's Office Summary: ${now.getFullYear()} (Manual)`;
            periodLabel = `Year ${now.getFullYear()}`;
            color = 0xE67E22;
            break;
        default:
            return { success: false, message: "Invalid report type." };
    }

    try {
        const fullStats = await aggregateCoronerStats(startTime, endTime);
        const { coronerReports, coronerEmails, massFatalities } = fullStats;

        if (coronerReports.total === 0 && coronerEmails.total === 0 && massFatalities.total === 0) {
            return { success: false, message: "No activity found for this period." };
        }

        let coronerReportSummary = `**${coronerReports.total}** death investigations filed.`;
        if (coronerReports.total > 0) {
            const topAreasData = Object.entries(coronerReports.placeOfDeath).sort(([, a], [, b]) => b.total - a.total).slice(0, 3);
            let topAreasDescription = topAreasData.map(([area, data]) => {
                const topStreets = Object.entries(data.streets).sort(([, a], [, b]) => b - a).slice(0, 2).map(([street, count]) => `${street} (${count})`).join(', ');
                return `**${area}** (${data.total}) - _Top Streets: ${topStreets || 'N/A'}_`;
            }).join('\n');
            if (topAreasDescription) {
                coronerReportSummary += `\n**Top Regions**:\n${topAreasDescription}`;
            }
        }

        const topCoroners = Object.entries(coronerReports.topCoroners).sort(([, a], [, b]) => b - a).slice(0, 3).map(([name, count]) => `${name} (${count})`).join(', ');
        if (topCoroners) {
            coronerReportSummary += `\n**Top Coroners**: ${topCoroners}`;
        }

        let emailSummary = `**${coronerEmails.total}** emails sent.`;
        if (coronerEmails.total > 0) {
            const topDepts = Object.entries(coronerEmails.departments).sort(([, a], [, b]) => b.count - a.count).slice(0, 3).map(([dept, data]) => {
                return `${dept} (${data.count})`;
            }).join(', ');
            emailSummary += `\n**Top Departments**: ${topDepts}`;
        }

        let massFatalitySummary = `**${massFatalities.total}** events, **${massFatalities.totalDecedents}** total decedents.`;
        if (type !== 'yearly' && massFatalities.total > 0) {
             const reportLinks = massFatalities.reports.slice(0, 5).map(r => {
                const safeOriginalKey = encodeURIComponent(r.originalKey.replace(/\//g, '_'));
                const reportUrl = `https://phmc-tools.gta.world/#/view-report/${r.author}/${safeOriginalKey}`;
                return `[${r.title || 'View Report'}](${reportUrl}) (${r.decedents} decedents)`;
            }).join('\n');
            massFatalitySummary += `\n**Recent Events**:\n${reportLinks}`;
        }

        const embed = {
            title: title,
            description: `Manual trigger requested for ${periodLabel}.`,
            color: color,
            fields: [
                { name: "__Coroner Reports__", value: coronerReportSummary, inline: false },
                { name: "__Coroner Emails__", value: emailSummary, inline: false },
                { name: "__Mass Fatality Reports__", value: massFatalitySummary, inline: false }
            ],
            footer: { text: "PHMC Tools - Manual Report Trigger" },
            timestamp: new Date().toISOString()
        };

        const result = await sendWebhook({ embeds: [embed] });
        return { success: result, message: result ? "Webhook sent successfully." : "Failed to send webhook." };

    } catch (error) {
        console.error('[Manual Trigger] Error:', error);
        return { success: false, message: error.message };
    }
});

/**
 * Scans reports from the last 30 days to identify untracked locations.
 */
export const scanUntrackedLocations = onCall({
    secrets: ["ADMIN_ACTION_WEBHOOK_URL", "DISCORD_WEBHOOK_FUNCTIONS"],
}, async (request) => {
    const now = Date.now();
    const SixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);

    console.log('[Scan Untracked] Starting manual scan of reports from the last 60 days...');

    try {
        // aggregateCoronerStats internally calls matchLocation -> processUntrackedLocation
        await aggregateCoronerStats(SixtyDaysAgo, now);
        return { success: true, message: "Scan complete. Any new locations found have been added to the list." };
    } catch (error) {
        console.error('[Scan Untracked] Error:', error);
        return { success: false, message: error.message };
    }
});

export const monthlyCoronerSummary = onSchedule({
    schedule: "1 0 1 * *",
    timeZone: "UTC",
    secrets: ["ADMIN_ACTION_WEBHOOK_URL", "DISCORD_WEBHOOK_FUNCTIONS"],
}, async (event) => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - 1);
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1).getTime();
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    const monthName = targetDate.toLocaleString('default', { month: 'long' });
    const year = targetDate.getFullYear();

    console.log(`[Monthly Summary] Generating summary for ${monthName} ${year}`);

    try {
        const fullStats = await aggregateCoronerStats(startOfMonth, endOfMonth);
        
        const { coronerReports, coronerEmails, massFatalities } = fullStats;

        if (coronerReports.total === 0 && coronerEmails.total === 0 && massFatalities.total === 0) {
            console.log('[Monthly Summary] No coroner activity found for this period.');
            return null;
        }
        
        let coronerReportSummary = `**${coronerReports.total}** death investigations filed.`;
        if (coronerReports.total > 0) {
            const topAreasData = Object.entries(coronerReports.placeOfDeath).sort(([, a], [, b]) => b.total - a.total).slice(0, 3);
            let topAreasDescription = topAreasData.map(([area, data]) => {
                const topStreets = Object.entries(data.streets).sort(([, a], [, b]) => b - a).slice(0, 2).map(([street, count]) => `${street} (${count})`).join(', ');
                return `**${area}** (${data.total}) - _Top Streets: ${topStreets || 'N/A'}_`;
            }).join('\n');
            if (topAreasDescription) {
                coronerReportSummary += `\n**Top Regions**:\n${topAreasDescription}`;
            }
        }

        const topCoroners = Object.entries(coronerReports.topCoroners).sort(([, a], [, b]) => b - a).slice(0, 3).map(([name, count]) => `${name} (${count})`).join(', ');
        if (topCoroners) {
            coronerReportSummary += `\n**Top Coroners**: ${topCoroners}`;
        }

        let emailSummary = `**${coronerEmails.total}** emails sent.`;
        if (coronerEmails.total > 0) {
            const topDepts = Object.entries(coronerEmails.departments).sort(([, a], [, b]) => b.count - a.count).slice(0, 3).map(([dept, data]) => {
                if (data.url) {
                    return `[${dept}](${data.url}) (${data.count})`;
                }
                return `${dept} (${data.count})`;
            }).join(', ');
            emailSummary += `\n**Top Departments**: ${topDepts}`;
        }

        let massFatalitySummary = `**${massFatalities.total}** events, **${massFatalities.totalDecedents}** total decedents.`;
        if (massFatalities.total > 0) {
            const reportLinks = massFatalities.reports.slice(0, 5).map(r => {
                const safeOriginalKey = encodeURIComponent(r.originalKey.replace(/\//g, '_'));
                const reportUrl = `https://phmc-tools.gta.world/#/view-report/${r.author}/${safeOriginalKey}`;
                console.log(safeOriginalKey);
                return `[${r.title || 'View Report'}](${reportUrl}) (${r.decedents} decedents)`;
                
            }).join('\n');
            massFatalitySummary += `\n**Recent Events**:\n${reportLinks}`;
        }

        const embed = {
            title: `📊 Monthly Coroner's Office Summary: ${monthName} ${year}`,
            color: 0x9B59B6,
            fields: [
                { name: "__Coroner Reports__", value: coronerReportSummary, inline: false },
                { name: "__Coroner Emails__", value: emailSummary, inline: false },
                { name: "__Mass Fatality Reports__", value: massFatalitySummary, inline: false }
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
