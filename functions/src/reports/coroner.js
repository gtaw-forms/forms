import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as functions from "firebase-functions";
import { getFunctions } from 'firebase-admin/functions';
import { db } from '../utils/firebase.js';
import { sendWebhook, sendWebhookWithFile } from '../utils/helpers.js';
import { processUntrackedLocation } from '../utils/locationReporting.js';

async function getProcessedLocations() {
    try {
        // Fetch both legacy locationData and new verified_locations
        const [locSnapshot, verifiedSnapshot] = await Promise.all([
            db.ref('locationData').once('value'),
            db.ref('verified_locations').once('value')
        ]);
        
        const locations = locSnapshot.val();
        const verified = verifiedSnapshot.val();
        
        const streetToAreaMap = new Map();
        const allAreas = new Set();
        const allStreets = new Set();

        if (!locations && !verified) {
            console.warn("[Location Match] No location data found in database. Using empty defaults.");
            return { streetToAreaMap, allAreas, allStreets };
        }

        // 1. Process legacy locationData (provides initial Area mapping)
        if (locations) {
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
        }

        // 2. Process verified_locations (PRECDENCE: Overrides legacy data with high-confidence mapped data)
        if (verified) {
            Object.values(verified).forEach(loc => {
                if (!loc.name) return;
                const nameLower = loc.name.toLowerCase();
                
                // Add to candidate set (or ensure it's there)
                allStreets.add(nameLower);

                // If this is a verified location, it might have an explicit area or type
                if (loc.area) {
                    const areaLower = loc.area.toLowerCase();
                    allAreas.add(areaLower);
                    streetToAreaMap.set(nameLower, areaLower);
                } else {
                    // For verified locations without an explicit area, we assign a better default than legacy if unknown
                    // or keep the legacy mapping if it exists and hasn't been overridden.
                    if (!streetToAreaMap.has(nameLower)) {
                        if (loc.type === 'Building' || loc.type === 'Hospital') {
                            streetToAreaMap.set(nameLower, loc.type);
                            allAreas.add(loc.type.toLowerCase());
                        } else {
                            streetToAreaMap.set(nameLower, 'Verified Street');
                        }
                    }
                }
            });
        }

        return { streetToAreaMap, allAreas, allStreets };
    } catch (error) {
        console.error("[Location Match] Error fetching location data:", error);
        return { streetToAreaMap: new Map(), allAreas: new Set(), allStreets: new Set() };
    }
}

async function matchLocation(place, processedLocations, reportKey = null, skipReport = false) {
    if (!place || typeof place !== 'string') {
        return { area: 'Unknown', street: null, confidence: 0, level: "VERY LOW", matchedName: "N/A" };
    }

    const { streetToAreaMap, allAreas, allStreets } = processedLocations;
    
    // Abbreviation expansion mapping
    const abbrevMap = {
        'st': 'street',
        'ave': 'avenue',
        'blvd': 'boulevard',
        'rd': 'road',
        'dr': 'drive',
        'ln': 'lane',
        'pl': 'place',
        'pkwy': 'parkway',
        'ct': 'court',
        'cir': 'circle',
        'hwy': 'highway'
    };

    // Normalization helper
    const normalize = (str) => {
        let normalized = str.toLowerCase()
            .replace(/\s*\(.*?\)\s*/g, ' ') 
            .replace(/\s*zone\s*\d+\s*/g, ' ') 
            .replace(/[^a-z0-9\s]/g, ' ') 
            .replace(/\s+/g, ' ') 
            .trim();
        
        // Expand abbreviations
        return normalized.split(' ').map(word => abbrevMap[word] || word).join(' ');
    };

    const cleanedPlace = normalize(place);
    if (!cleanedPlace) return { area: 'Unknown', street: null, confidence: 0, level: "VERY LOW", matchedName: "N/A" };

    // Common suffixes to ignore for "loose" matching
    const suffixes = ['avenue', 'street', 'boulevard', 'road', 'way', 'drive', 'lane', 'place', 'parkway', 'court', 'circle', 'highway'];
    const getSignificantName = (name) => {
        let parts = normalize(name).split(' ');
        if (parts.length > 1 && suffixes.includes(parts[parts.length - 1])) {
            parts.pop();
        }
        return parts.join(' ');
    };

    // Exact match check
    for (const street of allStreets) {
        if (normalize(street) === cleanedPlace) {
            return { area: streetToAreaMap.get(street), street: street, confidence: 100, level: "VERY HIGH", matchedName: street };
        }
    }

    // Intersection detection
    const intersectionSeps = [' and ', ' & ', ' at ', ' / '];
    let isIntersection = false;
    let parts = [cleanedPlace];
    
    for (const sep of intersectionSeps) {
        if (place.toLowerCase().includes(sep)) {
            parts = place.toLowerCase().split(sep).map(p => normalize(p));
            isIntersection = true;
            break;
        }
    }

    const candidates = [];

    // Match logic for each part (or the whole string if not an intersection)
    parts.forEach(part => {
        allStreets.forEach(street => {
            const normStreet = normalize(street);
            const sigStreet = getSignificantName(street);
            if (!normStreet || !sigStreet) return;

            if (part === normStreet || part === sigStreet) {
                candidates.push({ type: 'street', name: street, area: streetToAreaMap.get(street), matchType: 'full' });
            } else if (part.includes(normStreet) || part.includes(sigStreet)) {
                candidates.push({ type: 'street', name: street, area: streetToAreaMap.get(street), matchType: 'full' });
            } else if (part.length >= 4 && (normStreet.includes(part) || sigStreet.includes(part))) {
                candidates.push({ type: 'street', name: street, area: streetToAreaMap.get(street), matchType: 'partial' });
            }
        });
    });

    if (candidates.length === 0) {
        // Area check fallback
        allAreas.forEach(area => {
            const normArea = normalize(area);
            if (normArea && cleanedPlace.includes(normArea)) {
                candidates.push({ type: 'area', name: area, area: area });
            }
        });
    }

    if (candidates.length === 0) {
        if (!skipReport) await processUntrackedLocation(place, null, null, reportKey, "REPORT", { confidenceLevel: "VERY LOW", confidenceScore: 0 });
        return { area: place, street: null, confidence: 0, level: "VERY LOW", matchedName: "N/A" };
    }

    // Scoring
    let bestCandidate = null;
    let highestScore = -1;
    const uniqueMatches = new Set(candidates.map(c => c.name));

    candidates.forEach(candidate => {
        let score = 0;
        if (candidate.type === 'street') {
            score = (candidate.matchType === 'full' ? 65 : 45) + candidate.name.length;
            if (candidate.area && cleanedPlace.includes(normalize(candidate.area))) score += 30;
            // Boost for intersection discovery
            if (isIntersection && uniqueMatches.size > 1) score += 20;
        } else {
            score = 45 + candidate.name.length;
        }

        if (score > highestScore) {
            highestScore = score;
            bestCandidate = candidate;
        }
    });

    const confidence = Math.min(Math.round(highestScore), 100);
    let level = "VERY LOW";
    if (confidence > 85) level = "VERY HIGH";
    else if (confidence > 65) level = "HIGH";
    else if (confidence > 45) level = "MEDIUM";
    else if (confidence > 25) level = "LOW";

    const matchedNameOutput = isIntersection ? Array.from(uniqueMatches).join(' & ') : (bestCandidate?.name || "N/A");

    if (bestCandidate && confidence > 45) {
        return {
            area: bestCandidate.area,
            street: matchedNameOutput,
            confidence: confidence,
            level: level,
            matchedName: matchedNameOutput
        };
    }

    if (!skipReport) {
        await processUntrackedLocation(place, null, bestCandidate?.area, reportKey, "REPORT", { confidenceLevel: level, confidenceScore: confidence });
    }
    return { area: place, street: null, confidence: confidence, level: level, matchedName: matchedNameOutput };
}


async function aggregateCoronerStats(startOfMonth, endOfMonth) {
    const reportsPaths = ['newSavedReports', 'savedReports'];
    
    const agencyDataStore = (await db.ref('/agencies').once('value')).val() || {};
    const processedLocations = await getProcessedLocations();
    const processedReportIds = new Set();


    const stats = {
        coronerReports: { total: 0, mannerOfDeath: {}, placeOfDeath: {} }, // Removed topCoroners from here
        coronerEmails: { total: 0, departments: {} },
        massFatalities: { total: 0, locations: {}, totalDecedents: 0, reports: [] },
        reportBreakdown: {},
        topUsers: {}, // New object to track all top users
        totalReports: 0 // New field for total reports processed
    };

    for (const path of reportsPaths) {
        const reportsRef = db.ref(path);
        const snapshot = await reportsRef.once('value');
        if (!snapshot.exists()) {
            console.log(`[CoronerStats] No reports found in path: ${path}`);
            continue;
        }

        const allUsersReports = snapshot.val();
        let reportsInPath = 0;
        for (const userId in allUsersReports) {
            const userReports = allUsersReports[userId];
            if (userReports && typeof userReports === 'object') {
                reportsInPath += Object.keys(userReports).length;
            }
        }
        console.log(`[CoronerStats] Located ${reportsInPath} reports in path: ${path}`);

        for (const userId in allUsersReports) {
            // Only process 'CIVILIAN' reports from the legacy savedReports path
            if (path === 'savedReports' && userId !== 'CIVILIAN') continue;

            const userReports = allUsersReports[userId];
            if (!userReports || typeof userReports !== 'object') continue;

            for (const reportId in userReports) {
                if (processedReportIds.has(reportId)) continue;
                
                const report = userReports[reportId];
                if (!report.timestamp || report.timestamp < startOfMonth || report.timestamp > endOfMonth) continue;
                
                processedReportIds.add(reportId);
                stats.totalReports++;

                const formId = report.formId || report.data?.formId;
                const data = report.data || report;
                const author = report.authorName || userId || 'Unknown'; // Get author for topUsers

                stats.topUsers[author] = (stats.topUsers[author] || 0) + 1; // Increment for all reports
                stats.totalReports++; // Increment total reports count

                let reportType = 'unknown';
                if (formId === 'coroner-report' || (!formId && data.mannerOfDeath)) {
                    reportType = 'coroner-report';
                } else if (formId === 'coroner_email') {
                    reportType = 'coroner_email';
                } else if (formId === 'mass-ftality-test') {
                    reportType = 'mass-fatality';
                }

                stats.reportBreakdown[formId || 'unknown'] = (stats.reportBreakdown[formId || 'unknown'] || 0) + 1; // Increment report breakdown

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
                    
                    default:
                        // This will catch any reports that don't match the above types
                        // and ensure they are still counted in the breakdown.
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
            const topAreasData = Object.entries(coronerReports.placeOfDeath || {}).sort(([, a], [, b]) => b.total - a.total).slice(0, 3);
            let topAreasDescription = topAreasData.map(([area, data]) => {
                const topStreets = Object.entries(data.streets || {}).sort(([, a], [, b]) => b - a).slice(0, 2).map(([street, count]) => `${street} (${count})`).join(', ');
                return `**${area}** (${data.total}) - _Top Streets: ${topStreets || 'N/A'}_`;
            }).join('\n');
            if (topAreasDescription) {
                coronerReportSummary += `\n**Top Regions**:\n${topAreasDescription}`;
            }
        }

        const topUsers = Object.entries(fullStats.topUsers || {}).sort(([, a], [, b]) => b - a).slice(0, 3).map(([name, count]) => `${name} (${count})`).join(', ');
        if (topUsers) {
            coronerReportSummary += `\n**Top Users**: ${topUsers}`;
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

        let emailSummary = `**${coronerEmails.total}** emails sent.`;
        if (coronerEmails.total > 0) {
            const topDepts = Object.entries(coronerEmails.departments).sort(([, a], [, b]) => b.count - a.count).slice(0, 5).map(([dept, data]) => {
                return `${dept} (${data.count})`;
            }).join(', ');
            emailSummary += `\n**Top Departments**: ${topDepts}`;
        }

        let massFatalitySummary = `**${massFatalities.total}** events, **${massFatalities.totalDecedents}** total decedents.`;

        const reportNameMapping = {
            1: "Forensic Services",
            4: "Autopsy Report",
            2: "Coroner Email",
            8: "Certificate of Death",
            11: "Mass Fatality Report",
            37: "Death Record",
            'coroner-report': "Forensic Services",
            'coroner_email': "Coroner Email",
            'mass-ftality-test': "Mass Fatality Report"
        };
        
        const reportBreakdown = Object.entries(fullStats.reportBreakdown || {}).map(([formId, count]) => {
            const name = reportNameMapping[formId] || formId;
            return `${name}: ${count}`;
        }).join('\n') || 'No reports filed.';

        const topUsers = Object.entries(fullStats.topUsers || {}).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, count]) => `${name} (${count})`).join(', ');

        const embed = {
            title: `🗓️ Yearly Coroner's Office Summary: ${year}`,
            description: "Annual performance and statistics overview.",
            color: 0xE67E22, // Orange
            fields: [
                { name: "__Total Reports Processed__", value: fullStats.totalReports.toString(), inline: false },
                { name: "__Annual Coroner Reports__", value: coronerReportSummary, inline: false },
                { name: "__Annual Coroner Emails__", value: emailSummary, inline: false },
                { name: "__Annual Mass Fatality Stats__", value: massFatalitySummary, inline: false },
                { name: "__Report Breakdown__", value: reportBreakdown, inline: false },
                { name: "__Top 10 Users (Annual)__", value: topUsers || 'N/A', inline: false }
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
            const topAreasData = Object.entries(coronerReports.placeOfDeath || {}).sort(([, a], [, b]) => b.total - a.total).slice(0, 3);
            let topAreasDescription = topAreasData.map(([area, data]) => {
                const topStreets = Object.entries(data.streets || {}).sort(([, a], [, b]) => b - a).slice(0, 2).map(([street, count]) => `${street} (${count})`).join(', ');
                return `**${area}** (${data.total}) - _Top Streets: ${topStreets || 'N/A'}_`;
            }).join('\n');
            if (topAreasDescription) {
                coronerReportSummary += `\n**Top Regions**:\n${topAreasDescription}`;
            }
        }

        const topUsers = Object.entries(fullStats.topUsers || {}).sort(([, a], [, b]) => b - a).slice(0, 3).map(([name, count]) => `${name} (${count})`).join(', ');
        if (topUsers) {
            coronerReportSummary += `\n**Top Users**: ${topUsers}`;
        }

        let emailSummary = `**${coronerEmails.total}** emails sent.`;
        if (coronerEmails.total > 0) {
            const topDepts = Object.entries(coronerEmails.departments || {}).sort(([, a], [, b]) => b.count - a.count).slice(0, 3).map(([dept, data]) => {
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
 * Scans reports from the last 60 days to identify untracked locations.
 * Results are sent via Webhook as a .txt file.
 */
export const scanUntrackedLocations = onCall({
    secrets: ["ADMIN_ACTION_WEBHOOK_URL", "DISCORD_WEBHOOK_FUNCTIONS"],
}, async (request) => {
    const now = Date.now();
    const SixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);

    console.log('[Scan Untracked] Starting manual scan of reports from the last 60 days...');

    try {
        // 1. Run the scan (updates untracked_locations_log in DB with new findings)
        await aggregateCoronerStats(SixtyDaysAgo, now);

        // 2. Fetch the updated results
        const logSnapshot = await db.ref('untracked_locations_log').once('value');
        const logs = logSnapshot.val() || {};
        
        // 3. Filter out things that are now tracked (Cleanup Step)
        const processedLocations = await getProcessedLocations();
        const trulyUntracked = [];
        const updates = {};

        for (const [key, entry] of Object.entries(logs)) {
            // Use matchLocation with skipReport=true to check if we now know about this place
            const matched = await matchLocation(entry.place, processedLocations, null, true);
            
            // CLEANUP LOGIC: If the system can now match this with at least MEDIUM confidence (> 45),
            // it is no longer "untracked" and should be purged from the log.
            if (matched.confidence > 45) {
                updates[`untracked_locations_log/${key}`] = null;
            } else {
                // REPORT FILTER: Only include discoveries from actual report scans in the .txt file
                if (entry.source === 'REPORT' || (entry.lastReportKey && entry.lastReportKey !== 'N/A')) {
                    trulyUntracked.push({ ...entry, matchAnalysis: matched });
                }
            }
        }

        // Apply cleanup updates to Firebase
        if (Object.keys(updates).length > 0) {
            console.log(`[Scan Untracked] Purged ${Object.keys(updates).length} matched locations from untracked log.`);
            await db.ref().update(updates);
        }

        if (trulyUntracked.length === 0) {
            return { success: true, message: "Scan complete. All discovered locations are already mapped!" };
        }

        const sortedEntries = trulyUntracked.sort((a, b) => b.timestamp - a.timestamp);

        // 4. Format into a text file
        let reportText = `PHMC UNTRACKED LOCATIONS REPORT\n`;
        reportText += `Generated: ${new Date().toISOString()}\n`;
        reportText += `Total Locations Requiring Mapping: ${sortedEntries.length}\n`;
        reportText += `(Note: Results with > 45% confidence are auto-accepted and were purged from this log)\n`;
        reportText += `------------------------------------------\n\n`;

        sortedEntries.forEach(entry => {
            const analysis = entry.matchAnalysis || {};
            const confidenceStr = analysis.level ? `${analysis.level} (${analysis.confidence || 0}%)` : 'UNKNOWN (0%)';

            reportText += `PLACE: ${entry.place}\n`;
            reportText += `NEAREST: ${entry.nearestStreet || analysis.matchedName || 'N/A'}\n`;
            reportText += `CONFIDENCE: ${confidenceStr}\n`;
            reportText += `DATABASE SEARCH: ${entry.place} - MATCH RATING: ${analysis.confidence || 0}% (FOUND: ${analysis.matchedName || "None"})\n`;
            reportText += `TYPE: REPORT\n`;
            reportText += `REPORT ID: ${entry.lastReportKey || 'N/A'}\n`;
            reportText += `------------------------------------------\n`;
        });

        // 5. Send Webhook with File
        const webhookPayload = {
            embeds: [{
                title: "🗺️ Untracked Locations Scan Results",
                description: `Scan of the last 60 days complete. Found **${sortedEntries.length}** locations that truly require mapping.`,
                color: 0xFFAA00,
                footer: { text: "PHMC Tools - Automated Discovery & Cleanup" }
            }]
        };

        const fileName = `untracked_locations_${new Date().toISOString().split('T')[0]}.txt`;
        await sendWebhookWithFile(reportText, fileName, webhookPayload);

        return { success: true, message: `Scan complete. Found ${sortedEntries.length} truly untracked locations. Results sent to Discord.` };
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

