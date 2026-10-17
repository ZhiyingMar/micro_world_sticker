// 车流：停电时车都堵在斑马线上；出租车回来、司机醒了才带头开起来
// 开起来以后有人在斑马线上，快到斑马线的车会停下来让
import * as THREE from 'three';
import { sfx } from '../../audio.js';
import { car } from './models.js';
import { ROAD, CROSS, LANES, CARS, JAM, TAXI_BAY } from './layout.js';

const PALETTE = ['#4fa3ff', '#ffd23f', '#ff6b8b', '#f4f1ea'];
const SPEED = 1.4;
const JAM_SAY = '🚗 车都堵在这儿……左边好像有条缝，能挤过去';

export function createTraffic(w, power) {
  const k = w.kit;
  const hw = w.size[0] / 2;
  const jam = JAM.map((b) => w.blocker(b.minX, b.maxX, b.minZ, b.maxZ, JAM_SAY));

  const cars = CARS.map((spec, i) => {
    const lane = LANES[spec.lane];
    const g = car(k, spec.taxi ? '#ffd23f' : PALETTE[i % PALETTE.length], { taxi: spec.taxi });
    g.rotation.y = lane.dir > 0 ? 0 : Math.PI;
    w.add(g, spec.jamX ?? TAXI_BAY[0], 0, lane.z);
    if (spec.taxi) g.visible = false; // 出租车还在像素小镇
    return { g, spec, lane: spec.lane, dir: lane.dir, v: SPEED };
  });
  const taxi = cars.find((c) => c.spec.taxi);

  let running = false;
  const someoneOnCrossing = () => {
    const people = w.player ? [...w.villagers, w.player] : w.villagers;
    return people.some((p) => Math.abs(p.x) < CROSS + 0.25 && p.z > ROAD.z0 - 0.3 && p.z < ROAD.z1 + 0.3);
  };

  w.onUpdate((dt) => {
    if (!running) return;
    const busy = someoneOnCrossing();
    for (const c of cars) {
      const x = c.g.position.x;
      const front = x + c.dir * 0.55;
      // 行人在斑马线上：快到斑马线的车停下来
      const beforeCross = c.dir > 0 ? front < -CROSS && front > -CROSS - 1.0 : front > CROSS && front < CROSS + 1.0;
      let target = busy && beforeCross ? 0 : SPEED;
      // 跟车距离
      for (const o of cars) {
        if (o === c || o.lane !== c.lane) continue;
        const gap = (o.g.position.x - x) * c.dir;
        if (gap > 0 && gap < 1.5) target = Math.min(target, o.v * 0.9);
      }
      c.v += (target - c.v) * Math.min(1, dt * 4);
      // 开出方块边缘时缩小消失，从另一边长出来
      let nx = x + c.dir * c.v * dt;
      if (nx > hw + 1.2) nx = -hw - 1.2;
      if (nx < -hw - 1.2) nx = hw + 1.2;
      c.g.position.x = nx;
      const s = THREE.MathUtils.clamp((hw + 0.3 - Math.abs(nx)) / 0.7, 0, 1);
      c.g.scale.setScalar(Math.max(0.001, s));
    }
  });

  return {
    get running() {
      return running;
    },
    // 出租车回到停靠位
    showTaxi() {
      taxi.g.visible = true;
    },
    // 出租车按喇叭带头，车流动起来，路灯亮了，斑马线通了
    start(instant) {
      if (running) return;
      running = true;
      if (instant) cars.forEach((c) => (c.g.position.x = c.spec.x));
      else {
        taxi.v = 0;
        setTimeout(() => sfx.horn(), 1100);
      }
      power.turnOn('street', instant);
      jam.forEach((c) => w.unblock(c));
    },
  };
}
