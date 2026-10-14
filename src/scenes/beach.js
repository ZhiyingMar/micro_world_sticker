// 海边假日 —— 最后一个世界：沙滩、透明的海水、椰子树、沙堡、救生塔、栈桥，海鸥和小螃蟹
import * as THREE from 'three';
import { at, rng } from '../kit.js';
import { glow } from '../fx.js';

const SHORE = 1.6; // x 大于这个值就是海
const WATER_Y = -0.08;

function ground(w) {
  const k = w.kit;
  const landW = SHORE + 5;
  w.add(k.box(landW, 0.3, 10, '#f6e3b0', 0.12), -5 + landW / 2, -0.15, 0);
  w.add(k.box(landW, 1.1, 10, '#e2c387', 0.12), -5 + landW / 2, -0.85, 0);
  // 沙子侧面的分层条纹
  for (const y of [-0.55, -0.95]) w.add(k.box(landW + 0.02, 0.05, 10.02, '#d4b06e', 0), -5 + landW / 2, y, 0);
  // 水下的缓坡和海床
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(1.4, -0.95);
  s.lineTo(0, -0.95);
  s.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 10, bevelEnabled: false });
  geo.translate(0, 0, -5);
  w.add(k.mesh(geo, '#f0d89c'), SHORE, 0, 0);
  const seaW = 5 - SHORE;
  w.add(k.box(seaW, 0.45, 10, '#e8cf92', 0.05), SHORE + seaW / 2, -1.18, 0);
  // 海水：半透明的水块，从侧面能看见水里的鱼
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(seaW, 0.9, 10),
    new THREE.MeshStandardMaterial({ color: '#3fc6e0', transparent: true, opacity: 0.45, roughness: 0.1, depthWrite: false }),
  );
  w.add(water, SHORE + seaW / 2, -0.52, 0);
  // 海面：会起伏的网格
  const surfGeo = new THREE.PlaneGeometry(seaW, 10, 16, 40);
  surfGeo.rotateX(-Math.PI / 2);
  const base = surfGeo.attributes.position.array.slice();
  const surf = new THREE.Mesh(
    surfGeo,
    new THREE.MeshStandardMaterial({ color: '#6fdcf0', transparent: true, opacity: 0.72, roughness: 0.08, metalness: 0.1, depthWrite: false }),
  );
  surf.receiveShadow = true;
  w.add(surf, SHORE + seaW / 2, WATER_Y, 0);
  // 浪花：沿着岸边一进一退
  const foam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 9.9), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
  w.add(foam, SHORE + 0.2, WATER_Y + 0.02, 0);
  w.onUpdate((dt, t) => {
    const a = surfGeo.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      const x = base[i];
      const z = base[i + 2];
      a[i + 1] = Math.sin(x * 2.2 + t * 1.6) * 0.03 + Math.cos(z * 1.3 + t * 1.1) * 0.025;
    }
    surfGeo.attributes.position.needsUpdate = true;
    surfGeo.computeVertexNormals();
    const k2 = (Math.sin(t * 0.9) + 1) / 2;
    foam.position.x = SHORE + 0.1 + k2 * 0.35;
    foam.material.opacity = 0.35 + (1 - k2) * 0.55;
  });
  // 海里不能走（栈桥除外）
  w.colliders.push({ type: 'box', minX: SHORE, maxX: 5, minZ: -5, maxZ: -2.85 });
  w.colliders.push({ type: 'box', minX: SHORE, maxX: 5, minZ: -2.15, maxZ: 5 });
  w.bounds.minX = -4.55;
  w.bounds.maxX = 4.7;
}

function palm(w, x, z, { h = 2.2, lean = 0.25, ry = 0 } = {}) {
  const k = w.kit;
  const g = new THREE.Group();
  const segs = 7;
  let px = 0;
  let py = 0;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const seg = k.cyl(0.11 - t * 0.03, 0.13 - t * 0.03, h / segs + 0.04, i % 2 ? '#a8784a' : '#bb8a58', 10);
    const dx = Math.sin(t * 1.4) * lean;
    seg.position.set(dx, py + h / segs / 2, 0);
    seg.rotation.z = -Math.cos(t * 1.4) * lean * 0.5;
    g.add(seg);
    px = dx;
    py += h / segs;
  }
  const top = new THREE.Group();
  top.position.set(px, py, 0);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = k.sphere(0.5, i % 2 ? '#4fae4a' : '#5fc256', 12);
    leaf.scale.set(1.5, 0.07, 0.32);
    leaf.position.set(Math.cos(a) * 0.6, -0.12, Math.sin(a) * 0.6);
    leaf.rotation.y = -a;
    leaf.rotation.z = -0.35;
    top.add(leaf);
  }
  for (let i = 0; i < 3; i++) top.add(at(k.sphere(0.09, '#6b4a2e', 10), Math.cos(i * 2.1) * 0.12, -0.12, Math.sin(i * 2.1) * 0.12));
  g.add(top);
  w.add(g, x, 0, z, ry);
  w.solidCircle(x, z, 0.2);
  w.onUpdate((dt, t) => {
    top.rotation.z = Math.sin(t * 0.9 + x) * 0.04;
  });
  return g;
}

function umbrella(w, x, z, colors) {
  const k = w.kit;
  const g = new THREE.Group();
  const pole = k.cyl(0.025, 0.025, 1.9, '#f4f1ea', 8);
  pole.position.y = 0.95;
  pole.rotation.z = 0.12;
  g.add(pole);
  const canopy = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.ConeGeometry(1.0, 0.38, 2, 1, true, (i / 8) * Math.PI * 2, Math.PI / 4);
    canopy.add(k.mesh(geo, k.m(colors[i % 2], { side: THREE.DoubleSide })));
  }
  canopy.position.set(-0.11, 1.9, 0);
  canopy.rotation.z = 0.12;
  g.add(canopy);
  w.add(g, x, 0, z);
  w.solidCircle(x, z, 0.08);
}

function towel(w, x, z, color, stripe, ry = 0) {
  const k = w.kit;
  const g = new THREE.Group();
  const t = k.box(0.75, 0.02, 1.4, color, 0.01);
  t.castShadow = false;
  g.add(at(t, 0, 0.01, 0));
  for (const zz of [-0.4, 0, 0.4]) {
    const s = k.box(0.76, 0.022, 0.1, stripe, 0);
    s.castShadow = false;
    g.add(at(s, 0, 0.012, zz));
  }
  w.add(g, x, 0, z, ry);
}

function deckChair(w, x, z, ry = 0) {
  const k = w.kit;
  const g = new THREE.Group();
  const seat = k.box(0.55, 0.04, 0.8, '#4fa3ff', 0.02);
  seat.position.set(0, 0.3, 0.1);
  g.add(seat);
  const back = k.box(0.55, 0.04, 0.6, '#4fa3ff', 0.02);
  back.position.set(0, 0.52, -0.42);
  back.rotation.x = -1.0;
  g.add(back);
  for (const sx of [-0.27, 0.27]) {
    g.add(at(k.box(0.03, 0.3, 0.03, '#f4f1ea', 0.01), sx, 0.15, 0.45));
    g.add(at(k.box(0.03, 0.3, 0.03, '#f4f1ea', 0.01), sx, 0.15, -0.2));
  }
  w.add(g, x, 0, z, ry);
  return g;
}

function sandcastle(w, x, z) {
  const k = w.kit;
  const sand = '#e8c98a';
  const g = new THREE.Group();
  g.add(at(k.box(1.0, 0.3, 1.0, sand, 0.06), 0, 0.15, 0));
  for (const [cx, cz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
    g.add(at(k.cyl(0.14, 0.16, 0.5, sand, 12), cx, 0.25, cz));
    g.add(at(k.cone(0.16, 0.22, '#dcb878', 12), cx, 0.61, cz));
  }
  g.add(at(k.cyl(0.25, 0.3, 0.55, sand, 16), 0, 0.57, 0));
  g.add(at(k.cone(0.28, 0.35, '#dcb878', 16), 0, 1.02, 0));
  g.add(at(k.cyl(0.01, 0.01, 0.35, '#8a6a4a', 6), 0, 1.3, 0));
  const flag = k.box(0.18, 0.1, 0.01, '#ff5f5f', 0.005);
  g.add(at(flag, 0.09, 1.42, 0));
  g.add(at(k.box(0.16, 0.2, 0.04, '#c9a46a', 0.03), 0, 0.12, 0.5));
  // 护城河里的小贝壳装饰
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const s = k.sphere(0.04, i % 2 ? '#ffc2d1' : '#ffffff', 8);
    s.scale.y = 0.5;
    g.add(at(s, Math.cos(a) * 0.75, 0.02, Math.sin(a) * 0.75));
  }
  w.add(g, x, 0, z, -0.3);
  w.solidCircle(x, z, 0.62);
  w.onUpdate((dt, t) => (flag.rotation.y = Math.sin(t * 4) * 0.3));
}

function lifeguardTower(w, x, z) {
  const k = w.kit;
  const wood = '#d8b07a';
  const g = new THREE.Group();
  for (const [lx, lz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
    g.add(at(k.cyl(0.05, 0.06, 1.3, wood, 8), lx, 0.65, lz));
    w.solidCircle(x + lx, z + lz, 0.07);
  }
  g.add(at(k.box(1.2, 0.08, 1.2, wood, 0.02), 0, 1.3, 0));
  // 栏杆
  for (const s of [-1, 1]) {
    g.add(at(k.box(1.2, 0.05, 0.05, '#ffffff', 0.01), 0, 1.6, s * 0.58));
    g.add(at(k.box(0.05, 0.05, 1.2, '#ffffff', 0.01), s * 0.58, 1.6, 0));
  }
  for (const [px, pz] of [[-0.58, -0.58], [0.58, -0.58], [-0.58, 0.58], [0.58, 0.58]]) g.add(at(k.box(0.05, 0.32, 0.05, '#ffffff', 0.01), px, 1.46, pz));
  // 小棚子：红白条纹顶
  g.add(at(k.box(0.06, 0.8, 0.06, '#ffffff', 0.01), -0.5, 1.75, -0.5));
  g.add(at(k.box(0.06, 0.8, 0.06, '#ffffff', 0.01), 0.5, 1.75, -0.5));
  for (let i = 0; i < 4; i++) g.add(at(k.box(0.33, 0.06, 1.3, i % 2 ? '#ffffff' : '#e8443a', 0.01), -0.48 + i * 0.32, 2.17, -0.05));
  // 梯子
  for (let i = 0; i < 5; i++) g.add(at(k.box(0.45, 0.04, 0.05, wood, 0.01), 0, 0.2 + i * 0.25, 0.75));
  for (const s of [-1, 1]) {
    const rail = k.box(0.04, 1.4, 0.04, wood, 0.01);
    rail.rotation.x = 0.25;
    g.add(at(rail, s * 0.22, 0.68, 0.72));
  }
  // 救生圈
  const ring = k.torus(0.16, 0.05, '#ff6b4f');
  ring.position.set(0, 1.55, 0.62);
  g.add(ring);
  w.add(g, x, 0, z);
}

function pier(w) {
  const k = w.kit;
  const g = new THREE.Group();
  const z0 = -2.5;
  for (let x = 1.35; x < 4.9; x += 0.3) {
    const plank = k.box(0.27, 0.06, 0.72, (Math.round(x * 10) % 2) ? '#c49461' : '#b5865a', 0.01);
    g.add(at(plank, x, 0.06, z0));
  }
  for (let x = 1.8; x < 4.9; x += 1.0) {
    for (const s of [-1, 1]) g.add(at(k.cyl(0.05, 0.05, 1.3, '#8a6a4a', 8), x, -0.55, z0 + s * 0.33));
  }
  for (const s of [-1, 1]) g.add(at(k.cyl(0.06, 0.06, 0.4, '#8a6a4a', 8), 4.75, 0.2, z0 + s * 0.33));
  w.add(g);
  // 小船：拴在栈桥尽头，随浪轻轻摇
  const boat = new THREE.Group();
  const hull = k.box(1.1, 0.24, 0.48, '#ffffff', 0.12);
  boat.add(at(hull, 0, 0.0, 0));
  boat.add(at(k.box(1.12, 0.06, 0.5, '#4fa3ff', 0.03), 0, 0.1, 0));
  boat.add(at(k.box(0.9, 0.04, 0.38, '#c49461', 0.01), 0, 0.1, 0));
  boat.add(at(k.box(0.06, 0.12, 0.4, '#c49461', 0.01), 0.1, 0.15, 0));
  const oar = k.box(0.9, 0.025, 0.05, '#a87a4a', 0.01);
  oar.rotation.y = 0.3;
  boat.add(at(oar, -0.05, 0.16, 0.05));
  w.add(boat, 4.1, WATER_Y + 0.04, -1.75);
  w.onUpdate((dt, t) => {
    boat.position.y = WATER_Y + 0.04 + Math.sin(t * 1.5) * 0.03;
    boat.rotation.z = Math.sin(t * 1.2) * 0.05;
    boat.rotation.x = Math.cos(t * 1.4) * 0.04;
  });
}

function iceCreamCart(w, x, z) {
  const k = w.kit;
  const g = new THREE.Group();
  g.add(at(k.box(1.1, 0.6, 0.6, '#ffc2d1', 0.06), 0, 0.5, 0));
  g.add(at(k.box(1.12, 0.1, 0.62, '#ffffff', 0.03), 0, 0.82, 0));
  for (const s of [-1, 1]) {
    const wh = k.cyl(0.17, 0.17, 0.06, '#5a5f78', 14);
    wh.rotation.x = Math.PI / 2;
    g.add(at(wh, s * 0.35, 0.17, 0.32));
  }
  g.add(at(k.cyl(0.02, 0.02, 1.0, '#f4f1ea', 8), 0, 1.3, 0));
  const cols = ['#ffd23f', '#ffffff'];
  for (let i = 0; i < 6; i++) {
    const geo = new THREE.ConeGeometry(0.75, 0.3, 2, 1, true, (i / 6) * Math.PI * 2, Math.PI / 3);
    g.add(at(k.mesh(geo, k.m(cols[i % 2], { side: THREE.DoubleSide })), 0, 1.85, 0));
  }
  // 展示的冰淇淋
  const flavors = ['#ff9ec7', '#9fe0b0', '#fff1c4'];
  flavors.forEach((c, i) => {
    g.add(at(k.cone(0.05, 0.14, '#e0a85a', 8), -0.25 + i * 0.25, 0.94, 0), at(k.sphere(0.06, c, 10), -0.25 + i * 0.25, 1.04, 0));
    g.children[g.children.length - 2].rotation.x = Math.PI;
  });
  w.add(g, x, 0, z, 0.4);
  w.solid(g.children[0], 0.05);
}

function seagulls(w) {
  const k = w.kit;
  const birds = [];
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Group();
    const wl = new THREE.Group();
    const wr = new THREE.Group();
    wl.add(at(k.box(0.3, 0.02, 0.1, '#ffffff', 0.01), -0.15, 0, 0));
    wr.add(at(k.box(0.3, 0.02, 0.1, '#ffffff', 0.01), 0.15, 0, 0));
    b.add(wl, wr, at(k.sphere(0.05, '#ffffff', 8), 0, 0, 0.02));
    b.traverse((o) => (o.castShadow = false));
    w.root.add(b);
    birds.push({ b, wl, wr, r: 2.5 + i * 1.2, h: 4.2 + i * 0.5, sp: 0.35 + i * 0.08, off: i * 2 });
  }
  w.onUpdate((dt, t) => {
    for (const s of birds) {
      const a = t * s.sp + s.off;
      s.b.position.set(1.5 + Math.cos(a) * s.r, s.h + Math.sin(t * 0.7 + s.off) * 0.2, Math.sin(a) * s.r);
      s.b.rotation.y = -a;
      const flap = Math.sin(t * 6 + s.off) * 0.5;
      s.wl.rotation.z = flap;
      s.wr.rotation.z = -flap;
    }
  });
}

function crabs(w) {
  const k = w.kit;
  for (let i = 0; i < 2; i++) {
    const c = new THREE.Group();
    const body = k.sphere(0.11, '#ff6b4f', 12);
    body.scale.set(1.3, 0.6, 1);
    c.add(at(body, 0, 0.08, 0));
    for (const s of [-1, 1]) {
      c.add(at(k.sphere(0.05, '#ff6b4f', 8), s * 0.17, 0.1, 0.06));
      c.add(at(k.cyl(0.01, 0.01, 0.07, '#e85540', 6), s * 0.04, 0.15, 0.05));
      c.add(at(k.sphere(0.02, '#2b211c', 6), s * 0.04, 0.19, 0.05));
    }
    const sx = -2 - i * 1.5;
    const sz = 0.5 + i * 1.2;
    w.add(c, sx, 0, sz);
    const st = { tx: sx, tz: sz, wait: 1 + i };
    w.onUpdate((dt, t) => {
      st.wait -= dt;
      const dx = st.tx - c.position.x;
      const dz = st.tz - c.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const step = Math.min(d, dt * 0.6);
        c.position.x += (dx / d) * step;
        c.position.z += (dz / d) * step;
        c.rotation.y = Math.atan2(dx, dz) + Math.PI / 2; // 螃蟹横着走
        c.position.y = Math.abs(Math.sin(t * 18)) * 0.02;
      } else if (st.wait <= 0) {
        for (let n = 0; n < 8; n++) {
          const nx = c.position.x + (Math.random() - 0.5) * 2.4;
          const nz = c.position.z + (Math.random() - 0.5) * 2.4;
          if (nx < SHORE - 0.3 && !w.blocked(nx, nz, 0.15)) {
            st.tx = nx;
            st.tz = nz;
            break;
          }
        }
        st.wait = 1.5 + Math.random() * 3;
      }
    });
  }
}

function fish(w) {
  const k = w.kit;
  const cols = ['#ffb84f', '#ff7aa2', '#7fd4ff', '#ffe680'];
  cols.forEach((col, i) => {
    const f = new THREE.Group();
    const body = k.sphere(0.12, col, 10);
    body.scale.set(1.5, 0.8, 0.5);
    f.add(body);
    const tail = k.cone(0.09, 0.14, col, 4);
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -0.22;
    f.add(tail);
    f.add(at(k.sphere(0.02, '#2b211c', 6), 0.1, 0.03, 0.05));
    w.root.add(f);
    const cx = 3.7;
    const cz = -0.5 + i * 0.9 - 1.3;
    const r = 0.6 + i * 0.1;
    const y = -0.6 + (i % 2) * 0.25;
    const sp = 0.6 + i * 0.12;
    w.onUpdate((dt, t) => {
      const a = t * sp + i * 1.7;
      f.position.set(cx + Math.cos(a) * r, y + Math.sin(t * 2 + i) * 0.04, cz + Math.sin(a) * r * 1.4);
      f.rotation.y = -a - Math.PI / 2;
      tail.rotation.y = Math.sin(t * 10 + i) * 0.4;
    });
  });
}

function skyStuff(w) {
  const k = w.kit;
  const sun = k.sphere(0.7, '#fff3b0', 20, { emissive: '#ffe066', emissiveIntensity: 1.2 });
  sun.castShadow = false;
  w.add(sun, -5.5, 7.5, -7);
  w.add(glow('#fff1a8', 5, 0.6), -5.5, 7.5, -7);
  const clouds = [];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Group();
    for (const [x, y, r] of [[0, 0, 0.45], [0.45, -0.05, 0.35], [-0.45, -0.08, 0.32], [0.15, 0.2, 0.35]]) c.add(at(k.sphere(r, '#ffffff', 14), x, y, 0));
    c.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    w.add(c, -6 + i * 5, 5.2 + i * 0.5, -3 + i * 2);
    clouds.push(c);
  }
  w.onUpdate((dt) => {
    for (const c of clouds) {
      c.position.x += dt * 0.2;
      if (c.position.x > 7) c.position.x = -7;
    }
  });
}

export default {
  id: 'beach',
  name: '海边假日',
  emoji: '🏖️',
  style: 'cozy',
  styleLabel: '夏日风 · 晴天',
  magnetStyle: 'beach',
  ambient: 'sea',
  bg: 'linear-gradient(180deg, #74cef5 0%, #b9e8ff 55%, #fff0c4 100%)',
  lights: {
    hemi: ['#fffaf0', '#f3dfa8', 1.8],
    sun: ['#fff4d6', 2.8, [6, 12, 5]],
  },
  camera: { pos: [11.5, 11, 14.5], target: [0, 0.6, 0], fitH: 2.6, maxPolar: 1.32, min: 2.5 },
  spawn: [-1.0, 0.5],
  // 第一次进来时，这个小人会主动打招呼
  greet: { name: '小贝', text: '你来啦！我的小水桶不见了……你能帮我找找吗？' },
  next: 'finale',
  items: [
    {
      id: 'starfish',
      name: '海星',
      icon: '⭐',
      hint: '海边的礁石上',
      make(k) {
        const g = new THREE.Group();
        const s = k.star(0.15, '#ff8a4f', 0.04, { emissive: '#ff8a4f', emissiveIntensity: 0.3 });
        s.rotation.x = -Math.PI / 2;
        g.add(s);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
          g.add(at(k.sphere(0.015, '#ffe0c2', 6), Math.cos(a) * 0.07, 0.03, -Math.sin(a) * 0.07));
        }
        return g;
      },
    },
    {
      id: 'bucket',
      name: '小水桶',
      icon: '🪣',
      hint: '沙堡的后面',
      make(k) {
        const g = new THREE.Group();
        g.add(at(k.cyl(0.11, 0.08, 0.17, '#4fa3ff', 14, { emissive: '#4fa3ff', emissiveIntensity: 0.2 }), 0, 0.085, 0));
        g.add(at(k.cyl(0.1, 0.1, 0.01, '#e8c98a', 14), 0, 0.165, 0));
        const handle = k.torus(0.1, 0.01, '#ffd23f');
        handle.scale.y = 0.8;
        g.add(at(handle, 0, 0.17, 0));
        const shovel = new THREE.Group();
        shovel.add(at(k.cyl(0.012, 0.012, 0.22, '#ff5f5f', 6), 0, 0.11, 0));
        shovel.add(at(k.box(0.07, 0.08, 0.015, '#ff5f5f', 0.01), 0, 0.25, 0));
        shovel.rotation.z = 0.5;
        g.add(at(shovel, 0.12, 0, 0.05));
        return g;
      },
    },
    {
      id: 'camera',
      name: '旧相机',
      icon: '📷',
      hint: '救生塔上',
      make(k) {
        const g = new THREE.Group();
        g.add(k.box(0.26, 0.17, 0.12, '#3a3428', 0.03));
        g.add(at(k.box(0.27, 0.07, 0.125, '#c8a46a', 0.01), 0, -0.03, 0));
        const lens = k.cyl(0.055, 0.06, 0.08, '#2b2b33', 14);
        lens.rotation.x = Math.PI / 2;
        g.add(at(lens, 0, 0, 0.09));
        const glass = k.cyl(0.04, 0.04, 0.01, '#8fd0ff', 14, { emissive: '#8fd0ff', emissiveIntensity: 0.6 });
        glass.rotation.x = Math.PI / 2;
        g.add(at(glass, 0, 0, 0.135));
        g.add(at(k.box(0.06, 0.04, 0.04, '#ffffff', 0.01, { emissive: '#ffffff', emissiveIntensity: 0.4 }), 0.08, 0.1, 0));
        g.add(at(k.cyl(0.02, 0.02, 0.03, '#ff5f5f', 8), -0.08, 0.1, 0));
        return g;
      },
    },
  ],
  build(w) {
    const k = w.kit;
    ground(w);
    skyStuff(w);

    palm(w, -4.2, -4.0, { h: 2.4, lean: 0.35 });
    palm(w, -1.6, -4.3, { h: 2.0, lean: 0.2, ry: 1.2 });
    palm(w, 1.0, -3.9, { h: 2.6, lean: 0.4, ry: -0.6 });
    palm(w, -4.3, 3.9, { h: 1.9, lean: 0.3, ry: 2.4 });

    umbrella(w, -2.6, 0.7, ['#e8443a', '#ffffff']);
    towel(w, -2.2, 1.0, '#ff9ec7', '#ffffff', 0.15);
    umbrella(w, -0.5, 3.4, ['#4fa3ff', '#ffd23f']);
    towel(w, -0.2, 3.3, '#ffd23f', '#4fa3ff', -0.2);
    deckChair(w, -1.25, 3.5, 0.3);
    w.poi(-2.2, 1.0, { emote: '😎', face: 0.3, dur: 9, sit: true, seatY: 0.12 });
    w.poi(-1.25, 3.55, { emote: '💤', face: 0.3, dur: 9, sit: true, seatY: 0.34 });

    sandcastle(w, -2.0, 3.4);
    w.poi(-1.2, 2.6, { emote: '🏰', face: -2.2, dur: 7 });

    lifeguardTower(w, 0.55, -0.9);
    w.poi(0.55, 0.2, { emote: '👀', face: Math.PI / 2, dur: 6 });

    pier(w);
    w.poi(4.4, -2.5, { emote: '🎣', face: Math.PI / 2, dur: 9 });

    iceCreamCart(w, -3.9, -1.6);
    w.poi(-3.0, -0.6, { emote: '🍦', face: -2.3, dur: 6 });

    // 冲浪板
    for (const [x, z, c, r] of [[-2.9, -4.4, '#ff7aa2', -0.15], [-2.5, -4.45, '#4fc3d9', 0.1]]) {
      const b = k.sphere(0.6, c, 16);
      b.scale.set(0.28, 1, 0.06);
      b.rotation.z = r;
      w.add(b, x, 0.45, z);
    }
    w.colliders.push({ type: 'box', minX: -3.15, maxX: -2.25, minZ: -4.6, maxZ: -4.3 });

    // 礁石和潮池
    const rk = rng(8);
    for (const [x, z, r] of [[1.85, 2.6, 0.3], [2.2, 2.2, 0.22], [2.25, 2.95, 0.18], [1.4, 3.1, 0.15]]) {
      const s = k.sphere(r, rk() > 0.5 ? '#9a9da6' : '#868a94', 12);
      s.scale.y = 0.6;
      w.add(s, x, 0.02, z);
    }
    w.poi(1.15, 2.6, { emote: '🦀', face: Math.PI / 2, dur: 6 });

    // 散落的贝壳
    for (let i = 0; i < 12; i++) {
      const x = -4.3 + rk() * 5.4;
      const z = -4 + rk() * 8.5;
      if (w.blocked(x, z, 0.1)) continue;
      const s = k.sphere(0.035, ['#ffffff', '#ffc2d1', '#ffe0c2'][i % 3], 8);
      s.scale.y = 0.45;
      s.castShadow = false;
      w.add(s, x, 0.01, z);
    }

    seagulls(w);
    crabs(w);
    fish(w);

    w.placeItem('starfish', 1.95, 0.24, 2.6, { spin: false });
    w.placeItem('bucket', -2.7, 0.02, 2.75, { spin: false });
    w.placeItem('camera', 0.55, 1.45, -0.95);

    w.villager(
      {
        name: '阿浪',
        look: { hair: '#2b2b33', shirt: '#4fc3d9', pants: '#ffb84f', hat: 'cap', hatColor: '#ff7a3a' },
        lines: ['浪来啦！……啊，又被拍回岸上了。', '救生塔上好像放着一台旧相机，它拍出来的照片会是什么样呢？', '这是最后一块冰箱贴的世界了，玩得开心吗？'],
      },
      -0.6,
      1.4,
    );
    w.villager(
      {
        name: '小贝',
        look: { hair: '#c48a54', shirt: '#ff8fb1', pants: '#ffe680', hat: 'bow', hatColor: '#ffd23f' },
        lines: ['我在堆沙堡！我的小水桶好像落在沙堡后面了……你能帮我找找吗？', '海水是咸的！我偷偷尝过。', '听说集齐所有冰箱贴，大家会一起拍一张全家福！'],
      },
      -1.6,
      2.3,
    );
    w.villager(
      {
        name: '老船长',
        speed: 0.6,
        look: { hair: '#e8e4dc', shirt: '#2e5a8a', pants: '#f4f1ea', hat: 'cap', hatColor: '#ffffff' },
        lines: ['我年轻的时候，去过好多好多冰箱贴世界。', '岸边的礁石上趴着一只海星，涨潮前快去看看吧。', '这片海的那一头？……那一头，就是你家的冰箱门啦。'],
      },
      -3.0,
      -0.6,
    );
  },
};
