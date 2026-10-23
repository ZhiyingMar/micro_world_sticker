// 到处撒的小点缀：小路上的石板、满地的小花、方块侧面嵌着的小石头、萤火虫
// 都只是看的，不挡路。要等别的东西都摆好、碰撞登记完了再撒，花才不会长进树干和屋子里
import { rng } from '../../kit.js';
import { makeMotes } from '../../fx.js';
import { pathStone, flower, sidePebble } from './models.js';
import { PATHS } from './layout.js';

// 小路：石板多大、隔多远一块，左右错开多少、随机歪多少
const PATH_STONE_RADIUS = 0.2;
const PATH_STONE_SPACING = 0.55;
const PATH_STONE_SWAY = 0.1;
const PATH_STONE_JITTER = 0.08;
const PATH_SEED = 5;

// 小花：每平方单位大约几朵，撒的时候最多试几次；离小路石板多近就不种
const FLOWERS_PER_AREA = 0.6;
const FLOWER_TRIES_PER_FLOWER = 6;
const FLOWER_ROOM = 0.12;
const FLOWER_CLEAR_OF_PATH = 0.3;
const FLOWER_COLORS = ['#ff8fb1', '#ffffff', '#ffd84a', '#b38ee8', '#ff9a6b'];
const FLOWER_SEED = 42;

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
  const stones = pathStones(world);
  flowers(world, stones);
  sidePebbles(world);
  fireflies(world);
}

/**
 * 沿着 layout 里的小路铺石板
 * @param {World} world
 * @returns {number[][]} 每块石板的位置 [x, z]，撒花时避开
 */
function pathStones(world) {
  const random = rng(PATH_SEED);
  const placed = [];

  for (const path of PATHS) {
    for (let i = 0; i < path.length - 1; i++) {
      placed.push(...stonesAlong(world, random, path[i], path[i + 1]));
    }
  }
  return placed;
}

/**
 * 一段直路上铺石板，一左一右错开着铺
 * @description 落在台阶上、悬在崖边的石板不铺（它是平的，铺上去会翘起来或者悬空）
 * @param {World} world
 * @param {Function} random 随机数
 * @param {number[]} start 这一段的起点 [x, z]
 * @param {number[]} end 这一段的终点 [x, z]
 * @returns {number[][]} 铺下的石板位置
 */
function stonesAlong(world, random, start, end) {
  const [startX, startZ] = start;
  const dx = end[0] - startX;
  const dz = end[1] - startZ;
  const length = Math.hypot(dx, dz);
  const count = Math.max(1, Math.round(length / PATH_STONE_SPACING));
  const placed = [];

  for (let i = 0; i < count; i++) {
    const t = i / count;
    // 和路垂直的方向上左右错开
    const side = i % 2 ? PATH_STONE_SWAY : -PATH_STONE_SWAY;
    const x = startX + dx * t + (-dz / length) * side + (random() - 0.5) * PATH_STONE_JITTER;
    const z = startZ + dz * t + (dx / length) * side + (random() - 0.5) * PATH_STONE_JITTER;
    const flat = world.terrain.isPlainGround(x, z) && !world.terrain.straddles(x, z, PATH_STONE_RADIUS);
    if (!flat) {
      continue;
    }

    world.add(pathStone(world.kit, PATH_STONE_RADIUS), x, world.heightAt(x, z), z, random() * Math.PI);
    placed.push([x, z]);
  }
  return placed;
}

/**
 * 满地的小花：随机撒在空着的平地上
 * @description 种子固定，每次进来花都长在一样的地方
 * @param {World} world
 * @param {number[][]} stones 小路石板的位置，花不长在石板上
 */
function flowers(world, stones) {
  const random = rng(FLOWER_SEED);
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const wanted = Math.round((maxX - minX) * (maxZ - minZ) * FLOWERS_PER_AREA);
  const nearPath = (x, z) => stones.some(([stoneX, stoneZ]) => Math.hypot(x - stoneX, z - stoneZ) < FLOWER_CLEAR_OF_PATH);
  let planted = 0;

  for (let tries = 0; tries < wanted * FLOWER_TRIES_PER_FLOWER && planted < wanted; tries++) {
    const x = minX + random() * (maxX - minX);
    const z = minZ + random() * (maxZ - minZ);
    const free = world.terrain.isPlainGround(x, z) && !world.blocked(x, z, FLOWER_ROOM) && !nearPath(x, z);
    if (!free) {
      continue;
    }

    world.add(flower(world.kit, FLOWER_COLORS[planted % FLOWER_COLORS.length]), x, world.heightAt(x, z), z, random() * Math.PI * 2);
    planted++;
  }
}

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
