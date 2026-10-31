// 霓虹：招牌、灯管、地上的光斑。只负责造出来，挂在哪、跟哪一路电力亮由用它的地方决定
//   招牌是一块自己发光的板（不受光照，停电时电力系统把颜色压暗）；外面一圈光晕是 fx.js 的 glow
//   光斑是平铺在地上的一片柔光，叠加在地面上，像灯光照在地上、映在湿地面上
import * as THREE from 'three';
import { at, canvasTexture } from '../../kit.js';
import { softDotTexture } from '../../fx.js';

// 光斑离地多高：要盖过马路面和路面标线，又不能看得出浮着
const POOL_LIFT = 0.036;
// 霓虹灯管的线有多粗、外面那圈光晕晕开多少（像素）
const TUBE_WIDTH = 7;
const TUBE_CORE = 2.5;
const TUBE_BLUR = 18;

/**
 * 地上的一片光斑：中间亮、往外淡，叠加在地面上
 * @param {string} color 光的颜色
 * @param {number} size 直径（世界单位）
 * @returns {THREE.Mesh} 平躺着，原点在地面上（已经抬高了一点点）；一开始全暗，电力来了再调亮
 */
export function lightPool(color, size) {
  const geometry = new THREE.PlaneGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ map: softDotTexture(), color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const pool = new THREE.Mesh(geometry, material);
  pool.position.y = POOL_LIFT;
  pool.renderOrder = 1;
  return pool;
}

/**
 * 把一片光斑放到地上 (x, z)
 * @param {World} world
 * @param {string} color
 * @param {number} size 直径
 * @param {number} x
 * @param {number} z
 * @returns {THREE.Mesh}
 */
export function placeLightPool(world, color, size, x, z) {
  const pool = lightPool(color, size);
  world.add(pool, x, world.heightAt(x, z) + POOL_LIFT, z);
  return pool;
}

/**
 * 一块自己发光的招牌板
 * @param {THREE.Texture} texture 招牌上画的东西
 * @param {number} width
 * @param {number} height
 * @returns {THREE.Mesh} 正面朝 +z；材质是它自己的，电力系统、变半透明都单独调它
 */
export function signBoard(texture, width, height) {
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

/**
 * 一根霓虹灯管：细长的一条，自己发光
 * @param {number} length 多长（沿 x）
 * @param {string} color
 * @returns {THREE.Mesh} 材质是它自己的，电力系统把它压暗 / 调亮
 */
export function neonTube(length, color) {
  const material = new THREE.MeshBasicMaterial({ color });
  return new THREE.Mesh(new THREE.CapsuleGeometry(0.018, length, 4, 8).rotateZ(Math.PI / 2), material);
}

/**
 * 画一张霓虹图案：线条外面一圈光晕，中间一道白芯，像真的灯管
 * @param {World} world 登记贴图
 * @param {number} width 像素
 * @param {number} height 像素
 * @param {string} backing 底板颜色（可以是透明）
 * @param {(context: CanvasRenderingContext2D, tube: (color: string, path: () => void) => void) => void} draw
 *   画什么：用 tube(颜色, 画路径) 画一根灯管
 * @returns {THREE.CanvasTexture}
 */
export function neonDrawing(world, width, height, backing, draw) {
  return world.texture(
    canvasTexture(width, height, (context) => {
      context.fillStyle = backing;
      context.fillRect(0, 0, width, height);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      const tube = (color, path) => strokeTube(context, color, path);
      draw(context, tube);
    }),
  );
}

/**
 * 画一根灯管：先画粗的彩色带光晕，再画细白芯
 * @param {CanvasRenderingContext2D} context
 * @param {string} color
 * @param {() => void} path 画路径（beginPath 之后、stroke 之前的那些）
 */
function strokeTube(context, color, path) {
  context.save();
  context.shadowColor = color;
  context.shadowBlur = TUBE_BLUR;
  context.strokeStyle = color;
  context.lineWidth = TUBE_WIDTH;
  context.beginPath();
  path();
  context.stroke();
  context.shadowBlur = 0;
  context.strokeStyle = 'rgba(255,255,255,0.85)';
  context.lineWidth = TUBE_CORE;
  context.beginPath();
  path();
  context.stroke();
  context.restore();
}

/**
 * 霓虹猫脸：两只尖耳朵、眯眯眼、粉鼻子和胡子，挂在会玩俄罗斯方块的“夜猫”大楼楼顶
 * @param {World} world
 * @returns {THREE.CanvasTexture} 256 × 200
 */
export function catFaceSign(world) {
  const cyan = '#4ff0ff';
  const pink = '#ff6fb0';
  return neonDrawing(world, 256, 200, 'rgba(0,0,0,0)', (context, tube) => {
    tube(cyan, () => {
      context.moveTo(52, 92);
      context.lineTo(62, 26);
      context.lineTo(102, 62);
      context.quadraticCurveTo(128, 54, 154, 62);
      context.lineTo(194, 26);
      context.lineTo(204, 92);
      context.quadraticCurveTo(212, 176, 128, 178);
      context.quadraticCurveTo(44, 176, 52, 92);
    });
    tube(cyan, () => {
      context.moveTo(84, 108);
      context.quadraticCurveTo(98, 96, 112, 108);
      context.moveTo(144, 108);
      context.quadraticCurveTo(158, 96, 172, 108);
    });
    tube(pink, () => {
      context.moveTo(120, 128);
      context.lineTo(136, 128);
      context.lineTo(128, 138);
      context.closePath();
    });
    tube(pink, () => {
      for (const side of [-1, 1]) {
        context.moveTo(128 + side * 30, 136);
        context.lineTo(128 + side * 70, 128);
        context.moveTo(128 + side * 30, 144);
        context.lineTo(128 + side * 70, 150);
      }
    });
  });
}

/**
 * 鸡尾酒杯：BAR 侧面伸出来的小招牌，杯子里插着一颗橄榄
 * @param {World} world
 * @returns {THREE.CanvasTexture} 128 × 192
 */
export function cocktailSign(world) {
  const pink = '#ff5fa2';
  const cyan = '#4ff0ff';
  const yellow = '#ffe066';
  return neonDrawing(world, 128, 192, 'rgba(24,10,34,0.9)', (context, tube) => {
    tube(pink, () => {
      context.moveTo(24, 40);
      context.lineTo(104, 40);
      context.lineTo(64, 96);
      context.closePath();
      context.moveTo(64, 96);
      context.lineTo(64, 146);
      context.moveTo(40, 150);
      context.lineTo(88, 150);
    });
    tube(cyan, () => {
      context.moveTo(52, 22);
      context.lineTo(74, 70);
    });
    tube(yellow, () => {
      context.arc(72, 60, 7, 0, Math.PI * 2);
    });
    context.strokeStyle = pink;
    context.lineWidth = 3;
    context.strokeRect(6, 6, 116, 180);
  });
}

/**
 * 一个霓虹招牌：板子贴在 (x, y, z)，前面一团光晕
 * @param {World} world
 * @param {THREE.Object3D} parent 挂在谁身上（楼会变半透明，招牌跟着一起淡）
 * @param {object} sign
 * @param {THREE.Texture} sign.texture
 * @param {number[]} sign.size [宽, 高]
 * @param {number[]} sign.position [x, y, z]，parent 自己的坐标
 * @param {number} [sign.facing] 朝向（弧度，0 朝 +z）
 * @param {THREE.Sprite} halo 光晕（fx.js 的 glow），摆在世界里
 * @param {number[]} haloPosition 光晕在世界里的位置 [x, y, z]
 * @returns {THREE.Mesh} 招牌板
 */
export function hangSign(world, parent, { texture, size, position, facing = 0 }, halo, haloPosition) {
  const board = signBoard(texture, ...size);
  parent.add(at(board, ...position, facing));
  world.add(halo, ...haloPosition);
  return board;
}
