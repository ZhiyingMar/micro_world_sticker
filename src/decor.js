// 小屋装修：工作台上能合成的壁纸、地板
// 每一款只是数据（叫什么、要几个材料、怎么画图案、配什么背景），小屋照着数据刷墙、铺地板
import { canvasTexture } from './kit.js';
import { state, save, canAfford, spendMaterials } from './state.js';

// 壁纸图案一块的像素大小，墙上横着铺几块、竖着铺几块
const WALLPAPER_TILE_PX = 256;
const WALLPAPER_REPEAT = [3, 1.4];
// 地板图案一块的像素大小，地上铺几块
const FLOOR_TILE_PX = 512;
const FLOOR_REPEAT = [1.6, 1.6];
// 工作台面板上的小样，画多大（像素）
const SWATCH_PX = 96;
// 方块外面那一大片背景：壁纸图案放大铺开，压得很淡，只当底纹
const BACKDROP_TILE_PX = 220;
const BACKDROP_PATTERN_ALPHA = 0.22;

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
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#2c3170');
  gradient.addColorStop(1, '#1d2148');
  context.fillStyle = gradient;
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
 * 一排排错缝的木地板
 * @param {CanvasRenderingContext2D} context 画布
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 * @param {number[]} plankRGB 木板的底色 [r, g, b]
 * @param {string} seamColor 木板之间缝的颜色
 */
function paintPlanks(context, width, height, plankRGB, seamColor) {
  const rows = 8;
  const rowHeight = height / rows;
  const plankLength = 256;

  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * (plankLength / 2);
    for (let x = -offset; x < width; x += plankLength) {
      // 每块板深浅差一点，看着像真木头
      const shade = 0.92 + ((row * 7 + x) % 5) * 0.025;
      const [red, green, blue] = plankRGB.map((channel) => Math.round(channel * shade));
      context.fillStyle = `rgb(${red},${green},${blue})`;
      context.fillRect(x, row * rowHeight, plankLength, rowHeight);
      context.fillStyle = seamColor;
      context.fillRect(x, row * rowHeight, 3, rowHeight);
    }
    context.fillStyle = seamColor;
    context.fillRect(0, row * rowHeight, width, 3);
  }
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

// cost 为空的是一开始就有的；wainscot 是墙裙的颜色；backdrop 是方块外面那一大片背景的渐变
export const WALLPAPERS = [
  {
    id: 'cream-dots',
    name: '奶油小圆点',
    cost: {},
    wainscot: '#a8cfa0',
    backdrop: 'radial-gradient(circle at 50% 30%, #fff6e3 0%, #f8dfc0 55%, #ecc39c 100%)',
    // 一开始的样子保持原样，外面不铺底纹
    backdropPattern: false,
    paint: paintCreamDots,
  },
  {
    id: 'mint-stripes',
    name: '薄荷条纹',
    cost: { plastic: 3 },
    wainscot: '#7fbfa8',
    backdrop: 'radial-gradient(circle at 50% 30%, #f3fbf6 0%, #d3eee2 55%, #a9d8c3 100%)',
    backdropPattern: true,
    paint: paintMintStripes,
  },
  {
    id: 'pink-gingham',
    name: '粉色格子布',
    cost: { plastic: 4, glass: 1 },
    wainscot: '#e8a0b4',
    backdrop: 'radial-gradient(circle at 50% 30%, #fff6f6 0%, #fbd9de 55%, #f0b3c0 100%)',
    backdropPattern: true,
    paint: paintPinkGingham,
  },
  {
    id: 'starry-night',
    name: '夜都星空',
    cost: { plastic: 2, glass: 3 },
    wainscot: '#3b4282',
    backdrop: 'radial-gradient(ellipse at 30% 10%, #3b4282 0%, #1d2148 45%, #0d0f26 100%)',
    backdropPattern: true,
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
    swatchCache.set(entry.id, paintToDataURL(entry.paint, SWATCH_PX, 1));
  }
  return swatchCache.get(entry.id);
}

/**
 * 换上这款壁纸以后，方块外面那一大片背景的 CSS
 * @description 动森那种感觉：屋里换了壁纸，整个画面的底色跟着变，外面再淡淡铺一层同样的图案
 * @param {object} wallpaper 目录里的一款壁纸
 * @returns {string} 能直接放进 background 的值
 */
export function wallpaperBackdrop(wallpaper) {
  if (!wallpaper.backdropPattern) {
    return wallpaper.backdrop;
  }

  const pattern = paintToDataURL(wallpaper.paint, BACKDROP_TILE_PX, BACKDROP_PATTERN_ALPHA);
  return `url(${pattern}) center / ${BACKDROP_TILE_PX}px repeat, ${wallpaper.backdrop}`;
}

/**
 * 把一个图案画到小画布上，导出成 data URL
 * @param {Function} paint 图案的画法 (context, width, height)
 * @param {number} sizePx 画多大，像素（正方形）
 * @param {number} alpha 整体透明度，0~1
 * @returns {string}
 */
function paintToDataURL(paint, sizePx, alpha) {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;

  // 图案是按 256 像素一块写的，小画布先缩放再画，图案比例不变
  const source = document.createElement('canvas');
  source.width = WALLPAPER_TILE_PX;
  source.height = WALLPAPER_TILE_PX;
  paint(source.getContext('2d'), WALLPAPER_TILE_PX, WALLPAPER_TILE_PX);

  const context = canvas.getContext('2d');
  context.globalAlpha = alpha;
  context.drawImage(source, 0, 0, sizePx, sizePx);
  return canvas.toDataURL();
}
