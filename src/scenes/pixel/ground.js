// 像素小镇的地面：一块块小体素，草地一片深一片浅、偶尔一个小花点，弯弯的土路，喷泉四周一圈石板广场
import * as THREE from 'three';
import { noiseAt } from '../../kit.js';
import { buildVoxelTerrain } from '../../terrain-voxel.js';
import { distanceToPath, PATH_HALF_WIDTH } from './paths.js';
import { PLAZA } from './layout.js';

// 草地：三种绿（暗、本色、亮），按大片的斑块挑；越高的台地越亮一点（晒得到太阳）
const GRASS = ['#55ad4a', '#63bd52', '#73ca5d'];
const LEVEL_LIGHTEN = 0.025;
// 草地上零星的像素点：亮一点的草尖、暗一点的草根、小白花黄花粉花
const GRASS_TIP = '#8bd96d';
const GRASS_ROOT = '#4a9b42';
const GRASS_TIP_CHANCE = 0.07;
const GRASS_ROOT_CHANCE = 0.05;
const FLOWER_DOTS = ['#ffffff', '#ffe066', '#ff9ec2'];
const FLOWER_DOT_CHANCE = 0.012;
// 土路：路面、路边、路上的小石子；路边弯弯曲曲多少
const PATH = '#dcbf86';
const PATH_EDGE = '#c9a56e';
const PATH_PEBBLE = '#b59c78';
const PATH_PEBBLE_CHANCE = 0.06;
const PATH_EDGE_WIDTH = 0.1;
const PATH_WOBBLE = 0.08;
// 广场：几种灰白的石板；边上一圈深一点的路缘石有多宽
const COBBLES = ['#d6d0c2', '#c6bfb0', '#ded9cc', '#bcb5a6'];
const CURB = '#a59e90';
const CURB_WIDTH = 0.25;

const LOOK = {
  top: paintTop,
  strata: ['#8b5a2b', '#7a4d24', '#9a6633', '#6e4520'],
  pebble: '#aba59b',
  shore: '#e9d8a6',
  bed: '#3d8fb3',
  water: '#58bdf0',
  ripple: '#a9e6ff',
  stairs: ['#dcd5c6', '#c7bfae'],
  plank: '#b98a5a',
  stone: '#a8a8b8',
};

// 每块小体素都要算一次颜色，反复用同一个
const paint = new THREE.Color();

/**
 * 画像素小镇的地面
 * @param {World} world 像素小镇
 * @returns {{ waterSurface: number, waterPatch: (width: number, depth: number) => THREE.Mesh, stairs: object[] }}
 *   水面多高；做一小块一样的水面；每一格台阶（小镇卡住了时，广场上去的台阶塌成一层底座）
 */
export function buildGround(world) {
  return buildVoxelTerrain(world, LOOK);
}

/**
 * 地面上一块小体素的颜色：广场是石板，路上是土，别的地方是草
 * @param {number} x 这块小体素的中心
 * @param {number} z
 * @param {number} level 高度层
 * @returns {THREE.Color}
 */
function paintTop(x, z, level) {
  const plazaDistance = Math.hypot(x - PLAZA.x, z - PLAZA.z);
  if (plazaDistance < PLAZA.radius) {
    return paintCobble(x, z, PLAZA.radius - plazaDistance);
  }

  // 路边弯弯曲曲的，不是尺子画的
  const edge = PATH_HALF_WIDTH + (noiseAt(x, 0, z, 21) - 0.5) * 2 * PATH_WOBBLE;
  const outside = distanceToPath(x, z) - edge;
  if (outside < 0) {
    return paintPath(x, z, -outside);
  }
  return paintGrass(x, z, level);
}

/**
 * 广场上的一块石板：几种灰白随便挑，最外一圈是深色的路缘石
 * @param {number} x
 * @param {number} z
 * @param {number} fromEdge 离广场边多远
 * @returns {THREE.Color}
 */
function paintCobble(x, z, fromEdge) {
  if (fromEdge < CURB_WIDTH) {
    return paint.set(CURB);
  }
  const pick = Math.floor(noiseAt(x, 1, z, 23) * COBBLES.length);
  return paint.set(COBBLES[pick]);
}

/**
 * 土路上的一块：中间浅，靠边深一点，偶尔一颗小石子
 * @param {number} x
 * @param {number} z
 * @param {number} fromEdge 离路边多远
 * @returns {THREE.Color}
 */
function paintPath(x, z, fromEdge) {
  if (noiseAt(x, 2, z, 25) < PATH_PEBBLE_CHANCE) {
    return paint.set(PATH_PEBBLE);
  }
  return paint.set(fromEdge < PATH_EDGE_WIDTH ? PATH_EDGE : PATH);
}

/**
 * 草地上的一块：大片的深浅斑块，零星几个亮点、暗点、小花点
 * @param {number} x
 * @param {number} z
 * @param {number} level 高度层
 * @returns {THREE.Color}
 */
function paintGrass(x, z, level) {
  const roll = noiseAt(x, 3, z, 27);
  if (roll < FLOWER_DOT_CHANCE) {
    return paint.set(FLOWER_DOTS[Math.floor(noiseAt(x, 4, z, 29) * FLOWER_DOTS.length)]);
  }
  if (roll < FLOWER_DOT_CHANCE + GRASS_TIP_CHANCE) {
    return paint.set(GRASS_TIP);
  }
  if (roll < FLOWER_DOT_CHANCE + GRASS_TIP_CHANCE + GRASS_ROOT_CHANCE) {
    return paint.set(GRASS_ROOT);
  }

  // 两组斜着交叉的波叠出一大片一大片的深浅，再挑三档里的一档
  const patches = 0.5 + 0.25 * Math.sin(x * 0.8 + Math.sin(z * 0.55) * 1.6) + 0.25 * Math.sin(z * 1.05 - x * 0.4 + 1.1);
  const shade = Math.min(GRASS.length - 1, Math.floor(patches * GRASS.length));
  return paint.set(GRASS[shade]).offsetHSL(0, 0, level * LEVEL_LIGHTEN);
}
