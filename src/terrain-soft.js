// 圆润的地形外观：把地形文字地图画成一整张起伏的网格，代替一格一格的方块
//   崖边、拐角是圆的，崖壁上露出一层层的土；池塘和小溪连成一整片会流动的水；
//   台阶是嵌在草坡里的石板，踏脚石是一块块扁石头，桥两头有桥桩
// 只管外观：走路、碰撞、寻路还是看 Terrain 的逻辑高度（heightAt）。
// 圆角只在崖边很窄的一圈里，人本来就站不到离崖边那么近，所以人脚下的地面和逻辑高度对得上。
// 夜都的人行道、挡土墙要方方正正，还用 Terrain.build 的方块；童话风的世界用这个
import * as THREE from 'three';
import { at, canvasTexture, rng, noiseAt } from './kit.js';

// 网格多细：每 1 单位切几段。越细圆角越顺，三角形越多
const SAMPLES_PER_UNIT = 12;
// 崖边磨圆：[1, 2, 1] 模糊做几遍。两遍时圆角只在崖边 ±2 段（约 0.17）以内，比人离崖边最近的距离（0.22）窄
const SMOOTH_PASSES = 2;
// 方块底面多深
const BOTTOM = -1.5;
// 水面比 0 层低多少（按层算）：踏脚石、桥、岸边都露出水面一截
const WATER_DROP_LEVELS = 0.4;
// 法线朝上的分量比 GRASS_ABOVE 大是草，比 CLIFF_BELOW 小是土，中间渐变
const GRASS_ABOVE = 0.8;
const CLIFF_BELOW = 0.55;
// 崖壁土层一层多厚，层和层的分界线高低起伏多少
const STRATA_THICKNESS = 0.22;
const STRATA_WOBBLE = 0.05;
// 方块侧面顶上一圈草边有多厚
const GRASS_LIP = 0.07;
// 岸边水线那一圈浅色有多高（水面往上）
const SHORE_FOAM = 0.04;
const FOAM_COLOR = '#f2fbff';
const FOAM_STRENGTH = 0.55;
// 方块侧面竖着切几段：段越密土层分得越清楚
const SKIRT_ROW_HEIGHT = 0.1;

// 水面：多透明，波纹贴图多少单位重复一次，往哪边流、流多快（每秒挪动多少个贴图）
const WATER_OPACITY = 0.8;
const RIPPLE_TILE = 3;
const RIPPLE_DRIFT = [0.03, 0.018];
const RIPPLE_PX = 256;
const RIPPLE_LINES = 16;
const RIPPLE_SEED = 9;

// 台阶：每格几级石板，石板比一格窄多少、多厚（往下埋进草坡里）
const STAIR_SLABS = 4;
const STAIR_WIDTH = 0.82;
const STAIR_THICKNESS = 0.16;
const STAIR_COLORS = ['#e4dccb', '#d6cdb9'];

// 踏脚石：多大，顶面比 0 层高一点点（看起来是踩在石头上），压多扁，表面凹凸多少
const STONE_RADIUS = 0.45;
const STONE_TOP = 0.03;
const STONE_FLATTEN = 0.5;
const STONE_BUMPS = 0.035;

// 桥：桥面往两头岸上多伸出一点（盖住岸边的圆角），木板几块、多宽，桥桩多高
const BRIDGE_OVERHANG = 0.12;
const BRIDGE_PLANKS = 6;
const BRIDGE_WIDTH = 0.86;
const BRIDGE_POST_HEIGHT = 0.5;

// 能走的水格子（桥、踏脚石）：它们旁边的岸不能磨圆，不然人从岸上走过去会踩空
const WALKABLE_WATER = new Set(['=', '|', 'o']);
const DIRS = { '>': [1, 0], '<': [-1, 0], v: [0, 1], '^': [0, -1] };
// 给每个顶点算颜色时反复用的，不用每个顶点新建一个
const scratchTop = new THREE.Color();
const foamColor = new THREE.Color(FOAM_COLOR);

/**
 * 把世界的地形画成圆润的样子
 * @description 方块一格一格的地形一眼就是格子地图；磨圆的崖边、弯弯的岸、流动的水才像一个小小的真实世界
 * @param {World} world 有地形（def.terrain）的世界
 * @param {object} look 颜色
 * @param {(x: number, z: number, level: number) => string | THREE.Color} look.grass 草地顶面的颜色：每个顶点问一次，可以画出深浅、小路
 * @param {string[]} look.strata 崖壁土层的颜色，从上往下轮流
 * @param {string} look.bed 水底的颜色
 * @param {string} look.water 水的颜色
 * @param {string} look.ripple 水面波纹的颜色
 * @param {string} look.stone 踏脚石的颜色
 * @param {string} look.plank 桥的木头颜色
 * @returns {{ waterSurface: number, heightAt: (x: number, z: number) => number }} 水面多高；画出来的地面多高（摆在岸边圆角上的东西用）
 */
export function buildSoftTerrain(world, look) {
  const terrain = world.terrain;
  const waterSurface = -terrain.level * WATER_DROP_LEVELS;
  const heights = smoothHeights(terrain);
  const group = new THREE.Group();

  group.add(groundMesh(world.kit, terrain, heights, look, waterSurface));
  group.add(skirtMesh(world.kit, terrain, heights, look, waterSurface));
  group.add(waterMesh(world, terrain, heights, look, waterSurface));
  for (const feature of cellFeatures(world.kit, terrain, look)) {
    group.add(feature);
  }

  world.root.add(group);
  return { waterSurface, heightAt: (x, z) => heights.sample(x, z) };
}

// ---------- 高度 ----------

/**
 * 算出每个网格点画出来有多高：先按地图取高度，再把崖边磨圆
 * @description 桥和踏脚石算两遍：算岸的时候把它们当成平地（岸不磨圆，人走得过去），算它们自己那一格时当成水底
 * @param {Terrain} terrain
 * @returns {{ columns: number, rows: number, values: Float32Array, sample(x: number, z: number): number }}
 */
function smoothHeights(terrain) {
  const columns = terrain.w * SAMPLES_PER_UNIT + 1;
  const rows = terrain.d * SAMPLES_PER_UNIT + 1;
  const landProfile = blurred(rawHeights(terrain, columns, rows, true), columns, rows);
  const waterProfile = blurred(rawHeights(terrain, columns, rows, false), columns, rows);

  const values = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      const [x, z] = samplePosition(terrain, column, row);
      const onWalkableWater = WALKABLE_WATER.has(symbolAt(terrain, x, z));
      values[index] = onWalkableWater ? waterProfile[index] : landProfile[index];
    }
  }

  const sample = (x, z) => bilinear(values, columns, rows, (x - terrain.x0) * SAMPLES_PER_UNIT, (z - terrain.z0) * SAMPLES_PER_UNIT);
  return { columns, rows, values, sample };
}

/**
 * 网格点在世界里的位置
 * @param {Terrain} terrain
 * @param {number} column 第几列网格点
 * @param {number} row 第几行网格点
 * @returns {number[]} [x, z]
 */
function samplePosition(terrain, column, row) {
  return [terrain.x0 + column / SAMPLES_PER_UNIT, terrain.z0 + row / SAMPLES_PER_UNIT];
}

/**
 * 这一处在地图上是什么符号
 * @param {Terrain} terrain
 * @param {number} x
 * @param {number} z
 * @returns {string}
 */
function symbolAt(terrain, x, z) {
  const [column, row] = terrain.cellAt(x, z);
  return terrain.ch(column, row);
}

/**
 * 按地图取每个网格点的高度，还没磨圆
 * @param {Terrain} terrain
 * @param {number} columns
 * @param {number} rows
 * @param {boolean} walkableAsLand 桥、踏脚石当成平地（算岸）还是当成水底（算它们自己）
 * @returns {Float32Array}
 */
function rawHeights(terrain, columns, rows, walkableAsLand) {
  const values = new Float32Array(columns * rows);
  const bed = -terrain.level;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const [x, z] = samplePosition(terrain, column, row);
      const walkableWater = WALKABLE_WATER.has(symbolAt(terrain, x, z));
      const asBed = walkableWater && !walkableAsLand;
      values[row * columns + column] = asBed ? bed : terrain.heightAt(x, z);
    }
  }
  return values;
}

/**
 * 横竖各做几遍 [1, 2, 1] 模糊，崖边、拐角就圆了
 * @param {Float32Array} values 每个网格点的高度
 * @param {number} columns
 * @param {number} rows
 * @returns {Float32Array}
 */
function blurred(values, columns, rows) {
  let current = values;
  for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
    current = blurAlong(current, columns, rows, 1, 0);
    current = blurAlong(current, columns, rows, 0, 1);
  }
  return current;
}

/**
 * 沿一个方向做一遍 [1, 2, 1] 模糊；边上的点拿自己补（方块边上不往下塌）
 * @param {Float32Array} values
 * @param {number} columns
 * @param {number} rows
 * @param {number} stepColumn 沿列方向（1）还是不动（0）
 * @param {number} stepRow 沿行方向（1）还是不动（0）
 * @returns {Float32Array}
 */
function blurAlong(values, columns, rows, stepColumn, stepRow) {
  const result = new Float32Array(values.length);
  const at = (column, row) => {
    const clampedColumn = THREE.MathUtils.clamp(column, 0, columns - 1);
    const clampedRow = THREE.MathUtils.clamp(row, 0, rows - 1);
    return values[clampedRow * columns + clampedColumn];
  };

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const before = at(column - stepColumn, row - stepRow);
      const after = at(column + stepColumn, row + stepRow);
      result[row * columns + column] = (before + 2 * at(column, row) + after) / 4;
    }
  }
  return result;
}

/**
 * 在网格上按双线性插值取一个值
 * @param {Float32Array} values
 * @param {number} columns
 * @param {number} rows
 * @param {number} column 网格坐标（可以带小数）
 * @param {number} row 网格坐标（可以带小数）
 * @returns {number}
 */
function bilinear(values, columns, rows, column, row) {
  const left = THREE.MathUtils.clamp(Math.floor(column), 0, columns - 2);
  const top = THREE.MathUtils.clamp(Math.floor(row), 0, rows - 2);
  const fx = THREE.MathUtils.clamp(column - left, 0, 1);
  const fz = THREE.MathUtils.clamp(row - top, 0, 1);
  const at = (c, r) => values[r * columns + c];

  const upper = at(left, top) * (1 - fx) + at(left + 1, top) * fx;
  const lower = at(left, top + 1) * (1 - fx) + at(left + 1, top + 1) * fx;
  return upper * (1 - fz) + lower * fz;
}

// ---------- 颜色 ----------

/**
 * 崖壁这个高度是哪一层土
 * @description 分界线跟着 x、z 起伏一点，看起来是自然的土层，不是尺子画的横线
 * @param {string[]} strata 土层颜色
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {THREE.Color} target 写进这里
 * @returns {THREE.Color}
 */
function strataColor(strata, x, y, z, target) {
  const wobble = Math.sin(x * 2.1 + z * 1.3) * STRATA_WOBBLE;
  const layer = Math.floor((BOTTOM - y + wobble) / STRATA_THICKNESS);
  const index = ((layer % strata.length) + strata.length) % strata.length;
  return target.set(strata[index]);
}

/**
 * 地面上一个点的颜色：平的是草，陡的是土层，水下是水底，水线上一圈浅色
 * @param {object} look 颜色
 * @param {number} x
 * @param {number} y 这一点画出来的高度
 * @param {number} z
 * @param {number} upness 法线朝上的分量（1 是平地，0 是竖直的崖）
 * @param {number} level 这一格的高度层
 * @param {number} waterSurface 水面高度
 * @param {THREE.Color} target 写进这里
 * @returns {THREE.Color}
 */
function groundColor(look, x, y, z, upness, level, waterSurface, target) {
  if (y < waterSurface - SHORE_FOAM) {
    return target.set(look.bed);
  }

  const top = scratchTop.set(look.grass(x, z, level));
  strataColor(look.strata, x, y, z, target);
  const grassiness = THREE.MathUtils.smoothstep(upness, CLIFF_BELOW, GRASS_ABOVE);
  target.lerp(top, grassiness);

  const nearWaterline = y < waterSurface + SHORE_FOAM;
  if (nearWaterline) {
    target.lerp(foamColor, FOAM_STRENGTH);
  }
  return target;
}

// ---------- 网格 ----------

/**
 * 地面：一整张起伏的网格，顶点上色
 * @param {Kit} kit
 * @param {Terrain} terrain
 * @param {object} heights smoothHeights 的结果
 * @param {object} look 颜色
 * @param {number} waterSurface
 * @returns {THREE.Mesh}
 */
function groundMesh(kit, terrain, heights, look, waterSurface) {
  const { columns, rows, values } = heights;
  const positions = new Float32Array(columns * rows * 3);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      const [x, z] = samplePosition(terrain, column, row);
      positions.set([x, values[index], z], index * 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(gridIndices(columns, rows), 1));
  geometry.computeVertexNormals();

  const normals = geometry.getAttribute('normal');
  const colors = new Float32Array(positions.length);
  const color = new THREE.Color();
  for (let index = 0; index < columns * rows; index++) {
    const [x, y, z] = positions.subarray(index * 3, index * 3 + 3);
    const [column, row] = terrain.cellAt(x, z);
    groundColor(look, x, y, z, normals.getY(index), terrain.levelOf(column, row), waterSurface, color);
    colors.set([color.r, color.g, color.b], index * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return kit.mesh(geometry, '#ffffff', { vertexColors: true });
}

/**
 * 网格的三角形：每个小方格两个三角形，朝上
 * @param {number} columns
 * @param {number} rows
 * @returns {Uint32Array}
 */
function gridIndices(columns, rows) {
  const indices = new Uint32Array((columns - 1) * (rows - 1) * 6);
  let cursor = 0;

  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const topLeft = row * columns + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + columns;
      const bottomRight = bottomLeft + 1;
      indices.set([topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight], cursor);
      cursor += 6;
    }
  }
  return indices;
}

/**
 * 沿着方块四条边走一圈的网格点，每个点给出世界坐标和那里的高度
 * @param {Terrain} terrain
 * @param {object} heights
 * @returns {{ x: number, z: number, top: number }[][]} 四条边，各是一串点
 */
function boundaryRuns(terrain, heights) {
  const { columns, rows, values } = heights;
  const point = (column, row) => {
    const [x, z] = samplePosition(terrain, column, row);
    return { x, z, top: values[row * columns + column] };
  };
  const along = (count, toPoint) => Array.from({ length: count }, (_, i) => toPoint(i));

  return [
    along(columns, (i) => point(i, 0)),
    along(columns, (i) => point(i, rows - 1)),
    along(rows, (i) => point(0, i)),
    along(rows, (i) => point(columns - 1, i)),
  ];
}

/**
 * 方块四个侧面：从地面一直到底，露出一层层的土，顶上一圈草边
 * @param {Kit} kit
 * @param {Terrain} terrain
 * @param {object} heights
 * @param {object} look
 * @param {number} waterSurface
 * @returns {THREE.Mesh}
 */
function skirtMesh(kit, terrain, heights, look, waterSurface) {
  const positions = [];
  const colors = [];
  const indices = [];
  const color = new THREE.Color();

  for (const run of boundaryRuns(terrain, heights)) {
    const firstVertex = positions.length / 3;
    const levels = skirtLevels(run);
    for (const { x, z, top } of run) {
      for (const depth of levels) {
        const y = Math.max(top - depth, BOTTOM);
        positions.push(x, y, z);
        skirtColor(look, x, y, z, top, waterSurface, color);
        colors.push(color.r, color.g, color.b);
      }
    }
    skirtIndices(indices, firstVertex, run.length, levels.length);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return kit.mesh(geometry, '#ffffff', { vertexColors: true, side: THREE.DoubleSide });
}

/**
 * 侧面竖着切在哪些深度（从顶往下量）：顶上一圈草边，往下按土层的厚度切
 * @description 一条边上每一列都切一样多段（按最高那列算）；矮的列多出来的几段压在 BOTTOM 上，底边是平的
 * @param {{ top: number }[]} run 一条边上的点
 * @returns {number[]}
 */
function skirtLevels(run) {
  const highest = Math.max(...run.map((point) => point.top));
  const depths = [0, GRASS_LIP];
  for (let depth = GRASS_LIP + SKIRT_ROW_HEIGHT; depth < highest - BOTTOM; depth += SKIRT_ROW_HEIGHT) {
    depths.push(depth);
  }
  depths.push(highest - BOTTOM);
  return depths;
}

/**
 * 侧面一个点的颜色
 * @param {object} look
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} top 这一列的地面高度
 * @param {number} waterSurface
 * @param {THREE.Color} target
 * @returns {THREE.Color}
 */
function skirtColor(look, x, y, z, top, waterSurface, target) {
  const inGrassLip = top - y < GRASS_LIP + 0.001;
  const underwater = top < waterSurface;
  if (inGrassLip && underwater) {
    return target.set(look.bed);
  }
  if (inGrassLip) {
    return target.set(look.grass(x, z, 0));
  }
  return strataColor(look.strata, x, y, z, target);
}

/**
 * 侧面的三角形：相邻两列、相邻两段围成一个小方格
 * @param {number[]} indices 往这里面加
 * @param {number} firstVertex 这条边第一个顶点的编号
 * @param {number} length 这条边有几列
 * @param {number} depth 每列切几段
 */
function skirtIndices(indices, firstVertex, length, depth) {
  for (let i = 0; i < length - 1; i++) {
    for (let level = 0; level < depth - 1; level++) {
      const here = firstVertex + i * depth + level;
      const next = here + depth;
      indices.push(here, here + 1, next, next, here + 1, next + 1);
    }
  }
}

// ---------- 水 ----------

/**
 * 水：整个方块上一张水面（被地挡住的地方看不见），小溪流出方块边的地方补一块侧面
 * @description 波纹贴图慢慢挪，看起来水在流
 * @param {World} world
 * @param {Terrain} terrain
 * @param {object} heights
 * @param {object} look
 * @param {number} waterSurface
 * @returns {THREE.Group}
 */
function waterMesh(world, terrain, heights, look, waterSurface) {
  const ripples = world.texture(rippleTexture(look));
  ripples.repeat.set(terrain.w / RIPPLE_TILE, terrain.d / RIPPLE_TILE);
  const material = new THREE.MeshStandardMaterial({
    map: ripples,
    transparent: true,
    opacity: WATER_OPACITY,
    roughness: 0.2,
    metalness: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const group = new THREE.Group();
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(terrain.w, terrain.d), material);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = waterSurface;
  surface.receiveShadow = true;
  group.add(surface);

  const sides = waterSides(terrain, heights, waterSurface);
  if (sides) {
    group.add(new THREE.Mesh(sides, new THREE.MeshStandardMaterial({ color: look.water, transparent: true, opacity: WATER_OPACITY, depthWrite: false, side: THREE.DoubleSide })));
  }

  world.onUpdate((dt) => {
    ripples.offset.x += dt * RIPPLE_DRIFT[0];
    ripples.offset.y += dt * RIPPLE_DRIFT[1];
  });
  return group;
}

/**
 * 小溪流出方块边的地方，水的侧面
 * @param {Terrain} terrain
 * @param {object} heights
 * @param {number} waterSurface
 * @returns {THREE.BufferGeometry | null} 没有水流到边上时是 null
 */
function waterSides(terrain, heights, waterSurface) {
  const positions = [];
  for (const run of boundaryRuns(terrain, heights)) {
    for (let i = 0; i < run.length - 1; i++) {
      const here = run[i];
      const next = run[i + 1];
      const belowSurface = here.top < waterSurface || next.top < waterSurface;
      if (!belowSurface) {
        continue;
      }
      const hereBottom = Math.min(here.top, waterSurface);
      const nextBottom = Math.min(next.top, waterSurface);
      positions.push(here.x, hereBottom, here.z, next.x, nextBottom, next.z, here.x, waterSurface, here.z);
      positions.push(here.x, waterSurface, here.z, next.x, nextBottom, next.z, next.x, waterSurface, next.z);
    }
  }
  if (!positions.length) {
    return null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * 水面的波纹贴图：浅色的弯弯水纹和几点亮光，能无缝平铺
 * @param {object} look
 * @returns {THREE.CanvasTexture}
 */
function rippleTexture(look) {
  const random = rng(RIPPLE_SEED);
  return canvasTexture(
    RIPPLE_PX,
    RIPPLE_PX,
    (context, width, height) => {
      context.fillStyle = look.water;
      context.fillRect(0, 0, width, height);

      context.strokeStyle = look.ripple;
      context.lineCap = 'round';
      for (let i = 0; i < RIPPLE_LINES; i++) {
        drawRipple(context, random() * width, random() * height, 14 + random() * 26, width, height);
      }
    },
    { repeat: [1, 1] },
  );
}

/**
 * 画一道弯弯的水纹；画到边外的部分在对边再画一次，平铺时接得上
 * @param {CanvasRenderingContext2D} context
 * @param {number} centerX 水纹中间在哪（像素）
 * @param {number} centerY
 * @param {number} length 水纹多长（像素）
 * @param {number} width 贴图宽
 * @param {number} height 贴图高
 */
function drawRipple(context, centerX, centerY, length, width, height) {
  for (const shiftX of [-width, 0, width]) {
    for (const shiftY of [-height, 0, height]) {
      const x = centerX + shiftX;
      const y = centerY + shiftY;
      context.globalAlpha = 0.55;
      context.lineWidth = 2.5;
      context.beginPath();
      context.moveTo(x - length / 2, y);
      context.quadraticCurveTo(x, y - length * 0.25, x + length / 2, y);
      context.stroke();
    }
  }
  context.globalAlpha = 1;
}

// ---------- 台阶、踏脚石、桥 ----------

/**
 * 地图上那些单独画的格子：台阶、踏脚石、桥
 * @param {Kit} kit
 * @param {Terrain} terrain
 * @param {object} look
 * @returns {THREE.Object3D[]}
 */
function cellFeatures(kit, terrain, look) {
  const features = [];
  for (let row = 0; row < terrain.d; row++) {
    for (let column = 0; column < terrain.w; column++) {
      const feature = cellFeature(kit, terrain, look, column, row);
      if (feature) {
        features.push(feature);
      }
    }
  }
  return features;
}

/**
 * 一格要单独画的东西，普通的地和水返回 null
 * @param {Kit} kit
 * @param {Terrain} terrain
 * @param {object} look
 * @param {number} column
 * @param {number} row
 * @returns {THREE.Object3D | null}
 */
function cellFeature(kit, terrain, look, column, row) {
  const symbol = terrain.ch(column, row);
  const x = terrain.x0 + column + 0.5;
  const z = terrain.z0 + row + 0.5;

  if (DIRS[symbol]) {
    return stairs(kit, DIRS[symbol], terrain.levelOf(column, row) * terrain.level, terrain.level, x, z);
  }
  if (symbol === 'o') {
    return steppingStone(kit, look.stone, column * 31 + row * 17, x, z);
  }
  if (symbol === '=' || symbol === '|') {
    const bridge = plankBridge(kit, look.plank);
    bridge.position.set(x, 0, z);
    if (symbol === '|') {
      bridge.rotation.y = Math.PI / 2;
    }
    return bridge;
  }
  return null;
}

/**
 * 台阶：几块石板一级一级嵌在草坡里
 * @param {Kit} kit
 * @param {number[]} direction 往上走的方向 [x, z]
 * @param {number} baseY 低的那头多高
 * @param {number} rise 一共升高多少（一层）
 * @param {number} x 这一格中心
 * @param {number} z 这一格中心
 * @returns {THREE.Group}
 */
function stairs(kit, direction, baseY, rise, x, z) {
  const group = new THREE.Group();
  const depth = 1 / STAIR_SLABS;
  const [dx, dz] = direction;

  for (let i = 0; i < STAIR_SLABS; i++) {
    const along = -0.5 + depth * (i + 0.5);
    const top = baseY + ((i + 1) / STAIR_SLABS) * rise;
    const width = dx ? depth : STAIR_WIDTH;
    const length = dz ? depth : STAIR_WIDTH;
    const slab = kit.box(width, STAIR_THICKNESS, length, STAIR_COLORS[i % STAIR_COLORS.length], 0.03);
    slab.position.set(x + dx * along, top - STAIR_THICKNESS / 2, z + dz * along);
    group.add(slab);
  }
  return group;
}

/**
 * 一块踏脚石：扁扁的、有点凹凸的大石头，顶面磨平了好站人
 * @param {Kit} kit
 * @param {string} color
 * @param {number} seed 凹凸的样子，每块不一样
 * @param {number} x 这一格中心
 * @param {number} z 这一格中心
 * @returns {THREE.Mesh}
 */
function steppingStone(kit, color, seed, x, z) {
  const random = rng(seed);
  const geometry = new THREE.IcosahedronGeometry(STONE_RADIUS, 1);
  const positions = geometry.getAttribute('position');
  const flatTop = STONE_RADIUS * STONE_FLATTEN * 0.7;

  // 按位置推，同一个角的几个重复顶点推得一样，面和面之间不裂缝
  for (let i = 0; i < positions.count; i++) {
    const bump = 1 + (noiseAt(positions.getX(i), positions.getY(i), positions.getZ(i), seed) - 0.5) * 2 * STONE_BUMPS / STONE_RADIUS;
    const y = Math.min(positions.getY(i) * STONE_FLATTEN, flatTop);
    positions.setXYZ(i, positions.getX(i) * bump, y, positions.getZ(i) * bump);
  }
  geometry.computeVertexNormals();

  const stone = kit.mesh(geometry, color, { flatShading: true });
  stone.position.set(x, STONE_TOP - flatTop, z);
  stone.rotation.y = random() * Math.PI * 2;
  return stone;
}

/**
 * 小木桥：横铺的木板，两边一根横梁，四角立着桥桩，桩之间拉一根扶手
 * @description 沿 x 方向走；桥面两头比一格多伸出一点，搭在岸上
 * @param {Kit} kit
 * @param {string} color 木头颜色
 * @returns {THREE.Group} 原点在桥面中间，桥面顶和 0 层一样高
 */
function plankBridge(kit, color) {
  const group = new THREE.Group();
  const span = 1 + BRIDGE_OVERHANG * 2;
  const plankWidth = span / BRIDGE_PLANKS;
  const halfWidth = BRIDGE_WIDTH / 2;

  for (let i = 0; i < BRIDGE_PLANKS; i++) {
    const plank = kit.box(plankWidth * 0.85, 0.06, BRIDGE_WIDTH, color, 0.015);
    plank.position.set(-span / 2 + plankWidth * (i + 0.5), -0.03, 0);
    group.add(plank);
  }

  for (const side of [-1, 1]) {
    group.add(at(kit.box(span, 0.08, 0.08, color, 0.02), 0, -0.09, side * (halfWidth - 0.06)));
    for (const end of [-1, 1]) {
      const post = kit.cyl(0.04, 0.05, BRIDGE_POST_HEIGHT, color, 8);
      group.add(at(post, end * (span / 2 - 0.06), BRIDGE_POST_HEIGHT / 2 - 0.12, side * halfWidth));
    }
    group.add(at(kit.box(span - 0.12, 0.04, 0.04, color, 0.015), 0, BRIDGE_POST_HEIGHT - 0.16, side * halfWidth));
  }
  return group;
}
