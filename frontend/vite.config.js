import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 开发时前端跑在 5173，后端 NestJS 跑在 3000。
// /api、/output、/library 统一代理到后端；/api/comfy-ws（采样预览 WebSocket）同样走代理。
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true, ws: true },
      '/output': { target: 'http://localhost:3000', changeOrigin: true },
      '/library': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
  },
});
