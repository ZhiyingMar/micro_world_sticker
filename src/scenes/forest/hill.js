// 右后角的小山：山顶一座高塔，塔背后一圈花丛里藏着游戏卡带
// 上山的路绕着山走：右边草地的台阶上山腰，沿山腰往左，再一级台阶上山顶
import { fairyTower, flower, TOWER_BASE_RADIUS } from './models.js';
import { TOWER, FLOWER_RING, CARTRIDGE, TOWER_SPOT } from './layout.js';

// 小旗摆得多快、摆多大角度（弧度）
const FLAG_WAVE_SPEED = 3;
const FLAG_WAVE_ANGLE = 0.3;
// 花丛的花开得比别处的大
const RING_FLOWER_SCALE = 1.6;
// 一朵大花要占多大地方：离崖边比这还近就会悬在半空
const RING_FLOWER_ROOM = 0.1;
const RING_COLORS = ['#ff8fb1', '#ffffff', '#ffd84a', '#b38ee8', '#ff9a6b'];
// 卡带离地面多高
const CARTRIDGE_LIFT = 0.22;
// 在塔门前站多久（秒）
const TOWER_STAY = 6;

/**
 * 搭小山上的东西
 * @param {World} world 童话森林
 */
export function buildHill(world) {
  tower(world);
  flowerRing(world);

  const [cartridgeX, cartridgeZ] = CARTRIDGE;
  world.placeItem('cartridge', cartridgeX, world.heightAt(cartridgeX, cartridgeZ) + CARTRIDGE_LIFT, cartridgeZ);
}

/**
 * 山顶的高塔，小旗一直在飘
 * @description 塔又高又在后排，人走到塔后面会被挡住，所以登记成会变半透明的大件
 * @param {World} world
 */
function tower(world) {
  const { group, flag } = fairyTower(world.kit);
  world.add(group, TOWER.x, world.heightAt(TOWER.x, TOWER.z), TOWER.z, TOWER.facing);
  world.solidCircle(TOWER.x, TOWER.z, TOWER_BASE_RADIUS);
  world.fadeable(group);

  world.onUpdate((dt, time) => {
    flag.rotation.y = Math.sin(time * FLAG_WAVE_SPEED) * FLAG_WAVE_ANGLE;
  });
  world.poi(TOWER_SPOT.x, TOWER_SPOT.z, { emote: '✨', face: TOWER_SPOT.face, dur: TOWER_STAY });
}

/**
 * 塔背后一圈特别密、特别大的花丛
 * @description 从默认镜头看被塔挡住，要转镜头或者爬上山才发现，卡带就藏在里面
 * @param {World} world
 */
function flowerRing(world) {
  const { from, to, count, radii } = FLOWER_RING;

  for (let i = 0; i < count; i++) {
    const angle = from + (i / (count - 1)) * (to - from);
    const radius = radii[i % radii.length];
    const x = TOWER.x + Math.cos(angle) * radius;
    const z = TOWER.z - Math.sin(angle) * radius;
    // 花丛贴着山顶边上，落到山顶外面、或者悬在崖边上的那几朵不种
    const onHilltop = world.terrain.isPlainGround(x, z) && !world.terrain.straddles(x, z, RING_FLOWER_ROOM);
    if (!onHilltop) {
      continue;
    }

    const bloom = flower(world.kit, RING_COLORS[i % RING_COLORS.length]);
    bloom.scale.setScalar(RING_FLOWER_SCALE);
    world.add(bloom, x, world.heightAt(x, z), z);
  }
}
