// 挂月亮：杆子太高够不着，要上观景台，把小月亮放到望远镜前面，放大了才挂得回去
// 隔着望远镜看过去，月亮在杆子上慢慢变大；挂好以后望远镜还能再看
import * as THREE from 'three';
import { ghostify } from '../../world.js';
import { sfx } from '../../audio.js';
import { createTimeline } from '../../timeline.js';
import { MOON, MOON_POLE, TELESCOPE } from './layout.js';
import pixel from '../pixel/index.js';

// 小月亮的虚影摆在镜头前面：离望远镜多远、离地多高、放大几倍（像素小镇的模型很小）
const SPOT = { out: 0.5, height: 1.15, scale: 2.2 };
// 隔着望远镜看月亮：镜头拉多近（1 是平时跟人的远近）、看多久（秒）、
// 从望远镜上方多高看过去（镜头不能压得比这更平，再低会被镜头的上下范围挡住）
const SCOPE_VIEW = { zoom: 0.42, hold: 3.4, rise: 2.3 };
// 挂好以后再看一眼，不用等月亮长大，看得短一点
const SECOND_LOOK_HOLD = 2.2;
// 走到杆子这么近就提示够不着；站在望远镜这么近能用它
const POLE_HINT_RANGE = 1.3;
const SCOPE_REACH = 1.4;

const POLE_SAY = '🌙 杆子太高了，够不着……观景台的望远镜正对着这儿';
const EMPTY_SCOPE_SAY = '🔭 镜头前面空空的……把小月亮放上来吧';

/**
 * 登记挂月亮的修复点、杆子下的提示，和挂好以后还能用的望远镜
 * @param {World} world 夜都
 * @param {object} options
 * @param {THREE.Group} options.telescope 观景台上的望远镜
 * @param {() => boolean} options.isHung 月亮挂回去了没有
 * @param {(instant: boolean) => void} options.hang 把月亮挂回去，月光亮起来；instant 是读档时直接变成挂好的样子
 */
export function createMoonRepair(world, { telescope, isHung, hang }) {
  const timeline = createTimeline(world);
  const [spotX, spotZ] = spotBeforeLens();

  world.repairSpot('moon', ghostMoon(world), spotX, world.heightAt(spotX, spotZ) + SPOT.height, spotZ, {
    label: '把 🌙 小月亮放到望远镜前',
    pickR: 0.4,
    seeR: 3.0,
    fn(instant) {
      if (instant) {
        hang(true);
        return;
      }

      // 镜头到了杆子跟前，月亮才开始变大，不然只看得到半截
      const [atMoon] = lookThroughScope(world, SCOPE_VIEW.hold);
      timeline.after(atMoon, () => {
        hang(false);
        sfx.twinkle();
      });
    },
  });

  hintUnderPole(world, isHung);
  useTelescope(world, telescope, isHung);
}

/**
 * 小月亮的虚影放在哪：望远镜镜头朝着杆子，就摆在那一头
 * @returns {number[]} [x, z]
 */
function spotBeforeLens() {
  const [scopeX, scopeZ] = TELESCOPE;
  const towardPole = new THREE.Vector2(MOON[0] - scopeX, MOON[2] - scopeZ).normalize();
  return [scopeX + towardPole.x * SPOT.out, scopeZ + towardPole.y * SPOT.out];
}

/**
 * 小月亮的虚影：和像素小镇捡到的那个一模一样
 * @param {World} world
 * @returns {THREE.Group}
 */
function ghostMoon(world) {
  const ghost = ghostify(pixel.items.find((item) => item.id === 'moon').make(world.kit));
  ghost.scale.setScalar(SPOT.scale);
  const spot = new THREE.Group();
  spot.add(ghost);
  return spot;
}

/**
 * 隔着望远镜看月亮杆子：四周一圈黑，镜头顺着望远镜的方向推过去
 * @param {World} world
 * @param {number} hold 看多久（秒）
 * @returns {number[]} 镜头到位是在多少秒以后
 */
function lookThroughScope(world, hold) {
  const [moonX, moonY, moonZ] = MOON;
  const [scopeX, scopeZ] = TELESCOPE;
  const from = new THREE.Vector3(scopeX, moonY + SCOPE_VIEW.rise, scopeZ);
  return world.showcase([{ at: new THREE.Vector3(moonX, moonY, moonZ), zoom: SCOPE_VIEW.zoom, hold, from, scope: true }]);
}

/**
 * 走到杆子下面提示够不着
 * @description 月亮挂在街区中间，最容易先找到杆子；告诉玩家要去观景台，不然站在这儿不知道怎么办
 * @param {World} world
 * @param {() => boolean} isHung 月亮挂回去了没有
 */
function hintUnderPole(world, isHung) {
  const [poleX, poleZ] = MOON_POLE;
  let underPole = false;

  world.onUpdate(() => {
    const player = world.player;
    if (!player || isHung()) {
      return;
    }

    const near = Math.hypot(player.x - poleX, player.z - poleZ) < POLE_HINT_RANGE;
    if (near && !underPole) {
      world.env.toast?.(POLE_SAY);
    }
    underPole = near;
  });
}

/**
 * 望远镜本身能点：挂好月亮以后再看一眼，没挂之前提醒放小月亮
 * @param {World} world
 * @param {THREE.Group} telescope 观景台上的望远镜
 * @param {() => boolean} isHung 月亮挂回去了没有
 */
function useTelescope(world, telescope, isHung) {
  const [scopeX, scopeZ] = TELESCOPE;
  world.interact('telescope', telescope, scopeX, scopeZ, {
    reach: SCOPE_REACH,
    icon: '🔭',
    short: '望远镜',
    label: '看看月亮',
    available: isHung,
    fn() {
      if (!isHung()) {
        world.env.toast?.(EMPTY_SCOPE_SAY);
        return;
      }
      sfx.twinkle();
      lookThroughScope(world, SECOND_LOOK_HOLD);
    },
  });
}
