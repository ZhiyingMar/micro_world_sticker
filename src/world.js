import * as THREE from 'three';
import { Kit } from './kit.js';
import { Sparkles } from './fx.js';
import { Villager } from './villager.js';
import { foundIn, repairedIn, flagsIn, save } from './state.js';

const proxyMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
// 修复点上“缺了东西”的半透明虚影
const ghostMat = new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.35, depthWrite: false });

// 把一个模型变成虚影：换成半透明材质，不投影，光晕关掉
export function ghostify(obj) {
  obj.traverse((o) => {
    if (o.isSprite || o.isLight) o.visible = false;
    else if (o.isMesh) {
      o.material = ghostMat;
      o.castShadow = o.receiveShadow = false;
    }
  });
  return obj;
}

// 一个“冰箱贴世界”：方块小场景 + 里面的东西和居民
export class World {
  constructor(def, env = {}) {
    this.def = def;
    this.env = env; // { hemi, sun, toast, onChange }：场景里改灯光（比如闪电）、弹提示、通知界面刷新
    this.kit = new Kit(def.style);
    this.root = new THREE.Group();
    this.colliders = [];
    this.bounds = { minX: -4.55, maxX: 4.55, minZ: -4.55, maxZ: 4.55, ...(def.bounds || {}) };
    this.villagers = [];
    this.items = new Map();
    this.hiddenItems = new Map(); // 要等修好某处才出现的物品
    this.repairs = new Map(); // 修复点：{ id, spot, x, z, reach, fn, can, seen }
    this.interacts = new Map(); // 可以互动的东西（售货机……）：{ id, obj, x, z, reach, label, icon, fn }
    this.restoredFns = [];
    this.games = new Map(); // 点一下就能玩的小游戏（大楼俄罗斯方块……）
    this.pois = [];
    this.updaters = [];
    this.textures = [];
    this.fx = new Sparkles(this.root);
    // 这个世界的东西已经找齐了（老存档也算）：破败世界直接当作已经修好
    this.complete = def.items.length > 0 && def.items.every((i) => foundIn(def.id).includes(i.id));
    if (def.repairs && this.complete) {
      const done = repairedIn(def.id);
      for (const r of def.repairs) if (!done.includes(r.id)) done.push(r.id);
    }
    def.build(this);
    // 已经修好的地方直接恢复原样（不播动画）
    if (def.repairs) {
      for (const id of [...repairedIn(def.id)]) this.repair(id, true);
      this.restored = this.fullyRepaired;
    }
  }

  add(obj, x = 0, y = 0, z = 0, ry = 0) {
    obj.position.set(x, y, z);
    if (ry) obj.rotation.y = ry;
    this.root.add(obj);
    return obj;
  }

  // 把物体的包围盒登记成障碍物
  solid(obj, pad = 0) {
    obj.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(obj);
    this.colliders.push({ type: 'box', minX: b.min.x - pad, maxX: b.max.x + pad, minZ: b.min.z - pad, maxZ: b.max.z + pad });
    return obj;
  }

  solidCircle(x, z, r) {
    this.colliders.push({ type: 'circle', x, z, r });
  }

  blocked(x, z, r, self) {
    const b = this.bounds;
    if (x - r < b.minX || x + r > b.maxX || z - r < b.minZ || z + r > b.maxZ) return true;
    for (const c of this.colliders) {
      if (c.type === 'box') {
        const cx = Math.max(c.minX, Math.min(x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
        if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
      } else if ((x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2) {
        return true;
      }
    }
    if (self) {
      const others = this.player ? [...this.villagers, this.player] : this.villagers;
      for (const v of others) {
        if (v === self) continue;
        const rr = r + v.radius;
        const dx = x - v.x;
        const dz = z - v.z;
        if (dx * dx + dz * dz < rr * rr) {
          // 已经重叠时允许走开，避免卡死
          const cur = (self.x - v.x) ** 2 + (self.z - v.z) ** 2;
          if (dx * dx + dz * dz < cur) return true;
        }
      }
    }
    return false;
  }

  // 放置一个隐藏物品（已经找到过的就不再放）
  placeItem(id, x, y, z, { ry = 0, scale = 1, spin = true, hidden = false } = {}) {
    if (foundIn(this.def.id).includes(id)) return null;
    const itemDef = this.def.items.find((i) => i.id === id);
    const g = new THREE.Group();
    const model = itemDef.make(this.kit);
    model.scale.setScalar(scale);
    g.add(model);
    const proxy = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), proxyMat);
    proxy.castShadow = false;
    proxy.userData.pickable = true;
    g.add(proxy);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    g.userData.itemId = id;
    g.userData.baseY = y;
    g.userData.spin = spin;
    g.userData.nextSparkle = 1 + Math.random() * 2;
    g.userData.hover = 0;
    this.root.add(g);
    if (hidden) {
      g.visible = false;
      this.hiddenItems.set(id, g);
    } else {
      this.items.set(id, g);
    }
    return g;
  }

  // 让一个藏起来的物品出现
  revealItem(id, instant = false) {
    const g = this.hiddenItems.get(id);
    if (!g) return;
    this.hiddenItems.delete(id);
    this.items.set(id, g);
    g.visible = true;
    if (!instant) {
      g.scale.setScalar(0.001);
      this.fx.emit(g.position, { count: 14, spread: 0.3, size: 0.3, rise: 1.0, color: '#fff3a0' });
    }
  }

  // 世界里的小道具（硬币、咖啡……）：不算收集物品，捡起来放进背包，用来修东西
  placeThing(id, obj, x, y, z, { icon, name, hidden = false } = {}) {
    if (this.flag(id)) return null;
    const g = new THREE.Group();
    g.add(obj);
    const proxy = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), proxyMat);
    proxy.castShadow = false;
    proxy.userData.pickable = true;
    g.add(proxy);
    g.position.set(x, y, z);
    g.userData = { itemId: id, thing: { icon, name }, baseY: y, spin: true, nextSparkle: 1, hover: 0 };
    this.root.add(g);
    if (hidden) {
      g.visible = false;
      this.hiddenItems.set(id, g);
    } else this.items.set(id, g);
    return g;
  }

  // ---------- 破败世界的进度标记 ----------
  flag(name) {
    return flagsIn(this.def.id).includes(name);
  }

  setFlag(name, instant = false) {
    const f = flagsIn(this.def.id);
    if (f.includes(name)) return;
    f.push(name);
    save();
    if (instant) return;
    this.env.onChange?.();
    this.checkRestored();
  }

  // 背包里还没用掉的小道具，scene 里可以覆盖
  bag() {
    return [];
  }

  // ---------- 可以互动的东西 ----------
  interact(id, obj, x, z, { reach = 1.4, label, icon = '👆', fn }) {
    obj.userData.interact = id;
    this.interacts.set(id, { id, obj, x, z, reach, label, icon, fn });
  }

  // ---------- 小游戏 ----------
  // opts: { title, hover, help, view: { target, halfW, halfH }, can(), start(api), stop(), key(k), update(dt) }
  game(id, obj, opts) {
    obj.userData.game = id;
    this.games.set(id, { id, obj, ...opts });
  }

  // ---------- 破败世界：修复点 ----------
  // spot 是放在缺东西的地方的虚影，要先走近（或把镜头拉近）才会发现
  // can() 返回 true 表示可以修；返回 { name, text } 表示还不行，由谁说什么
  // 修好时调用 fn(instant)
  repairSpot(id, spot, x, y, z, { reach = 1.5, pickR = 0.35, seeR = 2.2, can, fn } = {}) {
    const proxy = new THREE.Mesh(new THREE.SphereGeometry(pickR, 8, 6), proxyMat);
    proxy.castShadow = false;
    proxy.userData.pickable = true;
    spot.add(proxy);
    spot.userData.repair = id;
    this.add(spot, x, y, z);
    const seen = this.flag(`seen:${id}`);
    spot.visible = seen;
    this.repairs.set(id, { id, spot, x, z, reach, seeR, can, fn, seen, done: false, next: 1 + Math.random() });
  }

  // 发现了一个缺东西的地方：虚影显现出来
  discover(id) {
    const r = this.repairs.get(id);
    if (!r || r.seen || r.done) return false;
    r.seen = true;
    r.spot.visible = true;
    this.setFlag(`seen:${id}`, true);
    this.fx.emit(r.spot.position.clone().setY(r.spot.position.y + 0.2), { count: 18, spread: 0.5, size: 0.35, rise: 1.0, color: '#bfe6ff' });
    return true;
  }

  whenRestored(fn) {
    this.restoredFns.push(fn);
  }

  // 全部修好的那一刻（只在玩的过程中触发，读档时不触发）
  checkRestored() {
    if (this.restored || !this.fullyRepaired) return;
    this.restored = true;
    for (const fn of this.restoredFns) fn();
  }

  isRepaired(id) {
    return !!this.repairs.get(id)?.done;
  }

  // scene 可以加上额外的条件（比如司机醒了）
  get fullyRepaired() {
    return [...this.repairs.values()].every((r) => r.done) && (!this.extraDone || this.extraDone());
  }

  repair(id, instant = false) {
    const r = this.repairs.get(id);
    if (!r || r.done) return false;
    r.done = true;
    r.spot.removeFromParent();
    const done = repairedIn(this.def.id);
    if (!done.includes(id)) {
      done.push(id);
      save();
    }
    r.fn?.(instant);
    if (!instant) this.checkRestored();
    return true;
  }

  // 可以被移走的障碍（say：玩家撞上时的提示）
  blocker(minX, maxX, minZ, maxZ, say) {
    const c = { type: 'box', minX, maxX, minZ, maxZ, say };
    this.colliders.push(c);
    return c;
  }

  unblock(c) {
    const i = this.colliders.indexOf(c);
    if (i >= 0) this.colliders.splice(i, 1);
  }

  // 玩家正撞着的、带提示的障碍
  blockerNear(x, z, r) {
    for (const c of this.colliders) {
      if (!c.say) continue;
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return c;
    }
    return null;
  }

  poi(x, z, opts) {
    this.pois.push({ x, z, dur: 6, ...opts, taken: null });
  }

  villager(opts, x, z) {
    const v = new Villager(this, opts);
    v.root.position.set(x, 0, z);
    this.root.add(v.root);
    if (!opts.controlled) this.villagers.push(v);
    return v;
  }

  onUpdate(fn) {
    this.updaters.push(fn);
  }

  texture(tex) {
    this.textures.push(tex);
    return tex;
  }

  update(dt, t, input) {
    for (const v of this.villagers) v.update(dt, t, input);
    for (const g of this.items.values()) {
      const u = g.userData;
      g.position.y = u.baseY + Math.sin(t * 2 + g.id) * 0.03;
      if (u.spin) g.rotation.y += dt * 1.1;
      const s = 1 + u.hover * 0.25;
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, s, 1 - Math.exp(-dt * 12)));
      u.nextSparkle -= dt;
      if (u.nextSparkle <= 0) {
        u.nextSparkle = 1.8 + Math.random() * 2.2;
        this.fx.emit(g.position, { count: 2, spread: 0.18, size: 0.2, rise: 0.35 });
      }
    }
    if (this.repairs.size) {
      ghostMat.opacity = 0.3 + Math.sin(t * 3) * 0.12;
      for (const r of this.repairs.values()) {
        if (r.done || !r.seen) continue;
        r.next -= dt;
        if (r.next <= 0) {
          r.next = 1.2 + Math.random() * 1.2;
          this.fx.emit(r.spot.position.clone().setY(r.spot.position.y + 0.3), { count: 2, spread: 0.3, size: 0.22, rise: 0.4, color: '#bfe6ff' });
        }
      }
    }
    for (const fn of this.updaters) fn(dt, t);
    this.fx.update(dt);
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const t of this.textures) t.dispose();
    this.root.removeFromParent();
  }
}
