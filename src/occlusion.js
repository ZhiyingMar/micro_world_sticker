// 挡住人的楼变半透明：镜头不动，挡在镜头和人中间的大件慢慢淡下去，走开了再恢复
// 哪些东西会淡由世界自己登记（world.fadeable），一般只登记楼这种大件，树和路灯不管
import * as THREE from 'three';

// 淡到多透明
const FADED_OPACITY = 0.22;
// 淡下去 / 恢复有多快（越大越快）
const FADE_SPEED = 8;
// 看人身上的哪几处：脚边和头顶，挡住任何一处都算挡住
const CHECK_HEIGHTS = [0.3, 1.1];
// 射线停在人前面一点，别把人脚下的地面也算进去
const NEAR_PLAYER = 0.3;

const raycaster = new THREE.Raycaster();
const lookAt = new THREE.Vector3();
const direction = new THREE.Vector3();

/**
 * 每帧更新：挡住人的楼淡下去，没挡的恢复
 * @param {World} world 当前世界
 * @param {THREE.Camera} camera 镜头
 * @param {Villager|null} player 玩家；玩小游戏、没有人时传 null，全部恢复
 * @param {number} dt 这一帧过了多久（秒）
 */
export function updateOccluders(world, camera, player, dt) {
  if (!world.fadeables.length) {
    return;
  }

  const blocking = player ? findBlocking(world, camera, player) : new Set();
  const step = 1 - Math.exp(-dt * FADE_SPEED);

  for (const object of world.fadeables) {
    const target = blocking.has(object) ? FADED_OPACITY : 1;
    const current = object.userData.fade;
    if (current === target) {
      continue;
    }

    let next = current + (target - current) * step;
    if (Math.abs(next - target) < 0.01) {
      next = target;
    }
    object.userData.fade = next;
    applyFade(object, next);
  }
}

/**
 * 找出挡在镜头和人中间的那几栋
 * @param {World} world
 * @param {THREE.Camera} camera
 * @param {Villager} player
 * @returns {Set<THREE.Object3D>} 挡住人的、登记过的大件
 */
function findBlocking(world, camera, player) {
  const blocking = new Set();
  const roots = new Set(world.fadeables);

  for (const height of CHECK_HEIGHTS) {
    player.root.getWorldPosition(lookAt);
    lookAt.y += height;
    direction.subVectors(lookAt, camera.position);
    const distance = direction.length();
    raycaster.set(camera.position, direction.normalize());
    raycaster.far = distance - NEAR_PLAYER;

    for (const hit of raycaster.intersectObjects(world.fadeables, true)) {
      const root = fadeableRoot(hit.object, roots);
      if (root) {
        blocking.add(root);
      }
    }
  }
  return blocking;
}

/**
 * 从被射线碰到的网格往上找，找到它属于哪个登记过的大件
 * @param {THREE.Object3D} object 被碰到的网格
 * @param {Set<THREE.Object3D>} roots 登记过的大件
 * @returns {THREE.Object3D|null}
 */
function fadeableRoot(object, roots) {
  for (let node = object; node; node = node.parent) {
    if (roots.has(node)) {
      return node;
    }
  }
  return null;
}

/**
 * 把一个大件下面所有的网格淡到某个程度
 * @description 第一次淡的时候记下材质原来的透明度（招牌本来就是半透明的），恢复时还原；
 *   淡下去时不写深度，后面的东西和人才画得出来
 * @param {THREE.Object3D} object 登记过的大件
 * @param {number} fade 1 是原样，越小越透明
 */
function applyFade(object, fade) {
  const faded = fade < 1;
  object.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material.userData.baseOpacity === undefined) {
        material.userData.baseOpacity = material.opacity;
        material.userData.baseTransparent = material.transparent;
        material.userData.baseDepthWrite = material.depthWrite;
      }

      const transparent = faded || material.userData.baseTransparent;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = material.userData.baseOpacity * fade;
      material.depthWrite = faded ? false : material.userData.baseDepthWrite;
    }
  });
}
