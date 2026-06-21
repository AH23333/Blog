const lightboxClass = "mermaid-lightbox";
const activeClass = "mermaid-lightbox-active";

type LightboxElements = {
  overlay: HTMLDivElement;
  inner: HTMLDivElement;
  closeBtn: HTMLButtonElement;
};

function buildLightbox(): LightboxElements {
  const overlay = document.createElement("div");
  overlay.className = lightboxClass;

  const inner = document.createElement("div");
  inner.className = "mermaid-lightbox-inner";

  const closeBtn = document.createElement("button");
  closeBtn.className = "mermaid-lightbox-close";
  closeBtn.setAttribute("aria-label", "关闭");
  closeBtn.textContent = "✕";

  overlay.append(inner, closeBtn);
  document.body.append(overlay);

  return { overlay, inner, closeBtn };
}

/**
 * 获取或创建 lightbox DOM 元素。
 * 使用 DOM 查询而非模块级变量去重，避免浏览器缓存模块后
 * 变量指向已脱离 DOM 的旧元素。
 */
function ensureLightbox(): LightboxElements {
  const existing = document.querySelector<HTMLDivElement>(`.${lightboxClass}`);
  if (existing) {
    const inner = existing.querySelector(".mermaid-lightbox-inner");
    const closeBtn = existing.querySelector(".mermaid-lightbox-close");
    if (inner && closeBtn) {
      return {
        overlay: existing,
        inner: inner as HTMLDivElement,
        closeBtn: closeBtn as HTMLButtonElement
      };
    }
  }
  return buildLightbox();
}

function close(): void {
  const overlay = document.querySelector<HTMLDivElement>(`.${lightboxClass}`);
  if (overlay) {
    overlay.classList.remove(activeClass);
  }
}

function open(svg: SVGElement): void {
  const lb = ensureLightbox();
  lb.inner.innerHTML = "";
  const clone = svg.cloneNode(true) as SVGElement;
  clone.removeAttribute("width");
  clone.style.width = "100%";
  clone.style.maxHeight = "85vh";
  lb.inner.appendChild(clone);
  lb.overlay.classList.add(activeClass);
}

let keydownBound = false;

export function installMermaidLightbox(root: ParentNode = document): void {
  const diagrams = root.querySelectorAll<HTMLElement>("pre.mermaid");
  if (diagrams.length === 0) return;

  const lb = ensureLightbox();

  // 绑定关闭事件
  lb.closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });
  lb.overlay.addEventListener("click", (e) => {
    if (e.target === lb.overlay) close();
  });

  // 全局 keydown 只绑定一次
  if (!keydownBound) {
    keydownBound = true;
    document.addEventListener("keydown", (e) => {
      const overlay = document.querySelector<HTMLDivElement>(`.${lightboxClass}`);
      if (e.key === "Escape" && overlay?.classList.contains(activeClass)) {
        close();
      }
    });
  }

  // 绑定图表点击事件
  for (const d of diagrams) {
    if (d.dataset.lightboxReady === "true") continue;
    d.dataset.lightboxReady = "true";
    d.addEventListener("click", () => {
      const svg = d.querySelector<SVGElement>("svg");
      if (svg) open(svg);
    });
  }
}
