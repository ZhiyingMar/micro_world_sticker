// 像素风的地形外观：把地形文字地图画成一块块 0.25 见方的小体素，代替一格 1×1 的大方块
//   草地、土路、石板都画在小体素上，弯弯的路边、一片片深浅的草是一格一格的像素，看不出 1×1 的地图格子；
//   崖顶一圈亮边、草从崖边垂下来一点，崖壁露出一层层带杂色的土和小石子；
//   水面是会一格一格流动的像素波纹，岸边一圈湿沙和一闪一闪的白浪
// 只管外观：顶面高度和逻辑高度（Terrain.heightAt）一模一样，走路、碰撞、寻路都不受影响。
// 圆润的童话风世界用 terrain-soft.js，方方正正的夜都用 Terrain.build 的大方块，像素风的世界用这个
import * as THREE from 'three';
import { canvasTexture, noiseAt, rng } from './kit.js';
import { QuadBuilder, SIDE_FACES, TOP_FACE, jitter } from './voxel.js';

// 一个小体素多大：一格切 4×4，一层（0.5）正好两块高
export const TERRAIN_VOXEL = 0.25;
// 方块底面多深
const BOTTOM = -1.5;
// 水面比 0 层低多少：岸边露出一截湿沙
const WATER_DROP = 0.2;

// 顶面：崖顶边上那一圈亮一点（被太阳照到的棱），崖脚下暗一点（被崖挡住的光）
const EDGE_HIGHLIGHT = 0.06;
const FOOT_SHADE = 0.1;
// 每块顶面、侧面深浅差多少（杂色）
const TOP_JITTER = 0.025;
const SIDE_JITTER = 0.04;
// 崖壁：最上面一块是草边；第二块有多少比例是垂下来的草
const DRIP_CHANCE = 0.45;
// 草边比顶面暗多少（侧着看不到太阳）
const LIP_SHADE = 0.08;
// 土层一层多厚，层和层的分界线高低错开多少
const STRATA_THICKNESS = 0.25;
const STRATA_WOBBLE = 0.12;
// 土里嵌着小石子的比例
const PEBBLE_CHANCE = 0.07;

// 水：多透明；波纹贴图多少像素一块、多少单位重复一次、往哪边流（每秒挪几个像素）
const WATER_OPACITY = 0.82;
const RIPPLE_PX = 16;
const RIPPLE_TILE = 2;
const RIPPLE_FLOW = [3, 1.5];
const RIPPLE_DASHES = 6;
const RIPPLE_SPARKLES = 2;
const RIPPLE_SEED = 17;
// 岸边白浪：贴着岸多宽，离水面多高（免得和水面闪着打架），一闪一闪多快、多透明
const FOAM_WIDTH = 0.07;
const FOAM_LIFT = 0.004;
const FOAM_SPEED = 1.6;
const FOAM_OPACITY = [0.35, 0.8];

// 台阶：每格几级；桥：木板几块、多宽，扶手多高
const STAIR_STEPS = 4;
const BRIDGE_PLANKS = 4;
const BRIDGE_WIDTH = 0.9;
const BRIDGE_RAIL_HEIGHT = 0.35;
// 踏脚石占一格多大
const STEPPING_STONE_SIZE = 0.7;

// 下面是水的几种格子：水、两种桥、踏脚石
const OVER_WATER = new Set(['~', '=', '|', 'o']);
const STAIRS = { '>': [1, 0], '<': [-1, 0], v: [0, 1], '^': [0, -1] };
// 顶面颜色反复用的，不用每块新建一个
const scratch = new THREE.Color();

/**
 * 把世界的地形画成像素风的小体素
 * @description 一格一格的大方块一眼就是地图格子；切成小体素以后，路边、草色、岸边都能弯、能有深浅，
 *   还是像素画的样子
 * @param {World} world 有地形（def.terrain）的世界
 * @param {object} look 颜色
 * @param {(x: number, z: number, level: number) => string | THREE.Color} look.top 顶面一块小体素的颜色（草地、路、广场），每块问一次
 * @param {string[]} look.strata 崖壁土层的颜色，从上往下轮流
 * @param {string} look.pebble 嵌在土里的小石子
 * @param {string} look.shore 岸边湿沙
 * @param {string} look.bed 水底
 * @param {string} look.water 水
 * @param {string} look.ripple 水面波纹
 * @param {string[]} look.stairs 台阶石板，两种颜色一级一级错开
 * @param {string} look.plank 桥的木头
 * @param {string} look.stone 踏脚石
 * @returns {{ waterSurface: number, waterPatch: (width: number, depth: number) => THREE.Mesh, stairs: CellFeature[] }} 水面多高；
 *   做一小块和地上一样的水面（喷泉这种小水池用，波纹一样大、一起流），原点在中心，平躺着；
 *   每一格台阶（场景要让它塌掉、再一级级长回来时用）
 */
export function buildVoxelTerrain(world, look) {
  const terrain = world.terrain;
  warnIfLevelMisfits(terrain);
  const waterSurface = -WATER_DROP;
  const grid = columnGrid(terrain);

  const builder = new QuadBuilder();
  addTops(builder, terrain, grid, look);
  addSides(builder, grid, look, waterSurface);

  const group = new THREE.Group();
  group.add(world.kit.mesh(builder.geometry(), '#ffffff', { vertexColors: true }));
  const water = buildWater(world, terrain, grid, look, waterSurface);
  group.add(water.group);
  const stairs = [];
  for (const feature of cellFeatures(world.kit, terrain, look)) {
    group.add(feature.object);
    if (STAIRS[feature.symbol]) {
      stairs.push(feature);
    }
  }

  world.root.add(group);
  const waterPatch = (width, depth) => waterPatchMesh(terrain, water.material, width, depth);
  return { waterSurface, waterPatch, stairs };
}

/**
 * 一小块水面，用地上的水的材质；贴图坐标按大小缩放，波纹和地上的一样大
 * @param {Terrain} terrain
 * @param {THREE.Material} material 地上的水的材质
 * @param {number} width
 * @param {number} depth
 * @returns {THREE.Mesh}
 */
function waterPatchMesh(terrain, material, width, depth) {
  const geometry = new THREE.PlaneGeometry(width, depth);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) * width) / terrain.w, (uv.getY(i) * depth) / terrain.d);
  }
  geometry.rotateX(-Math.PI / 2);

  const patch = new THREE.Mesh(geometry, material);
  patch.receiveShadow = true;
  return patch;
}

/**
 * 层高不是小体素的整数倍时，崖壁会和顶面对不齐，说一声
 * @param {Terrain} terrain
 */
function warnIfLevelMisfits(terrain) {
  const voxelsPerLevel = terrain.level / TERRAIN_VOXEL;
  if (Math.abs(voxelsPerLevel - Math.round(voxelsPerLevel)) > 1e-6) {
    console.warn(`体素地形：层高 ${terrain.level} 不是 ${TERRAIN_VOXEL} 的整数倍，崖壁的小方块会对不齐`);
  }
}

// ---------- 一根根小柱子 ----------

/**
 * 把地面切成一根根小体素柱子，记下每根有多高、是不是水
 * @param {Terrain} terrain
 * @returns {{ columns: number, rows: number, tops: Float32Array, water: Uint8Array, stairs: Uint8Array, x0: number, z0: number, level: number, topAt(column: number, row: number): number }}
 */
function columnGrid(terrain) {
  const columns = Math.round(terrain.w / TERRAIN_VOXEL);
  const rows = Math.round(terrain.d / TERRAIN_VOXEL);
  const tops = new Float32Array(columns * rows);
  const water = new Uint8Array(columns * rows);
  const stairs = new Uint8Array(columns * rows);

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = terrain.x0 + (column + 0.5) * TERRAIN_VOXEL;
      const z = terrain.z0 + (row + 0.5) * TERRAIN_VOXEL;
      const [cellColumn, cellRow] = terrain.cellAt(x, z);
      const symbol = terrain.ch(cellColumn, cellRow);
      const index = row * columns + column;

      water[index] = OVER_WATER.has(symbol) ? 1 : 0;
      stairs[index] = STAIRS[symbol] ? 1 : 0;
      // 水底比 0 层低一层；台阶这一格的柱子只到低的那头，上面摆一级级石板
      tops[index] = water[index] ? -terrain.level : terrain.levelOf(cellColumn, cellRow) * terrain.level;
    }
  }

  // 方块外面当作一直低到底，四个侧面就会一直画到底
  const topAt = (column, row) => {
    const outside = column < 0 || row < 0 || column >= columns || row >= rows;
    return outside ? BOTTOM : tops[row * columns + column];
  };
  const grid = { columns, rows, tops, water, stairs, x0: terrain.x0, z0: terrain.z0, level: terrain.level, topAt };
  roundCorners(grid);
  return grid;
}

/**
 * 把拐角磨掉一块：崖顶的外角削低一块，崖脚的内角、池塘的角垫高一块
 * @description 像素画里圆角就是这么做的：直角上缺一块、补一块，一眼就不是尺子画的方块了。
 *   只动拐角那一块小体素，人离崖边最近也有 0.22，站不到它上面（最多脚尖擦到一点）
 * @param {object} grid columnGrid 里还没磨的柱子
 */
function roundCorners(grid) {
  const { columns, rows, tops, water, stairs, topAt } = grid;
  // 先按原来的高度看完一遍再改，免得削过的一块又让旁边那块变成拐角
  const original = Float32Array.from(tops);
  const originalAt = (column, row) => {
    const outside = column < 0 || row < 0 || column >= columns || row >= rows;
    return outside ? topAt(column, row) : original[row * columns + column];
  };
  const nearStairs = (column, row) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => isStairs(grid, column + dx, row + dz));

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      if (stairs[index] || nearStairs(column, row)) {
        continue;
      }
      const corner = cornerKind(originalAt, column, row);
      if (corner.convex && !water[index]) {
        tops[index] -= TERRAIN_VOXEL;
      } else if (corner.concave && water[index]) {
        // 池塘的角补成岸：和旁边的岸一样高（最高到 0 层），画成湿沙
        water[index] = 0;
        tops[index] = Math.min(corner.lowestHigher, 0);
      } else if (corner.concave) {
        tops[index] = Math.min(tops[index] + TERRAIN_VOXEL, corner.lowestHigher);
      }
    }
  }
}

/**
 * 这一块是不是拐角：左右里有一边、前后里有一边比它低（外角），或者都比它高（内角）
 * @param {(column: number, row: number) => number} heightAt 柱子的高度（原来的）
 * @param {number} column
 * @param {number} row
 * @returns {{ convex: boolean, concave: boolean, lowestHigher: number }} lowestHigher 是内角两边里矮的那边多高
 */
function cornerKind(heightAt, column, row) {
  const top = heightAt(column, row);
  const sideways = [heightAt(column - 1, row), heightAt(column + 1, row)];
  const frontBack = [heightAt(column, row - 1), heightAt(column, row + 1)];
  const lower = (height) => height <= top - TERRAIN_VOXEL;
  const higher = (height) => height >= top + TERRAIN_VOXEL;

  const convex = sideways.some(lower) && frontBack.some(lower);
  const higherSideways = sideways.filter(higher);
  const higherFrontBack = frontBack.filter(higher);
  const concave = higherSideways.length > 0 && higherFrontBack.length > 0;
  const lowestHigher = Math.min(...higherSideways, ...higherFrontBack);
  return { convex, concave, lowestHigher };
}

/**
 * 这根柱子是不是台阶（方块外面不算）
 * @param {object} grid
 * @param {number} column
 * @param {number} row
 * @returns {boolean}
 */
function isStairs(grid, column, row) {
  const inside = column >= 0 && row >= 0 && column < grid.columns && row < grid.rows;
  return inside && grid.stairs[row * grid.columns + column] === 1;
}

/**
 * 一根柱子中心在世界里的位置
 * @param {object} grid columnGrid 的结果
 * @param {number} column
 * @param {number} row
 * @returns {number[]} [x, z]
 */
function columnCenter(grid, column, row) {
  return [grid.x0 + (column + 0.5) * TERRAIN_VOXEL, grid.z0 + (row + 0.5) * TERRAIN_VOXEL];
}

/**
 * 这根柱子是不是水（方块外面不算）
 * @param {object} grid
 * @param {number} column
 * @param {number} row
 * @returns {boolean}
 */
function isWater(grid, column, row) {
  const inside = column >= 0 && row >= 0 && column < grid.columns && row < grid.rows;
  return inside && grid.water[row * grid.columns + column] === 1;
}

// ---------- 顶面 ----------

/**
 * 每根柱子顶上一块面：草地、路、广场、岸边湿沙、水底
 * @param {QuadBuilder} builder
 * @param {Terrain} terrain
 * @param {object} grid
 * @param {object} look
 */
function addTops(builder, terrain, grid, look) {
  const half = TERRAIN_VOXEL / 2;
  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      const index = row * grid.columns + column;
      // 台阶这一格上面盖满了石板，柱子顶看不见
      if (grid.stairs[index]) {
        continue;
      }
      const [x, z] = columnCenter(grid, column, row);
      const top = grid.tops[index];
      const color = topColor(terrain, grid, look, column, row);
      builder.quad([x, top, z], TOP_FACE.normal, TOP_FACE.u, TOP_FACE.v, half, half, color);
    }
  }
}

/**
 * 一块顶面的颜色
 * @param {Terrain} terrain
 * @param {object} grid
 * @param {object} look
 * @param {number} column
 * @param {number} row
 * @returns {THREE.Color}
 */
function topColor(terrain, grid, look, column, row) {
  const [x, z] = columnCenter(grid, column, row);
  const top = grid.tops[row * grid.columns + column];
  if (isWater(grid, column, row)) {
    return jitter(scratch.set(look.bed), [x, top, z], TOP_JITTER, 3);
  }

  const nextToWater = top <= 0 && touchesWater(grid, column, row);
  if (nextToWater) {
    scratch.set(look.shore);
  } else {
    scratch.set(look.top(x, z, Math.round(top / terrain.level)));
  }
  jitter(scratch, [x, top, z], TOP_JITTER, 1);

  // 崖顶的棱亮一点，崖脚暗一点：一眼看得出哪边高
  const neighbors = SIDE_FACES.map(({ normal }) => grid.topAt(column + normal[0], row + normal[2]));
  if (neighbors.some((height) => height < top)) {
    scratch.offsetHSL(0, 0, EDGE_HIGHLIGHT);
  }
  if (neighbors.some((height) => height > top)) {
    scratch.offsetHSL(0, 0, -FOOT_SHADE);
  }
  return scratch;
}

/**
 * 这根柱子旁边（八个方向）有没有水
 * @param {object} grid
 * @param {number} column
 * @param {number} row
 * @returns {boolean}
 */
function touchesWater(grid, column, row) {
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (isWater(grid, column + dx, row + dz)) {
        return true;
      }
    }
  }
  return false;
}

// ---------- 侧面 ----------

/**
 * 柱子比旁边高的地方，一块块画出侧面：崖壁、岸、方块四周的土层
 * @param {QuadBuilder} builder
 * @param {object} grid
 * @param {object} look
 * @param {number} waterSurface
 */
function addSides(builder, grid, look, waterSurface) {
  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      for (const face of SIDE_FACES) {
        addColumnSide(builder, grid, look, waterSurface, column, row, face);
      }
    }
  }
}

/**
 * 一根柱子朝一个方向的侧面：从柱顶往下一块一块，直到旁边那根柱子的高度
 * @param {QuadBuilder} builder
 * @param {object} grid
 * @param {object} look
 * @param {number} waterSurface
 * @param {number} column
 * @param {number} row
 * @param {{ normal: number[], u: number[], v: number[] }} face 朝哪个方向
 */
function addColumnSide(builder, grid, look, waterSurface, column, row, face) {
  const top = grid.topAt(column, row);
  const [nx, , nz] = face.normal;
  const neighborTop = grid.topAt(column + nx, row + nz);
  if (neighborTop >= top) {
    return;
  }

  const [x, z] = columnCenter(grid, column, row);
  const half = TERRAIN_VOXEL / 2;
  const facesWater = isWater(grid, column + nx, row + nz);
  const isLand = !isWater(grid, column, row);
  const grass = isLand ? scratch.set(look.top(x, z, Math.round(top / grid.level))).clone() : null;
  const layers = Math.round((top - neighborTop) / TERRAIN_VOXEL);

  for (let depth = 0; depth < layers; depth++) {
    const centerY = top - (depth + 0.5) * TERRAIN_VOXEL;
    const center = [x + nx * half, centerY, z + nz * half];
    const color = sideColor(look, { x, y: centerY, z, depth, grass, facesWater, waterSurface, dripSeed: noiseAt(x, nx, z, nz) });
    builder.quad(center, face.normal, face.u, face.v, half, half, color);
  }
}

/**
 * 侧面一块的颜色：最上面是草边、有的往下垂一块草，再往下是一层层的土，水下是水底的颜色
 * @param {object} look
 * @param {object} block
 * @param {number} block.x
 * @param {number} block.y 这一块中心的高度
 * @param {number} block.z
 * @param {number} block.depth 从柱顶往下数第几块
 * @param {THREE.Color | null} block.grass 柱顶的颜色（水底的柱子没有草边）
 * @param {boolean} block.facesWater 这一面是不是朝着水
 * @param {number} block.waterSurface
 * @param {number} block.dripSeed 0 到 1：这一列的草要不要往下垂
 * @returns {THREE.Color}
 */
function sideColor(look, { x, y, z, depth, grass, facesWater, waterSurface, dripSeed }) {
  const underwater = facesWater && y < waterSurface;
  if (underwater) {
    return jitter(scratch.set(look.bed), [x, y, z], SIDE_JITTER, 5);
  }
  const atWaterline = facesWater && y < waterSurface + TERRAIN_VOXEL;
  if (atWaterline) {
    return jitter(scratch.set(look.shore), [x, y, z], SIDE_JITTER, 5);
  }

  const drips = depth === 1 && dripSeed < DRIP_CHANCE;
  const grassy = grass && (depth === 0 || drips);
  if (grassy) {
    return jitter(scratch.copy(grass).offsetHSL(0, 0, -LIP_SHADE * (depth + 1)), [x, y, z], SIDE_JITTER, 7);
  }

  if (noiseAt(x, y, z, 11) < PEBBLE_CHANCE) {
    return jitter(scratch.set(look.pebble), [x, y, z], SIDE_JITTER, 9);
  }
  const wobble = (noiseAt(x, 0, z, 13) - 0.5) * 2 * STRATA_WOBBLE;
  const layer = Math.floor((-y + wobble) / STRATA_THICKNESS);
  const index = ((layer % look.strata.length) + look.strata.length) % look.strata.length;
  return jitter(scratch.set(look.strata[index]), [x, y, z], SIDE_JITTER, 15);
}

// ---------- 水 ----------

/**
 * 水：整个方块上一张像素波纹的水面（被地挡住的地方看不见），岸边一圈一闪一闪的白浪
 * @description 波纹一个像素一个像素地挪，看起来是像素画里的流水，不是平滑地滑过去
 * @param {World} world
 * @param {Terrain} terrain
 * @param {object} grid
 * @param {object} look
 * @param {number} waterSurface
 * @returns {{ group: THREE.Group, material: THREE.Material }}
 */
function buildWater(world, terrain, grid, look, waterSurface) {
  const ripples = world.texture(rippleTexture(look));
  ripples.repeat.set(terrain.w / RIPPLE_TILE, terrain.d / RIPPLE_TILE);
  const material = new THREE.MeshLambertMaterial({ map: ripples, transparent: true, opacity: WATER_OPACITY, depthWrite: false });

  const group = new THREE.Group();
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(terrain.w, terrain.d), material);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = waterSurface;
  surface.receiveShadow = true;
  group.add(surface);

  const foam = shoreFoam(grid, waterSurface);
  if (foam) {
    group.add(foam);
  }

  world.onUpdate((dt, time) => {
    // 一次挪一整个像素：贴图是像素画，挪半个像素会糊
    ripples.offset.x = Math.floor(time * RIPPLE_FLOW[0]) / RIPPLE_PX;
    ripples.offset.y = Math.floor(time * RIPPLE_FLOW[1]) / RIPPLE_PX;
    if (foam) {
      const pulse = 0.5 + 0.5 * Math.sin(time * FOAM_SPEED);
      foam.material.opacity = FOAM_OPACITY[0] + (FOAM_OPACITY[1] - FOAM_OPACITY[0]) * pulse;
    }
  });
  return { group, material };
}

/**
 * 岸边的白浪：每块挨着岸的水，在岸那一边贴一条细细的白边
 * @param {object} grid
 * @param {number} waterSurface
 * @returns {THREE.Mesh | null} 没有水时是 null
 */
function shoreFoam(grid, waterSurface) {
  const builder = new QuadBuilder();
  const white = new THREE.Color('#ffffff');
  const half = TERRAIN_VOXEL / 2;

  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      if (!isWater(grid, column, row)) {
        continue;
      }
      const [x, z] = columnCenter(grid, column, row);
      for (const { normal } of SIDE_FACES) {
        const [nx, , nz] = normal;
        const bankAhead = grid.topAt(column + nx, row + nz) > waterSurface;
        if (!bankAhead) {
          continue;
        }
        // 白边贴着岸：沿岸那个方向占满一块，朝水里只伸出一小条
        const center = [x + nx * (half - FOAM_WIDTH / 2), waterSurface + FOAM_LIFT, z + nz * (half - FOAM_WIDTH / 2)];
        const halfX = nx ? FOAM_WIDTH / 2 : half;
        const halfZ = nz ? FOAM_WIDTH / 2 : half;
        builder.quad(center, TOP_FACE.normal, TOP_FACE.u, TOP_FACE.v, halfZ, halfX, white);
      }
    }
  }
  if (!builder.positions.length) {
    return null;
  }

  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: FOAM_OPACITY[1], depthWrite: false });
  return new THREE.Mesh(builder.geometry(), material);
}

/**
 * 水面的像素波纹：几道浅色的短横、两个亮点，能无缝平铺
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

      // 短横画到边外的部分从另一边接上，平铺时看不出接缝
      context.fillStyle = look.ripple;
      for (let i = 0; i < RIPPLE_DASHES; i++) {
        const startX = Math.floor(random() * width);
        const y = Math.floor(random() * height);
        const length = 2 + Math.floor(random() * 3);
        for (let step = 0; step < length; step++) {
          context.fillRect((startX + step) % width, y, 1, 1);
        }
      }
      context.fillStyle = '#ffffff';
      for (let i = 0; i < RIPPLE_SPARKLES; i++) {
        context.fillRect(Math.floor(random() * width), Math.floor(random() * height), 1, 1);
      }
    },
    { pixel: true, repeat: [1, 1] },
  );
}

// ---------- 台阶、桥、踏脚石 ----------

/**
 * 单独画出来的一格：一格台阶、一座桥、一块踏脚石
 * @typedef {object} CellFeature
 * @property {THREE.Object3D} object 画出来的东西（台阶是一组石板，一级一块）
 * @property {string} symbol 地图上这一格的符号
 * @property {number} column 第几列
 * @property {number} row 第几行
 * @property {number} x 这一格中心
 * @property {number} z 这一格中心
 * @property {number} baseY 这一格低的那头多高（台阶从这儿往上长）
 */

/**
 * 地图上那些单独画的格子：台阶、桥、踏脚石
 * @param {Kit} kit
 * @param {Terrain} terrain
 * @param {object} look
 * @returns {CellFeature[]}
 */
function cellFeatures(kit, terrain, look) {
  const features = [];
  for (let row = 0; row < terrain.d; row++) {
    for (let column = 0; column < terrain.w; column++) {
      const object = cellFeature(kit, terrain, look, column, row);
      if (!object) {
        continue;
      }
      const x = terrain.x0 + column + 0.5;
      const z = terrain.z0 + row + 0.5;
      const baseY = terrain.levelOf(column, row) * terrain.level;
      features.push({ object, symbol: terrain.ch(column, row), column, row, x, z, baseY });
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

  if (STAIRS[symbol]) {
    return stairs(kit, look, STAIRS[symbol], terrain.levelOf(column, row) * terrain.level, terrain.level, x, z);
  }
  if (symbol === 'o') {
    const height = terrain.level;
    const stone = kit.box(STEPPING_STONE_SIZE, height, STEPPING_STONE_SIZE, look.stone);
    stone.position.set(x, -height / 2, z);
    return stone;
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
 * 一格台阶：几块石板一级一级往上，每级从柱子顶一直垫到这一级的高度
 * @param {Kit} kit
 * @param {object} look
 * @param {number[]} direction 往上走的方向 [x, z]
 * @param {number} baseY 低的那头多高
 * @param {number} rise 一共升高多少（一层）
 * @param {number} x 这一格中心
 * @param {number} z
 * @returns {THREE.Group}
 */
function stairs(kit, look, direction, baseY, rise, x, z) {
  const group = new THREE.Group();
  const depth = 1 / STAIR_STEPS;
  const [dx, dz] = direction;

  for (let step = 0; step < STAIR_STEPS; step++) {
    const along = -0.5 + depth * (step + 0.5);
    const height = ((step + 1) / STAIR_STEPS) * rise;
    const width = dx ? depth : 1;
    const length = dz ? depth : 1;
    const slab = kit.box(width, height, length, look.stairs[step % look.stairs.length]);
    slab.position.set(x + dx * along, baseY + height / 2, z + dz * along);
    group.add(slab);
  }
  return group;
}

/**
 * 小木桥：几块横铺的木板，两边一道扶手
 * @description 沿 x 方向走
 * @param {Kit} kit
 * @param {string} color 木头颜色
 * @returns {THREE.Group} 原点在桥面中间，桥面顶和 0 层一样高
 */
function plankBridge(kit, color) {
  const group = new THREE.Group();
  const plankWidth = 1 / BRIDGE_PLANKS;
  for (let i = 0; i < BRIDGE_PLANKS; i++) {
    const plank = kit.box(plankWidth * 0.9, 0.08, BRIDGE_WIDTH, color);
    plank.position.set(-0.5 + plankWidth * (i + 0.5), -0.04, 0);
    group.add(plank);
  }
  for (const side of [-1, 1]) {
    const rail = kit.box(1, 0.06, 0.06, color);
    rail.position.set(0, BRIDGE_RAIL_HEIGHT, side * BRIDGE_WIDTH / 2);
    group.add(rail);
  }
  return group;
}
