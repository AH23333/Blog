/**
 * 多主题 Mermaid 客户端初始化
 *
 * 与 textmode 的 init.ts 逻辑一致，但配色按主题区分：
 *  - erudite  ：浅色 neutral / 暗色深灰双套，随 data-theme 自适应
 *  - paper    ：跟随 data-theme 的亮/暗双套配色
 *  - retypeset：暖色杂志风，亮/暗双套
 *
 * 逐图懒渲染：只有当 <pre class="mermaid"> 接近视口时才加载
 * mermaid 库并渲染该图，渲染完成后立即安装该图的灯箱。
 * 页面无 <pre class="mermaid"> 时不加载任何 mermaid 资源。
 */

import { installMermaidLightbox } from "../textmode/lightbox/mermaid";

export type ThemeMermaidStyle = "erudite" | "paper" | "retypeset";

declare global {
  interface Window {
    __themeMermaidReady?: Promise<MermaidModule>;
  }
}

type MermaidModule = typeof import("mermaid")["default"];

/** 提前渲染距离：图表距视口不足该值时开始渲染 */
const PRELOAD_MARGIN_PX = 600;

/**
 * 各类图统一按自然尺寸渲染（useMaxWidth: false）。
 *
 * 主题正文列宽有限（erudite ≈ 40rem），宽图（如多参与者的时序图）
 * 在 useMaxWidth: true 下会被压缩到 0.4 倍左右，文字不可辨认；
 * 关闭后按 16px 基准字号渲染，超宽部分由 pre.mermaid 横向滚动，
 * 也可点击灯箱查看全图。
 */
const naturalSize = { useMaxWidth: false };

const diagramSizeConfigs = {
  flowchart: naturalSize,
  sequence: naturalSize,
  gantt: naturalSize,
  journey: naturalSize,
  timeline: naturalSize,
  class: naturalSize,
  state: naturalSize,
  er: naturalSize,
  pie: naturalSize,
  requirement: naturalSize,
  architecture: naturalSize,
  mindmap: naturalSize,
  ishikawa: naturalSize,
  kanban: naturalSize,
  gitGraph: naturalSize,
  c4: naturalSize,
  sankey: naturalSize,
  packet: naturalSize,
  block: naturalSize,
  eventmodeling: naturalSize,
  treeView: naturalSize,
  radar: naturalSize,
  venn: naturalSize,
  "wardley-beta": naturalSize
};

function neutralPalette(): Record<string, string> {
  return {
    background: "transparent",
    primaryColor: "#ececec",
    primaryBorderColor: "#9e9e9e",
    primaryTextColor: "#333333",
    secondaryColor: "#e0e0e0",
    secondaryBorderColor: "#8d8d8d",
    secondaryTextColor: "#444444",
    tertiaryColor: "#f5f5f5",
    tertiaryBorderColor: "#9e9e9e",
    tertiaryTextColor: "#444444",
    lineColor: "#7b7b7b",
    textColor: "#3d3d3d",
    clusterBkg: "#f2f2f2",
    clusterBorder: "#b4b4b4",
    edgeLabelBackground: "#f5f5f5",
    noteBackgroundColor: "#f5f5f5",
    noteBorderColor: "#9e9e9e"
  };
}

/**
 * erudite 暗色配色：对齐 styles.css 的 --gray-* 暗色梯度
 * （#111 页面底 → #3a 边框）。此前暗色下仍用浅色 neutral 配色，
 * cluster 底 #f2f2f2 在深色页面上呈现为刺眼的浅灰大块，且节点
 * #ececec 与 cluster 底几乎同色，整体看起来就是一块纯色。
 */
function eruditeDarkPalette(): Record<string, string> {
  return {
    background: "transparent",
    primaryColor: "#2a2a2a",
    primaryBorderColor: "#5a5a5a",
    primaryTextColor: "#ececec",
    secondaryColor: "#222222",
    secondaryBorderColor: "#666666",
    secondaryTextColor: "#d9d9d9",
    tertiaryColor: "#191919",
    tertiaryBorderColor: "#5a5a5a",
    tertiaryTextColor: "#d9d9d9",
    lineColor: "#6e6e6e",
    textColor: "#e0e0e0",
    clusterBkg: "#191919",
    clusterBorder: "#3a3a3a",
    edgeLabelBackground: "#191919",
    noteBackgroundColor: "#191919",
    noteBorderColor: "#5a5a5a"
  };
}

function paperPalette(dark: boolean): Record<string, string> {
  if (dark) {
    return {
      background: "#212737",
      primaryColor: "#2d3550",
      primaryBorderColor: "#566386",
      primaryTextColor: "#eaedf3",
      secondaryColor: "#343f60",
      secondaryBorderColor: "#566386",
      secondaryTextColor: "#afb9ca",
      tertiaryColor: "#283048",
      tertiaryBorderColor: "#566386",
      tertiaryTextColor: "#afb9ca",
      lineColor: "#566386",
      textColor: "#eaedf3",
      clusterBkg: "#283048",
      clusterBorder: "#566386",
      edgeLabelBackground: "#283048"
    };
  }
  return {
    background: "#fdfdfd",
    primaryColor: "#e8f1f8",
    primaryBorderColor: "#006cac",
    primaryTextColor: "#282728",
    secondaryColor: "#eef6fb",
    secondaryBorderColor: "#5fa8d3",
    secondaryTextColor: "#282728",
    tertiaryColor: "#f4f9fc",
    tertiaryBorderColor: "#5fa8d3",
    tertiaryTextColor: "#282728",
    lineColor: "#6b7280",
    textColor: "#282728",
    clusterBkg: "#f4f9fc",
    clusterBorder: "#5fa8d3",
    edgeLabelBackground: "#f4f9fc"
  };
}

function retypesetPalette(dark: boolean): Record<string, string> {
  if (dark) {
    return {
      background: "#1a1815",
      primaryColor: "#262320",
      primaryBorderColor: "#5c554c",
      primaryTextColor: "#d8d2c8",
      secondaryColor: "#2d2a26",
      secondaryBorderColor: "#5c554c",
      secondaryTextColor: "#c4bdb1",
      tertiaryColor: "#221f1c",
      tertiaryBorderColor: "#5c554c",
      tertiaryTextColor: "#c4bdb1",
      lineColor: "#6e675d",
      textColor: "#d8d2c8",
      clusterBkg: "#221f1c",
      clusterBorder: "#5c554c",
      edgeLabelBackground: "#221f1c"
    };
  }
  return {
    background: "#faf9f6",
    primaryColor: "#f1ede5",
    primaryBorderColor: "#a89e90",
    primaryTextColor: "#2f2a26",
    secondaryColor: "#eae5da",
    secondaryBorderColor: "#b5aa99",
    secondaryTextColor: "#4a4239",
    tertiaryColor: "#f5f2ec",
    tertiaryBorderColor: "#a89e90",
    tertiaryTextColor: "#4a4239",
    lineColor: "#8a8072",
    textColor: "#2f2a26",
    clusterBkg: "#f5f2ec",
    clusterBorder: "#b5aa99",
    edgeLabelBackground: "#f5f2ec"
  };
}

function ensureMermaid(style: ThemeMermaidStyle): Promise<MermaidModule> {
  if (!window.__themeMermaidReady) {
    window.__themeMermaidReady = import("mermaid").then((m) => {
      const mermaid = (m.default ?? m) as MermaidModule;

      if (style === "erudite") {
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        mermaid.initialize({
          startOnLoad: false,
          theme: dark ? "base" : "neutral",
          fontFamily: "inherit",
          securityLevel: "loose",
          themeVariables: dark ? eruditeDarkPalette() : neutralPalette(),
          ...diagramSizeConfigs
        });
      } else if (style === "paper") {
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          fontFamily: "inherit",
          securityLevel: "loose",
          themeVariables: paperPalette(dark),
          ...diagramSizeConfigs
        });
      } else {
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          fontFamily: "inherit",
          securityLevel: "loose",
          themeVariables: retypesetPalette(dark),
          ...diagramSizeConfigs
        });
      }

      return mermaid;
    });
  }

  return window.__themeMermaidReady;
}

/**
 * 懒渲染页面内所有未处理的 mermaid 图。
 *
 * 每个图由独立 IntersectionObserver 监测，接近视口时进入
 * 渲染队列；队列串行消费，避免并发 mermaid.render 竞争。
 * 跳滚越过的图由滚动守卫补入队（IO 对被越过的元素不触发）。
 * mermaid 库在第一张图需要渲染时才动态加载。
 * 每张图渲染完成后立即安装它的灯箱（无需等待整页渲染完）。
 */
export function initThemeMermaid(style: ThemeMermaidStyle): void {
  const diagrams = document.querySelectorAll<HTMLElement>("pre.mermaid:not([data-processed])");

  if (diagrams.length === 0) {
    return;
  }

  const queue: HTMLElement[] = [];
  let rendering = false;

  const processQueue = async (): Promise<void> => {
    if (rendering) return;
    rendering = true;

    try {
      const mermaid = await ensureMermaid(style);

      while (queue.length > 0) {
        const diagram = queue.shift();

        if (!diagram || diagram.getAttribute("data-processed") === "true") {
          continue;
        }

        const id = `tmermaid-${Math.random().toString(36).slice(2, 11)}`;

        try {
          const { svg } = await mermaid.render(id, diagram.textContent ?? "");
          diagram.innerHTML = svg;
          diagram.setAttribute("data-processed", "true");
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          diagram.innerHTML = `<div class="mermaid-error">Diagram error: ${message}</div>`;
          diagram.setAttribute("data-processed", "true");
        }

        // 安装该图的灯箱（root 取父节点：installMermaidLightbox 只扫描后代）
        installMermaidLightbox(diagram.parentElement ?? document);
      }
    } finally {
      rendering = false;
    }
  };

  const enqueue = (diagram: HTMLElement): boolean => {
    if (diagram.dataset.queued === "true") return false;
    diagram.dataset.queued = "true";
    observer.unobserve(diagram);
    queue.push(diagram);
    return true;
  };

  const observer = new IntersectionObserver(
    (entries) => {
      let queued = false;

      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        if (enqueue(entry.target as HTMLElement)) {
          queued = true;
        }
      }

      if (queued) {
        void processQueue();
      }
    },
    { rootMargin: `${PRELOAD_MARGIN_PX}px 0px` }
  );

  for (const diagram of diagrams) {
    observer.observe(diagram);
  }

  // 跳滚守卫：瞬间跳滚（End 键 / 目录锚点 / 拖动滚动条）会越过中间的图，
  // IO 只在元素与视口（含 rootMargin）相交时触发，被越过的图
  // 永远不会进入渲染队列。每次滚动（rAF 节流）时把所有已滚过
  // 视口顶端的未渲染图直接入队，与 lazy-list-client 的守卫一致。
  let ticking = false;

  const activatePassed = (): void => {
    let queued = false;
    let allDone = true;

    for (const diagram of diagrams) {
      if (diagram.getAttribute("data-processed") === "true") continue;
      allDone = false;

      if (diagram.dataset.queued !== "true" && diagram.getBoundingClientRect().top < 0) {
        if (enqueue(diagram)) {
          queued = true;
        }
      }
    }

    if (queued) {
      void processQueue();
    }

    if (allDone) {
      window.removeEventListener("scroll", onScroll);
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

  // 页面加载时可能已停在文章中部（刷新保留滚动位置）
  activatePassed();
}
