// 水面上的反应：一圈圈往外散的波纹、溅起来又落回去的水珠
// 踩踏脚石、鱼跳出水面都用它。东西是一开始就做好一批反复用的，不会越溅越多
import * as THREE from 'three';

// 波纹：一次最多几圈，散多久（秒），从多大散到多大（相对 size），一开始多透明
const RING_POOL = 12;
const RING_LIFE = 0.9;
const RING_GROW = [0.35, 1];
const RING_OPACITY = 0.9;
// 波纹圈的粗细（占半径的比例）、离水面多高（免得和水面闪着打架）
const RING_WIDTH = 0.16;
const RING_LIFT = 0.005;
// 水珠：一次最多几颗，多大，往外、往上溅多快，往下掉多快
const DROP_POOL = 40;
const DROP_RADIUS = 0.035;
const DROP_OUTWARD = [0.4, 0.9];
const DROP_UPWARD = [1.0, 1.7];
const GRAVITY = 6;
const WATER_WHITE = '#f2fbff';

/**
 * 准备好水面上的波纹和水珠
 * @param {World} world 童话森林
 * @param {number} waterSurface 水面多高
 * @returns {{ ripple(x: number, z: number, size: number): void, splash(x: number, z: number, count: number): void }}
 */
export function createSplashes(world, waterSurface) {
  const rings = ringPool(world);
  const drops = dropPool(world);

  world.onUpdate((dt) => {
    for (const ring of rings) {
      updateRing(ring, dt);
    }
    for (const drop of drops) {
      updateDrop(drop, dt, waterSurface);
    }
  });

  return {
    /**
     * 在水面 (x, z) 散开一圈波纹
     * @param {number} x
     * @param {number} z
     * @param {number} size 散到最大时的半径
     */
    ripple(x, z, size) {
      const ring = rings.find((candidate) => !candidate.mesh.visible) ?? oldest(rings);
      ring.mesh.position.set(x, waterSurface + RING_LIFT, z);
      ring.mesh.visible = true;
      ring.size = size;
      ring.age = 0;
    },
    /**
     * 在 (x, z) 溅起几颗水珠
     * @param {number} x
     * @param {number} z
     * @param {number} count 几颗
     */
    splash(x, z, count) {
      for (let i = 0; i < count; i++) {
        const drop = drops.find((candidate) => !candidate.mesh.visible) ?? oldest(drops);
        launch(drop, x, waterSurface, z);
      }
    },
  };
}

/**
 * 一批波纹圈：平躺在水面上的细圆环
 * @param {World} world
 * @returns {{ mesh: THREE.Mesh, size: number, age: number }[]}
 */
function ringPool(world) {
  const geometry = new THREE.RingGeometry(1 - RING_WIDTH, 1, 32).rotateX(-Math.PI / 2);
  return Array.from({ length: RING_POOL }, () => {
    const material = new THREE.MeshBasicMaterial({ color: WATER_WHITE, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    world.root.add(mesh);
    return { mesh, size: 1, age: 0 };
  });
}

/**
 * 一批水珠：小小的白球
 * @param {World} world
 * @returns {{ mesh: THREE.Mesh, velocity: THREE.Vector3, age: number }[]}
 */
function dropPool(world) {
  const geometry = new THREE.SphereGeometry(DROP_RADIUS, 6, 4);
  const material = new THREE.MeshBasicMaterial({ color: WATER_WHITE, transparent: true, opacity: 0.85 });
  return Array.from({ length: DROP_POOL }, () => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    world.root.add(mesh);
    return { mesh, velocity: new THREE.Vector3(), age: 0 };
  });
}

/**
 * 一圈波纹往外散，越散越淡，散完藏起来
 * @param {{ mesh: THREE.Mesh, size: number, age: number }} ring
 * @param {number} dt 这一帧多少秒
 */
function updateRing(ring, dt) {
  if (!ring.mesh.visible) {
    return;
  }

  ring.age += dt;
  const progress = ring.age / RING_LIFE;
  if (progress >= 1) {
    ring.mesh.visible = false;
    return;
  }

  // 一开始散得快，后来慢下来
  const eased = 1 - (1 - progress) ** 2;
  ring.mesh.scale.setScalar(ring.size * (RING_GROW[0] + (RING_GROW[1] - RING_GROW[0]) * eased));
  ring.mesh.material.opacity = RING_OPACITY * (1 - progress);
}

/**
 * 把一颗水珠从水面往外、往上抛出去
 * @param {{ mesh: THREE.Mesh, velocity: THREE.Vector3, age: number }} drop
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
function launch(drop, x, y, z) {
  const angle = Math.random() * Math.PI * 2;
  const outward = DROP_OUTWARD[0] + Math.random() * (DROP_OUTWARD[1] - DROP_OUTWARD[0]);
  const upward = DROP_UPWARD[0] + Math.random() * (DROP_UPWARD[1] - DROP_UPWARD[0]);
  drop.velocity.set(Math.cos(angle) * outward, upward, Math.sin(angle) * outward);
  drop.mesh.position.set(x, y, z);
  drop.mesh.visible = true;
  drop.age = 0;
}

/**
 * 水珠往下掉，落回水面就藏起来
 * @param {{ mesh: THREE.Mesh, velocity: THREE.Vector3, age: number }} drop
 * @param {number} dt
 * @param {number} waterSurface
 */
function updateDrop(drop, dt, waterSurface) {
  if (!drop.mesh.visible) {
    return;
  }

  drop.age += dt;
  drop.velocity.y -= GRAVITY * dt;
  drop.mesh.position.addScaledVector(drop.velocity, dt);
  const falling = drop.velocity.y < 0;
  if (falling && drop.mesh.position.y < waterSurface) {
    drop.mesh.visible = false;
  }
}

/**
 * 都在用的时候，挑用得最久的那个拿来重用
 * @param {{ age: number }[]} pool
 * @returns {object}
 */
function oldest(pool) {
  return pool.reduce((older, candidate) => (candidate.age > older.age ? candidate : older));
}
