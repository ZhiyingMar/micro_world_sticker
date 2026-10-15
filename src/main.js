import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { World } from './world.js';
import { SCENES, HOME } from './scenes/index.js';
import { state, save, foundIn, resetSave } from './state.js';
import { ui } from './ui.js';
import { sfx } from './audio.js';
import { blobShadowTexture } from './fx.js';

const canvas = document.getElementById('c');
// stencil：人被挡住时画剪影要用
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, stencil: true });
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
// 2.5D：视野窄、镜头拉远，透视变形小，像在看一个小立体模型。不画实时阴影，人和物品脚下贴一块圆影
const FOV = 20;
// 镜头距离都是按原来 32° 视野调的，换了视野按这个比例拉远，画面里东西的大小不变
const ZOOM = Math.tan(THREE.MathUtils.degToRad(16)) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.5, 250);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.zoomToCursor = true;
controls.maxDistance = 26 * ZOOM;
controls.rotateSpeed = 0.7;

// 灯光
const hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2.5);
scene.add(sun, sun.target);

// 方块世界下面的影子
const blob = new THREE.Mesh(
  new THREE.PlaneGeometry(17, 17),
  new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }),
);
blob.rotation.x = -Math.PI / 2;
blob.position.y = -2.6;
scene.add(blob);

// ---------------- 状态 ----------------
let world = null;
let player = null;
let talking = null;
let busy = false; // 合成动画/切换场景时锁定操作
let intro = null; // 方块落下动画
let focus = null; // 相机平滑移动
let overview = null; // 拉远看整个方块时的镜头 { pos, target }（原来的“上帝视角”）
let hold = false; // 镜头暂时不跟着人走（往电话亭里看的时候），人一动就恢复
let game = null; // 正在玩的小游戏：{ g, pos, target }
let greeting = null; // 小人正在主动打招呼：{ v, t }
const anims = [];
const input = { up: false, down: false, left: false, right: false, ax: 0, az: 0 };
// 触控设备：一开始按设备能力判断，之后只要碰到触摸就切到触控界面
let touchMode = matchMedia('(pointer: coarse)').matches;
// 镜头跟着人：离人这么远时完全围着人转，拉远到全貌时慢慢过渡成围着整个方块转
// 竖屏画面窄，同样距离看到的东西少很多，拉远一点
const followDist = () => 11.5 * ZOOM * THREE.MathUtils.clamp(0.85 / camera.aspect, 1, 1.7);

// ---------------- 渲染尺寸 ----------------
function applySize() {
  const pixel = world && world.def.style === 'pixel';
  // 平板屏幕分辨率很高，触控设备上限制一下渲染倍率，保证流畅
  const pr = pixel ? Math.min(0.6, 600 / innerWidth) : Math.min(devicePixelRatio, touchMode ? 1.5 : 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
  canvas.classList.toggle('pixelated', pixel);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', () => {
  applySize();
  // 横竖屏切换：全貌按新的屏幕重新取景
  if (world) overview = defaultView(world.def);
});

// ---------------- 场景加载 ----------------
// 界面元素在四边占掉的空间（NDC 坐标）。横跨屏幕中间的挡上下，竖跨中间的挡左右，角落里的小按钮不管
function safeArea() {
  const W = innerWidth;
  const H = innerHeight;
  const pad = { top: 10, bottom: 10, left: 10, right: 10 };
  for (const sel of ['#title-card', '#top-buttons', '#goal']) {
    const r = document.querySelector(sel).getBoundingClientRect();
    if (!r.width) continue;
    const hc = r.right > W * 0.28 && r.left < W * 0.72;
    const vc = r.bottom > H * 0.3 && r.top < H * 0.7;
    if (hc && !vc) {
      if (r.top + r.bottom < H) pad.top = Math.max(pad.top, r.bottom + 6);
      else pad.bottom = Math.max(pad.bottom, H - r.top + 6);
    } else if (vc && !hc) {
      if (r.left + r.right < W) pad.left = Math.max(pad.left, r.right + 6);
      else pad.right = Math.max(pad.right, W - r.left + 6);
    }
  }
  return { x0: -1 + (2 * pad.left) / W, x1: 1 - (2 * pad.right) / W, y0: -1 + (2 * pad.bottom) / H, y1: 1 - (2 * pad.top) / H };
}

const _fitCam = new THREE.PerspectiveCamera();
// 开场全貌：让方块的地面（和后排的高处）刚好填满界面之间的空白
function defaultView(def) {
  const c = def.camera;
  const target = new THREE.Vector3(...c.target);
  const off = new THREE.Vector3(...c.pos).sub(target);
  const aspect = innerWidth / innerHeight;
  // 竖屏时把镜头转得更正一些：斜着看方块最宽，正一点同样宽度能放得更大
  const sph = new THREE.Spherical().setFromVector3(off);
  if (aspect < 0.85) {
    let az = sph.theta * 0.35;
    if (c.minAz !== undefined) az = Math.max(az, c.minAz + 0.05);
    if (c.maxAz !== undefined) az = Math.min(az, c.maxAz - 0.05);
    sph.theta = az;
  }
  const dir = new THREE.Vector3().setFromSpherical(sph).normalize();

  const H = c.fitH ?? 2.5;
  const pts = [];
  for (const x of [-5, 5]) for (const z of [-5, 5]) pts.push(new THREE.Vector3(x, 0, z));
  for (const x of [-5, 5]) pts.push(new THREE.Vector3(x, H, -5));
  const safe = safeArea();
  _fitCam.fov = camera.fov;
  _fitCam.aspect = aspect;
  _fitCam.updateProjectionMatrix();
  const bbox = (d, t) => {
    _fitCam.position.copy(t).addScaledVector(dir, d);
    _fitCam.lookAt(t);
    _fitCam.updateMatrixWorld();
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const p of pts) {
      const v = p.clone().project(_fitCam);
      b.x0 = Math.min(b.x0, v.x);
      b.x1 = Math.max(b.x1, v.x);
      b.y0 = Math.min(b.y0, v.y);
      b.y1 = Math.max(b.y1, v.y);
    }
    return b;
  };
  // 二分找“刚好装得下”的距离，再把画面中心对准空白区域的中心
  let lo = 3;
  let hi = 150;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    const b = bbox(mid, target);
    if (b.x1 - b.x0 <= safe.x1 - safe.x0 && b.y1 - b.y0 <= safe.y1 - safe.y0) hi = mid;
    else lo = mid;
  }
  const d = hi * 1.03;
  for (let i = 0; i < 2; i++) {
    const b = bbox(d, target);
    const halfH = d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const right = new THREE.Vector3().setFromMatrixColumn(_fitCam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(_fitCam.matrixWorld, 1);
    target.addScaledVector(right, ((b.x0 + b.x1) / 2 - (safe.x0 + safe.x1) / 2) * halfH * aspect);
    target.addScaledVector(up, ((b.y0 + b.y1) / 2 - (safe.y0 + safe.y1) / 2) * halfH);
  }
  const pos = target.clone().addScaledVector(dir, d);
  controls.maxDistance = Math.max(26 * ZOOM, d * 1.3);
  return { pos, target };
}

function loadScene(id) {
  const def = SCENES[id];
  endGreeting();
  if (world) world.dispose();
  if (player) player = null;
  talking = null;
  ui.closeDialog();
  world = new World(def, { hemi, sun, toast: (t) => ui.toast(t), onChange: () => refreshGoal(), startGame: (id) => startGame(id) });
  scene.add(world.root);

  const [sky, gnd, hi] = def.lights.hemi;
  hemi.color.set(sky);
  hemi.groundColor.set(gnd);
  hemi.intensity = hi;
  const [sc, si, sp] = def.lights.sun;
  sun.color.set(sc);
  sun.intensity = si;
  sun.position.set(...sp);

  world.whenRestored(() => {
    refreshGoal();
    setTimeout(() => {
      sfx.fanfare();
      ui.toast(`🎉 「${def.name}」恢复原样了！`);
    }, 1600);
  });
  // 先把界面画出来，取景时要量收集栏等占了多少地方
  ui.setScene(def);
  syncHomeButton();
  refreshGoal();
  sfx.ambient(def.ambient || null);
  applySize();

  const c = def.camera;
  controls.minDistance = (c.min || 2.5) * ZOOM;
  controls.maxPolarAngle = c.maxPolar || 1.3;
  controls.minAzimuthAngle = c.minAz ?? -Infinity;
  controls.maxAzimuthAngle = c.maxAz ?? Infinity;
  overview = defaultView(def);
  focus = null;
  hold = false;

  state.current = id;
  if (state.newMagnet === id) state.newMagnet = null;
  save();

  spawnPlayer();
  // 一进来镜头就在人身边，斜着看一点，像在看一个小立体模型
  const az = THREE.MathUtils.clamp(0.35, controls.minAzimuthAngle, controls.maxAzimuthAngle);
  controls.target.set(player.x, 0.5, player.z);
  camera.position.setFromSphericalCoords(followDist(), 0.82, az).add(controls.target);
  controls.update();
  intro = { t: 0 };
  world.root.scale.setScalar(0.001);
}

function travel(id) {
  if (busy) return;
  busy = true;
  sfx.whoosh();
  ui.fade(() => loadScene(id)).then(() => {
    busy = false;
    ui.toast(id === HOME ? '🏠 回到家啦' : `${SCENES[id].emoji} 欢迎来到「${SCENES[id].name}」`);
  });
}

// ---------------- 玩家 ----------------
function spawnPlayer() {
  const [sx, sz] = world.def.spawn;
  player = world.villager(
    {
      name: '你',
      controlled: true,
      speed: 2.3,
      look: world.kit.pixel
        ? { hair: '#5a3d2b', shirt: '#4fb0c6', pants: '#3d5bd6', hat: 'cap', hatColor: '#7cc576' }
        : { hair: '#5a3d2b', shirt: '#7cc576', pants: '#5b6b9a', hat: 'leaf' },
    },
    sx,
    sz,
  );
  player.heading = Math.PI;
  player.root.rotation.y = Math.PI;
  world.player = player;
  addSilhouette(player.root);
}

// 人被房子、树挡住时，挡住的那部分画成半透明的剪影（镜头能随便转，经常会转到建筑后面）
// 原理：人身上看得见的像素先在模板缓冲里记一下；剪影只画在“没记过、而且有东西挡在前面”的地方，
// 这样手臂被自己身体挡住这种情况不会冒出剪影
const silhouetteMat = new THREE.MeshBasicMaterial({
  color: '#ffd27a',
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
  depthFunc: THREE.GreaterDepth,
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.NotEqualStencilFunc,
});
function addSilhouette(root) {
  const meshes = [];
  root.traverse((o) => o.isMesh && !o.userData.contactShadow && meshes.push(o));
  for (const m of meshes) {
    // 人身上的材质单独复制一份（材质是按颜色共用的，别影响到别的东西）
    m.material = m.material.clone();
    Object.assign(m.material, {
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
    });
    const s = new THREE.Mesh(m.geometry, silhouetteMat);
    s.renderOrder = 20;
    m.add(s);
  }
}

// 手机竖屏时提示一次：横过来画面更大
function maybeRotateHint() {
  if (state.rotateHinted || !touchMode || innerHeight < innerWidth * 1.2) return;
  setTimeout(() => ui.toast('📱 把手机横过来玩，画面更大哦'), 1200);
  state.rotateHinted = true;
  save();
}

// ---------------- 相机 ----------------
// 电话亭、空心木头这类“里面藏着东西”的物体：点它时镜头凑到开口处往里看
function peekAt(obj) {
  let o = obj;
  while (o && !o.userData.peek) o = o.parent;
  if (!o) return false;
  const { target, from } = o.userData.peek;
  const t = world.root.localToWorld(new THREE.Vector3(...target));
  const p = world.root.localToWorld(new THREE.Vector3(...target).add(new THREE.Vector3(...from).multiplyScalar(ZOOM)));
  // 已经在这个角度附近了，就当普通点击处理（继续放大）
  if (camera.position.distanceTo(p) < 0.6) return false;
  focus = { t: 0, dur: 0.8, fromT: controls.target.clone(), toT: t, fromP: camera.position.clone(), toP: p };
  hold = true; // 看完之前镜头先别跟着人走
  return true;
}

// 拉远看整个小世界（原来的“上帝视角”）。拉得够远时镜头会自动围着方块中心转
function resetView() {
  hold = false;
  focus = { t: 0, dur: 0.9, fromT: controls.target.clone(), toT: overview.target, fromP: camera.position.clone(), toP: overview.pos };
}
document.getElementById('btn-reset').addEventListener('click', () => {
  sfx.click();
  resetView();
});

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const easeOutBack = (k) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;

function updateCamera(dt) {
  if (game) {
    camera.position.lerp(game.pos, 1 - Math.exp(-dt * 4));
    game.look.lerp(game.target, 1 - Math.exp(-dt * 4));
    camera.lookAt(game.look);
    return;
  }
  if (focus) {
    focus.t += dt;
    const k = ease(Math.min(1, focus.t / focus.dur));
    controls.target.lerpVectors(focus.fromT, focus.toT, k);
    camera.position.lerpVectors(focus.fromP, focus.toP, k);
    if (k >= 1) focus = null;
  } else if (player && !hold) {
    // 镜头中心跟着人走（旋转、缩放交给 OrbitControls）；拉得越远越偏向整个方块的中心
    const d = camera.position.distanceTo(controls.target);
    const far = overview.pos.distanceTo(overview.target);
    const k = THREE.MathUtils.smoothstep(d, followDist() + 1, Math.max(far * 0.9, followDist() + 2));
    _want.set(player.x, 0.5, player.z).lerp(overview.target, k);
    _delta.copy(_want).sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 6));
    controls.target.add(_delta);
    camera.position.add(_delta);
  }
  controls.update();
}
const _want = new THREE.Vector3();
const _delta = new THREE.Vector3();

// ---------------- 拾取 / 点击 ----------------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

// 点击判定时要跳过的东西：雨丝、粒子、光晕、看不见的物体、半透明玻璃
function blocksPick(o) {
  if (o.isSprite || o.isPoints || o.isLine || o.userData.contactShadow) return false;
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  if (o.userData.pickable) return true; // 物品的隐形点击范围
  const m = o.material;
  if (m && !Array.isArray(m) && m.transparent && m.opacity < 0.95) return false;
  return true;
}

function pick(clientX, clientY) {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(world.root, true);
  for (const h of hits) {
    if (!blocksPick(h.object)) continue;
    let o = h.object;
    while (o && o !== world.root) {
      if (o.userData.itemId) return { type: 'item', id: o.userData.itemId, obj: o, point: h.point };
      if (o.userData.repair) return { type: 'repair', id: o.userData.repair, obj: o, point: h.point };
      if (o.userData.interact) return { type: 'interact', id: o.userData.interact, obj: o, point: h.point };
      // 小游戏还没开放时，就当普通的东西
      if (o.userData.game) {
        const g = world.games.get(o.userData.game);
        if (!g.can || g.can()) return { type: 'game', id: g.id, obj: o, point: h.point };
      }
      if (o.userData.villager) {
        if (o.userData.villager === player) break;
        return { type: 'villager', v: o.userData.villager, point: h.point };
      }
      if (o.userData.action) return { type: 'action', action: o.userData.action, point: h.point };
      o = o.parent;
    }
    return { type: 'ground', point: h.point, obj: h.object };
  }
  return null;
}

const _v = new THREE.Vector3();
function pickNear(cx, cy, radius) {
  const cands = [];
  for (const [id, g] of world.items) cands.push({ type: 'item', id, obj: g, pos: g.getWorldPosition(new THREE.Vector3()) });
  for (const r of world.repairs.values()) {
    if (!r.done && r.seen) cands.push({ type: 'repair', id: r.id, obj: r.spot, pos: r.spot.getWorldPosition(new THREE.Vector3()) });
  }
  for (const v of world.villagers) {
    const pos = v.root.getWorldPosition(new THREE.Vector3());
    pos.y += 0.55;
    cands.push({ type: 'villager', v, pos });
  }
  let best = null;
  let bd = radius;
  for (const c of cands) {
    _v.copy(c.pos).project(camera);
    if (_v.z > 1) continue;
    const sx = ((_v.x + 1) / 2) * innerWidth;
    const sy = ((1 - _v.y) / 2) * innerHeight;
    // 找东西是主线：附近有物品时优先选物品（小人的判定距离按 2.5 倍算）
    const d = Math.hypot(sx - cx, sy - cy) * (c.type === 'villager' ? 2.5 : 1);
    if (d >= bd) continue;
    // 被墙或家具挡住的不算
    const dir = c.pos.clone().sub(camera.position);
    const dist = dir.length();
    raycaster.set(camera.position, dir.normalize());
    const first = raycaster.intersectObject(world.root, true).find((h) => blocksPick(h.object));
    if (first && first.distance < dist - 0.45) {
      let o = first.object;
      let mine = false;
      while (o) {
        if (o === c.obj || (c.v && o === c.v.root)) mine = true;
        o = o.parent;
      }
      if (!mine) continue;
    }
    bd = d;
    best = c;
  }
  if (!best) return null;
  return { ...best, point: best.pos };
}

function localPoint(p) {
  return world.root.worldToLocal(p.clone());
}

function distToPlayer(x, z) {
  return Math.hypot(player.x - x, player.z - z);
}

function handleClick(cx, cy, touch = false) {
  if (busy || ui.fridgeOpen || game) return;
  endGreeting();
  if (ui.dialogOpen) {
    endTalk();
    return;
  }
  let hit = pick(cx, cy);
  // 手指比鼠标粗：没点中东西时，看看附近有没有物品或小人
  if (touch && (!hit || hit.type === 'ground')) hit = pickNear(cx, cy, 34) || hit;
  if (!hit) return;
  if (hit.type === 'game') {
    startGame(hit.id);
    return;
  }
  // 点哪里走到哪里，够近了就互动
  const lp = localPoint(hit.point);
  if (hit.type === 'item') {
    const g = hit.obj;
    if (distToPlayer(g.position.x, g.position.z) < 1.6) collect(hit.id);
    else player.goTo(g.position.x, g.position.z);
  } else if (hit.type === 'repair') {
    const r = world.repairs.get(hit.id);
    if (distToPlayer(r.x, r.z) < r.reach) doRepair(hit.id);
    else player.goTo(r.x, r.z);
  } else if (hit.type === 'interact') {
    const it = world.interacts.get(hit.id);
    if (distToPlayer(it.x, it.z) < it.reach) it.fn();
    else player.goTo(it.x, it.z);
  } else if (hit.type === 'villager') {
    if (distToPlayer(hit.v.x, hit.v.z) < 1.8) talkTo(hit.v);
    else player.goTo(hit.v.x, hit.v.z);
  } else if (hit.type === 'action' && hit.action === 'fridge') {
    const f = world.fridge.position;
    if (distToPlayer(f.x, f.z) < 2.0) openFridge();
    else player.goTo(f.x, f.z + 0.9);
  } else if (peekAt(hit.obj)) {
    sfx.click();
  } else {
    player.goTo(lp.x, lp.z);
    world.fx.emit(lp.setY(0.1), { count: 3, spread: 0.1, size: 0.18, rise: 0.4, color: '#ffffff' });
  }
}

let down = null;
const activePointers = new Set();
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (e.pointerType === 'touch') setTouchMode(true);
  else if (e.pointerType === 'mouse') setTouchMode(false);
  activePointers.add(e.pointerId);
  if (activePointers.size > 1) {
    // 双指缩放/平移：这次手势不算点击
    if (down) down.multi = true;
    return;
  }
  down = { x: e.clientX, y: e.clientY, t: performance.now(), touch: e.pointerType !== 'mouse', multi: false };
});
const pointerEnd = (e) => {
  activePointers.delete(e.pointerId);
  if (!down || e.type === 'pointercancel') {
    if (!activePointers.size) down = null;
    return;
  }
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const slop = down.touch ? 12 : 7;
  if (!down.multi && moved < slop && performance.now() - down.t < 500) handleClick(e.clientX, e.clientY, down.touch);
  if (!activePointers.size) down = null;
};
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// 悬停提示
let hoverPos = null;
let hovered = null;
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') hoverPos = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerleave', () => {
  hoverPos = null;
  ui.tooltip(null);
});

function updateHover() {
  if (hovered && hovered.type === 'item') hovered.obj.userData.hover = 0;
  hovered = null;
  if (!hoverPos || busy || ui.fridgeOpen || down || game) {
    ui.tooltip(null);
    return;
  }
  const hit = pick(hoverPos.x, hoverPos.y);
  hovered = hit;
  let tip = null;
  if (hit?.type === 'item') {
    hit.obj.userData.hover = 1;
    tip = hit.obj.userData.thing ? `✨ ${hit.obj.userData.thing.icon} ${hit.obj.userData.thing.name}` : '✨ 发现了什么！';
  } else if (hit?.type === 'repair') {
    const p = partOf(world.def, hit.id);
    tip = `✨ 这里少了 ${p.icon} ${p.name} · 点击放回`;
  } else if (hit?.type === 'interact') {
    const it = world.interacts.get(hit.id);
    tip = `${it.icon} ${typeof it.label === 'function' ? it.label() : it.label}`;
  } else if (hit?.type === 'game') tip = `🎮 ${world.games.get(hit.id).hover}`;
  else if (hit?.type === 'villager') tip = `💬 ${hit.v.name}`;
  else if (hit?.type === 'action') tip = '🧊 冰箱 · 点击打开';
  canvas.style.cursor = tip ? 'pointer' : '';
  ui.tooltip(tip, hoverPos.x, hoverPos.y);
}

// ---------------- 对话 ----------------
function talkTo(v) {
  endGreeting();
  if (talking && talking !== v) talking.endTalk();
  talking = v;
  const from = player.root.position;
  v.startTalk(from.x, from.z);
  if (player) {
    player.moveTarget = null;
    player.face(v.x, v.z);
  }
  // 有些小人会先看看你带了什么（比如等咖啡的司机）
  ui.say(v.name, v.onTalk?.() ?? v.nextLine());
}

// 第一次进入一个世界（或世界有了大变化）时，有个小人主动打招呼
function maybeGreet() {
  const g0 = world.def.greet;
  if (!g0 || busy || game || ui.fridgeOpen) return;
  const g = typeof g0 === 'function' ? g0(world) : g0;
  const key = g.key || world.def.id;
  if (!state.greeted) state.greeted = {};
  if (state.greeted[key]) return;
  const v = world.villagers.find((x) => x.name === g.name);
  if (!v) return;
  state.greeted[key] = true;
  save();
  const from = player.root.position;
  v.startTalk(from.x, from.z);
  v.hideBubble();
  greeting = { v, t: 0 };
  ui.speech(g.name, g.text);
}

// 一动（点屏幕、按键、走路）就收起来，不挡操作
function endGreeting() {
  if (!greeting) return;
  greeting.v.endTalk();
  greeting = null;
  ui.speech(null);
}

const _head = new THREE.Vector3();
function updateGreeting(dt) {
  if (!greeting) return;
  greeting.t += dt;
  const moving = player && (player.moving || player.moveTarget);
  if (greeting.t > 8 || (moving && greeting.t > 0.5)) {
    endGreeting();
    return;
  }
  greeting.v.root.localToWorld(_head.set(0, 1.55, 0)).project(camera);
  ui.speechAt(((_head.x + 1) / 2) * innerWidth, ((1 - _head.y) / 2) * innerHeight);
}

function endTalk() {
  endGreeting();
  if (talking) talking.endTalk();
  talking = null;
  ui.closeDialog();
}
document.getElementById('dialog').addEventListener('click', () => {
  sfx.click();
  endTalk();
});

// ---------------- 小游戏 ----------------
function startGame(id) {
  if (busy || game) return;
  const g = world.games.get(id);
  endTalk();
  focus = null;
  player.moveTarget = null;
  player.root.visible = false; // 别挡在楼前面
  controls.enabled = false;
  document.body.classList.add('in-game');
  ui.showGame(g, (k) => (k === 'exit' ? stopGame() : g.key(k)));
  // 镜头飞到正对着它的地方，稍微往下看一点。
  // 上面的栏、下面的十字键挡在大楼前面时，把大楼放进它们之间的空白里
  const target = world.root.localToWorld(new THREE.Vector3(...g.view.target));
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const H = innerHeight;
  const covers = (r) => r.width && r.left < innerWidth * 0.62 && r.right > innerWidth * 0.38;
  const br = document.getElementById('game-bar').getBoundingClientRect();
  const pr = document.getElementById('game-pad').getBoundingClientRect();
  const top = covers(br) ? br.bottom + 8 : 8;
  const bottom = covers(pr) ? H - pr.top + 8 : 8;
  const usable = Math.max(H * 0.4, H - top - bottom);
  const d = Math.max((g.view.halfH * H) / (tan * usable * 0.92), (g.view.halfW / (tan * camera.aspect)) * 1.1);
  const lift = ((H / 2 - (top + usable / 2)) * 2 * d * tan) / H; // 空白区域的中心比屏幕中心高多少
  target.y -= lift;
  const pos = target.clone().add(new THREE.Vector3(0, 0.3, 0.95).normalize().multiplyScalar(d));
  game = { g, target, pos, look: controls.target.clone(), back: { target: controls.target.clone(), pos: camera.position.clone() } };
  sfx.whoosh();
  g.start({
    status: (text) => ui.gameStatus(text),
    // 通关后过一会儿自动回到城市，看大家欢呼
    exitSoon: (ms) => setTimeout(() => game?.g === g && stopGame(), ms),
  });
}

function stopGame() {
  if (!game) return;
  game.g.stop();
  // 镜头飞回进游戏之前的位置，接着跟着人
  const { back } = game;
  focus = { t: 0, dur: 0.9, fromT: game.look.clone(), toT: back.target, fromP: camera.position.clone(), toP: back.pos };
  controls.target.copy(game.look);
  game = null;
  player.root.visible = true;
  document.body.classList.remove('in-game');
  ui.hideGame();
  controls.enabled = true;
}

// ---------------- 收集 ----------------
function popAway(g) {
  const y0 = g.position.y;
  if (g.userData.shadow) g.userData.shadow.visible = false; // 飞起来时影子留在原地不好看，直接收掉
  const s0 = g.scale.x;
  anims.push({
    t: 0,
    dur: 0.8,
    step(k) {
      g.position.y = y0 + Math.sin(k * Math.PI * 0.5) * 0.8;
      g.rotation.y += 0.25;
      g.scale.setScalar(s0 * (k < 0.6 ? 1 + k * 1.2 : (1 - k) * 4.3));
    },
    done() {
      g.removeFromParent();
    },
  });
}

function collect(id) {
  const g = world.items.get(id);
  if (!g || busy) return;
  world.items.delete(id);
  // 小道具：放进背包
  const thing = g.userData.thing;
  if (thing) {
    world.setFlag(id);
    sfx.pickup();
    world.fx.emit(g.position, { count: 12, spread: 0.3, size: 0.3, rise: 1.2, color: '#fff3a0' });
    popAway(g);
    ui.toast(`拿到了 ${thing.icon} ${thing.name}`);
    refreshGoal();
    return;
  }
  const def = world.def;
  const it = def.items.find((i) => i.id === id);
  const found = foundIn(def.id);
  if (!found.includes(id)) found.push(id);
  save();
  const valid = found.filter((f) => def.items.some((i) => i.id === f));

  sfx.pickup();
  world.fx.emit(g.position, { count: 16, spread: 0.3, size: 0.35, rise: 1.4, color: '#fff3a0' });
  popAway(g);
  ui.markFound(id);
  ui.toast(`找到了 ${it.icon} ${it.name}！`);

  if (valid.length >= def.items.length) {
    busy = true;
    setTimeout(() => runCombine(def), 1300);
  }
}

// ---------------- 修复 ----------------
// 修复点用的是上一个世界带来的东西
function partOf(def, id) {
  return SCENES[def.repairs.find((r) => r.id === id).from].items.find((i) => i.id === id);
}

function refreshGoal() {
  const broken = world.repairs.size > 0 && !world.fullyRepaired;
  ui.renderGoal(world.def, { broken, bag: world.bag() });
}

function doRepair(id) {
  if (busy) return;
  const def = world.def;
  const r = world.repairs.get(id);
  if (!r || r.done) return;
  // 还差一步：由旁边的人告诉你缺什么
  const ok = r.can ? r.can() : true;
  if (ok !== true) {
    sfx.pop();
    if (ok.name) ui.say(ok.name, ok.text);
    else ui.toast(ok.text);
    return;
  }
  const pos = r.spot.position.clone();
  if (!world.repair(id)) return;
  const p = partOf(def, id);
  sfx.repair();
  world.fx.emit(pos.setY(pos.y + 0.2), { count: 24, spread: 0.6, size: 0.4, rise: 1.6, color: '#fff3a0' });
  refreshGoal();
  ui.toast(`${p.icon} 放回了${p.name}！${def.repairs.find((x) => x.id === id).msg || ''}`);
}

// 走近、或者把镜头拉近到缺东西的地方，就会发现它
function checkDiscover() {
  for (const r of world.repairs.values()) {
    if (r.seen || r.done) continue;
    // 人走到附近，或者镜头凑近看（比如转过去看杆子顶上）
    let near = distToPlayer(r.x, r.z) < r.seeR;
    if (!near && !focus) {
      const sp = r.spot.getWorldPosition(new THREE.Vector3());
      near = camera.position.distanceTo(sp) < 4 * ZOOM;
    }
    if (near && world.discover(r.id)) {
      const p = partOf(world.def, r.id);
      sfx.pop();
      ui.toast(`💡 这里好像少了点什么……是 ${p.icon} ${p.name}！`);
    }
  }
}

async function runCombine(def) {
  endTalk();
  const next = SCENES[def.next];
  if (!state.magnets.includes(next.id)) state.magnets.push(next.id);
  state.newMagnet = next.id;
  save();
  await ui.combine(def, next);
  refreshGoal();
  busy = false;
  openFridge();
}

// ---------------- 冰箱 ----------------
function openFridge() {
  if (busy) return;
  endTalk();
  ui.openFridge((id) => {
    const def = SCENES[id];
    if (def.ending) {
      ui.closeFridge();
      showEnding();
      return;
    }
    if (def.comingSoon) {
      sfx.pop();
      ui.toast('🏗 这个世界还在建造中，敬请期待！');
      return;
    }
    ui.closeFridge();
    if (id !== state.current) travel(id);
  });
}
// 右上角的按钮：在家里是“冰箱”（选下一个世界），在别的世界是“回家”
const homeBtn = document.getElementById('btn-fridge');
function syncHomeButton() {
  const atHome = world.def.id === HOME;
  homeBtn.textContent = atHome ? '🧊 冰箱' : '🏠 回家';
  homeBtn.title = atHome ? '打开冰箱，选一块冰箱贴出发' : '回到小屋';
}
homeBtn.addEventListener('click', () => {
  if (world.def.id === HOME) openFridge();
  else {
    sfx.click();
    travel(HOME);
  }
});

// 全家福：集齐所有世界之后的结局
async function showEnding() {
  if (state.newMagnet === 'finale') {
    state.newMagnet = null;
    save();
  }
  endTalk();
  const choice = await ui.showEnding();
  if (choice === 'reset') {
    resetSave();
    location.reload();
  } else {
    openFridge();
  }
}
document.getElementById('fridge-close').addEventListener('click', () => {
  sfx.click();
  ui.closeFridge();
});
document.getElementById('fridge').addEventListener('click', (e) => {
  if (e.target.id === 'fridge') ui.closeFridge();
});

// ---------------- 声音 ----------------
// ---------------- 触控：摇杆 / 互动按钮 / 全屏 ----------------
function setTouchMode(on) {
  if (on === touchMode) return;
  touchMode = on;
  syncTouchUI();
  applySize();
}

function syncTouchUI() {
  document.body.classList.toggle('touch', touchMode);
  document.getElementById('joystick').hidden = !touchMode;
  if (!touchMode) {
    ui.action(null);
    input.ax = input.az = 0;
  }
}

const joy = document.getElementById('joystick');
const stick = joy.querySelector('.stick');
let joyId = null;
function joyMove(e) {
  const r = joy.getBoundingClientRect();
  const max = r.width * 0.36;
  let dx = e.clientX - (r.left + r.width / 2);
  let dy = e.clientY - (r.top + r.height / 2);
  const l = Math.hypot(dx, dy);
  if (l > max) {
    dx = (dx / l) * max;
    dy = (dy / l) * max;
  }
  stick.style.transform = `translate(${dx}px, ${dy}px)`;
  input.ax = dx / max;
  input.az = dy / max;
}
function joyEnd(e) {
  if (e.pointerId !== joyId) return;
  joyId = null;
  joy.classList.remove('active');
  stick.style.transform = '';
  input.ax = input.az = 0;
}
joy.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sfx.unlock();
  joyId = e.pointerId;
  try {
    joy.setPointerCapture(e.pointerId);
  } catch {
    /* 个别浏览器不支持捕获，不影响摇杆 */
  }
  joy.classList.add('active');
  endGreeting();
  if (ui.dialogOpen) endTalk();
  if (player) player.moveTarget = null;
  joyMove(e);
});
joy.addEventListener('pointermove', (e) => {
  if (e.pointerId === joyId) joyMove(e);
});
joy.addEventListener('pointerup', joyEnd);
joy.addEventListener('pointercancel', joyEnd);

document.getElementById('btn-action').addEventListener('click', () => {
  if (busy || ui.fridgeOpen) return;
  if (ui.dialogOpen) {
    endTalk();
    return;
  }
  const n = nearestInteractable();
  if (n?.type === 'villager') talkTo(n.v);
  else if (n?.type === 'repair') doRepair(n.id);
  else if (n?.type === 'interact') n.it.fn();
  else if (n?.type === 'fridge') openFridge();
});

const fullBtn = document.getElementById('btn-full');
const root = document.documentElement;
const reqFull = root.requestFullscreen || root.webkitRequestFullscreen;
if (reqFull && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
  fullBtn.hidden = false;
  fullBtn.addEventListener('click', () => {
    sfx.click();
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else reqFull.call(root);
  });
}

// iPad Safari 的双指缩放整个页面
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

const soundBtn = document.getElementById('btn-sound');
const syncSound = () => (soundBtn.textContent = state.muted ? '🔇' : '🔊');
syncSound();
soundBtn.addEventListener('click', () => {
  state.muted = !state.muted;
  save();
  syncSound();
  sfx.refreshAmbient();
  sfx.click();
});

// ---------------- 键盘 ----------------
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };

function nearestInteractable() {
  if (!player) return null;
  let best = null;
  for (const r of world.repairs.values()) {
    if (r.done || !r.seen || !isFinite(r.reach)) continue;
    const d = distToPlayer(r.x, r.z);
    if (d < r.reach) return { type: 'repair', id: r.id };
  }
  for (const it of world.interacts.values()) {
    if (it.available && !it.available()) continue;
    if (distToPlayer(it.x, it.z) < it.reach) return { type: 'interact', id: it.id, it };
  }
  let bd = 1.6;
  for (const v of world.villagers) {
    const d = distToPlayer(v.x, v.z);
    if (d < bd) {
      bd = d;
      best = { type: 'villager', v };
    }
  }
  if (!best && world.fridge) {
    const f = world.fridge.position;
    if (distToPlayer(f.x, f.z) < 1.9) best = { type: 'fridge' };
  }
  return best;
}

const GAME_KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'rotate', KeyW: 'rotate', ArrowDown: 'down', KeyS: 'down', Space: 'drop' };

addEventListener('keydown', (e) => {
  endGreeting();
  if (game) {
    if (e.code === 'Escape') stopGame();
    else if (GAME_KEYS[e.code]) {
      e.preventDefault();
      game.g.key(GAME_KEYS[e.code]);
    }
    return;
  }
  if (e.code === 'Escape') {
    if (ui.fridgeOpen) ui.closeFridge();
    endTalk();
    return;
  }
  if (busy || ui.fridgeOpen) return;
  if (KEYMAP[e.code]) {
    input[KEYMAP[e.code]] = true;
    e.preventDefault();
    if (ui.dialogOpen) endTalk();
    return;
  }
  if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (ui.dialogOpen) {
      endTalk();
      return;
    }
    const n = nearestInteractable();
    if (n?.type === 'villager') talkTo(n.v);
    else if (n?.type === 'repair') doRepair(n.id);
    else if (n?.type === 'interact') n.it.fn();
    else if (n?.type === 'fridge') openFridge();
  }
});
addEventListener('keyup', (e) => {
  if (KEYMAP[e.code]) input[KEYMAP[e.code]] = false;
});
addEventListener('blur', () => Object.keys(input).forEach((k) => (input[k] = false)));

// ---------------- 主循环 ----------------
const clock = new THREE.Clock();
let simTime = 0;
function frame(dt, render = true) {
  simTime += dt;
  const t = simTime;

  if (intro) {
    intro.t += dt;
    const k = Math.min(1, intro.t / 0.9);
    world.root.scale.setScalar(Math.max(0.001, easeOutBack(k)));
    world.root.rotation.y = (1 - ease(k)) * -0.8;
    world.root.position.y = (1 - ease(k)) * 1.5;
    if (k >= 1) {
      intro = null;
      // 方块落定之后再打招呼（第一次打开游戏时，等开场说明关掉）
      if (state.seenIntro) setTimeout(maybeGreet, 400);
    }
  }

  world.update(dt, t, input);
  if (player) {
    // 方向键、摇杆跟着镜头转：“上”永远是朝屏幕里走
    input.yaw = controls.getAzimuthalAngle();
    player.update(dt, t, input);
    // 往电话亭里看完，人一动镜头就重新跟上
    if (hold && player.moving) hold = false;
    // 走到东西旁边自动捡起
    for (const [id, g] of world.items) {
      if (Math.hypot(player.x - g.position.x, player.z - g.position.z) < 0.8) {
        collect(id);
        break;
      }
    }
    const n = !ui.dialogOpen && !busy ? nearestInteractable() : null;
    let tip = null;
    if (n?.type === 'villager') tip = `<kbd>E</kbd>和 ${n.v.name} 聊天`;
    else if (n?.type === 'repair') {
      const p = partOf(world.def, n.id);
      tip = `<kbd>E</kbd>放回 ${p.icon} ${p.name}`;
    } else if (n?.type === 'interact') {
      tip = `<kbd>E</kbd>${typeof n.it.label === 'function' ? n.it.label() : n.it.label}`;
    } else if (n) tip = '<kbd>E</kbd>打开冰箱';
    else if (!ui.dialogOpen) tip = world.blockerNear(player.x, player.z, player.radius + 0.08)?.say || null;
    ui.prompt(tip);
    ui.action(touchMode ? (n?.type === 'repair' ? { ...n, part: partOf(world.def, n.id) } : n) : null);
  }
  if (world.repairs.size) checkDiscover();

  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    a.step(k);
    if (k >= 1) {
      a.done?.();
      anims.splice(i, 1);
    }
  }

  if (game) game.g.update(dt);
  updateCamera(dt);
  updateGreeting(dt);
  updateHover();
  if (render) renderer.render(scene, camera);
}

function loop() {
  frame(Math.min(clock.getDelta(), 0.05));
  requestAnimationFrame(loop);
}

// ---------------- 启动 ----------------
ui.setHint();
syncTouchUI();
const startDef = SCENES[state.current];
loadScene(startDef && !startDef.comingSoon && !startDef.ending ? state.current : 'home');
loop();
if (!state.seenIntro) {
  ui.intro().then(() => {
    state.seenIntro = true;
    save();
    setTimeout(maybeGreet, 400);
    maybeRotateHint();
  });
} else {
  maybeRotateHint();
}

// 调试用：在控制台里 window.__mw 可以看到状态
window.__mw = {
  state,
  get world() {
    return world;
  },
  camera,
  controls,
  travel,
  pick,
  // 窗口在后台时 requestAnimationFrame 会暂停，用它手动推进若干帧
  step(n = 60, render = true) {
    for (let i = 0; i < n; i++) frame(1 / 60, render && i === n - 1);
  },
};
