// Vitest config — separate from vite.config.js (build must stay untouched).
// Tests run in jsdom; the react plugin is required for any .jsx test files.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js', 'src/**/*.test.jsx', 'tests/**/*.test.js', 'tests/**/*.test.jsx'],
  },
});