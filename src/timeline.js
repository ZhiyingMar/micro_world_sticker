// 按世界里的时间排先后的小动画：过一会儿做某件事、在一段时间里慢慢变过去
// 跟着世界的 onUpdate 走：切到别的世界以后旧世界不再更新，排着的事也跟着停，不会去动已经拆掉的世界（setTimeout 会）

/**
 * 给一个世界建一条时间线
 * @param {World} world 动画在哪个世界里放
 * @returns {{ after(delay: number, action: Function): void, tween(duration: number, onProgress: Function, delay?: number): void }}
 *   after：过 delay 秒做 action；tween：过 delay 秒开始，在 duration 秒里每帧用 0~1 的进度调 onProgress，最后一定调一次 1
 */
export function createTimeline(world) {
  const tasks = [];
  let now = 0;

  world.onUpdate((dt) => {
    now += dt;
    // 倒着走：做完的直接从数组里拿掉
    for (let i = tasks.length - 1; i >= 0; i--) {
      const task = tasks[i];
      if (now < task.start) {
        continue;
      }

      const finished = runTask(task, now);
      if (finished) {
        tasks.splice(i, 1);
      }
    }
  });

  return {
    after(delay, action) {
      tasks.push({ start: now + delay, duration: 0, onProgress: action });
    },
    tween(duration, onProgress, delay = 0) {
      tasks.push({ start: now + delay, duration, onProgress });
    },
  };
}

/**
 * 跑一帧排好的事
 * @param {{ start: number, duration: number, onProgress: Function }} task 排好的事
 * @param {number} now 时间线走到第几秒
 * @returns {boolean} 做完了没有
 */
function runTask(task, now) {
  if (task.duration <= 0) {
    task.onProgress(1);
    return true;
  }

  const progress = Math.min((now - task.start) / task.duration, 1);
  task.onProgress(progress);
  return progress >= 1;
}

/**
 * 先冲过头一点再落回来的缓动（东西"噗"地长出来、弹出来用）
 * @param {number} progress 0~1
 * @returns {number} 0 开始，中间会超过 1 一点，最后停在 1
 */
export function easeOutBack(progress) {
  const overshoot = 1.7;
  const shifted = progress - 1;
  return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2;
}

/**
 * 慢慢起步、慢慢停下的缓动
 * @param {number} progress 0~1
 * @returns {number} 0~1
 */
export function easeInOut(progress) {
  return progress * progress * (3 - 2 * progress);
}

/**
 * 一个数在 [from, to] 这一段里走到了几成
 * @param {number} value 现在的数
 * @param {number} from 这一段从哪儿开始
 * @param {number} to 到哪儿结束
 * @returns {number} 0~1，段前是 0，段后是 1
 */
export function ramp(value, from, to) {
  if (to <= from) {
    return value >= to ? 1 : 0;
  }
  return Math.min(Math.max((value - from) / (to - from), 0), 1);
}
