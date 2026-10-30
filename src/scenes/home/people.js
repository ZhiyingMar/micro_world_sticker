// 小屋里的两个居民：小橘（第一次进来会打招呼）和阿绵，台词里带着找东西的提示
// 白天、夜里说的话不一样（几点算夜里由 daylight.js 按钟点决定，和蟋蟀、摇篮曲同一个时刻）；
// 找东西的提示白天夜里都有，晚上进来也找得到

// 每个居民：名字、长相、一开始站在哪，白天和夜里的台词
const RESIDENTS = [
  {
    name: '小橘',
    look: { hair: '#e8893a', shirt: '#ffd84a', pants: '#7a8fc4' },
    x: 1.2,
    z: 2.4,
    dayLines: [
      '今天的阳光好舒服呀～',
      '听说冰箱上的每一块冰箱贴，都是一个小小的世界哦。',
      '我刚才好像看到床底下有什么东西在发光……',
      '要不要一起喝杯茶？☕',
    ],
    nightLines: [
      '晚上好呀～落地灯一亮，屋里就暖暖的。',
      '听说冰箱上的每一块冰箱贴，都是一个小小的世界哦。',
      '关了大灯才看得清：床底下好像有什么东西在发光……',
      '睡前要不要来杯热牛奶？🥛',
    ],
  },
  {
    name: '阿绵',
    look: { hair: '#f2e6d6', shirt: '#8ec5e8', pants: '#e8b38a', hat: 'bow', hatColor: '#f6a6b8' },
    x: -1.5,
    z: -1.0,
    dayLines: [
      '呼啊……刚睡醒。',
      '角落那盆大植物最近长得好快，土里好像冒出了点什么。',
      '冰箱顶上……是不是有颗星星在闪？',
      '我最喜欢收集小东西了！你也是吗？',
    ],
    nightLines: [
      '呼啊……好困，可我还不想睡。',
      '角落那盆大植物晚上也在偷偷长，土里好像冒出了点什么。',
      '冰箱顶上那颗星星，晚上比窗外的还亮。',
      '你听，外面的蟋蟀在唱歌，花园里还有萤火虫！',
    ],
  },
];

/**
 * 让小橘和阿绵住进小屋
 * @param {World} world 小屋这个世界
 * @returns {{ setNight(night: boolean): void }} 天黑了 / 天亮了：换成夜里 / 白天的台词
 */
export function createPeople(world) {
  const residents = RESIDENTS.map((resident) => {
    const villager = world.villager({ name: resident.name, look: resident.look, lines: resident.dayLines }, resident.x, resident.z);
    return { resident, villager };
  });
  let night = false;

  return {
    setNight(isNight) {
      if (isNight === night) {
        return;
      }

      night = isNight;
      for (const { resident, villager } of residents) {
        // 换了一套话，从第一句说起（第一句是打招呼，"晚上好"这种）
        villager.lines = night ? resident.nightLines : resident.dayLines;
        villager.lineIdx = 0;
      }
    },
  };
}
