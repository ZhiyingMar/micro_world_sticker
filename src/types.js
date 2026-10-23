// 几个大家共用的数据形状，只给类型检查用（JSDoc @typedef），运行时这个文件什么也不做
// 用法：在要用的文件里写
//   /** @typedef {import('./types.js').SceneDef} SceneDef */
// 然后 @param {SceneDef} def 就能用了

/**
 * 一个世界的定义：src/scenes/ 里每个世界文件导出的那个对象
 * @description 全家福（finale）只是一块冰箱贴、没有 build / lights 这些，严格说不满足这个形状；
 *   现在 SCENES 统一标成 SceneDef，等 scenes/index.js 也开了 @ts-check 再把它单独拆成一种类型
 * @typedef {object} SceneDef
 * @property {string} id 唯一 id，存档里用它
 * @property {string} name 世界名
 * @property {string} emoji 标题卡和冰箱贴上的图标
 * @property {'cozy' | 'toon' | 'pixel'} style 材质风格，见 kit.js
 * @property {string} styleLabel 标题卡上的小字
 * @property {string} magnetStyle 冰箱贴的 CSS 样式名（style.css 里 .magnet--xxx）
 * @property {string} bg 方块外面的背景，能直接放进 CSS background 的值
 * @property {SceneLights} lights 两盏灯
 * @property {SceneCamera} camera 镜头的取景和限制
 * @property {[number, number]} spawn 玩家出生在哪 [x, z]
 * @property {string} next 集齐物品后合成哪个世界的冰箱贴
 * @property {ItemDef[]} items 要找的东西
 * @property {(world: import('./world.js').World) => void} build 搭场景
 * @property {Greet | ((world: import('./world.js').World) => Greet)} [greet] 第一次进来谁主动打招呼
 * @property {'rain' | 'city' | 'sea' | 'forest' | 'home'} [ambient] 环境声
 * @property {{ map: string[], level?: number }} [terrain] 有高低的地面，见 terrain.js
 * @property {[number, number]} [size] 没有地形时世界多大 [宽, 深]
 * @property {{ minX?: number, maxX?: number, minZ?: number, maxZ?: number }} [bounds] 人能走的范围
 * @property {RepairDef[]} [repairs] 破败世界：要放回原处的东西
 * @property {string} [brokenGoal] 破败世界还没修好时，目标栏上的那句话（可以带 HTML）
 * @property {MaterialDef[]} [materials] 这个世界能捡的材料
 * @property {{ material: string, count: number, from: string[] }[]} [scatter] 每次进来随机藏几个、藏在带哪些标签的地方
 * @property {boolean} [test] 测试场景，不记进存档的"当前世界"
 * @property {boolean} [ending] 全家福：点开是结局，不是世界
 * @property {boolean} [comingSoon] 还没做好，冰箱上点了提示"施工中"
 */

/**
 * 世界的两盏灯
 * @typedef {object} SceneLights
 * @property {[string, string, number]} hemi 半球光：天空色、地面色、强度
 * @property {[string, number, [number, number, number]]} sun 方向光：颜色、强度、位置 [x, y, z]
 */

/**
 * 世界的镜头设置。角度都是弧度：polar 是离正上方多少，azimuth 是绕竖轴转多少（0 从 +z 往里看）
 * @typedef {object} SceneCamera
 * @property {[number, number, number]} pos 全貌从哪个方向看（和 target 一起定方向，距离会重新算）
 * @property {[number, number, number]} target 全貌看着哪儿
 * @property {number} [fitH] 全貌取景时，后排要算多高也装进画面
 * @property {number} [min] 最近能拉多近（还会乘窄视野的换算系数）
 * @property {number} [minPolar] 上下最多抬到哪
 * @property {number} [maxPolar] 上下最多压到哪
 * @property {number} [minAz] 左右最多转到哪
 * @property {number} [maxAz] 左右最多转到哪
 * @property {number} [startAz] 一进来从哪个方向看
 * @property {number} [startPolar] 一进来的上下角
 * @property {[number, number]} [fitSize] 全貌只框住这么大的地面 [宽, 深]，不写就是整个世界
 */

/**
 * 主动打招呼：谁说什么
 * @typedef {object} Greet
 * @property {string} name 说话的小人名字
 * @property {string} text 说的话
 * @property {string} [key] 记在存档里的名字，同一个世界想说两次不同的话时用不同的 key
 */

/**
 * 一样要收集的东西
 * @typedef {object} ItemDef
 * @property {string} id
 * @property {string} name
 * @property {string} icon 目标栏和提示里的图标
 * @property {string} hint 目标栏格子上的提示
 * @property {(kit: import('./kit.js').Kit) => import('three').Object3D} make 造模型
 */

/**
 * 破败世界里一个要放回去的东西
 * @typedef {object} RepairDef
 * @property {string} id 和 from 那个世界里某样物品的 id 一样，图标、名字用它的
 * @property {string} from 是从哪个世界带来的
 * @property {string} hint 目标栏格子上的提示
 * @property {string} [msg] 放回去时提示后面接的一句话
 */

/**
 * 一种材料（瓶子、蘑菇……）
 * @typedef {object} MaterialDef
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {(kit: import('./kit.js').Kit) => import('three').Object3D} make 露在外面时的模型
 */

/**
 * world.game() 登记的小游戏
 * @typedef {object} GameDef
 * @property {string} id
 * @property {import('three').Object3D} obj 点它就能玩的东西
 * @property {string} title 小游戏界面顶栏的标题
 * @property {string} hover 鼠标悬停提示
 * @property {string} [help] 操作说明
 * @property {{ target: [number, number, number], halfW: number, halfH: number }} view 玩的时候镜头对着哪儿、要装下多大
 * @property {{ x: number, z: number, reach: number }} [entrance] 入口：有入口的，点它只走过去，站到入口才开始
 * @property {() => boolean} [can] 现在能不能玩
 * @property {(api: { status(text: string): void, exitSoon(ms: number): void }) => void} start
 * @property {() => void} stop
 * @property {(key: string) => void} key 按键：left / right / rotate / down / drop
 * @property {(dt: number) => void} update
 */

export {};
