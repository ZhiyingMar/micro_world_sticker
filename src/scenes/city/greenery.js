// 公园、花园里的点缀：一簇簇的花、满地的草丛、人行道墙根的小草、萤火虫，风吹着树冠轻轻摇
// 都只是看的，不挡路。要等树、树篱、长椅都摆好、碰撞登记完了再撒，才不会长进东西里面
// 花是“设计”出来的：树底下、树篱两头、长椅边、挡土墙顶上隔一段一簇，花园的菜畦边，再零星撒一些野花
import { rng } from '../../kit.js';
import { flowerField, grassField, swayInWind } from '../../plants.js';
import { createFireflies } from '../../fireflies.js';
import { PARK_TREES, HEDGES, BUSHES, PARK_BENCH, GARDEN_BEDS, GARDEN_SHED, REGIONS } from './layout.js';

// 夜里看得清的花色：白、浅粉、淡紫、淡黄
const FLOWER_COLORS = ['#fff4fb', '#ffd1e8', '#c9b8ff', '#ffe58a', '#ff9ec7'];
// 花有大有小；一朵要占多大地方（离东西、崖边多近就不长）
const FLOWER_SCALE = [0.8, 1.25];
const FLOWER_ROOM = 0.06;
// 树底下：离树干多远，一簇几朵、多大
const TREE_CLUSTER = { gap: 0.5, blooms: 5, radius: 0.2 };
// 树篱两头：离树篱的头多远，一簇几朵
const HEDGE_CLUSTER = { gap: 0.25, blooms: 4, radius: 0.16 };
// 长椅边、菜畦边、小棚子门口
const BENCH_CLUSTER = { gap: 0.6, blooms: 5, radius: 0.18 };
const BED_CLUSTER = { gap: 0.75, blooms: 4, radius: 0.15 };
// 挡土墙顶上：隔多远一簇，离墙边多远
const WALL_CLUSTER = { spacing: 1.6, inset: 0.35, blooms: 4, radius: 0.18 };
// 零星的野花
const WILDFLOWERS = 30;
const FLOWER_SEED = 88;

// 草丛：撒多少丛，颜色、大小；离东西、崖边多近就不长
const GRASS_TUFTS = 380;
const GRASS_COLORS = ['#3f7a58', '#4f8a64', '#5f9a6e'];
const GRASS_SCALE = [0.7, 1.3];
const GRASS_ROOM = 0.05;
// 人行道挡土墙根下石缝里冒出来的小草：几丛，离墙多远
const CRACK_WEEDS = 26;
const CRACK_GAP = 0.08;
const GRASS_SEED = 23;

// 萤火虫绕着树和灌木丛飞，月亮挂回去以后才出来
const FIREFLY_SEED = 17;

/**
 * 撒点缀，让树冠跟着风摇
 * @param {World} world 夜都
 * @param {object} context
 * @param {{ surfaceAt(x: number, z: number): string }} context.ground 某一处铺的是什么（只在草地上长草）
 * @param {THREE.Group[]} context.crowns 公园里的树冠
 * @param {object} context.power 电力（萤火虫跟着月光出来）
 */
export function plantGreenery(world, { ground, crowns, power }) {
  const isGrass = (x, z) => {
    const surface = ground.surfaceAt(x, z);
    return surface === 'park' || surface === 'garden';
  };

  flowers(world, isGrass);
  grass(world, isGrass);
  swayInWind(world, crowns);

  const fireflies = createFireflies(world, fireflySpots(world, isGrass), FIREFLY_SEED);
  power.show(({ sky }) => fireflies.setPresence(sky));
}

// ---------- 花 ----------

/**
 * 种花
 * @param {World} world
 * @param {(x: number, z: number) => boolean} isGrass 这一处是不是草地
 */
function flowers(world, isGrass) {
  const random = rng(FLOWER_SEED);
  const grow = (x, z, { blooms, radius }) => cluster(world, random, isGrass, x, z, radius, blooms);

  const spots = [
    ...PARK_TREES.map(([x, z]) => around(x, z, TREE_CLUSTER.gap, random)),
    ...HEDGES.flatMap(hedgeEnds),
    around(...PARK_BENCH, BENCH_CLUSTER.gap, random),
    ...GARDEN_BEDS.map(([x, z]) => [x + BED_CLUSTER.gap, z + (random() - 0.5) * 0.4]),
    [GARDEN_SHED[0] + BED_CLUSTER.gap, GARDEN_SHED[1] + 0.4],
  ];
  const sizes = [
    ...PARK_TREES.map(() => TREE_CLUSTER),
    ...HEDGES.flatMap(() => [HEDGE_CLUSTER, HEDGE_CLUSTER]),
    BENCH_CLUSTER,
    ...GARDEN_BEDS.map(() => BED_CLUSTER),
    BED_CLUSTER,
  ];

  const blooms = [
    ...spots.flatMap(([x, z], index) => grow(x, z, sizes[index])),
    ...wallTop(world).flatMap(([x, z]) => grow(x, z, WALL_CLUSTER)),
    ...wildflowers(world, random, isGrass),
  ];
  world.root.add(flowerField(world.kit, blooms));
}

/**
 * 某个东西旁边随便一个方向、离它 gap 远的一点
 * @param {number} x
 * @param {number} z
 * @param {number} gap
 * @param {() => number} random
 * @returns {number[]} [x, z]
 */
function around(x, z, gap, random) {
  const angle = random() * Math.PI * 2;
  return [x + Math.cos(angle) * gap, z + Math.sin(angle) * gap];
}

/**
 * 一道树篱两头外面一点
 * @param {number[]} hedge [minX, maxX, minZ, maxZ]
 * @returns {number[][]} 两头各一点 [x, z]
 */
function hedgeEnds([minX, maxX, minZ, maxZ]) {
  const alongX = maxX - minX >= maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  if (alongX) {
    return [
      [minX - HEDGE_CLUSTER.gap, centerZ],
      [maxX + HEDGE_CLUSTER.gap, centerZ],
    ];
  }
  return [
    [centerX, minZ - HEDGE_CLUSTER.gap],
    [centerX, maxZ + HEDGE_CLUSTER.gap],
  ];
}

/**
 * 公园挡土墙顶上（靠马路那一排）隔一段一个花簇的位置
 * @param {World} world
 * @returns {number[][]} [x, z]
 */
function wallTop(world) {
  const terrain = world.terrain;
  const wallZ = terrain.z0 + REGIONS.parkFromRow;
  const spots = [];
  for (let x = terrain.x0 + WALL_CLUSTER.spacing / 2; x < terrain.x0 + terrain.w; x += WALL_CLUSTER.spacing) {
    spots.push([x, wallZ + WALL_CLUSTER.inset]);
  }
  return spots;
}

/**
 * 一簇花：在 (x, z) 附近一小团里长几朵，长不下的位置跳过
 * @param {World} world
 * @param {() => number} random
 * @param {(x: number, z: number) => boolean} isGrass
 * @param {number} centerX
 * @param {number} centerZ
 * @param {number} radius 这一簇多大
 * @param {number} count 几朵
 * @returns {object[]} flowerField 要的每朵花
 */
function cluster(world, random, isGrass, centerX, centerZ, radius, count) {
  const colors = [FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)], FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)]];
  const blooms = [];
  for (let i = 0; i < count; i++) {
    // 开平方让花在圆里撒得均匀，不全挤在中间
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    const x = centerX + Math.cos(angle) * distance;
    const z = centerZ + Math.sin(angle) * distance;
    const bloom = bloomAt(world, random, isGrass, x, z, colors[i % colors.length]);
    if (bloom) {
      blooms.push(bloom);
    }
  }
  return blooms;
}

/**
 * 零星的野花：公园、花园草地上随便撒
 * @param {World} world
 * @param {() => number} random
 * @param {(x: number, z: number) => boolean} isGrass
 * @returns {object[]}
 */
function wildflowers(world, random, isGrass) {
  const blooms = [];
  const tries = WILDFLOWERS * 4;
  for (let i = 0; i < tries && blooms.length < WILDFLOWERS; i++) {
    const [x, z] = randomPoint(world, random);
    const color = FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)];
    const bloom = bloomAt(world, random, isGrass, x, z, color);
    if (bloom) {
      blooms.push(bloom);
    }
  }
  return blooms;
}

/**
 * 在这里长一朵花；不是草地平地、被东西占着、贴着崖边就不长
 * @param {World} world
 * @param {() => number} random
 * @param {(x: number, z: number) => boolean} isGrass
 * @param {number} x
 * @param {number} z
 * @param {string} color
 * @returns {object | null}
 */
function bloomAt(world, random, isGrass, x, z, color) {
  const fits = isGrass(x, z) && world.terrain.isPlainGround(x, z) && !world.blocked(x, z, FLOWER_ROOM);
  if (!fits) {
    return null;
  }
  const scale = FLOWER_SCALE[0] + random() * (FLOWER_SCALE[1] - FLOWER_SCALE[0]);
  return { x, y: world.heightAt(x, z), z, color, scale, turn: random() * Math.PI * 2 };
}

/**
 * 地图里随便一点
 * @param {World} world
 * @param {() => number} random
 * @returns {number[]} [x, z]
 */
function randomPoint(world, random) {
  const terrain = world.terrain;
  return [terrain.x0 + random() * terrain.w, terrain.z0 + random() * terrain.d];
}

// ---------- 草 ----------

/**
 * 草地上撒满草丛，人行道挡土墙根下冒出几丛小草
 * @param {World} world
 * @param {(x: number, z: number) => boolean} isGrass
 */
function grass(world, isGrass) {
  const random = rng(GRASS_SEED);
  const tufts = [];
  const tryTuft = (x, z, onGrassOnly) => {
    const allowed = !onGrassOnly || isGrass(x, z);
    const fits = allowed && world.terrain.isPlainGround(x, z) && !world.blocked(x, z, GRASS_ROOM);
    if (fits) {
      tufts.push(tuftAt(world, random, x, z));
    }
  };

  for (let i = 0; i < GRASS_TUFTS * 3 && tufts.length < GRASS_TUFTS; i++) {
    tryTuft(...randomPoint(world, random), true);
  }

  // 墙根石缝：人行道这边，贴着公园挡土墙
  const wallZ = world.terrain.z0 + REGIONS.parkFromRow - CRACK_GAP;
  for (let i = 0; i < CRACK_WEEDS; i++) {
    const x = world.terrain.x0 + random() * world.terrain.w;
    tryTuft(x, wallZ, false);
  }
  world.root.add(grassField(world.kit, tufts));
}

/**
 * 一丛草
 * @param {World} world
 * @param {() => number} random
 * @param {number} x
 * @param {number} z
 * @returns {object} grassField 要的一丛
 */
function tuftAt(world, random, x, z) {
  const scale = GRASS_SCALE[0] + random() * (GRASS_SCALE[1] - GRASS_SCALE[0]);
  const color = GRASS_COLORS[Math.floor(random() * GRASS_COLORS.length)];
  return { x, y: world.heightAt(x, z), z, color, scale, turn: random() * Math.PI * 2 };
}

// ---------- 萤火虫 ----------

/**
 * 萤火虫绕着飞的地方：公园的树、草地上的灌木丛
 * @param {World} world
 * @param {(x: number, z: number) => boolean} isGrass
 * @returns {{ x: number, y: number, z: number }[]}
 */
function fireflySpots(world, isGrass) {
  const spots = [...PARK_TREES, ...BUSHES].map(([x, z]) => [x, z]).filter(([x, z]) => isGrass(x, z));
  return spots.map(([x, z]) => ({ x, y: world.heightAt(x, z), z }));
}
