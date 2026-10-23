// 碰一下会有反应的：踢到地上的毛线球它会滚走；屋里走路有轻轻的脚步声，木地板上"嗒嗒"，地毯上闷闷的
// 撞到家具不出声也不晃（试玩嫌吵），家具老老实实挡着就好
// 这些反应只是好玩，不改进度、不进存档
import * as THREE from 'three';
import { sfx } from '../../audio.js';
import { yarnBall } from './furniture-models.js';
import { RUG, YARN_BALL } from './layout.js';

// 毛线球：多大、什么颜色；人碰到它时踢出去多快（每秒），在地板上每秒剩多少速度，撞到墙和家具弹回来剩多少速度
const YARN = { radius: 0.1, color: '#f6a6b8', kick: 2.4, friction: 0.25, bounce: 0.55 };
// 速度小于这个就当停了；人离它多近算踢到（人的半径之外再多这么点）
const YARN_REST = 0.04;
const YARN_REACH = 0.04;
// 弹墙的声音至少隔多久才响一次（秒）：卡在角落里来回弹的时候不会连响一串
const YARN_SOUND_GAP = 0.2;

/**
 * 摆上毛线球，开始盯着人走到哪、踢到什么
 * @param {World} world 小屋这个世界
 */
export function createTouch(world) {
  const yarn = placeYarnBall(world);
  let lastStep = null;

  world.onUpdate((dt) => {
    const player = world.player;
    if (player) {
      lastStep = footstep(player, lastStep);
      kickYarn(player, yarn);
    }
    rollYarn(world, yarn, dt);
  });
}

// ---------- 脚步 ----------

/**
 * 玩家这一帧有没有迈出一步；迈了就按脚下是地毯还是木地板出声
 * @description 腿是按 sin(phase) 摆的，phase 每过半圈（π）就是一只脚落地
 * @param {Villager} player
 * @param {number | null} lastStep 上一帧走到第几步
 * @returns {number} 这一帧走到第几步
 */
function footstep(player, lastStep) {
  const step = Math.floor(player.phase / Math.PI);
  const steppedNow = lastStep !== null && step !== lastStep && player.moving;
  if (steppedNow) {
    const onRug = Math.hypot(player.x - RUG.x, player.z - RUG.z) < RUG.radius;
    sfx.footstep(onRug, step % 2 === 0);
  }
  return step;
}

// ---------- 毛线球 ----------

/**
 * 地上一团毛线球（和毛线篮里的一样）
 * @param {World} world
 * @returns {{ mesh: THREE.Group, velocity: THREE.Vector2, quietFor: number }}
 */
function placeYarnBall(world) {
  const mesh = yarnBall(world.kit, YARN.radius, YARN.color);
  world.add(mesh, YARN_BALL.x, world.heightAt(YARN_BALL.x, YARN_BALL.z) + YARN.radius, YARN_BALL.z);
  return { mesh, velocity: new THREE.Vector2(), quietFor: 0 };
}

/**
 * 人碰到毛线球：顺着人往前走的方向把它踢出去
 * @param {Villager} player
 * @param {{ mesh: THREE.Group, velocity: THREE.Vector2 }} yarn
 */
function kickYarn(player, yarn) {
  const awayX = yarn.mesh.position.x - player.x;
  const awayZ = yarn.mesh.position.z - player.z;
  const distance = Math.hypot(awayX, awayZ);
  const touching = distance < player.radius + YARN.radius + YARN_REACH;
  if (!touching || !player.moving) {
    return;
  }

  // 一半顺着人走的方向，一半顺着人碰到它的方向，踢出去才自然
  const kick = new THREE.Vector2(Math.sin(player.heading), Math.cos(player.heading)).add(new THREE.Vector2(awayX, awayZ).normalize()).normalize();
  const fresh = yarn.velocity.length() < YARN.kick / 2;
  yarn.velocity.copy(kick.multiplyScalar(YARN.kick));
  if (fresh) {
    sfx.puff();
  }
}

/**
 * 毛线球滚一帧：慢慢停下，撞到墙和家具弹回来，边滚边转
 * @param {World} world
 * @param {{ mesh: THREE.Group, velocity: THREE.Vector2, quietFor: number }} yarn
 * @param {number} dt
 */
function rollYarn(world, yarn, dt) {
  yarn.quietFor -= dt;
  const speed = yarn.velocity.length();
  if (speed < YARN_REST) {
    yarn.velocity.set(0, 0);
    return;
  }

  const position = yarn.mesh.position;
  const nextX = position.x + yarn.velocity.x * dt;
  const nextZ = position.z + yarn.velocity.y * dt;
  // 分开看 x、z 两个方向哪个被挡住，挡住的那个方向弹回来
  const hitSide = world.blocked(nextX, position.z, YARN.radius);
  if (hitSide) {
    yarn.velocity.x *= -YARN.bounce;
  } else {
    position.x = nextX;
  }
  const hitFront = world.blocked(position.x, nextZ, YARN.radius);
  if (hitFront) {
    yarn.velocity.y *= -YARN.bounce;
  } else {
    position.z = nextZ;
  }
  const bounced = hitSide || hitFront;
  if (bounced && yarn.quietFor <= 0) {
    sfx.puff();
    yarn.quietFor = YARN_SOUND_GAP;
  }

  // 往前滚：绕着和滚动方向垂直的轴转，转过的弧长等于走过的路
  const axis = new THREE.Vector3(yarn.velocity.y, 0, -yarn.velocity.x).normalize();
  yarn.mesh.rotateOnWorldAxis(axis, (speed * dt) / YARN.radius);
  yarn.velocity.multiplyScalar(Math.pow(YARN.friction, dt));
}
