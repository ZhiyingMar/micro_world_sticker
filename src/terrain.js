// 有高低的地面：用一张文字地图描述，每个字符是 1×1 的一格
//   0-9      高度层（一层多高看 level，默认 0.5）
//   ~        水：比 0 层低一层，走不过去（和旁边的地差一层，自然就挡住了）
//   = |      桥（横 / 竖）：0 层，下面是水
//   o        踏脚石：0 层，下面是水，没有栏杆（走起来和桥一样，只是样子是一块石头）
//   > < ^ v  台阶，箭头指向“往上走”的方向（> 往 +x，v 往 +z，也就是往屏幕下方）
//            低的一头和来的那格一样高，高的一头再高一层
// 逻辑和外观分开：heightAt 只看地图；画出来的样子现在是代码方块占位，以后换模型
import * as THREE from 'three';

const DIRS = { '>': [1, 0], '<': [-1, 0], v: [0, 1], '^': [0, -1] };
// 相邻两处地面高度差超过这个就算“崖”，走不过去（台阶是连续的斜坡，差不会超过）
const MAX_STEP = 0.2;
// 踏脚石：顶面和桥一样高（0 层），上小下大，比一格小一圈，石头之间露出一点水
const STEPPING_STONE_TOP_RADIUS = 0.38;
const STEPPING_STONE_BOTTOM_RADIUS = 0.46;
// 边数少一点，看起来是凿出来的石头，不是圆柱
const STEPPING_STONE_SIDES = 9;
// 踏脚石的石头顶面比 0 层高出一点点，看起来是“踩在石头上”而不是陷进去
const STEPPING_STONE_LIFT = 0.03;
// 下面是水的几种格子：水、两种桥、踏脚石
const OVER_WATER = new Set(['~', '=', '|', 'o']);
// 水面比水格子的高度（0 层往下一层）再低一点，水面那块有多厚
const WATER_DROP = 0.05;
const WATER_THICKNESS = 0.1;

export class Terrain {
  constructor({ map, level = 0.5 }) {
    this.rows = map;
    this.level = level;
    this.d = map.length;
    this.w = Math.max(...map.map((r) => r.length));
    this.x0 = -this.w / 2;
    this.z0 = -this.d / 2;
  }

  ch(i, j) {
    i = THREE.MathUtils.clamp(i, 0, this.w - 1);
    j = THREE.MathUtils.clamp(j, 0, this.d - 1);
    return this.rows[j][i] ?? '0';
  }

  // 一格的高度层；台阶返回低的那头
  levelOf(i, j) {
    const c = this.ch(i, j);
    if (c >= '0' && c <= '9') return +c;
    if (c === '~') return -1;
    if (OVER_WATER.has(c)) return 0;
    const dir = DIRS[c];
    if (dir) {
      const back = this.ch(i - dir[0], j - dir[1]);
      return DIRS[back] ? this.levelOf(i - dir[0], j - dir[1]) + 1 : this.levelOf(i - dir[0], j - dir[1]);
    }
    return 0;
  }

  cellAt(x, z) {
    return [Math.floor(x - this.x0), Math.floor(z - this.z0)];
  }

  /**
   * 这一处是不是普通的平地（某个高度层），不是水、桥、踏脚石或台阶
   * @description 随手撒花、撒小石头时用：这些东西只该长在平地上
   * @param {number} x
   * @param {number} z
   * @returns {boolean}
   */
  isPlainGround(x, z) {
    const [col, row] = this.cellAt(x, z);
    const symbol = this.ch(col, row);
    return symbol >= '0' && symbol <= '9';
  }

  heightAt(x, z) {
    const [i, j] = this.cellAt(x, z);
    const c = this.ch(i, j);
    const dir = DIRS[c];
    const base = this.levelOf(i, j) * this.level;
    if (!dir) return base;
    // 台阶在逻辑上是一段平滑的斜坡
    const fx = x - this.x0 - i;
    const fz = z - this.z0 - j;
    const t = dir[0] ? (dir[0] > 0 ? fx : 1 - fx) : dir[1] > 0 ? fz : 1 - fz;
    return base + THREE.MathUtils.clamp(t, 0, 1) * this.level;
  }

  // 半径 r 的小人站在这里会不会跨在崖边上
  straddles(x, z, r) {
    const h = this.heightAt(x, z);
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      if (Math.abs(this.heightAt(x + Math.cos(ang) * r, z + Math.sin(ang) * r) - h) > MAX_STEP) return true;
    }
    return false;
  }

  get bounds() {
    const m = 0.05;
    return { minX: this.x0 + m, maxX: -this.x0 - m, minZ: this.z0 + m, maxZ: -this.z0 - m };
  }

  // 代码方块占位：每格一根土柱子，顶上一层草；台阶一级一级；水、桥
  // grass 可以是一个颜色，也可以是 (i, j, 高度层) => 颜色，比如城里人行道是灰的、公园是绿的
  build(w, { grass = '#a6e07f', dirt = '#c99a6b', water = '#7fd3ea', plank = '#b98a5a', stone = '#c9c2b4', steps = ['#f2e8d4', '#e8dcc4'], bottom = -1.5 } = {}) {
    const k = w.kit;
    const topColor = typeof grass === 'function' ? grass : () => grass;
    const L = this.level;
    const g = new THREE.Group();
    const box = (sx, sy, sz, color, x, y, z) => {
      const m = k.mesh(new THREE.BoxGeometry(sx, sy, sz), color);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    const top = 0.1; // 草皮厚度
    for (let j = 0; j < this.d; j++) {
      for (let i = 0; i < this.w; i++) {
        const c = this.ch(i, j);
        const x = this.x0 + i + 0.5;
        const z = this.z0 + j + 0.5;
        const h = this.levelOf(i, j) * L;
        if (OVER_WATER.has(c)) {
          // 水底的土 + 半透明水面
          const wy = -L;
          box(1, wy - 0.15 - bottom, 1, dirt, x, (bottom + wy - 0.15) / 2, z);
          const wm = new THREE.Mesh(new THREE.BoxGeometry(1, WATER_THICKNESS, 1), new THREE.MeshStandardMaterial({ color: water, transparent: true, opacity: 0.75, roughness: 0.2 }));
          wm.position.set(x, wy - WATER_DROP - WATER_THICKNESS / 2, z);
          g.add(wm);
          if (c === 'o') {
            g.add(this.steppingStone(k, stone, x, z, wy));
          } else if (c !== '~') {
            // 桥：几块木板，两边一根扶手栏杆
            const along = c === '=' ? [1, 0] : [0, 1];
            for (let p = 0; p < 4; p++) {
              const o = -0.375 + p * 0.25;
              box(along[0] ? 0.22 : 0.9, 0.08, along[0] ? 0.9 : 0.22, plank, x + along[0] * o, -0.04, z + along[1] * o);
            }
            for (const s of [-1, 1]) {
              box(along[0] ? 1 : 0.06, 0.06, along[0] ? 0.06 : 1, plank, x + along[1] * s * 0.44, 0.35, z + along[0] * s * 0.44);
            }
          }
          continue;
        }
        const dir = DIRS[c];
        box(1, h - top - bottom, 1, dirt, x, (bottom + h - top) / 2, z);
        if (!dir) {
          box(1, top, 1, topColor(i, j, this.levelOf(i, j)), x, h - top / 2, z);
          continue;
        }
        // 台阶：分 4 级，每级是从土柱顶到这一级高度的一块，最高一级和上面那层地一样高
        const n = 4;
        for (let s = 0; s < n; s++) {
          const sh = top + ((s + 1) / n) * L;
          const len = 1 / n;
          const off = -0.5 + len * (s + 0.5);
          const cx = x + dir[0] * off;
          const cz = z + dir[1] * off;
          box(dir[0] ? len : 1, sh, dir[1] ? len : 1, steps[s % 2], cx, h - top + sh / 2, cz);
        }
      }
    }
    w.root.add(g);
    return g;
  }

  /**
   * 一块踏脚石：从水底立起来的一根圆石柱，顶面和 0 层一样高
   * @param {Kit} kit 当前世界的模型工具
   * @param {string} color 石头的颜色
   * @param {number} x 这一格中心的 x
   * @param {number} z 这一格中心的 z
   * @param {number} waterY 水面的高度
   * @returns {THREE.Mesh}
   */
  steppingStone(kit, color, x, z, waterY) {
    // 从水面下一点一直立到 0 层，水面上看到的是石头露出来的那一截
    const bottomY = waterY - this.level / 2;
    const topY = STEPPING_STONE_LIFT;
    const height = topY - bottomY;

    const stone = kit.cyl(STEPPING_STONE_TOP_RADIUS, STEPPING_STONE_BOTTOM_RADIUS, height, color, STEPPING_STONE_SIDES);
    stone.position.set(x, bottomY + height / 2, z);
    return stone;
  }
}
