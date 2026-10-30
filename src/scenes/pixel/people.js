// 像素小镇的居民和他们的台词。台词就是给玩家的提示：小镇卡住了时说缺了什么、在哪儿，修好以后说三样东西藏在哪、怎么走上台地
import { VILLAGERS } from './layout.js';

const LOOKS = {
  fangfang: { hair: '#3b2a20', shirt: '#e85d5d', pants: '#3d5bd6', hat: 'cap', hatColor: '#e85d5d' },
  doudou: { hair: '#ffd84a', shirt: '#52b852', pants: '#6e4520' },
  axiang: { hair: '#8b5a2b', shirt: '#b38ee8', pants: '#4a4a5a', hat: 'beanie', hatColor: '#ff9ec7' },
};
// 阿像走得慢吞吞的
const AXIANG_SPEED = 0.7;

// 修好以后的台词：三样东西藏在哪、怎么走上台地
const RESTORED_LINES = {
  fangfang: [
    '欢迎来到像素小镇！这里一切都是方的，包括我的脑袋。',
    '广场上的喷泉一直在冒水，下面那层水池里，好像浮着一个小小的月亮……可现在是白天呀？',
    '小镇是一层一层的，台阶要一格一格走上去。你仔细听，脚底下会叮叮咚咚响哦。',
  ],
  doudou: [
    '从广场后面的大台阶上来，就是蓝屋顶房子。屋子后头堆着几个木箱，最上面好像停着一辆黄色的小车。',
    '我在练习走直线。一格、一格、又一格。',
    '你知道吗？这个镇子再往外，是一座晚上比白天还亮的大城市。',
  ],
  axiang: [
    '菜园白栅栏外面那棵矮矮的苹果树底下，有什么东西金灿灿的，像一支萨克斯。',
    '……嘀嘀嘀，存档中，请勿关机。',
    '小鸡们胆子可小了，走路轻一点。',
    '风车山上能看到整个小镇。从后面的台地往左，再上一级台阶就到了。',
  ],
};

/**
 * 放小镇的三位居民
 * @param {World} world 像素小镇
 * @returns {{ fangfang: Villager, doudou: Villager, axiang: Villager, refreshLines(progress: { has(id: string): boolean, restored: boolean }): void }}
 *   三位居民；按修好了哪些地方换台词
 */
export function createPeople(world) {
  const fangfang = world.villager({ name: '方方', look: LOOKS.fangfang }, ...VILLAGERS.fangfang);
  const doudou = world.villager({ name: '豆豆', look: LOOKS.doudou }, ...VILLAGERS.doudou);
  const axiang = world.villager({ name: '阿像', speed: AXIANG_SPEED, look: LOOKS.axiang }, ...VILLAGERS.axiang);

  const refreshLines = (progress) => {
    if (progress.restored) {
      setLines(fangfang, RESTORED_LINES.fangfang);
      setLines(doudou, RESTORED_LINES.doudou);
      setLines(axiang, RESTORED_LINES.axiang);
      return;
    }
    setLines(fangfang, fangfangStuckLines(progress));
    setLines(doudou, doudouStuckLines(progress));
    setLines(axiang, axiangStuckLines(progress));
  };
  return { fangfang, doudou, axiang, refreshLines };
}

/**
 * 换一位居民的台词；和原来一样就不换，免得聊到一半又从第一句说起
 * @param {Villager} villager
 * @param {string[]} lines
 */
function setLines(villager, lines) {
  if (villager.lines.join() === lines.join()) {
    return;
  }
  villager.lines = lines;
  villager.lineIdx = 0;
}

/**
 * 方方（广场上）：小镇卡住了时，说三样东西各缺在哪儿
 * @param {{ has(id: string): boolean }} progress 修好了哪些地方
 * @returns {string[]}
 */
function fangfangStuckLines({ has }) {
  const lines = ['那场大风把小镇的三样东西吹进了森林……小镇一下子就卡住了。'];
  if (!has('heart')) {
    lines.push('喷泉是小镇的心。心被吹走了，水就不冒了。');
  }
  if (!has('coin')) {
    lines.push('大台阶底下那台投币机一直闪着 INSERT COIN。台阶的方块全不见了，上不了台地。');
  }
  if (!has('cartridge')) {
    lines.push('风车门口的卡槽机空着。卡带不插回去，风车就不转，小镇的音乐也没了。');
  }
  return lines;
}

/**
 * 豆豆（后面台地上）：台阶塌了时被困在上面，台阶回来了指路去风车山
 * @param {{ has(id: string): boolean }} progress 修好了哪些地方
 * @returns {string[]}
 */
function doudouStuckLines({ has }) {
  if (!has('coin')) {
    return ['喂——我下不去啦！台阶的方块都不见了。', '投个币，台阶说不定就长回来了？'];
  }
  if (!has('cartridge')) {
    return ['谢谢你！台阶长回来了，走上去还叮叮咚咚的。', '风车门口有台卡槽机，空着好久了。从这边往左，再上一级台阶就是风车山。'];
  }
  return ['风车转起来了！', RESTORED_LINES.doudou[0]];
}

/**
 * 阿像（前面，菜园旁边）：卡带没插回去时像游戏机一样卡着，音乐回来了就说萨克斯在哪
 * @param {{ has(id: string): boolean }} progress 修好了哪些地方
 * @returns {string[]}
 */
function axiangStuckLines({ has }) {
  if (!has('cartridge')) {
    return ['……嘀嘀嘀，读不到卡带，请插入卡带。', '小鸡们胆子可小了，走路轻一点。'];
  }
  return ['音乐回来了！', RESTORED_LINES.axiang[0]];
}
