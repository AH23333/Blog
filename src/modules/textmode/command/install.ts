import { clearSearch, getSearchManager } from "./commands/search";
import { initTheme } from "./commands/themes";
import { CommandEngine } from "./engine";
import { registerBuiltinCommands } from "./registry";
import { getScrollConfig } from "./scroll-config";
import { CommandUI } from "./ui";

/** 全局命令引擎实例 */
let engine: CommandEngine | null = null;
let ui: CommandUI | null = null;

/** 安装命令系统 */
export function installCommandMode(): void {
  if (engine) return; // 防止重复安装

  engine = new CommandEngine();
  ui = new CommandUI(engine);

  // 恢复已保存的主题
  initTheme();

  // 注册内置命令
  registerBuiltinCommands();

  // 全局键盘监听
  document.addEventListener("keydown", onGlobalKeydown);

  // 触摸手势支持
  document.addEventListener("touchstart", onTouchStart, { passive: false });
  document.addEventListener("touchend", onTouchEnd, { passive: false });
}

/** 触摸起始位置 */
let touchStartY = 0;
let touchStartX = 0;

function onTouchStart(e: TouchEvent): void {
  if (e.touches.length === 1) {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }
}

function onTouchEnd(e: TouchEvent): void {
  if (!engine || !ui) return;
  if (e.changedTouches.length !== 1) return;

  const deltaY = e.changedTouches[0].clientY - touchStartY;
  const deltaX = e.changedTouches[0].clientX - touchStartX;
  const absDeltaY = Math.abs(deltaY);
  const absDeltaX = Math.abs(deltaX);

  if (absDeltaY < 30 && absDeltaX < 30) return;

  if (absDeltaY > absDeltaX) {
    if (deltaY < 0) {
      window.scrollBy({ top: window.innerHeight * 0.6, behavior: "smooth" });
    } else {
      window.scrollBy({ top: -window.innerHeight * 0.6, behavior: "smooth" });
    }
  } else {
    if (deltaX < 0) {
      window.scrollBy({ left: window.innerWidth * 0.4, behavior: "smooth" });
    } else {
      window.scrollBy({ left: -window.innerWidth * 0.4, behavior: "smooth" });
    }
  }
}

/** 全局键盘事件 */
function onGlobalKeydown(e: KeyboardEvent): void {
  if (!engine || !ui) return;

  // 忽略表单元素内的按键
  const target = e.target as HTMLElement;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
    return;
  }

  // 忽略 IME 组合中的按键
  if (e.isComposing) return;

  // 忽略带修饰键的按键（Ctrl+C, Alt+F 等）
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  // ── 命令模式触发 ──────────────────────────────────────────────────
  if (e.key === ":") {
    e.preventDefault();
    ui.activate("command");
    return;
  }
  if (e.key === "/") {
    e.preventDefault();
    ui.activate("search");
    return;
  }

  // ── 上下箭头：面板未激活时打开面板并显示历史 ────────────────────────
  if (!ui.isActive) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      ui.activate("command");
      const prev = engine.history.previous();
      if (prev !== null) {
        ui.setInputValue(prev);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      ui.activate("command");
      const next = engine.history.next();
      if (next !== null && next !== "") {
        ui.setInputValue(next);
      }
      return;
    }
  }

  // ── n/N 搜索导航 ──────────────────────────────────────────────────
  if (e.key === "n" && engine.lastSearchTerm) {
    e.preventDefault();
    const result = engine.continueSearch(false);
    ui.showOutput(result);
    return;
  }
  if (e.key === "N" && engine.lastSearchTerm) {
    e.preventDefault();
    const result = engine.continueSearch(true);
    ui.showOutput(result);
    return;
  }

  // ── Esc 清除搜索高亮 ──────────────────────────────────────────────
  if (e.key === "Escape" && getSearchManager().isActive) {
    e.preventDefault();
    clearSearch();
    engine.lastSearchTerm = "";
    return;
  }

  // ── PageUp / PageDown 翻页 ─────────────────────────────────────────
  if (e.key === "PageDown") {
    e.preventDefault();
    window.scrollBy({ top: window.innerHeight * 0.85, behavior: "smooth" });
    return;
  }
  if (e.key === "PageUp") {
    e.preventDefault();
    window.scrollBy({ top: -window.innerHeight * 0.85, behavior: "smooth" });
    return;
  }

  // ── hjkl 导航 ─────────────────────────────────────────────────────
  const scroll = getScrollConfig();
  if (e.key === "j") {
    e.preventDefault();
    window.scrollBy({ top: scroll.vertical * 20, behavior: "smooth" });
    return;
  }
  if (e.key === "k") {
    e.preventDefault();
    window.scrollBy({ top: -scroll.vertical * 20, behavior: "smooth" });
    return;
  }
  if (e.key === "h") {
    e.preventDefault();
    window.scrollBy({ left: -scroll.horizontal * 8, behavior: "smooth" });
    return;
  }
  if (e.key === "l") {
    e.preventDefault();
    window.scrollBy({ left: scroll.horizontal * 8, behavior: "smooth" });
    return;
  }

  // ── 空格键翻页 ────────────────────────────────────────────────────
  if (e.key === " ") {
    e.preventDefault();
    window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" });
    return;
  }
}

/** 获取命令引擎实例 */
export function getCommandEngine(): CommandEngine | null {
  return engine;
}

/** 获取命令 UI 实例 */
export function getCommandUI(): CommandUI | null {
  return ui;
}
