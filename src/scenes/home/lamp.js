// 落地灯的开关：天黑了自己"咔哒"一声亮起来，天亮了关掉
// 只管灯亮到几分、怎么亮起来；几点开几点关由 daylight.js 按钟点决定
import { sfx } from '../../audio.js';

// 全亮时：灯光多亮、照多远；灯泡、灯罩自己发光多亮。夜里它是屋里的主光，比原来白天那盏亮、照得远
const LAMP_ON = { light: 7, distance: 7.5, bulbGlow: 1.2, shadeGlow: 0.7 };
// 开灯：多久亮到全亮（秒），先闪一下再稳住，像老灯泡；关灯多久暗下去
const WARM_UP_SECONDS = 0.6;
// 闪一下：在开灯过程的哪一刻（0~1）、往下闪多少、闪多短（占开灯过程的比例）
const FLICKER = { at: 0.18, dip: 0.35, width: 0.08 };
const COOL_DOWN_SECONDS = 0.35;

/**
 * 给落地灯接上开关
 * @param {World} world 小屋这个世界
 * @param {{ light: THREE.PointLight, bulbMaterial: THREE.MeshStandardMaterial, shadeMaterial: THREE.MeshStandardMaterial }} lamp
 *   floorLamp() 造出来的灯光和材质
 * @returns {{ switchTo(on: boolean, instantly?: boolean): void }} 开 / 关；instantly 是一下到位、不出声（刚进屋时）
 */
export function wireLamp(world, lamp) {
  lamp.light.distance = LAMP_ON.distance;
  // 现在亮到几分（0~1）、要亮到几分；正在开或关时，按下开关以后过了几秒（没在变是 null）、从几分开始变
  let level = 0;
  let target = 0;
  let changeElapsed = null;
  let changeFrom = 0;

  const show = () => {
    lamp.light.intensity = LAMP_ON.light * level;
    lamp.bulbMaterial.emissiveIntensity = LAMP_ON.bulbGlow * level;
    lamp.shadeMaterial.emissiveIntensity = LAMP_ON.shadeGlow * level;
  };

  world.onUpdate((dt) => {
    if (changeElapsed === null) {
      return;
    }

    changeElapsed += dt;
    const elapsed = changeElapsed;
    const turningOn = target > changeFrom;
    const duration = turningOn ? WARM_UP_SECONDS : COOL_DOWN_SECONDS;
    if (elapsed >= duration) {
      level = target;
      changeElapsed = null;
    } else if (turningOn) {
      // 关到一半又开：从现在的亮度接着往上走
      level = changeFrom + (1 - changeFrom) * warmUp(elapsed / WARM_UP_SECONDS);
    } else {
      level = changeFrom * (1 - elapsed / COOL_DOWN_SECONDS);
    }
    show();
  });

  const switchTo = (on, instantly = false) => {
    const next = on ? 1 : 0;
    if (next === target) {
      return;
    }

    target = next;
    if (instantly) {
      level = target;
      changeElapsed = null;
      show();
      return;
    }
    changeFrom = level;
    changeElapsed = 0;
    sfx.lampClick(on);
  };

  show();
  return { switchTo };
}

/**
 * 开灯这一下亮到几分：先冲上去、闪暗一下，再稳稳地亮到全亮
 * @param {number} progress 开灯过程走到哪了（0~1）
 * @returns {number} 0~1
 */
function warmUp(progress) {
  // 一开始冲得快，后面慢慢稳住
  const rise = 1 - (1 - progress) ** 3;
  // 在 FLICKER.at 那一刻往下闪一下，前后很快恢复
  const nearFlicker = Math.max(0, 1 - Math.abs(progress - FLICKER.at) / FLICKER.width);
  return Math.max(0, rise - FLICKER.dip * nearFlicker);
}
