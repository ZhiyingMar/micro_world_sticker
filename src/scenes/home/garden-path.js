// 花园里那条小路在哪：把 layout 里几个点连成一条顺的曲线，算一点离路多远
// 地面画土路、摆踏脚石、路边种花都用它，路只在这一处定义
import * as THREE from 'three';
import { GARDEN_PATH } from './layout.js';

// 土路多宽（一半）
export const PATH_HALF_WIDTH = 0.3;
// 曲线切成多少段来算距离：段越多越准
const PATH_SEGMENTS = 48;

const curve = new THREE.CatmullRomCurve3(GARDEN_PATH.map(([x, z]) => new THREE.Vector3(x, 0, z)));
const samples = curve.getSpacedPoints(PATH_SEGMENTS);

/**
 * 路上等距的一串点（俯视），从院门走到台阶
 * @param {number} count 要几个点
 * @returns {THREE.Vector3[]} 每个点的 x、z（y 是 0）
 */
export function pathPoints(count) {
  return curve.getSpacedPoints(count - 1);
}

/**
 * 路在这一点往哪边走（俯视的单位向量）
 * @param {number} along 0 是院门，1 是台阶
 * @returns {THREE.Vector3}
 */
export function pathDirection(along) {
  return curve.getTangentAt(along).setY(0).normalize();
}

/**
 * 一点离路的中线多远
 * @param {number} x
 * @param {number} z
 * @returns {number}
 */
export function distanceToPath(x, z) {
  let nearest = Infinity;
  for (let i = 0; i < samples.length - 1; i++) {
    nearest = Math.min(nearest, distanceToSegment(x, z, samples[i], samples[i + 1]));
  }
  return nearest;
}

/**
 * 一点离一段线段多远（俯视）
 * @param {number} x
 * @param {number} z
 * @param {THREE.Vector3} start
 * @param {THREE.Vector3} end
 * @returns {number}
 */
function distanceToSegment(x, z, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  // 投影到线段上走到哪儿（0 是起点，1 是终点）
  const along = lengthSquared > 0 ? THREE.MathUtils.clamp(((x - start.x) * dx + (z - start.z) * dz) / lengthSquared, 0, 1) : 0;
  return Math.hypot(x - (start.x + dx * along), z - (start.z + dz * along));
}
