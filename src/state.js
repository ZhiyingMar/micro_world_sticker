const KEY = 'micro_world_save_v1';

function fresh() {
  return {
    current: 'home',
    magnets: [], // 已获得的冰箱贴（= 已解锁的世界；小屋是家，不算冰箱贴）
    found: {}, // { sceneId: [itemId, ...] }
    newMagnet: null, // 刚获得、还没进去过的冰箱贴
    seenIntro: false,
    muted: false,
    // 小屋装修：{ wallpaper, floor } 是现在用的那款 id，owned 是工作台上做过的；没有就是一开始那套
    decor: { owned: [] },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    /* 隐私模式等情况下读取失败，直接用新存档 */
  }
  return fresh();
}

export const state = load();

// 只在内存里玩（宣传片模式）：不读也不写浏览器里的存档，录完玩家的进度一点不变
let memoryOnly = false;

/**
 * 换成一份只在内存里的进度，之后 save() 不再写进浏览器
 * @description 宣传片要从固定的进度开始演（夜都还停着电、冰箱上已经有夜都那块），又不能动玩家自己的存档
 * @param {object} preset 要用的进度，没写到的字段按新存档补齐
 */
export function useMemorySave(preset) {
  memoryOnly = true;
  for (const key of Object.keys(state)) {
    delete state[key];
  }
  Object.assign(state, fresh(), structuredClone(preset));
}

export function save() {
  if (memoryOnly) {
    return;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 写不进去就算了，不影响游玩 */
  }
}

export function foundIn(sceneId) {
  return state.found[sceneId] || (state.found[sceneId] = []);
}

// 破败世界里已经修好的地方：{ sceneId: [repairId, ...] }
export function repairedIn(sceneId) {
  if (!state.repaired) state.repaired = {};
  return state.repaired[sceneId] || (state.repaired[sceneId] = []);
}

// 破败世界里的其他进度：发现了哪些修复点、拿到的小道具……{ sceneId: ['seen:moon', 'coin', ...] }
export function flagsIn(sceneId) {
  if (!state.flags) state.flags = {};
  return state.flags[sceneId] || (state.flags[sceneId] = []);
}

/**
 * 背包里某种材料有多少
 * @description 材料（瓶子、蘑菇……）各个世界共用一个背包，以后回家在工作台上合成用
 * @param {string} id 材料 id，比如 plastic、glass
 * @returns {number}
 */
export function materialCount(id) {
  return state.materials?.[id] || 0;
}

/**
 * 捡到材料，存进背包
 * @param {string} id 材料 id
 * @param {number} amount 捡到几个
 * @returns {number} 现在一共有几个
 */
export function addMaterial(id, amount = 1) {
  if (!state.materials) {
    state.materials = {};
  }
  state.materials[id] = materialCount(id) + amount;
  save();
  return state.materials[id];
}

/**
 * 背包里的材料够不够这份配方
 * @param {Object<string, number>} cost 每种材料要几个，比如 { plastic: 3, glass: 1 }
 * @returns {boolean}
 */
export function canAfford(cost) {
  return Object.entries(cost).every(([id, amount]) => materialCount(id) >= amount);
}

/**
 * 按配方从背包里扣材料
 * @description 调用前先用 canAfford 看够不够；不够还扣是调用方的错，直接报错，不把数量扣成负的
 * @param {Object<string, number>} cost 每种材料要几个
 */
export function spendMaterials(cost) {
  if (!canAfford(cost)) {
    throw new Error(`材料不够，扣不了：${JSON.stringify(cost)}`);
  }

  for (const [id, amount] of Object.entries(cost)) {
    state.materials[id] = materialCount(id) - amount;
  }
  save();
}

export function resetSave() {
  if (memoryOnly) {
    return;
  }
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
