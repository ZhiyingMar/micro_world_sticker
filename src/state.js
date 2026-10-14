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

export function resetSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
