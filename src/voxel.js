// 体素模型：一堆小方块拼成一个网格，只画露在外面的面，每个小方块有自己的颜色
// 像素风的世界（像素小镇）用它造树冠、石头、云、小鸡、地面：比几个大方块叠起来细，
// 一眼还是一格一格的像素感；颜色深浅错开、带一点杂色，看起来是手捏的，不是复制出来的
import * as THREE from 'three';
import { noiseAt } from './kit.js';

// 光从哪边来（左上前方，和像素小镇的太阳一致）：朝着光的那面小方块挑亮色，背光的挑暗色
const LIGHT_DIRECTION = new THREE.Vector3(-0.5, 1, 0.6).normalize();
// 一个颜色分成暗、本色、亮三档时，每档差多少亮度
const SHADE_STEP = 0.07;
// 朝光程度超过这个算亮面，低于负的这个算暗面
const SHADE_SPLIT = 0.35;

// 六个面：法线 n，以及面上的两个方向 u、v（u × v = n，四个角按逆时针排，正面朝外）
// 顺序是 +x、-x、+y、-y、+z、-z；体素地形画崖壁时只用四个侧面（SIDE_FACES）
export const FACES = [
  { normal: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { normal: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { normal: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
];
// 四个朝水平方向的面：+x、-x、+z、-z
export const SIDE_FACES = [FACES[0], FACES[1], FACES[4], FACES[5]];
// 朝上的面
export const TOP_FACE = FACES[2];

/**
 * 一堆四边形攒成一个网格：每个面四个顶点、自己的颜色和法线
 * @description 体素模型和体素地形都是一块块朝着六个方向的小方面，攒齐了一次做成网格
 */
export class QuadBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.indices = [];
  }

  /**
   * 加一个长方形的面
   * @param {number[]} center 面中心 [x, y, z]
   * @param {number[]} normal 朝外的方向
   * @param {number[]} u 面上的第一个方向（单位向量）
   * @param {number[]} v 面上的第二个方向（单位向量，u × v = normal）
   * @param {number} halfU 沿 u 方向的一半长
   * @param {number} halfV 沿 v 方向的一半长
   * @param {THREE.Color} color 这个面的颜色
   */
  quad(center, normal, u, v, halfU, halfV, color) {
    const first = this.positions.length / 3;
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];

    for (const [signU, signV] of corners) {
      for (let axis = 0; axis < 3; axis++) {
        this.positions.push(center[axis] + u[axis] * halfU * signU + v[axis] * halfV * signV);
      }
      this.normals.push(...normal);
      this.colors.push(color.r, color.g, color.b);
    }
    this.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }

  /**
   * 攒好的面做成几何体
   * @returns {THREE.BufferGeometry}
   */
  geometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/**
 * 一个体素模型：按整数格子记着哪些小方块是实的、什么颜色
 * @description 格子 (0, 0, 0) 的底面中心在原点：y 从 0 往上长，x、z 以原点为中心，摆到地上不用再挪
 */
export class VoxelShape {
  /**
   * @param {number} size 一个小方块多大（世界单位）
   */
  constructor(size) {
    this.size = size;
    this.cells = new Map();
  }

  /**
   * 格子的名字
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {string}
   */
  static key(x, y, z) {
    return `${x},${y},${z}`;
  }

  /**
   * 放一个小方块（已经有的就换颜色）
   * @param {number} x 格子坐标（整数）
   * @param {number} y
   * @param {number} z
   * @param {THREE.Color | string} color
   */
  set(x, y, z, color) {
    const value = color instanceof THREE.Color ? color : new THREE.Color(color);
    this.cells.set(VoxelShape.key(x, y, z), { x, y, z, color: value });
  }

  /**
   * 这一格有没有小方块
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean}
   */
  has(x, y, z) {
    return this.cells.has(VoxelShape.key(x, y, z));
  }

  /**
   * 拿掉一个小方块
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  remove(x, y, z) {
    this.cells.delete(VoxelShape.key(x, y, z));
  }

  /**
   * 填一个实心长方体
   * @param {number[]} from 起点格子 [x, y, z]（含）
   * @param {number[]} to 终点格子 [x, y, z]（含）
   * @param {(x: number, y: number, z: number) => THREE.Color | string | null} paint 每格什么颜色，返回 null 就空着
   */
  fillBox(from, to, paint) {
    for (let x = from[0]; x <= to[0]; x++) {
      for (let y = from[1]; y <= to[1]; y++) {
        this.fillRow(x, y, from[2], to[2], paint);
      }
    }
  }

  /**
   * 沿 z 填一排（fillBox 的最里面一层）
   * @param {number} x
   * @param {number} y
   * @param {number} fromZ
   * @param {number} toZ
   * @param {Function} paint
   */
  fillRow(x, y, fromZ, toZ, paint) {
    for (let z = fromZ; z <= toZ; z++) {
      const color = paint(x, y, z);
      if (color) {
        this.set(x, y, z, color);
      }
    }
  }

  /**
   * 填一团疙疙瘩瘩的椭球：树冠、灌木、石头、云都是它
   * @description 表面按位置推进推出一点，不是光溜溜的球；颜色按朝光程度分暗、本色、亮三档
   * @param {object} options
   * @param {number[]} options.center 中心格子 [x, y, z]（可以带小数）
   * @param {number[]} options.radius 三个方向的半径（格子数）
   * @param {string[]} options.shades [暗, 本色, 亮]
   * @param {number} options.bumpiness 表面起伏多大（占半径的比例）
   * @param {number} options.seed 起伏和杂色的样子
   * @param {number} [options.speckle] 多少比例的小方块换成邻近的一档颜色（叶子上的光斑）
   */
  fillBlob({ center, radius, shades, bumpiness, seed, speckle = 0 }) {
    const [centerX, centerY, centerZ] = center;
    const [radiusX, radiusY, radiusZ] = radius;
    const colors = shades.map((shade) => new THREE.Color(shade));
    const offset = new THREE.Vector3();

    for (let x = Math.floor(centerX - radiusX - 1); x <= Math.ceil(centerX + radiusX + 1); x++) {
      for (let y = Math.floor(centerY - radiusY - 1); y <= Math.ceil(centerY + radiusY + 1); y++) {
        for (let z = Math.floor(centerZ - radiusZ - 1); z <= Math.ceil(centerZ + radiusZ + 1); z++) {
          offset.set((x - centerX) / radiusX, (y - centerY) / radiusY, (z - centerZ) / radiusZ);
          const reach = 1 + (noiseAt(x, y, z, seed) - 0.5) * 2 * bumpiness;
          if (offset.length() > reach) {
            continue;
          }
          this.set(x, y, z, pickShade(colors, offset, noiseAt(z, x, y, seed + 1), speckle));
        }
      }
    }
  }

  /**
   * 做成网格：只画旁边空着的那些面
   * @param {Kit} kit 当前世界的造型工具（用它的材质，跟着世界风格）
   * @returns {THREE.Mesh}
   */
  mesh(kit) {
    const builder = new QuadBuilder();
    const half = this.size / 2;

    for (const { x, y, z, color } of this.cells.values()) {
      const center = [x * this.size, y * this.size + half, z * this.size];
      for (const face of FACES) {
        const [nx, ny, nz] = face.normal;
        if (this.has(x + nx, y + ny, z + nz)) {
          continue;
        }
        const faceCenter = [center[0] + nx * half, center[1] + ny * half, center[2] + nz * half];
        builder.quad(faceCenter, face.normal, face.u, face.v, half, half, color);
      }
    }
    return kit.mesh(builder.geometry(), '#ffffff', { vertexColors: true });
  }
}

/**
 * 按朝光程度挑一档颜色，偶尔换成邻近一档（光斑、阴影里的杂色）
 * @param {THREE.Color[]} colors [暗, 本色, 亮]
 * @param {THREE.Vector3} offset 这一格离团中心的方向（没归一化也行）
 * @param {number} chance 0 到 1 的随机数，决定要不要换档
 * @param {number} speckle 换档的比例
 * @returns {THREE.Color}
 */
function pickShade(colors, offset, chance, speckle) {
  const facing = offset.lengthSq() > 0 ? offset.clone().normalize().dot(LIGHT_DIRECTION) : 1;
  let index = 1;
  if (facing > SHADE_SPLIT) {
    index = 2;
  } else if (facing < -SHADE_SPLIT) {
    index = 0;
  }

  if (chance < speckle) {
    const brighter = chance < speckle / 2;
    index = THREE.MathUtils.clamp(index + (brighter ? 1 : -1), 0, colors.length - 1);
  }
  return colors[index];
}

/**
 * 一种颜色的三档：暗、本色、亮
 * @description 像素画的体积感靠颜色分档，不靠平滑的光照；三档错开一点色相，暗面偏冷、亮面偏暖
 * @param {string} color 本色
 * @param {number} [step] 每档差多少亮度
 * @returns {string[]} [暗, 本色, 亮]
 */
export function shadesOf(color, step = SHADE_STEP) {
  const base = new THREE.Color(color);
  const dark = base.clone().offsetHSL(0.01, 0.04, -step);
  const light = base.clone().offsetHSL(-0.01, -0.02, step);
  return [`#${dark.getHexString()}`, color, `#${light.getHexString()}`];
}

/**
 * 给一个颜色按位置加一点杂色：同一个位置每次一样
 * @description 一整片同一个颜色的小方块看着像塑料；每块深浅差一点点，才像一块块手摆上去的
 * @param {THREE.Color} color 原来的颜色（会被改掉）
 * @param {number[]} position 位置 [x, y, z]
 * @param {number} amount 最多差多少亮度
 * @param {number} seed
 * @returns {THREE.Color}
 */
export function jitter(color, [x, y, z], amount, seed) {
  return color.offsetHSL(0, 0, (noiseAt(x, y, z, seed) - 0.5) * 2 * amount);
}
