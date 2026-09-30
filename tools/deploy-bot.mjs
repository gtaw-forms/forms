#!/usr/bin/env node
/**
 * tools/deploy-bot.mjs — mirror the WHOLE discord-bot/ tree to the VPS, prove
 * parity with an md5 check, stamp a deploy marker, and restart PM2.
 *
 * WHY WHOLE-TREE (read this before changing it):
 *   The VPS at /opt/phmc-bot/discord-bot is a MIRROR, not a partial copy. A file
 *   only updates when it is actually copied there, so "scp just the file I
 *   edited" leaves every untouched file on whatever version it was last hand-
 *   copied to — silently and indefinitely. That is how the repo and VPS drifted
 *   apart and how autopsy request 10308 lost its acknowledgement. This tool
 *   ALWAYS syncs the entire tree (minus secrets, node_modules, data, logs,
 *   sessions, debug) and then verifies the result.
 *
 * The FIRST run after a period of drift is a RECONCILIATION: review the parity
 * report (and `git diff`) before passing --deploy, because a full sync will
 * overwrite the VPS with the repo. After one clean reconcile, --deploy is a
 * safe no-op-when-unchanged mirror.
 *
 * Usage:
 *   node tools/deploy-bot.mjs                  # PARITY CHECK ONLY (safe default)
 *   node tools/deploy-bot.mjs --deploy         # sync tree + verify + restart
 *   node tools/deploy-bot.mjs --deploy --no-restart
 *   node tools/deploy-bot.mjs --allow-dirty    # skip the clean-git-tree guard
 *
 * Env overrides:
 *   PHMC_VPS_HOST     (default root@88.208.243.254)
 *   PHMC_VPS_SSH_KEY  (default ~/.ssh/phmc_vps)
 *   PHMC_VPS_BOT_DIR  (default /opt/phmc-bot/discord-bot)
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCAL_BOT = path.join(ROOT, 'discord-bot');

const SSH_KEY = process.env.PHMC_VPS_SSH_KEY || path.join(os.homedir(), '.ssh', 'phmc_vps');
const VPS = process.env.PHMC_VPS_HOST || 'root@88.208.243.254';
const REMOTE_BOT = process.env.PHMC_VPS_BOT_DIR || '/opt/phmc-bot/discord-bot';

const EXCLUDE_DIRS = new Set(['node_modules', 'data', 'logs', '.git', 'debug', 'debug-testing-scripts', 'out']);
// changelog.md is deliberately excluded: the repo and VPS copies have diverged
// (different sections; the repo copy is also encoding-damaged) so a mirror must
// not clobber either. Reconcile it by hand.
const EXCLUDE_FILE_RE = /(^|\/)(\.env(\..*)?|\.browser\.env|forum-session.*\.json|[^/]*\.log|log\..+\.(txt|log)|firebase-admin-key\.json|morgue-data\.json|morgue-meta\.json|changelog\.md|\.deploy-revision)$/i;

const DEPLOY = process.argv.includes('--deploy');
const NO_RESTART = process.argv.includes('--no-restart');
const ALLOW_DIRTY = process.argv.includes('--allow-dirty');

function isExcluded(rel) {
    if (rel.split('/').some(p => EXCLUDE_DIRS.has(p))) return true;
    return EXCLUDE_FILE_RE.test(rel);
}

function walk(dir, base = '') {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = base ? base + '/' + e.name : e.name;
        if (e.isDirectory()) {
            if (EXCLUDE_DIRS.has(e.name)) continue;
            out.push(...walk(path.join(dir, e.name), rel));
        } else if (e.isFile() && !isExcluded(rel)) {
            out.push(rel);
        }
    }
    return out;
}

const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

function localManifest() {
    // Mirror exactly the COMMITTED (git-tracked) tree, so local-only artifacts
    // that are deliberately gitignored (.env, changelog.md, debug scripts,
    // aghMetrics) never clobber the VPS copy. Falls back to a directory walk if
    // git is unavailable.
    let rels;
    try {
        rels = execFileSync('git', ['ls-files', '-z', '--', 'discord-bot'], { cwd: ROOT, encoding: 'utf8' })
            .split('\0').filter(Boolean)
            .map(p => p.replace(/^discord-bot\//, ''))
            .filter(rel => rel && !isExcluded(rel));
    } catch {
        rels = walk(LOCAL_BOT);
    }
    const m = new Map();
    for (const rel of rels) {
        const full = path.join(LOCAL_BOT, rel);
        if (fs.existsSync(full)) m.set(rel, md5(fs.readFileSync(full)));
    }
    return m;
}

function ssh(cmd, opts = {}) {
    return execFileSync('ssh', ['-i', SSH_KEY, VPS, cmd], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, ...opts });
}

function remoteManifest() {
    const notPath = [...EXCLUDE_DIRS].map(d => `-not -path './${d}/*'`).join(' ');
    const out = ssh(`cd ${REMOTE_BOT} && find . -type f ${notPath} -print0 | xargs -0 md5sum`);
    const m = new Map();
    for (const line of out.split('\n')) {
        const i = line.indexOf('  ');
        if (i < 0) continue;
        let rel = line.slice(i + 2).trim();
        if (rel.startsWith('./')) rel = rel.slice(2);
        if (!rel || isExcluded(rel)) continue;
        m.set(rel, line.slice(0, i).trim());
    }
    return m;
}

function diff(local, remote) {
    const onlyLocal = [...local.keys()].filter(k => !remote.has(k));
    const onlyRemote = [...remote.keys()].filter(k => !local.has(k));
    const differing = [...local.keys()].filter(k => remote.has(k) && remote.get(k) !== local.get(k));
    return { onlyLocal, onlyRemote, differing };
}

function report(label, d) {
    console.log(`\n[bot-parity] ${label}`);
    console.log(`  repo -> VPS pending (missing or differ): ${d.onlyLocal.length + d.differing.length}`);
    if (d.differing.length) { console.log(`  DIFFER (${d.differing.length}):`); for (const f of d.differing) console.log('    ~ ' + f); }
    if (d.onlyLocal.length) { console.log(`  MISSING ON VPS (${d.onlyLocal.length}):`); for (const f of d.onlyLocal) console.log('    + ' + f); }
    if (d.onlyRemote.length) { console.log(`  VPS-ONLY (informational, not deleted) (${d.onlyRemote.length}):`); for (const f of d.onlyRemote) console.log('    - ' + f); }
}

// ── 1. Pre-flight: import resolution (catches the 95d6fbb class of bug) ──
try {
    execFileSync(process.execPath, [path.join(__dirname, 'check-bot-imports.mjs')], { stdio: 'inherit' });
} catch {
    console.error('[bot-parity] ABORT — unresolved imports (see above). Fix before deploying.');
    process.exit(1);
}

// ── 2. Parity ──
const local = localManifest();
const remoteBefore = remoteManifest();
report('repo (working tree) vs VPS (before):', diff(local, remoteBefore));

if (!DEPLOY) {
    console.log('\n[bot-parity] Check-only mode. Re-run with --deploy to mirror the tree.');
    process.exit(0);
}

// ── 3. Deploy ──
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'discord-bot'], { cwd: ROOT, encoding: 'utf8' }).trim();
if (dirty && !ALLOW_DIRTY) {
    console.error('\n[bot-parity] ABORT — discord-bot/ has uncommitted changes. Commit first (or pass --allow-dirty).');
    console.error(dirty);
    process.exit(1);
}

const listFile = path.join(os.tmpdir(), `phmc-bot-files-${Date.now()}.txt`);
const tarFile = path.join(os.tmpdir(), `phmc-bot-deploy-${Date.now()}.tar`);
fs.writeFileSync(listFile, [...local.keys()].join('\n'), 'utf8');
console.log('\n[bot-parity] Building tar of', local.size, 'files...');
execFileSync('tar', ['-cf', tarFile, '-C', LOCAL_BOT, '--files-from', listFile], { stdio: 'inherit' });
fs.rmSync(listFile, { force: true });

console.log('[bot-parity] Backing up current VPS tree...');
ssh(`mkdir -p /opt/phmc-bot/backups && cd /opt/phmc-bot && tar czf backups/discord-bot-$(date +%Y%m%d-%H%M%S).tar.gz --exclude='discord-bot/node_modules' --exclude='discord-bot/data' --exclude='discord-bot/logs' discord-bot/ 2>/dev/null; true`);

console.log('[bot-parity] Uploading + extracting...');
execFileSync('scp', ['-i', SSH_KEY, tarFile, `${VPS}:/tmp/phmc-bot-deploy.tar`], { stdio: 'inherit' });
fs.rmSync(tarFile, { force: true });
ssh(`cd ${REMOTE_BOT} && tar -xf /tmp/phmc-bot-deploy.tar && rm -f /tmp/phmc-bot-deploy.tar`);

// ── 4. npm install if dependencies changed ──
if (remoteBefore.get('package.json') && remoteBefore.get('package.json') !== local.get('package.json')) {
    console.log('[bot-parity] package.json changed — running npm install on VPS...');
    execFileSync('ssh', ['-i', SSH_KEY, VPS, `cd ${REMOTE_BOT} && npm install --omit=dev 2>&1 | tail -5`], { stdio: 'inherit' });
}

// ── 5. Deploy marker (git SHA of what is now live) ──
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const marker = JSON.stringify({ sha, branch, deployedAt: new Date().toISOString(), by: os.userInfo().username, files: local.size }, null, 2);
ssh(`cat > ${REMOTE_BOT}/.deploy-revision <<'PHMC_EOF'\n${marker}\nPHMC_EOF`);
console.log('[bot-parity] Wrote deploy marker: ' + sha.slice(0, 10) + ' (' + branch + ')');

// ── 6. Restart ──
if (!NO_RESTART) {
    console.log('[bot-parity] Restarting phmc-bot...');
    execFileSync('ssh', ['-i', SSH_KEY, VPS, 'pm2 restart phmc-bot --update-env'], { stdio: 'inherit' });
    if (remoteBefore.get('morgue-api.js') !== local.get('morgue-api.js')) {
        console.log('[bot-parity] morgue-api.js changed — restarting morgue-api...');
        execFileSync('ssh', ['-i', SSH_KEY, VPS, 'pm2 restart morgue-api --update-env'], { stdio: 'inherit' });
    }
}

// ── 7. Verify ──
const remoteAfter = remoteManifest();
const after = diff(local, remoteAfter);
report('repo (working tree) vs VPS (after):', after);
if (after.onlyLocal.length || after.differing.length) {
    console.error('\n[bot-parity] [ERR] parity FAILED after deploy — the tree did not fully sync.');
    process.exit(1);
}
console.log('\n[bot-parity] [OK] tree mirrored; VPS matches the repo.');
