import home from './home.js';
import forest from './forest.js';
import pixel from './pixel.js';
import city from './city.js';
import london from './london.js';

// 还没做出来的世界：冰箱贴可以拿到，但里面还在施工
const beach = {
  id: 'beach',
  name: '海边假日',
  emoji: '🏖️',
  styleLabel: '即将开放',
  magnetStyle: 'beach',
  comingSoon: true,
  items: [],
};

export const SCENES = { home, forest, pixel, city, london, beach };
export const ORDER = ['home', 'forest', 'pixel', 'city', 'london', 'beach'];
