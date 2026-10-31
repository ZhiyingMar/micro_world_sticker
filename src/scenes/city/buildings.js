// 夜都的楼：只负责造出来（摆在哪、挡不挡路、跟不跟电力走，由用它的地方决定）
//   外立面是一层层不一样的窗户（facade.js）；楼顶一圈矮墙，上面堆着空调外机、排气管、楼梯间、卫星锅；
//   一楼上面绕一圈挑檐；有的楼外墙挂着铁楼梯（消防梯）、窗户底下挂着空调
import * as THREE from 'three';
import { at, rng } from '../../kit.js';
import { windowFacade } from './facade.js';
import { waterTank } from './models.js';

// 窗户多密：一扇窗大约多宽、一层多高（世界单位），按楼的大小取整
const WINDOW_SPACING = 0.45;
const FLOOR_HEIGHT = 0.55;
// 楼顶：压顶比楼宽出多少、多厚；矮墙多高、多厚
const CORNICE_OVERHANG = 0.05;
const CORNICE_HEIGHT = 0.1;
const PARAPET_HEIGHT = 0.16;
const PARAPET_THICKNESS = 0.06;
// 楼顶的杂物摆在一格格的位置上：一格多大，离矮墙多远
const ROOF_SLOT = 0.5;
const ROOF_MARGIN = 0.14;
// 一楼上面的挑檐：伸出多少、多厚
const LEDGE_OVERHANG = 0.04;
const LEDGE_HEIGHT = 0.05;
// 消防梯：铁的颜色，平台多深、多厚，栏杆多高，从第几层开始（太低会挡人头），最底下的梯子挂到多高
const IRON = '#3a3446';
const ESCAPE_DEPTH = 0.28;
const ESCAPE_SLAB = 0.03;
const ESCAPE_RAIL = 0.2;
const ESCAPE_FROM_FLOOR = 2;
const ESCAPE_LADDER_BOTTOM = 0.95;
// 窗下空调：多少窗户挂一台，多大
const WINDOW_UNIT_CHANCE = 0.16;
const WINDOW_UNIT_SIZE = [0.17, 0.11, 0.12];

/**
 * 一栋有窗户的楼
 * @param {World} world 用来登记贴图（离开世界时释放）
 * @param {object} spec
 * @param {number[]} spec.size [宽, 高, 深]
 * @param {object} spec.look 外立面：wall 墙、frame 窗框、dark 暗玻璃、lit 灯色、ratio 亮灯比例、seed 种子、pattern 砖 / 水泥板
 * @param {string} spec.roof 楼顶、压顶、矮墙的颜色
 * @param {string} [spec.groundFloor] 正面最底下一层：windows / lobby / door / shutter
 * @param {boolean} [spec.ledge] 一楼上面绕一圈挑檐；正面整面要空着的楼（玩俄罗斯方块的大楼）不加
 * @param {string[]} [spec.rooftop] 楼顶摆哪些杂物：ac 空调外机、vent 排气管、hut 楼梯间、dish 卫星锅、antenna 天线、tank 水塔
 * @param {number[][]} [spec.keepClear] 楼顶这些地方 [x, z, 半径]（楼自己的坐标）别摆杂物，留给别的东西
 * @returns {{ group: THREE.Group, body: THREE.Mesh, windows: object[], grid: object }}
 *   body 是楼身（登记碰撞、点击用）；windows 是正面、侧面两面墙的亮灯 / 停电两套贴图；grid 是正面窗户的格子（往墙上挂东西用）
 */
export function building(world, { size: [width, height, depth], look, roof, groundFloor = 'windows', ledge = true, rooftop = [], keepClear = [] }) {
  const kit = world.kit;
  const rows = Math.max(2, Math.round(height / FLOOR_HEIGHT));
  const columnsOf = (length) => Math.max(2, Math.round(length / WINDOW_SPACING));
  const faces = (ratio) => {
    const front = windowFacade(columnsOf(width), rows, { ...look, ratio, groundFloor });
    const side = windowFacade(columnsOf(depth), rows, { ...look, ratio, seed: look.seed + 7 });
    [front.map, front.emissive, side.map, side.emissive].forEach((texture) => world.texture(texture));
    return { front, side };
  };
  const on = faces(look.ratio);
  // 停电时：一扇亮着的窗户都没有
  const off = faces(0);

  const lit = (face) => new THREE.MeshStandardMaterial({ map: face.map, emissiveMap: face.emissive, emissive: '#ffffff', emissiveIntensity: 1, roughness: 0.85 });
  const frontMaterial = lit(on.front);
  const sideMaterial = lit(on.side);
  const roofMaterial = new THREE.MeshStandardMaterial({ color: roof, roughness: 0.9 });

  const group = new THREE.Group();
  const body = kit.mesh(new THREE.BoxGeometry(width, height, depth), frontMaterial);
  body.material = [sideMaterial, sideMaterial, roofMaterial, roofMaterial, frontMaterial, frontMaterial];
  group.add(at(body, 0, height / 2, 0));

  addRoofEdge(kit, group, width, depth, height, roof);
  addRooftop(kit, group, { width, depth, top: height, kinds: rooftop, keepClear, seed: look.seed, wall: look.wall });
  if (ledge) {
    group.add(at(kit.box(width + LEDGE_OVERHANG * 2, LEDGE_HEIGHT, depth + LEDGE_OVERHANG * 2, roof, 0.015), 0, height / rows, 0));
  }

  const windows = [
    { mat: frontMaterial, on: on.front, off: off.front },
    { mat: sideMaterial, on: on.side, off: off.side },
  ];
  const grid = { columns: columnsOf(width), sideColumns: columnsOf(depth), rows, floorHeight: height / rows, width, depth, height };
  return { group, body, windows, grid };
}

/**
 * 楼顶的边：一圈压顶，上面一圈矮墙
 * @param {Kit} kit
 * @param {THREE.Group} group 加到这栋楼里
 * @param {number} width
 * @param {number} depth
 * @param {number} top 楼顶多高
 * @param {string} color
 */
function addRoofEdge(kit, group, width, depth, top, color) {
  group.add(at(kit.box(width + CORNICE_OVERHANG * 2, CORNICE_HEIGHT, depth + CORNICE_OVERHANG * 2, color, 0.02), 0, top, 0));

  const wallY = top + CORNICE_HEIGHT / 2 + PARAPET_HEIGHT / 2;
  const halfWidth = width / 2 - PARAPET_THICKNESS / 2;
  const halfDepth = depth / 2 - PARAPET_THICKNESS / 2;
  for (const side of [-1, 1]) {
    group.add(at(kit.box(width, PARAPET_HEIGHT, PARAPET_THICKNESS, color, 0.01), 0, wallY, side * halfDepth));
    group.add(at(kit.box(PARAPET_THICKNESS, PARAPET_HEIGHT, depth, color, 0.01), side * halfWidth, wallY, 0));
  }
}

/**
 * 楼顶的杂物：在一格格的位置里随机挑几格摆上
 * @description 楼顶是从远处看全貌时天际线的样子，光秃秃的方盒子一眼就是练手作品
 * @param {Kit} kit
 * @param {THREE.Group} group
 * @param {object} roof
 * @param {number} roof.width
 * @param {number} roof.depth
 * @param {number} roof.top 楼顶多高
 * @param {string[]} roof.kinds 要摆的杂物，一样一格
 * @param {number[][]} roof.keepClear 别摆的地方 [x, z, 半径]
 * @param {number} roof.seed
 * @param {string} roof.wall 楼梯间的墙色
 */
function addRooftop(kit, group, { width, depth, top, kinds, keepClear, seed, wall }) {
  const random = rng(seed + 31);
  const slots = roofSlots(width, depth, keepClear);
  shuffle(slots, random);

  const floor = top + CORNICE_HEIGHT / 2;
  kinds.forEach((kind, index) => {
    const slot = slots[index];
    if (!slot) {
      return; // 楼顶摆不下这么多，少摆几样
    }
    const prop = ROOF_PROPS[kind](kit, wall);
    group.add(at(prop, slot[0], floor, slot[1], Math.floor(random() * 4) * (Math.PI / 2)));
  });
}

/**
 * 楼顶能摆东西的格子
 * @param {number} width
 * @param {number} depth
 * @param {number[][]} keepClear 别摆的地方 [x, z, 半径]
 * @returns {number[][]} 每格中心 [x, z]（楼自己的坐标）
 */
function roofSlots(width, depth, keepClear) {
  const usableWidth = width - ROOF_MARGIN * 2;
  const usableDepth = depth - ROOF_MARGIN * 2;
  const across = Math.max(1, Math.floor(usableWidth / ROOF_SLOT));
  const deep = Math.max(1, Math.floor(usableDepth / ROOF_SLOT));

  const slots = [];
  for (let i = 0; i < across; i++) {
    for (let j = 0; j < deep; j++) {
      const x = -usableWidth / 2 + (i + 0.5) * (usableWidth / across);
      const z = -usableDepth / 2 + (j + 0.5) * (usableDepth / deep);
      const blocked = keepClear.some(([clearX, clearZ, radius]) => Math.hypot(x - clearX, z - clearZ) < radius);
      if (!blocked) {
        slots.push([x, z]);
      }
    }
  }
  return slots;
}

/**
 * 原地打乱
 * @param {any[]} list
 * @param {() => number} random
 */
function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}

// 楼顶杂物：每样都是 (kit, 楼的墙色) => Group，原点在底面中间，小到能塞进窄楼顶
const ROOF_PROPS = {
  ac: roofAirCon,
  vent: roofVent,
  hut: stairHut,
  dish: satelliteDish,
  antenna: antennaMast,
  tank: (kit) => {
    const tank = waterTank(kit);
    tank.scale.setScalar(0.6);
    return tank;
  },
};

/**
 * 楼顶的空调外机：方盒子，顶上一个风扇
 * @param {Kit} kit
 * @returns {THREE.Group}
 */
function roofAirCon(kit) {
  const group = new THREE.Group();
  group.add(at(kit.box(0.34, 0.22, 0.26, '#c3c6d2', 0.02), 0, 0.11, 0));
  group.add(at(kit.cyl(0.09, 0.09, 0.02, '#5a5f70', 14), 0.04, 0.23, 0));
  group.add(at(kit.box(0.08, 0.04, 0.2, '#8d91a0', 0.01), -0.12, 0.24, 0));
  return group;
}

/**
 * 排气管：两根细管子，顶上戴个帽子
 * @param {Kit} kit
 * @returns {THREE.Group}
 */
function roofVent(kit) {
  const group = new THREE.Group();
  for (const [x, height] of [[-0.06, 0.32], [0.07, 0.22]]) {
    group.add(at(kit.cyl(0.035, 0.035, height, '#8d91a0', 10), x, height / 2, 0));
    group.add(at(kit.cone(0.06, 0.05, '#6f7382', 10), x, height + 0.02, 0));
  }
  return group;
}

/**
 * 楼梯间：楼顶上的小屋子，一扇门，门上一盏小灯
 * @param {Kit} kit
 * @param {string} wall 墙色，跟楼一样
 * @returns {THREE.Group}
 */
function stairHut(kit, wall) {
  const group = new THREE.Group();
  group.add(at(kit.box(0.42, 0.4, 0.36, wall, 0.02), 0, 0.2, 0));
  group.add(at(kit.box(0.48, 0.05, 0.42, '#3e4256', 0.015), 0, 0.42, 0));
  group.add(at(kit.box(0.16, 0.28, 0.02, '#2a2c38', 0.005), 0, 0.14, 0.185));
  group.add(at(kit.box(0.05, 0.03, 0.03, '#fff3d0', 0.005, { emissive: '#ffd98a', emissiveIntensity: 1.2 }), 0, 0.33, 0.19));
  return group;
}

/**
 * 卫星锅：一根小杆子，锅面斜着朝天
 * @param {Kit} kit
 * @returns {THREE.Group}
 */
function satelliteDish(kit) {
  const group = new THREE.Group();
  group.add(at(kit.cyl(0.015, 0.02, 0.16, '#8d91a0', 6), 0, 0.08, 0));
  const dish = kit.dome(0.12, '#e3e4ec', Math.PI / 2.6, 16);
  dish.rotation.x = -2.2;
  group.add(at(dish, 0, 0.2, 0.02));
  return group;
}

/**
 * 天线：一根高杆，几根横杆
 * @param {Kit} kit
 * @returns {THREE.Group}
 */
function antennaMast(kit) {
  const group = new THREE.Group();
  group.add(at(kit.cyl(0.012, 0.015, 0.7, '#9a9db0', 6), 0, 0.35, 0));
  for (const [y, length] of [[0.5, 0.26], [0.6, 0.18], [0.68, 0.1]]) {
    const bar = kit.cyl(0.006, 0.006, length, '#9a9db0', 4);
    bar.rotation.z = Math.PI / 2;
    group.add(at(bar, 0, y, 0));
  }
  return group;
}

/**
 * 消防梯：外墙上一层层的铁平台，平台之间斜着一段楼梯，最下面一节梯子挂着
 * @description 平台从第 ESCAPE_FROM_FLOOR 层开始，比人高，人从底下走过去不会撞到
 * @param {Kit} kit
 * @param {{ floorHeight: number, rows: number }} grid 楼的窗户格子
 * @param {number} span 平台多宽
 * @returns {THREE.Group} 原点在墙脚、平台中间；墙面在 z = 0，平台往 +z 伸出去
 */
export function fireEscape(kit, { floorHeight, rows }, span) {
  const group = new THREE.Group();
  const floors = [];
  for (let floor = ESCAPE_FROM_FLOOR; floor < rows; floor++) {
    floors.push(floor * floorHeight);
  }

  floors.forEach((y, index) => {
    group.add(at(kit.box(span, ESCAPE_SLAB, ESCAPE_DEPTH, IRON, 0.005), 0, y, ESCAPE_DEPTH / 2));
    group.add(at(kit.box(span, 0.015, 0.015, IRON, 0), 0, y + ESCAPE_RAIL, ESCAPE_DEPTH - 0.01));
    for (const side of [-1, 1]) {
      group.add(at(kit.box(0.015, ESCAPE_RAIL, 0.015, IRON, 0), (side * span) / 2, y + ESCAPE_RAIL / 2, ESCAPE_DEPTH - 0.01));
      group.add(at(kit.box(0.015, 0.015, ESCAPE_DEPTH, IRON, 0), (side * span) / 2, y + ESCAPE_RAIL, ESCAPE_DEPTH / 2));
    }

    const above = floors[index + 1];
    if (above !== undefined) {
      group.add(escapeFlight(kit, span, y, above, index % 2 === 0 ? 1 : -1));
    }
  });

  const lowest = floors[0];
  const ladderHeight = lowest - ESCAPE_LADDER_BOTTOM;
  for (const side of [-1, 1]) {
    group.add(at(kit.box(0.012, ladderHeight, 0.012, IRON, 0), span / 2 - 0.06 + side * 0.06, ESCAPE_LADDER_BOTTOM + ladderHeight / 2, ESCAPE_DEPTH - 0.04));
  }
  return group;
}

/**
 * 两层平台之间斜着的一段楼梯
 * @param {Kit} kit
 * @param {number} span 平台多宽
 * @param {number} from 下面那层平台多高
 * @param {number} to 上面那层平台多高
 * @param {number} lean 往哪边斜（1 往 +x 爬，-1 往 -x 爬）
 * @returns {THREE.Mesh}
 */
function escapeFlight(kit, span, from, to, lean) {
  const run = span * 0.7;
  const rise = to - from;
  const length = Math.hypot(run, rise);
  const flight = kit.box(length, 0.03, ESCAPE_DEPTH * 0.45, IRON, 0.005);
  flight.rotation.z = Math.atan2(rise, run) * lean;
  return at(flight, 0, from + rise / 2, ESCAPE_DEPTH * 0.3);
}

/**
 * 正面窗户底下挂的空调：每扇窗有一点点机会挂一台，一楼和挂着消防梯的地方不挂
 * @param {Kit} kit
 * @param {object} grid building() 返回的 grid
 * @param {number} seed
 * @param {(column: number) => boolean} [skipColumn] 这一列不挂（消防梯挂在这儿）
 * @returns {THREE.Group} 楼自己的坐标，墙面在 z = 深度的一半
 */
export function windowUnits(kit, grid, seed, skipColumn = () => false) {
  const random = rng(seed + 53);
  const group = new THREE.Group();
  const [unitWidth, unitHeight, unitDepth] = WINDOW_UNIT_SIZE;
  const columnWidth = grid.width / grid.columns;

  for (let row = 0; row < grid.rows - 1; row++) {
    for (let column = 0; column < grid.columns; column++) {
      const hang = random() < WINDOW_UNIT_CHANCE && !skipColumn(column);
      if (!hang) {
        continue;
      }
      const x = -grid.width / 2 + (column + 0.5) * columnWidth;
      // 第 row 层（从上往下数）窗户的下沿
      const y = grid.height - (row + 0.78) * grid.floorHeight;
      const unit = kit.box(unitWidth, unitHeight, unitDepth, '#d2d4dc', 0.015);
      group.add(at(unit, x, y - unitHeight / 2, grid.depth / 2 + unitDepth / 2));
    }
  }
  return group;
}

/**
 * 背景高楼：只有朝街这一面，进不去；楼顶有天线、水塔，正面挂着消防梯和窗下空调，一楼是卷帘门
 * @param {World} world
 * @param {{ width: number, height: number, depth: number, seed: number, wall?: string, keepClear?: number[][] }} spec
 *   宽、高、进深、窗户的随机种子、墙色；keepClear 是楼顶留给广告牌的地方 [x, z, 半径]
 * @returns {{ group: THREE.Group, body: THREE.Mesh, windows: object[] }}
 */
export function backdropBuilding(world, { width, height, depth, seed, wall = '#3f4766', keepClear = [] }) {
  const kit = world.kit;
  const look = { wall, frame: '#2c3350', dark: '#1d2238', lit: '#ffdca0', ratio: 0.45, seed, pattern: seed % 2 ? 'brick' : 'panel' };
  const result = building(world, { size: [width, height, depth], look, roof: '#2c3350', groundFloor: 'shutter', rooftop: ['tank', 'antenna', 'ac', 'vent'], keepClear });

  // 消防梯挂在正面靠左那两列窗户上
  const columnWidth = width / result.grid.columns;
  const escapeColumns = [1, 2];
  const escape = fireEscape(kit, result.grid, columnWidth * escapeColumns.length);
  escape.position.set(-width / 2 + columnWidth * 2, 0, depth / 2);
  result.group.add(escape);
  result.group.add(windowUnits(kit, result.grid, seed, (column) => escapeColumns.includes(column)));
  return result;
}
