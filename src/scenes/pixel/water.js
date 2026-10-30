// 会动的水：喷泉往四面喷出一道道方块水珠落进池子，瀑布的水帘一格一格往下流、脚下白沫翻腾，
// 池塘里时不时跳起一条小金鱼，荷叶跟着水轻轻晃。都只是看的，不挡路
// 小镇卡住了时喷泉是干的（setFlow(0)），心放回去以后水一点点冒起来
import * as THREE from 'three';
import { rng } from '../../kit.js';
import { fish as fishModel } from './models.js';

// 喷泉：几道水，每道几颗水珠；一颗从喷水口落到池子里要多久（秒），拱起来多高；落在离中心多远的地方
const SPRAY_ARCS = 8;
const DROPS_PER_ARC = 3;
const SPRAY_TIME = 0.9;
const SPRAY_ARCH = 0.22;
const SPRAY_REACH = 0.5;
const DROP_SIZE = 0.06;
// 每道水的水珠错开多少（占一趟的比例），几道水不会齐刷刷一起落
const ARC_STAGGER = 0.13;
// 水珠落进池子时隔多久散一圈波纹（秒），多大
const SPRAY_RIPPLE_GAP = 0.35;
const SPRAY_RIPPLE = 0.25;
// 水冒起来时：先冒到几成才喷得出水珠（之前是池子在慢慢涨），池底的水比池底高多少才看得见
const SPRAY_STARTS_AT = 0.3;
const WATER_ABOVE_FLOOR = 0.01;

// 瀑布：水帘每秒往下挪几个像素（贴图多少像素高见 pond.js）；白沫上下翻多高、多快；隔多久溅一次水
const SHEET_FLOW_PX = 18;
const SHEET_PX_HEIGHT = 16;
const FOAM_BOB = 0.05;
const FOAM_SPEED = 7;
// 白沫一块块错开翻（弧度），翻起来时放大到多少
const FOAM_PHASE_STEP = 1.7;
const FOAM_GROW = [0.8, 1.2];
// 溅水的地方在瀑布脚下左右散开多宽
const FALL_SPREAD = 0.6;
const FALL_SPLASH_GAP = 0.45;
const FALL_DROPS = 2;
const FALL_RIPPLE = 0.45;

// 鱼：隔多久跳一次（秒，随机），一跳多久、多高、多远；出水入水溅几颗水珠、波纹散多大
const FISH_GAP = [4, 9];
const FISH_JUMP_TIME = 0.7;
const FISH_JUMP_HEIGHT = 0.35;
const FISH_JUMP_LENGTH = 0.5;
const FISH_DROPS = 4;
const FISH_RIPPLE = 0.5;
const FISH_SEED = 7;
// 鱼比真的画大一点，远远看过去也认得出来
const FISH_SCALE = 1.4;
// 跳到最高时头抬多少、落下时低多少（弧度）
const FISH_TILT = 0.9;

// 荷叶：跟着水上下晃多少、转多少，多快
const PAD_BOB = 0.008;
const PAD_TURN = 0.05;
const PAD_SPEED = 1.2;
// 每片荷叶的步子错开多少（弧度）
const PAD_PHASE_STEP = 2.1;

/**
 * 让水动起来
 * @param {World} world 像素小镇
 * @param {object} context
 * @param {{ x: number, z: number, groundY: number, lowerWater: number, spout: number }} context.fountain 喷泉
 * @param {{ texture: THREE.Texture, foam: THREE.Mesh[], baseX: number, baseZ: number }} context.waterfall 瀑布
 * @param {THREE.Group[]} context.pads 荷叶
 * @param {number} context.waterSurface 池塘的水面多高
 * @param {{ ripple: Function, splash: Function }} context.splashes 水面上的波纹和水珠
 * @returns {{ fountain: { setFlow(level: number): void } }} 喷泉冒水冒到几成（0 干的，1 满池子、喷得最高）
 */
export function createWaterLife(world, { fountain, waterfall, pads, waterSurface, splashes }) {
  const spray = fountainSpray(world, fountain, splashes);
  flowingWaterfall(world, waterfall, waterSurface, splashes);
  jumpingFish(world, waterSurface, splashes);
  bobbingPads(world, pads);
  return { fountain: { setFlow: (level) => setFountainFlow(fountain, spray, level) } };
}

// ---------- 喷泉 ----------

/**
 * 喷泉：从顶上的喷水口往四面喷出几道弧，一颗颗方块水珠顺着弧落进下面的池子
 * @param {World} world
 * @param {{ x: number, z: number, groundY: number, lowerWater: number, spout: number }} fountain
 * @param {{ ripple: Function }} splashes
 * @returns {{ pressure: number }} 喷得多有劲（0 不喷，1 喷得最远最高），setFountainFlow 改它
 */
function fountainSpray(world, fountain, splashes) {
  const spray = { pressure: 1 };
  const material = world.kit.m('#bfeaff', { emissive: '#7fd0f7', emissiveIntensity: 0.3 });
  const geometry = new THREE.BoxGeometry(DROP_SIZE, DROP_SIZE, DROP_SIZE);
  const drops = [];
  for (let arc = 0; arc < SPRAY_ARCS; arc++) {
    const angle = (arc / SPRAY_ARCS) * Math.PI * 2;
    for (let i = 0; i < DROPS_PER_ARC; i++) {
      const drop = new THREE.Mesh(geometry, material);
      world.root.add(drop);
      drops.push({ mesh: drop, angle, offset: i / DROPS_PER_ARC + arc * ARC_STAGGER });
    }
  }

  const spoutY = fountain.groundY + fountain.spout;
  const waterY = fountain.groundY + fountain.lowerWater;
  let rippleWait = 0;
  world.onUpdate((dt, time) => {
    const spraying = spray.pressure > 0;
    for (const drop of drops) {
      drop.mesh.visible = spraying;
      if (!spraying) {
        continue;
      }
      const progress = (time / SPRAY_TIME + drop.offset) % 1;
      const reach = SPRAY_REACH * spray.pressure * progress;
      const arch = SPRAY_ARCH * spray.pressure;
      const y = THREE.MathUtils.lerp(spoutY, waterY, progress * progress) + arch * 4 * progress * (1 - progress);
      drop.mesh.position.set(fountain.x + Math.cos(drop.angle) * reach, y, fountain.z + Math.sin(drop.angle) * reach);
    }

    rippleWait -= dt;
    if (spraying && rippleWait <= 0) {
      rippleWait = SPRAY_RIPPLE_GAP;
      const angle = Math.floor(Math.random() * SPRAY_ARCS) * ((Math.PI * 2) / SPRAY_ARCS);
      const reach = SPRAY_REACH * spray.pressure;
      splashes.ripple(fountain.x + Math.cos(angle) * reach, fountain.z + Math.sin(angle) * reach, SPRAY_RIPPLE, waterY);
    }
  });
  return spray;
}

/**
 * 喷泉冒水冒到几成：先是大池子的水从池底涨上来，涨到一些以后顶上开始喷，越喷越远
 * @param {{ lowerWater: number, lowerFloor: number, waters: { lower: THREE.Mesh, upper: THREE.Mesh } }} fountain
 * @param {{ pressure: number }} spray fountainSpray() 返回的
 * @param {number} level 0 干的，1 满池子、喷得最高
 */
function setFountainFlow(fountain, spray, level) {
  const { lower, upper } = fountain.waters;
  const filled = Math.min(Math.max(level, 0), 1);
  lower.visible = filled > 0;
  lower.position.y = THREE.MathUtils.lerp(fountain.lowerFloor + WATER_ABOVE_FLOOR, fountain.lowerWater, filled);
  upper.visible = filled >= SPRAY_STARTS_AT;
  spray.pressure = Math.max((level - SPRAY_STARTS_AT) / (1 - SPRAY_STARTS_AT), 0);
}

// ---------- 瀑布 ----------

/**
 * 瀑布：水帘一个像素一个像素往下挪，脚下的白沫上下翻，隔一会儿溅起水珠、散开波纹
 * @param {World} world
 * @param {{ texture: THREE.Texture, foam: THREE.Mesh[], baseX: number, baseZ: number }} waterfall
 * @param {number} waterSurface
 * @param {{ ripple: Function, splash: Function }} splashes
 */
function flowingWaterfall(world, waterfall, waterSurface, splashes) {
  let splashWait = 0;
  world.onUpdate((dt, time) => {
    // 一次挪一整个像素：贴图是像素画，挪半个像素会糊
    waterfall.texture.offset.y = Math.floor(time * SHEET_FLOW_PX) / SHEET_PX_HEIGHT;

    waterfall.foam.forEach((block, index) => {
      const bob = Math.abs(Math.sin(time * FOAM_SPEED + index * FOAM_PHASE_STEP));
      block.position.y = waterSurface + bob * FOAM_BOB;
      block.scale.setScalar(FOAM_GROW[0] + bob * (FOAM_GROW[1] - FOAM_GROW[0]));
    });

    splashWait -= dt;
    if (splashWait <= 0) {
      splashWait = FALL_SPLASH_GAP;
      const spread = (Math.random() - 0.5) * FALL_SPREAD;
      splashes.splash(waterfall.baseX + spread, waterfall.baseZ, FALL_DROPS);
      splashes.ripple(waterfall.baseX + spread, waterfall.baseZ, FALL_RIPPLE);
    }
  });
}

// ---------- 鱼 ----------

/**
 * 池塘里时不时跳起一条小鱼，出水入水各溅一下水花、散一圈波纹
 * @param {World} world
 * @param {number} waterSurface
 * @param {{ ripple: Function, splash: Function }} splashes
 */
function jumpingFish(world, waterSurface, splashes) {
  const random = rng(FISH_SEED);
  const pools = waterCells(world.terrain);
  const fish = fishModel(world.kit);
  fish.scale.setScalar(FISH_SCALE);
  fish.visible = false;
  world.root.add(fish);

  let jump = null;
  let wait = FISH_GAP[0];
  world.onUpdate((dt) => {
    if (!jump) {
      wait -= dt;
      if (wait <= 0) {
        jump = startJump(random, pools, waterSurface);
        splashAt(splashes, jump.from);
      }
      return;
    }

    jump.time += dt;
    const progress = Math.min(jump.time / FISH_JUMP_TIME, 1);
    fish.visible = true;
    fish.position.lerpVectors(jump.from, jump.to, progress);
    fish.position.y += Math.sin(progress * Math.PI) * FISH_JUMP_HEIGHT;
    // 往上跳时抬头，落下时低头
    fish.rotation.y = Math.atan2(jump.to.x - jump.from.x, jump.to.z - jump.from.z);
    fish.rotation.x = -Math.cos(progress * Math.PI) * FISH_TILT;
    if (progress >= 1) {
      splashAt(splashes, jump.to);
      fish.visible = false;
      jump = null;
      wait = FISH_GAP[0] + random() * (FISH_GAP[1] - FISH_GAP[0]);
    }
  });
}

/**
 * 鱼出水、入水的地方溅一下
 * @param {{ ripple: Function, splash: Function }} splashes
 * @param {THREE.Vector3} where
 */
function splashAt(splashes, where) {
  splashes.ripple(where.x, where.z, FISH_RIPPLE);
  splashes.splash(where.x, where.z, FISH_DROPS);
}

/**
 * 挑一处水，定好这一跳从哪儿到哪儿
 * @param {Function} random
 * @param {number[][]} pools 水格子的中心
 * @param {number} waterSurface
 * @returns {{ from: THREE.Vector3, to: THREE.Vector3, time: number }}
 */
function startJump(random, pools, waterSurface) {
  const [x, z] = pools[Math.floor(random() * pools.length)];
  const direction = random() * Math.PI * 2;
  const half = FISH_JUMP_LENGTH / 2;
  const from = new THREE.Vector3(x - Math.cos(direction) * half, waterSurface, z - Math.sin(direction) * half);
  const to = new THREE.Vector3(x + Math.cos(direction) * half, waterSurface, z + Math.sin(direction) * half);
  return { from, to, time: 0 };
}

/**
 * 地图上的水格子的中心
 * @param {Terrain} terrain
 * @returns {number[][]}
 */
function waterCells(terrain) {
  const cells = [];
  for (let row = 0; row < terrain.d; row++) {
    for (let column = 0; column < terrain.w; column++) {
      if (terrain.ch(column, row) === '~') {
        cells.push([terrain.x0 + column + 0.5, terrain.z0 + row + 0.5]);
      }
    }
  }
  return cells;
}

// ---------- 荷叶 ----------

/**
 * 荷叶跟着水轻轻上下晃、转一点，每片步子错开
 * @param {World} world
 * @param {THREE.Group[]} pads
 */
function bobbingPads(world, pads) {
  const rest = pads.map((pad) => ({ y: pad.position.y, turn: pad.rotation.y }));
  world.onUpdate((dt, time) => {
    pads.forEach((pad, index) => {
      const phase = time * PAD_SPEED + index * PAD_PHASE_STEP;
      pad.position.y = rest[index].y + Math.sin(phase) * PAD_BOB;
      // 转得比上下晃慢一半，两个动作不同步
      pad.rotation.y = rest[index].turn + Math.sin(phase / 2) * PAD_TURN;
    });
  });
}
