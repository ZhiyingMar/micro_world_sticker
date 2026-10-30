// 植物模型（森林、小屋花园共用）：几种树、灌木、成片的小花和草丛。只负责造出来，摆在哪由用它的地方决定
// 树都把树冠单独放在一个 crown 组里，原点在树干顶上，风吹的时候只摇树冠
// 花和草一摆就是几百棵，用 InstancedMesh 一次画完，不然一棵一个网格太费
// 风吹树冠怎么摇（swayInWind）也在这里，种了树的世界都用它
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { at, rng } from './kit.js';

// 树冠的深浅：暗面、本色、亮面各差多少亮度
const SHADE_STEP = 0.06;
// 小花：茎多高，花瓣几片、离花心多远
const STEM_HEIGHT = 0.16;
const PETALS = 5;
const PETAL_RADIUS = 0.035;
const PETAL_SPREAD = 0.04;
// 花长得再小也留这么一点：缩到 0 的矩阵会让 three.js 算不出包围球
const MIN_GROWTH = 0.001;
// 风：树冠摇多快、摇多大角度（弧度）；风一阵大一阵小，多久一个来回
const WIND_SPEED = 1.3;
const WIND_ANGLE = 0.035;
const GUST_SPEED = 0.25;
const GUST_DEPTH = 0.4;
// 草丛：一丛几根叶子，叶子多高、往外歪多少
const BLADES = 5;
const BLADE_HEIGHT = 0.17;
const BLADE_LEAN = 0.35;

/**
 * 一种颜色的三个深浅：暗面、本色、亮面
 * @description 树冠几团颜色一样就成了一坨；深浅错开，阳光照着的那团亮一点，才有体积
 * @param {string} color 本色
 * @returns {string[]} [暗, 本色, 亮]
 */
function shades(color) {
  const base = new THREE.Color(color);
  const dark = base.clone().offsetHSL(0, 0.03, -SHADE_STEP);
  const light = base.clone().offsetHSL(0, -0.03, SHADE_STEP);
  return [`#${dark.getHexString()}`, color, `#${light.getHexString()}`];
}

/**
 * 按种类造一棵树
 * @param {Kit} kit
 * @param {object} options
 * @param {string} options.kind 哪种：round 圆冠树、pine 松树、poplar 高瘦的杨树
 * @param {number} options.size 整体大小，1 是普通大小
 * @param {string} options.color 树冠颜色
 * @param {number} options.seed 树冠几团怎么长，每棵不一样
 * @returns {{ group: THREE.Group, crown: THREE.Group }}
 */
export function tree(kit, { kind = 'round', size = 1, color, seed = 1 }) {
  if (kind === 'pine') {
    return pineTree(kit, { size, color, seed });
  }
  if (kind === 'poplar') {
    return poplarTree(kit, { size, color, seed });
  }
  return roundTree(kit, { size, color, seed });
}

/**
 * 圆冠树：一根有点粗的树干，顶上一大团加四五小团树冠，深浅错开
 * @param {Kit} kit
 * @param {{ size: number, color: string, seed: number }} options
 * @returns {{ group: THREE.Group, crown: THREE.Group }}
 */
function roundTree(kit, { size, color = '#7fd06a', seed }) {
  const random = rng(seed);
  const [dark, base, light] = shades(color);
  const trunkHeight = 1.0 * size;
  const radius = 0.7 * size;
  const group = new THREE.Group();
  addTrunk(kit, group, trunkHeight, 0.15 * size);

  const crown = new THREE.Group();
  crown.position.y = trunkHeight;
  crown.add(at(kit.sphere(radius, base, 14), 0, radius * 0.7, 0));

  // 四周几团，暗的在下面、亮的在上面
  const lobes = 4 + Math.floor(random() * 2);
  for (let i = 0; i < lobes; i++) {
    const angle = (i / lobes) * Math.PI * 2 + random() * 0.6;
    const lobeRadius = radius * (0.5 + random() * 0.18);
    const height = radius * (0.35 + random() * 0.5);
    const lobeColor = height > radius * 0.6 ? light : dark;
    crown.add(at(kit.sphere(lobeRadius, lobeColor, 10), Math.cos(angle) * radius * 0.62, height, Math.sin(angle) * radius * 0.62));
  }
  crown.add(at(kit.sphere(radius * 0.5, light, 10), radius * 0.12, radius * 1.25, -radius * 0.05));

  group.add(crown);
  return { group, crown };
}

/**
 * 松树：短树干上叠三层尖尖的树冠，越往上越小
 * @param {Kit} kit
 * @param {{ size: number, color: string, seed: number }} options
 * @returns {{ group: THREE.Group, crown: THREE.Group }}
 */
function pineTree(kit, { size, color = '#4f9a6a', seed }) {
  const random = rng(seed);
  const [dark, base, light] = shades(color);
  const trunkHeight = 0.4 * size;
  const radius = 0.62 * size;
  const tierHeight = 0.85 * size;
  const group = new THREE.Group();
  addTrunk(kit, group, trunkHeight, 0.11 * size);

  const crown = new THREE.Group();
  crown.position.y = trunkHeight;
  const tierColors = [dark, base, light];
  for (let i = 0; i < tierColors.length; i++) {
    const tier = kit.cone(radius * (1 - i * 0.24), tierHeight, tierColors[i], 9);
    tier.rotation.y = random() * Math.PI;
    crown.add(at(tier, 0, tierHeight / 2 + i * tierHeight * 0.5, 0));
  }

  group.add(crown);
  return { group, crown };
}

/**
 * 杨树：细高的树干，顶上一个长长的椭圆树冠，旁边贴一小团
 * @param {Kit} kit
 * @param {{ size: number, color: string, seed: number }} options
 * @returns {{ group: THREE.Group, crown: THREE.Group }}
 */
function poplarTree(kit, { size, color = '#9ad66c', seed }) {
  const random = rng(seed);
  const [dark, base, light] = shades(color);
  const trunkHeight = 0.6 * size;
  const radius = 0.42 * size;
  const group = new THREE.Group();
  addTrunk(kit, group, trunkHeight, 0.1 * size);

  const crown = new THREE.Group();
  crown.position.y = trunkHeight;
  const body = kit.sphere(radius, base, 16);
  body.scale.y = 2.1;
  crown.add(at(body, 0, radius * 1.8, 0));

  const side = random() > 0.5 ? 1 : -1;
  crown.add(at(kit.sphere(radius * 0.6, dark, 12), side * radius * 0.6, radius * 1.0, radius * 0.3));
  crown.add(at(kit.sphere(radius * 0.5, light, 12), -side * radius * 0.4, radius * 2.8, -radius * 0.2));

  group.add(crown);
  return { group, crown };
}

/**
 * 树干：上细下粗，根部再鼓出来一圈
 * @param {Kit} kit
 * @param {THREE.Group} group 加到这棵树里
 * @param {number} height 树干多高
 * @param {number} radius 树干底下多粗
 */
function addTrunk(kit, group, height, radius) {
  const bark = '#9a6440';
  group.add(at(kit.cyl(radius * 0.6, radius, height, bark, 10), 0, height / 2, 0));
  group.add(at(kit.cyl(radius, radius * 1.5, height * 0.12, bark, 10), 0, height * 0.06, 0));
}

/**
 * 一丛圆圆的灌木：一大团，旁边挤着一小团
 * @param {Kit} kit
 * @param {number} radius 大的那团的半径
 * @param {string} color 颜色
 * @returns {THREE.Group}
 */
export function bush(kit, radius, color = '#7fd06a') {
  const [dark, base, light] = shades(color);
  const group = new THREE.Group();
  const main = kit.sphere(radius, base, 14);
  main.scale.y = 0.72;
  group.add(at(main, 0, radius * 0.55, 0));

  const side = kit.sphere(radius * 0.65, dark, 12);
  side.scale.y = 0.75;
  group.add(at(side, radius * 0.7, radius * 0.4, radius * 0.3));
  const top = kit.sphere(radius * 0.45, light, 12);
  group.add(at(top, -radius * 0.2, radius * 0.85, -radius * 0.1));
  return group;
}

/**
 * 林子里的小红蘑菇：白色的柄，红色的圆帽子上三个白点
 * @description 只是看的，路过会弹一下，和能捡的橙色小蘑菇不一样
 * @param {Kit} kit
 * @param {number} size 大小，1 大约 0.17 高
 * @returns {{ group: THREE.Group, cap: THREE.Group }} cap 是帽子（原点在帽子底面），碰一下时让它弹
 */
export function toadstool(kit, size) {
  const group = new THREE.Group();
  const stemHeight = 0.12 * size;
  group.add(at(kit.cyl(0.025 * size, 0.035 * size, stemHeight, '#fff3dd', 8), 0, stemHeight / 2, 0));

  const cap = new THREE.Group();
  cap.position.y = stemHeight - 0.01 * size;
  const capRadius = 0.07 * size;
  const dome = kit.dome(capRadius, '#e8524a', Math.PI / 2, 12);
  dome.scale.y = 0.75;
  cap.add(dome);

  // 帽子上三个白点，绕一圈错开
  const dots = 3;
  const elevation = 0.75;
  for (let i = 0; i < dots; i++) {
    const around = (i / dots) * Math.PI * 2 + 0.4;
    const dot = kit.sphere(0.014 * size, '#ffffff', 6);
    dot.position.set(Math.cos(around) * Math.cos(elevation) * capRadius, Math.sin(elevation) * capRadius * 0.75, Math.sin(around) * Math.cos(elevation) * capRadius);
    cap.add(dot);
  }

  group.add(cap);
  return { group, cap };
}

/**
 * 一片小花：每朵花一根茎、一圈花瓣、一个黄花心，几百朵一次画完
 * @param {Kit} kit
 * @param {{ x: number, y: number, z: number, color: string, scale: number, turn: number }[]} blooms 每朵花在哪、什么颜色、多大、转多少
 * @returns {THREE.Group}
 */
export function flowerField(kit, blooms) {
  const group = new THREE.Group();
  if (!blooms.length) {
    return group;
  }

  const stem = new THREE.CylinderGeometry(0.012, 0.012, STEM_HEIGHT, 5).translate(0, STEM_HEIGHT / 2, 0);
  const center = new THREE.SphereGeometry(0.025, 6, 4).translate(0, STEM_HEIGHT + 0.02, 0);
  const stems = instanced(stem, kit.m('#5fae55'), blooms);
  const centers = instanced(center, kit.m('#ffd84a'), blooms);
  const petals = instanced(petalRing(), kit.m('#ffffff'), blooms);
  const color = new THREE.Color();
  blooms.forEach((bloom, index) => {
    petals.setColorAt(index, color.set(bloom.color));
  });

  for (const mesh of [stems, centers, petals]) {
    mesh.castShadow = false;
    group.add(mesh);
  }
  return group;
}

/**
 * 让一片花里的每朵花长到不同的大小
 * @description 花一朵接一朵开出来时每帧调一次；整朵花（茎、花瓣、花心）一起按原来的大小缩放
 * @param {THREE.Group} field flowerField() 造出来的那片花
 * @param {{ x: number, y: number, z: number, scale: number, turn: number }[]} blooms 造这片花时传进去的那些花
 * @param {(index: number) => number} growth 第几朵花长到原来的几成（0 还没冒出来，1 开足了，可以超过 1 一点弹一下）
 */
export function growFlowerField(field, blooms, growth) {
  const grown = blooms.map((bloom, index) => ({ ...bloom, scale: bloom.scale * Math.max(growth(index), MIN_GROWTH) }));
  for (const mesh of field.children) {
    placeInstances(mesh, grown);
  }
}

/**
 * 一朵花的一圈花瓣，拼成一个网格
 * @returns {THREE.BufferGeometry}
 */
function petalRing() {
  const pieces = [];
  for (let i = 0; i < PETALS; i++) {
    const angle = (i / PETALS) * Math.PI * 2;
    // 花瓣很小，几个面就够了，几百朵花加起来三角形少很多
    const petal = new THREE.SphereGeometry(PETAL_RADIUS, 6, 3);
    petal.scale(1, 0.5, 1);
    petal.translate(Math.cos(angle) * PETAL_SPREAD, STEM_HEIGHT + 0.01, Math.sin(angle) * PETAL_SPREAD);
    pieces.push(petal);
  }
  return mergeGeometries(pieces);
}

/**
 * 一片草丛：每丛几根细细的叶子往外歪，颜色深浅不一
 * @param {Kit} kit
 * @param {{ x: number, y: number, z: number, color: string, scale: number, turn: number }[]} tufts 每丛在哪、什么颜色、多大、转多少
 * @returns {THREE.InstancedMesh | THREE.Group} 没有草丛时是空的组
 */
export function grassField(kit, tufts) {
  if (!tufts.length) {
    return new THREE.Group();
  }

  const mesh = instanced(tuftGeometry(), kit.m('#ffffff'), tufts);
  const color = new THREE.Color();
  tufts.forEach((tuft, index) => {
    mesh.setColorAt(index, color.set(tuft.color));
  });
  mesh.castShadow = false;
  return mesh;
}

/**
 * 一丛草的样子：几根细三棱锥，绕着中心往外歪
 * @returns {THREE.BufferGeometry}
 */
function tuftGeometry() {
  const blades = [];
  for (let i = 0; i < BLADES; i++) {
    const angle = (i / BLADES) * Math.PI * 2;
    const height = BLADE_HEIGHT * (0.7 + (i % 3) * 0.15);
    const blade = new THREE.ConeGeometry(0.02, height, 3).translate(0, height / 2, 0);
    blade.rotateZ(BLADE_LEAN);
    blade.rotateY(angle);
    blades.push(blade);
  }
  return mergeGeometries(blades);
}

/**
 * 把同一个形状按一串位置摆成一个 InstancedMesh
 * @param {THREE.BufferGeometry} geometry 形状
 * @param {THREE.Material} material 材质
 * @param {{ x: number, y: number, z: number, scale: number, turn: number }[]} placements 每个摆在哪、多大、转多少
 * @returns {THREE.InstancedMesh}
 */
function instanced(geometry, material, placements) {
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  placeInstances(mesh, placements);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * 按位置、朝向、大小摆好一个 InstancedMesh 里的每一个
 * @param {THREE.InstancedMesh} mesh
 * @param {{ x: number, y: number, z: number, scale: number, turn: number }[]} placements 每一个在哪、多大、绕竖轴转多少
 */
function placeInstances(mesh, placements) {
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  placements.forEach((placement, index) => {
    rotation.setFromAxisAngle(up, placement.turn);
    position.set(placement.x, placement.y, placement.z);
    scale.setScalar(placement.scale);
    mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

// ---------- 风 ----------

/**
 * 风吹树冠：每棵树摇的步子错开，一阵风大一阵风小
 * @description 树冠绕着树干顶轻轻晃，树干不动；整片林子一起动，画面才是活的
 * @param {World} world 树在哪个世界
 * @param {THREE.Group[]} crowns 所有树冠（tree() 返回的 crown）
 */
export function swayInWind(world, crowns) {
  // 每棵树的步子跟着它在哪儿走，风像是从一边吹过去的
  const phases = crowns.map((crown) => {
    const position = crown.getWorldPosition(new THREE.Vector3());
    return position.x * 0.6 + position.z * 0.4;
  });

  world.onUpdate((dt, time) => {
    const gust = 1 - GUST_DEPTH + GUST_DEPTH * Math.sin(time * GUST_SPEED);
    crowns.forEach((crown, index) => {
      const phase = time * WIND_SPEED + phases[index];
      crown.rotation.z = Math.sin(phase) * WIND_ANGLE * gust;
      crown.rotation.x = Math.cos(phase * 0.8) * WIND_ANGLE * 0.6 * gust;
    });
  });
}
