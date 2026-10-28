// 像素小镇 —— 建在缓坡上的方块小镇：风车、两座房子、喷泉广场、池塘和小瀑布，一层层台地用台阶连起来
// 像素感来自体素地形、体素模型和方块小人；画面本身和别的世界一样按屏幕分辨率渲染，头顶的气泡、字都是清楚的
//
// 文件分工：
//   layout.js    地形文字地图、各处东西的位置
//   paths.js     土路和广场在哪，一点离路多远
//   ground.js    地面：小体素画的草地、土路、石板广场（src/terrain-voxel.js 画）
//   models.js    模型（只造不摆）：房子、风车、喷泉、路灯、长椅、木箱、栅栏、稻草人、菜、小鸡……
//   plants.js    体素树、灌木、方块小花和草丛（只造不摆）
//   town.js      房子、风车、喷泉广场、路灯、长椅；小月亮在喷泉里，小出租车在蓝屋子后头
//   garden.js    左前的菜园：白栅栏、菜畦、稻草人，栅栏外的矮苹果树和萨克斯
//   pond.js      右前的池塘：荷叶、芦苇、石头，台地上流下来的瀑布
//   woods.js     显眼的几棵树、四周的树墙、会沙沙响的灌木
//   scenery.js   一簇簇的花、满地草丛
//   water.js     会动的水：喷泉喷水、瀑布流、鱼跳、荷叶晃（波纹和水珠用 src/splashes.js 的方块样子）
//   life.js      风吹树冠和稻草人、风车转、烟囱冒烟、云飘过、蝴蝶
//   chickens.js  几只小鸡：转悠、啄地，人走近会扑腾着跑开
//   bits.js      蹦出来的小方块：羽毛、叶子
//   touch.js     碰一下会有反应：台阶上一步一个音，撞灌木沙沙响，贴着喷泉走溅水
//   people.js    居民和台词
import * as THREE from 'three';
import { at } from '../../kit.js';
import { buildGround } from './ground.js';
import { buildTown } from './town.js';
import { buildGarden } from './garden.js';
import { buildPond } from './pond.js';
import { buildWoods } from './woods.js';
import { buildScenery } from './scenery.js';
import { createWaterLife } from './water.js';
import { bringToLife } from './life.js';
import { createChickens } from './chickens.js';
import { createBits } from './bits.js';
import { createTouch } from './touch.js';
import { createPeople } from './people.js';
import { createSplashes } from '../../splashes.js';
import { MAP, LEVEL, SPAWN, FIT_HEIGHT, SUN } from './layout.js';

export default {
  id: 'pixel',
  name: '像素小镇',
  emoji: '👾',
  style: 'pixel',
  styleLabel: 'PIXEL · 8-BIT',
  magnetStyle: 'pixel',
  // 轻轻的风声，隔一会儿 8-bit 的鸟叫
  ambient: 'pixel',
  // 8-bit 的天：一条条色带，从上面的深蓝到下面午后的暖色
  bg: 'linear-gradient(180deg, #4f86ff 0%, #4f86ff 18%, #6d9dff 18%, #6d9dff 36%, #8fb5ff 36%, #8fb5ff 54%, #b6ceff 54%, #b6ceff 70%, #ffe3c7 70%, #ffe3c7 100%)',
  // 午后偏暖的太阳从左前方斜照：朝镜头的一面亮，影子往右后方拖；天光偏冷一点，暗面不发灰
  lights: {
    hemi: ['#d8e8ff', '#8fca6a', 1.45],
    sun: SUN,
  },
  camera: { pos: [11.5, 11, 14.5], target: [0, 0.6, 0], fitH: FIT_HEIGHT, min: 2.5 },
  terrain: { map: MAP, level: LEVEL },
  spawn: SPAWN,
  // 第一次进来时，这个小人会主动打招呼
  greet: { name: '方方', text: '欢迎来到像素小镇！这里一切都是方的，包括我的脑袋。' },
  next: 'city',
  items: [
    {
      id: 'moon',
      name: '小月亮',
      icon: '🌙',
      hint: '会冒水的地方',
      make(kit) {
        return kit.pixelArt(
          ['..yyyy.', '.yyy...', 'yyy....', 'yyy....', 'yyy....', '.yyy...', '..yyyy.'],
          { y: '#ffe680' },
          0.045,
          0.06,
          { '#ffe680': { emissive: '#ffd84a', emissiveIntensity: 0.7 } },
        );
      },
    },
    {
      id: 'taxi',
      name: '小出租车',
      icon: '🚕',
      hint: '蓝屋顶房子的后头',
      make(kit) {
        const group = new THREE.Group();
        group.add(at(kit.box(0.4, 0.12, 0.22, '#ffd23f', { emissive: '#ffd23f', emissiveIntensity: 0.25 }), 0, 0.1, 0));
        group.add(at(kit.box(0.22, 0.1, 0.2, '#ffd23f'), -0.02, 0.21, 0));
        group.add(at(kit.box(0.23, 0.07, 0.21, '#3a4a6a'), -0.02, 0.21, 0));
        group.add(at(kit.box(0.1, 0.04, 0.06, '#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), -0.02, 0.28, 0));
        const wheels = [
          [0.12, 0.11],
          [-0.12, 0.11],
          [0.12, -0.11],
          [-0.12, -0.11],
        ];
        for (const [x, z] of wheels) {
          group.add(at(kit.box(0.08, 0.08, 0.04, '#222222'), x, 0.04, z));
        }
        group.add(at(kit.box(0.02, 0.04, 0.16, '#fff4c8', { emissive: '#fff4c8', emissiveIntensity: 1 }), 0.2, 0.11, 0));
        return group;
      },
    },
    {
      id: 'sax',
      name: '萨克斯',
      icon: '🎷',
      hint: '树荫下的草地',
      make(kit) {
        return kit.pixelArt(
          ['.....d', '....g.', '....g.', '....g.', '....g.', '.g..g.', 'gg..g.', 'ggggg.', '.ggg..'],
          { g: '#f2b632', d: '#3a3a3a' },
          0.04,
          0.06,
          { '#f2b632': { emissive: '#f2b632', emissiveIntensity: 0.4 } },
        );
      },
    },
  ],
  build(world) {
    const ground = buildGround(world);
    const town = buildTown(world, ground);
    const garden = buildGarden(world);
    const pond = buildPond(world, ground);
    // 树墙、花、草要避开前面摆好的东西，最后种
    const woods = buildWoods(world);
    const scenery = buildScenery(world);
    createPeople(world);

    const splashes = createSplashes(world, ground.waterSurface, { square: true });
    const bits = createBits(world);
    createWaterLife(world, { fountain: town.fountain, waterfall: pond.waterfall, pads: pond.pads, waterSurface: ground.waterSurface, splashes });
    bringToLife(world, {
      crowns: [...woods.crowns, ...garden.crowns],
      swaying: [...garden.swaying, ...pond.reeds],
      blades: town.blades,
      chimneys: town.chimneys,
      gardens: scenery.gardens,
    });
    createChickens(world, bits);
    createTouch(world, { bushes: woods.bushes, fountain: town.fountain, splashes, bits });
  },
};
