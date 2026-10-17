// 街道：一圈马路（路面、中线、斑马线、路沿、出租车停靠位）、路灯、消防栓、公交站、司机睡觉的长椅
import { glow } from '../../fx.js';
import { lampPost, hydrant, busShelter, bench } from './models.js';
import { roundedLoop, centerRect } from './ring-road.js';
import { RING, CROSSWALKS, TAXI_BAY, LAMPS, HYDRANT, BUS_STOP, DRIVER_SEAT } from './layout.js';

const ROAD_COLOR = '#2e3241';
const LINE_COLOR = '#e8d27a';
const ZEBRA_COLOR = '#f2f2f2';
const CURB_COLOR = '#b3b7c6';
// 路面上的线贴着路面画，比路面高一点点，免得闪
const ROAD_TOP = 0.02;
const MARK_Y = 0.022;

/**
 * 搭街道
 * @param {World} world 夜都
 * @param {object} power 电力（路灯、公交站广告跟着亮）
 */
export function buildStreet(world, power) {
  const kit = world.kit;

  roadSurface(world);
  roadMarkings(world);
  roadColliders(world);
  lamps(world, power);
  busStop(world, power);

  const [hydrantX, hydrantZ] = HYDRANT;
  world.add(hydrant(kit), hydrantX, 0, hydrantZ);
  world.solidCircle(hydrantX, hydrantZ, 0.15);

  const [seatX, seatZ] = DRIVER_SEAT;
  const seat = bench(kit, { length: 1.0, depth: 0.34, back: -1 });
  world.add(seat, seatX, 0, seatZ - 0.05);
  world.solid(seat);
}

/**
 * 四条马路的范围：前后两条横贯，左右两条夹在中间
 * @returns {{ minX, maxX, minZ, maxZ }[]}
 */
function roadStrips() {
  const { outer, inner } = RING;
  return [
    { minX: outer.minX, maxX: outer.maxX, minZ: inner.maxZ, maxZ: outer.maxZ },
    { minX: outer.minX, maxX: outer.maxX, minZ: outer.minZ, maxZ: inner.minZ },
    { minX: outer.minX, maxX: inner.minX, minZ: inner.minZ, maxZ: inner.maxZ },
    { minX: inner.maxX, maxX: outer.maxX, minZ: inner.minZ, maxZ: inner.maxZ },
  ];
}

/**
 * 贴着地画一块不投影的薄片（路面、标线）
 * @param {World} world
 * @param {{ minX, maxX, minZ, maxZ }} box 范围
 * @param {string} color 颜色
 * @param {number} y 高度
 * @param {number} thickness 厚度
 */
function flat(world, box, color, y, thickness = 0.012) {
  const mesh = world.kit.box(box.maxX - box.minX, thickness, box.maxZ - box.minZ, color, 0);
  mesh.castShadow = false;
  world.add(mesh, (box.minX + box.maxX) / 2, y, (box.minZ + box.maxZ) / 2);
  return mesh;
}

/**
 * 路面和两圈路沿
 * @param {World} world
 */
function roadSurface(world) {
  for (const strip of roadStrips()) {
    flat(world, strip, ROAD_COLOR, ROAD_TOP / 2, ROAD_TOP);
  }

  // 路沿：沿着外圈和内圈各围一圈
  const curb = 0.05;
  for (const ring of [RING.outer, RING.inner]) {
    const edges = [
      { minX: ring.minX, maxX: ring.maxX, minZ: ring.minZ - curb, maxZ: ring.minZ + curb },
      { minX: ring.minX, maxX: ring.maxX, minZ: ring.maxZ - curb, maxZ: ring.maxZ + curb },
      { minX: ring.minX - curb, maxX: ring.minX + curb, minZ: ring.minZ, maxZ: ring.maxZ },
      { minX: ring.maxX - curb, maxX: ring.maxX + curb, minZ: ring.minZ, maxZ: ring.maxZ },
    ];
    for (const edge of edges) {
      flat(world, edge, CURB_COLOR, 0.035, 0.07);
    }
  }
}

/**
 * 中间的黄色虚线（斑马线那几段空着）、斑马线、出租车停靠位的黄框
 * @param {World} world
 */
function roadMarkings(world) {
  const centerLine = roundedLoop(centerRect(), 1.0, 1);
  const dash = 0.5;
  for (let s = 0; s < centerLine.length; s += 1) {
    const point = centerLine.pointAt(s + dash / 2);
    const onCrosswalk = Object.values(CROSSWALKS).some((crosswalk) => near(crosswalk, point.x, point.z, 0.3));
    if (onCrosswalk) {
      continue;
    }

    const mark = world.kit.box(dash, 0.012, 0.06, LINE_COLOR, 0);
    mark.castShadow = false;
    world.add(mark, point.x, MARK_Y, point.z, Math.atan2(-point.dirZ, point.dirX));
  }

  for (const crosswalk of Object.values(CROSSWALKS)) {
    zebra(world, crosswalk);
  }

  // 出租车停靠位：路面上的黄框
  const [bayX, bayZ] = TAXI_BAY;
  const bay = [
    [0, -0.36, 1.3, 0.05],
    [0, 0.36, 1.3, 0.05],
    [-0.63, 0, 0.05, 0.72],
    [0.63, 0, 0.05, 0.72],
  ];
  for (const [dx, dz, width, depth] of bay) {
    const x = bayX + dx;
    const z = bayZ + dz;
    flat(world, { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 }, '#ffd23f', MARK_Y + 0.002);
  }
}

/**
 * 一条斑马线的白条
 * @description 白条和车走的方向平行；斑马线在横着的马路上，白条就竖着排
 * @param {World} world
 * @param {{ minX, maxX, minZ, maxZ }} crosswalk 斑马线范围
 */
function zebra(world, crosswalk) {
  const stripe = 0.2;
  const spacing = 0.34;
  const margin = 0.1;
  const roadAlongX = crosswalk.maxZ - crosswalk.minZ >= crosswalk.maxX - crosswalk.minX;

  if (roadAlongX) {
    for (let x = crosswalk.minX + 0.17; x + stripe / 2 <= crosswalk.maxX; x += spacing) {
      flat(world, { minX: x - stripe / 2, maxX: x + stripe / 2, minZ: crosswalk.minZ + margin, maxZ: crosswalk.maxZ - margin }, ZEBRA_COLOR, MARK_Y);
    }
  } else {
    for (let z = crosswalk.minZ + 0.17; z + stripe / 2 <= crosswalk.maxZ; z += spacing) {
      flat(world, { minX: crosswalk.minX + margin, maxX: crosswalk.maxX - margin, minZ: z - stripe / 2, maxZ: z + stripe / 2 }, ZEBRA_COLOR, MARK_Y);
    }
  }
}

/**
 * 马路只能从斑马线过：每条马路扣掉斑马线，剩下的登记成障碍
 * @param {World} world
 */
function roadColliders(world) {
  for (const strip of roadStrips()) {
    const alongX = strip.maxX - strip.minX >= strip.maxZ - strip.minZ;
    const holes = Object.values(CROSSWALKS).filter((crosswalk) => overlaps(strip, crosswalk));
    for (const piece of splitAround(strip, holes, alongX)) {
      world.colliders.push({ type: 'box', ...piece });
    }
  }
}

/**
 * 把一条马路沿着它的方向切开，挖掉斑马线
 * @param {{ minX, maxX, minZ, maxZ }} strip 一条马路
 * @param {object[]} holes 在这条马路上的斑马线
 * @param {boolean} alongX 马路是不是横着（沿 x）的
 * @returns {object[]} 剩下的几段
 */
function splitAround(strip, holes, alongX) {
  const [lowKey, highKey] = alongX ? ['minX', 'maxX'] : ['minZ', 'maxZ'];
  const sorted = [...holes].sort((a, b) => a[lowKey] - b[lowKey]);

  const pieces = [];
  let cursor = strip[lowKey];
  for (const hole of sorted) {
    if (hole[lowKey] > cursor) {
      pieces.push({ ...strip, [lowKey]: cursor, [highKey]: hole[lowKey] });
    }
    cursor = Math.max(cursor, hole[highKey]);
  }
  if (cursor < strip[highKey]) {
    pieces.push({ ...strip, [lowKey]: cursor });
  }
  return pieces;
}

/**
 * 两个矩形有没有重叠
 * @param {{ minX, maxX, minZ, maxZ }} a
 * @param {{ minX, maxX, minZ, maxZ }} b
 */
function overlaps(a, b) {
  return a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;
}

/**
 * (x, z) 在不在矩形附近
 * @param {{ minX, maxX, minZ, maxZ }} box 矩形
 * @param {number} x
 * @param {number} z
 * @param {number} margin 往外放宽多少
 */
function near(box, x, z, margin) {
  return x > box.minX - margin && x < box.maxX + margin && z > box.minZ - margin && z < box.maxZ + margin;
}

/**
 * 路灯，跟着 street 电力亮
 * @param {World} world
 * @param {object} power
 */
function lamps(world, power) {
  const list = LAMPS.map(([x, z, facing]) => {
    const lamp = lampPost(world.kit);
    world.add(lamp.group, x, world.heightAt(x, z), z, facing);
    world.solidCircle(x, z, 0.12);
    return lamp;
  });

  power.show(({ street }) => {
    for (const lamp of list) {
      lamp.bulb.material.emissiveIntensity = 1.6 * street;
      lamp.halo.material.opacity = 0.55 * street;
      lamp.light.intensity = 5 * street;
    }
  });
}

/**
 * 公交站：背板朝着马路，等车的人站在背板和马路之间
 * @param {World} world
 * @param {object} power 广告牌跟着城市电力亮
 */
function busStop(world, power) {
  const { x, z, facing } = BUS_STOP;
  const shelter = busShelter(world);
  world.add(shelter.group, x, 0, z, facing);
  world.solid(shelter.backboard);

  // 模型里“朝马路”是 -z；转过 facing 以后的方向
  const towardRoad = [-Math.sin(facing), -Math.cos(facing)];
  const adGlow = glow('#ffb84f', 1.8, 0.3);
  world.add(adGlow, x + towardRoad[0] * 0.2, 0.95, z + towardRoad[1] * 0.2);
  power.neon(shelter.ad.material, adGlow, { op: 0.3, a: 0.6 });
  world.poi(x + towardRoad[0] * 0.45, z + towardRoad[1] * 0.45, { emote: '🚌', face: facing, dur: 7 });
}
