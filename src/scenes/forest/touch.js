// 碰一下会有反应的东西：踩踏脚石溅水花、走在桥上有脚步声、撞到蘑菇屋菌盖会弹、路过小红蘑菇它们会弹
// 这些反应只是好玩，不改进度、不进存档
import { rng } from '../../kit.js';
import { sfx } from '../../audio.js';
import { toadstool } from './plants.js';
import { distanceToPath, PATH_HALF_WIDTH } from './paths.js';
import { TOADSTOOLS } from './layout.js';

// 踏脚石：每一步从石头边上溅几颗水珠，波纹从石头往外散多大；水珠从离石头中心多远的地方溅起
const STEP_DROPS = 5;
const STONE_RIPPLE = 1.0;
const STONE_EDGE = 0.45;
// 桥：哪些地图符号是桥；桥面往两头岸上多伸出去多少（踩在伸出去的那截上也是在桥上）
const BRIDGES = new Set(['=', '|']);
const BRIDGE_OVERHANG = 0.12;

// 弹一下：压扁多少，晃多快（弧度每秒），多快停下来，弹多久；压扁时横着鼓出来多少（占压扁的几成）
const BOUNCE_SQUASH = 0.18;
const BOUNCE_FREQUENCY = 14;
const BOUNCE_DAMPING = 4;
const BOUNCE_TIME = 1.4;
const BOUNCE_BULGE = 0.5;
// 撞蘑菇屋：人贴着墙多近就算撞上了；大屋子声音低，按菌盖大小定音高
const HOUSE_TOUCH_SLACK = 0.06;
const HOUSE_PITCH = 1.1;
// 小红蘑菇：一簇几个、多大、撒多开；人离多近会弹，一簇里一个接一个弹，隔多久；声音高一点
const TOADSTOOLS_PER_CLUSTER = [2, 4];
const TOADSTOOL_SIZE = [0.8, 1.4];
const TOADSTOOL_SPREAD = 0.18;
const TOADSTOOL_REACH = 0.45;
const TOADSTOOL_STAGGER = 0.07;
const TOADSTOOL_PITCH = 2.2;
// 长小红蘑菇的地方要留多大空地，离路边多远
const TOADSTOOL_ROOM = 0.08;
const TOADSTOOL_CLEAR_OF_PATH = 0.1;
const TOADSTOOL_SEED = 19;

/**
 * 摆好会弹的小红蘑菇，开始盯着人走到哪、碰到什么
 * @param {World} world 童话森林
 * @param {object} context
 * @param {{ x: number, z: number, radius: number, size: number, cap: THREE.Group }[]} context.houses 蘑菇屋
 * @param {{ ripple: Function, splash: Function }} context.splashes 水面上的波纹和水珠
 */
export function createTouch(world, { houses, splashes }) {
  const clusters = plantToadstools(world);
  const bouncy = [...houses.map((house) => house.cap), ...clusters.flatMap((cluster) => cluster.caps)];
  const lastSteps = new Map();
  const touchingHouses = new Set();

  world.onUpdate((dt, time) => {
    for (const walker of walkers(world)) {
      footstep(world, splashes, walker, lastSteps);
    }

    const player = world.player;
    if (player) {
      bumpHouses(player, houses, touchingHouses, time);
      brushToadstools(player, clusters, time);
    }
    for (const cap of bouncy) {
      wobble(cap, time);
    }
  });
}

// ---------- 脚步 ----------

/**
 * 会踩出水花的人：玩家和居民
 * @param {World} world
 * @returns {Villager[]}
 */
function walkers(world) {
  if (!world.player) {
    return world.villagers;
  }
  return [world.player, ...world.villagers];
}

/**
 * 这一帧有没有迈出一步；迈了就看踩在什么上面
 * @description 腿是按 sin(phase) 摆的，phase 每过半圈（π）就是一只脚落地
 * @param {World} world
 * @param {{ ripple: Function, splash: Function }} splashes
 * @param {Villager} walker 玩家或者居民
 * @param {Map<Villager, number>} lastSteps 每个人上一次走到第几步
 */
function footstep(world, splashes, walker, lastSteps) {
  const step = Math.floor(walker.phase / Math.PI);
  const previous = lastSteps.get(walker);
  lastSteps.set(walker, step);
  const steppedNow = previous !== undefined && step !== previous && walker.moving;
  if (!steppedNow) {
    return;
  }

  const terrain = world.terrain;
  const [column, row] = terrain.cellAt(walker.x, walker.z);
  const ground = terrain.ch(column, row);
  const isPlayer = walker === world.player;
  if (ground === 'o') {
    stoneSplash(splashes, terrain.x0 + column + 0.5, terrain.z0 + row + 0.5);
    if (isPlayer) {
      sfx.splash();
    }
  } else if (isPlayer && onBridge(terrain, walker.x, walker.z)) {
    sfx.plank(step % 2 === 0);
  }
}

/**
 * 这一处是不是踩在桥上（算上桥面伸到岸上的那一截）
 * @param {Terrain} terrain
 * @param {number} x
 * @param {number} z
 * @returns {boolean}
 */
function onBridge(terrain, x, z) {
  const around = [[0, 0], [BRIDGE_OVERHANG, 0], [-BRIDGE_OVERHANG, 0], [0, BRIDGE_OVERHANG], [0, -BRIDGE_OVERHANG]];
  return around.some(([dx, dz]) => {
    const [column, row] = terrain.cellAt(x + dx, z + dz);
    return BRIDGES.has(terrain.ch(column, row));
  });
}

/**
 * 踩在踏脚石上：一圈波纹从石头往外散，边上溅起几颗水珠
 * @param {{ ripple: Function, splash: Function }} splashes
 * @param {number} stoneX 这块石头的中心
 * @param {number} stoneZ
 */
function stoneSplash(splashes, stoneX, stoneZ) {
  splashes.ripple(stoneX, stoneZ, STONE_RIPPLE);

  const angle = Math.random() * Math.PI * 2;
  splashes.splash(stoneX + Math.cos(angle) * STONE_EDGE, stoneZ + Math.sin(angle) * STONE_EDGE, STEP_DROPS);
}

// ---------- 弹一下 ----------

/**
 * 开始弹：从现在起压扁再弹回来
 * @param {THREE.Object3D} cap 菌盖
 * @param {number} time 什么时候开始（世界里的秒）
 */
function startBounce(cap, time) {
  cap.userData.bounceStart = time;
}

/**
 * 菌盖这一帧压扁多少：越弹越轻，弹完回到原样
 * @param {THREE.Object3D} cap
 * @param {number} time
 */
function wobble(cap, time) {
  const start = cap.userData.bounceStart;
  // 没在弹，或者排在一簇里后面、还没轮到它
  const notBouncing = start === undefined || time < start;
  if (notBouncing) {
    return;
  }

  const elapsed = time - start;
  if (elapsed > BOUNCE_TIME) {
    cap.scale.set(1, 1, 1);
    delete cap.userData.bounceStart;
    return;
  }

  const squash = BOUNCE_SQUASH * Math.exp(-BOUNCE_DAMPING * elapsed) * Math.cos(BOUNCE_FREQUENCY * elapsed);
  const bulge = 1 + squash * BOUNCE_BULGE;
  cap.scale.set(bulge, 1 - squash, bulge);
}

/**
 * 人撞到蘑菇屋的墙上，菌盖弹一下
 * @description 撞上的那一下才弹，一直贴着墙不会一直弹；离开再撞才会再弹
 * @param {Villager} player
 * @param {{ x: number, z: number, radius: number, size: number, cap: THREE.Group }[]} houses
 * @param {Set<object>} touching 现在正贴着的屋子
 * @param {number} time
 */
function bumpHouses(player, houses, touching, time) {
  for (const house of houses) {
    const reach = house.radius + player.radius + HOUSE_TOUCH_SLACK;
    const isTouching = Math.hypot(player.x - house.x, player.z - house.z) < reach;
    const justBumped = isTouching && !touching.has(house);
    if (justBumped) {
      startBounce(house.cap, time);
      sfx.boing(HOUSE_PITCH / house.size);
      touching.add(house);
    }
    if (!isTouching) {
      touching.delete(house);
    }
  }
}

// ---------- 小红蘑菇 ----------

/**
 * 在 layout 定的几处长一小簇小红蘑菇
 * @param {World} world
 * @returns {{ x: number, z: number, caps: THREE.Group[], near: boolean }[]}
 */
function plantToadstools(world) {
  const random = rng(TOADSTOOL_SEED);
  return TOADSTOOLS.map(([centerX, centerZ]) => {
    const count = TOADSTOOLS_PER_CLUSTER[0] + Math.floor(random() * (TOADSTOOLS_PER_CLUSTER[1] - TOADSTOOLS_PER_CLUSTER[0] + 1));
    const caps = [];
    for (let i = 0; i < count; i++) {
      const x = centerX + (random() - 0.5) * 2 * TOADSTOOL_SPREAD;
      const z = centerZ + (random() - 0.5) * 2 * TOADSTOOL_SPREAD;
      if (!roomForToadstool(world, x, z)) {
        continue;
      }

      const size = TOADSTOOL_SIZE[0] + random() * (TOADSTOOL_SIZE[1] - TOADSTOOL_SIZE[0]);
      const { group, cap } = toadstool(world.kit, size);
      world.add(group, x, world.heightAt(x, z), z, random() * Math.PI * 2);
      caps.push(cap);
    }
    return { x: centerX, z: centerZ, caps, near: false };
  });
}

/**
 * 这里能不能长一个小红蘑菇：平地、不贴崖边、不压着路和别的东西
 * @param {World} world
 * @param {number} x
 * @param {number} z
 * @returns {boolean}
 */
function roomForToadstool(world, x, z) {
  const terrain = world.terrain;
  const flat = terrain.isPlainGround(x, z) && !terrain.straddles(x, z, TOADSTOOL_ROOM * 2);
  const offPath = distanceToPath(x, z) > PATH_HALF_WIDTH + TOADSTOOL_CLEAR_OF_PATH;
  return flat && offPath && !world.blocked(x, z, TOADSTOOL_ROOM);
}

/**
 * 人走到一簇小红蘑菇旁边，它们一个接一个弹一下
 * @param {Villager} player
 * @param {{ x: number, z: number, caps: THREE.Group[], near: boolean }[]} clusters
 * @param {number} time
 */
function brushToadstools(player, clusters, time) {
  for (const cluster of clusters) {
    const near = Math.hypot(player.x - cluster.x, player.z - cluster.z) < TOADSTOOL_REACH;
    const justArrived = near && !cluster.near && cluster.caps.length > 0;
    if (justArrived) {
      cluster.caps.forEach((cap, index) => startBounce(cap, time + index * TOADSTOOL_STAGGER));
      sfx.boing(TOADSTOOL_PITCH);
    }
    cluster.near = near;
  }
}
