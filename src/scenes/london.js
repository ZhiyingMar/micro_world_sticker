// 雨天伦敦 —— 一直在下雨：双层巴士、红电话亭、大本钟、联排小楼、水坑和闪电
import * as THREE from 'three';
import { at, rng, canvasTexture } from '../kit.js';
import { glow, neonText } from '../fx.js';
import { sfx } from '../audio.js';

function cobbleTexture() {
  return canvasTexture(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#5d636c';
      g.fillRect(0, 0, W, H);
      const r = rng(21);
      const size = 32;
      for (let y = 0; y < H; y += size * 0.75) {
        const off = (Math.round(y / (size * 0.75)) % 2) * size * 0.5;
        for (let x = -size; x < W + size; x += size) {
          const v = 120 + Math.floor(r() * 40);
          g.fillStyle = `rgb(${v},${v + 4},${v + 12})`;
          g.beginPath();
          g.ellipse(x + off + size / 2, y + size * 0.38, size * 0.44, size * 0.32, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    },
    { repeat: [6, 6] },
  );
}

function prism(k, w, d, h, color) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.lineTo(-w / 2, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  return k.mesh(geo, color);
}

function terrace(w) {
  const k = w.kit;
  const g = new THREE.Group();
  const houses = [
    { x: -3.7, h: 2.6, wall: '#b5523f', door: '#2e5a8a', roof: '#4a4f5c' },
    { x: -2.1, h: 3.0, wall: '#ece2cc', door: '#c8102e', roof: '#3d424f' },
    { x: -0.5, h: 2.7, wall: '#6f8fae', door: '#2f2f38', roof: '#4a4f5c' },
  ];
  for (const hs of houses) {
    const house = new THREE.Group();
    house.add(at(k.box(1.6, hs.h, 2.0, hs.wall, 0.03), 0, hs.h / 2, 0));
    house.add(at(k.box(1.66, 0.12, 2.06, '#e8e4dc', 0.02), 0, hs.h, 0));
    const roof = prism(k, 1.62, 2.0, 0.7, hs.roof);
    roof.rotation.y = Math.PI / 2;
    house.add(at(roof, 0, hs.h + 0.06, 0));
    house.add(at(k.box(0.3, 0.6, 0.3, '#8a4a3a', 0.02), 0.45, hs.h + 0.5, -0.4));
    for (const x of [0.38, 0.52]) house.add(at(k.cyl(0.05, 0.05, 0.14, '#c96a4a', 8), x, hs.h + 0.86, -0.4));
    // 窗户：两层，每层两扇
    for (const y of [1.0, hs.h - 0.75]) {
      for (const x of [-0.42, 0.42]) {
        if (y === 1.0 && x === 0.42) continue;
        house.add(at(k.box(0.42, 0.55, 0.06, '#ffffff', 0.02), x, y, 1.0));
        house.add(at(k.box(0.34, 0.47, 0.06, '#ffe9b0', 0.01, { emissive: '#ffd27a', emissiveIntensity: 0.9 }), x, y, 1.02));
        house.add(at(k.box(0.34, 0.03, 0.07, '#ffffff', 0.005), x, y, 1.04));
      }
    }
    house.add(at(k.box(0.5, 0.9, 0.08, '#ffffff', 0.02), 0.42, 0.5, 1.0));
    house.add(at(k.box(0.4, 0.82, 0.08, hs.door, 0.03), 0.42, 0.46, 1.03));
    house.add(at(k.sphere(0.03, '#d4a82a', 8), 0.55, 0.46, 1.09));
    house.add(at(k.box(0.6, 0.08, 0.3, '#d6d2c8', 0.02), 0.42, 0.04, 1.15));
    g.add(at(house, hs.x, 0, 0));
  }
  w.add(g, 0, 0, -3.5);
  w.solid(g);
}

function bigBen(w) {
  const k = w.kit;
  const stone = '#d8c08a';
  const g = new THREE.Group();
  g.add(at(k.box(1.3, 0.4, 1.3, '#bfa672', 0.03), 0, 0.2, 0));
  g.add(at(k.box(1.0, 3.2, 1.0, stone, 0.02), 0, 2.0, 0));
  for (const s of [-1, 1]) {
    for (const t of [-0.25, 0.25]) {
      g.add(at(k.box(0.05, 3.0, 0.04, '#c2a76c', 0.01), t, 2.0, s * 0.51));
      g.add(at(k.box(0.04, 3.0, 0.05, '#c2a76c', 0.01), s * 0.51, 2.0, t));
    }
  }
  g.add(at(k.box(1.18, 1.1, 1.18, stone, 0.03), 0, 4.15, 0));
  const clockTex = w.texture(
    canvasTexture(128, 128, (c) => {
      c.fillStyle = '#c9a85a';
      c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#fff8e0';
      c.beginPath();
      c.arc(64, 64, 52, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#3a3020';
      c.lineWidth = 4;
      c.stroke();
      c.fillStyle = '#3a3020';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        c.fillRect(64 + Math.cos(a) * 42 - 3, 64 + Math.sin(a) * 42 - 3, 6, 6);
      }
    }),
  );
  const clockMat = new THREE.MeshStandardMaterial({ map: clockTex, emissiveMap: clockTex, emissive: '#fff1c4', emissiveIntensity: 0.55 });
  const hands = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const face = new THREE.Group();
    face.rotation.y = a;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), clockMat);
    plane.position.z = 0.6;
    face.add(plane);
    const hh = new THREE.Group();
    hh.position.set(0, 0, 0.62);
    hh.add(at(k.box(0.04, 0.22, 0.02, '#2a2418', 0.005), 0, 0.1, 0));
    const mh = new THREE.Group();
    mh.position.set(0, 0, 0.63);
    mh.add(at(k.box(0.03, 0.34, 0.02, '#2a2418', 0.005), 0, 0.16, 0));
    face.add(hh, mh);
    hands.push({ hh, mh });
    face.position.y = 4.15;
    g.add(face);
  }
  g.add(at(k.box(0.9, 0.7, 0.9, stone, 0.02), 0, 5.05, 0));
  for (const s of [-1, 1]) {
    g.add(at(k.box(0.5, 0.45, 0.04, '#3a3428', 0.01), 0, 5.05, s * 0.46));
    g.add(at(k.box(0.04, 0.45, 0.5, '#3a3428', 0.01), s * 0.46, 5.05, 0));
  }
  const roof = k.cone(0.72, 1.4, '#4a5a52', 4);
  roof.rotation.y = Math.PI / 4;
  g.add(at(roof, 0, 6.1, 0));
  g.add(at(k.cyl(0.02, 0.03, 0.5, '#d4a82a', 6), 0, 7.0, 0));
  w.add(g, 3.3, 0, -3.4);
  w.solid(g.children[0]);
  w.onUpdate((dt, t) => {
    for (const h of hands) {
      h.mh.rotation.z = -t * 0.25;
      h.hh.rotation.z = -t * 0.25 / 12 - 1.2;
    }
  });
}

function phoneBooth(w, x, z) {
  const k = w.kit;
  const red = '#c8102e';
  const g = new THREE.Group();
  g.add(at(k.box(0.78, 0.08, 0.78, '#9a9a9a', 0.02), 0, 0.04, 0));
  for (const [px, pz] of [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]]) g.add(at(k.box(0.08, 1.6, 0.08, red, 0.02), px, 0.88, pz));
  const glass = { emissive: '#fff4d0', emissiveIntensity: 0.45, transparent: true, opacity: 0.78 };
  // 背面和两侧的格子窗
  const panel = (w2, rot, px, pz) => {
    const p = new THREE.Group();
    p.add(at(k.box(w2, 1.3, 0.03, '#f4f1ea', 0, glass), 0, 0, 0));
    for (let i = 1; i < 4; i++) p.add(at(k.box(w2, 0.04, 0.05, red, 0), 0, -0.65 + i * 0.33, 0));
    p.add(at(k.box(0.04, 1.3, 0.05, red, 0), 0, 0, 0));
    p.rotation.y = rot;
    p.position.set(px, 0.85, pz);
    g.add(p);
  };
  panel(0.62, 0, 0, -0.34);
  panel(0.62, Math.PI / 2, -0.34, 0);
  panel(0.62, Math.PI / 2, 0.34, 0);
  // 半开的门
  const door = new THREE.Group();
  const dp = new THREE.Group();
  dp.add(at(k.box(0.62, 1.3, 0.03, '#f4f1ea', 0, glass), 0.31, 0, 0));
  for (let i = 1; i < 4; i++) dp.add(at(k.box(0.62, 0.04, 0.05, red, 0), 0.31, -0.65 + i * 0.33, 0));
  dp.add(at(k.box(0.06, 1.3, 0.06, red, 0), 0.6, 0, 0));
  door.add(dp);
  door.position.set(-0.31, 0.85, 0.36);
  door.rotation.y = -2.0; // 向左外侧敞开，不挡住往里看的视线
  g.add(door);
  g.add(at(k.box(0.86, 0.14, 0.86, red, 0.03), 0, 1.72, 0));
  const crown = k.cyl(0.42, 0.42, 0.78, red, 16);
  crown.rotation.z = Math.PI / 2;
  crown.scale.set(1, 1, 0.35);
  g.add(at(crown, 0, 1.79, 0));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.11), new THREE.MeshBasicMaterial({ map: w.texture(neonText('TELEPHONE', { color: '#ffffff', bg: '#1c1c22', font: 'bold 34px sans-serif', w: 256, h: 48 })) }));
  g.add(at(sign, 0, 1.6, 0.4));
  g.add(at(k.box(0.18, 0.24, 0.1, '#1c1c22', 0.02), 0, 1.15, -0.27));
  g.add(at(k.box(0.36, 0.04, 0.2, '#6b4f3a', 0.01), 0, 0.72, -0.22));
  // 点电话亭时，镜头凑到门口往里看
  g.userData.peek = { target: [x, 0.8, z], from: [0.5, 0.9, 2.6] };
  w.add(g, x, 0, z);
  w.solid(g.children[0], -0.02);
  w.add(glow('#fff4d0', 1.6, 0.25), x, 1.2, z);
}

function victorianLamp(w, x, z) {
  const k = w.kit;
  const g = new THREE.Group();
  g.add(at(k.cyl(0.08, 0.12, 0.25, '#1c1c22', 10), 0, 0.12, 0));
  g.add(at(k.cyl(0.035, 0.05, 1.9, '#1c1c22', 10), 0, 1.1, 0));
  g.add(at(k.box(0.24, 0.3, 0.24, '#fff1c4', 0.02, { emissive: '#ffd27a', emissiveIntensity: 1.5 }), 0, 2.15, 0));
  const cap = k.cone(0.22, 0.2, '#1c1c22', 4);
  cap.rotation.y = Math.PI / 4;
  g.add(at(cap, 0, 2.4, 0));
  g.add(at(glow('#ffcf7a', 1.5, 0.5), 0, 2.15, 0));
  const light = new THREE.PointLight('#ffd49a', 4, 5, 1.5);
  light.position.y = 2.0;
  g.add(light);
  w.add(g, x, 0, z);
  w.solidCircle(x, z, 0.12);
}

function bus(w, x, z) {
  const k = w.kit;
  const red = '#c8102e';
  const g = new THREE.Group();
  g.add(at(k.box(2.6, 0.8, 0.86, red, 0.08), 0, 0.55, 0));
  g.add(at(k.box(2.6, 0.72, 0.86, red, 0.12), 0, 1.3, 0));
  g.add(at(k.box(2.62, 0.06, 0.88, '#f4f1ea', 0.02), 0, 0.95, 0));
  const win = { emissive: '#ffe9b0', emissiveIntensity: 0.5 };
  for (const y of [0.7, 1.35]) {
    g.add(at(k.box(2.2, 0.3, 0.88, '#2a3040', 0.03, win), -0.1, y, 0));
    for (let i = 0; i < 6; i++) g.add(at(k.box(0.04, 0.32, 0.9, red, 0), -1.1 + i * 0.4, y, 0));
  }
  g.add(at(k.box(0.05, 0.36, 0.7, '#2a3040', 0.02, win), 1.3, 0.72, 0));
  g.add(at(k.box(0.05, 0.3, 0.7, '#2a3040', 0.02, win), 1.3, 1.38, 0));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.14), new THREE.MeshBasicMaterial({ map: w.texture(neonText('LONDON', { color: '#ffd23f', bg: '#111111', font: 'bold 44px sans-serif', w: 256, h: 60 })) }));
  board.rotation.y = Math.PI / 2;
  g.add(at(board, 1.31, 1.6, 0));
  for (const [wx, wz] of [[0.8, 0.42], [-0.8, 0.42], [0.8, -0.42], [-0.8, -0.42]]) {
    const wh = k.cyl(0.17, 0.17, 0.1, '#1d1d24', 14);
    wh.rotation.x = Math.PI / 2;
    g.add(at(wh, wx, 0.17, wz));
  }
  for (const s of [-1, 1]) {
    g.add(at(k.sphere(0.06, '#fff4c8', 10, { emissive: '#fff4c8', emissiveIntensity: 2 }), 1.31, 0.35, s * 0.3));
    g.add(at(glow('#fff1b8', 0.8, 0.6), 1.42, 0.35, s * 0.3));
  }
  w.add(g, x, 0, z);
  w.solid(g, -0.02);
}

function cab(w, x, z) {
  const k = w.kit;
  const g = new THREE.Group();
  g.add(at(k.box(1.1, 0.34, 0.55, '#1f1f26', 0.1), 0, 0.3, 0));
  g.add(at(k.box(0.62, 0.34, 0.52, '#1f1f26', 0.12), -0.08, 0.6, 0));
  g.add(at(k.box(0.64, 0.2, 0.53, '#3a4458', 0.05, { emissive: '#ffe9b0', emissiveIntensity: 0.2 }), -0.08, 0.62, 0));
  g.add(at(k.box(0.2, 0.08, 0.12, '#ffd23f', 0.02, { emissive: '#ffb800', emissiveIntensity: 1.2 }), -0.08, 0.81, 0));
  for (const [wx, wz] of [[0.34, 0.27], [-0.34, 0.27], [0.34, -0.27], [-0.34, -0.27]]) {
    const wh = k.cyl(0.11, 0.11, 0.08, '#111116', 12);
    wh.rotation.x = Math.PI / 2;
    g.add(at(wh, wx, 0.12, wz));
  }
  for (const s of [-1, 1]) g.add(at(k.sphere(0.045, '#fff4c8', 8, { emissive: '#fff4c8', emissiveIntensity: 2 }), 0.55, 0.32, s * 0.17));
  w.add(g, x, 0, z, Math.PI);
  w.solid(g, -0.02);
}

function rain(w) {
  const N = 520;
  const pos = new Float32Array(N * 6);
  const speed = new Float32Array(N);
  const r = rng(5);
  const H = 8;
  const set = (i, x, y, z) => {
    pos[i * 6] = x;
    pos[i * 6 + 1] = y;
    pos[i * 6 + 2] = z;
    pos[i * 6 + 3] = x + 0.03;
    pos[i * 6 + 4] = y + 0.28;
    pos[i * 6 + 5] = z;
  };
  for (let i = 0; i < N; i++) {
    set(i, (r() - 0.5) * 11, r() * H, (r() - 0.5) * 11);
    speed[i] = 8 + r() * 3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#d4e0f0', transparent: true, opacity: 0.5, depthWrite: false }));
  lines.frustumCulled = false;
  w.root.add(lines);

  // 地上溅起的小水圈
  const rings = [];
  const ringGeo = new THREE.RingGeometry(0.03, 0.05, 14);
  ringGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 36; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#e8f0ff', transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false;
    w.root.add(m);
    rings.push({ m, t: 1 });
  }
  let ri = 0;
  w.onUpdate((dt) => {
    for (let i = 0; i < N; i++) {
      let y = pos[i * 6 + 1] - speed[i] * dt;
      if (y < 0) {
        const x = pos[i * 6];
        const z = pos[i * 6 + 2];
        if (Math.abs(x) < 4.9 && Math.abs(z) < 4.9 && Math.random() < 0.25 && !w.blocked(x, z, 0)) {
          const ring = rings[ri++ % rings.length];
          ring.m.position.set(x, 0.025, z);
          ring.t = 0;
          ring.m.visible = true;
        }
        y += H;
        set(i, (Math.random() - 0.5) * 11, y, (Math.random() - 0.5) * 11);
      } else {
        pos[i * 6 + 1] = y;
        pos[i * 6 + 4] = y + 0.28;
      }
    }
    geo.attributes.position.needsUpdate = true;
    for (const ring of rings) {
      if (ring.t >= 1) continue;
      ring.t += dt / 0.45;
      ring.m.scale.setScalar(1 + ring.t * 2.5);
      ring.m.material.opacity = 0.6 * (1 - ring.t);
      if (ring.t >= 1) ring.m.visible = false;
    }
  });
}

function lightning(w) {
  let next = 8 + Math.random() * 10;
  let flash = -1;
  let base = null;
  w.onUpdate((dt) => {
    const hemi = w.env.hemi;
    if (!hemi) return;
    if (flash < 0) {
      next -= dt;
      if (next <= 0) {
        base = hemi.intensity;
        flash = 0;
        next = 14 + Math.random() * 16;
        sfx.thunder();
      }
      return;
    }
    flash += dt;
    // 两下闪光：亮-暗-亮
    const on = flash < 0.08 || (flash > 0.18 && flash < 0.26);
    hemi.intensity = on ? base + 3.5 : base;
    if (flash > 0.3) {
      hemi.intensity = base;
      flash = -1;
    }
  });
}

export default {
  id: 'london',
  name: '雨天伦敦',
  emoji: '☔',
  style: 'cozy',
  styleLabel: '英伦风 · 雨天',
  magnetStyle: 'london',
  ambient: 'rain',
  bg: 'linear-gradient(180deg, #56637a 0%, #7f8ea3 55%, #a7b2c1 100%)',
  lights: {
    hemi: ['#c4cede', '#4a5260', 1.35],
    sun: ['#d0dcef', 1.1, [5, 10, 6]],
  },
  camera: { pos: [11.5, 11.5, 14.5], target: [0, 1.2, 0], fitH: 4, min: 2.5 },
  spawn: [0.2, -0.8],
  // 第一次进来时，这个小人会主动打招呼
  greet: { name: '亚瑟', text: '日安！欢迎来到伦敦——这里的雨，从来不会停。' },
  // 先暂停：还没照森林的样子重做，冰箱上显示"敬请期待"、进不去；夜都直接合成全家福
  comingSoon: true,
  next: 'beach',
  items: [
    {
      id: 'sunglasses',
      name: '太阳镜',
      icon: '🕶️',
      hint: '红色电话亭里',
      make(k) {
        const g = new THREE.Group();
        for (const s of [-1, 1]) {
          const lens = k.cyl(0.065, 0.065, 0.015, '#2a2a3a', 16);
          lens.rotation.x = Math.PI / 2;
          g.add(at(lens, s * 0.08, 0, 0));
          g.add(at(k.torus(0.067, 0.012, '#ff6b8b', { emissive: '#ff6b8b', emissiveIntensity: 0.5 }), s * 0.08, 0, 0));
          g.add(at(k.box(0.012, 0.012, 0.14, '#ff6b8b', 0.004), s * 0.15, 0.02, -0.07));
        }
        g.add(at(k.box(0.04, 0.015, 0.015, '#ff6b8b', 0.004), 0, 0.03, 0));
        return g;
      },
    },
    {
      id: 'shell',
      name: '扇贝壳',
      icon: '🐚',
      hint: '大本钟背后',
      make(k) {
        const g = new THREE.Group();
        const fan = k.dome(0.14, '#ffc2d1', Math.PI / 2, 18, { emissive: '#ffb3c6', emissiveIntensity: 0.35 });
        fan.scale.set(1, 0.4, 0.8);
        g.add(at(fan, 0, 0.02, 0));
        for (let i = 0; i < 7; i++) {
          const a = -1.2 + (i / 6) * 2.4;
          const rib = k.box(0.015, 0.02, 0.12, '#ff9ab3', 0.005);
          rib.rotation.y = a;
          rib.position.set(Math.sin(a) * 0.06, 0.06, Math.cos(a) * 0.06 - 0.02);
          g.add(rib);
        }
        g.add(at(k.box(0.06, 0.03, 0.04, '#ff9ab3', 0.01), 0, 0.02, -0.1));
        return g;
      },
    },
    {
      id: 'beachball',
      name: '沙滩球',
      icon: '🏐',
      hint: '咖啡座的大伞底下',
      make(k) {
        const g = new THREE.Group();
        const cs = ['#ff5f5f', '#ffffff', '#4fb0ff', '#ffffff', '#ffd23f', '#ffffff'];
        cs.forEach((c, i) => {
          const geo = new THREE.SphereGeometry(0.13, 6, 12, (i / 6) * Math.PI * 2, Math.PI / 3);
          g.add(k.mesh(geo, c, { emissive: c, emissiveIntensity: 0.15 }));
        });
        return g;
      },
    },
  ],
  build(w) {
    const k = w.kit;
    const cobble = w.texture(cobbleTexture());
    const top = k.mesh(new THREE.BoxGeometry(10, 0.3, 10), new THREE.MeshStandardMaterial({ map: cobble, roughness: 0.45, metalness: 0.05 }));
    w.add(top, 0, -0.15, 0);
    w.add(k.box(9.9, 1.4, 9.9, '#3d424c', 0.2), 0, -0.95, 0);
    const road = k.box(10, 0.02, 2.0, '#33383f', 0, { roughness: 0.25, metalness: 0.15 });
    road.castShadow = false;
    w.add(road, 0, 0.01, 1.5);
    for (const z of [1.42, 1.58]) {
      const l = k.box(10, 0.01, 0.04, '#e8d27a', 0);
      l.castShadow = false;
      w.add(l, 0, 0.022, z);
    }
    for (const z of [0.5, 2.5]) {
      const curb = k.box(10, 0.07, 0.1, '#9aa0aa', 0.02);
      curb.castShadow = false;
      w.add(curb, 0, 0.035, z);
    }

    terrace(w);
    bigBen(w);
    phoneBooth(w, 1.4, -2.6);
    bus(w, -1.6, 1.5);
    cab(w, 2.5, 1.5);

    // 邮筒
    const post = new THREE.Group();
    post.add(at(k.cyl(0.2, 0.22, 0.9, '#c8102e', 16), 0, 0.45, 0));
    post.add(at(k.dome(0.22, '#c8102e', Math.PI / 2, 16), 0, 0.9, 0));
    post.add(at(k.box(0.2, 0.03, 0.05, '#1c1c22', 0.01), 0, 0.72, 0.2));
    post.add(at(k.cyl(0.24, 0.24, 0.06, '#1c1c22', 16), 0, 0.03, 0));
    w.add(post, -4.2, 0, -1.6);
    w.solidCircle(-4.2, -1.6, 0.25);
    w.poi(-3.6, -1.6, { emote: '✉', face: -Math.PI / 2, dur: 5 });

    victorianLamp(w, -2.6, 0.2);
    victorianLamp(w, 0.9, 0.2);
    victorianLamp(w, -4.2, 2.95);
    victorianLamp(w, 4.3, 2.95);

    // 咖啡座：大伞 + 桌椅
    const cafe = new THREE.Group();
    cafe.add(at(k.cyl(0.4, 0.4, 0.05, '#f4f1ea', 20), 0, 0.62, 0));
    cafe.add(at(k.cyl(0.04, 0.04, 0.6, '#1c1c22', 8), 0, 0.31, 0));
    cafe.add(at(k.cyl(0.2, 0.22, 0.03, '#1c1c22', 12), 0, 0.015, 0));
    cafe.add(at(k.cyl(0.025, 0.025, 2.0, '#e8e4dc', 8), 0, 1.0, 0));
    const stripes = ['#2e5a8a', '#f4f1ea'];
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.ConeGeometry(1.15, 0.45, 2, 1, true, (i / 8) * Math.PI * 2, Math.PI / 4);
      cafe.add(at(k.mesh(geo, k.m(stripes[i % 2], { side: THREE.DoubleSide })), 0, 2.0, 0));
    }
    cafe.add(at(k.cyl(0.06, 0.06, 0.05, '#ffffff', 10), 0.12, 0.67, 0.05));
    cafe.add(at(k.cyl(0.07, 0.07, 0.01, '#ffffff', 12), 0.12, 0.65, 0.05));
    w.add(cafe, 2.8, 0, 3.8);
    w.solidCircle(2.8, 3.8, 0.42);
    const chair = (x, z) => {
      const c = new THREE.Group();
      c.add(at(k.cyl(0.2, 0.2, 0.05, '#1c1c22', 14), 0, 0.42, 0));
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        c.add(at(k.cyl(0.02, 0.02, 0.42, '#1c1c22', 6), Math.cos(a) * 0.13, 0.21, Math.sin(a) * 0.13));
      }
      w.add(c, x, 0, z);
    };
    chair(2.05, 3.8);
    chair(3.55, 3.8);
    w.poi(2.05, 3.8, { emote: '☕', face: Math.PI / 2, dur: 9, sit: true, seatY: 0.45 });
    w.poi(3.55, 3.8, { emote: '🍰', face: -Math.PI / 2, dur: 8, sit: true, seatY: 0.45 });

    // 小花园：树篱、玫瑰、梧桐树
    const hedge = k.box(2.2, 0.5, 0.45, '#3f6e45', 0.15);
    w.add(hedge, -2.4, 0.25, 4.45);
    w.solid(hedge);
    const r = rng(14);
    for (let i = 0; i < 9; i++) w.add(k.sphere(0.06, i % 3 ? '#d6304a' : '#ff8fa8', 8), -3.4 + r() * 2.0, 0.5 + r() * 0.05, 4.25 + r() * 0.35);
    const tree = new THREE.Group();
    tree.add(at(k.cyl(0.12, 0.16, 1.3, '#6b5a48', 10), 0, 0.65, 0));
    tree.add(at(k.sphere(0.8, '#55804f', 18), 0, 1.75, 0));
    tree.add(at(k.sphere(0.5, '#62905a', 14), 0.5, 1.45, 0.2));
    w.add(tree, -4.1, 0, 3.8);
    w.solidCircle(-4.1, 3.8, 0.2);
    const bench = new THREE.Group();
    bench.add(at(k.box(1.2, 0.07, 0.36, '#2f4f3a', 0.02), 0, 0.42, 0));
    bench.add(at(k.box(1.2, 0.32, 0.05, '#2f4f3a', 0.02), 0, 0.64, 0.17));
    for (const x of [-0.5, 0.5]) bench.add(at(k.box(0.06, 0.42, 0.36, '#1c1c22', 0.01), x, 0.21, 0));
    w.add(bench, -0.6, 0, 3.95);
    w.poi(-0.85, 3.95, { emote: '🎵', face: Math.PI, dur: 8, sit: true, seatY: 0.45 });

    // 水坑
    const pr = rng(31);
    for (const [x, z, s] of [[-1.2, -0.9, 0.55], [2.3, -0.6, 0.4], [-3.2, 2.0, 0.35], [0.6, 3.4, 0.45], [4.0, -1.4, 0.3], [-2.6, -1.8, 0.3]]) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(s, 24), new THREE.MeshStandardMaterial({ color: '#7d8ca3', roughness: 0.08, metalness: 0.35 }));
      p.rotation.x = -Math.PI / 2;
      p.scale.y = 0.6 + pr() * 0.4;
      p.receiveShadow = true;
      w.add(p, x, 0.012, z);
    }

    rain(w);
    lightning(w);

    w.placeItem('sunglasses', 1.4, 0.8, -2.62);
    w.placeItem('shell', 2.45, 0.1, -4.3);
    w.placeItem('beachball', 2.95, 0.14, 3.95, { spin: false });

    w.poi(0.7, -1.95, { emote: '☎', face: 2.36, dur: 6 }); // 站在电话亭侧前方，不挡门口
    w.poi(3.3, -2.2, { emote: '🕰', face: 0, dur: 9 });
    w.poi(-2.1, -2.0, { emote: '🏠', face: Math.PI, dur: 6 });
    w.poi(-1.6, 0.25, { emote: '🚌', face: 0, dur: 6 });

    w.villager(
      {
        name: '亚瑟',
        look: { hair: '#5a4a3a', shirt: '#2e3a4f', pants: '#22262e', shoes: '#1c1c22', hat: 'tophat', hatColor: '#26262e', umbrella: '#26262e' },
        lines: ['日安！这种天气，正适合来一杯热红茶。', '红色电话亭里，好像有人落下了一副墨镜——在伦敦，真是乐观啊。', '下雨天，我最想念的是阳光和沙滩。'],
      },
      0.2,
      -1.2,
    );
    w.villager(
      {
        name: '玛丽',
        look: { hair: '#c48a54', shirt: '#ffd6e0', pants: '#6f8fae', hat: 'bow', hatColor: '#e85d8a', umbrella: '#e85d8a' },
        lines: ['雨伞是伦敦人最好的朋友。', '咖啡座的大伞底下，滚进去了一个彩色的球。', '听说下一块冰箱贴，是一片金色的海滩呢。'],
      },
      -2.0,
      -1.4,
    );
    w.villager(
      {
        name: '卫兵',
        speed: 0.55,
        look: { hair: '#3a2a20', shirt: '#c8102e', pants: '#1c1c22', shoes: '#111116', hat: 'busby' },
        lines: ['……（卫兵一动不动）', '……大本钟后面，有个贝壳。我什么都没说。', '站岗的时候不能说话。……刚才那句不算。'],
      },
      3.3,
      -2.2,
    );
  },
};
