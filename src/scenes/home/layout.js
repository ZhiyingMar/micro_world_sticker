// 小屋的布局：房子多大、镜头怎么看、工作台摆在哪、外面花园多大
// 都是数据，房间、家具、房檐、花园照着它搭

// 镜头：从右前方斜着看进屋子（只有后墙、左墙两面墙，别的方向看过去是空的）
export const CAMERA_POS = [9.5, 9.5, 12.5];
export const CAMERA_TARGET = [0, 1, -0.5];
// 左右以默认方向为中心，各能转多少（弧度，约 25°），转不到正对一面墙
export const CAMERA_TURN = 0.44;
// 上下：镜头离正上方的角度范围（弧度）。越大看得越平，墙和家具越显得高；不让俯视到头顶，也不让压到贴地
export const CAMERA_TILT = [0.9, 1.15];
// 一进来的俯角：比别的世界平一些，墙和家具立得起来
export const CAMERA_START_TILT = 1.05;
export const CAMERA_AZIMUTH = Math.atan2(CAMERA_POS[0] - CAMERA_TARGET[0], CAMERA_POS[2] - CAMERA_TARGET[2]);
// 全貌只框住屋子（不算外面的花园），屋子差不多填满画面；拉远最多就到这里，拉近随意
export const ROOM_SIZE = [10, 10];
// 拉近最多到多近（和别的世界一样按 ZOOM 换算）
export const CAMERA_MIN_DISTANCE = 2.2;
// 连外面一圈花园，整个方块的边长（屋子 10，四周各留一圈花园）
export const GARDEN_SIZE = 15;

// 房子的尺寸：地板 9.6 × 9.6，中心在原点
export const HOUSE = {
  half: 4.8, // 地板边离中心多远
  wallInner: 4.5, // 墙的内侧面离中心多远
  wallThickness: 0.3,
  wallHeight: 4.2,
  trimTop: 4.36, // 墙顶那根木线的顶面高度
  floorThickness: 0.3, // 地板那块板多厚（顶面在 0）
  wainscotHeight: 1.1, // 墙裙多高
  wainscotThickness: 0.06,
};

// 后墙上的窗户：窗洞中心在哪（x、离地多高），窗洞多宽多高。墙上真的开了洞，看得到屋后的花园
export const WINDOW = { x: 1.5, y: 2.45, width: 1.8, height: 1.4 };

// 圆地毯：中心和外圈半径（脚步声踩在上面是闷的）
export const RUG = { x: 0.5, z: 0.4, radius: 1.75 };
// 家具摆在哪：x、z，朝向（弧度，0 是正面朝 +z）。存档里不记家具，这就是小屋的样子
export const FURNITURE = {
  bed: { x: -3.4, z: -3.0 },
  lamp: { x: -4.1, z: -1.05 },
  shelf: { x: -1.0, z: -4.22 },
  counter: { x: 2.6, z: -4.15 },
  fridge: { x: 3.95, z: -4.0 },
  plant: { x: -4.0, z: 1.4 },
  // 收音机柜靠左墙，正面朝屋里（+x）
  cabinet: { x: -4.15, z: 3.15, facing: Math.PI / 2 },
  basket: { x: 3.9, z: 3.7 },
  slippers: { x: -2.0, z: -1.2 },
};
// 茶桌旁边的两张凳子：在哪、坐垫什么颜色，坐上去的人头上冒什么
export const STOOLS = [
  { x: -0.75, z: 0.75, color: '#f6a6b8', emote: '☕' },
  { x: 1.75, z: 0.65, color: '#8ec5e8', emote: '🍪' },
];
// 地上那团毛线球一开始在哪（人踢一下会滚走）
export const YARN_BALL = { x: 2.35, z: 3.6 };
// 小猫蜷在毛线篮旁边睡觉，头朝哪边（弧度，0 朝 +z；朝着镜头偏右，看得到它的脸）
export const CAT = { x: 3.1, z: 3.05, facing: 1.0 };

// 人能走的范围：只在屋里那块地板上，走不到花园里
export const BOUNDS = { minX: -4.45, maxX: 4.7, minZ: -4.45, maxZ: 4.7 };
export const SPAWN = [1.6, 2.8];

// 工作台：靠左墙，摆在落地灯和大盆栽中间，台面朝屋里（+x）
export const WORKBENCH = { x: -4.15, z: 0.15, facing: Math.PI / 2 };
// 台面多长（沿墙）、多深、多高
export const WORKBENCH_SIZE = { length: 1.2, depth: 0.6, height: 0.9 };
// 人站在台面前多远就能用
export const WORKBENCH_REACH = 1.3;

// ---------- 屋外的花园（只是看的，人走不出屋子） ----------

// 花园地面：比屋里地板低一点（房子坐在一块地基上）；方块底在哪；方块四个角磨圆多大；篱笆离方块边多远
export const GARDEN = { groundY: -0.3, bottom: -1.5, cornerRadius: 0.7, fenceInset: 0.32 };
// 院门开在右边篱笆上：门洞中心离前后多远（z），门洞多宽
export const GATE = { z: 2.6, width: 1.1 };
// 石板小路：从院门弯弯地走到屋子右边的木台阶（俯视的几个点，连成一条顺的曲线）
export const GARDEN_PATH = [[7.45, 2.6], [6.6, 2.85], [6.0, 2.35], [5.55, 1.8], [5.25, 1.55]];
// 屋子右边地板下面的一级木台阶：小路走到这儿就上屋了
export const PORCH_STEP = { x: 5.12, z: 1.55, width: 0.95 };
// 院门里面的小信箱，信箱口朝着小路
export const MAILBOX = { x: 6.9, z: 3.55, facing: -Math.PI / 2 };
// 屋后、屋左的树：[x, z, 种类, 大小, 树冠颜色]。种在镜头最远的两边，树冠从房檐上冒出来，把方块框住；
// 窗户正后面那棵从窗洞里看得到树干和树冠底下
export const GARDEN_TREES = [
  [-6.2, -6.3, 'round', 2.6, '#7fd06a'],
  [-3.4, -6.6, 'poplar', 2.7, '#9ad66c'],
  [-1.0, -6.3, 'round', 2.2, '#8fd17f'],
  [1.7, -6.5, 'round', 2.0, '#7cc576'],
  [4.1, -6.4, 'poplar', 2.4, '#a2d878'],
  [6.3, -6.2, 'round', 2.1, '#86c766'],
  [-6.6, -3.6, 'pine', 2.5, '#5f9e6e'],
  [-6.3, -0.9, 'round', 2.3, '#8fd17f'],
  [-6.6, 1.9, 'poplar', 2.3, '#9ad66c'],
];
// 灌木：[x, z, 半径, 颜色]。屋后屋左填在树中间；前面和右边只放矮的几团，在角上把方块收住
export const GARDEN_BUSHES = [
  [-5.3, -5.6, 0.5, '#7fd06a'],
  [0.3, -5.6, 0.42, '#86c766'],
  [3.0, -5.7, 0.4, '#7fd06a'],
  [-5.6, -2.2, 0.45, '#8fd17f'],
  [-5.5, 3.3, 0.5, '#7fd06a'],
  [-6.5, 4.6, 0.42, '#86c766'],
  [-6.6, 6.5, 0.4, '#7fd06a'],
  [6.6, -4.6, 0.45, '#8fd17f'],
  [6.7, 6.6, 0.32, '#86c766'],
];
// 窗外的两棵向日葵：[x, z, 多高]，花盘朝着窗户，从屋里透过窗洞看得到
export const SUNFLOWERS = [[1.05, -5.3, 1.95], [2.15, -5.35, 1.75]];
// 成片的花：[x, z, 半径, 几朵]。屋前地基边、院门两边、方块的角上，都是镜头这一侧的矮花
export const FLOWER_BEDS = [
  [-3.2, 5.35, 0.45, 9],
  [0.6, 5.3, 0.4, 8],
  [3.6, 5.35, 0.45, 9],
  [5.35, 4.4, 0.4, 8],
  [5.35, -1.6, 0.45, 9],
  [5.4, -3.9, 0.4, 7],
  [7.0, 1.6, 0.3, 6],
  [7.0, 3.9, 0.3, 6],
  [-5.6, 6.6, 0.4, 8],
  [6.4, 6.0, 0.4, 8],
];
