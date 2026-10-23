// 森林的居民和他们的台词。台词就是给玩家的提示：东西藏在哪、怎么过池塘、怎么上山
import { VILLAGERS } from './layout.js';

const LOOKS = {
  bobo: { hair: '#f2e6d6', shirt: '#7fb2f0', pants: '#a0663a', hat: 'gnome', hatColor: '#e85d5d' },
  lily: { hair: '#c48a54', shirt: '#ffb7d5', pants: '#7fb2f0', hat: 'gnome', hatColor: '#b38ee8' },
  mushroomKid: { hair: '#7a4b2a', shirt: '#fff3dd', pants: '#8a5a3a', hat: 'mushroom', hatColor: '#f26b6b' },
};
// 蘑菇仔走得慢吞吞的
const MUSHROOM_KID_SPEED = 0.65;

/**
 * 放森林的三位居民
 * @param {World} world 童话森林
 */
export function createPeople(world) {
  world.villager(
    {
      name: '波波',
      look: LOOKS.bobo,
      lines: [
        '欢迎来到童话森林！后面那几座蘑菇屋是我盖的哦。',
        '池塘里有一排踏脚石，弯弯曲曲的，踩着石头就能过到对面。拐弯那儿的荷叶上，好像停着一枚亮晶晶的金币……',
        '听说凑齐“像素的东西”，就能去一个方方正正的世界。',
      ],
    },
    ...VILLAGERS.bobo,
  );

  world.villager(
    {
      name: '莉莉',
      look: LOOKS.lily,
      lines: [
        '嘘……前面那根空心木头里，好像住着一颗小小的心。',
        '山顶高塔后面的花丛，我从来没去过呢。从这边的台阶上山腰，绕着山走就上得去，你敢去看看吗？',
        '你也是从冰箱上来的吗？',
      ],
    },
    ...VILLAGERS.lily,
  );

  world.villager(
    {
      name: '蘑菇仔',
      speed: MUSHROOM_KID_SPEED,
      look: LOOKS.mushroomKid,
      lines: ['……嗯？', '我在这里站了好久，都快长成蘑菇了。', '小溪上那座桥，是大家一起搭的。', '你的鞋子，踩到我的影子啦。'],
    },
    ...VILLAGERS.mushroomKid,
  );
}
