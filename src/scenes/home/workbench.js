// 工作台：靠左墙，走过去按 E 打开装修面板，用各个世界捡来的材料做壁纸、地板
import * as THREE from 'three';
import { at } from '../../kit.js';
import { chooseDecor } from '../../decor.js';
import { WOOD, WOOD_DARK } from './furniture.js';
import { WORKBENCH, WORKBENCH_SIZE, WORKBENCH_REACH } from './layout.js';

/**
 * 工作台的模型：木台面、下层隔板，台上一卷壁纸、一叠地砖和一把锤子，墙上挂一块洞洞板
 * @description 原点在台子底面中心，台面朝 +z
 * @param {Kit} kit 造型工具箱
 * @returns {THREE.Group}
 */
function buildWorkbench(kit) {
  const { length, depth, height } = WORKBENCH_SIZE;
  const topThickness = 0.08;
  const legSize = 0.08;
  const legInsetX = length / 2 - legSize;
  const legInsetZ = depth / 2 - legSize;
  const bench = new THREE.Group();

  // 台面 + 四条腿 + 下层隔板
  bench.add(at(kit.box(length, topThickness, depth, WOOD, 0.03), 0, height - topThickness / 2, 0));
  for (const [x, z] of [[-legInsetX, -legInsetZ], [legInsetX, -legInsetZ], [-legInsetX, legInsetZ], [legInsetX, legInsetZ]]) {
    bench.add(at(kit.box(legSize, height - topThickness, legSize, WOOD_DARK, 0.02), x, (height - topThickness) / 2, z));
  }
  bench.add(at(kit.box(length - legSize, 0.04, depth - legSize, WOOD_DARK, 0.01), 0, 0.22, 0));

  // 下层放着两个等着用的瓶子
  bench.add(at(kit.cyl(0.05, 0.05, 0.2, '#9fd8f0', 12), -0.3, 0.34, 0.05));
  bench.add(at(kit.cyl(0.05, 0.06, 0.24, '#7cc59a', 12), -0.15, 0.36, -0.05));

  // 台上：一卷壁纸（横放，拉出来一截）、一叠地砖、一把锤子
  const roll = kit.cyl(0.08, 0.08, 0.5, '#f6a6b8', 16);
  roll.rotation.z = Math.PI / 2;
  bench.add(at(roll, -0.25, height + 0.08, -0.08));
  bench.add(at(kit.box(0.4, 0.01, 0.22, '#fbe1e6', 0.004), -0.25, height + 0.005, 0.12));
  for (let i = 0; i < 3; i++) {
    const tileColor = ['#a8dff5', '#f7f4ec', '#c48a54'][i];
    bench.add(at(kit.box(0.24, 0.035, 0.24, tileColor, 0.01), 0.3, height + 0.02 + i * 0.037, 0.02));
  }
  const hammer = new THREE.Group();
  hammer.add(kit.box(0.04, 0.04, 0.28, WOOD_DARK, 0.015));
  hammer.add(at(kit.box(0.14, 0.06, 0.06, '#8a8f99', 0.015), 0, 0, -0.14));
  hammer.rotation.y = 0.5;
  bench.add(at(hammer, 0.05, height + 0.02, 0.1));

  // 墙上的洞洞板，挂着尺子和剪刀
  const boardZ = -depth / 2 + 0.03;
  bench.add(at(kit.box(length, 0.75, 0.04, '#e7c9a0', 0.02), 0, height + 0.75, boardZ));
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 6; column++) {
      bench.add(at(kit.cyl(0.015, 0.015, 0.01, '#b08a60', 6), -0.45 + column * 0.18, height + 0.5 + row * 0.25, boardZ + 0.025));
    }
  }
  const ruler = kit.box(0.05, 0.5, 0.015, '#ffd84a', 0.005);
  ruler.rotation.z = 0.15;
  bench.add(at(ruler, -0.3, height + 0.75, boardZ + 0.04));
  for (const side of [-1, 1]) {
    const handle = kit.torus(0.05, 0.015, '#e85d5d');
    bench.add(at(handle, 0.25 + side * 0.06, height + 0.62, boardZ + 0.04));
  }
  bench.add(at(kit.box(0.03, 0.22, 0.015, '#c0c4cc', 0.005), 0.25, height + 0.8, boardZ + 0.04));

  return bench;
}

/**
 * 在小屋里摆上工作台，走过去按 E 打开装修面板
 * @description 在各个世界捡来的材料，回家在这里做成壁纸、地板
 * @param {World} w 小屋这个世界
 * @param {{ applyDecor(kind: string, entry: object): void }} room buildRoom 返回的换装修接口
 * @returns {THREE.Group} 工作台（撞上去会晃一下）
 */
export function placeWorkbench(w, room) {
  const bench = buildWorkbench(w.kit);
  w.add(bench, WORKBENCH.x, w.heightAt(WORKBENCH.x, WORKBENCH.z), WORKBENCH.z, WORKBENCH.facing);
  w.solid(bench);

  // 人站在台面前面用；台面朝向就是 facing
  const standDistance = WORKBENCH_SIZE.depth / 2 + 0.5;
  const standX = WORKBENCH.x + Math.sin(WORKBENCH.facing) * standDistance;
  const standZ = WORKBENCH.z + Math.cos(WORKBENCH.facing) * standDistance;

  /**
   * 面板上选了一款：做出来（或直接换上），小屋马上变样
   * @param {'wallpaper' | 'floor'} kind 哪一类
   * @param {object} entry 装修目录里的一款
   * @returns {'switched' | 'crafted' | 'short'} chooseDecor 的结果
   */
  const pick = (kind, entry) => {
    const result = chooseDecor(kind, entry);
    if (result !== 'short') {
      room.applyDecor(kind, entry);
    }
    return result;
  };

  w.interact('workbench', bench, standX, standZ, {
    reach: WORKBENCH_REACH,
    icon: '🔨',
    short: '工作台',
    label: '用工作台换壁纸、地板',
    fn: () => w.env.openWorkbench(pick),
  });
  return bench;
}
