// 小屋的一天：按钟点换光、背景色、星星
// 光照着下面一张"关键时刻表"走，两个时刻之间平滑过渡，不会一档一档地跳
// 太阳的路线：早上从屋子右边（东，没有墙）斜照进来铺满地板；下午转到左前方，就是原来那种午后光；
// 傍晚落到左墙那边，左墙的影子一点点拉长盖过地板，屋里慢慢暗下来；夜里换成又冷又弱的月光
import * as THREE from 'three';
import { createDisplayClock } from '../../daytime.js';

// 一天里几个关键时刻的样子，按钟点排；最后一个绕过半夜接回第一个
//   sky / ground / skyLight：天光（半球光）上面、下面的颜色，多亮
//   sun / sunLight：太阳（夜里是月亮）的颜色，多亮
//   bearing：太阳从哪边照过来（度）：0 东（屋子右边 +x），90 南（屋前、镜头这边 +z），180 西（左墙那边 -x）
//   elevation：太阳离地平线多高（度）。最低压在 14° 左右：再低影子拉得太长，阴影边上会出毛刺
//   tint / tintStrength：方块外面背景上盖的那层颜色，多浓（0 是不盖，露出壁纸配的底色）
//   night：夜有多深（0 白天 ~ 1 深夜），星星跟着它
const KEYFRAMES = [
  // 深夜：天光是深蓝，月光从右前方高处淡淡地照下来
  { hour: 0, sky: '#4a5aa8', ground: '#2c2846', skyLight: 1.0, sun: '#a8bcff', sunLight: 0.55, bearing: 60, elevation: 50, tint: '#10142e', tintStrength: 0.85, night: 1 },
  { hour: 4.5, sky: '#4a5aa8', ground: '#2c2846', skyLight: 1.0, sun: '#a8bcff', sunLight: 0.55, bearing: 60, elevation: 50, tint: '#10142e', tintStrength: 0.85, night: 1 },
  // 天快亮：月亮落下去、太阳还没出来，平行光几乎没有，趁这时换方向
  { hour: 5.5, sky: '#8a86c0', ground: '#4a3c56', skyLight: 1.05, sun: '#ff9f8a', sunLight: 0.15, bearing: 15, elevation: 14, tint: '#3c3a7a', tintStrength: 0.6, night: 0.6 },
  // 日出：粉橙色的光从右边低低地铺进屋里
  { hour: 6.5, sky: '#f2c6d6', ground: '#b4887a', skyLight: 1.25, sun: '#ffb07a', sunLight: 1.6, bearing: 18, elevation: 16, tint: '#ffa088', tintStrength: 0.35, night: 0 },
  { hour: 8, sky: '#e8eeff', ground: '#d2b08e', skyLight: 1.5, sun: '#ffe0b8', sunLight: 2.4, bearing: 40, elevation: 30, tint: '#ffd6a8', tintStrength: 0.1, night: 0 },
  { hour: 11, sky: '#eaf0ff', ground: '#d6b088', skyLight: 1.6, sun: '#fff0d8', sunLight: 2.7, bearing: 80, elevation: 50, tint: '#ffd6a8', tintStrength: 0, night: 0 },
  // 下午两点：就是原来那种午后光（左前方的暖光，影子往右后方拖）
  { hour: 14, sky: '#eaf0ff', ground: '#d6b088', skyLight: 1.6, sun: '#ffe2b3', sunLight: 2.7, bearing: 116.6, elevation: 50.9, tint: '#ffb070', tintStrength: 0, night: 0 },
  { hour: 16.5, sky: '#f0e8f0', ground: '#d8aa80', skyLight: 1.5, sun: '#ffcc8a', sunLight: 2.5, bearing: 140, elevation: 32, tint: '#ffb070', tintStrength: 0.12, night: 0 },
  // 日落：橙红的光从左边低低地照过来，左墙的影子盖过大半个屋子
  { hour: 18, sky: '#e8b4c4', ground: '#b07a64', skyLight: 1.2, sun: '#ff8f5a', sunLight: 1.9, bearing: 160, elevation: 15, tint: '#ff8866', tintStrength: 0.4, night: 0 },
  { hour: 19, sky: '#8274b4', ground: '#4a3a5a', skyLight: 1.05, sun: '#c27aa8', sunLight: 0.45, bearing: 165, elevation: 14, tint: '#4a3c86', tintStrength: 0.68, night: 0.6 },
  // 太阳落下去、月亮还没上来：平行光几乎没有，趁这时换方向
  { hour: 19.75, sky: '#5a62ac', ground: '#342e50', skyLight: 1.0, sun: '#a8bcff', sunLight: 0.08, bearing: 120, elevation: 30, tint: '#1c2050', tintStrength: 0.8, night: 0.9 },
  { hour: 20.5, sky: '#4a5aa8', ground: '#2c2846', skyLight: 1.0, sun: '#a8bcff', sunLight: 0.55, bearing: 60, elevation: 50, tint: '#10142e', tintStrength: 0.85, night: 1 },
];
const HOURS_PER_DAY = 24;
// 太阳离方块中心多远：要在阴影相机的范围里，和原来那盏午后的灯一样远
const SUN_DISTANCE = 14.2;
// 背景那层颜色是网页上的 CSS，改一次要重画整个背景：最多隔这么久（秒）改一次，变化小于这么多也不改
const TINT_INTERVAL = 0.2;
const TINT_STEP = 0.01;

// 关键时刻表里的颜色先转成 THREE.Color，每帧混色时不用再解析
const FRAMES = KEYFRAMES.map((frame) => ({
  ...frame,
  sky: new THREE.Color(frame.sky),
  ground: new THREE.Color(frame.ground),
  sun: new THREE.Color(frame.sun),
  tint: new THREE.Color(frame.tint),
}));

/**
 * 让小屋跟着钟点过一天
 * @param {World} world 小屋这个世界（灯在 world.env 里）
 * @param {object} parts 跟着钟点变的东西
 * @param {{ showNightSky(level: number): void }} parts.room 房间：天黑了外面的星星出来
 */
export function bringDayAndNight(world, { room }) {
  const { hemi, sun } = world.env;
  const clock = createDisplayClock();
  const day = blankFrame();
  const tint = { shownColor: null, shownStrength: -1, wait: 0 };

  const apply = (dt) => {
    const hour = clock.update(dt);
    sampleDay(hour, day);

    applyLights(day, hemi, sun);
    room.showNightSky(day.night);

    tint.wait -= dt;
    if (tint.wait <= 0) {
      tint.wait = TINT_INTERVAL;
      applySkyTint(world, day, tint);
    }
  };

  // 搭好就先按现在的钟点摆一次，第一帧就是对的光
  apply(0);
  world.onUpdate((dt) => apply(dt));
}

/**
 * 一份空的"这一刻的样子"，每帧往里面写，不用每帧新建
 * @returns {object}
 */
function blankFrame() {
  return {
    sky: new THREE.Color(),
    ground: new THREE.Color(),
    skyLight: 0,
    sun: new THREE.Color(),
    sunLight: 0,
    bearing: 0,
    elevation: 0,
    tint: new THREE.Color(),
    tintStrength: 0,
    night: 0,
  };
}

/**
 * 按钟点在关键时刻表里找前后两个时刻，混出这一刻的样子
 * @param {number} hour 0~24 之间的小时
 * @param {object} out 写进这里（blankFrame 的结果）
 */
function sampleDay(hour, out) {
  let nextIndex = FRAMES.findIndex((frame) => frame.hour > hour);
  if (nextIndex === -1) {
    nextIndex = 0;
  }
  const previous = FRAMES[(nextIndex - 1 + FRAMES.length) % FRAMES.length];
  const next = FRAMES[nextIndex];

  // 跨过半夜的那一段：后一个时刻算成第二天的
  const span = (next.hour - previous.hour + HOURS_PER_DAY) % HOURS_PER_DAY;
  const since = (hour - previous.hour + HOURS_PER_DAY) % HOURS_PER_DAY;
  const progress = span > 0 ? since / span : 0;
  // 两头慢中间快，经过关键时刻时看不出拐弯
  const blend = THREE.MathUtils.smoothstep(progress, 0, 1);

  out.sky.lerpColors(previous.sky, next.sky, blend);
  out.ground.lerpColors(previous.ground, next.ground, blend);
  out.sun.lerpColors(previous.sun, next.sun, blend);
  out.tint.lerpColors(previous.tint, next.tint, blend);
  for (const key of ['skyLight', 'sunLight', 'bearing', 'elevation', 'tintStrength', 'night']) {
    out[key] = THREE.MathUtils.lerp(previous[key], next[key], blend);
  }
}

/**
 * 把这一刻的天光、太阳设到灯上
 * @param {object} day sampleDay 混出来的样子
 * @param {THREE.HemisphereLight} hemi 天光
 * @param {THREE.DirectionalLight} sun 太阳（夜里是月亮），照着方块中心
 */
function applyLights(day, hemi, sun) {
  hemi.color.copy(day.sky);
  hemi.groundColor.copy(day.ground);
  hemi.intensity = day.skyLight;

  sun.color.copy(day.sun);
  sun.intensity = day.sunLight;
  const bearing = THREE.MathUtils.degToRad(day.bearing);
  const elevation = THREE.MathUtils.degToRad(day.elevation);
  const across = Math.cos(elevation) * SUN_DISTANCE;
  sun.position.set(Math.cos(bearing) * across, Math.sin(elevation) * SUN_DISTANCE, Math.sin(bearing) * across);
}

/**
 * 背景上盖的那层颜色：变化够大才改
 * @param {World} world
 * @param {object} day sampleDay 混出来的样子
 * @param {{ shownColor: string | null, shownStrength: number }} shown 上一次设的颜色和浓度，改完写回去
 */
function applySkyTint(world, day, shown) {
  const color = `#${day.tint.getHexString()}`;
  const strength = Math.round(day.tintStrength * 100) / 100;
  const changed = color !== shown.shownColor || Math.abs(strength - shown.shownStrength) >= TINT_STEP;
  if (!changed) {
    return;
  }

  shown.shownColor = color;
  shown.shownStrength = strength;
  if (strength <= 0) {
    world.setSkyTint(null);
  } else {
    world.setSkyTint({ color, strength });
  }
}
