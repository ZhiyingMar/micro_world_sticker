import { state, foundIn } from './state.js';
import { SCENES, ORDER } from './scenes/index.js';
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
    this.renderGoal(def);
  },

  renderGoal(def) {
    const next = SCENES[def.next];
    const found = foundIn(def.id);
    const done = found.filter((f) => def.items.some((i) => i.id === f)).length >= def.items.length;
    $('#goal-text').innerHTML = done
      ? `这里的东西已经集齐 ✓ <b>「${next.name}」</b>冰箱贴在冰箱上`
      : `找到这些东西，组成 <b>「${next.name}」</b>冰箱贴`;
    $('#slots').innerHTML = def.items
      .map((it) => {
        const f = found.includes(it.id);
        return `<div class="slot ${f ? 'found' : ''}" data-id="${it.id}" title="${f ? it.name : '提示：' + it.hint}">
          <div class="slot-icon"><span>${it.icon}</span></div>
          <div class="slot-name">${f ? it.name : '？？？'}</div>
        </div>`;
      })
      .join('');
  },

  markFound(id) {
    const el = document.querySelector(`.slot[data-id="${id}"]`);
    if (!el) return;
    el.classList.add('found');
    const def = SCENES[state.current];
    const it = def.items.find((i) => i.id === id);
    el.querySelector('.slot-name').textContent = it.name;
    el.title = it.name;
  },

  setMode(mode) {
    document.querySelectorAll('#mode-switch button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    document.body.classList.toggle('mode-life', mode === 'life');
    $('#hint').innerHTML =
      mode === 'god'
        ? '🖱 拖动旋转 · 滚轮缩放<br>👆 点击任何地方放大细节<br>💬 点小人聊天'
        : '⌨ WASD / 方向键走动<br>👆 点地面走过去<br>✨ 靠近东西自动捡起 · E 聊天';
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
    const key = near ? (near.type === 'villager' ? near.v.name : 'fridge') : '';
    if (btn.dataset.key === key) return;
    btn.dataset.key = key;
    if (!near) {
      btn.hidden = true;
      return;
    }
    btn.innerHTML =
      near.type === 'villager' ? `<span class="a-icon">💬</span>${near.v.name}` : '<span class="a-icon">🧊</span>冰箱';
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

  // ---------- 冰箱 ----------
  magnetHTML(def, { locked = false, badge = '', isNew = false, rot = 0, sub = '' } = {}) {
    if (locked) {
      return `<div class="magnet locked" style="--rot:${rot}deg"><div class="m-emoji">?</div><div class="m-name">未发现</div><div class="m-sub">在上一个世界里找找看</div></div>`;
    }
    return `<button class="magnet magnet--${def.magnetStyle} ${isNew ? 'new' : ''}" data-id="${def.id}" style="--rot:${rot}deg">
      ${badge ? `<span class="m-badge">${badge}</span>` : ''}
      <div class="m-emoji">${def.emoji}</div>
      <div class="m-name">${def.name}</div>
      ${sub ? `<div class="m-sub">${sub}</div>` : ''}
    </button>`;
  },

  openFridge(onPick) {
    sfx.pop();
    const rots = [-4, 3, -2, 5, -3, 4];
    $('#magnets').innerHTML = ORDER.map((id, i) => {
      const def = SCENES[id];
      if (!state.magnets.includes(id)) return this.magnetHTML(def, { locked: true, rot: rots[i] });
      const isNew = state.newMagnet === id;
      const badge = isNew ? 'NEW!' : state.current === id ? '📍 你在这里' : '';
      let sub = '';
      if (def.comingSoon) sub = '施工中…';
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
