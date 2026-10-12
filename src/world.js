import * as THREE from 'three';
import { Kit } from './kit.js';
import { Sparkles } from './fx.js';
import { Villager } from './villager.js';
import { foundIn } from './state.js';

const proxyMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

// 一个“冰箱贴世界”：方块小场景 + 里面的东西和居民
export class World {
  constructor(def, env = {}) {
    this.def = def;
    this.env = env; // { hemi, sun }：场景里需要时可以改灯光（比如闪电）
    this.kit = new Kit(def.style);
    this.root = new THREE.Group();
    this.colliders = [];
    this.bounds = { minX: -4.55, maxX: 4.55, minZ: -4.55, maxZ: 4.55, ...(def.bounds || {}) };
    this.villagers = [];
    this.items = new Map();
    this.pois = [];
    this.updaters = [];
    this.textures = [];
    this.fx = new Sparkles(this.root);
    def.build(this);
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
  placeItem(id, x, y, z, { ry = 0, scale = 1, spin = true } = {}) {
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
    this.items.set(id, g);
    return g;
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
