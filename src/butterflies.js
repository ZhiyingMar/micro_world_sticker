// 蝴蝶：绕着花丛飞，忽高忽低，扇着翅膀；人走近会被惊飞，飞远停一会儿再慢慢飞回来
// 森林和小屋花园共用；只是看的，不挡路，也不会被点到
import * as THREE from 'three';
import { rng } from './kit.js';
import { sfx } from './audio.js';

// 蝴蝶：几只，翅膀什么颜色，绕着花丛飞多大一圈、飞多高、扇翅膀多快
const BUTTERFLY_COLORS = ['#ffd84a', '#ffffff', '#ff9ec2', '#9fd3ff', '#ffb36b'];
const BUTTERFLY_ORBIT = [0.35, 0.7];
const BUTTERFLY_HEIGHT = 0.4;
const BUTTERFLY_BOB = 0.12;
const BUTTERFLY_FLAP_SPEED = 16;
const BUTTERFLY_FLAP_ANGLE = 1.1;
// 比真的蝴蝶画大一点，远远看过去也认得出来
const BUTTERFLY_SCALE = 2;
// 惊飞：人在走动、离多近会惊到它；往远离人的方向飞多远、飞多高；
// 飞出去、在高处停一会儿、慢慢飞回花丛各多久（秒）；受惊时翅膀扇得快几倍
const SCARE_RADIUS = 0.9;
const FLEE_DISTANCE = 1.4;
const FLEE_HEIGHT = 1.1;
const FLEE_OUT = 0.9;
const FLEE_HOLD = 1.2;
const FLEE_BACK = 2.5;
const FLEE_FLAP_BOOST = 1.8;

/**
 * 放几只蝴蝶：每只绕着一片花丛飞，忽高忽低，扇着翅膀；人走近会被惊飞
 * @param {World} world 放在哪个世界
 * @param {{ x: number, z: number, y: number }[]} gardens 每只绕着飞的花丛中心，y 是那里的地面高度
 * @param {number} seed 随机种子：每只飞多大圈、多快，每次进来都一样
 * @returns {{ setPresence(level: number): void }} 出来多少（1 都在飞 ~ 0 都躲起来了，天黑时用）
 */
export function createButterflies(world, gardens, seed) {
  const random = rng(seed);

  const flock = gardens.map(({ x, z, y }, index) => {
    const color = BUTTERFLY_COLORS[index % BUTTERFLY_COLORS.length];
    const { group, wings } = butterfly(world.kit, color);
    group.scale.setScalar(BUTTERFLY_SCALE);
    world.root.add(group);
    return {
      group,
      wings,
      x,
      z,
      groundY: y,
      orbit: BUTTERFLY_ORBIT[0] + random() * (BUTTERFLY_ORBIT[1] - BUTTERFLY_ORBIT[0]),
      speed: 0.6 + random() * 0.5,
      phase: random() * Math.PI * 2,
      flee: null,
    };
  });

  // 天黑了蝴蝶一点点缩小、躲起来；全躲起来以后不画也不算
  let presence = 1;
  world.onUpdate((dt, time) => {
    if (presence <= 0) {
      return;
    }
    for (const fly of flock) {
      maybeScare(fly, world.player, time);
      flutter(fly, time);
    }
  });

  const setPresence = (level) => {
    presence = level;
    for (const fly of flock) {
      fly.group.visible = level > 0;
      fly.group.scale.setScalar(BUTTERFLY_SCALE * level);
    }
  };
  return { setPresence };
}

/**
 * 人走近了，蝴蝶受惊往远离人的方向飞走
 * @description 人站着不动不会惊到它；已经在逃的不再算一次
 * @param {object} fly
 * @param {Villager | null} player
 * @param {number} time
 */
function maybeScare(fly, player, time) {
  const calm = !fly.flee;
  const playerWalking = Boolean(player && player.moving);
  const canBeScared = calm && playerWalking;
  if (!canBeScared) {
    return;
  }

  const awayX = fly.group.position.x - player.x;
  const awayZ = fly.group.position.z - player.z;
  const distance = Math.hypot(awayX, awayZ);
  if (distance > SCARE_RADIUS) {
    return;
  }

  // 正好在人头顶上时随便挑个方向飞
  const length = distance || 1;
  fly.flee = { start: time, x: awayX / length, z: awayZ / length };
  sfx.flutter();
}

/**
 * 受惊的蝴蝶离花丛有多远：飞出去 → 在高处停一会儿 → 慢慢飞回来
 * @param {object} fly
 * @param {number} time
 * @returns {number} 0 在花丛上，1 飞到最远最高
 */
function fleeAmount(fly, time) {
  if (!fly.flee) {
    return 0;
  }

  const elapsed = time - fly.flee.start;
  if (elapsed < FLEE_OUT) {
    const progress = elapsed / FLEE_OUT;
    return 1 - (1 - progress) ** 2;
  }
  if (elapsed < FLEE_OUT + FLEE_HOLD) {
    return 1;
  }
  const back = (elapsed - FLEE_OUT - FLEE_HOLD) / FLEE_BACK;
  if (back >= 1) {
    fly.flee = null;
    return 0;
  }
  return 1 - back * back * (3 - 2 * back);
}

/**
 * 一只蝴蝶这一帧在哪、朝哪、翅膀扇到哪
 * @param {object} fly butterflies() 里的一只
 * @param {number} time 世界里过了多久（秒）
 */
function flutter(fly, time) {
  const angle = time * fly.speed + fly.phase;
  // 横着是一个歪歪扭扭的 8 字，看起来不像绕圈
  const x = fly.x + Math.sin(angle) * fly.orbit;
  const z = fly.z + Math.sin(angle * 2) * fly.orbit * 0.5;
  const y = fly.groundY + BUTTERFLY_HEIGHT + Math.sin(angle * 3.1) * BUTTERFLY_BOB;

  // 受惊时整条路线往远离人的方向、往高处挪开
  const scared = fleeAmount(fly, time);
  const fleeX = fly.flee ? fly.flee.x * FLEE_DISTANCE * scared : 0;
  const fleeZ = fly.flee ? fly.flee.z * FLEE_DISTANCE * scared : 0;

  // 朝着飞的方向
  const headingX = Math.cos(angle) * fly.orbit;
  const headingZ = Math.cos(angle * 2) * fly.orbit;
  fly.group.position.set(x + fleeX, y + FLEE_HEIGHT * scared, z + fleeZ);
  fly.group.rotation.y = Math.atan2(headingX, headingZ);

  const flapSpeed = BUTTERFLY_FLAP_SPEED * (1 + (FLEE_FLAP_BOOST - 1) * scared);
  const flap = Math.abs(Math.sin(time * flapSpeed + fly.phase)) * BUTTERFLY_FLAP_ANGLE;
  fly.wings[0].rotation.z = flap;
  fly.wings[1].rotation.z = -flap;
}

/**
 * 一只蝴蝶：细细的身子，左右两片翅膀，翅膀的根在身子上，扇的时候绕着根转
 * @param {Kit} kit
 * @param {string} color 翅膀颜色
 * @returns {{ group: THREE.Group, wings: THREE.Mesh[] }} 朝 +z 飞
 */
function butterfly(kit, color) {
  const group = new THREE.Group();
  const body = kit.cyl(0.008, 0.008, 0.08, '#4a3a30', 5);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.05, 0.06, 0.1, 0.04, 0.09, -0.01);
  shape.bezierCurveTo(0.08, -0.05, 0.03, -0.04, 0, 0);
  const wingGeometry = new THREE.ShapeGeometry(shape);
  wingGeometry.rotateX(-Math.PI / 2);

  const wings = [1, -1].map((side) => {
    const wing = kit.mesh(wingGeometry, color, { side: THREE.DoubleSide });
    wing.scale.x = side;
    group.add(wing);
    return wing;
  });
  return { group, wings };
}
