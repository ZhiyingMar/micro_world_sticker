// 像素小镇的土路和广场：画在地上，撒花、种树、小鸡转悠时要避开
import { pathDistanceField } from '../../path-distance.js';
import { PATHS, PLAZA } from './layout.js';

// 路有多宽（一半）
export const PATH_HALF_WIDTH = 0.3;

/**
 * 这一点离最近的一条路的中线有多远
 * @type {(x: number, z: number) => number}
 */
export const distanceToPath = pathDistanceField(PATHS);

/**
 * 这一点在不在铺石板的广场上（广场边往外多算 margin）
 * @param {number} x
 * @param {number} z
 * @param {number} [margin] 往外多算多少
 * @returns {boolean}
 */
export function onPlaza(x, z, margin = 0) {
  return Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.radius + margin;
}

/**
 * 这里是不是空地：不在路上，也不在广场上
 * @description 花草、树、石头都只长在空地上
 * @param {number} x
 * @param {number} z
 * @param {number} clearance 离路边、广场边至少多远
 * @returns {boolean}
 */
export function offPaths(x, z, clearance) {
  return distanceToPath(x, z) > PATH_HALF_WIDTH + clearance && !onPlaza(x, z, clearance);
}
