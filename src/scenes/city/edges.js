// 马路外面的边缘：坡上公园、社区花园、后巷和背景高楼、观景台
// 都要过马路才去得了；藏在这里的东西由 story.js 和瓶子那边放
import { bench, telescope, planter, hedge, gardenBed, shed, dumpster, airConditioner, cat, lightPost } from './models.js';
import { at } from '../../kit.js';
import { glow, neonText } from '../../fx.js';
import { tree, bush } from '../../plants.js';
import { backdropBuilding } from './buildings.js';
import { hangSign, placeLightPool } from './neon.js';
import { verticalSign } from './models.js';
import { PARK_BENCH, PARK_TREES, HEDGES, BUSHES, GARDEN_BEDS, GARDEN_SHED, BACKDROP, BACKDROP_Z, BACKDROP_DEPTH, BACKDROP_SIGNS, BACK_LANE_PROPS, TELESCOPE, PLANTERS, LOOKOUT_POSTS, LOOKOUT_POST_HEIGHT, MOON } from './layout.js';

// 垃圾桶盖子的高度（猫蹲在上面）
const DUMPSTER_LID = 0.62;
// 公园里的树：按 PARK_TREES 的顺序一棵一种，夜里偏蓝的绿；树冠半径换算成 plants.js 的大小（大小 1 的圆冠树半径 0.7）
const PARK_TREE_LOOKS = [
  { kind: 'round', color: '#3f7f5f' }, // 土坡上
  { kind: 'pine', color: '#2f6a58' }, // 右边高台上
  { kind: 'poplar', color: '#4a8a5c' },
  { kind: 'round', color: '#356f62' },
];
const TREE_SIZE_PER_RADIUS = 1 / 0.7;
const TREE_TRUNK_RADIUS = 0.18;
// 灌木丛三种绿，挨着的不一样
const BUSH_COLORS = ['#3a7258', '#447d5a', '#33685c'];
// 背景高楼的墙色，一栋一个，不是三栋一模一样的蓝盒子
const BACKDROP_WALLS = ['#3f4766', '#4f4163', '#3a5462'];
// 竖招牌一个字多高（宽固定）；楼顶广告牌多大、架子多高；招牌照在后巷地上的光斑离墙多远、多大、多亮
const VERTICAL_SIGN_WIDTH = 0.42;
const VERTICAL_SIGN_PER_CHAR = 0.3;
const ROOF_BOARD = { size: [1.7, 0.5], legs: 0.35 };
const LANE_POOL = { out: 0.45, size: 1.8, opacity: 0.42 };
// 背景高楼的招牌比街区的晚一点亮，一栋接一栋
const BACKDROP_SIGN_DELAY = [0.5, 0.58, 0.66];

/**
 * 搭边缘
 * @param {World} world 夜都
 * @param {object} power 电力（背景高楼的窗户跟着亮）
 * @returns {{ crowns: THREE.Group[], bins: THREE.Group[], cat: THREE.Group, telescope: THREE.Group }} 公园里的树冠（风吹着摇）、后巷的大垃圾桶（撞了会晃）、垃圾桶上的猫、观景台的望远镜（主线要用）
 */
export function buildEdges(world, power) {
  const crowns = park(world);
  garden(world);
  const lane = backLane(world, power);
  const scope = lookout(world);
  return { crowns, bins: lane.dumpsters, cat: lane.cat, telescope: scope };
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
 * 坡上公园：树篱隔出弯弯曲曲的小路，左边土坡、右边高台；灌木丛（包括花园里那几丛）都能翻
 * @description 长椅藏在土坡靠马路那一面，默认镜头被土坡和树挡住，要转镜头或者走过去才发现
 * @param {World} world
 * @returns {THREE.Group[]} 树冠
 */
function park(world) {
  const kit = world.kit;

  const [benchX, benchZ] = PARK_BENCH;
  placeOnGround(world, bench(kit), benchX, benchZ);
  world.poi(benchX - 0.3, benchZ, { emote: '🌙', face: Math.PI, dur: 9, sit: true, seatY: 0.45 });

  const crowns = PARK_TREES.map(([x, z, radius], index) => {
    const look = PARK_TREE_LOOKS[index % PARK_TREE_LOOKS.length];
    const planted = tree(kit, { ...look, size: radius * TREE_SIZE_PER_RADIUS, seed: index + 1 });
    placeOnGround(world, planted.group, x, z, index * 1.3);
    world.solidCircle(x, z, TREE_TRUNK_RADIUS);
    return planted.crown;
  });

  HEDGES.forEach(([minX, maxX, minZ, maxZ], index) => {
    const x = (minX + maxX) / 2;
    const z = (minZ + maxZ) / 2;
    const alongX = maxX - minX >= maxZ - minZ;
    const length = alongX ? maxX - minX : maxZ - minZ;
    const thickness = alongX ? maxZ - minZ : maxX - minX;
    placeOnGround(world, hedge(kit, length, thickness, index + 1), x, z, alongX ? 0 : Math.PI / 2);
    world.colliders.push({ type: 'box', minX, maxX, minZ, maxZ });
  });

  // 灌木丛都能翻，瓶子塞在里面只露出一点
  BUSHES.forEach(([x, z, radius, deep], index) => {
    const shrub = placeOnGround(world, bush(kit, radius, BUSH_COLORS[index % BUSH_COLORS.length]), x, z, index * 0.9);
    const tags = deep ? ['bush', 'deep'] : ['bush'];
    const tucked = radius * 0.55;
    world.hideout(`bush${index}`, shrub, x, z, { tags, name: '草丛', icon: '🌿', show: 'peek', offset: [tucked, tucked] });
  });
  return crowns;
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
 * @returns {{ dumpsters: THREE.Group[], cat: THREE.Group }}
 */
function backLane(world, power) {
  const kit = world.kit;

  BACKDROP.forEach((spec, index) => {
    const wall = BACKDROP_WALLS[index % BACKDROP_WALLS.length];
    const signs = BACKDROP_SIGNS.filter((sign) => sign.building === index);
    const keepClear = signs.filter((sign) => sign.kind === 'roof').map((sign) => [sign.x, 0, ROOF_BOARD.size[0] / 2 + 0.2]);
    const result = backdropBuilding(world, { ...spec, depth: BACKDROP_DEPTH, wall, keepClear });
    placeOnGround(world, result.group, spec.x, BACKDROP_Z);
    // 招牌的架子用按颜色共用的材质，要在登记变半透明之前挂上去
    for (const sign of signs) {
      backdropSign(world, power, result.group, { ...spec, depth: BACKDROP_DEPTH }, sign, BACKDROP_SIGN_DELAY[index]);
    }
    world.solid(result.body);
    world.fadeable(result.group);
    power.windows(result.windows, 0.45);
  });

  const dumpsters = BACK_LANE_PROPS.dumpsters.map(([x, z], index) => {
    const bin = placeOnGround(world, dumpster(kit), x, z);
    world.solid(bin);
    world.hideout(`dumpster${index}`, bin, x, z, { tags: ['bin'], name: '大垃圾桶', icon: '🗑️', reach: 1.1 });
    return bin;
  });
  for (const [x, z] of BACK_LANE_PROPS.airCon) {
    world.solid(placeOnGround(world, airConditioner(kit), x, z));
  }

  // 猫蹲在垃圾桶盖上，有人路过会过去看看它
  const [catX, catZ] = BACK_LANE_PROPS.cat;
  const blackCat = cat(kit);
  blackCat.position.y = DUMPSTER_LID;
  placeOnGround(world, blackCat, catX, catZ, Math.PI * 0.15);
  world.poi(catX + 0.7, catZ + 0.45, { emote: '🐈‍⬛', face: -Math.PI / 2, dur: 6 });
  return { dumpsters, cat: blackCat };
}

/**
 * 背景高楼上的一个霓虹招牌：正面的竖招牌在后巷地上照出一片光，楼顶的广告牌立在架子上
 * @param {World} world
 * @param {object} power 跟着城市电力亮
 * @param {THREE.Group} group 这栋楼（招牌挂在楼上，跟着楼变半透明）
 * @param {{ x: number, height: number, depth: number }} spec 这栋楼在哪、多高、多深
 * @param {{ kind: string, x: number, y?: number, text: string, color: string }} sign BACKDROP_SIGNS 里的一个
 * @param {number} delay 城市电力到多少才开始亮
 */
function backdropSign(world, power, group, spec, sign, delay) {
  const front = spec.depth / 2 + 0.01;
  const worldZ = BACKDROP_Z + front;

  if (sign.kind === 'roof') {
    const [width, height] = ROOF_BOARD.size;
    const boardY = spec.height + ROOF_BOARD.legs + height / 2;
    const texture = world.texture(neonText(sign.text, { color: sign.color, bg: 'rgba(30,15,40,0.92)', font: 'bold 44px sans-serif', w: 320, h: 96 }));
    const halo = glow(sign.color, 2.4, 0);
    const board = hangSign(world, group, { texture, size: ROOF_BOARD.size, position: [sign.x, boardY, 0] }, halo, [spec.x + sign.x, boardY, BACKDROP_Z + 0.3]);
    for (const side of [-1, 1]) {
      group.add(at(world.kit.box(0.04, ROOF_BOARD.legs + height, 0.04, '#3a3d4a', 0.005), sign.x + side * width * 0.4, spec.height + (ROOF_BOARD.legs + height) / 2, -0.03));
    }
    power.neon(board.material, halo, { op: 0.3, a: delay });
    return;
  }

  const height = VERTICAL_SIGN_PER_CHAR * [...sign.text].length + 0.1;
  const texture = world.texture(verticalSign(sign.text, sign.color));
  const halo = glow(sign.color, 2.0, 0);
  const board = hangSign(world, group, { texture, size: [VERTICAL_SIGN_WIDTH, height], position: [sign.x, sign.y, front] }, halo, [spec.x + sign.x, sign.y, worldZ + 0.2]);
  const pool = placeLightPool(world, sign.color, LANE_POOL.size, spec.x + sign.x, worldZ + LANE_POOL.out);
  power.neon(board.material, halo, { op: 0.32, a: delay, pools: [{ mesh: pool, opacity: LANE_POOL.opacity }] });
}

/**
 * 右后角观景台：第二层放一台对着月亮的望远镜，第一层几盆花
 * @param {World} world
 * @returns {THREE.Group} 望远镜
 */
function lookout(world) {
  const kit = world.kit;

  const [scopeX, scopeZ] = TELESCOPE;
  const towardMoon = Math.atan2(scopeX - MOON[0], scopeZ - MOON[2]);
  const scope = placeOnGround(world, telescope(kit), scopeX, scopeZ, towardMoon);
  world.solidCircle(scopeX, scopeZ, 0.12);
  world.poi(scopeX + 0.45, scopeZ + 0.3, { emote: '🔭', face: Math.atan2(MOON[0] - scopeX, MOON[2] - scopeZ), dur: 7 });

  for (const [x, z] of PLANTERS) {
    world.solid(placeOnGround(world, planter(kit), x, z));
  }

  // 后边两根杆子，中间挂一串彩灯（life.js 挂灯）
  for (const [x, z] of LOOKOUT_POSTS) {
    placeOnGround(world, lightPost(kit, LOOKOUT_POST_HEIGHT), x, z);
    world.solidCircle(x, z, 0.06);
  }
  return scope;
}
