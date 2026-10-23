// 小屋的布局：房子多大、镜头怎么看、工作台摆在哪、外面花园多大
// 都是数据，房间、家具、房檐、花园照着它搭

// 镜头：从右前方斜着看进屋子（只有后墙、左墙两面墙，别的方向看过去是空的）
export const CAMERA_POS = [9.5, 9.5, 12.5];
export const CAMERA_TARGET = [0, 1, -0.5];
// 左右以默认方向为中心，各能转多少（弧度，约 25°），转不到正对一面墙
export const CAMERA_TURN = 0.44;
// 上下：镜头离正上方的角度范围（弧度）。越大看得越平，墙和家具越显得高；不让俯视到头顶，也不让压到贴地
export const CAMERA_TILT = [0.9, 1.15];
// 一进来的俯角：比别的世界平一些，墙和家具立得起来
export const CAMERA_START_TILT = 1.05;
export const CAMERA_AZIMUTH = Math.atan2(CAMERA_POS[0] - CAMERA_TARGET[0], CAMERA_POS[2] - CAMERA_TARGET[2]);
// 全貌只框住屋子（不算外面的花园），屋子差不多填满画面；拉远最多就到这里，拉近随意
export const ROOM_SIZE = [10, 10];
// 拉近最多到多近（和别的世界一样按 ZOOM 换算）
export const CAMERA_MIN_DISTANCE = 2.2;
// 连外面一圈花园，整个方块的边长（屋子 10，四周各留一圈花园）
export const GARDEN_SIZE = 15;

// 房子的尺寸：地板 9.6 × 9.6，中心在原点
export const HOUSE = {
  half: 4.8, // 地板边离中心多远
  wallInner: 4.5, // 墙的内侧面离中心多远
  wallThickness: 0.3,
  wallHeight: 4.2,
  trimTop: 4.36, // 墙顶那根木线的顶面高度
  floorThickness: 0.3, // 地板那块板多厚（顶面在 0）
  wainscotHeight: 1.1, // 墙裙多高
  wainscotThickness: 0.06,
};

// 后墙上的窗户：窗洞中心在哪（x、离地多高），窗洞多宽多高。墙上真的开了洞，看得到屋后的花园
export const WINDOW = { x: 1.5, y: 2.45, width: 1.8, height: 1.4 };

// 圆地毯：中心和外圈半径（脚步声踩在上面是闷的）
export const RUG = { x: 0.5, z: 0.4, radius: 1.75 };
// 地上那团毛线球一开始在哪（人踢一下会滚走）
export const YARN_BALL = { x: 2.35, z: 3.6 };
// 小猫蜷在毛线篮旁边睡觉，头朝哪边（弧度，0 朝 +z；朝着镜头偏右，看得到它的脸）
export const CAT = { x: 3.1, z: 3.05, facing: 1.0 };

// 人能走的范围：只在屋里那块地板上，走不到花园里
export const BOUNDS = { minX: -4.45, maxX: 4.7, minZ: -4.45, maxZ: 4.7 };
export const SPAWN = [1.6, 2.8];

// 工作台：靠左墙，摆在落地灯和大盆栽中间，台面朝屋里（+x）
export const WORKBENCH = { x: -4.15, z: 0.15, facing: Math.PI / 2 };
// 台面多长（沿墙）、多深、多高
export const WORKBENCH_SIZE = { length: 1.2, depth: 0.6, height: 0.9 };
// 人站在台面前多远就能用
export const WORKBENCH_REACH = 1.3;
