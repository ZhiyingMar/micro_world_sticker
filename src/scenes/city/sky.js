// 夜空：星星，和便利店后面挂月亮的杆子。月亮跟着 sky 电力慢慢变大
import * as THREE from 'three';
import { rng } from '../../kit.js';
import { glow } from '../../fx.js';
import { MOON } from './layout.js';

export function buildSky(w, power) {
  const k = w.kit;
  const [mx, my, mz] = MOON;
  const poleH = my + 0.75;
  const poleZ = mz - 0.4;
  w.add(k.cyl(0.035, 0.045, poleH, '#3a3d4a', 8), mx, poleH / 2, poleZ);
  // 杆子太细不好点：套一个看不见的粗一点的点击范围
  const poleHit = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, poleH, 6), new THREE.MeshBasicMaterial({ visible: false }));
  poleHit.userData.pickable = true;
  w.add(poleHit, mx, poleH / 2, poleZ);
  // 横杆和吊线
  w.add(k.box(0.05, 0.05, 0.45, '#3a3d4a', 0.01), mx, my + 0.72, mz - 0.2);
  w.add(k.cyl(0.006, 0.006, 0.3, '#9a9db0', 4), mx, my + 0.57, mz);

  const moon = k.sphere(0.42, '#fff6d8', 24, { emissive: '#fff1c2', emissiveIntensity: 1.2 });
  moon.castShadow = false;
  w.add(moon, mx, my, mz);
  const moonGlow = glow('#cfd8ff', 3, 0.5);
  w.add(moonGlow, mx, my, mz);

  // 星星围着方块撒一圈，世界大了跟着往外放
  const r = rng(77);
  const n = 140;
  const inner = Math.max(...w.size) / 2;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const rad = inner + 2 + r() * 6;
    pos[i * 3] = Math.cos(a) * rad;
    pos[i * 3 + 1] = 3 + r() * 8;
    pos[i * 3 + 2] = Math.sin(a) * rad;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({ color: '#e8ecff', size: 0.07, transparent: true, opacity: 0.85, depthWrite: false });
  w.root.add(new THREE.Points(geo, starMat));

  power.show(({ sky }, t) => {
    moon.visible = moonGlow.visible = sky > 0.01;
    moon.scale.setScalar(Math.max(0.001, sky));
    moonGlow.material.opacity = 0.5 * sky;
    starMat.opacity = (0.25 + 0.75 * sky) * (0.65 + Math.sin(t * 1.7) * 0.2);
  });
}
