// 蘑菇屋村：左后角三座蘑菇屋，门口是小人闲逛时爱去的地方
import { mushroomHouse } from './models.js';
import { HOUSES } from './layout.js';

// 墙外面再留一点，人别贴着墙走
const WALL_PAD = 0.05;
// 门口站人的地方离墙多远
const DOORSTEP = 0.35;
// 在门口站多久（秒）
const DOORSTEP_STAY = 6;

/**
 * 搭蘑菇屋村
 * @param {World} world 童话森林
 */
export function buildVillage(world) {
  for (const house of HOUSES) {
    placeHouse(world, house);
  }
}

/**
 * 摆一座蘑菇屋，登记碰撞，门口加一个兴趣点
 * @description 菌盖很大，人走到屋子后面会被挡住，所以登记成会变半透明的大件
 * @param {World} world
 * @param {object} house layout 里 HOUSES 的一项
 */
function placeHouse(world, house) {
  const model = mushroomHouse(world.kit, house);
  world.add(model, house.x, world.heightAt(house.x, house.z), house.z, house.facing);
  world.solidCircle(house.x, house.z, house.stemRadius + WALL_PAD);
  world.fadeable(model);

  // 站在门口往外看
  const doorDistance = house.stemRadius + DOORSTEP;
  const doorX = house.x + Math.sin(house.facing) * doorDistance;
  const doorZ = house.z + Math.cos(house.facing) * doorDistance;
  world.poi(doorX, doorZ, { emote: house.emote, face: house.facing, dur: DOORSTEP_STAY });
}
