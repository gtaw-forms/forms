/**
 * deployNotifier.js — posts web-deploy results to Discord via the bot client.
 *
 * tools/deploy.js (local) cannot reach Discord directly — no webhook URLs are
 * used anywhere (safer: no bearer tokens outside the VPS). Instead it writes
 * a notice node, and this watcher picks it up event-driven and posts it to
 * the log channel with the bot's own client.
 *
 * Node shape: deployNotifications/<pushId> = {
 *   title, description, color, createdAt, status: 'pending', source: 'web-deploy'
 * }
 * Nodes are removed after posting. A pending node left over from downtime is
 * picked up on next boot (listener replay), so deploy notices survive outages.
 */

import firebase from './firebase.js';
import { sendLogMessage } from './logChannel.js';

let _ref = null;

export function startDeployNotifier() {
    firebase.init();
    const ref = firebase.db.ref('deployNotifications');
    _ref = ref;
    console.log('[DEPLOY-NOTIFY] Watching deployNotifications...');
    ref.on('child_added', async (snap) => {
        if (!snap.exists()) return;
        const v = snap.val() || {};
        if (v.status && v.status !== 'pending') return;
        try {
            // Mentions inside embeds do NOT trigger notifications — lift any
            // <@user>/<@&role> tags from the description into the message
            // content (which does ping, via allowedMentions) and keep the
            // embed itself unchanged.
            const description = v.description || '';
            const mentions = [...new Set(description.match(/<@!?\d+>|<@&\d+>/g) || [])];
            await sendLogMessage(mentions.length ? mentions.join(' ') : null, {
                title: v.title || 'Web deploy',
                description,
                color: typeof v.color === 'number' ? v.color : 0x5865F2,
                timestamp: v.createdAt || new Date().toISOString(),
                footer: { text: 'PHMC web deploy' },
            });
            await snap.ref.remove().catch(() => {});
            console.log(`[DEPLOY-NOTIFY] Posted + cleared ${snap.key}`);
        } catch (err) {
            console.warn(`[DEPLOY-NOTIFY] Failed for ${snap.key}: ${err.message}`);
        }
    });
}

export function stopDeployNotifier() {
    if (_ref) {
        _ref.off('child_added');
        _ref = null;
    }
}
