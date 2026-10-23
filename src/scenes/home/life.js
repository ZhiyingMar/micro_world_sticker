// 让小屋活起来：窗帘被窗缝里的风吹得轻轻晃，桌上的茶壶冒热气，收音机隔一会儿飘出一个音符
// 都只是看的，不挡路，也不会被点到
import * as THREE from 'three';
import { canvasTexture } from '../../kit.js';

// 窗帘：晃多快、晃多大（弧度），两片步子错开多少；一阵风大一阵风小，多久一个来回
const CURTAIN_SPEED = 1.1;
const CURTAIN_SWAY = 0.035;
const CURTAIN_OFFSET = 1.3;
const GUST_SPEED = 0.3;
const GUST_DEPTH = 0.5;

// 热气：隔多久冒一团（秒），一团多大、多白、飘多快、多久散掉
const STEAM_GAP = 0.45;
const STEAM = { count: 1, color: '#ffffff', size: 0.38, spread: 0.02, rise: 0.28, life: 2.2, opacity: 0.75 };
// 茶壶嘴口离壶嘴模型中心多远（沿壶嘴往外），热气从那儿冒
const SPOUT_TIP = 0.1;

// 收音机的音符：隔多久飘一个（秒），飘多高、左右晃多大、多久散掉，多大
const NOTE_GAP = 2.6;
const NOTE_RISE = 0.7;
const NOTE_SWAY = 0.12;
const NOTE_LIFE = 2.4;
const NOTE_SIZE = 0.2;
const NOTE_GLYPHS = ['♪', '♫'];
const NOTE_COLORS = ['#e85d5d', '#5d9ce8', '#f4a259'];
const NOTE_TEXTURE_PX = 64;
// 从收音机顶上多高的地方冒出来
const NOTE_START_HEIGHT = 0.25;

/**
 * 让小屋动起来
 * @param {World} world 小屋这个世界
 * @param {object} context
 * @param {THREE.Group[]} context.curtains 两片窗帘（原点在横杆上）
 * @param {THREE.Object3D} context.spout 茶壶嘴
 * @param {THREE.Object3D} context.radio 收音机
 * @param {{ emit: Function }} context.puffs 冒热气用
 */
export function bringToLife(world, { curtains, spout, radio, puffs }) {
  swayCurtains(world, curtains);
  steamTea(world, spout, puffs);
  playRadio(world, radio);
}

/**
 * 窗帘绕着横杆前后轻轻晃，一阵风大一阵风小
 * @param {World} world
 * @param {THREE.Group[]} curtains
 */
function swayCurtains(world, curtains) {
  world.onUpdate((dt, time) => {
    const gust = 1 - GUST_DEPTH + GUST_DEPTH * Math.sin(time * GUST_SPEED);
    curtains.forEach((curtain, index) => {
      const phase = time * CURTAIN_SPEED + index * CURTAIN_OFFSET;
      // 绕 x 转负的角度，下摆才往屋里（+z）飘；只往屋里飘，不往墙里戳
      curtain.rotation.x = -(0.5 + 0.5 * Math.sin(phase)) * CURTAIN_SWAY * gust;
    });
  });
}

/**
 * 茶壶嘴隔一会儿冒一团热气，往上飘着散开
 * @param {World} world
 * @param {THREE.Object3D} spout
 * @param {{ emit: Function }} puffs
 */
function steamTea(world, spout, puffs) {
  // 搭场景时方块还没开始动，这时候算出来的位置就是方块里的位置
  spout.updateWorldMatrix(true, false);
  const tip = new THREE.Vector3(0, SPOUT_TIP, 0).applyMatrix4(spout.matrixWorld);
  let wait = 0;

  world.onUpdate((dt) => {
    wait -= dt;
    if (wait > 0) {
      return;
    }
    wait = STEAM_GAP * (0.7 + Math.random() * 0.6);
    puffs.emit(tip, STEAM);
  });
}

/**
 * 收音机隔一会儿飘出一个彩色音符，晃着往上飘，慢慢变淡
 * @param {World} world
 * @param {THREE.Object3D} radio
 */
function playRadio(world, radio) {
  radio.updateWorldMatrix(true, false);
  const start = new THREE.Vector3(0, NOTE_START_HEIGHT, 0).applyMatrix4(radio.matrixWorld);
  const textures = NOTE_GLYPHS.map((glyph) => world.texture(noteTexture(glyph)));
  const notes = [];
  let wait = NOTE_GAP / 2;
  let count = 0;

  world.onUpdate((dt) => {
    wait -= dt;
    if (wait <= 0) {
      wait = NOTE_GAP * (0.8 + Math.random() * 0.4);
      const material = new THREE.SpriteMaterial({ map: textures[count % textures.length], color: NOTE_COLORS[count % NOTE_COLORS.length], transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(NOTE_SIZE);
      world.add(sprite, start.x, start.y, start.z);
      notes.push({ sprite, age: 0, phase: Math.random() * Math.PI * 2 });
      count++;
    }

    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      note.age += dt;
      const progress = note.age / NOTE_LIFE;
      if (progress >= 1) {
        note.sprite.removeFromParent();
        note.sprite.material.dispose();
        notes.splice(i, 1);
        continue;
      }
      note.sprite.position.y = start.y + progress * NOTE_RISE;
      note.sprite.position.x = start.x + Math.sin(note.phase + progress * Math.PI * 2) * NOTE_SWAY;
      note.sprite.material.opacity = Math.sin(progress * Math.PI);
    }
  });
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
