import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/forms/',
  plugins: [react(), sentryVitePlugin({
    org: "phmc-gtaw",
    project: "javascript-react"
  }), ],
  build: {
    outDir: 'build',
    sourcemap: true,
  },
  optimizeDeps: {
    include: ['react-markdown', 'remark-gfm'],
  },
  server: {
    port: 3000,
    open: true
  }
});