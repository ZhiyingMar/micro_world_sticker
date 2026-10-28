// 像素小镇的模型（只造不摆）：房子、风车、干草堆、喷泉、路灯、长椅、木箱、栅栏、稻草人、菜、小鸡、像素块……
// 每个函数拿 kit 和几个选项，返回一个 THREE.Group，原点在底面中心、正面朝 +z；摆在哪、登记碰撞在调用的地方做
// 大件用几块方块搭（颜色分暗、本色、亮几档，像素画靠颜色分出体积），小石头、云这种疙疙瘩瘩的用体素（src/voxel.js）
import * as THREE from 'three';
import { at, rng } from '../../kit.js';
import { VoxelShape, shadesOf } from '../../voxel.js';

// ---------- 房子 ----------
// 石头地基多高、比墙宽出多少；墙角柱多粗；墙顶横梁多高
const FOUNDATION_HEIGHT = 0.16;
const FOUNDATION_LIP = 0.06;
const CORNER_POST = 0.12;
const TOP_BEAM = 0.1;
// 屋顶：一层层往上收，几层、每层多高；屋檐往两边、前后各伸出多少；山墙两边露出多宽的屋顶边
const ROOF_STEPS = 5;
const ROOF_STEP_HEIGHT = 0.24;
const EAVE_SIDE = 0.18;
const EAVE_FRONT = 0.16;
const ROOF_RIM = 0.15;
// 门：多宽多高，门框多宽；门前石阶多大
const DOOR_WIDTH = 0.46;
const DOOR_HEIGHT = 0.8;
const DOOR_FRAME = 0.06;
const DOORSTEP = [0.8, 0.08, 0.32];
// 窗：多大，离门多远（占墙宽的比例），多高（占墙高的比例）；窗下的花箱
const WINDOW_SIZE = 0.42;
const WINDOW_SPREAD = 0.3;
const WINDOW_HEIGHT = 0.56;
const SHUTTER_WIDTH = 0.12;
const FLOWER_BOX = [0.5, 0.1, 0.14];
const WINDOW_FLOWERS = ['#ff6b8b', '#ffd84a', '#ffffff', '#ff9a4d'];
// 烟囱：多粗，冒出屋顶多高，在屋顶哪儿（占宽、深的比例）
const CHIMNEY_SIZE = 0.3;
const CHIMNEY_ABOVE = 0.45;
const CHIMNEY_SPOT = [0.24, -0.2];
const STONE = '#9c978c';
const BRICK = '#b5654a';
const GLASS = '#a8dcff';

/**
 * 一座方块小房子：石头地基、墙角柱、一层层收上去的屋顶，门、带百叶窗和花箱的窗户、烟囱
 * @description 两座房子用同一个造法，但宽窄、颜色、阁楼窗、旁边的小棚子都不一样，看着不是复制的
 * @param {Kit} kit
 * @param {object} spec 样子
 * @param {number} spec.width 墙宽（x）
 * @param {number} spec.depth 墙深（z）
 * @param {number} spec.height 墙高
 * @param {string} spec.wall 墙的颜色
 * @param {string} spec.roof 屋顶的颜色
 * @param {string} spec.trim 木头柱子、门框的颜色
 * @param {string} spec.shutters 百叶窗的颜色
 * @param {boolean} [spec.attic] 山墙上开一扇小阁楼窗
 * @param {boolean} [spec.shed] 右边搭一个小木棚
 * @returns {{ group: THREE.Group, chimneyTop: THREE.Vector3, roofTop: number }} 烟囱口在哪（相对房子原点），屋顶最高多高
 */
export function house(kit, spec) {
  const group = new THREE.Group();
  const { width, depth, height, wall, trim } = spec;
  const wallTop = FOUNDATION_HEIGHT + height;

  group.add(at(kit.box(width + FOUNDATION_LIP * 2, FOUNDATION_HEIGHT, depth + FOUNDATION_LIP * 2, STONE), 0, FOUNDATION_HEIGHT / 2, 0));
  group.add(at(kit.box(width, height, depth, wall), 0, FOUNDATION_HEIGHT + height / 2, 0));
  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      const post = kit.box(CORNER_POST, height, CORNER_POST, trim);
      group.add(at(post, sideX * (width / 2 - CORNER_POST / 3), FOUNDATION_HEIGHT + height / 2, sideZ * (depth / 2 - CORNER_POST / 3)));
    }
  }
  group.add(at(kit.box(width + 0.04, TOP_BEAM, depth + 0.04, trim), 0, wallTop - TOP_BEAM / 2, 0));

  const roofTop = addRoof(kit, group, spec, wallTop);
  addFront(kit, group, spec);
  const chimneyTop = addChimney(kit, group, spec, wallTop);
  if (spec.shed) {
    group.add(at(shed(kit, spec), width / 2 + 0.36, 0, -depth * 0.12));
  }
  return { group, chimneyTop, roofTop };
}

/**
 * 屋顶：一层层往上收的方块，左右两边各露出一道屋顶边，前后山墙是墙的颜色
 * @param {Kit} kit
 * @param {THREE.Group} group 房子
 * @param {object} spec 房子的样子
 * @param {number} wallTop 墙顶多高
 * @returns {number} 屋顶最高多高
 */
function addRoof(kit, group, spec, wallTop) {
  const [dark, base, light] = shadesOf(spec.roof);
  const gable = shadesOf(spec.wall)[0];
  const roofDepth = spec.depth + EAVE_FRONT * 2;
  const bottomWidth = spec.width + EAVE_SIDE * 2;

  for (let step = 0; step < ROOF_STEPS; step++) {
    const stepWidth = bottomWidth * (1 - step / ROOF_STEPS);
    const y = wallTop + ROOF_STEP_HEIGHT * (step + 0.5);
    // 一层亮一层暗，一眼看出是一层层瓦
    const color = step % 2 ? light : base;
    group.add(at(kit.box(stepWidth, ROOF_STEP_HEIGHT, roofDepth, color), 0, y, 0));

    // 山墙：每层中间盖一块墙色的板，两边只露出屋顶边；在屋檐底下，比墙暗一档
    const gableWidth = stepWidth - ROOF_RIM * 2;
    if (gableWidth > 0) {
      for (const side of [-1, 1]) {
        group.add(at(kit.box(gableWidth, ROOF_STEP_HEIGHT, 0.02, gable), 0, y, side * (roofDepth / 2 + 0.01)));
      }
    }
  }
  const roofTop = wallTop + ROOF_STEP_HEIGHT * ROOF_STEPS;
  group.add(at(kit.box(bottomWidth / ROOF_STEPS + 0.08, 0.08, roofDepth + 0.04, dark), 0, roofTop + 0.04, 0));

  if (spec.attic) {
    const atticY = wallTop + ROOF_STEP_HEIGHT * 1.5;
    group.add(at(kit.box(0.34, 0.34, 0.03, spec.trim), 0, atticY, roofDepth / 2 + 0.03));
    group.add(at(kit.box(0.24, 0.24, 0.04, GLASS, { emissive: '#ffe9a8', emissiveIntensity: 0.25 }), 0, atticY, roofDepth / 2 + 0.035));
  }
  return roofTop + 0.08;
}

/**
 * 正面：门、门前石阶、门两边的窗户；右边侧墙、后墙上再各开一扇
 * @param {Kit} kit
 * @param {THREE.Group} group 房子
 * @param {object} spec 房子的样子
 */
function addFront(kit, group, spec) {
  const front = spec.depth / 2;
  const doorY = FOUNDATION_HEIGHT + DOOR_HEIGHT / 2;
  group.add(at(kit.box(DOOR_WIDTH + DOOR_FRAME * 2, DOOR_HEIGHT + DOOR_FRAME, 0.05, spec.trim), 0, doorY + DOOR_FRAME / 2, front + 0.01));
  group.add(at(kit.box(DOOR_WIDTH, DOOR_HEIGHT, 0.06, shadesOf(spec.trim)[2]), 0, doorY, front + 0.02));
  group.add(at(kit.box(0.06, 0.06, 0.04, '#ffd84a'), DOOR_WIDTH * 0.3, doorY, front + 0.06));
  group.add(at(kit.box(...DOORSTEP, STONE), 0, DOORSTEP[1] / 2, front + DOORSTEP[2] / 2 + FOUNDATION_LIP));

  const windowY = FOUNDATION_HEIGHT + spec.height * WINDOW_HEIGHT;
  const random = rng(Math.round(spec.width * 100));
  for (const side of [-1, 1]) {
    const windowGroup = windowWithBox(kit, spec, random);
    group.add(at(windowGroup, side * spec.width * WINDOW_SPREAD, windowY, front));
  }
  // 右边侧墙（镜头看得到的那面）也开一扇；搭了小棚子的那面被棚子挡着，不开
  if (!spec.shed) {
    const sideWindow = windowWithBox(kit, spec, random);
    sideWindow.rotation.y = Math.PI / 2;
    group.add(at(sideWindow, spec.width / 2, windowY, spec.depth * 0.1));
  }
  // 后墙一扇：转镜头绕到屋后（蓝屋子后院有木箱）时不是一面白墙
  const backWindow = windowWithBox(kit, spec, random);
  backWindow.rotation.y = Math.PI;
  group.add(at(backWindow, -spec.width * WINDOW_SPREAD, windowY, -front));
}

/**
 * 一扇窗：白窗框、十字窗棂、两扇百叶窗，窗下一个种着小花的花箱
 * @param {Kit} kit
 * @param {object} spec 房子的样子（用百叶窗、木头的颜色）
 * @param {Function} random 花的颜色怎么挑
 * @returns {THREE.Group} 原点在窗户中心、贴着墙面，朝 +z
 */
function windowWithBox(kit, spec, random) {
  const group = new THREE.Group();
  const half = WINDOW_SIZE / 2;
  group.add(at(kit.box(WINDOW_SIZE, WINDOW_SIZE, 0.04, '#ffffff'), 0, 0, 0.01));
  group.add(at(kit.box(WINDOW_SIZE - 0.1, WINDOW_SIZE - 0.1, 0.05, GLASS, { emissive: '#ffe9a8', emissiveIntensity: 0.2 }), 0, 0, 0.015));
  group.add(at(kit.box(0.03, WINDOW_SIZE - 0.1, 0.06, '#ffffff'), 0, 0, 0.02));
  group.add(at(kit.box(WINDOW_SIZE - 0.1, 0.03, 0.06, '#ffffff'), 0, 0, 0.02));
  for (const side of [-1, 1]) {
    group.add(at(kit.box(SHUTTER_WIDTH, WINDOW_SIZE, 0.03, spec.shutters), side * (half + SHUTTER_WIDTH / 2), 0, 0.015));
  }

  const boxY = -half - FLOWER_BOX[1] / 2;
  group.add(at(kit.box(...FLOWER_BOX, spec.trim), 0, boxY, FLOWER_BOX[2] / 2));
  const blooms = 4;
  for (let i = 0; i < blooms; i++) {
    const color = WINDOW_FLOWERS[Math.floor(random() * WINDOW_FLOWERS.length)];
    const x = -FLOWER_BOX[0] / 2 + (FLOWER_BOX[0] / blooms) * (i + 0.5);
    group.add(at(kit.box(0.07, 0.07, 0.07, color), x, boxY + FLOWER_BOX[1] / 2 + 0.05, FLOWER_BOX[2] / 2));
    group.add(at(kit.box(0.04, 0.05, 0.04, '#4fae4a'), x + 0.04, boxY + FLOWER_BOX[1] / 2 + 0.02, FLOWER_BOX[2] / 2 - 0.03));
  }
  return group;
}

/**
 * 烟囱：从屋顶后半边冒出来的一根砖柱子，顶上一圈深色的帽
 * @param {Kit} kit
 * @param {THREE.Group} group 房子
 * @param {object} spec 房子的样子
 * @param {number} wallTop 墙顶多高
 * @returns {THREE.Vector3} 烟囱口在哪
 */
function addChimney(kit, group, spec, wallTop) {
  const x = spec.width * CHIMNEY_SPOT[0];
  const z = spec.depth * CHIMNEY_SPOT[1];
  // 烟囱从墙顶立起来，冒出它所在那里的屋顶一截
  const roofHere = ROOF_STEP_HEIGHT * ROOF_STEPS * (1 - Math.abs(x) / (spec.width / 2 + EAVE_SIDE));
  const height = roofHere + CHIMNEY_ABOVE;
  group.add(at(kit.box(CHIMNEY_SIZE, height, CHIMNEY_SIZE, BRICK), x, wallTop + height / 2, z));
  group.add(at(kit.box(CHIMNEY_SIZE + 0.08, 0.08, CHIMNEY_SIZE + 0.08, '#5a4a44'), x, wallTop + height, z));
  return new THREE.Vector3(x, wallTop + height + 0.05, z);
}

/**
 * 墙边的小木棚：木板墙、斜斜的两级顶、一扇小门，门口靠着一把耙子
 * @param {Kit} kit
 * @param {object} spec 房子的样子（用屋顶、木头的颜色）
 * @returns {THREE.Group} 原点在棚子底面中心
 */
function shed(kit, spec) {
  const group = new THREE.Group();
  const [wood, , woodLight] = shadesOf('#b98a5a');
  group.add(at(kit.box(0.62, 0.7, 1.1, wood), 0, 0.35, 0));
  group.add(at(kit.box(0.78, 0.1, 1.24, spec.roof), -0.06, 0.75, 0));
  group.add(at(kit.box(0.5, 0.1, 1.24, shadesOf(spec.roof)[2]), -0.14, 0.85, 0));
  group.add(at(kit.box(0.03, 0.5, 0.36, woodLight), 0.31, 0.27, 0.15));
  // 耙子：一根长柄，头上一排齿
  const rake = new THREE.Group();
  rake.add(at(kit.box(0.03, 0.7, 0.03, '#8b5a2b'), 0, 0.35, 0));
  rake.add(at(kit.box(0.2, 0.04, 0.04, '#8a8a95'), 0, 0.7, 0));
  rake.rotation.z = -0.25;
  group.add(at(rake, 0.4, 0, -0.35));
  return group;
}

// ---------- 风车 ----------
// 塔身：一段段往上收，每段 [宽, 高]；段和段之间一道木箍
const TOWER_SEGMENTS = [
  [1.1, 0.5],
  [1.0, 0.5],
  [0.9, 0.5],
  [0.8, 0.45],
];
const TOWER_COLORS = ['#f3ead6', '#e8dcc3'];
const TOWER_BAND = 0.06;
// 塔顶的尖帽：几层、每层多高；风叶多长、帆多宽；风叶的轴在塔顶往前伸多远
const CAP_STEPS = 4;
const CAP_STEP_HEIGHT = 0.16;
const BLADE_LENGTH = 1.05;
const SAIL_WIDTH = 0.28;
const HUB_OUT = 0.12;

/**
 * 风车：石头底座，白色的塔身一段段往上收，红色尖帽，正面一扇门，四片带格子帆的风叶
 * @param {Kit} kit
 * @returns {{ group: THREE.Group, blades: THREE.Group, top: number }} blades 绕自己的 z 轴转；top 是风叶转起来最高到哪
 */
export function windmill(kit) {
  const group = new THREE.Group();
  group.add(at(kit.box(1.3, 0.2, 1.3, STONE), 0, 0.1, 0));

  let y = 0.2;
  TOWER_SEGMENTS.forEach(([width, height], index) => {
    group.add(at(kit.box(width, height, width, TOWER_COLORS[index % 2]), 0, y + height / 2, 0));
    group.add(at(kit.box(width + 0.04, TOWER_BAND, width + 0.04, '#8b5a2b'), 0, y + height, 0));
    y += height;
  });
  const towerTop = y;
  const topWidth = TOWER_SEGMENTS[TOWER_SEGMENTS.length - 1][0];

  const [roofDark, roof] = shadesOf('#c0583e');
  for (let step = 0; step < CAP_STEPS; step++) {
    const width = (topWidth + 0.2) * (1 - step / CAP_STEPS);
    group.add(at(kit.box(width, CAP_STEP_HEIGHT, width, step % 2 ? roofDark : roof), 0, towerTop + CAP_STEP_HEIGHT * (step + 0.5), 0));
  }

  const front = TOWER_SEGMENTS[0][0] / 2;
  group.add(at(kit.box(0.42, 0.62, 0.04, '#8b5a2b'), 0, 0.2 + 0.31, front + 0.01));
  group.add(at(kit.box(0.32, 0.54, 0.05, '#6e4520'), 0, 0.2 + 0.27, front + 0.02));
  const windowFront = TOWER_SEGMENTS[2][0] / 2;
  group.add(at(kit.box(0.2, 0.22, 0.05, GLASS, { emissive: '#ffe9a8', emissiveIntensity: 0.2 }), 0, 1.45, windowFront + 0.01));

  const hubY = towerTop - 0.15;
  group.add(at(kit.box(0.14, 0.14, HUB_OUT + topWidth / 2, '#5a3d2b'), 0, hubY, (HUB_OUT + topWidth / 2) / 2));
  const blades = windmillBlades(kit);
  group.add(at(blades, 0, hubY, topWidth / 2 + HUB_OUT + 0.04));
  return { group, blades, top: hubY + BLADE_LENGTH };
}

/**
 * 四片风叶：木头的叶杆，一边挂着白帆，帆上几道木格子
 * @param {Kit} kit
 * @returns {THREE.Group} 绕 z 轴转
 */
function windmillBlades(kit) {
  const blades = new THREE.Group();
  blades.add(kit.box(0.2, 0.2, 0.08, '#5a3d2b'));
  const arms = 4;
  const lattices = 3;
  for (let i = 0; i < arms; i++) {
    const arm = new THREE.Group();
    arm.add(at(kit.box(0.06, BLADE_LENGTH, 0.05, '#7a4b2a'), 0, BLADE_LENGTH / 2, 0));
    arm.add(at(kit.box(SAIL_WIDTH, BLADE_LENGTH * 0.72, 0.025, '#f8f2e4'), SAIL_WIDTH / 2 + 0.03, BLADE_LENGTH * 0.6, 0));
    for (let j = 0; j < lattices; j++) {
      const latticeY = BLADE_LENGTH * (0.32 + (j + 0.5) * (0.72 / lattices));
      arm.add(at(kit.box(SAIL_WIDTH, 0.025, 0.035, '#a8784a'), SAIL_WIDTH / 2 + 0.03, latticeY, 0));
    }
    arm.rotation.z = (i / arms) * Math.PI * 2;
    blades.add(arm);
  }
  return blades;
}

// ---------- 喷泉 ----------
// 下面的大池子：多大、池壁多厚多高；中间的柱子、上面的小池子；水面比池壁顶低多少
const BASIN_SIZE = 1.5;
const BASIN_WALL = 0.16;
const BASIN_HEIGHT = 0.36;
const PILLAR_SIZE = 0.28;
const PILLAR_HEIGHT = 0.62;
const UPPER_BASIN = 0.66;
const WATER_BELOW_RIM = 0.08;
const BASIN_STONE = ['#b9b6c4', '#cfccd8'];

/**
 * 喷泉：方方的大池子四角立着小石墩，中间一根石柱托着小池子，两层水面都是会流的像素水
 * @param {Kit} kit
 * @param {(width: number, depth: number) => THREE.Mesh} waterPatch 做一块和地上的水一样的水面
 * @returns {{ group: THREE.Group, lowerWater: number, upperWater: number, spout: number, radius: number }} 两层水面多高、喷水口多高、池子多大（一半）
 */
export function fountain(kit, waterPatch) {
  const group = new THREE.Group();
  const [stone, stoneLight] = BASIN_STONE;
  const half = BASIN_SIZE / 2;

  group.add(at(kit.box(BASIN_SIZE, 0.06, BASIN_SIZE, stone), 0, 0.03, 0));
  for (let i = 0; i < 4; i++) {
    const wall = kit.box(BASIN_SIZE - BASIN_WALL, BASIN_HEIGHT, BASIN_WALL, i % 2 ? stone : stoneLight);
    const angle = (i / 4) * Math.PI * 2;
    // 四面墙绕一圈错开半格，拐角各被一面墙盖住，不重叠
    wall.position.set(Math.sin(angle) * (half - BASIN_WALL / 2) + Math.cos(angle) * (BASIN_WALL / 2), BASIN_HEIGHT / 2, Math.cos(angle) * (half - BASIN_WALL / 2) - Math.sin(angle) * (BASIN_WALL / 2));
    wall.rotation.y = angle;
    group.add(wall);
  }
  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      group.add(at(kit.box(0.22, 0.12, 0.22, stoneLight), sideX * (half - 0.08), BASIN_HEIGHT + 0.06, sideZ * (half - 0.08)));
    }
  }
  const lowerWater = BASIN_HEIGHT - WATER_BELOW_RIM;
  group.add(at(waterPatch(BASIN_SIZE - BASIN_WALL * 2, BASIN_SIZE - BASIN_WALL * 2), 0, lowerWater, 0));

  group.add(at(kit.box(PILLAR_SIZE, PILLAR_HEIGHT, PILLAR_SIZE, stoneLight), 0, PILLAR_HEIGHT / 2, 0));
  const upperBottom = PILLAR_HEIGHT;
  group.add(at(kit.box(UPPER_BASIN, 0.14, UPPER_BASIN, stone), 0, upperBottom + 0.07, 0));
  const upperWater = upperBottom + 0.12;
  group.add(at(waterPatch(UPPER_BASIN - 0.12, UPPER_BASIN - 0.12), 0, upperWater, 0));
  group.add(at(kit.box(0.12, 0.26, 0.12, stoneLight), 0, upperWater + 0.13, 0));
  group.add(at(kit.box(0.08, 0.08, 0.08, '#e8e6f0'), 0, upperWater + 0.3, 0));
  return { group, lowerWater, upperWater, spout: upperWater + 0.3, radius: half };
}

// ---------- 小件 ----------

/**
 * 路灯：铁杆子、底座，顶上一盏方灯笼（白天也微微亮着）
 * @param {Kit} kit
 * @returns {THREE.Group}
 */
export function lamp(kit) {
  const group = new THREE.Group();
  const iron = '#4a4a5a';
  group.add(at(kit.box(0.2, 0.12, 0.2, iron), 0, 0.06, 0));
  group.add(at(kit.box(0.09, 1.25, 0.09, iron), 0, 0.68, 0));
  group.add(at(kit.box(0.24, 0.26, 0.24, '#fff1b0', { emissive: '#ffd866', emissiveIntensity: 0.45 }), 0, 1.42, 0));
  group.add(at(kit.box(0.32, 0.06, 0.32, iron), 0, 1.58, 0));
  group.add(at(kit.box(0.1, 0.08, 0.1, iron), 0, 1.65, 0));
  group.add(at(kit.box(0.3, 0.04, 0.3, iron), 0, 1.27, 0));
  return group;
}

// 长椅坐面多高（小人坐上去时用）
export const BENCH_SEAT_HEIGHT = 0.34;

/**
 * 木长椅：三根坐板、两根靠背板，铁腿
 * @param {Kit} kit
 * @returns {THREE.Group} 坐着的人脸朝 +z
 */
export function bench(kit) {
  const group = new THREE.Group();
  const [woodDark, wood] = shadesOf('#c48a54');
  const slats = 3;
  for (let i = 0; i < slats; i++) {
    group.add(at(kit.box(0.9, 0.04, 0.1, i % 2 ? woodDark : wood), 0, BENCH_SEAT_HEIGHT - 0.02, -0.12 + i * 0.12));
  }
  group.add(at(kit.box(0.9, 0.09, 0.04, wood), 0, BENCH_SEAT_HEIGHT + 0.14, -0.2));
  group.add(at(kit.box(0.9, 0.09, 0.04, woodDark), 0, BENCH_SEAT_HEIGHT + 0.27, -0.2));
  for (const side of [-1, 1]) {
    group.add(at(kit.box(0.05, BENCH_SEAT_HEIGHT, 0.32, '#4a4a5a'), side * 0.38, BENCH_SEAT_HEIGHT / 2, -0.02));
    group.add(at(kit.box(0.05, 0.36, 0.05, '#4a4a5a'), side * 0.38, BENCH_SEAT_HEIGHT + 0.16, -0.2));
  }
  return group;
}

/**
 * 一个木箱：木板的颜色，四条边一圈深色的框
 * @param {Kit} kit
 * @param {number} size 边长
 * @returns {THREE.Group} 原点在底面中心
 */
function crate(kit, size) {
  const group = new THREE.Group();
  const [dark, base] = shadesOf('#c8913a', 0.1);
  group.add(at(kit.box(size, size, size, base), 0, size / 2, 0));
  const frame = size * 0.12;
  for (const y of [frame / 2, size - frame / 2]) {
    group.add(at(kit.box(size + 0.02, frame, size + 0.02, dark), 0, y, 0));
  }
  group.add(at(kit.box(size + 0.02, size * 0.7, frame, dark), 0, size / 2, 0));
  return group;
}

// 木箱堆旁边那个小箱子摆在哪（相对大箱子），放在右边，左边留给人走过去拿车
export const SMALL_CRATE_OFFSET = [0.42, 0.08];

/**
 * 一堆木箱：底下一个大的，上面压一个小一点、歪着放的，旁边一个更小的
 * @param {Kit} kit
 * @returns {{ group: THREE.Group, topY: number, footprint: number }} 最上面那个箱子的顶面多高；占地多大（一半）
 */
export function crateStack(kit) {
  const group = new THREE.Group();
  const bottom = 0.5;
  const top = 0.38;
  group.add(crate(kit, bottom));
  group.add(at(crate(kit, top), 0.03, bottom, -0.02, 0.25));
  group.add(at(crate(kit, 0.3), SMALL_CRATE_OFFSET[0], 0, SMALL_CRATE_OFFSET[1], -0.3));
  return { group, topY: bottom + top, footprint: bottom / 2 };
}

/**
 * 木桶：中间鼓、两头收，上下两道铁箍
 * @param {Kit} kit
 * @returns {THREE.Group}
 */
export function barrel(kit) {
  const group = new THREE.Group();
  const [dark, base] = shadesOf('#a8703a');
  group.add(at(kit.box(0.34, 0.12, 0.34, base), 0, 0.06, 0));
  group.add(at(kit.box(0.4, 0.26, 0.4, base), 0, 0.25, 0));
  group.add(at(kit.box(0.34, 0.12, 0.34, base), 0, 0.44, 0));
  for (const y of [0.13, 0.37]) {
    group.add(at(kit.box(0.42, 0.04, 0.42, '#5a5a66'), 0, y, 0));
  }
  group.add(at(kit.box(0.28, 0.02, 0.28, dark), 0, 0.5, 0));
  return group;
}

// ---------- 干草堆 ----------
// 草堆用多大的体素；圆鼓鼓的一堆：半宽、半高（格子数）；草的颜色
const HAY_VOXEL = 0.06;
const HAY_MOUND_RADIUS = [5, 4.6, 4.6];
// 草堆中心抬多高（占半高的比例）：不到 1，底下一圈埋进地里，像是压实的
const HAY_MOUND_LIFT = 0.8;
const HAY_COLOR = '#e3b448';
// 草堆表面多疙瘩、多少草换成邻近的深浅
const HAY_BUMPINESS = 0.22;
const HAY_SPECKLE = 0.18;
// 旁边一个捆好的方草捆：多大，在草堆哪边（右前，朝镜头），转多少；捆它的两道麻绳多宽
const HAY_BALE = [0.32, 0.18, 0.2];
const HAY_BALE_SPOT = [0.36, 0.22];
const HAY_BALE_TURN = -0.5;
const TWINE_WIDTH = 0.025;
const TWINE_COLOR = '#8b5a2b';
// 地上散落的几根草：一根多大；在草堆哪儿 [dx, dz, 转角]
const LOOSE_STRAW = [0.12, 0.02, 0.03];
const LOOSE_STRAWS = [
  [-0.3, 0.28, 0.4],
  [0.05, 0.4, -0.9],
  [-0.42, -0.05, 1.3],
];

/**
 * 风车门口的干草堆：一堆圆鼓鼓的草，旁边一个捆好的方草捆，地上散着几根草
 * @param {Kit} kit
 * @param {number} seed 草堆表面的起伏
 * @returns {{ group: THREE.Group, footprint: number }} 原点在底面中心；footprint 是草堆占地多大（一半）
 */
export function haystack(kit, seed) {
  const group = new THREE.Group();
  const shades = shadesOf(HAY_COLOR, 0.09);
  const [, base, light] = shades;

  const mound = new VoxelShape(HAY_VOXEL);
  const [radiusX, radiusY, radiusZ] = HAY_MOUND_RADIUS;
  mound.fillBlob({ center: [0, radiusY * HAY_MOUND_LIFT, 0], radius: HAY_MOUND_RADIUS, shades, bumpiness: HAY_BUMPINESS, seed, speckle: HAY_SPECKLE });
  group.add(mound.mesh(kit));

  // 麻绳比草捆大一丝，包在外面看得见
  const [baleWidth, baleHeight, baleDepth] = HAY_BALE;
  const twineOverlap = 0.01;
  const bale = new THREE.Group();
  bale.add(at(kit.box(baleWidth, baleHeight, baleDepth, base), 0, baleHeight / 2, 0));
  for (const side of [-1, 1]) {
    const twine = kit.box(TWINE_WIDTH, baleHeight + twineOverlap, baleDepth + twineOverlap, TWINE_COLOR);
    bale.add(at(twine, (side * baleWidth) / 4, baleHeight / 2, 0));
  }
  group.add(at(bale, HAY_BALE_SPOT[0], 0, HAY_BALE_SPOT[1], HAY_BALE_TURN));

  const [strawLength, strawHeight, strawWidth] = LOOSE_STRAW;
  for (const [x, z, turn] of LOOSE_STRAWS) {
    group.add(at(kit.box(strawLength, strawHeight, strawWidth, light), x, strawHeight / 2, z, turn));
  }
  return { group, footprint: Math.max(radiusX, radiusZ) * HAY_VOXEL };
}

// 白栅栏：尖头木条隔多远一根，多高
const PICKET_SPACING = 0.22;
const PICKET_HEIGHT = 0.42;

/**
 * 一段白色尖头栅栏，沿 x 方向
 * @param {Kit} kit
 * @param {number} length 多长
 * @returns {THREE.Group} 原点在这段的中间
 */
export function picketFence(kit, length) {
  const group = new THREE.Group();
  const [shade, white] = shadesOf('#ffffff', 0.05);
  const count = Math.max(2, Math.round(length / PICKET_SPACING) + 1);
  for (let i = 0; i < count; i++) {
    const x = -length / 2 + (length / (count - 1)) * i;
    group.add(at(kit.box(0.07, PICKET_HEIGHT, 0.05, white), x, PICKET_HEIGHT / 2, 0));
    group.add(at(kit.box(0.04, 0.05, 0.04, white), x, PICKET_HEIGHT + 0.02, 0));
  }
  for (const y of [0.14, 0.32]) {
    group.add(at(kit.box(length, 0.05, 0.03, shade), 0, y, -0.035));
  }
  return group;
}

/**
 * 稻草人：一根木桩、横杆当胳膊，补丁衬衫，麻袋脑袋上缝着纽扣眼睛，戴一顶破草帽，袖口露出稻草
 * @param {Kit} kit
 * @returns {{ group: THREE.Group, body: THREE.Group }} body 是木桩以上的部分，风吹时让它晃
 */
export function scarecrow(kit) {
  const group = new THREE.Group();
  group.add(at(kit.box(0.07, 0.6, 0.07, '#8b5a2b'), 0, 0.3, 0));

  const body = new THREE.Group();
  body.position.y = 0.55;
  body.add(at(kit.box(0.82, 0.06, 0.06, '#8b5a2b'), 0, 0.28, 0));
  body.add(at(kit.box(0.34, 0.38, 0.18, '#c8603a'), 0, 0.2, 0));
  body.add(at(kit.box(0.12, 0.12, 0.02, '#5fa8d6'), -0.07, 0.14, 0.1));
  body.add(at(kit.box(0.6, 0.12, 0.14, '#c8603a'), 0, 0.3, 0));
  for (const side of [-1, 1]) {
    body.add(at(kit.box(0.08, 0.12, 0.1, '#f2d26b'), side * 0.36, 0.28, 0));
  }
  body.add(at(kit.box(0.26, 0.26, 0.24, '#e8d3a0'), 0, 0.53, 0));
  for (const side of [-1, 1]) {
    body.add(at(kit.box(0.05, 0.05, 0.02, '#2b211c'), side * 0.06, 0.55, 0.12));
  }
  body.add(at(kit.box(0.1, 0.02, 0.02, '#8b5a2b'), 0, 0.47, 0.12));
  body.add(at(kit.box(0.46, 0.04, 0.42, '#d9b45a'), 0, 0.67, 0));
  body.add(at(kit.box(0.26, 0.14, 0.24, '#d9b45a'), 0, 0.75, 0));
  body.add(at(kit.box(0.27, 0.04, 0.25, '#c0603a'), 0, 0.7, 0));
  group.add(body);
  return { group, body };
}

/**
 * 菜畦里的一棵菜
 * @param {Kit} kit
 * @param {string} kind carrot 胡萝卜（露一截橙色）、cabbage 卷心菜、pumpkin 南瓜
 * @param {Function} random 叶子朝哪、大小差一点
 * @returns {THREE.Group}
 */
export function crop(kit, kind, random) {
  const group = new THREE.Group();
  const leaf = shadesOf('#5fb04f');
  if (kind === 'carrot') {
    group.add(at(kit.box(0.08, 0.06, 0.08, '#f08a2c'), 0, 0.02, 0));
    const blades = 3;
    for (let i = 0; i < blades; i++) {
      const blade = kit.box(0.03, 0.16 + random() * 0.06, 0.03, leaf[i % 3]);
      blade.rotation.z = (i - 1) * 0.35;
      group.add(at(blade, (i - 1) * 0.03, 0.12, 0));
    }
  } else if (kind === 'cabbage') {
    group.add(at(kit.box(0.24, 0.12, 0.24, leaf[0]), 0, 0.06, 0));
    group.add(at(kit.box(0.17, 0.12, 0.17, leaf[2]), 0, 0.11, 0, 0.4));
    group.add(at(kit.box(0.1, 0.06, 0.1, '#b9e39a'), 0, 0.18, 0));
  } else {
    const [dark, base] = shadesOf('#f08a2c');
    group.add(at(kit.box(0.28, 0.2, 0.26, base), 0, 0.1, 0));
    for (const x of [-0.07, 0.07]) {
      group.add(at(kit.box(0.03, 0.2, 0.27, dark), x, 0.1, 0));
    }
    group.add(at(kit.box(0.04, 0.08, 0.04, '#6e4520'), 0, 0.24, 0));
    group.add(at(kit.box(0.12, 0.02, 0.08, leaf[1]), 0.06, 0.21, 0.05));
  }
  group.rotation.y = random() * Math.PI * 2;
  return group;
}

/**
 * 红信箱：一根木桩，顶上一个红箱子，旁边竖着一面小旗
 * @param {Kit} kit
 * @returns {THREE.Group}
 */
export function mailbox(kit) {
  const group = new THREE.Group();
  group.add(at(kit.box(0.08, 0.6, 0.08, '#8b5a2b'), 0, 0.3, 0));
  group.add(at(kit.box(0.24, 0.2, 0.34, '#e8433a'), 0, 0.7, 0));
  group.add(at(kit.box(0.2, 0.06, 0.3, '#ff6b5a'), 0, 0.82, 0));
  group.add(at(kit.box(0.02, 0.2, 0.02, '#4a4a5a'), 0.13, 0.82, -0.08));
  group.add(at(kit.box(0.02, 0.08, 0.1, '#ffd84a'), 0.13, 0.88, -0.02));
  return group;
}

/**
 * 路牌：一根木桩，两块指向不同方向的箭头木板
 * @param {Kit} kit
 * @returns {THREE.Group}
 */
export function signpost(kit) {
  const group = new THREE.Group();
  const [dark, base, light] = shadesOf('#c48a54');
  group.add(at(kit.box(0.08, 0.95, 0.08, dark), 0, 0.475, 0));
  const boards = [
    { y: 0.82, turn: 0.5, color: light },
    { y: 0.62, turn: -0.7, color: base },
  ];
  for (const { y, turn, color } of boards) {
    const board = new THREE.Group();
    board.add(at(kit.box(0.42, 0.13, 0.04, color), 0.17, 0, 0));
    board.add(at(kit.box(0.08, 0.08, 0.04, color), 0.41, 0, 0));
    board.rotation.y = turn;
    group.add(at(board, 0, y, 0));
  }
  return group;
}

/**
 * 荷叶：扁扁的一片，缺一个口；大的上面开一朵粉花
 * @param {Kit} kit
 * @param {number} size 大小（1 大约 0.36 宽）
 * @param {boolean} flower 开不开花
 * @returns {THREE.Group}
 */
export function lilyPad(kit, size, flower) {
  const group = new THREE.Group();
  const [dark, base] = shadesOf('#5fb04f');
  const width = 0.36 * size;
  group.add(at(kit.box(width, 0.02, width, base), 0, 0, 0));
  group.add(at(kit.box(width * 0.7, 0.025, width * 0.7, dark), 0, 0.002, 0));
  group.add(at(kit.box(width * 0.2, 0.03, width * 0.25, '#58bdf0'), width * 0.42, 0.004, 0));
  if (flower) {
    group.add(at(kit.box(0.1, 0.06, 0.1, '#ff9ec2'), -width * 0.15, 0.04, 0));
    group.add(at(kit.box(0.05, 0.05, 0.05, '#ffe066'), -width * 0.15, 0.08, 0));
  }
  return group;
}

// 芦苇：一丛几根，多高，顶上棕色蒲棒的比例
const REED_STALKS = 5;
const REED_HEIGHT = [0.35, 0.6];
const CATTAIL_CHANCE = 0.5;

/**
 * 一丛芦苇：几根细细的绿杆，有的顶上一截棕色的蒲棒
 * @param {Kit} kit
 * @param {Function} random 高矮、位置
 * @returns {THREE.Group} 风吹时整丛晃
 */
export function reeds(kit, random) {
  const group = new THREE.Group();
  const greens = shadesOf('#6cb64f');
  for (let i = 0; i < REED_STALKS; i++) {
    const height = REED_HEIGHT[0] + random() * (REED_HEIGHT[1] - REED_HEIGHT[0]);
    const x = (random() - 0.5) * 0.24;
    const z = (random() - 0.5) * 0.24;
    group.add(at(kit.box(0.03, height, 0.03, greens[i % 3]), x, height / 2, z));
    if (random() < CATTAIL_CHANCE) {
      group.add(at(kit.box(0.06, 0.12, 0.06, '#8b5a2b'), x, height - 0.06, z));
    }
  }
  return group;
}

// 疙疙瘩瘩的小东西用多大的体素
const SMALL_VOXEL = 0.07;

/**
 * 一块石头：灰色的一团体素，上亮下暗
 * @param {Kit} kit
 * @param {number} size 大小（1 大约 0.35 宽）
 * @param {number} seed 形状
 * @returns {THREE.Mesh}
 */
export function rock(kit, size, seed) {
  const shape = new VoxelShape(SMALL_VOXEL);
  const radius = 2.5 * size;
  shape.fillBlob({ center: [0, radius * 0.55, 0], radius: [radius, radius * 0.75, radius * 0.9], shades: shadesOf('#a6a39c', 0.09), bumpiness: 0.25, seed, speckle: 0.12 });
  return shape.mesh(kit);
}

/**
 * 一朵云：扁扁的白色体素，底下灰一点
 * @param {Kit} kit
 * @param {number} seed 形状
 * @returns {THREE.Mesh}
 */
export function cloud(kit, seed) {
  const random = rng(seed);
  const shape = new VoxelShape(0.12);
  const shades = ['#d9e4f5', '#f4f8ff', '#ffffff'];
  const puffs = 3;
  for (let i = 0; i < puffs; i++) {
    const x = (i - 1) * 3.2 + (random() - 0.5) * 2;
    const radius = 2.6 + random() * 1.4 - Math.abs(i - 1) * 0.6;
    shape.fillBlob({ center: [x, radius * 0.5, (random() - 0.5) * 1.5], radius: [radius * 1.2, radius * 0.7, radius], shades, bumpiness: 0.15, seed: seed + i });
  }
  return shape.mesh(kit);
}

// ---------- 小动物 ----------

/**
 * 一只方块小鸡：白身子、红鸡冠、黄嘴、橙色的腿，两只翅膀能扑腾
 * @param {Kit} kit
 * @returns {{ group: THREE.Group, body: THREE.Group, head: THREE.Group, wings: THREE.Object3D[], legs: THREE.Object3D[] }} 头朝 +z
 */
export function chicken(kit) {
  const group = new THREE.Group();
  const [feather, , featherLight] = shadesOf('#f6f3ea', 0.05);
  const body = new THREE.Group();
  body.position.y = 0.11;
  group.add(body);

  body.add(at(kit.box(0.22, 0.17, 0.26, featherLight), 0, 0.08, 0));
  body.add(at(kit.box(0.14, 0.14, 0.06, feather), 0, 0.17, -0.15));
  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.1);
  head.add(at(kit.box(0.14, 0.15, 0.13, featherLight), 0, 0.06, 0));
  head.add(at(kit.box(0.04, 0.06, 0.09, '#e8433a'), 0, 0.16, 0));
  head.add(at(kit.box(0.06, 0.04, 0.06, '#ffc23d'), 0, 0.05, 0.09));
  head.add(at(kit.box(0.03, 0.05, 0.02, '#e8433a'), 0, 0.0, 0.07));
  for (const side of [-1, 1]) {
    head.add(at(kit.box(0.02, 0.03, 0.03, '#2b211c'), side * 0.071, 0.08, 0.03));
  }
  body.add(head);

  const wings = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.11, 0.15, 0);
    pivot.add(at(kit.box(0.04, 0.12, 0.18, feather), side * 0.02, -0.05, 0));
    body.add(pivot);
    return pivot;
  });

  const legs = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.05, 0.11, 0.01);
    pivot.add(at(kit.box(0.03, 0.11, 0.03, '#ff9a3d'), 0, -0.055, 0));
    pivot.add(at(kit.box(0.06, 0.02, 0.07, '#ff9a3d'), 0, -0.1, 0.02));
    group.add(pivot);
    return pivot;
  });
  return { group, body, head, wings, legs };
}

/**
 * 一条方块小金鱼：橙色身子，后面一片尾巴
 * @param {Kit} kit
 * @returns {THREE.Group} 头朝 +z
 */
export function fish(kit) {
  const group = new THREE.Group();
  // 先抬头低头、再转向：不然转了向以后抬头会变成往侧面歪
  group.rotation.order = 'YXZ';
  group.add(kit.box(0.08, 0.09, 0.16, '#ff8a3d'));
  group.add(at(kit.box(0.02, 0.08, 0.06, '#ffb36b'), 0, 0, -0.1));
  group.add(at(kit.box(0.09, 0.02, 0.02, '#2b211c'), 0, 0.02, 0.05));
  return group;
}

// ---------- 材料 ----------
// 像素块：边长几个小方块，一个小方块多大
const BLOCK_CELLS = 5;
const BLOCK_VOXEL = 0.04;
// 每块随机挑一种亮色：粉、青、紫，和草地、菜、花、草堆的颜色都错开
const BLOCK_COLORS = ['#ff5fa2', '#3fc8ff', '#a070ff'];
// 亮边、暗点和本色差多少亮度
const BLOCK_SHADE_STEP = 0.12;
// 角上那颗高光是什么颜色
const BLOCK_SPARKLE = '#ffffff';
// 自己微微发光多亮：藏在灌木、菜畦里也一眼看得出是能捡的，不是装饰
const BLOCK_GLOW = 0.35;

/**
 * 一个像素块（像素小镇的材料）：亮色的小方块，每个面一圈亮边、正中一格暗点，朝光的角上一颗白色高光
 * @description 像 8-bit 游戏里的宝石方块，和小镇里的花、菜、木箱一眼分得开；每块颜色随机，翻出来不是一模一样的
 * @param {Kit} kit
 * @returns {THREE.Group} 原点在底面中心
 */
export function pixelBlock(kit) {
  const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
  const shades = shadesOf(color, BLOCK_SHADE_STEP);
  // 格子以原点为中心：x、z 从 -edge 到 edge，y 从 0 往上
  const edge = (BLOCK_CELLS - 1) / 2;

  const shape = new VoxelShape(BLOCK_VOXEL);
  shape.fillBox([-edge, 0, -edge], [edge, BLOCK_CELLS - 1, edge], (x, y, z) => blockCellColor([x, y - edge, z], edge, shades));

  const group = new THREE.Group();
  group.add(shape.mesh(kit, { emissive: color, emissiveIntensity: BLOCK_GLOW }));
  return group;
}

/**
 * 像素块上一个小方块是什么颜色
 * @description 小方块的颜色同时用在它露出来的几个面上：棱上的（两个以上坐标在边上）就是每个面的亮边，
 *   只有一个坐标在边上、另外两个在正中的就是每个面正中的暗点
 * @param {number[]} cell 以方块中心为原点的格子坐标 [x, y, z]
 * @param {number} edge 边上的格子离中心几格
 * @param {string[]} shades [暗, 本色, 亮]
 * @returns {string}
 */
function blockCellColor(cell, edge, shades) {
  const [dark, base, light] = shades;
  const [x, y, z] = cell;

  // 左上前的角朝着太阳，点一颗高光
  const sparkle = x === -edge && y === edge && z === edge;
  if (sparkle) {
    return BLOCK_SPARKLE;
  }

  const onEdge = cell.filter((value) => Math.abs(value) === edge).length;
  const centered = cell.filter((value) => value === 0).length;
  if (onEdge >= 2) {
    return light;
  }
  if (onEdge === 1 && centered === 2) {
    return dark;
  }
  return base;
}
