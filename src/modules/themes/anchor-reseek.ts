/**
 * 锚点跳转重寻位（配合 scroll-behavior: smooth + 页面懒渲染）。
 *
 * 问题：文章页存在逐图懒渲染的 mermaid 与懒加载图片，点击页内锚点
 * （目录/脚注等）跳转时，视口上方内容会在 smooth 滚动动画期间继续
 * 变高，动画朝点击瞬间计算的陈旧位置滚动，落地时目标元素可能已被
 * 推出视口数千像素。Chromium 的滚动锚定不补偿动画期间的布局变化。
 *
 * 方案：点击页内锚点后，短时间内周期性测量目标元素当前位置，漂移超
 * 阈值则重新滚动到最新位置，直至位置稳定或超时；用户滚轮/触摸/按键
 * 立即中止，不与用户操作抢滚动条。
 */

const RESEEK_INTERVAL_MS = 150;
const RESEEK_TIMEOUT_MS = 3000;
const RESEEK_DRIFT_PX = 24;
const STABLE_TICKS_TO_STOP = 8;

/** 当前进行中的重寻位循环的停止句柄；新循环开始前取消旧循环 */
let activeStop: (() => void) | null = null;

export function initAnchorReseek(): void {
  document.addEventListener("click", (event) => {
    const node = event.target;
    if (!(node instanceof Element)) {
      return;
    }

    const anchor = node.closest('a[href^="#"]');
    if (!(anchor instanceof HTMLAnchorElement)) {
      return;
    }

    const hash = anchor.hash;
    if (hash.length < 2) {
      return;
    }

    let dest: HTMLElement | null = null;
    try {
      dest = document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch {
      dest = document.getElementById(hash.slice(1));
    }
    if (!dest) {
      return;
    }
    const target: HTMLElement = dest;

    // 取消上一次仍在进行的重寻位循环（快速连点目录项时两个循环会互相覆盖 scrollTo）
    activeStop?.();

    const scrollMargin = Number.parseFloat(getComputedStyle(dest).scrollMarginTop) || 0;
    const startedAt = performance.now();
    let stableTicks = 0;
    let stopped = false;

    const stop = (): void => {
      stopped = true;
      if (activeStop === stop) {
        activeStop = null;
      }
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };

    window.addEventListener("wheel", stop, { passive: true, capture: true });
    window.addEventListener("touchstart", stop, { passive: true, capture: true });
    window.addEventListener("keydown", stop, { capture: true });

    activeStop = stop;

    const reseek = (): void => {
      if (stopped) {
        return;
      }

      if (performance.now() - startedAt > RESEEK_TIMEOUT_MS) {
        stop();
        return;
      }

      const targetY = target.getBoundingClientRect().top + window.scrollY - scrollMargin;
      const drift = Math.abs(targetY - window.scrollY);

      if (drift > RESEEK_DRIFT_PX) {
        stableTicks = 0;
        window.scrollTo({ top: Math.max(0, targetY) });
      } else {
        stableTicks += 1;
      }

      if (stableTicks < STABLE_TICKS_TO_STOP) {
        window.setTimeout(reseek, RESEEK_INTERVAL_MS);
      } else {
        stop();
      }
    };

    // 等待浏览器自身的锚点滚动动画基本完成后再开始校正
    window.setTimeout(reseek, 500);
  });
}
