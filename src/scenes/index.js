import home from './home/index.js';
import forest from './forest/index.js';
import pixel from './pixel/index.js';
import city from './city/index.js';
import london from './london.js';
import beach from './beach.js';
import terrainTest from './terrain-test.js';

// 最后一块冰箱贴：不是一个世界，而是集齐所有世界之后的纪念合照，点开是结局画面
const finale = {
  id: 'finale',
  name: '全家福',
  emoji: '🖼️',
  styleLabel: '纪念冰箱贴',
  magnetStyle: 'finale',
  ending: true,
  items: [],
};

// terrainTest 是测试场景，不在冰箱上，用 ?test=terrain 打开
/** @type {Record<string, import('../types.js').SceneDef>} */
export const SCENES = { home, forest, pixel, city, london, beach, finale, terrainTest };
export const ORDER = ['home', 'forest', 'pixel', 'city', 'london', 'beach', 'finale'];
// 小屋是家：冰箱就在小屋里，冰箱上贴的是“别的世界”，小屋自己不是冰箱贴
export const HOME = 'home';
export const MAGNETS = ORDER.filter((id) => id !== HOME);
// 现在拿得到的冰箱贴：还在做的世界（comingSoon）只在冰箱上占个位、写着"敬请期待"，不算进"集齐"
export const COLLECTIBLE_MAGNETS = MAGNETS.filter((id) => !SCENES[id].comingSoon);
// 真正可以进去玩的世界（不算全家福，也不算还在做的）
export const WORLDS = ORDER.filter((id) => !SCENES[id].ending && !SCENES[id].comingSoon);
