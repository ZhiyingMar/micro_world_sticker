// 翻蘑菇：灌木丛、树桩、落叶堆都能按 E 翻，每次进来随机挑几处长出小蘑菇
// 这里只摆东西、登记能翻的地方；藏哪几处、藏几个由 layout 里的 MUSHROOM_HIDING 定
import { stump, leafPile, STUMP_RADIUS } from './models.js';
import { bush } from '../../plants.js';
import { BUSHES, STUMPS, LEAF_PILES } from './layout.js';

// 树桩上的蘑菇长在树桩脚下，离树桩中心多远 [dx, dz]（朝镜头那边，一眼看得见）
const STUMP_MUSHROOM_OFFSET = [0.34, 0.22];
// 灌木丛里的蘑菇塞在里面多深（灌木半径的几成），只露出一点
const BUSH_TUCK = 0.55;
// 落叶堆的样子从这个种子开始，一堆换一个
const LEAF_SEED = 17;

/**
 * 摆灌木丛、树桩、落叶堆，登记成能翻的地方
 * @param {World} world 童话森林
 */
export function buildForage(world) {
  bushes(world);
  stumps(world);
  leafPiles(world);
}

/**
 * 灌木丛：蘑菇塞在里面，露出一点帽子
 * @param {World} world
 */
function bushes(world) {
  BUSHES.forEach(([x, z, radius], index) => {
    const shrub = world.add(bush(world.kit, radius), x, world.heightAt(x, z), z);
    const tucked = radius * BUSH_TUCK;
    world.hideout(`bush${index}`, shrub, x, z, { tags: ['bush'], name: '灌木丛', icon: '🌿', show: 'peek', offset: [tucked, tucked] });
  });
}

/**
 * 树桩：蘑菇明明白白长在树桩脚下，没长的时候也没什么好翻的
 * @param {World} world
 */
function stumps(world) {
  STUMPS.forEach(([x, z], index) => {
    const stumpModel = world.add(stump(world.kit), x, world.heightAt(x, z), z);
    world.solidCircle(x, z, STUMP_RADIUS);
    world.hideout(`stump${index}`, stumpModel, x, z, { tags: ['stump'], name: '树桩', icon: '🪵', show: 'open', offset: STUMP_MUSHROOM_OFFSET });
  });
}

/**
 * 落叶堆：蘑菇整个盖在叶子底下，翻开才知道有没有
 * @param {World} world
 */
function leafPiles(world) {
  LEAF_PILES.forEach(([x, z], index) => {
    const pile = world.add(leafPile(world.kit, LEAF_SEED + index), x, world.heightAt(x, z), z);
    world.hideout(`leaves${index}`, pile, x, z, { tags: ['leaves'], name: '落叶堆', icon: '🍂', show: 'inside' });
  });
}
