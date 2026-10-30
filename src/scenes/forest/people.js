// 森林的居民和他们的台词。台词就是给玩家的提示：魔法停了时说缺了什么、在哪儿，修好以后说东西藏在哪、怎么过池塘、怎么上山
import { VILLAGERS } from './layout.js';

const LOOKS = {
  bobo: { hair: '#f2e6d6', shirt: '#7fb2f0', pants: '#a0663a', hat: 'gnome', hatColor: '#e85d5d' },
  lily: { hair: '#c48a54', shirt: '#ffb7d5', pants: '#7fb2f0', hat: 'gnome', hatColor: '#b38ee8' },
  mushroomKid: { hair: '#7a4b2a', shirt: '#fff3dd', pants: '#8a5a3a', hat: 'mushroom', hatColor: '#f26b6b' },
};
// 蘑菇仔走得慢吞吞的
const MUSHROOM_KID_SPEED = 0.65;

// 修好以后的台词：东西藏在哪、怎么过池塘、怎么上山
const RESTORED_LINES = {
  bobo: [
    '欢迎来到童话森林！林子里那三座蘑菇屋是我盖的哦：一座在后面林子里，一座在小土坡上，还有一座在小溪那边。',
    '池塘里有一排踏脚石，弯弯曲曲的，踩着石头就能过到对面。拐弯那儿的荷叶上，好像停着一枚亮晶晶的金币……',
    '听说凑齐“像素的东西”，就能去一个方方正正的世界。',
  ],
  lily: [
    '嘘……前面那根空心木头里，好像住着一颗小小的心。',
    '山顶高塔后面的花丛，我从来没去过呢。从这边的台阶上山腰，绕着山走就上得去，你敢去看看吗？',
    '你也是从冰箱上来的吗？',
  ],
  mushroomKid: [
    '……嗯？',
    '谢谢你把童话书带回来，我每天都在树桩边讲一个故事。',
    '小溪上那座桥，是大家一起搭在一颗大红蘑菇上的。',
    '你的鞋子，踩到我的影子啦。',
  ],
};

/**
 * 放森林的三位居民
 * @param {World} world 童话森林
 * @returns {{ bobo: Villager, lily: Villager, mushroomKid: Villager, refreshLines(progress: { has(id: string): boolean, restored: boolean }): void }}
 *   三位居民；按修好了哪些地方换台词
 */
export function createPeople(world) {
  const bobo = world.villager({ name: '波波', look: LOOKS.bobo }, ...VILLAGERS.bobo);
  const lily = world.villager({ name: '莉莉', look: LOOKS.lily }, ...VILLAGERS.lily);
  const mushroomKid = world.villager({ name: '蘑菇仔', speed: MUSHROOM_KID_SPEED, look: LOOKS.mushroomKid }, ...VILLAGERS.mushroomKid);

  const refreshLines = (progress) => {
    if (progress.restored) {
      setLines(bobo, RESTORED_LINES.bobo);
      setLines(lily, RESTORED_LINES.lily);
      setLines(mushroomKid, RESTORED_LINES.mushroomKid);
      return;
    }
    setLines(bobo, boboBrokenLines(progress));
    setLines(lily, lilyBrokenLines(progress));
    setLines(mushroomKid, mushroomKidBrokenLines(progress));
  };
  return { bobo, lily, mushroomKid, refreshLines };
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
 * 波波（出生点旁边）：魔法停了时，说三样东西各缺在哪儿
 * @param {{ has(id: string): boolean }} progress 修好了哪些地方
 * @returns {string[]}
 */
function boboBrokenLines({ has }) {
  const lines = ['前些天刮了一场大风，森林里的三样东西都被吹跑了……说不定吹进了谁家的小屋里？'];
  if (!has('book')) {
    lines.push('蘑菇仔的童话书不见了，他就一直站在小土坡上的树桩边发呆。');
  }
  if (!has('mushroom')) {
    lines.push('小溪上的桥本来搭在一颗大红蘑菇上。蘑菇被吹走了，桥就塌进了水里。');
  }
  if (!has('star')) {
    lines.push('山顶高塔的塔尖上，本来有一颗魔法星星。星星一不见，池塘里的踏脚石全沉到水底了。');
  }
  return lines;
}

/**
 * 莉莉（小溪对岸）：桥塌了时隔着小溪喊，桥修好了指路上山
 * @param {{ has(id: string): boolean }} progress 修好了哪些地方
 * @returns {string[]}
 */
function lilyBrokenLines({ has }) {
  if (!has('mushroom')) {
    return ['喂——听得见吗？桥塌了，我过不去啦！', '桥底下本来撑着一颗大红蘑菇的，你见过吗？'];
  }
  if (!has('star')) {
    return ['谢谢你修好了桥！', '山顶的高塔黑乎乎的，塔尖上好像少了点什么……从这边的台阶上山腰，绕着山走就上得去。'];
  }
  return ['塔尖亮起来了！池塘里的踏脚石也浮上来了。', RESTORED_LINES.lily[1]];
}

/**
 * 蘑菇仔（小土坡上）：书丢了时守着空树桩，书回来了就讲故事，故事里说爱心藏在哪
 * @param {{ has(id: string): boolean }} progress 修好了哪些地方
 * @returns {string[]}
 */
function mushroomKidBrokenLines({ has }) {
  if (!has('book')) {
    return ['……嗯？', '我的童话书不见了……没有故事听，我就一直站着，都快长成蘑菇了。', '书是紫色的，封面上有一颗小星星。'];
  }
  return ['从前，有一根空心的木头，木头里住着一颗小小的心……', '故事讲到哪儿，森林里哪儿就会亮起来哦。', '你的鞋子，踩到我的影子啦。'];
}
