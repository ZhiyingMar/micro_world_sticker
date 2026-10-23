// 童话森林 —— 蘑菇屋、山顶的高塔、踏脚石过池塘，卡通着色
// 小山和池塘把森林分成左右两半，只有池塘里的踏脚石和小溪上的桥能过去
//
// 文件分工：
//   layout.js    地形文字地图、各处东西的位置
//   models.js    模型（只造不摆）
//   village.js   左后角的蘑菇屋村
//   pond.js      池塘和小溪：岸边石头、荷叶，荷叶上的金币
//   hill.js      右后角的小山：高塔、塔背后的花丛和卡带
//   woods.js     树、空心木头（爱心在里面）、栅栏
//   forage.js    灌木丛、树桩、落叶堆：能翻的地方，每次进来随机长小蘑菇
//   scenery.js   小路石板、满地小花、侧面小石头、萤火虫（最后撒，避开前面摆好的东西）
//   people.js    居民和台词
import * as THREE from 'three';
import { at } from '../../kit.js';
import { buildVillage } from './village.js';
import { buildPond } from './pond.js';
import { buildHill } from './hill.js';
import { buildWoods } from './woods.js';
import { buildForage } from './forage.js';
import { buildScenery } from './scenery.js';
import { createPeople } from './people.js';
import { mushroomPickup } from './models.js';
import { MAP, LEVEL, SPAWN, FIT_HEIGHT, MUSHROOM_HIDING } from './layout.js';

export default {
  id: 'forest',
  name: '童话森林',
  emoji: '🍄',
  style: 'toon',
  styleLabel: '童话风',
  magnetStyle: 'toon',
  bg: 'linear-gradient(180deg, #bfe9ff 0%, #e6f6ff 50%, #ffe3f1 100%)',
  lights: {
    hemi: ['#e8f7ff', '#b5e39a', 1.9],
    sun: ['#fffbe8', 2.6, [6, 12, 5]],
  },
  camera: { pos: [11.5, 11, 14.5], target: [0, 0.6, 0], fitH: FIT_HEIGHT, min: 2.5 },
  terrain: { map: MAP, level: LEVEL },
  spawn: SPAWN,
  // 第一次进来时，这个小人会主动打招呼
  greet: { name: '波波', text: '哇，新面孔！欢迎来到童话森林～听说这里藏着几样“像素的东西”。' },
  next: 'pixel',
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
    world.terrain.build(world);
    buildVillage(world);
    buildPond(world);
    buildHill(world);
    buildWoods(world);
    buildForage(world);
    buildScenery(world);
    createPeople(world);
  },
};
