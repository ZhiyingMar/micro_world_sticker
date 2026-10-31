// 让夜都活起来：井盖一直往外冒白汽，飞蛾绕着路灯飞，后巷和观景台挂着的彩灯被风吹得轻轻晃，垃圾桶上的猫甩尾巴
// 都只是看的，不挡路，也不会被点到；灯跟着电力亮
import * as THREE from 'three';
import { at, rng } from '../../kit.js';
import { glow, softDotTexture } from '../../fx.js';
import { ramp } from './power.js';
import { manholeCover } from './models.js';
import { MANHOLES, STRING_LIGHTS } from './layout.js';

// 井盖比路面高多少（压在沥青上）
const MANHOLE_LIFT = 0.02;
// 白汽：每个井盖隔多久冒一团，一团飘多久、升多高、从多大胀到多大，最浓时多不透明，被风往哪边吹
const STEAM_GAP = 0.45;
const STEAM_LIFE = 2.8;
const STEAM_RISE = 1.0;
const STEAM_SIZE = [0.25, 0.95];
const STEAM_OPACITY = 0.2;
const STEAM_DRIFT = [0.18, -0.06];
const STEAM_COLOR = '#d8dcf0';
const STEAM_PER_MANHOLE = Math.ceil(STEAM_LIFE / STEAM_GAP) + 1;

// 飞蛾：每盏路灯几只，绕多大一圈、多快，上下乱飞多少；画得比真的大一点，拉近玩的时候看得到
const MOTHS_PER_LAMP = 2;
const MOTH_ORBIT = [0.14, 0.3];
const MOTH_SPEED = [3, 6];
const MOTH_FLUTTER = 0.08;
const MOTH_SIZE = 0.09;
const MOTH_COLOR = '#fff4d8';
const MOTH_SEED = 29;

// 彩灯：一串几颗，灯泡多大，几种颜色（暖黄多一些），风吹着晃多大角度、多快；城市电力到多少开始亮
const BULBS_PER_STRING = 9;
const BULB_RADIUS = 0.035;
const BULB_COLORS = ['#ffd98a', '#ffd98a', '#ff9ec7', '#9ad8ff', '#b8ff9a'];
const BULB_GLOW = 0.32;
const STRING_SWAY = 0.08;
const STRING_SWAY_SPEED = 1.1;
const STRING_LIGHTS_FROM = 0.3;
const WIRE_COLOR = '#2a2c36';

// 猫闲着时尾巴慢慢甩
const TAIL_SWAY = 0.45;
const TAIL_SPEED = 1.6;

/**
 * 让夜都动起来
 * @param {World} world 夜都
 * @param {object} context
 * @param {object} context.power 电力
 * @param {THREE.Vector3[]} context.bulbs 路灯灯头在哪
 * @param {THREE.Group} context.cat 垃圾桶上的猫（头、尾巴叫 head、tail）
 */
export function bringToLife(world, { power, bulbs, cat }) {
  steam(world);
  moths(world, power, bulbs);
  stringLights(world, power);
  idleCat(world, cat);
}

// ---------- 井盖冒白汽 ----------

/**
 * 摆好井盖，一团团白汽往上飘、慢慢胀开、被风吹歪
 * @param {World} world
 */
function steam(world) {
  const puffs = [];
  MANHOLES.forEach(([x, z], index) => {
    const ground = world.heightAt(x, z) + MANHOLE_LIFT;
    world.add(manholeCover(world.kit), x, ground, z);
    for (let i = 0; i < STEAM_PER_MANHOLE; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: STEAM_COLOR, transparent: true, opacity: 0, depthWrite: false }));
      world.root.add(sprite);
      // 每团错开出生的时间，一个井盖的白汽是连着的
      puffs.push({ sprite, x, y: ground, z, age: i * STEAM_GAP + index * 0.2 });
    }
  });

  world.onUpdate((dt) => {
    for (const puff of puffs) {
      puff.age = (puff.age + dt) % (STEAM_PER_MANHOLE * STEAM_GAP);
      placePuff(puff);
    }
  });
}

/**
 * 一团白汽这一刻在哪、多大、多浓
 * @param {{ sprite: THREE.Sprite, x: number, y: number, z: number, age: number }} puff
 */
function placePuff(puff) {
  const life = Math.min(puff.age / STEAM_LIFE, 1);
  const size = STEAM_SIZE[0] + (STEAM_SIZE[1] - STEAM_SIZE[0]) * life;
  // 刚冒出来升得快，越往上越慢
  const rise = STEAM_RISE * (1 - (1 - life) ** 2);
  puff.sprite.position.set(puff.x + STEAM_DRIFT[0] * life, puff.y + 0.05 + rise, puff.z + STEAM_DRIFT[1] * life);
  puff.sprite.scale.setScalar(size);
  puff.sprite.material.opacity = STEAM_OPACITY * Math.sin(Math.PI * life);
}

// ---------- 飞蛾 ----------

/**
 * 每盏路灯边上绕着几只飞蛾，乱糟糟地转圈，灯亮了才出来
 * @param {World} world
 * @param {object} power
 * @param {THREE.Vector3[]} bulbs 灯头在哪
 */
function moths(world, power, bulbs) {
  const random = rng(MOTH_SEED);
  const between = ([low, high]) => low + random() * (high - low);
  const swarm = [];
  for (const bulb of bulbs) {
    for (let i = 0; i < MOTHS_PER_LAMP; i++) {
      const sprite = glow(MOTH_COLOR, MOTH_SIZE, 0);
      world.root.add(sprite);
      swarm.push({ sprite, center: bulb, radius: between(MOTH_ORBIT), speed: between(MOTH_SPEED) * (random() < 0.5 ? -1 : 1), phase: random() * Math.PI * 2 });
    }
  }

  power.show(({ street }, time) => {
    for (const moth of swarm) {
      const angle = time * moth.speed + moth.phase;
      // 圈的大小一胀一缩，上下乱扑，看着像扑灯的蛾子
      const radius = moth.radius * (0.75 + 0.25 * Math.sin(angle * 1.7));
      moth.sprite.position.set(moth.center.x + Math.cos(angle) * radius, moth.center.y - 0.05 + Math.sin(angle * 3.1) * MOTH_FLUTTER, moth.center.z + Math.sin(angle) * radius);
      moth.sprite.material.opacity = street;
      moth.sprite.visible = street > 0.01;
    }
  });
}

// ---------- 彩灯 ----------

/**
 * 挂起来的几串彩灯：一根垂下来的电线上挂一排小灯泡，风吹着整串轻轻晃
 * @param {World} world
 * @param {object} power 城市电力来了一颗接一颗亮
 */
function stringLights(world, power) {
  const strings = STRING_LIGHTS.map((spec, index) => hangString(world, spec, index));
  const bulbs = strings.flatMap((string) => string.bulbs);

  power.show(({ city }, time) => {
    strings.forEach((string, index) => {
      string.pivot.rotation.x = Math.sin(time * STRING_SWAY_SPEED + index * 1.7) * STRING_SWAY;
    });
    bulbs.forEach((bulb, index) => {
      // 一颗接一颗亮：后面的灯要等城市电力再高一点
      const from = STRING_LIGHTS_FROM + (index / bulbs.length) * 0.3;
      const level = ramp(from, from + 0.1, city);
      bulb.material.color.copy(bulb.userData.lit).multiplyScalar(0.08 + 0.92 * level);
      bulb.userData.halo.material.opacity = BULB_GLOW * level;
    });
  });
}

/**
 * 挂一串彩灯
 * @description 整串挂在一个绕着两头连线转的组里，转一点点就是被风吹得前后晃
 * @param {World} world
 * @param {{ from: number[], to: number[], sag: number }} spec 两头 [x, z, 离地多高]，中间垂多少
 * @param {number} index 第几串（颜色错开）
 * @returns {{ pivot: THREE.Group, bulbs: THREE.Mesh[] }}
 */
function hangString(world, { from, to, sag }, index) {
  const start = new THREE.Vector3(from[0], world.heightAt(from[0], from[1]) + from[2], from[1]);
  const end = new THREE.Vector3(to[0], world.heightAt(to[0], to[1]) + to[2], to[1]);

  // 转轴是两头的连线：外面一层放在起点、本地 x 轴指向终点；里面一层绕 x 轴晃
  const anchor = new THREE.Group();
  const span = end.clone().sub(start);
  anchor.position.copy(start);
  anchor.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), span.clone().normalize());
  const pivot = new THREE.Group();
  anchor.add(pivot);
  world.root.add(anchor);

  const length = span.length();
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(length / 2, -sag * 2, 0), new THREE.Vector3(length, 0, 0));
  pivot.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.006, 4), world.kit.m(WIRE_COLOR)));

  const bulbs = [];
  for (let i = 0; i < BULBS_PER_STRING; i++) {
    const point = curve.getPoint((i + 0.5) / BULBS_PER_STRING);
    const lit = new THREE.Color(BULB_COLORS[(i + index * 2) % BULB_COLORS.length]);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(BULB_RADIUS, 10, 8), new THREE.MeshBasicMaterial({ color: lit.clone() }));
    const halo = glow(`#${lit.getHexString()}`, 0.35, 0);
    pivot.add(at(bulb, point.x, point.y - BULB_RADIUS, point.z));
    pivot.add(at(halo, point.x, point.y - BULB_RADIUS, point.z));
    bulb.userData.lit = lit;
    bulb.userData.halo = halo;
    bulbs.push(bulb);
  }
  return { pivot, bulbs };
}

// ---------- 猫 ----------

/**
 * 猫闲着的时候尾巴慢慢甩（有人走近时 touch.js 让它扭头、甩得快一些）
 * @param {World} world
 * @param {THREE.Group} cat
 */
function idleCat(world, cat) {
  const tail = cat.getObjectByName('tail');
  // 甩的快慢会变，按累积的相位算，变快变慢时尾巴不会一下跳到别处
  let phase = 0;
  world.onUpdate((dt) => {
    const speed = TAIL_SPEED * (cat.userData.excited ? 3 : 1);
    phase += dt * speed;
    tail.rotation.y = Math.sin(phase) * TAIL_SWAY;
  });
}
