// 房间本身：地板、后墙和左墙、墙裙顶线、窗户、墙上的画和时钟，换壁纸地板时只换它们的贴图
import * as THREE from 'three';
import { at } from '../../kit.js';
import { makeStarField } from '../../fx.js';
import { currentDecor, decorTexture } from '../../decor.js';
import { WOOD_DARK } from './furniture.js';

// 星空壁纸时外面那片星星：撒在多远的球壳上，按整个方块对角线的倍数算（最近也要在花园外面）
const STAR_SHELL_NEAR = 0.8;
const STAR_SHELL_FAR = 3.5;
// 撒在镜头正对面多大的锥形里（半角，弧度）：盖住镜头左右转、上下转能看到的范围
const STAR_SPREAD = 1.2;
const STAR_SEED = 11;

/**
 * 搭小屋的地板、墙和墙上的摆设
 * @description 壁纸、地板、墙裙用的是小屋自己的材质，工作台上换装修时只换它们的贴图和颜色，不用重新搭
 * @param {World} w 小屋这个世界
 * @returns {{ applyDecor(kind: string, entry: object): void }} 换装修用的小接口
 */
export function buildRoom(w) {
  const k = w.kit;
  // 地板方块
  const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.75 });
  const floor = k.mesh(new THREE.BoxGeometry(9.6, 0.3, 9.6), floorMat);
  w.add(floor, 0, -0.15, 0);
  w.add(k.box(9.9, 0.9, 9.9, WOOD_DARK, 0.15), 0, -0.72, 0);

  // 两面墙共用一份壁纸材质，换壁纸时一起换
  const wpMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const back = k.mesh(new THREE.BoxGeometry(9.6, 4.2, 0.3), wpMat);
  w.add(back, 0, 2.1, -4.65);
  const left = k.mesh(new THREE.BoxGeometry(0.3, 4.2, 9.6), wpMat);
  w.add(left, -4.65, 2.1, 0);
  // 墙裙 + 顶线（墙裙颜色跟着壁纸配）
  const wainscotMat = new THREE.MeshStandardMaterial({ roughness: 0.82 });
  w.add(k.box(9.6, 1.1, 0.06, wainscotMat, 0.02), 0, 0.55, -4.48);
  w.add(k.box(0.06, 1.1, 9.6, wainscotMat, 0.02), -4.48, 0.55, 0);
  w.add(k.box(9.7, 0.08, 0.1, '#ffffff', 0.03), 0, 1.12, -4.47);
  w.add(k.box(0.1, 0.08, 9.7, '#ffffff', 0.03), -4.47, 1.12, 0);
  w.add(k.box(9.9, 0.22, 0.42, '#e7c9a0', 0.08), 0, 4.25, -4.65);
  w.add(k.box(0.42, 0.22, 9.9, '#e7c9a0', 0.08), -4.65, 4.25, 0);

  // 窗户
  const win = new THREE.Group();
  win.add(k.box(2.1, 1.7, 0.14, '#ffffff', 0.05));
  const glass = k.box(1.8, 1.4, 0.05, '#bfe8ff', 0.02, { emissive: '#bfe8ff', emissiveIntensity: 0.8 });
  glass.position.z = 0.05;
  win.add(glass);
  win.add(at(k.box(0.08, 1.4, 0.08, '#ffffff', 0.02), 0, 0, 0.09));
  win.add(at(k.box(1.8, 0.08, 0.08, '#ffffff', 0.02), 0, 0, 0.09));
  win.add(at(k.box(2.3, 0.12, 0.3, '#ffffff', 0.04), 0, -0.88, 0.12));
  for (const s of [-1, 1]) {
    const curtain = k.box(0.45, 1.9, 0.1, '#f6a6b8', 0.05);
    curtain.position.set(s * 1.2, -0.05, 0.18);
    win.add(curtain);
    const tie = k.torus(0.1, 0.03, '#f4a259');
    tie.position.set(s * 1.2, -0.3, 0.24);
    win.add(tie);
  }
  w.add(win, 1.5, 2.45, -4.45);
  // 窗台上的小盆栽
  const sill = new THREE.Group();
  sill.add(k.cyl(0.11, 0.08, 0.16, '#e07a5f', 14));
  const leaf = k.sphere(0.13, '#7cc576', 12);
  leaf.position.y = 0.15;
  sill.add(leaf);
  w.add(sill, 2.2, 1.66, -4.25);

  // 墙上的画 & 时钟
  const frame = new THREE.Group();
  frame.add(k.box(1.1, 0.85, 0.08, '#c48a54', 0.04));
  const art = k.box(0.9, 0.65, 0.04, '#bde3f2', 0.01);
  art.position.z = 0.04;
  frame.add(art);
  const hill = k.sphere(0.3, '#8fd17f', 16);
  hill.scale.set(1.4, 0.6, 0.1);
  hill.position.set(-0.1, -0.25, 0.07);
  frame.add(hill);
  const sun = k.sphere(0.09, '#ffd84a', 12);
  sun.scale.z = 0.2;
  sun.position.set(0.25, 0.15, 0.07);
  frame.add(sun);
  w.add(frame, -3.3, 2.75, -4.47);

  const clock = new THREE.Group();
  const face = k.cyl(0.38, 0.38, 0.08, '#fffaf0', 24);
  face.rotation.z = Math.PI / 2;
  const rim = k.torus(0.38, 0.05, '#f4a259');
  rim.rotation.y = Math.PI / 2;
  const hand1 = k.box(0.02, 0.24, 0.03, '#6b4f3a', 0.005);
  hand1.position.set(0.05, 0.1, 0);
  const hand2 = k.box(0.02, 0.18, 0.03, '#6b4f3a', 0.005);
  hand2.position.set(0.05, 0.06, 0.05);
  hand2.rotation.x = 1.2;
  clock.add(face, rim, hand1, hand2);
  w.add(clock, -4.45, 2.9, -0.4);
  w.onUpdate((dt) => {
    hand1.rotation.x -= dt * 0.4;
  });

  const stars = placeBackdropStars(w);

  /**
   * 换上一款壁纸或地板
   * @param {'wallpaper' | 'floor'} kind 哪一类
   * @param {object} entry 装修目录里的一款
   */
  const applyDecor = (kind, entry) => {
    const material = kind === 'wallpaper' ? wpMat : floorMat;
    // 旧贴图还挂在世界的贴图表里，离开小屋时一起释放；这里先放掉，换来换去不攒显存
    material.map?.dispose();
    material.map = w.texture(decorTexture(kind, entry));
    material.needsUpdate = true;

    if (kind === 'wallpaper') {
      wainscotMat.color.set(entry.wainscot);
      w.setBackdrop(entry.backdrop);
      stars.group.visible = !!entry.backdropStars;
    }
  };

  applyDecor('wallpaper', currentDecor('wallpaper'));
  applyDecor('floor', currentDecor('floor'));
  return { applyDecor };
}

/**
 * 小屋外面那片星星，先藏着，换上星空壁纸时才露出来
 * @description 星星撒在镜头背后那半边的远处，转镜头时远近星星错开移动，小屋才像真的飘在夜空里
 * @param {World} w 小屋这个世界
 * @returns {{ group: THREE.Group, update(t: number): void }} makeStarField 的结果
 */
function placeBackdropStars(w) {
  const { pos, target } = w.def.camera;
  const towardCamera = new THREE.Vector3(...pos).sub(new THREE.Vector3(...target));
  const worldDiagonal = Math.hypot(...w.size);
  const stars = makeStarField({
    away: towardCamera,
    spread: STAR_SPREAD,
    near: worldDiagonal * STAR_SHELL_NEAR,
    far: worldDiagonal * STAR_SHELL_FAR,
    seed: STAR_SEED,
  });

  stars.group.visible = false;
  w.add(stars.group);
  w.onUpdate((dt, t) => {
    if (stars.group.visible) {
      stars.update(t);
    }
  });
  return stars;
}
