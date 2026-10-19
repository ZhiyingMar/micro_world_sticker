// 宣传片画面上叠的东西：字幕、标题卡、黑场。都直接画在要录的那块画布上，录得进视频
// 尺寸按 1080p 画面写，画布大小不同时按高度等比缩放

const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
// 按多高的画面设计的（像素），其他尺寸按它等比缩放
const DESIGN_HEIGHT = 1080;

// 字幕：画面下方一条圆角的半透明底，白字
const CAPTION = {
  fontSize: 46,
  centerY: 0.87, // 字幕条中心在画面高度的哪儿（0 顶、1 底）
  padX: 44,
  padY: 22,
  rise: 14, // 淡入时从下面往上浮多少像素
  fill: 'rgba(28, 22, 40, 0.5)',
  text: '#ffffff',
};

// 标题卡：画面正中一行大标题、一行小字
const TITLE = {
  titleSize: 128,
  subtitleSize: 40,
  gap: 34, // 大标题和小字之间空多少像素
  shade: 'rgba(10, 8, 24, 0.45)', // 标题卡出来时整个画面压暗一点，字更清楚
  text: '#ffffff',
  subtitle: 'rgba(255, 244, 220, 0.92)',
  glow: 'rgba(255, 200, 120, 0.55)',
};

/**
 * 画一条圆角矩形的路径
 * @param {CanvasRenderingContext2D} context 画在哪
 * @param {number} x 左上角 x，像素
 * @param {number} y 左上角 y，像素
 * @param {number} width 宽，像素
 * @param {number} height 高，像素
 * @param {number} radius 圆角半径，像素
 */
function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

/**
 * 在画面下方画一条字幕
 * @param {CanvasRenderingContext2D} context 画在哪
 * @param {string} text 字幕
 * @param {number} opacity 0..1，淡入淡出用
 */
export function drawCaption(context, text, opacity) {
  if (!text || opacity <= 0) {
    return;
  }
  const { width, height } = context.canvas;
  const scale = height / DESIGN_HEIGHT;
  const fontSize = CAPTION.fontSize * scale;

  context.save();
  context.globalAlpha = opacity;
  context.font = `600 ${fontSize}px ${FONT}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const boxWidth = context.measureText(text).width + CAPTION.padX * 2 * scale;
  const boxHeight = fontSize + CAPTION.padY * 2 * scale;
  const centerY = height * CAPTION.centerY + (1 - opacity) * CAPTION.rise * scale;
  roundRect(context, (width - boxWidth) / 2, centerY - boxHeight / 2, boxWidth, boxHeight, boxHeight / 2);
  context.fillStyle = CAPTION.fill;
  context.fill();

  context.fillStyle = CAPTION.text;
  context.fillText(text, width / 2, centerY);
  context.restore();
}

/**
 * 在画面正中画标题卡
 * @param {CanvasRenderingContext2D} context 画在哪
 * @param {{ title: string, subtitle?: string }} card 大标题和下面一行小字
 * @param {number} opacity 0..1，淡入淡出用
 */
export function drawTitleCard(context, card, opacity) {
  if (!card || opacity <= 0) {
    return;
  }
  const { width, height } = context.canvas;
  const scale = height / DESIGN_HEIGHT;
  const titleSize = TITLE.titleSize * scale;
  const subtitleSize = TITLE.subtitleSize * scale;

  context.save();
  context.globalAlpha = opacity;
  context.fillStyle = TITLE.shade;
  context.fillRect(0, 0, width, height);

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const hasSubtitle = !!card.subtitle;
  let titleY = height / 2;
  if (hasSubtitle) {
    titleY -= (subtitleSize + TITLE.gap * scale) / 2;
  }
  context.font = `800 ${titleSize}px ${FONT}`;
  context.shadowColor = TITLE.glow;
  context.shadowBlur = 40 * scale;
  context.fillStyle = TITLE.text;
  context.fillText(card.title, width / 2, titleY);

  if (hasSubtitle) {
    context.shadowBlur = 0;
    context.font = `500 ${subtitleSize}px ${FONT}`;
    context.fillStyle = TITLE.subtitle;
    context.fillText(card.subtitle, width / 2, titleY + titleSize / 2 + TITLE.gap * scale + subtitleSize / 2);
  }
  context.restore();
}

/**
 * 盖一层黑：开头、结尾、换世界时用
 * @param {CanvasRenderingContext2D} context 画在哪
 * @param {number} amount 0 完全看得见，1 全黑
 */
export function drawFade(context, amount) {
  if (amount <= 0) {
    return;
  }
  const { width, height } = context.canvas;
  context.save();
  context.globalAlpha = Math.min(1, amount);
  context.fillStyle = '#000000';
  context.fillRect(0, 0, width, height);
  context.restore();
}
