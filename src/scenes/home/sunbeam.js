// 窗户斜照进来的一束光：一道淡淡的光柱，地上一块窗格形状的亮斑，光里慢慢飘着灰尘
// 只是看的，不是真的灯（不投影、不照亮东西），叠加上去让屋里有"午后"的感觉；小人会走到亮斑里晒太阳
import * as THREE from 'three';
import { canvasTexture, rng } from '../../kit.js';
import { HOUSE, WINDOW } from './layout.js';

// 光往哪边照：往下、往屋里（+z），稍微偏右；每往下 1，往屋里走多少
const BEAM_DIRECTION = new THREE.Vector3(0.12, -1, 1.1);
const BEAM_COLOR = '#ffe7b0';
// 光柱多亮：靠窗那头最亮，到地上淡成多少（占靠窗那头的比例）
const SHAFT_OPACITY = 0.2;
const SHAFT_FLOOR_FADE = 0.25;
// 光柱每个侧面的两边淡掉多宽（占这一面的比例），贴图多大 [宽, 高]
const SHAFT_EDGE_SOFTNESS = 0.35;
const SHAFT_TEXTURE_PX = [32, 128];
// 地上的亮斑：多亮，离地多高（盖得住地毯），边多软（贴图上的像素）
const PATCH_OPACITY = 0.55;
const PATCH_LIFT = 0.045;
const PATCH_TEXTURE_PX = 128;
const PATCH_SOFTNESS = 10;
// 亮斑上窗棂留下的十字暗缝多宽（占亮斑的比例）
const PATCH_MULLION = 0.05;
// 光柱的亮度慢慢起伏（像云走过去），多慢、起伏多大
const BREATHE_SPEED = 0.35;
const BREATHE_DEPTH = 0.18;

// 灰尘：多少颗、多大，飘多快、飘多远，一闪一闪多快
const DUST_COUNT = 46;
const DUST_SIZE = 0.045;
const DUST_DRIFT = 0.12;
const DUST_DRIFT_SPEED = 0.25;
const DUST_OPACITY = 0.65;
const DUST_TWINKLE = 0.25;
const DUST_TWINKLE_SPEED = 1.3;
const DOT_TEXTURE_PX = 32;
const DUST_COLOR = '#fff6d8';
const DUST_SEED = 17;
// 晒太阳：小人站在亮斑里多久、头朝窗户
const BASK_TIME = 6;

/**
 * 摆上窗户照进来的光
 * @param {World} world 小屋这个世界
 */
export function placeSunbeam(world) {
  const corners = windowCorners();
  const landing = corners.map(landOnFloor);
  const group = new THREE.Group();

  const shaftMaterial = new THREE.MeshBasicMaterial({
    color: BEAM_COLOR,
    map: world.texture(fadeTexture()),
    transparent: true,
    opacity: SHAFT_OPACITY,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < corners.length; i++) {
    const next = (i + 1) % corners.length;
    group.add(new THREE.Mesh(shaftSide(corners[i], corners[next], landing[i], landing[next]), shaftMaterial));
  }

  const patchMaterial = new THREE.MeshBasicMaterial({
    color: BEAM_COLOR,
    map: world.texture(patchTexture()),
    transparent: true,
    opacity: PATCH_OPACITY,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  group.add(new THREE.Mesh(floorPatch(landing), patchMaterial));

  const dust = makeDust(world, corners);
  group.add(dust.points);
  world.add(group);

  world.onUpdate((dt, time) => {
    const breathe = 1 - BREATHE_DEPTH + BREATHE_DEPTH * Math.sin(time * BREATHE_SPEED);
    shaftMaterial.opacity = SHAFT_OPACITY * breathe;
    patchMaterial.opacity = PATCH_OPACITY * breathe;
    dust.update(time);
  });

  // 小人闲逛时会走到亮斑中间，朝着窗户晒太阳
  const center = landing.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(landing.length);
  world.poi(center.x, center.z, { emote: '☀', face: Math.PI, dur: BASK_TIME });
}

/**
 * 窗洞的四个角（墙的内侧面上），按顺序绕一圈：左下、右下、右上、左上
 * @returns {THREE.Vector3[]}
 */
function windowCorners() {
  const left = WINDOW.x - WINDOW.width / 2;
  const right = WINDOW.x + WINDOW.width / 2;
  const bottom = WINDOW.y - WINDOW.height / 2;
  const top = WINDOW.y + WINDOW.height / 2;
  const z = -HOUSE.wallInner;
  return [new THREE.Vector3(left, bottom, z), new THREE.Vector3(right, bottom, z), new THREE.Vector3(right, top, z), new THREE.Vector3(left, top, z)];
}

/**
 * 从窗洞的一点顺着光照下去，落在地上（亮斑的高度）的哪儿
 * @param {THREE.Vector3} point 窗洞上的一点
 * @returns {THREE.Vector3}
 */
function landOnFloor(point) {
  const drop = (point.y - PATCH_LIFT) / -BEAM_DIRECTION.y;
  return point.clone().addScaledVector(BEAM_DIRECTION, drop);
}

/**
 * 光柱的一个侧面：窗洞的一条边连到地上亮斑的对应那条边，靠窗那头 v = 1（亮）
 * @param {THREE.Vector3} windowStart 窗洞这条边的一头
 * @param {THREE.Vector3} windowEnd 另一头
 * @param {THREE.Vector3} floorStart windowStart 照到地上的地方
 * @param {THREE.Vector3} floorEnd windowEnd 照到地上的地方
 * @returns {THREE.BufferGeometry}
 */
function shaftSide(windowStart, windowEnd, floorStart, floorEnd) {
  const geometry = new THREE.BufferGeometry();
  geometry.setFromPoints([windowStart, windowEnd, floorStart, floorEnd]);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  return geometry;
}

/**
 * 地上那块亮斑：光照到地上的四个点围成的一块
 * @param {THREE.Vector3[]} landing 窗洞四个角照到地上的地方（左下、右下、右上、左上）
 * @returns {THREE.BufferGeometry}
 */
function floorPatch(landing) {
  const geometry = new THREE.BufferGeometry();
  geometry.setFromPoints(landing);
  // 贴图直接对着窗洞的四个角（亮斑的格子是对称的，正着反着都一样）
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

/**
 * 光柱的贴图：白色，靠窗那头（上边）最亮，往下淡到 SHAFT_FLOOR_FADE；左右两边也淡掉，光柱的棱不硬
 * @returns {THREE.CanvasTexture}
 */
function fadeTexture() {
  return canvasTexture(SHAFT_TEXTURE_PX[0], SHAFT_TEXTURE_PX[1], (context, width, height) => {
    const image = context.createImageData(width, height);
    for (let row = 0; row < height; row++) {
      // 画布第一行是贴图的上边（靠窗那头）
      const towardFloor = row / (height - 1);
      const lengthwise = 1 - towardFloor * (1 - SHAFT_FLOOR_FADE);
      for (let column = 0; column < width; column++) {
        const across = column / (width - 1);
        const edge = Math.min(across, 1 - across) / SHAFT_EDGE_SOFTNESS;
        const crosswise = THREE.MathUtils.smoothstep(Math.min(edge, 1), 0, 1);
        const index = (row * width + column) * 4;
        image.data.set([255, 255, 255, Math.round(255 * lengthwise * crosswise)], index);
      }
    }
    context.putImageData(image, 0, 0);
  });
}

/**
 * 亮斑的贴图：四格窗户的形状，中间留一道十字暗缝，边是软的
 * @returns {THREE.CanvasTexture}
 */
function patchTexture() {
  return canvasTexture(PATCH_TEXTURE_PX, PATCH_TEXTURE_PX, (context, width, height) => {
    const gap = width * PATCH_MULLION;
    const margin = PATCH_SOFTNESS * 1.5;
    const paneWidth = (width - margin * 2 - gap) / 2;
    const paneHeight = (height - margin * 2 - gap) / 2;

    // 用模糊的阴影画格子，边就软了
    context.shadowColor = '#ffffff';
    context.shadowBlur = PATCH_SOFTNESS;
    context.fillStyle = '#ffffff';
    for (const column of [0, 1]) {
      for (const row of [0, 1]) {
        context.fillRect(margin + column * (paneWidth + gap), margin + row * (paneHeight + gap), paneWidth, paneHeight);
      }
    }
  });
}

/**
 * 光柱里飘着的灰尘：一小把亮点，在光里慢慢绕圈、一闪一闪
 * @param {World} world 小屋这个世界
 * @param {THREE.Vector3[]} corners 窗洞的四个角
 * @returns {{ points: THREE.Points, update(time: number): void }}
 */
function makeDust(world, corners) {
  const random = rng(DUST_SEED);
  const [bottomLeft, bottomRight, , topLeft] = corners;
  const across = bottomRight.clone().sub(bottomLeft);
  const up = topLeft.clone().sub(bottomLeft);

  // 每颗灰尘在光柱里的位置：窗洞上随便一点，顺着光往下走一段
  const homes = [];
  for (let i = 0; i < DUST_COUNT; i++) {
    const start = bottomLeft.clone().addScaledVector(across, random()).addScaledVector(up, random());
    const along = random() * ((start.y - PATCH_LIFT) / -BEAM_DIRECTION.y);
    homes.push({ position: start.addScaledVector(BEAM_DIRECTION, along), phase: random() * Math.PI * 2 });
  }

  const positions = new Float32Array(DUST_COUNT * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: DUST_COLOR,
    map: world.texture(dotTexture()),
    size: DUST_SIZE,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);

  /**
   * 灰尘这一帧飘到哪儿
   * @param {number} time 世界里过了多久（秒）
   */
  const update = (time) => {
    // 三个方向的步子错开，看着是乱飘，不是绕圈
    homes.forEach((home, index) => {
      const angle = time * DUST_DRIFT_SPEED + home.phase;
      positions[index * 3] = home.position.x + Math.sin(angle) * DUST_DRIFT;
      positions[index * 3 + 1] = home.position.y + Math.sin(angle * 0.7 + 1.3) * DUST_DRIFT;
      positions[index * 3 + 2] = home.position.z + Math.cos(angle * 0.9) * DUST_DRIFT;
    });
    geometry.attributes.position.needsUpdate = true;
    material.opacity = DUST_OPACITY + Math.sin(time * DUST_TWINKLE_SPEED) * DUST_TWINKLE;
  };
  update(0);
  return { points, update };
}

/**
 * 一颗灰尘的样子：中间亮、往外淡的小圆点
 * @returns {THREE.CanvasTexture}
 */
function dotTexture() {
  return canvasTexture(DOT_TEXTURE_PX, DOT_TEXTURE_PX, (context, width, height) => {
    const gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  });
}
