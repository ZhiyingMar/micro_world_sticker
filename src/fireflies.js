// 萤火虫：天黑以后在花丛、灌木上慢慢飘，一闪一闪；只是看的，不挡路，也不会被点到
// 小屋花园先用；森林以后做"抓萤火虫"可以接着用
import * as THREE from 'three';
import { rng } from './kit.js';
import { glow } from './fx.js';

// 每个地方飘几只
const PER_SPOT = 2;
// 绕着那个地方飘多大一圈、离地多高、上下浮多少、飘多快（弧度 / 秒）
const DRIFT_RADIUS = [0.25, 0.7];
const FLY_HEIGHT = [0.25, 0.9];
const BOB = 0.15;
const DRIFT_SPEED = [0.15, 0.35];
// 一闪一闪：亮暗一个来回的快慢（弧度 / 秒），每只不一样，看着不像一起呼吸
const BLINK_SPEED = [1.2, 2.2];
// 光点：外面一圈柔光、中间一个小亮点，偏绿的暖黄。比真的萤火虫画大，拉近玩的时候也看得到
const HALO = { color: '#d8ff7a', size: 0.45, opacity: 0.55 };
const CORE = { color: '#fbffd0', size: 0.12, opacity: 1 };

/**
 * 在几个地方放上萤火虫，一开始看不见，天黑了再出来
 * @param {World} world 放在哪个世界
 * @param {{ x: number, z: number, y: number }[]} spots 萤火虫绕着飘的地方，y 是那里的地面高度
 * @param {number} seed 随机种子：每只飘多大圈、多快，每次进来都一样
 * @returns {{ setPresence(level: number): void }} 出来多少（0 全藏起来 ~ 1 全亮）
 */
export function createFireflies(world, spots, seed) {
  const random = rng(seed);
  const between = ([low, high]) => low + random() * (high - low);
  const group = new THREE.Group();
  world.root.add(group);

  const swarm = [];
  for (const spot of spots) {
    for (let i = 0; i < PER_SPOT; i++) {
      const halo = glow(HALO.color, HALO.size, 0);
      const core = glow(CORE.color, CORE.size, 0);
      group.add(halo, core);
      swarm.push({
        halo,
        core,
        spot,
        radius: between(DRIFT_RADIUS),
        height: between(FLY_HEIGHT),
        speed: between(DRIFT_SPEED),
        blinkSpeed: between(BLINK_SPEED),
        phase: random() * Math.PI * 2,
      });
    }
  }

  let presence = 0;
  group.visible = false;
  world.onUpdate((dt, time) => {
    if (!group.visible) {
      return;
    }
    for (const firefly of swarm) {
      drift(firefly, time, presence);
    }
  });

  const setPresence = (level) => {
    presence = level;
    group.visible = level > 0;
  };
  return { setPresence };
}

/**
 * 一只萤火虫这一帧在哪、多亮
 * @param {object} firefly createFireflies 里的一只
 * @param {number} time 世界里过了多久（秒）
 * @param {number} presence 天黑了多少（0~1），整群一起淡入淡出
 */
function drift(firefly, time, presence) {
  const angle = time * firefly.speed + firefly.phase;
  // 横着走一个歪歪扭扭的圈，上下慢慢浮，看着像在找路
  const x = firefly.spot.x + Math.cos(angle) * firefly.radius;
  const z = firefly.spot.z + Math.sin(angle * 1.3) * firefly.radius;
  const y = firefly.spot.y + firefly.height + Math.sin(angle * 2.1) * BOB;
  firefly.halo.position.set(x, y, z);
  firefly.core.position.set(x, y, z);

  // 亮的时候慢慢亮起来、慢慢暗下去，有一半时间是暗的
  const pulse = Math.max(0, Math.sin(time * firefly.blinkSpeed + firefly.phase));
  const brightness = pulse * pulse * presence;
  firefly.halo.material.opacity = HALO.opacity * brightness;
  firefly.core.material.opacity = CORE.opacity * brightness;
}
