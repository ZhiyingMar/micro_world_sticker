// 像素小镇的主线：那场大风把小镇的三样像素东西吹进了森林，小镇"卡住了"：喷泉干了，广场上去的台阶塌了，风车停了
// 把在森林里找到的东西放回原处，小镇一样样动起来：
//   ❤️ 像素爱心放回喷泉顶上 → 爱心一跳一跳，水一点点冒起来，小月亮从池底浮上来
//   🪙 像素金币投进大台阶底下的投币机 → 三条台阶一级级长回来，能上台地（蓝屋子后院的小出租车、风车山）
//   🎮 游戏卡带插进风车门口的卡槽机（要先上台地）→ 风车转起来，响一段开场曲，音乐回来了，苹果树下的萨克斯出现
// 爱心和金币先放哪个都行，卡带一定在台阶长回来之后；全部修好时大家欢呼，喷泉边蹦出一把彩色小方块
import * as THREE from 'three';
import { ghostify } from '../../world.js';
import { sfx } from '../../audio.js';
import { canvasTexture } from '../../kit.js';
import { foundIn, repairedIn, save } from '../../state.js';
import { createTimeline, easeOutBack, easeInOut } from '../../timeline.js';
import { createStairGates } from './stairs.js';
import forest from '../forest/index.js';
import { SAX } from './layout.js';

// 哪个修复点修好以后出现哪些东西（小出租车在台地上，台阶回来才够得着）
// 老存档里这些东西已经找到了、修复点却没修，说明是改版以前就逛开了的小镇
const REVEALS = { heart: ['moon'], coin: ['taxi'], cartridge: ['sax'] };

// 爱心：比森林里找到时大几倍，浮在喷水口上面多高；一跳一跳多快（每秒几下）、跳多大
const HEART_SCALE = 1.6;
const HEART_ABOVE_SPOUT = 0.22;
const HEART_BEAT_RATE = 1.2;
const HEART_BEAT = 0.12;
// 爱心放回去以后：水冒满要多久（秒）；站在池边多远够得着喷泉顶（池子一半大往外再加多少）
const FOUNTAIN_FILL = 2.2;
const FOUNTAIN_REACH = 0.9;

// 金币：比森林里找到时大几倍，飘在投币口前面多远；投进去要多久；投完多久台阶开始长
const COIN_SCALE = 1.5;
const COIN_HOVER = 0.18;
const COIN_SLIDE = 0.35;
const STAIRS_AFTER_COIN = 0.5;
// 投币机屏幕：贴图多少像素（像素字），字什么颜色；INSERT COIN 一秒闪几下
const SCREEN_PX = [48, 26];
const SCREEN_FONT = 'bold 10px monospace';
const INSERT_COLOR = '#ffd84a';
const THANKS_COLOR = '#5cff7a';
const BLINK_RATE = 1.5;

// 卡带：比森林里找到时大几倍；插进卡槽多深；插进去要多久
const CARTRIDGE_SCALE = 1.1;
const CARTRIDGE_SINK = 0.08;
const CARTRIDGE_SLIDE = 0.3;
// 卡槽机的小灯：没插卡带红的，插上绿的
const LED_ON = '#5cff7a';
// 风车转起来要多久；开场曲放多久以后萨克斯出现
const WINDMILL_SPIN_UP = 2.5;
const SAX_AFTER_MUSIC = 1.6;
// 萨克斯出现时旁边冒的一阵亮晶晶
const SAX_SPARKLES = { count: 22, spread: 0.5, size: 0.35, rise: 1.2, color: '#ffe680' };

// 全部修好：最后一处的动画放完以后再欢呼；喷泉边蹦几把彩色小方块、一把几块、什么颜色
const CHEER_TIME = 3;
const CONFETTI_BURSTS = 4;
const CONFETTI_PER_BURST = 8;
const CONFETTI_COLORS = ['#ff6b8b', '#ffd84a', '#5cc8ff', '#7ddc6a', '#b38ee8'];
// 弹出来的东西一开始有多小：缩到 0 的矩阵会让 three.js 算不出包围球
const MIN_SCALE = 0.001;

/**
 * 搭小镇的主线：台阶塌了、喷泉干了、风车停了，三个修复点，修好以后各自动起来
 * @description 要在别的东西都摆好以后才搭：挡路的格子不能影响树和花往哪儿长；修好了的存档在搭完以后由 World 一处处直接恢复
 * @param {World} world 像素小镇
 * @param {object} parts 搭好的各部分
 * @param {object} parts.ground 画出来的地面（每一格台阶）
 * @param {object} parts.town 小镇：喷泉、投币机、卡槽机
 * @param {{ fountain: { setFlow(level: number): void } }} parts.water 会动的水：喷泉冒水冒到几成
 * @param {{ windmill: { setPower(level: number): void } }} parts.life 会动的东西：风车转得多带劲
 * @param {object} parts.people 三位居民和换台词
 * @param {{ burst: Function }} parts.bits 蹦小方块
 */
export function createStory(world, { ground, town, water, life, people, bits }) {
  upgradeOldSave(world);
  // 直接看存档：搭场景时修复还没套用上去，isRepaired 还是 false
  const has = (id) => repairedIn(world.def.id).includes(id);
  const restored = () => world.def.repairs.every((repair) => has(repair.id));
  const refreshLines = () => people.refreshLines({ has, restored: restored() });

  const timeline = createTimeline(world);
  const [machineX, , machineZ] = town.coinMachine.slotAt.toArray();
  const stairs = createStairGates(world, ground, { from: { x: machineX, z: machineZ }, bits, timeline });
  const toast = (text) => world.env.toast?.(text);
  // 最后修好的那一处动画要放多久（秒）：放完了再欢呼
  const finale = { wait: 0 };
  const context = { timeline, people, toast, finale, refreshLines };

  water.fountain.setFlow(0);
  life.windmill.setPower(0);

  heartSpot(world, town.fountain, { ...context, water });
  coinSpot(world, town.coinMachine, { ...context, stairs });
  cartridgeSpot(world, town.cartridgeConsole, { ...context, life });
  celebrateWhenRestored(world, { timeline, finale, refreshLines, bits, fountain: town.fountain });
  refreshLines();
}

/**
 * 老存档补修复点：改版以前在小镇里已经找到过东西的，小镇早就逛开了，直接当作修好，不让它突然卡住
 * @description 新的玩法里，这几样东西要等对应的地方修好才拿得到；找到了却没修，只能是改版以前的存档
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
 * 从森林带来的东西的模型（和森林里找到时一样），放大几倍
 * @param {World} world
 * @param {string} id 森林里那样东西的 id：heart、coin、cartridge
 * @param {number} scale 放大几倍
 * @returns {THREE.Group}
 */
function forestModel(world, id, scale) {
  const model = forest.items.find((item) => item.id === id).make(world.kit);
  model.scale.multiplyScalar(scale);
  const group = new THREE.Group();
  group.add(model);
  return group;
}

// ---------- ❤️ 爱心 ----------

/**
 * 喷泉顶上少了小镇的心
 * @param {World} world
 * @param {{ x: number, z: number, groundY: number, spout: number, radius: number }} fountain 喷泉
 * @param {object} context
 */
function heartSpot(world, fountain, { timeline, water, toast, finale, refreshLines }) {
  const heartY = fountain.groundY + fountain.spout + HEART_ABOVE_SPOUT;
  const ghost = ghostify(forestModel(world, 'heart', HEART_SCALE));

  world.repairSpot('heart', ghost, fountain.x, heartY, fountain.z, {
    reach: fountain.radius + FOUNTAIN_REACH,
    pickR: 0.35,
    seeR: fountain.radius + 2,
    fn(instant) {
      const heart = forestModel(world, 'heart', HEART_SCALE);
      world.add(heart, fountain.x, heartY, fountain.z);
      // 心一跳一跳：快快地鼓两下，停一停
      world.onUpdate((dt, time) => {
        const beat = Math.max(Math.sin(time * HEART_BEAT_RATE * Math.PI * 2), 0) ** 4;
        heart.scale.setScalar(1 + beat * HEART_BEAT);
      });
      refreshLines();
      if (instant) {
        water.fountain.setFlow(1);
        world.revealItem('moon', true);
        return;
      }

      sfx.splash();
      timeline.tween(FOUNTAIN_FILL, (progress) => water.fountain.setFlow(easeInOut(progress)));
      timeline.after(FOUNTAIN_FILL, () => {
        world.revealItem('moon');
        sfx.twinkle();
        toast('🌙 池子里浮起来一个小月亮！');
      });
      finale.wait = FOUNTAIN_FILL;
    },
  });
}

// ---------- 🪙 金币 ----------

/**
 * 大台阶底下的投币机等着投币
 * @param {World} world
 * @param {{ screen: THREE.Mesh, slotAt: THREE.Vector3 }} machine 投币机的屏幕和投币口
 * @param {object} context
 */
function coinSpot(world, machine, { timeline, stairs, people, toast, finale, refreshLines }) {
  const screens = {
    insert: screenMaterial(world, ['INSERT', 'COIN'], INSERT_COLOR),
    blank: screenMaterial(world, [], INSERT_COLOR),
    thanks: screenMaterial(world, ['THANK', 'YOU!'], THANKS_COLOR),
  };
  let paid = false;
  world.onUpdate((dt, time) => {
    if (paid) {
      return;
    }
    const lit = Math.floor(time * BLINK_RATE * 2) % 2 === 0;
    machine.screen.material = lit ? screens.insert : screens.blank;
  });

  const { x, y, z } = machine.slotAt;
  const ghost = ghostify(forestModel(world, 'coin', COIN_SCALE));
  world.repairSpot('coin', ghost, x, y, z + COIN_HOVER, {
    reach: 1.3,
    pickR: 0.3,
    seeR: 2.4,
    fn(instant) {
      paid = true;
      machine.screen.material = screens.thanks;
      refreshLines();
      if (instant) {
        stairs.rebuild({ instant: true });
        return;
      }

      // 金币从投币口前面滑进去，"叮——"；台阶一级级长回来
      const coin = forestModel(world, 'coin', COIN_SCALE);
      world.add(coin, x, y, z + COIN_HOVER);
      timeline.tween(COIN_SLIDE, (progress) => {
        coin.position.z = z + COIN_HOVER * (1 - progress);
        coin.scale.setScalar(Math.max(1 - progress, MIN_SCALE));
      });
      timeline.after(COIN_SLIDE, () => {
        coin.removeFromParent();
        sfx.coin();
      });
      stairs.rebuild({
        delay: COIN_SLIDE + STAIRS_AFTER_COIN,
        done: () => {
          toast('🪜 台阶长回来了，能上台地了！');
          people.doudou.showBubble('❗', 2);
        },
      });
      finale.wait = COIN_SLIDE + STAIRS_AFTER_COIN + stairs.rebuildTime;
    },
  });
}

/**
 * 投币机屏幕上的一屏字：黑底，像素字，一行或两行
 * @param {World} world
 * @param {string[]} lines 每行写什么（空的就是黑屏）
 * @param {string} color 字的颜色
 * @returns {THREE.MeshBasicMaterial} 不受光照影响，像屏幕自己在发光
 */
function screenMaterial(world, lines, color) {
  const [width, height] = SCREEN_PX;
  const texture = canvasTexture(width, height, (context) => {
    context.fillStyle = '#10131c';
    context.fillRect(0, 0, width, height);
    context.fillStyle = color;
    context.font = SCREEN_FONT;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    lines.forEach((line, index) => {
      const lineY = (height * (index + 1)) / (lines.length + 1);
      context.fillText(line, width / 2, lineY);
    });
  }, { pixel: true });
  world.texture(texture);
  return new THREE.MeshBasicMaterial({ map: texture });
}

// ---------- 🎮 卡带 ----------

/**
 * 风车门口的卡槽机空着
 * @description 卡槽机在风车山上，要先让台阶长回来、上了台地才走得到
 * @param {World} world
 * @param {{ led: THREE.Mesh, slotAt: THREE.Vector3 }} slot 卡槽机的小灯和卡槽口
 * @param {object} context
 */
function cartridgeSpot(world, slot, { timeline, life, people, toast, finale, refreshLines }) {
  const { x, y, z } = slot.slotAt;
  const ghost = ghostify(forestModel(world, 'cartridge', CARTRIDGE_SCALE));
  const standingY = y + cartridgeHalfHeight(world) - CARTRIDGE_SINK;

  world.repairSpot('cartridge', ghost, x, standingY, z, {
    reach: 1.3,
    pickR: 0.3,
    seeR: 2.4,
    fn(instant) {
      const cartridge = forestModel(world, 'cartridge', CARTRIDGE_SCALE);
      world.add(cartridge, x, standingY, z);
      slot.led.material = world.kit.m(LED_ON, { emissive: LED_ON, emissiveIntensity: 0.9 });
      refreshLines();
      if (instant) {
        life.windmill.setPower(1);
        world.revealItem('sax', true);
        return;
      }

      // 卡带"咔"地插进去 → 风车慢慢转起来、开场曲响起 → 苹果树下的萨克斯出现
      timeline.tween(CARTRIDGE_SLIDE, (progress) => {
        cartridge.position.y = standingY + CARTRIDGE_SINK * (1 - easeOutBack(progress));
      });
      timeline.after(CARTRIDGE_SLIDE, () => sfx.gameStart());
      timeline.tween(WINDMILL_SPIN_UP, (progress) => life.windmill.setPower(easeInOut(progress)), CARTRIDGE_SLIDE);
      timeline.after(CARTRIDGE_SLIDE + SAX_AFTER_MUSIC, () => {
        const [saxX, saxZ] = SAX;
        world.fx.emit(new THREE.Vector3(saxX, world.heightAt(saxX, saxZ), saxZ), SAX_SPARKLES);
        world.revealItem('sax');
        people.axiang.showBubble('🎵', 3);
        toast('🎵 音乐回来了！菜园外的苹果树下面，有什么东西金灿灿的');
      });
      finale.wait = CARTRIDGE_SLIDE + SAX_AFTER_MUSIC;
    },
  });
}

/**
 * 卡带竖着放时一半有多高（插进卡槽时，卡带中心在卡槽口往上这么多）
 * @param {World} world
 * @returns {number}
 */
function cartridgeHalfHeight(world) {
  const box = new THREE.Box3().setFromObject(forestModel(world, 'cartridge', CARTRIDGE_SCALE));
  return (box.max.y - box.min.y) / 2;
}

// ---------- 全部修好 ----------

/**
 * 全部修好的那一刻：等最后一处的动画放完，大家头上冒 🎉，喷泉边蹦出几把彩色小方块，台词换成找东西的提示
 * @param {World} world
 * @param {object} context
 */
function celebrateWhenRestored(world, { timeline, finale, refreshLines, bits, fountain }) {
  world.whenRestored(() => {
    refreshLines();
    timeline.after(finale.wait, () => {
      for (const villager of world.villagers) {
        villager.showBubble('🎉', CHEER_TIME);
      }
      // 绕着喷泉四个角各蹦一把
      for (let i = 0; i < CONFETTI_BURSTS; i++) {
        const angle = (i / CONFETTI_BURSTS) * Math.PI * 2 + Math.PI / 4;
        const burstX = fountain.x + Math.cos(angle) * fountain.radius;
        const burstZ = fountain.z + Math.sin(angle) * fountain.radius;
        bits.burst(burstX, fountain.groundY, burstZ, CONFETTI_COLORS, CONFETTI_PER_BURST);
      }
      sfx.twinkle();
    });
  });
}
