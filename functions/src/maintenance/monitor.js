import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import { db, admin } from '../utils/firebase.js';
import { sendWebhook } from '../utils/helpers.js';
import { getConfigValue } from '../utils/config.js';

/**
 * Manually triggers a test "Critical Outage" alert to verify webhook delivery and pings.
 */
export const triggerTestHealthAlert = onCall({
    secrets: ["PHMC_CONFIG"],
}, async (request) => {
    // Check if user is authenticated and is an admin (optional, but good practice)
    // For now, focusing on the trigger logic as requested.

    const testAlerts = [
        {
            title: "🔴 TEST: Cloudflare Critical Outage",
            description: "Widespread API errors detected globally. Manual trigger for testing.",
            color: 0xFF0000,
            source: 'cloudflare'
        },
        {
            title: "🔴 TEST: GTA World UCP Unreachable",
            description: "Connection timed out to https://ucp.gta.world/ (France/OVH Node).",
            color: 0xFF0000,
            source: 'gtaw'
        }
    ];

    const developerUser = "<@228306972204597248>"; 
    const phmcLeaderUser = "<@216339303926595586>"; 

    const tasks = [];

    // Process Cloudflare Test Alert
    const cfAlert = testAlerts.find(a => a.source === 'cloudflare');
    const cfPayload = {
        username: "System Uptime Alert",
        content: `🚨 **TEST: CLOUDFLARE INCIDENT** 🚨\nForms Developer: ${developerUser}\nPHMC Bot Manager: ${phmcLeaderUser}`,
        embeds: [{
            title: "Cloudflare System Health Alert (TEST)",
            fields: [{ name: cfAlert.title, value: cfAlert.description }],
            color: 0xFF0000,
            timestamp: new Date().toISOString(),
            footer: { text: "PHMC Tools - System Monitor (Test)" }
        }]
    };
    tasks.push(sendWebhook(cfPayload, getConfigValue("DISCORD_WEBHOOK_FUNCTIONS")));
    tasks.push(sendWebhook(cfPayload, getConfigValue("PHMC_DISCORD")));

    // Process GTAW Test Alert
    const gtawAlert = testAlerts.find(a => a.source === 'gtaw');
    const gtawPayload = {
        username: "System Uptime Alert",
        content: `🚨 **TEST: GTAW INCIDENT** 🚨\nForms Developer: ${developerUser}`,
        embeds: [{
            title: "GTAW System Health Alert (TEST)",
            fields: [{ name: gtawAlert.title, value: gtawAlert.description }],
            color: 0xFF0000,
            timestamp: new Date().toISOString(),
            footer: { text: "PHMC Tools - System Monitor (Test)" }
        }]
    };
    tasks.push(sendWebhook(gtawPayload, getConfigValue("DISCORD_WEBHOOK_FUNCTIONS")));

    await Promise.all(tasks);

    return { success: true, message: "Test alerts dispatched to respective channels." };
});

export const systemHealthMonitor = onSchedule({
    schedule: "every 15 minutes",
    timeZone: "UTC",
    region: "europe-west2",
    memory: "128MiB",
    secrets: ["PHMC_CONFIG"],
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
                        color: 0xF1C40F, // Orange
                        source: 'cloudflare'
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
            if (!alertTriggered) {
                 if (currentIndicator !== 'none' && currentIndicator !== previousState.cloudflare?.indicator) {
                    alerts.push({
                        title: "⚠️ Cloudflare Status Changed",
                        description: `Status changed to: **${currentDescription}** (${currentIndicator})`,
                        color: 0xF1C40F, // Orange
                        source: 'cloudflare'
                    });
                    updates['cloudflare'] = {
                        indicator: currentIndicator,
                        description: currentDescription,
                        lastChecked: admin.database.ServerValue.TIMESTAMP,
                         activeIncidentId: null,
                         lastUpdateId: null
                    };
                } else if (currentIndicator === 'none' && previousState.cloudflare?.indicator !== 'none') {
                    alerts.push({
                        title: "✅ Cloudflare Status Resolved",
                        description: "Cloudflare systems are back to normal.",
                        color: 0x00FF00, // Green
                        source: 'cloudflare'
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
    const LATENCY_THRESHOLD = 30000; // 30 seconds
    try {
        const start = Date.now();
        // Use a timeout to detect timeouts as failures
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000); 

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
                color: 0xE67E22, // Orange
                source: 'gtaw'
            });
        } else if (!isSlow && previousState.gtaw?.status === 'slow') {
             alerts.push({
                title: "🚀 GTA World UCP Latency Normal",
                description: `UCP latency has returned to normal (${latency}ms).`,
                color: 0x00FF00, // Green
                source: 'gtaw'
            });
        }
        
        updates['gtaw'] = {
            status: currentStatus,
            lastLatency: latency,
            lastChecked: admin.database.ServerValue.TIMESTAMP
        };

    } catch (error) {
        console.error('[System Monitor] Error checking GTAW UCP:', error);
        if (previousState.gtaw?.status !== 'error') {
            alerts.push({
                title: "🔴 GTA World UCP Unreachable",
                description: `Failed to reach UCP. Error: ${error.message}`,
                color: 0xFF0000, // Red
                source: 'gtaw'
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
        
        const developerUser = "<@228306972204597248>"; 
        const phmcLeaderUser = "<@216339303926595586>"; 

        const tasks = [];

        // Route alerts based on source
        const cfAlerts = alerts.filter(a => a.source === 'cloudflare');
        const gtawAlerts = alerts.filter(a => a.source === 'gtaw');

        if (cfAlerts.length > 0) {
            const isHighPriority = cfAlerts.some(a => 
                a.title.includes('Critical') || a.title.includes('Major') || a.title.includes('🔴') || a.title.includes('🟠')
            );

            const cfPayload = {
                username: "System Uptime Alert",
                content: isHighPriority ? `🚨 **CLOUDFLARE INCIDENT DETECTED** 🚨\nForms Developer: ${developerUser}\nPHMC Bot Manager: ${phmcLeaderUser}` : null,
                embeds: [{
                    title: isHighPriority ? "🚨 Cloudflare System Health Alert" : "Cloudflare System Health Alert",
                    fields: cfAlerts.map(a => ({ name: a.title, value: a.description, inline: false })),
                    color: isHighPriority ? 0xFF0000 : cfAlerts[0].color,
                    timestamp: new Date().toISOString(),
                    footer: { text: "PHMC Tools - System Monitor" }
                }]
            };
            tasks.push(sendWebhook(cfPayload, getConfigValue("DISCORD_WEBHOOK_FUNCTIONS")));
            tasks.push(sendWebhook(cfPayload, getConfigValue("PHMC_DISCORD")));
        }

        if (gtawAlerts.length > 0) {
            const isHighPriority = gtawAlerts.some(a => 
                a.title.includes('Unreachable') || a.title.includes('🔴')
            );

            const gtawPayload = {
                username: "System Uptime Alert",
                content: isHighPriority ? `🚨 **GTAW UCP INCIDENT DETECTED** 🚨\nForms Developer: ${developerUser}` : null,
                embeds: [{
                    title: isHighPriority ? "🚨 GTAW System Health Alert" : "GTAW System Health Alert",
                    fields: gtawAlerts.map(a => ({ name: a.title, value: a.description, inline: false })),
                    color: isHighPriority ? 0xFF0000 : gtawAlerts[0].color,
                    timestamp: new Date().toISOString(),
                    footer: { text: "PHMC Tools - System Monitor" }
                }]
            };
            tasks.push(sendWebhook(gtawPayload, getConfigValue("DISCORD_WEBHOOK_FUNCTIONS")));
        }

        await Promise.all(tasks);
    }
});
