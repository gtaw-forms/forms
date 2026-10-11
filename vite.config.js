import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

let gitSha = 'unknown';
try {
  gitSha = execSync('git rev-parse --short=7 HEAD').toString().trim();
} catch (e) {
  console.warn('[vite] Could not determine git commit SHA:', e.message);
}

export default defineConfig({
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
    open: true
  }
});