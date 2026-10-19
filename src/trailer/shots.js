// 宣传片分镜：先在小屋，再去霓虹夜都，最后亮灯的夜都配上标题
// 每个镜头：
//   world     在哪个世界拍（和上一个不同就换世界，方块会重新落下来）
//   duration  多少秒
//   caption   字幕（相邻镜头字幕一样就连着显示）
//   camera    { from, to } 两个机位，镜头在中间平滑过渡；机位 = 看着哪儿 look、离多远 distance、
//             上下角 polar（离正上方多少弧度）、左右角 azimuth（弧度，0 从 +z 往里看）
//             distance 和游戏里镜头距离的写法一样，会再乘上窄视野的换算系数
//   setup     开始这个镜头时做的准备（把人挪到哪……）
//   cues      [{ at: 第几秒, run(stage) }] 到点触发的剧情
//   fadeIn / fadeOut  开头从黑场淡入、结尾淡出到黑场各多少秒
//   title     { title, subtitle, at: 第几秒出现, fade: 淡入多久 } 标题卡
// 夜都的坐标都从 layout.js 拿；小屋没有单独的布局文件，从搭好的世界里读（冰箱、工作台、藏东西的地方）
import { MOON, TAXI_BAY, STOOL, CROSSWALKS, TOWER, BLOCK_FRONT, SPAWN } from '../scenes/city/layout.js';

// 小屋默认从哪个方向看进去（弧度）：右前方，对着后墙和左墙
const HOME_AZIMUTH = 0.63;
// 夜都默认从哪个方向看（弧度）：右前方，看得到街区正面和前面的马路
const CITY_AZIMUTH = 0.67;
// 人站在工作台前多远（和小屋里能用工作台的位置差不多）
const WORKBENCH_STAND = 0.85;
// 人走到冰箱前停在哪：冰箱正面往屋里多少
const FRIDGE_STAND = 0.9;
// 人走去捡蘑菇时停在离它多远（够近就会自动捡起来）
const MUSHROOM_STAND = 0.55;
// 斑马线镜头：人先站在主斑马线靠街区这头等着（算在斑马线上），再过马路上公园台阶
// 车流一开起来，刚好开到斑马线前的出租车和对面车道的车就得停下来等人过去：
// 车只在刚开起来时经过这条斑马线，下一圈要二十多秒以后，所以人要在出租车回来之前就站好
const CROSSING_X = CROSSWALKS.front.minX + 0.35;
const CROSSING_FROM_Z = CROSSWALKS.front.minZ - 0.1;
const CROSSING_TO_Z = 4.6;
// 萨克斯镜头里人站在乐手凳子前面多远
const SAX_STAND = 0.75;

const crossingCenterZ = (CROSSWALKS.front.minZ + CROSSWALKS.front.maxZ) / 2;

/**
 * 小屋里工作台前站人的位置
 * @param {object} stage 导演给的小工具
 * @returns {number[]} [x, z]
 */
function workbenchStand(stage) {
  const bench = stage.world.interacts.get('workbench');
  return [bench.x, bench.z];
}

/**
 * 冰箱的位置
 * @param {object} stage 导演给的小工具
 * @returns {THREE.Vector3}
 */
function fridgePosition(stage) {
  return stage.world.fridge.position;
}

export const SHOTS = [
  // ---------- 小屋 ----------
  {
    name: '小屋落下',
    world: 'home',
    duration: 5,
    fadeIn: 1.0,
    caption: '冰箱上的每一块冰箱贴，都是一个小世界',
    camera: {
      from: { look: [0, 0.8, -0.3], distance: 16, polar: 0.95, azimuth: HOME_AZIMUTH + 0.35 },
      to: { look: [0, 0.8, -0.5], distance: 13.5, polar: 1.02, azimuth: HOME_AZIMUTH - 0.1 },
    },
  },
  {
    name: '找亮晶晶的东西',
    duration: 5,
    caption: '走一走、找一找，藏着亮晶晶的东西',
    setup(stage) {
      const mushroom = stage.world.items.get('mushroom').position;
      stage.walk(mushroom.x + MUSHROOM_STAND, mushroom.z + MUSHROOM_STAND * 0.3);
    },
    camera: {
      from: { look: (stage) => stage.playerPoint(0.5), distance: 7.5, polar: 1.02, azimuth: HOME_AZIMUTH + 0.2 },
      to: { look: (stage) => stage.playerPoint(0.5), distance: 6, polar: 1.05, azimuth: HOME_AZIMUTH - 0.15 },
    },
  },
  {
    name: '换壁纸',
    duration: 6,
    caption: '捡来的瓶子，回家做成壁纸和地板',
    setup(stage) {
      const [x, z] = workbenchStand(stage);
      stage.walk(x + WORKBENCH_STAND * 0.3, z);
    },
    cues: [
      { at: 1.4, run: (stage) => stage.useWorkbench('wallpaper', 'starry-night') },
      { at: 3.4, run: (stage) => stage.useWorkbench('floor', 'walnut') },
    ],
    camera: {
      from: { look: [-1.6, 1.0, -0.8], distance: 11, polar: 1.02, azimuth: HOME_AZIMUTH + 0.05 },
      to: { look: [-0.8, 1.0, -0.6], distance: 13, polar: 1.0, azimuth: HOME_AZIMUTH - 0.3 },
    },
  },
  {
    name: '去冰箱',
    duration: 4.5,
    fadeOut: 0.9,
    caption: '点一块冰箱贴，出发！',
    setup(stage) {
      const fridge = fridgePosition(stage);
      stage.walk(fridge.x - 0.2, fridge.z + FRIDGE_STAND);
    },
    cues: [{ at: 3.3, run: (stage) => stage.sound('whoosh') }],
    camera: {
      from: { look: (stage) => [fridgePosition(stage).x - 0.5, 1.3, fridgePosition(stage).z + 0.6], distance: 9, polar: 1.05, azimuth: HOME_AZIMUTH - 0.25 },
      to: { look: (stage) => [fridgePosition(stage).x, 1.75, fridgePosition(stage).z + 0.5], distance: 3.6, polar: 1.1, azimuth: HOME_AZIMUTH - 0.35 },
    },
  },

  // ---------- 霓虹夜都 ----------
  {
    name: '停电的夜都',
    world: 'city',
    duration: 5,
    fadeIn: 0.6,
    caption: '可是一到夜都，整座城都停电了……',
    setup(stage) {
      stage.place(SPAWN[0], SPAWN[1], Math.PI);
    },
    camera: {
      from: { look: [0, 0.5, -0.5], distance: 22, polar: 0.95, azimuth: CITY_AZIMUTH + 0.3 },
      to: { look: [0, 0.6, -0.8], distance: 18.5, polar: 1.0, azimuth: CITY_AZIMUTH },
    },
  },
  {
    name: '挂回月亮',
    duration: 6,
    caption: '把丢掉的东西，放回原来的地方',
    cues: [
      { at: 0.5, run: (stage) => stage.discover('moon') },
      { at: 2.2, run: (stage) => stage.repair('moon') },
    ],
    camera: {
      from: { look: [MOON[0], MOON[1] - 1.2, MOON[2]], distance: 9.5, polar: 1.12, azimuth: CITY_AZIMUTH - 0.3 },
      to: { look: [MOON[0], MOON[1] - 1.6, MOON[2] + 0.5], distance: 12, polar: 1.05, azimuth: CITY_AZIMUTH - 0.1 },
    },
  },
  {
    name: '出租车回来',
    duration: 4,
    caption: '出租车回来了，车流动起来',
    setup(stage) {
      stage.place(CROSSING_X, CROSSING_FROM_Z, 0);
    },
    cues: [
      { at: 0.3, run: (stage) => stage.discover('taxi') },
      { at: 1.2, run: (stage) => stage.repair('taxi') },
    ],
    camera: {
      from: { look: [TAXI_BAY[0] + 0.5, 0.3, TAXI_BAY[1]], distance: 7.5, polar: 1.02, azimuth: CITY_AZIMUTH - 0.2 },
      to: { look: [TAXI_BAY[0] + 1.2, 0.3, TAXI_BAY[1] + 0.2], distance: 9, polar: 1.0, azimuth: CITY_AZIMUTH },
    },
  },
  {
    name: '过斑马线',
    duration: 5.5,
    caption: '过马路时，车会停下来让你',
    cues: [{ at: 1.2, run: (stage) => stage.walk(CROSSING_X, CROSSING_TO_Z) }],
    camera: {
      // 斑马线和左边停下来等的出租车都要在画面里
      from: { look: [CROSSING_X - 0.6, 0.3, crossingCenterZ], distance: 9.5, polar: 1.0, azimuth: CITY_AZIMUTH + 0.2 },
      to: { look: [CROSSING_X - 0.3, 0.4, crossingCenterZ + 0.5], distance: 8.5, polar: 1.03, azimuth: CITY_AZIMUTH },
    },
  },
  {
    name: '萨克斯响起',
    duration: 8,
    caption: '音乐响起，城市一盏一盏亮起来',
    setup(stage) {
      stage.place(STOOL[0] - SAX_STAND, STOOL[1] + SAX_STAND, Math.PI * 0.75);
    },
    cues: [
      { at: 0.3, run: (stage) => stage.discover('sax') },
      { at: 1.3, run: (stage) => stage.repair('sax') },
    ],
    camera: {
      from: { look: [STOOL[0], 0.9, STOOL[1]], distance: 6, polar: 1.05, azimuth: CITY_AZIMUTH - 0.25 },
      to: { look: [0.5, 1.4, -1.0], distance: 20, polar: 1.0, azimuth: CITY_AZIMUTH + 0.05 },
    },
  },
  {
    name: '大楼俄罗斯方块',
    duration: 5,
    caption: '大楼的窗户，还能玩俄罗斯方块',
    camera: {
      // 待机演示刚开始没多久，方块都堆在下半截：镜头凑近看下半截
      from: { look: [TOWER.x, TOWER.size[1] * 0.4, BLOCK_FRONT], distance: 8, polar: 1.22, azimuth: 0.2 },
      to: { look: [TOWER.x, TOWER.size[1] * 0.35, BLOCK_FRONT], distance: 6.5, polar: 1.2, azimuth: -0.1 },
    },
  },
  {
    name: '片尾',
    duration: 6.5,
    fadeOut: 1.2,
    title: { title: '🧲 冰箱贴小世界', subtitle: '在线试玩 · zhiyingmar.github.io/micro_world_sticker', at: 0.8, fade: 1.0 },
    camera: {
      from: { look: [0.5, 1.0, -0.5], distance: 19, polar: 0.98, azimuth: CITY_AZIMUTH - 0.45 },
      to: { look: [0.5, 1.0, -0.5], distance: 21, polar: 0.95, azimuth: CITY_AZIMUTH + 0.25 },
    },
  },
];

// 宣传片从这份进度开始演（只在内存里，不碰玩家的存档）：
//   冰箱上已经有夜都那块；夜都还停着电；司机已经喝过咖啡醒着（片子里不演买咖啡这段，出租车一回来车就开）
//   背包里的瓶子够在工作台上做星空壁纸和胡桃木地板；打过招呼了，不会有人跳出来说话挡镜头
export const TRAILER_SAVE = {
  current: 'home',
  magnets: ['forest', 'pixel', 'city'],
  seenIntro: true,
  greeted: { home: true, 'city:broken': true, 'city:restored': true },
  materials: { plastic: 12, glass: 8 },
  flags: { city: ['coin', 'coffee', 'driver'] },
};
