// 方块外面那一大片背景：游戏里是网页的 CSS 渐变，3D 画布本身是透明的
// 录视频只录画布，所以要把同样的渐变自己画进视频里
//
// 只认游戏里用到的两种写法，别的写法直接报错（悄悄画错颜色比报错更难发现）：
//   radial-gradient(circle|ellipse at X% Y%, #颜色 位置%, ...)
//   linear-gradient(角度deg, #颜色 位置%, ...)

const RADIAL = /^radial-gradient\(\s*(circle|ellipse)\s+at\s+([\d.]+)%\s+([\d.]+)%\s*,(.+)\)$/;
const LINEAR = /^linear-gradient\(\s*([\d.]+)deg\s*,(.+)\)$/;

/**
 * 把 CSS 渐变的色标拆出来
 * @description 没写位置的色标按 CSS 的规矩在前后两个有位置的色标之间平均分
 * @param {string} text 色标那一段，比如 "#fff6e3 0%, #f8dfc0 55%, #ecc39c 100%"
 * @returns {{ color: string, offset: number }[]} offset 是 0..1
 */
function parseStops(text) {
  const stops = text.split(',').map((part) => {
    const [color, position] = part.trim().split(/\s+/);
    const offset = position === undefined ? null : parseFloat(position) / 100;
    return { color, offset };
  });

  if (stops[0].offset === null) {
    stops[0].offset = 0;
  }
  if (stops[stops.length - 1].offset === null) {
    stops[stops.length - 1].offset = 1;
  }
  for (let i = 1; i < stops.length - 1; i++) {
    if (stops[i].offset !== null) {
      continue;
    }
    const before = stops[i - 1].offset;
    let next = i + 1;
    while (stops[next].offset === null) {
      next++;
    }
    stops[i].offset = before + (stops[next].offset - before) / (next - i + 1);
  }
  return stops;
}

/**
 * 把色标填进画布的渐变对象
 * @param {CanvasGradient} gradient 画布渐变
 * @param {{ color: string, offset: number }[]} stops parseStops 的结果
 */
function addStops(gradient, stops) {
  for (const stop of stops) {
    gradient.addColorStop(Math.min(1, Math.max(0, stop.offset)), stop.color);
  }
}

/**
 * 画一个径向渐变，大小按 CSS 默认的 farthest-corner（渐变边缘刚好到最远的角）
 * @param {CanvasRenderingContext2D} context 画在哪
 * @param {string} shape circle 或 ellipse
 * @param {number} cx 中心 x，像素
 * @param {number} cy 中心 y，像素
 * @param {{ color: string, offset: number }[]} stops 色标
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 */
function paintRadial(context, shape, cx, cy, stops, width, height) {
  const farX = Math.max(cx, width - cx);
  const farY = Math.max(cy, height - cy);

  // 椭圆：横竖比和到最近两边的距离之比一样，再放大到刚好经过最远的角
  let scaleY = 1;
  let radius = Math.hypot(farX, farY);
  if (shape === 'ellipse') {
    const nearX = Math.max(1, Math.min(cx, width - cx));
    const nearY = Math.max(1, Math.min(cy, height - cy));
    scaleY = nearY / nearX;
    radius = Math.hypot(farX, farY / scaleY);
  }

  context.save();
  context.translate(cx, cy);
  context.scale(1, scaleY);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
  addStops(gradient, stops);
  context.fillStyle = gradient;
  // 缩放过的坐标系里铺满整块画布
  context.fillRect(-cx, -cy / scaleY, width, height / scaleY);
  context.restore();
}

/**
 * 画一个线性渐变，角度按 CSS 的规矩（0deg 从下往上，180deg 从上往下）
 * @param {CanvasRenderingContext2D} context 画在哪
 * @param {number} degrees CSS 里写的角度
 * @param {{ color: string, offset: number }[]} stops 色标
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 */
function paintLinear(context, degrees, stops, width, height) {
  const angle = (degrees * Math.PI) / 180;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  // CSS 的渐变线长度：让两头的角刚好落在 0% 和 100% 上
  const halfLength = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  const cx = width / 2;
  const cy = height / 2;

  const gradient = context.createLinearGradient(cx - dx * halfLength, cy - dy * halfLength, cx + dx * halfLength, cy + dy * halfLength);
  addStops(gradient, stops);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

/**
 * 按游戏里的背景 CSS 把整块画布铺满
 * @param {CanvasRenderingContext2D} context 画在哪
 * @param {string} css 世界的背景，和 world.backdrop 一样的写法
 * @param {number} width 画布宽，像素
 * @param {number} height 画布高，像素
 */
export function paintBackdrop(context, css, width, height) {
  const text = css.trim();

  const radial = text.match(RADIAL);
  if (radial) {
    const [, shape, xPercent, yPercent, stops] = radial;
    const cx = (parseFloat(xPercent) / 100) * width;
    const cy = (parseFloat(yPercent) / 100) * height;
    paintRadial(context, shape, cx, cy, parseStops(stops), width, height);
    return;
  }

  const linear = text.match(LINEAR);
  if (linear) {
    const [, degrees, stops] = linear;
    paintLinear(context, parseFloat(degrees), parseStops(stops), width, height);
    return;
  }

  throw new Error(`宣传片画不了这种背景写法：${css}`);
}
