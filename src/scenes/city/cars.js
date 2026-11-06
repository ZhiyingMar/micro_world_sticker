// 夜都的车：和楼一个路子，棱角利落、只倒一点小斜角、细节画全，车漆偏灰但会反一点灯光
//   车身按侧面轮廓挤出来，车头、挡风玻璃、车尾的线条都是对的；驾驶室往上收窄，比例还是圆滚滚的，和小人搭
//   车窗、门缝、门把手、保险杠、车牌、轮毂都有，一共四种车：轿车、两厢小车、厢式小货车、出租车
//   地上的光（车灯照在路上、车尾的红光、车底的影子）单独挂，虚影那辆出租车不要这些
// 只负责造出来；开在哪、轮子转多快、刹车灯什么时候亮由 traffic.js 决定
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { at, canvasTexture } from '../../kit.js';
import { glow, softDotTexture } from '../../fx.js';
import { placedBox } from './buildings.js';
import { ROAD_TOP } from './layout.js';

// 车宽（和堵车时留的那条缝是配好的，改了要一起改 layout.js 的 JAM）
const CAR_WIDTH = 0.5;
// 轮子：多大、多宽，轮心多高（轮子踩在马路面上），轮子离车身外侧多远
export const WHEEL_RADIUS = 0.105;
const WHEEL_WIDTH = 0.085;
const WHEEL_Y = ROAD_TOP + WHEEL_RADIUS;
const WHEEL_INSET = 0.045;
const TIRE_COLOR = '#17181f';
const HUB_COLOR = '#aeb2c0';
const SPOKE_COLOR = '#3d404d';
// 车身：底板多高，轮拱多大，棱上的小斜角多宽
const FLOOR_Y = 0.09;
const ARCH_RADIUS = 0.125;
const BEVEL = 0.012;
// 轮拱的圆弧被底板切掉的角度：底板比轮心低，圆弧不用画满半圈
const ARCH_CUT = Math.asin((WHEEL_Y - FLOOR_Y) / ARCH_RADIUS);

// 车漆：比楼滑一些，路灯和霓虹在车身上打出高光；底盘、保险杠、门缝是深色，门把手、车牌、腰线是浅金属
const PAINT = { roughness: 0.32, metalness: 0.15 };
const TRIM_COLOR = '#22242d';
const METAL_COLOR = '#b9bdcb';
// 车窗：下面暗上面亮，像映着夜空；斜着一道反光，和楼上暗着的窗户一个画法
const GLASS_LOW = new THREE.Color('#141a2b');
const GLASS_HIGH = new THREE.Color('#4a6390');
const GLASS_GLINT = new THREE.Color('#8ea6cf');
const GLASS_LOOK = { vertexColors: true, roughness: 0.18, metalness: 0.1, emissive: '#101a33', emissiveIntensity: 1 };
// 玻璃离车身边多远、比车身表面高多少（免得闪）
const GLASS_MARGIN = 0.03;
const GLASS_LIFT = 0.004;
// 门缝、贴在车身外面的小东西比车身高多少
const SURFACE_LIFT = 0.002;

// 车灯：车头两盏、车尾两盏离中间多远；车头灯外面一小圈光晕
const LAMP_SIDE = 0.165;
const HEAD_LAMP_Y = 0.235;
const TAIL_LAMP_Y = 0.25;
const HEAD_HALO = { color: '#fff1b8', size: 0.42, opacity: 0.55 };

// 出租车：车身颜色，顶灯多大，车门上一排黑格子多大、几格
const TAXI_COLOR = '#e9b83c';
const TAXI_SIGN_SIZE = [0.22, 0.075, 0.11];
const CHECKER_SIZE = 0.028;
const CHECKER_COUNT = 10;

// 地上的光：车头照出去多长多宽、多亮；车尾红光多大；车底影子多大、多深；都比马路面高一点点
const BEAM = { length: 1.7, width: 1.0, opacity: 0.42, color: '#ffe9b0', start: 0.48 };
const TAIL_POOL = { size: 0.85, offset: 0.62, color: '#ff3b3b' };
const CONTACT_SHADOW = { size: [1.3, 0.78], opacity: 0.55, color: '#05060c' };
const ROAD_LIGHT_LIFT = ROAD_TOP + 0.016;
const BEAM_TEXTURE_PX = 128;

// 四种车的侧面（车头朝 +x）
//   front / rear 车头车尾在哪，belt 腰线（车窗下沿）多高，roof 车顶多高，wheels 前后轮在哪
//   outline 车身的轮廓：从车头下沿绕到车尾下沿的几个角 [x, y, 圆角]
//   cabin 驾驶室四个角的 x：挡风玻璃底、挡风玻璃顶、后窗顶、后窗底；taper 车顶比腰线窄几成
//   pillar 前后车窗中间那根柱子在哪；rearGlass 后面那扇侧窗有没有（货车后面是货厢）
const KINDS = {
  sedan: {
    front: 0.53,
    rear: -0.53,
    belt: 0.34,
    roof: 0.54,
    wheels: [0.31, -0.31],
    outline: [[0.53, FLOOR_Y, 0.03], [0.53, 0.265, 0.04], [0.22, 0.34, 0.05], [-0.42, 0.34, 0.03], [-0.53, 0.31, 0.04], [-0.53, FLOOR_Y, 0.03]],
    cabin: [0.24, 0.06, -0.22, -0.4],
    taper: 0.16,
    pillar: -0.07,
    rearGlass: true,
  },
  hatch: {
    front: 0.47,
    rear: -0.46,
    belt: 0.365,
    roof: 0.62,
    wheels: [0.27, -0.27],
    outline: [[0.47, FLOOR_Y, 0.03], [0.47, 0.29, 0.05], [0.3, 0.365, 0.05], [-0.44, 0.365, 0.02], [-0.46, 0.34, 0.02], [-0.46, FLOOR_Y, 0.03]],
    cabin: [0.31, 0.15, -0.36, -0.45],
    taper: 0.14,
    pillar: -0.06,
    rearGlass: true,
  },
  van: {
    front: 0.53,
    rear: -0.53,
    belt: 0.41,
    roof: 0.74,
    wheels: [0.33, -0.33],
    outline: [[0.53, FLOOR_Y, 0.03], [0.53, 0.31, 0.05], [0.42, 0.41, 0.05], [-0.52, 0.41, 0.02], [-0.53, 0.38, 0.02], [-0.53, FLOOR_Y, 0.03]],
    cabin: [0.43, 0.27, -0.5, -0.525],
    taper: 0.06,
    pillar: 0.07,
    rearGlass: false,
  },
};
KINDS.taxi = KINDS.sedan;

/**
 * 造一辆车
 * @param {World} world 用来登记贴图（出租车顶灯、货车车身上的字）
 * @param {object} options
 * @param {'sedan' | 'hatch' | 'van' | 'taxi'} options.kind 哪种车
 * @param {string} [options.color] 车身颜色，出租车不用写
 * @param {string} [options.roof] 驾驶室和车顶的颜色，不写和车身一样（两厢小车常漆成双色）
 * @returns {THREE.Group} 车头朝 +x，原点在地面；userData.parts 是 { body, wheels, tailLamp }，开起来时要转轮子、晃车身、点刹车灯
 */
export function car(world, { kind, color = TAXI_COLOR, roof = color }) {
  const kit = world.kit;
  const spec = KINDS[kind];
  const body = new THREE.Group();

  body.add(kit.mesh(lowerBody(spec), color, PAINT));
  body.add(kit.mesh(cabin(spec), roof, PAINT));
  body.add(kit.mesh(glass(spec), '#ffffff', GLASS_LOOK));
  body.add(kit.mesh(mergeGeometries(mirrors(spec)), color, PAINT));
  body.add(kit.mesh(mergeGeometries(trimPieces(spec, kind)), TRIM_COLOR));
  body.add(kit.mesh(mergeGeometries(metalPieces(spec)), METAL_COLOR, { roughness: 0.4, metalness: 0.5 }));
  const tailLamp = addLamps(kit, body, spec);

  if (kind === 'taxi') {
    body.add(taxiSign(world, spec));
  }
  if (kind === 'van') {
    body.add(vanDecals(world, spec));
  }

  const group = new THREE.Group();
  group.add(body);
  const wheels = addWheels(kit, group, spec);
  group.userData.parts = { body, wheels, tailLamp };
  return group;
}

// ---------- 车身 ----------

/**
 * 拐过一个圆角：先直走到快到角的地方，再画一段弧拐过去
 * @param {THREE.Shape} shape
 * @param {number[]} corner 这个角 [x, y, 圆角]
 * @param {number[]} next 下一个点 [x, y]
 */
function turnCorner(shape, [x, y, radius], [nextX, nextY]) {
  const back = new THREE.Vector2(shape.currentPoint.x - x, shape.currentPoint.y - y);
  const forward = new THREE.Vector2(nextX - x, nextY - y);
  const cut = Math.min(radius, back.length() / 2, forward.length() / 2);
  back.setLength(cut);
  forward.setLength(cut);

  shape.lineTo(x + back.x, y + back.y);
  shape.quadraticCurveTo(x, y, x + forward.x, y + forward.y);
}

/**
 * 把一个侧面轮廓挤成有厚度的形状，棱上倒一道小斜角
 * @param {THREE.Shape} shape 侧面轮廓
 * @returns {THREE.ExtrudeGeometry} 中心在 z = 0
 */
function extrudeAcross(shape) {
  const depth = CAR_WIDTH - BEVEL * 2;
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelOffset: -BEVEL, bevelSegments: 1, curveSegments: 5 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/**
 * 腰线以下的车身：底下挖出两个轮拱
 * @param {object} spec KINDS 里的一种
 * @returns {THREE.BufferGeometry}
 */
function lowerBody({ rear, wheels, outline }) {
  const start = [rear + 0.04, FLOOR_Y];
  const shape = new THREE.Shape();
  shape.moveTo(...start);
  for (const x of [...wheels].sort((a, b) => a - b)) {
    shape.absarc(x, WHEEL_Y, ARCH_RADIUS, Math.PI + ARCH_CUT, -ARCH_CUT, true);
  }

  const loop = [...outline, start];
  outline.forEach((corner, index) => turnCorner(shape, corner, loop[index + 1]));
  return extrudeAcross(shape);
}

/**
 * 这个高度上车身有多宽的一半：腰线以下是车宽，往上慢慢收窄
 * @param {object} spec
 * @param {number} y
 * @returns {number}
 */
function halfWidthAt({ belt, roof, taper }, y) {
  const rise = THREE.MathUtils.clamp((y - belt) / (roof - belt), 0, 1);
  return (CAR_WIDTH / 2) * (1 - taper * rise);
}

/**
 * 驾驶室：挤出来以后越往上越窄
 * @description 高度和收窄是直线关系，所以侧面还是一个平面，不会皱
 * @param {object} spec
 * @returns {THREE.BufferGeometry}
 */
function cabin(spec) {
  const { belt, roof, cabin: [baseFront, topFront, topRear, baseRear] } = spec;
  const bottom = belt - 0.02;
  const shape = new THREE.Shape();
  shape.moveTo(baseRear, bottom);
  shape.lineTo(baseFront, bottom);
  shape.lineTo(baseFront, belt);

  const corners = [[topFront, roof, 0.05], [topRear, roof, 0.05]];
  const loop = [...corners, [baseRear, belt]];
  corners.forEach((corner, index) => turnCorner(shape, corner, loop[index + 1]));
  shape.lineTo(baseRear, belt);

  const geometry = extrudeAcross(shape);
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    const narrowed = halfWidthAt(spec, positions.getY(index)) / (CAR_WIDTH / 2);
    positions.setZ(index, positions.getZ(index) * narrowed);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// ---------- 车窗 ----------

/**
 * 攒车窗的四边形：每个顶点按高度上色，下面暗上面亮
 */
class GlassBuffer {
  /**
   * @param {object} spec KINDS 里的一种
   */
  constructor(spec) {
    this.spec = spec;
    this.positions = [];
    this.colors = [];
  }

  /**
   * 加一块四边形玻璃
   * @param {number[][]} corners 四个角 [x, y, z]，按一圈的顺序
   * @param {number[]} outward 朝外的方向，四个角顺时针给反了会自己翻过来
   * @param {THREE.Color} [flat] 整块一个颜色（反光），不写就按高度渐变
   */
  quad(corners, outward, flat) {
    const facing = new THREE.Vector3(...outward).normalize();
    const lifted = corners.map((corner) => new THREE.Vector3(...corner).addScaledVector(facing, flat ? GLASS_LIFT * 1.5 : GLASS_LIFT));
    const across = lifted[1].clone().sub(lifted[0]);
    const up = lifted[2].clone().sub(lifted[0]);
    if (across.cross(up).dot(facing) < 0) {
      lifted.reverse();
    }

    for (const index of [0, 1, 2, 0, 2, 3]) {
      const point = lifted[index];
      const color = flat ?? this.skyColor(point.y);
      this.positions.push(point.x, point.y, point.z);
      this.colors.push(color.r, color.g, color.b);
    }
  }

  /**
   * 玻璃这个高度映出来的颜色
   * @param {number} y
   * @returns {THREE.Color}
   */
  skyColor(y) {
    const { belt, roof } = this.spec;
    return GLASS_LOW.clone().lerp(GLASS_HIGH, THREE.MathUtils.clamp((y - belt) / (roof - belt), 0, 1));
  }

  /**
   * 变成 BufferGeometry
   * @returns {THREE.BufferGeometry}
   */
  toGeometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }
}

/**
 * 车窗：挡风玻璃、后窗，两边的侧窗（中间隔一根柱子），挡风玻璃和前侧窗上斜着一道反光
 * @param {object} spec
 * @returns {THREE.BufferGeometry}
 */
function glass(spec) {
  const { belt, roof, pillar, rearGlass, cabin: [baseFront, topFront, topRear, baseRear] } = spec;
  const buffer = new GlassBuffer(spec);
  const low = belt + GLASS_MARGIN * 0.6;
  const high = roof - GLASS_MARGIN * 1.2;
  const frontEdge = (y) => THREE.MathUtils.mapLinear(y, belt, roof, baseFront, topFront);
  const rearEdge = (y) => THREE.MathUtils.mapLinear(y, belt, roof, baseRear, topRear);

  // 挡风玻璃和后窗：斜着从腰线搭到车顶，朝外的方向和那条斜线垂直
  addSlopedPane(buffer, spec, frontEdge, low, high, [roof - belt, baseFront - topFront]);
  addSlopedPane(buffer, spec, rearEdge, low, high, [belt - roof, topRear - baseRear]);

  for (const side of [-1, 1]) {
    const wall = (x, y) => [x, y, side * halfWidthAt(spec, y)];
    const outward = [0, 0, side];
    const front = (y) => frontEdge(y) - GLASS_MARGIN;
    buffer.quad([wall(pillar + 0.012, low), wall(front(low), low), wall(front(high), high), wall(pillar + 0.012, high)], outward);
    addGlint(buffer, wall, outward, (pillar + front(low)) / 2, low, high);
    if (rearGlass) {
      const back = (y) => rearEdge(y) + GLASS_MARGIN;
      buffer.quad([wall(back(low), low), wall(pillar - 0.012, low), wall(pillar - 0.012, high), wall(back(high), high)], outward);
    }
  }
  return buffer.toGeometry();
}

/**
 * 挡风玻璃或者后窗，上面斜着一道反光
 * @param {GlassBuffer} buffer
 * @param {object} spec
 * @param {(y: number) => number} edge 这个高度上玻璃在哪个 x
 * @param {number} low 玻璃下沿
 * @param {number} high 玻璃上沿
 * @param {number[]} facing 侧面看朝外的方向 [x, y]
 */
function addSlopedPane(buffer, spec, edge, low, high, [facingX, facingY]) {
  const across = (y) => halfWidthAt(spec, y) - GLASS_MARGIN;
  const outward = [facingX, facingY, 0];
  buffer.quad([[edge(low), low, -across(low)], [edge(low), low, across(low)], [edge(high), high, across(high)], [edge(high), high, -across(high)]], outward);

  const glintLow = THREE.MathUtils.lerp(low, high, 0.15);
  const glintHigh = THREE.MathUtils.lerp(low, high, 0.9);
  const width = CAR_WIDTH * 0.07;
  const slant = CAR_WIDTH * 0.1;
  buffer.quad([[edge(glintLow), glintLow, -slant], [edge(glintLow), glintLow, -slant + width], [edge(glintHigh), glintHigh, slant + width], [edge(glintHigh), glintHigh, slant]], outward, GLASS_GLINT);
}

/**
 * 侧窗上斜着一道反光
 * @param {GlassBuffer} buffer
 * @param {(x: number, y: number) => number[]} wall 车身这一侧表面上的点
 * @param {number[]} outward 朝外的方向
 * @param {number} x 这道反光在哪
 * @param {number} low 玻璃下沿
 * @param {number} high 玻璃上沿
 */
function addGlint(buffer, wall, outward, x, low, high) {
  const glintLow = THREE.MathUtils.lerp(low, high, 0.1);
  const glintHigh = THREE.MathUtils.lerp(low, high, 0.9);
  const width = 0.022;
  const slant = 0.03;
  buffer.quad([wall(x - slant, glintLow), wall(x - slant + width, glintLow), wall(x + slant + width, glintHigh), wall(x + slant, glintHigh)], outward, GLASS_GLINT);
}

// ---------- 贴在车身上的小东西 ----------

/**
 * 后视镜：挡风玻璃底下两边各一个
 * @param {object} spec
 * @returns {THREE.BufferGeometry[]}
 */
function mirrors({ belt, cabin: [baseFront] }) {
  return [-1, 1].map((side) => placedBox(0.035, 0.03, 0.045, [baseFront - 0.04, belt + 0.03, side * (CAR_WIDTH / 2 + 0.018)]));
}

/**
 * 深色的部分：前后保险杠、进气格栅、底下的裙边、门缝；出租车门上再加一排黑格子
 * @param {object} spec
 * @param {string} kind 哪种车
 * @returns {THREE.BufferGeometry[]}
 */
function trimPieces(spec, kind) {
  const { front, rear, belt, wheels, pillar, cabin: [baseFront] } = spec;
  const skin = CAR_WIDTH / 2 + SURFACE_LIFT;
  const bumperWidth = CAR_WIDTH + 0.012;
  const pieces = [
    placedBox(0.05, 0.065, bumperWidth, [front + 0.003, 0.135, 0]),
    placedBox(0.05, 0.065, bumperWidth, [rear - 0.003, 0.135, 0]),
    placedBox(0.012, 0.05, 0.2, [front + 0.002, 0.215, 0]),
  ];

  const betweenWheels = wheels[0] - wheels[1] - ARCH_RADIUS * 2;
  for (const side of [-1, 1]) {
    pieces.push(placedBox(betweenWheels, 0.032, 0.012, [(wheels[0] + wheels[1]) / 2, FLOOR_Y + 0.012, side * skin]));
    for (const seam of [baseFront - 0.03, pillar]) {
      pieces.push(placedBox(0.007, belt - FLOOR_Y - 0.05, 0.004, [seam, (belt + FLOOR_Y + 0.03) / 2, side * skin]));
    }
  }

  if (kind === 'taxi') {
    pieces.push(...checkerRow(spec));
  }
  return pieces;
}

/**
 * 出租车门上的一排黑格子，上下错开
 * @param {object} spec
 * @returns {THREE.BufferGeometry[]}
 */
function checkerRow({ belt, wheels }) {
  const pieces = [];
  const startX = (wheels[0] + wheels[1]) / 2 - (CHECKER_COUNT / 2) * CHECKER_SIZE;
  for (const side of [-1, 1]) {
    for (let i = 0; i < CHECKER_COUNT; i++) {
      const y = belt - 0.05 - (i % 2) * CHECKER_SIZE;
      pieces.push(placedBox(CHECKER_SIZE, CHECKER_SIZE, 0.004, [startX + i * CHECKER_SIZE, y, side * (CAR_WIDTH / 2 + SURFACE_LIFT)]));
    }
  }
  return pieces;
}

/**
 * 浅金属的部分：腰线上一道亮条、门把手、前后车牌
 * @param {object} spec
 * @returns {THREE.BufferGeometry[]}
 */
function metalPieces({ front, rear, belt, pillar, cabin: [baseFront, , , baseRear] }) {
  const skin = CAR_WIDTH / 2 + SURFACE_LIFT;
  const stripLength = baseFront - baseRear;
  const pieces = [
    placedBox(0.008, 0.04, 0.11, [front + 0.03, 0.135, 0]),
    placedBox(0.008, 0.04, 0.11, [rear - 0.03, 0.135, 0]),
  ];

  for (const side of [-1, 1]) {
    pieces.push(placedBox(stripLength, 0.01, 0.005, [(baseFront + baseRear) / 2, belt - 0.008, side * skin]));
    pieces.push(placedBox(0.036, 0.012, 0.008, [pillar + 0.05, belt - 0.04, side * skin]));
  }
  return pieces;
}

/**
 * 车灯：车头两盏一直亮，车尾两盏平时暗红、踩刹车时变亮
 * @param {Kit} kit
 * @param {THREE.Group} body 加到车身上
 * @param {object} spec
 * @returns {THREE.MeshStandardMaterial} 车尾灯的材质（每辆车自己一份，刹车时单独调亮）
 */
function addLamps(kit, body, { front, rear }) {
  const tailMaterial = kit.m('#ff3b3b', { emissive: '#ff2a2a', emissiveIntensity: 1.5 }).clone();

  for (const side of [-1, 1]) {
    const headLamp = kit.box(0.012, 0.05, 0.085, '#ffffff', 0, { emissive: '#fff4c8', emissiveIntensity: 2 });
    body.add(at(headLamp, front + 0.002, HEAD_LAMP_Y, side * LAMP_SIDE));
    const halo = glow(HEAD_HALO.color, HEAD_HALO.size, HEAD_HALO.opacity);
    halo.position.set(front + 0.06, HEAD_LAMP_Y, side * LAMP_SIDE);
    body.add(halo);

    const tailLamp = kit.mesh(new THREE.BoxGeometry(0.012, 0.05, 0.09), tailMaterial);
    body.add(at(tailLamp, rear - 0.002, TAIL_LAMP_Y, side * LAMP_SIDE));
  }
  return tailMaterial;
}

/**
 * 出租车车顶的灯牌：发光的小盒子，四面写着 TAXI
 * @param {World} world
 * @param {object} spec
 * @returns {THREE.Mesh}
 */
function taxiSign(world, { roof, cabin: [, topFront, topRear] }) {
  const texture = world.texture(
    canvasTexture(128, 48, (context, width, height) => {
      context.fillStyle = '#ffe9a0';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#2a2230';
      context.font = 'bold 34px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('TAXI', width / 2, height / 2 + 2);
    }),
  );
  const material = new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: 0.9 });
  const sign = world.kit.mesh(new THREE.BoxGeometry(...TAXI_SIGN_SIZE), material);
  return at(sign, (topFront + topRear) / 2, roof + TAXI_SIGN_SIZE[1] / 2, 0);
}

/**
 * 货车车厢两边的字：一弯月亮和 MOON CAFE，公交站广告上那家店的送货车
 * @param {World} world
 * @param {object} spec
 * @returns {THREE.Group}
 */
function vanDecals(world, spec) {
  const { belt, roof, pillar, cabin: [, , topRear] } = spec;
  const texture = world.texture(
    canvasTexture(256, 128, (context, width, height) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#d98a3a';
      context.beginPath();
      context.arc(52, height / 2, 34, Math.PI * 0.3, Math.PI * 1.7);
      context.quadraticCurveTo(44, height / 2, 76, height / 2 + 26);
      context.fill();
      context.fillStyle = '#4a3a5c';
      context.font = 'bold 36px sans-serif';
      context.textBaseline = 'middle';
      context.fillText('MOON', 96, height / 2 - 20);
      context.fillText('CAFE', 96, height / 2 + 20);
    }),
  );
  const material = new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.5, depthWrite: false });

  const group = new THREE.Group();
  const left = topRear + 0.06;
  const right = pillar - 0.06;
  const low = belt + 0.05;
  const high = roof - 0.05;
  for (const side of [-1, 1]) {
    group.add(new THREE.Mesh(decalPlate(spec, side, left, right, low, high), material));
  }
  return group;
}

/**
 * 贴在车厢侧面的一块平板，字从人看过去的左边读到右边
 * @param {object} spec
 * @param {number} side 哪一侧（1 或 -1）
 * @param {number} left 平板最小的 x
 * @param {number} right 平板最大的 x
 * @param {number} low 下沿
 * @param {number} high 上沿
 * @returns {THREE.BufferGeometry}
 */
function decalPlate(spec, side, left, right, low, high) {
  const zAt = (y) => side * (halfWidthAt(spec, y) + GLASS_LIFT);
  const corners = [[left, low], [right, low], [right, high], [left, high]];
  const positions = corners.flatMap(([x, y]) => [x, y, zAt(y)]);
  // 从 -z 那边看过去 x 是反的，u 也要反过来
  const uvs = side > 0 ? [0, 0, 1, 0, 1, 1, 0, 1] : [1, 0, 0, 0, 0, 1, 1, 1];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(side > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
  geometry.computeVertexNormals();
  return geometry;
}

// ---------- 轮子 ----------

/**
 * 给一块形状涂上一个颜色
 * @param {THREE.BufferGeometry} geometry
 * @param {string} hex
 * @returns {THREE.BufferGeometry}
 */
function painted(geometry, hex) {
  const color = new THREE.Color(hex);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    colors.set([color.r, color.g, color.b], index * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * 一个轮子的形状：轮胎、浅色轮毂、十字的轮辐（转起来看得出来）
 * @returns {THREE.BufferGeometry} 轴沿着 z
 */
function wheelGeometry() {
  const tire = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 16).rotateX(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(WHEEL_RADIUS * 0.6, WHEEL_RADIUS * 0.6, WHEEL_WIDTH + 0.008, 12).rotateX(Math.PI / 2);
  const spokeLength = WHEEL_RADIUS * 1.1;
  const spokeDepth = WHEEL_WIDTH + 0.014;
  const spokeAcross = new THREE.BoxGeometry(spokeLength, 0.016, spokeDepth);
  const spokeUp = new THREE.BoxGeometry(0.016, spokeLength, spokeDepth);
  return mergeGeometries([painted(tire, TIRE_COLOR), painted(hub, HUB_COLOR), painted(spokeAcross, SPOKE_COLOR), painted(spokeUp, SPOKE_COLOR)]);
}

/**
 * 四个轮子，每个单独能转
 * @param {Kit} kit
 * @param {THREE.Group} group 加到车上（不跟着车身晃）
 * @param {object} spec
 * @returns {THREE.Mesh[]}
 */
function addWheels(kit, group, { wheels }) {
  const shape = wheelGeometry();
  const placed = [];
  for (const x of wheels) {
    for (const side of [-1, 1]) {
      const wheel = kit.mesh(shape, '#ffffff', { vertexColors: true, roughness: 0.65 });
      group.add(at(wheel, x, WHEEL_Y, side * (CAR_WIDTH / 2 - WHEEL_INSET)));
      placed.push(wheel);
    }
  }
  return placed;
}

// ---------- 地上的光 ----------

/**
 * 准备车灯照在路上的光，给每辆车挂上
 * @description 车灯把车和夜里的街连在一起：一片暖光铺在车头前面，车尾红红的，车底压一块影子，车才像停在路上
 * @param {World} world
 * @returns {(model: THREE.Group) => { tailPool: THREE.Mesh }} 给一辆车挂上地上的光；tailPool 是车尾的红光，刹车时调亮
 */
export function createRoadLights(world) {
  const beamMaterial = new THREE.MeshBasicMaterial({ map: world.texture(beamTexture()), color: BEAM.color, transparent: true, opacity: BEAM.opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: softDotTexture(), color: CONTACT_SHADOW.color, transparent: true, opacity: CONTACT_SHADOW.opacity, depthWrite: false });

  return (model) => {
    const shadow = flatPlane(...CONTACT_SHADOW.size, shadowMaterial);
    const beam = flatPlane(BEAM.length, BEAM.width, beamMaterial);
    const tailMaterial = new THREE.MeshBasicMaterial({ map: softDotTexture(), color: TAIL_POOL.color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const tailPool = flatPlane(TAIL_POOL.size, TAIL_POOL.size, tailMaterial);

    model.add(at(shadow, 0, ROAD_LIGHT_LIFT, 0));
    model.add(at(beam, BEAM.start + BEAM.length / 2, ROAD_LIGHT_LIFT, 0));
    model.add(at(tailPool, -TAIL_POOL.offset, ROAD_LIGHT_LIFT, 0));
    return { tailPool };
  };
}

/**
 * 一块平躺着的方片
 * @param {number} length 沿 x 多长
 * @param {number} width 沿 z 多宽
 * @param {THREE.Material} material
 * @returns {THREE.Mesh}
 */
function flatPlane(length, width, material) {
  const geometry = new THREE.PlaneGeometry(length, width);
  geometry.rotateX(-Math.PI / 2);
  const plane = new THREE.Mesh(geometry, material);
  plane.renderOrder = 1;
  return plane;
}

/**
 * 车灯照在路上的样子：左右两束光，靠车头亮，往前慢慢淡，两束在前面叠到一起
 * @description 只画一束的话中间亮成一个刺眼的点，不像两盏车灯
 * @returns {THREE.CanvasTexture} 贴图的左边是车头那头
 */
function beamTexture() {
  return canvasTexture(BEAM_TEXTURE_PX, BEAM_TEXTURE_PX, (context, width, height) => {
    context.fillStyle = '#000000';
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';

    for (const side of [-1, 1]) {
      context.save();
      context.translate(0, height / 2 + side * height * (LAMP_SIDE / BEAM.width));
      context.scale(width, height * 0.3);
      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, 'rgba(255,255,255,0.5)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(0, 0, 1, -Math.PI / 2, Math.PI / 2);
      context.fill();
      context.restore();
    }
  });
}
