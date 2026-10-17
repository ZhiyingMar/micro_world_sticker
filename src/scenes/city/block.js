// 街区：一圈马路中间的那排楼：大楼、便利店、售货机、BAR，和大楼与便利店中间的小巷
// 都是停电的样子搭起来，再登记到电力上，来电以后自己一点点亮
import * as THREE from 'three';
import { at } from '../../kit.js';
import { glow, neonText } from '../../fx.js';
import { ramp } from './power.js';
import { building, convenienceStore, vendingMachine, stool, waterTank, verticalSign, doorPlate, chainFence, kitchenBin, trashBag, kitchenDoor } from './models.js';
import { TOWER, STORE, BAR, BLOCK_FRONT, VENDING, STOOL, ALLEY, KITCHEN_BINS, KITCHEN_DOOR_Z, NOOK_BIN } from './layout.js';

const DARK_ALLEY_SAY = '🌑 小巷里黑漆漆的，什么也看不见……';
const FENCE_SAY = '🕸️ 铁丝网挡着……对面看得见，可是过不去';
// 巷子两头黑着的时候挡住的那一段有多深
const ALLEY_MOUTH = 0.45;

/**
 * 搭街区
 * @param {World} world 夜都
 * @param {object} power 电力
 * @returns {{ tower, bar, vending, alley }} 别的模块要用的东西
 */
export function buildBlock(world, power) {
  return {
    tower: tower(world, power),
    bar: bar(world, power),
    vending: shops(world, power),
    alley: alley(world, power),
  };
}

/**
 * 摆一栋有窗户的楼，登记成障碍
 * @param {World} world
 * @param {{ x, z, size }} spot 位置和大小
 * @param {object} look 外立面的颜色、亮灯比例
 */
function placeBuilding(world, { x, z, size }, look) {
  const result = building(world, { size, ...look });
  world.add(result.group, x, world.heightAt(x, z), z);
  world.solid(result.body);
  return result;
}

/**
 * 把招牌、天线这些挂到楼上（跟着楼一起变半透明）
 * @param {{ group: THREE.Group }} result placeBuilding 返回的楼
 * @param {{ x: number, z: number }} spot 楼的位置
 * @param {THREE.Object3D} object 要挂上去的东西
 * @param {number} x 世界坐标
 * @param {number} y 世界坐标
 * @param {number} z 世界坐标
 */
function attach(result, spot, object, x, y, z) {
  result.group.add(at(object, x - spot.x, y, z - spot.z));
  return object;
}

/**
 * 会玩俄罗斯方块的大楼：楼顶天线一闪一闪，正面挂着竖的“夜猫”招牌
 * @param {World} world
 * @param {object} power
 * @returns {{ body, front, sign }} front 是正面那面墙（俄罗斯方块贴在上面），sign 是玩的时候要藏起来的招牌
 */
function tower(world, power) {
  const kit = world.kit;
  const result = placeBuilding(world, TOWER, { wall: '#5b6285', frame: '#3e4463', dark: '#2a2f4a', lit: '#ffe39a', ratio: 0.55, seed: 3, roof: '#3e4463' });
  power.windows(result.windows, 0.3);

  const top = TOWER.size[1];
  const antennaX = TOWER.x - 0.2;
  attach(result, TOWER, kit.cyl(0.03, 0.03, 0.9, '#9a9db0', 6), antennaX, top + 0.5, TOWER.z);
  const beacon = kit.sphere(0.07, '#ff3b3b', 10, { emissive: '#ff2020', emissiveIntensity: 2 });
  attach(result, TOWER, beacon, antennaX, top + 0.98, TOWER.z);
  const beaconGlow = glow('#ff4040', 0.9, 0.8);
  world.add(beaconGlow, antennaX, top + 0.98, TOWER.z);
  power.show(({ city }, time) => {
    const blink = Math.sin(time * 3) > 0.3;
    beacon.visible = city > 0.6 && blink;
    beaconGlow.visible = beacon.visible;
  });

  const signX = TOWER.x + TOWER.size[0] / 2 - 0.22;
  const signTexture = world.texture(verticalSign('夜猫', '#4ff0ff'));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.3), new THREE.MeshBasicMaterial({ map: signTexture, transparent: true }));
  attach(result, TOWER, sign, signX, 3.0, BLOCK_FRONT + 0.01);
  const signGlow = glow('#4ff0ff', 2.2, 0.35);
  world.add(signGlow, signX, 3.0, BLOCK_FRONT + 0.2);
  power.neon(sign.material, signGlow, { op: 0.35, a: 0.5 });
  world.fadeable(result.group);

  return { body: result.body, front: result.windows[0], sign: [sign, signGlow] };
}

/**
 * BAR：楼顶水塔，门口霓虹招牌和 CLOSED 牌子，乐手的凳子
 * @param {World} world
 * @param {object} power
 * @returns {{ open() }} 萨克斯响起来时把牌子翻成 OPEN
 */
function bar(world, power) {
  const kit = world.kit;
  const result = placeBuilding(world, BAR, { wall: '#7a5f6e', frame: '#5a4352', dark: '#2e2533', lit: '#ffc48a', ratio: 0.6, seed: 9, roof: '#4a3a44' });
  power.windows(result.windows, 0);
  attach(result, BAR, waterTank(kit), BAR.x + 0.3, BAR.size[1] + 0.06, BAR.z - 0.3);

  const signTexture = world.texture(neonText('BAR', { color: '#ff5fa2', bg: 'rgba(20,8,30,0.85)' }));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.36), new THREE.MeshBasicMaterial({ map: signTexture, transparent: true }));
  attach(result, BAR, sign, BAR.x, 1.0, BLOCK_FRONT + 0.01);
  const signGlow = glow('#ff5fa2', 1.8, 0.45);
  world.add(signGlow, BAR.x, 1.0, BLOCK_FRONT + 0.2);
  power.neon(sign.material, signGlow, { op: 0.45, a: 0, flicker: true });

  const closedTexture = world.texture(doorPlate('CLOSED', '#c8343a'));
  const openTexture = world.texture(doorPlate('OPEN', '#2f9a5a'));
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.16), new THREE.MeshBasicMaterial({ map: closedTexture }));
  attach(result, BAR, plate, BAR.x, 0.62, BLOCK_FRONT + 0.02);
  world.fadeable(result.group);

  world.add(stool(kit), STOOL[0], world.heightAt(...STOOL), STOOL[1]);

  return {
    open() {
      plate.material.map = openTexture;
    },
  };
}

/**
 * 便利店和售货机：门面、招牌、面板跟着城市电力亮
 * @param {World} world
 * @param {object} power
 * @returns {THREE.Group} 售货机（要能点）
 */
function shops(world, power) {
  const { x: storeX, z: storeZ, scale } = STORE;
  const store = convenienceStore(world);
  store.group.scale.set(scale, 1, scale);
  world.add(store.group, storeX, 0, storeZ);
  world.solid(store.group);
  world.fadeable(store.group);

  const storeGlow = glow('#fff1c4', 3.2, 0.35);
  world.add(storeGlow, storeX, 0.7, BLOCK_FRONT + 0.3);
  const storeLight = new THREE.PointLight('#fff1c4', 4, 4.5, 1.5);
  world.add(storeLight, storeX, 0.9, BLOCK_FRONT + 0.5);
  power.neon(store.sign.material, storeGlow, { op: 0.35, a: 0.2 });
  world.poi(storeX - 0.4, BLOCK_FRONT + 0.6, { emote: '🍙', face: Math.PI, dur: 6 });

  const [vendingX, vendingZ] = VENDING;
  const machine = vendingMachine(world);
  world.add(machine.group, vendingX, 0, vendingZ);
  world.solid(machine.group);
  const machineGlow = glow('#cfe8ff', 1.6, 0.35);
  world.add(machineGlow, vendingX, 0.95, vendingZ + 0.45);
  world.poi(vendingX, vendingZ + 0.55, { emote: '🥤', face: Math.PI, dur: 5 });

  const frontOn = store.front.material.color.clone();
  const frontOff = new THREE.Color('#2a2c38');
  power.show(({ city }) => {
    const shop = ramp(0.2, 0.6, city);
    store.front.material.emissiveIntensity = 0.05 + 1.05 * shop;
    store.front.material.color.copy(frontOff).lerp(frontOn, shop);
    storeLight.intensity = 4 * shop;
    machine.panel.material.color.setScalar(0.15 + 0.85 * shop);
    machine.panel.material.emissiveIntensity = 0.05 + 0.85 * shop;
    machineGlow.material.opacity = 0.35 * shop;
  });

  // 售货机后面那条缝，最里面一个垃圾桶
  placeBin(world, 'nook', NOOK_BIN, { tags: ['bin', 'kitchen'] });

  return machine.group;
}

/**
 * 摆一个能翻的小垃圾桶
 * @param {World} world
 * @param {string} id 翻找点的名字
 * @param {number[]} spot 位置 [x, z]
 * @param {{ tags: string[], when?: Function }} options 标签；when 返回 false 时先不能翻
 */
function placeBin(world, id, [x, z], { tags, when }) {
  const bin = kitchenBin(world.kit);
  world.add(bin, x, world.heightAt(x, z), z, Math.PI / 2);
  world.solid(bin);
  world.hideout(id, bin, x, z, { tags, name: '垃圾桶', icon: '🗑️', when });
}

/**
 * 小巷：穿过整个街区，中间一道铁丝网
 * @description 便利店后厨扔垃圾的地方。铁丝网两边都看得见对面，但过不去，要绕到街区另一面才进得了另一半。
 *   停电时整条巷子黑漆漆的，两头都进不去；月光照进来才看得见，垃圾桶也才能翻
 * @param {World} world
 * @param {object} power
 * @returns {{ open() }} 月亮挂回去时调用，两头都能进了
 */
function alley(world, power) {
  const half = ALLEY.width / 2;
  const left = ALLEY.x - half;
  const right = ALLEY.x + half;
  const depth = ALLEY.front - ALLEY.back;

  // 后厨：便利店后门开在铁丝网后面那一半，垃圾桶靠着大楼那面墙，旁边堆几袋垃圾
  // 巷子黑着的时候看不见，不能翻
  let lit = false;
  KITCHEN_BINS.forEach((spot, index) => {
    placeBin(world, `kitchen${index}`, spot, { tags: ['bin', 'kitchen'], when: () => lit });
    world.add(trashBag(world.kit), spot[0] + 0.05, 0, spot[1] + 0.32 * (index ? 1 : -1));
  });
  const door = kitchenDoor(world.kit);
  world.add(door.group, right - 0.02, 0, KITCHEN_DOOR_Z, Math.PI);

  // 铁丝网：一直挡着
  const fence = chainFence(world, ALLEY.width, 1.8);
  world.add(fence, ALLEY.x, 0, ALLEY.fenceZ);
  world.blocker(left, right, ALLEY.fenceZ - 0.05, ALLEY.fenceZ + 0.05, FENCE_SAY);

  // 停电时：黑漆漆的一团，两头挡住
  const darkMaterial = new THREE.MeshBasicMaterial({ color: '#04050d', transparent: true, opacity: 0.92, depthWrite: false });
  const dark = new THREE.Mesh(new THREE.BoxGeometry(ALLEY.width + 0.2, 2.6, depth + 0.1), darkMaterial);
  world.add(dark, ALLEY.x, 1.3, (ALLEY.front + ALLEY.back) / 2);
  const mouths = [
    world.blocker(left, right, ALLEY.front - ALLEY_MOUTH, ALLEY.front, DARK_ALLEY_SAY),
    world.blocker(left, right, ALLEY.back, ALLEY.back + ALLEY_MOUTH, DARK_ALLEY_SAY),
  ];

  // 月光：铁丝网两边各一团
  const moonlights = [ALLEY.fenceZ + depth / 4, ALLEY.fenceZ - depth / 4].map((z) => {
    const light = glow('#cfd8ff', 1.4, 0);
    world.add(light, ALLEY.x, 0.4, z);
    return light;
  });

  power.show(({ sky, city }) => {
    door.bulb.material.emissiveIntensity = 1.2 * ramp(0.2, 0.6, city);
    darkMaterial.opacity = 0.92 * (1 - sky);
    dark.visible = sky < 0.99;
    for (const light of moonlights) {
      light.material.opacity = 0.35 * sky * (1 - city * 0.5);
    }
  });

  return {
    open() {
      lit = true;
      mouths.forEach((collider) => world.unblock(collider));
    },
  };
}
