// 童话森林的布局：地形文字地图 + 各处东西的位置。别的文件只用这里的名字，不自己写坐标
// 小山和池塘把森林分成左右两半：
//   左边：后面是蘑菇屋村，中间一个小土坡，前面躺着空心木头
//   右边：后面是两层的小山（山顶是高塔），前面一片草地
//   中间：池塘，往前流出一条小溪。只有池塘里的踏脚石和小溪上的桥能过到另一边
// 地图上面是远处（-z），下面是镜头这边（+z）。符号见 src/terrain.js：数字是高度层，~ 水，= 桥，o 踏脚石，> < ^ v 台阶

export const LEVEL = 0.5;

// 14 × 14：x -7..7，z -7..7。一格的中心是 (列 - 6.5, 行 - 6.5)
export const MAP = [
  '00000011112222', // z -6.5  蘑菇屋村；山腰（一层）；山顶（两层）
  '000000111>2222', // z -5.5  山腰往右一级台阶上山顶，正好从高塔背后上去
  '00000011112222',
  '00000011111111', // z -3.5  山腰绕到山前面的一条窄道
  '0000000~~0000^', // z -2.5  池塘最里面；右边台阶从草地上山腰
  '000000~ooo0000', // z -1.5  踏脚石弯弯曲曲穿过池塘
  '000000oo~~0000',
  '1110000~~~0000', // z 0.5   左边小土坡（一层）
  '111<0000~00000', //         小土坡的台阶；池塘往前流出小溪
  '11100000~00000',
  '00000000~~0000', // z 3.5   小溪拐一下
  '000000000~0000',
  '000000000=0000', // z 5.5   小溪上的桥
  '000000000~0000',
];

// 镜头一进来的全貌：后排要装下多高（山顶的高塔）
export const FIT_HEIGHT = 4;

// ---------- 蘑菇屋村（左后） ----------
// facing 是门朝哪边（弧度，0 朝 +z 也就是镜头这边）；seed 决定菌盖上白点怎么撒
export const HOUSES = [
  { x: -4.8, z: -5.0, stemRadius: 0.75, stemHeight: 1.3, capRadius: 1.3, capColor: '#f26b6b', facing: 0.15, seed: 11, emote: '🏠' },
  { x: -1.9, z: -5.6, stemRadius: 0.55, stemHeight: 1.0, capRadius: 0.95, capColor: '#7fb2f0', facing: -0.25, seed: 23, emote: '🧹' },
  { x: -6.0, z: -2.2, stemRadius: 0.45, stemHeight: 0.85, capRadius: 0.8, capColor: '#ffd84a', facing: 0.9, seed: 37, emote: '🍵' },
];

// ---------- 池塘和小溪（中间） ----------
// 荷叶 [x, z, 半径]，都在水格子上；第一片是放金币的那片，在两段踏脚石拐弯的地方，站在石头上够得着
export const LILY_PADS = [
  [1.6, -0.45, 0.26],
  [2.4, 0.55, 0.2],
  [0.4, -2.55, 0.18],
  [0.7, 0.4, 0.15],
  [-0.45, -1.6, 0.17],
];
export const COIN_PAD = LILY_PADS[0];
// 荷花开在这片荷叶上
export const LOTUS_PAD = LILY_PADS[1];
// 钓鱼的人站在右岸，面朝池塘
export const FISHING_SPOT = { x: 3.4, z: 0.5, face: -Math.PI / 2 };
// 桥边的岸上看小溪里的鱼
export const STREAM_SPOT = { x: 3.4, z: 4.5, face: -Math.PI / 2 };

// ---------- 小山（右后） ----------
// 高塔在山顶靠前的地方，门斜着朝山顶的空地（从台阶上来的那边）
export const TOWER = { x: 5.4, z: -5.4, facing: -0.6 };
// 塔背后一圈特别密的花丛，从默认镜头看被塔挡住
// 从塔中心往后（-z）的一段圆弧：角度 from..to（弧度，0 朝 +x，往 -z 转），离塔中心 radii 里轮流取
export const FLOWER_RING = { from: 0.5, to: 2.6, count: 16, radii: [1.05, 1.2, 1.35] };
// 卡带藏在花丛里，正好在从镜头看过去塔的背后
export const CARTRIDGE = [4.5, -6.4];
// 爬上山顶的人站在塔门前看风景
export const TOWER_SPOT = { x: 4.5, z: -4.6, face: 0.4 };

// ---------- 树林 ----------
// 树 [x, z, 样子]：样子是 trunkHeight 树干多高、crownRadius 树冠多大、color 树冠颜色，不写就是普通绿树
export const TREES = [
  [-6.4, -6.4, { crownRadius: 0.7, trunkHeight: 1.3, color: '#8fd17f' }], // 蘑菇村后面的角落
  [-6.4, -0.6, { crownRadius: 0.55, trunkHeight: 0.9, color: '#b5e39a' }],
  [-5.6, 1.4, { crownRadius: 0.7, trunkHeight: 0.95, color: '#ffb7d5' }], // 小土坡上，有人在树下打盹
  [-6.4, 6.3, { crownRadius: 0.6, trunkHeight: 1.0 }],
  [-3.0, 6.5, { crownRadius: 0.5, trunkHeight: 0.8, color: '#9ee08a' }],
  [0.3, 6.5, { crownRadius: 0.55, trunkHeight: 0.85, color: '#ffb7d5' }],
  [0.9, -5.6, { crownRadius: 1.0, trunkHeight: 1.4, color: '#7fd06a' }], // 山腰上的老树，从哪儿都看得见
  [2.5, -6.5, { crownRadius: 0.5, trunkHeight: 0.8, color: '#b5e39a' }],
  [3.4, -6.6, { crownRadius: 0.45, trunkHeight: 0.75, color: '#ffb7d5' }], // 山顶，挡在花丛后面
  [3.9, -2.4, { crownRadius: 0.5, trunkHeight: 0.85, color: '#9ee08a' }],
  [6.4, 0.6, { crownRadius: 0.6, trunkHeight: 0.95, color: '#ffb7d5' }],
  [6.4, 3.4, { crownRadius: 0.5, trunkHeight: 0.75, color: '#9ee08a' }],
];
// 有人在小土坡的树下打盹
export const NAP_SPOT = { x: -4.9, z: 1.6, face: -Math.PI / 2 };

// 空心木头：横躺着，开口朝 +x，爱心在开口那头往里一点
export const LOG = { x: -4.6, z: 4.7, radius: 0.36, length: 1.8 };
// 爱心离开口那头多远（往木头里面）
export const HEART_INSET = 0.25;
// 点木头时镜头从开口那头的哪个方向往里看（相对爱心）
export const LOG_PEEK_FROM = [2.6, 0.8, 0.4];

// 右边草地最前面一道白栅栏
export const FENCE = { fromX: 3.5, toX: 6.6, z: 6.55 };
// 栅栏后面看花
export const FLOWER_SPOT = { x: 5.0, z: 5.4, face: 0 };

// ---------- 小路 ----------
// 一段段折线，沿着铺小石板（只是看的，哪儿都能走）
export const PATHS = [
  // 出生点往北，经过小土坡的台阶口，到蘑菇屋村
  [[-1.4, 4.6], [-2.4, 2.8], [-2.6, 0.6], [-3.4, -1.2], [-3.9, -3.4]],
  // 岔出去，到池塘的踏脚石
  [[-2.7, -0.2], [-1.6, -0.5]],
  // 出生点往右，到桥头
  [[-0.8, 5.5], [0.5, 5.8], [1.6, 5.5]],
  // 过了桥穿过右边草地，到上山腰的台阶
  [[3.4, 5.5], [4.4, 4.2], [4.9, 2.0], [5.6, 0.0], [6.5, -1.6]],
  // 山腰上：台阶上来往左，绕到上山顶的台阶
  [[6.5, -3.5], [2.6, -3.5], [2.1, -4.6], [2.2, -5.5]],
];

// ---------- 小人 ----------
export const SPAWN = [-1.4, 5.2];
export const VILLAGERS = {
  bobo: [-2.4, 2.2],
  lily: [5.0, 1.6],
  mushroomKid: [-5.2, -1.0],
};
