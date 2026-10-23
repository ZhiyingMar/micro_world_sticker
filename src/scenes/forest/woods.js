// 树林：几棵显眼的树、四周一圈树墙、左前方躺着的空心木头（爱心藏在里面）、右边草地前面一道白栅栏
// 树墙要避开已经摆好的东西（屋子、能翻的地方、物品、小路），所以要在它们后面种
import * as THREE from 'three';
import { rng } from '../../kit.js';
import { hollowLog, picketFence } from './models.js';
import { tree, bush } from './plants.js';
import { distanceToPath, PATH_HALF_WIDTH } from './paths.js';
import { TREES, NAP_SPOT, LOG, HEART_INSET, LOG_PEEK_FROM, FENCE, FLOWER_SPOT, SPAWN, VILLAGERS } from './layout.js';

// 树干有多粗：人绕着树干走，树冠不挡
const TRUNK_RADIUS = 0.2;
// 爱心在木头里离底面多高（躺在木头内壁上）
const HEART_LIFT = 0.32;
// 往木头里看的时候，镜头对准木头里多高的地方
const PEEK_HEIGHT = 0.35;
// 看木头的人站在木头前面多远
const LOG_SPOT_GAP = 0.85;
// 栅栏的碰撞有多厚
const FENCE_THICKNESS = 0.1;
// 打盹、看虫子、看花各待多久（秒）
const NAP_STAY = 8;
const LOG_STAY = 5;
const FLOWER_STAY = 6;

// 树墙：后边和左边（离镜头远，种高树不挡视线）种两排，离边多远、隔多远一棵、位置随机错开多少
const WALL_ROWS = [0.45, 1.2];
const WALL_SPACING = 0.8;
const WALL_JITTER = 0.3;
// 树墙的树：什么种类、多大、什么颜色
const WALL_KINDS = ['pine', 'round', 'pine', 'poplar', 'round'];
const WALL_SIZE = [0.85, 1.25];
const WALL_COLORS = {
  pine: ['#4f9a6a', '#5aa874', '#44906a'],
  round: ['#7fd06a', '#6cc26a', '#93d86f'],
  poplar: ['#9ad66c', '#86c95f'],
};
// 前边和右边（离镜头近）只种矮灌木：离边多远、隔多远一丛、多大
const HEDGE_INSET = 0.35;
const HEDGE_SPACING = 1.0;
const HEDGE_RADIUS = [0.24, 0.36];
const HEDGE_COLORS = ['#7fd06a', '#6cc26a', '#8fd17f'];
// 种下去的地方：周围留多大空地（也管着离方块边至少这么远），离崖边多远；离小路、兴趣点、能翻的地方、物品、小人多远
const WALL_ROOM = 0.35;
const WALL_CLIFF_ROOM = 0.45;
const CLEAR_OF_PATH = 0.4;
const CLEAR_OF_SPOTS = 0.75;
// 山顶（两层）不种树墙，高塔要衬着天空
const WALL_MAX_LEVEL = 1;
const WALL_SEED = 21;
// 每棵树转一个不同的角度（黄金角），看起来不像复制出来的
const GOLDEN_ANGLE = 2.39996;

/**
 * 搭树林
 * @param {World} world 童话森林
 * @returns {{ crowns: THREE.Group[] }} 所有树冠，风吹的时候摇它们
 */
export function buildWoods(world) {
  const crowns = featureTrees(world);
  log(world);
  fence(world);
  crowns.push(...treeWall(world));
  edgeHedges(world);
  return { crowns };
}

/**
 * 种一棵树，树干登记成障碍
 * @param {World} world
 * @param {number} x
 * @param {number} z
 * @param {object} look tree() 的样子
 * @returns {THREE.Group} 树冠
 */
function plant(world, x, z, look) {
  const { group, crown } = tree(world.kit, look);
  const turn = (look.seed * GOLDEN_ANGLE) % (Math.PI * 2);
  world.add(group, x, world.heightAt(x, z), z, turn);
  world.solidCircle(x, z, TRUNK_RADIUS);
  return crown;
}

/**
 * 显眼的那几棵树
 * @param {World} world
 * @returns {THREE.Group[]} 树冠
 */
function featureTrees(world) {
  const crowns = TREES.map(([x, z, look], index) => plant(world, x, z, { ...look, seed: index + 1 }));
  world.poi(NAP_SPOT.x, NAP_SPOT.z, { emote: '💤', face: NAP_SPOT.face, dur: NAP_STAY });
  return crowns;
}

/**
 * 空心木头：爱心藏在开口那头，点木头时镜头转到开口往里看
 * @param {World} world
 */
function log(world) {
  const groundY = world.heightAt(LOG.x, LOG.z);
  const hollow = hollowLog(world.kit, LOG);
  world.add(hollow, LOG.x, groundY, LOG.z);
  world.solid(hollow);

  // 开口朝 +x：爱心在开口那头往里一点
  const heartX = LOG.x + LOG.length / 2 - HEART_INSET;
  hollow.userData.peek = { target: [heartX, groundY + PEEK_HEIGHT, LOG.z], from: LOG_PEEK_FROM };
  world.placeItem('heart', heartX, groundY + HEART_LIFT, LOG.z, { ry: Math.PI / 2, spin: false });

  world.poi(LOG.x, LOG.z + LOG.radius + LOG_SPOT_GAP, { emote: '🐛', face: Math.PI, dur: LOG_STAY });
}

/**
 * 右边草地最前面的一道白栅栏，后面是看花的地方
 * @param {World} world
 */
function fence(world) {
  const { fromX, toX, z } = FENCE;
  const centerX = (fromX + toX) / 2;
  world.add(picketFence(world.kit, toX - fromX), centerX, world.heightAt(centerX, z), z);
  world.colliders.push({ type: 'box', minX: fromX, maxX: toX, minZ: z - FENCE_THICKNESS / 2, maxZ: z + FENCE_THICKNESS / 2 });

  world.poi(FLOWER_SPOT.x, FLOWER_SPOT.z, { emote: '🌸', face: FLOWER_SPOT.face, dur: FLOWER_STAY });
}

/**
 * 后边和左边种两排密密的树，像森林把这块空地围起来
 * @description 只种在离镜头远的两边，挡不住视线；空不出地方的位置就跳过，不硬塞
 * @param {World} world
 * @returns {THREE.Group[]} 树冠
 */
function treeWall(world) {
  const random = rng(WALL_SEED);
  const [width, depth] = world.size;
  const crowns = [];

  for (const inset of WALL_ROWS) {
    // 后边一排（沿 x），左边一排（沿 z）
    const back = alongEdge(random, width, (along) => [along, -depth / 2 + inset]);
    const left = alongEdge(random, depth, (along) => [-width / 2 + inset, along]);
    for (const point of [...back, ...left]) {
      const [x, z] = insideEdge(world, point);
      if (!roomForTree(world, x, z)) {
        continue;
      }

      const kind = WALL_KINDS[Math.floor(random() * WALL_KINDS.length)];
      const palette = WALL_COLORS[kind];
      const look = {
        kind,
        size: WALL_SIZE[0] + random() * (WALL_SIZE[1] - WALL_SIZE[0]),
        color: palette[Math.floor(random() * palette.length)],
        seed: Math.floor(random() * 1000),
      };
      crowns.push(plant(world, x, z, look));
    }
  }
  return crowns;
}

/**
 * 前边和右边贴着边种一溜矮灌木，方块边上不至于光秃秃的
 * @param {World} world
 */
function edgeHedges(world) {
  const random = rng(WALL_SEED + 1);
  const [width, depth] = world.size;
  const front = alongEdge(random, width, (along) => [along, depth / 2 - HEDGE_INSET], HEDGE_SPACING);
  const right = alongEdge(random, depth, (along) => [width / 2 - HEDGE_INSET, along], HEDGE_SPACING);

  for (const point of [...front, ...right]) {
    const [x, z] = insideEdge(world, point);
    if (!roomForTree(world, x, z)) {
      continue;
    }
    const radius = HEDGE_RADIUS[0] + random() * (HEDGE_RADIUS[1] - HEDGE_RADIUS[0]);
    const color = HEDGE_COLORS[Math.floor(random() * HEDGE_COLORS.length)];
    world.add(bush(world.kit, radius, color), x, world.heightAt(x, z), z, random() * Math.PI * 2);
  }
}

/**
 * 沿着一条边等距取一串位置，每个位置随机错开一点
 * @param {Function} random 随机数
 * @param {number} length 这条边多长
 * @param {(along: number) => number[]} toPoint 沿边走到哪 → [x, z]
 * @param {number} spacing 隔多远一个
 * @returns {number[][]}
 */
function alongEdge(random, length, toPoint, spacing = WALL_SPACING) {
  const points = [];
  for (let along = -length / 2 + spacing / 2; along < length / 2; along += spacing) {
    const [x, z] = toPoint(along + (random() - 0.5) * WALL_JITTER);
    points.push([x + (random() - 0.5) * WALL_JITTER, z + (random() - 0.5) * WALL_JITTER]);
  }
  return points;
}

/**
 * 把一个位置往里收，离方块边至少留出一棵树的空地
 * @param {World} world
 * @param {number[]} point [x, z]
 * @returns {number[]}
 */
function insideEdge(world, [x, z]) {
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const margin = WALL_ROOM + 0.01;
  return [THREE.MathUtils.clamp(x, minX + margin, maxX - margin), THREE.MathUtils.clamp(z, minZ + margin, maxZ - margin)];
}

/**
 * 这里能不能种树墙的一棵树（或者一丛灌木）
 * @description 要是平地、不贴着崖边、周围没东西、不压着小路，也不挡着人会去的地方
 * @param {World} world
 * @param {number} x
 * @param {number} z
 * @returns {boolean}
 */
function roomForTree(world, x, z) {
  const terrain = world.terrain;
  const [column, row] = terrain.cellAt(x, z);
  const flat = terrain.isPlainGround(x, z) && !terrain.straddles(x, z, WALL_CLIFF_ROOM);
  const lowEnough = terrain.levelOf(column, row) <= WALL_MAX_LEVEL;
  const free = flat && lowEnough && !world.blocked(x, z, WALL_ROOM);
  if (!free) {
    return false;
  }
  if (distanceToPath(x, z) < PATH_HALF_WIDTH + CLEAR_OF_PATH) {
    return false;
  }
  return !keepClearSpots(world).some(([spotX, spotZ]) => Math.hypot(x - spotX, z - spotZ) < CLEAR_OF_SPOTS);
}

/**
 * 树墙不能挡住的地方：兴趣点、能翻的地方、物品、出生点、小人
 * @param {World} world
 * @returns {number[][]}
 */
function keepClearSpots(world) {
  const pois = world.pois.map((poi) => [poi.x, poi.z]);
  const hideouts = [...world.hideouts.values()].map((spot) => [spot.x, spot.z]);
  const items = [...world.items.values(), ...world.hiddenItems.values()].map((item) => [item.position.x, item.position.z]);
  return [...pois, ...hideouts, ...items, SPAWN, ...Object.values(VILLAGERS)];
}
