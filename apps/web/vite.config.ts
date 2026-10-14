import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../api/dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    allowedHosts: 'all',
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
