// 一下子蹦出来的小方块：小鸡受惊掉的羽毛、灌木被碰到抖下来的叶子
// 一开始做好一批反复用，不会越蹦越多；只是看的，不挡路
import * as THREE from 'three';

// 一次最多几块，多大；往外、往上蹦多快，往下掉多快，转多快；一块最多飘多久（秒）
const BIT_POOL = 36;
const BIT_SIZE = 0.05;
const BIT_OUTWARD = [0.3, 0.8];
const BIT_UPWARD = [0.8, 1.5];
const GRAVITY = 4;
const BIT_SPIN = 8;
const BIT_LIFE = 1.4;
// 羽毛、叶子很轻：往下掉最快也就这么快，是飘着下来的
const MAX_FALL_SPEED = 0.6;

/**
 * 准备好一批小方块
 * @param {World} world 像素小镇
 * @returns {{ burst(x: number, y: number, z: number, colors: string[], count: number): void }}
 */
export function createBits(world) {
  const geometry = new THREE.BoxGeometry(BIT_SIZE, BIT_SIZE, BIT_SIZE);
  const bits = Array.from({ length: BIT_POOL }, () => {
    const mesh = new THREE.Mesh(geometry, world.kit.m('#ffffff'));
    mesh.visible = false;
    world.root.add(mesh);
    return { mesh, velocity: new THREE.Vector3(), spin: new THREE.Vector3(), age: 0, floor: 0 };
  });

  world.onUpdate((dt) => {
    for (const bit of bits) {
      updateBit(bit, dt);
    }
  });

  return {
    /**
     * 在 (x, y, z) 蹦出几块小方块，落到 y 就没了
     * @param {number} x
     * @param {number} y 地面多高
     * @param {number} z
     * @param {string[]} colors 轮流用哪几种颜色
     * @param {number} count 几块
     */
    burst(x, y, z, colors, count) {
      for (let i = 0; i < count; i++) {
        const bit = bits.find((candidate) => !candidate.mesh.visible) ?? oldest(bits);
        launch(world, bit, x, y, z, colors[i % colors.length]);
      }
    },
  };
}

/**
 * 把一块小方块往外、往上抛出去
 * @param {World} world
 * @param {object} bit
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {string} color
 */
function launch(world, bit, x, y, z, color) {
  const angle = Math.random() * Math.PI * 2;
  const outward = BIT_OUTWARD[0] + Math.random() * (BIT_OUTWARD[1] - BIT_OUTWARD[0]);
  const upward = BIT_UPWARD[0] + Math.random() * (BIT_UPWARD[1] - BIT_UPWARD[0]);
  bit.velocity.set(Math.cos(angle) * outward, upward, Math.sin(angle) * outward);
  bit.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(BIT_SPIN);
  bit.mesh.material = world.kit.m(color);
  bit.mesh.position.set(x, y + BIT_SIZE, z);
  bit.mesh.visible = true;
  bit.age = 0;
  bit.floor = y;
}

/**
 * 小方块往下飘，落地或者飘够了就藏起来
 * @param {object} bit
 * @param {number} dt
 */
function updateBit(bit, dt) {
  if (!bit.mesh.visible) {
    return;
  }

  bit.age += dt;
  bit.velocity.y = Math.max(bit.velocity.y - GRAVITY * dt, -MAX_FALL_SPEED);
  bit.mesh.position.addScaledVector(bit.velocity, dt);
  bit.mesh.rotation.x += bit.spin.x * dt;
  bit.mesh.rotation.y += bit.spin.y * dt;
  bit.mesh.rotation.z += bit.spin.z * dt;

  const landed = bit.velocity.y < 0 && bit.mesh.position.y < bit.floor;
  if (landed || bit.age > BIT_LIFE) {
    bit.mesh.visible = false;
  }
}

/**
 * 都在用的时候，挑用得最久的那块拿来重用
 * @param {{ age: number }[]} pool
 * @returns {object}
 */
function oldest(pool) {
  return pool.reduce((older, candidate) => (candidate.age > older.age ? candidate : older));
}
