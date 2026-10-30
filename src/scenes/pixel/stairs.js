// 广场上去台地的三条台阶：小镇卡住了时石板方块都不见了，只剩贴着地的一层底座，上不了台地
// 挡路是数据（blocker），塌掉只是画面；投了币以后石板一级接一级长回来，每一级叮一个音，一条长完了才能走
import { sfx } from '../../audio.js';
import { easeOutBack } from '../../timeline.js';

// 塌掉的台阶剩多厚的底座：台阶这一格地面上没画顶面，要留一层把格子盖住
const RUBBLE_HEIGHT = 0.02;
// 长回来：一级接一级隔多久（秒），每级长多久；一条台阶长完到下一条开始隔多久
const STEP_GAP = 0.13;
const STEP_GROW = 0.25;
const FLIGHT_GAP = 0.25;
// 每长一级蹦出几块小方块，什么颜色（和台阶石板一样）
const STEP_BITS = 3;
const BIT_COLORS = ['#dcd5c6', '#c7bfae'];
// 一条接一条，叮的音也一条比一条起得高一点
const NOTE_RISE_PER_FLIGHT = 1;
// 撞上去时的提示
const GATE_SAY = '台阶的方块都不见了，上不去……';

/**
 * 让广场上去的台阶都塌掉，登记挡路；返回让它们长回来的办法
 * @description 广场是最低的一层，从它上去的台阶一塌，人就只能在广场和前面逛；风车山那一级在台地上，台地上不去也就到不了
 * @param {World} world 像素小镇
 * @param {{ stairs: { object: THREE.Group, x: number, z: number, baseY: number }[] }} ground 地面画出来的每一格台阶
 * @param {object} context
 * @param {{ x: number, z: number }} context.from 从哪儿开始长（投币机），离它近的台阶先长
 * @param {{ burst: Function }} context.bits 蹦小方块
 * @param {ReturnType<import('../../timeline.js').createTimeline>} context.timeline 排动画用
 * @returns {{ rebuild(options?: { instant?: boolean, delay?: number, done?: Function }): void, rebuildTime: number }}
 *   rebuild 让台阶长回来；rebuildTime 是全长回来要多久（秒）
 */
export function createStairGates(world, ground, { from, bits, timeline }) {
  const lowest = Math.min(...ground.stairs.map((feature) => feature.baseY));
  const flights = ground.stairs
    .filter((feature) => feature.baseY === lowest)
    .map((feature) => collapse(world, feature))
    .sort((first, second) => distance(first, from) - distance(second, from));

  const flightTime = (stepsPerFlight(flights) - 1) * STEP_GAP + STEP_GROW;
  const rebuildTime = (flights.length - 1) * (flightTime + FLIGHT_GAP) + flightTime;
  return {
    rebuild: (options = {}) => rebuild(world, flights, { bits, timeline, flightTime, ...options }),
    rebuildTime,
  };
}

/**
 * 一条台阶有几级
 * @param {{ slabs: object[] }[]} flights
 * @returns {number}
 */
function stepsPerFlight(flights) {
  return flights.length ? flights[0].slabs.length : 0;
}

/**
 * 两处在地上隔多远
 * @param {{ x: number, z: number }} first
 * @param {{ x: number, z: number }} second
 * @returns {number}
 */
function distance(first, second) {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

/**
 * 一格台阶塌成一层底座，这一格挡上
 * @param {World} world
 * @param {{ object: THREE.Group, x: number, z: number, baseY: number }} feature
 * @returns {{ x: number, z: number, baseY: number, slabs: { mesh: THREE.Mesh, height: number }[], blocker: object }}
 *   slabs 从低到高，每级石板本来多高
 */
function collapse(world, { object, x, z, baseY }) {
  // 石板从这一格低的那头一直垫到这一级的高度，中心在一半高的地方
  const slabs = object.children.map((mesh) => ({ mesh, height: (mesh.position.y - baseY) * 2 }));
  const flight = { x, z, baseY, slabs, blocker: world.blocker(x - 0.5, x + 0.5, z - 0.5, z + 0.5, GATE_SAY) };
  for (const slab of slabs) {
    setSlabGrowth(flight, slab, 0);
  }
  return flight;
}

/**
 * 一级石板长到几成
 * @param {{ baseY: number }} flight
 * @param {{ mesh: THREE.Mesh, height: number }} slab
 * @param {number} growth 0 只剩底座，1 长足了（中间可以冲过头一点）
 */
function setSlabGrowth(flight, slab, growth) {
  const height = Math.max(RUBBLE_HEIGHT, slab.height * growth);
  slab.mesh.scale.y = height / slab.height;
  slab.mesh.position.y = flight.baseY + height / 2;
}

/**
 * 台阶一条接一条、一级接一级长回来，每级叮一个音、蹦几块小方块；一条长完就能走
 * @param {World} world
 * @param {object[]} flights collapse() 过、排好先后的台阶
 * @param {object} options
 * @param {boolean} [options.instant] 读档时直接长好，不播动画
 * @param {number} [options.delay] 过多久（秒）开始长
 * @param {Function} [options.done] 全长回来以后调用
 * @param {{ burst: Function }} options.bits
 * @param {object} options.timeline
 * @param {number} options.flightTime 一条台阶长完要多久
 */
function rebuild(world, flights, { instant = false, delay = 0, done, bits, timeline, flightTime }) {
  if (instant) {
    for (const flight of flights) {
      flight.slabs.forEach((slab) => setSlabGrowth(flight, slab, 1));
      world.unblock(flight.blocker);
    }
    done?.();
    return;
  }

  flights.forEach((flight, flightIndex) => {
    const flightStart = delay + flightIndex * (flightTime + FLIGHT_GAP);
    flight.slabs.forEach((slab, step) => {
      const start = flightStart + step * STEP_GAP;
      timeline.after(start, () => {
        sfx.stairNote(step + 1 + flightIndex * NOTE_RISE_PER_FLIGHT);
        bits.burst(slab.mesh.position.x, flight.baseY, slab.mesh.position.z, BIT_COLORS, STEP_BITS);
      });
      timeline.tween(STEP_GROW, (progress) => setSlabGrowth(flight, slab, easeOutBack(progress)), start);
    });
    timeline.after(flightStart + flightTime, () => world.unblock(flight.blocker));
  });

  const allDone = delay + (flights.length - 1) * (flightTime + FLIGHT_GAP) + flightTime;
  timeline.after(allDone, () => done?.());
}
