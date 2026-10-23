// 树和灌木：几棵有讲究的树，后边、左边、右后一圈树墙把小镇框起来，最前面只种矮灌木；
// 台地边上、崖脚下、池塘边几丛灌木打断一条条直直的崖边，人碰到会沙沙响（touch.js）
// 树墙要避开已经摆好的东西（房子、风车、物品、小路），所以要在它们后面种
import { rng } from '../../kit.js';
import { voxelTree, voxelBush } from './plants.js';
import { offPaths } from './paths.js';
import { TREES, BUSHES, SPAWN, VILLAGERS, CRATES, SAX, FOUNTAIN, BACKYARD } from './layout.js';

// 树干有多粗：人绕着树干走，树冠不挡
const TRUNK_RADIUS = 0.15;
// 每棵树转一个不同的角度（黄金角），看起来不像复制出来的
const GOLDEN_ANGLE = 2.39996;

// 树墙：离方块边多远，隔多远一棵，位置随机错开多少
const WALL_INSET = 0.45;
const WALL_SPACING = 0.95;
const WALL_JITTER = 0.25;
// 右边只种后半边（z 小于这个），前半边离镜头近，种了挡住池塘和瀑布
const RIGHT_WALL_TO_Z = -1.2;
// 树墙的树：轮流用哪几种，多大
const WALL_KINDS = ['pine', 'oak', 'birch', 'pine', 'apple', 'oak'];
const WALL_SIZE = [0.7, 1.0];
// 种下去的地方：周围留多大空地，离崖边多远；离小路、广场多远；离物品、出生点、小人多远
const WALL_ROOM = 0.3;
const WALL_CLIFF_ROOM = 0.35;
const CLEAR_OF_PATH = 0.3;
const CLEAR_OF_SPOTS = 0.8;
const WALL_SEED = 21;

// 最前面一排矮灌木：离前边多远，隔多远一丛，多大
const FRONT_INSET = 0.3;
const FRONT_SPACING = 1.3;
const FRONT_RADIUS = [0.18, 0.26];
const BUSH_COLORS = ['#5fb24c', '#4fa64a', '#6cbd55'];
// 灌木的碰撞比看起来小一圈：边上疙疙瘩瘩的叶子人可以擦过去
const BUSH_SOLID = 0.8;
const BUSH_SEED = 41;

/**
 * 种树、种灌木
 * @param {World} world 像素小镇
 * @returns {{ crowns: THREE.Group[], bushes: { x: number, z: number, radius: number, group: THREE.Group }[] }} 树冠（风吹的时候摇）；灌木（碰一下会沙沙响）
 */
export function buildWoods(world) {
  const crowns = TREES.map(([x, z, look], index) => plantTree(world, x, z, { ...look, seed: index + 1 }));
  const bushes = BUSHES.map(([x, z, radius], index) => plantBush(world, x, z, radius, BUSH_SEED + index));

  crowns.push(...treeWall(world));
  bushes.push(...frontBushes(world));
  return { crowns, bushes };
}

/**
 * 种一棵树，树干登记成障碍
 * @param {World} world
 * @param {number} x
 * @param {number} z
 * @param {{ kind: string, size: number, seed: number }} look
 * @returns {THREE.Group} 树冠
 */
function plantTree(world, x, z, look) {
  const { group, crown } = voxelTree(world.kit, look);
  world.add(group, x, world.heightAt(x, z), z, (look.seed * GOLDEN_ANGLE) % (Math.PI * 2));
  world.solidCircle(x, z, TRUNK_RADIUS * look.size);
  return crown;
}

/**
 * 种一丛灌木，登记成障碍
 * @param {World} world
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 * @param {number} seed
 * @returns {{ x: number, z: number, radius: number, group: THREE.Group }}
 */
function plantBush(world, x, z, radius, seed) {
  const color = BUSH_COLORS[seed % BUSH_COLORS.length];
  const group = voxelBush(world.kit, radius, seed, color);
  world.add(group, x, world.heightAt(x, z), z, seed * GOLDEN_ANGLE);
  world.solidCircle(x, z, radius * BUSH_SOLID);
  return { x, z, radius, group };
}

/**
 * 树墙：沿后边、左边、右后边种一排，避开房子、小路、台阶、崖边
 * @param {World} world
 * @returns {THREE.Group[]} 树冠
 */
function treeWall(world) {
  const random = rng(WALL_SEED);
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const lines = [
    { from: [minX + WALL_INSET, minZ + WALL_INSET], to: [maxX - WALL_INSET, minZ + WALL_INSET] },
    { from: [minX + WALL_INSET, minZ + WALL_INSET + WALL_SPACING], to: [minX + WALL_INSET, maxZ - WALL_INSET] },
    { from: [maxX - WALL_INSET, minZ + WALL_INSET + WALL_SPACING], to: [maxX - WALL_INSET, RIGHT_WALL_TO_Z] },
  ];

  const crowns = [];
  let planted = 0;
  for (const line of lines) {
    for (const [x, z] of spotsAlong(line, random)) {
      if (!roomForTree(world, x, z)) {
        continue;
      }
      const kind = WALL_KINDS[planted % WALL_KINDS.length];
      const size = WALL_SIZE[0] + random() * (WALL_SIZE[1] - WALL_SIZE[0]);
      crowns.push(plantTree(world, x, z, { kind, size, seed: WALL_SEED + planted }));
      planted++;
    }
  }
  return crowns;
}

/**
 * 沿一条线隔一段取一个点，前后左右随机错开一点
 * @param {{ from: number[], to: number[] }} line
 * @param {Function} random
 * @returns {number[][]} [[x, z], ...]
 */
function spotsAlong({ from, to }, random) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const count = Math.floor(length / WALL_SPACING) + 1;
  const spots = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const x = from[0] + (to[0] - from[0]) * t + (random() - 0.5) * 2 * WALL_JITTER;
    const z = from[1] + (to[1] - from[1]) * t + (random() - 0.5) * 2 * WALL_JITTER;
    spots.push([x, z]);
  }
  return spots;
}

/**
 * 这里能不能种一棵树墙的树：平地、离崖边远、不压着路和东西，也不挡着物品、小人和蓝屋子的后院
 * @param {World} world
 * @param {number} x
 * @param {number} z
 * @returns {boolean}
 */
function roomForTree(world, x, z) {
  const terrain = world.terrain;
  const flat = terrain.isPlainGround(x, z) && !terrain.straddles(x, z, WALL_CLIFF_ROOM);
  const keepClear = [SPAWN, SAX, [CRATES.x, CRATES.z], [FOUNTAIN.x, FOUNTAIN.z], ...Object.values(VILLAGERS), ...world.pois.map((poi) => [poi.x, poi.z])];
  const nearSpot = keepClear.some(([spotX, spotZ]) => Math.hypot(x - spotX, z - spotZ) < CLEAR_OF_SPOTS);
  const inBackyard = x > BACKYARD.minX && x < BACKYARD.maxX && z > BACKYARD.minZ && z < BACKYARD.maxZ;
  return flat && offPaths(x, z, CLEAR_OF_PATH) && !nearSpot && !inBackyard && !world.blocked(x, z, WALL_ROOM);
}

/**
 * 最前面一排矮灌木：离镜头近，只种矮的，不挡视线
 * @param {World} world
 * @returns {{ x: number, z: number, radius: number, group: THREE.Group }[]}
 */
function frontBushes(world) {
  const random = rng(BUSH_SEED);
  const { minX, maxX, maxZ } = world.bounds;
  const line = { from: [minX + FRONT_INSET, maxZ - FRONT_INSET], to: [maxX - FRONT_INSET, maxZ - FRONT_INSET] };
  const count = Math.floor((maxX - minX) / FRONT_SPACING) + 1;

  const bushes = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = line.from[0] + (line.to[0] - line.from[0]) * t + (random() - 0.5) * WALL_JITTER;
    const z = line.from[1] - random() * WALL_JITTER;
    const radius = FRONT_RADIUS[0] + random() * (FRONT_RADIUS[1] - FRONT_RADIUS[0]);
    if (roomForTree(world, x, z)) {
      bushes.push(plantBush(world, x, z, radius, BUSH_SEED + 100 + i));
    }
  }
  return bushes;
}
