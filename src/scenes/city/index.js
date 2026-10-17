// 霓虹夜都 —— 夜晚的都市街区：亮灯的高楼、便利店、霓虹招牌、会礼让斑马线的小车
// 刚到的时候全城停电：要把从像素小镇带来的月亮、出租车、萨克斯放回原处，城市才会一点点亮起来
//
// 文件分工：
//   layout.js     地形文字地图、各处东西的位置
//   models.js     模型（只造不摆）
//   power.js      三路电力，各处的灯登记在上面
//   sky.js / back-row.js / street.js / park.js   搭场景
//   traffic.js    车流
//   people.js     居民和台词
//   story.js      主线：修复点、售货机、叫醒司机、藏起来的东西
//   tower-game.js 大楼俄罗斯方块和围观的人
import * as THREE from 'three';
import { at } from '../../kit.js';
import { createPower } from './power.js';
import { buildSky } from './sky.js';
import { buildBackRow } from './back-row.js';
import { buildStreet } from './street.js';
import { buildPark } from './park.js';
import { createTraffic } from './traffic.js';
import { createStory } from './story.js';
import { createTowerGame } from './tower-game.js';
import { MAP, LEVEL, PARK_ROW, TERRACE_COL, SPAWN } from './layout.js';

// 地面颜色：人行道灰色，坡上的公园是草地，天台铺浅色地砖
function groundColor(i, j, level) {
  if (level >= 1 && j >= PARK_ROW) return '#3d6b55';
  if (level >= 1 && i >= TERRACE_COL) return '#a9adbd';
  return '#8f93a3';
}

export default {
  id: 'city',
  name: '霓虹夜都',
  emoji: '🌃',
  style: 'cozy',
  styleLabel: '都市风 · 夜晚',
  magnetStyle: 'city',
  ambient: 'city',
  bg: 'radial-gradient(ellipse at 30% 10%, #3b4282 0%, #1d2148 45%, #0d0f26 100%)',
  lights: {
    hemi: ['#6a78c0', '#1e2238', 1.0],
    sun: ['#aab8ff', 0.9, [-6, 10, 5]],
  },
  camera: { pos: [11.5, 11, 14.5], target: [0, 1, 0], fitH: 4, maxPolar: 1.3, min: 2.5 },
  terrain: { map: MAP, level: LEVEL },
  spawn: SPAWN,
  // 第一次进来时主动打招呼：停电时和修好以后各一句（key 不同，各说一次）
  greet: (w) =>
    w.restored
      ? { key: 'city:restored', name: '老乔', text: '又见面啦！今晚这首爵士，送给把灯点亮的你。' }
      : { key: 'city:broken', name: '夜猫', text: '啊，有人来了！停电了，整座城一下子全黑了……你能帮帮我们吗？' },
  next: 'london',
  // 破败世界：到的时候停电了，要先把上一个世界带来的东西放回原处
  brokenGoal: '停电了！四处找找，哪里少了从 <b>「像素小镇」</b> 带来的东西',
  repairs: [
    { id: 'moon', from: 'pixel', hint: '便利店后面空着的杆子', msg: '月光照进了小巷' },
    { id: 'taxi', from: 'pixel', hint: '马路边的出租车停靠位' },
    { id: 'sax', from: 'pixel', hint: '关着门的 BAR 门口', msg: '音乐响起来了' },
  ],
  items: [
    {
      id: 'umbrella',
      name: '红雨伞',
      icon: '🌂',
      hint: '坡上公园的树丛里',
      make(k) {
        const g = new THREE.Group();
        const canopy = k.mesh(new THREE.ConeGeometry(0.2, 0.12, 8, 1, true), k.m('#e8443a', { emissive: '#e8443a', emissiveIntensity: 0.35, side: THREE.DoubleSide }));
        canopy.position.y = 0.3;
        g.add(canopy);
        g.add(at(k.cyl(0.01, 0.01, 0.34, '#3a3a3a', 6), 0, 0.17, 0));
        const hook = k.torus(0.035, 0.01, '#6b4f3a');
        g.add(at(hook, 0.035, 0, 0));
        g.rotation.z = 0.35;
        return g;
      },
    },
    {
      id: 'tophat',
      name: '绅士礼帽',
      icon: '🎩',
      hint: '坡上公园的长椅上',
      make(k) {
        const g = new THREE.Group();
        g.add(at(k.cyl(0.09, 0.095, 0.16, '#26262e', 16), 0, 0.1, 0));
        g.add(at(k.cyl(0.15, 0.15, 0.015, '#26262e', 18), 0, 0.02, 0));
        g.add(at(k.cyl(0.097, 0.097, 0.035, '#e8443a', 16, { emissive: '#e8443a', emissiveIntensity: 0.5 }), 0, 0.05, 0));
        return g;
      },
    },
    {
      id: 'teapot',
      name: '红茶壶',
      icon: '🫖',
      hint: '大楼和便利店之间的小巷',
      make(k) {
        const g = new THREE.Group();
        const body = k.sphere(0.12, '#f4f1ea', 18, { emissive: '#ffffff', emissiveIntensity: 0.15 });
        body.scale.y = 0.8;
        g.add(at(body, 0, 0.1, 0));
        g.add(at(k.cyl(0.122, 0.122, 0.03, '#3d6fd6', 18), 0, 0.1, 0));
        g.add(at(k.sphere(0.03, '#3d6fd6', 8), 0, 0.21, 0));
        const spout = k.cyl(0.015, 0.03, 0.13, '#f4f1ea', 8);
        spout.rotation.z = -0.8;
        g.add(at(spout, 0.14, 0.13, 0));
        const handle = k.torus(0.05, 0.015, '#f4f1ea');
        g.add(at(handle, -0.13, 0.11, 0));
        return g;
      },
    },
  ],
  build(w) {
    w.terrain.build(w, { grass: groundColor, dirt: '#4a4e5e', steps: ['#b3b7c6', '#9a9eae'] });
    const power = createPower(w);
    buildSky(w, power);
    const backRow = buildBackRow(w, power);
    buildStreet(w, power);
    buildPark(w);
    const traffic = createTraffic(w, power);
    const story = createStory(w, { power, backRow, traffic });
    createTowerGame(w, { power, tower: backRow.tower, story });
    story.refreshLines();
  },
};
