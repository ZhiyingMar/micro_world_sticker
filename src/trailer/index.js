// 宣传片模式（网址加 ?trailer）：按分镜自动演一遍小屋和夜都，录成一段 1080p 视频
// 页面上只露出要录的那块画布和一个小面板；点“开始录制”（浏览器要先有一次点击才肯出声）后开拍，
// 演完自动停，开发服务器上直接存进项目的 recordings/ 文件夹，否则给一个下载链接
import { useMemorySave } from '../state.js';
import { pinHour } from '../daytime.js';
import { sfx } from '../audio.js';
import { createRecorder } from './recorder.js';
import { createDirector } from './director.js';
import { SHOTS, TRAILER_SAVE } from './shots.js';

// 视频尺寸（像素）和帧率
const VIDEO_SIZE = [1920, 1080];
const FPS = 30;
// 开发服务器上存视频的接口（见 vite.config.js）
const SAVE_ENDPOINT = '/__trailer/save';
// 最后一个镜头演完以后多录一会儿（秒），黑场不会被截掉一截
const TAIL_SECONDS = 0.3;
// 小屋钉在下午两点：分镜是照午后的暖光拍的，不随录的时候是几点变
const TRAILER_HOUR = 14;

/**
 * 进入宣传片模式
 * @param {object} game main.js 交出来的游戏接口
 */
export function runTrailer(game) {
  useMemorySave(TRAILER_SAVE);
  pinHour(TRAILER_HOUR);
  document.body.classList.add('trailer');
  game.setRenderSize(VIDEO_SIZE);

  const recorder = createRecorder(VIDEO_SIZE, FPS);
  recorder.canvas.id = 'trailer-view';
  const panel = buildPanel();
  document.getElementById('app').append(recorder.canvas, panel.root);

  panel.onStart(async (record) => {
    // 这一下点击让浏览器允许出声，录音要在它之后拿
    sfx.unlock();
    const ended = new Promise((resolve) => {
      const director = createDirector(game, SHOTS, { recorder, onEnd: resolve });
      director.begin();
      game.setDirector(director);
    });

    if (!record) {
      panel.status('预览中……');
      game.loop();
      await ended;
      panel.status('预览完了，刷新页面可以再来一次');
      return;
    }

    const extension = recorder.start(sfx.recordingStream());
    panel.status(`录制中（${extension}）……`);
    game.loop();
    await ended;
    await new Promise((resolve) => setTimeout(resolve, TAIL_SECONDS * 1000));
    const video = await recorder.stop();
    panel.status('录好了，正在保存……');
    await deliver(video, panel);
  });
}

/**
 * 把录好的视频交出去：开发服务器上直接存进项目，不行就给下载链接
 * @param {{ blob: Blob, extension: string }} video 录好的视频
 * @param {object} panel 控制面板
 */
async function deliver({ blob, extension }, panel) {
  const name = `trailer-${timestamp()}.${extension}`;
  const sizeMb = (blob.size / 1024 / 1024).toFixed(1);
  panel.download(URL.createObjectURL(blob), name);

  let response;
  try {
    response = await fetch(`${SAVE_ENDPOINT}?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
  } catch (error) {
    console.warn('存不进项目文件夹（不是开发服务器？），只能点链接下载', error);
    panel.status(`录好了（${sizeMb} MB），点下面的链接下载`);
    return;
  }
  if (!response.ok) {
    console.warn(`开发服务器没存上视频：${response.status}`);
    panel.status(`录好了（${sizeMb} MB），没存进项目，点下面的链接下载`);
    return;
  }
  const { path } = await response.json();
  panel.status(`录好了（${sizeMb} MB），已存到 ${path}`);
}

/**
 * 文件名用的时间：年月日-时分秒
 * @returns {string}
 */
function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${date}-${time}`;
}

/**
 * 做右上角的小控制面板（不会录进视频）
 * @returns {object} root 面板本身；onStart(fn) 点开始时调用 fn(要不要录)；status(text) 改说明；download(url, name) 放下载链接
 */
function buildPanel() {
  const root = document.createElement('div');
  root.id = 'trailer-panel';
  root.innerHTML = `
    <div class="trailer-title">🎬 宣传片：小屋 + 霓虹夜都</div>
    <div class="trailer-buttons">
      <button class="pill" data-record="1">● 开始录制</button>
      <button class="pill" data-record="0">▶ 只预览</button>
    </div>
    <div class="trailer-status">点开始后自动演完，约一分钟；录制时别切走这个窗口</div>
    <a class="trailer-download" hidden></a>
  `;
  const statusLine = root.querySelector('.trailer-status');
  const link = root.querySelector('.trailer-download');

  return {
    root,
    onStart(fn) {
      for (const button of root.querySelectorAll('button')) {
        button.addEventListener('click', () => {
          root.querySelector('.trailer-buttons').hidden = true;
          fn(button.dataset.record === '1').catch((error) => {
            statusLine.textContent = `出错了：${error.message}`;
            throw error;
          });
        });
      }
    },
    status(text) {
      statusLine.textContent = text;
    },
    download(url, name) {
      link.href = url;
      link.download = name;
      link.textContent = `⬇ 下载 ${name}`;
      link.hidden = false;
    },
  };
}
