/**
 * 多主题 Mermaid 客户端初始化
 *
 * 与 textmode 的 init.ts 逻辑一致，但配色按主题区分：
 *  - erudite  ：中性灰，light/dark 自适应（"neutral" 基础主题）
 *  - paper    ：跟随 data-theme 的亮/暗双套配色
 *  - retypeset：暖色杂志风
 *
 * 页面无 <pre class="mermaid"> 时直接返回，不加载 mermaid 资源。
 */

export type ThemeMermaidStyle = "erudite" | "paper" | "retypeset";

declare global {
  interface Window {
    __themeMermaidReady?: Promise<MermaidModule>;
  }
}

type MermaidModule = typeof import("mermaid")["default"];

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
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          fontFamily: "inherit",
          securityLevel: "loose",
          themeVariables: neutralPalette()
        });
      } else if (style === "paper") {
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          fontFamily: "inherit",
          securityLevel: "loose",
          themeVariables: paperPalette(dark)
        });
      } else {
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          fontFamily: "inherit",
          securityLevel: "loose",
          themeVariables: retypesetPalette(dark)
        });
      }

      return mermaid;
    });
  }

  return window.__themeMermaidReady;
}

/** 渲染页面内所有未处理的 mermaid 图 */
export async function initThemeMermaid(style: ThemeMermaidStyle): Promise<void> {
  const diagrams = document.querySelectorAll<HTMLElement>("pre.mermaid:not([data-processed])");

  if (diagrams.length === 0) {
    return;
  }

  const mermaid = await ensureMermaid(style);

  for (const diagram of diagrams) {
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
  }
}
