// 像素小镇的居民和台词。台词就是给玩家的提示：三样东西藏在哪、怎么走上台地
import { VILLAGERS } from './layout.js';

const LOOKS = {
  fangfang: { hair: '#3b2a20', shirt: '#e85d5d', pants: '#3d5bd6', hat: 'cap', hatColor: '#e85d5d' },
  doudou: { hair: '#ffd84a', shirt: '#52b852', pants: '#6e4520' },
  axiang: { hair: '#8b5a2b', shirt: '#b38ee8', pants: '#4a4a5a', hat: 'beanie', hatColor: '#ff9ec7' },
};
// 阿像走得慢吞吞的
const AXIANG_SPEED = 0.7;

/**
 * 放小镇的三位居民
 * @param {World} world 像素小镇
 */
export function createPeople(world) {
  world.villager(
    {
      name: '方方',
      look: LOOKS.fangfang,
      lines: [
        '欢迎来到像素小镇！这里一切都是方的，包括我的脑袋。',
        '广场上的喷泉一直在冒水，下面那层水池里，好像浮着一个小小的月亮……可现在是白天呀？',
        '小镇是一层一层的，台阶要一格一格走上去。你仔细听，脚底下会叮叮咚咚响哦。',
      ],
    },
    ...VILLAGERS.fangfang,
  );

  world.villager(
    {
      name: '豆豆',
      look: LOOKS.doudou,
      lines: [
        '从广场后面的大台阶上来，就是蓝屋顶房子。屋子后头堆着几个木箱，最上面好像停着一辆黄色的小车。',
        '我在练习走直线。一格、一格、又一格。',
        '你知道吗？这个镇子再往外，是一座晚上比白天还亮的大城市。',
      ],
    },
    ...VILLAGERS.doudou,
  );

  world.villager(
    {
      name: '阿像',
      speed: AXIANG_SPEED,
      look: LOOKS.axiang,
      lines: [
        '菜园白栅栏外面那棵矮矮的苹果树底下，有什么东西金灿灿的，像一支萨克斯。',
        '……嘀嘀嘀，存档中，请勿关机。',
        '小鸡们胆子可小了，走路轻一点。',
        '风车山上能看到整个小镇。从后面的台地往左，再上一级台阶就到了。',
      ],
    },
    ...VILLAGERS.axiang,
  );
}
