// 录像：每帧把背景渐变、3D 画面、字幕叠到一块画布上，再用浏览器自带的 MediaRecorder 连声音一起录下来
// 是按真实时间录的（声音是现场合成的，只能实时录），电脑卡的时候画面会掉帧
import { paintBackdrop } from './backdrop.js';

// 换背景时新旧两张交叉淡化多久（秒）：和游戏里网页背景的过渡一样长
const BACKDROP_FADE = 0.6;
// 视频码率（比特/秒）：1080p 的小立体模型细节多，给足一点，不然霓虹边上会糊
const VIDEO_BITRATE = 16_000_000;
const AUDIO_BITRATE = 192_000;
// 按顺序挑浏览器支持的第一种格式：能直接录 MP4 最好，不行就 WebM
const FORMATS = [
  { mimeType: 'video/mp4;codecs=avc1.640028,mp4a.40.2', extension: 'mp4' },
  { mimeType: 'video/mp4', extension: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
];

/**
 * 挑一种这个浏览器能录的视频格式
 * @returns {{ mimeType: string, extension: string }}
 */
function pickFormat() {
  const format = FORMATS.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType));
  if (!format) {
    throw new Error('这个浏览器的 MediaRecorder 既录不了 MP4 也录不了 WebM');
  }
  return format;
}

/**
 * 做一个录像机
 * @param {number[]} size 视频尺寸 [宽, 高]，像素
 * @param {number} fps 每秒录多少帧
 * @returns {object} 录像机：canvas 是要录（也拿来预览）的画布，compose() 每帧叠一次画面，start() / stop() 开始和结束录制
 */
export function createRecorder([width, height], fps) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  // 背景：画好的渐变存成小画布，换背景时新的一张慢慢盖上旧的
  const backdropCache = new Map();
  let backdrop = null;
  let previousBackdrop = null;
  let backdropBlend = 1;

  let mediaRecorder = null;
  let chunks = [];
  let format = null;

  /**
   * 拿一张画好的背景（同一种写法只画一次）
   * @param {string} css 背景的 CSS 渐变
   * @returns {HTMLCanvasElement}
   */
  function backdropImage(css) {
    if (!backdropCache.has(css)) {
      const image = document.createElement('canvas');
      image.width = width;
      image.height = height;
      paintBackdrop(image.getContext('2d'), css, width, height);
      backdropCache.set(css, image);
    }
    return backdropCache.get(css);
  }

  /**
   * 铺背景，换了背景时新旧交叉淡化
   * @param {string} css 这一帧的背景
   * @param {number} dt 离上一帧多少秒
   */
  function drawBackdrop(css, dt) {
    if (css !== backdrop) {
      previousBackdrop = backdrop;
      backdrop = css;
      backdropBlend = previousBackdrop ? 0 : 1;
    }
    backdropBlend = Math.min(1, backdropBlend + dt / BACKDROP_FADE);

    if (previousBackdrop && backdropBlend < 1) {
      context.drawImage(backdropImage(previousBackdrop), 0, 0);
    }
    context.save();
    context.globalAlpha = backdropBlend;
    context.drawImage(backdropImage(css), 0, 0);
    context.restore();
  }

  return {
    canvas,

    /**
     * 叠出这一帧：背景 → 3D 画面 → 字幕这些
     * @param {HTMLCanvasElement} source 刚画完的 3D 画布（和视频一样大）
     * @param {object} layers 这一帧要叠的东西
     * @param {string} layers.backdrop 方块外面的背景 CSS
     * @param {number} layers.dt 离上一帧多少秒
     * @param {(context: CanvasRenderingContext2D) => void} layers.overlay 最后画上去的字幕、标题、黑场
     */
    compose(source, { backdrop: css, dt, overlay }) {
      drawBackdrop(css, dt);
      context.drawImage(source, 0, 0, width, height);
      overlay(context);
    },

    /**
     * 开始录（画面加上声音）
     * @param {MediaStream | null} audioStream 游戏的声音；拿不到时只录画面，并提示一下
     * @returns {string} 录的是什么格式，比如 mp4
     */
    start(audioStream) {
      format = pickFormat();
      const stream = canvas.captureStream(fps);
      if (audioStream) {
        for (const track of audioStream.getAudioTracks()) {
          stream.addTrack(track);
        }
      } else {
        console.warn('拿不到游戏的声音，这次只录画面');
      }

      chunks = [];
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: format.mimeType,
        videoBitsPerSecond: VIDEO_BITRATE,
        audioBitsPerSecond: AUDIO_BITRATE,
      });
      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size) {
          chunks.push(event.data);
        }
      });
      mediaRecorder.addEventListener('error', (event) => {
        console.error('录像出错了', event.error);
      });
      // 每秒交一块数据：中途出问题时前面录的不会全丢
      mediaRecorder.start(1000);
      return format.extension;
    },

    /**
     * 停止录制，拿到整段视频
     * @returns {Promise<{ blob: Blob, extension: string }>}
     */
    stop() {
      if (!mediaRecorder) {
        return Promise.reject(new Error('还没开始录就要停'));
      }
      const recorder = mediaRecorder;
      mediaRecorder = null;
      return new Promise((resolve) => {
        recorder.addEventListener('stop', () => {
          resolve({ blob: new Blob(chunks, { type: format.mimeType }), extension: format.extension });
        });
        recorder.stop();
      });
    },
  };
}
