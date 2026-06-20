import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

let gitSha = 'unknown';
try {
  gitSha = execSync('git rev-parse --short HEAD').toString().trim();
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
    port: 3000,
    open: true
  }
});