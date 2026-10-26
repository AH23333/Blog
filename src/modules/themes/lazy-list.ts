/**
 * 主题文章列表懒加载：服务端分批计划
 *
 * 首屏只渲染前 N 张卡片，其余按批存入 <template>，
 * 由 lazy-list-client.ts 在滚动接近时激活。
 * 与 textmode 的 LazyRender（modules/lazy）思路一致，
 * 但针对均匀高度的卡片列表做了简化。
 */

/** 懒加载列表分批计划 */
export type LazyListPlan<T> = {
  /** 首屏直接渲染的条目 */
  initial: T[];
  /** 待激活批次：每批条目 + 哨兵占位高度（px） */
  batches: { items: T[]; reserveHeightPx: number }[];
};

/** 分批选项 */
export type LazyListOptions = {
  /** 首屏渲染条数（默认 12） */
  initialCount?: number;
  /** 每批条数（默认 12） */
  batchSize?: number;
  /** 单条目估算高度 px（默认 100） */
  itemHeightPx?: number;
  /** 单批占位高度上限 px（默认 480） */
  maxReservePx?: number;
};

/**
 * 将条目列表切分为「首屏 + 懒加载批次」。
 *
 * 条目数不超过首屏数量时，batches 为空，页面退化为普通列表（无任何额外 DOM）。
 */
export function planLazyList<T>(items: T[], options: LazyListOptions = {}): LazyListPlan<T> {
  const initialCount = options.initialCount ?? 12;
  const batchSize = options.batchSize ?? 12;
  const itemHeightPx = options.itemHeightPx ?? 100;
  const maxReservePx = options.maxReservePx ?? 480;

  const initial = items.slice(0, initialCount);
  const rest = items.slice(initialCount);

  const batches: { items: T[]; reserveHeightPx: number }[] = [];
  for (let start = 0; start < rest.length; start += batchSize) {
    const chunk = rest.slice(start, start + batchSize);
    batches.push({
      items: chunk,
      reserveHeightPx: Math.min(chunk.length * itemHeightPx, maxReservePx)
    });
  }

  return { initial, batches };
}
