// 夜都的地面：人行道铺灰砖、后巷是旧水泥板、观景台铺陶土砖、公园是草地
//   高出来的地方是石块砌的挡土墙，墙顶压一圈水泥条；公园里土坡的边是一圈垂下来的草皮
//   方块四周的侧面露出地底下一层层的土，插着几根管子；台阶是一级级水泥台阶
// 城里本来就是人造的，墙和台阶还是方方正正的；只是表面铺上贴图、按世界坐标连成一片，看不出 1×1 的格子
// 只管外观：走路、碰撞、寻路还是看 Terrain 的逻辑高度（heightAt）。每格顶面画在它的逻辑高度上
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pavingTexture, laneTexture, terraceTexture, grassTexture, stoneWallTexture, strataTexture, GROUND_TILE, WALL_TILE, STRATA_BOTTOM, STRATA_TOP } from './textures.js';
import { REGIONS } from './layout.js';

// 每格顶面横竖切几段：深浅斑块是按顶点上色的，切得太粗斑块会变成方格
const TOP_SUBDIVISIONS = 4;
// 方块底面多深（和土层贴图画到的最低处一样）
const BOTTOM = STRATA_BOTTOM;

// 墙顶压的水泥条：多高，往里多宽，往墙外伸出多少，比地面高出多少
const COPING = { height: 0.08, depth: 0.16, overhang: 0.04, rise: 0.03, color: '#b9bccb' };
// 公园土坡边上垂下来的一圈草皮：多厚，往外伸出多少，往里多宽
const GRASS_LIP = { height: 0.07, overhang: 0.03, depth: 0.12, color: '#4a8064' };
// 方块侧面最上面：人行道石板的边，厚一点，比土层亮
const SLAB_EDGE = { height: 0.14, overhang: 0.015, depth: 0.1, color: '#a3a6b5' };
// 这几样边条的棱倒多圆
const TRIM_ROUND = 0.02;

// 台阶：每格几级，两种深浅的水泥交替，棱倒多圆，每级往下埋多少（和下面的墙接上）
const STEP_COUNT = 4;
const STEP_COLORS = ['#b8bbc9', '#a8abba'];
const STEP_ROUND = 0.02;
const STEP_BURY = 0.03;

// 方块侧面插着的管子 [哪一面, 沿着这一面在哪, 高度 y, 半径, 颜色]
// 哪一面：+x 右边、-x 左边、+z 前面（镜头这边）、-z 后面；默认镜头看得到右边和前面
const PIPES = [
  ['+x', -3.4, -0.32, 0.08, '#8b8f9e'],
  ['+x', 1.6, -0.62, 0.06, '#9a6a4a'],
  ['+x', 5.3, -0.3, 0.05, '#8b8f9e'],
  ['+z', -4.6, -0.5, 0.09, '#8b8f9e'],
  ['+z', 3.2, -0.75, 0.06, '#9a6a4a'],
  ['-x', -2.2, -0.4, 0.08, '#8b8f9e'],
];
// 管子从墙里伸出来多长，管口里面多暗
const PIPE_LENGTH = 0.16;
const PIPE_INSIDE = '#1e1b26';

// 各种地面：用哪张贴图，顶点按位置乘上的深浅（斑块）
// tint 返回 [r, g, b] 乘数：1 是贴图原色，草地会偏黄偏蓝，看起来是一片一片的
const SURFACES = {
  sidewalk: { texture: pavingTexture, tint: (patch) => grey(0.88 + 0.16 * patch) },
  lane: { texture: laneTexture, tint: (patch) => grey(0.82 + 0.2 * patch) },
  terrace: { texture: terraceTexture, tint: (patch) => grey(0.9 + 0.12 * patch) },
  park: { texture: grassTexture, tint: (patch) => mix([0.72, 0.84, 0.92], [1.12, 1.12, 0.88], patch) },
  garden: { texture: grassTexture, tint: (patch) => mix([0.86, 0.92, 0.8], [1.18, 1.14, 0.8], patch) },
};
// 人造的地面（墙顶压水泥条、侧面露石板边），别的是草地（边上一圈草皮）
const PAVED = new Set(['sidewalk', 'lane', 'terrace']);

const DIRS = { '>': [1, 0], '<': [-1, 0], v: [0, 1], '^': [0, -1] };
// 四个方向：往哪边、这一面叫什么
const SIDES = [
  { dx: 1, dz: 0, name: '+x' },
  { dx: -1, dz: 0, name: '-x' },
  { dx: 0, dz: 1, name: '+z' },
  { dx: 0, dz: -1, name: '-z' },
];

/**
 * 画夜都的地面
 * @param {World} world 夜都
 * @returns {{ surfaceAt(x: number, z: number): string }} 某一处是哪种地面（sidewalk / lane / terrace / park / garden），往上种草种花时用
 */
export function buildGround(world) {
  const terrain = world.terrain;
  const group = new THREE.Group();

  group.add(...topMeshes(world, terrain));
  group.add(...faceMeshes(world, terrain));
  group.add(...trimMeshes(world, terrain));
  group.add(stairMesh(world, terrain));
  group.add(pipes(world, terrain));

  world.root.add(group);
  return {
    surfaceAt(x, z) {
      const [column, row] = terrain.cellAt(x, z);
      return surfaceOf(terrain, column, row);
    },
  };
}

// ---------- 哪一格是什么 ----------

/**
 * 这一格铺的是什么：公园、观景台高出来，花园在左边，后巷在最后面，别的都是人行道
 * @param {Terrain} terrain
 * @param {number} column 第几列
 * @param {number} row 第几行
 * @returns {string} SURFACES 里的名字
 */
function surfaceOf(terrain, column, row) {
  const raised = terrain.levelOf(column, row) >= 1;
  if (raised && row >= REGIONS.parkFromRow) {
    return 'park';
  }
  if (raised && column >= REGIONS.lookoutFromCol && row <= REGIONS.lookoutToRow) {
    return 'terrace';
  }
  const inGarden = column <= REGIONS.gardenToCol && row > REGIONS.backLaneRow && row < REGIONS.parkFromRow - 1;
  if (inGarden) {
    return 'garden';
  }
  if (row <= REGIONS.backLaneRow) {
    return 'lane';
  }
  return 'sidewalk';
}

/**
 * 这一格是不是台阶；是的话往哪边爬
 * @param {Terrain} terrain
 * @param {number} column
 * @param {number} row
 * @returns {number[] | undefined} [dx, dz]
 */
function stairDirection(terrain, column, row) {
  return DIRS[terrain.ch(column, row)];
}

/**
 * 这一格的地面画多高：平地是它的高度层，台阶算低的那头（上面的台阶自己往上搭）
 * @param {Terrain} terrain
 * @param {number} column
 * @param {number} row
 * @returns {number}
 */
function baseHeight(terrain, column, row) {
  return terrain.levelOf(column, row) * terrain.level;
}

/**
 * 这一格在不在地图里
 * @param {Terrain} terrain
 * @param {number} column
 * @param {number} row
 * @returns {boolean}
 */
function inside(terrain, column, row) {
  return column >= 0 && column < terrain.w && row >= 0 && row < terrain.d;
}

// ---------- 颜色 ----------

/**
 * 灰色的乘数
 * @param {number} value
 * @returns {number[]} [r, g, b]
 */
function grey(value) {
  return [value, value, value];
}

/**
 * 两个乘数之间按比例混
 * @param {number[]} from patch 为 0 时
 * @param {number[]} to patch 为 1 时
 * @param {number} patch 0 ~ 1
 * @returns {number[]} [r, g, b]
 */
function mix(from, to, patch) {
  return from.map((value, index) => value + (to[index] - value) * patch);
}

/**
 * 一处地面是亮的那片还是暗的那片：两组斜着交叉的波叠出一大片一大片的深浅，再加一点细碎的
 * @param {number} x
 * @param {number} z
 * @returns {number} 0 ~ 1
 */
function patchAt(x, z) {
  const broad = 0.5 + 0.25 * Math.sin(x * 0.9 + Math.sin(z * 0.6) * 1.7) + 0.25 * Math.sin(z * 1.15 - x * 0.45 + 1.3);
  const fine = Math.sin(x * 5.3) * Math.sin(z * 4.7) * 0.08;
  return THREE.MathUtils.clamp(broad + fine, 0, 1);
}

// ---------- 自己拼网格 ----------

/**
 * 攒顶点的小工具：一个一个四边形加进来，最后变成一个网格
 */
class QuadBuffer {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.colors = [];
    this.indices = [];
  }

  /**
   * 加一个顶点
   * @param {number[]} position [x, y, z]
   * @param {number[]} normal [x, y, z]
   * @param {number[]} uv [u, v]
   * @param {number[]} color [r, g, b]
   * @returns {number} 这个顶点的编号
   */
  vertex(position, normal, uv, color = [1, 1, 1]) {
    this.positions.push(...position);
    this.normals.push(...normal);
    this.uvs.push(...uv);
    this.colors.push(...color);
    return this.positions.length / 3 - 1;
  }

  /**
   * 加两个三角形拼成的四边形，四个角按“从正面看逆时针”给
   * @param {number} a
   * @param {number} b
   * @param {number} c
   * @param {number} d
   */
  quad(a, b, c, d) {
    this.indices.push(a, b, c, a, c, d);
  }

  /**
   * 变成 BufferGeometry
   * @param {boolean} withColors 要不要带顶点颜色
   * @returns {THREE.BufferGeometry}
   */
  toGeometry(withColors) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    if (withColors) {
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    }
    geometry.setIndex(this.indices);
    return geometry;
  }
}

// ---------- 顶面 ----------

/**
 * 所有格子的顶面：每种地面拼成一个网格，贴图按世界坐标铺，顶点按位置深浅不一
 * @param {World} world
 * @param {Terrain} terrain
 * @returns {THREE.Mesh[]}
 */
function topMeshes(world, terrain) {
  const buffers = new Map();
  for (let row = 0; row < terrain.d; row++) {
    for (let column = 0; column < terrain.w; column++) {
      const kind = surfaceOf(terrain, column, row);
      if (!buffers.has(kind)) {
        buffers.set(kind, new QuadBuffer());
      }
      addTop(buffers.get(kind), terrain, column, row, SURFACES[kind].tint);
    }
  }

  return [...buffers].map(([kind, buffer]) => {
    const material = new THREE.MeshStandardMaterial({ map: SURFACES[kind].texture(world), vertexColors: true, roughness: 0.92 });
    const mesh = new THREE.Mesh(buffer.toGeometry(true), material);
    mesh.receiveShadow = true;
    return mesh;
  });
}

/**
 * 一格的顶面：切成几乘几的小格，每个顶点按位置上一点深浅
 * @description 台阶格也铺一层（台阶下面那截），台阶自己的一级级由 stairMesh 搭
 * @param {QuadBuffer} buffer
 * @param {Terrain} terrain
 * @param {number} column
 * @param {number} row
 * @param {(patch: number) => number[]} tint 深浅怎么乘
 */
function addTop(buffer, terrain, column, row, tint) {
  const y = baseHeight(terrain, column, row);
  const left = terrain.x0 + column;
  const back = terrain.z0 + row;
  const steps = TOP_SUBDIVISIONS;
  const up = [0, 1, 0];

  const ids = [];
  for (let b = 0; b <= steps; b++) {
    for (let a = 0; a <= steps; a++) {
      const x = left + a / steps;
      const z = back + b / steps;
      ids.push(buffer.vertex([x, y, z], up, [x / GROUND_TILE, -z / GROUND_TILE], tint(patchAt(x, z))));
    }
  }

  const stride = steps + 1;
  for (let b = 0; b < steps; b++) {
    for (let a = 0; a < steps; a++) {
      const corner = b * stride + a;
      // 从上往下看逆时针：(x, z) → (x, z+1) → (x+1, z+1) → (x+1, z)
      buffer.quad(ids[corner], ids[corner + stride], ids[corner + stride + 1], ids[corner + 1]);
    }
  }
}

// ---------- 侧面 ----------

/**
 * 一格某一边的那面墙：在格子边上，竖着从 low 到 high，朝外
 * @param {Terrain} terrain
 * @param {number} column
 * @param {number} row
 * @param {{ dx: number, dz: number }} side 朝哪边
 * @returns {{ center: number[], right: number[], normal: number[] }} 这一面中间的 [x, z]、从外面看往右的方向、朝外的方向
 */
function edgeFrame(terrain, column, row, { dx, dz }) {
  const centerX = terrain.x0 + column + 0.5 + dx * 0.5;
  const centerZ = terrain.z0 + row + 0.5 + dz * 0.5;
  // 从外面看着这面墙时“右手边”：朝外的方向和竖直方向叉乘
  const right = [dz, 0, -dx];
  return { center: [centerX, centerZ], right, normal: [dx, 0, dz] };
}

/**
 * 加一面竖着的墙
 * @param {QuadBuffer} buffer
 * @param {{ center: number[], right: number[], normal: number[] }} frame edgeFrame 的结果
 * @param {number} low 墙脚多高
 * @param {number} high 墙顶多高
 * @param {(y: number) => number} vOf 世界 y 对应贴图的 v
 */
function addWall(buffer, frame, low, high, vOf) {
  const [centerX, centerZ] = frame.center;
  const [rightX, , rightZ] = frame.right;
  const corner = (side, y) => {
    const x = centerX + rightX * side * 0.5;
    const z = centerZ + rightZ * side * 0.5;
    // 沿着墙走多远：同一条直边上相邻几格接得上
    const along = x * rightX + z * rightZ;
    return buffer.vertex([x, y, z], frame.normal, [along / WALL_TILE, vOf(y)]);
  };

  const bottomLeft = corner(-1, low);
  const bottomRight = corner(1, low);
  const topRight = corner(1, high);
  const topLeft = corner(-1, high);
  buffer.quad(bottomLeft, bottomRight, topRight, topLeft);
}

/**
 * 所有竖着的面：方块四周露出土层；里面高低落差的地方是石块挡土墙
 * @description 观景台是人造的平台，伸到方块边上那截也是石墙，地面以下才是土
 * @param {World} world
 * @param {Terrain} terrain
 * @returns {THREE.Mesh[]}
 */
function faceMeshes(world, terrain) {
  const strata = new QuadBuffer();
  const stone = new QuadBuffer();
  const strataV = (y) => (y - STRATA_BOTTOM) / (STRATA_TOP - STRATA_BOTTOM);
  const stoneV = (y) => y / WALL_TILE;

  for (let row = 0; row < terrain.d; row++) {
    for (let column = 0; column < terrain.w; column++) {
      const height = baseHeight(terrain, column, row);
      for (const side of SIDES) {
        const frame = edgeFrame(terrain, column, row, side);
        const neighborColumn = column + side.dx;
        const neighborRow = row + side.dz;

        if (!inside(terrain, neighborColumn, neighborRow)) {
          const builtUp = surfaceOf(terrain, column, row) === 'terrace' && height > 0;
          const soilTop = builtUp ? 0 : height;
          addWall(strata, frame, BOTTOM, soilTop, strataV);
          if (builtUp) {
            addWall(stone, frame, 0, height, stoneV);
          }
          continue;
        }

        const neighborHeight = baseHeight(terrain, neighborColumn, neighborRow);
        if (height > neighborHeight) {
          addWall(stone, frame, neighborHeight, height, stoneV);
        }
      }
    }
  }

  const look = (texture) => new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 });
  return [
    [strata, look(strataTexture(world))],
    [stone, look(stoneWallTexture(world))],
  ].map(([buffer, material]) => {
    const mesh = new THREE.Mesh(buffer.toGeometry(false), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  });
}

// ---------- 墙顶的边条 ----------

/**
 * 墙顶和方块边上的边条：人造的地方压水泥条（侧面最上面是石板的边），草地边上垂一圈草皮
 * @param {World} world
 * @param {Terrain} terrain
 * @returns {THREE.Mesh[]} 每种颜色一个网格
 */
function trimMeshes(world, terrain) {
  const byColor = new Map();
  const add = (color, geometry) => {
    if (!byColor.has(color)) {
      byColor.set(color, []);
    }
    byColor.get(color).push(geometry);
  };

  for (let row = 0; row < terrain.d; row++) {
    for (let column = 0; column < terrain.w; column++) {
      if (stairDirection(terrain, column, row)) {
        continue; // 台阶两边是墙，墙顶是台阶自己，不压边条
      }
      for (const side of SIDES) {
        const trim = trimFor(terrain, column, row, side);
        if (trim) {
          add(trim.color, trimGeometry(terrain, column, row, side, trim));
        }
      }
    }
  }

  return [...byColor].map(([color, geometries]) => world.kit.mesh(mergeGeometries(geometries), color));
}

/**
 * 这一格的这一边要压什么边条
 * @param {Terrain} terrain
 * @param {number} column
 * @param {number} row
 * @param {{ dx: number, dz: number }} side
 * @returns {object | null} COPING / GRASS_LIP / SLAB_EDGE，不用压就是 null
 */
function trimFor(terrain, column, row, side) {
  const kind = surfaceOf(terrain, column, row);
  const paved = PAVED.has(kind);
  const height = baseHeight(terrain, column, row);
  const neighborColumn = column + side.dx;
  const neighborRow = row + side.dz;

  if (!inside(terrain, neighborColumn, neighborRow)) {
    if (!paved) {
      return GRASS_LIP;
    }
    return height > 0 ? COPING : SLAB_EDGE;
  }

  const neighborHeight = baseHeight(terrain, neighborColumn, neighborRow);
  if (height <= neighborHeight) {
    return null;
  }
  // 台阶从这边爬上来：台阶顶上那一级接着地面，不能有一道坎
  const stair = stairDirection(terrain, neighborColumn, neighborRow);
  const climbsIn = stair && stair[0] === side.dx * -1 && stair[1] === side.dz * -1;
  if (climbsIn) {
    return null;
  }

  // 公园里土坡、高台的边是草皮；对着马路、人行道的挡土墙压水泥条
  const neighborIsPark = surfaceOf(terrain, neighborColumn, neighborRow) === 'park';
  if (!paved && neighborIsPark) {
    return GRASS_LIP;
  }
  return COPING;
}

/**
 * 一段边条的形状：沿着这条边，两头各多伸出一点盖住拐角
 * @param {Terrain} terrain
 * @param {number} column
 * @param {number} row
 * @param {{ dx: number, dz: number }} side
 * @param {{ height: number, depth: number, overhang: number, rise?: number }} trim 边条的尺寸
 * @returns {THREE.BufferGeometry}
 */
function trimGeometry(terrain, column, row, side, trim) {
  const height = baseHeight(terrain, column, row);
  const rise = trim.rise ?? 0;
  const length = 1 + trim.overhang * 2;
  const thickness = trim.depth + trim.overhang;
  const alongX = side.dx === 0;

  const geometry = new RoundedBoxGeometry(alongX ? length : thickness, trim.height, alongX ? thickness : length, 1, TRIM_ROUND);
  // 边条的外边伸出墙外 overhang，里边往格子里伸 depth
  const outward = 0.5 + trim.overhang - thickness / 2;
  const x = terrain.x0 + column + 0.5 + side.dx * outward;
  const z = terrain.z0 + row + 0.5 + side.dz * outward;
  geometry.translate(x, height + rise - trim.height / 2, z);
  return geometry;
}

// ---------- 台阶 ----------

/**
 * 所有台阶：每格一级级水泥台阶，两种深浅交替，棱是圆的
 * @param {World} world
 * @param {Terrain} terrain
 * @returns {THREE.Group}
 */
function stairMesh(world, terrain) {
  const byColor = STEP_COLORS.map(() => []);
  for (let row = 0; row < terrain.d; row++) {
    for (let column = 0; column < terrain.w; column++) {
      const direction = stairDirection(terrain, column, row);
      if (direction) {
        addSteps(byColor, terrain, column, row, direction);
      }
    }
  }

  const group = new THREE.Group();
  byColor.forEach((geometries, index) => {
    if (geometries.length > 0) {
      group.add(world.kit.mesh(mergeGeometries(geometries), STEP_COLORS[index]));
    }
  });
  return group;
}

/**
 * 一格台阶：STEP_COUNT 级，最高一级和上面那层地一样高
 * @param {THREE.BufferGeometry[][]} byColor 按颜色攒形状
 * @param {Terrain} terrain
 * @param {number} column
 * @param {number} row
 * @param {number[]} direction 往哪边爬 [dx, dz]
 */
function addSteps(byColor, terrain, column, row, [dx, dz]) {
  const base = baseHeight(terrain, column, row);
  const centerX = terrain.x0 + column + 0.5;
  const centerZ = terrain.z0 + row + 0.5;
  const tread = 1 / STEP_COUNT;

  for (let step = 0; step < STEP_COUNT; step++) {
    const top = base + ((step + 1) / STEP_COUNT) * terrain.level;
    const bottom = base - STEP_BURY;
    const height = top - bottom;
    const offset = -0.5 + tread * (step + 0.5);
    const across = 1;
    const width = dx ? tread : across;
    const depth = dz ? tread : across;

    const geometry = new RoundedBoxGeometry(width, height, depth, 2, STEP_ROUND);
    geometry.translate(centerX + dx * offset, bottom + height / 2, centerZ + dz * offset);
    byColor[step % STEP_COLORS.length].push(geometry);
  }
}

// ---------- 管子 ----------

/**
 * 方块侧面插着的几根管子：地底下有下水道、电缆，城市才像真的
 * @param {World} world
 * @param {Terrain} terrain
 * @returns {THREE.Group}
 */
function pipes(world, terrain) {
  const kit = world.kit;
  const group = new THREE.Group();

  for (const [sideName, along, y, radius, color] of PIPES) {
    const side = SIDES.find((candidate) => candidate.name === sideName);
    const pipe = new THREE.Group();
    const tube = kit.cyl(radius, radius, PIPE_LENGTH, color, 14);
    tube.rotation.x = Math.PI / 2;
    pipe.add(tube);
    const mouth = kit.cyl(radius * 0.72, radius * 0.72, 0.01, PIPE_INSIDE, 14);
    mouth.rotation.x = Math.PI / 2;
    mouth.position.z = PIPE_LENGTH / 2;
    pipe.add(mouth);

    // 管子沿着 +z 摆好，再转到朝外的方向；一半埋在墙里
    const facing = Math.atan2(side.dx, side.dz);
    const wallX = side.dx ? edgeOf(terrain.x0, terrain.w, side.dx) : along;
    const wallZ = side.dz ? edgeOf(terrain.z0, terrain.d, side.dz) : along;
    pipe.rotation.y = facing;
    pipe.position.set(wallX + side.dx * PIPE_LENGTH * 0.3, y, wallZ + side.dz * PIPE_LENGTH * 0.3);
    group.add(pipe);
  }
  return group;
}

/**
 * 方块某一边的坐标
 * @param {number} start 地图最小的那边（x0 或 z0）
 * @param {number} size 地图多宽 / 多深
 * @param {number} direction 1 是大的那边，-1 是小的那边
 * @returns {number}
 */
function edgeOf(start, size, direction) {
  if (direction > 0) {
    return start + size;
  }
  return start;
}
