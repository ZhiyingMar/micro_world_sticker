// 围着房子的一圈花园：圆角的草地方块、尖头白篱笆和院门、弯弯的石板小路走到屋边的木台阶，
// 屋后屋左几种树把方块框住（风吹树冠），窗外两棵向日葵，花一簇簇长在篱笆脚下、路边、地基边和树下，满地草丛，几只蝴蝶
// 只是看的，人走不出屋子（小屋的 bounds 还是屋里那块地板）；镜头只能从右前方斜着看，所以前面和右边只放矮的东西
import { rng } from '../../kit.js';
import { tree, bush, flowerField, grassField, swayInWind } from '../../plants.js';
import { createButterflies } from '../../butterflies.js';
import { buildGardenGround } from './garden-ground.js';
import { picketFence, gardenGate, mailbox, sunflower, porchStep, steppingStone } from './garden-models.js';
import { pathPoints, pathDirection, distanceToPath, PATH_HALF_WIDTH } from './garden-path.js';
import { GARDEN, GARDEN_SIZE, HOUSE, GATE, PORCH_STEP, MAILBOX, GARDEN_TREES, GARDEN_BUSHES, SUNFLOWERS, FLOWER_BEDS } from './layout.js';

// 房子地基外面多远才是花园（地基比地板四边多出来 0.15，再留一点缝）
const FOUNDATION_CLEAR = HOUSE.half + 0.25;
// 树干、向日葵、信箱、台阶各占多大一块地（花草不长进去）
const TRUNK_ROOM = 0.35;
const SUNFLOWER_ROOM = 0.15;
const MAILBOX_ROOM = 0.15;
const STEP_ROOM = 0.45;
// 台阶多高（地面到台面）：花园地面到屋里地板一半的地方
const STEP_HEIGHT = -GARDEN.groundY / 2;

// 踏脚石：隔多远一块、多大，左右错开多少；靠台阶那头多少段不放（台阶在那儿）
const STONE_SPACING = 0.42;
const STONE_RADIUS = [0.17, 0.22];
const STONE_ZIGZAG = 0.07;
const STONE_END_CLEAR = 0.12;
const STONE_SEED = 5;

// 花：颜色，一簇只用两种，看起来是一起长的；有大有小；离路、离篱笆多远才长
const FLOWER_COLORS = ['#ff8fb1', '#ffffff', '#ffd84a', '#b38ee8', '#ff9a6b', '#8ec5e8'];
const FLOWER_SCALE = [0.85, 1.3];
const FLOWER_ROOM = 0.06;
const FLOWER_CLEAR_OF_PATH = 0.05;
const FLOWER_CLEAR_OF_FENCE = 0.12;
// 篱笆脚下：离篱笆多远，隔多远一簇，一簇几朵、多大一团
const FENCE_CLUSTER_GAP = 0.28;
const FENCE_CLUSTER_SPACING = 1.3;
const FENCE_CLUSTER_BLOOMS = 4;
const FENCE_CLUSTER_RADIUS = 0.18;
// 路边：隔多远一簇（沿路的比例），离路边多远，一簇几朵
const PATH_CLUSTERS = 7;
const PATH_CLUSTER_GAP = 0.2;
const PATH_CLUSTER_BLOOMS = 3;
const PATH_CLUSTER_RADIUS = 0.14;
// 树下：离树干多远，一簇几朵
const TREE_CLUSTER_GAP = 0.6;
const TREE_CLUSTER_BLOOMS = 4;
const TREE_CLUSTER_RADIUS = 0.2;
// 零星的野花
const WILDFLOWERS = 30;
const FLOWER_SEED = 42;

// 草丛：撒多少丛、最多试几次，颜色、大小；离篱笆多近还能长
const GRASS_TUFTS = 560;
const GRASS_TRIES = 5;
const GRASS_COLORS = ['#6fb85a', '#86c766', '#a2d878'];
const GRASS_SCALE = [0.7, 1.4];
const GRASS_CLEAR_OF_FENCE = 0.05;
const GRASS_SEED = 13;

// 蝴蝶绕着哪几片花飞（FLOWER_BEDS 里的第几片）：都在镜头这一侧，看得到
const BUTTERFLY_BEDS = [0, 2, 4, 9];
const BUTTERFLY_SEED = 41;
// 树的样子每棵不一样
const TREE_SEED = 3;

/**
 * 围着房子铺一圈花园
 * @param {World} world 小屋这个世界
 */
export function placeGarden(world) {
  buildGardenGround(world);
  // 已经占了地方的圆 [x, z, 半径]：后面种的花草要避开
  const taken = [];

  placeFence(world);
  placePath(world, taken);
  const crowns = placeTrees(world, taken);
  placeBushes(world, taken);
  const sunflowers = placeSunflowers(world, taken);
  placeMailbox(world, taken);
  placeFlowers(world, taken);
  placeGrass(world, taken);

  // 树冠和向日葵一起被风吹着晃
  swayInWind(world, [...crowns, ...sunflowers]);
  const beds = BUTTERFLY_BEDS.map((index) => ({ x: FLOWER_BEDS[index][0], z: FLOWER_BEDS[index][1], y: GARDEN.groundY }));
  createButterflies(world, beds, BUTTERFLY_SEED);
}

// ---------- 篱笆、小路 ----------

/**
 * 沿方块四边围一圈尖头篱笆，右边留出院门
 * @description 每段篱笆的横条都在朝屋里的那一面
 * @param {World} world
 */
function placeFence(world) {
  const kit = world.kit;
  const edge = GARDEN_SIZE / 2 - GARDEN.fenceInset;
  const gateStart = GATE.z + GATE.width / 2;
  const gateEnd = GATE.z - GATE.width / 2;
  // [起点 x, 起点 z, 多长, 朝向]：朝向让篱笆沿着这条边走、横条朝里
  const runs = [
    [-edge, edge, edge * 2, 0],
    [edge, edge, edge - gateStart, Math.PI / 2],
    [edge, gateEnd, gateEnd + edge, Math.PI / 2],
    [edge, -edge, edge * 2, Math.PI],
    [-edge, -edge, edge * 2, -Math.PI / 2],
  ];

  runs.forEach(([x, z, length, facing], index) => {
    world.add(picketFence(kit, length, index + 1), x, GARDEN.groundY, z, facing);
  });
  world.add(gardenGate(kit, GATE.width), edge, GARDEN.groundY, GATE.z, Math.PI / 2);
}

/**
 * 小路上一块块踏脚石，路走到头是上屋的木台阶
 * @param {World} world
 * @param {number[][]} taken 占了地方的圆，往里加
 */
function placePath(world, taken) {
  const random = rng(STONE_SEED);
  const points = pathPoints(Math.round(pathLength() / STONE_SPACING) + 1);
  const lastStone = Math.floor(points.length * (1 - STONE_END_CLEAR));

  for (let i = 0; i < lastStone; i++) {
    const along = i / (points.length - 1);
    const direction = pathDirection(along);
    const side = i % 2 === 0 ? 1 : -1;
    // 和路垂直的方向，左右错开一点
    const x = points[i].x - direction.z * STONE_ZIGZAG * side;
    const z = points[i].z + direction.x * STONE_ZIGZAG * side;
    const radius = STONE_RADIUS[0] + random() * (STONE_RADIUS[1] - STONE_RADIUS[0]);
    world.add(steppingStone(world.kit, radius, i + 1), x, GARDEN.groundY + 0.01, z, random() * Math.PI);
  }

  world.add(porchStep(world.kit, PORCH_STEP.width, STEP_HEIGHT), PORCH_STEP.x, GARDEN.groundY, PORCH_STEP.z);
  taken.push([PORCH_STEP.x, PORCH_STEP.z, STEP_ROOM]);
}

/**
 * 小路大概多长（俯视）
 * @returns {number}
 */
function pathLength() {
  const points = pathPoints(32);
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += points[i].distanceTo(points[i - 1]);
  }
  return length;
}

// ---------- 树、灌木、向日葵、信箱 ----------

/**
 * 屋后屋左种几种树，各转一个方向
 * @param {World} world
 * @param {number[][]} taken
 * @returns {THREE.Group[]} 所有树冠（风吹着晃）
 */
function placeTrees(world, taken) {
  const random = rng(TREE_SEED);
  return GARDEN_TREES.map(([x, z, kind, size, color], index) => {
    const { group, crown } = tree(world.kit, { kind, size, color, seed: index + 1 });
    world.add(group, x, GARDEN.groundY, z, random() * Math.PI * 2);
    taken.push([x, z, TRUNK_ROOM]);
    return crown;
  });
}

/**
 * 灌木丛：屋后屋左填在树中间，前面和右边角上几团矮的
 * @param {World} world
 * @param {number[][]} taken
 */
function placeBushes(world, taken) {
  const random = rng(TREE_SEED + 1);
  for (const [x, z, radius, color] of GARDEN_BUSHES) {
    world.add(bush(world.kit, radius, color), x, GARDEN.groundY, z, random() * Math.PI * 2);
    taken.push([x, z, radius]);
  }
}

/**
 * 窗外两棵向日葵，花盘朝着窗户
 * @param {World} world
 * @param {number[][]} taken
 * @returns {THREE.Group[]} 整棵向日葵（风吹时绕根晃）
 */
function placeSunflowers(world, taken) {
  return SUNFLOWERS.map(([x, z, height], index) => {
    const { group } = sunflower(world.kit, height);
    // 一棵正对窗户，一棵稍微偏一点，不像一对复制出来的
    world.add(group, x, GARDEN.groundY, z, (index - 0.5) * 0.4);
    taken.push([x, z, SUNFLOWER_ROOM]);
    return group;
  });
}

/**
 * 院门里面的信箱
 * @param {World} world
 * @param {number[][]} taken
 */
function placeMailbox(world, taken) {
  world.add(mailbox(world.kit), MAILBOX.x, GARDEN.groundY, MAILBOX.z, MAILBOX.facing);
  taken.push([MAILBOX.x, MAILBOX.z, MAILBOX_ROOM]);
}

// ---------- 花、草 ----------

/**
 * 种花：成片的花圃、篱笆脚下、路边、树下，再加一些野花
 * @param {World} world
 * @param {number[][]} taken
 */
function placeFlowers(world, taken) {
  const random = rng(FLOWER_SEED);
  const blooms = [
    ...FLOWER_BEDS.flatMap(([x, z, radius, count]) => cluster(random, taken, x, z, radius, count, pickColors(random))),
    ...fenceClusters(random, taken),
    ...pathClusters(random, taken),
    ...GARDEN_TREES.flatMap(([x, z]) => treeCluster(random, taken, x, z)),
    ...wildflowers(random, taken),
  ];
  world.add(flowerField(world.kit, blooms));
}

/**
 * 随便挑两种花色，一簇花只用这两种
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
 * @param {Function} random
 * @param {number[][]} taken
 * @param {number} centerX
 * @param {number} centerZ
 * @param {number} radius 这一簇多大
 * @param {number} count 几朵
 * @param {string[]} colors 用哪几种颜色
 * @returns {object[]} flowerField 要的每朵花
 */
function cluster(random, taken, centerX, centerZ, radius, count, colors) {
  const blooms = [];
  for (let i = 0; i < count; i++) {
    // 开平方让花在圆里撒得均匀，不全挤在中间
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    const x = centerX + Math.cos(angle) * distance;
    const z = centerZ + Math.sin(angle) * distance;
    if (!roomToGrow(taken, x, z, FLOWER_ROOM, FLOWER_CLEAR_OF_FENCE, FLOWER_CLEAR_OF_PATH)) {
      continue;
    }
    const scale = FLOWER_SCALE[0] + random() * (FLOWER_SCALE[1] - FLOWER_SCALE[0]);
    blooms.push({ x, y: GARDEN.groundY, z, color: colors[i % colors.length], scale, turn: random() * Math.PI * 2 });
  }
  return blooms;
}

/**
 * 前面和右边的篱笆脚下，隔一段一簇花（镜头这一侧，屋后屋左有树和灌木）
 * @param {Function} random
 * @param {number[][]} taken
 * @returns {object[]}
 */
function fenceClusters(random, taken) {
  const inner = GARDEN_SIZE / 2 - GARDEN.fenceInset - FENCE_CLUSTER_GAP;
  const blooms = [];
  for (let along = -inner; along <= inner; along += FENCE_CLUSTER_SPACING) {
    blooms.push(...cluster(random, taken, along, inner, FENCE_CLUSTER_RADIUS, FENCE_CLUSTER_BLOOMS, pickColors(random)));
    blooms.push(...cluster(random, taken, inner, along, FENCE_CLUSTER_RADIUS, FENCE_CLUSTER_BLOOMS, pickColors(random)));
  }
  return blooms;
}

/**
 * 小路两边隔一段一簇，左右轮流
 * @param {Function} random
 * @param {number[][]} taken
 * @returns {object[]}
 */
function pathClusters(random, taken) {
  const offset = PATH_HALF_WIDTH + PATH_CLUSTER_GAP;
  const points = pathPoints(PATH_CLUSTERS);
  return points.flatMap((point, index) => {
    const direction = pathDirection(index / (points.length - 1));
    const side = index % 2 === 0 ? 1 : -1;
    const x = point.x - direction.z * offset * side;
    const z = point.z + direction.x * offset * side;
    return cluster(random, taken, x, z, PATH_CLUSTER_RADIUS, PATH_CLUSTER_BLOOMS, pickColors(random));
  });
}

/**
 * 树底下长一簇花
 * @param {Function} random
 * @param {number[][]} taken
 * @param {number} treeX
 * @param {number} treeZ
 * @returns {object[]}
 */
function treeCluster(random, taken, treeX, treeZ) {
  const angle = random() * Math.PI * 2;
  const x = treeX + Math.cos(angle) * TREE_CLUSTER_GAP;
  const z = treeZ + Math.sin(angle) * TREE_CLUSTER_GAP;
  return cluster(random, taken, x, z, TREE_CLUSTER_RADIUS, TREE_CLUSTER_BLOOMS, pickColors(random));
}

/**
 * 零零星星的野花，撒在整圈花园里
 * @param {Function} random
 * @param {number[][]} taken
 * @returns {object[]}
 */
function wildflowers(random, taken) {
  const half = GARDEN_SIZE / 2;
  const blooms = [];
  for (let i = 0; i < WILDFLOWERS; i++) {
    const x = (random() * 2 - 1) * half;
    const z = (random() * 2 - 1) * half;
    blooms.push(...cluster(random, taken, x, z, 0, 1, [FLOWER_COLORS[i % FLOWER_COLORS.length]]));
  }
  return blooms;
}

/**
 * 满地的小草丛，草地不是一块平平的绿色
 * @param {World} world
 * @param {number[][]} taken
 */
function placeGrass(world, taken) {
  const random = rng(GRASS_SEED);
  const half = GARDEN_SIZE / 2;
  const tufts = [];

  for (let tries = 0; tries < GRASS_TUFTS * GRASS_TRIES && tufts.length < GRASS_TUFTS; tries++) {
    const x = (random() * 2 - 1) * half;
    const z = (random() * 2 - 1) * half;
    if (!roomToGrow(taken, x, z, FLOWER_ROOM, GRASS_CLEAR_OF_FENCE, 0)) {
      continue;
    }
    const color = GRASS_COLORS[Math.floor(random() * GRASS_COLORS.length)];
    const scale = GRASS_SCALE[0] + random() * (GRASS_SCALE[1] - GRASS_SCALE[0]);
    tufts.push({ x, y: GARDEN.groundY, z, color, scale, turn: random() * Math.PI * 2 });
  }
  world.add(grassField(world.kit, tufts));
}

/**
 * 这里能不能长花草：在地基外面、篱笆里面，不压着路，不长进树干、台阶这些东西里
 * @param {number[][]} taken 占了地方的圆 [x, z, 半径]
 * @param {number} x
 * @param {number} z
 * @param {number} room 这棵花草自己要占多大
 * @param {number} clearOfFence 离篱笆至少多远
 * @param {number} clearOfPath 离路边至少多远
 * @returns {boolean}
 */
function roomToGrow(taken, x, z, room, clearOfFence, clearOfPath) {
  const fromCenter = Math.max(Math.abs(x), Math.abs(z));
  const outsideHouse = fromCenter > FOUNDATION_CLEAR;
  const insideFence = fromCenter < GARDEN_SIZE / 2 - GARDEN.fenceInset - clearOfFence;
  const offPath = distanceToPath(x, z) > PATH_HALF_WIDTH + clearOfPath;
  const free = taken.every(([takenX, takenZ, radius]) => Math.hypot(x - takenX, z - takenZ) > radius + room);
  return outsideHouse && insideFence && offPath && free;
}
