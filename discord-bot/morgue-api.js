import { readFileSync, writeFileSync, existsSync, createWriteStream, renameSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ──────────────────────────────────────────
// Load .env manually (same as index.js)
// ──────────────────────────────────────────
function loadEnv() {
    const envPath = resolve(__dirname, '.env');
    if (!existsSync(envPath)) {
        console.warn('[MORGUE-API] No .env file found at', envPath);
        return;
    }

    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const sepIndex = trimmed.indexOf('=');
        if (sepIndex === -1) continue;
        const key = trimmed.slice(0, sepIndex).trim();
        const value = trimmed.slice(sepIndex + 1).trim();
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

loadEnv();

// ── Per-session file logger (logs/api-<timestamp>.log) ──
const { initLogger } = await import('./services/logger.js');
initLogger('api');

// ──────────────────────────────────────────
// Validate required env vars
// ──────────────────────────────────────────
if (!process.env.MORGUE_API_KEYS && !process.env.MORGUE_WRITE_API_KEYS) {
    console.error('[MORGUE-API] No API keys configured.');
    console.error('[MORGUE-API] Set MORGUE_API_KEYS (read-only) and/or MORGUE_WRITE_API_KEYS (write-allowed) in .env');
    console.error('[MORGUE-API] Example: MORGUE_API_KEYS=pmc_morgue_abc123');
    process.exit(1);
}

const API_KEYS = process.env.MORGUE_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
const WRITE_KEYS = (process.env.MORGUE_WRITE_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
const PORT = parseInt(process.env.MORGUE_API_PORT || '3001', 10);
const DISCORD_WEBHOOK_URL = process.env.MORGUE_API_LOG_WEBHOOK || null;

// ── IP ban config ──
// Bans are PERMANENT and persisted to disk (data/ban-state.json), so they
// survive restarts. An IP is banned after BAN_THRESHOLD suspicious requests.
const BAN_THRESHOLD = parseInt(process.env.MORGUE_BAN_THRESHOLD || '2', 10);       // suspicious requests before a permanent ban
const BAN_STATE_PATH = resolve(__dirname, 'data', 'ban-state.json');

console.log(`[MORGUE-API] Loaded ${API_KEYS.length} API key(s) (read-only) and ${WRITE_KEYS.length} write key(s)`);
console.log(`[MORGUE-API] Configured port: ${PORT}`);
console.log(`[MORGUE-API] IP ban: ${BAN_THRESHOLD} suspicious request(s) → permanent ban (persisted to ${BAN_STATE_PATH})`);
if (DISCORD_WEBHOOK_URL) {
    console.log(`[MORGUE-API] Discord webhook logging enabled`);
} else {
    console.log(`[MORGUE-API] No MORGUE_API_LOG_WEBHOOK set — skipping Discord logs`);
}

// ──────────────────────────────────────────
// Initialize Firebase
// ──────────────────────────────────────────
import firebase from './services/firebase.js';
firebase.init();

// ──────────────────────────────────────────
// Local file storage (mirrors Firebase RTDB structure)
// ──────────────────────────────────────────
const MORGUE_DATA_PATH = resolve(__dirname, 'morgue-data.json');
const MORGUE_META_PATH = resolve(__dirname, 'morgue-meta.json');

/**
 * Load all records from the local data file.
 * Structure: { "caseId": { ...record }, "caseId2": { ...record } }
 * Mirrors Firebase RTDB: morgue-records/{caseId}
 */
function loadLocalData() {
    if (!existsSync(MORGUE_DATA_PATH)) return {};
    try {
        return JSON.parse(readFileSync(MORGUE_DATA_PATH, 'utf-8'));
    } catch (err) {
        console.warn('[MORGUE-API] Failed to parse local morgue data:', err.message);
        return {};
    }
}

/**
 * Upsert a single record into the local data file.
 * Returns the saved record with updated lastUpdated and firebaseKey.
 */
function saveLocalRecord(caseId, record) {
    const data = loadLocalData();
    data[caseId] = {
        ...record,
        caseId,
        firebaseKey: caseId,
        lastUpdated: Date.now(),
        source: record.source || 'API',
    };
    writeFileSync(MORGUE_DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return data[caseId];
}

/**
 * Delete a record from the local data file by caseId.
 */
function deleteLocalRecord(caseId) {
    const data = loadLocalData();
    const deleted = data[caseId] || null;
    if (data[caseId]) {
        delete data[caseId];
        writeFileSync(MORGUE_DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
    }
    return deleted;
}

/**
 * Read the local version meta file.
 */
function getLocalVersion() {
    if (!existsSync(MORGUE_META_PATH)) return null;
    try {
        return JSON.parse(readFileSync(MORGUE_META_PATH, 'utf-8')).version || null;
    } catch { return null; }
}

/**
 * Write the local version meta file.
 */
function setLocalVersion(version) {
    writeFileSync(MORGUE_META_PATH, JSON.stringify({ version }), 'utf-8');
}

// ──────────────────────────────────────────
// Express setup
// ──────────────────────────────────────────
import express from 'express';
const app = express();

// ── Body parser for write endpoints ──
app.use(express.json({ limit: '1mb' }));

// ── Input sanitization middleware ──
function sanitizeInputs(req, _res, next) {
    if (req.query) {
        for (const [k, v] of Object.entries(req.query)) {
            if (typeof v === 'string') req.query[k] = v.replace(/[\x00-\x1f\x7f]/g, '');
        }
    }
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
        for (const [k, v] of Object.entries(req.body)) {
            if (typeof v === 'string') req.body[k] = v.replace(/[\x00-\x1f\x7f]/g, '').trim();
        }
    }
    next();
}
app.use(sanitizeInputs);

// ── Rate limiting (simple in-memory) ──
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60_000;     // 1 minute
const RATE_LIMIT_MAX = 60;            // 60 requests per minute per key

function rateLimiter(req, res, next) {
    const key = req.apiKeyName || 'unknown';
    const now = Date.now();

    if (!rateLimitMap.has(key)) {
        rateLimitMap.set(key, { count: 1, windowStart: now });
        return next();
    }

    const entry = rateLimitMap.get(key);
    if (now - entry.windowStart > RATE_LIMIT_WINDOW) {
        entry.count = 1;
        entry.windowStart = now;
        return next();
    }

    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
        return res.status(429).json({
            error: 'Too many requests',
            message: `Rate limit of ${RATE_LIMIT_MAX} requests per minute exceeded.`,
        });
    }

    next();
}

// Clean up stale rate-limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
        if (now - entry.windowStart > RATE_LIMIT_WINDOW * 2) {
            rateLimitMap.delete(key);
        }
    }
}, 300_000);

// ── IP ban tracking (per suspicious request count) ──
// An IP is PERMANENTLY banned after BAN_THRESHOLD suspicious requests. Bans and
// strike counts are persisted to disk (data/ban-state.json) so they survive
// restarts — a banned scanner doesn't get a fresh slate on reboot.
const ipBanMap = new Map();

function isIpBanned(ip) {
    const entry = ipBanMap.get(ip);
    return !!(entry && entry.banned);
}

/** Load persisted ban state (bans + strike counts) on startup. */
function loadBanState() {
    try {
        if (!existsSync(BAN_STATE_PATH)) return;
        const data = JSON.parse(readFileSync(BAN_STATE_PATH, 'utf-8'));
        for (const [ip, entry] of Object.entries(data)) {
            if (!entry || typeof entry !== 'object') continue;
            ipBanMap.set(ip, {
                count: entry.count || 0,
                banned: !!entry.banned,
                reason: entry.reason || '',
                bannedAt: entry.bannedAt || 0,
                lastSeen: entry.lastSeen || Date.now(),
            });
        }
        console.log(`[MORGUE-API] Loaded ${ipBanMap.size} persisted IP ban-state entr${ipBanMap.size === 1 ? 'y' : 'ies'}`);
    } catch (e) {
        console.warn(`[MORGUE-API] Could not load ban state: ${e.message}`);
    }
}

let _persistTimer = null;
/** Debounced atomic write of the ban map to disk. */
function persistBanState() {
    if (_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
        try {
            const out = {};
            for (const [ip, entry] of ipBanMap) {
                out[ip] = {
                    count: entry.count,
                    banned: !!entry.banned,
                    reason: entry.reason || '',
                    bannedAt: entry.bannedAt || 0,
                    lastSeen: entry.lastSeen,
                };
            }
            const tmp = BAN_STATE_PATH + '.tmp';
            writeFileSync(tmp, JSON.stringify(out, null, 2));
            renameSync(tmp, BAN_STATE_PATH);
        } catch (e) {
            console.warn(`[MORGUE-API] Could not persist ban state: ${e.message}`);
        }
    }, 500);
}

/**
 * High-confidence scanner/CVE probes (label starts with CVE- or SCAN-) are
 * banned on FIRST hit — e.g. phpunit eval, .env, wp-admin, git config scans.
 * Ambiguous attack attempts (RCE/SQLi/path-traversal/SSTI) use the strike rule.
 */
function isObviousScanner(label) {
    return /^(CVE|SCAN)-/i.test(label || '');
}

/**
 * Trust-list guard so OUR OWN tooling can never ban itself: loopback addresses
 * are always trusted, plus any IP listed in MORGUE_API_TRUSTED_IPS (comma-
 * separated). Trusted IPs skip strike/ban registration entirely.
 */
const TRUSTED_IPS_ENV = (process.env.MORGUE_API_TRUSTED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
const LOOPBACK_RE = /^(127\.|::1$|::ffff:127\.)/i;
function isTrustedIp(ip) {
    if (!ip) return false;
    if (LOOPBACK_RE.test(ip)) return true;
    return TRUSTED_IPS_ENV.includes(ip);
}

/**
 * Record a suspicious request for an IP. Obvious scanner/CVE probes ban
 * immediately; other attempts permanently ban the IP once the threshold is
 * hit. Returns true if this call triggered a ban.
 */
function registerSuspiciousRequest(ip, reason, instant = false) {
    const now = Date.now();
    let entry = ipBanMap.get(ip);
    if (!entry) {
        entry = { count: 0, banned: false, reason: '', bannedAt: 0, lastSeen: now };
        ipBanMap.set(ip, entry);
    }
    entry.lastSeen = now;

    // Already permanently banned — nothing more to do.
    if (entry.banned) return true;

    // Obvious scanner/CVE probe → permanent ban on first hit.
    if (instant) {
        entry.banned = true;
        entry.reason = reason || 'suspicious request(s)';
        entry.bannedAt = now;
        console.warn(
            `[MORGUE-API] [WARN] IP BANNED ${ip} permanently (instant) for ${entry.reason}`
        );
        sendIpBanAlert(ip, entry.reason).catch(() => {});
        persistBanState();
        return true;
    }

    entry.count++;
    if (entry.count >= BAN_THRESHOLD) {
        entry.banned = true;
        entry.reason = reason || 'suspicious request(s)';
        entry.bannedAt = now;
        console.warn(
            `[MORGUE-API] [WARN] IP BANNED ${ip} permanently for ${entry.reason} after ${BAN_THRESHOLD} suspicious request(s)`
        );
        sendIpBanAlert(ip, entry.reason).catch(() => {});
        persistBanState();
        return true;
    }
    // Persist the running strike count too, so strikes survive restarts.
    persistBanState();
    return false;
}

/** Immediate high-priority Discord alert confirming a permanent ban. */
async function sendIpBanAlert(ip, reason) {
    if (!DISCORD_WEBHOOK_URL) return;
    const msg = [
        `**[MORGUE-API] [WARN] IP permanently banned**`,
        `IP \`${ip}\` was banned for \`${reason || 'suspicious request(s)'}\``,
        `**Threshold:** ${BAN_THRESHOLD} suspicious request(s)`,
        `**Duration:** permanent`,
        `**Time:** ${new Date().toISOString()}`,
    ].join('\n');
    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: msg.slice(0, 1990) }),
        });
    } catch (err) {
        console.warn(`[MORGUE-API] IP ban alert webhook failed: ${err.message}`);
    }
}

// ── CORS ──
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'x-api-key, content-type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// ── Write method restriction ──
// PUT and DELETE require a key from MORGUE_WRITE_API_KEYS. Regular API keys
// (MORGUE_API_KEYS) are blocked. Write operations are always flagged prominently.
app.use((req, res, next) => {
    if (req.method === 'PUT' || req.method === 'DELETE') {
        const ip = req.clientIp || 'unknown';
        const ua = (req.headers['user-agent'] || '').replace(/[\x00-\x1f]/g, '').slice(0, 120);
        const key = req.headers['x-api-key'] || '';

        // Check if this is a write/allowed key
        const isWriteKey = WRITE_KEYS.length > 0 && WRITE_KEYS.includes(key);

        if (isWriteKey) {
            // Admin write key — allow but flag prominently
            req.apiKeyName = `admin_${key.slice(0, 16)}...`;
            req.isAdminKey = true;
            console.warn(
                `[MORGUE-API] [INFO] WRITE ${req.method} ${req.originalUrl} ` +
                `by admin key from ${ip} ua="${ua}"`
            );

            if (DISCORD_WEBHOOK_URL) {
                fetch(DISCORD_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: [
                            `**[MORGUE-API] Write operation**`,
                            `**Method:** \`${req.method}\``,
                            `**Route:** \`${req.originalUrl}\``,
                            `**By:** \`admin key\``,
                            `**IP:** \`${ip}\``,
                            `**UA:** \`${ua}\``,
                        ].join('\n').slice(0, 1990),
                    }),
                }).catch(() => {});
            }
            return next();
        }

        // Regular key or no key — block
        const keyLabel = key ? `key_${key.slice(0, 16)}...` : 'no-key';
        console.warn(
            `[MORGUE-API] [WARN] Blocked ${req.method} ${req.originalUrl} ` +
            `from ${ip} [${keyLabel}] ua="${ua}"`
        );

        if (DISCORD_WEBHOOK_URL) {
            fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: [
                        `**[MORGUE-API] [WARN] Blocked write attempt**`,
                        `**Method:** \`${req.method}\``,
                        `**Route:** \`${req.originalUrl}\``,
                        `**IP:** \`${ip}\``,
                        `**Key:** \`${keyLabel}\``,
                        `**UA:** \`${ua}\``,
                    ].join('\n').slice(0, 1990),
                }),
            }).catch(() => {});
        }

        return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: 'Write operations (PUT/DELETE) require a write API key.',
        });
    }
    next();
});

// ── Morgue data version (from local meta file, NOT Firebase) ──
let cachedVersion = null;
let versionLastFetched = 0;
const VERSION_CACHE_TTL = 30_000; // 30 seconds

function getMorgueVersion() {
    const now = Date.now();
    if (cachedVersion !== null && now - versionLastFetched < VERSION_CACHE_TTL) {
        return cachedVersion;
    }
    cachedVersion = getLocalVersion();
    versionLastFetched = now;
    return cachedVersion;
}

// Refresh version from meta file every 30 seconds
setInterval(() => {
    cachedVersion = getLocalVersion();
    versionLastFetched = Date.now();
}, VERSION_CACHE_TTL).unref();

/**
 * Load records from local data file, returned as an array.
 * Each record has the local-caseId key set as firebaseKey for API consistency.
 */
function getLocalRecords() {
    const data = loadLocalData();
    return Object.values(data).map(r => ({
        ...r,
        firebaseKey: r.firebaseKey || r.caseId,
    }));
}

/**
 * Generate tolerant spelling variants of one search token: the token itself,
 * all adjacent-transposition swaps, and all single-character deletions.
 * Catches common typos like "Autospy" -> "Autopsy" without any heavyweight
 * edit-distance machinery. Length floor keeps variants meaningful.
 */
function queryTokenVariants(token) {
    const q = String(token || '').toLowerCase().trim();
    if (!q) return [];
    const set = new Set([q]);
    for (let i = 0; i < q.length - 1; i++) {
        if (q[i] !== q[i + 1]) set.add(q.slice(0, i) + q[i + 1] + q[i] + q.slice(i + 2));
    }
    for (let i = 0; i < q.length; i++) {
        const v = q.slice(0, i) + q.slice(i + 1);
        if (v.length >= 4) set.add(v);
    }
    return [...set];
}

/** True when EVERY query token (or a typo-variant of it) appears in hay. */
function fuzzyTokenMatch(hay, qLower) {
    if (hay.includes(qLower)) return true;
    const tokens = qLower.split(/\s+/).filter(t => t.length >= 3);
    if (tokens.length === 0) return false;
    return tokens.every(tok => {
        for (const v of queryTokenVariants(tok)) {
            if (hay.includes(v)) return true;
        }
        return false;
    });
}

/**
 * Search local records by name, caseId, or location.
 * Matching is case-insensitive substring AND typo-tolerant per token
 * (one adjacent swap or one dropped character), so external consumers'
 * near-miss queries — "Autospy Test", "Jane Doe!" — still resolve.
 */
function searchLocalRecords(query) {
    const records = getLocalRecords();
    if (!query || !query.trim()) return records;
    const q = query.toLowerCase().trim();
    const hays = new Map();
    return records.filter(r => {
        let hay = hays.get(r);
        if (hay === undefined) {
            hay = `${r.name || ''} ${String(r.caseId || '')} ${r.location || ''}`.toLowerCase();
            hays.set(r, hay);
        }
        return fuzzyTokenMatch(hay, q);
    });
}

// ── API key validation middleware ──
// Regular API keys (MORGUE_API_KEYS) get read-only access (GET + POST).
// Write keys (MORGUE_WRITE_API_KEYS) can also do PUT/DELETE.
function validateApiKey(req, res, next) {
    const key = req.headers['x-api-key'];

    if (!key) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing API key. Provide it via x-api-key header.',
        });
    }

    // Check both key sets
    const isWriteKey = WRITE_KEYS.length > 0 && WRITE_KEYS.includes(key);
    const isReadKey = API_KEYS.includes(key);

    if (!isWriteKey && !isReadKey) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid API key.',
        });
    }

    req.apiKeyName = isWriteKey
        ? `admin_${key.slice(0, 16)}...`
        : `key_${key.slice(0, 16)}...`;
    req.isAdminKey = isWriteKey;
    next();
}

// ── Activity log (last 200 calls in memory) ──
const activityLog = [];
const MAX_ACTIVITY = 200;

function recordActivity(req, statusCode, ms, ip, ua, suspicious) {
    const source = req.query.source || '';
    const entry = {
        id: req.requestId || null,
        time: new Date().toISOString(),
        method: req.method,
        path: req.path,
        query: req.query.q || null,
        source: source || null,
        key: req.apiKeyName || 'no-key',
        status: statusCode,
        ms,
        ip: ip || req.clientIp || null,
        ua: ua || null,
        suspicious: suspicious || null,
        note: req.fetchSummary || null,
    };
    activityLog.push(entry);
    if (activityLog.length > MAX_ACTIVITY) activityLog.shift();
}

// ── Discord webhook logging (batched) ──
const webhookBatch = [];
const WEBHOOK_FLUSH_INTERVAL = 30_000; // flush every 30 seconds
const WEBHOOK_BATCH_MAX = 10;          // or every 10 entries, whichever first
let webhookTimer = null;

function queueWebhookLog(entry) {
    if (!DISCORD_WEBHOOK_URL) return;
    webhookBatch.push(entry);
    if (webhookBatch.length >= WEBHOOK_BATCH_MAX) {
        if (webhookTimer) {
            clearTimeout(webhookTimer);
            webhookTimer = null;
        }
        flushWebhookBatch();
    } else if (!webhookTimer) {
        webhookTimer = setTimeout(flushWebhookBatch, WEBHOOK_FLUSH_INTERVAL);
    }
}

async function flushWebhookBatch() {
    webhookTimer = null;
    const batch = webhookBatch.splice(0);
    if (!batch.length || !DISCORD_WEBHOOK_URL) return;

    // Build a compact message — group lines into one embed
    let lines = [];
    for (const e of batch) {
        const q = e.query ? ` q="${e.query}"` : '';
        const s = e.source ? ` src="${e.source}"` : '';
        const n = e.note ? ` ${e.note}` : '';
        lines.push(`\`${e.time.slice(11, 19)}\` **${e.method}** \`${e.path}\` → ${e.status} (${e.ms}ms) [${e.key}]${q}${s}${n}`);
    }

    // Discord has a 2000-char limit on webhook content
    let msg = `**[MORGUE-API]** ${batch.length} call(s)\n${lines.join('\n')}`;
    if (msg.length > 1900) {
        msg = msg.slice(0, 1897) + '...';
    }

    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: msg }),
        });
    } catch (err) {
        console.warn(`[MORGUE-API] Failed to send webhook log: ${err.message}`);
    }
}

// ──────────────────────────────────
// Security: input sanitization
// ──────────────────────────────────

/** Strip control characters from string inputs (prevents log injection, etc.) */
function sanitize(val) {
    if (typeof val === 'string') return val.replace(/[\x00-\x1f\x7f]/g, '').trim();
    if (Array.isArray(val)) return val.map(sanitize);
    if (val && typeof val === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(val)) out[k] = sanitize(v);
        return out;
    }
    return val;
}

// ──────────────────────────────────
// Security: suspicious pattern detection
// ──────────────────────────────────
const SUSPICIOUS_PATTERNS = [
    // RCE / command injection
    { pattern: /eval\s*\(/i,              label: 'RCE-eval' },
    { pattern: /exec\s*\(/i,              label: 'RCE-exec' },
    { pattern: /system\s*\(/i,            label: 'RCE-system' },
    { pattern: /passthru\s*\(/i,          label: 'RCE-passthru' },
    { pattern: /shell_exec/i,             label: 'RCE-shell_exec' },
    { pattern: /pcntl_exec/i,             label: 'RCE-pcntl_exec' },
    { pattern: /popen\s*\(/i,             label: 'RCE-popen' },
    { pattern: /proc_open/i,              label: 'RCE-proc_open' },
    { pattern: /`[^`]+`/,                 label: 'RCE-backtick' },
    { pattern: /\$\(/,                    label: 'RCE-subshell' },
    { pattern: /\|\s*(sh|bash|cmd|ping|nslookup|wget|curl)\s/i,
                                           label: 'RCE-pipe-shell' },

    // Path traversal
    { pattern: /\.\.(\/|\\){2,}/,         label: 'TRAVERSAL-double' },
    { pattern: /%2e%2e%2f/i,             label: 'TRAVERSAL-url-encoded' },
    { pattern: /%c0%ae/i,                label: 'TRAVERSAL-unicode' },
    { pattern: /\.\.\/\.\.\//,            label: 'TRAVERSAL-updir' },

    // Known CVE / scanner probes
    { pattern: /eval-stdin\.php/i,        label: 'CVE-phpunit-eval' },
    { pattern: /phpunit/i,                label: 'SCAN-phpunit' },
    { pattern: /\.env/i,                  label: 'SCAN-dotenv' },
    { pattern: /wp-admin/i,               label: 'SCAN-wordpress' },
    { pattern: /xmlrpc/i,                 label: 'SCAN-xmlrpc' },
    { pattern: /actuator/i,               label: 'SCAN-actuator' },
    { pattern: /swagger/i,                label: 'SCAN-swagger' },
    { pattern: /server-status/i,          label: 'SCAN-server-status' },
    { pattern: /adminer/i,                label: 'SCAN-adminer' },
    // API-scanner families observed hitting morgue-api in the wild (2026-08)
    { pattern: /hassio(_ingress)?\//i,     label: 'SCAN-hassio' },
    { pattern: /\/api\/auth\/cognito/i,    label: 'SCAN-cognito' },
    { pattern: /\/api\/jmeter/i,           label: 'SCAN-jmeter' },
    { pattern: /\/api\/runscript/i,        label: 'SCAN-runscript' },
    { pattern: /supervisor\/info/i,        label: 'SCAN-supervisor' },
    { pattern: /router\/mesh\/status/i,    label: 'SCAN-mesh-probe' },
    // Encoded-traversal variants missed by the earlier traversal rules
    { pattern: /%252e|%252f|%255c|%\t\.|\.\x09\./i, label: 'SCAN-traversal-encoded' },
    { pattern: /phpmyadmin/i,             label: 'SCAN-phpmyadmin' },
    { pattern: /\.git\/config/i,          label: 'SCAN-git-config' },
    { pattern: /\.git\/HEAD/i,            label: 'SCAN-git-head' },
    { pattern: /composer\.json/i,         label: 'SCAN-composer' },
    { pattern: /laravel/i,                label: 'SCAN-laravel' },

    // SQL injection probes
    { pattern: /'?\s*OR\s+['"]?\d*['"]?\s*=\s*['"]?\d*['"]?/i,
                                           label: 'SQLI-or-tautology' },
    { pattern: /union\s+(all\s+)?select/i, label: 'SQLI-union' },
    { pattern: /waitfor\s+delay/i,        label: 'SQLI-timing' },
    { pattern: /pg_sleep/i,               label: 'SQLI-pg_sleep' },
    { pattern: /';.*--/i,                 label: 'SQLI-comment' },
    { pattern: /1=1/i,                    label: 'SQLI-1=1' },

    // Prototype pollution
    { pattern: /__proto__/i,              label: 'PROTO-pollution' },
    { pattern: /constructor/i,             label: 'PROTO-constructor' },

    // Server-side template injection
    { pattern: /\{\{.*\}\}/i,             label: 'SSTI-double-brace' },
    { pattern: /<%=.*%>/i,               label: 'SSTI-erb' },
    { pattern: /\$\{.*\}/i,              label: 'SSTI-dollar-brace' },
];

/**
 * Check a string against all suspicious patterns.
 * Returns first match { pattern, label, match } or null.
 */
function detectSuspicious(input) {
    if (!input || typeof input !== 'string') return null;
    for (const check of SUSPICIOUS_PATTERNS) {
        const match = input.match(check.pattern);
        if (match) return { label: check.label, match: match[0] };
    }
    return null;
}

/**
 * Send an immediate high-priority alert for suspicious requests.
 * Bypasses the batched webhook queue — sends right away.
 */
async function sendSuspiciousAlert(req, finding, ip) {
    if (!DISCORD_WEBHOOK_URL) return;

    const bodySnippet = req.body && typeof req.body === 'object'
        ? '```json\n' + JSON.stringify(req.body).slice(0, 500) + '\n```'
        : '_no body_';

    const msg = [
        `**[MORGUE-API] [WARN] Suspicious request detected**`,
        `**Pattern:** \`${finding.label}\``,
        `**Match:** \`${finding.match}\``,
        `**IP:** \`${ip}\``,
        `**Route:** \`${req.method} ${req.originalUrl}\``,
        `**UA:** \`${(req.headers['user-agent'] || 'none').slice(0, 200)}\``,
        `**Key:** \`${req.apiKeyName || 'no-key'}\``,
        `**Body:** ${bodySnippet}`,
    ].join('\n');

    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: msg.slice(0, 1990) }),
        });
    } catch (err) {
        console.warn(`[MORGUE-API] Suspicious alert webhook failed: ${err.message}`);
    }
}

// ──────────────────────────────────
// Security & logging middleware
// ──────────────────────────────────

/** Extract client IP from request, respecting proxies. */
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    const realIp = req.headers['x-real-ip'];
    if (realIp) return realIp;
    return req.socket?.remoteAddress || 'unknown';
}

app.use((req, res, next) => {
    // ── Attach unique request ID ──
    req.requestId = randomUUID().slice(0, 8);

    // ── Attach client IP ──
    req.clientIp = getClientIp(req);

    const ip = req.clientIp;

    // Authorized API clients (valid x-api-key) are never IP-reputation blocked.
    // Cloud Functions egresses from shared Google Cloud IPs that scanners have
    // been banned on; a keyed request must not 403/ban based on IP alone.
    const apiKeyHeader = req.headers['x-api-key'];
    const hasValidApiKey = !!apiKeyHeader && (
        (API_KEYS.length > 0 && API_KEYS.includes(apiKeyHeader)) ||
        (WRITE_KEYS.length > 0 && WRITE_KEYS.includes(apiKeyHeader))
    );
    req.hasValidApiKey = hasValidApiKey;

    // ── Ban check: reject known-bad IPs before doing anything else ──
    if (isIpBanned(ip) && !hasValidApiKey) {
        const banReason = ipBanMap.get(ip)?.reason || 'suspicious request(s)';
        console.warn(
            `[MORGUE-API] [WARN] BLOCKED req=${req.requestId} ${req.method} ${req.originalUrl} ` +
            `BANNED_IP ip=${ip}`
        );
        recordActivity(req, 403, 0, ip,
            (req.headers['user-agent'] || '').replace(/[\x00-\x1f]/g, '').slice(0, 120),
            `BANNED:${banReason}`
        );
        return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: `IP permanently banned (${banReason}).`,
        });
    }

    // ── Check all attack surfaces for suspicious patterns ──
    const checkTargets = [req.path, req.originalUrl];
    if (req.query.q) checkTargets.push(req.query.q);
    if (req.query.source) checkTargets.push(req.query.source);
    if (req.query.name) checkTargets.push(req.query.name);
    if (req.body && typeof req.body === 'object') {
        for (const val of Object.values(req.body)) {
            if (typeof val === 'string') checkTargets.push(val);
        }
    }

    let suspiciousFinding = null;
    for (const target of checkTargets) {
        const finding = detectSuspicious(target);
        if (finding) {
            suspiciousFinding = finding;
            break;
        }
    }

    // ── Fire-and-forget alert if suspicious, THEN BLOCK ──
    // (Trusted IPs — loopback / MORGUE_API_TRUSTED_IPS — skip strikes & bans
    // so our own probes and health checks can never self-ban.)
    if (suspiciousFinding && !isTrustedIp(ip) && !hasValidApiKey) {
        sendSuspiciousAlert(req, suspiciousFinding, ip).catch(() => {});
        console.warn(
            `[MORGUE-API] [WARN] BLOCKED req=${req.requestId} ${req.method} ${req.originalUrl} ` +
            `SUSPICIOUS=${suspiciousFinding.label} match="${suspiciousFinding.match}" ip=${ip}`
        );
        // Record the blocked attempt in activity log
        recordActivity(req, 403, 0, ip,
            (req.headers['user-agent'] || '').replace(/[\x00-\x1f]/g, '').slice(0, 120),
            `BLOCKED:${suspiciousFinding.label}`
        );
        // Count toward the IP ban — obvious scanner/CVE probes ban instantly.
        registerSuspiciousRequest(ip, suspiciousFinding.label, isObviousScanner(suspiciousFinding.label));
        return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: 'Request blocked.',
        });
    }

    // ── Timing + logging ──
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;

        const source = req.query.source ? ` src="${sanitize(req.query.source)}"` : '';
        const ua = (req.headers['user-agent'] || '').replace(/[\x00-\x1f]/g, '').slice(0, 120);
        const label = suspiciousFinding
            ? ` [SUSPICIOUS:${suspiciousFinding.label}]`
            : '';

        const summary = req.fetchSummary ? ` note="${sanitize(req.fetchSummary)}"` : '';
        console.log(
            `[MORGUE-API] [${req.requestId}] ${req.method} ${req.path} ` +
            `→ ${res.statusCode} (${ms}ms) [${req.apiKeyName || 'no-key'}]` +
            ` ip=${ip}${source} ua="${ua}"${label}${summary}`
        );

        // Store in activity log with new fields
        recordActivity(req, res.statusCode, ms, ip, ua, suspiciousFinding?.label);

        // Queue webhook log
        queueWebhookLog({
            time: new Date().toISOString(),
            method: req.method,
            path: req.path,
            query: req.query.q || null,
            source: req.query.source || null,
            key: req.apiKeyName || 'no-key',
            status: res.statusCode,
            ms,
            ip,
            ua: ua.slice(0, 80),
            suspicious: suspiciousFinding?.label || null,
            note: req.fetchSummary || null,
        });
    });
    next();
});

// ──────────────────────────────────────────
// Routes
// ──────────────────────────────────────────

/**
 * GET /api/morgue
 * Returns all morgue records.
 *
 * Query params:
 *   q       - Search term (matches name, caseId, location)
 *   limit   - Max records to return (default 100, max 500)
 *
 * Headers:
 *   x-api-key - Your API key (query param ?key= is no longer supported)
 */
app.get('/api/morgue', validateApiKey, rateLimiter, (req, res) => {
    try {
        const query = (req.query.q || '').trim();
        const limit = Math.min(parseInt(req.query.limit || '10000', 10) || 10000, 10000);

        let records = query ? searchLocalRecords(query) : getLocalRecords();

        // Sort by lastUpdated descending (most recent first)
        records.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

        const paginated = records.slice(0, limit);
        const version = getMorgueVersion();

        res.json({
            success: true,
            count: paginated.length,
            total: records.length,
            query: query || null,
            morgueDataVersion: version,
            records: paginated,
        });
    } catch (error) {
        console.error('[MORGUE-API] Error fetching morgue records:', error.message);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to fetch morgue records.',
        });
    }
});

/**
 * GET /api/morgue/drug
 * Returns only morgue records that have narcotics data.
 * Records with empty/null/"N/A"/"None" narcotics are excluded.
 *
 * Query params:
 *   q       - Search term (matches name, caseId, location)
 *   limit   - Max records to return (default 100, max 500)
 *
 * Headers:
 *   x-api-key - Your API key
 */
app.get('/api/morgue/drug', validateApiKey, rateLimiter, (req, res) => {
    try {
        const query = (req.query.q || '').trim();
        const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);

        let records = query ? searchLocalRecords(query) : getLocalRecords();

        const drugRecords = records.filter(r => {
            const narc = (r.narcotics || '').trim();
            return narc && narc !== 'N/A' && narc !== 'None' && narc !== 'Unknown' && narc !== '';
        });

        drugRecords.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

        const paginated = drugRecords.slice(0, limit);

        res.json({
            success: true,
            count: paginated.length,
            total: drugRecords.length,
            query: query || null,
            morgueDataVersion: getMorgueVersion(),
            records: paginated,
        });
    } catch (error) {
        console.error('[MORGUE-API] Error fetching drug records:', error.message);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to fetch drug records.',
        });
    }
});

/**
 * GET /api/morgue/:firebaseKey
 * Returns a single morgue record by its Firebase key.
 *
 * Headers:
 *   x-api-key - Your API key
 */
app.get('/api/morgue/:firebaseKey', validateApiKey, rateLimiter, (req, res) => {
    try {
        const { firebaseKey } = req.params;

        if (!firebaseKey || firebaseKey.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Bad request',
                message: 'Invalid firebaseKey.',
            });
        }

        const records = getLocalRecords();
        const record = records.find(r => r.firebaseKey === firebaseKey || String(r.caseId) === firebaseKey);

        if (!record) {
            return res.status(404).json({
                success: false,
                error: 'Not found',
                message: `No record found with key: ${firebaseKey}`,
            });
        }

        res.json({
            success: true,
            record: record,
        });
    } catch (error) {
        console.error('[MORGUE-API] Error fetching record:', error.message);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to fetch record.',
        });
    }
});

/**
 * GET /api/version
 * Returns just the current morgueDataVersion (no auth required).
 * Third-party tools can check this first — if the version hasn't
 * changed since their last fetch, they can skip re-downloading records.
 */
app.get('/api/version', (req, res) => {
    res.json({
        morgueDataVersion: getMorgueVersion(),
    });
});

/**
 * GET /api/health
 * Lightweight health check (no API key required).
 * Reports system maintenance state so API consumers can tell whether an outage /
 * maintenance window is in effect (e.g. upstream forum provider down), vs the
 * API itself being up.
 */
app.get('/api/health', async (req, res) => {
    let maintenance = null;
    let deployQueuePaused = false;
    try {
        const botSnap = await firebase.db.ref('appMetadata/botMaintenance').once('value');
        deployQueuePaused = botSnap.val() === true;
        const maintSnap = await firebase.db.ref('appMetadata/maintenance').once('value');
        const m = maintSnap.val() || {};
        if (m.active) {
            maintenance = {
                active: true,
                message: m.message || null,
                splashActive: !!(m.splash && m.splash.active),
                splashTitle: (m.splash && m.splash.title) || null,
                splashEta: (m.splash && m.splash.eta) || null,
            };
        }
    } catch (err) {
        // Best-effort — health must never fail because of a DB hiccup.
        console.warn('[HEALTH] Could not read maintenance state:', err.message);
    }

    const maintenanceActive = !!(maintenance && maintenance.active);
    res.json({
        status: 'ok', // the API itself is serving; maintenance is reported below
        degraded: maintenanceActive,
        service: 'phmc-morgue-api',
        morgueDataVersion: getMorgueVersion(),
        maintenance: {
            active: maintenanceActive,
            deployQueuePaused,
            ...(maintenance || {}),
        },
        timestamp: new Date().toISOString(),
    });
});

/**
 * GET /api/activity
 * Returns recent API calls (past 200). Useful for checking who's using the API.
 * Requires the same API key auth as other endpoints.
 */
app.get('/api/activity', validateApiKey, rateLimiter, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
    const recent = activityLog.slice(-limit).reverse();

    res.json({
        success: true,
        count: recent.length,
        total: activityLog.length,
        activity: recent,
    });
});

// ──────────────────────────────────────────
// Write endpoints (local file storage)
// ──────────────────────────────────────────

/**
 * PUT /api/morgue/records/:caseId
 * Upsert a single morgue record to local file storage.
 * Mirrors the Firebase RTDB PUT pattern used by morgue-logger.ps1.
 *
 * Body: Full record JSON (name, sex, location, bullets, findings, etc.)
 * Auth: x-api-key header (query param ?key= is no longer supported)
 *
 * Dual-writes to local file + Firebase RTDB for now.
 * When migration is complete, the Firebase write is removed.
 */
app.put('/api/morgue/records/:caseId', validateApiKey, rateLimiter, async (req, res) => {
    try {
        const { caseId } = req.params;
        if (!caseId || !/^\d+$/.test(caseId)) {
            return res.status(400).json({
                success: false,
                error: 'Bad request',
                message: 'caseId must be a numeric string.',
            });
        }

        const record = saveLocalRecord(caseId, req.body);

        // Dual-write to Firebase RTDB (keeps both in sync during migration)
        try {
            await firebase.db.ref(`morgue-records/${caseId}`).set(record);
        } catch (fbErr) {
            console.warn(`[MORGUE-API] Firebase write warning (non-fatal): ${fbErr.message}`);
        }

        console.log(`[MORGUE-API] PUT /api/morgue/records/${caseId} → saved (${record.name})`);
        res.json({ success: true, record });
    } catch (err) {
        console.error('[MORGUE-API] Error saving record:', err.message);
        res.status(500).json({
            success: false,
            error: 'Internal error',
            message: err.message,
        });
    }
});

/**
 * DELETE /api/morgue/records/:caseId
 * Delete a morgue record from the local file (and Firebase for consistency).
 *
 * Auth: x-api-key header (query param ?key= is no longer supported)
 */
app.delete('/api/morgue/records/:caseId', validateApiKey, rateLimiter, async (req, res) => {
    try {
        const { caseId } = req.params;
        if (!caseId || !/^\d+$/.test(caseId)) {
            return res.status(400).json({
                success: false,
                error: 'Bad request',
                message: 'caseId must be a numeric string.',
            });
        }

        const deleted = deleteLocalRecord(caseId);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Not found',
                message: `No record found with caseId: ${caseId}`,
            });
        }

        // Also delete from Firebase for consistency
        try {
            await firebase.db.ref(`morgue-records/${caseId}`).remove();
        } catch (fbErr) {
            console.warn(`[MORGUE-API] Firebase delete warning (non-fatal): ${fbErr.message}`);
        }

        // Bump version
        const now = Date.now();
        cachedVersion = now;
        versionLastFetched = now;
        setLocalVersion(now);
        try {
            await firebase.db.ref('appMetadata/morgueDataVersion').set(now);
        } catch { /* best effort */ }

        console.log(`[MORGUE-API] DELETE /api/morgue/records/${caseId} → deleted (${deleted.name})`);
        res.json({ success: true, deleted: { caseId, name: deleted.name } });
    } catch (err) {
        console.error('[MORGUE-API] Error deleting record:', err.message);
        res.status(500).json({
            success: false,
            error: 'Internal error',
            message: err.message,
        });
    }
});

/**
 * POST /api/morgue/purge
 * Delete ALL morgue records from local file and Firebase.
 * Requires confirmed=true in the body.
 *
 * Auth: x-api-key header (query param ?key= is no longer supported)
 */
app.post('/api/morgue/purge', validateApiKey, rateLimiter, async (req, res) => {
    try {
        if (!req.body?.confirmed) {
            return res.status(400).json({
                success: false,
                error: 'Bad request',
                message: 'Set confirmed=true in the request body to purge all records.',
            });
        }

        // Wipe local file
        writeFileSync(MORGUE_DATA_PATH, '{}', 'utf-8');

        // Wipe Firebase
        try {
            await firebase.db.ref('morgue-records').remove();
        } catch (fbErr) {
            console.warn(`[MORGUE-API] Firebase purge warning (non-fatal): ${fbErr.message}`);
        }

        // Bump version
        const now = Date.now();
        cachedVersion = now;
        versionLastFetched = now;
        setLocalVersion(now);
        try {
            await firebase.db.ref('appMetadata/morgueDataVersion').set(now);
        } catch { /* best effort */ }

        console.log('[MORGUE-API] PURGE → all morgue records deleted');
        res.json({ success: true });
    } catch (err) {
        console.error('[MORGUE-API] Error purging records:', err.message);
        res.status(500).json({
            success: false,
            error: 'Internal error',
            message: err.message,
        });
    }
});

/**
 * POST /api/morgue/bulk
 * Upload multiple records in a single request (avoids per-record rate limits).
 * Accepts an array of records, writes each to local storage + Firebase,
 * then auto-bumps the version so web clients refresh.
 *
 * Body: { records: [{ caseId: "12345", name: "...", ... }, ...] }
 *
 * Auth: x-api-key header (query param ?key= is no longer supported)
 */
app.post('/api/morgue/bulk', validateApiKey, rateLimiter, async (req, res) => {
    try {
        const { records } = req.body;
        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Bad request',
                message: 'Send { records: [...] } with at least one record.',
            });
        }

        const results = { ok: 0, failed: 0, errors: [] };

        // Load local data once, batch all writes, then write file once
        const data = loadLocalData();
        const fbPromises = [];

        for (const record of records) {
            const caseId = String(record.caseId || '').trim();
            if (!caseId || !/^\d+$/.test(caseId)) {
                results.failed++;
                results.errors.push({ caseId, error: 'Invalid or missing caseId' });
                continue;
            }

            data[caseId] = {
                ...record,
                caseId,
                firebaseKey: caseId,
                lastUpdated: Date.now(),
                source: record.source || 'API',
            };
            results.ok++;

            // Dual-write to Firebase (non-blocking — caught individually)
            fbPromises.push(
                firebase.db.ref(`morgue-records/${caseId}`).set(data[caseId])
                    .catch((fbErr) => {
                        console.warn(`[MORGUE-API] Bulk Firebase write warning for ${caseId}: ${fbErr.message}`);
                    })
            );
        }

        // Write local file once (batch write)
        writeFileSync(MORGUE_DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');

        // Fire all Firebase writes in parallel (best-effort)
        await Promise.allSettled(fbPromises);

        // Auto-bump version
        const now = Date.now();
        cachedVersion = now;
        versionLastFetched = now;
        setLocalVersion(now);
        try {
            await firebase.db.ref('appMetadata/morgueDataVersion').set(now);
        } catch { /* best effort */ }

        console.log(`[MORGUE-API] Bulk upload complete: ${results.ok} ok, ${results.failed} failed`);
        res.json({ success: true, ...results, morgueDataVersion: now });
    } catch (err) {
        console.error('[MORGUE-API] Error in bulk upload:', err.message);
        res.status(500).json({
            success: false,
            error: 'Internal error',
            message: err.message,
        });
    }
});

/**
 * POST /api/morgue/lookup-by-names
 * Batch-lookup morgue records by an array of names.
 * Useful for checking which names from a group roster have morgue records.
 *
 * Body: { names: string[], exact?: boolean }
 *   names - Array of name strings to search for (required, min 1)
 *   exact - If true, exact case-insensitive match. If false (default), substring includes match.
 *
 * Returns each query name with matched records (or empty array if no match).
 *
 * Auth: x-api-key header (query param ?key= is no longer supported)
 */
app.post('/api/morgue/lookup-by-names', validateApiKey, rateLimiter, (req, res) => {
    try {
        const { names, exact } = req.body || {};

        if (!Array.isArray(names) || names.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Bad request',
                message: 'Send { names: [...] } with at least one name.',
            });
        }

        const allRecords = getLocalRecords();
        const results = names.map((query) => {
            const q = String(query || '').trim().toLowerCase();
            if (!q) return { query: query || '', matched: false, records: [] };

            const matches = allRecords.filter((r) => {
                const recordName = (r.name || '').toLowerCase();
                return exact
                    ? recordName === q
                    : recordName.includes(q);
            });

            return {
                query: query,
                matched: matches.length > 0,
                records: matches,
            };
        });

        const matchedCount = results.filter((r) => r.matched).length;

        res.json({
            success: true,
            totalNames: names.length,
            matchedCount,
            unmatchedCount: names.length - matchedCount,
            results,
        });
    } catch (err) {
        console.error('[MORGUE-API] Error in lookup-by-names:', err.message);
        res.status(500).json({
            success: false,
            error: 'Internal error',
            message: err.message,
        });
    }
});

/**
 * POST /api/morgue/version-bump
 * Bump the morgue data version cache so web app clients refresh.
 * Called by morgue-logger.ps1 after a batch upload completes.
 *
 * Auth: x-api-key header (query param ?key= is no longer supported)
 */
app.post('/api/morgue/version-bump', validateApiKey, rateLimiter, async (req, res) => {
    try {
        const now = Date.now();
        cachedVersion = now;
        versionLastFetched = now;
        setLocalVersion(now);

        // Also bump in Firebase
        try {
            await firebase.db.ref('appMetadata/morgueDataVersion').set(now);
        } catch (fbErr) {
            console.warn(`[MORGUE-API] Firebase version bump warning (non-fatal): ${fbErr.message}`);
        }

        console.log(`[MORGUE-API] Version bumped to ${now}`);
        res.json({ success: true, morgueDataVersion: now });
    } catch (err) {
        console.error('[MORGUE-API] Error bumping version:', err.message);
        res.status(500).json({
            success: false,
            error: 'Internal error',
            message: err.message,
        });
    }
});

/**
 * POST /api/morgue/export
 * Export all records from Firebase into the local data file.
 * Useful for the initial migration or re-sync if local file is corrupted.
 *
 * Auth: x-api-key header (query param ?key= is no longer supported)
 */
app.post('/api/morgue/export', validateApiKey, rateLimiter, async (req, res) => {
    try {
        const records = await firebase.getMorgueRecords();
        const data = {};
        for (const r of records) {
            if (r.caseId) data[r.caseId] = r;
        }
        writeFileSync(MORGUE_DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`[MORGUE-API] Exported ${records.length} records from Firebase to local file`);
        res.json({ success: true, count: records.length });
    } catch (err) {
        console.error('[MORGUE-API] Error exporting records:', err.message);
        res.status(500).json({
            success: false,
            error: 'Internal error',
            message: err.message,
        });
    }
});

/**
 * POST /api/morgue/push-to-firebase
 * Push all records from the local file into Firebase, overwriting everything.
 * Re-seeds Firebase from the VPS source of truth.
 *
 * Auth: x-api-key header (query param ?key= is no longer supported)
 */
app.post('/api/morgue/push-to-firebase', validateApiKey, rateLimiter, async (req, res) => {
    try {
        const data = loadLocalData();
        const entries = Object.entries(data);

        if (entries.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Bad request',
                message: 'No records in local data file to push.',
            });
        }

        // Write each record to Firebase
        let pushed = 0;
        for (const [caseId, record] of entries) {
            try {
                await firebase.db.ref(`morgue-records/${caseId}`).set(record);
                pushed++;
            } catch (err) {
                console.warn(`[MORGUE-API] Failed to push record ${caseId}: ${err.message}`);
            }
        }

        // Bump version
        const now = Date.now();
        cachedVersion = now;
        versionLastFetched = now;
        setLocalVersion(now);
        try {
            await firebase.db.ref('appMetadata/morgueDataVersion').set(now);
        } catch { /* best effort */ }

        console.log(`[MORGUE-API] Pushed ${pushed}/${entries.length} records from local file to Firebase`);
        res.json({ success: true, pushed, total: entries.length });
    } catch (err) {
        console.error('[MORGUE-API] Error pushing to Firebase:', err.message);
        res.status(500).json({
            success: false,
            error: 'Internal error',
            message: err.message,
        });
    }
});

// ── Roster Endpoints (Faction Member Lists) ──
// Served from local JSON files synced daily by factionRosterSync.js
// Data path: /opt/phmc-bot/discord-bot/data/{faction}-roster.json

const ROSTER_DIR = resolve(__dirname, 'data');

function getRosterPath(faction) {
    return resolve(ROSTER_DIR, `${faction}-roster.json`);
}

function loadRoster(faction) {
    try {
        const path = getRosterPath(faction);
        if (!existsSync(path)) return null;
        return JSON.parse(readFileSync(path, 'utf-8'));
    } catch { return null; }
}

// ── Agency Credentials Endpoint ──
// Shared faction-forum account credentials, stored ONLY on the VPS
// (data/agency-credentials.json) — never shipped to the web client. Served to
// authenticated callers (the Firebase getAgencyCredentials function) via the
// morgue-api key.
const AGENCY_CREDENTIALS_PATH = resolve(__dirname, 'data', 'agency-credentials.json');

function loadAgencyCredentials() {
    try {
        if (!existsSync(AGENCY_CREDENTIALS_PATH)) return null;
        return JSON.parse(readFileSync(AGENCY_CREDENTIALS_PATH, 'utf-8'));
    } catch { return null; }
}

/**
 * GET /api/agency-credentials
 * Returns the faction-forum account credentials map (keyed by forum hostname).
 * Auth: x-api-key header (server-side only — the web client must go through
 * the Firebase function, never call this directly).
 */
app.get('/api/agency-credentials', validateApiKey, rateLimiter, (req, res) => {
    const data = loadAgencyCredentials();
    if (!data) return res.status(404).json({ error: 'No agency credentials configured' });
    return res.json(data);
});

/**
 * GET /api/protocols-dev
 * Returns the dev EMS protocols dataset ({ protocols: [...] }). Hosted on the
 * VPS (data/protocols-dev.json) to keep the heavy base64 images out of RTDB.
 * Auth: x-api-key header (the web client goes through the Firebase function).
 */
const PROTOCOLS_DEV_PATH = resolve(__dirname, 'data', 'protocols-dev.json');

function loadProtocolsDev() {
    try {
        if (!existsSync(PROTOCOLS_DEV_PATH)) return null;
        return JSON.parse(readFileSync(PROTOCOLS_DEV_PATH, 'utf-8'));
    } catch { return null; }
}

app.get('/api/protocols-dev', validateApiKey, rateLimiter, (req, res) => {
    const data = loadProtocolsDev();
    if (!data) return res.status(404).json({ error: 'No dev protocols configured' });
    return res.json(data);
});

/**
 * GET /api/roster/check?name=XXX&dept=lspd
 * Checks a name against the LSPD/LSSD/SADCR rosters.
 *
 * If `dept` is provided (lspd/lssd/sadcr): checks that department first,
 * cross-references the others if not found.
 *
 * If `dept` is omitted: checks ALL rosters and returns ALL matches
 * in a `matches` array.
 *
 * Returns (with dept):
 *   { found: true, department: "lspd", name: "Richard Kovchin" }
 *   { found: false, department: "lspd", name: "Richard Kovchin", altMatch: { ... } }
 *
 * Returns (auto-detect, no dept):
 *   { found: true, count: 2, matches: [{ name: "...", department: "lspd" }, ...] }
 *   { found: false, count: 0, matches: [] }
 *
 * Auth: x-api-key header
 */
app.get('/api/roster/check', validateApiKey, rateLimiter, (req, res) => {
    const name = (req.query.name || '').trim().toLowerCase();
    const rawName = req.query.name || '';
    const dept = (req.query.department || req.query.dept || '').trim().toLowerCase();
    const hasDept = dept === 'lspd' || dept === 'lssd' || dept === 'sadcr';

    if (!name || name.length < 2) {
        return res.status(400).json({ error: 'name parameter is required (min 2 chars)' });
    }

    const rosters = ['lspd', 'lssd', 'sadcr'];

    if (hasDept) {
        // ── Specific department mode (original) ──
        const primaryRoster = loadRoster(dept);
        const primaryMatch = primaryRoster?.members?.find(m =>
            m.name?.toLowerCase() === name || m.name?.toLowerCase().includes(name)
        );
        if (primaryMatch) {
            return res.json({ found: true, department: dept, name: primaryMatch.name });
        }

        const otherDept = rosters.find(r => r !== dept);
        const otherRoster = loadRoster(otherDept);
        const otherMatch = otherRoster?.members?.find(m =>
            m.name?.toLowerCase() === name || m.name?.toLowerCase().includes(name)
        );

        return res.json({
            found: false,
            department: dept,
            name: rawName.trim(),
            altMatch: otherMatch
                ? { name: otherMatch.name, department: otherDept }
                : null,
        });
    }

    // ── Auto-detect mode (no department specified) ──
    // Check all rosters, return ALL matches found
    const matches = [];
    for (const r of rosters) {
        const roster = loadRoster(r);
        const rosterMatches = roster?.members?.filter(m =>
            m.name?.toLowerCase() === name || m.name?.toLowerCase().includes(name)
        ) || [];
        for (const m of rosterMatches) {
            matches.push({ name: m.name, department: r });
        }
    }

    return res.json({
        found: matches.length > 0,
        count: matches.length,
        matches,
    });
});

// ── Patient Index Endpoints ──
// Served from data/medical-records-index.json, built by services/patientIndex.js
// (startup incremental refresh + write-through on medical-record deploy + a
// paginated f=97 full rebuild every 3 days).

const PATIENT_INDEX_PATH = resolve(__dirname, 'data', 'medical-records-index.json');

function loadPatientIndex() {
    try {
        if (!existsSync(PATIENT_INDEX_PATH)) return null;
        return JSON.parse(readFileSync(PATIENT_INDEX_PATH, 'utf-8'));
    } catch { return null; }
}

/**
 * GET /api/patients?q=<name>
 * Case-insensitive substring search over the patient index (min 2 chars),
 * newest-seen first, limited to 10. Returns [{ name, id, lastSeen }].
 *
 * GET /api/patients
 * Returns the whole index { version, lastUpdated, lastFullBuild, count, patients }.
 *
 * Auth: x-api-key header
 */
app.get('/api/patients', validateApiKey, rateLimiter, (req, res) => {
    const index = loadPatientIndex();
    if (!index || !Array.isArray(index.patients)) {
        return res.status(404).json({ error: 'Patient index not built yet' });
    }

    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) {
        return res.json({
            version: index.version,
            lastUpdated: index.lastUpdated,
            lastFullBuild: index.lastFullBuild,
            count: index.count ?? index.patients.length,
            patients: index.patients,
        });
    }
    if (q.length < 2) {
        return res.status(400).json({ error: 'q must be at least 2 characters' });
    }

    // Match by NAME (substring) or by PATIENT ID (exact or substring of the
    // numeric id) — lets the web app validate/fill a patient name from the ID
    // the ME typed (bidirectional lookup).
    const matches = index.patients
        .filter((p) => {
            if ((p.name || '').toLowerCase().includes(q)) return true;
            const pid = p.id;
            return pid != null && String(pid).toLowerCase().includes(q);
        })
        .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
        .slice(0, 10)
        .map((p) => ({ name: p.name, id: p.id || null, lastSeen: p.lastSeen || null }));

    return res.json({ count: matches.length, matches });
});

/**
 * GET /api/roster/lspd
 * GET /api/roster/lssd
 * Returns the full member list for a faction.
 *
 * Auth: x-api-key header (query param ?key= is no longer supported)
 */
app.get('/api/roster/:faction', validateApiKey, rateLimiter, (req, res) => {
    const faction = req.params.faction;
    if (faction !== 'lspd' && faction !== 'lssd' && faction !== 'sadcr') {
        return res.status(404).json({ error: 'Unknown faction. Use lspd, lssd, or sadcr.' });
    }
    const data = loadRoster(faction);
    if (!data) {
        return res.status(503).json({ error: 'Roster not yet synced. Try again after the next sync cycle.' });
    }
    res.json(data);
});

// ──────────────────────────────────────────
// CCTV Data Routes
// ──────────────────────────────────────────
const CCTV_DATA_PATH = '/opt/phmc-bot/cctv-script/output/cctv-data.json';
const CCTV_CAMERAS_PATH = '/opt/phmc-bot/cctv-script/cameras.json';

function loadCctvData() {
    if (!existsSync(CCTV_DATA_PATH)) return null;
    try { return JSON.parse(readFileSync(CCTV_DATA_PATH, 'utf-8')); }
    catch { return null; }
}

function loadCctvCameras() {
    if (!existsSync(CCTV_CAMERAS_PATH)) return null;
    try { return JSON.parse(readFileSync(CCTV_CAMERAS_PATH, 'utf-8')); }
    catch { return null; }
}

/**
 * GET /api/cctv/cameras
 * Returns list of all cameras with metadata (log count, latestId, recent activity)
 */
app.get('/api/cctv/cameras', validateApiKey, rateLimiter, (req, res) => {
    const cameras = loadCctvCameras();
    const data = loadCctvData();

    if (!cameras) {
        return res.status(503).json({ success: false, error: 'Camera config not available.' });
    }

    const result = cameras.map(cam => {
        const stored = data?.cameras?.[String(cam.id)];
        return {
            id: cam.id,
            name: cam.name,
            logCount: stored?.logs?.length ?? 0,
            latestId: stored?.latestId ?? 0,
            hasLogs: (stored?.logs?.length ?? 0) > 0,
        };
    });

    res.json({ success: true, data: result });
});

/**
 * GET /api/cctv/search?q=keyword
 * Searches all camera logs for a keyword (case-insensitive).
 * Returns matches grouped by camera.
 */
app.get('/api/cctv/search', validateApiKey, rateLimiter, (req, res) => {
    const data = loadCctvData();
    if (!data) {
        return res.status(503).json({ success: false, error: 'CCTV data not available.' });
    }

    const query = (req.query.q || '').trim().toLowerCase();
    if (!query) {
        return res.status(400).json({ success: false, error: 'Search query "q" is required.' });
    }

    const cameras = data.cameras || {};
    const results = [];

    for (const [camId, camData] of Object.entries(cameras)) {
        const matches = (camData.logs || []).filter(
            (entry) =>
                (entry.message || '').toLowerCase().includes(query) ||
                (entry.date || '').toLowerCase().includes(query)
        );
        if (matches.length > 0) {
            results.push({
                cameraId: parseInt(camId, 10),
                cameraName: camData.name || `Camera ${camId}`,
                matchCount: matches.length,
                logs: matches,
            });
        }
    }

    // Sort by cameraId for consistent ordering
    results.sort((a, b) => a.cameraId - b.cameraId);

    const totalMatches = results.reduce((sum, r) => sum + r.matchCount, 0);

    res.json({
        success: true,
        data: {
            query: req.query.q,
            totalMatches,
            camerasWithMatches: results.length,
            results,
        },
    });
});

/**
 * GET /api/cctv/cameras/:id
 * Returns full log entries for a specific camera.
 */
app.get('/api/cctv/cameras/:id', validateApiKey, rateLimiter, (req, res) => {
    const data = loadCctvData();
    if (!data) {
        return res.status(503).json({ success: false, error: 'CCTV data not available.' });
    }

    const camData = data.cameras?.[req.params.id];
    if (!camData) {
        return res.status(404).json({ success: false, error: `Camera ${req.params.id} not found.` });
    }

    res.json({
        success: true,
        data: {
            id: parseInt(req.params.id, 10),
            name: camData.name,
            latestId: camData.latestId,
            logs: camData.logs || [],
        },
    });
});

/**
 * GET /api/cctv/stats
 * Aggregate statistics for all cameras.
 */
app.get('/api/cctv/stats', validateApiKey, rateLimiter, (req, res) => {
    const data = loadCctvData();
    if (!data) {
        return res.status(503).json({ success: false, error: 'CCTV data not available.' });
    }

    const cameras = data.cameras || {};
    const camIds = Object.keys(cameras);
    let totalEntries = 0;
    let camerasWithData = 0;

    for (const id of camIds) {
        const count = cameras[id]?.logs?.length ?? 0;
        totalEntries += count;
        if (count > 0) camerasWithData++;
    }

    res.json({
        success: true,
        data: {
            totalCameras: camIds.length,
            camerasWithData,
            totalLogEntries: totalEntries,
            lastFetched: data.metadata?.lastFetched || null,
        },
    });
});

/**
 * POST /api/cctv/fetch
 * Triggers fetch-all.js on the VPS to pull latest CCTV data.
 * Returns immediately — the script runs in the background.
 * (Firebase callable functions have a 60s timeout, so we can't wait.)
 */
app.post('/api/cctv/fetch', validateApiKey, rateLimiter, async (req, res) => {
    const scriptPath = '/opt/phmc-bot/cctv-script';
    const logFile = 'output/fetch-trigger.log';

    try {
        const { spawn } = await import('child_process');
        const child = spawn('node', ['fetch-all.js', '--headless'], {
            cwd: scriptPath,
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        const timestamp = new Date().toISOString();
        const logStream = createWriteStream(`${scriptPath}/${logFile}`, { flags: 'a' });
        logStream.write(`\n[${timestamp}] Manual fetch triggered via API\n`);
        child.stdout.pipe(logStream);
        child.stderr.pipe(logStream);
        child.unref();

        console.log('[CCTV] Manual fetch triggered via API');
        req.fetchSummary = 'Fetch triggered';

        res.json({
            success: true,
            message: 'Fetch triggered in background.',
        });
    } catch (err) {
        console.error('[CCTV] Failed to trigger fetch:', err.message);
        res.status(500).json({ success: false, error: `Failed to trigger fetch: ${err.message}` });
    }
});

// ── Saved-report BBCode store (P2: off RTDB — newSavedReportBBCode ~11MB) ──
// The web app writes/reads report BBCode here (via Cloud Function) instead of
// growing newSavedReportBBCode in RTDB. POST is a read-key op; GET is read.
// Files: data/saved-report-bbcode/<author>/<key>.json
const REPORT_BBCODE_DIR = resolve(__dirname, 'data', 'saved-report-bbcode');

app.get('/api/report-bbcode/:author/:key', validateApiKey, rateLimiter, (req, res) => {
    try {
        const safeAuthor = String(req.params.author || '').replace(/[^a-zA-Z0-9_-]/g, '');
        const safeKey = String(req.params.key || '').replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeAuthor || !safeKey) return res.status(400).json({ success: false, error: 'Invalid author/key.' });
        const file = join(REPORT_BBCODE_DIR, safeAuthor, `${safeKey}.json`);
        if (!existsSync(file)) return res.status(404).json({ success: false, error: 'Not found' });
        const data = JSON.parse(readFileSync(file, 'utf-8'));
        return res.json({ success: true, bbCode: data.bbCode || '' });
    } catch (err) {
        console.error('[MORGUE-API] report-bbcode GET error:', err.message);
        return res.status(500).json({ success: false, error: 'Read failed' });
    }
});

app.post('/api/report-bbcode', validateApiKey, rateLimiter, (req, res) => {
    try {
        const { author, key, bbCode } = req.body || {};
        const safeAuthor = String(author || '').replace(/[^a-zA-Z0-9_-]/g, '');
        const safeKey = String(key || '').replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeAuthor || !safeKey || typeof bbCode !== 'string') {
            return res.status(400).json({ success: false, error: 'author, key and bbCode are required.' });
        }
        const dir = join(REPORT_BBCODE_DIR, safeAuthor);
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            join(dir, `${safeKey}.json`),
            JSON.stringify({ author: safeAuthor, key: safeKey, bbCode, savedAt: Date.now() }),
            'utf-8'
        );
        return res.json({ success: true });
    } catch (err) {
        console.error('[MORGUE-API] report-bbcode POST error:', err.message);
        return res.status(500).json({ success: false, error: 'Write failed' });
    }
});

// ── 404 handler (+ unknown-path enumeration strike) ──
// Junk API scanners cycle through many distinct nonexistent endpoints
// (/api/status, /api/v1/me/, /api/server/version, ...) that no single pattern
// catches. Cycling N DISTINCT unknown paths inside the window is a scanner
// signature -> instant permanent ban. Repeat-hammering ONE missing path is a
// buggy client, not an attacker, so only distinct paths count.
const UNKNOWN_PATH_WINDOW_MS = 10 * 60 * 1000;
const UNKNOWN_PATH_BAN_COUNT = 12;
const unknownPathMap = new Map(); // ip -> { start: ts, paths: Set(path) }

app.use((req, res) => {
    const ip = req.clientIp || req.ip || 'unknown';
    if (!req.hasValidApiKey && !isIpBanned(ip) && !isTrustedIp(ip)) {
        const now = Date.now();
        let entry = unknownPathMap.get(ip);
        if (!entry || now - entry.start > UNKNOWN_PATH_WINDOW_MS) {
            entry = { start: now, paths: new Set() };
            unknownPathMap.set(ip, entry);
        }
        entry.paths.add(`${req.method} ${req.path}`);
        if (unknownPathMap.size > 500) {
            // Opportunistic prune so abandoned scanners don't grow the map.
            for (const [k, v] of unknownPathMap) {
                if (now - v.start > UNKNOWN_PATH_WINDOW_MS) unknownPathMap.delete(k);
            }
        }
        if (entry.paths.size >= UNKNOWN_PATH_BAN_COUNT) {
            console.warn(
                `[MORGUE-API] [WARN] ENUMERATOR ip=${ip} hit ${entry.paths.size} distinct unknown API paths ` +
                `in ${Math.round((now - entry.start) / 1000)}s — banning permanently`
            );
            registerSuspiciousRequest(ip, 'SCAN-path-enumeration', true);
            unknownPathMap.delete(ip);
        }
    }
    res.status(404).json({
        success: false,
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found.`,
    });
});

// ──────────────────────────────────────────
// Start server
// ──────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
    // Load persisted IP bans / strike counts so they survive restarts.
    loadBanState();
    console.log('═══════════════════════════════════════════');
    console.log(`[MORGUE-API] Server running on port ${PORT}`);
    console.log(`[MORGUE-API] Endpoint:     http://0.0.0.0:${PORT}/api/morgue`);
    console.log(`[MORGUE-API] Health:       http://0.0.0.0:${PORT}/api/health`);
    console.log(`[MORGUE-API] Local data:   ${MORGUE_DATA_PATH}`);
    console.log(`[MORGUE-API] Write API:    PUT /api/morgue/records/:caseId`);
    console.log(`[MORGUE-API] Data source:  LOCAL FILE (${MORGUE_DATA_PATH}) — Firebase RTDB deprecated for reads`);
    console.log('═══════════════════════════════════════════');
});

// ── Graceful shutdown ──
function shutdown(signal) {
    console.log(`\n[MORGUE-API] ${signal} received. Shutting down...`);
    server.close(() => {
        console.log('[MORGUE-API] Server closed.');
        process.exit(0);
    });
    setTimeout(() => {
        console.error('[MORGUE-API] Forced shutdown after timeout.');
        process.exit(1);
    }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
