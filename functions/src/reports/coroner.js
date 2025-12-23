import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as functions from "firebase-functions";
import { getFunctions } from 'firebase-admin/functions';
import { db } from '../utils/firebase.js';
import { sendWebhook } from '../utils/helpers.js';
import { gtaLocations } from '../utils/gtaLocations.js';

// --- Pre-process locations for efficient searching ---
const streetToAreaMap = new Map();
const allAreas = new Set();
const allStreets = new Set();

[...gtaLocations.los_santos_city, ...gtaLocations.blaine_county].forEach(region => {
    const areaLower = region.area.toLowerCase();
    allAreas.add(areaLower);
    region.streets.forEach(street => {
        const streetLower = street.toLowerCase();
        allStreets.add(streetLower);
        streetToAreaMap.set(streetLower, areaLower);
    });
});

gtaLocations.major_highways.forEach(highway => {
    const highwayLower = highway.toLowerCase();
    allStreets.add(highwayLower);
    streetToAreaMap.set(highwayLower, 'highway');
});
allAreas.add('highway');

function matchLocation(place) {
    if (!place || typeof place !== 'string') {
        return { area: 'Unknown', street: null, confidence: 0 };
    }

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

    return { area: place, street: null, confidence: 0 };
}

/**
 * Helper to process reports and aggregate statistics
 */
async function aggregateCoronerStats(startOfMonth, endOfMonth) {
    const reportsPaths = ['newSavedReports', 'savedReports'];
    let totalDeathReports = 0;
    const untrackedReportQueue = new Set();
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
                if (!report.timestamp || report.timestamp < startOfMonth || report.timestamp > endOfMonth) continue;

                const formId = report.formId || report.data?.formId;
                const data = report.data || report;
                if (formId !== 'coroner-report' && !data.mannerOfDeath) continue;

                totalDeathReports++;

                const manner = data.mannerOfDeath || 'Undetermined';
                stats.mannerOfDeath[manner] = (stats.mannerOfDeath[manner] || 0) + 1;

                const placeInput = data.placeOfDeath || 'Unknown';
                const matched = matchLocation(placeInput);

                if (matched.confidence === 0 && placeInput !== 'Unknown') {
                    untrackedReportQueue.add(placeInput);
                }

                if (!stats.placeOfDeath[matched.area]) {
                    stats.placeOfDeath[matched.area] = { total: 0, streets: {} };
                }
                stats.placeOfDeath[matched.area].total++;

                const streetToCount = matched.street || `(Unmatched) ${placeInput}`;
                stats.placeOfDeath[matched.area].streets[streetToCount] = (stats.placeOfDeath[matched.area].streets[streetToCount] || 0) + 1;

                const rank = data.coronerRank || 'Unknown';
                stats.coronerRank[rank] = (stats.coronerRank[rank] || 0) + 1;

                const coroner = data.coronerEmployee || report.authorName || 'Unknown';
                stats.topCoroners[coroner] = (stats.topCoroners[coroner] || 0) + 1;

                const dept = data.department || 'Unknown';
                stats.departments[dept] = (stats.departments[dept] || 0) + 1;
            }
        }
    }

    if (untrackedReportQueue.size > 0) {
        console.log(`[Untracked Location] Found ${untrackedReportQueue.size} unique untracked locations to report.`);
        try {
            const taskQueue = getFunctions().taskQueue("reportuntrackedlocation");
            const promises = [];
            untrackedReportQueue.forEach(place => {
                promises.push(taskQueue.enqueue({ data: { place } }));
            });
            await Promise.all(promises);
            console.log("[Untracked Location] Successfully enqueued untracked location reports.");
        } catch (error) {
             console.error("[Untracked Location] Error enqueuing tasks:", error);
        }
    }

    const sortObj = (obj) => Object.entries(obj).sort(([, a], [, b]) => b - a).reduce((r, [k, v]) => ({ ...r, [k]: v }), {});
    
    return {
        totalReports: totalDeathReports,
        stats: {
            mannerOfDeath: sortObj(stats.mannerOfDeath),
            placeOfDeath: stats.placeOfDeath,
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

export const monthlyCoronerSummary = onSchedule({
    schedule: "every hour",
    timeZone: "UTC",
    secrets: ["ADMIN_ACTION_WEBHOOK_URL"],
}, async (event) => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - 1);
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
        const topAreasData = Object.entries(reportData.stats.placeOfDeath).sort(([, a], [, b]) => b.total - a.total).slice(0, 5);
        let topAreasDescription = topAreasData.map(([area, data]) => {
            const topStreets = Object.entries(data.streets).sort(([, a], [, b]) => b - a).slice(0, 3).map(([street, count]) => `  - ${street} (${count})`).join('\n');
            let areaText = `**${area.charAt(0).toUpperCase() + area.slice(1)}** (${data.total} total)`;
            if (topStreets) areaText += `\n${topStreets}`;
            return areaText;
        }).join('\n\n') || 'None';

        const topCoroners = Object.entries(reportData.stats.topCoroners).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join('\n');

        const embed = {
            title: `📊 Monthly Coroner Report: ${monthName} ${year}`,
            color: 0x9B59B6,
            fields: [
                { name: "📋 Total Reports", value: `**${reportData.totalReports}** death investigations filed.`, inline: false },
                { name: "💀 Manners of Death (Top 5)", value: topManners || 'None', inline: true },
                { name: "👨‍⚕️ Top Coroners (Top 5)", value: topCoroners || 'None', inline: true },
                { name: "📍 Top Regions & Streets (Top 5)", value: topAreasDescription, inline: false },
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
