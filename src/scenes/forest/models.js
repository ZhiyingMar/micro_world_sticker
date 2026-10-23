// 童话森林用到的模型：只负责造出来。摆在哪、挡不挡路、藏不藏东西，由用它的地方决定
// 原点都在底面中心，正面（门、开口）朝 +z，另有说明的除外
import * as THREE from 'three';
import { at, rng } from '../../kit.js';

// 菌盖压扁一点，像一顶圆帽子
const CAP_FLATTEN = 0.75;
// 菌盖上撒几个白点
const CAP_DOTS = 9;
// 高塔底下有多粗：摆的地方按这个登记碰撞
export const TOWER_BASE_RADIUS = 0.85;

/**
 * 蘑菇屋：奶油色的菌柄是墙，圆圆的菌盖是屋顶，上面撒着白点；门和一扇亮着的圆窗朝 +z
 * @param {Kit} kit
 * @param {object} options
 * @param {number} options.stemRadius 菌柄（墙）的半径
 * @param {number} options.stemHeight 菌柄有多高
 * @param {number} options.capRadius 菌盖的半径
 * @param {string} options.capColor 菌盖的颜色
 * @param {number} options.seed 白点怎么撒，同一个数每次都一样
 * @returns {{ group: THREE.Group, cap: THREE.Group }} cap 是整个菌盖（原点在菌盖底面），碰一下时让它弹
 */
export function mushroomHouse(kit, { stemRadius, stemHeight, capRadius, capColor, seed }) {
  const group = new THREE.Group();
  group.add(at(kit.cyl(stemRadius * 0.9, stemRadius, stemHeight, '#fff3dd', 24), 0, stemHeight / 2, 0));

  // 菌盖坐在菌柄顶上往下一点，底下一圈浅色的菌褶；菌盖、菌褶、白点放在一组里一起弹
  const cap = new THREE.Group();
  cap.position.y = stemHeight - 0.1;
  const dome = kit.dome(capRadius, capColor, Math.PI / 2, 28);
  dome.scale.y = CAP_FLATTEN;
  cap.add(dome);
  cap.add(at(kit.cyl(capRadius * 0.98, capRadius * 0.6, 0.12, '#f7e3c3', 28), 0, -0.02, 0));
  for (const dot of capDots(kit, capRadius, seed)) {
    cap.add(dot);
  }
  group.add(cap);

  // 门、门把手
  group.add(at(kit.box(stemRadius * 0.6, stemHeight * 0.55, 0.12, '#a0663a', 0.08), 0, stemHeight * 0.275, stemRadius * 0.93));
  group.add(at(kit.sphere(0.035, '#ffd84a', 8), stemRadius * 0.18, stemHeight * 0.28, stemRadius * 0.93 + 0.07));

  // 门旁边一扇亮着的圆窗，贴着墙转过去一点
  const windowAngle = 0.9;
  const roundWindow = kit.cyl(0.13, 0.13, 0.06, '#ffe9a8', 16, { emissive: '#ffd27a', emissiveIntensity: 0.6 });
  roundWindow.rotation.x = Math.PI / 2;
  roundWindow.rotation.y = windowAngle;
  group.add(at(roundWindow, Math.sin(windowAngle) * stemRadius * 0.95, stemHeight * 0.62, Math.cos(windowAngle) * stemRadius * 0.95));
  return { group, cap };
}

/**
 * 菌盖上的白点：随机撒在菌盖表面，压扁了贴着菌盖
 * @param {Kit} kit
 * @param {number} capRadius 菌盖的半径
 * @param {number} seed 随机种子
 * @returns {THREE.Mesh[]} 位置以菌盖底面中心为原点
 */
function capDots(kit, capRadius, seed) {
  const random = rng(seed);
  const dots = [];

  for (let i = 0; i < CAP_DOTS; i++) {
    const around = random() * Math.PI * 2;
    const elevation = 0.25 + random() * 0.9;
    const dot = kit.sphere(capRadius * (0.1 + random() * 0.06), '#ffffff', 12);
    dot.position.set(
      Math.cos(around) * Math.cos(elevation) * capRadius,
      Math.sin(elevation) * capRadius * CAP_FLATTEN,
      Math.sin(around) * Math.cos(elevation) * capRadius,
    );
    dot.scale.set(1, 0.35, 1);

    // 让压扁的那面贴着菌盖：朝菌盖表面的法线方向看过去，再转平
    dot.lookAt(dot.position.x * 2, dot.position.y * 3, dot.position.z * 2);
    dot.rotateX(Math.PI / 2);
    dots.push(dot);
  }
  return dots;
}

/**
 * 童话高塔：淡紫色的圆塔，顶上一圈垛口、粉色尖顶和一面小旗；门和两扇亮着的窗朝 +z
 * @param {Kit} kit
 * @returns {{ group: THREE.Group, flag: THREE.Group }} flag 是小旗，绕着旗杆转，用的地方让它飘
 */
export function fairyTower(kit) {
  const group = new THREE.Group();
  const wallHeight = 2.6;
  group.add(at(kit.cyl(0.75, TOWER_BASE_RADIUS, wallHeight, '#d4c6f5', 24), 0, wallHeight / 2, 0));

  // 一圈垛口
  const merlons = 8;
  for (let i = 0; i < merlons; i++) {
    const angle = (i / merlons) * Math.PI * 2;
    group.add(at(kit.box(0.22, 0.25, 0.22, '#c4b3ef', 0.04), Math.cos(angle) * 0.72, wallHeight + 0.1, Math.sin(angle) * 0.72));
  }

  // 尖顶、旗杆、小旗（小旗挂在旗杆上，绕着旗杆摆）
  group.add(at(kit.cone(1.0, 1.4, '#f6a6c8', 24), 0, 3.45, 0));
  group.add(at(kit.cyl(0.015, 0.015, 0.5, '#8a6a4a', 6), 0, 4.35, 0));
  const flag = new THREE.Group();
  flag.add(at(kit.box(0.3, 0.18, 0.02, '#ffd84a', 0.01), 0.16, 0, 0));
  group.add(at(flag, 0, 4.5, 0));

  // 门和两扇窗
  group.add(at(kit.box(0.42, 0.7, 0.1, '#8a5a3a', 0.1), 0, 0.35, 0.82));
  for (const windowY of [1.3, 2.05]) {
    const towerWindow = kit.box(0.22, 0.32, 0.08, '#ffe9a8', 0.08, { emissive: '#ffd27a', emissiveIntensity: 0.6 });
    group.add(at(towerWindow, 0, windowY, 0.8));
  }
  return { group, flag };
}

/**
 * 空心木头：横躺着，沿 x 方向，两头是空的能往里看；顶上一团青苔
 * @param {Kit} kit
 * @param {object} options
 * @param {number} options.radius 木头的半径
 * @param {number} options.length 木头多长
 * @returns {THREE.Group} 原点在底面中间
 */
export function hollowLog(kit, { radius, length }) {
  const group = new THREE.Group();

  // 两头不封口的圆筒，里面也要画，往里看才看得见里面
  const shell = kit.mesh(new THREE.CylinderGeometry(radius, radius, length, 20, 1, true), '#a0663a', { side: THREE.DoubleSide });
  shell.rotation.z = Math.PI / 2;
  group.add(at(shell, 0, radius, 0));

  // 两头一圈浅色的年轮
  for (const end of [-1, 1]) {
    const ring = kit.torus(radius - 0.04, 0.05, '#e3b787');
    ring.rotation.y = Math.PI / 2;
    group.add(at(ring, (end * length) / 2, radius, 0));
  }

  const moss = kit.sphere(0.22, '#8fd17f', 12);
  moss.scale.set(1.6, 0.5, 1);
  group.add(at(moss, -length * 0.2, radius * 2 - 0.04, 0));
  return group;
}

/**
 * 一片荷叶
 * @param {Kit} kit
 * @param {number} radius 荷叶的半径
 * @returns {THREE.Mesh}
 */
export function lilyPad(kit, radius) {
  const pad = kit.cyl(radius, radius, 0.02, '#5fbf5a', 16);
  pad.position.y = 0.01;
  return pad;
}

/**
 * 一朵荷花（花苞）
 * @param {Kit} kit
 * @returns {THREE.Mesh}
 */
export function lotus(kit) {
  const bud = kit.sphere(0.07, '#ffb3cf', 10);
  bud.scale.y = 0.6;
  bud.position.y = 0.04;
  return bud;
}

/**
 * 岸边的一块小圆石头
 * @param {Kit} kit
 * @param {number} radius 石头的半径
 * @param {string} color 石头的颜色
 * @returns {THREE.Mesh}
 */
export function shoreRock(kit, radius, color) {
  const rock = kit.sphere(radius, color, 10);
  rock.scale.y = 0.6;
  return rock;
}

/**
 * 白色尖头栅栏：沿 x 方向一排，中间一根横栏
 * @param {Kit} kit
 * @param {number} length 栅栏多长
 * @returns {THREE.Group} 原点在中间
 */
export function picketFence(kit, length) {
  const group = new THREE.Group();
  const spacing = 0.55;
  const posts = Math.floor(length / spacing) + 1;
  const firstX = -((posts - 1) * spacing) / 2;

  for (let i = 0; i < posts; i++) {
    const x = firstX + i * spacing;
    group.add(at(kit.box(0.1, 0.5, 0.06, '#fffaf0', 0.03), x, 0.25, 0));
    group.add(at(kit.cone(0.07, 0.1, '#fffaf0', 4), x, 0.55, 0));
  }
  group.add(at(kit.box((posts - 1) * spacing, 0.06, 0.05, '#fffaf0', 0.02), 0, 0.35, 0.02));
  return group;
}

/**
 * 方块侧面嵌着的小石头（扁扁的，贴在土上）
 * @param {Kit} kit
 * @param {number} radius 石头的半径
 * @returns {THREE.Mesh} 扁的那面朝 z
 */
export function sidePebble(kit, radius) {
  const pebble = kit.sphere(radius, '#b3865a', 10);
  pebble.scale.z = 0.4;
  return pebble;
}

/**
 * 树桩：一截矮矮的树干，顶上一圈浅色年轮，底下几条树根
 * @param {Kit} kit
 * @returns {THREE.Group} 半径大约 0.3
 */
export function stump(kit) {
  const group = new THREE.Group();
  const height = 0.3;
  group.add(at(kit.cyl(0.24, 0.3, height, '#a0663a', 14), 0, height / 2, 0));
  group.add(at(kit.cyl(0.235, 0.235, 0.02, '#e3b787', 14), 0, height + 0.01, 0));

  const roots = 3;
  for (let i = 0; i < roots; i++) {
    const angle = (i / roots) * Math.PI * 2 + 0.4;
    const root = kit.box(0.1, 0.08, 0.22, '#8a5a3a', 0.03);
    root.rotation.y = angle;
    group.add(at(root, Math.sin(angle) * 0.28, 0.04, Math.cos(angle) * 0.28));
  }
  return group;
}

/**
 * 一堆落叶：几片压扁的橙黄色叶子堆成小山
 * @param {Kit} kit
 * @param {number} seed 叶子怎么堆，同一个数每次都一样
 * @returns {THREE.Group} 半径大约 0.35
 */
export function leafPile(kit, seed) {
  const random = rng(seed);
  const colors = ['#e8a94f', '#d98a3a', '#f2c55c'];
  const group = new THREE.Group();

  const leaves = 8;
  for (let i = 0; i < leaves; i++) {
    const angle = random() * Math.PI * 2;
    const distance = random() * 0.22;
    const leaf = kit.sphere(0.12 + random() * 0.06, colors[i % colors.length], 10);
    leaf.scale.y = 0.35;
    // 越靠中间堆得越高
    const height = 0.04 + (0.22 - distance) * 0.5;
    group.add(at(leaf, Math.cos(angle) * distance, height, Math.sin(angle) * distance));
  }
  return group;
}

/**
 * 能捡的小蘑菇（森林的材料）：白色的菌柄，橙色的小圆帽
 * @description 帽子用亮橙色，长在棕色树桩脚下、绿草丛里都一眼看得出来
 * @param {Kit} kit
 * @returns {THREE.Group} 立在地上，大约 0.18 高
 */
export function mushroomPickup(kit) {
  const group = new THREE.Group();
  const stemHeight = 0.11;
  group.add(at(kit.cyl(0.032, 0.04, stemHeight, '#fff3dd', 10), 0, stemHeight / 2, 0));

  const cap = kit.dome(0.09, '#f07f45', Math.PI / 2, 14);
  cap.scale.y = CAP_FLATTEN;
  group.add(at(cap, 0, stemHeight - 0.01, 0));
  return group;
}
