// 后墙上的窗户：白窗框、十字窗棂、一层很淡的玻璃，窗台，挂在横杆上的两片窗帘
// 只造不摆；墙上的洞在 room.js 里按同一份尺寸（layout 的 WINDOW）开
import * as THREE from 'three';
import { at } from '../../kit.js';
import { roundedPart } from './materials.js';

const FRAME_COLOR = '#ffffff';
// 窗框一圈多宽、多厚；十字窗棂多粗
const FRAME_BORDER = 0.15;
const FRAME_DEPTH = 0.14;
const MULLION = 0.08;
// 玻璃：很淡，几乎看得见外面；上面两道斜斜的反光
const GLASS_COLOR = '#dff3ff';
const GLASS_OPACITY = 0.14;
const GLINT_OPACITY = 0.35;
// 反光条：[宽, 离窗洞中心多远（x）]，多长、多高（占窗洞高的比例），斜多少（弧度）
const GLINTS = [[0.12, -0.42], [0.05, -0.25]];
const GLINT_LENGTH = 0.42;
const GLINT_Y = 0.2;
const GLINT_TILT = -0.6;
// 窗台：比窗框两边多出来多少、多厚、往屋里伸多少，顶面压进窗框底边多少
const SILL = { overhang: 0.1, height: 0.12, depth: 0.3, overlap: 0.03 };
// 窗帘：多宽、多长，中心离窗洞边多远，离墙多远；横杆比窗框高多少、两头多伸出去多少
const CURTAIN = { width: 0.45, length: 1.9, thickness: 0.1, color: '#f6a6b8', offset: 0.15, forward: 0.18 };
const ROD = { lift: 0.1, overhang: 0.25, radius: 0.03, color: '#c48a54' };
// 窗帘上几道褶子
const CURTAIN_FOLDS = 4;
// 窗帘中间系着的绑带：离横杆多远，多大
const TIE_DROP = 1.25;
const TIE_RADIUS = 0.1;
const TIE_COLOR = '#f4a259';

/**
 * 造一扇窗户
 * @description 原点在窗洞中心、墙的内侧面上，朝 +z（屋里）
 * @param {Kit} kit 造型工具箱
 * @param {{ width: number, height: number }} opening 窗洞多宽多高
 * @returns {{ group: THREE.Group, curtains: THREE.Group[] }} 窗户；两片窗帘（原点在横杆上，风吹时绕它晃）
 */
export function buildWindow(kit, opening) {
  const group = new THREE.Group();
  addFrame(kit, group, opening);
  addGlass(kit, group, opening);

  const sillWidth = opening.width + FRAME_BORDER * 2 + SILL.overhang * 2;
  const sillY = -opening.height / 2 - FRAME_BORDER - SILL.height / 2 + SILL.overlap;
  group.add(at(roundedPart(kit, sillWidth, SILL.height, SILL.depth, FRAME_COLOR, 0.04), 0, sillY, SILL.depth / 2 - SILL.overlap));

  const curtains = addCurtains(kit, group, opening);
  return { group, curtains };
}

/**
 * 窗框（四根边框，中间是空的，看得到外面）和十字窗棂
 * @param {Kit} kit
 * @param {THREE.Group} group 加到窗户里
 * @param {{ width: number, height: number }} opening
 */
function addFrame(kit, group, opening) {
  const outerWidth = opening.width + FRAME_BORDER * 2;
  const sideY = opening.height / 2 + FRAME_BORDER / 2;
  const sideX = opening.width / 2 + FRAME_BORDER / 2;

  for (const sign of [-1, 1]) {
    group.add(at(roundedPart(kit, outerWidth, FRAME_BORDER, FRAME_DEPTH, FRAME_COLOR, 0.04), 0, sign * sideY, 0));
    group.add(at(roundedPart(kit, FRAME_BORDER, opening.height, FRAME_DEPTH, FRAME_COLOR, 0.04), sign * sideX, 0, 0));
  }
  group.add(at(roundedPart(kit, MULLION, opening.height, MULLION, FRAME_COLOR, 0.02), 0, 0, 0));
  group.add(at(roundedPart(kit, opening.width, MULLION, MULLION, FRAME_COLOR, 0.02), 0, 0, 0));
}

/**
 * 一层很淡的玻璃，加两道斜着的反光，一看就知道窗户是关着的
 * @param {Kit} kit
 * @param {THREE.Group} group
 * @param {{ width: number, height: number }} opening
 */
function addGlass(kit, group, opening) {
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(opening.width, opening.height),
    new THREE.MeshStandardMaterial({ color: GLASS_COLOR, transparent: true, opacity: GLASS_OPACITY, roughness: 0.1, depthWrite: false }),
  );
  glass.position.z = -MULLION / 4;
  group.add(glass);

  const glintMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: GLINT_OPACITY, depthWrite: false });
  // 两道反光：一宽一窄，斜着划过左上那格
  for (const [width, x] of GLINTS) {
    const glint = new THREE.Mesh(new THREE.PlaneGeometry(width, opening.height * GLINT_LENGTH), glintMaterial);
    glint.position.set(x, opening.height * GLINT_Y, glass.position.z + 0.002);
    glint.rotation.z = GLINT_TILT;
    group.add(glint);
  }
}

/**
 * 一片有褶子的窗帘：几根竖着的半圆筒并排，深浅交替，看着像一道道布褶
 * @param {Kit} kit
 * @returns {THREE.Group} 原点在顶上中间，往下垂
 */
function pleatedPanel(kit) {
  const panel = new THREE.Group();
  const foldWidth = CURTAIN.width / CURTAIN_FOLDS;
  const shade = new THREE.Color(CURTAIN.color).offsetHSL(0, 0, -0.05);
  for (let i = 0; i < CURTAIN_FOLDS; i++) {
    const color = i % 2 === 0 ? CURTAIN.color : `#${shade.getHexString()}`;
    const fold = kit.cyl(foldWidth * 0.62, foldWidth * 0.68, CURTAIN.length, color, 10);
    fold.scale.z = CURTAIN.thickness / foldWidth;
    panel.add(at(fold, -CURTAIN.width / 2 + foldWidth * (i + 0.5), -CURTAIN.length / 2, 0));
  }
  // 顶上一道窄窄的布边，把褶子收在一起
  panel.add(at(roundedPart(kit, CURTAIN.width + 0.02, 0.08, CURTAIN.thickness + 0.02, CURTAIN.color, 0.03), 0, -0.04, 0));
  return panel;
}

/**
 * 横杆和挂在两边的窗帘，窗帘中间系一根绑带
 * @param {Kit} kit
 * @param {THREE.Group} group
 * @param {{ width: number, height: number }} opening
 * @returns {THREE.Group[]} 两片窗帘，原点在横杆上
 */
function addCurtains(kit, group, opening) {
  const rodY = opening.height / 2 + FRAME_BORDER + ROD.lift;
  const rodLength = opening.width + FRAME_BORDER * 2 + ROD.overhang * 2 + CURTAIN.width;
  const rod = kit.cyl(ROD.radius, ROD.radius, rodLength, ROD.color, 10);
  rod.rotation.z = Math.PI / 2;
  group.add(at(rod, 0, rodY, CURTAIN.forward));
  for (const sign of [-1, 1]) {
    group.add(at(kit.sphere(ROD.radius * 2, ROD.color, 10), sign * rodLength / 2, rodY, CURTAIN.forward));
  }

  return [-1, 1].map((sign) => {
    const curtain = new THREE.Group();
    curtain.add(pleatedPanel(kit));
    curtain.add(at(kit.torus(TIE_RADIUS, TIE_RADIUS * 0.3, TIE_COLOR), 0, -TIE_DROP, CURTAIN.thickness / 2 + 0.01));
    const sideX = opening.width / 2 + FRAME_BORDER + CURTAIN.offset;
    group.add(at(curtain, sign * sideX, rodY, CURTAIN.forward));
    return curtain;
  });
}
