// 让森林活起来：风吹树冠轻轻摇，蝴蝶在花丛上飞（人走近会被惊飞），池塘里时不时跳起一条鱼
// 都只是看的，不挡路，也不会被点到
import * as THREE from 'three';
import { at, rng } from '../../kit.js';
import { swayInWind } from '../../plants.js';
import { createButterflies } from '../../butterflies.js';
import { FLOWER_PATCHES, HOUSES } from './layout.js';

// 蝴蝶怎么飞每次都一样
const BUTTERFLY_SEED = 31;

// 鱼：隔多久跳一次（秒，随机），一跳多久、多高、多远；出水入水溅几颗水珠、波纹散多大
const FISH_GAP = [4, 9];
const FISH_JUMP_TIME = 0.7;
const FISH_JUMP_HEIGHT = 0.35;
const FISH_JUMP_LENGTH = 0.5;
const FISH_DROPS = 4;
const FISH_RIPPLE = 0.6;
const FISH_SEED = 7;

/**
 * 让森林动起来
 * @param {World} world 童话森林
 * @param {object} context
 * @param {THREE.Group[]} context.crowns 所有树冠
 * @param {number} context.waterSurface 水面多高
 * @param {{ ripple: Function, splash: Function }} context.splashes 水面上的波纹和水珠
 */
export function bringToLife(world, { crowns, waterSurface, splashes }) {
  swayInWind(world, crowns);
  butterflies(world);
  jumpingFish(world, waterSurface, splashes);
}

/**
 * 蝴蝶：每片花丛上一只，绕着花丛飞，人走近会被惊飞
 * @param {World} world
 */
function butterflies(world) {
  // 花丛的中心：空地上那几大片，加上每座蘑菇屋门口
  const gardens = [...FLOWER_PATCHES.map(([x, z]) => [x, z]), ...HOUSES.map((house) => [house.x + Math.sin(house.facing), house.z + Math.cos(house.facing)])];
  createButterflies(world, gardens.map(([x, z]) => ({ x, z, y: world.heightAt(x, z) })), BUTTERFLY_SEED);
}

/**
 * 池塘、小溪里时不时跳起一条小鱼，入水出水各溅一下水花、散一圈波纹
 * @param {World} world
 * @param {number} waterSurface 水面多高
 * @param {{ ripple: Function, splash: Function }} splashes
 */
function jumpingFish(world, waterSurface, splashes) {
  const random = rng(FISH_SEED);
  const pools = waterCells(world.terrain);
  const fish = goldfish(world.kit);
  fish.visible = false;
  world.root.add(fish);

  let jump = null;
  let wait = FISH_GAP[0];
  world.onUpdate((dt) => {
    if (!jump) {
      wait -= dt;
      if (wait <= 0) {
        jump = startJump(random, pools, waterSurface);
        splashAt(splashes, jump.from);
      }
      return;
    }

    jump.time += dt;
    const progress = Math.min(jump.time / FISH_JUMP_TIME, 1);
    placeFish(fish, jump, progress);
    if (progress >= 1) {
      splashAt(splashes, jump.to);
      fish.visible = false;
      jump = null;
      wait = FISH_GAP[0] + random() * (FISH_GAP[1] - FISH_GAP[0]);
    }
  });
}

/**
 * 鱼出水、入水的地方溅一下
 * @param {{ ripple: Function, splash: Function }} splashes
 * @param {THREE.Vector3} where
 */
function splashAt(splashes, where) {
  splashes.ripple(where.x, where.z, FISH_RIPPLE);
  splashes.splash(where.x, where.z, FISH_DROPS);
}

/**
 * 挑一处水，定好这一跳从哪儿到哪儿
 * @param {Function} random
 * @param {number[][]} pools 水格子的中心
 * @param {number} waterSurface
 * @returns {{ from: THREE.Vector3, to: THREE.Vector3, time: number }}
 */
function startJump(random, pools, waterSurface) {
  const [x, z] = pools[Math.floor(random() * pools.length)];
  const direction = random() * Math.PI * 2;
  const half = FISH_JUMP_LENGTH / 2;
  const from = new THREE.Vector3(x - Math.cos(direction) * half, waterSurface, z - Math.sin(direction) * half);
  const to = new THREE.Vector3(x + Math.cos(direction) * half, waterSurface, z + Math.sin(direction) * half);
  return { from, to, time: 0 };
}

/**
 * 鱼在一跳里走到哪：一条抛物线，头朝着往前飞的方向
 * @param {THREE.Group} fish
 * @param {{ from: THREE.Vector3, to: THREE.Vector3 }} jump
 * @param {number} progress 0 刚出水，1 落回水里
 */
function placeFish(fish, jump, progress) {
  fish.visible = true;
  fish.position.lerpVectors(jump.from, jump.to, progress);
  fish.position.y += Math.sin(progress * Math.PI) * FISH_JUMP_HEIGHT;

  // 往上跳时抬头，落下时低头
  fish.rotation.y = Math.atan2(jump.to.x - jump.from.x, jump.to.z - jump.from.z);
  fish.rotation.x = -Math.cos(progress * Math.PI) * 0.9;
}

/**
 * 地图上真正的水格子（不算桥和踏脚石）的中心
 * @param {Terrain} terrain
 * @returns {number[][]}
 */
function waterCells(terrain) {
  const cells = [];
  for (let row = 0; row < terrain.d; row++) {
    for (let column = 0; column < terrain.w; column++) {
      if (terrain.ch(column, row) === '~') {
        cells.push([terrain.x0 + column + 0.5, terrain.z0 + row + 0.5]);
      }
    }
  }
  return cells;
}

/**
 * 一条小金鱼：圆圆的身子，后面一条尾巴
 * @param {Kit} kit
 * @returns {THREE.Group} 头朝 +z
 */
function goldfish(kit) {
  const group = new THREE.Group();
  // 先抬头低头、再转向：不然转了向以后抬头会变成往侧面歪
  group.rotation.order = 'YXZ';
  const body = kit.sphere(0.06, '#ff8a3d', 10);
  body.scale.set(0.7, 0.8, 1.3);
  group.add(body);

  const tail = kit.cone(0.045, 0.07, '#ffb36b', 6);
  tail.rotation.x = Math.PI / 2;
  group.add(at(tail, 0, 0, -0.1));
  return group;
}
