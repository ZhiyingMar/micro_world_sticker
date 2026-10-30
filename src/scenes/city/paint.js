// 在画布上画贴图用的小工具：变深变浅、撒点、裂缝、砌砖。地面、墙面、楼的外立面都用
// 画到贴图边上的东西会在对边补一份，贴图铺开以后接缝处看不出来
import * as THREE from 'three';

/**
 * 一个颜色深一点或浅一点
 * @param {string} hex 本色
 * @param {number} amount 正数变亮、负数变暗，-1 ~ 1
 * @returns {string} CSS 颜色
 */
export function shade(hex, amount) {
  const color = new THREE.Color(hex);
  if (amount >= 0) {
    color.lerp(new THREE.Color('#ffffff'), amount);
  } else {
    color.lerp(new THREE.Color('#000000'), -amount);
  }
  return `#${color.getHexString()}`;
}

/**
 * 在画布上撒一把小点（石子、污渍、草叶）
 * @description 画到贴图边上的点在对边再画一次，铺开以后接缝处也有点，看不出边
 * @param {CanvasRenderingContext2D} context
 * @param {() => number} random 随机数
 * @param {number} count 撒多少个
 * @param {number} size 多大（像素）
 * @param {string[]} colors 从这几个颜色里挑
 */
export function speckle(context, random, count, size, colors) {
  const { width, height } = context.canvas;
  for (let i = 0; i < count; i++) {
    const x = random() * width;
    const y = random() * height;
    const radius = size * (0.5 + random());
    context.fillStyle = colors[Math.floor(random() * colors.length)];
    for (const [dx, dy] of wrapCopies(x, y, radius, width, height)) {
      context.beginPath();
      context.arc(x + dx, y + dy, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
}

/**
 * 一个点贴着边的时候，要在对边补画的那几份的偏移
 * @param {number} x
 * @param {number} y
 * @param {number} reach 这个点往外伸多远
 * @param {number} width 画布宽
 * @param {number} height 画布高
 * @returns {number[][]} [dx, dy] 列表，第一份总是 [0, 0]
 */
export function wrapCopies(x, y, reach, width, height) {
  const xs = [0];
  const ys = [0];
  if (x < reach) {
    xs.push(width);
  }
  if (x > width - reach) {
    xs.push(-width);
  }
  if (y < reach) {
    ys.push(height);
  }
  if (y > height - reach) {
    ys.push(-height);
  }
  return xs.flatMap((dx) => ys.map((dy) => [dx, dy]));
}

/**
 * 一道弯弯曲曲的细裂缝
 * @param {CanvasRenderingContext2D} context
 * @param {() => number} random
 * @param {number} x 起点
 * @param {number} y 起点
 * @param {number} length 多长（像素）
 * @param {string} color
 */
export function crack(context, random, x, y, length, color) {
  context.strokeStyle = color;
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(x, y);
  let angle = random() * Math.PI * 2;
  let cursorX = x;
  let cursorY = y;
  const segments = 6;
  for (let i = 0; i < segments; i++) {
    angle += (random() - 0.5) * 1.2;
    cursorX += Math.cos(angle) * (length / segments);
    cursorY += Math.sin(angle) * (length / segments);
    context.lineTo(cursorX, cursorY);
  }
  context.stroke();
}

/**
 * 铺砖：一行行方砖，每块深浅不一，砖缝暗一点，砖面上方亮一线、下方暗一线，看起来是一块块凸起来的
 * @param {CanvasRenderingContext2D} context
 * @param {() => number} random
 * @param {object} pattern
 * @param {number} pattern.brickWidth 砖多宽（像素）
 * @param {number} pattern.brickHeight 砖多高（像素）
 * @param {number} pattern.offset 每隔一行错开多少（0 不错开，0.5 错开半块）
 * @param {string[]} pattern.colors 砖的几种颜色
 * @param {string} pattern.joint 砖缝颜色
 * @param {number} pattern.jointWidth 砖缝多宽（像素）
 * @param {number} pattern.variation 每块砖深浅差多少（0 ~ 1）
 */
export function bricks(context, random, { brickWidth, brickHeight, offset, colors, joint, jointWidth, variation }) {
  const { width, height } = context.canvas;
  context.fillStyle = joint;
  context.fillRect(0, 0, width, height);

  const rows = Math.round(height / brickHeight);
  for (let row = 0; row < rows; row++) {
    const shift = (row % 2) * offset * brickWidth;
    for (let left = -brickWidth + shift; left < width; left += brickWidth) {
      const base = colors[Math.floor(random() * colors.length)];
      const top = row * brickHeight;
      paintBrick(context, left, top, brickWidth, brickHeight, shade(base, (random() - 0.5) * variation), jointWidth);
    }
  }
}

/**
 * 画一块砖：本色，上边一线亮、下边一线暗
 * @param {CanvasRenderingContext2D} context
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 * @param {string} color
 * @param {number} jointWidth 四周留多宽的缝
 */
function paintBrick(context, left, top, width, height, color, jointWidth) {
  const half = jointWidth / 2;
  const x = left + half;
  const y = top + half;
  const innerWidth = width - jointWidth;
  const innerHeight = height - jointWidth;

  context.fillStyle = color;
  context.fillRect(x, y, innerWidth, innerHeight);
  context.fillStyle = shade(color, 0.12);
  context.fillRect(x, y, innerWidth, Math.max(1, jointWidth * 0.6));
  context.fillStyle = shade(color, -0.15);
  context.fillRect(x, y + innerHeight - Math.max(1, jointWidth * 0.6), innerWidth, Math.max(1, jointWidth * 0.6));

  // 砖画到右边外面去的那截，在左边补上（每行最后一块会伸出画布）
  const canvasWidth = context.canvas.width;
  if (x + innerWidth > canvasWidth) {
    context.fillStyle = color;
    context.fillRect(x - canvasWidth, y, innerWidth, innerHeight);
  }
}
