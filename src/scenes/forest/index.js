// 童话森林 —— 蘑菇屋、山顶的高塔、踏脚石过池塘，卡通着色
// 小山和池塘把森林分成左右两半，只有池塘里的踏脚石和小溪上的桥能过去
// 刚到的时候森林的魔法停了：桥塌了，踏脚石沉了，要把从小屋带来的童话书、红蘑菇、魔法星星放回原处，才能逛到对岸
//
// 文件分工：
//   layout.js    地形文字地图、各处东西的位置
//   models.js    模型（只造不摆）：屋子、塔、木头、栅栏、树桩……
//   （植物模型：几种树、灌木、成片的花和草，在 src/plants.js，和小屋花园共用）
//   ground.js    地面：圆润的地形、深浅不一的草地、土路（paths.js 是路在哪）
//   village.js   三座蘑菇屋，散在林子里
//   pond.js      池塘和小溪：岸边石头、荷叶，荷叶上的金币
//   hill.js      右后角的小山：高塔、塔背后的花丛和卡带
//   forage.js    灌木丛、树桩、落叶堆：能翻的地方，每次进来随机长小蘑菇
//   woods.js     显眼的几棵树、四周的树墙、空心木头（爱心在里面）、栅栏
//   scenery.js   一簇簇的花、满地草丛、侧面小石头、萤火虫
//   life.js      风吹树冠、蝴蝶（人走近会被惊飞）、池塘里跳起来的鱼
//   （水面上的波纹和溅起的水珠在 src/splashes.js，和像素小镇共用）
//   touch.js     碰一下会有反应的：踩踏脚石溅水花、桥上的脚步声、撞到蘑菇屋菌盖会弹、路过小红蘑菇会弹
//   people.js    居民和台词（魔法停了时、修好以后各一套）
//   crossings.js 桥塌下去、踏脚石沉下去，挡住去对岸的路；修好时红蘑菇长出来顶起桥、石头一块块浮上来
//   story.js     主线：三个修复点、修好以后各自醒过来、老存档
import * as THREE from 'three';
import { at } from '../../kit.js';
import { buildGround } from './ground.js';
import { buildVillage } from './village.js';
import { buildPond } from './pond.js';
import { buildHill } from './hill.js';
import { buildWoods } from './woods.js';
import { buildForage } from './forage.js';
import { buildScenery } from './scenery.js';
import { createPeople } from './people.js';
import { bringToLife } from './life.js';
import { createSplashes } from '../../splashes.js';
import { createTouch } from './touch.js';
import { createStory } from './story.js';
import { mushroomPickup } from './models.js';
import { MAP, LEVEL, SPAWN, FIT_HEIGHT, MUSHROOM_HIDING } from './layout.js';

export default {
  id: 'forest',
  name: '童话森林',
  emoji: '🍄',
  style: 'toon',
  styleLabel: '童话风',
  magnetStyle: 'toon',
  // 溪水声和隔一会儿的鸟叫
  ambient: 'forest',
  // 午后：天是淡蓝的，往下暖起来
  bg: 'linear-gradient(180deg, #a9dcff 0%, #e4f4ff 45%, #fff0da 100%)',
  // 午后偏暖的太阳从左前方斜照过来：朝镜头的一面亮，影子往右后方拖长；天光偏冷一点，暗面不发灰
  lights: {
    hemi: ['#dcecff', '#b0d98f', 1.5],
    sun: ['#ffe2b3', 2.9, [-7, 9, 6]],
  },
  camera: { pos: [11.5, 11, 14.5], target: [0, 0.6, 0], fitH: FIT_HEIGHT, min: 2.5 },
  terrain: { map: MAP, level: LEVEL },
  spawn: SPAWN,
  // 第一次进来时主动打招呼：魔法停了时和修好以后各一句
  // 修好以后那句用原来的 key（世界的 id），改版以前就来过的人不会再听一遍；魔法停了时已经见过波波的，修好以后也不再说
  greet: (world) =>
    world.restored
      ? { name: '波波', text: '欢迎来到童话森林～听说林子里藏着几样“像素的东西”。', seenWith: ['forest:broken'] }
      : { key: 'forest:broken', name: '波波', text: '啊，你来啦！森林的魔法停了……桥塌了，池塘里的踏脚石也沉了下去。你是从小屋来的吗？我们丢的东西，会不会在你那儿？' },
  next: 'pixel',
  // 破败世界：到的时候魔法停了，要先把小屋里找到的东西放回原处
  brokenGoal: '森林的魔法停了！四处找找，哪里少了从 <b>「我的小屋」</b> 带来的东西',
  repairs: [
    { id: 'book', from: 'home', hint: '小土坡上，蘑菇仔身边的树桩', msg: '蘑菇仔讲起了故事' },
    { id: 'mushroom', from: 'home', hint: '小溪上塌下去的桥底下', msg: '它一下长成了桥墩' },
    { id: 'star', from: 'home', hint: '山顶高塔的塔尖（先得过桥）', msg: '森林的魔法回来了' },
  ],
  // 森林的材料：灌木丛、树桩、落叶堆里翻出来的小蘑菇，以后回家合成用
  materials: [{ id: 'mushroom', name: '小蘑菇', icon: '🍄', make: mushroomPickup }],
  // 每次进来藏在哪：灌木丛、树桩、落叶堆，都要翻找
  scatter: MUSHROOM_HIDING,
  items: [
    {
      id: 'coin',
      name: '像素金币',
      icon: '🪙',
      hint: '池塘里，踏脚石拐弯那儿的荷叶上',
      make(kit) {
        return kit.pixelArt(
          ['..###..', '.#yyy#.', '#yy#yy#', '#yy#yy#', '#yy#yy#', '.#yyy#.', '..###..'],
          { '#': '#c98a12', y: '#ffd23f' },
          0.045,
          0.06,
          { '#ffd23f': { emissive: '#ffb800', emissiveIntensity: 0.4 } },
        );
      },
    },
    {
      id: 'heart',
      name: '像素爱心',
      icon: '❤️',
      hint: '空心的木头里',
      make(kit) {
        return kit.pixelArt(
          ['.rr.rr.', 'rwrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
          { r: '#ff4d6d', w: '#ffffff' },
          0.04,
          0.06,
          { '#ff4d6d': { emissive: '#ff4d6d', emissiveIntensity: 0.5 } },
        );
      },
    },
    {
      id: 'cartridge',
      name: '游戏卡带',
      icon: '🎮',
      hint: '山顶高塔背后的花丛',
      make(kit) {
        const group = new THREE.Group();
        group.add(kit.box(0.26, 0.3, 0.06, '#8c8c9c', 0.02));
        const label = kit.box(0.2, 0.15, 0.02, '#ff6b8b', 0.01, { emissive: '#ff6b8b', emissiveIntensity: 0.3 });
        group.add(at(label, 0, 0.03, 0.035));

        // 底下一排金手指
        const pins = 4;
        for (let i = 0; i < pins; i++) {
          group.add(at(kit.box(0.03, 0.04, 0.02, '#ffd84a', 0.005), -0.06 + i * 0.04, -0.12, 0.035));
        }
        group.add(at(kit.box(0.22, 0.02, 0.07, '#6f6f80', 0.005), 0, 0.12, 0));
        return group;
      },
    },
  ],
  build(world) {
    const ground = buildGround(world);
    const village = buildVillage(world);
    buildPond(world, ground);
    const hill = buildHill(world);
    buildForage(world);
    // 树墙、花、草要避开前面摆好的东西，最后种
    const woods = buildWoods(world);
    buildScenery(world);
    const people = createPeople(world);
    const splashes = createSplashes(world, ground.waterSurface);
    const life = bringToLife(world, { crowns: woods.crowns, waterSurface: ground.waterSurface, splashes });
    createTouch(world, { houses: village.houses, splashes });
    // 主线最后搭：桥和踏脚石挡路的格子不能影响前面的树和花往哪儿长
    createStory(world, { ground, village, hill, people, life, splashes });
  },
};
