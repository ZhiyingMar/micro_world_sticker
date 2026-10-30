// 池塘和小溪：水、桥、踏脚石都在地形地图里，由地面画出来；这里摆水线上的石头、荷叶、荷花，和荷叶上的金币
// 小溪流到方块边上的地方，两岸各压一块大石头，水里横着一排小石头拦住，水不会直接从边上流出去
import { rng } from '../../kit.js';
import { lilyPad, lotus, shoreRock, boulder } from './models.js';
import { LILY_PADS, COIN_PAD, LOTUS_PAD, FISHING_SPOT, STREAM_SPOT, STREAM_MOUTH } from './layout.js';

// 岸边石头：每条岸边摆几块、多大、什么颜色；石头一半泡在水里，压在水线上
const ROCKS_PER_EDGE = 3;
const ROCK_RADIUS = [0.09, 0.16];
const ROCK_COLORS = ['#d6d0c4', '#c4bdb0', '#b9b2a4'];
// 石头中心离水面多高（负数是往水下）：露出来一小半
const ROCK_SINK = -0.03;
// 岸边石头沿着岸撒开的范围（一格边长的一部分，两头留空，免得拐角处叠在一起）
const ROCK_SPREAD = 0.8;
const ROCK_SEED = 3;
// 只有和水差一层的地方（0 层的平地）才算岸；山腰那种高崖下面直接是水，不摆
const SHORE_LEVEL = 0;
// 上下左右四个方向 [列, 行]
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// 小溪口的石头：颜色；大石头压多扁、高度的几成埋进土里；拦水的小石头竖着不压扁，顶露出水面多少
const MOUTH_COLORS = ['#b9b2a4', '#c4bdb0', '#aaa396'];
const BOULDER_FLATTEN = 0.75;
const BOULDER_SINK = 0.4;
const WEIR_FLATTEN = 1;
const WEIR_ABOVE_WATER = 0.1;
// 大石头的碰撞比石头本身小一点，人能贴着石头走
const BOULDER_SOLID = 0.85;
const MOUTH_SEED = 41;

// 金币浮在荷叶上面多高
const COIN_LIFT = 0.2;
// 钓鱼、看鱼各待多久（秒）
const FISHING_STAY = 8;
const STREAM_STAY = 5;

/**
 * 搭池塘和小溪
 * @param {World} world 童话森林
 * @param {{ waterSurface: number }} ground 画出来的地面（水面多高）
 */
export function buildPond(world, ground) {
  shoreRocks(world, ground.waterSurface);
  lilyPads(world, ground.waterSurface);
  streamMouths(world, ground);

  world.poi(FISHING_SPOT.x, FISHING_SPOT.z, { emote: '🎣', face: FISHING_SPOT.face, dur: FISHING_STAY });
  world.poi(STREAM_SPOT.x, STREAM_SPOT.z, { emote: '🐟', face: STREAM_SPOT.face, dur: STREAM_STAY });
}

/**
 * 池塘和小溪岸边的水线上摆一圈小石头
 * @description 岸边已经磨圆了，再压一圈半泡在水里的石头，岸线更像天然的
 * @param {World} world
 * @param {number} waterSurface 水面多高
 */
function shoreRocks(world, waterSurface) {
  const terrain = world.terrain;
  const random = rng(ROCK_SEED);

  for (let row = 0; row < terrain.d; row++) {
    for (let col = 0; col < terrain.w; col++) {
      if (terrain.ch(col, row) !== '~') {
        continue;
      }
      for (const direction of NEIGHBORS) {
        rocksAlongEdge(world, random, waterSurface, col, row, direction);
      }
    }
  }
}

/**
 * 一格水朝某个方向的那条边，如果对面是岸，就在水线上摆几块石头
 * @param {World} world
 * @param {Function} random 随机数
 * @param {number} waterSurface 水面多高
 * @param {number} col 水格子的列
 * @param {number} row 水格子的行
 * @param {number[]} direction 朝哪边 [列, 行]
 */
function rocksAlongEdge(world, random, waterSurface, col, row, direction) {
  const terrain = world.terrain;
  const [dCol, dRow] = direction;
  const neighborCol = col + dCol;
  const neighborRow = row + dRow;
  const insideMap = neighborCol >= 0 && neighborRow >= 0 && neighborCol < terrain.w && neighborRow < terrain.d;
  if (!insideMap) {
    return;
  }
  const neighbor = terrain.ch(neighborCol, neighborRow);
  const isShore = neighbor === String(SHORE_LEVEL);
  if (!isShore) {
    return;
  }

  // 两格之间那条边的中点，正好是水线
  const centerX = terrain.x0 + col + 0.5;
  const centerZ = terrain.z0 + row + 0.5;
  const edgeX = centerX + dCol * 0.5;
  const edgeZ = centerZ + dRow * 0.5;

  for (let i = 0; i < ROCKS_PER_EDGE; i++) {
    // 沿着岸边（和 direction 垂直）撒开
    const along = (random() - 0.5) * ROCK_SPREAD;
    const x = edgeX + dRow * along;
    const z = edgeZ + dCol * along;
    const radius = ROCK_RADIUS[0] + random() * (ROCK_RADIUS[1] - ROCK_RADIUS[0]);
    const color = ROCK_COLORS[i % ROCK_COLORS.length];
    world.add(shoreRock(world.kit, radius, color), x, waterSurface + ROCK_SINK, z, random() * Math.PI);
  }
}

/**
 * 找出水流到方块边上的地方，每一处都用石头拦上
 * @param {World} world
 * @param {{ waterSurface: number, heightAt: Function }} ground 画出来的地面
 */
function streamMouths(world, ground) {
  const terrain = world.terrain;
  const random = rng(MOUTH_SEED);

  for (let row = 0; row < terrain.d; row++) {
    for (let col = 0; col < terrain.w; col++) {
      if (terrain.ch(col, row) !== '~') {
        continue;
      }
      for (const direction of NEIGHBORS) {
        const outside = !isInsideMap(terrain, col + direction[0], row + direction[1]);
        if (outside) {
          blockMouth(world, ground, random, col, row, direction);
        }
      }
    }
  }
}

/**
 * 这一格在不在地图里
 * @param {Terrain} terrain
 * @param {number} col
 * @param {number} row
 * @returns {boolean}
 */
function isInsideMap(terrain, col, row) {
  return col >= 0 && row >= 0 && col < terrain.w && row < terrain.d;
}

/**
 * 拦一处小溪口：两岸各一块大石头，水里横着一排小石头
 * @param {World} world
 * @param {{ waterSurface: number, heightAt: Function }} ground
 * @param {Function} random
 * @param {number} col 流到边上的那格水
 * @param {number} row
 * @param {number[]} direction 往方块外面的方向 [列, 行]
 */
function blockMouth(world, ground, random, col, row, direction) {
  const terrain = world.terrain;
  const [outX, outZ] = direction;
  // 沿着方块边的方向（和往外的方向垂直）
  const alongX = outZ;
  const alongZ = outX;
  // 这格水贴着方块边那条线的中点
  const edgeX = terrain.x0 + col + 0.5 + outX * 0.5;
  const edgeZ = terrain.z0 + row + 0.5 + outZ * 0.5;
  const { boulderRadius, boulderInset, boulderFromEdge, weirStones, weirRadius, weirFromEdge } = STREAM_MOUTH;

  // 两岸的大石头：压在岸上，靠着水，离方块边一点点
  for (const side of [-1, 1]) {
    const x = edgeX + alongX * side * (0.5 + boulderInset) - outX * boulderFromEdge;
    const z = edgeZ + alongZ * side * (0.5 + boulderInset) - outZ * boulderFromEdge;
    if (!terrain.isPlainGround(x, z)) {
      continue;
    }
    const radius = between(random, boulderRadius);
    const rock = boulder(world.kit, { radius, flatten: BOULDER_FLATTEN, color: pick(random, MOUTH_COLORS), seed: Math.floor(random() * 1000) });
    // 石头压扁后一共 2 × radius × flatten 高，其中 BOULDER_SINK 那么多埋在土里
    const halfHeight = radius * BOULDER_FLATTEN;
    world.add(rock, x, ground.heightAt(x, z) + halfHeight - halfHeight * 2 * BOULDER_SINK, z, random() * Math.PI);
    world.solidCircle(x, z, radius * BOULDER_SOLID);
  }

  // 水里横着一排小石头，顶露出水面一点，把小溪口拦住
  for (let i = 0; i < weirStones; i++) {
    const across = ((i + 0.5) / weirStones - 0.5) * (1 - weirRadius[0]);
    const x = edgeX + alongX * across - outX * weirFromEdge;
    const z = edgeZ + alongZ * across - outZ * weirFromEdge;
    const radius = between(random, weirRadius);
    const stone = boulder(world.kit, { radius, flatten: WEIR_FLATTEN, color: pick(random, MOUTH_COLORS), seed: Math.floor(random() * 1000) });
    world.add(stone, x, ground.waterSurface + WEIR_ABOVE_WATER - radius * WEIR_FLATTEN, z, random() * Math.PI);
  }
}

/**
 * 在 [小, 大] 之间随机取一个数
 * @param {Function} random
 * @param {number[]} range [小, 大]
 * @returns {number}
 */
function between(random, range) {
  return range[0] + random() * (range[1] - range[0]);
}

/**
 * 随机挑一个
 * @param {Function} random
 * @param {any[]} list
 * @returns {any}
 */
function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/**
 * 水面上的荷叶、荷花，和放在一片荷叶上的金币
 * @description 金币先藏着：踏脚石沉在水底时，站在左岸一角离那片荷叶也够得着，要等石头浮上来才出现
 * @param {World} world
 * @param {number} surface 水面多高
 */
function lilyPads(world, surface) {
  for (const [x, z, radius] of LILY_PADS) {
    world.add(lilyPad(world.kit, radius), x, surface, z);
  }
  const [lotusX, lotusZ] = LOTUS_PAD;
  world.add(lotus(world.kit), lotusX, surface, lotusZ);

  const [coinX, coinZ] = COIN_PAD;
  world.placeItem('coin', coinX, surface + COIN_LIFT, coinZ, { hidden: true });
}
