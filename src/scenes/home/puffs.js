// 一小团一小团软软的雾：茶壶冒的热气、撞到家具扬起的灰、盆栽抖落的叶子屑
// 和捡东西时那种发亮的星星不一样（那是"能捡"的信号），这里是不发光的圆点，慢慢胀大、变淡
import * as THREE from 'three';
import { softDotTexture } from '../../fx.js';

// 一团雾最开始多大（占 size 的比例），散开时变大到多少倍
const START_SCALE = 0.4;
const GROW = 1.8;

/**
 * @typedef {object} PuffOptions
 * @property {number} [count] 一次冒几团
 * @property {string} [color] 颜色
 * @property {number} [size] 一团多大（世界单位）
 * @property {number} [spread] 从中心往四周散开的范围
 * @property {number} [rise] 往上飘多快（每秒）
 * @property {number} [life] 一团多久消失（秒）
 * @property {number} [opacity] 最浓的时候多不透明
 */

/**
 * 准备好冒雾的小工具，挂在世界上每帧更新
 * @param {World} world 小屋这个世界
 * @returns {{ emit(position: THREE.Vector3, options?: PuffOptions): void }}
 */
export function createPuffs(world) {
  const group = new THREE.Group();
  world.add(group);
  const live = [];

  /**
   * 在一个地方冒几团雾
   * @param {THREE.Vector3} position 从哪儿冒（世界里的位置）
   * @param {PuffOptions} [options]
   */
  const emit = (position, { count = 3, color = '#ffffff', size = 0.18, spread = 0.08, rise = 0.35, life = 1.4, opacity = 0.5 } = {}) => {
    for (let i = 0; i < count; i++) {
      const material = new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, opacity: 0, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(position.x + (Math.random() - 0.5) * spread * 2, position.y, position.z + (Math.random() - 0.5) * spread * 2);
      group.add(sprite);
      live.push({
        sprite,
        age: 0,
        life: life * (0.75 + Math.random() * 0.5),
        size: size * (0.75 + Math.random() * 0.5),
        opacity,
        velocity: new THREE.Vector3((Math.random() - 0.5) * spread, rise * (0.7 + Math.random() * 0.6), (Math.random() - 0.5) * spread),
      });
    }
  };

  world.onUpdate((dt) => {
    for (let i = live.length - 1; i >= 0; i--) {
      const puff = live[i];
      puff.age += dt;
      const progress = puff.age / puff.life;
      if (progress >= 1) {
        group.remove(puff.sprite);
        puff.sprite.material.dispose();
        live.splice(i, 1);
        continue;
      }

      puff.sprite.position.addScaledVector(puff.velocity, dt);
      puff.sprite.scale.setScalar(puff.size * (START_SCALE + progress * GROW));
      // 一冒出来很快变浓，然后慢慢淡掉
      puff.sprite.material.opacity = puff.opacity * Math.sin(Math.min(1, progress * 3) * Math.PI / 2) * (1 - progress);
    }
  });
  return { emit };
}
