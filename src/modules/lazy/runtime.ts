/**
 * LazyRender 客户端运行时
 *
 * 监测用户滚动位置，按需激活后续内容块：
 * - 使用 IntersectionObserver 监测占位元素
 * - 当占位元素进入视口时，激活对应的 template 内容
 * - 新激活的块应用打字机效果
 * - Mermaid 图表在可见时初始化
 */

import { installMermaidLightbox } from "../textmode/lightbox/mermaid";
import { initMermaidForElement } from "../textmode/mermaid/init";
import { initTypewriterForElement } from "../textmode/typewriter/install";

console.log("[LazyRender] Module loaded");

/** 懒加载配置 */
const LAZY_CONFIG = {
  // 预加载距离：提前 N 像素开始加载
  preloadDistance: 200,
  // 最小激活间隔：避免连续激活导致卡顿
  minActivateInterval: 100
};

/** 激活状态 */
type ActivationState = {
  lastActivateTime: number;
  pendingActivations: Set<string>;
  isProcessing: boolean;
};

/** 全局状态 */
const state: ActivationState = {
  lastActivateTime: 0,
  pendingActivations: new Set(),
  isProcessing: false
};

/** 占位元素观测器 */
let placeholderObserver: IntersectionObserver | null = null;

/** 已激活的块 ID */
const activatedChunks = new Set<string>();

/**
 * 初始化懒加载系统
 *
 * 扫描 DOM 中的懒加载占位元素，设置 IntersectionObserver
 */
export function initLazyRender(): void {
  console.log("[LazyRender] initLazyRender called");

  const placeholders = document.querySelectorAll(".lazy-placeholder");

  if (placeholders.length === 0) {
    console.log("[LazyRender] No lazy placeholders found");
    return;
  }

  console.log(`[LazyRender] Found ${placeholders.length} lazy placeholders`);

  // 创建 IntersectionObserver
  placeholderObserver = new IntersectionObserver(handleIntersection, {
    root: null,
    rootMargin: `${LAZY_CONFIG.preloadDistance}px 0px`,
    threshold: 0.01
  });

  // 观测所有占位元素
  for (const placeholder of placeholders) {
    placeholderObserver.observe(placeholder);
  }

  // 初始化性能监控
  initPerformanceMonitor();
}

/**
 * 处理 IntersectionObserver 回调
 */
function handleIntersection(entries: IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;

    const placeholder = entry.target as HTMLElement;
    const chunkId = placeholder.dataset.chunkId;

    if (!chunkId || activatedChunks.has(chunkId)) continue;

    // 添加到待激活队列
    state.pendingActivations.add(chunkId);
  }

  // 处理待激活队列
  processPendingActivations();
}

/**
 * 处理待激活队列
 *
 * 按顺序激活块，避免同时激活多个导致卡顿
 */
function processPendingActivations(): void {
  if (state.isProcessing || state.pendingActivations.size === 0) return;

  // 控制激活频率
  const now = Date.now();
  if (now - state.lastActivateTime < LAZY_CONFIG.minActivateInterval) {
    setTimeout(processPendingActivations, LAZY_CONFIG.minActivateInterval);
    return;
  }

  state.isProcessing = true;
  state.lastActivateTime = now;

  // 取出第一个待激活的块
  const chunkId = state.pendingActivations.values().next().value;
  if (!chunkId) {
    state.isProcessing = false;
    return;
  }

  state.pendingActivations.delete(chunkId);
  activateChunk(chunkId).finally(() => {
    state.isProcessing = false;
    // 继续处理剩余队列
    if (state.pendingActivations.size > 0) {
      setTimeout(processPendingActivations, LAZY_CONFIG.minActivateInterval);
    }
  });
}

/**
 * 激活单个内容块
 *
 * 将 template 中的块（与 PhileShell.astro 相同结构）插入 DOM，
 * 对每个 text 块逐个应用打字机效果。
 */
async function activateChunk(chunkId: string): Promise<void> {
  const placeholder = document.querySelector<HTMLElement>(`.lazy-placeholder[data-chunk-id="${chunkId}"]`);
  const template = document.querySelector<HTMLElement>(`.lazy-template[data-chunk-id="${chunkId}"]`);

  if (!placeholder || !template) {
    console.warn(`[LazyRender] Missing placeholder or template for ${chunkId}`);
    return;
  }

  // 获取 template 内容并解析为 DOM 元素
  const content = template.innerHTML;
  const hasMermaid = template.dataset.hasMermaid === "true";

  const temp = document.createElement("div");
  temp.innerHTML = content;

  // 收集所有 .textmode-pre 元素（需要打字机效果）
  const textElements: HTMLElement[] = [];
  const fragment = document.createDocumentFragment();

  for (const child of Array.from(temp.children)) {
    const el = child as HTMLElement;
    if (el.classList.contains("textmode-pre")) {
      textElements.push(el);
    }
    fragment.appendChild(el);
  }

  // 替换占位元素为新的块元素
  placeholder.replaceWith(fragment);

  // 移除 template（已使用）
  template.remove();

  // 标记已激活
  activatedChunks.add(chunkId);

  // 记录激活性能
  const startTime = performance.now();

  // 对每个 text 块逐个应用打字机效果
  for (const el of textElements) {
    await initTypewriterForElement(el);
  }

  // 打字机完成后初始化 Mermaid 图表
  if (hasMermaid) {
    for (const el of textElements) {
      await initMermaidForElement(el);
    }
    // 仅为新激活的元素安装 lightbox，避免全文档扫描
    for (const el of textElements) {
      installMermaidLightbox(el);
    }
  }

  const elapsed = performance.now() - startTime;
  console.log(`[LazyRender] Activated ${chunkId} in ${elapsed.toFixed(2)}ms`);

  // 发送激活事件（供测试和调试）
  window.dispatchEvent(
    new CustomEvent("lazy-chunk-activated", {
      detail: { chunkId, elapsed, hasMermaid }
    })
  );
}

/**
 * 性能监控
 *
 * 记录首次渲染时间、滚动流畅度、内存占用等指标
 */
function initPerformanceMonitor(): void {
  // 首次渲染时间（从页面加载到首屏打字机完成）
  if (window.__typewriterDone) {
    recordMetric("firstRenderComplete", performance.now());
  } else {
    window.addEventListener("typewriter-done", () => {
      recordMetric("firstRenderComplete", performance.now());
    });
  }

  // 滚动流畅度监控
  let lastScrollTime = 0;
  let scrollFrameCount = 0;
  let scrollJankCount = 0;

  window.addEventListener(
    "scroll",
    () => {
      const now = performance.now();
      const delta = now - lastScrollTime;

      if (delta > 50) {
        // 超过 50ms 认为是卡顿
        scrollJankCount++;
      }

      scrollFrameCount++;
      lastScrollTime = now;
    },
    { passive: true }
  );

  // 每 5 秒记录一次滚动流畅度
  setInterval(() => {
    if (scrollFrameCount > 0) {
      const jankRate = scrollJankCount / scrollFrameCount;
      recordMetric("scrollJankRate", jankRate);
    }
    scrollFrameCount = 0;
    scrollJankCount = 0;
  }, 5000);

  // 内存占用监控（如果 API 可用）
  // @ts-expect-error performance.memory 是非标准 API，仅在 Chrome 中可用
  if (performance.memory) {
    setInterval(() => {
      // @ts-expect-error performance.memory 是非标准 API
      const usedMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
      recordMetric("memoryUsedMB", parseFloat(usedMB));
    }, 10000);
  }
}

/** 性能指标存储 */
const metrics: Map<string, number[]> = new Map();

function recordMetric(name: string, value: number): void {
  if (!metrics.has(name)) {
    metrics.set(name, []);
  }
  metrics.get(name)?.push(value);

  // 发送指标事件（供测试和调试）
  window.dispatchEvent(
    new CustomEvent("lazy-metric", {
      detail: { name, value }
    })
  );
}

/**
 * 获取性能指标报告
 */
export function getPerformanceReport(): Record<string, { avg: number; max: number; min: number; count: number }> {
  const report: Record<string, { avg: number; max: number; min: number; count: number }> = {};

  for (const [name, values] of metrics) {
    if (values.length === 0) continue;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    report[name] = { avg, max, min, count: values.length };
  }

  return report;
}

/**
 * 清理懒加载系统
 *
 * 在页面销毁时调用，释放资源
 */
export function cleanupLazyRender(): void {
  if (placeholderObserver) {
    placeholderObserver.disconnect();
    placeholderObserver = null;
  }

  state.pendingActivations.clear();
  activatedChunks.clear();
}

// 类型声明扩展
declare global {
  interface Window {
    __typewriterDone?: boolean;
    __lazyRenderInitialized?: boolean;
  }
}
