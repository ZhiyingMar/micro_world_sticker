// 蘑菇屋：三座散在林子里（左后的红蘑菇屋、小土坡上的黄蘑菇屋、右边草地上的蓝蘑菇屋），门口是小人闲逛时爱去的地方
// 黄蘑菇屋门口还有蘑菇仔的读书树桩：童话书就放在它顶上
import { mushroomHouse, stump, STUMP_RADIUS, STUMP_HEIGHT } from './models.js';
import { HOUSES, READING_STUMP } from './layout.js';

// 墙外面再留一点，人别贴着墙走
const WALL_PAD = 0.05;
// 门口站人的地方离墙多远
const DOORSTEP = 0.35;
// 在门口站多久（秒）
const DOORSTEP_STAY = 6;

/**
 * 摆三座蘑菇屋和蘑菇仔的读书树桩
 * @description 树桩要在花草之前摆好，花草才会绕开它长
 * @param {World} world 童话森林
 * @returns {{ houses: { x: number, z: number, radius: number, size: number, cap: THREE.Group }[], readingStump: { x: number, y: number, z: number } }}
 *   每座屋子在哪、墙多粗、多大、菌盖（碰一下会弹）；读书树桩顶面的中心
 */
export function buildVillage(world) {
  const houses = HOUSES.map((house) => placeHouse(world, house));
  return { houses, readingStump: placeReadingStump(world) };
}

/**
 * 黄蘑菇屋门口的读书树桩
 * @param {World} world
 * @returns {{ x: number, y: number, z: number }} 树桩顶面的中心，童话书放在这儿
 */
function placeReadingStump(world) {
  const [x, z] = READING_STUMP;
  const groundY = world.heightAt(x, z);
  world.add(stump(world.kit), x, groundY, z);
  world.solidCircle(x, z, STUMP_RADIUS);
  return { x, y: groundY + STUMP_HEIGHT, z };
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
