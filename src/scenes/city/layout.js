// 霓虹夜都的布局：地形文字地图 + 各处东西的位置。别的文件只用这里的名字，不自己写坐标
// 地图上面是远处（-z，大楼那一排），下面是镜头这边（+z，坡上的小公园）
// 符号见 src/terrain.js：数字是高度层，> < ^ v 是台阶（箭头指往上走的方向）

export const LEVEL = 0.5;

// 14 × 12：x -7..7，z -6..6
export const MAP = [
  '00000000000022', // z -6  后排大楼；右边角上是两层高的天台
  '00000000000022',
  '0000000000001^', //       上天台第二层的台阶
  '00000000000011',
  '000000000000^0', // z -2  大楼前的人行道，从这里上天台
  '00000000000000', //       马路
  '00000000000000',
  '00000000000000',
  '00000000000000', // z 2   马路对面的人行道、公交站
  '111111vv111111', // z 3   公园的挡土墙，台阶正对着斑马线
  '22<11111111111', //       公园左边一个小土坡
  '22111111111111',
];

// 公园、天台占的格子（地面上色用）
export const PARK_ROW = 9;
export const TERRACE_COL = 12;

// ---------- 马路 ----------
export const ROAD = { z0: -0.6, z1: 1.6 };
export const CROSS = 0.85; // 斑马线半宽，马路只能从这里过
export const LANES = [
  { z: ROAD.z0 + 0.55, dir: 1 },
  { z: ROAD.z0 + 1.65, dir: -1 },
];
export const TAXI_BAY = [-3.2, LANES[0].z]; // 出租车停靠位
// 停电时两辆车堵在斑马线上，左边只留一条窄缝，侧着身子能挤过去
export const JAM = [
  { minX: -0.25, maxX: CROSS, minZ: ROAD.z0 + 0.28, maxZ: ROAD.z0 + 0.82 },
  { minX: -0.2, maxX: CROSS, minZ: ROAD.z0 + 1.38, maxZ: ROAD.z0 + 1.92 },
];
// 四辆车平时的位置 / 停电时堵着的位置（第二辆是出租车，停电时不在）
export const CARS = [
  { lane: 0, x: -4.2, jamX: 0.25 },
  { lane: 0, x: 1.5, jamX: null, taxi: true },
  { lane: 1, x: 3.0, jamX: 0.3 },
  { lane: 1, x: -2.0, jamX: 2.1 },
];
// 路灯 [x, z, 朝向]：大楼这边一排，马路对面一排
const BACK_CURB = ROAD.z0 - 0.25;
const FRONT_CURB = ROAD.z1 + 0.25;
export const LAMPS = [
  [-5.9, BACK_CURB, 0],
  [-2.4, BACK_CURB, 0],
  [2.6, BACK_CURB, Math.PI],
  [-4.3, FRONT_CURB, 0],
  [1.0, FRONT_CURB, 0],
  [4.6, FRONT_CURB, Math.PI],
];
export const HYDRANT = [-1.2, ROAD.z0 - 0.4];
export const DRIVER_SEAT = [1.3, ROAD.z0 - 0.37]; // 司机老周睡觉的长椅，便利店门口路边
export const BUS_STOP = [-1.9, ROAD.z1 + 1.05];

// ---------- 后排 ----------
export const TOWER = { x: -3.2, z: -4.5, size: [2.2, 5.2, 2.4] }; // 会玩俄罗斯方块的大楼
export const TOWER_FRONT = TOWER.z + TOWER.size[2] / 2;
export const APARTMENT = { x: -5.75, z: -4.6, size: [2.1, 3.8, 2.2] };
export const STORE = [0.2, -4.6]; // 便利店 2.6 × 2.0
export const BAR = { x: 3.3, z: -4.5, size: [2.0, 3.4, 2.2] };
export const BAR_FRONT = BAR.z + BAR.size[2] / 2;
export const VENDING = [1.9, -3.85];
export const STOOL = [3.75, -2.9]; // 酒吧门口乐手的凳子
export const MOON = [0.6, 4.3, -5.55]; // 月亮像舞台道具一样挂在便利店后面的杆子上
// 大楼和便利店中间的小巷：停电时黑漆漆的，进不去
export const ALLEY = { x: -1.6, z: -4.55, entry: { minX: -2.1, maxX: -1.1, minZ: -3.7, maxZ: -3.25 } };
export const TEAPOT = [-1.6, -5.3];
export const COIN = [-1.6, -4.0];

// ---------- 坡上的小公园（一层高） ----------
export const PARK_BENCH = [2.4, 4.75];
export const TOPHAT = [2.75, 4.75];
export const PARK_TREES = [
  [-6.0, 5.3, 0.7], // 土坡上
  [4.6, 5.3, 0.6],
  [-2.6, 5.4, 0.55],
];
export const BUSHES = [
  [-6.4, 4.4, 0.32],
  [-3.4, 5.5, 0.25],
  [3.6, 5.6, 0.28],
  [0.1, 5.5, 0.26],
  [6.3, 4.4, 0.3],
];
export const UMBRELLA = [-6.4, 4.4]; // 藏在土坡上的树丛里

// ---------- 右后角的天台 ----------
export const TELESCOPE = [6.2, -5.3]; // 第二层，对着月亮
export const PLANTERS = [
  [5.35, -3.65],
  [6.6, -2.35],
];

// ---------- 小人 ----------
export const SPAWN = [0, -2.1];
export const VILLAGERS = {
  yemao: [-0.8, -2.3],
  ani: [BUS_STOP[0], BUS_STOP[1] - 0.55],
  xiaofei: [2.0, -1.9],
};
// 围观俄罗斯方块的站位：大楼右边的人行道上，斜着朝大楼看（站在正前方会挡住最下面几行）
export const CROWD_SPOTS = [
  [-1.75, -2.4],
  [-1.6, -1.7],
  [-1.15, -2.7],
  [-1.0, -1.95],
  [-0.5, -2.4],
  [-1.85, -1.1],
  [-0.55, -1.55],
  [-0.05, -2.05],
];
// 路人从街两头走进来，看完再走回去
export const STREET_ENDS = [
  [-6.2, -1.9],
  [6.4, -1.6],
];
