// 电力：三路，分别由三件东西点亮
//   sky    月亮挂回去：月光、星星，小巷看得见了
//   street 出租车带头、车流动起来：路灯
//   city   萨克斯响起来：窗户、霓虹招牌、便利店
// 这里只管把每一路的亮度慢慢调到目标；各处的灯自己用 show() 登记“亮度变了怎么显示”
import * as THREE from 'three';

// 亮度 v 在 from..to 之间平滑地从 0 变到 1：用来让东西一栋一栋、一盏一盏地亮
export const ramp = (from, to, v) => THREE.MathUtils.smoothstep(v, from, to);

// 夜都开了泛光：亮度超过 1 的东西才会往外晕开（见场景的 post.bloom.threshold）
// 霓虹全亮时的亮度，压过门面、窗户，只有招牌的字晕出光来
const NEON_PEAK = 1.6;
// 停电时霓虹灯管不是全黑，还能看出一点颜色
const NEON_OFF = 0.03;

export function createPower(w) {
  const lines = { sky: { v: 0, t: 0 }, street: { v: 0, t: 0 }, city: { v: 0, t: 0 } };
  const views = [];
  const { hemi, sun } = w.env;
  w.onUpdate((dt, t) => {
    for (const l of Object.values(lines)) l.v += (l.t - l.v) * Math.min(1, dt * 0.9);
    const lv = { sky: lines.sky.v, street: lines.street.v, city: lines.city.v };
    if (hemi) hemi.intensity = 0.35 + 0.4 * lv.sky + 0.25 * lv.city;
    if (sun) sun.intensity = 0.15 + 0.75 * lv.sky;
    for (const fn of views) fn(lv, t);
  });

  const power = {
    turnOn(key, instant = false) {
      lines[key].t = 1;
      if (instant) lines[key].v = 1;
    },
    level: (key) => lines[key].v,
    // fn({ sky, street, city }, t)：每帧调用
    show(fn) {
      views.push(fn);
    },
    // 一栋楼的窗户跟着城市电力，a 越大亮得越晚。灯是“啪”地一下亮的
    // 某面墙被借去放俄罗斯方块时（game = true）先不管它
    windows(list, a) {
      power.show(({ city }) => {
        const s = ramp(a, a + 0.4, city);
        for (const wm of list) {
          if (wm.game) continue;
          const f = s > 0.5 ? wm.on : wm.off;
          if (wm.mat.map !== f.map) {
            wm.mat.map = f.map;
            wm.mat.emissiveMap = f.emissive;
            wm.mat.needsUpdate = true;
          }
          wm.mat.emissiveIntensity = s;
        }
      });
    },
    // 霓虹招牌：mat 是招牌本身，halo 是它的光晕（最亮时透明度 op）；flicker 的偶尔闪一下
    neon(mat, halo, { op, a, flicker = false }) {
      power.show(({ city }, t) => {
        const flick = flicker && (Math.sin(t * 13) > 0.97 || (t % 7 > 6.6 && Math.sin(t * 40) > 0));
        const s = ramp(a, a + 0.4, city) * (flick ? 0.35 : 1);
        mat.color.setScalar(NEON_OFF + (NEON_PEAK - NEON_OFF) * s);
        halo.material.opacity = op * s;
      });
    },
  };
  return power;
}
