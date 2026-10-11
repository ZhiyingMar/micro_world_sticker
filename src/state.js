const KEY = 'micro_world_save_v1';

function fresh() {
  return {
    current: 'home',
    magnets: ['home'], // 已获得的冰箱贴（= 已解锁的世界）
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

export function resetSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
