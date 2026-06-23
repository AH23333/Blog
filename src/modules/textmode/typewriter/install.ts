/**
 * UNIX 光标打字动画 — 逐行显示 + 闪烁光标
 *
 * 从 TextmodeLayout.astro 内联脚本提取，获得 TypeScript 类型检查与 IDE 支持。
 */

declare global {
  interface Window {
    __typewriterDone?: boolean;
  }
}

function signalTypewriterDone(): void {
  window.__typewriterDone = true;
  window.dispatchEvent(new CustomEvent("typewriter-done"));
}

export function initTypewriter(): void {
  const preElements = document.querySelectorAll(".textmode-pre");
  if (preElements.length === 0) {
    signalTypewriterDone();
    return;
  }

  const allLines: { el: HTMLElement; lineHtml: string }[] = [];

  for (const pre of preElements) {
    const preEl = pre as HTMLElement;
    if (preEl.hasAttribute("data-typed")) continue;
    preEl.setAttribute("data-typed", "true");

    // 跳过自身标记为 no-typewriter 的元素
    if (preEl.hasAttribute("data-no-typewriter")) {
      preEl.style.visibility = "visible";
      continue;
    }

    const originalHtml = preEl.innerHTML;
    if (!originalHtml.trim()) {
      preEl.style.visibility = "visible";
      continue;
    }

    // 保护 data-no-typewriter 子元素：利用 DOM 解析找到它们，用占位符替换
    const noTypewriterBlocks: string[] = [];
    let protectedHtml = originalHtml;

    // 用临时 DOM 找出所有 data-no-typewriter 元素
    const tmp = document.createElement("div");
    tmp.innerHTML = originalHtml;
    const blocks = tmp.querySelectorAll("[data-no-typewriter]");
    for (const block of blocks) {
      const outer = block.outerHTML;
      const idx = noTypewriterBlocks.length;
      noTypewriterBlocks.push(outer);
      protectedHtml = protectedHtml.replace(outer, `\uE400NT${idx}\uE400`);
    }

    let lines: string[];

    // <div> 元素：浏览器 innerHTML 不保留 \n → 使用 DOM 分行
    if (preEl.tagName === "DIV") {
      const domTmp = document.createElement("div");
      domTmp.innerHTML = protectedHtml;
      lines = [];

      const BLOCK_TAGS =
        /^(p|h[1-6]|ul|ol|li|blockquote|table|hr|div|pre|figure|figcaption|dl|dt|dd|section|header|footer|main|article|nav|aside)$/;

      function walk(node: Node): void {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          if (text.trim()) {
            const parts = text.split("\n");
            for (const part of parts) {
              lines.push(part);
            }
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (BLOCK_TAGS.test(el.tagName.toLowerCase())) {
            lines.push(el.outerHTML);
          } else {
            for (const child of node.childNodes) {
              walk(child);
            }
          }
        }
      }

      for (const child of domTmp.childNodes) {
        walk(child);
      }
    } else {
      // <pre> 元素：直接按 \n 拆分
      lines = protectedHtml.split("\n");
    }

    preEl.innerHTML = "";

    for (const lineHtml of lines) {
      let restored = lineHtml;
      for (let i = 0; i < noTypewriterBlocks.length; i++) {
        restored = restored.replaceAll(`\uE400NT${i}\uE400`, noTypewriterBlocks[i]);
      }
      allLines.push({ el: preEl, lineHtml: restored });
    }
  }

  if (allLines.length === 0) {
    signalTypewriterDone();
    return;
  }

  let currentIndex = 0;
  const batchSize = Math.max(2, Math.min(8, Math.floor(allLines.length / 200)));
  const interval = 20;

  const cursor = document.createElement("span");
  cursor.className = "typewriter-cursor";
  cursor.textContent = "\u2588";
  cursor.setAttribute("aria-hidden", "true");

  function typeNextBatch(): void {
    const batch = allLines.slice(currentIndex, currentIndex + batchSize);

    if (batch.length === 0) {
      cursor.remove();
      return;
    }

    for (const { el, lineHtml } of batch) {
      const existingCount = el.querySelectorAll(".tw-line").length;
      const lineSpan = document.createElement("span");
      lineSpan.className = "tw-line";
      lineSpan.innerHTML = lineHtml || "&nbsp;";

      if (existingCount > 0) {
        el.appendChild(document.createTextNode("\n"));
      } else {
        el.style.visibility = "visible";
      }
      el.appendChild(lineSpan);

      lineSpan.appendChild(cursor);
    }

    currentIndex += batch.length;

    if (currentIndex < allLines.length) {
      window.setTimeout(typeNextBatch, interval);
    } else {
      cursor.remove();
      signalTypewriterDone();
    }
  }

  window.setTimeout(typeNextBatch, 150);
}

/**
 * 在 DOM 就绪后启动打字机动画。
 */
export function bootstrapTypewriter(): void {
  if (document.readyState === "complete") {
    window.setTimeout(initTypewriter, 50);
  } else {
    window.addEventListener(
      "load",
      () => {
        window.setTimeout(initTypewriter, 50);
      },
      { once: true }
    );
  }
}
