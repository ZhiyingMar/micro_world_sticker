// 楼的外立面贴图：一层层的窗户，每扇都不太一样
//   亮着的有暖黄、橘色、看电视的蓝光，挂着窗帘、拉着百叶窗、窗台上摆盆栽；暗着的玻璃上斜着一道反光
//   每层之间一道窗台线和楼板线，墙面是砖或者水泥板；最底下一层可以是店面、大门或者卷帘门
// 返回白天样子的 map 和只有亮着的窗户的 emissiveMap，电力系统在亮灯 / 停电两套之间切换
import { canvasTexture, rng } from '../../kit.js';
import { shade, speckle, bricks } from './paint.js';

// 一扇窗（一格）画多少像素：拉近也看得出窗帘和百叶
const CELL = 48;
// 窗户在一格里占多大（按格子的比例）：左右留墙，上面留楼板、下面留窗台
const WINDOW_LEFT = 0.2;
const WINDOW_WIDTH = 0.6;
const WINDOW_TOP = 0.2;
const WINDOW_HEIGHT = 0.56;
// 亮着的窗户里是什么：几种灯色、几种窗帘色
const LAMP_COLORS = ['#ffd98a', '#ffe7b0', '#ffc27a', '#ffb070', '#bfe0ff'];
const CURTAIN_COLORS = ['#e86a6a', '#6aa8e8', '#f2c14e', '#9a7be0', '#5fc28f', '#f29bc0'];
// 每扇亮着的窗户里挂什么，各占几成
const INTERIORS = [
  { kind: 'curtains', weight: 0.35 },
  { kind: 'blinds', weight: 0.2 },
  { kind: 'plant', weight: 0.15 },
  { kind: 'lamp', weight: 0.3 },
];

/**
 * 画一面墙的窗户
 * @param {number} columns 横着几扇
 * @param {number} rows 竖着几层
 * @param {object} look
 * @param {string} look.wall 墙的颜色
 * @param {string} look.frame 窗框颜色
 * @param {string} look.dark 暗着的玻璃颜色
 * @param {string} look.lit 主要的灯色（别的灯色偶尔混进来）
 * @param {number} look.ratio 多少窗户亮着（0 停电）
 * @param {number} look.seed 随机种子：同一个种子亮灯、停电两套的窗户一模一样，只是灯开没开
 * @param {'panel' | 'brick'} [look.pattern] 墙面：水泥板还是砖
 * @param {'windows' | 'lobby' | 'door' | 'shutter'} [look.groundFloor] 最底下一层：普通窗户、玻璃大堂、一扇门、卷帘门加小门
 * @returns {{ map: THREE.CanvasTexture, emissive: THREE.CanvasTexture }}
 */
export function windowFacade(columns, rows, look) {
  const plan = planWindows(columns, rows, look);
  const width = columns * CELL;
  const height = rows * CELL;
  return {
    map: canvasTexture(width, height, (context) => paintFacade(context, plan, look, false)),
    emissive: canvasTexture(width, height, (context) => paintFacade(context, plan, look, true)),
  };
}

/**
 * 先定好每扇窗亮不亮、什么颜色、里面挂什么；白天和发光两张图照同一份画
 * @param {number} columns
 * @param {number} rows
 * @param {object} look
 * @returns {{ columns: number, rows: number, windows: object[] }}
 */
function planWindows(columns, rows, look) {
  const random = rng(look.seed);
  const windows = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      // 随机数每扇都取同样多次：亮灯比例变了（停电），每扇窗的样子不变
      const lightRoll = random();
      const colorRoll = random();
      const interiorRoll = random();
      const curtainRoll = random();
      const lampColor = colorRoll < 0.6 ? look.lit : LAMP_COLORS[Math.floor(colorRoll * LAMP_COLORS.length)];
      windows.push({
        column,
        row,
        on: lightRoll < look.ratio,
        color: lampColor,
        interior: pickInterior(interiorRoll),
        curtain: CURTAIN_COLORS[Math.floor(curtainRoll * CURTAIN_COLORS.length)],
      });
    }
  }
  return { columns, rows, windows };
}

/**
 * 按比例挑一种窗户里的样子
 * @param {number} roll 0 ~ 1 的随机数
 * @returns {string}
 */
function pickInterior(roll) {
  let total = 0;
  for (const interior of INTERIORS) {
    total += interior.weight;
    if (roll < total) {
      return interior.kind;
    }
  }
  return INTERIORS[INTERIORS.length - 1].kind;
}

/**
 * 画整面墙
 * @param {CanvasRenderingContext2D} context
 * @param {{ columns: number, rows: number, windows: object[] }} plan
 * @param {object} look
 * @param {boolean} emissive 画的是发光图（只画亮着的地方，别处全黑）
 */
function paintFacade(context, plan, look, emissive) {
  const { width, height } = context.canvas;
  const groundFloor = look.groundFloor ?? 'windows';
  const random = rng(look.seed + 1);

  if (emissive) {
    context.fillStyle = '#000000';
    context.fillRect(0, 0, width, height);
  } else {
    paintWall(context, random, look);
    paintFloorLines(context, plan.rows);
  }

  for (const pane of plan.windows) {
    const onGroundFloor = pane.row === plan.rows - 1;
    if (onGroundFloor && groundFloor !== 'windows') {
      continue;
    }
    paintWindow(context, pane, look, emissive);
  }
  if (groundFloor !== 'windows') {
    paintGroundFloor(context, groundFloor, plan, look, emissive);
  }
}

/**
 * 墙面：砖墙一块块错缝，水泥板墙一格一道竖缝，再撒一点脏点
 * @param {CanvasRenderingContext2D} context
 * @param {() => number} random
 * @param {object} look
 */
function paintWall(context, random, look) {
  const { width, height } = context.canvas;
  if (look.pattern === 'brick') {
    const colors = [look.wall, shade(look.wall, 0.06), shade(look.wall, -0.06)];
    bricks(context, random, { brickWidth: CELL / 4, brickHeight: CELL / 8, offset: 0.5, colors, joint: shade(look.wall, -0.3), jointWidth: 1, variation: 0.1 });
  } else {
    context.fillStyle = look.wall;
    context.fillRect(0, 0, width, height);
    context.fillStyle = shade(look.wall, -0.12);
    for (let x = 0; x < width; x += CELL) {
      context.fillRect(x, 0, 1, height);
    }
  }
  speckle(context, random, Math.round((width * height) / 200), 0.8, [shade(look.wall, -0.2), shade(look.wall, 0.15)]);
}

/**
 * 每层之间：上面一道亮的楼板线，下面一线影子，看起来墙上有一圈圈凸出来的边
 * @param {CanvasRenderingContext2D} context
 * @param {number} rows
 */
function paintFloorLines(context, rows) {
  const { width } = context.canvas;
  for (let row = 1; row < rows; row++) {
    const y = row * CELL;
    context.fillStyle = 'rgba(255,255,255,0.14)';
    context.fillRect(0, y - 3, width, 3);
    context.fillStyle = 'rgba(0,0,0,0.22)';
    context.fillRect(0, y, width, 2);
  }
}

/**
 * 一扇窗：窗框、玻璃、窗台；亮着的画灯光和里面的东西，暗着的画一道反光
 * @param {CanvasRenderingContext2D} context
 * @param {{ column: number, row: number, on: boolean, color: string, interior: string, curtain: string }} pane
 * @param {object} look
 * @param {boolean} emissive
 */
function paintWindow(context, pane, look, emissive) {
  const left = pane.column * CELL + CELL * WINDOW_LEFT;
  const top = pane.row * CELL + CELL * WINDOW_TOP;
  const width = CELL * WINDOW_WIDTH;
  const height = CELL * WINDOW_HEIGHT;

  if (!emissive) {
    context.fillStyle = look.frame;
    context.fillRect(left - 2, top - 2, width + 4, height + 4);
    // 窗台：比窗户宽一点的一道亮边
    context.fillStyle = shade(look.wall, 0.25);
    context.fillRect(left - 4, top + height + 2, width + 8, 3);
  }

  if (!pane.on) {
    if (!emissive) {
      paintDarkGlass(context, left, top, width, height, look.dark);
    }
    return;
  }
  paintLitGlass(context, left, top, width, height, pane);
}

/**
 * 暗着的玻璃：深色，斜着一道淡淡的反光
 * @param {CanvasRenderingContext2D} context
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 * @param {string} color
 */
function paintDarkGlass(context, left, top, width, height, color) {
  context.fillStyle = color;
  context.fillRect(left, top, width, height);
  context.save();
  context.beginPath();
  context.rect(left, top, width, height);
  context.clip();
  context.fillStyle = 'rgba(180,200,255,0.12)';
  context.beginPath();
  context.moveTo(left + width * 0.2, top);
  context.lineTo(left + width * 0.45, top);
  context.lineTo(left + width * 0.05, top + height);
  context.lineTo(left - width * 0.2, top + height);
  context.fill();
  context.restore();
}

/**
 * 亮着的玻璃：上面亮一点的灯光，里面挂窗帘、百叶窗或者摆盆栽，中间一道窗棂
 * @param {CanvasRenderingContext2D} context
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 * @param {{ color: string, interior: string, curtain: string }} pane
 */
function paintLitGlass(context, left, top, width, height, pane) {
  const gradient = context.createLinearGradient(0, top, 0, top + height);
  gradient.addColorStop(0, shade(pane.color, 0.3));
  gradient.addColorStop(1, shade(pane.color, -0.15));
  context.fillStyle = gradient;
  context.fillRect(left, top, width, height);

  if (pane.interior === 'curtains') {
    context.fillStyle = shade(pane.curtain, -0.1);
    context.fillRect(left, top, width * 0.28, height);
    context.fillRect(left + width * 0.72, top, width * 0.28, height);
    context.fillStyle = shade(pane.curtain, -0.35);
    context.fillRect(left, top, width, 3);
  } else if (pane.interior === 'blinds') {
    context.fillStyle = 'rgba(90,60,30,0.35)';
    for (let y = top + 2; y < top + height * 0.7; y += 4) {
      context.fillRect(left, y, width, 2);
    }
  } else if (pane.interior === 'plant') {
    context.fillStyle = '#2f5d3c';
    context.beginPath();
    context.arc(left + width * 0.3, top + height - 6, 6, 0, Math.PI * 2);
    context.arc(left + width * 0.38, top + height - 10, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#8a4b2f';
    context.fillRect(left + width * 0.22, top + height - 5, 9, 5);
  } else {
    context.fillStyle = 'rgba(255,255,255,0.35)';
    context.beginPath();
    context.arc(left + width / 2, top + 5, 5, 0, Math.PI * 2);
    context.fill();
  }

  // 窗棂：一横一竖
  context.fillStyle = 'rgba(40,30,40,0.55)';
  context.fillRect(left + width / 2 - 1, top, 2, height);
  context.fillRect(left, top + height * 0.45, width, 2);
}

/**
 * 最底下一层：玻璃大堂、一扇门、卷帘门加小门
 * @param {CanvasRenderingContext2D} context
 * @param {string} kind
 * @param {{ columns: number, rows: number }} plan
 * @param {object} look
 * @param {boolean} emissive
 */
function paintGroundFloor(context, kind, plan, look, emissive) {
  const { width } = context.canvas;
  const top = (plan.rows - 1) * CELL;
  const lit = look.ratio > 0;

  if (kind === 'lobby') {
    // 一整排落地玻璃，中间两扇门
    const glass = { left: 6, top: top + 8, width: width - 12, height: CELL - 8 };
    paintShopGlass(context, glass, look, lit, emissive);
    if (!emissive) {
      context.fillStyle = look.frame;
      for (let x = glass.left; x <= glass.left + glass.width; x += CELL / 2) {
        context.fillRect(x - 1, glass.top, 3, glass.height);
      }
    }
    return;
  }

  const doorWidth = CELL * 0.5;
  const doorLeft = width / 2 - doorWidth / 2;
  if (kind === 'shutter' && !emissive) {
    paintShutter(context, 6, top + 10, doorLeft - 14, CELL - 10, look);
    paintShutter(context, doorLeft + doorWidth + 8, top + 10, width - doorLeft - doorWidth - 14, CELL - 10, look);
  }
  if (kind === 'door') {
    // 门两边各一扇亮着的小窗，里面暖暖的
    paintShopGlass(context, { left: 8, top: top + 12, width: doorLeft - 16, height: CELL * 0.5 }, look, lit, emissive);
    paintShopGlass(context, { left: doorLeft + doorWidth + 8, top: top + 12, width: width - doorLeft - doorWidth - 16, height: CELL * 0.5 }, look, lit, emissive);
  }
  if (!emissive) {
    paintDoor(context, doorLeft, top + 8, doorWidth, CELL - 8, look);
  }
}

/**
 * 店面的大玻璃：亮着是暖光，停电是深色
 * @param {CanvasRenderingContext2D} context
 * @param {{ left: number, top: number, width: number, height: number }} glass
 * @param {object} look
 * @param {boolean} lit
 * @param {boolean} emissive
 */
function paintShopGlass(context, glass, look, lit, emissive) {
  if (!lit) {
    if (!emissive) {
      paintDarkGlass(context, glass.left, glass.top, glass.width, glass.height, look.dark);
    }
    return;
  }
  const gradient = context.createLinearGradient(0, glass.top, 0, glass.top + glass.height);
  gradient.addColorStop(0, '#fff1c4');
  gradient.addColorStop(1, '#ffc98a');
  context.fillStyle = gradient;
  context.fillRect(glass.left, glass.top, glass.width, glass.height);
}

/**
 * 一扇门：深色门板，门框，一个小门把手
 * @param {CanvasRenderingContext2D} context
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 * @param {object} look
 */
function paintDoor(context, left, top, width, height, look) {
  context.fillStyle = look.frame;
  context.fillRect(left - 3, top - 3, width + 6, height + 3);
  context.fillStyle = shade(look.frame, -0.25);
  context.fillRect(left, top, width, height);
  context.fillStyle = shade(look.frame, 0.15);
  context.fillRect(left + 3, top + 3, width - 6, height * 0.4);
  context.fillStyle = '#d8c070';
  context.fillRect(left + width - 7, top + height * 0.55, 3, 3);
}

/**
 * 卷帘门：一道道横纹的铁皮
 * @param {CanvasRenderingContext2D} context
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 * @param {object} look
 */
function paintShutter(context, left, top, width, height, look) {
  context.fillStyle = '#7d8191';
  context.fillRect(left, top, width, height);
  context.fillStyle = '#5c6070';
  for (let y = top + 2; y < top + height; y += 4) {
    context.fillRect(left, y, width, 1);
  }
  context.fillStyle = look.frame;
  context.fillRect(left - 2, top - 3, width + 4, 4);
}
