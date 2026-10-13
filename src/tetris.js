// 大楼窗户上的俄罗斯方块：每一扇窗户是一个格子，亮起来的窗户就是方块
import { sfx } from './audio.js';

const PIECES = [
  { color: '#4ff0ff', m: ['....', 'XXXX', '....', '....'] }, // I
  { color: '#ffd84a', m: ['XX', 'XX'] }, // O
  { color: '#c77dff', m: ['.X.', 'XXX', '...'] }, // T
  { color: '#59d98a', m: ['.XX', 'XX.', '...'] }, // S
  { color: '#ff5f7a', m: ['XX.', '.XX', '...'] }, // Z
  { color: '#5f8bff', m: ['X..', 'XXX', '...'] }, // J
  { color: '#ffa94f', m: ['..X', 'XXX', '...'] }, // L
];
const PARTY = ['#ff5fa2', '#4ff0ff', '#ffd84a', '#59ff9c', '#c77dff', '#ffa94f'];

const cellsOf = (m) => {
  const out = [];
  m.forEach((row, y) => [...row].forEach((ch, x) => ch === 'X' && out.push([x, y])));
  return out;
};
// 顺时针转 90°
const rotate = (cells, n) => cells.map(([x, y]) => [n - 1 - y, x]);

export class Tetris {
  // look：窗户的配色 { wall, frame, dark }
  // lobby：底下留几格当一楼大堂（会被门口的长椅、路灯挡住，不放方块）
  constructor({ cols = 10, rows = 20, lobby = 3, goal = 4, look = {}, onStatus, onLines, onWin } = {}) {
    Object.assign(this, { cols, rows, lobby, goal, onStatus, onLines, onWin });
    this.look = { wall: '#5b6285', frame: '#3e4463', dark: '#2a2f4a', ...look };
    this.cell = 20;
    this.map = document.createElement('canvas');
    this.emit = document.createElement('canvas');
    for (const c of [this.map, this.emit]) {
      c.width = cols * this.cell;
      c.height = (rows + lobby) * this.cell;
    }
    this.reset();
  }

  reset() {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.lines = 0;
    this.bag = [];
    this.won = false;
    this.over = 0; // 输了之后整面墙闪红一下再重来
    this.flash = 0;
    this.timer = 0;
    this.party = 0;
    this.spawn();
    this.status();
  }

  status() {
    this.onStatus?.(this.won ? '通关！🎉' : `消掉 ${this.lines} / ${this.goal} 行`);
  }

  spawn() {
    if (!this.bag.length) {
      this.bag = PIECES.map((_, i) => i);
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    const p = PIECES[this.bag.pop()];
    const n = p.m.length;
    this.piece = { color: p.color, n, cells: cellsOf(p.m), x: Math.floor((this.cols - n) / 2), y: p.m[0].includes('X') ? 0 : -1 };
    if (this.hits(this.piece.cells, this.piece.x, this.piece.y)) {
      this.over = 0.8;
      sfx.whoosh();
    }
  }

  hits(cells, px, py) {
    return cells.some(([x, y]) => {
      const gx = px + x;
      const gy = py + y;
      return gx < 0 || gx >= this.cols || gy >= this.rows || (gy >= 0 && this.grid[gy][gx]);
    });
  }

  get busy() {
    return this.won || this.over > 0;
  }

  key(k) {
    if (this.busy) return;
    const p = this.piece;
    if (k === 'left' || k === 'right') {
      const dx = k === 'left' ? -1 : 1;
      if (!this.hits(p.cells, p.x + dx, p.y)) {
        p.x += dx;
        sfx.click();
      }
    } else if (k === 'rotate') {
      const r = rotate(p.cells, p.n);
      // 贴着墙转不过去时，往旁边挪一挪再试
      for (const dx of [0, -1, 1, -2, 2]) {
        if (!this.hits(r, p.x + dx, p.y)) {
          p.cells = r;
          p.x += dx;
          sfx.click();
          break;
        }
      }
    } else if (k === 'down') {
      this.fall();
      this.timer = 0;
    } else if (k === 'drop') {
      while (!this.hits(p.cells, p.x, p.y + 1)) p.y++;
      this.lock();
    }
  }

  fall() {
    const p = this.piece;
    if (this.hits(p.cells, p.x, p.y + 1)) this.lock();
    else p.y++;
  }

  lock() {
    const p = this.piece;
    for (const [x, y] of p.cells) if (p.y + y >= 0) this.grid[p.y + y][p.x + x] = p.color;
    const full = this.grid.filter((row) => row.every(Boolean)).length;
    if (full) {
      this.grid = this.grid.filter((row) => !row.every(Boolean));
      while (this.grid.length < this.rows) this.grid.unshift(Array(this.cols).fill(null));
      this.lines += full;
      this.flash = 0.25;
      sfx.pickup();
      this.status();
      this.onLines?.(full);
      if (this.lines >= this.goal) {
        this.won = true;
        this.status();
        this.onWin?.();
        return;
      }
    } else sfx.pop();
    this.spawn();
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    this.party += dt;
    if (this.over > 0) {
      this.over -= dt;
      if (this.over <= 0) this.reset();
      return;
    }
    if (this.won) return;
    this.timer += dt;
    // 越消越快
    if (this.timer >= Math.max(0.25, 0.65 - this.lines * 0.08)) {
      this.timer = 0;
      this.fall();
    }
  }

  // 画到大楼正面：map 是白天看到的颜色，emit 是夜里自己发的光
  draw() {
    const { cols, rows, cell, look } = this;
    const g = this.map.getContext('2d');
    const e = this.emit.getContext('2d');
    g.fillStyle = look.wall;
    g.fillRect(0, 0, this.map.width, this.map.height);
    e.fillStyle = '#000000';
    e.fillRect(0, 0, this.emit.width, this.emit.height);

    const shown = this.grid.map((row) => row.slice());
    let ghost = [];
    if (!this.busy) {
      const p = this.piece;
      let gy = p.y;
      while (!this.hits(p.cells, p.x, gy + 1)) gy++;
      ghost = p.cells.map(([x, y]) => [p.x + x, gy + y]);
      for (const [x, y] of p.cells) if (p.y + y >= 0) shown[p.y + y][p.x + x] = p.color;
    }
    // 一楼大堂和大门
    const top = rows * cell;
    g.fillStyle = look.frame;
    g.fillRect(0, top + 2, this.map.width, 4);
    g.fillStyle = '#c9c6bc';
    g.fillRect(this.map.width / 2 - cell * 1.2, top + cell * 0.8, cell * 2.4, cell * 2.2);
    e.fillStyle = '#3a3420';
    e.fillRect(this.map.width / 2 - cell * 1.2, top + cell * 0.8, cell * 2.4, cell * 2.2);
    const tick = Math.floor(this.party / 0.15);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const wx = x * cell + cell * 0.15;
        const wy = y * cell + cell * 0.15;
        const ww = cell * 0.7;
        g.fillStyle = look.frame;
        g.fillRect(wx - 2, wy - 2, ww + 4, ww + 4);
        let c = shown[y][x];
        // 通关：整栋楼的窗户变成彩色派对
        if (this.won) c = PARTY[(x * 7 + y * 3 + tick) % PARTY.length];
        else if (this.over > 0 && c) c = '#ff4040';
        const isGhost = !c && ghost.some(([gx, gy]) => gx === x && gy === y);
        g.fillStyle = c || (isGhost ? '#4a5278' : look.dark);
        g.fillRect(wx, wy, ww, ww);
        if (c) {
          e.fillStyle = c;
          e.fillRect(wx, wy, ww, ww);
        } else if (isGhost) {
          e.fillStyle = '#1c2140';
          e.fillRect(wx, wy, ww, ww);
        }
      }
    }
    if (this.flash > 0) {
      e.fillStyle = `rgba(255,255,255,${this.flash * 2})`;
      e.fillRect(0, 0, this.emit.width, this.emit.height);
    }
  }
}
