// 收音机：柜子上那台红色收音机放着轻音乐（src/music.js 现场编的），旋律响一个音，就飘出一个彩色音符
// 点它或者走近按 E 开关，拧开关时收音机缩一下再弹回来；关掉以后下次进来也还是关着（记在存档里）
// 白天放轻快的小曲，天黑了下一首换成摇篮曲（daylight.js 按钟点告诉它）
import * as THREE from 'three';
import { canvasTexture } from '../../kit.js';
import { sfx } from '../../audio.js';
import { createRadioMusic } from '../../music.js';
import { state, save } from '../../state.js';
import { FURNITURE } from './layout.js';

// 音符：飘多高、左右晃多大、多久散掉，多大
const NOTE_RISE = 0.7;
const NOTE_SWAY = 0.12;
const NOTE_LIFE = 2.4;
const NOTE_SIZE = 0.2;
const NOTE_GLYPHS = ['♪', '♫'];
const NOTE_COLORS = ['#e85d5d', '#5d9ce8', '#f4a259'];
const NOTE_TEXTURE_PX = 64;
// 从收音机顶上多高的地方冒出来
const NOTE_START_HEIGHT = 0.25;
// 两个音符至少隔多久才飘（秒）：旋律密的时候不至于冒成一串
const NOTE_MIN_GAP = 1.1;

// 进屋以后过几秒音乐才响起来（等环境声先淡进来）；拧开以后先沙沙地调一会儿台再出声
const ENTER_DELAY = 1.5;
const TUNE_IN_DELAY = 0.5;
// 拧开关时收音机压扁多少、多久弹回原样（秒）
const SWITCH_SQUASH = 0.14;
const SWITCH_BOUNCE_SECONDS = 0.35;
// 人站在柜子正面多远开关它（柜子一半深，再让开小人的身子），离那儿多近就能按
const STAND_DISTANCE = 0.8;
const REACH = 1.3;

/**
 * 让收音机放起音乐来，登记成能开关的东西
 * @param {World} world 小屋这个世界
 * @param {object} parts 收音机柜
 * @param {THREE.Object3D} parts.cabinet 整个柜子（点它就是点收音机，手机上好点）
 * @param {THREE.Object3D} parts.radio 柜子上的收音机（音符从它顶上冒出来）
 * @returns {{ setNight(night: boolean): void }} 天黑了 / 天亮了：下一首换成摇篮曲 / 白天的小曲
 */
export function placeRadio(world, { cabinet, radio }) {
  const notes = createFloatingNotes(world, radio);
  const music = createRadioMusic({ onMelody: notes.expect });
  let squashTime = null;

  if (state.radioOn) {
    music.start(ENTER_DELAY);
  }

  const toggle = () => {
    state.radioOn = !state.radioOn;
    save();
    sfx.radioSwitch(state.radioOn);
    sfx.radioPower(state.radioOn);
    if (state.radioOn) {
      music.start(TUNE_IN_DELAY);
    } else {
      music.stop();
      notes.clear();
    }
    squashTime = 0;
  };

  const { x, z, facing } = FURNITURE.cabinet;
  const standX = x + Math.sin(facing) * STAND_DISTANCE;
  const standZ = z + Math.cos(facing) * STAND_DISTANCE;
  world.interact('radio', cabinet, standX, standZ, {
    reach: REACH,
    icon: '📻',
    short: '收音机',
    label: () => (state.radioOn ? '关掉收音机' : '打开收音机'),
    fn: toggle,
  });

  world.onUpdate((dt, time) => {
    // 还没点过一次时没有音频的钟：先拿画面的时间走着，音符照样飘；有了音频的钟，音乐会自己接上
    music.update(sfx.musicClock() ?? time);
    notes.update(dt);
    squashTime = bounce(radio, squashTime, dt);
  });

  return { setNight: music.setNight };
}

/**
 * 拧开关时收音机压扁一下再弹回来
 * @param {THREE.Object3D} radio 收音机
 * @param {number | null} elapsed 拧了开关以后过了几秒，null 是没在弹
 * @param {number} dt 这一帧几秒
 * @returns {number | null} 下一帧的 elapsed
 */
function bounce(radio, elapsed, dt) {
  if (elapsed === null) {
    return null;
  }

  const next = elapsed + dt;
  const progress = Math.min(1, next / SWITCH_BOUNCE_SECONDS);
  // 先压扁，再弹过头一点，最后停在原样
  const squash = SWITCH_SQUASH * Math.sin(progress * Math.PI * 2) * (1 - progress);
  radio.scale.set(1 + squash, 1 - squash, 1 + squash);
  if (progress >= 1) {
    radio.scale.setScalar(1);
    return null;
  }
  return next;
}

/**
 * 收音机顶上飘的彩色音符：旋律响一个音就飘一个，晃着往上飘，慢慢变淡
 * @param {World} world
 * @param {THREE.Object3D} radio 收音机
 * @returns {{ expect(wait: number): void, clear(): void, update(dt: number): void }}
 *   expect：音乐说再过几秒要响一个旋律音；clear：关掉了，还没飘的不飘了；update：每帧推一下
 */
function createFloatingNotes(world, radio) {
  radio.updateWorldMatrix(true, false);
  const start = new THREE.Vector3(0, NOTE_START_HEIGHT, 0).applyMatrix4(radio.matrixWorld);
  const textures = NOTE_GLYPHS.map((glyph) => world.texture(noteTexture(glyph)));
  const floating = [];
  // 还没到时候的音符：再过几秒冒出来
  let upcoming = [];
  let sinceLast = Infinity;
  let count = 0;

  const spawn = () => {
    const material = new THREE.SpriteMaterial({ map: textures[count % textures.length], color: NOTE_COLORS[count % NOTE_COLORS.length], transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(NOTE_SIZE);
    world.add(sprite, start.x, start.y, start.z);
    floating.push({ sprite, age: 0, phase: Math.random() * Math.PI * 2 });
    count++;
    sinceLast = 0;
  };

  const drift = (dt) => {
    for (let i = floating.length - 1; i >= 0; i--) {
      const note = floating[i];
      note.age += dt;
      const progress = note.age / NOTE_LIFE;
      if (progress >= 1) {
        note.sprite.removeFromParent();
        note.sprite.material.dispose();
        floating.splice(i, 1);
        continue;
      }
      note.sprite.position.y = start.y + progress * NOTE_RISE;
      note.sprite.position.x = start.x + Math.sin(note.phase + progress * Math.PI * 2) * NOTE_SWAY;
      note.sprite.material.opacity = Math.sin(progress * Math.PI);
    }
  };

  return {
    expect(wait) {
      // 音乐提前一点点把音交给音频：等它真的响了再冒
      upcoming.push(Math.max(0, wait));
    },
    clear() {
      upcoming = [];
    },
    update(dt) {
      sinceLast += dt;
      upcoming = upcoming.map((wait) => wait - dt);
      const due = upcoming.filter((wait) => wait <= 0).length;
      upcoming = upcoming.filter((wait) => wait > 0);
      if (due > 0 && sinceLast >= NOTE_MIN_GAP) {
        spawn();
      }
      drift(dt);
    },
  };
}

/**
 * 一个音符的贴图：白色的字（颜色由材质染）
 * @param {string} glyph ♪ 或 ♫
 * @returns {THREE.CanvasTexture}
 */
function noteTexture(glyph) {
  return canvasTexture(NOTE_TEXTURE_PX, NOTE_TEXTURE_PX, (context, width, height) => {
    context.font = `bold ${Math.round(height * 0.8)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.fillText(glyph, width / 2, height / 2);
  });
}
