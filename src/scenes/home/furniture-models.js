// 小屋家具的模型：只造不摆，原点在地上、正面朝 +z（摆在哪、朝哪、碰撞和兴趣点在 furniture.js）
// 木头部分都用和地板一样的木纹，布料有自己的花纹；形状做得胖一点、圆一点，多几样小细节（把手、床柱、坐垫的扣子），
// 看着像一套做出来的游戏家具，而不是几个纯色方块拼的
import * as THREE from 'three';
import { at } from '../../kit.js';
import { roundedPart } from './materials.js';

export const WOOD = '#d9a066';
export const WOOD_DARK = '#b07a45';
// 更深的木头（书架背板、柜子踢脚）、更浅的木头（砧板、抽屉面）
const WOOD_DEEP = '#8a5a32';
const WOOD_LIGHT = '#e8b884';
const CREAM = '#fff6e6';
const BRASS = '#d8b46a';

/**
 * @typedef {import('./materials.js').FurnitureKit} FurnitureKit
 */

// ---------- 床 ----------

/**
 * 木头床：四根带圆球的床柱，床头板顶上一道圆拱，厚床垫，拼布被子从两边垂下来，一个大枕头加一个小靠垫
 * @description 床底下是空的（童话书藏在下面），长边沿 z，床头在 -z
 * @param {FurnitureKit} furniture
 * @returns {THREE.Group}
 */
export function bed(furniture) {
  const { kit } = furniture;
  const group = new THREE.Group();

  // 床柱：床头两根高，床尾两根矮，顶上一颗圆球
  for (const [x, z, height] of [[-0.98, -1.33, 1.25], [0.98, -1.33, 1.25], [-0.98, 1.33, 0.72], [0.98, 1.33, 0.72]]) {
    group.add(at(furniture.woodCylinder(0.07, 0.085, height, WOOD_DARK, 12), x, height / 2, z));
    group.add(at(furniture.woodMesh(new THREE.SphereGeometry(0.1, 14, 10), WOOD_DARK), x, height + 0.07, z));
  }
  // 床头板：一块板，顶上压一道扁扁的圆拱
  group.add(at(furniture.woodBox(1.86, 0.78, 0.1, WOOD, 0.04), 0, 0.72, -1.33));
  const arch = new THREE.CylinderGeometry(0.93, 0.93, 0.1, 32, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).scale(1, 0.32, 1);
  group.add(at(furniture.woodMesh(arch, WOOD), 0, 1.1, -1.33));
  group.add(at(kit.sphere(0.07, '#f4a259', 12), 0, 1.22, -1.27));
  // 床尾板、两边的床沿、托着床垫的床板
  group.add(at(furniture.woodBox(1.86, 0.34, 0.1, WOOD, 0.04), 0, 0.47, 1.33));
  for (const side of [-1, 1]) {
    group.add(at(furniture.woodBox(0.1, 0.18, 2.56, WOOD, 0.03), side * 0.96, 0.32, 0));
  }
  group.add(at(furniture.woodBox(1.84, 0.05, 2.56, WOOD_DARK, 0.02), 0, 0.36, 0));

  // 床垫、被子（两边垂下来一截）、翻过来的白被头
  group.add(at(roundedPart(kit, 1.84, 0.22, 2.54, '#fffaf2', 0.09), 0, 0.49, 0));
  group.add(at(furniture.quilt(1.98, 0.1, 1.85, 0.05), 0, 0.62, 0.33));
  for (const side of [-1, 1]) {
    group.add(at(furniture.quilt(0.07, 0.24, 1.85, 0.03), side * 0.97, 0.52, 0.33));
  }
  group.add(at(roundedPart(kit, 1.96, 0.07, 0.22, '#ffffff', 0.035), 0, 0.68, -0.62));

  // 大枕头：压扁的球，鼓鼓的；旁边斜靠一个粉色小靠垫
  const pillow = kit.sphere(0.5, '#ffffff', 24);
  pillow.scale.set(0.96, 0.22, 0.5);
  group.add(at(pillow, 0, 0.71, -0.98));
  const cushion = kit.sphere(0.24, '#f6a6b8', 18);
  cushion.scale.set(1, 0.85, 0.35);
  cushion.rotation.x = -0.5;
  group.add(at(cushion, 0.42, 0.86, -0.86));
  return group;
}

// ---------- 灯 ----------

/**
 * 落地灯：木头圆底座、细铜杆，顶上一个有褶子的布灯罩，里面亮着一盏暖光
 * @param {FurnitureKit} furniture
 * @returns {THREE.Group}
 */
export function floorLamp(furniture) {
  const { kit } = furniture;
  const group = new THREE.Group();
  group.add(at(furniture.woodCylinder(0.2, 0.24, 0.07, WOOD_DARK, 20), 0, 0.035, 0));
  group.add(at(furniture.woodMesh(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), WOOD_DARK), 0, 0.07, 0));
  group.add(at(kit.cyl(0.022, 0.022, 1.45, BRASS, 8, { metalness: 0.4, roughness: 0.4 }), 0, 0.78, 0));
  const knot = kit.torus(0.035, 0.015, BRASS);
  knot.rotation.x = Math.PI / 2;
  group.add(at(knot, 0, 0.8, 0));

  group.add(at(pleatedShade(kit), 0, 1.62, 0));
  group.add(at(kit.sphere(0.07, '#fff6d8', 12, { emissive: '#ffe9b0', emissiveIntensity: 1 }), 0, 1.55, 0));
  // 拉绳和小珠子
  group.add(at(kit.cyl(0.004, 0.004, 0.2, '#c9a46a', 4), 0.1, 1.34, 0));
  group.add(at(kit.sphere(0.018, BRASS, 8), 0.1, 1.23, 0));

  const bulb = new THREE.PointLight('#ffcf8a', 3, 5, 1.6);
  bulb.position.y = 1.5;
  group.add(bulb);
  return group;
}

/**
 * 有褶子的灯罩：上窄下宽的一圈布，一凹一凸，上下两道滚边
 * @param {Kit} kit
 * @returns {THREE.Group}
 */
function pleatedShade(kit) {
  const pleats = 14;
  const geometry = new THREE.CylinderGeometry(0.19, 0.33, 0.4, pleats * 2, 1, true);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const angle = Math.atan2(z, x);
    const fold = 1 + 0.05 * Math.cos(angle * pleats);
    position.setXYZ(i, x * fold, position.getY(i), z * fold);
  }
  geometry.computeVertexNormals();

  const shade = new THREE.Group();
  shade.add(kit.mesh(geometry, '#fff1c9', { emissive: '#ffd27a', emissiveIntensity: 0.55, side: THREE.DoubleSide }));
  for (const [radius, y] of [[0.19, 0.2], [0.33, -0.2]]) {
    const trim = kit.torus(radius, 0.018, '#f4a259');
    trim.rotation.x = Math.PI / 2;
    shade.add(at(trim, 0, y, 0));
  }
  return shade;
}

// ---------- 书架 ----------

/**
 * 书架：两块侧板、顶上一圈线脚，三格放书，最下面一圈踢脚；顶上摆一盆小多肉和一个相框
 * @param {FurnitureKit} furniture
 * @returns {THREE.Group}
 */
export function bookshelf(furniture) {
  const { kit } = furniture;
  const group = new THREE.Group();
  const width = 1.8;
  const inner = width - 0.16;

  for (const side of [-1, 1]) {
    group.add(at(furniture.woodBox(0.08, 2.08, 0.5, WOOD, 0.025), side * (width / 2 - 0.04), 1.04, 0));
  }
  group.add(at(furniture.woodBox(inner, 1.96, 0.03, WOOD_DEEP, 0.01), 0, 1.1, -0.235));
  group.add(at(furniture.woodBox(inner, 0.12, 0.44, WOOD_DEEP, 0.02), 0, 0.06, -0.01));
  // 三层隔板：最下面那块、中间两块
  const floors = [0.145, 0.8, 1.44];
  for (const y of floors) {
    group.add(at(furniture.woodBox(inner, 0.05, 0.48, WOOD, 0.015), 0, y, 0));
  }
  // 顶：一块宽一点的盖板，下面压一道深色线脚
  group.add(at(furniture.woodBox(width + 0.12, 0.08, 0.58, WOOD, 0.03), 0, 2.13, 0.01));
  group.add(at(furniture.woodBox(width + 0.04, 0.05, 0.54, WOOD_DARK, 0.02), 0, 2.07, 0.01));

  addBooks(kit, group, floors, inner);

  // 顶上：一盆小多肉，一个立着的相框
  group.add(at(kit.cyl(0.08, 0.06, 0.11, '#e07a5f', 12), 0.55, 2.225, 0.02));
  for (let i = 0; i < 4; i++) {
    const leaf = kit.sphere(0.045, '#7cc576', 8);
    leaf.scale.set(0.6, 1.2, 0.6);
    leaf.rotation.z = (i - 1.5) * 0.5;
    group.add(at(leaf, 0.55 + (i - 1.5) * 0.03, 2.32, 0.02));
  }
  const frame = new THREE.Group();
  frame.add(furniture.woodBox(0.3, 0.36, 0.03, WOOD_DARK, 0.01));
  frame.add(at(roundedPart(kit, 0.22, 0.27, 0.01, '#bde3f2', 0.004), 0, 0, 0.017));
  frame.add(at(kit.sphere(0.06, '#f6a6b8', 10), -0.03, -0.02, 0.022));
  frame.rotation.x = -0.15;
  group.add(at(frame, -0.45, 2.36, 0.02));
  return group;
}

/**
 * 三格书：每格一排高矮、厚薄、颜色不一的书，书脊上一道浅色的线；中间那格右边平躺着一摞
 * @param {Kit} kit
 * @param {THREE.Group} group 书架
 * @param {number[]} floors 每层隔板的高度
 * @param {number} inner 书架里面多宽
 */
function addBooks(kit, group, floors, inner) {
  const palette = ['#e85d5d', '#5d9ce8', '#f4c95d', '#7cc576', '#b38ee8', '#f6a6b8', '#5dc8c8', '#f4a259'];
  floors.forEach((floorY, shelfIndex) => {
    const base = floorY + 0.025;
    // 中间那格右边留给平放的一摞
    const end = shelfIndex === 1 ? inner / 2 - 0.42 : inner / 2 - 0.08;
    let x = -inner / 2 + 0.06;
    let index = shelfIndex * 5;
    while (x < end) {
      const thickness = 0.07 + ((index * 37) % 5) * 0.02;
      const height = 0.38 + ((index * 53) % 4) * 0.06;
      const color = palette[index % palette.length];
      const book = new THREE.Group();
      book.add(at(roundedPart(kit, thickness, height, 0.3, color, 0.015), 0, height / 2, 0));
      book.add(at(roundedPart(kit, thickness + 0.004, 0.025, 0.02, '#fff6dc', 0.004), 0, height * 0.82, 0.15));
      // 偶尔一本往旁边歪着靠
      const leaning = index % 7 === 3;
      if (leaning) {
        book.rotation.z = -0.2;
      }
      group.add(at(book, x + thickness / 2, base, 0.04));
      x += thickness + 0.012;
      index++;
    }
  });

  for (let i = 0; i < 3; i++) {
    const width = 0.34 - i * 0.03;
    group.add(at(roundedPart(kit, width, 0.06, 0.26, palette[(i * 3 + 1) % palette.length], 0.015), inner / 2 - 0.24 + i * 0.01, floors[1] + 0.055 + i * 0.062, 0.03));
  }
}

// ---------- 厨房 ----------

/**
 * 厨房台面：奶油色柜子，两扇薄荷绿的门（门芯凹进去一块）、木头圆把手，木头台面；
 * 台上一把橙色水壶、一瓶花、一块砧板上放着面包
 * @param {FurnitureKit} furniture
 * @returns {THREE.Group}
 */
export function kitchenCounter(furniture) {
  const { kit } = furniture;
  const group = new THREE.Group();
  group.add(at(furniture.woodBox(1.3, 0.08, 0.56, WOOD_DEEP, 0.02), 0, 0.04, -0.03));
  group.add(at(roundedPart(kit, 1.36, 0.78, 0.62, CREAM, 0.04), 0, 0.47, 0));
  for (const side of [-1, 1]) {
    group.add(at(roundedPart(kit, 0.6, 0.62, 0.03, '#d9eedf', 0.02), side * 0.33, 0.47, 0.315));
    group.add(at(roundedPart(kit, 0.44, 0.46, 0.02, '#c3e2cf', 0.015), side * 0.33, 0.47, 0.33));
    group.add(at(furniture.woodMesh(new THREE.SphereGeometry(0.035, 12, 8), WOOD_DARK), side * 0.07, 0.62, 0.35));
  }
  group.add(at(furniture.woodBox(1.5, 0.07, 0.78, WOOD, 0.025), 0, 0.895, 0));

  group.add(at(kettle(kit), 0.42, 0.93, 0));
  // 一瓶花
  group.add(at(kit.cyl(0.07, 0.09, 0.2, '#5d9ce8', 14), -0.42, 1.03, 0.05));
  for (let i = 0; i < 3; i++) {
    const tilt = (i - 1) * 0.25;
    group.add(at(kit.cyl(0.008, 0.008, 0.2, '#5fae55', 4), -0.42 + Math.sin(tilt) * 0.06, 1.18, 0.05));
    group.add(at(kit.sphere(0.055, ['#f6a6b8', '#ffd84a', '#ffffff'][i], 10), -0.42 + Math.sin(tilt) * 0.12, 1.27 + (i % 2) * 0.05, 0.05));
  }
  // 砧板上一条面包
  group.add(at(furniture.woodBox(0.4, 0.03, 0.26, WOOD_LIGHT, 0.012), -0.02, 0.945, 0.1));
  const loaf = kit.sphere(0.1, '#e3a45e', 14);
  loaf.scale.set(1.5, 0.75, 0.9);
  group.add(at(loaf, -0.02, 1.0, 0.1));
  return group;
}

/**
 * 橙色圆水壶：壶身、壶盖、壶嘴，顶上一道提手
 * @param {Kit} kit
 * @returns {THREE.Group} 原点在壶底
 */
function kettle(kit) {
  const group = new THREE.Group();
  const body = kit.sphere(0.14, '#f4a259', 16);
  body.scale.y = 0.85;
  group.add(at(body, 0, 0.12, 0));
  group.add(at(kit.cyl(0.07, 0.08, 0.03, '#f4a259', 14), 0, 0.23, 0));
  group.add(at(kit.sphere(0.025, '#6b4f3a', 8), 0, 0.26, 0));
  const spout = kit.cyl(0.018, 0.03, 0.14, '#f4a259', 8);
  spout.rotation.z = -0.9;
  group.add(at(spout, 0.15, 0.15, 0));
  const handle = kit.mesh(new THREE.TorusGeometry(0.1, 0.014, 6, 16, Math.PI), '#6b4f3a');
  group.add(at(handle, 0, 0.22, 0));
  return group;
}

/**
 * 复古冰箱：圆圆的薄荷绿箱子，上下两扇门微微鼓出来，银色把手，四只小脚；门上贴着冰箱贴和一张便条
 * @description 每个网格都会被标成"点了打开冰箱"，在 furniture.js 里做
 * @param {FurnitureKit} furniture
 * @returns {THREE.Group}
 */
export function fridge(furniture) {
  const { kit } = furniture;
  const group = new THREE.Group();
  const chrome = { metalness: 0.5, roughness: 0.3 };
  for (const [x, z] of [[-0.38, -0.36], [0.38, -0.36], [-0.38, 0.36], [0.38, 0.36]]) {
    group.add(at(kit.cyl(0.05, 0.04, 0.07, '#6b6f78', 10), x, 0.035, z));
  }
  group.add(at(roundedPart(kit, 1.0, 2.22, 0.95, '#c4e6da', 0.14), 0, 1.18, 0));
  // 上面冷冻室的门、下面冷藏室的门，比箱子鼓出来一点
  group.add(at(roundedPart(kit, 0.92, 0.62, 0.05, '#cdebe0', 0.07), 0, 1.92, 0.47));
  group.add(at(roundedPart(kit, 0.92, 1.4, 0.05, '#cdebe0', 0.07), 0, 0.86, 0.47));
  // 把手：一根竖着的银条，两头各一个小托
  for (const [y, length] of [[1.86, 0.34], [1.2, 0.5]]) {
    group.add(at(roundedPart(kit, 0.05, length, 0.05, '#e6eef0', 0.02, chrome), -0.36, y, 0.54));
    for (const end of [-1, 1]) {
      group.add(at(roundedPart(kit, 0.04, 0.04, 0.06, '#e6eef0', 0.015, chrome), -0.36, y + end * (length / 2 - 0.04), 0.51));
    }
  }
  // 冷冻室门上一块小金牌
  const badge = kit.cyl(0.07, 0.07, 0.01, BRASS, 16, chrome);
  badge.rotation.x = Math.PI / 2;
  badge.scale.x = 1.6;
  group.add(at(badge, 0.22, 2.1, 0.5));

  // 冰箱贴，一张用冰箱贴压着的便条
  const magnetColors = ['#f4a259', '#e85d5d', '#5d9ce8', '#ffd84a', '#b38ee8'];
  magnetColors.forEach((color, index) => {
    const round = index % 2 === 0;
    const magnet = round ? kit.cyl(0.07, 0.07, 0.04, color, 14) : roundedPart(kit, 0.13, 0.13, 0.04, color, 0.02);
    if (round) {
      magnet.rotation.x = Math.PI / 2;
    }
    magnet.position.set(-0.1 + (index % 3) * 0.2, 1.62 + Math.floor(index / 3) * 0.22 + (index % 2) * 0.05, 0.5);
    magnet.rotation.z = (index - 2) * 0.15;
    group.add(magnet);
  });
  const note = roundedPart(kit, 0.17, 0.21, 0.005, '#fffaf0', 0.002);
  note.rotation.z = 0.12;
  group.add(at(note, 0.18, 1.18, 0.5));
  group.add(at(kit.sphere(0.03, '#e85d5d', 10), 0.16, 1.27, 0.505));
  return group;
}

// ---------- 茶桌、凳子、地毯 ----------

/**
 * 圆茶桌：厚厚的圆桌面带一圈圆边，车出来的桌腿，喇叭口底座；桌上一块花边垫布、一套茶壶茶杯、一盘饼干
 * @param {FurnitureKit} furniture
 * @returns {{ group: THREE.Group, spout: THREE.Mesh }} spout 是茶壶嘴（冒热气的地方）
 */
export function teaTable(furniture) {
  const { kit } = furniture;
  const group = new THREE.Group();
  group.add(at(furniture.woodCylinder(0.79, 0.79, 0.07, WOOD, 40), 0, 0.69, 0));
  const rim = furniture.woodMesh(new THREE.TorusGeometry(0.79, 0.036, 8, 48), WOOD);
  rim.rotation.x = Math.PI / 2;
  group.add(at(rim, 0, 0.69, 0));
  group.add(at(furniture.woodCylinder(0.6, 0.6, 0.07, WOOD_DARK, 32), 0, 0.62, 0));

  // 车出来的桌腿：一节粗一节细
  const leg = [[0.06, 0.08], [0.11, 0.12], [0.07, 0.2], [0.06, 0.32], [0.1, 0.4], [0.06, 0.48], [0.07, 0.56], [0.1, 0.6]];
  group.add(furniture.woodMesh(new THREE.LatheGeometry(leg.map(([radius, y]) => new THREE.Vector2(radius, y)), 16), WOOD_DARK));
  const foot = [[0.001, 0.0], [0.4, 0.0], [0.38, 0.04], [0.18, 0.08], [0.08, 0.1]];
  group.add(furniture.woodMesh(new THREE.LatheGeometry(foot.map(([radius, y]) => new THREE.Vector2(radius, y)), 24), WOOD_DARK));

  group.add(at(doily(kit), 0.05, 0.727, 0.02));
  const { teapot, spout } = teapotSet(kit);
  group.add(at(teapot, 0.1, 0.73, 0.05));
  for (const [x, z] of [[-0.35, 0.2], [-0.15, -0.35]]) {
    group.add(at(teacup(kit), x, 0.727, z));
  }
  group.add(at(kit.cyl(0.16, 0.13, 0.02, '#ffffff', 18), 0.35, 0.737, -0.25));
  for (let i = 0; i < 3; i++) {
    const cookie = new THREE.Group();
    cookie.add(kit.cyl(0.045, 0.045, 0.02, '#d9a066', 12));
    for (const [x, z] of [[0.015, 0.01], [-0.015, 0.015], [0.0, -0.018]]) {
      cookie.add(at(kit.sphere(0.009, '#6b4f3a', 6), x, 0.01, z));
    }
    group.add(at(cookie, 0.3 + i * 0.05, 0.76 + (i % 2) * 0.012, -0.25 + (i % 2) * 0.06));
  }
  return { group, spout };
}

/**
 * 桌上的花边垫布：一圈波浪边的白圆片
 * @param {Kit} kit
 * @returns {THREE.Mesh}
 */
function doily(kit) {
  const geometry = new THREE.CircleGeometry(0.3, 48).rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position');
  for (let i = 1; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const scallop = 1 + 0.07 * Math.cos(Math.atan2(z, x) * 12);
    position.setXYZ(i, x * scallop, 0, z * scallop);
  }
  const cloth = kit.mesh(geometry, '#fffdf7');
  cloth.castShadow = false;
  return cloth;
}

/**
 * 白瓷茶壶：圆壶身中间一道粉边，粉色壶盖，壶嘴、把手
 * @param {Kit} kit
 * @returns {{ teapot: THREE.Group, spout: THREE.Mesh }} 原点在壶底；spout 的 +y 那头是壶嘴口
 */
function teapotSet(kit) {
  const teapot = new THREE.Group();
  const body = kit.sphere(0.15, '#ffffff', 18);
  body.scale.y = 0.8;
  teapot.add(at(body, 0, 0.11, 0));
  const band = kit.torus(0.148, 0.012, '#f6a6b8');
  band.rotation.x = Math.PI / 2;
  teapot.add(at(band, 0, 0.11, 0));
  teapot.add(at(kit.dome(0.075, '#f6a6b8', Math.PI / 2, 14), 0, 0.21, 0));
  teapot.add(at(kit.sphere(0.025, '#f6a6b8', 8), 0, 0.29, 0));
  const spout = kit.cyl(0.02, 0.035, 0.18, '#ffffff', 8);
  spout.rotation.z = -0.9;
  teapot.add(at(spout, 0.18, 0.15, 0));
  const handle = kit.mesh(new THREE.TorusGeometry(0.075, 0.016, 6, 14, Math.PI), '#ffffff');
  handle.rotation.z = Math.PI / 2;
  teapot.add(at(handle, -0.15, 0.12, 0));
  return { teapot, spout };
}

/**
 * 一只茶杯：小碟子、杯身、茶面、把手
 * @param {Kit} kit
 * @returns {THREE.Group} 原点在碟子底
 */
function teacup(kit) {
  const cup = new THREE.Group();
  cup.add(at(kit.cyl(0.1, 0.09, 0.015, '#ffffff', 16), 0, 0.008, 0));
  cup.add(at(kit.cyl(0.065, 0.05, 0.09, '#ffffff', 14), 0, 0.06, 0));
  cup.add(at(kit.cyl(0.058, 0.058, 0.005, '#b37a4c', 14), 0, 0.1, 0));
  const handle = kit.torus(0.025, 0.008, '#ffffff');
  cup.add(at(handle, 0.072, 0.06, 0));
  return cup;
}

/**
 * 小凳子：四条往外撇的腿，中间一圈横撑，木头凳面上一个鼓鼓的毛线坐垫，中间一颗扣子
 * @param {FurnitureKit} furniture
 * @param {string} color 坐垫的颜色
 * @returns {THREE.Group} 坐垫顶差不多在 0.45 高
 */
export function stool(furniture, color) {
  const { kit } = furniture;
  const group = new THREE.Group();
  const splay = 0.12;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = furniture.woodCylinder(0.024, 0.03, 0.38, WOOD_DARK, 8);
    // 腿顶往里收：在 +x 边的腿绕 z 转，在 +z 边的腿绕 x 反着转
    leg.rotation.z = splay * Math.cos(angle);
    leg.rotation.x = -splay * Math.sin(angle);
    group.add(at(leg, Math.cos(angle) * 0.16, 0.19, Math.sin(angle) * 0.16));
  }
  const rung = furniture.woodMesh(new THREE.TorusGeometry(0.17, 0.014, 6, 24), WOOD_DARK);
  rung.rotation.x = Math.PI / 2;
  group.add(at(rung, 0, 0.13, 0));
  group.add(at(furniture.woodCylinder(0.24, 0.22, 0.05, WOOD, 24), 0, 0.37, 0));

  group.add(at(furniture.knit(new THREE.SphereGeometry(0.23, 22, 12).scale(1, 0.24, 1), color), 0, 0.42, 0));
  group.add(at(kit.sphere(0.022, '#fffaf0', 8), 0, 0.475, 0));
  return group;
}

/**
 * 编织的圆地毯：一整块，一圈圈的颜色和辫子纹画在顶面上
 * @param {FurnitureKit} furniture
 * @param {number} radius 多大
 * @returns {THREE.Mesh}
 */
export function braidedRug(furniture, radius) {
  const { kit } = furniture;
  // 圆柱的三组面依次是侧面、顶面、底面：顶面铺地毯花纹，侧面是最外圈的颜色
  const edge = kit.m('#e9a98b');
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.03, 64), [edge, furniture.rug, edge]);
  rug.receiveShadow = true;
  return rug;
}

// ---------- 墙边的东西 ----------

/**
 * 大盆栽：赤陶盆带一圈白边和盆沿，下面一个托盘；土上一丛宽叶子的植物，叶子一片片往外伸
 * @description 盆里的土面在 0.575 高（红蘑菇藏在土上）
 * @param {FurnitureKit} furniture
 * @returns {THREE.Group}
 */
export function bigPlant(furniture) {
  const { kit } = furniture;
  const group = new THREE.Group();
  group.add(at(kit.cyl(0.36, 0.32, 0.05, '#c9654d', 24), 0, 0.025, 0));
  group.add(at(kit.cyl(0.39, 0.29, 0.46, '#e07a5f', 24), 0, 0.28, 0));
  group.add(at(kit.cyl(0.44, 0.41, 0.1, '#e88a6f', 24), 0, 0.52, 0));
  const band = kit.torus(0.355, 0.018, '#fff1c9');
  band.rotation.x = Math.PI / 2;
  group.add(at(band, 0, 0.3, 0));
  // 土面比盆口高一点，贴在同一高度会闪
  group.add(at(kit.cyl(0.4, 0.4, 0.04, '#7a5236', 24), 0, 0.555, 0));

  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.2, 0.1, 0.22, 0.38, 0, 0.52);
  leafShape.bezierCurveTo(-0.22, 0.38, -0.2, 0.1, 0, 0);
  const leafGeometry = new THREE.ShapeGeometry(leafShape, 8);
  // 叶子往中间凹一点，像真的叶片
  const position = leafGeometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    position.setZ(i, position.getX(i) ** 2 * 1.6);
  }
  leafGeometry.computeVertexNormals();

  const greens = ['#5fae55', '#7cc576', '#4f9a4a'];
  // 叶子多、茎短、往外撇：一大丛，不是一把细棍子
  const leaves = 13;
  const leafScale = 1.35;
  for (let i = 0; i < leaves; i++) {
    // 黄金角绕一圈，叶子不会排成整齐的一圈；靠中间的茎直一点、高一点
    const around = i * 2.4;
    const lean = 0.3 + ((i * 37) % 10) / 15;
    const length = 0.75 - lean * 0.35 + ((i * 53) % 10) / 40;
    const pivot = new THREE.Group();
    pivot.rotation.y = around;
    const stem = kit.cyl(0.012, 0.018, length, '#6b8f4a', 5);
    stem.rotation.x = lean;
    stem.position.set(0, Math.cos(lean) * length / 2, Math.sin(lean) * length / 2);
    pivot.add(stem);
    const leaf = kit.mesh(leafGeometry, greens[i % greens.length], { side: THREE.DoubleSide });
    leaf.scale.setScalar(leafScale);
    leaf.rotation.x = lean + 0.35;
    leaf.position.set(0, Math.cos(lean) * length, Math.sin(lean) * length);
    pivot.add(leaf);
    group.add(at(pivot, 0, 0.575, 0));
  }
  return group;
}

/**
 * 收音机柜：带小腿的矮木柜，两扇门、木头把手；柜上一台红色复古收音机，旁边一盆小仙人掌
 * @param {FurnitureKit} furniture
 * @returns {{ group: THREE.Group, radio: THREE.Group }} radio 的原点在收音机中心（音符从它上面冒出来）
 */
export function radioCabinet(furniture) {
  const { kit } = furniture;
  const group = new THREE.Group();
  for (const [x, z] of [[-0.48, -0.22], [0.48, -0.22], [-0.48, 0.22], [0.48, 0.22]]) {
    group.add(at(furniture.woodCylinder(0.03, 0.02, 0.12, WOOD_DARK, 8), x, 0.06, z));
  }
  group.add(at(furniture.woodBox(1.06, 0.56, 0.56, WOOD, 0.04), 0, 0.4, 0));
  group.add(at(furniture.woodBox(1.12, 0.05, 0.62, WOOD_DARK, 0.02), 0, 0.705, 0));
  for (const side of [-1, 1]) {
    group.add(at(furniture.woodBox(0.46, 0.44, 0.03, WOOD_LIGHT, 0.02), side * 0.25, 0.4, 0.285));
    group.add(at(furniture.woodMesh(new THREE.SphereGeometry(0.03, 10, 8), WOOD_DARK), side * 0.06, 0.42, 0.31));
  }

  const radio = retroRadio(kit);
  group.add(at(radio, 0, 0.88, 0));
  group.add(at(kit.cyl(0.06, 0.05, 0.08, '#e07a5f', 12), -0.4, 0.77, 0.05));
  const cactus = kit.sphere(0.05, '#6fb85a', 10);
  cactus.scale.y = 1.6;
  group.add(at(cactus, -0.4, 0.86, 0.05));
  group.add(at(kit.sphere(0.018, '#f6a6b8', 6), -0.4, 0.94, 0.05));
  return { group, radio };
}

/**
 * 红色复古收音机：圆角的机身，一个圆喇叭（一圈圈的网罩），奶油色的刻度窗和指针，两个旋钮，顶上提手和天线
 * @param {Kit} kit
 * @returns {THREE.Group} 原点在机身中心，正面朝 +z
 */
function retroRadio(kit) {
  const radio = new THREE.Group();
  radio.add(roundedPart(kit, 0.6, 0.3, 0.32, '#e85d5d', 0.07));
  const front = 0.165;
  const speaker = kit.cyl(0.1, 0.1, 0.02, '#6b4f3a', 18);
  speaker.rotation.x = Math.PI / 2;
  radio.add(at(speaker, -0.13, 0, front));
  for (const radius of [0.035, 0.065, 0.09]) {
    radio.add(at(kit.torus(radius, 0.007, '#c9a46a'), -0.13, 0, front + 0.012));
  }
  radio.add(at(roundedPart(kit, 0.2, 0.08, 0.02, '#fff6dc', 0.01), 0.13, 0.05, front));
  radio.add(at(roundedPart(kit, 0.008, 0.06, 0.01, '#e85d5d', 0.002), 0.1, 0.05, front + 0.012));
  for (const x of [0.07, 0.19]) {
    const knob = kit.cyl(0.03, 0.03, 0.03, '#fff6dc', 12);
    knob.rotation.x = Math.PI / 2;
    radio.add(at(knob, x, -0.07, front));
  }
  radio.add(at(kit.mesh(new THREE.TorusGeometry(0.15, 0.018, 6, 16, Math.PI), '#6b4f3a'), 0, 0.15, 0));
  const antenna = kit.cyl(0.006, 0.006, 0.4, '#b8bcc4', 6);
  antenna.rotation.z = -0.5;
  radio.add(at(antenna, 0.32, 0.3, -0.08));
  return radio;
}

/**
 * 藤编的毛线篮：编织纹的篮身、一圈篮沿、一道提手，里面三团毛线，一团上插着两根毛衣针
 * @param {FurnitureKit} furniture
 * @returns {THREE.Group}
 */
export function yarnBasket(furniture) {
  const { kit } = furniture;
  const group = new THREE.Group();
  group.add(at(furniture.weave(new THREE.CylinderGeometry(0.32, 0.26, 0.3, 24), '#d9b380'), 0, 0.15, 0));
  const rim = kit.torus(0.32, 0.03, '#c49a63');
  rim.rotation.x = Math.PI / 2;
  group.add(at(rim, 0, 0.3, 0));
  group.add(at(kit.mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 20, Math.PI), '#c49a63'), 0, 0.3, 0));

  for (const [x, z, color] of [[-0.1, 0.05, '#f6a6b8'], [0.1, -0.05, '#8ec5e8'], [0, 0.12, '#ffd84a']]) {
    group.add(at(yarnBall(kit, 0.13, color), x, 0.32, z));
  }
  for (const tilt of [-0.4, 0.3]) {
    const needle = kit.cyl(0.008, 0.008, 0.36, '#b8bcc4', 6);
    needle.rotation.z = tilt;
    group.add(at(needle, -0.1 + tilt * 0.1, 0.48, 0.05));
    group.add(at(kit.sphere(0.02, '#e85d5d', 8), -0.1 + tilt * 0.1 - Math.sin(tilt) * 0.18, 0.48 + Math.cos(tilt) * 0.18, 0.05));
  }
  return group;
}

/**
 * 一团毛线：圆球上斜着缠几圈线
 * @param {Kit} kit
 * @param {number} radius 多大
 * @param {string} color 毛线颜色
 * @returns {THREE.Group} 原点在球心
 */
export function yarnBall(kit, radius, color) {
  const ball = new THREE.Group();
  ball.add(kit.sphere(radius, color, 14));
  const strand = new THREE.Color(color).offsetHSL(0, 0, -0.06);
  for (const tilt of [0.5, -0.7, 1.4]) {
    const loop = kit.torus(radius * 0.98, radius * 0.12, `#${strand.getHexString()}`);
    loop.rotation.set(tilt, tilt * 0.6, 0);
    ball.add(loop);
  }
  return ball;
}

/**
 * 一双拖鞋：圆头的鞋面，鞋头一颗毛绒球，一只稍微歪一点
 * @param {Kit} kit
 * @returns {THREE.Group}
 */
export function slippers(kit) {
  const pair = new THREE.Group();
  for (const side of [-1, 1]) {
    const slipper = new THREE.Group();
    slipper.add(at(roundedPart(kit, 0.17, 0.04, 0.34, '#f4a259', 0.02), 0, 0.02, 0));
    const toe = kit.dome(0.09, '#f7b77a', Math.PI / 2, 14);
    toe.scale.set(1, 0.7, 1.3);
    slipper.add(at(toe, 0, 0.04, 0.06));
    slipper.add(at(kit.sphere(0.035, '#ffffff', 10), 0, 0.1, 0.1));
    slipper.rotation.y = side * 0.15;
    pair.add(at(slipper, side * 0.12, 0, 0));
  }
  return pair;
}
