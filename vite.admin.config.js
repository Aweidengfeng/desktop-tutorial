import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/admin',
  base: '/admin-v2-assets/',
  build: {
    outDir: resolve(__dirname, 'dist-admin'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/admin/index.html'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': 'http://localhost:8080',
      '/uploads': 'http://localhost:8080',
    },
  },
});
