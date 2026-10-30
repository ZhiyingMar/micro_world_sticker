// 让小镇活起来：风吹树冠、稻草人和芦苇轻轻晃，风车一直转（小镇卡住了时停着），烟囱冒出一团团方块烟，
// 方块云从天上飘过、影子从小镇上滑过去，花丛上飞着蝴蝶（人走近会被惊飞）
// 都只是看的，不挡路，也不会被点到
import * as THREE from 'three';
import { rng } from '../../kit.js';
import { swayInWind } from '../../plants.js';
import { createButterflies } from '../../butterflies.js';
import { cloud } from './models.js';
import { SUN } from './layout.js';

// 风车：平时转多快（弧度每秒），风一阵大一阵小，多久一个来回、差多少
const WINDMILL_SPEED = 0.9;
const GUST_SPEED = 0.25;
const GUST_DEPTH = 0.35;

// 炊烟：每个烟囱几团烟反复用，隔多久冒一团（秒），一团飘多久；往上飘多快，被风往右吹多快；
// 从多小长到多大，颜色从灰到白
const SMOKE_PUFFS = 6;
const SMOKE_GAP = 0.7;
const SMOKE_LIFE = 3.6;
const SMOKE_RISE = 0.45;
const SMOKE_DRIFT = 0.18;
const SMOKE_SIZE = [0.12, 0.34];
const SMOKE_COLORS = ['#bdb8b2', '#f4f2ee'];
const SMOKE_OPACITY = 0.85;
// 一团烟刚冒出来时，用一辈子的多少（比例）变到最浓，后面慢慢淡掉
const SMOKE_FADE_IN = 0.15;

// 看得见的云：方块前后各飘几朵（飘在小镇正上方会挡住斜着往下看的镜头）；离方块边多远、多高，飘多快（每秒多远）；
// 飘出方块外面多远再从另一边回来
const CLOUDS_PER_SIDE = 2;
const CLOUD_OUT = [1.5, 4];
const CLOUD_HEIGHT = [2.2, 4.2];
const CLOUD_SPEED = [0.18, 0.3];
const CLOUD_WRAP = 3;
// 云在镜头这一侧时淡掉（不然转镜头时会挡在镜头前面）：朝镜头的程度（-1 在对面、1 正对镜头）从多少开始淡、到多少完全没了
const CLOUD_FADE = [-0.1, 0.35];
// 只投影子的云：几朵，多高；影子从小镇上慢慢滑过去，看不见云本身
const SHADOW_CLOUDS = 2;
const SHADOW_CLOUD_HEIGHT = 7;
const SHADOW_CLOUD_SPEED = [0.22, 0.32];
const CLOUD_SEED = 53;

// 蝴蝶怎么飞每次都一样
const BUTTERFLY_SEED = 31;

/**
 * 让小镇动起来
 * @param {World} world 像素小镇
 * @param {object} context
 * @param {THREE.Group[]} context.crowns 所有树冠
 * @param {THREE.Object3D[]} context.swaying 别的风吹会晃的东西（稻草人、芦苇）
 * @param {THREE.Group} context.blades 风车的风叶
 * @param {THREE.Vector3[]} context.chimneys 烟囱口在哪
 * @param {number[][]} context.gardens 几大片花丛的中心 [x, z]
 * @returns {{ windmill: { setPower(level: number): void } }} 风车转得多带劲（0 停着，1 平时那样转）
 */
export function bringToLife(world, { crowns, swaying, blades, chimneys, gardens }) {
  swayInWind(world, [...crowns, ...swaying]);
  const windmill = spinWindmill(world, blades);
  for (const chimney of chimneys) {
    chimneySmoke(world, chimney);
  }
  driftingClouds(world);
  createButterflies(world, gardens.map(([x, z]) => ({ x, z, y: world.heightAt(x, z) })), BUTTERFLY_SEED);
  return { windmill };
}

/**
 * 风车一直转，风大的时候快一点
 * @param {World} world
 * @param {THREE.Group} blades
 * @returns {{ setPower(level: number): void }} 转得多带劲：0 停着，1 平时那样转（转起来时从 0 慢慢加上去）
 */
function spinWindmill(world, blades) {
  let power = 1;
  world.onUpdate((dt, time) => {
    const gust = 1 + GUST_DEPTH * Math.sin(time * GUST_SPEED);
    blades.rotation.z -= dt * WINDMILL_SPEED * gust * power;
  });
  return {
    setPower(level) {
      power = level;
    },
  };
}

/**
 * 烟囱冒烟：一团团方块烟往上飘，被风往右吹，越飘越大、越淡，最后没了
 * @param {World} world
 * @param {THREE.Vector3} chimney 烟囱口
 */
function chimneySmoke(world, chimney) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const gray = new THREE.Color(SMOKE_COLORS[0]);
  const white = new THREE.Color(SMOKE_COLORS[1]);
  const puffs = Array.from({ length: SMOKE_PUFFS }, () => {
    // 每团烟自己一份材质，各淡各的
    const material = new THREE.MeshLambertMaterial({ color: gray.clone(), transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    world.root.add(mesh);
    return { mesh, age: 0, spin: 0 };
  });

  let wait = Math.random() * SMOKE_GAP;
  world.onUpdate((dt) => {
    wait -= dt;
    if (wait <= 0) {
      wait = SMOKE_GAP;
      const puff = puffs.find((candidate) => !candidate.mesh.visible) ?? puffs[0];
      puff.age = 0;
      puff.spin = (Math.random() - 0.5) * 2;
      puff.mesh.visible = true;
    }

    for (const puff of puffs) {
      if (!puff.mesh.visible) {
        continue;
      }
      puff.age += dt;
      const life = puff.age / SMOKE_LIFE;
      if (life >= 1) {
        puff.mesh.visible = false;
        continue;
      }
      puff.mesh.position.set(chimney.x + puff.age * SMOKE_DRIFT, chimney.y + puff.age * SMOKE_RISE, chimney.z);
      puff.mesh.scale.setScalar(SMOKE_SIZE[0] + (SMOKE_SIZE[1] - SMOKE_SIZE[0]) * Math.sqrt(life));
      puff.mesh.rotation.y = puff.spin * puff.age;
      puff.mesh.material.color.copy(gray).lerp(white, life);
      puff.mesh.material.opacity = SMOKE_OPACITY * Math.min(1, life / SMOKE_FADE_IN) * (1 - life);
    }
  });
}

/**
 * 方块云：看得见的几朵飘在方块前后的天上，转到镜头这一侧的会淡掉；另有几朵看不见、只投影子的云飘在小镇上空，
 * 影子从房顶、广场上滑过去
 * @description 云真飘在小镇上空的话，斜着往下看的镜头会被它挡住；影子和云分开，天上有云、地上有云影，都不挡人
 * @param {World} world
 */
function driftingClouds(world) {
  const random = rng(CLOUD_SEED);
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const drifters = [];

  const sides = [
    { edge: minZ, outward: -1 },
    { edge: maxZ, outward: 1 },
  ];
  const visible = [];
  sides.forEach(({ edge, outward }, sideIndex) => {
    for (let i = 0; i < CLOUDS_PER_SIDE; i++) {
      const mesh = cloud(world.kit, CLOUD_SEED + sideIndex * CLOUDS_PER_SIDE + i);
      // 每朵云自己一份材质，各淡各的
      mesh.material = mesh.material.clone();
      mesh.material.transparent = true;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const out = CLOUD_OUT[0] + random() * (CLOUD_OUT[1] - CLOUD_OUT[0]);
      const y = CLOUD_HEIGHT[0] + random() * (CLOUD_HEIGHT[1] - CLOUD_HEIGHT[0]);
      const lane = { from: minX - CLOUD_WRAP, to: maxX + CLOUD_WRAP, y, z: edge + outward * out };
      const drifting = drifter(world, mesh, { ...lane, speed: CLOUD_SPEED, random, index: i, count: CLOUDS_PER_SIDE });
      drifters.push(drifting);
      visible.push(mesh);
    }
  });

  // 影子落在云下面、顺着太阳光往远离太阳那边挪：云要摆在影子的"上游"
  const [sunX, sunY, sunZ] = SUN[2];
  const shadowShiftX = (-sunX / sunY) * SHADOW_CLOUD_HEIGHT;
  const shadowShiftZ = (-sunZ / sunY) * SHADOW_CLOUD_HEIGHT;
  const shadowOnly = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false });
  for (let i = 0; i < SHADOW_CLOUDS; i++) {
    const mesh = cloud(world.kit, CLOUD_SEED + CLOUDS_PER_SIDE * sides.length + i);
    mesh.material = shadowOnly;
    mesh.receiveShadow = false;
    const shadowZ = minZ + random() * (maxZ - minZ);
    const options = { from: minX - CLOUD_WRAP - shadowShiftX, to: maxX + CLOUD_WRAP - shadowShiftX, y: SHADOW_CLOUD_HEIGHT, z: shadowZ - shadowShiftZ };
    drifters.push(drifter(world, mesh, { ...options, speed: SHADOW_CLOUD_SPEED, random, index: i, count: SHADOW_CLOUDS }));
  }

  world.onUpdate((dt) => {
    for (const { mesh, speed, from, to } of drifters) {
      mesh.position.x += dt * speed;
      if (mesh.position.x > to) {
        mesh.position.x = from;
      }
    }
    fadeCloudsNearCamera(world.env.camera, visible);
  });
}

/**
 * 转到镜头这一侧的云淡掉，对面的云照常
 * @param {THREE.Camera | undefined} camera
 * @param {THREE.Mesh[]} clouds 看得见的云
 */
function fadeCloudsNearCamera(camera, clouds) {
  if (!camera) {
    return;
  }
  const toCamera = new THREE.Vector2(camera.position.x, camera.position.z).normalize();
  for (const mesh of clouds) {
    const toCloud = new THREE.Vector2(mesh.position.x, mesh.position.z).normalize();
    const facing = toCloud.dot(toCamera);
    const opacity = 1 - THREE.MathUtils.smoothstep(facing, CLOUD_FADE[0], CLOUD_FADE[1]);
    mesh.material.opacity = opacity;
    mesh.visible = opacity > 0.01;
  }
}

/**
 * 摆好一朵飘着的云：在飘的那段路上错开摆，点不到它
 * @param {World} world
 * @param {THREE.Mesh} mesh
 * @param {object} lane
 * @param {number} lane.from 从哪儿飘起（x）
 * @param {number} lane.to 飘到哪儿就回到 from
 * @param {number} lane.y 多高
 * @param {number} lane.z
 * @param {number[]} lane.speed 飘多快的范围
 * @param {Function} lane.random
 * @param {number} lane.index 这一组里第几朵
 * @param {number} lane.count 这一组几朵（错开摆）
 * @returns {{ mesh: THREE.Mesh, speed: number, from: number, to: number }}
 */
function drifter(world, mesh, { from, to, y, z, speed, random, index, count }) {
  // 云不挡点击：点到天上的云不该让人往那儿走
  mesh.raycast = () => {};
  const x = from + ((index + random()) / count) * (to - from);
  world.add(mesh, x, y, z);
  return { mesh, speed: speed[0] + random() * (speed[1] - speed[0]), from, to };
}
