import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let gitSha = 'unknown';
try {
  gitSha = execSync('git rev-parse --short=7 HEAD').toString().trim();
} catch (e) {
  console.warn('[vite] Could not determine git commit SHA:', e.message);
}

// ── Localhost morgue dev path ─────────────────────────────────────────────
// The production path is the getMorgueRecords Cloud Function, which requires a
// signed-in Firebase user and only allows listed browser origins. Localhost
// dev often runs unsigned-in, so the dev server proxies /dev-morgue to the VPS
// morgue-api over Tailscale instead, injecting the read key SERVER-SIDE. The
// key never reaches the browser and nothing in production is loosened.
//
// Key resolution order: PHMC_MORGUE_API_KEY (root .env), then the first key in
// discord-bot/.env's MORGUE_API_KEYS (gitignored). No key = proxy disabled.
function readBotMorgueKey() {
  try {
    const p = resolve(process.cwd(), 'discord-bot/.env');
    if (!existsSync(p)) return '';
    const text = readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
    const line = text.split(/\r?\n/).find((l) => l.trim().startsWith('MORGUE_API_KEYS='));
    if (!line) return '';
    const raw = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
    return raw.split(',')[0].trim();
  } catch {
    return '';
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devMorgueKey = String(env.PHMC_MORGUE_API_KEY || '').trim() || readBotMorgueKey();
  const devMorgueTarget = String(env.PHMC_MORGUE_DEV_URL || 'http://100.84.161.69:3001').trim();
  if (devMorgueKey) {
    // Target only — never log the key.
    console.log(`[vite] morgue dev proxy: /dev-morgue -> ${devMorgueTarget}/api/morgue`);
  } else {
    console.warn('[vite] morgue dev proxy disabled: no PHMC_MORGUE_API_KEY / MORGUE_API_KEYS found');
  }

  return {
    base: '/forms/',
    define: {
      __GIT_SHA__: JSON.stringify(gitSha),
    },
    plugins: [react(), sentryVitePlugin({
      org: "phmc-gtaw",
      project: "javascript-react"
    })],
    build: {
      outDir: 'build',
      sourcemap: 'hidden',
    },
    optimizeDeps: {
      include: [],
    },
    server: {
      // 3000 collides with AdGuard Home's web UI (127.0.0.1:3000 on this desktop),
      // so `localhost:3000` intermittently resolved to AdGuard and returned 401.
      port: 5173,
      open: true,
      ...(devMorgueKey ? {
        proxy: {
          '/dev-morgue': {
            target: devMorgueTarget,
            changeOrigin: true,
            secure: false,
            rewrite: () => '/api/morgue',
            headers: { 'x-api-key': devMorgueKey },
          },
        },
      } : {}),
    }
  };
});
