// 像素小镇的植物（只造不摆）：几种体素树、灌木，一大片方块小花和草丛
// 树冠是一团团疙疙瘩瘩的小体素，朝着太阳的一面亮、背光的一面暗，再撒一点光斑，像 MagicaVoxel 捏出来的；
// 每棵树按 seed 长得不一样。树冠单独一个组，原点在树干顶上，风吹时只摇树冠（src/plants.js 的 swayInWind）
// 花和草一摆几百棵，用 InstancedMesh 一次画完
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { at, rng, noiseAt } from '../../kit.js';
import { VoxelShape, shadesOf } from '../../voxel.js';

// 树冠的体素多大
const TREE_VOXEL = 0.125;
// 树干：多粗，多高（按 size 缩放）；树根往外鼓出来一圈多大
const TRUNK_WIDTH = 0.22;
const TRUNK_HEIGHT = { oak: 0.55, apple: 0.45, blossom: 0.5, pine: 0.35, birch: 0.85 };
const ROOT_FLARE = 0.08;
const BARK = '#8b5a2b';
// 每种树冠的颜色
const CROWN_COLORS = {
  oak: '#56ab47',
  apple: '#5fb24c',
  blossom: '#ffb3cf',
  pine: '#3f8a52',
  birch: '#9ad66c',
};
// 苹果树上苹果的比例、开花树上白花的比例
const APPLE_CHANCE = 0.06;
const BLOSSOM_WHITE_CHANCE = 0.08;
// 树冠表面起伏多大、光斑多少
const CROWN_BUMPS = 0.18;
const CROWN_SPECKLE = 0.12;
// 松树：几层，最下面一层多大（体素数），每层多厚
const PINE_TIERS = 4;
const PINE_BASE_RADIUS = 5;
const PINE_TIER_HEIGHT = 3;

/**
 * 按种类造一棵体素树
 * @param {Kit} kit
 * @param {object} options
 * @param {string} options.kind oak 圆冠树、apple 苹果树、blossom 开粉花的树、pine 松树、birch 白桦
 * @param {number} options.size 整体大小，1 是普通大小
 * @param {number} options.seed 树冠怎么长，每棵不一样
 * @returns {{ group: THREE.Group, crown: THREE.Group }}
 */
export function voxelTree(kit, { kind = 'oak', size = 1, seed = 1 }) {
  const group = new THREE.Group();
  const trunkHeight = TRUNK_HEIGHT[kind] * size;
  group.add(trunk(kit, kind, trunkHeight, size));

  const crown = new THREE.Group();
  crown.position.y = trunkHeight;
  let shape;
  if (kind === 'pine') {
    shape = pineCrown(size, seed);
  } else if (kind === 'birch') {
    shape = roundCrown({ size, seed, color: CROWN_COLORS.birch, stretch: 1.5, puffs: 2 });
  } else {
    shape = roundCrown({ size, seed, color: CROWN_COLORS[kind], stretch: 1, puffs: 4 });
  }
  if (kind === 'apple') {
    dotSurface(shape, '#e8433a', APPLE_CHANCE, seed);
  } else if (kind === 'blossom') {
    dotSurface(shape, '#ffffff', BLOSSOM_WHITE_CHANCE, seed);
  }
  crown.add(shape.mesh(kit));
  group.add(crown);
  return { group, crown };
}

/**
 * 树干：一根方木头，根部往外鼓一圈；白桦是白的，带几道黑纹
 * @param {Kit} kit
 * @param {string} kind
 * @param {number} height
 * @param {number} size
 * @returns {THREE.Group}
 */
function trunk(kit, kind, height, size) {
  const group = new THREE.Group();
  const width = TRUNK_WIDTH * Math.sqrt(size);
  const birch = kind === 'birch';
  const [dark, base] = shadesOf(birch ? '#ece8dc' : BARK);
  // 树干插进树冠一截，免得风吹树冠时露出缝
  const overlap = TREE_VOXEL * 2;
  group.add(at(kit.box(width, height + overlap, width, base), 0, (height + overlap) / 2, 0));
  group.add(at(kit.box(width + ROOT_FLARE, ROOT_FLARE, width + ROOT_FLARE, dark), 0, ROOT_FLARE / 2, 0));

  if (birch) {
    const marks = 4;
    for (let i = 0; i < marks; i++) {
      const y = height * (0.2 + 0.18 * i);
      group.add(at(kit.box(width * 0.5, 0.04, 0.02, '#3a3a3a'), (i % 2 ? 0.25 : -0.25) * width, y, width / 2 + 0.005));
    }
  }
  return group;
}

/**
 * 圆圆的树冠：中间一大团，旁边挤着几小团
 * @param {object} options
 * @param {number} options.size 整体大小
 * @param {number} options.seed
 * @param {string} options.color 本色
 * @param {number} options.stretch 往高里拉长多少（白桦瘦高）
 * @param {number} options.puffs 旁边几小团
 * @returns {VoxelShape}
 */
function roundCrown({ size, seed, color, stretch, puffs }) {
  const random = rng(seed);
  const shape = new VoxelShape(TREE_VOXEL);
  const shades = shadesOf(color);
  const radius = 4.6 * size;
  const center = [0, radius * 0.9 * stretch, 0];
  shape.fillBlob({ center, radius: [radius, radius * 0.85 * stretch, radius], shades, bumpiness: CROWN_BUMPS, seed, speckle: CROWN_SPECKLE });

  for (let i = 0; i < puffs; i++) {
    const angle = (i / puffs) * Math.PI * 2 + random() * 0.8;
    const out = radius * (0.6 + random() * 0.2);
    const puffRadius = radius * (0.5 + random() * 0.15);
    const puffCenter = [center[0] + Math.cos(angle) * out, center[1] + (random() - 0.4) * radius * 0.6 * stretch, center[2] + Math.sin(angle) * out];
    shape.fillBlob({ center: puffCenter, radius: [puffRadius, puffRadius * 0.85 * stretch, puffRadius], shades, bumpiness: CROWN_BUMPS, seed: seed + i + 1, speckle: CROWN_SPECKLE });
  }
  return shape;
}

/**
 * 松树的树冠：一层层往上收的方盘子，每层边上往下垂一点，层顶亮、层底暗
 * @param {number} size
 * @param {number} seed
 * @returns {VoxelShape}
 */
function pineCrown(size, seed) {
  const shape = new VoxelShape(TREE_VOXEL);
  const [dark, base, light] = shadesOf(CROWN_COLORS.pine).map((color) => new THREE.Color(color));
  const tierHeight = Math.max(2, Math.round(PINE_TIER_HEIGHT * size));

  for (let tier = 0; tier < PINE_TIERS; tier++) {
    const radius = Math.max(1, Math.round(PINE_BASE_RADIUS * size * (1 - tier / (PINE_TIERS + 0.5))));
    const bottom = tier * (tierHeight - 1);
    for (let y = 0; y < tierHeight; y++) {
      // 每层下面宽、上面窄一圈
      const layerRadius = radius - y;
      const isTop = y === tierHeight - 1;
      const paint = (x, layerY, z) => pineNeedle({ x, z, radius: layerRadius, isTop, isBottom: y === 0, seed, colors: [dark, base, light] });
      shape.fillBox([-layerRadius, bottom + y, -layerRadius], [layerRadius, bottom + y, layerRadius], paint);
    }
  }
  shape.set(0, PINE_TIERS * (tierHeight - 1) + 1, 0, light);
  return shape;
}

/**
 * 松树一层里一块小体素的颜色；方盘子的四个角削掉，看着是圆的
 * @param {object} needle
 * @param {number} needle.x
 * @param {number} needle.z
 * @param {number} needle.radius 这一层多大
 * @param {boolean} needle.isTop 是不是这一层的顶
 * @param {boolean} needle.isBottom 是不是这一层的底
 * @param {number} needle.seed
 * @param {THREE.Color[]} needle.colors [暗, 本色, 亮]
 * @returns {THREE.Color | null} 削掉的角是 null
 */
function pineNeedle({ x, z, radius, isTop, isBottom, seed, colors }) {
  const corner = x * x + z * z > radius * radius + radius * 0.6;
  if (corner) {
    return null;
  }
  const [dark, base, light] = colors;
  if (isTop && noiseAt(x, 1, z, seed) > 0.25) {
    return light;
  }
  if (isBottom) {
    return dark;
  }
  return base;
}

/**
 * 在树冠表面零星点上几块别的颜色：苹果、白花
 * @param {VoxelShape} shape
 * @param {string} color
 * @param {number} chance 表面上多少比例的小方块换颜色
 * @param {number} seed
 */
function dotSurface(shape, color, chance, seed) {
  const dot = new THREE.Color(color);
  for (const cell of shape.cells.values()) {
    const exposed = !shape.has(cell.x, cell.y + 1, cell.z) || !shape.has(cell.x + 1, cell.y, cell.z) || !shape.has(cell.x, cell.y, cell.z + 1);
    if (exposed && noiseAt(cell.x, cell.y, cell.z, seed + 7) < chance) {
      cell.color = dot;
    }
  }
}

/**
 * 一丛灌木：一团扁扁的体素
 * @param {Kit} kit
 * @param {number} radius 多大（世界单位）
 * @param {number} seed
 * @param {string} [color]
 * @returns {THREE.Group} 原点在底面中心，碰一下时整丛压扁再弹回来
 */
export function voxelBush(kit, radius, seed, color = '#5fb24c') {
  const shape = new VoxelShape(TREE_VOXEL * 0.8);
  const voxels = radius / shape.size;
  shape.fillBlob({ center: [0, voxels * 0.6, 0], radius: [voxels, voxels * 0.72, voxels], shades: shadesOf(color), bumpiness: 0.2, seed, speckle: CROWN_SPECKLE });
  const group = new THREE.Group();
  group.add(shape.mesh(kit));
  return group;
}

// ---------- 成片的花和草 ----------
// 小花：茎多高；花是一个十字：中间一块黄花心，四边四块花瓣
const STEM_HEIGHT = 0.12;
const PETAL = 0.045;
// 草丛：几根，多高
const BLADE_HEIGHTS = [0.12, 0.18, 0.1];
const BLADE_SPREAD = 0.035;

/**
 * 一片方块小花：每朵一根茎、四块花瓣、一个黄花心，几百朵一次画完
 * @param {Kit} kit
 * @param {{ x: number, y: number, z: number, color: string, scale: number, turn: number }[]} blooms 每朵花在哪、什么颜色、多大、转多少
 * @returns {THREE.Group}
 */
export function voxelFlowerField(kit, blooms) {
  const group = new THREE.Group();
  if (!blooms.length) {
    return group;
  }

  const stem = new THREE.BoxGeometry(0.025, STEM_HEIGHT, 0.025).translate(0, STEM_HEIGHT / 2, 0);
  const center = new THREE.BoxGeometry(PETAL, PETAL, PETAL).translate(0, STEM_HEIGHT + PETAL / 2, 0);
  const petalOffsets = [
    [PETAL, 0],
    [-PETAL, 0],
    [0, PETAL],
    [0, -PETAL],
  ];
  const petals = mergeGeometries(petalOffsets.map(([x, z]) => new THREE.BoxGeometry(PETAL, PETAL * 0.8, PETAL).translate(x, STEM_HEIGHT + PETAL / 2, z)));

  const stems = instanced(stem, kit.m('#4fa64a'), blooms);
  const centers = instanced(center, kit.m('#ffd84a'), blooms);
  const petalMesh = instanced(petals, kit.m('#ffffff'), blooms);
  const color = new THREE.Color();
  blooms.forEach((bloom, index) => {
    petalMesh.setColorAt(index, color.set(bloom.color));
  });

  for (const mesh of [stems, centers, petalMesh]) {
    mesh.castShadow = false;
    group.add(mesh);
  }
  return group;
}

/**
 * 一片方块草丛：每丛三根高矮不一的细方条
 * @param {Kit} kit
 * @param {{ x: number, y: number, z: number, color: string, scale: number, turn: number }[]} tufts
 * @returns {THREE.InstancedMesh | THREE.Group} 没有草丛时是空的组
 */
export function voxelGrassField(kit, tufts) {
  if (!tufts.length) {
    return new THREE.Group();
  }

  const blades = BLADE_HEIGHTS.map((height, i) => {
    const angle = (i / BLADE_HEIGHTS.length) * Math.PI * 2;
    return new THREE.BoxGeometry(0.03, height, 0.03).translate(Math.cos(angle) * BLADE_SPREAD, height / 2, Math.sin(angle) * BLADE_SPREAD);
  });
  const mesh = instanced(mergeGeometries(blades), kit.m('#ffffff'), tufts);
  const color = new THREE.Color();
  tufts.forEach((tuft, index) => {
    mesh.setColorAt(index, color.set(tuft.color));
  });
  mesh.castShadow = false;
  return mesh;
}

/**
 * 把同一个形状按一串位置摆成一个 InstancedMesh
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {{ x: number, y: number, z: number, scale: number, turn: number }[]} placements
 * @returns {THREE.InstancedMesh}
 */
function instanced(geometry, material, placements) {
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
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
  mesh.receiveShadow = true;
  return mesh;
}
