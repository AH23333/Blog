/**
 * 自定义页面内搜索引擎
 * 替换不可靠的 window.find() API，使用 TreeWalker + Range 实现精确搜索
 * 支持：Enter 连续跳转、n/N 正反向导航、匹配高亮、自动滚动
 */

/** 单个匹配结果 */
interface SearchMatch {
  range: Range;
  /** 标记 span 元素（用于高亮） */
  marker: HTMLSpanElement | null;
}

/** 搜索管理器（单例） */
class SearchManager {
  private matches: SearchMatch[] = [];
  private currentIndex = -1;
  private term = "";
  /** 当前高亮的匹配 marker */
  private activeMarker: HTMLSpanElement | null = null;

  /** 执行搜索，返回匹配数量 */
  search(term: string): number {
    this.clear();
    this.term = term;
    if (!term) return 0;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // 跳过不可见元素、脚本、样式、命令面板内的文本
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const el = parent as HTMLElement;
        if (
          el.tagName === "SCRIPT" ||
          el.tagName === "STYLE" ||
          el.tagName === "NOSCRIPT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "INPUT" ||
          el.id === "cmd-container" ||
          el.closest("#cmd-container") ||
          el.closest(".theme-custom-panel") ||
          el.hasAttribute("aria-hidden") ||
          el.offsetParent === null
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const regex = new RegExp(this.escapeRegex(term), "gi");
    const textNodes: { node: Text; text: string }[] = [];

    // 收集所有文本节点
    let node = walker.nextNode() as Text | null;
    while (node) {
      const text = node.textContent ?? "";
      if (regex.test(text)) {
        regex.lastIndex = 0;
        textNodes.push({ node, text });
      }
      node = walker.nextNode() as Text | null;
    }

    // 为每个文本节点创建匹配 Range
    for (const { node: textNode, text } of textNodes) {
      const localRegex = new RegExp(this.escapeRegex(term), "gi");
      let match = localRegex.exec(text);
      while (match !== null) {
        try {
          const range = document.createRange();
          range.setStart(textNode, match.index);
          range.setEnd(textNode, match.index + term.length);
          this.matches.push({ range, marker: null });
        } catch {
          // 忽略无效的 range
        }
        match = localRegex.exec(text);
      }
    }

    this.currentIndex = 0;
    return this.matches.length;
  }

  /** 跳转到下一个匹配 */
  next(): boolean {
    if (this.matches.length === 0) return false;
    this.currentIndex = (this.currentIndex + 1) % this.matches.length;
    this.highlightAndScroll(this.currentIndex);
    return true;
  }

  /** 跳转到上一个匹配 */
  prev(): boolean {
    if (this.matches.length === 0) return false;
    this.currentIndex = this.currentIndex <= 0 ? this.matches.length - 1 : this.currentIndex - 1;
    this.highlightAndScroll(this.currentIndex);
    return true;
  }

  /** 跳转到指定索引 */
  goTo(index: number): boolean {
    if (index < 0 || index >= this.matches.length) return false;
    this.currentIndex = index;
    this.highlightAndScroll(this.currentIndex);
    return true;
  }

  /** 高亮并滚动到当前匹配 */
  private highlightAndScroll(index: number): void {
    // 清除上一个高亮
    this.clearActiveHighlight();

    const match = this.matches[index];
    if (!match) return;

    try {
      // 创建高亮标记
      const marker = document.createElement("span");
      marker.className = "cmd-search-active";
      marker.style.backgroundColor = "var(--ansi-yellow, #e0af68)";
      marker.style.color = "var(--bg, #0c0d10)";
      marker.style.borderRadius = "2px";
      marker.style.padding = "0 1px";
      marker.style.transition = "background-color 0.15s";

      match.range.surroundContents(marker);
      match.marker = marker;
      this.activeMarker = marker;

      // 滚动到可视区域
      marker.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      // surroundContents 可能失败（部分选中），滚动到 range 位置
      try {
        const rect = match.range.getBoundingClientRect();
        if (rect) {
          window.scrollBy({
            top: rect.top - window.innerHeight / 2,
            behavior: "smooth"
          });
        }
      } catch {
        // ignore
      }
    }
  }

  /** 清除当前高亮 */
  private clearActiveHighlight(): void {
    if (this.activeMarker) {
      const parent = this.activeMarker.parentNode;
      if (parent) {
        const text = this.activeMarker.textContent ?? "";
        parent.replaceChild(document.createTextNode(text), this.activeMarker);
        parent.normalize();
      }
      this.activeMarker = null;
    }
  }

  /** 清除所有搜索结果 */
  clear(): void {
    this.clearActiveHighlight();
    // 还原所有标记
    for (const match of this.matches) {
      if (match.marker) {
        const parent = match.marker.parentNode;
        if (parent) {
          const text = match.marker.textContent ?? "";
          parent.replaceChild(document.createTextNode(text), match.marker);
          parent.normalize();
        }
      }
    }
    this.matches = [];
    this.currentIndex = -1;
    this.term = "";
  }

  /** 获取匹配总数 */
  get count(): number {
    return this.matches.length;
  }

  /** 获取当前匹配索引（1-based 显示用） */
  get currentDisplay(): number {
    return this.currentIndex + 1;
  }

  /** 获取搜索词 */
  get searchTerm(): string {
    return this.term;
  }

  /** 是否有活动搜索 */
  get isActive(): boolean {
    return this.matches.length > 0;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

// 全局单例
const searchManager = new SearchManager();

/** 获取搜索管理器实例 */
export function getSearchManager(): SearchManager {
  return searchManager;
}

/** 执行搜索（供 registry 调用） */
export function executeSearch(
  term: string,
  isContinue = false,
  backwards = false
): { success: boolean; message: string } {
  if (!term.trim()) {
    return { success: false, message: "请输入搜索词" };
  }

  // 正在搜索不同词，重新搜索
  if (!isContinue) {
    const count = searchManager.search(term);
    if (count === 0) {
      return { success: false, message: `未找到: "${term}"` };
    }
    return {
      success: true,
      message: `找到 ${count} 处匹配: "${term}" (第 1/${count} 处)\nEnter 下一个 | n 下一个 | N 上一个 | Esc 关闭`
    };
  }

  // 继续搜索（Enter 或 n/N）
  if (!searchManager.isActive) {
    return { success: false, message: "没有活动搜索，请先使用 / 搜索" };
  }

  const moved = backwards ? searchManager.prev() : searchManager.next();
  if (!moved) {
    return { success: false, message: "没有搜索匹配" };
  }

  return {
    success: true,
    message: `查找: "${searchManager.searchTerm}" (第 ${searchManager.currentDisplay}/${searchManager.count} 处)`
  };
}

/** 清除搜索状态 */
export function clearSearch(): void {
  searchManager.clear();
}
