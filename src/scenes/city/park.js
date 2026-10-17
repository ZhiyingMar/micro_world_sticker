// 高处：马路对面坡上的小公园（一层高，左边土坡两层），和右后角的天台（一层、两层）
// 只是摆设和小人的去处；藏在这里的东西由 story.js 放
import { bench, darkTree, bush, telescope, planter } from './models.js';
import { PARK_BENCH, PARK_TREES, BUSHES, TELESCOPE, PLANTERS, MOON } from './layout.js';

export function buildPark(w) {
  const k = w.kit;
  const ground = (x, z) => w.heightAt(x, z);

  const [bx, bz] = PARK_BENCH;
  w.add(bench(k), bx, ground(bx, bz), bz);
  w.poi(bx - 0.3, bz, { emote: '🌙', face: Math.PI, dur: 9, sit: true, seatY: 0.45 });

  for (const [x, z, r] of PARK_TREES) {
    w.add(darkTree(k, r), x, ground(x, z), z);
    w.solidCircle(x, z, 0.18);
  }
  for (const [x, z, r] of BUSHES) {
    const b = bush(k, r);
    b.position.set(x, ground(x, z) + b.position.y, z);
    w.root.add(b);
  }

  // 天台：望远镜对着月亮，旁边几盆花
  const [tx, tz] = TELESCOPE;
  const scope = telescope(k);
  w.add(scope, tx, ground(tx, tz), tz, Math.atan2(tx - MOON[0], tz - MOON[2]));
  w.solidCircle(tx, tz, 0.12);
  w.poi(tx - 0.45, tz + 0.35, { emote: '🔭', face: Math.atan2(MOON[0] - tx, MOON[2] - tz), dur: 7 });
  for (const [x, z] of PLANTERS) {
    const p = planter(k);
    w.add(p, x, ground(x, z), z);
    w.solid(p);
  }
}
