// 毛线篮旁边蜷着睡觉的小猫：一直在轻轻地呼吸、甩尾巴尖、抖耳朵，头上时不时冒一个 💤
// 人走近了它会抬头看过来，"喵"一声；人走开一会儿它又趴下睡了。只是好玩，不进存档
import * as THREE from 'three';
import { at } from '../../kit.js';
import { roundedPart } from './materials.js';
import { sfx } from '../../audio.js';
import { makeBubble, bubbleTexture } from '../../fx.js';
import { CAT } from './layout.js';

// 毛色：奶白底，背上和一只耳朵是橘色的花斑；闭着的眼睛、鼻子
const FUR = '#fff6ea';
const PATCH = '#f2a65a';
const EYE = '#5a4030';
const NOSE = '#f29bb0';
// 身子多大（蜷成一团的椭圆），头多大
const BODY_RADIUS = 0.22;
const BODY_SHAPE = [1.25, 0.62, 1.0];
const HEAD_RADIUS = 0.13;
// 整只猫放大多少：比真的猫大一点，远远看也认得出是只猫
const CAT_SCALE = 1.3;
// 占地多大（登记成圆形障碍，人和小人都绕着走）
const CAT_RADIUS = 0.36;

// 呼吸：一口气多久（弧度每秒），胸口起伏多大
const BREATH_SPEED = 1.6;
const BREATH_DEPTH = 0.045;
// 尾巴尖：睡着时慢慢扫、醒着时甩得快，各甩多大（弧度）
const TAIL_SLEEP = { speed: 0.8, swing: 0.08 };
const TAIL_AWAKE = { speed: 4.5, swing: 0.25 };
// 抖耳朵：隔几秒抖一下（随机范围），抖多大、多久
const EAR_TWITCH_GAP = [3, 7];
const EAR_TWITCH_ANGLE = 0.45;
const EAR_TWITCH_TIME = 0.25;
// 睡着时头低下多少，醒了抬起来多少（弧度，绕脖子往前点头为正）；头最多往两边转多少
const HEAD_DOWN = 0.35;
const HEAD_UP = -0.25;
const HEAD_TURN_LIMIT = 0.9;
// 头动起来多快跟上（越大越快）
const HEAD_FOLLOW = 6;
// 人在走、离多近会吵醒它；人离多远、离开多久它才又睡着
const WAKE_RADIUS = 1.1;
const STAY_RADIUS = 1.8;
const SLEEP_DELAY = 3;
// 头上的气泡：睡着时隔多久冒一次 💤、冒多久；醒来时冒一个 ♥
const SNORE_GAP = 6;
const SNORE_TIME = 2.2;
const WAKE_BUBBLE_TIME = 1.6;
const BUBBLE_HEIGHT = 0.62;
const BUBBLE_SIZE = 0.38;

/**
 * 小猫的模型
 * @description 原点在地上、身子中间，头朝 +z；眼睛是两条细缝，醒了才睁开
 * @param {Kit} kit 造型工具箱
 * @returns {{ group: THREE.Group, body: THREE.Mesh, head: THREE.Group, ears: THREE.Object3D[], eyes: THREE.Mesh[], tail: THREE.Group }}
 */
export function buildCat(kit) {
  const group = new THREE.Group();

  const body = kit.sphere(BODY_RADIUS, FUR, 18);
  body.scale.set(...BODY_SHAPE);
  body.position.y = BODY_RADIUS * BODY_SHAPE[1];
  group.add(body);
  // 背上一块橘色花斑：贴着身子的一块扁圆
  const patch = kit.sphere(BODY_RADIUS * 0.62, PATCH, 14);
  patch.scale.set(1.3, 0.5, 1.1);
  group.add(at(patch, -0.05, BODY_RADIUS * BODY_SHAPE[1] * 1.55, -0.04));

  // 头：脖子那儿是转轴，点头、转头都绕它
  const head = new THREE.Group();
  // 先转头再点头：不然转过去以后点头会变成歪脖子
  head.rotation.order = 'YXZ';
  head.position.set(0.02, BODY_RADIUS * 0.75, BODY_RADIUS * 0.9);
  head.add(at(kit.sphere(HEAD_RADIUS, FUR, 16), 0, HEAD_RADIUS * 0.6, HEAD_RADIUS * 0.6));
  const ears = [-1, 1].map((side) => {
    const ear = new THREE.Group();
    ear.position.set(side * HEAD_RADIUS * 0.55, HEAD_RADIUS * 1.35, HEAD_RADIUS * 0.45);
    ear.rotation.z = -side * 0.35;
    const earColor = side > 0 ? PATCH : FUR;
    ear.add(at(kit.cone(HEAD_RADIUS * 0.38, HEAD_RADIUS * 0.6, earColor, 4), 0, HEAD_RADIUS * 0.25, 0));
    head.add(ear);
    return ear;
  });
  const eyes = [-1, 1].map((side) => {
    const eye = roundedPart(kit, HEAD_RADIUS * 0.32, HEAD_RADIUS * 0.12, 0.02, EYE, 0.005);
    head.add(at(eye, side * HEAD_RADIUS * 0.42, HEAD_RADIUS * 0.72, HEAD_RADIUS * 1.5));
    return eye;
  });
  head.add(at(kit.sphere(HEAD_RADIUS * 0.12, NOSE, 8), 0, HEAD_RADIUS * 0.5, HEAD_RADIUS * 1.6));
  group.add(head);

  // 尾巴：绕着身子前面弯过来的一段圈，根在屁股那儿
  const tail = new THREE.Group();
  tail.position.set(-BODY_RADIUS * 0.6, 0.05, -BODY_RADIUS * 0.7);
  const curl = kit.mesh(new THREE.TorusGeometry(BODY_RADIUS * 1.05, 0.045, 8, 18, Math.PI * 0.85), PATCH);
  curl.rotation.x = Math.PI / 2;
  curl.rotation.z = Math.PI * 0.55;
  curl.position.set(BODY_RADIUS * 0.6, 0, BODY_RADIUS * 0.7);
  tail.add(curl);
  group.add(tail);

  return { group, body, head, ears, eyes, tail };
}

/**
 * 把小猫放在毛线篮旁边，开始呼吸、甩尾巴，盯着人有没有走近
 * @param {World} world 小屋这个世界
 */
export function placeCat(world) {
  const cat = buildCat(world.kit);
  cat.group.scale.setScalar(CAT_SCALE);
  world.add(cat.group, CAT.x, world.heightAt(CAT.x, CAT.z), CAT.z, CAT.facing);
  world.solidCircle(CAT.x, CAT.z, CAT_RADIUS);

  const bubble = makeBubble();
  bubble.scale.setScalar(BUBBLE_SIZE);
  bubble.position.y = BUBBLE_HEIGHT;
  cat.group.add(bubble);

  const mood = { awake: false, awayFor: 0, bubbleUntil: 0, nextSnore: SNORE_GAP, nextTwitch: EAR_TWITCH_GAP[0], twitchStart: -1, twitchEar: 0 };
  const bodyBaseY = cat.body.scale.y;

  world.onUpdate((dt, time) => {
    updateMood(cat, mood, world.player, bubble, time, dt);

    const breath = Math.sin(time * BREATH_SPEED) * BREATH_DEPTH;
    cat.body.scale.y = bodyBaseY * (1 + breath);

    const tailMotion = mood.awake ? TAIL_AWAKE : TAIL_SLEEP;
    cat.tail.rotation.y = Math.sin(time * tailMotion.speed) * tailMotion.swing;

    twitchEars(cat, mood, time);
    turnHead(cat, mood, world.player, dt);
    bubble.visible = time < mood.bubbleUntil;
  });
}

/**
 * 醒着还是睡着：人走近就醒，人走开一会儿又睡
 * @param {object} cat buildCat 的结果
 * @param {object} mood 小猫现在的状态
 * @param {Villager | null} player 玩家
 * @param {THREE.Sprite} bubble 头上的气泡
 * @param {number} time 世界里过了多久（秒）
 * @param {number} dt 这一帧多久（秒）
 */
function updateMood(cat, mood, player, bubble, time, dt) {
  const distance = player ? Math.hypot(player.x - CAT.x, player.z - CAT.z) : Infinity;
  const playerWalking = Boolean(player && player.moving);

  if (!mood.awake) {
    const disturbed = playerWalking && distance < WAKE_RADIUS;
    if (disturbed) {
      mood.awake = true;
      mood.awayFor = 0;
      sfx.meow();
      showBubble(bubble, mood, '♥', time, WAKE_BUBBLE_TIME);
      setEyesOpen(cat, true);
      return;
    }
    if (time > mood.nextSnore) {
      showBubble(bubble, mood, '💤', time, SNORE_TIME);
      mood.nextSnore = time + SNORE_GAP;
    }
    return;
  }

  mood.awayFor = distance > STAY_RADIUS ? mood.awayFor + dt : 0;
  if (mood.awayFor > SLEEP_DELAY) {
    mood.awake = false;
    mood.nextSnore = time + SNORE_GAP / 2;
    setEyesOpen(cat, false);
  }
}

/**
 * 头上冒一个气泡，过一会儿自己消失
 * @param {THREE.Sprite} bubble
 * @param {object} mood
 * @param {string} text 气泡里画什么
 * @param {number} time 现在（秒）
 * @param {number} duration 冒多久（秒）
 */
function showBubble(bubble, mood, text, time, duration) {
  bubble.material.map = bubbleTexture(text);
  bubble.material.needsUpdate = true;
  mood.bubbleUntil = time + duration;
}

/**
 * 睁眼（圆点）还是闭眼（细缝）
 * @param {object} cat
 * @param {boolean} open
 */
function setEyesOpen(cat, open) {
  const height = open ? 2.4 : 1;
  for (const eye of cat.eyes) {
    eye.scale.set(open ? 0.7 : 1, height, 1);
  }
}

/**
 * 隔几秒抖一下耳朵：一只耳朵飞快地往外撇一下再回来
 * @param {object} cat
 * @param {object} mood
 * @param {number} time
 */
function twitchEars(cat, mood, time) {
  if (time > mood.nextTwitch) {
    mood.twitchStart = time;
    mood.twitchEar = Math.floor(time * 7) % 2;
    const gap = EAR_TWITCH_GAP[0] + ((time * 13.7) % 1) * (EAR_TWITCH_GAP[1] - EAR_TWITCH_GAP[0]);
    mood.nextTwitch = time + gap;
  }

  const progress = (time - mood.twitchStart) / EAR_TWITCH_TIME;
  const twitching = progress >= 0 && progress < 1;
  const flick = twitching ? Math.sin(progress * Math.PI) * EAR_TWITCH_ANGLE : 0;
  cat.ears.forEach((ear, index) => {
    ear.rotation.x = index === mood.twitchEar ? -flick : 0;
  });
}

/**
 * 头：睡着时低着；醒了抬起来，转过去看着人（转不过去的角度就停在最大）
 * @param {object} cat
 * @param {object} mood
 * @param {Villager | null} player
 * @param {number} dt
 */
function turnHead(cat, mood, player, dt) {
  let nod = HEAD_DOWN;
  let turn = 0;
  if (mood.awake && player) {
    nod = HEAD_UP;
    const towardPlayer = Math.atan2(player.x - CAT.x, player.z - CAT.z) - CAT.facing;
    // 角度绕到 -π ~ π 之间，再限制在能转到的范围里
    const wrapped = Math.atan2(Math.sin(towardPlayer), Math.cos(towardPlayer));
    turn = THREE.MathUtils.clamp(wrapped, -HEAD_TURN_LIMIT, HEAD_TURN_LIMIT);
  }

  const follow = 1 - Math.exp(-dt * HEAD_FOLLOW);
  cat.head.rotation.x = THREE.MathUtils.lerp(cat.head.rotation.x, nod, follow);
  cat.head.rotation.y = THREE.MathUtils.lerp(cat.head.rotation.y, turn, follow);
}
