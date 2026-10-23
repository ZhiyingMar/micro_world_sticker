// 地上的点缀：一簇簇的花、满地的草丛、方块侧面嵌着的小石头、萤火虫
// 都只是看的，不挡路。要等别的东西都摆好、碰撞登记完了再撒，才不会长进树干和屋子里
// 花是"设计"出来的：屋前一小片、路边隔一段一簇、树底下一簇、空地上几大片，再零星撒一些野花
import { rng } from '../../kit.js';
import { makeMotes } from '../../fx.js';
import { sidePebble } from './models.js';
import { flowerField, grassField } from '../../plants.js';
import { distanceToPath, PATH_HALF_WIDTH } from './paths.js';
import { PATHS, HOUSES, TREES, FLOWER_PATCHES } from './layout.js';

const FLOWER_COLORS = ['#ff8fb1', '#ffffff', '#ffd84a', '#b38ee8', '#ff9a6b'];
// 一朵花要占多大地方；离路边多近就不长
const FLOWER_ROOM = 0.06;
const FLOWER_CLEAR_OF_PATH = 0.04;
// 离崖边多近就不长（再近就悬在磨圆的崖边上了）
const FLOWER_CLEAR_OF_CLIFF = 0.18;
// 花有大有小
const FLOWER_SCALE = [0.8, 1.25];
// 屋前花坛：离墙多远，门两边各一簇，离门多远，一簇几朵
const BED_GAP = 0.45;
const BED_SIDE = 0.5;
const BED_BLOOMS = 6;
const BED_RADIUS = 0.2;
// 路边：隔多远一簇，离路边多远，一簇几朵、多大一团
const PATH_CLUSTER_SPACING = 1.5;
const PATH_CLUSTER_GAP = 0.28;
const PATH_CLUSTER_BLOOMS = 4;
const PATH_CLUSTER_RADIUS = 0.18;
// 树底下：离树干多远，一簇几朵
const TREE_CLUSTER_GAP = 0.55;
const TREE_CLUSTER_BLOOMS = 4;
const TREE_CLUSTER_RADIUS = 0.2;
// 零星的野花有几朵
const WILDFLOWERS = 40;
const FLOWER_SEED = 42;

// 草丛：撒多少丛、最多试几次，颜色在两种绿之间，有大有小；离路边、崖边多近就不长
const GRASS_TUFTS = 650;
const GRASS_TRIES = 4;
const GRASS_COLORS = ['#6fb85a', '#86c766', '#a2d878'];
const GRASS_SCALE = [0.7, 1.4];
const GRASS_ROOM = 0.05;
const GRASS_CLEAR_OF_CLIFF = 0.14;
const GRASS_SEED = 13;

// 方块侧面的小石头：每单位边长几块，多大，嵌在土里多深的范围（地面往下）
const PEBBLES_PER_LENGTH = 0.4;
const PEBBLE_RADIUS = [0.12, 0.22];
const PEBBLE_DEPTH = [0.7, 1.3];
// 离方块的角多远就不放了，免得石头从角上戳出来
const PEBBLE_CORNER_MARGIN = 0.3;
const PEBBLE_SEED = 7;

// 萤火虫：每平方单位几只，在多大一块范围里飞（占整个森林的比例）
const FIREFLIES_PER_AREA = 0.25;
const FIREFLY_SPREAD = 0.9;
const FIREFLY_COLOR = '#fff3a0';
const FIREFLY_SEED = 5;

/**
 * 撒点缀
 * @param {World} world 童话森林
 */
export function buildScenery(world) {
  flowers(world);
  grass(world);
  sidePebbles(world);
  fireflies(world);
}

// ---------- 花 ----------

/**
 * 种花：屋前、路边、树下、空地上几大片，再加一些野花
 * @param {World} world
 */
function flowers(world) {
  const random = rng(FLOWER_SEED);
  const blooms = [
    ...houseBeds(world, random),
    ...pathClusters(world, random),
    ...treeClusters(world, random),
    ...FLOWER_PATCHES.flatMap(([x, z, radius, count]) => cluster(world, random, x, z, radius, count, pickColors(random))),
    ...wildflowers(world, random),
  ];
  world.root.add(flowerField(world.kit, blooms));
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
 * @returns {object[]} flowerField 要的每朵花
 */
function cluster(world, random, centerX, centerZ, radius, count, colors) {
  const blooms = [];
  for (let i = 0; i < count; i++) {
    // 开平方让花在圆里撒得均匀，不全挤在中间
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    const x = centerX + Math.cos(angle) * distance;
    const z = centerZ + Math.sin(angle) * distance;
    const color = colors[i % colors.length];
    const bloom = bloomAt(world, random, x, z, color);
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
  const offPath = distanceToPath(x, z) > PATH_HALF_WIDTH + FLOWER_CLEAR_OF_PATH;
  const free = onFlatGround && offPath && !world.blocked(x, z, FLOWER_ROOM);
  if (!free) {
    return null;
  }

  const scale = FLOWER_SCALE[0] + random() * (FLOWER_SCALE[1] - FLOWER_SCALE[0]);
  return { x, y: world.heightAt(x, z), z, color, scale, turn: random() * Math.PI * 2 };
}

/**
 * 每座蘑菇屋门口两边各一小片花坛，颜色跟着屋顶
 * @param {World} world
 * @param {Function} random
 * @returns {object[]}
 */
function houseBeds(world, random) {
  return HOUSES.flatMap((house) => {
    const distance = house.stemRadius + BED_GAP;
    const frontX = house.x + Math.sin(house.facing) * distance;
    const frontZ = house.z + Math.cos(house.facing) * distance;
    // 门的左右两边（和门的朝向垂直）
    const sideX = Math.cos(house.facing) * BED_SIDE;
    const sideZ = -Math.sin(house.facing) * BED_SIDE;
    const colors = [house.capColor, '#ffffff'];
    return [
      ...cluster(world, random, frontX + sideX, frontZ + sideZ, BED_RADIUS, BED_BLOOMS, colors),
      ...cluster(world, random, frontX - sideX, frontZ - sideZ, BED_RADIUS, BED_BLOOMS, colors),
    ];
  });
}

/**
 * 路边隔一段长一簇花，左右轮流
 * @param {World} world
 * @param {Function} random
 * @returns {object[]}
 */
function pathClusters(world, random) {
  const blooms = [];
  let side = 1;

  for (const path of PATHS) {
    for (let i = 0; i < path.length - 1; i++) {
      const [startX, startZ] = path[i];
      const [endX, endZ] = path[i + 1];
      const length = Math.hypot(endX - startX, endZ - startZ);
      // 和路垂直的方向
      const normalX = -(endZ - startZ) / length;
      const normalZ = (endX - startX) / length;
      const offset = PATH_HALF_WIDTH + PATH_CLUSTER_GAP;

      for (let along = PATH_CLUSTER_SPACING / 2; along < length; along += PATH_CLUSTER_SPACING) {
        const t = along / length;
        const x = startX + (endX - startX) * t + normalX * offset * side;
        const z = startZ + (endZ - startZ) * t + normalZ * offset * side;
        blooms.push(...cluster(world, random, x, z, PATH_CLUSTER_RADIUS, PATH_CLUSTER_BLOOMS, pickColors(random)));
        side = -side;
      }
    }
  }
  return blooms;
}

/**
 * 显眼的几棵树底下各一簇花
 * @param {World} world
 * @param {Function} random
 * @returns {object[]}
 */
function treeClusters(world, random) {
  return TREES.flatMap(([treeX, treeZ]) => {
    const angle = random() * Math.PI * 2;
    const x = treeX + Math.cos(angle) * TREE_CLUSTER_GAP;
    const z = treeZ + Math.sin(angle) * TREE_CLUSTER_GAP;
    return cluster(world, random, x, z, TREE_CLUSTER_RADIUS, TREE_CLUSTER_BLOOMS, pickColors(random));
  });
}

/**
 * 零零星星的野花，撒满整个森林
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
    const bloom = bloomAt(world, random, x, z, FLOWER_COLORS[i % FLOWER_COLORS.length]);
    if (bloom) {
      blooms.push(bloom);
    }
  }
  return blooms;
}

// ---------- 草 ----------

/**
 * 满地的小草丛，让草地不是一块平平的绿色
 * @param {World} world
 */
function grass(world) {
  const random = rng(GRASS_SEED);
  const terrain = world.terrain;
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const tufts = [];

  for (let tries = 0; tries < GRASS_TUFTS * GRASS_TRIES && tufts.length < GRASS_TUFTS; tries++) {
    const x = minX + random() * (maxX - minX);
    const z = minZ + random() * (maxZ - minZ);
    const onFlatGround = terrain.isPlainGround(x, z) && !terrain.straddles(x, z, GRASS_CLEAR_OF_CLIFF);
    const offPath = distanceToPath(x, z) > PATH_HALF_WIDTH;
    const free = onFlatGround && offPath && !world.blocked(x, z, GRASS_ROOM);
    if (!free) {
      continue;
    }

    const color = GRASS_COLORS[Math.floor(random() * GRASS_COLORS.length)];
    const scale = GRASS_SCALE[0] + random() * (GRASS_SCALE[1] - GRASS_SCALE[0]);
    tufts.push({ x, y: world.heightAt(x, z), z, color, scale, turn: random() * Math.PI * 2 });
  }
  world.root.add(grassField(world.kit, tufts));
}

// ---------- 侧面、萤火虫 ----------

/**
 * 方块四个侧面的土里嵌几块小石头
 * @param {World} world
 */
function sidePebbles(world) {
  const random = rng(PEBBLE_SEED);
  const [width, depth] = world.size;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  // 四个侧面：沿哪个方向排、贴在哪儿、扁的那面要不要转过来朝 x
  const sides = [
    { length: width, place: (along, y) => [along, y, halfDepth], turned: false },
    { length: depth, place: (along, y) => [halfWidth, y, along], turned: true },
    { length: width, place: (along, y) => [along, y, -halfDepth], turned: false },
    { length: depth, place: (along, y) => [-halfWidth, y, along], turned: true },
  ];

  for (const side of sides) {
    const count = Math.round(side.length * PEBBLES_PER_LENGTH);
    for (let i = 0; i < count; i++) {
      const along = (random() - 0.5) * (side.length - PEBBLE_CORNER_MARGIN * 2);
      const y = -(PEBBLE_DEPTH[0] + random() * (PEBBLE_DEPTH[1] - PEBBLE_DEPTH[0]));
      const radius = PEBBLE_RADIUS[0] + random() * (PEBBLE_RADIUS[1] - PEBBLE_RADIUS[0]);
      const [x, , z] = side.place(along, y);
      // 小溪流出去的地方侧面是水，不嵌石头
      if (!world.terrain.isPlainGround(x, z)) {
        continue;
      }

      const facing = side.turned ? Math.PI / 2 : 0;
      world.add(sidePebble(world.kit, radius), x, y, z, facing);
    }
  }
}

/**
 * 萤火虫：在整片森林上空慢慢飘
 * @param {World} world
 */
function fireflies(world) {
  const [width, depth] = world.size;
  const spread = Math.max(width, depth) * FIREFLY_SPREAD;
  const count = Math.round(width * depth * FIREFLIES_PER_AREA);

  const motes = makeMotes(count, spread, FIREFLY_COLOR, FIREFLY_SEED);
  world.root.add(motes);
  world.onUpdate((dt, time) => motes.userData.update(time));
}
