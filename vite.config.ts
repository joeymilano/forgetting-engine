import { defineConfig } from 'vite';

// 前端不能直连 GLM(会暴露 Key),/api/* 由本地 server.mjs 或 Vercel Function 代理
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
  },
});
