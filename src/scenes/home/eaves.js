// 两面墙顶上的房檐：从屋里看得到屋顶的边，两段在后左墙角拼成屋脊
import * as THREE from 'three';
import { at } from '../../kit.js';
import { roundedPart } from './materials.js';
import { HOUSE } from './layout.js';

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
    const shingle = roundedPart(kit, end - start, lip * 2, 0.04, EAVE.shingleColor, 0.01);
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
  const fascia = roundedPart(kit, edges.end - edges.start, 0.06, fasciaHeight, EAVE.fasciaColor, 0.02);
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
