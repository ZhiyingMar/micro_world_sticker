// 离小路有多远：小路是一段段折线，画地面、撒花、种树时都要问"这一点离路多远"
import * as THREE from 'three';

/**
 * 给一组折线做一个"离最近一条路多远"的函数
 * @param {number[][][]} polylines 每条路是一串点 [[x, z], ...]
 * @returns {(x: number, z: number) => number} 到最近一条路中线的距离
 */
export function pathDistanceField(polylines) {
  const segments = polylines.flatMap((points) => points.slice(1).map((end, i) => [points[i], end]));
  return (x, z) => {
    let nearest = Infinity;
    for (const [start, end] of segments) {
      nearest = Math.min(nearest, distanceToSegment(x, z, start, end));
    }
    return nearest;
  };
}

/**
 * 点到线段的距离
 * @param {number} x
 * @param {number} z
 * @param {number[]} start 线段起点 [x, z]
 * @param {number[]} end 线段终点 [x, z]
 * @returns {number}
 */
function distanceToSegment(x, z, start, end) {
  const [startX, startZ] = start;
  const dx = end[0] - startX;
  const dz = end[1] - startZ;
  const lengthSquared = dx * dx + dz * dz;

  // 投影到线段上，超出两头就取端点
  const t = THREE.MathUtils.clamp(((x - startX) * dx + (z - startZ) * dz) / lengthSquared, 0, 1);
  return Math.hypot(x - (startX + dx * t), z - (startZ + dz * t));
}
