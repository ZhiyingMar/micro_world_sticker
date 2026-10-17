// 马路外面的边缘：坡上公园、社区花园、后巷和背景高楼、观景台
// 都要过马路才去得了；藏在这里的东西由 story.js 和瓶子那边放
import { bench, darkTree, bush, telescope, planter, hedge, gardenBed, shed, backdropBuilding, dumpster, airConditioner, cat } from './models.js';
import { PARK_BENCH, PARK_TREES, HEDGES, BUSHES, GARDEN_BEDS, GARDEN_SHED, BACKDROP, BACKDROP_Z, BACKDROP_DEPTH, BACK_LANE_PROPS, TELESCOPE, PLANTERS, MOON } from './layout.js';

// 垃圾桶盖子的高度（猫蹲在上面）
const DUMPSTER_LID = 0.62;

/**
 * 搭边缘
 * @param {World} world 夜都
 * @param {object} power 电力（背景高楼的窗户跟着亮）
 */
export function buildEdges(world, power) {
  park(world);
  garden(world);
  backLane(world, power);
  lookout(world);
}

/**
 * 地面上 (x, z) 处摆一个东西
 * @param {World} world
 * @param {THREE.Object3D} object 要摆的东西
 * @param {number} x
 * @param {number} z
 * @param {number} facing 朝向（弧度）
 */
function placeOnGround(world, object, x, z, facing = 0) {
  return world.add(object, x, world.heightAt(x, z) + object.position.y, z, facing);
}

/**
 * 坡上公园：树篱隔出弯弯曲曲的小路，左边土坡、右边高台
 * @description 长椅藏在土坡靠马路那一面，默认镜头被土坡和树挡住，要转镜头或者走过去才发现
 * @param {World} world
 */
function park(world) {
  const kit = world.kit;

  const [benchX, benchZ] = PARK_BENCH;
  placeOnGround(world, bench(kit), benchX, benchZ);
  world.poi(benchX - 0.3, benchZ, { emote: '🌙', face: Math.PI, dur: 9, sit: true, seatY: 0.45 });

  for (const [x, z, radius] of PARK_TREES) {
    placeOnGround(world, darkTree(kit, radius), x, z);
    world.solidCircle(x, z, 0.18);
  }

  for (const [minX, maxX, minZ, maxZ] of HEDGES) {
    const x = (minX + maxX) / 2;
    const z = (minZ + maxZ) / 2;
    const alongX = maxX - minX >= maxZ - minZ;
    const length = alongX ? maxX - minX : maxZ - minZ;
    const thickness = alongX ? maxZ - minZ : maxX - minX;
    placeOnGround(world, hedge(kit, length, thickness), x, z, alongX ? 0 : Math.PI / 2);
    world.colliders.push({ type: 'box', minX, maxX, minZ, maxZ });
  }

  for (const [x, z, radius] of BUSHES) {
    placeOnGround(world, bush(kit, radius), x, z);
  }
}

/**
 * 左边的社区花园：几块菜畦、一间放工具的小棚子
 * @param {World} world
 */
function garden(world) {
  const kit = world.kit;

  for (const [x, z] of GARDEN_BEDS) {
    const bed = placeOnGround(world, gardenBed(kit), x, z, Math.PI / 2);
    world.solid(bed);
  }
  world.poi(GARDEN_BEDS[1][0] + 0.75, GARDEN_BEDS[1][1], { emote: '🌱', face: -Math.PI / 2, dur: 6 });

  const [shedX, shedZ] = GARDEN_SHED;
  const toolShed = placeOnGround(world, shed(kit), shedX, shedZ);
  world.solid(toolShed);
}

/**
 * 后巷：背景高楼前面一条窄巷，垃圾桶、空调外机、一只猫
 * @param {World} world
 * @param {object} power 背景高楼的窗户最后才亮
 */
function backLane(world, power) {
  const kit = world.kit;

  for (const spec of BACKDROP) {
    const result = backdropBuilding(world, { ...spec, depth: BACKDROP_DEPTH });
    placeOnGround(world, result.group, spec.x, BACKDROP_Z);
    world.solid(result.body);
    power.windows(result.windows, 0.45);
  }

  for (const [x, z] of BACK_LANE_PROPS.dumpsters) {
    world.solid(placeOnGround(world, dumpster(kit), x, z));
  }
  for (const [x, z] of BACK_LANE_PROPS.airCon) {
    world.solid(placeOnGround(world, airConditioner(kit), x, z));
  }

  // 猫蹲在垃圾桶盖上，有人路过会过去看看它
  const [catX, catZ] = BACK_LANE_PROPS.cat;
  const blackCat = cat(kit);
  blackCat.position.y = DUMPSTER_LID;
  placeOnGround(world, blackCat, catX, catZ, Math.PI * 0.15);
  world.poi(catX + 0.7, catZ + 0.45, { emote: '🐈‍⬛', face: -Math.PI / 2, dur: 6 });
}

/**
 * 右后角观景台：第二层放一台对着月亮的望远镜，第一层几盆花
 * @param {World} world
 */
function lookout(world) {
  const kit = world.kit;

  const [scopeX, scopeZ] = TELESCOPE;
  const towardMoon = Math.atan2(scopeX - MOON[0], scopeZ - MOON[2]);
  placeOnGround(world, telescope(kit), scopeX, scopeZ, towardMoon);
  world.solidCircle(scopeX, scopeZ, 0.12);
  world.poi(scopeX + 0.45, scopeZ + 0.3, { emote: '🔭', face: Math.atan2(MOON[0] - scopeX, MOON[2] - scopeZ), dur: 7 });

  for (const [x, z] of PLANTERS) {
    world.solid(placeOnGround(world, planter(kit), x, z));
  }
}
