// 右前的池塘：荷叶、池边的芦苇和石头；右边台地上一眼小泉水，从崖顶流下来一道像素瀑布
// 只搭出来，瀑布怎么流、水花怎么溅在 water.js
import * as THREE from 'three';
import { canvasTexture, rng } from '../../kit.js';
import { lilyPad, reeds, rock } from './models.js';
import { LILY_PADS, REEDS, POND_ROCKS, WATERFALL, FISHING_SPOT } from './layout.js';

// 荷叶浮在水面上多高；大一点的荷叶开花
const PAD_LIFT = 0.012;
const PAD_FLOWER_SIZE = 0.9;
// 瀑布：水帘贴在崖面前面多远；崖顶上那眼泉水往台地里伸多深；泉水两边的石头离水多远、多大
const SHEET_OUT = 0.02;
const SPRING_DEPTH = 0.34;
const SPRING_ROCK_GAP = 0.14;
const SPRING_ROCK_SIZE = 0.75;
// 泉水那一块挡着不让人走进水里（人离崖边本来就要 0.22）
const SPRING_BLOCK_DEPTH = 0.4;
// 水帘的像素贴图：几个像素宽、几个像素高，铺在多大一块上（单位），几种蓝
const SHEET_PX = [8, 16];
const SHEET_TILE = [1, 2];
const SHEET_COLORS = ['#58bdf0', '#7fd0f7', '#a9e6ff', '#ffffff'];
const SHEET_OPACITY = 0.88;
// 瀑布脚下翻起来的白沫：几块，多大
const FOAM_BLOCKS = 5;
const FOAM_SIZE = 0.12;
// 泡在水里的石头埋进水面下多深
const ROCK_SINK = 0.05;
// 每片荷叶、每块石头转一个不同的角度（黄金角），看起来不像复制出来的
const GOLDEN_ANGLE = 2.39996;
const REED_SEED = 83;
const ROCK_SEED = 91;
const FISHING_STAY = 10;

/**
 * 搭池塘
 * @param {World} world 像素小镇
 * @param {{ waterSurface: number, waterPatch: Function }} ground 地面
 * @returns {{ pads: THREE.Group[], reeds: THREE.Group[], waterfall: { texture: THREE.Texture, foam: THREE.Mesh[], baseX: number, baseZ: number } }}
 */
export function buildPond(world, ground) {
  const pads = LILY_PADS.map(([x, z, size], index) => {
    const pad = lilyPad(world.kit, size, size >= PAD_FLOWER_SIZE);
    world.add(pad, x, ground.waterSurface + PAD_LIFT, z, index * GOLDEN_ANGLE);
    return pad;
  });

  const random = rng(REED_SEED);
  const reedClumps = REEDS.map(([x, z]) => world.add(reeds(world.kit, random), x, world.heightAt(x, z), z));
  POND_ROCKS.forEach(([x, z, size], index) => {
    // 泡在水里的石头从水面下一点长出来，不是从水底
    const y = Math.max(world.heightAt(x, z), ground.waterSurface - ROCK_SINK);
    world.add(rock(world.kit, size, ROCK_SEED + index), x, y, z, index * GOLDEN_ANGLE);
  });

  const waterfall = buildWaterfall(world, ground);
  world.poi(FISHING_SPOT.x, FISHING_SPOT.z, { emote: '🎣', face: FISHING_SPOT.face, dur: FISHING_STAY });
  return { pads, reeds: reedClumps, waterfall };
}

/**
 * 瀑布：崖顶一眼泉水（两边压着石头），一道像素水帘从崖顶挂到水面，脚下几块翻腾的白沫
 * @param {World} world
 * @param {{ waterSurface: number, waterPatch: Function }} ground
 * @returns {{ texture: THREE.Texture, foam: THREE.Mesh[], baseX: number, baseZ: number }} 水帘的贴图（往下流）、白沫、瀑布脚下在哪
 */
function buildWaterfall(world, ground) {
  const { z, fromX, toX } = WATERFALL;
  const centerX = (fromX + toX) / 2;
  const width = toX - fromX;
  const top = world.heightAt(centerX, z - SPRING_DEPTH);
  const height = top - ground.waterSurface;

  const spring = ground.waterPatch(width, SPRING_DEPTH);
  world.add(spring, centerX, top + 0.01, z - SPRING_DEPTH / 2);
  for (const side of [-1, 1]) {
    const x = centerX + side * (width / 2 + SPRING_ROCK_GAP);
    world.add(rock(world.kit, SPRING_ROCK_SIZE, ROCK_SEED + side), x, top, z - SPRING_DEPTH / 2, side * GOLDEN_ANGLE);
  }
  world.solidBox(fromX, toX, z - SPRING_BLOCK_DEPTH, z);

  const texture = world.texture(sheetTexture());
  texture.repeat.set(width / SHEET_TILE[0], height / SHEET_TILE[1]);
  const material = new THREE.MeshLambertMaterial({ map: texture, transparent: true, opacity: SHEET_OPACITY, depthWrite: false });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  sheet.position.set(centerX, ground.waterSurface + height / 2, z + SHEET_OUT);
  world.root.add(sheet);

  const foam = [];
  for (let i = 0; i < FOAM_BLOCKS; i++) {
    const block = world.kit.box(FOAM_SIZE, FOAM_SIZE, FOAM_SIZE, '#ffffff');
    block.castShadow = false;
    block.position.set(fromX + (width / (FOAM_BLOCKS - 1)) * i, ground.waterSurface, z + FOAM_SIZE);
    world.root.add(block);
    foam.push(block);
  }
  return { texture, foam, baseX: centerX, baseZ: z + FOAM_SIZE * 2 };
}

/**
 * 水帘的像素贴图：一条条竖着的深浅蓝，夹几道白，往下挪就是在流
 * @returns {THREE.CanvasTexture}
 */
function sheetTexture() {
  const random = rng(ROCK_SEED);
  const [width, height] = SHEET_PX;
  return canvasTexture(
    width,
    height,
    (context) => {
      for (let x = 0; x < width; x++) {
        context.fillStyle = SHEET_COLORS[x % 2];
        context.fillRect(x, 0, 1, height);
        // 每一列上几道亮的竖条，长短不一
        const streaks = 2;
        for (let i = 0; i < streaks; i++) {
          context.fillStyle = SHEET_COLORS[2 + Math.floor(random() * 2)];
          context.fillRect(x, Math.floor(random() * height), 1, 2 + Math.floor(random() * 4));
        }
      }
    },
    { pixel: true, repeat: [1, 1] },
  );
}
