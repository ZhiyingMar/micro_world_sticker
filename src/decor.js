// 小屋装修：工作台上能合成的壁纸、地板
// 每一款只是数据（叫什么、要几个材料、怎么画图案、配什么背景），小屋照着数据刷墙、铺地板
import { canvasTexture, rng } from './kit.js';
import { state, save, canAfford, spendMaterials } from './state.js';

// 壁纸图案一块的像素大小，墙上横着铺几块、竖着铺几块
const WALLPAPER_TILE_PX = 256;
const WALLPAPER_REPEAT = [3, 1.4];
// 地板图案一块的像素大小，地上铺几块（地板 9.6 宽，一块图大约 4 个单位）
const FLOOR_TILE_PX = 512;
const FLOOR_REPEAT = [2.4, 2.4];
// 木地板：一块图里横着几排板（一排约 0.4 宽，人高 1，看着像真的地板而不是几块大方砖）
const PLANK_ROWS = 10;
// 每块板多长（占图宽的比例，约 1.2 ~ 2.2 个单位），长短错开，接缝不排成一条线
const PLANK_LENGTH = [0.3, 0.55];
// 每块板深浅差多少（亮度倍数的范围）
const PLANK_TONE = 0.1;
// 每块板上几道木纹，木纹多深、多透明；木纹弯弯的，上下起伏多少（占一排高的比例）
const GRAIN_LINES = 4;
const GRAIN_DARKEN = 0.72;
const GRAIN_ALPHA = 0.16;
const GRAIN_WAVE = 0.12;
// 一道木纹分几段画、每段弯多少（弧度）：段数够多才顺，弯得慢才像木头不像波浪线
const GRAIN_SEGMENTS = 12;
const GRAIN_BEND = 0.6;
// 多少块板上有一个木节
const KNOT_CHANCE = 0.07;
// 缝多宽（占图宽的比例：512 像素的图是 3 像素），每排上沿一道亮边，看着板子有一点倒角
const SEAM_RATIO = 3 / 512;
const BEVEL_LIGHT = 'rgba(255,255,255,0.18)';
const PLANK_SEED = 3;
// 工作台面板上的小样，画多大（像素）
const SWATCH_PX = 96;

// ---------- 壁纸图案 ----------

/**
 * 奶油底 + 浅绿竖条 + 粉色小圆点（一开始就有的那款）
 * @param {CanvasRenderingContext2D} context 画布
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 */
function paintCreamDots(context, width, height) {
  context.fillStyle = '#fbf3df';
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#e4eedb';
  for (let x = 0; x < width; x += 64) {
    context.fillRect(x, 0, 28, height);
  }

  // 圆点一列高一列低，错开着排
  context.fillStyle = '#f2b8a8';
  for (let y = 16; y < height; y += 64) {
    for (let x = 46; x < width; x += 64) {
      const shifted = x % 128 !== 0;
      const dotY = shifted ? y + 32 : y;
      context.beginPath();
      context.arc(x, dotY, 5, 0, Math.PI * 2);
      context.fill();
    }
  }
}

/**
 * 薄荷绿宽竖条纹，条纹中间一道白细线
 * @param {CanvasRenderingContext2D} context 画布
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 */
function paintMintStripes(context, width, height) {
  const stripeWidth = width / 8;

  context.fillStyle = '#f3fbf6';
  context.fillRect(0, 0, width, height);

  for (let i = 0; i < 8; i += 2) {
    context.fillStyle = '#bfe5d3';
    context.fillRect(i * stripeWidth, 0, stripeWidth, height);
    context.fillStyle = 'rgba(255,255,255,0.7)';
    context.fillRect(i * stripeWidth + stripeWidth / 2 - 1.5, 0, 3, height);
  }
}

/**
 * 粉色格子布：横竖两层半透明粉条叠出深浅格
 * @param {CanvasRenderingContext2D} context 画布
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 */
function paintPinkGingham(context, width, height) {
  const cell = width / 8;

  context.fillStyle = '#fff6f6';
  context.fillRect(0, 0, width, height);

  context.fillStyle = 'rgba(240,150,170,0.38)';
  for (let i = 0; i < 8; i += 2) {
    context.fillRect(i * cell, 0, cell, height);
    context.fillRect(0, i * cell, width, cell);
  }
}

/**
 * 夜都星空：深蓝底，撒小星星，偶尔一颗大的十字星
 * @description 用夜都捡来的瓶子做的，颜色跟夜都的天一样
 * @param {CanvasRenderingContext2D} context 画布
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 */
function paintStarryNight(context, width, height) {
  // 纯色底：图案要一块块平铺，上下有渐变的话每块接缝处都会断一道
  context.fillStyle = '#252a5e';
  context.fillRect(0, 0, width, height);

  // 星星位置写死成一张表，每次画出来一样，接缝处也不会断
  const smallStars = [[20, 30], [70, 90], [130, 20], [200, 60], [240, 140], [40, 170], [110, 150], [170, 210], [90, 230], [220, 240], [150, 100], [10, 110]];
  context.fillStyle = '#fff4c2';
  for (const [x, y] of smallStars) {
    context.beginPath();
    context.arc(x, y, 2.2, 0, Math.PI * 2);
    context.fill();
  }

  const bigStars = [[60, 50], [190, 170]];
  for (const [x, y] of bigStars) {
    paintSparkle(context, x, y, 9);
  }
}

/**
 * 画一颗四角十字星
 * @param {CanvasRenderingContext2D} context 画布
 * @param {number} x 中心 x，像素
 * @param {number} y 中心 y，像素
 * @param {number} size 角尖到中心的距离，像素
 */
function paintSparkle(context, x, y, size) {
  const waist = size * 0.22;

  context.fillStyle = '#ffd84a';
  context.beginPath();
  context.moveTo(x, y - size);
  context.lineTo(x + waist, y - waist);
  context.lineTo(x + size, y);
  context.lineTo(x + waist, y + waist);
  context.lineTo(x, y + size);
  context.lineTo(x - waist, y + waist);
  context.lineTo(x - size, y);
  context.lineTo(x - waist, y - waist);
  context.closePath();
  context.fill();
}

// ---------- 地板图案 ----------

/**
 * 一排排错缝的木地板：板子长短不一、深浅不一，上面有弯弯的木纹，偶尔一个木节
 * @description 板子太宽、颜色一样的话，近看就是几块大色块；窄板子加木纹才像真的木头地板
 * @param {CanvasRenderingContext2D} context 画布
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 * @param {number[]} plankRGB 木板的底色 [r, g, b]
 * @param {string} seamColor 木板之间缝的颜色
 */
function paintPlanks(context, width, height, plankRGB, seamColor) {
  // 种子固定：每次画出来一样，大图和工作台上的小样也一样
  const random = rng(PLANK_SEED);
  const rowHeight = height / PLANK_ROWS;
  const seamWidth = Math.max(1, width * SEAM_RATIO);

  for (let row = 0; row < PLANK_ROWS; row++) {
    const top = row * rowHeight;
    for (const plank of plankRow(random, width)) {
      const look = { plankRGB, seamColor, seamWidth, tone: 1 + (random() - 0.5) * PLANK_TONE, knot: random() < KNOT_CHANCE };
      // 跨过右边的板子在左边再画一遍，图左右接得上
      for (const shift of [0, -width]) {
        paintPlank(context, random, plank.start + shift, top, plank.length, rowHeight, look);
      }
    }

    context.fillStyle = seamColor;
    context.fillRect(0, top, width, seamWidth);
    context.fillStyle = BEVEL_LIGHT;
    context.fillRect(0, top + seamWidth, width, seamWidth / 2);
  }
}

/**
 * 一排板子从哪儿开始、各多长：从随便一个地方开始，一块接一块，正好铺满一圈图宽
 * @param {Function} random 返回 0~1 的随机数
 * @param {number} width 图宽，像素
 * @returns {{ start: number, length: number }[]}
 */
function plankRow(random, width) {
  const shortest = PLANK_LENGTH[0] * width;
  const longest = PLANK_LENGTH[1] * width;
  const planks = [];
  let start = random() * width;
  let left = width;

  while (left > 0) {
    let length = shortest + random() * (longest - shortest);
    // 剩下的不够一块短板，就并进这一块，接缝不会挤在一起
    const tooLittleLeft = left - length < shortest;
    if (tooLittleLeft) {
      length = left;
    }
    planks.push({ start, length });
    start += length;
    left -= length;
  }
  return planks;
}

/**
 * 画一块板：底色、几道木纹、可能有个木节，头上一道缝
 * @param {CanvasRenderingContext2D} context 画布
 * @param {Function} random 返回 0~1 的随机数
 * @param {number} x 板子左边，像素（可能超出画布，超出的部分画不出来）
 * @param {number} y 板子上边，像素
 * @param {number} length 板子多长，像素
 * @param {number} rowHeight 板子多宽（一排多高），像素
 * @param {{ plankRGB: number[], seamColor: string, seamWidth: number, tone: number, knot: boolean }} look 这块板的颜色和样子
 */
function paintPlank(context, random, x, y, length, rowHeight, look) {
  const [red, green, blue] = look.plankRGB.map((channel) => Math.round(Math.min(255, channel * look.tone)));
  const [grainRed, grainGreen, grainBlue] = [red, green, blue].map((channel) => Math.round(channel * GRAIN_DARKEN));

  context.save();
  context.beginPath();
  context.rect(x, y, length, rowHeight);
  context.clip();
  context.fillStyle = `rgb(${red},${green},${blue})`;
  context.fillRect(x, y, length, rowHeight);

  // 木纹：顺着板子的细线，慢慢上下起伏
  context.strokeStyle = `rgba(${grainRed},${grainGreen},${grainBlue},${GRAIN_ALPHA})`;
  context.lineWidth = Math.max(1, rowHeight / 22);
  for (let i = 0; i < GRAIN_LINES; i++) {
    const baseY = y + rowHeight * (0.15 + random() * 0.7);
    const wave = rowHeight * GRAIN_WAVE * (0.5 + random());
    const phase = random() * Math.PI * 2;
    context.beginPath();
    for (let step = 0; step <= GRAIN_SEGMENTS; step++) {
      const along = x + (length * step) / GRAIN_SEGMENTS;
      const lineY = baseY + Math.sin(phase + step * GRAIN_BEND) * wave;
      if (step === 0) {
        context.moveTo(along, lineY);
      } else {
        context.lineTo(along, lineY);
      }
    }
    context.stroke();
  }

  if (look.knot) {
    paintKnot(context, x + length * (0.2 + random() * 0.6), y + rowHeight * (0.3 + random() * 0.4), rowHeight, [grainRed, grainGreen, grainBlue]);
  }
  context.restore();

  context.fillStyle = look.seamColor;
  context.fillRect(x, y, look.seamWidth, rowHeight);
}

/**
 * 木板上的一个小木节：一个深色的扁圆，外面一圈淡淡的纹
 * @param {CanvasRenderingContext2D} context 画布
 * @param {number} x 中心，像素
 * @param {number} y 中心，像素
 * @param {number} rowHeight 一排多高，木节按它定大小
 * @param {number[]} grainRGB 木纹的颜色 [r, g, b]
 */
function paintKnot(context, x, y, rowHeight, grainRGB) {
  const [red, green, blue] = grainRGB;
  const size = rowHeight * 0.12;

  context.fillStyle = `rgba(${red},${green},${blue},0.3)`;
  context.beginPath();
  context.ellipse(x, y, size * 1.8, size, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = `rgba(${red},${green},${blue},0.12)`;
  context.beginPath();
  context.ellipse(x, y, size * 3.2, size * 1.8, 0, 0, Math.PI * 2);
  context.stroke();
}

/**
 * 黑白相间的方格瓷砖，砖缝一道浅灰
 * @param {CanvasRenderingContext2D} context 画布
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 * @param {string} lightColor 浅色砖
 * @param {string} darkColor 深色砖
 * @param {number} perSide 一张图里一边铺几块
 */
function paintTiles(context, width, height, lightColor, darkColor, perSide) {
  const tile = width / perSide;

  for (let row = 0; row < perSide; row++) {
    for (let column = 0; column < perSide; column++) {
      const dark = (row + column) % 2 === 1;
      context.fillStyle = dark ? darkColor : lightColor;
      context.fillRect(column * tile, row * tile, tile, tile);
    }
  }

  context.fillStyle = 'rgba(120,120,130,0.35)';
  for (let i = 0; i < perSide; i++) {
    context.fillRect(i * tile, 0, 2, height);
    context.fillRect(0, i * tile, width, 2);
  }
}

// ---------- 目录 ----------

// cost 为空的是一开始就有的；wainscot 是墙裙的颜色
// backdrop 是方块外面那一大片背景：只用渐变，不铺图案（铺了像一张贴纸，小屋浮在上面没有空间感）
export const WALLPAPERS = [
  {
    id: 'cream-dots',
    name: '奶油小圆点',
    cost: {},
    wainscot: '#a8cfa0',
    backdrop: 'radial-gradient(circle at 50% 30%, #fff6e3 0%, #f8dfc0 55%, #ecc39c 100%)',
    paint: paintCreamDots,
  },
  {
    id: 'mint-stripes',
    name: '薄荷条纹',
    cost: { plastic: 3 },
    wainscot: '#7fbfa8',
    backdrop: 'radial-gradient(circle at 50% 30%, #f3fbf6 0%, #d3eee2 55%, #a9d8c3 100%)',
    paint: paintMintStripes,
  },
  {
    id: 'pink-gingham',
    name: '粉色格子布',
    cost: { plastic: 4, glass: 1 },
    wainscot: '#e8a0b4',
    backdrop: 'radial-gradient(circle at 50% 30%, #fff6f6 0%, #fbd9de 55%, #f0b3c0 100%)',
    paint: paintPinkGingham,
  },
  {
    id: 'starry-night',
    name: '夜都星空',
    cost: { plastic: 2, glass: 3 },
    wainscot: '#3b4282',
    backdrop: 'radial-gradient(ellipse at 30% 10%, #3b4282 0%, #1d2148 45%, #0d0f26 100%)',
    // 外面围一圈 3D 星星，跟着镜头转，像小屋飘在夜空里
    backdropStars: true,
    paint: paintStarryNight,
  },
];

export const FLOORS = [
  {
    id: 'oak',
    name: '原木地板',
    cost: {},
    paint: (context, width, height) => paintPlanks(context, width, height, [232, 184, 128], 'rgba(140,90,50,0.35)'),
  },
  {
    id: 'walnut',
    name: '胡桃木地板',
    cost: { plastic: 3 },
    paint: (context, width, height) => paintPlanks(context, width, height, [150, 98, 62], 'rgba(60,35,20,0.45)'),
  },
  {
    id: 'checker',
    name: '黑白格瓷砖',
    cost: { plastic: 1, glass: 2 },
    paint: (context, width, height) => paintTiles(context, width, height, '#f7f4ec', '#3d3d48', 6),
  },
  {
    id: 'sky-tiles',
    name: '天蓝小瓷砖',
    cost: { plastic: 2, glass: 2 },
    paint: (context, width, height) => paintTiles(context, width, height, '#eaf6fb', '#a8dff5', 12),
  },
];

// 两类装修：存档里的键、面板上的标题、目录、贴图大小
export const DECOR_KINDS = {
  wallpaper: { label: '壁纸', list: WALLPAPERS, tilePx: WALLPAPER_TILE_PX, repeat: WALLPAPER_REPEAT },
  floor: { label: '地板', list: FLOORS, tilePx: FLOOR_TILE_PX, repeat: FLOOR_REPEAT },
};

/**
 * 某一类装修现在用的是哪一款
 * @description 老存档没有装修记录，就是一开始那款，进来看不出区别
 * @param {'wallpaper' | 'floor'} kind 哪一类
 * @returns {object} 目录里的那一款
 */
export function currentDecor(kind) {
  const list = DECOR_KINDS[kind].list;
  const chosenId = state.decor?.[kind];
  if (!chosenId) {
    return list[0];
  }

  const entry = list.find((candidate) => candidate.id === chosenId);
  if (!entry) {
    // 存档里的这款已经从目录里拿掉了，退回默认那款，不让小屋缺墙
    console.warn(`存档里的${DECOR_KINDS[kind].label}「${chosenId}」已经没有了，换回默认的`);
    return list[0];
  }
  return entry;
}

/**
 * 这一款做没做过（不要材料的那款一开始就有）
 * @param {object} entry 目录里的一款
 * @returns {boolean}
 */
export function ownsDecor(entry) {
  const free = Object.keys(entry.cost).length === 0;
  return free || !!state.decor?.owned?.includes(entry.id);
}

/**
 * 在工作台上选了一款：没做过的先花材料做出来，然后换上
 * @param {'wallpaper' | 'floor'} kind 哪一类
 * @param {object} entry 目录里的一款
 * @returns {'switched' | 'crafted' | 'short'} 换上了 / 刚做好并换上 / 材料不够
 */
export function chooseDecor(kind, entry) {
  let result = 'switched';
  if (!ownsDecor(entry)) {
    if (!canAfford(entry.cost)) {
      return 'short';
    }
    spendMaterials(entry.cost);
    result = 'crafted';
  }

  if (!state.decor) {
    state.decor = { owned: [] };
  }
  if (result === 'crafted') {
    state.decor.owned.push(entry.id);
  }
  state.decor[kind] = entry.id;
  save();
  return result;
}

/**
 * 按一款装修画一张能平铺的贴图
 * @param {'wallpaper' | 'floor'} kind 哪一类，决定画多大、铺几块
 * @param {object} entry 目录里的一款
 * @returns {THREE.CanvasTexture}
 */
export function decorTexture(kind, entry) {
  const { tilePx, repeat } = DECOR_KINDS[kind];
  return canvasTexture(tilePx, tilePx, entry.paint, { repeat });
}

const swatchCache = new Map();

/**
 * 工作台面板上的小样图（data URL），画过一次就记住
 * @param {object} entry 目录里的一款
 * @returns {string}
 */
export function decorSwatch(entry) {
  if (!swatchCache.has(entry.id)) {
    swatchCache.set(entry.id, paintToDataURL(entry.paint, SWATCH_PX));
  }
  return swatchCache.get(entry.id);
}

/**
 * 把一个图案画到小画布上，导出成 data URL
 * @param {Function} paint 图案的画法 (context, width, height)
 * @param {number} sizePx 画多大，像素（正方形）
 * @returns {string}
 */
function paintToDataURL(paint, sizePx) {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;

  // 图案是按 256 像素一块写的，小画布先缩放再画，图案比例不变
  const source = document.createElement('canvas');
  source.width = WALLPAPER_TILE_PX;
  source.height = WALLPAPER_TILE_PX;
  paint(source.getContext('2d'), WALLPAPER_TILE_PX, WALLPAPER_TILE_PX);

  const context = canvas.getContext('2d');
  context.drawImage(source, 0, 0, sizePx, sizePx);
  return canvas.toDataURL();
}
