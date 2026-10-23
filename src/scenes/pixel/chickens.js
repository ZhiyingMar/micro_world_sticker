// 几只方块小鸡：在自己那一小块地方转悠、啄地，隔一会儿咕咕叫一声；
// 人走近（在走动时）会扑腾着翅膀蹦跳着跑开，掉几片羽毛，"咯咯哒"一声，过一会儿又慢慢走回来
// 只是好玩，不改进度、不进存档；小鸡不挡人，人也不挡小鸡
import * as THREE from 'three';
import { rng } from '../../kit.js';
import { sfx } from '../../audio.js';
import { chicken } from './models.js';
import { CHICKENS } from './layout.js';

// 比真的小鸡画大一点，远远看过去也认得出来
const CHICKEN_SCALE = 1.3;
// 小鸡多胖（算碰撞用，崖边、树干、房子都绕开）
const CHICKEN_RADIUS = 0.12;
// 转悠：离自己的窝最远走多远，走多快；啄几下地、每下多久，停多久再走（秒）
const WANDER_RADIUS = 1.1;
const WALK_SPEED = 0.35;
const PECKS = [1, 3];
const PECK_TIME = 0.35;
// 啄地时头低下去多少（弧度）
const PECK_DIP = 0.9;
const REST_TIME = [0.8, 2.2];
// 走路时腿摆多快、摆多大（弧度）
const STEP_SPEED = 18;
const STEP_SWING = 0.6;
// 受惊：人在走动、离多近会惊到；跑多快、跑多久；一边跑一边蹦多高、多快；翅膀扇多快、张多开
const SCARE_RADIUS = 0.75;
const FLEE_SPEED = 1.5;
const FLEE_TIME = 1.1;
const HOP_HEIGHT = 0.12;
const HOP_SPEED = 16;
const FLAP_SPEED = 30;
const FLAP_ANGLE = 1.0;
// 受惊时掉几片羽毛
const FEATHERS = 5;
const FEATHER_COLORS = ['#ffffff', '#f6f3ea'];
// 跑的路被挡住时，往左右各试着拐多少（弧度）
const DODGE_ANGLES = [0.6, -0.6, 1.2, -1.2, 2.0, -2.0];
// 转身多快
const TURN_RATE = 10;
// 两次"咯咯哒"至少隔多久（几只一起受惊时只叫一声）；人在附近时，隔多久随便哪只咕咕一声
const SCARE_SOUND_GAP = 0.5;
const IDLE_CLUCK_GAP = [6, 14];
const IDLE_CLUCK_RANGE = 3.5;
const CHICKEN_SEED = 97;

/**
 * 放几只小鸡
 * @param {World} world 像素小镇
 * @param {{ burst: Function }} bits 掉羽毛用
 */
export function createChickens(world, bits) {
  const random = rng(CHICKEN_SEED);
  const flock = CHICKENS.map(([x, z]) => {
    // 窝放在走不了的地方（崖边、水边、树干里），小鸡就一步也挪不动
    if (world.blocked(x, z, CHICKEN_RADIUS)) {
      console.warn(`像素小镇：小鸡的窝 (${x}, ${z}) 被挡住了，它会一直站着不动，挪到空地上`);
    }
    const model = chicken(world.kit);
    model.group.scale.setScalar(CHICKEN_SCALE);
    world.add(model.group, x, world.heightAt(x, z), z, random() * Math.PI * 2);
    return { ...model, home: [x, z], x, z, heading: model.group.rotation.y, state: 'rest', timer: random() * REST_TIME[1], pecks: 0, target: null, flee: null, phase: 0 };
  });

  let lastScareSound = -Infinity;
  let idleCluck = IDLE_CLUCK_GAP[0];
  world.onUpdate((dt, time) => {
    for (const hen of flock) {
      const scared = maybeScare(world, hen, bits);
      if (scared && time - lastScareSound > SCARE_SOUND_GAP) {
        sfx.cluck(false);
        lastScareSound = time;
      }
      updateChicken(world, hen, dt, random);
      pose(world, hen, dt);
    }

    idleCluck -= dt;
    if (idleCluck <= 0) {
      idleCluck = IDLE_CLUCK_GAP[0] + random() * (IDLE_CLUCK_GAP[1] - IDLE_CLUCK_GAP[0]);
      cluckIfNear(world.player, flock);
    }
  });
}

/**
 * 人走近了，小鸡受惊往远离人的方向跑
 * @description 人站着不动不会惊到它；已经在跑的不再算一次
 * @param {World} world
 * @param {object} hen
 * @param {{ burst: Function }} bits
 * @returns {boolean} 这一下刚受惊
 */
function maybeScare(world, hen, bits) {
  const player = world.player;
  const playerWalking = Boolean(player && player.moving);
  if (hen.flee || !playerWalking) {
    return false;
  }

  const awayX = hen.x - player.x;
  const awayZ = hen.z - player.z;
  const distance = Math.hypot(awayX, awayZ);
  if (distance > SCARE_RADIUS) {
    return false;
  }

  // 正好在人脚下时随便挑个方向跑
  const length = distance || 1;
  hen.flee = { x: awayX / length, z: awayZ / length, time: 0 };
  hen.state = 'flee';
  bits.burst(hen.x, world.heightAt(hen.x, hen.z), hen.z, FEATHER_COLORS, FEATHERS);
  return true;
}

/**
 * 小鸡这一帧干什么：跑、走、啄地、歇着
 * @param {World} world
 * @param {object} hen
 * @param {number} dt
 * @param {Function} random
 */
function updateChicken(world, hen, dt, random) {
  if (hen.state === 'flee') {
    hen.flee.time += dt;
    const direction = Math.atan2(hen.flee.x, hen.flee.z);
    const moved = stepToward(world, hen, direction, FLEE_SPEED * dt, true);
    if (!moved || hen.flee.time > FLEE_TIME) {
      hen.flee = null;
      startResting(hen, random);
    }
    return;
  }

  if (hen.state === 'walk') {
    const dx = hen.target[0] - hen.x;
    const dz = hen.target[1] - hen.z;
    const arrived = Math.hypot(dx, dz) < WALK_SPEED * dt * 2;
    const moved = !arrived && stepToward(world, hen, Math.atan2(dx, dz), WALK_SPEED * dt, false);
    if (!moved) {
      hen.state = 'peck';
      hen.pecks = PECKS[0] + Math.floor(random() * (PECKS[1] - PECKS[0] + 1));
      hen.timer = PECK_TIME * hen.pecks;
    }
    return;
  }

  hen.timer -= dt;
  if (hen.timer > 0) {
    return;
  }
  if (hen.state === 'peck') {
    startResting(hen, random);
  } else {
    startWalking(hen, random);
  }
}

/**
 * 歇一会儿
 * @param {object} hen
 * @param {Function} random
 */
function startResting(hen, random) {
  hen.state = 'rest';
  hen.timer = REST_TIME[0] + random() * (REST_TIME[1] - REST_TIME[0]);
}

/**
 * 在窝附近挑一个地方走过去
 * @param {object} hen
 * @param {Function} random
 */
function startWalking(hen, random) {
  const angle = random() * Math.PI * 2;
  const distance = Math.sqrt(random()) * WANDER_RADIUS;
  hen.target = [hen.home[0] + Math.cos(angle) * distance, hen.home[1] + Math.sin(angle) * distance];
  hen.state = 'walk';
}

/**
 * 朝一个方向挪一步；被挡住时（受惊逃跑时）往左右拐着试
 * @param {World} world
 * @param {object} hen
 * @param {number} direction 想走的方向（弧度，0 朝 +z）
 * @param {number} distance 这一步多远
 * @param {boolean} dodge 被挡住了要不要拐着试
 * @returns {boolean} 挪动了没有
 */
function stepToward(world, hen, direction, distance, dodge) {
  const tries = dodge ? [0, ...DODGE_ANGLES] : [0];
  for (const turn of tries) {
    const angle = direction + turn;
    const x = hen.x + Math.sin(angle) * distance;
    const z = hen.z + Math.cos(angle) * distance;
    if (world.blocked(x, z, CHICKEN_RADIUS)) {
      continue;
    }
    hen.x = x;
    hen.z = z;
    hen.heading = angle;
    if (hen.flee && turn) {
      hen.flee.x = Math.sin(angle);
      hen.flee.z = Math.cos(angle);
    }
    return true;
  }
  return false;
}

/**
 * 摆好这一帧的样子：位置、朝向、腿、翅膀、啄地时低头，跑的时候一蹦一蹦
 * @param {World} world
 * @param {object} hen
 * @param {number} dt
 */
function pose(world, hen, dt) {
  const running = hen.state === 'flee';
  const walking = running || hen.state === 'walk';
  hen.phase += dt * (walking ? STEP_SPEED : 0);

  const hop = running ? Math.abs(Math.sin(hen.phase * (HOP_SPEED / STEP_SPEED))) * HOP_HEIGHT : 0;
  hen.group.position.set(hen.x, world.heightAt(hen.x, hen.z) + hop, hen.z);
  const turn = Math.atan2(Math.sin(hen.heading - hen.group.rotation.y), Math.cos(hen.heading - hen.group.rotation.y));
  hen.group.rotation.y += turn * Math.min(1, dt * TURN_RATE);

  const swing = walking ? Math.sin(hen.phase) * STEP_SWING : 0;
  hen.legs[0].rotation.x = swing;
  hen.legs[1].rotation.x = -swing;

  const flap = running ? Math.abs(Math.sin(hen.phase * (FLAP_SPEED / STEP_SPEED))) * FLAP_ANGLE : 0;
  hen.wings[0].rotation.z = -flap;
  hen.wings[1].rotation.z = flap;

  // 啄地：每一下先低头再抬头
  const pecking = hen.state === 'peck';
  const peckProgress = pecking ? (hen.timer / PECK_TIME) % 1 : 0;
  hen.head.rotation.x = Math.sin(peckProgress * Math.PI) * PECK_DIP;
}

/**
 * 人在附近的话，离人最近的那只咕咕一声
 * @param {Villager | null} player
 * @param {object[]} flock
 */
function cluckIfNear(player, flock) {
  if (!player) {
    return;
  }
  const near = flock.some((hen) => Math.hypot(hen.x - player.x, hen.z - player.z) < IDLE_CLUCK_RANGE);
  if (near) {
    sfx.cluck(true);
  }
}
