// 让小屋活起来：窗帘被窗缝里的风吹得轻轻晃，桌上的茶壶冒热气（收音机的音乐和音符在 radio.js）
// 都只是看的，不挡路，也不会被点到
import * as THREE from 'three';

// 窗帘：晃多快、晃多大（弧度），两片步子错开多少；一阵风大一阵风小，多久一个来回
const CURTAIN_SPEED = 1.1;
const CURTAIN_SWAY = 0.035;
const CURTAIN_OFFSET = 1.3;
const GUST_SPEED = 0.3;
const GUST_DEPTH = 0.5;

// 热气：隔多久冒一团（秒），一团多大、多白、飘多快、多久散掉
const STEAM_GAP = 0.45;
const STEAM = { count: 1, color: '#ffffff', size: 0.38, spread: 0.02, rise: 0.28, life: 2.2, opacity: 0.75 };
// 茶壶嘴口离壶嘴模型中心多远（沿壶嘴往外），热气从那儿冒
const SPOUT_TIP = 0.1;

/**
 * 让小屋动起来
 * @param {World} world 小屋这个世界
 * @param {object} context
 * @param {THREE.Group[]} context.curtains 两片窗帘（原点在横杆上）
 * @param {THREE.Object3D} context.spout 茶壶嘴
 * @param {{ emit: Function }} context.puffs 冒热气用
 */
export function bringToLife(world, { curtains, spout, puffs }) {
  swayCurtains(world, curtains);
  steamTea(world, spout, puffs);
}

/**
 * 窗帘绕着横杆前后轻轻晃，一阵风大一阵风小
 * @param {World} world
 * @param {THREE.Group[]} curtains
 */
function swayCurtains(world, curtains) {
  world.onUpdate((dt, time) => {
    const gust = 1 - GUST_DEPTH + GUST_DEPTH * Math.sin(time * GUST_SPEED);
    curtains.forEach((curtain, index) => {
      const phase = time * CURTAIN_SPEED + index * CURTAIN_OFFSET;
      // 绕 x 转负的角度，下摆才往屋里（+z）飘；只往屋里飘，不往墙里戳
      curtain.rotation.x = -(0.5 + 0.5 * Math.sin(phase)) * CURTAIN_SWAY * gust;
    });
  });
}

/**
 * 茶壶嘴隔一会儿冒一团热气，往上飘着散开
 * @param {World} world
 * @param {THREE.Object3D} spout
 * @param {{ emit: Function }} puffs
 */
function steamTea(world, spout, puffs) {
  // 搭场景时方块还没开始动，这时候算出来的位置就是方块里的位置
  spout.updateWorldMatrix(true, false);
  const tip = new THREE.Vector3(0, SPOUT_TIP, 0).applyMatrix4(spout.matrixWorld);
  let wait = 0;

  world.onUpdate((dt) => {
    wait -= dt;
    if (wait > 0) {
      return;
    }
    wait = STEAM_GAP * (0.7 + Math.random() * 0.6);
    puffs.emit(tip, STEAM);
  });
}
