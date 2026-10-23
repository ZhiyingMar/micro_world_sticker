// 碰一下会有反应的东西：台阶上每一步"叮"一个音（往上走音越来越高，往下走越来越低），
// 撞到灌木会抖一下、沙沙响、掉几片叶子，贴着喷泉走会溅起水珠
// 这些反应只是好玩，不改进度、不进存档
import { sfx } from '../../audio.js';

// 台阶：每格几级（和地形画出来的一样）
const STAIR_STEPS = 4;
// 弹一下：压扁多少，晃多快（弧度每秒），多快停下来，弹多久；压扁时横着鼓出来多少（占压扁的几成）
const BOUNCE_SQUASH = 0.2;
const BOUNCE_FREQUENCY = 16;
const BOUNCE_DAMPING = 5;
const BOUNCE_TIME = 1.2;
const BOUNCE_BULGE = 0.5;
// 撞灌木：人贴着多近就算撞上了；掉几片叶子、什么颜色
const BUSH_TOUCH_SLACK = 0.08;
const LEAVES = 4;
const LEAF_COLORS = ['#5fb24c', '#8bd96d', '#4fa64a'];
// 撞喷泉：人贴着池壁多近算撞上；溅几颗水珠
const FOUNTAIN_TOUCH_SLACK = 0.08;
const FOUNTAIN_DROPS = 5;
// 水珠从池子里离池壁多远的地方溅起来（占池子一半宽的比例，不会溅在池壁上）
const FOUNTAIN_SPLASH_INSET = 0.6;

/**
 * 开始盯着人走到哪、碰到什么
 * @param {World} world 像素小镇
 * @param {object} context
 * @param {{ x: number, z: number, radius: number, group: THREE.Group }[]} context.bushes 灌木
 * @param {{ x: number, z: number, groundY: number, lowerWater: number, radius: number }} context.fountain 喷泉
 * @param {{ splash: Function }} context.splashes 溅水
 * @param {{ burst: Function }} context.bits 掉叶子
 */
export function createTouch(world, { bushes, fountain, splashes, bits }) {
  const touchingBushes = new Set();
  let lastStep = null;
  let touchingFountain = false;

  world.onUpdate((dt, time) => {
    const player = world.player;
    if (player) {
      lastStep = stairNote(world, player, lastStep);
      bumpBushes(world, player, bushes, touchingBushes, bits, time);
      touchingFountain = brushFountain(player, fountain, touchingFountain, splashes);
    }
    for (const bush of bushes) {
      wobble(bush.group, time);
    }
  });
}

// ---------- 台阶上的音 ----------

/**
 * 这一帧有没有迈出一步；迈在台阶上就"叮"一个音，站得越高音越高
 * @description 腿是按 sin(phase) 摆的，phase 每过半圈（π）就是一只脚落地；
 *   像素小镇的台阶一格一格走上去，像在弹一段往上爬的音阶
 * @param {World} world
 * @param {Villager} player
 * @param {number | null} lastStep 上一帧走到第几步
 * @returns {number} 这一帧走到第几步
 */
function stairNote(world, player, lastStep) {
  const step = Math.floor(player.phase / Math.PI);
  const steppedNow = lastStep !== null && step !== lastStep && player.moving;
  if (!steppedNow) {
    return step;
  }

  const terrain = world.terrain;
  const [column, row] = terrain.cellAt(player.x, player.z);
  if (isStairSymbol(terrain.ch(column, row))) {
    // 一级台阶多高，就按几级数：第几级就是音阶里第几个音
    const stairHeight = terrain.level / STAIR_STEPS;
    sfx.stairNote(Math.round(world.heightAt(player.x, player.z) / stairHeight));
  }
  return step;
}

/**
 * 这个地图符号是不是台阶
 * @param {string} symbol
 * @returns {boolean}
 */
function isStairSymbol(symbol) {
  return symbol === '>' || symbol === '<' || symbol === '^' || symbol === 'v';
}

// ---------- 弹一下 ----------

/**
 * 开始弹：从现在起压扁再弹回来
 * @param {THREE.Object3D} object
 * @param {number} time 什么时候开始（世界里的秒）
 */
function startBounce(object, time) {
  object.userData.bounceStart = time;
}

/**
 * 这一帧压扁多少：越弹越轻，弹完回到原样
 * @param {THREE.Object3D} object
 * @param {number} time
 */
function wobble(object, time) {
  const start = object.userData.bounceStart;
  if (start === undefined) {
    return;
  }

  const elapsed = time - start;
  if (elapsed > BOUNCE_TIME) {
    object.scale.set(1, 1, 1);
    delete object.userData.bounceStart;
    return;
  }

  const squash = BOUNCE_SQUASH * Math.exp(-BOUNCE_DAMPING * elapsed) * Math.cos(BOUNCE_FREQUENCY * elapsed);
  const bulge = 1 + squash * BOUNCE_BULGE;
  object.scale.set(bulge, 1 - squash, bulge);
}

/**
 * 人撞到灌木：抖一下、沙沙响、掉几片叶子
 * @description 撞上的那一下才有，一直贴着不会一直响；离开再撞才会再来一次
 * @param {World} world
 * @param {Villager} player
 * @param {{ x: number, z: number, radius: number, group: THREE.Group }[]} bushes
 * @param {Set<object>} touching 现在正贴着的灌木
 * @param {{ burst: Function }} bits
 * @param {number} time
 */
function bumpBushes(world, player, bushes, touching, bits, time) {
  for (const bush of bushes) {
    const reach = bush.radius + player.radius + BUSH_TOUCH_SLACK;
    const isTouching = Math.hypot(player.x - bush.x, player.z - bush.z) < reach;
    const justBumped = isTouching && !touching.has(bush);
    if (justBumped) {
      startBounce(bush.group, time);
      sfx.rustle();
      bits.burst(bush.x, world.heightAt(bush.x, bush.z) + bush.radius, bush.z, LEAF_COLORS, LEAVES);
      touching.add(bush);
    }
    if (!isTouching) {
      touching.delete(bush);
    }
  }
}

/**
 * 人贴着喷泉池壁走过去，池子里溅起几颗水珠
 * @param {Villager} player
 * @param {{ x: number, z: number, groundY: number, lowerWater: number, radius: number }} fountain
 * @param {boolean} wasTouching 上一帧是不是已经贴着
 * @param {{ splash: Function }} splashes
 * @returns {boolean} 这一帧贴没贴着
 */
function brushFountain(player, fountain, wasTouching, splashes) {
  // 池子是方的：看人离池壁最近的那一边
  const reach = fountain.radius + player.radius + FOUNTAIN_TOUCH_SLACK;
  const isTouching = Math.abs(player.x - fountain.x) < reach && Math.abs(player.z - fountain.z) < reach;
  if (isTouching && !wasTouching) {
    // 水珠从人这一边的池子里溅起来
    const inside = fountain.radius * FOUNTAIN_SPLASH_INSET;
    const towardX = Math.sign(player.x - fountain.x) * Math.min(Math.abs(player.x - fountain.x), inside);
    const towardZ = Math.sign(player.z - fountain.z) * Math.min(Math.abs(player.z - fountain.z), inside);
    splashes.splash(fountain.x + towardX, fountain.z + towardZ, FOUNTAIN_DROPS, fountain.groundY + fountain.lowerWater);
    sfx.splash();
  }
  return isTouching;
}
