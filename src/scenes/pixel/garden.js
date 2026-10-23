// 左前的菜园：红屋顶台地的崖下，白栅栏围起来，右边一个口子当院门；
// 里面三行菜畦（胡萝卜、卷心菜、南瓜），中间一个稻草人；栅栏右前角外面一棵矮矮的苹果树，萨克斯躺在树荫里
import * as THREE from 'three';
import { rng } from '../../kit.js';
import { picketFence, scarecrow, crop } from './models.js';
import { voxelTree } from './plants.js';
import { GARDEN, CROP_ROWS, SCARECROW, SHORT_TREE, SAX } from './layout.js';

// 栅栏的碰撞有多厚
const FENCE_THICKNESS = 0.1;
// 菜畦：离栅栏多远，一棵菜占多宽，翻过的土多宽多厚；稻草人旁边留多大空
const BED_INSET = 0.3;
const CROP_SPACING = 0.36;
const SOIL_WIDTH = 0.34;
const SOIL_HEIGHT = 0.05;
const SOIL_COLOR = '#7a4d24';
const SCARECROW_ROOM = 0.35;
const SCARECROW_RADIUS = 0.12;
// 稻草人稍微侧过身，朝着院门那边
const SCARECROW_TURN = 0.3;
// 矮苹果树：多大，树干的碰撞多粗
const SHORT_TREE_SIZE = 0.7;
const TRUNK_RADIUS = 0.15;
// 树冠转个角度，挂苹果多的一面朝镜头
const SHORT_TREE_TURN = 0.7;
// 萨克斯躺在草上多高
const SAX_LIFT = 0.22;
// 有人进菜园浇水：站在院门里面一点，脸朝菜畦
const GARDENER_SPOT = { x: GARDEN.maxX - 0.45, z: (GARDEN.gateZ[0] + GARDEN.gateZ[1]) / 2, face: -Math.PI / 2 };
const GARDENER_STAY = 7;
const CROP_SEED = 61;
const TREE_SEED = 73;

/**
 * 搭菜园
 * @param {World} world 像素小镇
 * @returns {{ crowns: THREE.Group[], swaying: THREE.Object3D[] }} 树冠；风吹会晃的别的东西（稻草人）
 */
export function buildGarden(world) {
  fence(world);
  cropBeds(world);
  const scarecrowBody = placeScarecrow(world);
  const crown = shortTree(world);
  world.poi(GARDENER_SPOT.x, GARDENER_SPOT.z, { emote: '🥕', face: GARDENER_SPOT.face, dur: GARDENER_STAY });
  return { crowns: [crown], swaying: [scarecrowBody] };
}

/**
 * 白栅栏围一圈，右边那条留个院门
 * @param {World} world
 */
function fence(world) {
  const { minX, maxX, minZ, maxZ, gateZ } = GARDEN;
  const runs = [
    { from: [minX, minZ], to: [maxX, minZ] },
    { from: [minX, maxZ], to: [maxX, maxZ] },
    { from: [minX, minZ], to: [minX, maxZ] },
    { from: [maxX, minZ], to: [maxX, gateZ[0]] },
    { from: [maxX, gateZ[1]], to: [maxX, maxZ] },
  ];
  for (const run of runs) {
    fenceRun(world, run.from, run.to);
  }
}

/**
 * 一段直直的栅栏（沿 x 或沿 z），连碰撞一起
 * @param {World} world
 * @param {number[]} from 起点 [x, z]
 * @param {number[]} to 终点 [x, z]
 */
function fenceRun(world, from, to) {
  const alongX = from[1] === to[1];
  const length = alongX ? Math.abs(to[0] - from[0]) : Math.abs(to[1] - from[1]);
  const x = (from[0] + to[0]) / 2;
  const z = (from[1] + to[1]) / 2;
  const turn = alongX ? 0 : Math.PI / 2;
  world.add(picketFence(world.kit, length), x, world.heightAt(x, z), z, turn);

  const halfX = alongX ? length / 2 : FENCE_THICKNESS / 2;
  const halfZ = alongX ? FENCE_THICKNESS / 2 : length / 2;
  world.solidBox(x - halfX, x + halfX, z - halfZ, z + halfZ);
}

/**
 * 三行菜畦：翻过的深色土上一棵棵菜，稻草人站的地方空着
 * @param {World} world
 */
function cropBeds(world) {
  const random = rng(CROP_SEED);
  const fromX = GARDEN.minX + BED_INSET;
  const toX = GARDEN.maxX - BED_INSET;
  const centerX = (fromX + toX) / 2;

  for (const row of CROP_ROWS) {
    const soil = world.kit.box(toX - fromX, SOIL_HEIGHT, SOIL_WIDTH, SOIL_COLOR);
    soil.castShadow = false;
    world.add(soil, centerX, world.heightAt(centerX, row.z) + SOIL_HEIGHT / 2, row.z);

    for (let x = fromX + CROP_SPACING / 2; x < toX; x += CROP_SPACING) {
      const nearScarecrow = Math.hypot(x - SCARECROW[0], row.z - SCARECROW[1]) < SCARECROW_ROOM;
      if (nearScarecrow) {
        continue;
      }
      const plant = crop(world.kit, row.crop, random);
      world.add(plant, x, world.heightAt(x, row.z) + SOIL_HEIGHT, row.z);
    }
  }
}

/**
 * 稻草人
 * @param {World} world
 * @returns {THREE.Group} 木桩以上的部分，风吹时晃
 */
function placeScarecrow(world) {
  const [x, z] = SCARECROW;
  const { group, body } = scarecrow(world.kit);
  world.add(group, x, world.heightAt(x, z), z, SCARECROW_TURN);
  world.solidCircle(x, z, SCARECROW_RADIUS);
  return body;
}

/**
 * 栅栏外面的矮苹果树，萨克斯躺在它的树荫里
 * @param {World} world
 * @returns {THREE.Group} 树冠
 */
function shortTree(world) {
  const [x, z] = SHORT_TREE;
  const { group, crown } = voxelTree(world.kit, { kind: 'apple', size: SHORT_TREE_SIZE, seed: TREE_SEED });
  world.add(group, x, world.heightAt(x, z), z, SHORT_TREE_TURN);
  world.solidCircle(x, z, TRUNK_RADIUS);
  world.placeItem('sax', SAX[0], world.heightAt(...SAX) + SAX_LIFT, SAX[1]);
  return crown;
}
