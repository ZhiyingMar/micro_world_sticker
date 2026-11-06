// 车流：车沿着一圈马路一直绕着开
// 停电时车都堵着不动；出租车回来、司机醒了才带头开起来
// 开起来以后，有人在哪条斑马线上，快到那条斑马线的车就停下来让
import * as THREE from 'three';
import { sfx } from '../../audio.js';
import { car, createRoadLights, WHEEL_RADIUS } from './cars.js';
import { createLanes } from './ring-road.js';
import { CARS, JAM, CROSSWALKS } from './layout.js';

// 车身颜色：和楼一样偏灰一点，不是玩具的纯色；CARS 里第几辆用第几个，出租车有自己的黄色
// roof 是两厢小车漆成双色时车顶的颜色
const PAINTS = [{ color: '#3f7f8a' }, {}, { color: '#ded6c2' }, { color: '#b5485a', roof: '#ded6c2' }, { color: '#5a6aa8' }, { color: '#7f5a96', roof: '#ded6c2' }];
const SPEED = 1.4;
// 跟车：和前车隔得比这个近就跟着前车减速
const FOLLOW_GAP = 1.5;
// 车头离车中心多远；再往前看多远，看到有人的斑马线就停
const BUMPER = 0.55;
const LOOK_AHEAD = 1.0;
// 人站在斑马线边上一点也算在过马路
const CROSSWALK_MARGIN = 0.25;
const JAM_SAY = '🚗 车都堵在这儿……左边好像有条缝，能挤过去';
// 刹车、起步时车身点头：加速度换算成多少弧度，最多多少，跟得多快；开起来车身轻轻颠多少、多快（每单位路程）
const PITCH_PER_ACCEL = 0.02;
const MAX_PITCH = 0.07;
const PITCH_FOLLOW = 8;
const BOUNCE_HEIGHT = 0.004;
const BOUNCE_PER_LENGTH = 9;
// 刹车灯：减速比这个猛或者停着就算踩着刹车；亮暗跟得多快；平时、踩刹车时多亮，车尾地上的红光多亮
const BRAKE_ACCEL = -0.2;
const STOPPED_SPEED = 0.05;
const BRAKE_FOLLOW = 10;
const TAIL_GLOW = [1.2, 3.4];
const TAIL_POOL_OPACITY = [0.12, 0.4];

/**
 * 搭车流：摆好车、登记堵车的障碍，每帧让车往前开
 * @param {World} world 夜都
 * @param {object} power 电力（车流动起来时路灯跟着亮）
 * @returns {{ running: boolean, showTaxi(), start(instant) }}
 */
export function createTraffic(world, power) {
  const lanes = createLanes();
  const jam = JAM.map((box) => world.blocker(box.minX, box.maxX, box.minZ, box.maxZ, JAM_SAY));

  const addRoadLights = createRoadLights(world);
  const cars = CARS.map((spec, index) => {
    const lane = lanes[spec.lane];
    const model = car(world, { kind: spec.kind, ...PAINTS[index % PAINTS.length] });
    const { tailPool } = addRoadLights(model);
    world.root.add(model);

    // 堵着的时候都踩着刹车，车尾红红的
    const entry = { model, parts: model.userData.parts, tailPool, spec, lane, s: lane.project(...spec.jam), speed: SPEED, pitch: 0, brake: 1 };
    placeOnLane(entry);
    showBrake(entry);
    if (spec.taxi) {
      model.visible = false; // 出租车还在像素小镇
    }
    return entry;
  });
  const taxi = cars.find((entry) => entry.spec.taxi);

  let running = false;
  world.onUpdate((dt) => {
    // 这一帧时间没走就不算（后面要除以 dt 算加速度）
    if (!running || dt === 0) {
      return;
    }

    const busy = busyCrosswalks(world);
    for (const entry of cars) {
      const target = Math.min(yieldSpeed(entry, busy), followSpeed(entry, cars));
      const before = entry.speed;
      entry.speed += (target - entry.speed) * Math.min(1, dt * 4);
      entry.s = (entry.s + entry.speed * dt) % entry.lane.length;
      placeOnLane(entry);
      animateCar(entry, (entry.speed - before) / dt, dt);
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
 * 车开起来的样子：轮子跟着速度转，刹车时车头往下点、起步时往上抬，路上轻轻颠，踩刹车时车尾灯亮
 * @param {{ parts, speed: number, s: number, pitch: number, brake: number }} entry 一辆车
 * @param {number} acceleration 这一帧的加速度
 * @param {number} dt 这一帧过了多久（秒）
 */
function animateCar(entry, acceleration, dt) {
  const { body, wheels } = entry.parts;
  for (const wheel of wheels) {
    wheel.rotation.z -= (entry.speed * dt) / WHEEL_RADIUS;
  }

  const lean = THREE.MathUtils.clamp(acceleration * PITCH_PER_ACCEL, -MAX_PITCH, MAX_PITCH);
  entry.pitch += (lean - entry.pitch) * Math.min(1, dt * PITCH_FOLLOW);
  body.rotation.z = entry.pitch;
  body.position.y = Math.sin(entry.s * BOUNCE_PER_LENGTH) * BOUNCE_HEIGHT * Math.min(1, entry.speed / SPEED);

  const stopped = entry.speed < STOPPED_SPEED;
  const braking = stopped || acceleration < BRAKE_ACCEL;
  const brakeTarget = braking ? 1 : 0;
  entry.brake += (brakeTarget - entry.brake) * Math.min(1, dt * BRAKE_FOLLOW);
  showBrake(entry);
}

/**
 * 按踩刹车的程度点亮车尾灯和地上的红光
 * @param {{ parts, tailPool: THREE.Mesh, brake: number }} entry 一辆车，brake 是 0（没踩）~ 1（踩到底）
 */
function showBrake(entry) {
  entry.parts.tailLamp.emissiveIntensity = THREE.MathUtils.lerp(...TAIL_GLOW, entry.brake);
  entry.tailPool.material.opacity = THREE.MathUtils.lerp(...TAIL_POOL_OPACITY, entry.brake);
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
