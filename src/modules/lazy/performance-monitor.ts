/**
 * 性能监控模块
 *
 * 独立管理懒加载相关的性能指标收集：
 * - 首次渲染完成时间
 * - 滚动流畅度（卡顿率）
 * - 内存占用
 *
 * 与懒加载核心逻辑解耦，可独立启用/禁用和测试。
 */

/** 性能监控配置 */
const MONITOR_CONFIG = {
  /** 滚动卡顿阈值（毫秒），超过此值视为一次卡顿 */
  scrollJankThreshold: 50,
  /** 滚动流畅度上报间隔（毫秒） */
  scrollReportInterval: 5000,
  /** 内存占用上报间隔（毫秒） */
  memoryReportInterval: 10000
};

/** 滚动监控状态 */
interface ScrollState {
  lastScrollTime: number;
  frameCount: number;
  jankCount: number;
}

/** 性能指标报告条目 */
export type MetricReport = {
  avg: number;
  max: number;
  min: number;
  count: number;
};

/** 性能指标报告 */
export type PerformanceReport = Record<string, MetricReport>;

export class PerformanceMonitor {
  private metrics = new Map<string, number[]>();
  private scrollState: ScrollState = { lastScrollTime: 0, frameCount: 0, jankCount: 0 };
  private scrollTimer: number | null = null;
  private memoryTimer: number | null = null;
  private readonly scrollHandler: () => void;
  private readonly typewriterDoneHandler: () => void;

  constructor() {
    this.scrollHandler = this.onScroll.bind(this);
    this.typewriterDoneHandler = this.onTypewriterDone.bind(this);
  }

  /** 启动监控 */
  start(): void {
    this.initFirstRenderMonitoring();
    this.initScrollMonitoring();
    this.initMemoryMonitoring();
  }

  /** 停止监控并清理资源 */
  stop(): void {
    if (this.scrollTimer !== null) {
      window.clearInterval(this.scrollTimer);
      this.scrollTimer = null;
    }
    if (this.memoryTimer !== null) {
      window.clearInterval(this.memoryTimer);
      this.memoryTimer = null;
    }
    window.removeEventListener("scroll", this.scrollHandler);
    window.removeEventListener("typewriter-done", this.typewriterDoneHandler);
  }

  /** 记录一个性能指标 */
  recordMetric(name: string, value: number): void {
    let values = this.metrics.get(name);
    if (!values) {
      values = [];
      this.metrics.set(name, values);
    }
    values.push(value);

    window.dispatchEvent(
      new CustomEvent("lazy-metric", {
        detail: { name, value }
      })
    );
  }

  /** 获取性能指标报告 */
  getReport(): PerformanceReport {
    const report: PerformanceReport = {};

    for (const [name, values] of this.metrics) {
      if (values.length === 0) continue;

      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);

      report[name] = { avg, max, min, count: values.length };
    }

    return report;
  }

  // ── 私有方法 ────────────────────────────────────────────────────────────

  /** 首次渲染时间监控 */
  private initFirstRenderMonitoring(): void {
    if (window.__typewriterDone) {
      this.recordMetric("firstRenderComplete", performance.now());
    } else {
      window.addEventListener("typewriter-done", this.typewriterDoneHandler);
    }
  }

  private onTypewriterDone(): void {
    this.recordMetric("firstRenderComplete", performance.now());
  }

  /** 滚动流畅度监控 */
  private initScrollMonitoring(): void {
    window.addEventListener("scroll", this.scrollHandler, { passive: true });

    this.scrollTimer = window.setInterval(() => {
      if (this.scrollState.frameCount > 0) {
        const jankRate = this.scrollState.jankCount / this.scrollState.frameCount;
        this.recordMetric("scrollJankRate", jankRate);
      }
      this.scrollState.frameCount = 0;
      this.scrollState.jankCount = 0;
    }, MONITOR_CONFIG.scrollReportInterval);
  }

  private onScroll(): void {
    const now = performance.now();
    const delta = now - this.scrollState.lastScrollTime;

    if (delta > MONITOR_CONFIG.scrollJankThreshold) {
      this.scrollState.jankCount++;
    }

    this.scrollState.frameCount++;
    this.scrollState.lastScrollTime = now;
  }

  /** 内存占用监控 */
  private initMemoryMonitoring(): void {
    // @ts-expect-error performance.memory 是非标准 API，仅在 Chrome 中可用
    if (!performance.memory) return;

    this.memoryTimer = window.setInterval(() => {
      // @ts-expect-error performance.memory 是非标准 API
      const usedMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
      this.recordMetric("memoryUsedMB", parseFloat(usedMB));
    }, MONITOR_CONFIG.memoryReportInterval);
  }
}
