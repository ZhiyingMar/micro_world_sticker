// 小镇的房子和广场：风车、红屋顶和蓝屋顶两座房子、喷泉、路灯、长椅、屋后的木箱，还有信箱和路牌
// 小月亮浮在喷泉的水池里，小出租车停在蓝屋子后头的木箱上
import * as THREE from 'three';
import { house, windmill, fountain, lamp, bench, crateStack, barrel, mailbox, signpost, BENCH_SEAT_HEIGHT, SMALL_CRATE_OFFSET } from './models.js';
import { RED_HOUSE, BLUE_HOUSE, WINDMILL, FOUNTAIN, MOON_OFFSET, LAMPS, BENCHES, CRATES, BARREL, MAILBOX, SIGNPOST } from './layout.js';

// 房子的碰撞比墙大一点点（石头地基露在外面）
const HOUSE_PAD = 0.06;
// 小棚子的碰撞：在房子右边多远、多宽多深
const SHED_COLLIDER = { offset: 0.36, halfWidth: 0.31, halfDepth: 0.55, shiftZ: -0.12 };
// 风车底座一半多大
const WINDMILL_HALF = 0.65;
// 门口的兴趣点离墙多远；在门口、喷泉边待多久（秒）
const DOOR_SPOT_GAP = 0.6;
const DOOR_STAY = 6;
const FOUNTAIN_STAY = 6;
// 喷泉边看水的人站在池边外面多远
const FOUNTAIN_SPOT_GAP = 0.35;
// 小月亮浮在水面上多高
const MOON_FLOAT = 0.16;
// 路灯杆、信箱、路牌、木桶的碰撞多粗
const POST_RADIUS = 0.1;
const BARREL_RADIUS = 0.22;
// 长椅：碰撞是沿着椅子摆的两个圆，离中心多远、多大；坐的人从椅子前面多远走过去
const BENCH_HALF_SPAN = 0.25;
const BENCH_RADIUS = 0.2;
const BENCH_APPROACH = 0.45;
const BENCH_STAY = 8;
// 每盏路灯转一个不同的角度（黄金角），看起来不像复制出来的
const GOLDEN_ANGLE = 2.39996;
// 木箱堆旁边那个小箱子的碰撞多大
const SMALL_CRATE_RADIUS = 0.17;

/**
 * 搭小镇：房子、风车、广场
 * @param {World} world 像素小镇
 * @param {{ waterPatch: Function }} ground 地面（喷泉的水和地上的水一样）
 * @returns {{ blades: THREE.Group, chimneys: THREE.Vector3[], fountain: { x: number, z: number, groundY: number, lowerWater: number, upperWater: number, spout: number, radius: number } }}
 */
export function buildTown(world, ground) {
  const chimneys = [buildHouse(world, RED_HOUSE, '🏠'), buildHouse(world, BLUE_HOUSE, '🔑')];
  const blades = buildWindmill(world);
  const fountainInfo = buildFountain(world, ground);
  buildStreetProps(world);
  buildCrates(world);
  return { blades, chimneys, fountain: fountainInfo };
}

/**
 * 盖一座房子，登记碰撞、挡人时变半透明，门口一个兴趣点
 * @param {World} world
 * @param {object} spec RED_HOUSE / BLUE_HOUSE
 * @param {string} emote 在门口的人头上冒什么
 * @returns {THREE.Vector3} 烟囱口在世界里的位置
 */
function buildHouse(world, spec, emote) {
  const { group, chimneyTop } = house(world.kit, spec);
  const groundY = world.heightAt(spec.x, spec.z);
  world.add(group, spec.x, groundY, spec.z, spec.facing);
  world.fadeable(group);

  const halfWidth = spec.width / 2 + HOUSE_PAD;
  const halfDepth = spec.depth / 2 + HOUSE_PAD;
  world.solidBox(spec.x - halfWidth, spec.x + halfWidth, spec.z - halfDepth, spec.z + halfDepth);
  if (spec.shed) {
    const shedX = spec.x + spec.width / 2 + SHED_COLLIDER.offset;
    const shedZ = spec.z + spec.depth * SHED_COLLIDER.shiftZ;
    world.solidBox(shedX - SHED_COLLIDER.halfWidth, shedX + SHED_COLLIDER.halfWidth, shedZ - SHED_COLLIDER.halfDepth, shedZ + SHED_COLLIDER.halfDepth);
  }

  // 门朝 +z（facing 0），站在门口脸朝门
  world.poi(spec.x, spec.z + spec.depth / 2 + DOOR_SPOT_GAP, { emote, face: Math.PI, dur: DOOR_STAY });

  group.updateMatrixWorld(true);
  return group.localToWorld(chimneyTop.clone());
}

/**
 * 风车立在小山包上，风叶朝着镜头
 * @param {World} world
 * @returns {THREE.Group} 风叶，life.js 让它转
 */
function buildWindmill(world) {
  const { group, blades } = windmill(world.kit);
  world.add(group, WINDMILL.x, world.heightAt(WINDMILL.x, WINDMILL.z), WINDMILL.z, WINDMILL.facing);
  world.fadeable(group);
  world.solidBox(WINDMILL.x - WINDMILL_HALF, WINDMILL.x + WINDMILL_HALF, WINDMILL.z - WINDMILL_HALF, WINDMILL.z + WINDMILL_HALF);
  world.poi(WINDMILL.x, WINDMILL.z + WINDMILL_HALF + DOOR_SPOT_GAP, { emote: '🌾', face: Math.PI, dur: DOOR_STAY });
  return blades;
}

/**
 * 广场中间的喷泉；小月亮浮在下面那层水池里
 * @param {World} world
 * @param {{ waterPatch: Function }} ground
 * @returns {{ x: number, z: number, groundY: number, lowerWater: number, upperWater: number, spout: number, radius: number }} 喷泉在哪、各层水多高（相对地面）
 */
function buildFountain(world, ground) {
  const built = fountain(world.kit, ground.waterPatch);
  const groundY = world.heightAt(FOUNTAIN.x, FOUNTAIN.z);
  world.add(built.group, FOUNTAIN.x, groundY, FOUNTAIN.z);
  const half = built.radius;
  world.solidBox(FOUNTAIN.x - half, FOUNTAIN.x + half, FOUNTAIN.z - half, FOUNTAIN.z + half);

  world.placeItem('moon', FOUNTAIN.x + MOON_OFFSET[0], groundY + built.lowerWater + MOON_FLOAT, FOUNTAIN.z + MOON_OFFSET[1]);

  // 一个人站在池子前面看水，一个人站在左边往池子里扔硬币
  const spotGap = half + FOUNTAIN_SPOT_GAP;
  world.poi(FOUNTAIN.x, FOUNTAIN.z + spotGap, { emote: '💧', face: Math.PI, dur: FOUNTAIN_STAY });
  world.poi(FOUNTAIN.x - spotGap, FOUNTAIN.z, { emote: '🪙', face: Math.PI / 2, dur: FOUNTAIN_STAY });

  return { x: FOUNTAIN.x, z: FOUNTAIN.z, groundY, ...built };
}

/**
 * 路灯、长椅、信箱、路牌
 * @param {World} world
 */
function buildStreetProps(world) {
  LAMPS.forEach(([x, z], index) => {
    world.add(lamp(world.kit), x, world.heightAt(x, z), z, index * GOLDEN_ANGLE);
    world.solidCircle(x, z, POST_RADIUS);
  });
  for (const spot of BENCHES) {
    placeBench(world, spot);
  }

  world.add(mailbox(world.kit), MAILBOX[0], world.heightAt(...MAILBOX), MAILBOX[1], -0.3);
  world.solidCircle(MAILBOX[0], MAILBOX[1], POST_RADIUS);
  world.add(signpost(world.kit), SIGNPOST[0], world.heightAt(...SIGNPOST), SIGNPOST[1], 0.4);
  world.solidCircle(SIGNPOST[0], SIGNPOST[1], POST_RADIUS);
}

/**
 * 摆一张长椅：沿着椅子两个圆当碰撞，前面一个能坐上去的兴趣点
 * @param {World} world
 * @param {{ x: number, z: number, facing: number, emote: string }} spot
 */
function placeBench(world, { x, z, facing, emote }) {
  world.add(bench(world.kit), x, world.heightAt(x, z), z, facing);

  // 椅子沿着自己的 x 方向摆，转过 facing 以后是 (cos, -sin)
  const alongX = Math.cos(facing);
  const alongZ = -Math.sin(facing);
  for (const side of [-1, 1]) {
    world.solidCircle(x + alongX * side * BENCH_HALF_SPAN, z + alongZ * side * BENCH_HALF_SPAN, BENCH_RADIUS);
  }

  // 坐的人先走到椅子前面，再一步挪上座位
  const frontX = x + Math.sin(facing) * BENCH_APPROACH;
  const frontZ = z + Math.cos(facing) * BENCH_APPROACH;
  world.poi(frontX, frontZ, { emote, face: facing, dur: BENCH_STAY, sit: true, seatY: BENCH_SEAT_HEIGHT, seat: { x, z } });
}

/**
 * 蓝屋子后头的木箱堆，小出租车停在最上面；旁边一个木桶
 * @param {World} world
 */
function buildCrates(world) {
  const { group, topY, footprint } = crateStack(world.kit);
  const groundY = world.heightAt(CRATES.x, CRATES.z);
  world.add(group, CRATES.x, groundY, CRATES.z);
  world.solidCircle(CRATES.x, CRATES.z, footprint + 0.05);
  world.solidCircle(CRATES.x + SMALL_CRATE_OFFSET[0], CRATES.z + SMALL_CRATE_OFFSET[1], SMALL_CRATE_RADIUS);
  world.placeItem('taxi', CRATES.x + 0.03, groundY + topY, CRATES.z - 0.02, { ry: 0.6 });

  world.add(barrel(world.kit), BARREL[0], world.heightAt(...BARREL), BARREL[1]);
  world.solidCircle(BARREL[0], BARREL[1], BARREL_RADIUS);
}
