// 让森林活起来：风吹树冠轻轻摇，蝴蝶在花丛上飞，池塘里时不时跳起一条鱼
// 都只是看的，不挡路，也不会被点到
import * as THREE from 'three';
import { at, rng } from '../../kit.js';
import { FLOWER_PATCHES, HOUSES } from './layout.js';

// 风：树冠摇多快、摇多大角度（弧度）；风一阵大一阵小，多久一个来回
const WIND_SPEED = 1.3;
const WIND_ANGLE = 0.035;
const GUST_SPEED = 0.25;
const GUST_DEPTH = 0.4;

// 蝴蝶：几只，翅膀什么颜色，绕着花丛飞多大一圈、飞多高、扇翅膀多快
const BUTTERFLY_COLORS = ['#ffd84a', '#ffffff', '#ff9ec2', '#9fd3ff', '#ffb36b'];
const BUTTERFLY_ORBIT = [0.35, 0.7];
const BUTTERFLY_HEIGHT = 0.4;
const BUTTERFLY_BOB = 0.12;
const BUTTERFLY_FLAP_SPEED = 16;
const BUTTERFLY_FLAP_ANGLE = 1.1;
// 比真的蝴蝶画大一点，远远看过去也认得出来
const BUTTERFLY_SCALE = 2;
const BUTTERFLY_SEED = 31;

// 鱼：隔多久跳一次（秒，随机），一跳多久、多高、多远；溅起的水花
const FISH_GAP = [4, 9];
const FISH_JUMP_TIME = 0.7;
const FISH_JUMP_HEIGHT = 0.35;
const FISH_JUMP_LENGTH = 0.5;
const SPLASH = { count: 8, spread: 0.14, size: 0.18, rise: 0.6, life: 0.6, color: '#e6f8ff' };
const FISH_SEED = 7;

/**
 * 让森林动起来
 * @param {World} world 童话森林
 * @param {object} context
 * @param {THREE.Group[]} context.crowns 所有树冠
 * @param {number} context.waterSurface 水面多高
 */
export function bringToLife(world, { crowns, waterSurface }) {
  wind(world, crowns);
  butterflies(world);
  jumpingFish(world, waterSurface);
}

/**
 * 风吹树冠：每棵树摇的步子错开，一阵风大一阵风小
 * @description 树冠绕着树干顶轻轻晃，树干不动；整片林子一起动，画面才是活的
 * @param {World} world
 * @param {THREE.Group[]} crowns
 */
function wind(world, crowns) {
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

/**
 * 蝴蝶：每只绕着一片花丛飞，忽高忽低，扇着翅膀
 * @param {World} world
 */
function butterflies(world) {
  const random = rng(BUTTERFLY_SEED);
  // 花丛的中心：空地上那几大片，加上每座蘑菇屋门口
  const gardens = [...FLOWER_PATCHES.map(([x, z]) => [x, z]), ...HOUSES.map((house) => [house.x + Math.sin(house.facing), house.z + Math.cos(house.facing)])];

  const flock = gardens.map(([x, z], index) => {
    const color = BUTTERFLY_COLORS[index % BUTTERFLY_COLORS.length];
    const { group, wings } = butterfly(world.kit, color);
    group.scale.setScalar(BUTTERFLY_SCALE);
    world.root.add(group);
    return {
      group,
      wings,
      x,
      z,
      groundY: world.heightAt(x, z),
      orbit: BUTTERFLY_ORBIT[0] + random() * (BUTTERFLY_ORBIT[1] - BUTTERFLY_ORBIT[0]),
      speed: 0.6 + random() * 0.5,
      phase: random() * Math.PI * 2,
    };
  });

  world.onUpdate((dt, time) => {
    for (const fly of flock) {
      flutter(fly, time);
    }
  });
}

/**
 * 一只蝴蝶这一帧在哪、朝哪、翅膀扇到哪
 * @param {object} fly butterflies() 里的一只
 * @param {number} time 世界里过了多久（秒）
 */
function flutter(fly, time) {
  const angle = time * fly.speed + fly.phase;
  // 横着是一个歪歪扭扭的 8 字，看起来不像绕圈
  const x = fly.x + Math.sin(angle) * fly.orbit;
  const z = fly.z + Math.sin(angle * 2) * fly.orbit * 0.5;
  const y = fly.groundY + BUTTERFLY_HEIGHT + Math.sin(angle * 3.1) * BUTTERFLY_BOB;

  // 朝着飞的方向
  const headingX = Math.cos(angle) * fly.orbit;
  const headingZ = Math.cos(angle * 2) * fly.orbit;
  fly.group.position.set(x, y, z);
  fly.group.rotation.y = Math.atan2(headingX, headingZ);

  const flap = Math.abs(Math.sin(time * BUTTERFLY_FLAP_SPEED + fly.phase)) * BUTTERFLY_FLAP_ANGLE;
  fly.wings[0].rotation.z = flap;
  fly.wings[1].rotation.z = -flap;
}

/**
 * 一只蝴蝶：细细的身子，左右两片翅膀，翅膀的根在身子上，扇的时候绕着根转
 * @param {Kit} kit
 * @param {string} color 翅膀颜色
 * @returns {{ group: THREE.Group, wings: THREE.Mesh[] }} 朝 +z 飞
 */
function butterfly(kit, color) {
  const group = new THREE.Group();
  const body = kit.cyl(0.008, 0.008, 0.08, '#4a3a30', 5);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.05, 0.06, 0.1, 0.04, 0.09, -0.01);
  shape.bezierCurveTo(0.08, -0.05, 0.03, -0.04, 0, 0);
  const wingGeometry = new THREE.ShapeGeometry(shape);
  wingGeometry.rotateX(-Math.PI / 2);

  const wings = [1, -1].map((side) => {
    const wing = kit.mesh(wingGeometry, color, { side: THREE.DoubleSide });
    wing.scale.x = side;
    group.add(wing);
    return wing;
  });
  return { group, wings };
}

/**
 * 池塘、小溪里时不时跳起一条小鱼，入水出水各溅一下水花
 * @param {World} world
 * @param {number} waterSurface 水面多高
 */
function jumpingFish(world, waterSurface) {
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
        world.fx.emit(jump.from, SPLASH);
      }
      return;
    }

    jump.time += dt;
    const progress = Math.min(jump.time / FISH_JUMP_TIME, 1);
    placeFish(fish, jump, progress);
    if (progress >= 1) {
      world.fx.emit(jump.to, SPLASH);
      fish.visible = false;
      jump = null;
      wait = FISH_GAP[0] + random() * (FISH_GAP[1] - FISH_GAP[0]);
    }
  });
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
