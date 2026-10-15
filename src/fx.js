import * as THREE from 'three';

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

// 贴地圆影：不画实时阴影，人和物品脚下贴一块软软的深色圆片，看得出站在哪儿
let contactMat = null;
const contactGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
export function contactShadow(r) {
  if (!contactMat) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(30,24,40,0.42)');
    grd.addColorStop(0.55, 'rgba(30,24,40,0.28)');
    grd.addColorStop(1, 'rgba(30,24,40,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    contactMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  }
  const m = new THREE.Mesh(contactGeo, contactMat);
  m.scale.setScalar(r);
  m.renderOrder = 1;
  m.userData.contactShadow = true;
  return m;
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
