// 夜都的主线：停电了，把从像素小镇带来的月亮、出租车、萨克斯放回原处，城市一点点亮起来
//   🌙 月亮挂回杆子上 → 月光照进小巷，硬币和红茶壶出现（红茶壶在铁丝网后面，要绕到街区背面去拿）
//   🪙 硬币 → 售货机买罐装咖啡 → ☕ 叫醒司机老周
//   🚕 出租车回到停靠位 + 司机醒了 → 车流动起来，礼帽出现
//   🎷 萨克斯还给老乔（要等月亮出来）→ 霓虹和窗户亮起来，红伞出现
import * as THREE from 'three';
import { ghostify } from '../../world.js';
import { sfx } from '../../audio.js';
import { foundIn, repairedIn } from '../../state.js';
import { car } from './models.js';
import { createPeople } from './people.js';
import { MOON, TAXI_BAY, STOOL, VENDING, TEAPOT, COIN, TOPHAT, UMBRELLA } from './layout.js';
import pixel from '../pixel/index.js';

export function createStory(w, { power, block, traffic }) {
  const progress = loadProgress(w);
  const { has } = progress;
  const people = createPeople(w, progress, traffic);
  const toast = (text) => w.env.toast?.(text);

  // 全部修好的一刻：大家一起欢呼
  w.whenRestored(() => {
    people.refreshLines();
    setTimeout(() => w.villagers.forEach((v) => v.showBubble('🎉', 3)), 1600);
  });

  // 出租车在、司机也醒了：车流动起来，礼帽出现，送外卖的来了
  const startTraffic = (instant) => {
    if (traffic.running || !has('taxi') || !progress.awake) return;
    traffic.start(instant);
    if (!instant) people.driverLeaves();
    w.revealItem('tophat', instant);
    people.addCourier(instant);
    if (!instant) toast('🚦 车流动起来了，斑马线通了！');
  };

  // 老周：拿着咖啡去跟他说话，他就醒了
  const driver = people.driver;
  if (driver) {
    driver.onTalk = () => {
      if (progress.awake) return null;
      if (!w.flag('coffee')) {
        driver.showBubble('💤');
        return '呼……呼……（说梦话）咖啡……罐装的……热乎乎的……';
      }
      progress.awake = true;
      people.wakeDriver();
      startTraffic(false);
      w.setFlag('driver');
      people.refreshLines();
      return has('taxi') ? '咕嘟咕嘟……啊！醒了！我的车回来了？谢谢你，这就出发带路！' : '咕嘟咕嘟……啊，醒了！谢谢你的咖啡！可我的出租车呢？';
    };
  }

  vending(w, block.vending, toast);
  repairs(w, { power, block, traffic, people, progress, startTraffic, toast });
  placeItems(w);
  return { refreshLines: people.refreshLines };
}

// 进度：读存档，顺便把老存档补齐
function loadProgress(w) {
  // 直接看存档：搭场景时修复还没套用上去，isRepaired 还是 false
  const has = (id) => repairedIn('city').includes(id);
  // 老存档已经通关这里：中间步骤也都当作做完了
  // 最早那版原型没有“叫醒司机”这一步：出租车放回去车就开了。那时的存档里出租车修好了，
  // 却没有“发现过出租车”的记录（新版本一定是先发现、再修），中间步骤也当作做完，不然车永远不动
  const legacyTaxi = has('taxi') && !w.flag('seen:taxi');
  if (w.complete || legacyTaxi) for (const f of ['coin', 'coffee', 'driver']) w.setFlag(f, true);
  w.extraDone = () => w.flag('driver');
  w.bag = () => {
    const b = [];
    if (w.flag('coin') && !w.flag('coffee')) b.push({ icon: '🪙', name: '硬币' });
    if (w.flag('coffee') && !w.flag('driver')) b.push({ icon: '☕', name: '罐装咖啡' });
    return b;
  };
  return { has, found: (id) => foundIn('city').includes(id), awake: w.flag('driver') };
}

// 售货机：投硬币买咖啡
function vending(w, obj, toast) {
  const [x, z] = VENDING;
  w.interact('vending', obj, x, z + 0.8, {
    reach: 1.3,
    icon: '🥤',
    short: '售货机',
    label: () => (w.flag('coffee') ? '售货机（已经买过咖啡啦）' : w.flag('coin') ? '投币买一罐咖啡' : '售货机'),
    fn() {
      if (w.flag('coffee')) {
        toast('☕ 已经买过咖啡啦');
        return;
      }
      if (!w.flag('coin')) {
        sfx.pop();
        toast('🪙 停电了，售货机还亮着应急灯……可是身上没有零钱');
        return;
      }
      sfx.pickup();
      w.fx.emit(new THREE.Vector3(x, 0.5, z + 0.35), { count: 14, spread: 0.3, rise: 1.0, color: '#fff3a0' });
      w.setFlag('coffee');
      toast('☕ 哐当！买到一罐热咖啡');
    },
  });
}

function repairs(w, { power, block, traffic, people, progress, startTraffic, toast }) {
  const k = w.kit;
  const { has } = progress;

  // 🌙 月亮挂回杆子上：月光照亮小巷，红茶壶和一枚硬币出现
  w.repairSpot('moon', ghostify(k.sphere(0.42, '#ffffff', 24)), ...MOON, {
    reach: Infinity, // 挂得太高，只能点它
    pickR: 0.6,
    seeR: 3.0,
    fn(instant) {
      power.turnOn('sky', instant);
      block.alley.open();
      w.revealItem('teapot', instant);
      w.revealItem('coin', instant);
      people.refreshLines();
    },
  });

  // 🚕 出租车回到停靠位：还要等司机醒过来
  const [tx, tz] = TAXI_BAY;
  w.repairSpot('taxi', ghostify(car(k, '#ffd23f', { taxi: true })), tx, 0, tz, {
    reach: 1.5,
    pickR: 0.6,
    seeR: 2.0,
    fn(instant) {
      traffic.showTaxi();
      if (!instant && !progress.awake) {
        people.driver?.showBubble('💤');
        toast('🚕 出租车回来了……可是司机呢？');
      }
      startTraffic(instant);
      people.refreshLines();
    },
  });

  // 🎷 萨克斯还给老乔：要等月亮出来他才看得清谱子
  const ghostSax = ghostify(pixel.items.find((i) => i.id === 'sax').make(k));
  ghostSax.scale.setScalar(2.6);
  const saxSpot = new THREE.Group();
  saxSpot.add(ghostSax);
  const [sx, sz] = STOOL;
  w.repairSpot('sax', saxSpot, sx, w.heightAt(sx, sz) + 0.5, sz, {
    reach: 1.5,
    pickR: 0.4,
    seeR: 2.0,
    can: () => has('moon') || { name: '老乔', text: '这是我的萨克斯！可是天这么黑，我连谱子都看不清……等月亮出来再吹吧。' },
    fn(instant) {
      power.turnOn('city', instant);
      block.bar.open();
      people.qiaoPlays();
      w.revealItem('umbrella', instant);
      if (!instant) {
        sfx.jazz();
        people.pop(people.qiao);
      }
      people.refreshLines();
    },
  });
}

// 藏起来的东西：修好对应的地方才出现
function placeItems(w) {
  const k = w.kit;
  const onGround = ([x, z], dy) => [x, w.heightAt(x, z) + dy, z];
  w.placeItem('umbrella', ...onGround(UMBRELLA, 0.32), { hidden: true });
  w.placeItem('tophat', ...onGround(TOPHAT, 0.47), { spin: false, hidden: true });
  w.placeItem('teapot', ...onGround(TEAPOT, 0.12), { hidden: true });
  const coin = k.cyl(0.08, 0.08, 0.02, '#ffd23f', 16, { emissive: '#ffb800', emissiveIntensity: 0.5 });
  coin.rotation.x = Math.PI / 2;
  w.placeThing('coin', coin, ...onGround(COIN, 0.15), { icon: '🪙', name: '硬币', hidden: true });
}
