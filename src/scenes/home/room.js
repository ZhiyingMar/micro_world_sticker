// 房间本身：地板、后墙和左墙、墙裙顶线、窗户、墙上的画和时钟，换壁纸地板时只换它们的贴图
import * as THREE from 'three';
import { at, canvasTexture } from '../../kit.js';
import { makeStarField } from '../../fx.js';
import { currentDecor, decorTexture } from '../../decor.js';
import { WOOD, WOOD_DARK } from './furniture.js';
import { HOUSE } from './layout.js';

// 地板下面那圈木头地基：比地板四边多出来多少、多高、中心多低、圆角
const FOUNDATION = { overhang: 0.15, height: 0.9, y: -0.72, radius: 0.15 };
// 地板侧面的收边：木头的截面色，比地基浅一点，两层分得开
const FLOOR_EDGE = WOOD;

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
 * @returns {{ applyDecor(kind: string, entry: object): void }} 换装修用的小接口
 */
export function buildRoom(w) {
  const k = w.kit;
  const floorMat = buildFloor(w);

  // 两面墙共用一份壁纸材质，换壁纸时一起换
  const wpMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const back = k.mesh(new THREE.BoxGeometry(9.6, 4.2, 0.3), wpMat);
  w.add(back, 0, 2.1, -4.65);
  const left = k.mesh(new THREE.BoxGeometry(0.3, 4.2, 9.6), wpMat);
  w.add(left, -4.65, 2.1, 0);
  // 墙裙 + 顶线（墙裙颜色跟着壁纸配）
  const wainscotMat = new THREE.MeshStandardMaterial({ roughness: 0.82 });
  w.add(k.box(9.6, 1.1, 0.06, wainscotMat, 0.02), 0, 0.55, -4.48);
  w.add(k.box(0.06, 1.1, 9.6, wainscotMat, 0.02), -4.48, 0.55, 0);
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
  return { applyDecor };
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
  world.add(kit.box(foundationSize, FOUNDATION.height, foundationSize, WOOD_DARK, FOUNDATION.radius), 0, FOUNDATION.y, 0);
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
