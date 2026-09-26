/**
 * dashboardV2.js — PHMC System Dashboard rendered with Discord Components V2.
 *
 * Pure renderer: buildDashboardV2(data, opts) -> { flags, components, metrics }.
 * `data` is the exact shape gatherDashboardData() produces (same object the
 * legacy embed builder consumes), so the manager can swap renderers freely.
 *
 * Layout (5 top-level — every text lives inside a box, nothing floats
 * outside containers):
 *   1. Health Container (accent green/yellow/red): header + Forum Status + Services
 *   2. VPS Container: VPS Resources
 *   3. Ops Container: Deploy Queue + Face Posts + Scheduled Tasks
 *   4. Assignments Container (cyan accent): ME Assignments + footer marker
 *   5. Action Row: Refresh Now / Restart Bot (same customIds as legacy)
 *
 * Budgets (4000 text / 40 components / 10 top-level): measured on every
 * build; the variable-length Assignments block is trimmed first (row cap,
 * then "+N more"), fail-closed when still over. Reuses the battle-tested
 * counters from massPanelV2.js.
 *
 * Raw API JSON (no discord.js builders), same as massPanelV2.js.
 */

import { MessageFlags } from 'discord.js';
import { formatTimeSuffix } from './outstandingAutopsies.js';
import { measureV2Text, countV2Components, V2_TEXT_BUDGET, V2_COMPONENT_BUDGET } from './massPanelV2.js';
import { formatPostingLines, formatSessionLines } from './postingHealth.js';

export const DASH_V2_MARKER = '• v2';
const ACCENT_CYAN = 0x00bcd4;
// Leave headroom under the 4000 text budget for URL growth + discord counting.
const V2_TEXT_TARGET = 3800;
const ASSIGN_ROW_CAP_START = 12;

const td = (content) => ({ type: 10, content: String(content ?? '') });
const sep = (divider = true) => ({ type: 14, divider, spacing: 1 });

const truncate = (s, n) => {
    const str = String(s ?? '');
    return str.length <= n ? str : str.slice(0, Math.max(0, n - 3)) + '...';
};

/** True when a fetched message is a V2 dashboard (marker in footer text). */
export function isV2DashboardMessage(msg) {
    try {
        return JSON.stringify(msg?.components || []).includes(DASH_V2_MARKER);
    } catch {
        return false;
    }
}

function formatBytes(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
}

function formatUptime(sec) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function vpsText(vps, lastActivityFn, isBrowserActiveFn) {
    if (!vps) return 'pending…';
    const { cpuPct, mem, swap, load, uptime, procs } = vps;
    const memPct = mem && mem.total > 0 ? Math.round((mem.used / mem.total) * 100) : null;
    const swapPct = swap && swap.total > 0 ? Math.round((swap.used / swap.total) * 100) : null;
    const lines = [
        `**CPU** — ${cpuPct != null ? cpuPct.toFixed(1) + '%' : 'n/a'} (load ${load != null ? load.toFixed(2) : 'n/a'})`,
        `**MEM** — ${formatBytes(mem.used)} / ${formatBytes(mem.total)}${memPct != null ? ` (${memPct}%)` : ''}`,
    ];
    if (swapPct != null && swap.total > 0) {
        lines.push(`**SWAP** — ${formatBytes(swap.used)} / ${formatBytes(swap.total)} (${swapPct}%)`);
    }
    lines.push(`**Uptime** — ${formatUptime(uptime)}`);
    const chrome = procs?.chrome;
    const node = procs?.node;
    const chromeDetail = chrome?.breakdown && Object.keys(chrome.breakdown).length
        ? Object.entries(chrome.breakdown).map(([k, v]) => `${k} ${v}`).join(' · ')
        : null;
    const nodeDetail = node?.breakdown && Object.keys(node.breakdown).length
        ? Object.entries(node.breakdown).map(([k, v]) => `${k} ${v}`).join(' · ')
        : null;
    lines.push(
        `**Procs** — chrome ×${chrome?.total != null ? chrome.total : '?'}${chromeDetail ? ` (${chromeDetail})` : ''} · node ×${node?.total != null ? node.total : '?'}${nodeDetail ? ` (${nodeDetail})` : ''}`
    );
    try {
        const act = lastActivityFn ? lastActivityFn() : null;
        const active = isBrowserActiveFn ? isBrowserActiveFn() : false;
        lines.push(`**Browser** — ${active ? '🟢 Active' : '⚪ Idle'}`);
        if (act) {
            const ago = Math.floor((Date.now() - act.at) / 1000);
            const agoStr = ago < 60 ? `${ago}s ago` : ago < 3600 ? `${Math.floor(ago / 60)}m ago` : `${(ago / 3600).toFixed(1)}h ago`;
            lines.push(`**Last activity** — ${act.label} (${act.detail}) · ${agoStr}`);
        } else {
            lines.push('**Last activity** — none (no browser activity yet)');
        }
    } catch {
        lines.push('**Browser** — ⚪ Idle');
    }
    return lines.join('\n');
}

function assignmentLines(assignments, loaList, rowCap) {
    const lines = [];
    const loaLower = (loaList || []).map((n) => String(n).toLowerCase());
    const shown = (assignments || []).slice(0, rowCap);
    for (const a of shown) {
        const loaTag = loaLower.includes(String(a.name || '').toLowerCase()) ? ' [LOA]' : '';
        let linkLabel;
        if (a.label) linkLabel = a.label;
        else {
            const oocM = String(a.caseNum || '').match(/\(\(\s*(.*?)\s*\)\)/);
            linkLabel = oocM ? oocM[1] : a.caseNum || 'Case';
        }
        const caseLink = a.caseUrl ? `[${linkLabel}](<${a.caseUrl}>)` : `*${linkLabel}*`;
        const decedentSuffix = a.label && a.decedent ? ` (${a.decedent})` : '';
        const timeSuffix = formatTimeSuffix(a);
        lines.push(`**${a.name}**${loaTag} — ${caseLink}${decedentSuffix}${timeSuffix ? ` ${timeSuffix}` : ''}`);
    }
    const hidden = (assignments || []).length - shown.length;
    if (hidden > 0) lines.push(`*…and ${hidden} more*`);
    if ((loaList || []).length > 0) lines.push('', `_On LOA: ${loaList.join(', ')}_`);
    if (lines.length === 0) lines.push('No active assignments');
    return lines.join('\n');
}

/**
 * Build the V2 dashboard payload from gathered data.
 * @param {object} data — gatherDashboardData() output
 * @param {object} [opts]
 * @param {Function} [opts.emojiFor] — (name) => forum emoji string
 * @param {Function} [opts.lastActivity] — activityLog.lastActivity passthrough
 * @param {Function} [opts.isBrowserActive] — activityLog.isBrowserActive passthrough
 * @param {boolean} [opts.refreshing] — render the transient REFRESHING state
 * @returns {{flags: number, components: Array, metrics: object}}
 */
export function buildDashboardV2(data, opts = {}) {
    const d = data || {};
    const emojiFor = opts.emojiFor || ((n) => n);

    const forumLines = (d.forums || []).map((f) => {
        const parts = [emojiFor(f.name)];
        if (f.latency != null) parts.push(`${f.latency}ms`);
        parts.push(f.status);
        return parts.join(' ');
    }).join('\n') || 'No data';

    // Posting Status — write path, split from Website Online above.
    const posting = formatPostingLines(d.posting);
    // Sessions — forced-login churn per forum (leading indicator).
    const sessionLines = formatSessionLines(d.sessions);

    const servicesLines = [
        `**Cloudflare** — ${d.cloudflare?.emoji || '❓'} ${d.cloudflare?.text || 'Unknown'}`,
        `**GTAW UCP** — ${d.gtaw?.emoji || '❓'} ${d.gtaw?.text || 'Unknown'}`,
        `**Morgue** — ${d.morgue?.emoji || '❓'} ${d.morgue?.text || 'Unknown'}`,
    ].join('\n');

    const queue = d.queue || [];
    let queueLines = '✅ No reports awaiting deployment';
    if (queue.length > 0) {
        queueLines = queue.slice(0, 5).map((e) => {
            const icon = e.status === 'processing' ? '🔄 ' : e.status === 'retry' ? '🔁 ' : '';
            const timeStr = e.status === 'processing' ? 'Processing now' : `<t:${Math.floor(e.fireTime / 1000)}:R>`;
            return `${icon}**${e.label}** — ${timeStr}`;
        }).join('\n');
        if (queue.length > 5) queueLines += `\n…and ${queue.length - 5} more`;
    }

    const faceList = d.facePosts || [];
    let faceLines = '✅ None scheduled';
    if (faceList.length > 0) {
        faceLines = faceList.slice(0, 5).map((f) => `**${f.decedentName || f.reportKey}** — <t:${Math.floor(f.publishAt / 1000)}:R>`).join('\n');
        if (faceList.length > 5) faceLines += `\n…and ${faceList.length - 5} more`;
    }

    const taskLines = [];
    const rs = d.rosterSync;
    if (rs && rs.lastSyncAt) {
        const lastSync = `<t:${Math.floor(rs.lastSyncAt / 1000)}:R>`;
        const nextSync = rs.nextSyncAt ? `<t:${Math.floor(rs.nextSyncAt / 1000)}:R>` : 'pending...';
        taskLines.push(`📋 **Roster Sync** — every 12h (+random)\n└ LSPD: ${rs.lspdCount} | LSSD: ${rs.lssdCount} — last: ${lastSync} — next: ${nextSync}`);
    } else {
        taskLines.push('📋 **Roster Sync** — pending first sync');
    }
    const am = d.autopsyMonitor || {};
    if (am.active) {
        const intervalMin = Math.round((am.intervalMs || 300000) / 60000);
        const lastCheck = am.lastCheckTime ? `<t:${Math.floor(am.lastCheckTime / 1000)}:R>` : 'pending...';
        const statusIcon = am.lastCheckTime === null ? '⏳' : am.lastCheckSuccess ? '✅' : '❌';
        taskLines.push(`${statusIcon} **Autopsy Monitor** — every ${intervalMin}min (f=265)\n└ last check: ${lastCheck}`);
    } else if (am.statusError) {
        taskLines.push(`⚠️ **Autopsy Monitor** — status unavailable (${am.statusError})`);
    } else {
        taskLines.push('⏹️ **Autopsy Monitor** — inactive');
    }

    // Health accent follows the legacy embed colour logic, plus red when the
    // posting circuit breaker has any forum blocked.
    const badForum = (d.forums || []).some((f) => f.status === 'Unresponsive');
    const warnForum = (d.forums || []).some((f) => f.status === 'Bad');
    const accent = (badForum || posting.blocked) ? 0xdc3545 : (warnForum || (d.cloudflare && d.cloudflare.emoji === '⚠️')) ? 0xffc107 : 0x28a745;

    const header =
        `# PHMC System Dashboard\n` +
        `Last refreshed: <t:${Math.floor(Date.now() / 1000)}:R>\n` +
        `Data checked: ${d.lastCheckTime ? `<t:${Math.floor(d.lastCheckTime / 1000)}:R>` : 'awaiting first health check...'}`;

    // Trim loop: assignments shrink until the text budget holds.
    let rowCap = ASSIGN_ROW_CAP_START;
    let components = null;
    let textChars = 0;
    for (;;) {
        const assignText = assignmentLines(d.meAssignments || [], d.meLoa || [], rowCap);
        components = [
            {
                type: 17, accent_color: accent, components: [
                    td(header),
                    sep(false),
                    td(`## Forum Status\n${forumLines}`),
                    sep(false),
                    td(`## Posting Status\n${posting.lines}`),
                    ...(sessionLines ? [sep(false), td(`## Sessions\n${sessionLines}`)] : []),
                    sep(false),
                    td(`## Services\n${servicesLines}`),
                ],
            },
            {
                type: 17, components: [
                    td(`## VPS Resources\n${opts.refreshing ? '🔄 refreshing…' : vpsText(d.vps, opts.lastActivity, opts.isBrowserActive)}`),
                ],
            },
            {
                type: 17, components: [
                    td(`## Deploy Queue${queue.length ? ` (${queue.length})` : ''}\n${queueLines}`),
                    sep(false),
                    td(`## Scheduled Face Posts${faceList.length ? ` (${faceList.length})` : ''}\n${faceLines}`),
                    sep(false),
                    td(`## Scheduled Tasks\n${taskLines.join('\n') || 'None configured'}`),
                ],
            },
            {
                type: 17, accent_color: ACCENT_CYAN, components: [
                    td(`## ME Assignments${(d.meAssignments || []).length ? ` (${(d.meAssignments || []).length})` : ''}\n${assignText}`),
                    sep(false),
                    td(truncate(`*VPS stats live • full refresh every 10 minutes ${DASH_V2_MARKER}*`, 200)),
                ],
            },
            {
                type: 1, components: [
                    { type: 2, style: 2, label: 'Refresh Now', custom_id: 'dashboard_refresh', emoji: { name: '🔄' } },
                    { type: 2, style: 4, label: 'Restart Bot', custom_id: 'dashboard_restart', emoji: { name: '🔁' } },
                ],
            },
        ];
        textChars = measureV2Text(components);
        if (textChars <= V2_TEXT_TARGET || rowCap <= 2) break;
        rowCap = Math.max(2, Math.floor(rowCap / 2));
    }

    const metrics = {
        textChars,
        textBudget: V2_TEXT_BUDGET,
        componentCount: countV2Components(components),
        componentBudget: V2_COMPONENT_BUDGET,
        topLevel: components.length,
        assignRowCap: rowCap,
    };
    return { flags: MessageFlags.IsComponentsV2, components, metrics };
}
