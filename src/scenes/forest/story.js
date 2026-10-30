// 童话森林的主线：前些天一场大风，森林里的三样东西被吹进了小屋，森林的魔法停了：桥塌了，踏脚石沉了，只能在这半边逛
// 把小屋里找到的东西放回原处，森林一点点醒过来：
//   📖 童话书放回蘑菇仔的读书树桩 → 蘑菇仔讲起故事，故事里空心木头里的那颗心成真了：爱心出现
//   🍄 红蘑菇放到塌下去的桥底下 → 长成大红蘑菇，把桥顶平，能过到小溪对岸
//   ⭐ 魔法星星放回高塔的塔尖（要先过桥上山）→ 塔亮了，踏脚石浮上来、金币出现，塔背后的花开了、卡带出现
// 书和蘑菇先放哪个都行，星星一定在桥修好之后；全部修好时躲着的蝴蝶飞出来，大家欢呼
import * as THREE from 'three';
import { ghostify } from '../../world.js';
import { sfx } from '../../audio.js';
import { foundIn, repairedIn, save } from '../../state.js';
import { createTimeline, easeOutBack, easeInOut } from '../../timeline.js';
import { createCrossings } from './crossings.js';
import home from '../home/index.js';
import { LOG, READING_SPOT } from './layout.js';

// 哪个修复点修好以后出现哪些东西
// 老存档里这些东西已经找到了、修复点却没修，说明是改版以前就逛开了的森林
const REVEALS = { book: ['heart'], star: ['coin', 'cartridge'] };

// 童话书：虚影和放好的书比小屋里找到时大几倍，在树桩顶上多高（书一半的厚度）
const BOOK_SCALE = 1.4;
const BOOK_LIFT = 0.05;
const BOOK_TURN = 0.5;
// 放回书以后：蘑菇仔站着读多久（秒）才走开；故事讲到空心木头、爱心出现要多久；读书的兴趣点待多久
const KID_READS_FOR = 9;
const STORY_TO_HEART = 2.6;
const READING_STAY = 8;
// 空心木头那边冒出的一阵亮晶晶
const HEART_SPARKLES = { count: 26, spread: 0.6, size: 0.35, rise: 1.4, color: '#ffc2d4' };

// 红蘑菇的虚影：比小屋里找到时大几倍，冒在塌下去的桥中间
const MUSHROOM_GHOST_SCALE = 2;
// 桥顶平以后，过多久提示桥通了（秒）
const BRIDGE_OPEN_TOAST = 1.3;

// 魔法星星：弹上塔尖用多久；塔一点点醒过来（窗亮、旗飘、花开）用多久，从星星弹完开始
const STAR_POP = 0.5;
const MAGIC_WAKE = 2.4;
// 花丛开到几成时卡带露出来
const CARTRIDGE_AT = 0.6;
// 一串光点从塔尖飘到池塘：飘多久、每隔多久撒一把、一把几颗，弧线中间往上拱多高
const TRAIL_TIME = 1.4;
const TRAIL_STEP = 0.08;
const TRAIL_SPARKLES = { count: 4, spread: 0.25, size: 0.3, rise: 0.2, color: '#fff1a8' };
const TRAIL_ARC = 1.2;
// 光点落在池塘的哪儿：踏脚石中间那块
const POND_CENTER = new THREE.Vector3(1.0, 0, -1.0);

// 弹出来的东西一开始有多小：缩到 0 的矩阵会让 three.js 算不出包围球
const MIN_SCALE = 0.001;

// 全部修好：最后一处的动画放完以后再欢呼；蝴蝶飞出来用多久
const BUTTERFLIES_RETURN = 2.5;
const CHEER_TIME = 3;

/**
 * 搭森林的主线：桥和踏脚石断了，三个修复点，修好以后各自醒过来
 * @description 要在别的东西都摆好以后才搭：挡路的格子不能影响树和花往哪儿长；修好了的存档在搭完以后由 World 一处处直接恢复
 * @param {World} world 童话森林
 * @param {object} parts 搭好的各部分
 * @param {object} parts.ground 画出来的地面（水面、溪底、踏脚石和桥）
 * @param {{ readingStump: { x: number, y: number, z: number } }} parts.village 读书树桩在哪
 * @param {object} parts.hill 小山：魔法星星放在哪、魔法醒过来几成
 * @param {object} parts.people 三位居民和换台词
 * @param {{ butterflies: { setPresence(level: number): void } }} parts.life 会动的东西里的蝴蝶
 * @param {{ ripple: Function, splash: Function }} parts.splashes 水面上的波纹和水珠
 */
export function createStory(world, { ground, village, hill, people, life, splashes }) {
  upgradeOldSave(world);
  // 直接看存档：搭场景时修复还没套用上去，isRepaired 还是 false
  const has = (id) => repairedIn(world.def.id).includes(id);
  const restored = () => world.def.repairs.every((repair) => has(repair.id));
  const refreshLines = () => people.refreshLines({ has, restored: restored() });

  const timeline = createTimeline(world);
  const crossings = createCrossings(world, ground, { splashes, timeline });
  const toast = (text) => world.env.toast?.(text);
  // 最后修好的那一处动画要放多久（秒）：放完了再欢呼
  const finale = { wait: 0 };
  const context = { timeline, crossings, people, hill, toast, finale, refreshLines };

  if (!has('book')) {
    people.mushroomKid.pin({ emote: '💤', face: READING_SPOT.face });
  }
  if (!restored()) {
    life.butterflies.setPresence(0);
  }

  bookSpot(world, village.readingStump, context);
  mushroomSpot(world, context);
  starSpot(world, context);
  celebrateWhenRestored(world, { timeline, life, finale, refreshLines });
  refreshLines();
}

/**
 * 老存档补修复点：改版以前在森林里已经找到过东西的，森林早就逛开了，直接当作修好，不让它突然塌桥
 * @description 新的玩法里，这几样东西要等对应的地方修好才出现；找到了却没修，只能是改版以前的存档
 * @param {World} world
 */
function upgradeOldSave(world) {
  const found = foundIn(world.def.id);
  const done = repairedIn(world.def.id);
  const exploredBefore = Object.entries(REVEALS).some(([repairId, items]) => {
    const notRepaired = !done.includes(repairId);
    return notRepaired && items.some((itemId) => found.includes(itemId));
  });
  if (!exploredBefore) {
    return;
  }

  for (const repair of world.def.repairs) {
    if (!done.includes(repair.id)) {
      done.push(repair.id);
    }
  }
  save();
}

/**
 * 从小屋带来的东西的模型（和小屋里找到时一样）
 * @param {World} world
 * @param {string} id 小屋里那样东西的 id：book、mushroom、star
 * @returns {THREE.Object3D}
 */
function homeModel(world, id) {
  return home.items.find((item) => item.id === id).make(world.kit);
}

/**
 * 放了一样东西进一个组里，按倍数放大（虚影、放好的东西都要比小屋里找到时大）
 * @param {THREE.Object3D} model
 * @param {number} scale
 * @returns {THREE.Group}
 */
function scaled(model, scale) {
  const group = new THREE.Group();
  model.scale.multiplyScalar(scale);
  group.add(model);
  return group;
}

// ---------- 📖 童话书 ----------

/**
 * 蘑菇仔的读书树桩上少了童话书
 * @param {World} world
 * @param {{ x: number, y: number, z: number }} stumpTop 树桩顶面的中心
 * @param {object} context
 */
function bookSpot(world, stumpTop, { timeline, people, toast, finale, refreshLines }) {
  const kid = people.mushroomKid;
  const ghost = scaled(ghostify(homeModel(world, 'book')), BOOK_SCALE);
  ghost.rotation.y = BOOK_TURN;

  world.repairSpot('book', ghost, stumpTop.x, stumpTop.y + BOOK_LIFT, stumpTop.z, {
    reach: 1.4,
    pickR: 0.35,
    seeR: 2.4,
    fn(instant) {
      const book = scaled(homeModel(world, 'book'), BOOK_SCALE);
      world.add(book, stumpTop.x, stumpTop.y + BOOK_LIFT, stumpTop.z, BOOK_TURN);
      world.poi(READING_SPOT.x, READING_SPOT.z, { emote: '📖', face: READING_SPOT.face, dur: READING_STAY });
      refreshLines();
      if (instant) {
        world.revealItem('heart', true);
        return;
      }

      // 蘑菇仔醒过来，捧着书读一会儿；故事讲到空心木头，那颗心就真的出现了
      sfx.pageTurn();
      kid.pin({ emote: '📖', face: READING_SPOT.face });
      timeline.after(KID_READS_FOR, () => kid.unpin());
      timeline.after(STORY_TO_HEART, () => {
        world.fx.emit(new THREE.Vector3(LOG.x, world.heightAt(LOG.x, LOG.z) + LOG.radius * 2, LOG.z), HEART_SPARKLES);
        world.revealItem('heart');
        sfx.twinkle();
        toast('💗 故事里说，空心木头里住着一颗小小的心……');
      });
      finale.wait = STORY_TO_HEART;
    },
  });
}

// ---------- 🍄 红蘑菇 ----------

/**
 * 塌下去的桥底下少了撑着它的红蘑菇
 * @param {World} world
 * @param {object} context
 */
function mushroomSpot(world, { timeline, crossings, people, toast, finale, refreshLines }) {
  const { x, z, waterY } = crossings.bridge;
  const ghost = scaled(ghostify(homeModel(world, 'mushroom')), MUSHROOM_GHOST_SCALE);

  world.repairSpot('mushroom', ghost, x, waterY, z, {
    reach: 1.6,
    pickR: 0.4,
    seeR: 2.4,
    fn(instant) {
      crossings.liftBridge({ instant });
      refreshLines();
      if (instant) {
        return;
      }

      timeline.after(BRIDGE_OPEN_TOAST, () => {
        toast('🌉 桥通了，能过到小溪对岸了！');
        people.lily.showBubble('❗', 2);
      });
      finale.wait = BRIDGE_OPEN_TOAST;
    },
  });
}

// ---------- ⭐ 魔法星星 ----------

/**
 * 山顶高塔的塔尖上少了魔法星星
 * @description 塔太高，站在塔边上（不管哪一边）就够得着；要过了桥才上得了山
 * @param {World} world
 * @param {object} context
 */
function starSpot(world, { timeline, crossings, hill, toast, finale, refreshLines }) {
  const { starAt, starScale } = hill;
  const ghost = scaled(ghostify(homeModel(world, 'star')), starScale);

  world.repairSpot('star', ghost, starAt.x, starAt.y, starAt.z, {
    reach: 1.9,
    pickR: 0.5,
    seeR: 2.6,
    fn(instant) {
      const star = hill.placeStar(homeModel(world, 'star'));
      refreshLines();
      if (instant) {
        hill.setMagic(1);
        crossings.raiseStones({ instant: true });
        world.revealItem('coin', true);
        world.revealItem('cartridge', true);
        return;
      }

      // 星星弹上塔尖 → 塔一点点醒过来、花一朵朵开 → 一串光点飘到池塘 → 踏脚石一块块浮上来
      sfx.twinkle();
      star.scale.setScalar(MIN_SCALE);
      timeline.tween(STAR_POP, (progress) => star.scale.setScalar(Math.max(easeOutBack(progress), MIN_SCALE)));
      timeline.tween(MAGIC_WAKE, (progress) => hill.setMagic(easeInOut(progress)), STAR_POP);
      timeline.after(STAR_POP + MAGIC_WAKE * CARTRIDGE_AT, () => world.revealItem('cartridge'));
      magicTrail(world, timeline, starAt, STAR_POP);

      const stonesFrom = STAR_POP + TRAIL_TIME;
      crossings.raiseStones({
        delay: stonesFrom,
        done: () => {
          world.revealItem('coin');
          toast('🪨 踏脚石浮上来了，池塘能过去了！');
        },
      });
      finale.wait = stonesFrom + crossings.stonesRiseTime;
    },
  });
}

/**
 * 一串光点从塔尖飘到池塘：魔法顺着它流过去，踏脚石才浮上来
 * @param {World} world
 * @param {object} timeline
 * @param {THREE.Vector3} from 塔尖
 * @param {number} delay 过多久开始飘（秒）
 */
function magicTrail(world, timeline, from, delay) {
  const to = POND_CENTER.clone().setY(world.heightAt(POND_CENTER.x, POND_CENTER.z));
  const steps = Math.round(TRAIL_TIME / TRAIL_STEP);
  const point = new THREE.Vector3();

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    timeline.after(delay + i * TRAIL_STEP, () => {
      // 往上拱一点，像一道弧
      point.lerpVectors(from, to, progress);
      point.y += Math.sin(progress * Math.PI) * TRAIL_ARC;
      world.fx.emit(point, TRAIL_SPARKLES);
    });
  }
}

// ---------- 全部修好 ----------

/**
 * 全部修好的那一刻：等最后一处的动画放完，躲着的蝴蝶飞出来，大家头上冒 🎉，台词换成找东西的提示
 * @param {World} world
 * @param {object} context
 */
function celebrateWhenRestored(world, { timeline, life, finale, refreshLines }) {
  world.whenRestored(() => {
    refreshLines();
    timeline.after(finale.wait, () => {
      timeline.tween(BUTTERFLIES_RETURN, (progress) => life.butterflies.setPresence(progress));
      for (const villager of world.villagers) {
        villager.showBubble('🎉', CHEER_TIME);
      }
      sfx.twinkle();
    });
  });
}
