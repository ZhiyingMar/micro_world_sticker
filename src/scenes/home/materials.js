// 小屋家具共用的材质：和地板一样的木纹、拼布被子、毛线坐垫、编织地毯、藤编篮子
// 家具和地板用同一种"画出来的"质感，看着才像一个游戏里的东西；纯色方块会显得像另一套素材
// 贴图都是白底的花纹，颜色由材质染上去：一张木纹图能染出浅木头、深木头
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture, rng } from '../../kit.js';

// 圆角小于这个就当成直角（省三角形）；最薄一边比这个小的算小零件，圆角少分几段
const SHARP_RADIUS = 0.006;
const SMALL_PART = 0.12;

// 木纹：一张图铺多大一块（单位），图多大（像素），几道木纹，木纹多深、多透明，弯得多厉害
const WOOD_TILE = 0.8;
const WOOD_PX = 256;
const GRAIN_LINES = 13;
const GRAIN_DARKEN = 0.78;
const GRAIN_ALPHA = 0.32;
const GRAIN_WAVE = 3;
// 木头上一道道深浅不一的宽色带，有几条、多深
const TONE_BANDS = 5;
const TONE_ALPHA = 0.06;
const WOOD_SEED = 9;

// 布料：一张图铺多大一块（单位），图多大（像素）
const QUILT_TILE = 0.5;
const KNIT_TILE = 0.25;
const WEAVE_TILE = 0.18;
const FABRIC_PX = 128;
// 拼布被子四小块的颜色，缝线的颜色
const QUILT_COLORS = ['#8ec5e8', '#cfe8f7', '#f6c6d0', '#fff1c9'];
const STITCH_COLOR = 'rgba(255,255,255,0.85)';
// 编织地毯：一圈圈的颜色（从外往里），一圈多宽（占半径的比例），图多大
const RUG_RINGS = ['#e9a98b', '#f7c6a3', '#fff3e3', '#f3b6a0', '#fbe1c6', '#e9a98b', '#fff3e3', '#f7c6a3'];
const RUG_PX = 512;
// 辫子纹斜多少（弧度）
const BRAID_SLANT = 0.12;

/**
 * @typedef {object} FurnitureKit 造家具用的工具：造型工具箱加上一套共用材质
 * @property {Kit} kit 世界的造型工具箱
 * @property {(width: number, height: number, depth: number, tone: string, radius?: number) => THREE.Mesh} woodBox 一块木头（木纹顺着长边）
 * @property {(top: number, bottom: number, height: number, tone: string, segments?: number) => THREE.Mesh} woodCylinder 一根木头圆柱（木纹竖着）
 * @property {(geometry: THREE.BufferGeometry, tone: string) => THREE.Mesh} woodMesh 任意形状的木头（车出来的桌腿……）
 * @property {(width: number, height: number, depth: number, radius: number) => THREE.Mesh} quilt 拼布被子
 * @property {(geometry: THREE.BufferGeometry, color: string) => THREE.Mesh} knit 毛线织物（坐垫）
 * @property {(geometry: THREE.BufferGeometry, color: string) => THREE.Mesh} weave 藤编（篮子）
 * @property {THREE.Material} rug 编织地毯（贴在圆柱顶面上）
 */

/**
 * 准备好这个世界造家具用的材质
 * @description 贴图登记在世界里，离开小屋时一起释放；同一种颜色的材质只做一份
 * @param {World} world 小屋这个世界
 * @returns {FurnitureKit}
 */
export function createFurnitureKit(world) {
  const kit = world.kit;
  const grain = world.texture(canvasTexture(WOOD_PX, WOOD_PX, paintWoodGrain, { repeat: [1, 1] }));
  const knitMap = world.texture(canvasTexture(FABRIC_PX, FABRIC_PX, paintKnit, { repeat: [1, 1] }));
  const weaveMap = world.texture(canvasTexture(FABRIC_PX, FABRIC_PX, paintWeave, { repeat: [1, 1] }));
  const quiltMaterial = new THREE.MeshStandardMaterial({ map: world.texture(canvasTexture(FABRIC_PX, FABRIC_PX, paintQuilt, { repeat: [1, 1] })), roughness: 0.95 });
  const rug = new THREE.MeshStandardMaterial({ map: world.texture(canvasTexture(RUG_PX, RUG_PX, paintRug)), roughness: 0.95 });

  const woodMaterial = cachedBy((tone) => new THREE.MeshStandardMaterial({ color: tone, map: grain, roughness: 0.7 }));
  const knitMaterial = cachedBy((color) => new THREE.MeshStandardMaterial({ color, map: knitMap, roughness: 0.95 }));
  const weaveMaterial = cachedBy((color) => new THREE.MeshStandardMaterial({ color, map: weaveMap, roughness: 0.9 }));

  /**
   * 给一个形状套上材质，贴图按大小铺
   * @param {THREE.BufferGeometry} geometry
   * @param {THREE.Material} material
   * @param {number} tile 贴图一块铺多大（单位）
   * @returns {THREE.Mesh}
   */
  const dressed = (geometry, material, tile) => {
    projectUVs(geometry, tile);
    return kit.mesh(geometry, material);
  };

  return {
    kit,
    woodBox: (width, height, depth, tone, radius = 0.03) => dressed(roundedBox(width, height, depth, radius), woodMaterial(tone), WOOD_TILE),
    woodCylinder: (top, bottom, height, tone, segments = 16) => dressed(new THREE.CylinderGeometry(top, bottom, height, segments), woodMaterial(tone), WOOD_TILE),
    woodMesh: (geometry, tone) => dressed(geometry, woodMaterial(tone), WOOD_TILE),
    quilt: (width, height, depth, radius) => dressed(roundedBox(width, height, depth, radius), quiltMaterial, QUILT_TILE),
    knit: (geometry, color) => dressed(geometry, knitMaterial(color), KNIT_TILE),
    weave: (geometry, color) => dressed(geometry, weaveMaterial(color), WEAVE_TILE),
    rug,
  };
}

/**
 * 圆角方块的形状（圆角不超过最薄那一边的一半）
 * @description 圆角分几段看东西多大：小零件一段就够圆，大件两段；分三段的话一个方块近 600 个三角形，屋里几百个零件加起来太多
 * @param {number} width
 * @param {number} height
 * @param {number} depth
 * @param {number} radius 圆角半径
 * @returns {THREE.BufferGeometry}
 */
export function roundedBox(width, height, depth, radius) {
  const fitted = Math.min(radius, width / 2 - 0.001, height / 2 - 0.001, depth / 2 - 0.001);
  if (fitted < SHARP_RADIUS) {
    return new THREE.BoxGeometry(width, height, depth);
  }
  const thinnest = Math.min(width, height, depth);
  const segments = thinnest < SMALL_PART ? 1 : 2;
  return new RoundedBoxGeometry(width, height, depth, segments, fitted);
}

/**
 * 一个圆角方块零件（不是木头的：漆面、布、瓷……）
 * @param {Kit} kit 造型工具箱
 * @param {number} width
 * @param {number} height
 * @param {number} depth
 * @param {string | THREE.Material} color 颜色或材质
 * @param {number} [radius] 圆角半径
 * @param {object} [options] 材质的其他设置（金属感、发光……）
 * @returns {THREE.Mesh}
 */
export function roundedPart(kit, width, height, depth, color, radius = 0.02, options) {
  return kit.mesh(roundedBox(width, height, depth, radius), color, options);
}

/**
 * 按一个键缓存造出来的东西：同一种颜色只做一份材质
 * @param {(key: string) => THREE.Material} make 怎么造
 * @returns {(key: string) => THREE.Material}
 */
function cachedBy(make) {
  const cache = new Map();
  return (key) => {
    if (!cache.has(key)) {
      cache.set(key, make(key));
    }
    return cache.get(key);
  };
}

/**
 * 按位置给形状重新算贴图坐标：每个面按它朝哪边，投到另外两个方向上
 * @description 不管木块多大，木纹都一样密；而且木纹顺着这一面比较长的那个方向走，桌腿的纹是竖的，桌面的纹是横的
 * @param {THREE.BufferGeometry} geometry
 * @param {number} tile 贴图一块铺多大（单位）
 */
export function projectUVs(geometry, tile) {
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const axes = ['x', 'y', 'z'];
  const point = new THREE.Vector3();
  const facing = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    facing.fromBufferAttribute(normal, i).set(Math.abs(facing.x), Math.abs(facing.y), Math.abs(facing.z));
    // 这一面朝着的那个方向不用，剩下两个方向铺贴图
    let faceAxis = 'z';
    if (facing.x >= facing.y && facing.x >= facing.z) {
      faceAxis = 'x';
    } else if (facing.y >= facing.z) {
      faceAxis = 'y';
    }
    const [first, second] = axes.filter((axis) => axis !== faceAxis);
    // 木纹（贴图的横向）顺着长的那个方向
    const firstIsLonger = size[first] >= size[second];
    const along = firstIsLonger ? first : second;
    const across = firstIsLonger ? second : first;
    uv.setXY(i, point[along] / tile, point[across] / tile);
  }
  uv.needsUpdate = true;
}

// ---------- 画贴图 ----------

/**
 * 木纹：白底上一道道弯弯的深色细纹，几条深浅不一的宽色带；左右上下都能接上
 * @param {CanvasRenderingContext2D} context 画布
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 */
function paintWoodGrain(context, width, height) {
  const random = rng(WOOD_SEED);
  context.fillStyle = '#fffaf3';
  context.fillRect(0, 0, width, height);

  const grain = Math.round(255 * GRAIN_DARKEN);
  for (let i = 0; i < TONE_BANDS; i++) {
    context.fillStyle = `rgba(${grain},${grain - 20},${grain - 40},${TONE_ALPHA})`;
    context.fillRect(0, random() * height, width, height * (0.05 + random() * 0.12));
  }

  context.lineWidth = Math.max(1, height / 160);
  for (let i = 0; i < GRAIN_LINES; i++) {
    const baseY = ((i + random() * 0.6) / GRAIN_LINES) * height;
    const wave = GRAIN_WAVE * (0.5 + random());
    // 一整圈正好是整数个波，左右两头接得上
    const cycles = 1 + Math.floor(random() * 2);
    const phase = random() * Math.PI * 2;
    const alpha = GRAIN_ALPHA * (0.5 + random() * 0.5);
    context.strokeStyle = `rgba(${grain - 40},${grain - 70},${grain - 100},${alpha})`;
    // 靠上下边的纹在另一头再画一遍，上下也接得上
    for (const shift of [-height, 0, height]) {
      context.beginPath();
      for (let x = 0; x <= width; x += 4) {
        const y = baseY + shift + Math.sin(phase + (x / width) * Math.PI * 2 * cycles) * wave;
        if (x === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.stroke();
    }
  }
}

/**
 * 拼布被子：四块颜色的小方块，四边一圈白色虚线缝线
 * @param {CanvasRenderingContext2D} context 画布
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 */
function paintQuilt(context, width, height) {
  const half = width / 2;
  QUILT_COLORS.forEach((color, index) => {
    context.fillStyle = color;
    context.fillRect((index % 2) * half, Math.floor(index / 2) * half, half, half);
  });

  // 每块中间一颗小星花，四周虚线缝线
  context.fillStyle = 'rgba(255,255,255,0.7)';
  for (let index = 0; index < 4; index++) {
    const centerX = (index % 2) * half + half / 2;
    const centerY = Math.floor(index / 2) * half + half / 2;
    context.beginPath();
    context.arc(centerX, centerY, half * 0.08, 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = STITCH_COLOR;
  context.lineWidth = 2;
  context.setLineDash([5, 4]);
  for (const line of [3, half - 3, half + 3, width - 3]) {
    context.beginPath();
    context.moveTo(line, 0);
    context.lineTo(line, height);
    context.moveTo(0, line);
    context.lineTo(width, line);
    context.stroke();
  }
  context.setLineDash([]);
}

/**
 * 毛线织物：一排排小 V 字的针脚
 * @param {CanvasRenderingContext2D} context 画布
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 */
function paintKnit(context, width, height) {
  const stitch = width / 8;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(120,100,90,0.22)';
  context.lineWidth = stitch * 0.22;
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      const left = column * stitch;
      const top = row * stitch;
      context.beginPath();
      context.moveTo(left + stitch * 0.1, top + stitch * 0.15);
      context.lineTo(left + stitch * 0.5, top + stitch * 0.85);
      context.lineTo(left + stitch * 0.9, top + stitch * 0.15);
      context.stroke();
    }
  }
}

/**
 * 藤编：横竖交替的一小片一小片
 * @param {CanvasRenderingContext2D} context 画布
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 */
function paintWeave(context, width, height) {
  const cell = width / 4;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      const horizontal = (row + column) % 2 === 0;
      const left = column * cell;
      const top = row * cell;
      context.fillStyle = 'rgba(110,80,50,0.18)';
      for (let strand = 0; strand < 3; strand++) {
        const offset = (strand + 0.5) * (cell / 3);
        if (horizontal) {
          context.fillRect(left + 2, top + offset - 2, cell - 4, 3);
        } else {
          context.fillRect(left + offset - 2, top + 2, 3, cell - 4);
        }
      }
      context.strokeStyle = 'rgba(90,60,35,0.25)';
      context.strokeRect(left + 0.5, top + 0.5, cell - 1, cell - 1);
    }
  }
}

/**
 * 编织地毯：从外往里一圈圈不同的颜色，每圈上一排斜斜的辫子纹
 * @description 贴在圆柱的顶面上：圆柱顶面的贴图坐标是以中心为圆心的，画成同心圆正好
 * @param {CanvasRenderingContext2D} context 画布
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 */
function paintRug(context, width, height) {
  const center = width / 2;
  const ringWidth = center / RUG_RINGS.length;
  context.fillStyle = RUG_RINGS[RUG_RINGS.length - 1];
  context.fillRect(0, 0, width, height);

  RUG_RINGS.forEach((color, index) => {
    const outer = center - index * ringWidth;
    context.fillStyle = color;
    context.beginPath();
    context.arc(center, center, outer, 0, Math.PI * 2);
    context.fill();

    // 辫子纹：沿着这一圈排一圈短斜线
    const middle = outer - ringWidth / 2;
    const braids = Math.max(8, Math.round((Math.PI * 2 * middle) / (ringWidth * 0.9)));
    context.strokeStyle = 'rgba(120,70,50,0.18)';
    context.lineWidth = ringWidth * 0.18;
    for (let i = 0; i < braids; i++) {
      const angle = (i / braids) * Math.PI * 2;
      const inner = middle - ringWidth * 0.35;
      const outerEnd = middle + ringWidth * 0.35;
      context.beginPath();
      context.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
      context.lineTo(center + Math.cos(angle + BRAID_SLANT) * outerEnd, center + Math.sin(angle + BRAID_SLANT) * outerEnd);
      context.stroke();
    }
  });
}
