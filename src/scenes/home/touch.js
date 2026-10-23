// 碰一下会有反应的：撞到家具它会晃一下、响一声、扬起一点灰；踢到地上的毛线球它会滚走；
// 屋里走路有脚步声，木地板上"嗒嗒"，地毯上闷闷的
// 这些反应只是好玩，不改进度、不进存档
import * as THREE from 'three';
import { sfx } from '../../audio.js';
import { RUG, YARN_BALL } from './layout.js';

// 撞家具：人离家具的包围盒多近算碰上（人的半径之外再多这么点）；离开多远才算走开了，下次再碰会再晃
const BUMP_REACH = 0.07;
const BUMP_REARM = 0.25;
// 要朝着家具走过去才算撞（走路方向和指向家具的方向夹角的余弦至少这么大）：贴着走过去不算
const BUMP_FACING = 0.3;
// 晃一下：晃多快（弧度每秒）、多快停下、晃多久（秒）；压扁时横着鼓出来多少（占压扁的几成）
const WOBBLE_FREQUENCY = 16;
const WOBBLE_DAMPING = 5;
const WOBBLE_TIME = 1.2;
const WOBBLE_BULGE = 0.5;
// 声音：晃得越大（越小件）音越高
const PITCH_PER_SQUASH = 4;
// 撞上时扬起的东西：木头扬灰，盆栽掉叶子屑，床和毛线是白色的绒毛，金属的也扬一点灰
const BUMP_PUFF = {
  wood: { color: '#efdcc0', count: 3 },
  metal: { color: '#efdcc0', count: 2 },
  soft: { color: '#ffffff', count: 4 },
  leaf: { color: '#8fd17f', count: 5 },
};
const BUMP_PUFF_HEIGHT = 0.15;

// 毛线球：多大、什么颜色；人碰到它时踢出去多快（每秒），在地板上每秒剩多少速度，撞到墙和家具弹回来剩多少速度
const YARN = { radius: 0.1, color: '#f6a6b8', kick: 2.4, friction: 0.25, bounce: 0.55 };
// 速度小于这个就当停了；人离它多近算踢到（人的半径之外再多这么点）
const YARN_REST = 0.04;
const YARN_REACH = 0.04;
// 弹墙的声音至少隔多久才响一次（秒）：卡在角落里来回弹的时候不会连响一串
const YARN_SOUND_GAP = 0.2;

/**
 * @typedef {import('./furniture.js').Bumpable} Bumpable
 */

/**
 * 开始盯着人走到哪、碰到什么
 * @param {World} world 小屋这个世界
 * @param {object} context
 * @param {Bumpable[]} context.bumpables 撞了会晃的家具
 * @param {{ emit: Function }} context.puffs 冒灰、冒绒毛用
 */
export function createTouch(world, { bumpables, puffs }) {
  const pieces = bumpables.map((bumpable) => ({ ...bumpable, box: new THREE.Box3().setFromObject(bumpable.object), armed: true, wobbleStart: -1 }));
  const yarn = placeYarnBall(world);
  let lastStep = null;

  world.onUpdate((dt, time) => {
    const player = world.player;
    if (player) {
      lastStep = footstep(player, lastStep);
      for (const piece of pieces) {
        bumpInto(player, piece, puffs, time);
      }
      kickYarn(player, yarn);
    }

    for (const piece of pieces) {
      wobble(piece, time);
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

// ---------- 撞家具 ----------

/**
 * 人朝着一件家具走过去、碰上了：它晃一下、响一声、扬起一点灰
 * @param {Villager} player
 * @param {Bumpable & { box: THREE.Box3, armed: boolean, wobbleStart: number }} piece
 * @param {{ emit: Function }} puffs
 * @param {number} time
 */
function bumpInto(player, piece, puffs, time) {
  const closestX = THREE.MathUtils.clamp(player.x, piece.box.min.x, piece.box.max.x);
  const closestZ = THREE.MathUtils.clamp(player.z, piece.box.min.z, piece.box.max.z);
  const gap = Math.hypot(closestX - player.x, closestZ - player.z) - player.radius;
  if (gap > BUMP_REARM) {
    piece.armed = true;
  }

  const touching = gap < BUMP_REACH;
  if (!touching || !piece.armed || !player.moving) {
    return;
  }
  const toward = new THREE.Vector2(closestX - player.x, closestZ - player.z).normalize();
  const walking = new THREE.Vector2(Math.sin(player.heading), Math.cos(player.heading));
  if (toward.dot(walking) < BUMP_FACING) {
    return;
  }

  piece.armed = false;
  piece.wobbleStart = time;
  playBumpSound(piece);
  const puff = BUMP_PUFF[piece.sound];
  puffs.emit(new THREE.Vector3(closestX, BUMP_PUFF_HEIGHT, closestZ), { count: puff.count, color: puff.color, size: 0.16, rise: 0.25, spread: 0.12, life: 0.9 });
}

/**
 * 按家具的材料出声，小件音高一点
 * @param {Bumpable} piece
 */
function playBumpSound(piece) {
  const pitch = 1 + piece.squash * PITCH_PER_SQUASH;
  if (piece.sound === 'metal') {
    sfx.clank(pitch);
  } else if (piece.sound === 'soft') {
    sfx.puff();
  } else if (piece.sound === 'leaf') {
    sfx.rustle();
  } else {
    sfx.knock(pitch);
  }
}

/**
 * 家具这一帧压扁多少：越晃越轻，晃完回到原样
 * @param {Bumpable & { wobbleStart: number }} piece
 * @param {number} time
 */
function wobble(piece, time) {
  if (piece.wobbleStart < 0) {
    return;
  }

  const elapsed = time - piece.wobbleStart;
  if (elapsed > WOBBLE_TIME) {
    piece.object.scale.set(1, 1, 1);
    piece.wobbleStart = -1;
    return;
  }

  const squash = piece.squash * Math.exp(-WOBBLE_DAMPING * elapsed) * Math.sin(WOBBLE_FREQUENCY * elapsed);
  const bulge = 1 + squash * WOBBLE_BULGE;
  piece.object.scale.set(bulge, 1 - squash, bulge);
}

// ---------- 毛线球 ----------

/**
 * 地上一团毛线球，绕着几圈线
 * @param {World} world
 * @returns {{ mesh: THREE.Group, velocity: THREE.Vector2, quietFor: number }}
 */
function placeYarnBall(world) {
  const kit = world.kit;
  const mesh = new THREE.Group();
  mesh.add(kit.sphere(YARN.radius, YARN.color, 14));
  // 几圈缠着的线，斜着套在球上，滚起来看得出在转
  for (const tilt of [0.5, -0.7, 1.4]) {
    const loop = kit.torus(YARN.radius * 0.98, YARN.radius * 0.12, '#f08aa3');
    loop.rotation.set(tilt, tilt * 0.6, 0);
    mesh.add(loop);
  }
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
