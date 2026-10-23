// 地上的点缀：一簇簇方块小花、满地方块草丛
// 都只是看的，不挡路。要等别的东西都摆好、碰撞登记完了再撒，才不会长进树干和房子里
// 花是"设计"出来的：门口两边、路边隔一段一簇、树底下一簇、栅栏脚下一排、空地上几大片，再零星撒一些野花
import { rng } from '../../kit.js';
import { voxelFlowerField, voxelGrassField } from './plants.js';
import { offPaths, PATH_HALF_WIDTH } from './paths.js';
import { PATHS, TREES, FLOWER_PATCHES, RED_HOUSE, BLUE_HOUSE, GARDEN } from './layout.js';

const FLOWER_COLORS = ['#ff6b8b', '#ffffff', '#ffd84a', '#b38ee8', '#ff9a4d', '#7fc8ff'];
// 一朵花要占多大地方；离路边、广场边多近就不长；离崖边多近就不长
const FLOWER_ROOM = 0.06;
const FLOWER_CLEAR_OF_PATH = 0.04;
const FLOWER_CLEAR_OF_CLIFF = 0.16;
// 花有大有小
const FLOWER_SCALE = [0.85, 1.3];
// 门口花坛：离墙多远，门两边各一簇，离门多远，一簇几朵、多大
const BED_GAP = 0.35;
const BED_SIDE = 0.65;
const BED_BLOOMS = 6;
const BED_RADIUS = 0.2;
// 路边：隔多远一簇，离路边多远，一簇几朵、多大
const PATH_CLUSTER_SPACING = 1.4;
const PATH_CLUSTER_GAP = 0.22;
const PATH_CLUSTER_BLOOMS = 4;
const PATH_CLUSTER_RADIUS = 0.16;
// 树底下：离树干多远，一簇几朵
const TREE_CLUSTER_GAP = 0.45;
const TREE_CLUSTER_BLOOMS = 4;
const TREE_CLUSTER_RADIUS = 0.18;
// 菜园栅栏外面一排：离栅栏多远，隔多远一朵
const FENCE_FLOWER_GAP = 0.16;
const FENCE_FLOWER_SPACING = 0.28;
// 零星的野花有几朵
const WILDFLOWERS = 30;
const FLOWER_SEED = 42;

// 草丛：撒多少丛，颜色在几种绿之间，有大有小；离路边、崖边多近就不长
const GRASS_TUFTS = 520;
const GRASS_TRIES = 4;
const GRASS_COLORS = ['#4fa64a', '#63bd52', '#7ccf62'];
const GRASS_SCALE = [0.7, 1.35];
const GRASS_ROOM = 0.05;
const GRASS_CLEAR_OF_CLIFF = 0.12;
const GRASS_SEED = 13;

/**
 * 撒点缀
 * @param {World} world 像素小镇
 * @returns {{ gardens: number[][] }} 几大片花丛的中心（蝴蝶绕着飞）
 */
export function buildScenery(world) {
  flowers(world);
  grass(world);
  const doors = [RED_HOUSE, BLUE_HOUSE].map((house) => [house.x, house.z + house.depth / 2 + BED_GAP]);
  return { gardens: [...FLOWER_PATCHES.map(([x, z]) => [x, z]), ...doors] };
}

// ---------- 花 ----------

/**
 * 种花：门口、路边、树下、栅栏脚下、空地上几大片，再加一些野花
 * @param {World} world
 */
function flowers(world) {
  const random = rng(FLOWER_SEED);
  const blooms = [
    ...doorBeds(world, random),
    ...pathClusters(world, random),
    ...treeClusters(world, random),
    ...fenceRow(world, random),
    ...FLOWER_PATCHES.flatMap(([x, z, radius, count]) => cluster(world, random, x, z, radius, count, pickColors(random))),
    ...wildflowers(world, random),
  ];
  world.root.add(voxelFlowerField(world.kit, blooms));
}

/**
 * 随便挑两种花色，一簇花只用这两种，看起来是一起长的
 * @param {Function} random
 * @returns {string[]}
 */
function pickColors(random) {
  const first = FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)];
  const second = FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)];
  return [first, second];
}

/**
 * 一簇花：在 (x, z) 附近一小团里长几朵，长不下的位置跳过
 * @param {World} world
 * @param {Function} random
 * @param {number} centerX
 * @param {number} centerZ
 * @param {number} radius 这一簇多大
 * @param {number} count 几朵
 * @param {string[]} colors 用哪几种颜色
 * @returns {object[]} voxelFlowerField 要的每朵花
 */
function cluster(world, random, centerX, centerZ, radius, count, colors) {
  const blooms = [];
  for (let i = 0; i < count; i++) {
    // 开平方让花在圆里撒得均匀，不全挤在中间
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    const bloom = bloomAt(world, random, centerX + Math.cos(angle) * distance, centerZ + Math.sin(angle) * distance, colors[i % colors.length]);
    if (bloom) {
      blooms.push(bloom);
    }
  }
  return blooms;
}

/**
 * 在这里长一朵花；不是平地、贴着崖边、压着路或者被东西占了就不长
 * @param {World} world
 * @param {Function} random
 * @param {number} x
 * @param {number} z
 * @param {string} color
 * @returns {object | null}
 */
function bloomAt(world, random, x, z, color) {
  const terrain = world.terrain;
  const onFlatGround = terrain.isPlainGround(x, z) && !terrain.straddles(x, z, FLOWER_CLEAR_OF_CLIFF);
  const free = onFlatGround && offPaths(x, z, FLOWER_CLEAR_OF_PATH) && !world.blocked(x, z, FLOWER_ROOM);
  if (!free) {
    return null;
  }

  const scale = FLOWER_SCALE[0] + random() * (FLOWER_SCALE[1] - FLOWER_SCALE[0]);
  return { x, y: world.heightAt(x, z), z, color, scale, turn: random() * Math.PI * 2 };
}

/**
 * 两座房子门口两边各一小簇
 * @param {World} world
 * @param {Function} random
 * @returns {object[]}
 */
function doorBeds(world, random) {
  return [RED_HOUSE, BLUE_HOUSE].flatMap((house) => {
    const z = house.z + house.depth / 2 + BED_GAP;
    const colors = pickColors(random);
    return [-1, 1].flatMap((side) => cluster(world, random, house.x + side * BED_SIDE, z, BED_RADIUS, BED_BLOOMS, colors));
  });
}

/**
 * 沿着每条路，隔一段在路边长一小簇，左右交替
 * @param {World} world
 * @param {Function} random
 * @returns {object[]}
 */
function pathClusters(world, random) {
  const blooms = [];
  for (const path of PATHS) {
    for (let i = 1; i < path.length; i++) {
      blooms.push(...segmentClusters(world, random, path[i - 1], path[i]));
    }
  }
  return blooms;
}

/**
 * 一段路两边的花
 * @param {World} world
 * @param {Function} random
 * @param {number[]} start 这段路的起点 [x, z]
 * @param {number[]} end 终点
 * @returns {object[]}
 */
function segmentClusters(world, random, start, end) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  const steps = Math.floor(length / PATH_CLUSTER_SPACING);
  const blooms = [];

  for (let step = 1; step <= steps; step++) {
    const t = step / (steps + 1);
    const side = step % 2 ? 1 : -1;
    // 往路的一边挪出去：路的法线方向
    const out = (PATH_HALF_WIDTH + PATH_CLUSTER_GAP) * side;
    const x = start[0] + dx * t + (-dz / length) * out;
    const z = start[1] + dz * t + (dx / length) * out;
    blooms.push(...cluster(world, random, x, z, PATH_CLUSTER_RADIUS, PATH_CLUSTER_BLOOMS, pickColors(random)));
  }
  return blooms;
}

/**
 * 显眼的树底下，朝镜头那边长一簇
 * @param {World} world
 * @param {Function} random
 * @returns {object[]}
 */
function treeClusters(world, random) {
  return TREES.flatMap(([x, z]) => {
    const angle = random() * Math.PI;
    const clusterX = x + Math.cos(angle) * TREE_CLUSTER_GAP;
    const clusterZ = z + Math.sin(angle) * TREE_CLUSTER_GAP;
    return cluster(world, random, clusterX, clusterZ, TREE_CLUSTER_RADIUS, TREE_CLUSTER_BLOOMS, pickColors(random));
  });
}

/**
 * 菜园栅栏前面一排花，颜色交替
 * @param {World} world
 * @param {Function} random
 * @returns {object[]}
 */
function fenceRow(world, random) {
  const colors = pickColors(random);
  const z = GARDEN.maxZ + FENCE_FLOWER_GAP;
  const blooms = [];
  let index = 0;
  for (let x = GARDEN.minX; x <= GARDEN.maxX; x += FENCE_FLOWER_SPACING) {
    const bloom = bloomAt(world, random, x, z, colors[index % colors.length]);
    if (bloom) {
      blooms.push(bloom);
    }
    index++;
  }
  return blooms;
}

/**
 * 零星的野花：随便撒，长不下就跳过
 * @param {World} world
 * @param {Function} random
 * @returns {object[]}
 */
function wildflowers(world, random) {
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const blooms = [];
  for (let i = 0; i < WILDFLOWERS; i++) {
    const x = minX + random() * (maxX - minX);
    const z = minZ + random() * (maxZ - minZ);
    const color = FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)];
    const bloom = bloomAt(world, random, x, z, color);
    if (bloom) {
      blooms.push(bloom);
    }
  }
  return blooms;
}

// ---------- 草 ----------

/**
 * 满地方块草丛：路上、广场上、崖边、被东西占了的地方不长
 * @param {World} world
 */
function grass(world) {
  const random = rng(GRASS_SEED);
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const terrain = world.terrain;
  const tufts = [];

  for (let tries = 0; tries < GRASS_TUFTS * GRASS_TRIES && tufts.length < GRASS_TUFTS; tries++) {
    const x = minX + random() * (maxX - minX);
    const z = minZ + random() * (maxZ - minZ);
    const onFlatGround = terrain.isPlainGround(x, z) && !terrain.straddles(x, z, GRASS_CLEAR_OF_CLIFF);
    const free = onFlatGround && offPaths(x, z, 0) && !world.blocked(x, z, GRASS_ROOM);
    if (!free) {
      continue;
    }
    const color = GRASS_COLORS[Math.floor(random() * GRASS_COLORS.length)];
    const scale = GRASS_SCALE[0] + random() * (GRASS_SCALE[1] - GRASS_SCALE[0]);
    tufts.push({ x, y: world.heightAt(x, z), z, color, scale, turn: random() * Math.PI * 2 });
  }
  world.root.add(voxelGrassField(world.kit, tufts));
}
