// 后排：大楼、公寓、便利店、BAR、售货机，和大楼与便利店中间的小巷
// 都是停电的样子搭起来，再登记到电力上，来电以后自己一点点亮
import * as THREE from 'three';
import { at } from '../../kit.js';
import { glow, neonText } from '../../fx.js';
import { ramp } from './power.js';
import { building, convenienceStore, vendingMachine, stool, waterTank, verticalSign, doorPlate } from './models.js';
import { TOWER, TOWER_FRONT, APARTMENT, STORE, BAR, BAR_FRONT, VENDING, STOOL, ALLEY } from './layout.js';

export function buildBackRow(w, power) {
  apartment(w, power);
  return {
    tower: tower(w, power),
    bar: bar(w, power),
    vending: shops(w, power),
    alley: alley(w, power),
  };
}

function placeBuilding(w, { x, z, size }, look) {
  const b = building(w, { size, ...look });
  w.add(b.group, x, w.heightAt(x, z), z);
  w.solid(b.body);
  return b;
}

// 会玩俄罗斯方块的大楼：楼顶天线一闪一闪，正面挂着竖的“夜猫”招牌
function tower(w, power) {
  const k = w.kit;
  const b = placeBuilding(w, TOWER, { wall: '#5b6285', frame: '#3e4463', dark: '#2a2f4a', lit: '#ffe39a', ratio: 0.55, seed: 3, roof: '#3e4463' });
  power.windows(b.windows, 0.3);

  const top = TOWER.size[1];
  const ax = TOWER.x - 0.2;
  const az = TOWER.z;
  w.add(k.cyl(0.03, 0.03, 0.9, '#9a9db0', 6), ax, top + 0.5, az);
  const beacon = k.sphere(0.07, '#ff3b3b', 10, { emissive: '#ff2020', emissiveIntensity: 2 });
  w.add(beacon, ax, top + 0.98, az);
  const beaconGlow = glow('#ff4040', 0.9, 0.8);
  w.add(beaconGlow, ax, top + 0.98, az);
  power.show(({ city }, t) => {
    beacon.visible = beaconGlow.visible = city > 0.6 && Math.sin(t * 3) > 0.3;
  });

  const sx = TOWER.x + TOWER.size[0] / 2 - 0.22;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.3), new THREE.MeshBasicMaterial({ map: w.texture(verticalSign('夜猫', '#4ff0ff')), transparent: true }));
  w.add(sign, sx, 3.0, TOWER_FRONT + 0.01);
  const signGlow = glow('#4ff0ff', 2.2, 0.35);
  w.add(signGlow, sx, 3.0, TOWER_FRONT + 0.2);
  power.neon(sign.material, signGlow, { op: 0.35, a: 0.5 });

  // front：正面那面墙（俄罗斯方块就贴在这上面）；sign：玩的时候要藏起来的招牌
  return { body: b.body, front: b.windows[0], sign: [sign, signGlow] };
}

// 左边的公寓：只是凑一条街的热闹，来电后最后几个亮
function apartment(w, power) {
  const b = placeBuilding(w, APARTMENT, { wall: '#4f6a7a', frame: '#37505e', dark: '#24323d', lit: '#ffd9a0', ratio: 0.5, seed: 21, roof: '#37505e' });
  power.windows(b.windows, 0.45);
}

// BAR：楼顶水塔，门口霓虹招牌和 CLOSED 牌子，乐手的凳子
function bar(w, power) {
  const k = w.kit;
  const b = placeBuilding(w, BAR, { wall: '#7a5f6e', frame: '#5a4352', dark: '#2e2533', lit: '#ffc48a', ratio: 0.6, seed: 9, roof: '#4a3a44' });
  power.windows(b.windows, 0);
  w.add(waterTank(k), BAR.x + 0.3, BAR.size[1] + 0.06, BAR.z - 0.3);

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.36), new THREE.MeshBasicMaterial({ map: w.texture(neonText('BAR', { color: '#ff5fa2', bg: 'rgba(20,8,30,0.85)' })), transparent: true }));
  w.add(sign, BAR.x, 1.0, BAR_FRONT + 0.01);
  const signGlow = glow('#ff5fa2', 1.8, 0.45);
  w.add(signGlow, BAR.x, 1.0, BAR_FRONT + 0.2);
  power.neon(sign.material, signGlow, { op: 0.45, a: 0, flicker: true });

  const closedTex = w.texture(doorPlate('CLOSED', '#c8343a'));
  const openTex = w.texture(doorPlate('OPEN', '#2f9a5a'));
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.16), new THREE.MeshBasicMaterial({ map: closedTex }));
  w.add(plate, BAR.x, 0.62, BAR_FRONT + 0.02);

  w.add(stool(k), STOOL[0], w.heightAt(...STOOL), STOOL[1]);
  return {
    open() {
      plate.material.map = openTex;
    },
  };
}

// 便利店和旁边的售货机：门面、招牌、面板跟着城市电力亮。返回售货机（要能点）
function shops(w, power) {
  const [x, z] = STORE;
  const store = convenienceStore(w);
  w.add(store.group, x, 0, z);
  w.solid(store.group);
  const frontZ = z + 1.0;
  const storeGlow = glow('#fff1c4', 3.2, 0.35);
  w.add(storeGlow, x, 0.7, frontZ + 0.3);
  const storeLight = new THREE.PointLight('#fff1c4', 4, 4.5, 1.5);
  w.add(storeLight, x, 0.9, frontZ + 0.5);
  power.neon(store.sign.material, storeGlow, { op: 0.35, a: 0.2 });
  w.poi(x, frontZ + 0.6, { emote: '🍙', face: Math.PI, dur: 6 });

  const [vx, vz] = VENDING;
  const vm = vendingMachine(w);
  w.add(vm.group, vx, 0, vz);
  w.solid(vm.group);
  const vmGlow = glow('#cfe8ff', 1.6, 0.35);
  w.add(vmGlow, vx, 0.95, vz + 0.45);
  w.poi(vx, vz + 0.8, { emote: '🥤', face: Math.PI, dur: 5 });

  const frontOn = store.front.material.color.clone();
  const frontOff = new THREE.Color('#2a2c38');
  power.show(({ city }) => {
    const shop = ramp(0.2, 0.6, city);
    store.front.material.emissiveIntensity = 0.05 + 1.05 * shop;
    store.front.material.color.copy(frontOff).lerp(frontOn, shop);
    storeLight.intensity = 4 * shop;
    vm.panel.material.color.setScalar(0.15 + 0.85 * shop);
    vm.panel.material.emissiveIntensity = 0.05 + 0.85 * shop;
    vmGlow.material.opacity = 0.35 * shop;
  });
  return vm.group;
}

// 小巷：停电时黑漆漆的，进不去；月光照进来才看得见
function alley(w, power) {
  const dark = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.6, 2.3), new THREE.MeshBasicMaterial({ color: '#04050d', transparent: true, opacity: 0.92, depthWrite: false }));
  w.add(dark, ALLEY.x, 1.3, ALLEY.z);
  const e = ALLEY.entry;
  const block = w.blocker(e.minX, e.maxX, e.minZ, e.maxZ, '🌑 小巷里黑漆漆的，什么也看不见……');
  const moonlight = glow('#cfd8ff', 1.6, 0);
  w.add(moonlight, ALLEY.x, 0.4, ALLEY.z - 0.15);
  power.show(({ sky, city }) => {
    dark.material.opacity = 0.92 * (1 - sky);
    dark.visible = sky < 0.99;
    moonlight.material.opacity = 0.35 * sky * (1 - city * 0.5);
  });
  return { block };
}
