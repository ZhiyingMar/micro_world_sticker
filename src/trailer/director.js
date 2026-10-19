// 导演：照着分镜表一个镜头一个镜头地演
//   换世界、到点触发剧情（走路、放回东西、换壁纸……）、管镜头、叠字幕和黑场
// 镜头位置用“看着哪儿 + 离多远 + 上下角 + 左右角”写，前后两个机位之间平滑过渡
import * as THREE from 'three';
import { sfx } from '../audio.js';
import { DECOR_KINDS } from '../decor.js';
import { drawCaption, drawTitleCard, drawFade } from './overlay.js';

// 字幕、标题卡淡入淡出多久（秒）
const CAPTION_FADE = 0.45;

/**
 * 慢进慢出：镜头起步和停下都不突兀
 * @param {number} k 0..1 的进度
 * @returns {number} 0..1
 */
function easeInOut(k) {
  return k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
}

/**
 * 一段时间里的淡入淡出系数
 * @param {number} time 现在是这段里的第几秒
 * @param {number} duration 这段一共多少秒
 * @param {boolean} fadeIn 开头要不要淡入（和前一段字幕一样时不用）
 * @param {boolean} fadeOut 结尾要不要淡出（和后一段字幕一样时不用）
 * @returns {number} 0..1
 */
function fadeWindow(time, duration, fadeIn, fadeOut) {
  let opacity = 1;
  if (fadeIn) {
    opacity = Math.min(opacity, time / CAPTION_FADE);
  }
  if (fadeOut) {
    opacity = Math.min(opacity, (duration - time) / CAPTION_FADE);
  }
  return THREE.MathUtils.clamp(opacity, 0, 1);
}

/**
 * 做一个导演
 * @param {object} game main.js 交出来的游戏接口（镜头、世界、玩家、放回东西……）
 * @param {object[]} shots 分镜表，见 shots.js
 * @param {object} options
 * @param {object} options.recorder 录像机，每帧画完交给它叠字幕
 * @param {() => void} options.onEnd 最后一个镜头演完时调用
 * @returns {object} 导演：begin() 开拍，update(dt) / afterRender(canvas) 由主循环每帧调用
 */
export function createDirector(game, shots, { recorder, onEnd }) {
  let shotIndex = -1;
  let shotTime = 0;
  let firedCues = new Set();
  let lastDt = 0;
  let finished = false;
  // 下一次打开工作台时要选哪款：{ kind, id }
  let pendingDecor = null;

  const look = new THREE.Vector3();
  const lookFrom = new THREE.Vector3();
  const lookTo = new THREE.Vector3();

  // 分镜里的剧情动作用的小工具：只做分镜需要的几件事
  const stage = {
    get world() {
      return game.world;
    },
    get player() {
      return game.player;
    },
    /**
     * 把人直接挪到某处（换镜头时用，像剪辑里的跳切）
     * @param {number} x 位置
     * @param {number} z 位置
     * @param {number} facing 朝向，弧度，0 朝 +z
     */
    place(x, z, facing = 0) {
      const player = game.player;
      player.root.position.set(x, game.world.heightAt(x, z), z);
      player.moveTarget = null;
      player.path = null;
      player.heading = facing;
      player.root.rotation.y = facing;
    },
    /**
     * 让人自己走过去（会寻路绕开障碍）
     * @param {number} x 目标位置
     * @param {number} z 目标位置
     */
    walk(x, z) {
      game.player.goTo(x, z);
    },
    /**
     * 人头上方一点的位置：镜头跟着人时看这里
     * @param {number} lift 比脚底高多少
     * @returns {number[]} [x, y, z]
     */
    playerPoint(lift = 0.5) {
      const player = game.player;
      return [player.x, player.root.position.y + lift, player.z];
    },
    /**
     * 让缺东西的地方显出来（半透明的影子），和玩家走近时一样
     * @param {string} id 修复点 id
     */
    discover(id) {
      if (game.world.discover(id)) {
        sfx.pop();
      }
    },
    /**
     * 把东西放回原处，和玩家点它一样：音效、闪光、剧情都照常走
     * @param {string} id 修复点 id
     */
    repair(id) {
      game.doRepair(id);
    },
    /**
     * 在工作台上换一款装修，和玩家在面板上点选一样
     * @param {'wallpaper' | 'floor'} kind 哪一类
     * @param {string} id 装修目录里那一款的 id
     */
    useWorkbench(kind, id) {
      pendingDecor = { kind, id };
      game.world.interacts.get('workbench').fn();
    },
    /**
     * 放一个音效
     * @param {string} name sfx 里的名字，比如 whoosh、pickup
     */
    sound(name) {
      sfx[name]();
    },
  };

  /**
   * 算出某个机位这一帧要看着哪儿
   * @param {object} view 机位
   * @param {THREE.Vector3} out 结果写进这里
   * @returns {THREE.Vector3} out
   */
  function resolveLook(view, out) {
    const point = typeof view.look === 'function' ? view.look(stage) : view.look;
    return out.set(...point);
  }

  /**
   * 开始演第几个镜头：要换世界就先搭好新世界（方块会落下来），再做这个镜头的准备
   * @param {number} index 第几个镜头
   */
  function startShot(index) {
    shotIndex = index;
    shotTime = 0;
    firedCues = new Set();
    const shot = shots[index];
    if (shot.world && game.world?.def.id !== shot.world) {
      game.loadScene(shot.world);
    }
    shot.setup?.(stage);
  }

  /**
   * 这一帧的镜头：在起止两个机位之间按进度插值
   * @param {object} shot 当前镜头
   * @param {number} progress 0..1
   */
  function placeCamera(shot, progress) {
    const from = shot.camera.from;
    const to = shot.camera.to || from;
    const k = easeInOut(progress);

    resolveLook(from, lookFrom);
    resolveLook(to, lookTo);
    look.lerpVectors(lookFrom, lookTo, k);
    const distance = THREE.MathUtils.lerp(from.distance, to.distance, k) * game.zoom;
    const polar = THREE.MathUtils.lerp(from.polar, to.polar, k);
    const azimuth = THREE.MathUtils.lerp(from.azimuth, to.azimuth, k);

    const camera = game.camera;
    camera.position.setFromSphericalCoords(distance, polar, azimuth).add(look);
    camera.lookAt(look);
    // 别的地方（方向键朝向、遮挡判断）读的是 controls 的中心，一起对上
    game.controls.target.copy(look);
  }

  /**
   * 到点的剧情动作一个个触发
   * @param {object} shot 当前镜头
   */
  function fireCues(shot) {
    for (const [i, cue] of (shot.cues || []).entries()) {
      if (shotTime >= cue.at && !firedCues.has(i)) {
        firedCues.add(i);
        cue.run(stage);
      }
    }
  }

  /**
   * 叠字幕、标题卡、黑场
   * @param {CanvasRenderingContext2D} context 录像的画布
   */
  function drawOverlay(context) {
    const shot = shots[shotIndex];
    const duration = shot.duration;
    const previous = shots[shotIndex - 1];
    const next = shots[shotIndex + 1];

    // 相邻两个镜头字幕一样时连着显示，不闪一下
    const captionOpacity = fadeWindow(shotTime, duration, previous?.caption !== shot.caption, next?.caption !== shot.caption);
    drawCaption(context, shot.caption, captionOpacity);

    if (shot.title) {
      const titleTime = shotTime - shot.title.at;
      const titleOpacity = THREE.MathUtils.clamp(titleTime / shot.title.fade, 0, 1);
      drawTitleCard(context, shot.title, titleOpacity);
    }

    let black = 0;
    if (shot.fadeIn) {
      black = Math.max(black, 1 - shotTime / shot.fadeIn);
    }
    if (shot.fadeOut) {
      black = Math.max(black, 1 - (duration - shotTime) / shot.fadeOut);
    }
    drawFade(context, black);
  }

  return {
    // 开拍：搭好第一个镜头的世界。要在主循环开始之前调用，主循环每帧都要有世界可画
    begin() {
      startShot(0);
    },

    /**
     * 主循环每帧调用：推进时间、触发剧情、摆镜头
     * @param {number} dt 离上一帧多少秒
     */
    update(dt) {
      lastDt = dt;
      if (finished) {
        return;
      }
      shotTime += dt;
      if (shotTime >= shots[shotIndex].duration) {
        if (shotIndex === shots.length - 1) {
          finished = true;
          shotTime = shots[shotIndex].duration;
          onEnd();
        } else {
          startShot(shotIndex + 1);
        }
      }

      const shot = shots[shotIndex];
      fireCues(shot);
      placeCamera(shot, Math.min(1, shotTime / shot.duration));
    },

    /**
     * 主循环画完一帧后调用：交给录像机叠出要录的画面
     * @param {HTMLCanvasElement} canvas 刚画完的 3D 画布
     */
    afterRender(canvas) {
      recorder.compose(canvas, { backdrop: game.world.backdrop, dt: lastDt, overlay: drawOverlay });
    },

    /**
     * 世界要打开工作台时调用（拍片时不弹面板）：直接选分镜里写好的那款
     * @param {(kind: string, entry: object) => string} onPick 工作台选中一款时的处理
     */
    openWorkbench(onPick) {
      if (!pendingDecor) {
        throw new Error('分镜没说要在工作台上换哪款，却打开了工作台');
      }
      const { kind, id } = pendingDecor;
      pendingDecor = null;
      const entry = DECOR_KINDS[kind].list.find((candidate) => candidate.id === id);
      if (!entry) {
        throw new Error(`装修目录里没有「${id}」`);
      }
      const result = onPick(kind, entry);
      if (result === 'short') {
        throw new Error(`宣传片的预设材料不够做「${entry.name}」`);
      }
      sfx.pickup();
    },
  };
}
