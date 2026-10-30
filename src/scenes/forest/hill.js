// 右后角的小山：山顶一座高塔，塔背后一圈花丛里藏着游戏卡带
// 上山的路绕着山走：右边草地的台阶上山腰，沿山腰往左，再一级台阶上山顶
// 森林的魔法停了时，塔尖上少了魔法星星：塔窗暗着、小旗耷拉着、花丛还没开；星星放回去，一点点醒过来（setMagic）
import * as THREE from 'three';
import { fairyTower, TOWER_BASE_RADIUS, TOWER_TOP, TOWER_WINDOW_GLOW } from './models.js';
import { flowerField, growFlowerField } from '../../plants.js';
import { glow } from '../../fx.js';
import { easeOutBack, ramp } from '../../timeline.js';
import { TOWER, FLOWER_RING, CARTRIDGE, TOWER_SPOT } from './layout.js';

// 小旗摆得多快、摆多大角度（弧度）；魔法停了时往下耷拉多少（弧度）
const FLAG_WAVE_SPEED = 3;
const FLAG_WAVE_ANGLE = 0.3;
const FLAG_DROOP = 1.2;
// 塔窗暗着时的颜色（亮着时是模型本来的颜色）
const WINDOW_DARK_COLOR = '#8f86ad';
// 花丛的花开得比别处的大
const RING_FLOWER_SCALE = 1.6;
// 一朵大花要占多大地方：离崖边比这还近就会悬在半空
const RING_FLOWER_ROOM = 0.1;
const RING_COLORS = ['#ff8fb1', '#ffffff', '#ffd84a', '#b38ee8', '#ff9a6b'];
// 还没开的花有开足时的几成大；魔法醒过来时一朵接一朵开，每朵花开花用掉整段的几成
const RING_BUD_SIZE = 0.25;
const RING_BLOOM_SPAN = 0.35;
// 卡带离地面多高
const CARTRIDGE_LIFT = 0.22;
// 在塔门前站多久（秒）
const TOWER_STAY = 6;
// 塔尖的魔法星星：比小屋里找到时放大几倍（从远处看得见），在旗杆顶上多高，转多快（弧度每秒），光晕多大
const STAR_SCALE = 2.2;
const STAR_ABOVE_POLE = 0.4;
const STAR_SPIN = 0.9;
const STAR_HALO_SIZE = 1.4;

/**
 * 搭小山上的东西
 * @description 先按魔法停了的样子搭（塔窗暗、小旗耷拉、花没开）；修好了的存档在搭完以后马上调 setMagic(1)
 * @param {World} world 童话森林
 * @returns {{ starAt: THREE.Vector3, starScale: number, placeStar(model: THREE.Object3D): THREE.Object3D, setMagic(level: number): void }}
 *   魔法星星该放在哪、比小屋里找到时大几倍（虚影也照这个大小）；把星星放上塔尖（返回放好的那一组，用的地方可以让它弹出来）；
 *   魔法醒过来几成（0 停着，1 全醒）
 */
export function buildHill(world) {
  const tower = placeTower(world);
  const ring = flowerRing(world);

  const [cartridgeX, cartridgeZ] = CARTRIDGE;
  world.placeItem('cartridge', cartridgeX, world.heightAt(cartridgeX, cartridgeZ) + CARTRIDGE_LIFT, cartridgeZ, { hidden: true });

  const starAt = new THREE.Vector3(TOWER.x, world.heightAt(TOWER.x, TOWER.z) + TOWER_TOP + STAR_ABOVE_POLE, TOWER.z);
  const setMagic = (level) => {
    tower.setMagic(level);
    ring.setMagic(level);
  };
  setMagic(0);
  return { starAt, starScale: STAR_SCALE, placeStar: (model) => placeStar(world, model, starAt), setMagic };
}

/**
 * 山顶的高塔，小旗在飘（魔法停了时耷拉着）
 * @description 塔又高又在后排，人走到塔后面会被挡住，所以登记成会变半透明的大件
 * @param {World} world
 * @returns {{ setMagic(level: number): void }} 魔法醒过来几成：塔窗亮多少、小旗飘多大
 */
function placeTower(world) {
  const { group, flag, windows } = fairyTower(world.kit);
  world.add(group, TOWER.x, world.heightAt(TOWER.x, TOWER.z), TOWER.z, TOWER.facing);
  world.solidCircle(TOWER.x, TOWER.z, TOWER_BASE_RADIUS);
  // 登记成会变半透明的大件时，共用的材质会复制一份，之后改窗户的颜色不会改到别处
  world.fadeable(group);

  const litColor = windows[0].material.color.clone();
  const darkColor = new THREE.Color(WINDOW_DARK_COLOR);
  let magic = 0;
  world.onUpdate((dt, time) => {
    flag.rotation.y = Math.sin(time * FLAG_WAVE_SPEED) * FLAG_WAVE_ANGLE * magic;
    flag.rotation.z = -FLAG_DROOP * (1 - magic);
  });
  world.poi(TOWER_SPOT.x, TOWER_SPOT.z, { emote: '✨', face: TOWER_SPOT.face, dur: TOWER_STAY });

  const setMagic = (level) => {
    magic = THREE.MathUtils.clamp(level, 0, 1);
    for (const towerWindow of windows) {
      towerWindow.material.color.copy(darkColor).lerp(litColor, magic);
      towerWindow.material.emissiveIntensity = TOWER_WINDOW_GLOW * magic;
    }
  };
  return { setMagic };
}

/**
 * 塔背后一圈特别密、特别大的花丛
 * @description 从默认镜头看被塔挡住，要转镜头或者爬上山才发现，卡带就藏在里面；魔法停了时花还没开
 * @param {World} world
 * @returns {{ setMagic(level: number): void }} 魔法醒过来几成：花一朵接一朵开
 */
function flowerRing(world) {
  const { from, to, count, radii } = FLOWER_RING;
  const blooms = [];

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

    blooms.push({ x, y: world.heightAt(x, z), z, color: RING_COLORS[i % RING_COLORS.length], scale: RING_FLOWER_SCALE, turn: angle * 3 });
  }
  const field = flowerField(world.kit, blooms);
  world.root.add(field);

  // 第 i 朵花在整段里什么时候开：从花丛一头开到另一头
  const opensAt = (index) => (index / Math.max(blooms.length - 1, 1)) * (1 - RING_BLOOM_SPAN);
  const setMagic = (level) => {
    growFlowerField(field, blooms, (index) => {
      const open = easeOutBack(ramp(level, opensAt(index), opensAt(index) + RING_BLOOM_SPAN));
      return RING_BUD_SIZE + (1 - RING_BUD_SIZE) * open;
    });
  };
  return { setMagic };
}

/**
 * 把魔法星星放上塔尖：慢慢转着，背后一圈光晕
 * @param {World} world
 * @param {THREE.Object3D} model 小屋里找到的那颗星星的模型
 * @param {THREE.Vector3} starAt 放在哪
 * @returns {THREE.Group} 放好的星星（连光晕一起）
 */
function placeStar(world, model, starAt) {
  const star = new THREE.Group();
  model.scale.setScalar(STAR_SCALE);
  star.add(model);
  star.add(glow('#fff1a8', STAR_HALO_SIZE));
  world.add(star, starAt.x, starAt.y, starAt.z);

  world.onUpdate((dt) => {
    model.rotation.y += STAR_SPIN * dt;
  });
  return star;
}
