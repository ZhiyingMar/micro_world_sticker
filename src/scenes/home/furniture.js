// 把家具摆进小屋：摆在哪在 layout.js，长什么样在 furniture-models.js
// 摆好就登记碰撞和小人会去的兴趣点（打盹、看书、喝茶……）；凳子也挡人，小人从旁边一步坐上去
import * as THREE from 'three';
import { bed, floorLamp, bookshelf, kitchenCounter, fridge, teaTable, stool, braidedRug, bigPlant, radioCabinet, yarnBasket, slippers } from './furniture-models.js';
import { FURNITURE, STOOLS, RUG } from './layout.js';

// 碰撞：床的包围盒往里收一点（床柱顶上的圆球不挡人）；灯、桌子、凳子、盆栽、篮子按圆算，各多大
const BED_PAD = -0.05;
const LAMP_RADIUS = 0.25;
const TABLE_RADIUS = 0.8;
const STOOL_RADIUS = 0.25;
const PLANT_RADIUS = 0.45;
const BASKET_RADIUS = 0.33;
// 坐凳子：人先站在凳子外面多远（凳子半径 + 小人的半径 + 一点空），坐上去离地多高，坐多久
const PERSON_RADIUS = 0.22; // 和 villager.js 里小人的半径一样
const SEAT_GAP = 0.05;
const SEAT_APPROACH = STOOL_RADIUS + PERSON_RADIUS + SEAT_GAP;
const SEAT_HEIGHT = 0.42;
const SEAT_TIME = 8;
// 地毯比地板高一点点，贴在同一高度会闪
const RUG_LIFT = 0.015;
// 兴趣点：站在家具哪边（离家具中心的 [dx, dz]）、头朝哪、待多久、头上冒什么
const NAP = { offset: [1.35, 0.1], face: -Math.PI / 2, dur: 7, emote: '💤' };
const READ = { offset: [0, 0.72], face: Math.PI, dur: 6, emote: '📖' };
const SNACK = { offset: [0, 0.8], face: Math.PI, dur: 5, emote: '🍰' };
const WATER_PLANT = { offset: [0.7, 0], face: -Math.PI / 2, dur: 5, emote: '🌱' };
const LISTEN = { offset: [0.7, 0], face: -Math.PI / 2, dur: 7, emote: '♪' };

/**
 * 摆上屋里的家具，登记碰撞和兴趣点
 * @param {World} world 小屋这个世界
 * @param {import('./materials.js').FurnitureKit} furniture 造家具用的工具和材质
 * @returns {{ spout: THREE.Object3D, cabinet: THREE.Object3D, radio: THREE.Object3D, lamp: object }} 茶壶嘴（冒热气）；
 *   收音机柜和柜上的收音机（放音乐、点它开关）；落地灯的灯光和材质（天黑了开灯，见 floorLamp）
 */
export function buildFurniture(world, furniture) {
  world.solid(place(world, bed(furniture), FURNITURE.bed), BED_PAD);
  addPoi(world, FURNITURE.bed, NAP);

  const lamp = floorLamp(furniture);
  place(world, lamp.group, FURNITURE.lamp);
  world.solidCircle(FURNITURE.lamp.x, FURNITURE.lamp.z, LAMP_RADIUS);

  world.solid(place(world, bookshelf(furniture), FURNITURE.shelf));
  addPoi(world, FURNITURE.shelf, READ);

  world.solid(place(world, kitchenCounter(furniture), FURNITURE.counter));
  placeFridge(world, furniture);

  const { spout } = placeTeaCorner(world, furniture);

  place(world, bigPlant(furniture), FURNITURE.plant);
  world.solidCircle(FURNITURE.plant.x, FURNITURE.plant.z, PLANT_RADIUS);
  addPoi(world, FURNITURE.plant, WATER_PLANT);

  const cabinet = radioCabinet(furniture);
  world.solid(place(world, cabinet.group, FURNITURE.cabinet));
  addPoi(world, FURNITURE.cabinet, LISTEN);

  place(world, yarnBasket(furniture), FURNITURE.basket);
  world.solidCircle(FURNITURE.basket.x, FURNITURE.basket.z, BASKET_RADIUS);
  place(world, slippers(furniture.kit), FURNITURE.slippers);

  return { spout, cabinet: cabinet.group, radio: cabinet.radio, lamp };
}

/**
 * 把一件家具摆到它的位置上（贴着地面，转到它的朝向）
 * @param {World} world
 * @param {THREE.Object3D} object 家具
 * @param {{ x: number, z: number, facing?: number }} spot layout 里这件家具的位置
 * @returns {THREE.Object3D} 摆好的家具
 */
function place(world, object, spot) {
  return world.add(object, spot.x, world.heightAt(spot.x, spot.z), spot.z, spot.facing ?? 0);
}

/**
 * 在一件家具旁边登记一个兴趣点
 * @param {World} world
 * @param {{ x: number, z: number }} spot 家具在哪
 * @param {{ offset: number[], face: number, dur: number, emote: string }} poi 站在哪边、朝哪、待多久、冒什么
 */
function addPoi(world, spot, poi) {
  const [dx, dz] = poi.offset;
  world.poi(spot.x + dx, spot.z + dz, { emote: poi.emote, face: poi.face, dur: poi.dur });
}

/**
 * 冰箱：点它或者走近按 E 打开冰箱贴收藏；冰箱顶上藏着魔法星星
 * @param {World} world
 * @param {import('./materials.js').FurnitureKit} furniture
 */
function placeFridge(world, furniture) {
  const model = fridge(furniture);
  model.traverse((part) => {
    part.userData.action = 'fridge';
  });
  model.userData.label = '冰箱 · 点击打开';
  world.solid(place(world, model, FURNITURE.fridge));
  world.fridge = model;
  addPoi(world, FURNITURE.fridge, SNACK);
}

/**
 * 地毯中间的茶桌，两边各一张凳子；小人走到凳子旁边，一步坐上去喝茶
 * @param {World} world
 * @param {import('./materials.js').FurnitureKit} furniture
 * @returns {{ spout: THREE.Mesh }} 茶壶嘴
 */
function placeTeaCorner(world, furniture) {
  world.add(braidedRug(furniture, RUG.radius), RUG.x, world.heightAt(RUG.x, RUG.z) + RUG_LIFT, RUG.z);

  const table = teaTable(furniture);
  place(world, table.group, RUG);
  world.solidCircle(RUG.x, RUG.z, TABLE_RADIUS);

  for (const seat of STOOLS) {
    place(world, stool(furniture, seat.color), seat);
    world.solidCircle(seat.x, seat.z, STOOL_RADIUS);

    // 站的地方在凳子背对桌子的那一边，坐下时脸朝桌子
    const away = new THREE.Vector2(seat.x - RUG.x, seat.z - RUG.z).normalize();
    world.poi(seat.x + away.x * SEAT_APPROACH, seat.z + away.y * SEAT_APPROACH, {
      emote: seat.emote,
      face: Math.atan2(RUG.x - seat.x, RUG.z - seat.z),
      dur: SEAT_TIME,
      sit: true,
      seatY: SEAT_HEIGHT,
      seat: { x: seat.x, z: seat.z },
    });
  }
  return { spout: table.spout };
}
