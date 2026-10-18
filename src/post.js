// 后期处理：泛光（亮的东西往外晕开）和色调映射
// 只有场景里写了 post 的世界才走这条路，其他世界照旧直接画，样子一点不变
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 走后期时画面先画进一张贴图，画布自带的抗锯齿用不上了，贴图自己做 4 倍多重采样
const MSAA_SAMPLES = 4;
// 泛光在多小的分辨率上算：光晕本来就是糊的，算得粗一点看不出来，手机上省很多
const BLOOM_RESOLUTION_SCALE = 0.5;

const TONE_MAPPINGS = {
  neutral: THREE.NeutralToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
};

// 光晕叠回画面：颜色相加；透明度取光晕最亮的通道，这样光晕能晕到方块外面的背景上
const GLOW_OVER_ALPHA_SHADER = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    vec3 glowColor = texture2D(tDiffuse, vUv).rgb * opacity;
    float coverage = clamp(max(glowColor.r, max(glowColor.g, glowColor.b)), 0.0, 1.0);
    gl_FragColor = vec4(glowColor, coverage);
  }
`;

/**
 * 能画在透明画布上的泛光
 * @description 世界背后的渐变是网页 CSS 画的，画布得保持透明。three 自带的泛光叠回去时会把透明度写成 1，
 *   背景整个变黑。这里只换掉它最后“叠回画面”那一步，前面提亮、模糊都用原来的
 */
class TransparentBloomPass extends UnrealBloomPass {
  /**
   * @param {THREE.Vector2} resolution 画面大小（像素）
   * @param {number} strength 光晕强度
   * @param {number} radius 光晕扩散多远，0..1
   * @param {number} threshold 多亮才开始晕开（线性亮度）
   */
  constructor(resolution, strength, radius, threshold) {
    super(resolution, strength, radius, threshold);

    // copyUniforms 是父类给“叠回画面”那一步准备的 tDiffuse / opacity，父类每帧往里填光晕贴图
    const copyVertexShader = this.blendMaterial.vertexShader;
    this.blendMaterial.dispose();
    this.blendMaterial = new THREE.ShaderMaterial({
      uniforms: this.copyUniforms,
      vertexShader: copyVertexShader,
      fragmentShader: GLOW_OVER_ALPHA_SHADER,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.MaxEquation,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
  }

  /**
   * 跟着画面改大小，泛光按比例缩小了算
   * @param {number} width 画面宽（像素）
   * @param {number} height 画面高（像素）
   */
  setSize(width, height) {
    super.setSize(Math.max(1, Math.round(width * BLOOM_RESOLUTION_SCALE)), Math.max(1, Math.round(height * BLOOM_RESOLUTION_SCALE)));
  }
}

/**
 * 创建后期处理
 * @param {THREE.WebGLRenderer} renderer 画布的渲染器
 * @param {THREE.Scene} scene 要画的场景
 * @param {THREE.Camera} camera 镜头
 * @returns {{ use(settings: object | undefined): void, setSize(width: number, height: number, pixelRatio: number): void, render(): void }}
 */
export function createPost(renderer, scene, camera) {
  // 人被挡住时画剪影要用模板缓冲，贴图也得带上
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: MSAA_SAMPLES, stencilBuffer: true });
  const composer = new EffectComposer(renderer, target);
  const bloom = new TransparentBloomPass(new THREE.Vector2(1, 1), 0, 0, 1);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let active = false;

  return {
    /**
     * 换世界时调用：按这个世界的设置开关后期
     * @param {{ bloom?: { strength: number, radius: number, threshold: number }, toneMapping?: string, exposure?: number } | undefined} settings 场景里的 post，没有就不走后期
     */
    use(settings) {
      active = Boolean(settings);
      if (!active) {
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.toneMappingExposure = 1;
        return;
      }

      const toneMapping = TONE_MAPPINGS[settings.toneMapping];
      if (settings.toneMapping && !toneMapping) {
        console.warn(`不认识的色调映射：${settings.toneMapping}，先不做色调映射`);
      }
      renderer.toneMapping = toneMapping ?? THREE.NoToneMapping;
      renderer.toneMappingExposure = settings.exposure ?? 1;

      bloom.enabled = Boolean(settings.bloom);
      if (settings.bloom) {
        bloom.strength = settings.bloom.strength;
        bloom.radius = settings.bloom.radius;
        bloom.threshold = settings.bloom.threshold;
      }
    },

    /**
     * 画布大小变了
     * @param {number} width 画布宽（CSS 像素）
     * @param {number} height 画布高（CSS 像素）
     * @param {number} pixelRatio 渲染倍率
     */
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },

    /** 画一帧 */
    render() {
      if (active) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    },
  };
}
