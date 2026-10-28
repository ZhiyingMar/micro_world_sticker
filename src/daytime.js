// 小屋里现在几点：两种走法，玩家在设置里选
//   跟着现在：读这台设备的本地时间，晚上打开游戏，小屋里也是晚上
//   快进：现实 1 分钟 = 小屋里 1 小时，一整天 24 分钟，从切换那一刻的钟点接着往下走
// 这里只管钟点，不管画面；画面怎么跟着变由世界自己决定（现在只有小屋用）
import { state, save } from './state.js';

const HOURS_PER_DAY = 24;
// 快进：现实里每过 1 秒，小屋里过多少小时（现实 1 分钟 = 1 小时）
const FAST_HOURS_PER_SECOND = 1 / 60;
// 画面用的钟一下差了这么多小时（刚切了模式），不是正常走过去的：用一小段时间追上，光不一下跳过去
const JUMP_HOURS = 0.25;
// 追上去用多久（秒）
const CATCH_UP_SECONDS = 1.5;

// 网址加 ?hour=20.5 把钟点钉在这一刻（检查画面用），不进存档；宣传片也钉在一个固定的钟点
let pinnedHour = hourFromUrl();

/**
 * 网址里 ?hour= 写的钟点
 * @returns {number | null} 0~24 之间的小时；没写或写错了是 null
 */
function hourFromUrl() {
  const text = new URLSearchParams(location.search).get('hour');
  if (text === null) {
    return null;
  }

  const hour = Number(text);
  const valid = Number.isFinite(hour) && hour >= 0 && hour < HOURS_PER_DAY;
  if (!valid) {
    console.warn(`网址里的 hour=${text} 不是 0~24 之间的钟点，不管它`);
    return null;
  }
  return hour;
}

/**
 * 把钟点绕回 0~24 之间
 * @param {number} hour 小时，可以超过 24 或是负的
 * @returns {number}
 */
function wrapHour(hour) {
  return ((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
}

/**
 * 把钟点钉住，不再跟着模式走
 * @description 宣传片要录固定的下午光，不能随录的时候是几点变
 * @param {number} hour 钉在几点（0~24）
 */
export function pinHour(hour) {
  pinnedHour = wrapHour(hour);
}

/**
 * 现在用的是哪种走法
 * @description 老存档没有这一项，就是"跟着现在"
 * @returns {'real' | 'fast'}
 */
export function timeMode() {
  if (state.time?.mode === 'fast') {
    return 'fast';
  }
  return 'real';
}

/**
 * 换一种走法，记进存档
 * @description 切到快进时从现在这一刻的钟点接着往下走；存下起点，刷新页面、去别的世界再回来，时间接着走
 * @param {'real' | 'fast'} mode 跟着现在 / 快进
 */
export function setTimeMode(mode) {
  if (mode === timeMode()) {
    return;
  }

  if (mode === 'fast') {
    state.time = { mode, startHour: currentHour(), startedAt: Date.now() };
  } else {
    state.time = { mode: 'real' };
  }
  save();
}

/**
 * 小屋里现在几点
 * @returns {number} 0~24 之间的小时，带小数（19.5 是七点半）
 */
export function currentHour() {
  if (pinnedHour !== null) {
    return pinnedHour;
  }
  if (timeMode() === 'fast') {
    return fastHour();
  }
  return realHour();
}

/**
 * 这台设备上现在的本地时间
 * @returns {number} 0~24 之间的小时
 */
function realHour() {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

/**
 * 快进时现在几点：从存档里记的起点往后算
 * @returns {number} 0~24 之间的小时
 */
function fastHour() {
  const { startHour, startedAt } = state.time;
  const startValid = Number.isFinite(startHour) && Number.isFinite(startedAt);
  if (!startValid) {
    // 存档里的起点坏了（手改过存档之类），从现在的本地时间重新开始快进，不让钟点变成 NaN
    console.warn('存档里快进的起点不对，从现在的时间重新开始快进', state.time);
    state.time = { mode: 'fast', startHour: realHour(), startedAt: Date.now() };
    save();
  }

  const elapsedSeconds = (Date.now() - state.time.startedAt) / 1000;
  return wrapHour(state.time.startHour + elapsedSeconds * FAST_HOURS_PER_SECOND);
}

/**
 * 钟点写成 "19:05" 这样
 * @param {number} hour 0~24 之间的小时
 * @returns {string}
 */
export function formatHour(hour) {
  const totalMinutes = Math.floor(wrapHour(hour) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

/**
 * 一只给画面用的钟：平时就是 currentHour()，钟点一下差了很多（刚切了模式）时，往近的那边用一小段时间追上
 * @description 从快进切回"跟着现在"可能差好几个小时，光和钟的指针一下跳过去很突兀；追的时候像一小段延时摄影
 * @returns {{ update(dt: number): number }} 每帧调一次 update(这一帧过了几秒)，返回这一帧画面用的钟点
 */
export function createDisplayClock() {
  let shown = currentHour();
  // 正在追的时候：每秒追多少小时（往回追是负的）、还差多少小时
  let catchUp = null;

  const update = (dt) => {
    const target = currentHour();
    // 往近的那边算差多少：-12 ~ 12 小时
    const gap = wrapHour(target - shown + HOURS_PER_DAY / 2) - HOURS_PER_DAY / 2;
    if (!catchUp && Math.abs(gap) > JUMP_HOURS) {
      catchUp = { speed: gap / CATCH_UP_SECONDS, left: gap };
    }
    if (!catchUp) {
      shown = target;
      return shown;
    }

    const step = catchUp.speed * dt;
    const arrived = Math.abs(step) >= Math.abs(catchUp.left);
    if (arrived) {
      shown = target;
      catchUp = null;
    } else {
      shown = wrapHour(shown + step);
      catchUp.left -= step;
    }
    return shown;
  };
  return { update };
}
