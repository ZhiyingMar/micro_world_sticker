// 霓虹夜都 —— 夜晚的都市街区：亮灯的高楼、便利店、霓虹招牌、会礼让斑马线的小车
// 刚到的时候全城停电：要把从像素小镇带来的月亮、出租车、萨克斯放回原处，城市才会一点点亮起来
import * as THREE from 'three';
import { at, facade, rng, canvasTexture } from '../kit.js';
import { glow, neonText } from '../fx.js';
import { ghostify } from '../world.js';
import { sfx } from '../audio.js';
import { foundIn } from '../state.js';
import pixel from './pixel.js';

const ROAD_Z0 = 0.5;
const ROAD_Z1 = 2.7;
const CROSS = 0.85; // 斑马线半宽
const MOON_POS = [0.6, 4.3, -4.45]; // 月亮像舞台道具一样挂在便利店后面的杆子上
const TAXI_X = -3.2; // 出租车停靠位
const STOOL = [3.75, -1.8]; // 酒吧门口乐手的凳子

function building(w, x, z, W, H, D, opts) {
  const k = w.kit;
  const front = facade(Math.max(2, Math.round(W / 0.45)), Math.max(2, Math.round(H / 0.55)), opts);
  const side = facade(Math.max(2, Math.round(D / 0.45)), Math.max(2, Math.round(H / 0.55)), { ...opts, seed: opts.seed + 7 });
  [front.map, front.emissive, side.map, side.emissive].forEach((t) => w.texture(t));
  const mk = (f) => new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissive, emissive: '#ffffff', emissiveIntensity: 1, roughness: 0.85 });
  const roof = new THREE.MeshStandardMaterial({ color: opts.roof || '#4a4e63', roughness: 0.9 });
  const mFront = mk(front);
  const mSide = mk(side);
  const mesh = k.mesh(new THREE.BoxGeometry(W, H, D), mFront);
  mesh.material = [mSide, mSide, roof, roof, mFront, mFront];
  // 停电时用的版本：一扇亮着的窗户都没有
  const offF = facade(Math.max(2, Math.round(W / 0.45)), Math.max(2, Math.round(H / 0.55)), { ...opts, ratio: 0 });
  const offS = facade(Math.max(2, Math.round(D / 0.45)), Math.max(2, Math.round(H / 0.55)), { ...opts, ratio: 0, seed: opts.seed + 7 });
  [offF.map, offF.emissive, offS.map, offS.emissive].forEach((t) => w.texture(t));
  mesh.userData.windows = [
    { mat: mFront, on: front, off: offF },
    { mat: mSide, on: side, off: offS },
  ];
  w.add(mesh, x, H / 2, z);
  // 楼顶边沿
  w.add(k.box(W + 0.1, 0.12, D + 0.1, opts.roof || '#4a4e63', 0.03), x, H + 0.06, z);
  w.solid(mesh);
  return mesh;
}

function streetLamp(w, x, z, ry = 0) {
  const k = w.kit;
  const g = new THREE.Group();
  g.add(at(k.cyl(0.05, 0.07, 2.2, '#3a3d4a', 10), 0, 1.1, 0));
  g.add(at(k.box(0.5, 0.06, 0.08, '#3a3d4a', 0.02), 0.22, 2.18, 0));
  const bulb = k.box(0.26, 0.08, 0.18, '#fff3d0', 0.03, { emissive: '#ffd98a', emissiveIntensity: 1.6 });
  bulb.material = bulb.material.clone(); // 要单独开关
  g.add(at(bulb, 0.42, 2.12, 0));
  const halo = glow('#ffcf7a', 1.6, 0.55);
  halo.position.set(0.42, 2.05, 0);
  g.add(halo);
  const light = new THREE.PointLight('#ffd49a', 5, 5.5, 1.4);
  light.position.set(0.42, 1.9, 0);
  g.add(light);
  w.add(g, x, 0, z, ry);
  w.solidCircle(x, z, 0.12);
  return { bulb, halo, light };
}

function car(k, color, { taxi = false } = {}) {
  const g = new THREE.Group();
  g.add(at(k.box(1.0, 0.28, 0.5, color, 0.09), 0, 0.27, 0));
  g.add(at(k.box(0.56, 0.24, 0.46, color, 0.09), -0.06, 0.5, 0));
  g.add(at(k.box(0.58, 0.15, 0.47, '#24304d', 0.05, { emissive: '#3a5a9a', emissiveIntensity: 0.3 }), -0.06, 0.52, 0));
  for (const [x, z] of [[0.3, 0.24], [-0.3, 0.24], [0.3, -0.24], [-0.3, -0.24]]) {
    const wh = k.cyl(0.1, 0.1, 0.08, '#1d1d24', 12);
    wh.rotation.x = Math.PI / 2;
    g.add(at(wh, x, 0.12, z));
  }
  for (const s of [-1, 1]) {
    g.add(at(k.box(0.04, 0.07, 0.1, '#ffffff', 0.01, { emissive: '#fff4c8', emissiveIntensity: 2 }), 0.5, 0.29, s * 0.15));
    const hl = glow('#fff1b8', 0.7, 0.7);
    hl.position.set(0.62, 0.29, s * 0.15);
    g.add(hl);
    g.add(at(k.box(0.04, 0.06, 0.1, '#ff3b3b', 0.01, { emissive: '#ff2a2a', emissiveIntensity: 1.5 }), -0.5, 0.3, s * 0.15));
  }
  if (taxi) {
    g.add(at(k.box(0.2, 0.08, 0.12, '#fff7c2', 0.02, { emissive: '#ffe680', emissiveIntensity: 1 }), -0.06, 0.66, 0));
  }
  return g;
}

function starsAndMoon(w) {
  const k = w.kit;
  const [mx, my, mz] = MOON_POS;
  // 挂月亮的杆子和吊线
  w.add(k.cyl(0.035, 0.045, my + 0.75, '#3a3d4a', 8), mx, (my + 0.75) / 2, mz - 0.4);
  w.add(k.box(0.05, 0.05, 0.45, '#3a3d4a', 0.01), mx, my + 0.72, mz - 0.2);
  w.add(k.cyl(0.006, 0.006, 0.3, '#9a9db0', 4), mx, my + 0.57, mz);
  const moon = k.sphere(0.42, '#fff6d8', 24, { emissive: '#fff1c2', emissiveIntensity: 1.2 });
  moon.castShadow = false;
  w.add(moon, mx, my, mz);
  const mg = glow('#cfd8ff', 3, 0.5);
  w.add(mg, mx, my, mz);

  const r = rng(77);
  const n = 140;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const rad = 7 + r() * 6;
    pos[i * 3] = Math.cos(a) * rad;
    pos[i * 3 + 1] = 3 + r() * 8;
    pos[i * 3 + 2] = Math.sin(a) * rad;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: '#e8ecff', size: 0.07, transparent: true, opacity: 0.85, depthWrite: false });
  const stars = new THREE.Points(geo, mat);
  w.root.add(stars);
  return { moon, mg, stars: mat };
}

function verticalSign(text, color) {
  return canvasTexture(96, 64 * text.length + 32, (g, W, H) => {
    g.fillStyle = 'rgba(10,10,30,0.85)';
    g.fillRect(0, 0, W, H);
    g.font = 'bold 56px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 16;
    [...text].forEach((ch, i) => {
      g.fillStyle = '#ffffff';
      g.fillText(ch, W / 2, 48 + i * 64);
      g.fillStyle = color;
      g.fillText(ch, W / 2, 48 + i * 64);
    });
  });
}

export default {
  id: 'city',
  name: '霓虹夜都',
  emoji: '🌃',
  style: 'cozy',
  styleLabel: '都市风 · 夜晚',
  magnetStyle: 'city',
  ambient: 'city',
  bg: 'radial-gradient(ellipse at 30% 10%, #3b4282 0%, #1d2148 45%, #0d0f26 100%)',
  lights: {
    hemi: ['#6a78c0', '#1e2238', 1.0],
    sun: ['#aab8ff', 0.9, [-6, 10, 5]],
  },
  camera: { pos: [11.5, 11, 14.5], target: [0, 1, 0], fitH: 4, maxPolar: 1.3, min: 2.5 },
  spawn: [0, -1.0],
  next: 'london',
  // 破败世界：到的时候停电了，要先把上一个世界带来的东西放回原处
  brokenGoal: '停电了！把从 <b>「像素小镇」</b> 带来的东西放回原处',
  repairs: [
    { id: 'moon', from: 'pixel', hint: '便利店后面空着的杆子', msg: '月光照进了小巷' },
    { id: 'taxi', from: 'pixel', hint: '马路边的出租车停靠位', msg: '车流动起来了' },
    { id: 'sax', from: 'pixel', hint: '关着门的 BAR 门口', msg: '音乐响起来了' },
  ],
  items: [
    {
      id: 'umbrella',
      name: '红雨伞',
      icon: '🌂',
      hint: '公园树丛里',
      make(k) {
        const g = new THREE.Group();
        const canopy = k.mesh(new THREE.ConeGeometry(0.2, 0.12, 8, 1, true), k.m('#e8443a', { emissive: '#e8443a', emissiveIntensity: 0.35, side: THREE.DoubleSide }));
        canopy.position.y = 0.3;
        g.add(canopy);
        g.add(at(k.cyl(0.01, 0.01, 0.34, '#3a3a3a', 6), 0, 0.17, 0));
        const hook = k.torus(0.035, 0.01, '#6b4f3a');
        g.add(at(hook, 0.035, 0, 0));
        g.rotation.z = 0.35;
        return g;
      },
    },
    {
      id: 'tophat',
      name: '绅士礼帽',
      icon: '🎩',
      hint: '公园的长椅上',
      make(k) {
        const g = new THREE.Group();
        g.add(at(k.cyl(0.09, 0.095, 0.16, '#26262e', 16), 0, 0.1, 0));
        g.add(at(k.cyl(0.15, 0.15, 0.015, '#26262e', 18), 0, 0.02, 0));
        g.add(at(k.cyl(0.097, 0.097, 0.035, '#e8443a', 16, { emissive: '#e8443a', emissiveIntensity: 0.5 }), 0, 0.05, 0));
        return g;
      },
    },
    {
      id: 'teapot',
      name: '红茶壶',
      icon: '🫖',
      hint: '大楼和便利店之间的小巷',
      make(k) {
        const g = new THREE.Group();
        const body = k.sphere(0.12, '#f4f1ea', 18, { emissive: '#ffffff', emissiveIntensity: 0.15 });
        body.scale.y = 0.8;
        g.add(at(body, 0, 0.1, 0));
        g.add(at(k.cyl(0.122, 0.122, 0.03, '#3d6fd6', 18), 0, 0.1, 0));
        g.add(at(k.sphere(0.03, '#3d6fd6', 8), 0, 0.21, 0));
        const spout = k.cyl(0.015, 0.03, 0.13, '#f4f1ea', 8);
        spout.rotation.z = -0.8;
        g.add(at(spout, 0.14, 0.13, 0));
        const handle = k.torus(0.05, 0.015, '#f4f1ea');
        g.add(at(handle, -0.13, 0.11, 0));
        return g;
      },
    },
  ],
  build(w) {
    const k = w.kit;
    // ---------- 电力：三路，分别由三件东西点亮。v 是现在的亮度，t 是目标 ----------
    const P = { sky: { v: 0, t: 0 }, street: { v: 0, t: 0 }, city: { v: 0, t: 0 } };
    const power = (key, instant) => {
      P[key].t = 1;
      if (instant) P[key].v = 1;
    };
    const windows = []; // { mat, a }：a 越大亮得越晚，一栋一栋亮起来
    const neons = []; // { mat, glow, op, a }
    const lamps = [];
    const sm = (a, b, v) => THREE.MathUtils.smoothstep(v, a, b);

    // 地面：人行道 + 马路
    w.add(k.box(10, 0.3, 10, '#8f93a3', 0.12), 0, -0.15, 0);
    w.add(k.box(9.9, 1.4, 9.9, '#2c2f3c', 0.2), 0, -0.95, 0);
    const road = k.box(10, 0.02, ROAD_Z1 - ROAD_Z0, '#2e3241', 0);
    road.castShadow = false;
    w.add(road, 0, 0.01, (ROAD_Z0 + ROAD_Z1) / 2);
    const mid = (ROAD_Z0 + ROAD_Z1) / 2;
    for (let x = -4.6; x < 4.8; x += 1) {
      if (Math.abs(x + 0.25) < CROSS + 0.3) continue;
      const d = k.box(0.5, 0.012, 0.06, '#e8d27a', 0);
      d.castShadow = false;
      w.add(d, x + 0.25, 0.022, mid);
    }
    for (let i = 0; i < 5; i++) {
      const s = k.box(0.2, 0.012, ROAD_Z1 - ROAD_Z0 - 0.2, '#f2f2f2', 0);
      s.castShadow = false;
      w.add(s, -0.68 + i * 0.34, 0.022, mid);
    }
    for (const z of [ROAD_Z0, ROAD_Z1]) {
      const curb = k.box(10, 0.07, 0.1, '#b3b7c6', 0.02);
      curb.castShadow = false;
      w.add(curb, 0, 0.035, z);
    }
    // 出租车停靠位：路面上的黄框
    for (const [dx, dz, sw, sd] of [[0, -0.36, 1.3, 0.05], [0, 0.36, 1.3, 0.05], [-0.63, 0, 0.05, 0.72], [0.63, 0, 0.05, 0.72]]) {
      const m = k.box(sw, 0.012, sd, '#ffd23f', 0);
      m.castShadow = false;
      w.add(m, TAXI_X + dx, 0.024, 1.05 + dz);
    }
    // 马路只能从斑马线过
    w.colliders.push({ type: 'box', minX: -5, maxX: -CROSS, minZ: ROAD_Z0, maxZ: ROAD_Z1 });
    w.colliders.push({ type: 'box', minX: CROSS, maxX: 5, minZ: ROAD_Z0, maxZ: ROAD_Z1 });
    // 停电时车堵在斑马线上
    const jam = w.blocker(-CROSS, CROSS, ROAD_Z0, ROAD_Z1, '🚗 车都堵在斑马线上，过不去……');

    // 后排建筑
    const b1 = building(w, -3.2, -3.4, 2.2, 5.2, 2.4, { wall: '#5b6285', frame: '#3e4463', dark: '#2a2f4a', lit: '#ffe39a', ratio: 0.55, seed: 3, roof: '#3e4463' });
    for (const wd of b1.userData.windows) windows.push({ ...wd, a: 0.3 });
    const ant = k.cyl(0.03, 0.03, 0.9, '#9a9db0', 6);
    w.add(ant, -3.4, 5.7, -3.4);
    const beacon = k.sphere(0.07, '#ff3b3b', 10, { emissive: '#ff2020', emissiveIntensity: 2 });
    w.add(beacon, -3.4, 6.18, -3.4);
    const beaconGlow = glow('#ff4040', 0.9, 0.8);
    w.add(beaconGlow, -3.4, 6.18, -3.4);
    const yeSign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.3), new THREE.MeshBasicMaterial({ map: w.texture(verticalSign('夜猫', '#4ff0ff')), transparent: true }));
    w.add(yeSign, -2.32, 3.0, -2.19);
    const yeGlow = glow('#4ff0ff', 2.2, 0.35);
    w.add(yeGlow, -2.32, 3.0, -2.0);
    neons.push({ mat: yeSign.material, glow: yeGlow, op: 0.35, a: 0.5 });

    const b2 = building(w, 3.3, -3.4, 2.0, 3.4, 2.2, { wall: '#7a5f6e', frame: '#5a4352', dark: '#2e2533', lit: '#ffc48a', ratio: 0.6, seed: 9, roof: '#4a3a44' });
    for (const wd of b2.userData.windows) windows.push({ ...wd, a: 0 });
    const tank = new THREE.Group();
    tank.add(at(k.cyl(0.35, 0.35, 0.6, '#8a6a52', 16), 0, 0.6, 0));
    tank.add(at(k.cone(0.4, 0.25, '#6b4f3a', 16), 0, 1.02, 0));
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) tank.add(at(k.cyl(0.03, 0.03, 0.3, '#3a3d4a', 6), x, 0.15, z));
    w.add(tank, 3.6, 3.46, -3.7);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.36), new THREE.MeshBasicMaterial({ map: w.texture(neonText('BAR', { color: '#ff5fa2', bg: 'rgba(20,8,30,0.85)' })), transparent: true }));
    w.add(bar, 3.3, 1.0, -2.29);
    const barGlow = glow('#ff5fa2', 1.8, 0.45);
    w.add(barGlow, 3.3, 1.0, -2.1);
    const barNeon = { mat: bar.material, glow: barGlow, op: 0.45, a: 0 };
    neons.push(barNeon);
    // 酒吧门口挂的牌子：CLOSED / OPEN
    const plate = (text, color) =>
      w.texture(
        canvasTexture(160, 64, (g, W, H) => {
          g.fillStyle = '#f4ead8';
          g.fillRect(0, 0, W, H);
          g.strokeStyle = '#5a4352';
          g.lineWidth = 6;
          g.strokeRect(3, 3, W - 6, H - 6);
          g.font = 'bold 36px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = color;
          g.fillText(text, W / 2, H / 2 + 2);
        }),
      );
    const closedTex = plate('CLOSED', '#c8343a');
    const openTex = plate('OPEN', '#2f9a5a');
    const doorPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.16), new THREE.MeshBasicMaterial({ map: closedTex }));
    w.add(doorPlate, 3.3, 0.62, -2.28);
    // 乐手的凳子
    const stool = new THREE.Group();
    stool.add(at(k.cyl(0.18, 0.18, 0.06, '#a0663a', 14), 0, 0.42, 0));
    stool.add(at(k.cyl(0.03, 0.03, 0.4, '#3a3d4a', 6), 0, 0.2, 0));
    stool.add(at(k.cyl(0.14, 0.14, 0.02, '#3a3d4a', 12), 0, 0.01, 0));
    w.add(stool, STOOL[0], 0, STOOL[1]);

    // 便利店
    const store = new THREE.Group();
    store.add(at(k.box(2.6, 1.7, 2.0, '#e8e6df', 0.04), 0, 0.85, 0));
    store.add(at(k.box(2.7, 0.1, 2.1, '#c9c6bc', 0.03), 0, 1.75, 0));
    const storeFront = k.box(2.2, 1.05, 0.05, '#fff6d8', 0.01, { emissive: '#fff1c4', emissiveIntensity: 1.1 });
    storeFront.material = storeFront.material.clone();
    const frontOn = storeFront.material.color.clone();
    const frontOff = new THREE.Color('#2a2c38');
    store.add(at(storeFront, 0, 0.62, 1.0));
    for (const x of [-0.55, 0.55]) store.add(at(k.box(0.05, 1.05, 0.07, '#9aa0ad', 0.01), x, 0.62, 1.02));
    for (let i = 0; i < 6; i++) store.add(at(k.box(0.43, 0.12, 0.42, i % 2 ? '#ffffff' : '#3fbf7a', 0.02), -1.08 + i * 0.43, 1.3, 1.15));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: w.texture(neonText('24H 便利店', { color: '#59ff9c', bg: 'rgba(10,30,20,0.9)', font: 'bold 48px "Microsoft YaHei", sans-serif', w: 384 })), transparent: true }));
    store.add(at(sign, 0, 1.55, 1.04));
    w.add(store, 0.2, 0, -3.5);
    w.solid(store);
    const storeGlow = glow('#fff1c4', 3.2, 0.35);
    w.add(storeGlow, 0.2, 0.7, -2.2);
    const storeLight = new THREE.PointLight('#fff1c4', 4, 4.5, 1.5);
    w.add(storeLight, 0.2, 0.9, -2.0);
    neons.push({ mat: sign.material, glow: storeGlow, op: 0.35, a: 0.2 });
    w.poi(0.2, -1.9, { emote: '🍙', face: Math.PI, dur: 6 });

    // 自动售货机
    const vm = new THREE.Group();
    vm.add(at(k.box(0.7, 1.4, 0.55, '#d93a4a', 0.05), 0, 0.7, 0));
    const vmTex = w.texture(
      canvasTexture(128, 160, (g) => {
        g.fillStyle = '#eaf6ff';
        g.fillRect(0, 0, 128, 160);
        const cs = ['#ff5f5f', '#4fb0ff', '#ffd84a', '#59d98a', '#ff9ad5'];
        for (let y = 0; y < 3; y++)
          for (let x = 0; x < 5; x++) {
            g.fillStyle = cs[(x + y * 2) % cs.length];
            g.fillRect(10 + x * 22, 14 + y * 46, 14, 30);
          }
      }),
    );
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.75), new THREE.MeshStandardMaterial({ map: vmTex, emissiveMap: vmTex, emissive: '#ffffff', emissiveIntensity: 0.9 }));
    vm.add(at(panel, 0, 0.95, 0.28));
    vm.add(at(k.box(0.4, 0.12, 0.05, '#2a2a2a', 0.02), 0, 0.3, 0.28));
    w.add(vm, 1.9, 0, -2.75);
    w.solid(vm);
    const vmGlow = glow('#cfe8ff', 1.6, 0.35);
    w.add(vmGlow, 1.9, 0.95, -2.3);
    w.poi(1.9, -1.95, { emote: '🥤', face: Math.PI, dur: 5 });

    // 消防栓
    const hyd = new THREE.Group();
    hyd.add(at(k.cyl(0.09, 0.11, 0.35, '#e8443a', 12), 0, 0.175, 0));
    hyd.add(at(k.sphere(0.09, '#e8443a', 10), 0, 0.36, 0));
    const nub = k.cyl(0.04, 0.04, 0.3, '#e8443a', 8);
    nub.rotation.z = Math.PI / 2;
    hyd.add(at(nub, 0, 0.25, 0));
    w.add(hyd, -1.2, 0, 0.1);
    w.solidCircle(-1.2, 0.1, 0.15);

    // 路灯
    lamps.push(streetLamp(w, -2.4, 0.25), streetLamp(w, 2.6, 0.25, Math.PI), streetLamp(w, 1.0, 2.95), streetLamp(w, -4.3, 2.95));

    // 前面的小公园：公交站、长椅、树
    const shelter = new THREE.Group();
    shelter.add(at(k.box(1.6, 0.08, 0.7, '#3a3d4a', 0.03), 0, 1.5, 0));
    for (const x of [-0.75, 0.75]) shelter.add(at(k.cyl(0.03, 0.03, 1.5, '#3a3d4a', 8), x, 0.75, -0.25));
    const ad = w.texture(neonText('MOON CAFE', { color: '#ffb84f', bg: 'rgba(40,20,60,0.95)', font: 'bold 40px sans-serif' }));
    const adPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.55), new THREE.MeshBasicMaterial({ map: ad }));
    adPanel.rotation.y = 0;
    shelter.add(at(adPanel, 0, 0.95, -0.29));
    shelter.add(at(k.box(1.45, 0.62, 0.04, '#2a2d38', 0.01), 0, 0.95, -0.32));
    shelter.add(at(k.box(1.1, 0.06, 0.3, '#9a9db0', 0.02), 0, 0.42, -0.12));
    shelter.add(at(k.box(0.5, 0.25, 0.04, '#3a3d4a', 0.01), 0.6, 1.75, -0.25));
    w.add(shelter, -1.9, 0, 3.95);
    w.solid(shelter.children[4]);
    const adGlow = glow('#ffb84f', 1.8, 0.3);
    w.add(adGlow, -1.9, 0.95, 3.75);
    neons.push({ mat: adPanel.material, glow: adGlow, op: 0.3, a: 0.6 });
    w.poi(-1.9, 3.5, { emote: '🚌', face: 0, dur: 7 });

    const bench = new THREE.Group();
    bench.add(at(k.box(1.3, 0.07, 0.38, '#a0663a', 0.02), 0, 0.42, 0));
    bench.add(at(k.box(1.3, 0.35, 0.06, '#a0663a', 0.02), 0, 0.65, 0.18));
    for (const x of [-0.55, 0.55]) bench.add(at(k.box(0.06, 0.42, 0.38, '#3a3d4a', 0.01), x, 0.21, 0));
    w.add(bench, 2.4, 0, 3.9);
    w.poi(2.1, 3.9, { emote: '🌙', face: Math.PI, dur: 9, sit: true, seatY: 0.45 });

    const darkTree = (x, z, r = 0.7) => {
      const g = new THREE.Group();
      g.add(at(k.cyl(0.1, 0.13, 1.0, '#4a3a30', 10), 0, 0.5, 0));
      g.add(at(k.sphere(r, '#2f5a46', 18), 0, 1.0 + r * 0.6, 0));
      g.add(at(k.sphere(r * 0.6, '#356a52', 14), r * 0.5, 1.0 + r * 0.3, 0.1));
      w.add(g, x, 0, z);
      w.solidCircle(x, z, 0.18);
    };
    darkTree(-4.0, 4.0);
    darkTree(4.2, 3.5, 0.6);
    for (const [x, z, r] of [[-3.25, 4.1, 0.32], [-4.3, 3.4, 0.25], [3.6, 4.2, 0.28], [0.1, 4.3, 0.26]]) {
      const b = k.sphere(r, '#3a6e55', 14);
      b.scale.y = 0.75;
      w.add(b, x, r * 0.6, z);
    }

    const sky = starsAndMoon(w);

    // 停电时大楼和便利店之间的小巷黑漆漆的，进不去
    const dark = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.6, 2.3), new THREE.MeshBasicMaterial({ color: '#04050d', transparent: true, opacity: 0.92, depthWrite: false }));
    w.add(dark, -1.6, 1.3, -3.45);
    const alleyBlock = w.blocker(-2.1, -1.1, -2.6, -2.15, '🌑 小巷里黑漆漆的，什么也看不见……');
    const alleyLight = glow('#cfd8ff', 1.6, 0);
    w.add(alleyLight, -1.6, 0.4, -3.6);

    // 车流
    const cars = [];
    const lanes = [
      { z: 1.05, dir: 1 },
      { z: 2.15, dir: -1 },
    ];
    const palette = ['#4fa3ff', '#ffd23f', '#ff6b8b', '#f4f1ea'];
    // 平时的位置 / 停电时堵在斑马线上的位置（出租车不在）
    const normalX = [-4.2, 1.5, 3.0, -2.0];
    const jamX = [-0.2, null, 0.5, 2.1];
    [0, 0, 1, 1].forEach((lane, i) => {
      const L = lanes[lane];
      const taxi = i === 1;
      const c = car(k, taxi ? '#ffd23f' : palette[i % palette.length], { taxi });
      c.rotation.y = L.dir > 0 ? 0 : Math.PI;
      w.add(c, jamX[i] ?? TAXI_X, 0, L.z);
      if (taxi) c.visible = false;
      cars.push({ g: c, lane, dir: L.dir, speed: 1.4, v: 1.4 });
    });
    let traffic = false;
    const someoneOnCrossing = () => {
      const people = w.player ? [...w.villagers, w.player] : w.villagers;
      return people.some((p) => Math.abs(p.x) < CROSS + 0.25 && p.z > ROAD_Z0 - 0.3 && p.z < ROAD_Z1 + 0.3);
    };
    w.onUpdate((dt) => {
      if (!traffic) return;
      const busy = someoneOnCrossing();
      for (const c of cars) {
        const x = c.g.position.x;
        const front = x + c.dir * 0.55;
        // 行人在斑马线上：快到斑马线的车停下来
        const beforeCross = c.dir > 0 ? front < -CROSS && front > -CROSS - 1.0 : front > CROSS && front < CROSS + 1.0;
        let target = busy && beforeCross ? 0 : c.speed;
        // 跟车距离
        for (const o of cars) {
          if (o === c || o.lane !== c.lane) continue;
          const gap = (o.g.position.x - x) * c.dir;
          if (gap > 0 && gap < 1.5) target = Math.min(target, o.v * 0.9);
        }
        c.v += (target - c.v) * Math.min(1, dt * 4);
        let nx = x + c.dir * c.v * dt;
        if (nx > 6.2) nx = -6.2;
        if (nx < -6.2) nx = 6.2;
        c.g.position.x = nx;
        // 开出方块边缘时缩小消失，从另一边长出来
        const s = THREE.MathUtils.clamp((5.3 - Math.abs(nx)) / 0.7, 0, 1);
        c.g.scale.setScalar(Math.max(0.001, s));
      }
    });

    // ---------- 每帧按电力刷新灯光 ----------
    const { hemi, sun } = w.env;
    w.onUpdate((dt, t) => {
      for (const p of Object.values(P)) p.v += (p.t - p.v) * Math.min(1, dt * 0.9);
      const skyV = P.sky.v;
      const st = P.street.v;
      const ct = P.city.v;
      if (hemi) hemi.intensity = 0.35 + 0.4 * skyV + 0.25 * ct;
      if (sun) sun.intensity = 0.15 + 0.75 * skyV;
      // 天空：月亮慢慢变大，星星变亮
      sky.moon.visible = sky.mg.visible = skyV > 0.01;
      sky.moon.scale.setScalar(Math.max(0.001, skyV));
      sky.mg.material.opacity = 0.5 * skyV;
      sky.stars.opacity = (0.25 + 0.75 * skyV) * (0.65 + Math.sin(t * 1.7) * 0.2);
      dark.material.opacity = 0.92 * (1 - skyV);
      dark.visible = skyV < 0.99;
      alleyLight.material.opacity = 0.35 * skyV * (1 - ct * 0.5);
      // 街道：路灯
      for (const l of lamps) {
        l.bulb.material.emissiveIntensity = 1.6 * st;
        l.halo.material.opacity = 0.55 * st;
        l.light.intensity = 5 * st;
      }
      // 城市：窗户、招牌、便利店、售货机，一栋一栋亮起来
      for (const wm of windows) {
        const s = sm(wm.a, wm.a + 0.4, ct);
        // 灯是“啪”地一下亮的
        const f = s > 0.5 ? wm.on : wm.off;
        if (wm.mat.map !== f.map) {
          wm.mat.map = f.map;
          wm.mat.emissiveMap = f.emissive;
          wm.mat.needsUpdate = true;
        }
        wm.mat.emissiveIntensity = s;
      }
      // 霓虹灯偶尔闪一下
      const flick = Math.sin(t * 13) > 0.97 || (t % 7 > 6.6 && Math.sin(t * 40) > 0);
      for (const n of neons) {
        const s = sm(n.a, n.a + 0.4, ct) * (n === barNeon && flick ? 0.35 : 1);
        n.mat.color.setScalar(0.03 + 0.97 * s);
        n.glow.material.opacity = n.op * s;
      }
      const shop = sm(0.2, 0.6, ct);
      storeFront.material.emissiveIntensity = 0.05 + 1.05 * shop;
      storeFront.material.color.copy(frontOff).lerp(frontOn, shop);
      panel.material.color.setScalar(0.15 + 0.85 * shop);
      storeLight.intensity = 4 * shop;
      panel.material.emissiveIntensity = 0.05 + 0.85 * shop;
      vmGlow.material.opacity = 0.35 * shop;
      const on = ct > 0.6 && Math.sin(t * 3) > 0.3;
      beacon.visible = beaconGlow.visible = on;
    });

    // ---------- 居民 ----------
    const has = (id) => w.isRepaired(id);
    const found = (id) => foundIn('city').includes(id);
    const yemao = w.villager(
      {
        name: '夜猫',
        look: { hair: '#2b2b33', shirt: '#3d4a6b', pants: '#2a2d38', shoes: '#1d1d24' },
      },
      -0.8,
      -1.2,
    );
    const ani = w.villager(
      {
        name: '阿霓',
        look: { hair: '#ff8fc8', shirt: '#ff5fa2', pants: '#2e3a6b', hat: 'beanie', hatColor: '#4ff0ff' },
      },
      -1.9,
      3.4,
    );
    let xiaofei = null;
    let qiao = null;
    // 台词跟着城市修好的程度变
    const setLines = (v, lines) => {
      if (!v || v.lines.join() === lines.join()) return;
      v.lines = lines;
      v.lineIdx = 0;
    };
    const refreshLines = () => {
      if (w.fullyRepaired) {
        setLines(yemao, ['加班到现在……便利店的饭团，就是我的光。', '公园长椅上有顶黑色礼帽，是哪位绅士落下的？', '大楼和便利店中间的小巷里，夜里总飘出红茶的香味。']);
        setLines(ani, ['这座城市的夜晚，比白天还要亮！', '我在等最后一班公交……旁边树丛里有把红伞，不过不是我的。', '过马路要走斑马线哦，车会停下来让你。']);
        return;
      }
      const l = ['停电了……整座城一下子全黑了，便利店的饭团也热不了。'];
      if (!has('moon')) l.push('便利店后面挂月亮的杆子也空了。你带来的那个小月亮……挂回去试试？');
      else if (!found('teapot')) l.push('月光照进小巷了！里面好像飘出红茶的香味。');
      if (!has('taxi')) l.push('车都堵在斑马线上。司机们说，要等那辆黄色出租车回来带头。');
      if (!has('sax')) l.push('对面 BAR 的老乔把萨克斯弄丢了。他不吹，这条街的霓虹就不亮。');
      setLines(yemao, l);
      if (!has('taxi')) setLines(ani, ['车都不动了，我被困在马路这边，回不了家……', '要是有辆出租车来带个头就好了。']);
      else setLines(ani, ['车终于动了！可公园里还是黑乎乎的。', '刚才出租车上下来一位绅士，好像把帽子落在长椅上了。']);
    };
    const pop = (v) => w.fx.emit(v.root.position.clone().setY(0.6), { count: 14, spread: 0.4, rise: 1.2, color: '#ffe9a8' });
    // 全部修好的一刻：大家一起欢呼
    const cheer = () => {
      if (!w.fullyRepaired) return;
      setTimeout(() => w.villagers.forEach((v) => v.showBubble('🎉', 3)), 1600);
    };

    // ---------- 修复点 ----------
    // 🌙 月亮挂回天上：月光照亮小巷，红茶壶出现
    const ghostMoon = ghostify(k.sphere(0.42, '#ffffff', 24));
    w.repairSpot('moon', ghostMoon, ...MOON_POS, {
      reach: Infinity, // 挂得太高，只能点它
      pickR: 0.6,
      fn(instant) {
        power('sky', instant);
        w.unblock(alleyBlock);
        w.revealItem('teapot', instant);
        if (!instant) cheer();
        refreshLines();
      },
    });

    // 🚕 出租车回到停靠位：按喇叭带头，车流动起来，斑马线通了，礼帽出现
    const ghostTaxi = ghostify(car(k, '#ffd23f', { taxi: true }));
    w.repairSpot('taxi', ghostTaxi, TAXI_X, 0, 1.05, {
      reach: 1.5,
      pickR: 0.6,
      fn(instant) {
        const taxi = cars[1];
        taxi.g.visible = true;
        if (instant) cars.forEach((c, i) => (c.g.position.x = normalX[i]));
        else {
          taxi.v = 0;
          setTimeout(() => sfx.horn(), 500);
        }
        traffic = true;
        power('street', instant);
        w.unblock(jam);
        w.revealItem('tophat', instant);
        xiaofei = w.villager(
          {
            name: '小飞',
            speed: 1.1,
            look: { hair: '#5a3d2b', shirt: '#ffb84f', pants: '#3a3d4a', hat: 'cap', hatColor: '#ff7a3a' },
            lines: ['路通了！外卖又能送了！', '外卖！外卖！……啊，送错世界了。', '听说再往前，有一座一直在下雨的城市。', '下次我想送一份炸鱼薯条。'],
          },
          2.0,
          -0.8,
        );
        if (!instant) {
          pop(xiaofei);
          cheer();
        }
        refreshLines();
      },
    });

    // 🎷 萨克斯还给乐手：音乐响起，霓虹和窗户一栋栋亮起来，小伙伴们出门，红伞出现
    const ghostSax = ghostify(pixel.items.find((i) => i.id === 'sax').make(k));
    ghostSax.scale.setScalar(2.6);
    const saxSpot = new THREE.Group();
    saxSpot.add(ghostSax);
    w.repairSpot('sax', saxSpot, STOOL[0], 0.5, STOOL[1], {
      reach: 1.5,
      pickR: 0.4,
      fn(instant) {
        power('city', instant);
        doorPlate.material.map = openTex;
        w.poi(STOOL[0], STOOL[1], { emote: '🎷', face: 0, dur: 12, sit: true, seatY: 0.45 });
        qiao = w.villager(
          {
            name: '老乔',
            look: { hair: '#d8d8d8', shirt: '#6b3a5a', pants: '#26262e', shoes: '#1d1d24', hat: 'beanie', hatColor: '#26262e' },
            lines: ['我的萨克斯！谢谢你把它从像素小镇带回来。', '音乐一响，整条街的灯都跟着亮了。', '公园那边的树丛里，好像有把红伞在反光。'],
          },
          STOOL[0] - 0.5,
          STOOL[1] + 0.4,
        );
        const sax = pixel.items.find((i) => i.id === 'sax').make(k);
        sax.position.set(0.12, 0.2, 0.16);
        qiao.body.add(sax);
        w.revealItem('umbrella', instant);
        if (!instant) {
          sfx.jazz();
          pop(qiao);
          qiao.showBubble('🎷', 3);
          cheer();
        }
        refreshLines();
      },
    });

    w.placeItem('umbrella', -3.6, 0.32, 3.7, { hidden: true });
    w.placeItem('tophat', 2.75, 0.47, 3.9, { spin: false, hidden: true });
    w.placeItem('teapot', -1.6, 0.12, -4.2, { hidden: true });
    refreshLines();
  },
};
