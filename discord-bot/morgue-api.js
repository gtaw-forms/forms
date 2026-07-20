import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
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

console.log(`[MORGUE-API] Loaded ${API_KEYS.length} API key(s) (read-only) and ${WRITE_KEYS.length} write key(s)`);
console.log(`[MORGUE-API] Configured port: ${PORT}`);
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
 * Search local records by name, caseId, or location.
 */
function searchLocalRecords(query) {
    const records = getLocalRecords();
    if (!query || !query.trim()) return records;
    const q = query.toLowerCase().trim();
    return records.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        String(r.caseId || '').toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q)
    );
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
        lines.push(`\`${e.time.slice(11, 19)}\` **${e.method}** \`${e.path}\` → ${e.status} (${e.ms}ms) [${e.key}]${q}${s}`);
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

    // ── Check all attack surfaces for suspicious patterns ──
    const ip = req.clientIp;
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
    if (suspiciousFinding) {
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

        console.log(
            `[MORGUE-API] [${req.requestId}] ${req.method} ${req.path} ` +
            `→ ${res.statusCode} (${ms}ms) [${req.apiKeyName || 'no-key'}]` +
            ` ip=${ip}${source} ua="${ua}"${label}`
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
            record,
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
 * Lightweight health check (no API key required)
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'phmc-morgue-api',
        morgueDataVersion: getMorgueVersion(),
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

/**
 * GET /api/roster/check?name=XXX&dept=lspd
 * Checks a name against the LSPD/LSSD rosters.
 *
 * If `dept` is provided (lspd/lssd): checks that department first,
 * cross-references the other if not found (original behavior).
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
    const hasDept = dept === 'lspd' || dept === 'lssd';

    if (!name || name.length < 2) {
        return res.status(400).json({ error: 'name parameter is required (min 2 chars)' });
    }

    const rosters = ['lspd', 'lssd'];

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

/**
 * GET /api/roster/lspd
 * GET /api/roster/lssd
 * Returns the full member list for a faction.
 *
 * Auth: x-api-key header (query param ?key= is no longer supported)
 */
app.get('/api/roster/:faction', validateApiKey, rateLimiter, (req, res) => {
    const faction = req.params.faction;
    if (faction !== 'lspd' && faction !== 'lssd') {
        return res.status(404).json({ error: 'Unknown faction. Use lspd or lssd.' });
    }
    const data = loadRoster(faction);
    if (!data) {
        return res.status(503).json({ error: 'Roster not yet synced. Try again after the next sync cycle.' });
    }
    res.json(data);
});

// ── 404 handler ──
app.use((req, res) => {
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
