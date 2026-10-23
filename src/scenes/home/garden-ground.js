// 花园的地面：一整张草地网格，草色一片深一片浅，一条弯弯的土路，贴着房子地基的一圈草暗一点；
// 方块四个角磨圆，顶上一圈圆边，侧面露出一层层的土，土里嵌着几块小石头
// 只是看的，人走不到这里
import * as THREE from 'three';
import { rng } from '../../kit.js';
import { GARDEN, GARDEN_SIZE, HOUSE } from './layout.js';
import { distanceToPath, PATH_HALF_WIDTH } from './garden-path.js';

// 网格多细：每 1 单位切几段
const SAMPLES_PER_UNIT = 6;
// 方块顶上那圈圆边：离边多远开始往下弯，弯下去多少
const LIP_WIDTH = 0.22;
const LIP_DROP = 0.12;
// 房子地基外面多远开始有草（地基比地板四边多出来 0.15）
const FOUNDATION_HALF = HOUSE.half + 0.15;

// 草地：深浅两种绿，大片的斑块加细碎的深浅
const GRASS_LIGHT = new THREE.Color('#b6e58c');
const GRASS_DARK = new THREE.Color('#8ccd69');
const FINE_NOISE = 0.08;
// 贴着地基的一圈草暗一点（房子挡住了一点光），多宽、暗多少
const FOUNDATION_SHADE_WIDTH = 0.45;
const FOUNDATION_SHADE = 0.22;
// 土路：路面颜色、路边颜色，路边和草之间渐变多宽，路边起伏多少
const PATH_COLOR = new THREE.Color('#ead5a6');
const PATH_EDGE_COLOR = new THREE.Color('#d2b884');
const PATH_FADE = 0.09;
const PATH_WOBBLE = 0.05;

// 侧面：顶上一圈草边多厚；土层一层多厚，层和层的分界线高低起伏多少；竖着切几段、沿着边多远切一列
const GRASS_LIP = 0.07;
const STRATA = ['#c99a6b', '#b8875a', '#d6ab7a', '#a97b52'];
const STRATA_THICKNESS = 0.22;
const STRATA_WOBBLE = 0.05;
const SKIRT_ROW_HEIGHT = 0.1;
const OUTLINE_STEP = 0.2;
// 磨圆的角切几段
const CORNER_SEGMENTS = 10;

// 侧面土里嵌的小石头：每单位边长几块，多大，嵌在地面往下多深的范围，离角多远就不放
const PEBBLES_PER_LENGTH = 0.35;
const PEBBLE_RADIUS = [0.1, 0.2];
const PEBBLE_DEPTH = [0.55, 1.05];
const PEBBLE_COLOR = '#b3865a';
// 石头压扁多少（只露出土外面一小半）
const PEBBLE_FLATTEN = 0.4;
const PEBBLE_SEED = 7;

// 每个顶点都要算一次颜色，反复用同一个
const paint = new THREE.Color();
const road = new THREE.Color();
const strataPaint = new THREE.Color();

/**
 * 铺花园的地面
 * @param {World} world 小屋这个世界
 */
export function buildGardenGround(world) {
  const kit = world.kit;
  world.add(kit.mesh(topGeometry(), '#ffffff', { vertexColors: true }));
  world.add(kit.mesh(skirtGeometry(), '#ffffff', { vertexColors: true, side: THREE.DoubleSide }));
  placeSidePebbles(world);
}

// ---------- 形状 ----------

/**
 * 一点离方块边（四个角是圆的）多远：在里面是正的，在外面是负的
 * @param {number} x
 * @param {number} z
 * @returns {number}
 */
function insideBy(x, z) {
  const half = GARDEN_SIZE / 2;
  const radius = GARDEN.cornerRadius;
  const overX = Math.abs(x) - (half - radius);
  const overZ = Math.abs(z) - (half - radius);
  const outside = Math.hypot(Math.max(overX, 0), Math.max(overZ, 0)) + Math.min(Math.max(overX, overZ), 0) - radius;
  return -outside;
}

/**
 * 角上落在方块外面的点，挪到圆角的边上
 * @param {number} x
 * @param {number} z
 * @returns {number[]} [x, z]
 */
function clampToOutline(x, z) {
  const half = GARDEN_SIZE / 2;
  const center = half - GARDEN.cornerRadius;
  const inCorner = Math.abs(x) > center && Math.abs(z) > center;
  const alreadyInside = !inCorner || insideBy(x, z) >= 0;
  if (alreadyInside) {
    return [x, z];
  }

  const offsetX = Math.abs(x) - center;
  const offsetZ = Math.abs(z) - center;
  const length = Math.hypot(offsetX, offsetZ);
  const edgeX = center + (offsetX / length) * GARDEN.cornerRadius;
  const edgeZ = center + (offsetZ / length) * GARDEN.cornerRadius;
  return [Math.sign(x) * edgeX, Math.sign(z) * edgeZ];
}

/**
 * 地面在这一点有多高：中间是平的，靠边那一圈像圆角一样弯下去
 * @param {number} inside 离方块边多远（往里为正）
 * @returns {number}
 */
function surfaceHeight(inside) {
  const toEdge = 1 - THREE.MathUtils.clamp(inside / LIP_WIDTH, 0, 1);
  // 四分之一个圆的弧：边上最低，往里很快平
  return GARDEN.groundY - LIP_DROP * (1 - Math.sqrt(1 - toEdge * toEdge));
}

// ---------- 顶面 ----------

/**
 * 顶面的网格：整张草地，房子底下压住的格子不画
 * @returns {THREE.BufferGeometry}
 */
function topGeometry() {
  const columns = GARDEN_SIZE * SAMPLES_PER_UNIT + 1;
  const half = GARDEN_SIZE / 2;
  const positions = [];
  const colors = [];

  for (let row = 0; row < columns; row++) {
    for (let column = 0; column < columns; column++) {
      const [x, z] = clampToOutline(-half + column / SAMPLES_PER_UNIT, -half + row / SAMPLES_PER_UNIT);
      positions.push(x, surfaceHeight(insideBy(x, z)), z);
      grassColor(x, z);
      colors.push(paint.r, paint.g, paint.b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(topIndices(columns));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * 顶面的三角形：每个小方格两个；整格都压在房子底下的不画
 * @param {number} columns 一行几个点
 * @returns {number[]}
 */
function topIndices(columns) {
  const half = GARDEN_SIZE / 2;
  const indices = [];
  for (let row = 0; row < columns - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const cellX = -half + (column + 0.5) / SAMPLES_PER_UNIT;
      const cellZ = -half + (row + 0.5) / SAMPLES_PER_UNIT;
      const underHouse = Math.max(Math.abs(cellX), Math.abs(cellZ)) < HOUSE.half - 1 / SAMPLES_PER_UNIT;
      if (underHouse) {
        continue;
      }

      const topLeft = row * columns + column;
      const bottomLeft = topLeft + columns;
      indices.push(topLeft, bottomLeft, topLeft + 1, topLeft + 1, bottomLeft, bottomLeft + 1);
    }
  }
  return indices;
}

/**
 * 草地上一点的颜色：深浅斑块，路上是土色，贴着地基暗一点（写进 paint）
 * @param {number} x
 * @param {number} z
 */
function grassColor(x, z) {
  // 两组斜着交叉的波，叠出一大片一大片的深浅；再加一点细碎的
  const patches = 0.5 + 0.25 * Math.sin(x * 0.9 + Math.sin(z * 0.6) * 1.7) + 0.25 * Math.sin(z * 1.15 - x * 0.45 + 1.3);
  const fine = Math.sin(x * 5.3) * Math.sin(z * 4.7) * FINE_NOISE;
  paint.copy(GRASS_DARK).lerp(GRASS_LIGHT, THREE.MathUtils.clamp(patches + fine, 0, 1));

  const fromFoundation = Math.max(Math.abs(x), Math.abs(z)) - FOUNDATION_HALF;
  const nearFoundation = 1 - THREE.MathUtils.smoothstep(fromFoundation, 0, FOUNDATION_SHADE_WIDTH);
  paint.multiplyScalar(1 - FOUNDATION_SHADE * nearFoundation);

  // 路边弯弯曲曲的，不是尺子画的
  const edge = PATH_HALF_WIDTH + Math.sin(x * 3.1 + z * 2.3) * PATH_WOBBLE;
  const outside = distanceToPath(x, z) - edge;
  if (outside > PATH_FADE) {
    return;
  }
  road.copy(PATH_COLOR).lerp(PATH_EDGE_COLOR, THREE.MathUtils.smoothstep(outside, -PATH_FADE * 2, 0));
  paint.lerp(road, 1 - THREE.MathUtils.smoothstep(outside, -PATH_FADE, PATH_FADE));
}

// ---------- 侧面 ----------

/**
 * 沿着方块的边（四个角是圆的）走一圈的点，逆时针
 * @returns {number[][]} 每个点 [x, z]
 */
function outline() {
  const half = GARDEN_SIZE / 2;
  const radius = GARDEN.cornerRadius;
  const center = half - radius;
  // 四个角：圆心在哪个方向，从哪个角度转到哪个角度
  const corners = [[1, 1, 0], [-1, 1, Math.PI / 2], [-1, -1, Math.PI], [1, -1, Math.PI * 1.5]];
  const points = [];

  corners.forEach(([signX, signZ, startAngle], index) => {
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const angle = startAngle + (i / CORNER_SEGMENTS) * (Math.PI / 2);
      points.push([signX * center + Math.cos(angle) * radius, signZ * center + Math.sin(angle) * radius]);
    }
    // 这个角的终点到下一个角的起点之间的直边
    const [nextX, nextZ, nextAngle] = corners[(index + 1) % corners.length];
    const [fromX, fromZ] = points[points.length - 1];
    const toX = nextX * center + Math.cos(nextAngle) * radius;
    const toZ = nextZ * center + Math.sin(nextAngle) * radius;
    const steps = Math.max(1, Math.round(Math.hypot(toX - fromX, toZ - fromZ) / OUTLINE_STEP));
    for (let i = 1; i < steps; i++) {
      points.push([fromX + ((toX - fromX) * i) / steps, fromZ + ((toZ - fromZ) * i) / steps]);
    }
  });
  return points;
}

/**
 * 方块的侧面：从圆边一直到底，顶上一圈草边，往下一层层的土
 * @returns {THREE.BufferGeometry}
 */
function skirtGeometry() {
  const top = surfaceHeight(0);
  const depths = [0, GRASS_LIP];
  for (let depth = GRASS_LIP + SKIRT_ROW_HEIGHT; depth < top - GARDEN.bottom; depth += SKIRT_ROW_HEIGHT) {
    depths.push(depth);
  }
  depths.push(top - GARDEN.bottom);

  const points = outline();
  const positions = [];
  const colors = [];
  for (const [x, z] of points) {
    for (const depth of depths) {
      const y = top - depth;
      positions.push(x, y, z);
      skirtColor(x, y, z, depth);
      colors.push(strataPaint.r, strataPaint.g, strataPaint.b);
    }
  }

  // 相邻两列、相邻两段围成一个小方格；最后一列接回第一列
  const indices = [];
  const rows = depths.length;
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    for (let level = 0; level < rows - 1; level++) {
      const here = i * rows + level;
      const there = next * rows + level;
      indices.push(here, here + 1, there, there, here + 1, there + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * 侧面一点的颜色：顶上一圈是草，往下是一层层的土，分界线跟着位置起伏（写进 strataPaint）
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} depth 离顶上多深
 */
function skirtColor(x, y, z, depth) {
  if (depth < GRASS_LIP + 0.001) {
    grassColor(x, z);
    strataPaint.copy(paint);
    return;
  }
  const wobble = Math.sin(x * 2.1 + z * 1.3) * STRATA_WOBBLE;
  const layer = Math.floor((GARDEN.bottom - y + wobble) / STRATA_THICKNESS);
  const index = ((layer % STRATA.length) + STRATA.length) % STRATA.length;
  strataPaint.set(STRATA[index]);
}

/**
 * 四个侧面的土里嵌几块小石头（只在直边上，角上不放）
 * @param {World} world
 */
function placeSidePebbles(world) {
  const random = rng(PEBBLE_SEED);
  const half = GARDEN_SIZE / 2;
  const straight = half - GARDEN.cornerRadius;
  // 四个侧面：贴在哪儿，扁的那面要不要转过来朝 x
  const sides = [
    { place: (along) => [along, half], turned: false },
    { place: (along) => [half, along], turned: true },
    { place: (along) => [along, -half], turned: false },
    { place: (along) => [-half, along], turned: true },
  ];

  for (const side of sides) {
    const count = Math.round(straight * 2 * PEBBLES_PER_LENGTH);
    for (let i = 0; i < count; i++) {
      const along = (random() * 2 - 1) * straight;
      const depth = PEBBLE_DEPTH[0] + random() * (PEBBLE_DEPTH[1] - PEBBLE_DEPTH[0]);
      const radius = PEBBLE_RADIUS[0] + random() * (PEBBLE_RADIUS[1] - PEBBLE_RADIUS[0]);
      const pebble = world.kit.sphere(radius, PEBBLE_COLOR, 10);
      pebble.scale.z = PEBBLE_FLATTEN;
      const [x, z] = side.place(along);
      world.add(pebble, x, GARDEN.groundY - depth, z, side.turned ? Math.PI / 2 : 0);
    }
  }
}
