// 森林里的土路：layout 里一段段折线，画在地面上；撒花、种树时要避开
import { PATHS } from './layout.js';

// 路有多宽（一半）
export const PATH_HALF_WIDTH = 0.27;

// 把折线拆成一段段线段，算距离时直接用
const SEGMENTS = PATHS.flatMap((path) => path.slice(1).map((end, i) => [path[i], end]));

/**
 * 这一点离最近的一条路的中线有多远
 * @param {number} x
 * @param {number} z
 * @returns {number}
 */
export function distanceToPath(x, z) {
  let nearest = Infinity;
  for (const [start, end] of SEGMENTS) {
    nearest = Math.min(nearest, distanceToSegment(x, z, start, end));
  }
  return nearest;
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
  const t = Math.max(0, Math.min(1, ((x - startX) * dx + (z - startZ) * dz) / lengthSquared));
  return Math.hypot(x - (startX + dx * t), z - (startZ + dz * t));
}
