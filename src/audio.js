// 全部用 WebAudio 现场合成的小音效，不需要任何音频文件
import { state } from './state.js';

let ctx = null;
let master = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, { type = 'sine', vol = 0.5, slide = 0 } = {}) {
  const c = ac();
  if (!c || state.muted) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

let noiseBuf = null;
function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      // 略带“粉红”的噪声，听起来更像雨
      last = 0.97 * last + 0.03 * (Math.random() * 2 - 1);
      d[i] = (Math.random() * 2 - 1) * 0.5 + last * 4;
    }
  }
  return noiseBuf;
}

// ---------- 环境声（雨声等），跟着场景切换 ----------
let ambientKind = null;
let ambientNodes = null;
// 各种环境声：音量和音色（低通频率）
const AMBIENT = {
  rain: { vol: 0.32, lowpass: 2600 },
  city: { vol: 0.08, lowpass: 500 },
  sea: { vol: 0.3, lowpass: 900, swell: true },
};
const ambientVol = () => (state.muted || !AMBIENT[ambientKind] ? 0 : AMBIENT[ambientKind].vol);

function stopAmbient() {
  if (!ambientNodes) return;
  const { src, gain } = ambientNodes;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.6);
  src.stop(t + 0.7);
  if (ambientNodes.lfo) ambientNodes.lfo.stop(t + 0.7);
  ambientNodes = null;
}

function startAmbient() {
  const c = ctx;
  if (!c || !ambientKind || ambientNodes) return;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 400;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  const cfg = AMBIENT[ambientKind] || AMBIENT.city;
  lp.frequency.value = cfg.lowpass;
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(ambientVol(), c.currentTime + 1.2);
  let lfo = null;
  if (cfg.swell) {
    // 海浪：用很慢的振荡器让音量一涨一落
    const swell = c.createGain();
    swell.gain.value = 0.55;
    lfo = c.createOscillator();
    lfo.frequency.value = 0.12;
    const depth = c.createGain();
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(swell.gain);
    lfo.start();
    src.connect(hp).connect(lp).connect(swell).connect(gain).connect(master);
  } else {
    src.connect(hp).connect(lp).connect(gain).connect(master);
  }
  src.start();
  ambientNodes = { src, gain, lfo };
}

export const sfx = {
  unlock() {
    ac();
    startAmbient();
  },
  ambient(kind) {
    if (kind === ambientKind) return;
    ambientKind = kind;
    if (!ctx) return; // 等第一次点击后再开始
    stopAmbient();
    startAmbient();
  },
  refreshAmbient() {
    if (!ctx || !ambientNodes) return;
    ambientNodes.gain.gain.linearRampToValueAtTime(ambientVol(), ctx.currentTime + 0.3);
  },
  thunder() {
    const c = ac();
    if (!c || state.muted) return;
    const src = c.createBufferSource();
    src.buffer = noise(c);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    const g = c.createGain();
    const t = c.currentTime + 0.25;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(1.6, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    src.connect(lp).connect(g).connect(master);
    src.start();
    src.stop(t + 2.4);
  },
  pop() {
    tone(660, 0, 0.08, { type: 'triangle', vol: 0.3, slide: 1.5 });
  },
  click() {
    tone(520, 0, 0.05, { type: 'triangle', vol: 0.2 });
  },
  pickup() {
    [784, 988, 1319].forEach((f, i) => tone(f, i * 0.07, 0.25, { type: 'triangle', vol: 0.35 }));
  },
  fanfare() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => tone(f, i * 0.11, i === notes.length - 1 ? 0.7 : 0.2, { type: 'square', vol: 0.12 }));
    notes.forEach((f, i) => tone(f / 2, i * 0.11, 0.2, { type: 'triangle', vol: 0.25 }));
  },
  ending() {
    const melody = [523, 659, 784, 659, 698, 880, 784, 0, 659, 784, 1047, 988, 1047];
    melody.forEach((f, i) => f && tone(f, i * 0.18, 0.3, { type: 'triangle', vol: 0.3 }));
    [262, 349, 392, 523].forEach((f, i) => tone(f, i * 0.6, 0.6, { type: 'sine', vol: 0.2 }));
  },
  whoosh() {
    tone(300, 0, 0.35, { type: 'sine', vol: 0.25, slide: 3 });
  },
  horn() {
    tone(392, 0, 0.18, { type: 'square', vol: 0.05 });
    tone(392, 0.22, 0.25, { type: 'square', vol: 0.05 });
  },
  // 动森风格的“叽里咕噜”说话声
  blip() {
    const f = 380 + Math.random() * 260;
    tone(f, 0, 0.05, { type: 'square', vol: 0.06, slide: 1.1 });
  },
};
