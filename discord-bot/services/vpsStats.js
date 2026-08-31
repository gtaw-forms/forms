/**
 * VPS Stats — lightweight host resource sampling for the dashboard.
 *
 * Reads everything from the `os` module (plus /proc/meminfo for accurate
 * available memory + swap on Linux). No child processes, no browser — cheap
 * enough to call every 30s. Falls back gracefully when /proc isn't present
 * (e.g. local Windows dev).
 */

import os from 'os';
import { readFileSync, readdirSync } from 'fs';

let _lastCpu = null;

function cpuSample() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
        const t = cpu.times;
        idle += t.idle;
        total += t.user + t.nice + t.sys + t.idle + t.irq;
    }
    return { idle, total };
}

function memInfo() {
    const total = os.totalmem();
    let available = os.freemem();
    if (process.platform === 'linux') {
        try {
            const data = readFileSync('/proc/meminfo', 'utf8');
            const m = data.match(/^MemAvailable:\s+(\d+)\s*kB/m);
            if (m) available = parseInt(m[1], 10) * 1024;
        } catch { /* fall back to os.freemem */ }
    }
    const used = total - available;
    return { total, used, pct: total > 0 ? (used / total) * 100 : 0 };
}

function swapInfo() {
    if (process.platform !== 'linux') return { total: 0, used: 0 };
    try {
        const data = readFileSync('/proc/meminfo', 'utf8');
        const t = data.match(/^SwapTotal:\s+(\d+)\s*kB/m);
        const f = data.match(/^SwapFree:\s+(\d+)\s*kB/m);
        const total = t ? parseInt(t[1], 10) * 1024 : 0;
        const free = f ? parseInt(f[1], 10) * 1024 : 0;
        return { total, used: total - free };
    } catch {
        return { total: 0, used: 0 };
    }
}

/**
 * Count live processes whose /proc/<pid>/cmdline contains namePart.
 * Linux only; returns null where unsupported.
 */
export function countProcesses(namePart) {
    if (process.platform !== 'linux') return null;
    let count = 0;
    try {
        for (const entry of readdirSync('/proc')) {
            if (!/^\d+$/.test(entry)) continue;
            try {
                const cmdline = readFileSync(`/proc/${entry}/cmdline`, 'utf8');
                if (cmdline.includes(namePart)) count++;
            } catch { /* process exited mid-scan */ }
        }
    } catch { /* /proc unreadable */ }
    return count;
}

const CHROME_LABELS = {
    main: 'main',
    renderer: 'renderer',
    'gpu-process': 'gpu',
    zygote: 'zygote',
    'network-service': 'network',
    utility: 'utility',
    broker: 'broker',
    'crashpad-handler': 'crashpad',
};

/**
 * Scan /proc and classify the live chrome-headless-shell and node processes.
 * A single Playwright browser spawns MANY OS processes (main, renderer, gpu,
 * zygote, network, utility) — this breaks the count down so the dashboard can
 * explain why e.g. "7 chrome" is actually one browser.
 */
export function scanProcesses() {
    const chrome = [];
    const node = [];
    if (process.platform !== 'linux') return { chrome, node };
    try {
        for (const entry of readdirSync('/proc')) {
            if (!/^\d+$/.test(entry)) continue;
            let cmdline;
            try { cmdline = readFileSync(`/proc/${entry}/cmdline`, 'utf8'); } catch { continue; }

            if (cmdline.includes('chrome-headless-shell')) {
                const m = cmdline.match(/--type=([a-z-]+)/);
                chrome.push({ pid: entry, type: m ? m[1] : 'main' });
            } else if (cmdline.includes('node')) {
                let label = 'node';
                if (cmdline.includes('morgue-api')) label = 'morgue-api';
                else if (cmdline.includes('index.js')) label = 'bot';
                else if (cmdline.includes('pm2')) label = 'pm2';
                node.push({ pid: entry, label });
            }
        }
    } catch { /* /proc unreadable */ }

    const chromeBreakdown = {};
    for (const p of chrome) {
        const k = CHROME_LABELS[p.type] || 'other';
        chromeBreakdown[k] = (chromeBreakdown[k] || 0) + 1;
    }
    const nodeBreakdown = {};
    for (const p of node) {
        nodeBreakdown[p.label] = (nodeBreakdown[p.label] || 0) + 1;
    }

    return {
        chrome: { total: chrome.length, breakdown: chromeBreakdown },
        node: { total: node.length, breakdown: nodeBreakdown },
    };
}

/**
 * Snapshot current VPS stats.
 * CPU% is computed as a delta since the previous call (first call waits ~250ms
 * so it always returns a real figure). Returns raw numbers; format elsewhere.
 */
export async function getVpsStats() {
    let cpuPct = null;
    {
        const now = cpuSample();
        if (_lastCpu) {
            const dTotal = now.total - _lastCpu.total;
            const dIdle = now.idle - _lastCpu.idle;
            if (dTotal > 0) {
                cpuPct = Math.max(0, Math.min(100, (1 - dIdle / dTotal) * 100));
            }
        }
        _lastCpu = now;
        if (cpuPct === null) {
            await new Promise(r => setTimeout(r, 250));
            const now2 = cpuSample();
            const dTotal = now2.total - now.total;
            const dIdle = now2.idle - now.idle;
            _lastCpu = now2;
            if (dTotal > 0) cpuPct = Math.max(0, Math.min(100, (1 - dIdle / dTotal) * 100));
        }
        if (cpuPct === null) cpuPct = 0;
    }

    const mem = memInfo();
    const swap = swapInfo();
    const [load1] = os.loadavg();
    const procs = scanProcesses();

    return {
        cpuPct,
        mem,
        swap,
        load: load1,
        uptime: os.uptime(),
        procs,
    };
}