// 像素小镇 —— 方块房子、喷泉、飘过的方块云，整个画面按像素比例渲染
import * as THREE from 'three';
import { at, canvasTexture, rng } from '../kit.js';

function grassTexture() {
  return canvasTexture(
    20,
    20,
    (g) => {
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
          const checker = (Math.floor(x / 2) + Math.floor(y / 2)) % 2;
          g.fillStyle = checker ? '#5ec45e' : '#56b956';
          g.fillRect(x, y, 1, 1);
        }
      }
      const r = rng(11);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = r() > 0.5 ? '#7bd66f' : '#4aa84a';
        g.fillRect(Math.floor(r() * 20), Math.floor(r() * 20), 1, 1);
      }
    },
    { pixel: true },
  );
}

function house(w, x, z, { wall, roof, ry = 0 }) {
  const k = w.kit;
  const g = new THREE.Group();
  g.add(at(k.box(2.4, 1.5, 2.0, wall), 0, 0.75, 0));
  g.add(at(k.box(2.5, 0.12, 2.1, '#8b5a2b'), 0, 0.06, 0));
  const layers = [2.7, 2.1, 1.5, 0.9, 0.35];
  layers.forEach((wd, i) => g.add(at(k.box(wd, 0.28, 2.3, i % 2 ? roof : shade(roof)), 0, 1.64 + i * 0.28, 0)));
  g.add(at(k.box(0.35, 0.7, 0.35, '#a0a0a0'), 0.7, 2.2, -0.5));
  g.add(at(k.box(0.5, 0.85, 0.08, '#8b5a2b'), 0, 0.5, 1.02));
  g.add(at(k.box(0.08, 0.08, 0.06, '#ffd84a'), 0.15, 0.5, 1.07));
  for (const sx of [-0.75, 0.75]) {
    g.add(at(k.box(0.45, 0.45, 0.06, '#ffe680', 0, { emissive: '#ffd84a', emissiveIntensity: 0.5 }), sx, 0.95, 1.02));
    g.add(at(k.box(0.55, 0.08, 0.14, '#ffffff'), sx, 0.69, 1.05));
  }
  w.add(g, x, 0, z, ry);
  w.solid(g, -0.15);
  return g;
}

function shade(hex) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, -0.08);
  return '#' + c.getHexString();
}

function voxelTree(w, x, z, { h = 0.9, color = '#3fa34d' } = {}) {
  const k = w.kit;
  const g = new THREE.Group();
  g.add(at(k.box(0.35, h, 0.35, '#8b5a2b'), 0, h / 2, 0));
  g.add(at(k.box(1.3, 0.6, 1.3, color), 0, h + 0.3, 0));
  g.add(at(k.box(0.9, 0.5, 0.9, shade(color)), 0, h + 0.85, 0));
  g.add(at(k.box(0.4, 0.3, 0.4, color), 0, h + 1.2, 0));
  g.add(at(k.box(0.15, 0.15, 0.08, '#ff4d4d'), 0.35, h + 0.35, 0.66));
  w.add(g, x, 0, z);
  w.solid(g.children[0]);
  return g;
}

export default {
  id: 'pixel',
  name: '像素小镇',
  emoji: '👾',
  style: 'pixel',
  styleLabel: 'PIXEL · 8-BIT',
  magnetStyle: 'pixel',
  bg: 'linear-gradient(180deg, #3d7bff 0%, #3d7bff 22%, #5a91ff 22%, #5a91ff 44%, #78a8ff 44%, #78a8ff 66%, #9cc2ff 66%, #9cc2ff 100%)',
  lights: {
    hemi: ['#eaf4ff', '#6fae5f', 1.7],
    sun: ['#ffffff', 2.8, [-5, 12, 8]],
  },
  camera: { pos: [11.5, 11.5, 14.5], target: [0, 0.6, 0], fitH: 2.6, maxPolar: 1.3, min: 3 },
  spawn: [0, 3.6],
  next: 'city',
  items: [
    {
      id: 'moon',
      name: '小月亮',
      icon: '🌙',
      hint: '会冒水的地方',
      make(k) {
        return k.pixelArt(
          ['..yyyy.', '.yyy...', 'yyy....', 'yyy....', 'yyy....', '.yyy...', '..yyyy.'],
          { y: '#ffe680' },
          0.045,
          0.06,
          { '#ffe680': { emissive: '#ffd84a', emissiveIntensity: 0.7 } },
        );
      },
    },
    {
      id: 'taxi',
      name: '小出租车',
      icon: '🚕',
      hint: '蓝屋顶房子的后头',
      make(k) {
        const g = new THREE.Group();
        g.add(at(k.box(0.4, 0.12, 0.22, '#ffd23f', { emissive: '#ffd23f', emissiveIntensity: 0.25 }), 0, 0.1, 0));
        g.add(at(k.box(0.22, 0.1, 0.2, '#ffd23f'), -0.02, 0.21, 0));
        g.add(at(k.box(0.23, 0.07, 0.21, '#3a4a6a'), -0.02, 0.21, 0));
        g.add(at(k.box(0.1, 0.04, 0.06, '#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), -0.02, 0.28, 0));
        for (const [x, z] of [[0.12, 0.11], [-0.12, 0.11], [0.12, -0.11], [-0.12, -0.11]]) g.add(at(k.box(0.08, 0.08, 0.04, '#222222'), x, 0.04, z));
        g.add(at(k.box(0.02, 0.04, 0.16, '#fff4c8', { emissive: '#fff4c8', emissiveIntensity: 1 }), 0.2, 0.11, 0));
        return g;
      },
    },
    {
      id: 'sax',
      name: '萨克斯',
      icon: '🎷',
      hint: '树荫下的草地',
      make(k) {
        return k.pixelArt(
          ['.....d', '....g.', '....g.', '....g.', '....g.', '.g..g.', 'gg..g.', 'ggggg.', '.ggg..'],
          { g: '#f2b632', d: '#3a3a3a' },
          0.04,
          0.06,
          { '#f2b632': { emissive: '#f2b632', emissiveIntensity: 0.4 } },
        );
      },
    },
  ],
  build(w) {
    const k = w.kit;
    // 地面方块
    const grassTex = w.texture(grassTexture());
    const top = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshLambertMaterial({ map: grassTex }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.001;
    top.receiveShadow = true;
    w.root.add(top);
    w.add(k.box(10, 0.5, 10, '#5ec45e'), 0, -0.25, 0);
    w.add(k.box(10, 1.4, 10, '#8b5a2b'), 0, -1.2, 0);
    const r0 = rng(5);
    for (let i = 0; i < 24; i++) {
      const side = i % 4;
      const t = Math.round((r0() - 0.5) * 9) + 0.5;
      const y = -0.6 - Math.floor(r0() * 3) * 0.3;
      const pos = [[t, y, 5.0], [5.0, y, t], [t, y, -5.0], [-5.0, y, t]][side];
      w.add(k.box(0.3, 0.3, 0.3, r0() > 0.5 ? '#6e4520' : '#a0703a'), ...pos);
    }

    // 石板路
    const stone = (x, z) => {
      const s = k.box(0.92, 0.05, 0.92, (Math.round(x + z) & 1) ? '#c9c2b5' : '#b7afa1');
      s.castShadow = false;
      w.add(s, x, 0.025, z);
    };
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 2; z++) stone(x, z + 0.4);
    for (let z = 3; z <= 4; z++) stone(0, z + 0.4);
    for (const z of [-1.0, -1.5]) {
      stone(-2.6, z);
      stone(2.5, z);
    }
    stone(-1.6, -0.6);
    stone(1.6, -0.6);

    // 喷泉
    const fountain = new THREE.Group();
    fountain.add(at(k.box(1.7, 0.35, 1.7, '#a8a8b8'), 0, 0.175, 0));
    fountain.add(at(k.box(1.36, 0.05, 1.36, '#4ab8ff', { emissive: '#4ab8ff', emissiveIntensity: 0.35 }), 0, 0.33, 0));
    fountain.add(at(k.box(0.3, 0.8, 0.3, '#bfbfcc'), 0, 0.6, 0));
    fountain.add(at(k.box(0.7, 0.12, 0.7, '#a8a8b8'), 0, 1.0, 0));
    fountain.add(at(k.box(0.5, 0.05, 0.5, '#4ab8ff', { emissive: '#4ab8ff', emissiveIntensity: 0.35 }), 0, 1.07, 0));
    const drops = [];
    for (let i = 0; i < 8; i++) {
      const d = k.box(0.08, 0.08, 0.08, '#9fdcff', { emissive: '#9fdcff', emissiveIntensity: 0.5 });
      d.castShadow = false;
      fountain.add(d);
      drops.push({ d, a: (i / 8) * Math.PI * 2, off: i / 8 });
    }
    w.add(fountain, 0, 0, 0.4);
    w.solid(fountain);
    w.onUpdate((dt, t) => {
      for (const p of drops) {
        const k2 = (t * 0.8 + p.off) % 1;
        const rad = 0.15 + k2 * 0.45;
        p.d.position.set(Math.cos(p.a) * rad, 1.15 + Math.sin(k2 * Math.PI) * 0.35 - k2 * 0.7, Math.sin(p.a) * rad);
      }
    });
    w.poi(-1.2, 0.4, { emote: '💧', face: Math.PI / 2, dur: 6 });
    w.poi(1.2, 1.4, { emote: '🪙', face: -Math.PI / 2, dur: 5 });

    // 房子
    house(w, -2.6, -2.85, { wall: '#fff1d0', roof: '#e85d5d' });
    house(w, 2.5, -2.9, { wall: '#e8f1ff', roof: '#4a7bd6' });
    w.poi(-2.6, -1.3, { emote: '🏠', face: Math.PI, dur: 6 });
    w.poi(2.5, -1.3, { emote: '🔑', face: Math.PI, dur: 5 });

    // 冰淇淋放在蓝屋子后面的箱子上
    const crate = new THREE.Group();
    crate.add(k.box(0.5, 0.5, 0.5, '#c8913a'));
    crate.add(at(k.box(0.52, 0.06, 0.52, '#8b5a2b'), 0, 0.15, 0));
    crate.add(at(k.box(0.52, 0.06, 0.52, '#8b5a2b'), 0, -0.15, 0));
    w.add(crate, 4.1, 0.25, -4.25);
    w.solid(crate);

    // 树
    voxelTree(w, -4.1, 1.7);
    voxelTree(w, 4.1, 1.9, { color: '#52b852' });
    voxelTree(w, -3.6, 4.0, { h: 0.7, color: '#2f8f3f' });
    voxelTree(w, 3.9, 4.1, { h: 1.1 });
    voxelTree(w, 0.0, -4.2, { h: 0.8, color: '#52b852' });
    w.poi(-3.3, 1.7, { emote: '🍎', face: -Math.PI / 2, dur: 6 });

    // 路灯
    for (const x of [-1.25, 1.25]) {
      const lamp = new THREE.Group();
      lamp.add(at(k.box(0.12, 1.4, 0.12, '#4a4a5a'), 0, 0.7, 0));
      lamp.add(at(k.box(0.3, 0.3, 0.3, '#fff5a8', { emissive: '#ffe066', emissiveIntensity: 0.9 }), 0, 1.5, 0));
      lamp.add(at(k.box(0.36, 0.06, 0.36, '#4a4a5a'), 0, 1.68, 0));
      w.add(lamp, x, 0, 2.6);
      w.solid(lamp.children[0], 0.05);
    }

    // 方块花
    const r = rng(9);
    const fc = ['#ff4d6d', '#ffd84a', '#ffffff', '#b38ee8'];
    let n = 0;
    for (let tries = 0; tries < 300 && n < 40; tries++) {
      const x = Math.round((r() - 0.5) * 9 * 4) / 4;
      const z = Math.round((r() - 0.5) * 9 * 4) / 4;
      if (w.blocked(x, z, 0.15) || (Math.abs(x) < 1.6 && z > -1.3 && z < 4.9)) continue;
      const f = new THREE.Group();
      f.add(at(k.box(0.04, 0.14, 0.04, '#2f8f3f'), 0, 0.07, 0));
      f.add(at(k.box(0.1, 0.1, 0.1, fc[n % fc.length]), 0, 0.17, 0));
      f.traverse((o) => (o.castShadow = false));
      w.add(f, x, 0, z);
      n++;
    }

    // 栅栏
    for (let i = 0; i < 6; i++) {
      w.add(k.box(0.1, 0.45, 0.1, '#ffffff'), -4.4 + i * 0.5, 0.225, 2.9);
    }
    w.add(k.box(2.6, 0.08, 0.06, '#ffffff'), -3.15, 0.32, 2.9);
    w.solid(w.root.children[w.root.children.length - 1], 0.08);

    // 飘过的方块云
    const clouds = [];
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Group();
      c.add(k.box(1.2, 0.35, 0.7, '#ffffff'));
      c.add(at(k.box(0.7, 0.3, 0.5, '#ffffff'), 0.2, 0.3, 0));
      c.add(at(k.box(0.5, 0.25, 0.5, '#ffffff'), -0.45, 0.15, 0.1));
      c.traverse((o) => (o.receiveShadow = false));
      w.add(c, -6 + i * 5, 4.5 + i * 0.6, -2 + i * 2);
      clouds.push(c);
    }
    w.onUpdate((dt) => {
      for (const c of clouds) {
        c.position.x += dt * 0.25;
        if (c.position.x > 7) c.position.x = -7;
      }
    });

    w.placeItem('sax', -3.45, 0.2, 3.25);
    w.placeItem('moon', 0.42, 0.5, 0.85);
    w.placeItem('taxi', 4.1, 0.55, -4.25, { ry: 0.6 });

    w.villager(
      {
        name: '方方',
        look: { hair: '#3b2a20', shirt: '#e85d5d', pants: '#3d5bd6', hat: 'cap', hatColor: '#e85d5d' },
        lines: ['欢迎来到像素小镇！这里一切都是方的，包括我的脑袋。', '喷泉的水面上，倒映着一个小小的月亮……可现在是白天呀？', '8-bit 的天空，是最蓝的天空。'],
      },
      -0.6,
      2.2,
    );
    w.villager(
      {
        name: '豆豆',
        look: { hair: '#ffd84a', shirt: '#52b852', pants: '#6e4520' },
        lines: ['蓝屋顶房子后面堆着箱子，箱子上停着一辆黄色的小车。', '我在练习走直线。一格、一格、又一格。', '你知道吗？这个镇子再往外，是一座晚上比白天还亮的大城市。'],
      },
      1.8,
      0.0,
    );
    w.villager(
      {
        name: '阿像',
        speed: 0.7,
        look: { hair: '#8b5a2b', shirt: '#b38ee8', pants: '#4a4a5a', hat: 'beanie', hatColor: '#ff9ec7' },
        lines: ['白栅栏旁边那棵矮矮的树底下，有人在吹萨克斯吗？金灿灿的。', '……嘀嘀嘀，存档中，请勿关机。', '收集冰箱贴？真浪漫啊。'],
      },
      -2.4,
      0.6,
    );
  },
};
