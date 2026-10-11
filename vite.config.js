import { defineConfig } from 'vite';

export default defineConfig({
  // 用相对路径引用资源，这样部署在 GitHub Pages 的子路径（/micro_world_sticker/）下也能正常加载
  base: './',
  build: {
    // three.js 本身就有 500KB+，不需要这个提醒
    chunkSizeWarningLimit: 1000,
  },
});
