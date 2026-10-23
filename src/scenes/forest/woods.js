// 树林：到处的树、左前方躺着的空心木头（爱心藏在里面），右边草地前面一道白栅栏
import { roundTree, hollowLog, picketFence } from './models.js';
import { TREES, NAP_SPOT, LOG, HEART_INSET, LOG_PEEK_FROM, FENCE, FLOWER_SPOT } from './layout.js';

// 树干有多粗：人绕着树干走，树冠不挡
const TRUNK_RADIUS = 0.2;
// 爱心在木头里离底面多高（躺在木头内壁上）
const HEART_LIFT = 0.32;
// 往木头里看的时候，镜头对准木头里多高的地方
const PEEK_HEIGHT = 0.35;
// 看木头的人站在木头前面多远
const LOG_SPOT_GAP = 0.85;
// 栅栏的碰撞有多厚
const FENCE_THICKNESS = 0.1;
// 打盹、看虫子、看花各待多久（秒）
const NAP_STAY = 8;
const LOG_STAY = 5;
const FLOWER_STAY = 6;

/**
 * 搭树林
 * @param {World} world 童话森林
 */
export function buildWoods(world) {
  trees(world);
  log(world);
  fence(world);
}

/**
 * 种树，树干登记成障碍
 * @param {World} world
 */
function trees(world) {
  for (const [x, z, look] of TREES) {
    world.add(roundTree(world.kit, look), x, world.heightAt(x, z), z);
    world.solidCircle(x, z, TRUNK_RADIUS);
  }
  world.poi(NAP_SPOT.x, NAP_SPOT.z, { emote: '💤', face: NAP_SPOT.face, dur: NAP_STAY });
}

/**
 * 空心木头：爱心藏在开口那头，点木头时镜头转到开口往里看
 * @param {World} world
 */
function log(world) {
  const groundY = world.heightAt(LOG.x, LOG.z);
  const hollow = hollowLog(world.kit, LOG);
  world.add(hollow, LOG.x, groundY, LOG.z);
  world.solid(hollow);

  // 开口朝 +x：爱心在开口那头往里一点
  const heartX = LOG.x + LOG.length / 2 - HEART_INSET;
  hollow.userData.peek = { target: [heartX, groundY + PEEK_HEIGHT, LOG.z], from: LOG_PEEK_FROM };
  world.placeItem('heart', heartX, groundY + HEART_LIFT, LOG.z, { ry: Math.PI / 2, spin: false });

  world.poi(LOG.x, LOG.z + LOG.radius + LOG_SPOT_GAP, { emote: '🐛', face: Math.PI, dur: LOG_STAY });
}

/**
 * 右边草地最前面的一道白栅栏，后面是看花的地方
 * @param {World} world
 */
function fence(world) {
  const { fromX, toX, z } = FENCE;
  const centerX = (fromX + toX) / 2;
  world.add(picketFence(world.kit, toX - fromX), centerX, world.heightAt(centerX, z), z);
  world.colliders.push({ type: 'box', minX: fromX, maxX: toX, minZ: z - FENCE_THICKNESS / 2, maxZ: z + FENCE_THICKNESS / 2 });

  world.poi(FLOWER_SPOT.x, FLOWER_SPOT.z, { emote: '🌸', face: FLOWER_SPOT.face, dur: FLOWER_STAY });
}
