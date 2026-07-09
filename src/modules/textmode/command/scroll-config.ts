/**
 * 滚动配置共享模块
 * 供 install.ts（键盘事件）和 registry.ts（scroll 命令）共同引用
 * 避免循环依赖
 */

const SCROLL_CONFIG = {
  vertical: 3,
  horizontal: 5
};

// 加载持久化配置
try {
  const saved = localStorage.getItem("cmd-scroll-config");
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.vertical > 0) SCROLL_CONFIG.vertical = parsed.vertical;
    if (parsed.horizontal > 0) SCROLL_CONFIG.horizontal = parsed.horizontal;
  }
} catch {
  /* ignore */
}

function saveScrollConfig(): void {
  try {
    localStorage.setItem("cmd-scroll-config", JSON.stringify(SCROLL_CONFIG));
  } catch {
    /* ignore */
  }
}

/** 获取滚动配置（只读副本） */
export function getScrollConfig(): { vertical: number; horizontal: number } {
  return { ...SCROLL_CONFIG };
}

/** 更新滚动配置 */
export function setScrollConfig(vertical: number, horizontal: number): void {
  SCROLL_CONFIG.vertical = Math.max(1, vertical);
  SCROLL_CONFIG.horizontal = Math.max(1, horizontal);
  saveScrollConfig();
}