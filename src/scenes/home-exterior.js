// 小屋外面：两面墙顶上的房檐，和围着房子的一圈花园
// 只是看的，人走不出屋子（小屋的 bounds 还是屋里那块地板）；镜头只能从右前方斜着看，所以只做看得到的这几面
import * as THREE from 'three';
import { at, rng } from '../kit.js';

// 房子的尺寸，和 home.js 里搭地板、墙用的一致
const HOUSE = {
  half: 4.8, // 地板 9.6 × 9.6，中心在原点
  wallInner: 4.5, // 墙的内侧面离中心多远（墙厚 0.3）
  trimTop: 4.36, // 墙顶那根木线的顶面高度
};

// ---------- 房檐 ----------

// 房檐板压在墙顶木线上方一点，往屋外往下斜出去，也往屋里往上伸进来一截（像屋顶被切开，从屋里看得到屋顶的边）
const EAVE = {
  baseY: 4.45, // 压在墙上那条线的高度，比木线高一点，木线不会从瓦里戳出来
  inset: 0.06, // 压在墙上那条线比墙内侧再往屋外挪一点
  depth: 1.5, // 往屋外伸出去多远（沿斜面）
  inward: 0.9, // 往屋里伸进来多远（沿斜面）
  slope: THREE.MathUtils.degToRad(25), // 坡度
  thickness: 0.14,
  endOverhang: 0.35, // 开口那头比墙多伸出去一点，看着像屋顶的边
  shingleRow: 0.3, // 一排瓦多宽
  color: '#d9735a',
  shingleColor: '#c45f48',
  fasciaColor: '#fff6e8', // 房檐两边的封檐板
};

/**
 * 房檐的一段：贴着一面墙的斜板，上面一排排瓦，里外两边各一根封檐板
 * @description 在自己的坐标里搭：墙沿 x 从 0 到 length，压在墙上那条线是 y = 0，y 往屋外（往下斜）、负的 y 往屋里（往上斜）；
 *   墙角那头切成俯视 45° 的斜角，和另一面墙的房檐拼成屋脊
 * @param {Kit} kit 造型工具箱
 * @param {number} length 墙多长
 * @param {'start' | 'end'} cornerAt 墙角在哪一头（那头切斜角，另一头多伸出去一点）
 * @returns {THREE.Group}
 */
function buildEaveStrip(kit, length, cornerAt) {
  const { depth, inward, thickness } = EAVE;
  const edgesAt = (y) => eaveEdgesAt(y, length, cornerAt);

  const inner = edgesAt(-inward);
  const outer = edgesAt(depth);
  const shape = new THREE.Shape([
    new THREE.Vector2(inner.start, -inward),
    new THREE.Vector2(inner.end, -inward),
    new THREE.Vector2(outer.end, depth),
    new THREE.Vector2(outer.start, depth),
  ]);
  const board = kit.mesh(new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false }), EAVE.color);

  // 板子的坐标：x 沿墙，y 往屋外（沿斜面），z 是板子的厚度方向（朝上）
  const slab = new THREE.Group();
  slab.add(board);
  addShingles(kit, slab, edgesAt);
  addFascia(kit, slab, outer, depth);
  addFascia(kit, slab, inner, -inward);

  // 立起来：y 转到屋外（-z）并往下斜，厚度朝上
  slab.rotation.x = -(Math.PI / 2 + EAVE.slope);
  const strip = new THREE.Group();
  strip.add(slab);
  return strip;
}

/**
 * 房檐板在某一排（y）的左右两头
 * @description 墙角那头按俯视 45° 斜着切：板子是斜的，沿斜面走 y 在俯视里只有 y × cos(坡度)，两段房檐的斜边才对得上；
 *   开口那头比墙多伸出去 endOverhang
 * @param {number} y 沿斜面离压在墙上那条线多远，往屋外为正
 * @param {number} length 墙多长
 * @param {'start' | 'end'} cornerAt 墙角在哪一头
 * @returns {{ start: number, end: number }} 这一排从 x = start 到 x = end
 */
function eaveEdgesAt(y, length, cornerAt) {
  const miter = y * Math.cos(EAVE.slope);
  if (cornerAt === 'start') {
    return { start: -miter, end: length + EAVE.endOverhang };
  }
  return { start: -EAVE.endOverhang, end: length + miter };
}

/**
 * 在房檐板上一排排铺瓦，每排按那个位置的宽度裁
 * @param {Kit} kit 造型工具箱
 * @param {THREE.Group} slab 房檐板（自己的坐标：x 沿墙，y 往外，z 朝上）
 * @param {Function} edgesAt (y) 返回这一排的 { start, end }
 */
function addShingles(kit, slab, edgesAt) {
  const lip = 0.05; // 每排瓦的下沿厚一点，露出一道阴影线
  const firstRow = Math.ceil(-EAVE.inward / EAVE.shingleRow);
  const lastRow = Math.floor(EAVE.depth / EAVE.shingleRow);

  for (let row = firstRow; row <= lastRow; row++) {
    const y = row * EAVE.shingleRow - lip;
    const { start, end } = edgesAt(y);
    const shingle = kit.box(end - start, lip * 2, 0.04, EAVE.shingleColor, 0.01);
    slab.add(at(shingle, (start + end) / 2, y, EAVE.thickness + 0.01));
  }
}

/**
 * 房檐边上的封檐板：一根白木条，把瓦的边收干净
 * @param {Kit} kit 造型工具箱
 * @param {THREE.Group} slab 房檐板
 * @param {{ start: number, end: number }} edges 这条边从哪儿到哪儿（x）
 * @param {number} y 这条边在哪（沿斜面，往屋外为正）
 */
function addFascia(kit, slab, edges, y) {
  const fasciaHeight = 0.2;
  const fascia = kit.box(edges.end - edges.start, 0.06, fasciaHeight, EAVE.fasciaColor, 0.02);
  slab.add(at(fascia, (edges.start + edges.end) / 2, y, EAVE.thickness - fasciaHeight / 2));
}

/**
 * 在后墙和左墙顶上盖房檐，两段在后左墙角拼成屋脊
 * @param {World} world 小屋这个世界
 */
export function placeEaves(world) {
  const kit = world.kit;
  const edge = HOUSE.wallInner - EAVE.inset;
  const wallLength = HOUSE.half + edge;

  // 后墙：沿 +x，墙角在 x = -edge 那头，屋外是 -z
  const back = buildEaveStrip(kit, wallLength, 'start');
  world.add(back, -edge, EAVE.baseY, -edge);

  // 左墙：从前面开口那头往墙角走（沿 -z），屋外是 -x，所以墙角在这一段的末尾
  const left = buildEaveStrip(kit, wallLength, 'end');
  world.add(left, -edge, EAVE.baseY, HOUSE.half, Math.PI / 2);
}

// ---------- 花园 ----------

// 花园地面比屋里地板低一点，房子像坐在一块地基上
const GARDEN_GROUND_Y = -0.3;
const GARDEN_SOIL_DEPTH = 1.0; // 草地下面那层土有多厚（方块的侧面）
const GARDEN_COLORS = {
  grass: '#a5d68c',
  soil: '#b58a5c',
  path: '#e9dcc4',
  fence: '#fff6e8',
  trunk: '#9a6a43',
  leaves: ['#7cc576', '#8fd17f', '#6bb86a'],
  flowers: ['#f6a6b8', '#ffd84a', '#ffffff', '#b38ee8', '#f4a259', '#8ec5e8'],
};
// 篱笆：多高、木桩间距、离方块边多远、给小路留的口子半宽
const FENCE = { height: 0.45, postGap: 0.55, inset: 0.25, gateHalf: 0.6 };
const GARDEN_SEED = 23;

/**
 * 围着房子铺一圈花园：草地、篱笆、石板小路、花丛、灌木，屋后种几棵树
 * @description 让小屋像坐在自己的院子里，不再孤零零飘在背景上；只是看的，人走不出屋子
 * @param {World} world 小屋这个世界
 * @param {number} size 花园（整个方块）多大，边长
 */
export function placeGarden(world, size) {
  const kit = world.kit;
  const half = size / 2;
  const random = rng(GARDEN_SEED);

  placeGround(world, kit, size);
  placeFence(world, kit, half);
  placePath(world, kit, half);

  // 屋后、屋左：花圃 + 灌木 + 树，高一点也没关系，在房子后面
  const behindBack = { minX: -half + 0.6, maxX: half - 0.6, minZ: -half + 0.6, maxZ: -HOUSE.half - 0.5 };
  const behindLeft = { minX: -half + 0.6, maxX: -HOUSE.half - 0.5, minZ: -HOUSE.half, maxZ: half - 0.6 };
  scatterFlowers(world, kit, behindBack, 26, random);
  scatterFlowers(world, kit, behindLeft, 22, random);
  scatterBushes(world, kit, behindBack, 6, random);
  scatterBushes(world, kit, behindLeft, 5, random);
  for (const [x, z, scale] of [[-half + 1.1, -half + 1.0, 1.15], [1.8, -half + 0.9, 0.9], [-half + 0.9, 1.6, 0.95]]) {
    world.add(buildTree(kit, scale), x, GARDEN_GROUND_Y, z);
  }

  // 屋前、屋右（镜头这一侧）：只放矮的花，不挡住屋里
  const frontRight = { minX: HOUSE.half + 0.5, maxX: half - 0.6, minZ: -HOUSE.half, maxZ: half - 0.6 };
  const frontLeft = { minX: -half + 0.6, maxX: HOUSE.half, minZ: HOUSE.half + 0.5, maxZ: half - 0.6 };
  scatterFlowers(world, kit, frontRight, 20, random);
  scatterFlowers(world, kit, frontLeft, 20, random);
}

/**
 * 草地 + 下面一层土，和别的世界的方块一样
 * @param {World} world
 * @param {Kit} kit
 * @param {number} size 边长
 */
function placeGround(world, kit, size) {
  const grassThickness = 0.2;
  world.add(kit.box(size, grassThickness, size, GARDEN_COLORS.grass, 0.08), 0, GARDEN_GROUND_Y - grassThickness / 2, 0);
  world.add(kit.box(size - 0.1, GARDEN_SOIL_DEPTH, size - 0.1, GARDEN_COLORS.soil, 0.12), 0, GARDEN_GROUND_Y - grassThickness - GARDEN_SOIL_DEPTH / 2, 0);
}

/**
 * 沿方块边上围一圈矮白篱笆，右边给小路留个口
 * @param {World} world
 * @param {Kit} kit
 * @param {number} half 花园半边长
 */
function placeFence(world, kit, half) {
  const edge = half - FENCE.inset;
  const gateZ = pathZ(half);

  placeFenceRun(world, kit, [-edge, -edge], [edge, -edge]);
  placeFenceRun(world, kit, [-edge, -edge], [-edge, edge]);
  placeFenceRun(world, kit, [-edge, edge], [edge, edge]);
  placeFenceRun(world, kit, [edge, -edge], [edge, gateZ - FENCE.gateHalf]);
  placeFenceRun(world, kit, [edge, gateZ + FENCE.gateHalf], [edge, edge]);
}

/**
 * 一段直篱笆：一根根小木桩，中间一根横条
 * @param {World} world
 * @param {Kit} kit
 * @param {number[]} from 起点 [x, z]
 * @param {number[]} to 终点 [x, z]
 */
function placeFenceRun(world, kit, from, to) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const posts = Math.max(1, Math.round(length / FENCE.postGap));

  for (let i = 0; i <= posts; i++) {
    const post = kit.box(0.08, FENCE.height, 0.08, GARDEN_COLORS.fence, 0.02);
    world.add(post, from[0] + (dx * i) / posts, GARDEN_GROUND_Y + FENCE.height / 2, from[1] + (dz * i) / posts);
  }

  const rail = kit.box(length, 0.05, 0.04, GARDEN_COLORS.fence, 0.01);
  const facing = Math.atan2(-dz, dx);
  world.add(rail, from[0] + dx / 2, GARDEN_GROUND_Y + FENCE.height * 0.7, from[1] + dz / 2, facing);
}

/**
 * 小路从右边篱笆进来的位置（z）：靠前一点，正对着屋子右边的开口
 * @param {number} half 花园半边长
 * @returns {number}
 */
function pathZ(half) {
  return (half - FENCE.inset) * 0.35;
}

/**
 * 一条石板小路：从右边篱笆的口子走到屋子右边开口那里
 * @param {World} world
 * @param {Kit} kit
 * @param {number} half 花园半边长
 */
function placePath(world, kit, half) {
  const stones = 5;
  const startX = half - 0.4;
  const endX = HOUSE.half + 0.35;
  const z = pathZ(half);

  for (let i = 0; i < stones; i++) {
    const x = startX + ((endX - startX) * i) / (stones - 1);
    const stone = kit.cyl(0.24, 0.26, 0.05, GARDEN_COLORS.path, 14);
    stone.castShadow = false;
    world.add(stone, x, GARDEN_GROUND_Y + 0.025, z + (i % 2 ? 0.12 : -0.12));
  }
}

/**
 * 在一块地上随机种花：一根茎，顶上一朵小圆花
 * @param {World} world
 * @param {Kit} kit
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} area 种在哪块地
 * @param {number} count 种几朵
 * @param {Function} random 返回 0~1 的随机数
 */
function scatterFlowers(world, kit, area, count, random) {
  for (let i = 0; i < count; i++) {
    const x = area.minX + random() * (area.maxX - area.minX);
    const z = area.minZ + random() * (area.maxZ - area.minZ);
    const stemHeight = 0.18 + random() * 0.18;
    const color = GARDEN_COLORS.flowers[Math.floor(random() * GARDEN_COLORS.flowers.length)];

    const flower = new THREE.Group();
    flower.add(at(kit.cyl(0.015, 0.015, stemHeight, GARDEN_COLORS.leaves[0], 5), 0, stemHeight / 2, 0));
    flower.add(at(kit.sphere(0.07, color, 8), 0, stemHeight, 0));
    world.add(flower, x, GARDEN_GROUND_Y, z);
  }
}

/**
 * 在一块地上随机摆几团灌木：两三个绿球挤在一起
 * @param {World} world
 * @param {Kit} kit
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} area 摆在哪块地
 * @param {number} count 摆几团
 * @param {Function} random 返回 0~1 的随机数
 */
function scatterBushes(world, kit, area, count, random) {
  for (let i = 0; i < count; i++) {
    const x = area.minX + random() * (area.maxX - area.minX);
    const z = area.minZ + random() * (area.maxZ - area.minZ);
    const bush = new THREE.Group();
    const color = GARDEN_COLORS.leaves[i % GARDEN_COLORS.leaves.length];
    bush.add(at(kit.sphere(0.32, color, 12), 0, 0.22, 0));
    bush.add(at(kit.sphere(0.24, color, 12), 0.28, 0.16, 0.08));
    bush.add(at(kit.sphere(0.22, color, 12), -0.22, 0.14, -0.1));
    world.add(bush, x, GARDEN_GROUND_Y, z);
  }
}

/**
 * 一棵圆圆的树：树干 + 三团叶子
 * @description 种在屋后，树冠从房檐上面冒出来，看得出房子后面还有东西
 * @param {Kit} kit
 * @param {number} scale 大小倍数
 * @returns {THREE.Group}
 */
function buildTree(kit, scale) {
  const tree = new THREE.Group();
  const trunkHeight = 3.2;
  tree.add(at(kit.cyl(0.14, 0.2, trunkHeight, GARDEN_COLORS.trunk, 10), 0, trunkHeight / 2, 0));
  tree.add(at(kit.sphere(1.1, GARDEN_COLORS.leaves[0], 16), 0, trunkHeight + 0.6, 0));
  tree.add(at(kit.sphere(0.8, GARDEN_COLORS.leaves[1], 16), 0.6, trunkHeight + 0.2, 0.3));
  tree.add(at(kit.sphere(0.75, GARDEN_COLORS.leaves[2], 16), -0.5, trunkHeight + 0.3, -0.3));
  tree.scale.setScalar(scale);
  return tree;
}

