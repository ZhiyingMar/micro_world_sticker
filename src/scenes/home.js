// 我的小屋 —— 动森风的温馨房间，起始世界
import * as THREE from 'three';
import { at, canvasTexture } from '../kit.js';

const WOOD = '#d9a066';
const WOOD_DARK = '#b07a45';

function floorTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const rows = 8;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * 128;
      for (let x = -offset; x < w; x += 256) {
        const shade = 0.92 + ((r * 7 + x) % 5) * 0.025;
        g.fillStyle = `rgb(${Math.round(232 * shade)},${Math.round(184 * shade)},${Math.round(128 * shade)})`;
        g.fillRect(x, r * rh, 256, rh);
        g.fillStyle = 'rgba(140,90,50,0.35)';
        g.fillRect(x, r * rh, 3, rh);
      }
      g.fillStyle = 'rgba(140,90,50,0.4)';
      g.fillRect(0, r * rh, w, 3);
    }
  }, { repeat: [1.6, 1.6] });
}

function wallpaperTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#fbf3df';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e4eedb';
    for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 28, h);
    g.fillStyle = '#f2b8a8';
    for (let y = 16; y < h; y += 64) {
      for (let x = 46; x < w; x += 64) {
        g.beginPath();
        g.arc(x, y + (x % 128 ? 32 : 0), 5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }, { repeat: [3, 1.4] });
}

function buildRoom(w) {
  const k = w.kit;
  // 地板方块
  const floorTex = w.texture(floorTexture());
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75 });
  const floor = k.mesh(new THREE.BoxGeometry(9.6, 0.3, 9.6), floorMat);
  w.add(floor, 0, -0.15, 0);
  w.add(k.box(9.9, 0.9, 9.9, WOOD_DARK, 0.15), 0, -0.72, 0);

  // 两面墙
  const wpTex = w.texture(wallpaperTexture());
  const wpMat = new THREE.MeshStandardMaterial({ map: wpTex, roughness: 0.9 });
  const back = k.mesh(new THREE.BoxGeometry(9.6, 4.2, 0.3), wpMat);
  w.add(back, 0, 2.1, -4.65);
  const leftTex = w.texture(wallpaperTexture());
  leftTex.repeat.set(3, 1.4);
  const left = k.mesh(new THREE.BoxGeometry(0.3, 4.2, 9.6), new THREE.MeshStandardMaterial({ map: leftTex, roughness: 0.9 }));
  w.add(left, -4.65, 2.1, 0);
  // 墙裙 + 顶线
  w.add(k.box(9.6, 1.1, 0.06, '#a8cfa0', 0.02), 0, 0.55, -4.48);
  w.add(k.box(0.06, 1.1, 9.6, '#a8cfa0', 0.02), -4.48, 0.55, 0);
  w.add(k.box(9.7, 0.08, 0.1, '#ffffff', 0.03), 0, 1.12, -4.47);
  w.add(k.box(0.1, 0.08, 9.7, '#ffffff', 0.03), -4.47, 1.12, 0);
  w.add(k.box(9.9, 0.22, 0.42, '#e7c9a0', 0.08), 0, 4.25, -4.65);
  w.add(k.box(0.42, 0.22, 9.9, '#e7c9a0', 0.08), -4.65, 4.25, 0);

  // 窗户
  const win = new THREE.Group();
  win.add(k.box(2.1, 1.7, 0.14, '#ffffff', 0.05));
  const glass = k.box(1.8, 1.4, 0.05, '#bfe8ff', 0.02, { emissive: '#bfe8ff', emissiveIntensity: 0.8 });
  glass.position.z = 0.05;
  win.add(glass);
  win.add(at(k.box(0.08, 1.4, 0.08, '#ffffff', 0.02), 0, 0, 0.09));
  win.add(at(k.box(1.8, 0.08, 0.08, '#ffffff', 0.02), 0, 0, 0.09));
  win.add(at(k.box(2.3, 0.12, 0.3, '#ffffff', 0.04), 0, -0.88, 0.12));
  for (const s of [-1, 1]) {
    const curtain = k.box(0.45, 1.9, 0.1, '#f6a6b8', 0.05);
    curtain.position.set(s * 1.2, -0.05, 0.18);
    win.add(curtain);
    const tie = k.torus(0.1, 0.03, '#f4a259');
    tie.position.set(s * 1.2, -0.3, 0.24);
    win.add(tie);
  }
  w.add(win, 1.5, 2.45, -4.45);
  // 窗台上的小盆栽
  const sill = new THREE.Group();
  sill.add(k.cyl(0.11, 0.08, 0.16, '#e07a5f', 14));
  const leaf = k.sphere(0.13, '#7cc576', 12);
  leaf.position.y = 0.15;
  sill.add(leaf);
  w.add(sill, 2.2, 1.66, -4.25);

  // 墙上的画 & 时钟
  const frame = new THREE.Group();
  frame.add(k.box(1.1, 0.85, 0.08, '#c48a54', 0.04));
  const art = k.box(0.9, 0.65, 0.04, '#bde3f2', 0.01);
  art.position.z = 0.04;
  frame.add(art);
  const hill = k.sphere(0.3, '#8fd17f', 16);
  hill.scale.set(1.4, 0.6, 0.1);
  hill.position.set(-0.1, -0.25, 0.07);
  frame.add(hill);
  const sun = k.sphere(0.09, '#ffd84a', 12);
  sun.scale.z = 0.2;
  sun.position.set(0.25, 0.15, 0.07);
  frame.add(sun);
  w.add(frame, -3.3, 2.75, -4.47);

  const clock = new THREE.Group();
  const face = k.cyl(0.38, 0.38, 0.08, '#fffaf0', 24);
  face.rotation.z = Math.PI / 2;
  const rim = k.torus(0.38, 0.05, '#f4a259');
  rim.rotation.y = Math.PI / 2;
  const hand1 = k.box(0.02, 0.24, 0.03, '#6b4f3a', 0.005);
  hand1.position.set(0.05, 0.1, 0);
  const hand2 = k.box(0.02, 0.18, 0.03, '#6b4f3a', 0.005);
  hand2.position.set(0.05, 0.06, 0.05);
  hand2.rotation.x = 1.2;
  clock.add(face, rim, hand1, hand2);
  w.add(clock, -4.45, 2.9, -0.4);
  w.onUpdate((dt) => {
    hand1.rotation.x -= dt * 0.4;
  });
}

function buildFurniture(w) {
  const k = w.kit;

  // 床（下面是空的，可以藏东西）
  const bed = new THREE.Group();
  for (const [x, z] of [[-0.9, -1.3], [0.9, -1.3], [-0.9, 1.3], [0.9, 1.3]]) bed.add(at(k.cyl(0.07, 0.07, 0.25, WOOD_DARK, 10), x, 0.125, z));
  bed.add(at(k.box(2.0, 0.22, 2.8, WOOD, 0.06), 0, 0.36, 0));
  bed.add(at(k.box(1.86, 0.2, 2.66, '#ffffff', 0.08), 0, 0.56, 0));
  bed.add(at(k.box(1.96, 0.16, 1.8, '#8ec5e8', 0.08), 0, 0.68, 0.45));
  bed.add(at(k.box(1.96, 0.05, 0.25, '#ffffff', 0.02), 0, 0.77, -0.38));
  bed.add(at(k.box(1.1, 0.2, 0.55, '#fffaf0', 0.1), 0, 0.74, -0.95));
  bed.add(at(k.box(2.1, 1.2, 0.16, WOOD, 0.06), 0, 0.6, -1.42));
  for (let i = 0; i < 3; i++) bed.add(at(k.sphere(0.07, '#f4a259', 10), -0.6 + i * 0.6, 1.2, -1.42));
  w.add(bed, -3.4, 0, -3.0);
  w.solid(bed, -0.05);
  w.poi(-2.05, -2.9, { emote: '💤', face: -Math.PI / 2, dur: 7 });

  // 落地灯
  const lamp = new THREE.Group();
  lamp.add(at(k.cyl(0.22, 0.25, 0.06, '#6b4f3a', 16), 0, 0.03, 0));
  lamp.add(at(k.cyl(0.03, 0.03, 1.5, '#6b4f3a', 8), 0, 0.78, 0));
  const shade = k.cyl(0.18, 0.32, 0.36, '#fff1c9', 20, { emissive: '#ffd27a', emissiveIntensity: 0.55 });
  shade.position.y = 1.62;
  lamp.add(shade);
  const bulb = new THREE.PointLight('#ffcf8a', 3, 5, 1.6);
  bulb.position.y = 1.5;
  lamp.add(bulb);
  w.add(lamp, -4.1, 0, -1.05);
  w.solidCircle(-4.1, -1.05, 0.25);

  // 书架
  const shelf = new THREE.Group();
  shelf.add(at(k.box(1.8, 2.2, 0.55, WOOD, 0.05), 0, 1.1, 0));
  const palette = ['#e85d5d', '#5d9ce8', '#f4c95d', '#7cc576', '#b38ee8', '#f6a6b8', '#5dc8c8'];
  for (let s = 0; s < 3; s++) {
    const y = 0.25 + s * 0.68;
    shelf.add(at(k.box(1.6, 0.56, 0.3, '#8a5a32', 0.02), 0, y + 0.28, 0.14));
    let x = -0.72;
    let i = s * 3;
    while (x < 0.62) {
      const bw = 0.08 + ((i * 37) % 5) * 0.025;
      const bh = 0.36 + ((i * 53) % 4) * 0.05;
      const book = k.box(bw, bh, 0.3, palette[i % palette.length], 0.015);
      book.position.set(x + bw / 2, y + bh / 2 + 0.02, 0.17);
      if (i % 7 === 3) book.rotation.z = 0.18;
      shelf.add(book);
      x += bw + 0.015;
      i++;
    }
  }
  w.add(shelf, -1.0, 0, -4.22);
  w.solid(shelf);
  w.poi(-1.0, -3.5, { emote: '📖', face: Math.PI, dur: 6 });

  // 厨房台面
  const counter = new THREE.Group();
  counter.add(at(k.box(1.4, 0.9, 0.7, '#fffaf0', 0.05), 0, 0.45, 0));
  counter.add(at(k.box(1.5, 0.08, 0.78, '#e7c9a0', 0.03), 0, 0.93, 0));
  for (const x of [-0.33, 0.33]) counter.add(at(k.box(0.6, 0.6, 0.04, '#d9eedf', 0.03), x, 0.46, 0.36));
  const kettle = k.sphere(0.14, '#f4a259', 16);
  kettle.scale.y = 0.85;
  counter.add(at(kettle, 0.4, 1.08, 0));
  counter.add(at(k.cyl(0.04, 0.04, 0.05, '#6b4f3a', 8), 0.4, 1.2, 0));
  const vase = k.cyl(0.07, 0.09, 0.2, '#5d9ce8', 12);
  counter.add(at(vase, -0.35, 1.07, 0.05));
  for (let i = 0; i < 3; i++) counter.add(at(k.sphere(0.06, ['#f6a6b8', '#ffd84a', '#ffffff'][i], 10), -0.35 + (i - 1) * 0.07, 1.26 + (i % 2) * 0.05, 0.05));
  w.add(counter, 2.6, 0, -4.15);
  w.solid(counter);
  w.poi(1.5, -3.55, { emote: '☀', face: Math.PI, dur: 5 });

  // 冰箱（点它可以打开冰箱贴收藏）
  const fridge = new THREE.Group();
  fridge.add(at(k.box(1.0, 2.3, 0.95, '#c4e6da', 0.12), 0, 1.15, 0));
  fridge.add(at(k.box(0.96, 0.03, 0.02, '#9cc9b8', 0.01), 0, 1.45, 0.48));
  fridge.add(at(k.box(0.06, 0.45, 0.08, '#ffffff', 0.03), -0.36, 1.85, 0.5));
  fridge.add(at(k.box(0.06, 0.35, 0.08, '#ffffff', 0.03), -0.36, 1.1, 0.5));
  const mColors = ['#f4a259', '#e85d5d', '#5d9ce8', '#ffd84a', '#b38ee8'];
  for (let i = 0; i < 5; i++) {
    const m = i % 2 ? k.box(0.13, 0.13, 0.04, mColors[i], 0.02) : k.cyl(0.07, 0.07, 0.04, mColors[i], 14);
    if (!(i % 2)) m.rotation.x = Math.PI / 2;
    m.position.set(-0.1 + (i % 3) * 0.2, 1.65 + Math.floor(i / 3) * 0.25 + (i % 2) * 0.05, 0.49);
    m.rotation.z = (i - 2) * 0.15;
    fridge.add(m);
  }
  fridge.traverse((o) => (o.userData.action = 'fridge'));
  fridge.userData.label = '冰箱 · 点击打开';
  w.add(fridge, 3.95, 0, -4.0);
  w.solid(fridge);
  w.fridge = fridge;
  w.poi(3.95, -3.2, { emote: '🍰', face: Math.PI, dur: 5 });

  // 圆地毯 + 小圆桌 + 凳子
  const rug = k.cyl(1.75, 1.75, 0.03, '#f7c6a3', 40);
  w.add(rug, 0.5, 0.015, 0.4);
  rug.castShadow = false;
  const rug2 = k.cyl(1.35, 1.35, 0.035, '#fbe1c6', 40);
  rug2.castShadow = false;
  w.add(rug2, 0.5, 0.02, 0.4);

  const table = new THREE.Group();
  table.add(at(k.cyl(0.78, 0.78, 0.09, WOOD, 32), 0, 0.68, 0));
  table.add(at(k.cyl(0.08, 0.1, 0.62, WOOD_DARK, 12), 0, 0.33, 0));
  table.add(at(k.cyl(0.35, 0.4, 0.05, WOOD_DARK, 20), 0, 0.03, 0));
  const pot = k.sphere(0.15, '#ffffff', 16);
  pot.scale.y = 0.8;
  table.add(at(pot, 0.1, 0.84, 0.05));
  table.add(at(k.cyl(0.05, 0.06, 0.04, '#f6a6b8', 12), 0.1, 0.98, 0.05));
  const spout = k.cyl(0.02, 0.035, 0.18, '#ffffff', 8);
  spout.rotation.z = -0.9;
  table.add(at(spout, 0.28, 0.88, 0.05));
  for (const [x, z] of [[-0.35, 0.2], [-0.15, -0.35]]) {
    table.add(at(k.cyl(0.07, 0.055, 0.1, '#ffffff', 12), x, 0.78, z));
    table.add(at(k.cyl(0.055, 0.055, 0.01, '#b37a4c', 12), x, 0.83, z));
  }
  table.add(at(k.cyl(0.16, 0.16, 0.02, '#ffffff', 16), 0.35, 0.74, -0.25));
  for (let i = 0; i < 3; i++) table.add(at(k.cyl(0.045, 0.045, 0.025, '#d9a066', 10), 0.3 + i * 0.05, 0.765, -0.25 + (i % 2) * 0.06));
  w.add(table, 0.5, 0, 0.4);
  w.solidCircle(0.5, 0.4, 0.8);

  const stool = (x, z, color) => {
    const s = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      s.add(at(k.cyl(0.03, 0.03, 0.36, WOOD_DARK, 8), Math.cos(a) * 0.15, 0.18, Math.sin(a) * 0.15));
    }
    s.add(at(k.cyl(0.25, 0.25, 0.08, color, 20), 0, 0.38, 0));
    w.add(s, x, 0, z);
  };
  stool(-0.75, 0.75, '#f6a6b8');
  stool(1.75, 0.65, '#8ec5e8');
  w.poi(-0.75, 0.75, { emote: '☕', face: Math.atan2(1.25, -0.35), dur: 8, sit: true, seatY: 0.42 });
  w.poi(1.75, 0.65, { emote: '🍪', face: Math.atan2(-1.25, -0.25), dur: 8, sit: true, seatY: 0.42 });

  // 大盆栽
  const plant = new THREE.Group();
  plant.add(at(k.cyl(0.4, 0.3, 0.55, '#e07a5f', 20), 0, 0.275, 0));
  plant.add(at(k.torus(0.4, 0.05, '#c9654d'), 0, 0.55, 0));
  plant.children[1].rotation.x = Math.PI / 2;
  plant.add(at(k.cyl(0.37, 0.37, 0.04, '#7a5236', 20), 0, 0.53, 0));
  const leafSpots = [[0, 1.15, 0, 0.42], [-0.25, 0.9, 0.12, 0.3], [0.25, 0.95, -0.1, 0.32], [0.05, 1.5, -0.05, 0.3], [-0.15, 0.78, -0.2, 0.25], [0.25, 0.8, -0.15, 0.22]];
  plant.add(at(k.cyl(0.04, 0.05, 0.8, '#6b8f4a', 8), 0, 0.9, 0));
  for (const [x, y, z, r] of leafSpots) {
    const l = k.sphere(r, '#7cc576', 16);
    l.scale.y = 0.85;
    plant.add(at(l, x, y, z));
  }
  w.add(plant, -4.0, 0, 1.4);
  w.solidCircle(-4.0, 1.4, 0.45);
  w.poi(-3.3, 1.4, { emote: '🌱', face: -Math.PI / 2, dur: 5 });

  // 收音机柜
  const cab = new THREE.Group();
  cab.add(at(k.box(0.6, 0.7, 1.1, WOOD, 0.05), 0, 0.35, 0));
  cab.add(at(k.box(0.04, 0.5, 0.44, '#c48a54', 0.02), 0.3, 0.35, -0.25));
  cab.add(at(k.box(0.04, 0.5, 0.44, '#c48a54', 0.02), 0.3, 0.35, 0.25));
  const radio = new THREE.Group();
  radio.add(k.box(0.36, 0.3, 0.6, '#e85d5d', 0.07));
  const spk = k.cyl(0.1, 0.1, 0.02, '#6b4f3a', 16);
  spk.rotation.z = Math.PI / 2;
  radio.add(at(spk, 0.18, 0, -0.12));
  radio.add(at(k.box(0.02, 0.08, 0.16, '#fffaf0', 0.01), 0.18, 0.04, 0.14));
  radio.add(at(k.cyl(0.01, 0.01, 0.4, '#999999', 6), 0, 0.3, 0.2));
  radio.children[3].rotation.x = -0.4;
  cab.add(at(radio, 0, 0.86, 0));
  w.add(cab, -4.15, 0, 3.15);
  w.solid(cab);
  w.poi(-3.45, 3.15, { emote: '♪', face: -Math.PI / 2, dur: 7 });

  // 毛线篮 + 散落的小东西
  const basket = new THREE.Group();
  basket.add(at(k.cyl(0.32, 0.26, 0.3, '#d9b380', 16), 0, 0.15, 0));
  for (const [x, z, c] of [[-0.1, 0.05, '#f6a6b8'], [0.1, -0.05, '#8ec5e8'], [0, 0.12, '#ffd84a']]) basket.add(at(k.sphere(0.13, c, 12), x, 0.32, z));
  w.add(basket, 3.9, 0, 3.7);
  w.solidCircle(3.9, 3.7, 0.33);
  w.add(k.sphere(0.1, '#f6a6b8', 12), 2.9, 0.1, 2.9);

  // 拖鞋
  for (const s of [-1, 1]) {
    const sl = k.box(0.16, 0.06, 0.32, '#f4a259', 0.03);
    w.add(sl, -2.0 + s * 0.12, 0.03, -1.2, s * 0.15);
  }
}

export default {
  id: 'home',
  name: '我的小屋',
  emoji: '🏠',
  style: 'cozy',
  styleLabel: '动森风 · 起点',
  magnetStyle: 'cozy',
  bg: 'radial-gradient(circle at 50% 30%, #fff6e3 0%, #f8dfc0 55%, #ecc39c 100%)',
  lights: {
    hemi: ['#fff4e0', '#c8a27a', 1.7],
    sun: ['#fff1d6', 2.4, [6, 11, 7]],
  },
  camera: { pos: [9.5, 9.5, 12.5], target: [0, 1, -0.5], fitH: 4.4, minAz: 0.02, maxAz: 1.48, maxPolar: 1.25, min: 2.2 },
  bounds: { minX: -4.45, maxX: 4.7, minZ: -4.45, maxZ: 4.7 },
  spawn: [1.6, 2.8],
  // 第一次进来时，这个小人会主动打招呼
  greet: { name: '小橘', text: '你醒啦！冰箱上的每一块冰箱贴里，都藏着一个小世界哦。先在屋里找找 3 样亮晶晶的东西吧～' },
  next: 'forest',
  items: [
    {
      id: 'mushroom',
      name: '红蘑菇',
      icon: '🍄',
      hint: '绿意盎然的地方',
      make(k) {
        const g = new THREE.Group();
        g.add(at(k.cyl(0.045, 0.06, 0.12, '#fff3dd', 12), 0, 0.06, 0));
        const cap = k.dome(0.11, '#e8443a', Math.PI / 2, 20, { emissive: '#e8443a', emissiveIntensity: 0.25 });
        cap.scale.y = 0.8;
        g.add(at(cap, 0, 0.1, 0));
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          g.add(at(k.sphere(0.022, '#ffffff', 8), Math.cos(a) * 0.07, 0.16, Math.sin(a) * 0.07));
        }
        g.add(at(k.sphere(0.022, '#ffffff', 8), 0, 0.19, 0));
        g.scale.setScalar(1.3);
        return g;
      },
    },
    {
      id: 'book',
      name: '童话书',
      icon: '📖',
      hint: '睡觉的地方，低头看看',
      make(k) {
        const g = new THREE.Group();
        g.add(k.box(0.34, 0.07, 0.26, '#8a5ad6', 0.02, { emissive: '#8a5ad6', emissiveIntensity: 0.2 }));
        g.add(at(k.box(0.31, 0.05, 0.24, '#fffaf0', 0.01), 0.02, 0, 0));
        const st = k.star(0.06, '#ffd84a', 0.02, { emissive: '#ffd84a', emissiveIntensity: 0.6 });
        st.rotation.x = -Math.PI / 2;
        g.add(at(st, 0, 0.045, 0));
        g.rotation.y = 0.4;
        return g;
      },
    },
    {
      id: 'star',
      name: '魔法星星',
      icon: '⭐',
      hint: '高高的、凉凉的地方',
      make(k) {
        return k.star(0.16, '#ffd84a', 0.07, { emissive: '#ffc83a', emissiveIntensity: 0.7 });
      },
    },
  ],
  build(w) {
    buildRoom(w);
    buildFurniture(w);

    w.placeItem('mushroom', -3.86, 0.6, 1.66, { spin: false });
    w.placeItem('book', -2.55, 0.06, -2.5, { spin: false });
    w.placeItem('star', 3.95, 2.5, -4.0);

    w.villager(
      {
        name: '小橘',
        look: { hair: '#e8893a', shirt: '#ffd84a', pants: '#7a8fc4' },
        lines: [
          '今天的阳光好舒服呀～',
          '听说冰箱上的每一块冰箱贴，都是一个小小的世界哦。',
          '我刚才好像看到床底下有什么东西在发光……',
          '要不要一起喝杯茶？☕',
        ],
      },
      1.2,
      2.4,
    );
    w.villager(
      {
        name: '阿绵',
        look: { hair: '#f2e6d6', shirt: '#8ec5e8', pants: '#e8b38a', hat: 'bow', hatColor: '#f6a6b8' },
        lines: [
          '呼啊……刚睡醒。',
          '角落那盆大植物最近长得好快，土里好像冒出了点什么。',
          '冰箱顶上……是不是有颗星星在闪？',
          '我最喜欢收集小东西了！你也是吗？',
        ],
      },
      -1.5,
      -1.0,
    );
  },
};

