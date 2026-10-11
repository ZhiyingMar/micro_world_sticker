import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { World } from './world.js';
import { SCENES } from './scenes/index.js';
import { state, save, foundIn } from './state.js';
import { ui } from './ui.js';
import { sfx } from './audio.js';
import { blobShadowTexture } from './fx.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.zoomToCursor = true;
controls.maxDistance = 26;
controls.rotateSpeed = 0.7;

// 灯光
const hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
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
let mode = 'god';
let player = null;
let talking = null;
let busy = false; // 合成动画/切换场景时锁定操作
let intro = null; // 方块落下动画
let focus = null; // 相机平滑移动
const anims = [];
const input = { up: false, down: false, left: false, right: false, ax: 0, az: 0 };
// 触控设备：一开始按设备能力判断，之后只要碰到触摸就切到触控界面
let touchMode = matchMedia('(pointer: coarse)').matches;
const lifeLook = new THREE.Vector3();

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
addEventListener('resize', applySize);

// ---------------- 场景加载 ----------------
function defaultView(def) {
  const c = def.camera;
  const pos = new THREE.Vector3(...c.pos);
  const target = new THREE.Vector3(...c.target);
  // 竖屏时水平视野窄，按宽高比把镜头拉远，保证整个方块都在画面里
  const fit = Math.max(1, 1.3 / (innerWidth / innerHeight));
  pos.sub(target).multiplyScalar(fit).add(target);
  controls.maxDistance = Math.max(26, pos.distanceTo(target) * 1.2);
  return { pos, target };
}

function loadScene(id) {
  const def = SCENES[id];
  if (world) world.dispose();
  if (player) player = null;
  talking = null;
  ui.closeDialog();
  world = new World(def, { hemi, sun });
  scene.add(world.root);

  const [sky, gnd, hi] = def.lights.hemi;
  hemi.color.set(sky);
  hemi.groundColor.set(gnd);
  hemi.intensity = hi;
  const [sc, si, sp] = def.lights.sun;
  sun.color.set(sc);
  sun.intensity = si;
  sun.position.set(...sp);

  const c = def.camera;
  controls.minDistance = c.min || 2.5;
  controls.maxPolarAngle = c.maxPolar || 1.3;
  controls.minAzimuthAngle = c.minAz ?? -Infinity;
  controls.maxAzimuthAngle = c.maxAz ?? Infinity;
  const v = defaultView(def);
  camera.position.copy(v.pos);
  controls.target.copy(v.target);
  controls.update();
  focus = null;

  state.current = id;
  if (state.newMagnet === id) state.newMagnet = null;
  save();

  ui.setScene(def);
  sfx.ambient(def.ambient || null);
  applySize();
  if (mode === 'life') spawnPlayer();
  intro = { t: 0 };
  world.root.scale.setScalar(0.001);
}

function travel(id) {
  if (busy) return;
  busy = true;
  sfx.whoosh();
  ui.fade(() => loadScene(id)).then(() => {
    busy = false;
    ui.toast(`${SCENES[id].emoji} 欢迎来到「${SCENES[id].name}」`);
  });
}

// ---------------- 模式切换 ----------------
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
  const wp = player.root.getWorldPosition(new THREE.Vector3());
  lifeLook.copy(wp);
}

function setMode(m) {
  if (m === mode || busy) return;
  mode = m;
  ui.setMode(m);
  sfx.click();
  endTalk();
  if (m === 'life') {
    controls.enabled = false;
    focus = null;
    spawnPlayer();
    world.fx.emit(player.root.position.clone().setY(0.5), { count: 12, spread: 0.4, rise: 1.2, color: '#c8ffd0' });
  } else {
    if (player) {
      controls.target.copy(lifeLook);
      player.root.removeFromParent();
      world.player = null;
      player = null;
    }
    controls.enabled = true;
    ui.prompt(null);
  }
  syncTouchUI();
}
document.querySelectorAll('#mode-switch button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

// ---------------- 相机 ----------------
function focusOn(target, dist) {
  const dir = camera.position.clone().sub(controls.target).normalize();
  focus = {
    t: 0,
    dur: 0.7,
    fromT: controls.target.clone(),
    toT: target.clone(),
    fromP: camera.position.clone(),
    toP: target.clone().add(dir.multiplyScalar(dist)),
  };
}

function resetView() {
  if (mode === 'life') setMode('god');
  const v = defaultView(world.def);
  focus = { t: 0, dur: 0.9, fromT: controls.target.clone(), toT: v.target, fromP: camera.position.clone(), toP: v.pos };
}
document.getElementById('btn-reset').addEventListener('click', () => {
  sfx.click();
  resetView();
});

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const easeOutBack = (k) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;

function updateCamera(dt) {
  if (mode === 'life' && player) {
    const p = player.root.getWorldPosition(new THREE.Vector3());
    lifeLook.lerp(p.clone().setY(0.5), 1 - Math.exp(-dt * 6));
    const desired = lifeLook.clone().add(new THREE.Vector3(0, 5.2, 6.6));
    camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
    camera.lookAt(lifeLook);
    return;
  }
  if (focus) {
    focus.t += dt;
    const k = ease(Math.min(1, focus.t / focus.dur));
    controls.target.lerpVectors(focus.fromT, focus.toT, k);
    camera.position.lerpVectors(focus.fromP, focus.toP, k);
    if (k >= 1) focus = null;
  }
  const t = controls.target;
  t.x = THREE.MathUtils.clamp(t.x, -5.5, 5.5);
  t.y = THREE.MathUtils.clamp(t.y, 0, 3.5);
  t.z = THREE.MathUtils.clamp(t.z, -5.5, 5.5);
  controls.update();
}

// ---------------- 拾取 / 点击 ----------------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function pick(clientX, clientY) {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(world.root, true);
  for (const h of hits) {
    if (h.object.isSprite || h.object.isPoints) continue;
    let o = h.object;
    while (o && o !== world.root) {
      if (o.userData.itemId) return { type: 'item', id: o.userData.itemId, obj: o, point: h.point };
      if (o.userData.villager) {
        if (o.userData.villager === player) break;
        return { type: 'villager', v: o.userData.villager, point: h.point };
      }
      if (o.userData.action) return { type: 'action', action: o.userData.action, point: h.point };
      o = o.parent;
    }
    return { type: 'ground', point: h.point };
  }
  return null;
}

const _v = new THREE.Vector3();
function pickNear(cx, cy, radius) {
  const cands = [];
  for (const [id, g] of world.items) cands.push({ type: 'item', id, obj: g, pos: g.getWorldPosition(new THREE.Vector3()) });
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
    const d = Math.hypot(sx - cx, sy - cy);
    if (d >= bd) continue;
    // 被墙或家具挡住的不算
    const dir = c.pos.clone().sub(camera.position);
    const dist = dir.length();
    raycaster.set(camera.position, dir.normalize());
    const first = raycaster.intersectObject(world.root, true).find((h) => !h.object.isSprite && !h.object.isPoints);
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
  if (busy || ui.fridgeOpen) return;
  if (ui.dialogOpen) {
    endTalk();
    return;
  }
  let hit = pick(cx, cy);
  // 手指比鼠标粗：没点中东西时，看看附近有没有物品或小人
  if (touch && (!hit || hit.type === 'ground')) hit = pickNear(cx, cy, 34) || hit;
  if (!hit) return;
  if (mode === 'god') {
    if (hit.type === 'item') collect(hit.id);
    else if (hit.type === 'villager') talkTo(hit.v);
    else if (hit.type === 'action' && hit.action === 'fridge') openFridge();
    else {
      const d = camera.position.distanceTo(controls.target);
      const target = hit.point.clone();
      target.y = Math.min(target.y, 3);
      focusOn(target, Math.max(controls.minDistance + 0.3, d * 0.55));
      sfx.click();
    }
    return;
  }
  // 生活模式：点哪里走到哪里，够近了就互动
  const lp = localPoint(hit.point);
  if (hit.type === 'item') {
    const g = hit.obj;
    if (distToPlayer(g.position.x, g.position.z) < 1.6) collect(hit.id);
    else player.moveTarget = { x: g.position.x, z: g.position.z };
  } else if (hit.type === 'villager') {
    if (distToPlayer(hit.v.x, hit.v.z) < 1.8) talkTo(hit.v);
    else player.moveTarget = { x: hit.v.x, z: hit.v.z };
  } else if (hit.type === 'action' && hit.action === 'fridge') {
    const f = world.fridge.position;
    if (distToPlayer(f.x, f.z) < 2.0) openFridge();
    else player.moveTarget = { x: f.x, z: f.z + 0.9 };
  } else {
    player.moveTarget = { x: lp.x, z: lp.z };
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
  if (!hoverPos || busy || ui.fridgeOpen || down) {
    ui.tooltip(null);
    return;
  }
  const hit = pick(hoverPos.x, hoverPos.y);
  hovered = hit;
  let tip = null;
  if (hit?.type === 'item') {
    hit.obj.userData.hover = 1;
    tip = '✨ 发现了什么！';
  } else if (hit?.type === 'villager') tip = `💬 ${hit.v.name}`;
  else if (hit?.type === 'action') tip = '🧊 冰箱 · 点击打开';
  canvas.style.cursor = tip ? 'pointer' : mode === 'life' ? 'crosshair' : '';
  ui.tooltip(tip, hoverPos.x, hoverPos.y);
}

// ---------------- 对话 ----------------
function talkTo(v) {
  if (talking && talking !== v) talking.endTalk();
  talking = v;
  const from = mode === 'life' && player ? player.root.position : localPoint(camera.position);
  v.startTalk(from.x, from.z);
  if (player && mode === 'life') {
    player.moveTarget = null;
    player.face(v.x, v.z);
  }
  ui.say(v.name, v.nextLine());
}

function endTalk() {
  if (talking) talking.endTalk();
  talking = null;
  ui.closeDialog();
}
document.getElementById('dialog').addEventListener('click', () => {
  sfx.click();
  endTalk();
});

// ---------------- 收集 ----------------
function collect(id) {
  const g = world.items.get(id);
  if (!g || busy) return;
  world.items.delete(id);
  const def = world.def;
  const it = def.items.find((i) => i.id === id);
  const found = foundIn(def.id);
  if (!found.includes(id)) found.push(id);
  save();
  const valid = found.filter((f) => def.items.some((i) => i.id === f));

  sfx.pickup();
  world.fx.emit(g.position, { count: 16, spread: 0.3, size: 0.35, rise: 1.4, color: '#fff3a0' });
  const y0 = g.position.y;
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
  ui.markFound(id);
  ui.toast(`找到了 ${it.icon} ${it.name}！`);

  if (valid.length >= def.items.length) {
    busy = true;
    setTimeout(() => runCombine(def), 1300);
  }
}

async function runCombine(def) {
  endTalk();
  const next = SCENES[def.next];
  if (!state.magnets.includes(next.id)) state.magnets.push(next.id);
  state.newMagnet = next.id;
  save();
  await ui.combine(def, next);
  ui.renderGoal(def);
  busy = false;
  openFridge();
}

// ---------------- 冰箱 ----------------
function openFridge() {
  if (busy) return;
  endTalk();
  ui.openFridge((id) => {
    const def = SCENES[id];
    if (def.comingSoon) {
      sfx.pop();
      ui.toast('🏗 这个世界还在建造中，敬请期待！');
      return;
    }
    ui.closeFridge();
    if (id !== state.current) travel(id);
  });
}
document.getElementById('btn-fridge').addEventListener('click', openFridge);
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
  document.getElementById('joystick').hidden = !(touchMode && mode === 'life');
  if (!(touchMode && mode === 'life')) {
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

addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (ui.fridgeOpen) ui.closeFridge();
    endTalk();
    return;
  }
  if (busy || ui.fridgeOpen) return;
  if (KEYMAP[e.code]) {
    if (mode === 'life') {
      input[KEYMAP[e.code]] = true;
      e.preventDefault();
      if (ui.dialogOpen) endTalk();
    }
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
    else if (n?.type === 'fridge') openFridge();
  }
  if (e.code === 'Tab') {
    e.preventDefault();
    setMode(mode === 'god' ? 'life' : 'god');
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
    if (k >= 1) intro = null;
  }

  world.update(dt, t, input);
  if (player) {
    player.update(dt, t, input);
    // 生活模式：走到东西旁边自动捡起
    for (const [id, g] of world.items) {
      if (Math.hypot(player.x - g.position.x, player.z - g.position.z) < 0.8) {
        collect(id);
        break;
      }
    }
    const n = !ui.dialogOpen && !busy ? nearestInteractable() : null;
    ui.prompt(n ? (n.type === 'villager' ? `<kbd>E</kbd>和 ${n.v.name} 聊天` : '<kbd>E</kbd>打开冰箱') : null);
    ui.action(touchMode ? n : null);
  }

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

  updateCamera(dt);
  updateHover();
  if (render) renderer.render(scene, camera);
}

function loop() {
  frame(Math.min(clock.getDelta(), 0.05));
  requestAnimationFrame(loop);
}

// ---------------- 启动 ----------------
ui.setMode('god');
syncTouchUI();
loadScene(SCENES[state.current] && !SCENES[state.current].comingSoon ? state.current : 'home');
loop();
if (!state.seenIntro) {
  ui.intro().then(() => {
    state.seenIntro = true;
    save();
  });
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
  setMode,
  // 窗口在后台时 requestAnimationFrame 会暂停，用它手动推进若干帧
  step(n = 60, render = true) {
    for (let i = 0; i < n; i++) frame(1 / 60, render && i === n - 1);
  },
};
