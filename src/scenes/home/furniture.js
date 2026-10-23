// 屋里的家具：床、落地灯、书架、厨房台面、冰箱、地毯和小圆桌、凳子、大盆栽、收音机柜、毛线篮、拖鞋
// 摆好就登记碰撞和小人会去的兴趣点（打盹、看书、喝茶……），撞上去会晃的几件交给 touch.js
import * as THREE from 'three';
import { at } from '../../kit.js';
import { RUG } from './layout.js';

export const WOOD = '#d9a066';
export const WOOD_DARK = '#b07a45';

/**
 * @typedef {object} Bumpable 撞上去会晃一下、响一声的家具
 * @property {THREE.Object3D} object 整件家具（原点在地上，晃的时候按它压扁）
 * @property {'wood' | 'metal' | 'soft' | 'leaf'} sound 撞上去是什么声音
 * @property {number} squash 晃多大：大件晃得小，小件晃得大
 */

/**
 * 摆上屋里的家具，登记碰撞和兴趣点
 * @param {World} w 小屋这个世界
 * @returns {{ bumpables: Bumpable[], spout: THREE.Object3D, radio: THREE.Object3D }} 撞了会晃的家具；茶壶嘴（冒热气）；收音机（飘音符）
 */
export function buildFurniture(w) {
  const k = w.kit;
  /** @type {Bumpable[]} */
  const bumpables = [];

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
  bumpables.push({ object: bed, sound: 'soft', squash: 0.06 });
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
  bumpables.push({ object: lamp, sound: 'metal', squash: 0.08 });

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
  bumpables.push({ object: shelf, sound: 'wood', squash: 0.04 });
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
  bumpables.push({ object: counter, sound: 'wood', squash: 0.05 });

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
  bumpables.push({ object: fridge, sound: 'metal', squash: 0.04 });
  w.fridge = fridge;
  w.poi(3.95, -3.2, { emote: '🍰', face: Math.PI, dur: 5 });

  // 圆地毯 + 小圆桌 + 凳子
  const rug = k.cyl(RUG.radius, RUG.radius, 0.03, '#f7c6a3', 40);
  w.add(rug, RUG.x, 0.015, RUG.z);
  rug.castShadow = false;
  const rug2 = k.cyl(1.35, 1.35, 0.035, '#fbe1c6', 40);
  rug2.castShadow = false;
  w.add(rug2, RUG.x, 0.02, RUG.z);

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
  bumpables.push({ object: table, sound: 'wood', squash: 0.06 });

  const stool = (x, z, color) => {
    const s = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      s.add(at(k.cyl(0.03, 0.03, 0.36, WOOD_DARK, 8), Math.cos(a) * 0.15, 0.18, Math.sin(a) * 0.15));
    }
    s.add(at(k.cyl(0.25, 0.25, 0.08, color, 20), 0, 0.38, 0));
    w.add(s, x, 0, z);
    return s;
  };
  for (const seat of [stool(-0.75, 0.75, '#f6a6b8'), stool(1.75, 0.65, '#8ec5e8')]) {
    bumpables.push({ object: seat, sound: 'wood', squash: 0.14 });
  }
  w.poi(-0.75, 0.75, { emote: '☕', face: Math.atan2(1.25, -0.35), dur: 8, sit: true, seatY: 0.42 });
  w.poi(1.75, 0.65, { emote: '🍪', face: Math.atan2(-1.25, -0.25), dur: 8, sit: true, seatY: 0.42 });

  // 大盆栽
  const plant = new THREE.Group();
  plant.add(at(k.cyl(0.4, 0.3, 0.55, '#e07a5f', 20), 0, 0.275, 0));
  plant.add(at(k.torus(0.4, 0.05, '#c9654d'), 0, 0.55, 0));
  plant.children[1].rotation.x = Math.PI / 2;
  plant.add(at(k.cyl(0.37, 0.37, 0.04, '#7a5236', 20), 0, 0.545, 0)); // 土面比盆口高一点，贴在同一高度会闪
  const leafSpots = [[0, 1.15, 0, 0.42], [-0.25, 0.9, 0.12, 0.3], [0.25, 0.95, -0.1, 0.32], [0.05, 1.5, -0.05, 0.3], [-0.15, 0.78, -0.2, 0.25], [0.25, 0.8, -0.15, 0.22]];
  plant.add(at(k.cyl(0.04, 0.05, 0.8, '#6b8f4a', 8), 0, 0.9, 0));
  for (const [x, y, z, r] of leafSpots) {
    const l = k.sphere(r, '#7cc576', 16);
    l.scale.y = 0.85;
    plant.add(at(l, x, y, z));
  }
  w.add(plant, -4.0, 0, 1.4);
  w.solidCircle(-4.0, 1.4, 0.45);
  bumpables.push({ object: plant, sound: 'leaf', squash: 0.08 });
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
  bumpables.push({ object: cab, sound: 'wood', squash: 0.07 });
  w.poi(-3.45, 3.15, { emote: '♪', face: -Math.PI / 2, dur: 7 });

  // 毛线篮 + 散落的小东西
  const basket = new THREE.Group();
  basket.add(at(k.cyl(0.32, 0.26, 0.3, '#d9b380', 16), 0, 0.15, 0));
  for (const [x, z, c] of [[-0.1, 0.05, '#f6a6b8'], [0.1, -0.05, '#8ec5e8'], [0, 0.12, '#ffd84a']]) basket.add(at(k.sphere(0.13, c, 12), x, 0.32, z));
  w.add(basket, 3.9, 0, 3.7);
  w.solidCircle(3.9, 3.7, 0.33);
  bumpables.push({ object: basket, sound: 'soft', squash: 0.12 });

  // 拖鞋
  for (const s of [-1, 1]) {
    const sl = k.box(0.16, 0.06, 0.32, '#f4a259', 0.03);
    w.add(sl, -2.0 + s * 0.12, 0.03, -1.2, s * 0.15);
  }

  return { bumpables, spout, radio };
}
