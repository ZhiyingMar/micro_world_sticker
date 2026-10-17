// 街道：马路、斑马线、出租车停靠位、路灯、消防栓、公交站、司机睡觉的长椅
import * as THREE from 'three';
import { glow } from '../../fx.js';
import { lampPost, hydrant, busShelter, bench } from './models.js';
import { ROAD, CROSS, TAXI_BAY, LAMPS, HYDRANT, BUS_STOP, DRIVER_SEAT } from './layout.js';

export function buildStreet(w, power) {
  road(w);
  lamps(w, power);
  const k = w.kit;
  const [hx, hz] = HYDRANT;
  w.add(hydrant(k), hx, 0, hz);
  w.solidCircle(hx, hz, 0.15);
  busStop(w, power);
  const [sx, sz] = DRIVER_SEAT;
  const seat = bench(k, { length: 1.0, depth: 0.34, back: -1 });
  w.add(seat, sx, 0, sz - 0.05);
  w.solid(seat);
}

// 路面上的东西都贴着地画，不投影
function flat(w, sx, sz, color, x, y, z) {
  const m = w.kit.box(sx, 0.012, sz, color, 0);
  m.castShadow = false;
  w.add(m, x, y, z);
}

function road(w) {
  const k = w.kit;
  const len = w.size[0];
  const hw = len / 2;
  const depth = ROAD.z1 - ROAD.z0;
  const mid = (ROAD.z0 + ROAD.z1) / 2;
  const surface = k.box(len, 0.02, depth, '#2e3241', 0);
  surface.castShadow = false;
  w.add(surface, 0, 0.01, mid);
  // 中间的黄色虚线，斑马线那段空着
  for (let x = -hw + 0.4; x < hw - 0.2; x += 1) {
    if (Math.abs(x + 0.25) < CROSS + 0.3) continue;
    flat(w, 0.5, 0.06, '#e8d27a', x + 0.25, 0.022, mid);
  }
  for (let i = 0; i < 5; i++) flat(w, 0.2, depth - 0.2, '#f2f2f2', -0.68 + i * 0.34, 0.022, mid);
  for (const z of [ROAD.z0, ROAD.z1]) {
    const curb = k.box(len, 0.07, 0.1, '#b3b7c6', 0.02);
    curb.castShadow = false;
    w.add(curb, 0, 0.035, z);
  }
  // 出租车停靠位：路面上的黄框
  const [tx, tz] = TAXI_BAY;
  for (const [dx, dz, sw, sd] of [[0, -0.36, 1.3, 0.05], [0, 0.36, 1.3, 0.05], [-0.63, 0, 0.05, 0.72], [0.63, 0, 0.05, 0.72]]) {
    flat(w, sw, sd, '#ffd23f', tx + dx, 0.024, tz + dz);
  }
  // 马路只能从斑马线过
  w.colliders.push({ type: 'box', minX: -hw, maxX: -CROSS, minZ: ROAD.z0, maxZ: ROAD.z1 });
  w.colliders.push({ type: 'box', minX: CROSS, maxX: hw, minZ: ROAD.z0, maxZ: ROAD.z1 });
}

// 路灯跟着 street 电力
function lamps(w, power) {
  const list = LAMPS.map(([x, z, ry]) => {
    const l = lampPost(w.kit);
    w.add(l.group, x, w.heightAt(x, z), z, ry);
    w.solidCircle(x, z, 0.12);
    return l;
  });
  power.show(({ street }) => {
    for (const l of list) {
      l.bulb.material.emissiveIntensity = 1.6 * street;
      l.halo.material.opacity = 0.55 * street;
      l.light.intensity = 5 * street;
    }
  });
}

function busStop(w, power) {
  const [x, z] = BUS_STOP;
  const s = busShelter(w);
  w.add(s.group, x, 0, z);
  w.solid(s.backboard);
  const adGlow = glow('#ffb84f', 1.8, 0.3);
  w.add(adGlow, x, 0.95, z - 0.2);
  power.neon(s.ad.material, adGlow, { op: 0.3, a: 0.6 });
  w.poi(x, z - 0.45, { emote: '🚌', face: 0, dur: 7 });
}
