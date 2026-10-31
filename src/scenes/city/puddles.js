// 路上的水坑：刚下过雨，路面上几摊亮亮的积水，映着旁边的霓虹和路灯
//   水坑本身是一块又暗又亮滑的面（路灯、店里的光在上面打出高光），上面叠一层映出来的彩色光，轻轻晃
//   映的光跟着电力：停电时只是黑黑的一摊水
import * as THREE from 'three';
import { canvasTexture, rng } from '../../kit.js';
import { softDotTexture } from '../../fx.js';
import { PUDDLES } from './layout.js';

// 水坑离地多高：盖过马路面和标线；映出来的光再高一点点
const PUDDLE_LIFT = 0.034;
const REFLECTION_LIFT = 0.004;
// 水面：颜色、多透明、多滑（越小高光越尖）
const WATER_COLOR = '#151a2a';
const WATER_OPACITY = 0.78;
const WATER_ROUGHNESS = 0.06;
// 映出来的光：中间亮、往边上淡（整摊一样亮看起来像一块沙子），占水坑多大，最亮时多亮，晃得多快、晃多少
const REFLECTION_SCALE = 0.8;
const REFLECTION_OPACITY = 0.75;
const SHIMMER_SPEED = 1.3;
const SHIMMER_DEPTH = 0.2;
// 水坑形状的贴图多大、几团叠成一摊
const BLOB_PX = 128;
const BLOB_LOBES = 6;
const BLOB_SEED = 61;

/**
 * 摆好所有水坑，映的光跟着电力亮
 * @param {World} world 夜都
 * @param {object} power 电力
 * @returns {{ puddles: { x: number, y: number, z: number, radius: number }[] }} 水坑在哪、水面多高、多大（踩水坑溅水花要用）
 */
export function createPuddles(world, power) {
  const blob = world.texture(blobTexture());
  const random = rng(BLOB_SEED);

  const puddles = PUDDLES.map(([x, z, size, color, line]) => {
    const turn = random() * Math.PI * 2;
    const ground = world.heightAt(x, z) + PUDDLE_LIFT;
    const water = flatMesh(size, waterMaterial(blob));
    const reflection = flatMesh(size * REFLECTION_SCALE, reflectionMaterial(color));
    world.add(water, x, ground, z, turn);
    world.add(reflection, x, ground + REFLECTION_LIFT, z, turn);
    return { x, y: ground, z, radius: size / 2, reflection, line, phase: random() * Math.PI * 2 };
  });

  power.show((levels, time) => {
    for (const puddle of puddles) {
      const shimmer = 1 - SHIMMER_DEPTH + SHIMMER_DEPTH * Math.sin(time * SHIMMER_SPEED + puddle.phase);
      puddle.reflection.material.opacity = REFLECTION_OPACITY * levels[puddle.line] * shimmer;
    }
  });

  return { puddles: puddles.map(({ x, y, z, radius }) => ({ x, y, z, radius })) };
}

/**
 * 一块平躺着的方片
 * @param {number} size 边长
 * @param {THREE.Material} material
 * @returns {THREE.Mesh}
 */
function flatMesh(size, material) {
  const geometry = new THREE.PlaneGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * 水面：暗暗的、很滑，灯光在上面打出高光
 * @param {THREE.Texture} blob 水坑的形状（白的是水）
 * @returns {THREE.MeshStandardMaterial}
 */
function waterMaterial(blob) {
  return new THREE.MeshStandardMaterial({
    color: WATER_COLOR,
    alphaMap: blob,
    transparent: true,
    opacity: WATER_OPACITY,
    roughness: WATER_ROUGHNESS,
    metalness: 0.3,
    depthWrite: false,
  });
}

/**
 * 水里映出来的彩色光：中间一团亮、往外淡，叠加上去，一开始全暗
 * @param {string} color 映的是哪种光
 * @returns {THREE.MeshBasicMaterial}
 */
function reflectionMaterial(color) {
  return new THREE.MeshBasicMaterial({
    map: softDotTexture(),
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * 水坑的形状：几团软边的椭圆叠在一起，不是一个正圆
 * @returns {THREE.CanvasTexture} 黑底白水坑
 */
function blobTexture() {
  return canvasTexture(BLOB_PX, BLOB_PX, (context, width, height) => {
    const random = rng(BLOB_SEED + 1);
    context.fillStyle = '#000000';
    context.fillRect(0, 0, width, height);

    for (let i = 0; i < BLOB_LOBES; i++) {
      const angle = (i / BLOB_LOBES) * Math.PI * 2 + random() * 0.6;
      const reach = width * (0.08 + random() * 0.12);
      const x = width / 2 + Math.cos(angle) * reach;
      const y = height / 2 + Math.sin(angle) * reach * 0.7;
      const radius = width * (0.2 + random() * 0.08);
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.75, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  });
}
