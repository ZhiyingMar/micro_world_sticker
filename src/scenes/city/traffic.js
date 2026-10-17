// 车流：车沿着一圈马路一直绕着开
// 停电时车都堵着不动；出租车回来、司机醒了才带头开起来
// 开起来以后，有人在哪条斑马线上，快到那条斑马线的车就停下来让
import { sfx } from '../../audio.js';
import { car } from './models.js';
import { createLanes } from './ring-road.js';
import { CARS, JAM, CROSSWALKS } from './layout.js';

const PALETTE = ['#4fa3ff', '#ffd23f', '#ff6b8b', '#f4f1ea', '#9a7bff', '#59d98a'];
const SPEED = 1.4;
// 跟车：和前车隔得比这个近就跟着前车减速
const FOLLOW_GAP = 1.5;
// 车头离车中心多远；再往前看多远，看到有人的斑马线就停
const BUMPER = 0.55;
const LOOK_AHEAD = 1.0;
// 人站在斑马线边上一点也算在过马路
const CROSSWALK_MARGIN = 0.25;
const JAM_SAY = '🚗 车都堵在这儿……左边好像有条缝，能挤过去';

/**
 * 搭车流：摆好车、登记堵车的障碍，每帧让车往前开
 * @param {World} world 夜都
 * @param {object} power 电力（车流动起来时路灯跟着亮）
 * @returns {{ running: boolean, showTaxi(), start(instant) }}
 */
export function createTraffic(world, power) {
  const lanes = createLanes();
  const jam = JAM.map((box) => world.blocker(box.minX, box.maxX, box.minZ, box.maxZ, JAM_SAY));

  const cars = CARS.map((spec, index) => {
    const lane = lanes[spec.lane];
    const color = spec.taxi ? '#ffd23f' : PALETTE[index % PALETTE.length];
    const model = car(world.kit, color, { taxi: spec.taxi });
    world.root.add(model);

    const entry = { model, spec, lane, s: lane.project(...spec.jam), speed: SPEED };
    placeOnLane(entry);
    if (spec.taxi) {
      model.visible = false; // 出租车还在像素小镇
    }
    return entry;
  });
  const taxi = cars.find((entry) => entry.spec.taxi);

  let running = false;
  world.onUpdate((dt) => {
    if (!running) {
      return;
    }

    const busy = busyCrosswalks(world);
    for (const entry of cars) {
      const target = Math.min(yieldSpeed(entry, busy), followSpeed(entry, cars));
      entry.speed += (target - entry.speed) * Math.min(1, dt * 4);
      entry.s = (entry.s + entry.speed * dt) % entry.lane.length;
      placeOnLane(entry);
    }
  });

  return {
    get running() {
      return running;
    },

    /** 出租车回到停靠位 */
    showTaxi() {
      taxi.model.visible = true;
    },

    /**
     * 出租车按喇叭带头，车流动起来，路灯亮了，堵着的斑马线通了
     * @param {boolean} instant 读档时直接变成开着的样子，不播喇叭
     */
    start(instant) {
      if (running) {
        return;
      }
      running = true;

      if (instant) {
        for (const entry of cars) {
          entry.s = entry.lane.project(...entry.spec.normal);
          placeOnLane(entry);
        }
      } else {
        taxi.speed = 0;
        setTimeout(() => sfx.horn(), 1100);
      }

      power.turnOn('street', instant);
      jam.forEach((collider) => world.unblock(collider));
    },
  };
}

/**
 * 把车摆到它在车道上的位置，车头朝行驶方向
 * @param {{ model, lane, s }} entry 一辆车
 */
function placeOnLane(entry) {
  const point = entry.lane.pointAt(entry.s);
  entry.model.position.set(point.x, 0, point.z);
  // 车的模型车头朝 +x
  entry.model.rotation.y = Math.atan2(-point.dirZ, point.dirX);
}

/**
 * 现在有人站着的斑马线
 * @param {World} world
 * @returns {object[]} 斑马线的范围
 */
function busyCrosswalks(world) {
  const people = world.player ? [...world.villagers, world.player] : world.villagers;
  return Object.values(CROSSWALKS).filter((crosswalk) => people.some((person) => inside(crosswalk, person.x, person.z, CROSSWALK_MARGIN)));
}

/**
 * 前面的斑马线上有人：还没开上斑马线的车停下来，已经开上去的接着开走
 * @param {{ lane, s }} entry 一辆车
 * @param {object[]} busy 有人的斑马线
 * @returns {number} 这辆车该开多快
 */
function yieldSpeed(entry, busy) {
  const point = entry.lane.pointAt(entry.s);
  const bumper = [point.x + point.dirX * BUMPER, point.z + point.dirZ * BUMPER];
  const ahead = [point.x + point.dirX * (BUMPER + LOOK_AHEAD), point.z + point.dirZ * (BUMPER + LOOK_AHEAD)];

  for (const crosswalk of busy) {
    const approaching = inside(crosswalk, ...ahead, 0) && !inside(crosswalk, ...bumper, 0);
    if (approaching) {
      return 0;
    }
  }
  return SPEED;
}

/**
 * 跟车：前车离得太近就跟着它减速
 * @param {{ lane, s }} entry 一辆车
 * @param {object[]} cars 所有车
 * @returns {number} 这辆车最多能开多快
 */
function followSpeed(entry, cars) {
  let limit = SPEED;
  for (const other of cars) {
    if (other === entry || other.lane !== entry.lane) {
      continue;
    }

    const gap = (other.s - entry.s + entry.lane.length) % entry.lane.length;
    if (gap > 0 && gap < FOLLOW_GAP) {
      limit = Math.min(limit, other.speed * 0.9);
    }
  }
  return limit;
}

/**
 * (x, z) 在不在矩形里
 * @param {{ minX, maxX, minZ, maxZ }} box 矩形
 * @param {number} x
 * @param {number} z
 * @param {number} margin 往外放宽多少
 */
function inside(box, x, z, margin) {
  return x > box.minX - margin && x < box.maxX + margin && z > box.minZ - margin && z < box.maxZ + margin;
}
