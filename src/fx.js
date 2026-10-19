import * as THREE from 'three';
import { rng } from './kit.js';

const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

// ---------- 小人头顶的表情气泡 ----------
const bubbleCache = new Map();
export function bubbleTexture(text) {
  let tex = bubbleCache.get(text);
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fffaf0';
  g.strokeStyle = 'rgba(107,79,58,0.25)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(64, 56, 46, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(52, 96);
  g.lineTo(64, 120);
  g.lineTo(76, 96);
  g.fill();
  g.font = `56px ${EMOJI_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#6b4f3a';
  g.fillText(text, 64, 60);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  bubbleCache.set(text, tex);
  return tex;
}

export function makeBubble() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture('♪'), transparent: true, depthWrite: false }));
  s.scale.set(0.5, 0.5, 0.5);
  s.visible = false;
  s.renderOrder = 10;
  return s;
}

// ---------- 闪光粒子 ----------
let starTex = null;
function getStarTex() {
  if (starTex) return starTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(32, 2);
  g.quadraticCurveTo(35, 29, 62, 32);
  g.quadraticCurveTo(35, 35, 32, 62);
  g.quadraticCurveTo(29, 35, 2, 32);
  g.quadraticCurveTo(29, 29, 32, 2);
  g.fill();
  starTex = new THREE.CanvasTexture(c);
  return starTex;
}

export class Sparkles {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.list = [];
  }

  emit(pos, { color = '#fff6b0', count = 1, spread = 0.25, size = 0.22, life = 0.9, rise = 0.5 } = {}) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: getStarTex(),
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const s = new THREE.Sprite(mat);
      s.position.set(
        pos.x + (Math.random() - 0.5) * spread * 2,
        pos.y + (Math.random() - 0.3) * spread,
        pos.z + (Math.random() - 0.5) * spread * 2,
      );
      s.scale.setScalar(0.001);
      s.renderOrder = 11;
      this.group.add(s);
      this.list.push({
        s,
        t: 0,
        life: life * (0.7 + Math.random() * 0.6),
        size: size * (0.6 + Math.random() * 0.8),
        vy: rise * (0.5 + Math.random()),
        vx: (Math.random() - 0.5) * rise * 0.6,
        vz: (Math.random() - 0.5) * rise * 0.6,
      });
    }
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) {
        this.group.remove(p.s);
        p.s.material.dispose();
        this.list.splice(i, 1);
        continue;
      }
      p.s.position.x += p.vx * dt;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      p.s.scale.setScalar(p.size * Math.sin(k * Math.PI));
      p.s.material.rotation += dt * 2;
    }
  }
}

// ---------- 灯光/霓虹的光晕 ----------
let glowTex = null;
function getGlowTex() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function glow(color, size = 1, opacity = 0.8) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getGlowTex(),
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  s.scale.setScalar(size);
  s.renderOrder = 5;
  return s;
}

// 霓虹/招牌文字：不受光照影响，自己发光
export function neonText(text, { color = '#ff5fa2', bg = 'rgba(0,0,0,0)', font = 'bold 64px "Microsoft YaHei", sans-serif', w = 256, h = 96 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = '#ffffff';
  g.fillText(text, w / 2, h / 2 + 2);
  g.shadowBlur = 8;
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- 方块世界底下的软阴影 ----------
export function blobShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(60,40,30,0.35)');
  grd.addColorStop(0.6, 'rgba(60,40,30,0.15)');
  grd.addColorStop(1, 'rgba(60,40,30,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// 漂浮的萤火虫/光点
export function makeMotes(count, area, color, seed = 1) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (r() - 0.5) * area;
    pos[i * 3 + 1] = 0.3 + r() * 2.5;
    pos[i * 3 + 2] = (r() - 0.5) * area;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const base = pos.slice();
  const mat = new THREE.PointsMaterial({
    map: getStarTex(),
    color,
    size: 0.18,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData.update = (t) => {
    const a = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      a[i * 3] = base[i * 3] + Math.sin(t * 0.5 + i) * 0.3;
      a[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.8 + i * 1.7) * 0.25;
      a[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.4 + i * 0.9) * 0.3;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = 0.6 + Math.sin(t * 2) * 0.3;
  };
  return pts;
}

// ---------- 远处的星空 ----------

// 三层星星：越暗的越多、越小、越远，最亮的只有几颗、离得近一些
// size 是屏幕上的像素（镜头一般拉得很远、视角很窄，按世界大小算会小得看不见）
// depth 是这层在球壳里占哪一段：0 是最里面，1 是最外面
const STAR_LAYERS = [
  { count: 900, size: 5, opacity: 0.5, color: '#c9d2ff', depth: [0.55, 1] },
  { count: 260, size: 7, opacity: 0.8, color: '#e8ecff', depth: [0.25, 0.75] },
  { count: 45, size: 13, opacity: 1, color: '#fff4c2', depth: [0, 0.45] },
];
// 每层再分几组，各闪各的，看着不像一起呼吸
const TWINKLE_GROUPS = 3;
// 闪烁：亮度在 (1 - 幅度) ~ 1 之间来回，速度是每秒多少弧度
const TWINKLE_DEPTH = 0.45;
const TWINKLE_SPEED = [1.1, 2.3];

/**
 * 在方块后面撒一片很远的星星（3D 的点，不是贴在屏幕上的图）
 * @description 星星在方块后面一层厚厚的球壳上，转镜头时远近不同的星星错开移动，才有"外面是夜空"的空间感；
 *   只撒在背对镜头的一个锥形里（镜头看得到的那片），不会有星星飘在镜头和方块中间
 * @param {object} options
 * @param {THREE.Vector3} options.away 镜头所在的方向（从方块中心指向镜头），星星撒在它的正对面
 * @param {number} options.spread 锥形的半角（弧度），要盖住镜头能转到的范围
 * @param {number} options.near 球壳内半径（世界单位），要比方块大，星星才不会插进方块里
 * @param {number} options.far 球壳外半径（世界单位）
 * @param {number} options.seed 随机种子，同一个种子每次撒得一样
 * @returns {{ group: THREE.Group, update(t: number): void }} 星星，和每帧调用的闪烁
 */
export function makeStarField({ away, spread, near, far, seed = 1 }) {
  const random = rng(seed);
  const behind = away.clone().normalize().negate();
  const group = new THREE.Group();
  const twinklers = [];

  for (const layer of STAR_LAYERS) {
    const perGroup = Math.ceil(layer.count / TWINKLE_GROUPS);
    const layerNear = near + (far - near) * layer.depth[0];
    const layerFar = near + (far - near) * layer.depth[1];

    for (let i = 0; i < TWINKLE_GROUPS; i++) {
      const positions = scatterInCone(perGroup, behind, spread, layerNear, layerFar, random);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        map: getStarTex(),
        color: layer.color,
        size: layer.size,
        sizeAttenuation: false,
        transparent: true,
        opacity: layer.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      group.add(new THREE.Points(geometry, material));

      const speed = TWINKLE_SPEED[0] + random() * (TWINKLE_SPEED[1] - TWINKLE_SPEED[0]);
      twinklers.push({ material, peak: layer.opacity, speed, phase: random() * Math.PI * 2 });
    }
  }

  const update = (t) => {
    for (const twinkler of twinklers) {
      const wave = (Math.sin(t * twinkler.speed + twinkler.phase) + 1) / 2;
      twinkler.material.opacity = twinkler.peak * (1 - TWINKLE_DEPTH * wave);
    }
  };
  return { group, update };
}

/**
 * 在一个锥形里随机撒点：方向均匀落在锥形里，远近落在 near ~ far 之间
 * @param {number} count 撒几个
 * @param {THREE.Vector3} axis 锥形的中轴（单位向量）
 * @param {number} spread 锥形半角（弧度）
 * @param {number} near 最近多远
 * @param {number} far 最远多远
 * @param {Function} random 返回 0~1 的随机数
 * @returns {Float32Array} 每三个数一个点 (x, y, z)
 */
function scatterInCone(count, axis, spread, near, far, random) {
  const positions = new Float32Array(count * 3);
  // 跟中轴垂直的两个方向，用来把"偏离中轴多少"转成真正的方向
  const helper = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const sideA = new THREE.Vector3().crossVectors(axis, helper).normalize();
  const sideB = new THREE.Vector3().crossVectors(axis, sideA);
  const direction = new THREE.Vector3();
  const minCos = Math.cos(spread);

  for (let i = 0; i < count; i++) {
    // cos 均匀取，方向在锥形的球面上才是均匀的
    const cosOff = minCos + random() * (1 - minCos);
    const sinOff = Math.sqrt(1 - cosOff * cosOff);
    const turn = random() * Math.PI * 2;
    direction
      .copy(axis)
      .multiplyScalar(cosOff)
      .addScaledVector(sideA, Math.cos(turn) * sinOff)
      .addScaledVector(sideB, Math.sin(turn) * sinOff);

    // 半径按体积均匀取，远处不会挤成一层
    const radius = Math.cbrt(near ** 3 + random() * (far ** 3 - near ** 3));
    positions[i * 3] = direction.x * radius;
    positions[i * 3 + 1] = direction.y * radius;
    positions[i * 3 + 2] = direction.z * radius;
  }
  return positions;
}
