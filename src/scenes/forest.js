// 童话森林 —— 蘑菇屋、高塔、池塘，卡通着色
import * as THREE from 'three';
import { at, rng } from '../kit.js';
import { makeMotes } from '../fx.js';

function ground(w) {
  const k = w.kit;
  w.add(k.box(10, 0.45, 10, '#a6e07f', 0.18), 0, -0.225, 0);
  w.add(k.box(9.9, 1.5, 9.9, '#c99a6b', 0.25), 0, -1.1, 0);
  // 侧面的小石头点缀
  const r = rng(7);
  for (let i = 0; i < 16; i++) {
    const side = i % 4;
    const t = (r() - 0.5) * 8.5;
    const y = -0.7 - r() * 1.0;
    const s = k.sphere(0.12 + r() * 0.1, '#b3865a', 10);
    s.scale.z = 0.4;
    const pos = [[t, y, 4.95], [4.95, y, t], [t, y, -4.95], [-4.95, y, t]][side];
    if (side % 2) s.rotation.y = Math.PI / 2;
    w.add(s, ...pos);
  }
}

function mushroomHouse(w, x, z, { stemR, stemH, capR, capColor, ry = 0 }) {
  const k = w.kit;
  const g = new THREE.Group();
  g.add(at(k.cyl(stemR * 0.9, stemR, stemH, '#fff3dd', 24), 0, stemH / 2, 0));
  const cap = k.dome(capR, capColor, Math.PI / 2, 28);
  cap.scale.y = 0.75;
  g.add(at(cap, 0, stemH - 0.1, 0));
  const under = k.cyl(capR * 0.98, capR * 0.6, 0.12, '#f7e3c3', 28);
  g.add(at(under, 0, stemH - 0.12, 0));
  const r = rng(Math.round(x * 100 + z));
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const el = 0.25 + r() * 0.9;
    const dot = k.sphere(capR * (0.1 + r() * 0.06), '#ffffff', 12);
    const px = Math.cos(a) * Math.cos(el) * capR;
    const py = Math.sin(el) * capR * 0.75;
    const pz = Math.sin(a) * Math.cos(el) * capR;
    dot.position.set(px, stemH - 0.1 + py, pz);
    dot.scale.set(1, 0.35, 1);
    dot.lookAt(dot.position.x * 2, (dot.position.y - stemH) * 3 + stemH, dot.position.z * 2);
    dot.rotateX(Math.PI / 2);
    g.add(dot);
  }
  // 门、窗
  const door = k.box(stemR * 0.6, stemH * 0.55, 0.12, '#a0663a', 0.08);
  g.add(at(door, 0, stemH * 0.275, stemR * 0.93));
  g.add(at(k.sphere(0.035, '#ffd84a', 8), stemR * 0.18, stemH * 0.28, stemR * 0.93 + 0.07));
  const win = k.cyl(0.13, 0.13, 0.06, '#ffe9a8', 16, { emissive: '#ffd27a', emissiveIntensity: 0.6 });
  win.rotation.x = Math.PI / 2;
  const wa = 0.9;
  g.add(at(win, Math.sin(wa) * stemR * 0.95, stemH * 0.62, Math.cos(wa) * stemR * 0.95));
  win.rotation.y = wa;
  w.add(g, x, 0, z, ry);
  w.solidCircle(x, z, stemR + 0.05);
  return g;
}

function tree(w, x, z, { h = 1.1, r = 0.75, color = '#7fd06a', trunk = '#a0663a', solid = true } = {}) {
  const k = w.kit;
  const g = new THREE.Group();
  g.add(at(k.cyl(0.11, 0.15, h, trunk, 12), 0, h / 2, 0));
  g.add(at(k.sphere(r, color, 20), 0, h + r * 0.7, 0));
  g.add(at(k.sphere(r * 0.65, color, 16), r * 0.55, h + r * 0.35, 0.1));
  g.add(at(k.sphere(r * 0.6, color, 16), -r * 0.5, h + r * 0.45, -0.15));
  w.add(g, x, 0, z);
  if (solid) w.solidCircle(x, z, 0.2);
  return g;
}

function flower(k, color) {
  const g = new THREE.Group();
  g.add(at(k.cyl(0.012, 0.012, 0.16, '#5fae55', 5), 0, 0.08, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = k.sphere(0.035, color, 8);
    p.scale.y = 0.5;
    g.add(at(p, Math.cos(a) * 0.04, 0.17, Math.sin(a) * 0.04));
  }
  g.add(at(k.sphere(0.025, '#ffd84a', 8), 0, 0.18, 0));
  g.traverse((o) => (o.castShadow = false));
  return g;
}

export default {
  id: 'forest',
  name: '童话森林',
  emoji: '🍄',
  style: 'toon',
  styleLabel: '童话风',
  magnetStyle: 'toon',
  bg: 'linear-gradient(180deg, #bfe9ff 0%, #e6f6ff 50%, #ffe3f1 100%)',
  lights: {
    hemi: ['#e8f7ff', '#b5e39a', 1.9],
    sun: ['#fffbe8', 2.6, [6, 12, 5]],
  },
  camera: { pos: [11.5, 11, 14.5], target: [0, 0.6, 0], fitH: 3, maxPolar: 1.32, min: 2.5 },
  spawn: [0, 3.9],
  next: 'pixel',
  items: [
    {
      id: 'coin',
      name: '像素金币',
      icon: '🪙',
      hint: '水面上的荷叶',
      make(k) {
        return k.pixelArt(
          ['..###..', '.#yyy#.', '#yy#yy#', '#yy#yy#', '#yy#yy#', '.#yyy#.', '..###..'],
          { '#': '#c98a12', y: '#ffd23f' },
          0.045,
          0.06,
          { '#ffd23f': { emissive: '#ffb800', emissiveIntensity: 0.4 } },
        );
      },
    },
    {
      id: 'heart',
      name: '像素爱心',
      icon: '❤️',
      hint: '空心的木头里',
      make(k) {
        return k.pixelArt(
          ['.rr.rr.', 'rwrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
          { r: '#ff4d6d', w: '#ffffff' },
          0.04,
          0.06,
          { '#ff4d6d': { emissive: '#ff4d6d', emissiveIntensity: 0.5 } },
        );
      },
    },
    {
      id: 'cartridge',
      name: '游戏卡带',
      icon: '🎮',
      hint: '高塔背后的花丛',
      make(k) {
        const g = new THREE.Group();
        g.add(k.box(0.26, 0.3, 0.06, '#8c8c9c', 0.02));
        g.add(at(k.box(0.2, 0.15, 0.02, '#ff6b8b', 0.01, { emissive: '#ff6b8b', emissiveIntensity: 0.3 }), 0, 0.03, 0.035));
        for (let i = 0; i < 4; i++) g.add(at(k.box(0.03, 0.04, 0.02, '#ffd84a', 0.005), -0.06 + i * 0.04, -0.12, 0.035));
        g.add(at(k.box(0.22, 0.02, 0.07, '#6f6f80', 0.005), 0, 0.12, 0));
        return g;
      },
    },
  ],
  build(w) {
    const k = w.kit;
    ground(w);

    // 池塘
    const pond = new THREE.Group();
    pond.add(at(k.cyl(1.55, 1.55, 0.04, '#7fd4f0', 40, { emissive: '#7fd4f0', emissiveIntensity: 0.25 }), 0, 0.02, 0));
    const rr = rng(3);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const s = k.sphere(0.13 + rr() * 0.08, i % 3 ? '#d6d0c4' : '#c4bdb0', 10);
      s.scale.y = 0.6;
      pond.add(at(s, Math.cos(a) * 1.6, 0.04, Math.sin(a) * 1.6));
    }
    const lily = (x, z, r) => {
      const l = k.cyl(r, r, 0.02, '#5fbf5a', 16);
      pond.add(at(l, x, 0.05, z));
    };
    lily(0.6, 0.7, 0.24);
    lily(-0.6, -0.3, 0.18);
    lily(0.2, -0.8, 0.15);
    const lotus = k.sphere(0.07, '#ffb3cf', 10);
    lotus.scale.y = 0.6;
    pond.add(at(lotus, -0.6, 0.09, -0.3));
    w.add(pond, 2.4, 0, 1.6);
    w.solidCircle(2.4, 1.6, 1.5);
    w.poi(2.4, 3.4, { emote: '🎣', face: Math.PI, dur: 8 });

    // 蘑菇屋
    mushroomHouse(w, -2.7, -2.4, { stemR: 0.75, stemH: 1.3, capR: 1.3, capColor: '#f26b6b' });
    mushroomHouse(w, 0.4, -3.4, { stemR: 0.55, stemH: 1.0, capR: 0.95, capColor: '#7fb2f0', ry: -0.2 });
    w.poi(-2.7, -1.35, { emote: '🏠', face: 0, dur: 6 });
    w.poi(0.5, -2.55, { emote: '🧹', face: -0.2, dur: 6 });

    // 高塔
    const tower = new THREE.Group();
    tower.add(at(k.cyl(0.75, 0.85, 2.6, '#d4c6f5', 24), 0, 1.3, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      tower.add(at(k.box(0.22, 0.25, 0.22, '#c4b3ef', 0.04), Math.cos(a) * 0.72, 2.7, Math.sin(a) * 0.72));
    }
    tower.add(at(k.cone(1.0, 1.4, '#f6a6c8', 24), 0, 3.45, 0));
    tower.add(at(k.cyl(0.015, 0.015, 0.5, '#8a6a4a', 6), 0, 4.35, 0));
    const flag = k.box(0.3, 0.18, 0.02, '#ffd84a', 0.01);
    tower.add(at(flag, 0.16, 4.5, 0));
    const tdoor = k.box(0.42, 0.7, 0.1, '#8a5a3a', 0.1);
    tower.add(at(tdoor, 0, 0.35, 0.82));
    for (const y of [1.3, 2.05]) {
      const tw = k.box(0.22, 0.32, 0.08, '#ffe9a8', 0.08, { emissive: '#ffd27a', emissiveIntensity: 0.6 });
      tower.add(at(tw, 0, y, 0.8));
    }
    w.add(tower, 3.3, 0, -2.9);
    w.solidCircle(3.3, -2.9, 0.85);
    w.poi(3.3, -1.85, { emote: '✨', face: Math.PI, dur: 6 });
    w.onUpdate((dt, t) => {
      flag.rotation.y = Math.sin(t * 3) * 0.3;
    });

    // 空心木头
    const log = new THREE.Group();
    const shell = k.cyl(0.36, 0.36, 1.8, '#a0663a', 20, { side: THREE.DoubleSide });
    shell.geometry.dispose();
    shell.geometry = new THREE.CylinderGeometry(0.36, 0.36, 1.8, 20, 1, true);
    log.add(shell);
    for (const s of [-1, 1]) {
      const ring = k.torus(0.32, 0.05, '#e3b787');
      ring.rotation.x = Math.PI / 2;
      log.add(at(ring, 0, s * 0.9, 0));
    }
    const moss = k.sphere(0.22, '#8fd17f', 12);
    moss.scale.set(1.6, 0.5, 1);
    log.add(at(moss, -0.32, 0.2, 0));
    log.rotation.z = Math.PI / 2;
    // 点木头时，镜头转到开口那头往里看
    log.userData.peek = { target: [-0.95, 0.35, 2.9], from: [2.6, 0.8, 0.4] };
    w.add(log, -1.6, 0.36, 2.9);
    w.solid(log);
    w.poi(-1.6, 3.75, { emote: '🐛', face: Math.PI, dur: 5 });

    // 树
    tree(w, -4.1, 0.4);
    tree(w, -3.9, 4.0, { color: '#ffb7d5', h: 0.9, r: 0.65 });
    tree(w, 4.25, 4.25, { color: '#9ee08a', h: 0.75, r: 0.5 });
    tree(w, 4.3, -0.5, { color: '#ffb7d5', h: 0.95, r: 0.6 });
    tree(w, -4.3, -4.3, { color: '#8fd17f', h: 1.3, r: 0.7 });
    tree(w, 1.9, -4.4, { color: '#b5e39a', h: 0.8, r: 0.5 });
    w.poi(-3.35, 0.6, { emote: '💤', face: -Math.PI / 2, dur: 8 });

    // 踏脚石小路
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const s = k.cyl(0.24, 0.26, 0.05, '#e3ddd0', 14);
      s.castShadow = false;
      w.add(s, -2.7 * t + 0.1 * Math.sin(i * 2), 0.025, 4.2 - t * 5.4);
    }

    // 栅栏
    for (let i = 0; i < 7; i++) {
      w.add(k.box(0.1, 0.5, 0.06, '#fffaf0', 0.03), 0.9 + i * 0.55, 0.25, 4.7);
      w.add(k.cone(0.07, 0.1, '#fffaf0', 4), 0.9 + i * 0.55, 0.55, 4.7);
    }
    w.add(k.box(3.4, 0.06, 0.05, '#fffaf0', 0.02), 0.9 + 1.65, 0.35, 4.72);

    // 花丛（高塔后面一圈特别多，用来藏卡带）
    const r = rng(42);
    const colors = ['#ff8fb1', '#ffffff', '#ffd84a', '#b38ee8', '#ff9a6b'];
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < 70; tries++) {
      const x = (r() - 0.5) * 9.2;
      const z = (r() - 0.5) * 9.2;
      if (w.blocked(x, z, 0.12)) continue;
      w.add(flower(k, colors[placed % colors.length]), x, 0, z, r() * 6);
      placed++;
    }
    for (let i = 0; i < 14; i++) {
      const a = 0.6 + (i / 14) * 1.6;
      const x = 3.3 + Math.cos(a) * (1.05 + (i % 3) * 0.15);
      const z = -2.9 - Math.sin(a) * (1.05 + (i % 3) * 0.15);
      if (x > 4.6 || z < -4.6) continue;
      const f = flower(k, colors[i % colors.length]);
      f.scale.setScalar(1.6);
      w.add(f, x, 0, z);
    }
    for (const [x, z] of [[-1.2, -0.6], [1.0, 0.6], [-3.4, 2.0], [4.0, 2.8]]) {
      const b = k.sphere(0.3, '#7fd06a', 14);
      b.scale.y = 0.7;
      w.add(b, x, 0.15, z);
    }
    w.poi(-0.6, 0.7, { emote: '🌸', face: 0.5, dur: 6 });

    // 萤火虫
    const motes = makeMotes(26, 9, '#fff3a0', 5);
    w.root.add(motes);
    w.onUpdate((dt, t) => motes.userData.update(t));

    w.placeItem('coin', 3.0, 0.2, 2.3);
    w.placeItem('heart', -0.95, 0.32, 2.9, { ry: Math.PI / 2, spin: false });
    w.placeItem('cartridge', 4.05, 0.22, -4.0);

    w.villager(
      {
        name: '波波',
        look: { hair: '#f2e6d6', shirt: '#7fb2f0', pants: '#a0663a', hat: 'gnome', hatColor: '#e85d5d' },
        lines: [
          '欢迎来到童话森林！那两座蘑菇屋是我盖的哦。',
          '池塘的荷叶上，好像停着一枚亮晶晶的金币……',
          '听说凑齐“像素的东西”，就能去一个方方正正的世界。',
        ],
      },
      -1.0,
      0.0,
    );
    w.villager(
      {
        name: '莉莉',
        look: { hair: '#c48a54', shirt: '#ffb7d5', pants: '#7fb2f0', hat: 'gnome', hatColor: '#b38ee8' },
        lines: [
          '嘘……那根空心木头里，好像住着一颗小小的心。',
          '高塔后面的花丛，我从来没去过呢，你敢去看看吗？',
          '你也是从冰箱上来的吗？',
        ],
      },
      1.0,
      -1.4,
    );
    w.villager(
      {
        name: '蘑菇仔',
        speed: 0.65,
        look: { hair: '#7a4b2a', shirt: '#fff3dd', pants: '#8a5a3a', hat: 'mushroom', hatColor: '#f26b6b' },
        lines: ['……嗯？', '我在这里站了好久，都快长成蘑菇了。', '你的鞋子，踩到我的影子啦。'],
      },
      -2.2,
      1.2,
    );
  },
};
