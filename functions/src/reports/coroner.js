import { db } from '../utils/firebase.js';
import { sendWebhook } from '../utils/helpers.js';
import { processUntrackedLocation } from '../utils/locationReporting.js';

const MORGUE_API_URL = (process.env.MORGUE_API_URL || 'http://88.208.243.254').replace(/\/$/, '');
const MORGUE_API_KEY = process.env.MORGUE_API_KEY;

async function getReferenceDataset(name) {
    if (MORGUE_API_KEY) {
        try {
            const response = await fetch(`${MORGUE_API_URL}/api/reference/${name}`, {
                headers: { 'x-api-key': MORGUE_API_KEY },
            });
            if (response.ok) {
                const result = await response.json();
                return result.data || {};
            }
        } catch (error) {
            console.warn(`[CoronerStats] VPS reference ${name} unavailable: ${error.message}`);
        }
    }
    return (await db.ref(name).once('value')).val() || {};
}

async function getProcessedLocations() {
    try {
        // Prefer the VPS snapshot; retain RTDB fallback during the transition.
        const [locSnapshot, verifiedSnapshot] = await Promise.all([
            getReferenceDataset('locationData'),
            getReferenceDataset('verified_locations'),
        ]);
        
        const locations = locSnapshot;
        const verified = verifiedSnapshot;
        
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


function emptyCoronerStats() {
    return {
        coronerReports: { total: 0, mannerOfDeath: {}, placeOfDeath: {} },
        coronerEmails: { total: 0, departments: {} },
        massFatalities: { total: 0, locations: {}, totalDecedents: 0, reports: [] },
        reportBreakdown: {},
        topUsers: {},
        totalReports: 0
    };
}

async function aggregateCoronerStats(startOfMonth, endOfMonth) {
    // 3b-4: VPS aggregates — no RTDB full-node scans. Field-level breakdowns
    // come from GET /api/reports/coroner-stats (local-disk scan on the VPS);
    // only distinct placeOfDeath strings are matched locally below, and agency
    // URLs are resolved from the reference dataset. On VPS failure this
    // returns empty stats (summaries no-op) rather than falling back to RTDB.
    const stats = emptyCoronerStats();

    if (!MORGUE_API_KEY) {
        console.warn('[CoronerStats] MORGUE_API_KEY unset — returning empty stats (no RTDB scan).');
        return stats;
    }

    let agg;
    try {
        const start = Number(startOfMonth) || 0;
        const end = Number(endOfMonth) || Date.now();
        const response = await fetch(
            `${MORGUE_API_URL}/api/reports/coroner-stats?start=${start}&end=${end}`,
            { headers: { 'x-api-key': MORGUE_API_KEY } }
        );
        if (!response.ok) {
            throw new Error(`VPS coroner-stats returned ${response.status}`);
        }
        agg = await response.json();
    } catch (error) {
        console.error(`[CoronerStats] VPS aggregate unavailable: ${error.message} — returning empty stats (no RTDB scan).`);
        return stats;
    }

    const agencyDataStore = await getReferenceDataset('agencies');
    const processedLocations = await getProcessedLocations();

    stats.totalReports = Number(agg.totalReports) || 0;
    stats.reportBreakdown = agg.reportBreakdown || {};
    stats.topUsers = agg.topUsers || {};

    stats.coronerReports.total = Number(agg.coronerReports?.total) || 0;
    stats.coronerReports.mannerOfDeath = agg.coronerReports?.mannerOfDeath || {};
    for (const [place, count] of Object.entries(agg.coronerReports?.placeOfDeathRaw || {})) {
        // skipReport=true: summary jobs map distinct place strings only and must
        // not write untracked_locations_log entries (per-report deploy path
        // already handles discovery).
        const matched = await matchLocation(place, processedLocations, null, true);
        if (!stats.coronerReports.placeOfDeath[matched.area]) {
            stats.coronerReports.placeOfDeath[matched.area] = { total: 0, streets: {} };
        }
        stats.coronerReports.placeOfDeath[matched.area].total += count;
        if (matched.street) {
            stats.coronerReports.placeOfDeath[matched.area].streets[matched.street] =
                (stats.coronerReports.placeOfDeath[matched.area].streets[matched.street] || 0) + count;
        }
    }

    stats.coronerEmails.total = Number(agg.coronerEmails?.total) || 0;
    for (const [dept, count] of Object.entries(agg.coronerEmails?.departments || {})) {
        stats.coronerEmails.departments[dept] = { count, url: null };
        const agency = Object.values(agencyDataStore).find(a => a.fullName === dept);
        if (agency && agency.url) {
            stats.coronerEmails.departments[dept].url = agency.url;
        }
    }

    stats.massFatalities.total = Number(agg.massFatalities?.total) || 0;
    stats.massFatalities.locations = agg.massFatalities?.locations || {};
    stats.massFatalities.totalDecedents = Number(agg.massFatalities?.totalDecedents) || 0;
    stats.massFatalities.reports = Array.isArray(agg.massFatalities?.reports) ? agg.massFatalities.reports : [];

    return stats;
}


export const runWeeklyCoronerSummary = async () => {
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
};

export const runYearlyCoronerSummary = async () => {
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
};

/**
 * Monthly coroner summary (re-enabled 3b-4, 2026-09-14): the old
 * `coronerReports.topCoroners` TypeError is fixed by using `fullStats.topUsers`
 * (same as the weekly/yearly paths), and `aggregateCoronerStats` now reads VPS
 * aggregates (`GET /api/reports/coroner-stats`) instead of full-node RTDB
 * scans per `plan/saved-reports-migration-design.md` §8.
 */
export const runMonthlyCoronerSummary = async () => {
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
};

