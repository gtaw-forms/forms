/**
 * Deploy LSSD — cross-post completed autopsies to LSSD forum f=2263.
 * Tracks status in Firebase so failed cross-posts can be retried on restart.
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getForumClient } from './forumClient.js';
import { logFnCall } from './deployLogger.js';
import { state } from './deployState.js';

/**
 * Write LSSD cross-post status to Firebase (best-effort, never throws).
 * Strips undefined values since Firebase rejects them.
 */
async function writeStatus(phmcTopicId, db, status, extra) {
    if (!phmcTopicId || !db) return;
    try {
        const update = { lssdCrosspostStatus: status, lssdCrosspostUpdatedAt: new Date().toISOString(), ...extra };
        // Remove keys with undefined values (Firebase rejects them)
        const clean = {};
        for (const [k, v] of Object.entries(update)) {
            if (v !== undefined) clean[k] = v;
        }
        await db.ref(`autopsy-requested/${phmcTopicId}`).update(clean);
    } catch (err) {
        console.warn('[AUTO-CROSSPOST] Failed to write status:', err.message);
    }
}

export async function crosspostAutopsyToLssd(reportData, bbCode, phmcTopicId, db) {
    logFnCall('deployLssd', 'crosspostAutopsyToLssd', 'Cross-posting to LSSD');
    const d = reportData?.data || {};
    const rawDept = d.department || '';
    const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)).toLowerCase();

    if (!deptStr.includes('lssd') && !deptStr.includes('sheriff')) {
        console.log('[AUTO-CROSSPOST] Not LSSD — skipping');
        return { ok: true, skipped: true };
    }

    // Track as pending so restart retry picks it up if something goes wrong
    await writeStatus(phmcTopicId, db, 'pending', { lssdCrosspostBbCode: bbCode, lssdCrosspostOoc: d.decedentOOC || d.oocName || '' });

    const searchTerm = (d.decedentOOC || d.oocName || d.decedentName || '').trim();
    if (!searchTerm) {
        console.log('[AUTO-CROSSPOST] No search term');
        return { ok: false, skipped: true };
    }

    console.log('[AUTO-CROSSPOST] Searching LSSD for "' + searchTerm + '"...');

    try {
        const client = getForumClient();
        await client.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: 'https://lssd.gta.world' });
        const results = await client.searchForum(searchTerm, null, { baseUrl: 'https://lssd.gta.world' });

        // Filter out LSSD threads that already have a completed cross-post
        const usedLssdTopics = new Set();
        if (phmcTopicId && state.dbRef) {
            try {
                const usedSnap = await state.dbRef.child('autopsy-requested').orderByChild('lssdTopicId').once('value');
                if (usedSnap.exists()) {
                    usedSnap.forEach((child) => {
                        const e = child.val();
                        if (e.lssdTopicId && e.completedAt) usedLssdTopics.add(e.lssdTopicId);
                    });
                }
            } catch (err) {
                console.warn('[AUTO-CROSSPOST] Failed to load used LSSD topics:', err.message);
            }
        }

        const seen = new Set();
        let unique = results.filter(r => {
            const title = (r.title || '').trim();
            if (!title || title === 'Jump to post' || seen.has(title)) return false;
            seen.add(title);
            return true;
        });

        if (usedLssdTopics.size > 0) {
            const before = unique.length;
            unique = unique.filter(t => !usedLssdTopics.has(t.topicId));
            if (unique.length < before) {
                console.log('[AUTO-CROSSPOST] Filtered out ' + (before - unique.length) + ' already-completed LSSD thread(s)');
            }
        }

        if (unique.length === 0) {
            console.log('[AUTO-CROSSPOST] No LSSD threads found for "' + searchTerm + '"');
            await writeStatus(phmcTopicId, db, 'no_thread', { lssdCrosspostOoc: searchTerm });
            return { ok: false, reason: 'No matching thread' };
        }

        const pickId = 'lssd_xp_' + (state.autopsyPickCounter++) + '_' + Date.now();

        if (!state.discordClient) {
            console.log('[AUTO-CROSSPOST] No Discord client — auto-picking first');
            const t = unique[0];
            const r = await client.replyToTopic(t.topicId, 2263, bbCode, { dryRun: false });
            const status = r.ok ? 'completed' : 'failed';
            await writeStatus(phmcTopicId, state.dbRef, status, {
                lssdTopicId: t.topicId,
                lssdCrosspostedAt: new Date().toISOString(),
                lssdCrosspostError: r.ok ? undefined : (r.reason || 'Unknown'),
            });
            return { ok: true, awaitingPick: true, pickId: pickId };
        }

        const embed = new EmbedBuilder()
            .setColor(0xffc107)
            .setTitle('LSSD Cross-Post - Pick a Thread')
            .setDescription([
                '**Report:** ' + (reportData.originalKey || 'Autopsy'),
                '**Search:** ' + searchTerm,
                '**Dept:** ' + deptStr,
                '',
                'Topics found:',
                ...unique.map((t, i) => (i + 1) + '. #' + t.topicId + ' - ' + (t.title || 'Unknown')),
            ].join('\n'))
            .setFooter({ text: 'Expires in 5 min | ' + pickId })
            .setTimestamp();

        const rows = [];
        for (let i = 0; i < unique.length; i += 3) {
            const chunk = unique.slice(i, i + 3);
            rows.push(new ActionRowBuilder().addComponents(
                chunk.map(t => new ButtonBuilder()
                    .setCustomId(pickId + '_' + t.topicId)
                    .setLabel('#' + t.topicId + ' ' + (t.title || '').slice(0, 50))
                    .setStyle(ButtonStyle.Primary))
            ));
        }
        rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(pickId + '_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
        ));

        const channelId = process.env.BOT_LOG_CHANNEL_ID;
        if (!channelId) throw new Error('No BOT_LOG_CHANNEL_ID');
        const channel = await state.discordClient.channels.fetch(channelId);
        await channel.send({ embeds: [embed], components: rows });

        state.pendingAutopsyPicks.set(pickId, { db: state.dbRef, authorId: null, key: null, phmcTopicId, topics: unique, reportData, bbCode, lssd: true });

        setTimeout(() => {
            if (state.pendingAutopsyPicks.has(pickId)) {
                state.pendingAutopsyPicks.delete(pickId);
                console.log('[AUTO-CROSSPOST] Pick ' + pickId + ' expired');
            }
        }, 5 * 60 * 1000);

        console.log('[AUTO-CROSSPOST] Waiting for staff to pick a thread for "' + searchTerm + '"');
        return { ok: true, awaitingPick: true, pickId: pickId };
    } catch (err) {
        console.error('[AUTO-CROSSPOST] Error:', err.message);
        await writeStatus(phmcTopicId, db, 'failed', { lssdCrosspostError: err.message });
        return { ok: false, error: err.message };
    }
}

/**
 * Scan for failed LSSD cross-posts on startup and retry them.
 * Called from startAutoDeploy().
 */
export async function retryFailedLssdCrossposts(db) {
    logFnCall('deployLssd', 'retryFailedLssdCrossposts', 'Scanning for failed cross-posts');
    if (!db) return;
    try {
        const snap = await db.ref('autopsy-requested').orderByChild('lssdCrosspostStatus').equalTo('failed').once('value');
        if (!snap.exists()) {
            console.log('[AUTO-CROSSPOST] No failed cross-posts to retry');
            return;
        }
        let retried = 0;
        const promises = [];
        snap.forEach((child) => {
            const entry = child.val();
            const phmcTopicId = child.key;
            if (!entry.lssdCrosspostBbCode) {
                console.log('[AUTO-CROSSPOST] Skipping failed entry ' + phmcTopicId + ' — no BBCode saved');
                return;
            }
            console.log('[AUTO-CROSSPOST] Retrying cross-post for ' + (entry.lssdCrosspostOoc || phmcTopicId));
            const reportData = { data: { decedentOOC: entry.lssdCrosspostOoc || '', department: 'LSSD' } };
            promises.push(
                crosspostAutopsyToLssd(reportData, entry.lssdCrosspostBbCode, phmcTopicId, db)
                    .then((r) => {
                        if (r.ok && !r.error) {
                            console.log('[AUTO-CROSSPOST] Retry succeeded for ' + phmcTopicId);
                        } else {
                            console.log('[AUTO-CROSSPOST] Retry failed for ' + phmcTopicId + ': ' + (r.error || r.reason || 'Unknown'));
                        }
                    })
            );
            retried++;
        });
        await Promise.allSettled(promises);
        console.log('[AUTO-CROSSPOST] Retried ' + retried + ' failed cross-post(s)');
    } catch (err) {
        console.error('[AUTO-CROSSPOST] Retry scan error:', err.message);
    }
}
