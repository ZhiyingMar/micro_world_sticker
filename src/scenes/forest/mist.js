// 魔法停了时森林里起雾：离镜头越远的林子越白（镜头的雾），林子里低低地飘着一团团雾气，背景也蒙上一层白
// 修好一处散一些，全修好就散干净；雾只是看的，不挡路，也点不到
import * as THREE from 'three';
import { softDotTexture } from '../../fx.js';
import { rng } from '../../kit.js';

// 雾的颜色：一点点偏绿的白，和林子、天接得上
const FOG_COLOR = '#eef2ee';
// 镜头的雾按离方块中心的远近算：比中心近这么多开始有雾，雾最浓时比中心远这么多就全白（雾淡了全白的地方往后推）
const FOG_START_BEFORE_CENTER = 5;
const FOG_FULL_BEHIND_CENTER = 10;
// 没雾时把雾推到这么远，等于没有（换掉 scene.fog 要重新编译所有材质，会卡一下）
const NO_FOG = 1e5;
// 背景上盖一层白，和雾接得上；雾最浓时盖多少
const SKY_TINT_STRENGTH = 0.6;
// 一团团雾气：几团、多大、离地多高；往 +x 飘多快（每秒多远），上下浮多少、多快；雾最浓时多不透明
const WISPS = 30;
const WISP_SIZE = [2.2, 4.0];
const WISP_HEIGHT = [0.25, 0.9];
const WISP_SPEED = [0.05, 0.12];
const WISP_BOB = 0.08;
const WISP_BOB_SPEED = 0.4;
const WISP_OPACITY = 0.45;
const WISP_SEED = 61;

/**
 * 让森林起雾
 * @param {World} world 童话森林
 * @returns {{ setThickness(level: number): void, readonly thickness: number }} 雾多浓（1 最浓，0 散干净了）
 */
export function createMist(world) {
  const fog = new THREE.Fog(FOG_COLOR, NO_FOG, NO_FOG);
  world.fog = fog;
  const wisps = driftingWisps(world);
  let thickness = 0;

  const center = new THREE.Vector3();
  world.onUpdate(() => {
    const camera = world.env.camera;
    if (!camera || thickness <= 0) {
      return;
    }
    // 方块中心离镜头多远（沿着镜头看的方向）
    center.setFromMatrixPosition(world.root.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    const centerDepth = -center.z;
    fog.near = centerDepth - FOG_START_BEFORE_CENTER;
    fog.far = centerDepth + FOG_FULL_BEHIND_CENTER / thickness;
  });

  return {
    setThickness(level) {
      thickness = THREE.MathUtils.clamp(level, 0, 1);
      if (thickness <= 0) {
        fog.near = NO_FOG;
        fog.far = NO_FOG;
      }
      wisps.setOpacity(WISP_OPACITY * thickness);
      world.setSkyTint(thickness > 0 ? { color: FOG_COLOR, strength: SKY_TINT_STRENGTH * thickness } : null);
    },
    get thickness() {
      return thickness;
    },
  };
}

/**
 * 林子里低低飘着的一团团雾气：往一边慢慢飘，飘出方块从另一边回来，上下轻轻浮
 * @param {World} world
 * @returns {{ setOpacity(opacity: number): void }}
 */
function driftingWisps(world) {
  const random = rng(WISP_SEED);
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const width = maxX - minX;
  const material = new THREE.SpriteMaterial({ map: softDotTexture(), color: FOG_COLOR, transparent: true, opacity: 0, depthWrite: false });

  const wisps = Array.from({ length: WISPS }, () => {
    const sprite = new THREE.Sprite(material);
    const size = WISP_SIZE[0] + random() * (WISP_SIZE[1] - WISP_SIZE[0]);
    sprite.scale.set(size, size * 0.5, 1);
    world.root.add(sprite);
    return {
      sprite,
      x: minX + random() * width,
      z: minZ + random() * (maxZ - minZ),
      lift: WISP_HEIGHT[0] + random() * (WISP_HEIGHT[1] - WISP_HEIGHT[0]),
      speed: WISP_SPEED[0] + random() * (WISP_SPEED[1] - WISP_SPEED[0]),
      phase: random() * Math.PI * 2,
    };
  });

  world.onUpdate((dt, time) => {
    if (material.opacity <= 0) {
      return;
    }
    for (const wisp of wisps) {
      wisp.x += wisp.speed * dt;
      if (wisp.x > maxX) {
        wisp.x -= width;
      }
      const bob = Math.sin(time * WISP_BOB_SPEED + wisp.phase) * WISP_BOB;
      wisp.sprite.position.set(wisp.x, world.heightAt(wisp.x, wisp.z) + wisp.lift + bob, wisp.z);
    }
  });

  return {
    setOpacity(opacity) {
      material.opacity = opacity;
      for (const wisp of wisps) {
        wisp.sprite.visible = opacity > 0;
      }
    },
  };
}
