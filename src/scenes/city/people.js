// 夜都的居民和他们的台词。台词跟着城市修好的程度变
import { DRIVER_SEAT, STOOL, VILLAGERS } from './layout.js';
import pixel from '../pixel.js';

const LOOKS = {
  yemao: { hair: '#2b2b33', shirt: '#3d4a6b', pants: '#2a2d38', shoes: '#1d1d24' },
  ani: { hair: '#ff8fc8', shirt: '#ff5fa2', pants: '#2e3a6b', hat: 'beanie', hatColor: '#4ff0ff' },
  qiao: { hair: '#d8d8d8', shirt: '#6b3a5a', pants: '#26262e', shoes: '#1d1d24', hat: 'beanie', hatColor: '#26262e' },
  driver: { hair: '#3a2a20', shirt: '#2f6d8a', pants: '#3a3d4a', hat: 'cap', hatColor: '#ffd23f' },
  xiaofei: { hair: '#5a3d2b', shirt: '#ffb84f', pants: '#3a3d4a', hat: 'cap', hatColor: '#ff7a3a' },
};

// progress: { has(id) 修好了没有, found(id) 找到了没有, awake 司机醒了没有 }；traffic: 车流动起来没有
export function createPeople(w, progress, traffic) {
  const { has, found } = progress;
  const yemao = w.villager({ name: '夜猫', look: LOOKS.yemao }, ...VILLAGERS.yemao);
  const ani = w.villager({ name: '阿霓', look: LOOKS.ani }, ...VILLAGERS.ani);
  // 老乔：丢了萨克斯，垂头丧气地站在酒吧门口
  const qiao = w.villager({ name: '老乔', look: LOOKS.qiao }, STOOL[0] - 0.5, STOOL[1] + 0.25);
  qiao.pin({ emote: '😢', face: 0.4 });

  // 出租车司机老周：停电后在便利店门口路边的长椅上等着等着睡着了
  // 不放在大楼前面：玩俄罗斯方块时他和 💤 会挡住最下面几行
  const [dx, dz] = DRIVER_SEAT;
  let driver = null;
  if (!(progress.awake && has('taxi'))) {
    driver = w.villager({ name: '老周', look: LOOKS.driver }, dx, dz - 0.5);
    if (!progress.awake) {
      driver.root.position.set(dx, 0, dz);
      driver.pin({ emote: '💤', sit: true, seatY: 0.45, face: 0 });
    }
  }

  const pop = (v) => w.fx.emit(v.root.position.clone().setY(v.root.position.y + 0.6), { count: 14, spread: 0.4, rise: 1.2, color: '#ffe9a8' });

  const setLines = (v, lines) => {
    if (!v || v.lines.join() === lines.join()) return;
    v.lines = lines;
    v.lineIdx = 0;
  };
  const refreshLines = () => {
    setLines(qiao, has('sax') ? ['谢谢你把萨克斯从像素小镇带回来！', '音乐一响，整条街的灯都跟着亮了。', '马路对面坡上的公园，土坡上的树丛里，好像有把红伞在反光。'] : ['我的萨克斯不见了……', '没有萨克斯，这条街就没有音乐，霓虹也不肯亮。']);
    setLines(driver, ['谢谢你的咖啡！可我的出租车还没回来……', '黄色的，车顶有个小灯，你见过吗？']);
    if (w.fullyRepaired) {
      setLines(yemao, [
        '加班到现在……便利店的饭团，就是我的光。',
        w.flag('tetris') ? '你在大楼上玩俄罗斯方块，整条街都看见了！' : '偷偷告诉你：我们公司那栋楼的窗户，其实是一台俄罗斯方块机。点一下试试？',
        '公园长椅上有顶黑色礼帽，是哪位绅士落下的？',
        '大楼和便利店中间的小巷里，夜里总飘出红茶的香味。',
        'BAR 后面过了马路有个观景台，上面的望远镜正好对着月亮。',
        '街上到处是空瓶子……捡回去说不定能做点什么。',
      ]);
      setLines(ani, ['这座城市的夜晚，比白天还要亮！', '我在等最后一班公交……后面坡上的树丛里有把红伞，不过不是我的。', '过马路要走斑马线哦，车会停下来让你。']);
      return;
    }
    const l = ['停电了……整座城一下子全黑了。'];
    if (!has('moon')) l.push('便利店后面那根高高的杆子上，本来挂着月亮的。');
    else if (!found('teapot')) l.push('月光照进小巷了！铁丝网那头飘出红茶的香味……从街区后面绕过去看看？');
    if (!has('taxi')) l.push('车都堵在斑马线上。司机们说，要等那辆黄色出租车回来带头。');
    else if (!progress.awake) l.push('出租车回来了，可司机老周还在便利店门口的长椅上睡大觉。他最爱喝罐装咖啡。');
    if (!has('sax')) l.push('对面 BAR 的老乔把萨克斯弄丢了。他不吹，这条街的霓虹就不亮。');
    setLines(yemao, l);
    if (!traffic.running) setLines(ani, ['车都不动了，堵得死死的……我可不敢从车缝里挤过去。', '要是有辆出租车来带个头就好了。']);
    else setLines(ani, ['车终于动了！可公园里还是黑乎乎的。', '刚才出租车上下来一位绅士，往坡上公园的土坡后面去了，好像把帽子落在那儿的长椅上。']);
  };

  return {
    qiao,
    pop,
    refreshLines,
    get driver() {
      return driver;
    },
    // 司机醒了
    wakeDriver() {
      driver.unpin();
      driver.showBubble('❗', 2);
    },
    // 司机上车：人消失在出租车里
    driverLeaves() {
      if (!driver) return;
      const d = driver;
      driver = null;
      d.moveTarget = null;
      setTimeout(() => {
        pop(d);
        d.root.removeFromParent();
        w.villagers.splice(w.villagers.indexOf(d), 1);
      }, 900);
    },
    // 路通了，送外卖的小飞来了
    addCourier(instant) {
      const v = w.villager(
        {
          name: '小飞',
          speed: 1.1,
          look: LOOKS.xiaofei,
          lines: ['路通了！外卖又能送了！', '外卖！外卖！……啊，送错世界了。', '听说再往前，有一座一直在下雨的城市。', '下次我想送一份炸鱼薯条。'],
        },
        ...VILLAGERS.xiaofei,
      );
      if (!instant) pop(v);
    },
    // 老乔拿回萨克斯，坐到凳子上吹起来
    qiaoPlays() {
      const sax = pixel.items.find((i) => i.id === 'sax').make(w.kit);
      sax.position.set(0.12, 0.2, 0.16);
      qiao.body.add(sax);
      qiao.root.position.set(STOOL[0], 0, STOOL[1]);
      qiao.pin({ emote: '🎷', sit: true, seatY: 0.45, face: 0.3 });
    },
  };
}
