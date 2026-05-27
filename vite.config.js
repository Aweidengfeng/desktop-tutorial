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
        manualChunks: {
          weather: ['./www/js/modules/weather.js'],
          commercial: ['./www/js/modules/commercial.js'],
          community: ['./www/js/modules/community.js'],
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
