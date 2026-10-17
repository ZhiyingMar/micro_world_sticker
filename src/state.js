const KEY = 'micro_world_save_v1';

function fresh() {
  return {
    current: 'home',
    magnets: [], // 已获得的冰箱贴（= 已解锁的世界；小屋是家，不算冰箱贴）
    found: {}, // { sceneId: [itemId, ...] }
    newMagnet: null, // 刚获得、还没进去过的冰箱贴
    seenIntro: false,
    muted: false,
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

export function save() {
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

export function resetSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
