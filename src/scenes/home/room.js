// 房间本身：地板、后墙（开了窗洞）和左墙、墙裙顶线、窗户、墙上的画和时钟，换壁纸地板时只换它们的贴图
import * as THREE from 'three';
import { at, canvasTexture } from '../../kit.js';
import { roundedPart } from './materials.js';
import { makeStarField } from '../../fx.js';
import { currentDecor, decorTexture } from '../../decor.js';
import { WOOD, WOOD_DARK } from './furniture-models.js';
import { buildWindow } from './window.js';
import { HOUSE, WINDOW } from './layout.js';

// 地板下面那圈木头地基：比地板四边多出来多少、多高、中心多低、圆角
const FOUNDATION = { overhang: 0.15, height: 0.9, y: -0.72, radius: 0.15 };
// 地板侧面的收边：木头的截面色，比地基浅一点，两层分得开
const FLOOR_EDGE = WOOD;

// 墙切开露出来的截面（后墙右头、左墙前头、窗洞四周）：奶油色的墙芯，不铺壁纸
const WALL_EDGE = '#f3e6cf';
// 窗框比墙面往屋里凸出来多少
const WINDOW_INSET = 0.05;
// 晒太阳：小人站在窗前离墙多远（z）、待多久
const BASK_Z = -3.55;
const BASK_TIME = 5;
// 左墙上的钟：挂在哪、多大；分针停在哪（弧度），秒针一跳用多久（秒）
const CLOCK = { x: -4.45, y: 2.9, z: -0.4, radius: 0.38, minuteAngle: 1.2, tickTime: 0.12 };

// 墙根、墙角一圈淡淡的阴影：家具和墙像是坐在地上，屋子不像几块板拼起来的
const CORNER_SHADE = {
  color: '#6b4426',
  opacity: 0.32,
  floorWidth: 0.75, // 墙根往屋里淡出去多宽
  cornerWidth: 0.6, // 两面墙相交的竖角往两边淡出去多宽
  lift: 0.004, // 离地面、墙面多远：贴得太近会和它们抢着画，一闪一闪的
};
// 阴影从深到浅怎么淡：[离深边多远（0~1）, 多深（0~1）]，前面掉得快，后面拖得长
const SHADE_FALLOFF = [[0, 1], [0.25, 0.5], [0.55, 0.18], [1, 0]];
const SHADE_TEXTURE_PX = 64;

// 星空壁纸时外面那片星星：撒在多远的球壳上，按整个方块对角线的倍数算（最近也要在花园外面）
const STAR_SHELL_NEAR = 0.8;
const STAR_SHELL_FAR = 3.5;
// 撒在镜头正对面多大的锥形里（半角，弧度）：盖住镜头左右转、上下转能看到的范围
const STAR_SPREAD = 1.2;
const STAR_SEED = 11;

/**
 * 搭小屋的地板、墙和墙上的摆设
 * @description 壁纸、地板、墙裙用的是小屋自己的材质，工作台上换装修时只换它们的贴图和颜色，不用重新搭
 * @param {World} w 小屋这个世界
 * @returns {{ applyDecor(kind: string, entry: object): void, curtains: THREE.Group[] }} 换装修用的小接口；两片窗帘（会被风吹得轻轻晃）
 */
export function buildRoom(w) {
  const k = w.kit;
  const floorMat = buildFloor(w);

  const { wallpaper: wpMat, wainscot: wainscotMat } = buildWalls(w);
  const windowModel = buildWindow(k, WINDOW);
  w.add(windowModel.group, WINDOW.x, WINDOW.y, -(HOUSE.wallInner - WINDOW_INSET));
  // 小人闲逛时会走到窗前，朝着窗外晒太阳
  w.poi(WINDOW.x, BASK_Z, { emote: '☀', face: Math.PI, dur: BASK_TIME });
  // 窗台上的小盆栽
  const sill = new THREE.Group();
  sill.add(k.cyl(0.11, 0.08, 0.16, '#e07a5f', 14));
  const leaf = k.sphere(0.13, '#7cc576', 12);
  leaf.position.y = 0.15;
  sill.add(leaf);
  w.add(sill, 2.2, 1.66, -4.25);

  // 墙上的画 & 时钟
  const frame = new THREE.Group();
  frame.add(roundedPart(k, 1.1, 0.85, 0.08, '#c48a54', 0.04));
  const art = roundedPart(k, 0.9, 0.65, 0.04, '#bde3f2', 0.01);
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

  placeClock(w);

  placeCornerShade(w);
  const stars = placeBackdropStars(w);

  /**
   * 换上一款壁纸或地板
   * @param {'wallpaper' | 'floor'} kind 哪一类
   * @param {object} entry 装修目录里的一款
   */
  const applyDecor = (kind, entry) => {
    const material = kind === 'wallpaper' ? wpMat : floorMat;
    // 旧贴图还挂在世界的贴图表里，离开小屋时一起释放；这里先放掉，换来换去不攒显存
    material.map?.dispose();
    material.map = w.texture(decorTexture(kind, entry));
    material.needsUpdate = true;

    if (kind === 'wallpaper') {
      wainscotMat.color.set(entry.wainscot);
      w.setBackdrop(entry.backdrop);
      stars.group.visible = !!entry.backdropStars;
    }
  };

  applyDecor('wallpaper', currentDecor('wallpaper'));
  applyDecor('floor', currentDecor('floor'));
  return { applyDecor, curtains: windowModel.curtains };
}

/**
 * 左墙上的圆钟：秒针一秒一跳，"嗒"地往前走一格
 * @param {World} world 小屋这个世界
 */
function placeClock(world) {
  const kit = world.kit;
  const clock = new THREE.Group();
  const face = kit.cyl(CLOCK.radius, CLOCK.radius, 0.08, '#fffaf0', 24);
  face.rotation.z = Math.PI / 2;
  const rim = kit.torus(CLOCK.radius, 0.05, '#f4a259');
  rim.rotation.y = Math.PI / 2;
  clock.add(face, rim);

  // 指针挂在表盘中心的转轴上，转的时候绕中心转；钟挂在左墙上，表盘朝 +x，所以绕 x 轴转
  const handsOut = 0.05;
  const minuteHand = new THREE.Group();
  minuteHand.position.x = handsOut;
  minuteHand.rotation.x = CLOCK.minuteAngle;
  minuteHand.add(at(roundedPart(kit, 0.02, 0.18, 0.03, '#6b4f3a', 0.005), 0, 0.08, 0));
  const secondHand = new THREE.Group();
  secondHand.position.x = handsOut + 0.01;
  secondHand.add(at(roundedPart(kit, 0.015, 0.26, 0.02, '#e85d5d', 0.005), 0, 0.1, 0));
  clock.add(minuteHand, secondHand, at(kit.sphere(0.03, '#6b4f3a', 10), handsOut + 0.02, 0, 0));
  world.add(clock, CLOCK.x, CLOCK.y, CLOCK.z);

  const step = (Math.PI * 2) / 60;
  world.onUpdate((dt, time) => {
    const second = Math.floor(time);
    const tick = Math.min(1, (time - second) / CLOCK.tickTime);
    // 每一跳先快后慢地落到下一格
    const settled = 1 - (1 - tick) ** 3;
    secondHand.rotation.x = -(second - 1 + settled) * step;
  });
}

/**
 * 后墙和左墙：后墙按窗户的位置开一个真的洞，墙裙、墙裙顶线、墙顶木线
 * @description 两面墙共用一份壁纸材质，墙裙颜色跟着壁纸配，换壁纸时一起换
 * @param {World} world 小屋这个世界
 * @returns {{ wallpaper: THREE.MeshStandardMaterial, wainscot: THREE.MeshStandardMaterial }} 换装修时要换的两份材质
 */
function buildWalls(world) {
  const kit = world.kit;
  const wallpaper = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const faces = [wallpaper, kit.m(WALL_EDGE)];
  const length = HOUSE.half * 2;
  const outside = -(HOUSE.wallInner + HOUSE.wallThickness);

  const back = new THREE.Mesh(wallGeometry(length, WINDOW), faces);
  world.add(back, 0, 0, outside);
  const left = new THREE.Mesh(wallGeometry(length, null), faces);
  world.add(left, outside, 0, 0, Math.PI / 2);
  for (const wall of [back, left]) {
    wall.castShadow = true;
    wall.receiveShadow = true;
  }

  // 墙裙 + 顶线（老的尺寸，和墙的内侧面对齐）
  const wainscot = new THREE.MeshStandardMaterial({ roughness: 0.82 });
  world.add(roundedPart(kit, 9.6, 1.1, 0.06, wainscot, 0.02), 0, 0.55, -4.48);
  world.add(roundedPart(kit, 0.06, 1.1, 9.6, wainscot, 0.02), -4.48, 0.55, 0);
  world.add(roundedPart(kit, 9.7, 0.08, 0.1, '#ffffff', 0.03), 0, 1.12, -4.47);
  world.add(roundedPart(kit, 0.1, 0.08, 9.7, '#ffffff', 0.03), -4.47, 1.12, 0);
  world.add(roundedPart(kit, 9.9, 0.22, 0.42, '#e7c9a0', 0.08), 0, 4.25, -4.65);
  world.add(roundedPart(kit, 0.42, 0.22, 9.9, '#e7c9a0', 0.08), -4.65, 4.25, 0);
  return { wallpaper, wainscot };
}

/**
 * 一面墙的形状：从地面立起来的长方形，可以开一个窗洞，往 +z 挤出墙厚
 * @description 正面、背面的贴图坐标按位置算，整面墙从 0 铺到 1，和原来的方块墙一样；开了洞图案也不挤歪。
 *   截面（侧面）用第二份材质
 * @param {number} length 墙多长，沿 x，中心在 0
 * @param {{ x: number, y: number, width: number, height: number } | null} opening 窗洞的中心和大小，没有就是 null
 * @returns {THREE.ExtrudeGeometry}
 */
function wallGeometry(length, opening) {
  const half = length / 2;
  const height = HOUSE.wallHeight;
  const shape = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(half, height), new THREE.Vector2(-half, height)]);
  if (opening) {
    const left = opening.x - opening.width / 2;
    const right = opening.x + opening.width / 2;
    const bottom = opening.y - opening.height / 2;
    const top = opening.y + opening.height / 2;
    shape.holes.push(new THREE.Path([new THREE.Vector2(left, bottom), new THREE.Vector2(left, top), new THREE.Vector2(right, top), new THREE.Vector2(right, bottom)]));
  }

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: HOUSE.wallThickness, bevelEnabled: false });
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) + half) / length, position.getY(i) / height);
  }
  return geometry;
}

/**
 * 地板：顶面铺装修贴图，四个侧面是木头收边，下面一圈木头地基
 * @param {World} world 小屋这个世界
 * @returns {THREE.MeshStandardMaterial} 地板顶面的材质，换地板时换它的贴图
 */
function buildFloor(world) {
  const kit = world.kit;
  const size = HOUSE.half * 2;
  const floorMaterial = new THREE.MeshStandardMaterial({ roughness: 0.75 });
  const edgeMaterial = kit.m(FLOOR_EDGE);

  // BoxGeometry 六个面依次是 +x、-x、+y、-y、+z、-z；只有顶面铺贴图，侧面铺的话会被拉成一道道条纹
  const faces = [edgeMaterial, edgeMaterial, floorMaterial, edgeMaterial, edgeMaterial, edgeMaterial];
  const floor = new THREE.Mesh(new THREE.BoxGeometry(size, HOUSE.floorThickness, size), faces);
  floor.castShadow = true;
  floor.receiveShadow = true;
  world.add(floor, 0, -HOUSE.floorThickness / 2, 0);

  const foundationSize = size + FOUNDATION.overhang * 2;
  world.add(roundedPart(kit, foundationSize, FOUNDATION.height, foundationSize, WOOD_DARK, FOUNDATION.radius), 0, FOUNDATION.y, 0);
  return floorMaterial;
}

/**
 * 在墙根和两面墙相交的墙角铺一圈淡淡的阴影
 * @description 真的屋子里墙根、墙角总是暗一点；没有这一圈，地板和墙像是两块板硬拼在一起
 * @param {World} world 小屋这个世界
 */
function placeCornerShade(world) {
  const material = new THREE.MeshBasicMaterial({
    color: CORNER_SHADE.color,
    map: world.texture(shadeTexture()),
    transparent: true,
    opacity: CORNER_SHADE.opacity,
    depthWrite: false,
  });
  // 墙裙的正面比墙面往屋里多出来一点，墙角的竖条下半截贴墙裙、上半截贴墙面
  const wainscotFront = -(HOUSE.wallInner - HOUSE.wainscotThickness);
  const wallFace = -HOUSE.wallInner;
  const { floorWidth, cornerWidth, lift } = CORNER_SHADE;
  const floorFar = HOUSE.half;
  const wainscotTop = HOUSE.wainscotHeight;
  const wallTop = HOUSE.wallHeight;
  const quads = [
    // 后墙根、左墙根（地上）：深的一边贴着墙
    [[wainscotFront, lift, wainscotFront], [floorFar, lift, wainscotFront], [wainscotFront, lift, wainscotFront + floorWidth], [floorFar, lift, wainscotFront + floorWidth]],
    [[wainscotFront, lift, wainscotFront], [wainscotFront, lift, floorFar], [wainscotFront + floorWidth, lift, wainscotFront], [wainscotFront + floorWidth, lift, floorFar]],
    // 后墙、左墙上靠墙角的竖条：下半截在墙裙上，上半截在墙面上
    [[wainscotFront, 0, wainscotFront + lift], [wainscotFront, wainscotTop, wainscotFront + lift], [wainscotFront + cornerWidth, 0, wainscotFront + lift], [wainscotFront + cornerWidth, wainscotTop, wainscotFront + lift]],
    [[wallFace, wainscotTop, wallFace + lift], [wallFace, wallTop, wallFace + lift], [wallFace + cornerWidth, wainscotTop, wallFace + lift], [wallFace + cornerWidth, wallTop, wallFace + lift]],
    [[wainscotFront + lift, 0, wainscotFront], [wainscotFront + lift, wainscotTop, wainscotFront], [wainscotFront + lift, 0, wainscotFront + cornerWidth], [wainscotFront + lift, wainscotTop, wainscotFront + cornerWidth]],
    [[wallFace + lift, wainscotTop, wallFace], [wallFace + lift, wallTop, wallFace], [wallFace + lift, wainscotTop, wallFace + cornerWidth], [wallFace + lift, wallTop, wallFace + cornerWidth]],
  ];

  for (const [darkStart, darkEnd, fadeStart, fadeEnd] of quads) {
    const shade = new THREE.Mesh(shadeQuad(darkStart, darkEnd, fadeStart, fadeEnd), material);
    // 透明的阴影条要在地板、墙之后画
    shade.renderOrder = 1;
    world.add(shade);
  }
}

/**
 * 一条阴影：四个角围成的一块，深的那条边在 darkStart → darkEnd
 * @param {number[]} darkStart 深边的一头 [x, y, z]
 * @param {number[]} darkEnd 深边的另一头
 * @param {number[]} fadeStart 淡边上对着 darkStart 的那头
 * @param {number[]} fadeEnd 淡边上对着 darkEnd 的那头
 * @returns {THREE.BufferGeometry}
 */
function shadeQuad(darkStart, darkEnd, fadeStart, fadeEnd) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...darkStart, ...darkEnd, ...fadeStart, ...fadeEnd], 3));
  // 贴图上边（v = 1）是深的
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
  // 两面都画：哪面朝镜头都看得到
  geometry.setIndex([0, 2, 1, 1, 2, 3, 0, 1, 2, 1, 3, 2]);
  return geometry;
}

/**
 * 阴影条的贴图：白色，上边不透明，往下慢慢透明（颜色由材质给）
 * @returns {THREE.CanvasTexture}
 */
function shadeTexture() {
  return canvasTexture(1, SHADE_TEXTURE_PX, (context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    for (const [offset, strength] of SHADE_FALLOFF) {
      gradient.addColorStop(offset, `rgba(255,255,255,${strength})`);
    }
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  });
}

/**
 * 小屋外面那片星星，先藏着，换上星空壁纸时才露出来
 * @description 星星撒在镜头背后那半边的远处，转镜头时远近星星错开移动，小屋才像真的飘在夜空里
 * @param {World} w 小屋这个世界
 * @returns {{ group: THREE.Group, update(t: number): void }} makeStarField 的结果
 */
function placeBackdropStars(w) {
  const { pos, target } = w.def.camera;
  const towardCamera = new THREE.Vector3(...pos).sub(new THREE.Vector3(...target));
  const worldDiagonal = Math.hypot(...w.size);
  const stars = makeStarField({
    away: towardCamera,
    spread: STAR_SPREAD,
    near: worldDiagonal * STAR_SHELL_NEAR,
    far: worldDiagonal * STAR_SHELL_FAR,
    seed: STAR_SEED,
  });

  stars.group.visible = false;
  w.add(stars.group);
  w.onUpdate((dt, t) => {
    if (stars.group.visible) {
      stars.update(t);
    }
  });
  return stars;
}
