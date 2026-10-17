// 霓虹夜都的布局：地形文字地图 + 各处东西的位置。别的文件只用这里的名字，不自己写坐标
// 中间一个街区（大楼、便利店、BAR），四周一圈马路；马路外面是边缘：
//   前面坡上的公园、左边的社区花园、后面的后巷和背景高楼、右后角的观景台
// 地图上面是远处（-z），下面是镜头这边（+z）。符号见 src/terrain.js：数字是高度层，> < ^ v 是台阶

export const LEVEL = 0.5;

// 16 × 14：x -8..8，z -7..7
export const MAP = [
  '00000000000022<1', // z -7  背景高楼；右边观景台：2×2 的第二层平台
  '0000000000>>221^', // z -6  后巷；两层大台阶往右爬上观景台（后斑马线过来就是台阶脚下），右边另有台阶从窄道上来
  '0000000000000000', // z -5  后马路
  '0000000000000000',
  '0000000000000000', // z -3  街区：后人行道、大楼、前人行道
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000', // z 1   前马路
  '0000000000000000',
  '0000000000000000', // z 3   马路对面的人行道
  '11111111v11111v1', // z 4   公园挡土墙，两处台阶
  '22<1111111>22111', //       左边土坡、右边高台都是两层
  '2211111111122111',
];

// 地面上色用：哪些格子是公园、观景台、花园、后巷
export const REGIONS = {
  parkFromRow: 11,
  lookoutFromCol: 12,
  lookoutToRow: 1,
  gardenToCol: 1,
  backLaneRow: 1,
};

// ---------- 一圈马路 ----------
// 马路外圈和内圈（内圈就是街区），路宽 2，两条车道，各走一个方向
export const RING = {
  outer: { minX: -6, maxX: 7, minZ: -5, maxZ: 3 },
  inner: { minX: -4, maxX: 5, minZ: -3, maxZ: 1 },
};
// 车道中心线离马路中心线 0.5；拐角是圆的
export const LANE_OFFSET = 0.5;
export const CORNER_RADIUS = 1.0;

// 斑马线：马路只能从这里过；有人在上面时，快到的车会停下来让
export const CROSSWALKS = {
  front: { minX: -0.25, maxX: 1.45, minZ: 1, maxZ: 3 }, // 主斑马线，正对公园台阶；停电时堵车
  left: { minX: -6, maxX: -4, minZ: -1.85, maxZ: -0.15 }, // 去花园
  back: { minX: 0.2, maxX: 1.9, minZ: -5, maxZ: -3 }, // 去后巷；过去正好是观景台大台阶最低的那头（台阶往 +x 爬）
};

// 前马路上两条车道的 z（内道靠街区）
const FRONT_INNER_LANE_Z = 1.5;
const FRONT_OUTER_LANE_Z = 2.5;
export const TAXI_BAY = [-2.4, FRONT_INNER_LANE_Z]; // 出租车停靠位，大楼门口

// 停电时两辆车堵在主斑马线上，左边只留一条窄缝，侧着身子能挤过去
export const JAM = [
  { minX: 0.35, maxX: CROSSWALKS.front.maxX, minZ: FRONT_INNER_LANE_Z - 0.27, maxZ: FRONT_INNER_LANE_Z + 0.27 },
  { minX: 0.4, maxX: CROSSWALKS.front.maxX, minZ: FRONT_OUTER_LANE_Z - 0.27, maxZ: FRONT_OUTER_LANE_Z + 0.27 },
];

// 车：lane 是 inner / outer；normal 是车流动起来时的位置，jam 是停电时堵着的位置（都会吸到车道上）
// 出租车停电时不在（还在像素小镇），回来以后停在停靠位
export const CARS = [
  { lane: 'inner', normal: [-3.5, FRONT_INNER_LANE_Z], jam: [0.85, FRONT_INNER_LANE_Z] },
  { lane: 'inner', normal: [2.5, FRONT_INNER_LANE_Z], jam: TAXI_BAY, taxi: true },
  { lane: 'inner', normal: [5.5, -1.0], jam: [5.5, -2.0] },
  { lane: 'outer', normal: [3.0, FRONT_OUTER_LANE_Z], jam: [0.9, FRONT_OUTER_LANE_Z] },
  { lane: 'outer', normal: [-2.0, FRONT_OUTER_LANE_Z], jam: [2.7, FRONT_OUTER_LANE_Z] },
  { lane: 'outer', normal: [-1.0, -4.5], jam: [-2.0, -4.5] },
];

// ---------- 街区 ----------
// 楼都在一条线上：正面 z = BLOCK_FRONT，进深 BLOCK_DEPTH；前面是 1.4 宽的人行道
// 两侧和后面的人行道 0.9 宽，能绕着街区走一圈
export const BLOCK_FRONT = -0.4;
const BLOCK_DEPTH = 1.7;
const BLOCK_CENTER_Z = BLOCK_FRONT - BLOCK_DEPTH / 2;

export const TOWER = { x: -2.3, z: BLOCK_CENTER_Z, size: [1.6, 5.2, BLOCK_DEPTH] }; // 会玩俄罗斯方块的大楼
// 便利店模型原本 2.6 × 2.0，在这里缩一点塞进街区
export const STORE = { x: 0.6, z: BLOCK_FRONT - 0.85, scale: 0.85 };
export const BAR = { x: 3.25, z: BLOCK_CENTER_Z, size: [1.7, 3.4, BLOCK_DEPTH] };
export const VENDING = [2.05, BLOCK_FRONT - 0.25]; // 售货机塞在便利店和 BAR 中间，正面和楼齐平
export const STOOL = [3.85, BLOCK_FRONT + 0.3]; // 酒吧门口乐手的凳子，靠着墙角，不挡人行道
export const MOON = [0.6, 4.3, BLOCK_FRONT - BLOCK_DEPTH + 0.05]; // 月亮挂在便利店后面的杆子上，杆子立在后人行道

// 大楼和便利店中间的小巷：便利店后厨扔垃圾的地方，穿过整个街区，中间一道铁丝网，看得见对面但过不去
// 停电时整条巷子黑漆漆的，前后两头都进不去
export const ALLEY = {
  x: -1.0,
  width: 1.0,
  front: BLOCK_FRONT,
  back: BLOCK_FRONT - BLOCK_DEPTH,
  fenceZ: BLOCK_CENTER_Z,
};
// 垃圾桶靠着大楼那面墙排，另一边留出走人的路
const ALLEY_WALK_X = ALLEY.x + 0.15;
export const TEAPOT = [ALLEY_WALK_X, ALLEY.back + 0.35]; // 铁丝网后面那一半，要绕到街区背面去拿
export const COIN = [ALLEY_WALK_X, ALLEY.front - 0.35];
// 后厨的垃圾桶：铁丝网两边各一个；便利店后门开在巷子里
export const KITCHEN_BINS = [
  [ALLEY.x - ALLEY.width / 2 + 0.2, ALLEY.fenceZ - 0.35],
  [ALLEY.x - ALLEY.width / 2 + 0.2, ALLEY.fenceZ + 0.4],
];
export const KITCHEN_DOOR_Z = ALLEY.fenceZ - 0.45;
// 售货机后面那条缝（便利店和 BAR 中间），从街区背面钻进去，最里面一个垃圾桶
export const NOOK_BIN = [2.05, BLOCK_FRONT - 0.75];

// 街区前人行道上的东西
export const DRIVER_SEAT = [1.9, 0.75]; // 司机老周睡觉的长椅，在售货机前面的路边，中间留出买东西的地方
export const HYDRANT = [-3.2, 0.75];

// 路灯 [x, z, 朝向]：街区前面两个角，公园里两盏，花园、后巷、右边窄道各一盏
// 街区两侧、后面的人行道和公园前的人行道都太窄，立灯杆会把路堵死，那些地方不放
export const LAMPS = [
  [-3.7, 0.75, 0],
  [4.7, 0.75, Math.PI],
  [-4.0, 6.5, 0],
  [2.8, 6.6, Math.PI],
  [-7.8, -5.4, 0],
  [7.9, -1.0, Math.PI],
  [-3.0, -5.2, 0],
  [-0.8, -5.2, Math.PI], // 别立在后斑马线过来的地方
];

// ---------- 边缘 ----------
// 公交站在左边花园旁，背板朝着左马路；靠外边摆，等车的人和马路之间还能过人
export const BUS_STOP = { x: -7.45, z: 1.8, facing: -Math.PI / 2 };

// 坡上公园（一层，左边土坡和右边高台两层）
// 长椅藏在土坡后面（靠马路那边），默认镜头被土坡和树挡住，转一下镜头才看得到
export const PARK_BENCH = [-7.0, 4.45];
export const TOPHAT = [-6.65, 4.45];
export const PARK_TREES = [
  [-7.2, 5.9, 0.7], // 土坡上
  [4.3, 6.3, 0.6], // 右边高台上
  [-2.6, 6.4, 0.55],
  [1.6, 6.5, 0.5],
];
// 树篱：挡路的矮绿篱，把公园分成前后两半 [minX, maxX, minZ, maxZ]
// 树篱和挡土墙、土坡之间至少留 0.8 宽，两个人能错得开
export const HEDGES = [
  [-4.6, -1.2, 5.4, 5.7], // 左边：从中间台阶往左走，贴着挡土墙一路通到土坡后面的长椅
  [1.2, 1.9, 5.4, 5.7],
  [5.6, 5.9, 4.0, 6.0], // 从右边台阶上来，要绕到最前面才进得了公园
];
// 灌木丛 [x, z, 半径, 深]：都能翻；深的（土坡后面）才可能藏玻璃瓶
export const BUSHES = [
  [-7.5, 5.2, 0.32, true],
  [-6.0, 4.8, 0.26, true], // 长椅旁边
  [-0.6, 6.6, 0.25],
  [3.6, 5.6, 0.28],
  [6.4, 6.4, 0.3],
  [-3.2, 4.3, 0.26],
  [3.3, 4.3, 0.24],
  [-7.75, -0.62, 0.2], // 花园小棚子和菜畦中间
  [-7.6, 3.2, 0.26], // 公交站后面
];
export const UMBRELLA = [-7.5, 5.2]; // 藏在土坡上的树丛里

// 左边的社区花园：几块菜畦、一间小棚子，都靠外边摆，挨着马路留一条 0.8 宽的路
export const GARDEN_BEDS = [
  [-7.2, -4.2],
  [-7.2, -2.8],
  [-7.2, -1.4],
];
export const GARDEN_SHED = [-7.3, 0.0];

// 后巷：背景高楼前面一条窄巷，垃圾桶、空调外机，有只猫
export const BACKDROP = [
  { x: -6.2, width: 3.4, height: 6.0, seed: 21 },
  { x: -2.3, width: 3.8, height: 4.4, seed: 31 },
  { x: 1.9, width: 4.0, height: 5.4, seed: 41 },
];
export const BACKDROP_Z = -6.7;
export const BACKDROP_DEPTH = 0.6;
export const BACK_LANE_PROPS = {
  dumpsters: [[-4.4, -6.15], [0.2, -6.15]],
  airCon: [[-6.8, -6.25], [-1.6, -6.25]],
  cat: [0.2, -6.15], // 蹲在垃圾桶盖上
};

// 右后角观景台：第二层平台对着月亮放一台望远镜
export const TELESCOPE = [4.5, -6.6];
// 别挡住上下台阶的路
export const PLANTERS = [
  [5.6, -5.3],
  [7.6, -6.75],
];

// ---------- 瓶子 ----------
// 瓶子都要翻找：后厨和售货机后面的垃圾桶、后巷的大垃圾桶、草丛、路灯脚下
// 塑料瓶到处都可能有；玻璃瓶只藏在后厨垃圾桶和土坡后面的深草丛里
export const BOTTLE_HIDING = [
  { material: 'glass', count: 2, from: ['kitchen', 'deep'] },
  { material: 'plastic', count: 4, from: ['bin', 'bush', 'lamp'] },
];
// 路灯脚下扔瓶子的位置（离灯杆多远）
export const LAMP_LITTER_OFFSET = [0.3, 0.25];

// ---------- 小人 ----------
export const SPAWN = [0.3, 0.5];
export const VILLAGERS = {
  yemao: [-0.2, 0.4],
  ani: [BUS_STOP.x + 0.5, BUS_STOP.z],
  xiaofei: [3.0, 0.75],
};
// 围观俄罗斯方块的站位：大楼右边的前人行道上，斜着朝大楼看（站在正前方会挡住最下面几行）
export const CROWD_SPOTS = [
  [-1.1, -0.1],
  [-1.0, 0.6],
  [-0.6, 0.15],
  [-0.4, 0.75],
  [-0.1, -0.05],
  [0.2, 0.5],
  [0.5, 0.0],
  [0.7, 0.75],
];
// 路人从街区两侧的人行道走进来，看完再走回去
export const STREET_ENDS = [
  [-3.55, -1.5],
  [4.55, -1.5],
];
