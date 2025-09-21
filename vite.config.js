// filepath: vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/forms/',
  plugins: [react()],
  build: {
    sourcemap: true,
  },
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173, // You can change this if needed
  },
})