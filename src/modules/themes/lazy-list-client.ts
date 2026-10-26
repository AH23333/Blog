/**
 * 主题文章列表懒加载：客户端运行时
 *
 * 监测 li.lazy-list-sentinel 占位元素，滚动接近时将对应
 * template.lazy-list-template 中的卡片批次插入 DOM。
 *
 * 页面结构契约（由各主题列表页用 planLazyList 生成）：
 *   <ul>
 *     …首屏卡片…
 *     <li class="lazy-list-sentinel" data-batch="k" style="min-height:Npx"></li>
 *     <template class="lazy-list-template" data-batch="k">…批次卡片…</template>
 *     …后续批次…
 *   </ul>
 *
 * 除 IntersectionObserver 外，还有一道「跳滚守卫」：
 * 用户瞬间跳滚（拖动滚动条 / End 键 / scrollTo）会越过中间哨兵，
 * IntersectionObserver 不会为被跳过的元素触发回调；
 * 守卫在每次滚动时激活所有已位于视口上方的哨兵，
 * 保证视口上方的内容不会出现空洞。
 */

/** 提前激活距离：哨兵距视口不足该值时开始加载 */
const PRELOAD_MARGIN_PX = 200;

/** 激活标记：置于哨兵 dataset 上，保证幂等 */
const ACTIVATED_ATTR = "data-activated";

/** 初始化页面内所有懒加载列表 */
export function initThemeLazyLists(): void {
  const sentinels = Array.from(
    document.querySelectorAll<HTMLElement>(`li.lazy-list-sentinel[data-batch]:not([${ACTIVATED_ATTR}])`)
  );

  if (sentinels.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        const sentinel = entry.target as HTMLElement;
        observer.unobserve(sentinel);
        activateBatch(sentinel);
      }
    },
    { rootMargin: `${PRELOAD_MARGIN_PX}px 0px` }
  );

  for (const sentinel of sentinels) {
    observer.observe(sentinel);
  }

  // 跳滚守卫：激活所有已被滚过的哨兵（rAF 节流）
  let ticking = false;

  const activatePassed = (): void => {
    for (const sentinel of sentinels) {
      if (sentinel.dataset.activated === "true" || !sentinel.isConnected) continue;

      if (sentinel.getBoundingClientRect().top < 0) {
        observer.unobserve(sentinel);
        activateBatch(sentinel);
      }
    }
  };

  const onScroll = (): void => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      ticking = false;
      activatePassed();
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });

  // 页面加载时可能已停在列表中部（刷新保留滚动位置）
  activatePassed();
}

/** 激活单个批次：用 template 内容替换哨兵（幂等） */
function activateBatch(sentinel: HTMLElement): void {
  if (sentinel.dataset.activated === "true") return;
  sentinel.dataset.activated = "true";

  const batchId = sentinel.dataset.batch;
  const parent = sentinel.parentElement;

  if (batchId === undefined || !parent) {
    sentinel.remove();
    return;
  }

  const template = parent.querySelector<HTMLTemplateElement>(`template.lazy-list-template[data-batch="${batchId}"]`);

  if (!template) {
    sentinel.remove();
    return;
  }

  const fragment = document.createDocumentFragment();
  fragment.append(...Array.from(template.content.childNodes));
  sentinel.replaceWith(fragment);
  template.remove();
}
