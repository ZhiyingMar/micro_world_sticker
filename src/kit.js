// 造型工具箱：同一套积木，按世界风格（cozy 动森风 / toon 童话风 / pixel 像素风）换材质和细分度
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let toonGradient = null;
function getToonGradient() {
  if (!toonGradient) {
    const data = new Uint8Array([110, 180, 255]);
    toonGradient = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
    toonGradient.minFilter = toonGradient.magFilter = THREE.NearestFilter;
    toonGradient.needsUpdate = true;
  }
  return toonGradient;
}

const matCache = new Map();

export function makeMat(style, color, opts = {}) {
  const key = `${style}|${color}|${JSON.stringify(opts)}`;
  let m = matCache.get(key);
  if (m) return m;
  if (style === 'toon') m = new THREE.MeshToonMaterial({ color, gradientMap: getToonGradient(), ...opts });
  else if (style === 'pixel') m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });
  else m = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...opts });
  matCache.set(key, m);
  return m;
}

// 可复现的随机数，保证每次进入世界时花草位置一样
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Kit {
  constructor(style) {
    this.style = style;
    this.pixel = style === 'pixel';
  }

  m(color, opts) {
    return makeMat(this.style, color, opts);
  }

  mesh(geo, color, opts) {
    const me = new THREE.Mesh(geo, typeof color === 'object' && color.isMaterial ? color : this.m(color, opts));
    me.castShadow = true;
    me.receiveShadow = true;
    return me;
  }

  seg(n) {
    return this.pixel ? Math.max(4, Math.round(n / 4)) : n;
  }

  box(w, h, d, color, r = 0.05, opts) {
    if (typeof r === 'object') {
      opts = r;
      r = 0.05;
    }
    const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    const geo = this.pixel || rr <= 0.001 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 3, rr);
    return this.mesh(geo, color, opts);
  }

  sphere(r, color, seg = 24, opts) {
    return this.mesh(new THREE.SphereGeometry(r, this.seg(seg), Math.max(3, this.seg(Math.round(seg * 0.7)))), color, opts);
  }

  // 半球（蘑菇盖、头发等）
  dome(r, color, thetaLen = Math.PI / 2, seg = 24, opts) {
    return this.mesh(new THREE.SphereGeometry(r, this.seg(seg), this.seg(Math.round(seg / 2)), 0, Math.PI * 2, 0, thetaLen), color, opts);
  }

  cyl(rt, rb, h, color, seg = 24, opts) {
    return this.mesh(new THREE.CylinderGeometry(rt, rb, h, this.seg(seg)), color, opts);
  }

  cone(r, h, color, seg = 24, opts) {
    return this.mesh(new THREE.ConeGeometry(r, h, this.seg(seg)), color, opts);
  }

  torus(r, tube, color, opts) {
    return this.mesh(new THREE.TorusGeometry(r, tube, this.pixel ? 4 : 10, this.seg(28)), color, opts);
  }

  // 用字符画拼出像素物件：rows 为字符串数组，palette 映射字符到颜色
  pixelArt(rows, palette, px = 0.05, depth = 0.05, opts) {
    const g = new THREE.Group();
    const byColor = {};
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const color = palette[ch];
        if (!color) return;
        const geo = new THREE.BoxGeometry(px, px, depth);
        geo.translate((x - (w - 1) / 2) * px, ((h - 1) / 2 - y) * px, 0);
        (byColor[color] ||= []).push(geo);
      });
    });
    for (const [color, geos] of Object.entries(byColor)) {
      const o = opts && opts[color] ? opts[color] : undefined;
      g.add(this.mesh(mergeGeometries(geos), makeMat(this.style, color, o)));
    }
    return g;
  }

  star(r, color, depth = 0.06, opts) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.48;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: !this.pixel,
      bevelSize: depth * 0.4,
      bevelThickness: depth * 0.4,
      bevelSegments: 2,
    });
    geo.center();
    return this.mesh(geo, color, opts);
  }
}

export function at(obj, x = 0, y = 0, z = 0, ry = 0) {
  obj.position.set(x, y, z);
  if (ry) obj.rotation.y = ry;
  return obj;
}

// 楼房外立面：返回贴图 map（白天的样子）和 emissiveMap（只有亮着的窗户）
export function facade(cols, rows, { wall = '#8a8fa8', frame = '#5a5f78', dark = '#2a3048', lit = '#ffd98a', ratio = 0.5, seed = 1, cell = 32 } = {}) {
  const r = rng(seed);
  const lights = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) lights.push(r() < ratio);
  const draw = (emissive) => (g, w, h) => {
    g.fillStyle = emissive ? '#000000' : wall;
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const on = lights[y * cols + x];
        const wx = x * cell + cell * 0.2;
        const wy = y * cell + cell * 0.22;
        const ww = cell * 0.6;
        const wh = cell * 0.56;
        if (!emissive) {
          g.fillStyle = frame;
          g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
        }
        if (emissive && !on) continue;
        g.fillStyle = on ? lit : dark;
        g.fillRect(wx, wy, ww, wh);
      }
    }
  };
  return {
    map: canvasTexture(cols * cell, rows * cell, draw(false)),
    emissive: canvasTexture(cols * cell, rows * cell, draw(true)),
  };
}

export function canvasTexture(w, h, draw, { pixel = false, repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (pixel) {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
  } else {
    tex.anisotropy = 4;
  }
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}
