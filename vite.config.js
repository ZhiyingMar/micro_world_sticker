import { createWriteStream, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { defineConfig } from 'vite';

// 宣传片录好的视频存在哪（项目里的文件夹，不进 git）
const RECORDINGS_DIR = 'recordings';
// 只收这两种格式的文件名，别的一律不存
const RECORDING_NAME = /^[\w-]+\.(mp4|webm)$/;

/**
 * 开发服务器上的一个小接口：宣传片模式录完以后把视频 POST 过来，直接存进项目
 * @description 浏览器里的下载要一次次点确认；开发时录完直接落到 recordings/，方便马上打开看
 * @returns {import('vite').Plugin}
 */
function saveRecordings() {
  return {
    name: 'save-trailer-recordings',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__trailer/save', async (request, response) => {
        const name = basename(new URL(request.url, 'http://localhost').searchParams.get('name') || '');
        if (request.method !== 'POST' || !RECORDING_NAME.test(name)) {
          response.statusCode = 400;
          response.end('要 POST，文件名只能是字母数字加 .mp4 / .webm');
          return;
        }

        mkdirSync(RECORDINGS_DIR, { recursive: true });
        const path = join(RECORDINGS_DIR, name);
        try {
          await pipeline(request, createWriteStream(path));
        } catch (error) {
          console.error('宣传片视频没存上', error);
          response.statusCode = 500;
          response.end(String(error));
          return;
        }
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ path }));
      });
    },
  };
}

export default defineConfig({
  // 用相对路径引用资源，这样部署在 GitHub Pages 的子路径（/micro_world_sticker/）下也能正常加载
  base: './',
  build: {
    // three.js 本身就有 500KB+，不需要这个提醒
    chunkSizeWarningLimit: 1000,
  },
  plugins: [saveRecordings()],
});
