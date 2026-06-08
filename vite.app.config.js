import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// React 主应用构建配置（替代 Alpine.js 单体 index.html）
export default defineConfig({
  plugins: [react()],
  root: 'src/app',
  build: {
    outDir: resolve(__dirname, 'dist-app'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/app/index.html'),
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          axios: ['axios'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
    minify: 'terser',
    sourcemap: false,
  },
  server: {
    port: 3002,
    proxy: {
      '/api': 'http://localhost:8080',
      '/uploads': 'http://localhost:8080',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/app/src'),
    },
  },
});
