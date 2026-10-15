// 地形测试场景：试试“高度一层 0.5”走起来怎么样。不在冰箱上，只能用网址打开：
//   ?test=terrain            一层 0.5
//   ?test=terrain&level=0.4  换个层高对比
import * as THREE from 'three';
import { at } from '../kit.js';

const level = +new URLSearchParams(location.search).get('level') || 0.5;

// 上面是远处，下面是镜头这边。左上是两层高的小山，围着一圈一层的高台；
// 右边有一块两层高的石台直接立在平地上（对比一层、两层的崖）；右下是池塘和桥
const MAP = [
  '22222111000000',
  '22222111000000',
  '22222<11000000',
  '22222111022000',
  '11111111022000',
  '11111111<00000',
  '11111111000000',
  '111^1111000000',
  '00000000~~~~00',
  '00000000~~~~00',
  '00000000====00',
  '00000000~~~~00',
  '00000000000000',
  '00000000000000',
];

function tree(w, x, z, s = 1) {
  const k = w.kit;
  const y = w.heightAt(x, z);
  const g = new THREE.Group();
  g.add(at(k.cyl(0.08 * s, 0.11 * s, 0.7 * s, '#9a6b43', 10), 0, 0.35 * s, 0));
  g.add(at(k.sphere(0.42 * s, '#7fc96b', 16), 0, 0.95 * s, 0));
  g.add(at(k.sphere(0.3 * s, '#93d67c', 14), 0.18 * s, 1.25 * s, 0.05 * s));
  w.add(g, x, y, z);
  w.solidCircle(x, z, 0.16 * s);
}

function hut(w, x, z) {
  const k = w.kit;
  const y = w.heightAt(x, z);
  const g = new THREE.Group();
  g.add(at(k.box(1.4, 1.0, 1.2, '#fff3dd', 0.06), 0, 0.5, 0));
  const roof = k.cone(1.15, 0.7, '#e2795f', 4);
  roof.rotation.y = Math.PI / 4;
  g.add(at(roof, 0, 1.35, 0));
  g.add(at(k.box(0.36, 0.6, 0.06, '#a0663a', 0.03), 0, 0.3, 0.61));
  w.add(g, x, y, z);
  w.solid(g, 0.02);
}

export default {
  id: 'terrainTest',
  test: true,
  name: '地形测试',
  emoji: '🧪',
  style: 'toon',
  styleLabel: `高度一层 ${level}`,
  magnetStyle: 'toon',
  bg: 'linear-gradient(180deg, #bfe9ff 0%, #e6f6ff 50%, #ffe3f1 100%)',
  lights: {
    hemi: ['#e8f7ff', '#b5e39a', 1.9],
    sun: ['#fffbe8', 2.6, [6, 12, 5]],
  },
  camera: { pos: [11.5, 11, 14.5], target: [0, 0.6, 0], fitH: level * 2 + 1.5, maxPolar: 1.32, min: 2.5 },
  terrain: { map: MAP, level },
  spawn: [-1.5, 5.5],
  next: 'home',
  items: [],
  build(w) {
    w.terrain.build(w);
    // 高台、小山上种几棵树，平地上一间小屋，看看比例
    tree(w, -5.5, -5.5, 1.1);
    tree(w, -3.6, -6.2);
    tree(w, -6.3, -1.8, 0.9);
    tree(w, -1.5, -3.2);
    tree(w, 5.6, -5.4);
    tree(w, 6.2, 5.8, 0.9);
    hut(w, 3.0, -5.2);
    w.villager({ name: '小坡', lines: ['这块高台走上去刚刚好～', '从台阶上去，不然爬不上来哦。'], look: { shirt: '#f2a65a', hat: 'beanie', hatColor: '#6b8fd6' } }, -3.5, -1.5);
    w.villager({ name: '阿桥', lines: ['桥两边掉不下去的，放心走。', '那块两层高的石台，只能看不能上去。'], look: { shirt: '#6bb3d6', hair: '#3d2b1f' } }, 4.5, 5.5);
  },
};
