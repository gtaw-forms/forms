import { useCallback, useMemo } from 'react';
import * as Sentry from "@sentry/react";
import { database } from '../firebase';
import { ref, set, push } from 'firebase/database';
import { triggerWebhookProxy } from '../services/firebaseFunctions';

export const useWebhooks = (formData, commitInfo, showNotification, getIsInactivityWarningTriggered) => {
    const logWebhookToFirebase = useCallback(async (type, payload) => {
        const db = database;
        const logsRef = ref(db, 'webhook_logs');
        const newLogRef = push(logsRef);
        await set(newLogRef, {
            type,
            payload,
            userAgent: navigator.userAgent.substring(0, 500),
            timestamp: Date.now(),
        });
    }, []);

    const sendDataRequestLog = useCallback(async (file, cached, source, cachedDataSize, networkTransferSize, loggedIn, user, requestedPortions, missingPortions, segmentSizes = {}, error = null, metadata = {}) => {
        // P1 — Sample cache hits: 98% of CACHE hits are observability noise (e.g. 20 MB/hr). Only log 2% sampled + all errors/network.
        if (cached && !error) {
            // Always log in dev for validation, otherwise sample 2%
            const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.'));
            if (!isDev && Math.random() > 0.02) {
                console.log(`[DataRequest] Sampled out (cache hit) ${file} ${source}`);
                return;
            }
        }
        // C — Detailed-compact: 3-4 lines, per-segment KB kept but collapsed to one compact line
        const totalKb = ((cachedDataSize || 0) + (networkTransferSize || 0));
        const netKb = (networkTransferSize || 0);
        const srcLabel = `${source}${cached ? ' · cached' : ' · network'}`;
        const hostPath = (()=>{ try{ const u=new URL(window.location.href); return u.host + u.pathname + u.hash; }catch{ return window.location.href.slice(0,80);} })();

        const segmentSources = metadata.segmentSources || {};
        const totalSegs = Object.keys(segmentSources).length;
        const cachedCount = Object.values(segmentSources).filter(v=>v==='cache').length;
        const networkCount = Object.values(segmentSources).filter(v=>v==='network').length;

        // Compact per-segment line: factions·22.6k[C] | agencies·1.2k[C] ...
        const compactSegments = Object.entries(segmentSources).map(([seg, src])=>{
            const kb = segmentSizes[seg] ? `${segmentSizes[seg].toFixed(1)}k` : '—';
            const badge = src==='cache' ? 'C' : src==='network' ? 'N' : '—';
            return `${seg}·${kb}[${badge}]`;
        }).join(' | ');

        const fields = [
            { name: 'Source', value: `\`${srcLabel}\``, inline: true },
            { name: 'Cache', value: cached ? `Yes (${cachedCount}/${totalSegs})` : `No (${networkCount}/${totalSegs})`, inline: true },
            { name: 'Size', value: `${totalKb.toFixed(1)} KB total${netKb?` · ${netKb.toFixed(1)} KB network`:''}`, inline: true },
        ];

        if (compactSegments) {
            fields.push({ name: `Segments (${cachedCount}c/${networkCount}n)`, value: `\`${compactSegments}\``, inline: false });
        }

        if (missingPortions && missingPortions.length > 0) {
            fields.push({ name: 'Missing', value: missingPortions.join(', ').slice(0,500), inline: false });
        }

        if (metadata.detail) {
            fields.push({ name: 'Detail', value: String(metadata.detail).slice(0,500), inline: false });
        }

        if (error) {
            fields.push({ name: 'Error', value: String(error).slice(0,500), inline: false });
        }

        const inactiveFlag = getIsInactivityWarningTriggered() ? ' · inactivity' : '';
        const userLabel = (loggedIn && user) ? `**${user}**` : (loggedIn ? 'Logged In' : 'Guest');
        const embed = {
            title: cached ? 'Data Cache Hit' : 'Data Fetch',
            description: `${userLabel} • \`${metadata.route || '#/'}\` • \`${metadata.trigger || file}\`${inactiveFlag}`,
            fields,
            color: cached ? 0x2ecc71 : 0xe67e22,
            timestamp: new Date().toISOString(),
            footer: { text: `${hostPath}` }
        };

        try {
            await triggerWebhookProxy('admin', { embeds: [embed] });
            console.log(`Data request log sent successfully.`);
        } catch (error) {
            console.error(`Failed to send data request log webhook:`, error);
            Sentry.captureException(error, { extra: { context: `sendDataRequestLog` } });
        }
    }, [getIsInactivityWarningTriggered]);

    const handlePhmcWebhookSubmit = useCallback(async (payload) => {
        if (!payload) return;
        try {
            await triggerWebhookProxy('phmc', payload);
            showNotification('PHMC webhook embed sent successfully!', 'check-circle');
        } catch (error) {
            showNotification('Failed to send PHMC webhook.', 'exclamation-triangle');
            Sentry.captureException(error, { extra: { context: 'PHMC Webhook Submit' } });
        }
    }, [showNotification]);

    const handleWebhookSubmit = useCallback(async (payload) => {
        if (!payload) return;
        try {
            await triggerWebhookProxy('admin', payload);
            showNotification('Dev webhook embed sent successfully!', 'check-circle');
        } catch (error) {
            showNotification('Failed to send dev webhook.', 'exclamation-triangle');
            Sentry.captureException(error, { extra: { context: 'Dev Webhook Submit' } });
        }
    }, [showNotification]);

    return useMemo(() => ({
        logWebhookToFirebase,
        sendDataRequestLog,
        handlePhmcWebhookSubmit,
        handleWebhookSubmit,
    }), [logWebhookToFirebase, sendDataRequestLog, handlePhmcWebhookSubmit, handleWebhookSubmit]);
};
