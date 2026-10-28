// 翻像素块：灌木丛、蓝屋子后院的木箱堆和木桶、菜畦、风车门口的干草堆都能按 E 翻
// 东西都是别的文件摆好的，这里只登记成能翻的地方；每次藏哪几处、藏几个由 layout 里的 BLOCK_HIDING 定
import { CRATES, BARREL, CROP_ROWS, HAYSTACK } from './layout.js';

// 灌木丛里的像素块塞在里面多深（灌木半径的几成），朝镜头那边露出一个角
const BUSH_TUCK = 0.55;
// 木箱堆比别的地方大一圈：站在它旁边就够得着
const CRATE_REACH = 1.1;

/**
 * 把小镇里能翻的地方都登记上
 * @param {World} world 像素小镇
 * @param {object} spots 别的文件摆好的东西
 * @param {{ x: number, z: number, radius: number, group: THREE.Group }[]} spots.bushes 能翻的灌木丛
 * @param {{ crates: THREE.Group, barrel: THREE.Group }} spots.backyard 蓝屋子后院的木箱堆和木桶
 * @param {THREE.Mesh[]} spots.beds 每行菜畦的土，顺序和 CROP_ROWS 一样
 * @param {THREE.Group} spots.haystack 风车门口的干草堆
 */
export function buildForage(world, { bushes, backyard, beds, haystack }) {
  bushHideouts(world, bushes);
  backyardHideouts(world, backyard);
  bedHideouts(world, beds);
  world.hideout('haystack', haystack, HAYSTACK[0], HAYSTACK[1], { tags: ['hay'], name: '干草堆', icon: '🌾' });
}

/**
 * 灌木丛：像素块塞在里面，露出一个角
 * @param {World} world
 * @param {{ x: number, z: number, radius: number, group: THREE.Group }[]} bushes
 */
function bushHideouts(world, bushes) {
  bushes.forEach(({ x, z, radius, group }, index) => {
    const tucked = radius * BUSH_TUCK;
    world.hideout(`bush${index}`, group, x, z, { tags: ['bush'], name: '灌木丛', icon: '🌿', show: 'peek', offset: [tucked, tucked] });
  });
}

/**
 * 后院的木箱堆和木桶：东西整个藏在里面，翻开才知道有没有
 * @param {World} world
 * @param {{ crates: THREE.Group, barrel: THREE.Group }} backyard
 */
function backyardHideouts(world, { crates, barrel }) {
  world.hideout('crates', crates, CRATES.x, CRATES.z, { tags: ['crate'], name: '木箱堆', icon: '📦', reach: CRATE_REACH });
  world.hideout('barrel', barrel, BARREL[0], BARREL[1], { tags: ['crate'], name: '木桶', icon: '🛢️' });
}

/**
 * 菜畦：每行一格，像素块半埋在两棵菜中间的土里，斜着露出来
 * @param {World} world
 * @param {THREE.Mesh[]} beds
 */
function bedHideouts(world, beds) {
  CROP_ROWS.forEach((row, index) => {
    world.hideout(`bed${index}`, beds[index], row.digX, row.z, { tags: ['bed'], name: '菜畦', icon: '🥕', show: 'peek' });
  });
}
