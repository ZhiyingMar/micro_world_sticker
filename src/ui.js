import { state, foundIn, repairedIn } from './state.js';
import { SCENES, ORDER, WORLDS } from './scenes/index.js';
import { sfx } from './audio.js';

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const ui = {
  // ---------- 标题 & 目标 ----------
  setScene(def) {
    $('#scene-emoji').textContent = def.emoji;
    $('#scene-name').textContent = def.name;
    $('#scene-style').textContent = def.styleLabel;
    const cl = document.body.classList;
    [...cl].filter((c) => c.startsWith('style-')).forEach((c) => cl.remove(c));
    cl.add(`style-${def.style}`);
    document.getElementById('app').style.setProperty('--scene-bg', def.bg);
    this._shown = new Set(); // 换了世界：已经完成的直接不显示
    this.renderGoal(def);
  },

  // broken：破败世界还没修好；bag：背包里的小道具 [{ icon, name }]
  // 只显示还没完成的：刚完成的打个勾、淡出，全部完成后整个目标栏收起来
  renderGoal(def, { broken = false, bag = [] } = {}) {
    const next = SCENES[def.next];
    const slot = (key, cls, icon, name, title) => `<div class="slot ${cls}" data-id="${key}" title="${title}">
          <div class="slot-icon"><span>${icon}</span></div>
          <div class="slot-name">${name}</div>
        </div>`;
    const list = []; // { key, done, html }
    let text;
    if (def.repairs && broken) {
      // 破败的世界：先把上一个世界带来的东西放回原处
      const fixed = repairedIn(def.id);
      text = def.brokenGoal;
      for (const r of def.repairs) {
        const it = SCENES[r.from].items.find((i) => i.id === r.id);
        const used = fixed.includes(r.id);
        list.push({ key: `part:${r.id}`, done: used, html: slot(`part:${r.id}`, used ? 'part used leaving' : 'part', it.icon, used ? '放好了' : it.name, used ? '已经放回去了' : '提示：' + r.hint) });
      }
      for (const b of bag) list.push({ key: `bag:${b.name}`, done: false, html: slot(`bag:${b.name}`, 'part bag', b.icon, b.name, `背包里的${b.name}`) });
    } else {
      const found = foundIn(def.id);
      text = `找到这些东西，组成 <b>「${next.name}」</b>冰箱贴`;
      for (const it of def.items) {
        const f = found.includes(it.id);
        list.push({ key: `item:${it.id}`, done: f, html: slot(`item:${it.id}`, f ? 'found leaving' : '', it.icon, f ? it.name : '？？？', f ? it.name : '提示：' + it.hint) });
      }
    }
    // 上次还显示着、这次完成了的，留下来播完淡出动画
    const shown = this._shown || new Set();
    const visible = list.filter((x) => !x.done || shown.has(x.key));
    this._shown = new Set(list.filter((x) => !x.done).map((x) => x.key));
    $('#goal-text').innerHTML = text;
    $('#slots').innerHTML = visible.map((x) => x.html).join('');
    this._dropLeaving();
  },

  _dropLeaving() {
    this._syncGoal();
    if (!$('#slots .leaving')) return;
    setTimeout(() => {
      $('#slots').querySelectorAll('.leaving').forEach((el) => el.remove());
      this._syncGoal();
    }, 1100);
  },

  _syncGoal() {
    $('#goal').hidden = !$('#slots').children.length;
  },

  markFound(id) {
    const el = document.querySelector(`.slot[data-id="item:${id}"]`);
    if (!el) return;
    const def = SCENES[state.current];
    const it = def.items.find((i) => i.id === id);
    el.classList.add('found', 'leaving');
    el.querySelector('.slot-name').textContent = it.name;
    el.title = it.name;
    this._shown?.delete(`item:${id}`);
    this._dropLeaving();
  },

  setHint() {
    // 只剩一种玩法：人在世界里走，镜头可以随时转
    document.body.classList.add('mode-life');
    $('#hint').innerHTML = '⌨ WASD / 方向键走动 · 👆 点哪走哪<br>🖱 拖动旋转 · 滚轮缩放，拉远看全貌<br>✨ 靠近东西自动捡起 · E 聊天';
  },

  prompt(html) {
    const el = $('#prompt');
    if (!html) {
      el.hidden = true;
      return;
    }
    el.innerHTML = html;
    el.hidden = false;
  },

  tooltip(text, x, y) {
    const el = $('#tooltip');
    if (!text) {
      el.hidden = true;
      return;
    }
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.hidden = false;
  },

  // 触控互动按钮：near 为 null 时隐藏
  action(near) {
    const btn = $('#btn-action');
    const key = near ? (near.type === 'villager' ? near.v.name : near.type === 'repair' || near.type === 'interact' ? `${near.type}:${near.id}` : 'fridge') : '';
    if (btn.dataset.key === key) return;
    btn.dataset.key = key;
    if (!near) {
      btn.hidden = true;
      return;
    }
    if (near.type === 'villager') btn.innerHTML = `<span class="a-icon">💬</span>${near.v.name}`;
    else if (near.type === 'repair') btn.innerHTML = `<span class="a-icon">${near.part.icon}</span>放回`;
    else if (near.type === 'interact') btn.innerHTML = `<span class="a-icon">${near.it.icon}</span>${near.it.short || '看看'}`;
    else btn.innerHTML = '<span class="a-icon">🧊</span>冰箱';
    btn.hidden = false;
  },

  toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $('#toast-layer').appendChild(el);
    setTimeout(() => el.remove(), 2700);
  },

  // ---------- 对话 ----------
  dialogOpen: false,
  _typing: null,
  say(name, text) {
    const box = $('#dialog');
    box.hidden = false;
    box.querySelector('.dlg-name').textContent = name;
    const t = box.querySelector('.dlg-text');
    t.textContent = '';
    this.dialogOpen = true;
    clearInterval(this._typing);
    let i = 0;
    this._typing = setInterval(() => {
      t.textContent = text.slice(0, ++i);
      if (i % 2) sfx.blip();
      if (i >= text.length) clearInterval(this._typing);
    }, 38);
    // 重新触发入场动画
    box.style.animation = 'none';
    void box.offsetWidth;
    box.style.animation = '';
  },

  closeDialog() {
    clearInterval(this._typing);
    $('#dialog').hidden = true;
    this.dialogOpen = false;
  },

  // ---------- 头顶的话（小人主动打招呼） ----------
  _speechTyping: null,
  speech(name, text) {
    const el = $('#speech');
    clearInterval(this._speechTyping);
    if (!name) {
      el.hidden = true;
      return;
    }
    el.querySelector('.sp-name').textContent = name;
    const t = el.querySelector('.sp-text');
    t.textContent = '';
    el.hidden = false;
    let i = 0;
    this._speechTyping = setInterval(() => {
      t.textContent = text.slice(0, ++i);
      if (i % 2) sfx.blip();
      if (i >= text.length) clearInterval(this._speechTyping);
    }, 38);
  },

  // 跟着小人的头走（屏幕坐标）
  speechAt(x, y) {
    const el = $('#speech');
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  },

  // ---------- 冰箱 ----------
  magnetHTML(def, { locked = false, badge = '', isNew = false, rot = 0, sub = '' } = {}) {
    if (locked) {
      return `<div class="magnet locked m-${def.id}" style="--rot:${rot}deg"><div class="m-emoji">?</div><div class="m-name">未发现</div><div class="m-sub">在上一个世界里找找看</div></div>`;
    }
    return `<button class="magnet magnet--${def.magnetStyle} m-${def.id} ${isNew ? 'new' : ''}" data-id="${def.id}" style="--rot:${rot}deg">
      ${badge ? `<span class="m-badge">${badge}</span>` : ''}
      <div class="m-emoji">${def.emoji}</div>
      <div class="m-name">${def.name}</div>
      ${sub ? `<div class="m-sub">${sub}</div>` : ''}
    </button>`;
  },

  openFridge(onPick) {
    sfx.pop();
    const rots = [-4, 3, -2, 5, -3, 4, -2];
    $('#magnets').innerHTML = ORDER.map((id, i) => {
      const def = SCENES[id];
      if (!state.magnets.includes(id)) return this.magnetHTML(def, { locked: true, rot: rots[i] });
      const isNew = state.newMagnet === id;
      const badge = isNew ? 'NEW!' : state.current === id ? '📍 你在这里' : '';
      let sub = '';
      if (def.ending) sub = '集齐纪念 · 点我看看';
      else if (def.comingSoon) sub = '施工中…';
      else sub = `收集 ${foundIn(id).filter((f) => def.items.some((i) => i.id === f)).length} / ${def.items.length}`;
      return this.magnetHTML(def, { badge, isNew, rot: rots[i], sub });
    }).join('');
    $('#fridge-count').textContent = `冰箱贴 ${state.magnets.length} / ${ORDER.length}`;
    $('#fridge').hidden = false;
    $('#magnets').onclick = (e) => {
      const btn = e.target.closest('.magnet[data-id]');
      if (!btn) return;
      onPick(btn.dataset.id);
    };
  },

  closeFridge() {
    $('#fridge').hidden = true;
  },

  get fridgeOpen() {
    return !$('#fridge').hidden;
  },

  // ---------- 合成冰箱贴 ----------
  async combine(def, nextDef) {
    const ov = $('#combine');
    const items = $('#combine-items');
    const flash = $('#combine-flash');
    const mag = $('#combine-magnet');
    const text = $('#combine-text');
    const btn = $('#combine-btn');
    flash.classList.remove('go');
    mag.classList.remove('show');
    mag.innerHTML = this.magnetHTML(nextDef, { rot: -3 });
    btn.hidden = true;
    text.textContent = '三样东西开始发光……';
    items.innerHTML = def.items.map((it) => `<div class="c-item">${it.icon}</div>`).join('');
    const els = [...items.children];
    els.forEach((el, i) => {
      const a = (i / els.length) * Math.PI * 2 - Math.PI / 2;
      el.style.transition = 'none';
      el.style.opacity = '1';
      el.style.transform = `translate(${Math.cos(a) * 110}px, ${Math.sin(a) * 110}px) scale(0.3)`;
    });
    ov.hidden = false;
    await wait(50);
    els.forEach((el, i) => {
      const a = (i / els.length) * Math.PI * 2 - Math.PI / 2;
      el.style.transition = 'transform 0.5s cubic-bezier(.3,1.6,.5,1)';
      el.style.transform = `translate(${Math.cos(a) * 110}px, ${Math.sin(a) * 110}px) scale(1)`;
    });
    sfx.pop();
    await wait(900);
    els.forEach((el) => {
      el.style.transition = '';
      el.style.transform = 'translate(0,0) scale(0.4) rotate(360deg)';
      el.style.opacity = '0';
    });
    sfx.whoosh();
    await wait(1050);
    flash.classList.add('go');
    mag.classList.add('show');
    sfx.fanfare();
    text.textContent = `获得冰箱贴：「${nextDef.name}」！`;
    await wait(700);
    btn.hidden = false;
    await new Promise((res) => {
      btn.onclick = () => {
        sfx.click();
        res();
      };
    });
    ov.hidden = true;
  },

  // ---------- 小游戏 ----------
  showGame(g, onKey) {
    $('#game-title').textContent = g.title;
    $('#game-help').textContent = g.help || '';
    $('#game').hidden = false;
    // 按住方向键会一直移动
    let rep = null;
    const stop = () => {
      clearTimeout(rep);
      clearInterval(rep);
      rep = null;
    };
    let downTaps = [];
    for (const b of $('#game').querySelectorAll('button[data-k]')) {
      const k = b.dataset.k;
      // 退出要等一次完整的点击：按下就退的话，界面切回来，手指抬起补发的 click 会落到底下的冰箱按钮上
      if (k === 'exit') {
        b.onpointerdown = null;
        b.onclick = () => onKey(k);
        continue;
      }
      b.onpointerdown = (e) => {
        e.preventDefault();
        stop();
        // 连按三下 ↓：一落到底
        if (k === 'down') {
          const now = performance.now();
          downTaps = downTaps.filter((t) => now - t < 700).concat(now);
          if (downTaps.length >= 3) {
            downTaps = [];
            onKey('drop');
            return;
          }
        }
        onKey(k);
        if (k === 'left' || k === 'right' || k === 'down') rep = setTimeout(() => (rep = setInterval(() => onKey(k), 70)), 220);
      };
      b.onpointerup = b.onpointerleave = b.onpointercancel = stop;
    }
    this._stopRepeat = stop;
  },

  gameStatus(text) {
    $('#game-status').textContent = text;
  },

  hideGame() {
    this._stopRepeat?.();
    $('#game').hidden = true;
  },

  // ---------- 结局 ----------
  // 返回 'close'（回到冰箱）或 'reset'（从头再玩）
  showEnding() {
    const ov = $('#ending');
    $('#ending-photo').innerHTML = WORLDS.map((id, i) => `<span style="animation-delay:${i * 0.2}s">${SCENES[id].emoji}</span>`).join('');
    const items = WORLDS.reduce((n, id) => n + SCENES[id].items.length, 0);
    $('#ending-stats').innerHTML = `走过 <b>${WORLDS.length}</b> 个小世界，找到 <b>${items}</b> 样小东西`;
    $('#ending-names').textContent =
      '合照里还有：小橘、阿绵、波波、莉莉、蘑菇仔、方方、豆豆、阿像、夜猫、阿霓、小飞、亚瑟、玛丽、卫兵、阿浪、小贝、老船长……和你。';
    // 彩纸
    const conf = $('#confetti');
    conf.innerHTML = '';
    const bits = ['🎉', '✨', '⭐', '🧲', '💛', '🎊', '🌸'];
    for (let i = 0; i < 40; i++) {
      const el = document.createElement('i');
      el.textContent = bits[i % bits.length];
      el.style.left = Math.random() * 100 + 'vw';
      el.style.fontSize = 14 + Math.random() * 18 + 'px';
      el.style.animationDuration = 3 + Math.random() * 3 + 's';
      el.style.animationDelay = Math.random() * 2.5 + 's';
      conf.appendChild(el);
    }
    ov.hidden = false;
    sfx.ending();
    return new Promise((res) => {
      $('#ending-close').onclick = () => {
        sfx.click();
        ov.hidden = true;
        res('close');
      };
      $('#ending-reset').onclick = () => {
        sfx.click();
        if (!confirm('确定要从头再玩一次吗？现在的收集进度会被清空。')) return;
        ov.hidden = true;
        res('reset');
      };
    });
  },

  // ---------- 开场 ----------
  intro() {
    return new Promise((res) => {
      $('#intro').hidden = false;
      $('#intro-btn').onclick = () => {
        sfx.unlock();
        sfx.click();
        $('#intro').hidden = true;
        res();
      };
    });
  },

  async fade(fn) {
    const f = $('#fade');
    f.classList.add('on');
    await wait(460);
    await fn();
    await wait(60);
    f.classList.remove('on');
  },
};
