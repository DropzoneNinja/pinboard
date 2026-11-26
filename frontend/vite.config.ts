import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // During local dev, point the backend at wherever it's actually running —
      // e.g. the dockerized stack's nginx on :8080, or a bare `npm run dev` backend on :4000.
      '/api': {
        target: process.env.VITE_BACKEND_PROXY_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
