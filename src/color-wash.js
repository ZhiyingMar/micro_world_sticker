// 把一个世界的颜色抽掉一些：灰蒙蒙的，像褪了色；之后可以一点点还回来
// 原来的材质好几个世界一起用（按颜色共用），不能直接改：给世界里的东西换上一份复制的材质，画完颜色以后再往灰里拉
// 只是看的：不改模型、不改逻辑；颜色全还回来以后换回原来的材质，不多花一点力气
import * as THREE from 'three';

// 褪色时往哪种灰拉：一点点偏蓝的浅灰，像蒙了一层灰
const HAZE_COLOR = '#b9bdc6';
// 灰里面有几成是"蒙上的那层灰"，其余是"颜色变成黑白"（只变黑白会显得脏，蒙一层浅灰才是灰蒙蒙）
const HAZE_SHARE = 0.3;
// 亮度怎么算（人眼对绿最敏感）
const LUMA = '0.2126, 0.7152, 0.0722';

/**
 * 让世界里现在有的东西都能褪色
 * @description 只管调用时已经在世界里的东西；之后才放进来的（修好时放回去的东西、翻出来的材料）保持原色，
 *   在灰蒙蒙的世界里正好显眼。要一直保持原色的（物品）放进 keep
 * @param {World} world
 * @param {object} [options]
 * @param {THREE.Object3D[]} [options.keep] 不褪色的东西（连同下面的子物体）
 * @returns {{ setGrey(level: number): void, readonly grey: number }} 褪色褪到几成（0 原色，1 最灰）；回到 0 时换回原来的材质
 */
export function washOut(world, { keep = [] } = {}) {
  const uniforms = { uWashGrey: { value: 0 }, uWashHaze: { value: new THREE.Color(HAZE_COLOR) } };
  const swapped = swapMaterials(world.root, new Set(keep), uniforms);
  let washed = swapped.length > 0;

  const restore = () => {
    if (!washed) {
      return;
    }
    washed = false;
    const clones = new Set();
    for (const { mesh, original } of swapped) {
      clones.add(mesh.material);
      mesh.material = original;
    }
    for (const clone of clones) {
      disposeMaterial(clone);
    }
  };
  world.onDispose(restore);

  return {
    setGrey(level) {
      uniforms.uWashGrey.value = THREE.MathUtils.clamp(level, 0, 1);
      if (level <= 0) {
        restore();
      }
    },
    get grey() {
      return uniforms.uWashGrey.value;
    },
  };
}

/**
 * 把一棵树下面所有网格的材质换成会褪色的复制品
 * @param {THREE.Object3D} root 从哪儿开始找
 * @param {Set<THREE.Object3D>} keep 跳过这些（连同下面的子物体）
 * @param {object} uniforms 所有复制品共用的褪色参数
 * @returns {{ mesh: THREE.Mesh, original: THREE.Material | THREE.Material[] }[]} 换过的网格和它原来的材质
 */
function swapMaterials(root, keep, uniforms) {
  const clones = new Map();
  const swapped = [];
  const visit = (object) => {
    if (keep.has(object)) {
      return;
    }
    if (object.isMesh) {
      const original = object.material;
      const washable = Array.isArray(original) ? original.map((material) => washableCopy(material, clones, uniforms)) : washableCopy(original, clones, uniforms);
      if (washable !== original) {
        swapped.push({ mesh: object, original });
        object.material = washable;
      }
    }
    for (const child of object.children) {
      visit(child);
    }
  };
  visit(root);
  return swapped;
}

/**
 * 一个材质会褪色的复制品；同一个材质只复制一次，原来共用的还是共用
 * @param {THREE.Material} material 原来的材质
 * @param {Map<THREE.Material, THREE.Material>} clones 已经复制过的
 * @param {object} uniforms 褪色参数
 * @returns {THREE.Material} 复制品；改不了的（自己写着色器的材质）原样返回
 */
function washableCopy(material, clones, uniforms) {
  if (clones.has(material)) {
    return clones.get(material);
  }
  if (material.isShaderMaterial) {
    return material;
  }

  const copy = material.clone();
  copy.onBeforeCompile = (shader) => {
    shader.uniforms.uWashGrey = uniforms.uWashGrey;
    shader.uniforms.uWashHaze = uniforms.uWashHaze;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWashGrey;\nuniform vec3 uWashHaze;')
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        float washLuma = dot( gl_FragColor.rgb, vec3( ${LUMA} ) );
        vec3 washGrey = mix( vec3( washLuma ), uWashHaze, ${HAZE_SHARE.toFixed(3)} );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, washGrey, uWashGrey );`,
      );
  };
  // 和原来的材质用不同的着色器程序，不然 three.js 会拿缓存里没打补丁的那份
  copy.customProgramCacheKey = () => 'color-wash';
  clones.set(material, copy);
  return copy;
}

/**
 * 扔掉复制出来的材质（数组里的一个个扔）
 * @param {THREE.Material | THREE.Material[]} material
 */
function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach((each) => each.dispose());
    return;
  }
  material.dispose();
}
