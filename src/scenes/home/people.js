// 小屋里的两个居民：小橘（第一次进来会打招呼）和阿绵，台词里带着找东西的提示

/**
 * 让小橘和阿绵住进小屋
 * @param {World} world 小屋这个世界
 */
export function createPeople(world) {
  world.villager(
    {
      name: '小橘',
      look: { hair: '#e8893a', shirt: '#ffd84a', pants: '#7a8fc4' },
      lines: [
        '今天的阳光好舒服呀～',
        '听说冰箱上的每一块冰箱贴，都是一个小小的世界哦。',
        '我刚才好像看到床底下有什么东西在发光……',
        '要不要一起喝杯茶？☕',
      ],
    },
    1.2,
    2.4,
  );
  world.villager(
    {
      name: '阿绵',
      look: { hair: '#f2e6d6', shirt: '#8ec5e8', pants: '#e8b38a', hat: 'bow', hatColor: '#f6a6b8' },
      lines: [
        '呼啊……刚睡醒。',
        '角落那盆大植物最近长得好快，土里好像冒出了点什么。',
        '冰箱顶上……是不是有颗星星在闪？',
        '我最喜欢收集小东西了！你也是吗？',
      ],
    },
    -1.5,
    -1.0,
  );
}
