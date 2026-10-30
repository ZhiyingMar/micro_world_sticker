// 夜都地面、墙面用的贴图：都是用画布现画的，按世界坐标铺（一张贴图盖好几格），看不出一格一格的接缝
//   人行道的方砖、后巷的水泥板、观景台的陶土砖、公园的草、马路的沥青、挡土墙的石块、方块侧面的土层
// 只管画出来是什么样；铺在哪、怎么铺由 ground.js 和 street.js 决定
import * as THREE from 'three';
import { canvasTexture, rng } from '../../kit.js';
import { shade, speckle, wrapCopies, crack, bricks } from './paint.js';

// 地面贴图一张盖多大（世界单位）、多少像素：每单位 128 像素，拉近玩的时候砖缝也是清楚的
export const GROUND_TILE = 4;
const GROUND_PX = 512;
const PX_PER_UNIT = GROUND_PX / GROUND_TILE;

// 墙面贴图一张盖多宽（世界单位）
export const WALL_TILE = 2;
const WALL_PX = 256;
const WALL_PX_PER_UNIT = WALL_PX / WALL_TILE;

// 方块侧面的土层：贴图从多低画到多高（世界 y），竖着多少像素
export const STRATA_BOTTOM = -1.5;
export const STRATA_TOP = 1.1;
const STRATA_PX_HIGH = 512;
// 土层从上往下：比这个 y 高的是什么颜色（公园土坡露在外面的是表土，地面以下一层碎石垫层，再往下是几层土，最底下是石头）
// 夜里侧面背着月光，颜色要画亮一些、深浅交替，才看得出一层层的
const STRATA_LAYERS = [
  { below: STRATA_TOP, color: '#7a5c48', pebbles: 0.2, roots: true },
  { below: 0, color: '#8e8994', pebbles: 0.9 },
  { below: -0.2, color: '#9a6e56', pebbles: 0.15 },
  { below: -0.55, color: '#74533f', pebbles: 0.35 },
  { below: -0.95, color: '#8a654e', pebbles: 0.1 },
  { below: -1.25, color: '#5a4c62', pebbles: 0.5 },
];
// 层和层的分界线起伏多少（世界单位）
const STRATA_WOBBLE = 0.035;

/**
 * 画一张能无缝铺开的贴图，登记进世界（离开世界时释放）
 * @param {World} world 夜都
 * @param {number} width 像素宽
 * @param {number} height 像素高
 * @param {(context: CanvasRenderingContext2D, width: number, height: number) => void} draw 怎么画
 * @returns {THREE.CanvasTexture}
 */
function seamless(world, width, height, draw) {
  const texture = canvasTexture(width, height, draw);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return world.texture(texture);
}

/**
 * 人行道：半米见方的灰砖，有几块颜色深一点，零星的口香糖印和细裂缝
 * @param {World} world
 * @returns {THREE.CanvasTexture} 盖 GROUND_TILE × GROUND_TILE 单位
 */
export function pavingTexture(world) {
  return seamless(world, GROUND_PX, GROUND_PX, (context) => {
    const random = rng(101);
    const slab = PX_PER_UNIT / 2;
    bricks(context, random, { brickWidth: slab, brickHeight: slab, offset: 0, colors: ['#a7aab9', '#9fa2b2', '#aeb0bd'], joint: '#676a7a', jointWidth: 3, variation: 0.12 });
    speckle(context, random, 260, 1.2, ['rgba(70,72,88,0.35)', 'rgba(220,222,235,0.25)']);
    speckle(context, random, 14, 2.4, ['rgba(60,60,72,0.45)']);
    for (let i = 0; i < 6; i++) {
      crack(context, random, random() * GROUND_PX, random() * GROUND_PX, 30 + random() * 30, 'rgba(70,72,86,0.6)');
    }
  });
}

/**
 * 后巷：一米见方的旧水泥板，伸缩缝，几摊油渍，补过的地方
 * @param {World} world
 * @returns {THREE.CanvasTexture}
 */
export function laneTexture(world) {
  return seamless(world, GROUND_PX, GROUND_PX, (context) => {
    const random = rng(102);
    bricks(context, random, { brickWidth: PX_PER_UNIT, brickHeight: PX_PER_UNIT, offset: 0.5, colors: ['#7a7d8b', '#737684'], joint: '#4c4e5a', jointWidth: 3, variation: 0.08 });
    speckle(context, random, 500, 1, ['rgba(50,52,64,0.35)', 'rgba(200,202,215,0.2)']);
    for (let i = 0; i < 5; i++) {
      oilStain(context, random);
    }
    for (let i = 0; i < 8; i++) {
      crack(context, random, random() * GROUND_PX, random() * GROUND_PX, 40 + random() * 40, 'rgba(45,46,58,0.6)');
    }
  });
}

/**
 * 一摊油渍：几个叠在一起的暗色椭圆
 * @param {CanvasRenderingContext2D} context
 * @param {() => number} random
 */
function oilStain(context, random) {
  const x = 40 + random() * (GROUND_PX - 80);
  const y = 40 + random() * (GROUND_PX - 80);
  for (let i = 0; i < 4; i++) {
    context.fillStyle = 'rgba(30,30,42,0.18)';
    context.beginPath();
    context.ellipse(x + (random() - 0.5) * 24, y + (random() - 0.5) * 16, 12 + random() * 18, 8 + random() * 10, random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
}

/**
 * 观景台：暖色的陶土方砖，两种颜色错着铺
 * @param {World} world
 * @returns {THREE.CanvasTexture}
 */
export function terraceTexture(world) {
  return seamless(world, GROUND_PX, GROUND_PX, (context) => {
    const random = rng(103);
    const tile = PX_PER_UNIT / 2;
    bricks(context, random, { brickWidth: tile, brickHeight: tile, offset: 0, colors: ['#c08a72', '#b37d67', '#c99580'], joint: '#8c6a60', jointWidth: 4, variation: 0.1 });
    speckle(context, random, 300, 1, ['rgba(90,50,40,0.3)', 'rgba(255,230,210,0.2)']);
  });
}

/**
 * 草地：深浅不一的草叶一笔一笔画上去
 * @param {World} world
 * @returns {THREE.CanvasTexture}
 */
export function grassTexture(world) {
  return seamless(world, GROUND_PX, GROUND_PX, (context) => {
    const random = rng(104);
    context.fillStyle = '#4c8064';
    context.fillRect(0, 0, GROUND_PX, GROUND_PX);
    speckle(context, random, 900, 3, ['rgba(52,96,74,0.5)', 'rgba(98,150,110,0.35)']);

    const blades = 5000;
    const colors = ['#3c6b55', '#5a9472', '#6aa57c', '#355f4c'];
    for (let i = 0; i < blades; i++) {
      grassBlade(context, random, colors[Math.floor(random() * colors.length)]);
    }
  });
}

/**
 * 一片草叶：一道短短的斜线
 * @param {CanvasRenderingContext2D} context
 * @param {() => number} random
 * @param {string} color
 */
function grassBlade(context, random, color) {
  const x = random() * GROUND_PX;
  const y = random() * GROUND_PX;
  const length = 3 + random() * 5;
  const lean = (random() - 0.5) * 1.2;

  context.strokeStyle = color;
  context.lineWidth = 1.4;
  for (const [dx, dy] of wrapCopies(x, y, length, GROUND_PX, GROUND_PX)) {
    context.beginPath();
    context.moveTo(x + dx, y + dy);
    context.lineTo(x + dx + Math.sin(lean) * length, y + dy - Math.cos(lean) * length);
    context.stroke();
  }
}

/**
 * 马路：深色沥青，粗细不一的石子颗粒，几块补过的路面，几道裂缝
 * @param {World} world
 * @returns {THREE.CanvasTexture}
 */
export function asphaltTexture(world) {
  return seamless(world, GROUND_PX, GROUND_PX, (context) => {
    const random = rng(105);
    context.fillStyle = '#343846';
    context.fillRect(0, 0, GROUND_PX, GROUND_PX);
    for (let i = 0; i < 4; i++) {
      context.fillStyle = 'rgba(28,30,40,0.35)';
      context.fillRect(random() * GROUND_PX, random() * GROUND_PX, 40 + random() * 80, 30 + random() * 50);
    }
    speckle(context, random, 3500, 0.9, ['#40444f', '#2a2d38', '#4a4e5a', '#2f323d']);
    for (let i = 0; i < 7; i++) {
      crack(context, random, random() * GROUND_PX, random() * GROUND_PX, 50 + random() * 50, 'rgba(18,20,28,0.7)');
    }
  });
}

/**
 * 挡土墙：一层层错缝砌的石块，偏灰紫，每块深浅不一
 * @param {World} world
 * @returns {THREE.CanvasTexture} 盖 WALL_TILE × WALL_TILE 单位
 */
export function stoneWallTexture(world) {
  return seamless(world, WALL_PX, WALL_PX, (context) => {
    const random = rng(106);
    const course = WALL_PX_PER_UNIT / 4;
    bricks(context, random, { brickWidth: course * 2, brickHeight: course, offset: 0.5, colors: ['#8a8698', '#7e7a8e', '#948fa0', '#77748a'], joint: '#4f4c5e', jointWidth: 3, variation: 0.14 });
    speckle(context, random, 300, 0.9, ['rgba(60,58,72,0.35)', 'rgba(230,228,240,0.2)']);
    // 墙脚长了点青苔
    speckle(context, random, 40, 2.5, ['rgba(80,120,90,0.35)']);
  });
}

/**
 * 方块侧面的土层：竖着按世界高度画，一层层颜色，石子，最上面公园土坡里有几根草根
 * @param {World} world
 * @returns {THREE.CanvasTexture} 横着盖 WALL_TILE 单位；竖着从 STRATA_BOTTOM 画到 STRATA_TOP
 */
export function strataTexture(world) {
  const pxPerUnitHigh = STRATA_PX_HIGH / (STRATA_TOP - STRATA_BOTTOM);
  const rowOf = (y) => (STRATA_TOP - y) * pxPerUnitHigh;
  const texture = seamless(world, WALL_PX, STRATA_PX_HIGH, (context) => {
    const random = rng(107);
    paintStrataBands(context, rowOf);
    STRATA_LAYERS.forEach((layer, index) => {
      const bottom = STRATA_LAYERS[index + 1]?.below ?? STRATA_BOTTOM;
      paintLayerDetail(context, random, layer, rowOf(layer.below), rowOf(bottom));
    });
  });
  // 竖着不重复：贴图正好盖住从底到顶
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * 一层层土的底色，分界线弯弯的
 * @param {CanvasRenderingContext2D} context
 * @param {(y: number) => number} rowOf 世界 y 在画布的第几行
 */
function paintStrataBands(context, rowOf) {
  const { width } = context.canvas;
  const wobble = (column, index) => Math.sin((column / width) * Math.PI * 2 * 2 + index * 1.7) * STRATA_WOBBLE + Math.sin((column / width) * Math.PI * 2 * 5 + index) * STRATA_WOBBLE * 0.4;

  STRATA_LAYERS.forEach((layer, index) => {
    const next = STRATA_LAYERS[index + 1];
    context.fillStyle = layer.color;
    for (let column = 0; column < width; column++) {
      const top = index === 0 ? 0 : rowOf(layer.below + wobble(column, index));
      const bottom = next ? rowOf(next.below + wobble(column, index + 1)) : context.canvas.height;
      context.fillRect(column, top, 1, bottom - top + 1);
    }
  });
}

/**
 * 一层土里的石子、草根，和这一层顶上一线暗边（层和层之间看得出分界）
 * @param {CanvasRenderingContext2D} context
 * @param {() => number} random
 * @param {{ color: string, pebbles: number, roots?: boolean }} layer 这一层
 * @param {number} top 这一层从画布第几行开始
 * @param {number} bottom 到第几行
 */
function paintLayerDetail(context, random, layer, top, bottom) {
  const { width } = context.canvas;
  const height = Math.max(1, bottom - top);
  const pebbles = Math.round(layer.pebbles * width * height * 0.004);
  for (let i = 0; i < pebbles; i++) {
    const x = random() * width;
    const y = top + random() * height;
    const radius = 1 + random() * 2.5;
    context.fillStyle = shade(layer.color, random() < 0.5 ? 0.25 : -0.25);
    context.beginPath();
    context.ellipse(x, y, radius * 1.3, radius, random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }

  if (layer.roots) {
    for (let i = 0; i < 18; i++) {
      crack(context, random, random() * width, top + random() * height * 0.6, 10 + random() * 16, shade(layer.color, -0.35));
    }
  }
}
