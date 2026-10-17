// 夜都用到的模型：只负责造出来。摆在哪、挡不挡路、跟不跟电力走，由用它的地方决定
import * as THREE from 'three';
import { at, facade, canvasTexture } from '../../kit.js';
import { glow, neonText } from '../../fx.js';

// 有窗户的楼。windows 是正面、侧面两面墙，各有亮灯 / 停电两套贴图，电力系统按亮度切换
export function building(w, { size: [W, H, D], roof = '#4a4e63', ...look }) {
  const k = w.kit;
  const cols = (len) => Math.max(2, Math.round(len / 0.45));
  const rows = Math.max(2, Math.round(H / 0.55));
  const faces = (opts) => {
    const front = facade(cols(W), rows, opts);
    const side = facade(cols(D), rows, { ...opts, seed: opts.seed + 7 });
    [front.map, front.emissive, side.map, side.emissive].forEach((t) => w.texture(t));
    return { front, side };
  };
  const on = faces(look);
  const off = faces({ ...look, ratio: 0 }); // 停电时：一扇亮着的窗户都没有
  const lit = (f) => new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissive, emissive: '#ffffff', emissiveIntensity: 1, roughness: 0.85 });
  const mFront = lit(on.front);
  const mSide = lit(on.side);
  const mRoof = new THREE.MeshStandardMaterial({ color: roof, roughness: 0.9 });

  const group = new THREE.Group();
  const body = k.mesh(new THREE.BoxGeometry(W, H, D), mFront);
  body.material = [mSide, mSide, mRoof, mRoof, mFront, mFront];
  group.add(at(body, 0, H / 2, 0));
  group.add(at(k.box(W + 0.1, 0.12, D + 0.1, roof, 0.03), 0, H + 0.06, 0)); // 楼顶边沿
  const windows = [
    { mat: mFront, on: on.front, off: off.front },
    { mat: mSide, on: on.side, off: off.side },
  ];
  return { group, body, windows };
}

// 路灯：灯泡、光晕、点光源都单独返回，电力系统要开关它们
export function lampPost(k) {
  const group = new THREE.Group();
  group.add(at(k.cyl(0.05, 0.07, 2.2, '#3a3d4a', 10), 0, 1.1, 0));
  group.add(at(k.box(0.5, 0.06, 0.08, '#3a3d4a', 0.02), 0.22, 2.18, 0));
  const bulb = k.box(0.26, 0.08, 0.18, '#fff3d0', 0.03, { emissive: '#ffd98a', emissiveIntensity: 1.6 });
  bulb.material = bulb.material.clone(); // 要单独开关
  group.add(at(bulb, 0.42, 2.12, 0));
  const halo = glow('#ffcf7a', 1.6, 0.55);
  halo.position.set(0.42, 2.05, 0);
  group.add(halo);
  const light = new THREE.PointLight('#ffd49a', 5, 5.5, 1.4);
  light.position.set(0.42, 1.9, 0);
  group.add(light);
  return { group, bulb, halo, light };
}

export function car(k, color, { taxi = false } = {}) {
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

// 便利店：亮着的玻璃门面和招牌单独返回
export function convenienceStore(w) {
  const k = w.kit;
  const group = new THREE.Group();
  group.add(at(k.box(2.6, 1.7, 2.0, '#e8e6df', 0.04), 0, 0.85, 0));
  group.add(at(k.box(2.7, 0.1, 2.1, '#c9c6bc', 0.03), 0, 1.75, 0));
  const front = k.box(2.2, 1.05, 0.05, '#fff6d8', 0.01, { emissive: '#fff1c4', emissiveIntensity: 1.1 });
  front.material = front.material.clone();
  group.add(at(front, 0, 0.62, 1.0));
  for (const x of [-0.55, 0.55]) group.add(at(k.box(0.05, 1.05, 0.07, '#9aa0ad', 0.01), x, 0.62, 1.02));
  for (let i = 0; i < 6; i++) group.add(at(k.box(0.43, 0.12, 0.42, i % 2 ? '#ffffff' : '#3fbf7a', 0.02), -1.08 + i * 0.43, 1.3, 1.15));
  const signTex = w.texture(neonText('24H 便利店', { color: '#59ff9c', bg: 'rgba(10,30,20,0.9)', font: 'bold 48px "Microsoft YaHei", sans-serif', w: 384 }));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
  group.add(at(sign, 0, 1.55, 1.04));
  return { group, front, sign };
}

// 自动售货机：面板会跟着电力变亮
export function vendingMachine(w) {
  const k = w.kit;
  const group = new THREE.Group();
  group.add(at(k.box(0.7, 1.4, 0.55, '#d93a4a', 0.05), 0, 0.7, 0));
  const tex = w.texture(
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
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.75), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.9 }));
  group.add(at(panel, 0, 0.95, 0.28));
  group.add(at(k.box(0.4, 0.12, 0.05, '#2a2a2a', 0.02), 0, 0.3, 0.28));
  return { group, panel };
}

// 公交站：顶棚、广告牌、长凳。backboard 是挡路的那块板
export function busShelter(w) {
  const k = w.kit;
  const group = new THREE.Group();
  group.add(at(k.box(1.6, 0.08, 0.7, '#3a3d4a', 0.03), 0, 1.5, 0));
  for (const x of [-0.75, 0.75]) group.add(at(k.cyl(0.03, 0.03, 1.5, '#3a3d4a', 8), x, 0.75, -0.25));
  const adTex = w.texture(neonText('MOON CAFE', { color: '#ffb84f', bg: 'rgba(40,20,60,0.95)', font: 'bold 40px sans-serif' }));
  const ad = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.55), new THREE.MeshBasicMaterial({ map: adTex }));
  group.add(at(ad, 0, 0.95, -0.29));
  const backboard = k.box(1.45, 0.62, 0.04, '#2a2d38', 0.01);
  group.add(at(backboard, 0, 0.95, -0.32));
  group.add(at(k.box(1.1, 0.06, 0.3, '#9a9db0', 0.02), 0, 0.42, -0.12));
  group.add(at(k.box(0.5, 0.25, 0.04, '#3a3d4a', 0.01), 0.6, 1.75, -0.25));
  return { group, ad, backboard };
}

// 长椅：back = 1 靠背在 +z 那边，-1 在 -z 那边。坐面高 0.42
export function bench(k, { length = 1.3, depth = 0.38, back = 1 } = {}) {
  const g = new THREE.Group();
  g.add(at(k.box(length, 0.07, depth, '#a0663a', 0.02), 0, 0.42, 0));
  const bh = length > 1.1 ? 0.35 : 0.3;
  g.add(at(k.box(length, bh, 0.06, '#a0663a', 0.02), 0, 0.47 + bh / 2, back * (depth / 2 - 0.01)));
  const leg = length / 2 - 0.1;
  for (const x of [-leg, leg]) g.add(at(k.box(0.06, 0.42, depth, '#3a3d4a', 0.01), x, 0.21, 0));
  return g;
}

export function stool(k) {
  const g = new THREE.Group();
  g.add(at(k.cyl(0.18, 0.18, 0.06, '#a0663a', 14), 0, 0.42, 0));
  g.add(at(k.cyl(0.03, 0.03, 0.4, '#3a3d4a', 6), 0, 0.2, 0));
  g.add(at(k.cyl(0.14, 0.14, 0.02, '#3a3d4a', 12), 0, 0.01, 0));
  return g;
}

export function hydrant(k) {
  const g = new THREE.Group();
  g.add(at(k.cyl(0.09, 0.11, 0.35, '#e8443a', 12), 0, 0.175, 0));
  g.add(at(k.sphere(0.09, '#e8443a', 10), 0, 0.36, 0));
  const nub = k.cyl(0.04, 0.04, 0.3, '#e8443a', 8);
  nub.rotation.z = Math.PI / 2;
  g.add(at(nub, 0, 0.25, 0));
  return g;
}

export function waterTank(k) {
  const g = new THREE.Group();
  g.add(at(k.cyl(0.35, 0.35, 0.6, '#8a6a52', 16), 0, 0.6, 0));
  g.add(at(k.cone(0.4, 0.25, '#6b4f3a', 16), 0, 1.02, 0));
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(at(k.cyl(0.03, 0.03, 0.3, '#3a3d4a', 6), x, 0.15, z));
  return g;
}

export function darkTree(k, r = 0.7) {
  const g = new THREE.Group();
  g.add(at(k.cyl(0.1, 0.13, 1.0, '#4a3a30', 10), 0, 0.5, 0));
  g.add(at(k.sphere(r, '#2f5a46', 18), 0, 1.0 + r * 0.6, 0));
  g.add(at(k.sphere(r * 0.6, '#356a52', 14), r * 0.5, 1.0 + r * 0.3, 0.1));
  return g;
}

export function bush(k, r) {
  const b = k.sphere(r, '#3a6e55', 14);
  b.scale.y = 0.75;
  b.position.y = r * 0.6;
  return b;
}

// 天台上的投币望远镜，镜筒朝 -z 斜着往上
export function telescope(k) {
  const g = new THREE.Group();
  g.add(at(k.cyl(0.04, 0.06, 0.8, '#3a3d4a', 8), 0, 0.4, 0));
  const head = new THREE.Group();
  head.add(at(k.box(0.22, 0.2, 0.3, '#4fa3ff', 0.05), 0, 0, 0));
  const tube = k.cyl(0.07, 0.09, 0.36, '#4fa3ff', 12);
  tube.rotation.x = Math.PI / 2;
  head.add(at(tube, 0, 0.02, -0.28));
  head.position.y = 0.9;
  head.rotation.x = 0.45;
  g.add(head);
  return g;
}

export function planter(k) {
  const g = new THREE.Group();
  g.add(at(k.box(0.6, 0.3, 0.4, '#6b4f3a', 0.04), 0, 0.15, 0));
  for (const [x, r] of [[-0.15, 0.17], [0.13, 0.14]]) g.add(at(k.sphere(r, '#3a6e55', 12), x, 0.33, 0));
  return g;
}

// 竖着挂的霓虹招牌（一个字一行）
export function verticalSign(text, color) {
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

// 门口挂的小牌子：CLOSED / OPEN
export function doorPlate(text, color) {
  return canvasTexture(160, 64, (g, W, H) => {
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
  });
}

/**
 * 铁丝网：两根柱子，中间一张菱形网格，透过去看得见对面
 * @param {World} world 用来登记贴图（切换世界时释放）
 * @param {number} width 宽
 * @param {number} height 高
 * @returns {THREE.Group} 原点在底边中间，网面朝 ±z
 */
export function chainFence(world, width, height) {
  const kit = world.kit;
  const group = new THREE.Group();

  const meshTexture = world.texture(
    canvasTexture(128, 128, (context, size) => {
      context.clearRect(0, 0, size, size);
      context.strokeStyle = 'rgba(200, 205, 220, 0.9)';
      context.lineWidth = 3;
      const cell = 16;
      for (let offset = -size; offset < size * 2; offset += cell) {
        context.beginPath();
        context.moveTo(offset, 0);
        context.lineTo(offset + size, size);
        context.moveTo(offset, size);
        context.lineTo(offset + size, 0);
        context.stroke();
      }
    }),
  );
  meshTexture.wrapS = THREE.RepeatWrapping;
  meshTexture.wrapT = THREE.RepeatWrapping;
  meshTexture.repeat.set(width * 2, height * 2);
  const netMaterial = new THREE.MeshBasicMaterial({ map: meshTexture, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  group.add(at(new THREE.Mesh(new THREE.PlaneGeometry(width, height), netMaterial), 0, height / 2, 0));

  for (const side of [-1, 1]) {
    group.add(at(kit.cyl(0.03, 0.03, height + 0.1, '#7d8296', 8), (side * width) / 2, (height + 0.1) / 2, 0));
  }
  group.add(at(kit.box(width, 0.04, 0.04, '#7d8296', 0.01), 0, height, 0));
  return group;
}

/**
 * 修剪整齐的矮树篱
 * @param {Kit} kit
 * @param {number} length 沿 x 的长度
 * @param {number} depth 沿 z 的厚度
 * @returns {THREE.Mesh} 原点在底面中间
 */
export function hedge(kit, length, depth) {
  const height = 0.45;
  const mesh = kit.box(length, height, depth, '#2f5a46', 0.12);
  mesh.geometry.translate(0, height / 2, 0);
  return mesh;
}

/**
 * 菜畦：一圈木框，里面几棵菜
 * @param {Kit} kit
 * @returns {THREE.Group} 1.2 × 0.8
 */
export function gardenBed(kit) {
  const group = new THREE.Group();
  group.add(at(kit.box(1.2, 0.22, 0.8, '#7a5a3e', 0.03), 0, 0.11, 0));
  group.add(at(kit.box(1.1, 0.04, 0.7, '#4a3a2e', 0), 0, 0.23, 0));

  for (let i = 0; i < 4; i++) {
    const sprout = kit.sphere(0.12, i % 2 ? '#5fae55' : '#7fc96b', 10);
    sprout.scale.y = 0.7;
    group.add(at(sprout, -0.42 + i * 0.28, 0.3, (i % 2) * 0.2 - 0.1));
  }
  return group;
}

/**
 * 花园里放工具的小棚子
 * @param {Kit} kit
 * @returns {THREE.Group} 1.0 × 0.9，门朝 +x
 */
export function shed(kit) {
  const group = new THREE.Group();
  group.add(at(kit.box(1.0, 1.0, 0.9, '#8a6a52', 0.04), 0, 0.5, 0));
  const roof = kit.box(1.15, 0.08, 1.05, '#5a4a40', 0.02);
  roof.rotation.z = 0.15;
  group.add(at(roof, 0, 1.08, 0));
  group.add(at(kit.box(0.04, 0.7, 0.4, '#5a4436', 0.01), 0.51, 0.35, 0));
  return group;
}

/**
 * 背景高楼：只有朝街这一面，进不去
 * @param {World} world
 * @param {{ width: number, height: number, depth: number, seed: number }} spec 宽、高、进深、窗户的随机种子
 */
export function backdropBuilding(world, { width, height, depth, seed }) {
  return building(world, { size: [width, height, depth], wall: '#3f4766', frame: '#2c3350', dark: '#1d2238', lit: '#ffdca0', ratio: 0.45, seed, roof: '#2c3350' });
}

/**
 * 垃圾桶（大的那种带盖子的）
 * @param {Kit} kit
 * @returns {THREE.Group} 0.9 × 0.5
 */
export function dumpster(kit) {
  const group = new THREE.Group();
  group.add(at(kit.box(0.9, 0.55, 0.5, '#3f7a5a', 0.04), 0, 0.3, 0));
  const lid = kit.box(0.92, 0.05, 0.52, '#2f5a46', 0.02);
  lid.rotation.x = -0.12;
  group.add(at(lid, 0, 0.6, 0));
  return group;
}

/**
 * 挂在墙脚的空调外机
 * @param {Kit} kit
 * @returns {THREE.Group} 0.55 × 0.3，风扇朝 +z
 */
export function airConditioner(kit) {
  const group = new THREE.Group();
  group.add(at(kit.box(0.55, 0.4, 0.3, '#c9ccd6', 0.03), 0, 0.2, 0));
  const fan = kit.cyl(0.13, 0.13, 0.02, '#5a5f70', 14);
  fan.rotation.x = Math.PI / 2;
  group.add(at(fan, -0.08, 0.2, 0.16));
  return group;
}

/**
 * 蹲着的小猫
 * @param {Kit} kit
 * @returns {THREE.Group} 脸朝 +z
 */
export function cat(kit) {
  const color = '#2b2b33';
  const group = new THREE.Group();
  const body = kit.sphere(0.13, color, 12);
  body.scale.set(0.9, 1, 1.2);
  group.add(at(body, 0, 0.13, 0));
  group.add(at(kit.sphere(0.09, color, 12), 0, 0.27, 0.1));
  for (const side of [-1, 1]) {
    group.add(at(kit.cone(0.035, 0.07, color, 4), side * 0.05, 0.36, 0.1));
    group.add(at(kit.sphere(0.015, '#ffe680', 6, { emissive: '#ffe680', emissiveIntensity: 1.5 }), side * 0.035, 0.28, 0.18));
  }
  const tail = kit.cyl(0.02, 0.02, 0.25, color, 6);
  tail.rotation.x = -1.0;
  group.add(at(tail, 0, 0.12, -0.2));
  return group;
}

/**
 * 塑料瓶：透明蓝色瓶身，白瓶盖
 * @param {Kit} kit
 * @returns {THREE.Group} 横躺在地上
 */
export function plasticBottle(kit) {
  const group = new THREE.Group();
  const body = kit.cyl(0.05, 0.05, 0.2, '#8fd3ff', 10, { transparent: true, opacity: 0.75 });
  group.add(body);
  group.add(at(kit.cyl(0.025, 0.045, 0.05, '#8fd3ff', 10, { transparent: true, opacity: 0.75 }), 0, 0.12, 0));
  group.add(at(kit.cyl(0.026, 0.026, 0.03, '#ffffff', 8), 0, 0.16, 0));
  group.rotation.z = Math.PI / 2;
  group.position.y = 0.05;
  return group;
}

/**
 * 玻璃瓶：绿色的，在灯下会反光
 * @param {Kit} kit
 * @returns {THREE.Group} 立在地上
 */
export function glassBottle(kit) {
  const glass = { emissive: '#3fbf7a', emissiveIntensity: 0.35, transparent: true, opacity: 0.85 };
  const group = new THREE.Group();
  group.add(at(kit.cyl(0.055, 0.055, 0.2, '#3fbf7a', 12, glass), 0, 0.1, 0));
  group.add(at(kit.cyl(0.022, 0.055, 0.07, '#3fbf7a', 12, glass), 0, 0.235, 0));
  group.add(at(kit.cyl(0.022, 0.022, 0.06, '#3fbf7a', 8, glass), 0, 0.3, 0));
  return group;
}

/**
 * 后厨用的带轮子的小垃圾桶，盖子半掩着
 * @param {Kit} kit
 * @returns {THREE.Group} 0.4 × 0.4，原点在底面中间
 */
export function kitchenBin(kit) {
  const group = new THREE.Group();
  group.add(at(kit.box(0.4, 0.55, 0.4, '#3d5a7a', 0.04), 0, 0.31, 0));
  const lid = kit.box(0.42, 0.05, 0.42, '#2c4560', 0.02);
  lid.rotation.x = -0.25;
  group.add(at(lid, 0, 0.62, -0.03));

  for (const side of [-1, 1]) {
    const wheel = kit.cyl(0.04, 0.04, 0.03, '#1d1d24', 10);
    wheel.rotation.z = Math.PI / 2;
    group.add(at(wheel, side * 0.15, 0.04, -0.17));
  }
  return group;
}

/**
 * 扎好口的黑色垃圾袋
 * @param {Kit} kit
 * @returns {THREE.Group}
 */
export function trashBag(kit) {
  const group = new THREE.Group();
  const bag = kit.sphere(0.16, '#2a2a30', 12);
  bag.scale.set(1, 0.8, 0.9);
  group.add(at(bag, 0, 0.13, 0));
  group.add(at(kit.cone(0.05, 0.1, '#2a2a30', 6), 0, 0.3, 0));
  return group;
}

/**
 * 后厨的后门：一扇铁门，门上一盏小灯
 * @param {Kit} kit
 * @returns {{ group: THREE.Group, bulb: THREE.Mesh }} 门朝 +x；小灯跟着城市电力亮
 */
export function kitchenDoor(kit) {
  const group = new THREE.Group();
  group.add(at(kit.box(0.04, 0.9, 0.5, '#6b7080', 0.01), 0, 0.45, 0));
  group.add(at(kit.box(0.05, 0.04, 0.04, '#c9ccd6', 0.005), 0.02, 0.45, 0.17));
  const bulb = kit.box(0.08, 0.06, 0.12, '#fff3d0', 0.01, { emissive: '#ffd98a', emissiveIntensity: 1.2 });
  bulb.material = bulb.material.clone();
  group.add(at(bulb, 0.05, 1.0, 0));
  return { group, bulb };
}
