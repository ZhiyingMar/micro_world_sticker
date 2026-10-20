// 浏览器和页面上的几样东西，标准类型里没有，在这里补上（只给类型检查用）

// Safari 老版本的全屏接口带 webkit 前缀；main.js 的全屏按钮两种都试
interface Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
}

interface HTMLElement {
  webkitRequestFullscreen?: () => void;
}

// 调试用：控制台里 window.__mw 能看到游戏状态，见 main.js 末尾
interface Window {
  __mw: object;
}
