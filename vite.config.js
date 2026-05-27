import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('/www/js/modules/weather.js')) return 'weather';
          if (id.includes('/www/js/modules/commercial.js')) return 'commercial';
          if (id.includes('/www/js/modules/community.js')) return 'community';
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 150,
    minify: 'terser',
    sourcemap: false,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8080',
      '/uploads': 'http://localhost:8080',
    },
  },
});
