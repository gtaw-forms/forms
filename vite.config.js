
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/forms/',
  plugins: [react()],
  build: {
    outDir: 'build',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react': ['react', 'react-dom'],
          'firebase': ['firebase'],
          'bootstrap': ['react-bootstrap', 'bootstrap'],
          'vendor': [
            '@emotion/react',
            '@emotion/styled',
            '@fortawesome/fontawesome-free',
            '@rollbar/react',
            '@sentry/react',
            '@testing-library/jest-dom',
            '@testing-library/react',
            '@testing-library/user-event',
            '@tsparticles/all',
            '@tsparticles/engine',
            '@tsparticles/react',
            'dom-to-image',
            'node-fetch',
            'react-bootstrap-typeahead',
            'react-dropzone',
            'react-icons',
            'react-markdown',
            'react-router-dom',
            'react-select',
            'react-snowfall',
            'remark-gfm',
            'rollbar',
            'web-vitals'
          ],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react-markdown', 'remark-gfm'],
  },
  server: {
    port: 3000,
    open: true
  }
});
