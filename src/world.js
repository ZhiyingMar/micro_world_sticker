import * as THREE from 'three';
import { Kit, isSharedMaterial } from './kit.js';
import { Sparkles } from './fx.js';
import { Villager } from './villager.js';
import { Terrain } from './terrain.js';
import { foundIn, repairedIn, flagsIn, save, addMaterial } from './state.js';
import { sfx } from './audio.js';

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
    this.env = env; // { hemi, sun, camera, toast, onChange }：场景里改灯光（比如闪电）、看镜头在哪（像素小镇的云）、弹提示、通知界面刷新
    this.kit = new Kit(def.style);
    this.root = new THREE.Group();
    this.colliders = [];
    // 有高低的地面（没有的话就是平地，高度 0）
    this.terrain = def.terrain ? new Terrain(def.terrain) : null;
    this.size = this.terrain ? [this.terrain.w, this.terrain.d] : def.size || [10, 10];
    this.bounds = { minX: -4.55, maxX: 4.55, minZ: -4.55, maxZ: 4.55, ...(this.terrain?.bounds || {}), ...(def.bounds || {}) };
    this.villagers = [];
    this.items = new Map();
    this.hiddenItems = new Map(); // 要等修好某处才出现的物品
    this.repairs = new Map(); // 修复点：{ id, spot, x, z, reach, fn, can, seen }
    this.interacts = new Map(); // 可以互动的东西（售货机……）：{ id, obj, x, z, reach, label, icon, fn }
    this.hideouts = new Map(); // 能翻找材料的地方（垃圾桶、草丛……），见 hideout()
    this.fadeables = []; // 挡住人时会变半透明的大件（楼），见 fadeable()
    // 地图的第几版：拿掉一个障碍（修好了桥……）就加一，小人记着的"走不到的地方"要重新算
    this.layoutVersion = 0;
    // 世界里的雾（THREE.Fog），没有就是 null；换到这个世界时镜头的场景用它（童话森林魔法停了时起雾）
    this.fog = null;
    // 拆掉世界时要一起收拾的（换上去的材质……），见 onDispose()
    this.disposers = [];
    this.restoredFns = [];
    this.games = new Map(); // 点一下就能玩的小游戏（大楼俄罗斯方块……）
    this.pois = [];
    this.updaters = [];
    this.textures = [];
    this.fx = new Sparkles(this.root);
    // 方块外面那一大片背景（CSS），场景可以在搭建时或之后换掉，见 setBackdrop()
    this.backdrop = def.bg;
    // 背景上盖的一层颜色（小屋的清晨、傍晚、夜里）：{ color, strength }，没有就是 null，见 setSkyTint()
    this.skyTint = null;
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
    if (def.scatter) {
      this.hideMaterials(def.scatter);
    }
  }

  // ---------- 翻找材料 ----------

  /**
   * 登记一个能翻找的地方：垃圾桶、草丛、路灯脚下……
   * @description 每次进来随机挑几个藏上材料（见 hideMaterials），走过去按 E 翻，翻过就空了，下次进来重新藏
   * @param {string} id 这个地方的名字，同一个世界里不重复
   * @param {THREE.Object3D} object 点它就走过去翻（路灯这种不该点的，传一个空的 Object3D）
   * @param {number} x 站在哪儿能翻
   * @param {number} z 站在哪儿能翻
   * @param {object} options
   * @param {string[]} options.tags 标签，scatter 按标签挑地方，比如 bin、bush、lamp
   * @param {string} options.name 叫什么，用在提示里：垃圾桶、草丛
   * @param {string} options.icon 提示前面的图标
   * @param {string} options.show 藏的东西怎么露出来：inside 完全看不见，peek 露出一点，open 就躺在地上
   * @param {number[]} options.offset show 不是 inside 时，材料摆在离 (x, z) 多远的地方 [dx, dz]
   * @param {number} options.reach 离多近能翻
   * @param {Function} options.when 返回 false 时先不能翻（比如小巷还黑着）
   */
  hideout(id, object, x, z, { tags, name, icon, show = 'inside', offset = [0, 0], reach = 1.0, when = () => true }) {
    const spot = { id, x, z, tags, name, show, offset, material: null, model: null, searched: false };
    this.hideouts.set(id, spot);

    // 躺在地上的（路灯脚下）不藏东西时没什么好翻的；垃圾桶、草丛空的也能翻，翻过就不再提示
    const label = () => {
      if (spot.show === 'open' && spot.material) {
        return `捡起${spot.material.name}`;
      }
      return `翻翻${name}`;
    };
    const available = () => {
      if (spot.searched || !when()) {
        return false;
      }
      return spot.show !== 'open' || !!spot.material;
    };
    this.interact(`hideout:${id}`, object, x, z, { reach, icon, short: '翻找', label, available, fn: () => this.searchHideout(spot) });
  }

  /**
   * 每次进来，挑几个能翻的地方藏上材料
   * @description 先藏稀有的（组的顺序就是优先顺序），一个地方只藏一个
   * @param {{ material: string, count: number, from: string[] }[]} groups 每种材料藏几个、藏在带哪些标签的地方
   */
  hideMaterials(groups) {
    for (const group of groups) {
      const material = this.def.materials.find((entry) => entry.id === group.material);
      const candidates = [...this.hideouts.values()].filter((spot) => !spot.material && spot.tags.some((tag) => group.from.includes(tag)));

      for (let i = 0; i < group.count && candidates.length; i++) {
        const spot = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
        this.hideIn(spot, material);
      }
    }
  }

  /**
   * 把一个材料藏进某个地方；不是完全藏起来的，摆一个不动的模型
   * @param {object} spot 能翻的地方
   * @param {{ id: string, icon: string, name: string, make(kit) }} material 材料的定义
   */
  hideIn(spot, material) {
    spot.material = material;
    if (spot.show === 'inside') {
      return;
    }

    const model = material.make(this.kit);
    const x = spot.x + spot.offset[0];
    const z = spot.z + spot.offset[1];
    model.position.x = x;
    model.position.z = z;
    model.position.y += this.heightAt(x, z);
    // 塞在草丛里的斜插着，只露出瓶口
    if (spot.show === 'peek') {
      model.rotation.x = 0.9;
    }
    model.rotation.y = Math.random() * Math.PI * 2;
    // 点露出来的瓶子也能走过去捡
    model.userData.interact = `hideout:${spot.id}`;
    this.root.add(model);
    spot.model = model;
  }

  /**
   * 翻一个地方：有东西就放进背包，没有就说一声
   * @param {object} spot 能翻的地方
   */
  searchHideout(spot) {
    spot.searched = true;
    const toast = (text) => this.env.toast?.(text);

    if (!spot.material) {
      sfx.pop();
      toast(`翻了翻${spot.name}……什么也没有`);
      return;
    }

    const material = spot.material;
    const total = addMaterial(material.id);
    const where = new THREE.Vector3(spot.x + spot.offset[0], this.heightAt(spot.x, spot.z) + 0.3, spot.z + spot.offset[1]);
    spot.model?.removeFromParent();
    spot.material = null;

    sfx.pickup();
    this.fx.emit(where, { count: 12, spread: 0.25, size: 0.25, rise: 1.0, color: '#bfe6ff' });
    toast(`找到 ${material.icon} ${material.name}（一共 ${total} 个）`);
    this.env.onMaterial?.();
  }

  add(obj, x = 0, y = 0, z = 0, ry = 0) {
    obj.position.set(x, y, z);
    if (ry) obj.rotation.y = ry;
    this.root.add(obj);
    return obj;
  }

  /**
   * 登记一个挡住人时会变半透明的大件（楼）
   * @description 镜头随便转，人走到楼后面就看不见了。登记过的东西挡在镜头和人中间时会淡下去，
   *   让人看得见楼后面的路和能翻的东西。按颜色共用的材质复制一份，免得把别的东西也淡掉；
   *   本来就是这栋楼自己的材质（窗户、招牌）不复制，电力系统还拿着它们开关灯
   * @param {THREE.Object3D} object 整栋楼（下面所有的网格一起淡）
   */
  fadeable(object) {
    const own = (material) => (isSharedMaterial(material) ? material.clone() : material);
    object.traverse((child) => {
      if (!child.isMesh) {
        return;
      }
      if (Array.isArray(child.material)) {
        child.material = child.material.map(own);
      } else {
        child.material = own(child.material);
      }
    });
    object.userData.fade = 1;
    this.fadeables.push(object);
    return object;
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

  /**
   * 登记一块长方形的障碍（和 x、z 轴对齐）
   * @description 房子这种带屋檐、门前石阶的模型，包围盒比墙大一圈，用 solid() 会把门口也挡住；直接按墙的范围登记
   * @param {number} minX
   * @param {number} maxX
   * @param {number} minZ
   * @param {number} maxZ
   */
  solidBox(minX, maxX, minZ, maxZ) {
    this.colliders.push({ type: 'box', minX, maxX, minZ, maxZ });
  }

  blocked(x, z, r, self) {
    const b = this.bounds;
    if (x - r < b.minX || x + r > b.maxX || z - r < b.minZ || z + r > b.maxZ) return true;
    if (this.terrain?.straddles(x, z, r)) return true; // 崖边
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
  // available()：返回 false 时先不出现（比如还没来电）
  interact(id, obj, x, z, { reach = 1.4, label, icon = '👆', short, available, fn }) {
    obj.userData.interact = id;
    this.interacts.set(id, { id, obj, x, z, reach, label, icon, short, available, fn });
  }

  // ---------- 小游戏 ----------
  // opts: { title, hover, help, view: { target, halfW, halfH }, entrance: { x, z, reach }, can(), start(api), stop(), key(k), update(dt) }
  // entrance：入口。有入口的，点它只会走过去，站到入口才开始（防误触）
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
    this.layoutVersion++;
  }

  // ---------- 寻路 ----------
  // 把地面切成小格子做 A*，再把折线拉直。只看固定的障碍（不管小人）。
  // 返回 [{ x, z }, ...]（不含起点）；目标被障碍挡住时停在离它最近的空地；走不到返回 null
  // avoid：传一个小人进来时，别的小人也当成障碍（被人堵住了重新绕路用）
  findPath(sx, sz, tx, tz, r, avoid = null) {
    const C = 0.1; // 格子要细一点，夜都停电时斑马线边上那条窄缝才走得过去
    const b = this.bounds;
    const nx = Math.floor((b.maxX - b.minX) / C) + 1;
    const nz = Math.floor((b.maxZ - b.minZ) / C) + 1;
    const px = (i) => b.minX + i * C;
    const pz = (j) => b.minZ + j * C;
    const ci = (x) => THREE.MathUtils.clamp(Math.round((x - b.minX) / C), 0, nx - 1);
    const cj = (z) => THREE.MathUtils.clamp(Math.round((z - b.minZ) / C), 0, nz - 1);
    const cell = new Uint8Array(nx * nz); // 0 没算过，1 空地，2 有障碍
    const free = (i, j) => {
      if (i < 0 || j < 0 || i >= nx || j >= nz) return false;
      const k = j * nx + i;
      if (!cell[k]) cell[k] = this.blocked(px(i), pz(j), r, avoid) ? 2 : 1;
      return cell[k] === 1;
    };
    // 离 (i, j) 最近的空地（一圈一圈往外找）
    const nearestFree = (i, j, maxRing) => {
      if (free(i, j)) return [i, j];
      for (let ring = 1; ring <= maxRing; ring++) {
        let best = null;
        let bd = Infinity;
        for (let di = -ring; di <= ring; di++) {
          for (let dj = -ring; dj <= ring; dj++) {
            if (Math.max(Math.abs(di), Math.abs(dj)) !== ring || !free(i + di, j + dj)) continue;
            const d = di * di + dj * dj;
            if (d < bd) {
              bd = d;
              best = [i + di, j + dj];
            }
          }
        }
        if (best) return best;
      }
      return null;
    };
    const s = nearestFree(ci(sx), cj(sz), 6);
    const g = nearestFree(ci(tx), cj(tz), 20);
    if (!s || !g) return null;
    const S = s[1] * nx + s[0];
    const G = g[1] * nx + g[0];

    // A*（8 方向，斜着走时两边都得是空地，免得擦着墙角穿过去）
    const gScore = new Float32Array(nx * nz).fill(Infinity);
    const from = new Int32Array(nx * nz).fill(-1);
    const closed = new Uint8Array(nx * nz);
    const heap = []; // [f, k]
    const push = (f, k) => {
      heap.push([f, k]);
      for (let i = heap.length - 1; i > 0; ) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ; ) {
          const l = i * 2 + 1;
          const rr = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const h = (k) => Math.hypot((k % nx) - g[0], Math.floor(k / nx) - g[1]);
    gScore[S] = 0;
    push(h(S), S);
    while (heap.length) {
      const [, k] = pop();
      if (k === G) break;
      if (closed[k]) continue;
      closed[k] = 1;
      const i = k % nx;
      const j = Math.floor(k / nx);
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (!free(ni, nj) || (di && dj && (!free(i + di, j) || !free(i, j + dj)))) continue;
          const nk = nj * nx + ni;
          const ng = gScore[k] + (di && dj ? Math.SQRT2 : 1);
          if (ng < gScore[nk]) {
            gScore[nk] = ng;
            from[nk] = k;
            push(ng + h(nk), nk);
          }
        }
      }
    }
    if (from[G] === -1 && G !== S) return null;

    // 格子路线 → 坐标，终点用真正的目标（如果它本身是空地）
    const pts = [];
    for (let k = G; k !== -1 && k !== S; k = from[k]) pts.unshift({ x: px(k % nx), z: pz(Math.floor(k / nx)) });
    if (pts.length && !this.blocked(tx, tz, r)) pts[pts.length - 1] = { x: tx, z: tz };
    // 拉直：能直接看到的点就跳过去
    const out = [];
    let cur = { x: sx, z: sz };
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineClear(cur.x, cur.z, pts[j].x, pts[j].z, r, avoid)) j--;
      out.push(pts[j]);
      cur = pts[j];
      i = j + 1;
    }
    return out;
  }

  // 从 a 到 b 一路上都没有障碍
  lineClear(ax, az, bx, bz, r, avoid = null) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.08);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (this.blocked(ax + (bx - ax) * t, az + (bz - az) * t, r, avoid)) return false;
    }
    return true;
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

  /**
   * 登记一个兴趣点：小人闲逛时会走过去待一会儿
   * @param {number} x 站在哪
   * @param {number} z 站在哪
   * @param {object} opts 待多久（dur）、头上冒什么（emote）、朝哪（face）、坐不坐……
   * @returns {object} 登记好的兴趣点，场景以后还能改它（比如小屋夜里换头上冒的东西）
   */
  poi(x, z, opts) {
    const poi = { x, z, dur: 6, ...opts, taken: null };
    this.pois.push(poi);
    return poi;
  }

  heightAt(x, z) {
    return this.terrain ? this.terrain.heightAt(x, z) : 0;
  }

  villager(opts, x, z) {
    const v = new Villager(this, opts);
    v.root.position.set(x, this.heightAt(x, z), z);
    this.root.add(v.root);
    if (!opts.controlled) this.villagers.push(v);
    return v;
  }

  /**
   * 换掉方块外面那一大片背景
   * @description 小屋换了壁纸，外面的底色跟着变
   * @param {string} css 能直接放进 background 的值
   */
  setBackdrop(css) {
    this.backdrop = css;
    this.env.onBackdrop?.(css);
  }

  /**
   * 在方块外面的背景上盖一层颜色
   * @description 换壁纸时背景换成壁纸配的底色；钟点变了，底色不动，只在上面盖一层清晨的粉、傍晚的橙、夜里的深蓝
   * @param {{ color: string, strength: number } | null} tint 盖什么颜色（#rrggbb）、多浓（0~1）；null 是不盖
   */
  setSkyTint(tint) {
    this.skyTint = tint;
    this.env.onSkyTint?.(tint);
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

  /**
   * 镜头暂时对准变了的地方（修好东西时），一处处看过去，看完回到原来的地方
   * @param {{ at: THREE.Vector3, zoom?: number, hold: number }[]} shots 依次看哪儿（世界里的坐标）、拉多远（1 是平时跟人的远近）、看多久（秒）
   * @returns {number[]} 每一处镜头到位是在多少秒以后，场景按它排那里的变化；没有镜头时（测试场景）按一下就到算
   */
  showcase(shots) {
    if (this.env.showcase) {
      return this.env.showcase(shots);
    }
    let elapsed = 0;
    return shots.map((shot) => {
      const arrive = elapsed;
      elapsed += shot.hold;
      return arrive;
    });
  }

  /**
   * 拆掉这个世界时顺便收拾点东西
   * @param {Function} fn 拆的时候调用
   */
  onDispose(fn) {
    this.disposers.push(fn);
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const t of this.textures) t.dispose();
    for (const fn of this.disposers) fn();
    this.root.removeFromParent();
  }
}
