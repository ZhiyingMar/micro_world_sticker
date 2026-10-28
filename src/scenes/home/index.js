// 我的小屋 —— 动森风的温馨房间，起始世界
// 只有后墙和左墙两面墙，镜头从右前方斜着看进来；外面一圈花园只是看的，人走不出屋子
//
// 文件分工：
//   layout.js     房子多大、镜头怎么看、工作台摆在哪、花园多大
//   room.js       地板、两面墙（后墙开了窗洞）、墙上的画和时钟；换壁纸地板时换它们的贴图
//   window.js     窗户的模型：窗框、玻璃、窗台、窗帘
//   materials.js  家具共用的材质：和地板一样的木纹、拼布被子、毛线坐垫、编织地毯、藤编
//   furniture-models.js  家具的模型（只造不摆）：床、灯、书架、厨房、冰箱、茶桌、凳子、盆栽、收音机柜……
//   furniture.js  把家具摆进屋里，登记碰撞和兴趣点（凳子挡人，小人一步坐上去）
//   workbench.js  工作台：走过去按 E 换壁纸、地板
//   eaves.js      墙顶的房檐
//   garden.js     屋外一圈花园：篱笆院门、小路和台阶、几种树和灌木、窗外的向日葵、成簇的花、草丛、蝴蝶、风
//   garden-ground.js  花园的地面：圆角的草地方块、深浅草色和土路、侧面的土层和小石头
//   garden-models.js  花园里的小模型：尖头篱笆、院门、信箱、向日葵、木台阶、踏脚石
//   garden-path.js    小路在哪：连成曲线，算一点离路多远
//   cat.js        毛线篮旁边睡觉的小猫：呼吸、甩尾巴，人走近会抬头"喵"一声
//   puffs.js      软软的一小团雾：茶壶的热气
//   life.js       窗帘轻轻晃、茶壶冒热气、收音机飘音符
//   touch.js      碰一下会有反应：踢毛线球会滚、木地板和地毯上不一样的脚步声
//   people.js     居民和台词
//   daylight.js   小屋的一天：按钟点（设置里选跟着现在或快进）换光、背景色、星星
import * as THREE from 'three';
import { at } from '../../kit.js';
import { buildRoom } from './room.js';
import { placeCat } from './cat.js';
import { createPuffs } from './puffs.js';
import { bringToLife } from './life.js';
import { createTouch } from './touch.js';
import { buildFurniture } from './furniture.js';
import { createFurnitureKit } from './materials.js';
import { placeWorkbench } from './workbench.js';
import { placeEaves } from './eaves.js';
import { placeGarden } from './garden.js';
import { createPeople } from './people.js';
import { bringDayAndNight } from './daylight.js';
import {
  CAMERA_POS,
  CAMERA_TARGET,
  CAMERA_TURN,
  CAMERA_TILT,
  CAMERA_START_TILT,
  CAMERA_AZIMUTH,
  ROOM_SIZE,
  CAMERA_MIN_DISTANCE,
  GARDEN_SIZE,
  BOUNDS,
  SPAWN,
} from './layout.js';

export default {
  id: 'home',
  name: '我的小屋',
  emoji: '🏠',
  style: 'cozy',
  styleLabel: '动森风 · 起点',
  magnetStyle: 'cozy',
  // 屋里很安静，窗外有鸟叫
  ambient: 'home',
  bg: 'radial-gradient(circle at 50% 30%, #fff6e3 0%, #f8dfc0 55%, #ecc39c 100%)',
  // 下午两点的光：午后的暖光从左前方斜照进来，家具朝镜头的一面亮，影子往右后方拖；天光偏冷一点，暗面不发灰
  // 进来以后 daylight.js 按钟点换成别的时刻的光，这里只是搭建前先打上的那一套
  lights: {
    hemi: ['#eaf0ff', '#d6b088', 1.6],
    sun: ['#ffe2b3', 2.7, [-4, 11, 8]],
  },
  // 拉远最多到屋子填满画面（花园只在边上露一点），拉近随意，转动只在斜着看的一小段里
  camera: {
    pos: CAMERA_POS,
    target: CAMERA_TARGET,
    fitH: 4.4,
    minAz: CAMERA_AZIMUTH - CAMERA_TURN,
    maxAz: CAMERA_AZIMUTH + CAMERA_TURN,
    minPolar: CAMERA_TILT[0],
    maxPolar: CAMERA_TILT[1],
    startAz: CAMERA_AZIMUTH,
    startPolar: CAMERA_START_TILT,
    fitSize: ROOM_SIZE,
    min: CAMERA_MIN_DISTANCE,
  },
  // 整个方块算上花园；人只能在屋里走（bounds），走不到花园里
  size: [GARDEN_SIZE, GARDEN_SIZE],
  bounds: BOUNDS,
  spawn: SPAWN,
  // 第一次进来时，这个小人会主动打招呼
  greet: { name: '小橘', text: '你醒啦！冰箱上的每一块冰箱贴里，都藏着一个小世界哦。先在屋里找找 3 样亮晶晶的东西吧～' },
  next: 'forest',
  items: [
    {
      id: 'mushroom',
      name: '红蘑菇',
      icon: '🍄',
      hint: '绿意盎然的地方',
      make(k) {
        const g = new THREE.Group();
        g.add(at(k.cyl(0.045, 0.06, 0.12, '#fff3dd', 12), 0, 0.06, 0));
        const cap = k.dome(0.11, '#e8443a', Math.PI / 2, 20, { emissive: '#e8443a', emissiveIntensity: 0.25 });
        cap.scale.y = 0.8;
        g.add(at(cap, 0, 0.1, 0));
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          g.add(at(k.sphere(0.022, '#ffffff', 8), Math.cos(a) * 0.07, 0.16, Math.sin(a) * 0.07));
        }
        g.add(at(k.sphere(0.022, '#ffffff', 8), 0, 0.19, 0));
        g.scale.setScalar(1.3);
        return g;
      },
    },
    {
      id: 'book',
      name: '童话书',
      icon: '📖',
      hint: '睡觉的地方，低头看看',
      make(k) {
        const g = new THREE.Group();
        g.add(k.box(0.34, 0.07, 0.26, '#8a5ad6', 0.02, { emissive: '#8a5ad6', emissiveIntensity: 0.2 }));
        g.add(at(k.box(0.31, 0.05, 0.24, '#fffaf0', 0.01), 0.02, 0, 0));
        const st = k.star(0.06, '#ffd84a', 0.02, { emissive: '#ffd84a', emissiveIntensity: 0.6 });
        st.rotation.x = -Math.PI / 2;
        g.add(at(st, 0, 0.045, 0));
        g.rotation.y = 0.4;
        return g;
      },
    },
    {
      id: 'star',
      name: '魔法星星',
      icon: '⭐',
      hint: '高高的、凉凉的地方',
      make(k) {
        return k.star(0.16, '#ffd84a', 0.07, { emissive: '#ffc83a', emissiveIntensity: 0.7 });
      },
    },
  ],
  build(world) {
    const room = buildRoom(world);
    placeEaves(world);
    placeGarden(world);
    const furnitureKit = createFurnitureKit(world);
    const furniture = buildFurniture(world, furnitureKit);
    placeWorkbench(world, room, furnitureKit);
    placeCat(world);

    world.placeItem('mushroom', -3.86, 0.6, 1.66, { spin: false });
    world.placeItem('book', -2.55, 0.06, -2.5, { spin: false });
    world.placeItem('star', 3.95, 2.5, -4.0);

    createPeople(world);
    const puffs = createPuffs(world);
    bringToLife(world, { curtains: room.curtains, spout: furniture.spout, radio: furniture.radio, puffs });
    createTouch(world);
    bringDayAndNight(world, { room });
  },
};
