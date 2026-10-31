// 碰一下会有反应的东西：踩进水坑溅水花、撞到垃圾桶晃一晃“哐”一声、走近垃圾桶上的猫它会扭头看你、喵一声
// 人行道上走路有轻轻的脚步声。这些反应只是好玩，不改进度、不进存档
import * as THREE from 'three';
import { sfx } from '../../audio.js';
import { createSplashes } from '../../splashes.js';

// 水坑：离水坑中心多近算踩进去（按水坑半径的比例），波纹散多大，溅几颗水珠
const PUDDLE_STEP = 0.85;
const PUDDLE_RIPPLE = 0.5;
const PUDDLE_DROPS = 4;

// 垃圾桶：人贴着多近算撞上，撞一下歪多少（弧度）、晃多快、多快停，隔多久才能再撞响
const BIN_TOUCH_SLACK = 0.06;
const BIN_TILT = 0.12;
const BIN_WOBBLE_SPEED = 18;
const BIN_DAMPING = 5;
const BIN_COOLDOWN = 0.8;

// 猫：人走多近它会注意到；扭头最多扭多少、扭多快；隔多久才再喵一声
const CAT_NOTICE = 1.4;
const CAT_HEAD_LIMIT = 1.0;
const CAT_HEAD_SPEED = 6;
const CAT_MEOW_COOLDOWN = 8;
const CAT_HEARTS = { count: 3, spread: 0.12, size: 0.2, rise: 0.6, color: '#ffd1e8' };

/**
 * 开始盯着人走到哪、碰到什么
 * @param {World} world 夜都
 * @param {object} context
 * @param {{ x: number, y: number, z: number, radius: number }[]} context.puddles 水坑
 * @param {THREE.Group[]} context.bins 能撞得晃的垃圾桶
 * @param {THREE.Group} context.cat 垃圾桶上的猫（头叫 head）
 */
export function createTouch(world, { puddles, bins, cat }) {
  const splashes = createSplashes(world, 0);
  const lastSteps = new Map();
  const wobbles = bins.map(prepareWobble);
  const kitty = { cat, head: cat.getObjectByName('head'), lastMeow: -Infinity };

  world.onUpdate((dt, time) => {
    for (const walker of walkers(world)) {
      footstep(world, splashes, puddles, walker, lastSteps);
    }

    const player = world.player;
    for (const wobble of wobbles) {
      if (player) {
        bumpBin(wobble, player, time);
      }
      shakeBin(wobble, time);
    }
    watchCat(world, kitty, player, dt, time);
  });
}

// ---------- 脚步、水坑 ----------

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
 * 这一帧有没有迈出一步；踩进水坑就溅水，玩家在硬地上走有轻轻的脚步声
 * @description 腿是按 sin(phase) 摆的，phase 每过半圈（π）就是一只脚落地
 * @param {World} world
 * @param {{ ripple: Function, splash: Function }} splashes
 * @param {{ x: number, y: number, z: number, radius: number }[]} puddles
 * @param {Villager} walker 玩家或者居民
 * @param {Map<Villager, number>} lastSteps 每个人上一次走到第几步
 */
function footstep(world, splashes, puddles, walker, lastSteps) {
  const step = Math.floor(walker.phase / Math.PI);
  const previous = lastSteps.get(walker);
  lastSteps.set(walker, step);
  const steppedNow = previous !== undefined && step !== previous && walker.moving;
  if (!steppedNow) {
    return;
  }

  const isPlayer = walker === world.player;
  const puddle = puddles.find((candidate) => Math.hypot(walker.x - candidate.x, walker.z - candidate.z) < candidate.radius * PUDDLE_STEP);
  if (puddle) {
    splashes.ripple(walker.x, walker.z, PUDDLE_RIPPLE, puddle.y);
    splashes.splash(walker.x, walker.z, PUDDLE_DROPS, puddle.y);
    if (isPlayer) {
      sfx.splash();
    }
    return;
  }
  if (isPlayer) {
    sfx.footstep(false, step % 2 === 0);
  }
}

// ---------- 垃圾桶 ----------

/**
 * 记下垃圾桶原来的样子：多大、原来的朝向，晃的时候在这个基础上歪
 * @param {THREE.Group} bin
 * @returns {object}
 */
function prepareWobble(bin) {
  bin.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(bin);
  return {
    bin,
    box,
    rest: bin.quaternion.clone(),
    axis: new THREE.Vector3(1, 0, 0),
    start: -Infinity,
    tilt: new THREE.Quaternion(),
  };
}

/**
 * 人撞上垃圾桶：从被撞的那一边往外歪，“哐”一声
 * @param {object} wobble prepareWobble 的结果
 * @param {Villager} player
 * @param {number} time 世界里的秒
 */
function bumpBin(wobble, player, time) {
  const coolingDown = time - wobble.start < BIN_COOLDOWN;
  if (!player.moving || coolingDown) {
    return;
  }

  const { box } = wobble;
  const nearestX = THREE.MathUtils.clamp(player.x, box.min.x, box.max.x);
  const nearestZ = THREE.MathUtils.clamp(player.z, box.min.z, box.max.z);
  const gap = Math.hypot(player.x - nearestX, player.z - nearestZ);
  if (gap > player.radius + BIN_TOUCH_SLACK) {
    return;
  }

  // 往人推的方向歪：转轴是水平的、和推的方向垂直
  const pushX = nearestX - player.x;
  const pushZ = nearestZ - player.z;
  wobble.axis.set(pushZ, 0, -pushX).normalize();
  wobble.start = time;
  sfx.clank();
}

/**
 * 垃圾桶晃：一下歪过去，来回晃几下停住
 * @param {object} wobble
 * @param {number} time
 */
function shakeBin(wobble, time) {
  const age = time - wobble.start;
  if (age > BIN_COOLDOWN * 2) {
    return;
  }
  const angle = Math.sin(age * BIN_WOBBLE_SPEED) * BIN_TILT * Math.exp(-age * BIN_DAMPING);
  wobble.tilt.setFromAxisAngle(wobble.axis, angle);
  wobble.bin.quaternion.copy(wobble.tilt).multiply(wobble.rest);
}

// ---------- 猫 ----------

/**
 * 猫：有人走近就扭头盯着看、尾巴甩得快，刚注意到时喵一声冒几颗小心心；人走开了慢慢转回去
 * @param {World} world
 * @param {{ cat: THREE.Group, head: THREE.Object3D, lastMeow: number, near?: boolean }} kitty
 * @param {Villager | null} player
 * @param {number} dt
 * @param {number} time
 */
function watchCat(world, kitty, player, dt, time) {
  const { cat, head } = kitty;
  const position = cat.getWorldPosition(new THREE.Vector3());
  const near = Boolean(player) && Math.hypot(player.x - position.x, player.z - position.z) < CAT_NOTICE;

  let lookAt = 0;
  if (near) {
    // 头往人那边扭：世界里的方向减去猫自己的朝向
    const toward = Math.atan2(player.x - position.x, player.z - position.z) - cat.rotation.y;
    lookAt = THREE.MathUtils.clamp(Math.atan2(Math.sin(toward), Math.cos(toward)), -CAT_HEAD_LIMIT, CAT_HEAD_LIMIT);
  }
  head.rotation.y += (lookAt - head.rotation.y) * Math.min(1, dt * CAT_HEAD_SPEED);
  cat.userData.excited = near;

  const justNoticed = near && !kitty.near;
  kitty.near = near;
  if (justNoticed && time - kitty.lastMeow > CAT_MEOW_COOLDOWN) {
    kitty.lastMeow = time;
    sfx.meow();
    world.fx.emit(position.clone().add(new THREE.Vector3(0, 0.45, 0)), CAT_HEARTS);
  }
}
