// 蘑菇屋：三座散在林子里（左后的红蘑菇屋、小土坡上的黄蘑菇屋、右边草地上的蓝蘑菇屋），门口是小人闲逛时爱去的地方
import { mushroomHouse } from './models.js';
import { HOUSES } from './layout.js';

// 墙外面再留一点，人别贴着墙走
const WALL_PAD = 0.05;
// 门口站人的地方离墙多远
const DOORSTEP = 0.35;
// 在门口站多久（秒）
const DOORSTEP_STAY = 6;

/**
 * 摆三座蘑菇屋
 * @param {World} world 童话森林
 * @returns {{ houses: { x: number, z: number, radius: number, size: number, cap: THREE.Group }[] }} 每座屋子在哪、墙多粗、多大、菌盖（碰一下会弹）
 */
export function buildVillage(world) {
  return { houses: HOUSES.map((house) => placeHouse(world, house)) };
}

/**
 * 摆一座蘑菇屋，登记碰撞，门口加一个兴趣点
 * @description 菌盖很大，人走到屋子后面会被挡住，所以登记成会变半透明的大件
 * @param {World} world
 * @param {object} house layout 里 HOUSES 的一项
 * @returns {{ x: number, z: number, radius: number, size: number, cap: THREE.Group }}
 */
function placeHouse(world, house) {
  const { group, cap } = mushroomHouse(world.kit, house);
  const radius = house.stemRadius + WALL_PAD;
  world.add(group, house.x, world.heightAt(house.x, house.z), house.z, house.facing);
  world.solidCircle(house.x, house.z, radius);
  world.fadeable(group);

  // 站在门口往外看
  const doorDistance = house.stemRadius + DOORSTEP;
  const doorX = house.x + Math.sin(house.facing) * doorDistance;
  const doorZ = house.z + Math.cos(house.facing) * doorDistance;
  world.poi(doorX, doorZ, { emote: house.emote, face: house.facing, dur: DOORSTEP_STAY });
  return { x: house.x, z: house.z, radius, size: house.capRadius, cap };
}
