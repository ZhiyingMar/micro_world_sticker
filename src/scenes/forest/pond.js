// 池塘和小溪：水、桥、踏脚石都在地形地图里，由地面画出来；这里摆水线上的石头、荷叶、荷花，和荷叶上的金币
import { rng } from '../../kit.js';
import { lilyPad, lotus, shoreRock } from './models.js';
import { LILY_PADS, COIN_PAD, LOTUS_PAD, FISHING_SPOT, STREAM_SPOT } from './layout.js';

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
 * 水面上的荷叶、荷花，和放在一片荷叶上的金币
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
  world.placeItem('coin', coinX, surface + COIN_LIFT, coinZ);
}
