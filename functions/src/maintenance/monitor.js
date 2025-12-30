import { onSchedule } from "firebase-functions/v2/scheduler";
import fetch from 'node-fetch';
import { db, admin } from '../utils/firebase.js';
import { sendWebhook } from '../utils/helpers.js';

export const systemHealthMonitor = onSchedule({
    schedule: "every 30 minutes",
    timeZone: "UTC",
    secrets: ["ADMIN_ACTION_WEBHOOK_URL", "DISCORD_WEBHOOK_FUNCTIONS"],
}, async (event) => {
    console.log('[System Monitor] Starting health checks...');
    
    const monitoringRef = db.ref('monitoring');
    const snapshot = await monitoringRef.once('value');
    const previousState = snapshot.val() || {
        cloudflare: { indicator: 'none', description: 'All Systems Operational' },
        gtaw: { status: 'normal', lastLatency: 0 }
    };

    const alerts = [];
    const updates = {};

    // 1. Check Cloudflare Status
    try {
        // Use summary.json to get detailed incident updates
        const cfResponse = await fetch('https://www.cloudflarestatus.com/api/v2/summary.json');
        if (cfResponse.ok) {
            const cfData = await cfResponse.json();
            const currentIndicator = cfData.status.indicator;
            const currentDescription = cfData.status.description;
            console.log(`[System Monitor] Cloudflare Status: ${cfData.status.indicator} - ${cfData.status.description}`);

            // Find the most recent active incident (not resolved or postmortem)
            const activeIncident = cfData.incidents && cfData.incidents.find(i => {
                const isResolved = i.status === 'resolved' || i.status === 'postmortem';
                if (isResolved && previousState.cloudflare?.activeIncidentId === i.id) {
                    // This incident was the one we were tracking, and it's now resolved.
                    // We need to clear our stored incident data.
                    console.log(`[System Monitor] Detected resolved incident: ${i.id}. Clearing from state.`);
                    updates['cloudflare'] = {
                        ...updates['cloudflare'], // Keep any other updates
                        activeIncidentId: null,
                        lastUpdateId: null,
                    };
                }
                // An incident is only considered "active" for our purposes if it's not resolved AND it has been updated in the last 24 hours.
                // This prevents very old, stale incidents from being picked up.
                const lastUpdated = new Date(i.updated_at || i.created_at);
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                return !isResolved && lastUpdated > twentyFourHoursAgo;
            });
            
            let alertTriggered = false;

            // Check for new updates on an active incident
            if (activeIncident) {
                const lastUpdateId = previousState.cloudflare?.lastUpdateId;
                const latestUpdate = activeIncident.incident_updates[0]; // Updates are sorted newest first
                
                // If we have a new update (based on update ID)
                if (latestUpdate && latestUpdate.id !== lastUpdateId) {
                    alerts.push({
                        title: `⚠️ Cloudflare: ${activeIncident.name}`,
                        description: `**${latestUpdate.status}**: ${latestUpdate.body}`,
                        color: 0xF1C40F // Orange
                    });

                    updates['cloudflare'] = {
                        indicator: currentIndicator,
                        description: currentDescription,
                        activeIncidentId: activeIncident.id,
                        lastUpdateId: latestUpdate.id,
                        lastChecked: admin.database.ServerValue.TIMESTAMP
                    };
                    alertTriggered = true;
                }
            }

            // Fallback: If no specific incident update caused an alert, check for overall status changes
            // This catches cases where the indicator changes but maybe there isn't a specific incident object yet, or it was just resolved.
            if (!alertTriggered) {
                 if (currentIndicator !== 'none' && currentIndicator !== previousState.cloudflare?.indicator) {
                    alerts.push({
                        title: "⚠️ Cloudflare Status Changed",
                        description: `Status changed to: **${currentDescription}** (${currentIndicator})`,
                        color: 0xF1C40F // Orange
                    });
                    updates['cloudflare'] = {
                        indicator: currentIndicator,
                        description: currentDescription,
                        lastChecked: admin.database.ServerValue.TIMESTAMP,
                        // Reset incident trackers if we're just seeing a generic status change (or preserve them if needed)
                         activeIncidentId: null,
                         lastUpdateId: null
                    };
                } else if (currentIndicator === 'none' && previousState.cloudflare?.indicator !== 'none') {
                    alerts.push({
                        title: "✅ Cloudflare Status Resolved",
                        description: "Cloudflare systems are back to normal.",
                        color: 0x00FF00 // Green
                    });
                    updates['cloudflare'] = {
                        indicator: 'none',
                        description: 'All Systems Operational',
                        lastChecked: admin.database.ServerValue.TIMESTAMP,
                        activeIncidentId: null,
                        lastUpdateId: null
                    };
                }
            }

        }
    } catch (error) {
        console.error('[System Monitor] Error checking Cloudflare:', error);
    }

    // 2. Check GTA World UCP Latency
    const LATENCY_THRESHOLD = 2000; // 2 seconds
    try {
        const start = Date.now();
        // Use a timeout to detect timeouts as failures
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const gtawResponse = await fetch('https://ucp.gta.world/', { 
            method: 'GET',
            headers: { 'User-Agent': 'PHMC-Tools/HealthCheck' },
            signal: controller.signal
        });
        clearTimeout(timeout);
        
        const end = Date.now();
        const latency = end - start;
        const isSlow = latency > LATENCY_THRESHOLD;
        const currentStatus = isSlow ? 'slow' : 'normal';

        console.log(`[System Monitor] GTAW UCP Latency: ${latency}ms`);

        if (isSlow && previousState.gtaw?.status !== 'slow') {
             alerts.push({
                title: "🐢 GTA World UCP High Latency",
                description: `UCP is responding slowly. Latency: **${latency}ms** (Threshold: ${LATENCY_THRESHOLD}ms)`,
                color: 0xE67E22 // Orange
            });
        } else if (!isSlow && previousState.gtaw?.status === 'slow') {
             alerts.push({
                title: "🚀 GTA World UCP Latency Normal",
                description: `UCP latency has returned to normal (${latency}ms).`,
                color: 0x00FF00 // Green
            });
        }
        
        if (!gtawResponse.ok) {
             console.warn(`[System Monitor] GTAW UCP returned status ${gtawResponse.status}`);
             // Optional: Alert on HTTP errors? keeping it to latency for now as requested.
        }

        updates['gtaw'] = {
            status: currentStatus,
            lastLatency: latency,
            lastChecked: admin.database.ServerValue.TIMESTAMP
        };

    } catch (error) {
        console.error('[System Monitor] Error checking GTAW UCP:', error);
        // Treat timeout/network error as potential outage or critical slowness
        if (previousState.gtaw?.status !== 'error') {
            alerts.push({
                title: "🔴 GTA World UCP Unreachable",
                description: `Failed to reach UCP. Error: ${error.message}`,
                color: 0xFF0000 // Red
            });
            updates['gtaw'] = {
                status: 'error',
                lastError: error.message,
                lastChecked: admin.database.ServerValue.TIMESTAMP
            };
        }
    }

    // Save state
    if (Object.keys(updates).length > 0) {
        await monitoringRef.update(updates);
    }

    // Send alerts if any
    if (alerts.length > 0) {
        console.log(`[System Monitor] Sending ${alerts.length} alerts.`);
        const embed = {
            title: "System Health Alert",
            fields: alerts.map(a => ({
                name: a.title,
                value: a.description,
                inline: false
            })),
            color: alerts[0].color, // Use color of first alert
            timestamp: new Date().toISOString(),
            footer: { text: "PHMC Tools - System Monitor" }
        };
        
        // Use loop to handle different colors if necessary, but single embed is cleaner. 
        // If multiple mixed alerts (Good + Bad), maybe just send separate or neutral color.
        // For simplicity, sending one webhook with multiple fields.
        await sendWebhook({ embeds: [embed] });
    }
});
