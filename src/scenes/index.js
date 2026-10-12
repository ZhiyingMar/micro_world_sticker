import home from './home.js';
import forest from './forest.js';
import pixel from './pixel.js';
import city from './city.js';
import london from './london.js';
import beach from './beach.js';

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

export const SCENES = { home, forest, pixel, city, london, beach, finale };
export const ORDER = ['home', 'forest', 'pixel', 'city', 'london', 'beach', 'finale'];
// 真正可以进去玩的世界
export const WORLDS = ORDER.filter((id) => !SCENES[id].ending);
