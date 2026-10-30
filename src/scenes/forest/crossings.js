// 过到对岸的两条路：池塘里的踏脚石、小溪上的桥。森林的魔法停了时，踏脚石沉到水底、桥塌进小溪，都过不去
// 挡路是数据（blocker），沉下去、塌下去只是画面；修好时画面动回原样，再把挡路拿掉
import { sfx } from '../../audio.js';
import { easeOutBack } from '../../timeline.js';
import { bridgeMushroom } from './models.js';

// 踏脚石沉多深：顶面落到水面底下一点，透过水隐约看得见
const STONE_SINK = 0.3;
// 浮上来：一块接一块隔多久（秒）、每块浮多久；冒出水面时溅几颗水珠、波纹散多大
const STONE_STAGGER = 0.4;
const STONE_RISE = 0.7;
const STONE_DROPS = 6;
const STONE_RIPPLE = 1.1;
// 塌下去的桥：远的那头（+x，对岸）往下歪多少（弧度），整座往下沉多少；近的那头还搭在这边岸上
const BRIDGE_TILT = 0.38;
const BRIDGE_DROP = 0.2;
// 桥顶平以后落稳那一下"咚咚"隔多久（秒）
const BRIDGE_SETTLE_GAP = 0.12;
// 撑桥的大红蘑菇：菌盖顶多高（桥面顶和 0 层一样高，木板 0.06 厚，菌盖顶贴着木板底下），菌盖多大（桥 0.86 宽，两边各露出一截红边）
const PIER_TOP = -0.07;
const PIER_CAP_RADIUS = 0.7;
const PIER_SEED = 53;
// 红蘑菇长大、把桥顶起来要多久（秒）；刚放下去时只有多大（几成）；长的时候"啵嘤"一声，个子大声音低
const PIER_GROW_TIME = 1.1;
const PIER_START_SIZE = 0.15;
const PIER_PITCH = 0.55;
// 红蘑菇长起来时水面散开的波纹多大、溅几颗水珠
const PIER_RIPPLE = 1.4;
const PIER_DROPS = 8;
// 撞上去时的提示
const STONES_SAY = '踏脚石都沉到水底了，踩不过去……';
const BRIDGE_SAY = '桥塌进小溪里了，过不去……桥底下好像少了点什么';

/**
 * 让桥塌下去、踏脚石沉下去，登记挡路；返回修好它们的办法
 * @description 森林只有这两条路能过到对岸，它们一断，人就只能在出生的这半边逛
 * @param {World} world 童话森林
 * @param {{ waterSurface: number, heightAt: Function, crossings: { stones: object[], bridges: object[] } }} ground 画出来的地面：水面多高、溪底多深、踏脚石和桥
 * @param {object} context
 * @param {{ ripple: Function, splash: Function }} context.splashes 水面上的波纹和水珠
 * @param {ReturnType<import('../../timeline.js').createTimeline>} context.timeline 排动画用
 * @returns {{ bridge: { x: number, z: number, waterY: number }, raiseStones: Function, stonesRiseTime: number, liftBridge: Function }}
 *   桥在哪、水面多高；raiseStones 让踏脚石浮上来，全浮上来要多久（秒）；liftBridge 让桥底下长出大红蘑菇，把桥顶平
 */
export function createCrossings(world, ground, { splashes, timeline }) {
  const stones = sinkStones(world, ground.crossings.stones);
  const bridge = breakBridge(world, ground.crossings.bridges, ground.heightAt);

  return {
    bridge: { x: bridge.x, z: bridge.z, waterY: ground.waterSurface },
    raiseStones: (options) => raiseStones(world, stones, { splashes, timeline, ...options }),
    stonesRiseTime: (stones.length - 1) * STONE_STAGGER + STONE_RISE,
    liftBridge: (options) => liftBridge(world, bridge, { splashes, timeline, ...options }),
  };
}

// ---------- 踏脚石 ----------

/**
 * 踏脚石全沉到水底，每块那一格挡上
 * @param {World} world
 * @param {object[]} features 地面画出来的踏脚石（object、x、z）
 * @returns {{ object: THREE.Object3D, x: number, z: number, restY: number, blocker: object }[]}
 *   按从对岸（+x）往这边的顺序排好：浮上来时一块接一块，像一条路从对岸铺过来
 */
function sinkStones(world, features) {
  const stones = features.map(({ object, x, z }) => {
    const restY = object.position.y;
    object.position.y = restY - STONE_SINK;
    const blocker = world.blocker(x - 0.5, x + 0.5, z - 0.5, z + 0.5, STONES_SAY);
    return { object, x, z, restY, blocker };
  });

  return stones.sort((first, second) => {
    if (first.x !== second.x) {
      return second.x - first.x;
    }
    // 同一列的，离池塘里面（-z）近的先浮
    return first.z - second.z;
  });
}

/**
 * 踏脚石一块接一块浮出水面，全浮上来以后才能走
 * @param {World} world
 * @param {object[]} stones sinkStones() 排好的踏脚石
 * @param {object} options
 * @param {boolean} [options.instant] 读档时直接摆好，不播动画
 * @param {number} [options.delay] 过多久（秒）开始浮
 * @param {Function} [options.done] 全浮上来以后调用
 * @param {{ ripple: Function, splash: Function }} options.splashes
 * @param {object} options.timeline
 */
function raiseStones(world, stones, { instant = false, delay = 0, done, splashes, timeline }) {
  if (instant) {
    for (const stone of stones) {
      stone.object.position.y = stone.restY;
      world.unblock(stone.blocker);
    }
    done?.();
    return;
  }

  stones.forEach((stone, index) => {
    const start = delay + index * STONE_STAGGER;
    timeline.after(start, () => {
      splashes.ripple(stone.x, stone.z, STONE_RIPPLE);
      splashes.splash(stone.x, stone.z, STONE_DROPS);
      sfx.splash();
    });
    timeline.tween(STONE_RISE, (progress) => {
      stone.object.position.y = stone.restY - STONE_SINK * (1 - easeOutBack(progress));
    }, start);
  });

  const allUp = delay + (stones.length - 1) * STONE_STAGGER + STONE_RISE;
  timeline.after(allUp, () => {
    for (const stone of stones) {
      world.unblock(stone.blocker);
    }
    done?.();
  });
}

// ---------- 桥 ----------

/**
 * 桥塌下去：对岸那头歪进小溪，这头还搭在岸上；桥那一格挡上
 * @param {World} world
 * @param {object[]} features 地面画出来的桥
 * @param {(x: number, z: number) => number} heightAt 画出来的地面多高（桥底下是溪底）
 * @returns {{ object: THREE.Object3D, x: number, z: number, restY: number, bedY: number, blocker: object }}
 */
function breakBridge(world, features, heightAt) {
  if (features.length !== 1) {
    // 森林的地图上只有一座桥；地图改了要在这里跟着改
    console.warn(`森林的地图上应该正好有一座桥，现在有 ${features.length} 座，只有第一座会塌`);
  }

  const { object, x, z } = features[0];
  const blocker = world.blocker(x - 0.5, x + 0.5, z - 0.5, z + 0.5, BRIDGE_SAY);
  const bridge = { object, x, z, restY: object.position.y, bedY: heightAt(x, z), blocker };
  setBridgeLift(bridge, 0);
  return bridge;
}

/**
 * 桥顶到多平
 * @param {{ object: THREE.Object3D, restY: number }} bridge
 * @param {number} lift 0 塌着，1 平的（中间可以超过 1 一点，弹一下）
 */
function setBridgeLift(bridge, lift) {
  const sag = 1 - lift;
  bridge.object.rotation.z = -BRIDGE_TILT * sag;
  bridge.object.position.y = bridge.restY - BRIDGE_DROP * sag;
}

/**
 * 桥底下长出大红蘑菇，把桥顶平；顶平了才能走
 * @param {World} world
 * @param {object} bridge breakBridge() 返回的桥（带着溪底多深 bedY）
 * @param {object} options
 * @param {boolean} [options.instant] 读档时直接摆好，不播动画
 * @param {{ ripple: Function, splash: Function }} options.splashes
 * @param {object} options.timeline
 */
function liftBridge(world, bridge, { instant = false, splashes, timeline }) {
  const pier = bridgeMushroom(world.kit, { height: PIER_TOP - bridge.bedY, capRadius: PIER_CAP_RADIUS, seed: PIER_SEED });
  world.add(pier, bridge.x, bridge.bedY, bridge.z);
  if (instant) {
    setBridgeLift(bridge, 1);
    world.unblock(bridge.blocker);
    return;
  }

  // 蘑菇"噗"地从溪底长上来，同时把桥顶起来；冲过头一点再落回来，桥跟着弹一下
  sfx.boing(PIER_PITCH);
  splashes.ripple(bridge.x, bridge.z, PIER_RIPPLE);
  splashes.splash(bridge.x, bridge.z, PIER_DROPS);
  timeline.tween(PIER_GROW_TIME, (progress) => {
    const growth = easeOutBack(progress);
    pier.scale.setScalar(PIER_START_SIZE + (1 - PIER_START_SIZE) * growth);
    setBridgeLift(bridge, growth);
  });
  timeline.after(PIER_GROW_TIME, () => {
    world.unblock(bridge.blocker);
    sfx.plank(true);
  });
  timeline.after(PIER_GROW_TIME + BRIDGE_SETTLE_GAP, () => sfx.plank(false));
}
