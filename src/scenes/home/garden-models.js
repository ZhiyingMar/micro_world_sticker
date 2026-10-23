// 花园里的小模型：尖头的白篱笆、院门、信箱、向日葵、屋边的木台阶、踏脚石
// 只造不摆（摆在哪由 garden.js 按 layout 定），原点都在地上
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { at, noiseAt } from '../../kit.js';
import { roundedPart } from './materials.js';

const FENCE_COLOR = '#fff6e8';
const WOOD = '#c48a54';
// 篱笆：一根根尖头小木板，多宽、多厚、多高，隔多远一根；尖头多高；两根横条在多高（占高度的比例）
const PICKET = { width: 0.07, thickness: 0.035, height: 0.5, gap: 0.16, tip: 0.06 };
const RAIL_HEIGHTS = [0.3, 0.72];
const RAIL_SIZE = 0.04;
// 每根木板高矮、歪斜差一点，不像机器排出来的
const PICKET_HEIGHT_JITTER = 0.05;
const PICKET_TILT_JITTER = 0.05;
// 粗一点的木桩：隔多远一根，多粗，比木板高多少
const POST = { every: 9, size: 0.1, extra: 0.08 };

/**
 * 一段直的尖头篱笆：一根根木板（一次画完）、两根横条、隔几根一个粗木桩
 * @param {Kit} kit
 * @param {number} length 多长，沿 +x 从 0 排到 length
 * @param {number} seed 每段篱笆歪得不一样
 * @returns {THREE.Group}
 */
export function picketFence(kit, length, seed) {
  const group = new THREE.Group();
  const count = Math.max(2, Math.round(length / PICKET.gap) + 1);
  const spacing = length / (count - 1);

  const board = new THREE.BoxGeometry(PICKET.width, PICKET.height, PICKET.thickness).translate(0, PICKET.height / 2, 0);
  const tip = new THREE.ConeGeometry(PICKET.width * 0.72, PICKET.tip, 4).rotateY(Math.PI / 4).translate(0, PICKET.height + PICKET.tip / 2, 0);
  const picket = mergeGeometries([board, tip]);
  const pickets = new THREE.InstancedMesh(picket, kit.m(FENCE_COLOR), count);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Euler();
  const scale = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const height = 1 + (noiseAt(i, 0, 0, seed) - 0.5) * 2 * PICKET_HEIGHT_JITTER;
    rotation.set(0, 0, (noiseAt(i, 1, 0, seed) - 0.5) * 2 * PICKET_TILT_JITTER);
    matrix.compose(new THREE.Vector3(i * spacing, 0, 0), new THREE.Quaternion().setFromEuler(rotation), scale.set(1, height, 1));
    pickets.setMatrixAt(i, matrix);
  }
  pickets.castShadow = true;
  pickets.receiveShadow = true;
  group.add(pickets);

  for (const ratio of RAIL_HEIGHTS) {
    group.add(at(roundedPart(kit, length, RAIL_SIZE, RAIL_SIZE, FENCE_COLOR, 0.01), length / 2, PICKET.height * ratio, -PICKET.thickness));
  }
  for (let i = 0; i < count; i += POST.every) {
    group.add(fencePost(kit, PICKET.height + POST.extra, i * spacing));
  }
  group.add(fencePost(kit, PICKET.height + POST.extra, length));
  return group;
}

/**
 * 篱笆上一根粗木桩，顶上一个圆帽
 * @param {Kit} kit
 * @param {number} height 多高
 * @param {number} x 沿篱笆在哪
 * @returns {THREE.Group}
 */
function fencePost(kit, height, x) {
  const post = new THREE.Group();
  post.add(at(roundedPart(kit, POST.size, height, POST.size, FENCE_COLOR, 0.02), 0, height / 2, -PICKET.thickness));
  post.add(at(kit.sphere(POST.size * 0.6, FENCE_COLOR, 10), 0, height + POST.size * 0.3, -PICKET.thickness));
  post.position.x = x;
  return post;
}

/**
 * 院门：两根高一点的门柱，一扇往外推开的小木门
 * @description 原点在门洞中心，门洞沿 x，往外是 +z
 * @param {Kit} kit
 * @param {number} width 门洞多宽
 * @returns {THREE.Group}
 */
export function gardenGate(kit, width) {
  const group = new THREE.Group();
  const postHeight = PICKET.height + POST.extra * 2.5;
  for (const side of [-1, 1]) {
    group.add(at(roundedPart(kit, POST.size * 1.3, postHeight, POST.size * 1.3, FENCE_COLOR, 0.03), side * width / 2, postHeight / 2, 0));
    group.add(at(kit.sphere(POST.size * 0.8, FENCE_COLOR, 12), side * width / 2, postHeight + POST.size * 0.4, 0));
  }

  // 门：几根木板钉在两根横条上，铰链在左边门柱，往外推开一大半
  const door = new THREE.Group();
  const doorWidth = width - POST.size * 1.3;
  const boards = 4;
  for (let i = 0; i < boards; i++) {
    const x = ((i + 0.5) / boards) * doorWidth;
    door.add(at(roundedPart(kit, PICKET.width, PICKET.height * 0.9, PICKET.thickness, FENCE_COLOR, 0.01), x, PICKET.height * 0.45, 0));
  }
  for (const ratio of RAIL_HEIGHTS) {
    door.add(at(roundedPart(kit, doorWidth, RAIL_SIZE, RAIL_SIZE, FENCE_COLOR, 0.01), doorWidth / 2, PICKET.height * 0.9 * ratio, -PICKET.thickness));
  }
  door.position.x = -width / 2 + POST.size * 0.65;
  door.rotation.y = -1.1;
  group.add(door);
  return group;
}

/**
 * 小信箱：木杆上一个圆顶的红信箱，旁边一面小旗
 * @description 信箱口朝 +z
 * @param {Kit} kit
 * @returns {THREE.Group}
 */
export function mailbox(kit) {
  const group = new THREE.Group();
  const poleHeight = 0.62;
  group.add(at(roundedPart(kit, 0.07, poleHeight, 0.07, WOOD, 0.015), 0, poleHeight / 2, 0));

  const box = new THREE.Group();
  box.add(at(roundedPart(kit, 0.22, 0.16, 0.34, '#e85d5d', 0.03), 0, 0, 0));
  const roof = kit.cyl(0.11, 0.11, 0.34, '#e85d5d', 16);
  roof.rotation.x = Math.PI / 2;
  box.add(at(roof, 0, 0.08, 0));
  box.add(at(roundedPart(kit, 0.14, 0.08, 0.01, '#6b4f3a', 0.005), 0, 0.03, 0.172));
  // 小旗：竖起来的，说明里面有信
  box.add(at(roundedPart(kit, 0.015, 0.2, 0.015, '#6b4f3a', 0.004), 0.12, 0.12, -0.05));
  box.add(at(roundedPart(kit, 0.01, 0.07, 0.09, '#ffd84a', 0.004), 0.125, 0.19, -0.01));
  group.add(at(box, 0, poleHeight + 0.08, 0));
  return group;
}

/**
 * 一棵向日葵：长长的茎、两片叶子，顶上一个棕色花盘，一圈黄花瓣
 * @description 花盘朝 +z，微微往下低一点
 * @param {Kit} kit
 * @param {number} height 多高（到花盘中心）
 * @returns {{ group: THREE.Group, head: THREE.Group }} head 是花盘（风吹时让它点头）
 */
export function sunflower(kit, height) {
  const group = new THREE.Group();
  group.add(at(kit.cyl(0.025, 0.035, height, '#5f9e4a', 8), 0, height / 2, 0));
  for (const [side, y] of [[1, 0.45], [-1, 0.62]]) {
    const leaf = kit.sphere(0.12, '#6fb85a', 10);
    leaf.scale.set(1.4, 0.25, 0.7);
    leaf.rotation.z = side * 0.4;
    group.add(at(leaf, side * 0.13, height * y, 0));
  }

  const head = new THREE.Group();
  head.position.y = height;
  head.rotation.x = 0.25;
  const disk = kit.cyl(0.14, 0.14, 0.06, '#7a4f2a', 20);
  disk.rotation.x = Math.PI / 2;
  head.add(disk);
  const petals = 14;
  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2;
    const petal = kit.sphere(0.07, '#ffd23f', 8);
    petal.scale.set(0.55, 1.1, 0.25);
    petal.position.set(Math.sin(angle) * 0.2, Math.cos(angle) * 0.2, -0.01);
    petal.rotation.z = -angle;
    head.add(petal);
  }
  group.add(head);
  return { group, head };
}

/**
 * 屋边的一级木台阶：两块木板搭在两根小木墩上
 * @description 长的一边沿 z
 * @param {Kit} kit
 * @param {number} width 多宽（沿 z）
 * @param {number} height 台面多高
 * @returns {THREE.Group}
 */
export function porchStep(kit, width, height) {
  const group = new THREE.Group();
  const depth = 0.42;
  for (const side of [-1, 1]) {
    group.add(at(roundedPart(kit, depth * 0.8, height - 0.05, 0.12, '#a0663a', 0.02), 0, (height - 0.05) / 2, side * (width / 2 - 0.12)));
  }
  for (const offset of [-0.1, 0.1]) {
    group.add(at(roundedPart(kit, depth / 2 - 0.01, 0.05, width, '#d9a066', 0.015), offset, height - 0.025, 0));
  }
  return group;
}

/**
 * 一块踏脚石：扁扁的圆石头，边上高低不平
 * @param {Kit} kit
 * @param {number} radius 多大
 * @param {number} seed 每块石头的样子不一样
 * @returns {THREE.Mesh}
 */
export function steppingStone(kit, radius, seed) {
  const geometry = new THREE.CylinderGeometry(radius, radius * 1.05, 0.06, 9, 1);
  const position = geometry.getAttribute('position');
  // 按位置推一推顶点，一圈边不是正圆；同一个角的重复顶点推得一样，面和面之间不会裂开
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const push = 1 + (noiseAt(x, 0, z, seed) - 0.5) * 0.3;
    position.setXYZ(i, x * push, position.getY(i), z * push);
  }
  geometry.computeVertexNormals();
  const stone = kit.mesh(geometry, '#e9dcc4');
  stone.castShadow = false;
  return stone;
}
