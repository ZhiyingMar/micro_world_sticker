// 森林的地面：圆润的地形，草地一片深一片浅，上面一条条弯弯的土路
import * as THREE from 'three';
import { buildSoftTerrain } from '../../terrain-soft.js';
import { distanceToPath, PATH_HALF_WIDTH } from './paths.js';

// 草地：深浅两种绿，大片的斑块（阳光照到的、树荫下的）加细碎的深浅
const GRASS_LIGHT = new THREE.Color('#b6e58c');
const GRASS_DARK = new THREE.Color('#8ccd69');
const FINE_NOISE = 0.08;
// 越高的地方越亮一点点（山顶晒得到太阳）
const LEVEL_LIGHTEN = 0.03;
// 土路：路面颜色、路边颜色，路边和草地之间渐变多宽，路边起伏多少
const PATH_COLOR = new THREE.Color('#ead5a6');
const PATH_EDGE_COLOR = new THREE.Color('#d2b884');
const PATH_FADE = 0.09;
const PATH_WOBBLE = 0.05;

const LOOK = {
  grass: paintGrass,
  strata: ['#c99a6b', '#b8875a', '#d6ab7a', '#a97b52'],
  bed: '#79b9a6',
  water: '#86d4e6',
  ripple: '#e2f8ff',
  stone: '#c3bdb0',
  plank: '#b98a5a',
};

// 每个顶点都要算一次颜色，反复用同一个
const paint = new THREE.Color();
const road = new THREE.Color();

/**
 * 画森林的地面
 * @param {World} world 童话森林
 * @returns {{ waterSurface: number, heightAt: Function }} 水面多高、画出来的地面多高
 */
export function buildGround(world) {
  return buildSoftTerrain(world, LOOK);
}

/**
 * 草地上一点的颜色：深浅斑块，路上是土色
 * @param {number} x
 * @param {number} z
 * @param {number} level 高度层
 * @returns {THREE.Color}
 */
function paintGrass(x, z, level) {
  // 两组斜着交叉的波，叠出一大片一大片的深浅；再加一点细碎的
  const patches = 0.5 + 0.25 * Math.sin(x * 0.9 + Math.sin(z * 0.6) * 1.7) + 0.25 * Math.sin(z * 1.15 - x * 0.45 + 1.3);
  const fine = Math.sin(x * 5.3) * Math.sin(z * 4.7) * FINE_NOISE;
  const light = THREE.MathUtils.clamp(patches + fine + level * LEVEL_LIGHTEN, 0, 1);
  paint.copy(GRASS_DARK).lerp(GRASS_LIGHT, light);

  // 路边弯弯曲曲的，不是尺子画的
  const edge = PATH_HALF_WIDTH + Math.sin(x * 3.1 + z * 2.3) * PATH_WOBBLE;
  const outside = distanceToPath(x, z) - edge;
  if (outside > PATH_FADE) {
    return paint;
  }

  // 路中间浅，靠路边深一点，再往外渐渐变成草
  road.copy(PATH_COLOR).lerp(PATH_EDGE_COLOR, THREE.MathUtils.smoothstep(outside, -PATH_FADE * 2, 0));
  const roadiness = 1 - THREE.MathUtils.smoothstep(outside, -PATH_FADE, PATH_FADE);
  return paint.lerp(road, roadiness);
}
