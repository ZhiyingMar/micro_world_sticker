// 一圈马路的几何：车道是圆角矩形，车按“沿着车道走了多远”（s）来定位
// 马路怎么画、车怎么开、斑马线在哪，都从这里算
import { RING, LANE_OFFSET, CORNER_RADIUS } from './layout.js';

/**
 * 马路中心线围成的矩形（外圈和内圈正中间）
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number }}
 */
export function centerRect() {
  return {
    minX: (RING.outer.minX + RING.inner.minX) / 2,
    maxX: (RING.outer.maxX + RING.inner.maxX) / 2,
    minZ: (RING.outer.minZ + RING.inner.minZ) / 2,
    maxZ: (RING.outer.maxZ + RING.inner.maxZ) / 2,
  };
}

/**
 * 两条车道：内道沿前马路往 +x 开，外道反过来
 * @returns {{ inner: Loop, outer: Loop }}
 */
export function createLanes() {
  const center = centerRect();
  const shrink = (rect, amount) => ({
    minX: rect.minX + amount,
    maxX: rect.maxX - amount,
    minZ: rect.minZ + amount,
    maxZ: rect.maxZ - amount,
  });

  return {
    inner: roundedLoop(shrink(center, LANE_OFFSET), CORNER_RADIUS - LANE_OFFSET, 1),
    outer: roundedLoop(shrink(center, -LANE_OFFSET), CORNER_RADIUS + LANE_OFFSET, -1),
  };
}

/**
 * 一条圆角矩形的环线
 * @description 拆成四段直路、四段四分之一圆弧，按顺序首尾相接：前边往 +x、右边往 -z、后边往 -x、左边往 +z
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} rect 环线围成的矩形
 * @param {number} radius 拐角半径
 * @param {number} direction 1 按上面的顺序走，-1 反着走
 * @returns {Loop} { length, pointAt(s), project(x, z) }
 */
export function roundedLoop(rect, radius, direction) {
  const { minX, maxX, minZ, maxZ } = rect;
  const straightX = maxX - minX - 2 * radius;
  const straightZ = maxZ - minZ - 2 * radius;
  const quarter = -Math.PI / 2;

  const segments = [
    straight([minX + radius, maxZ], [1, 0], straightX),
    arc([maxX - radius, maxZ - radius], radius, Math.PI / 2, quarter),
    straight([maxX, maxZ - radius], [0, -1], straightZ),
    arc([maxX - radius, minZ + radius], radius, 0, quarter),
    straight([maxX - radius, minZ], [-1, 0], straightX),
    arc([minX + radius, minZ + radius], radius, -Math.PI / 2, quarter),
    straight([minX, minZ + radius], [0, 1], straightZ),
    arc([minX + radius, maxZ - radius], radius, -Math.PI, quarter),
  ];
  const length = segments.reduce((sum, segment) => sum + segment.length, 0);

  /**
   * 环线上走了 s 的地方
   * @param {number} s 从起点沿行驶方向走过的距离，超过一圈会自动绕回来
   * @returns {{ x: number, z: number, dirX: number, dirZ: number }} 位置和行驶方向（单位向量）
   */
  const pointAt = (s) => {
    let along = ((s % length) + length) % length;
    if (direction < 0) {
      along = length - along;
    }

    for (const segment of segments) {
      if (along <= segment.length) {
        const point = segment.at(along);
        return { x: point.x, z: point.z, dirX: point.dirX * direction, dirZ: point.dirZ * direction };
      }
      along -= segment.length;
    }
    return pointAt(0);
  };

  /**
   * 离 (x, z) 最近的那一点的 s：用来把布局里写的坐标吸到车道上
   * @param {number} x
   * @param {number} z
   * @returns {number}
   */
  const project = (x, z) => {
    const step = 0.05;
    let best = 0;
    let bestDistance = Infinity;
    for (let s = 0; s < length; s += step) {
      const point = pointAt(s);
      const distance = (point.x - x) ** 2 + (point.z - z) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = s;
      }
    }
    return best;
  };

  return { length, pointAt, project };
}

/**
 * 一段直路
 * @param {number[]} start 起点 [x, z]
 * @param {number[]} dir 方向 [x, z]，单位向量
 * @param {number} length 长度
 */
function straight(start, dir, length) {
  return {
    length,
    at: (t) => ({ x: start[0] + dir[0] * t, z: start[1] + dir[1] * t, dirX: dir[0], dirZ: dir[1] }),
  };
}

/**
 * 一段圆弧
 * @param {number[]} center 圆心 [x, z]
 * @param {number} radius 半径
 * @param {number} startAngle 起点的角度（弧度，0 朝 +x，π/2 朝 +z）
 * @param {number} sweep 转过的角度，负数是顺着 +x → -z 的方向转
 */
function arc(center, radius, startAngle, sweep) {
  const turn = Math.sign(sweep);
  return {
    length: Math.abs(sweep) * radius,
    at: (t) => {
      const angle = startAngle + (turn * t) / radius;
      return {
        x: center[0] + Math.cos(angle) * radius,
        z: center[1] + Math.sin(angle) * radius,
        dirX: -Math.sin(angle) * turn,
        dirZ: Math.cos(angle) * turn,
      };
    },
  };
}
