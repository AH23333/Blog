/**
 * Mermaid 客户端初始化模块。
 *
 * 在浏览器中动态加载 mermaid.js，渲染所有 <pre class="mermaid"> 元素为 SVG。
 * 使用 Tokyo Night 暗色主题配色。
 *
 * 注意：不使用模块级 initialized 标志，因为浏览器可能缓存模块，
 * 导致刷新页面后标志位仍为 true 而跳过渲染。
 * 改用 [data-processed] 属性在 DOM 层面去重，mermaid 初始化状态用 window 全局标记。
 */

declare global {
  interface Window {
    __mermaidReady?: Promise<typeof import("mermaid")["default"]>;
  }
}

function ensureMermaid() {
  if (!window.__mermaidReady) {
    window.__mermaidReady = import("mermaid").then((m) => {
      const mermaid = m.default || m;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        htmlLabels: false,
        themeVariables: {
          darkMode: true,
          background: "#0c0d10",
          primaryColor: "#7aa2f7",
          primaryBorderColor: "#414868",
          primaryTextColor: "#c0caf5",
          secondaryColor: "#414868",
          secondaryBorderColor: "#565f89",
          secondaryTextColor: "#a9b1d6",
          tertiaryColor: "#1a1b26",
          tertiaryBorderColor: "#414868",
          tertiaryTextColor: "#a9b1d6",
          lineColor: "#565f89",
          textColor: "#c0caf5",
          mainBkg: "#0c0d10",
          nodeBorder: "#414868",
          clusterBkg: "#1a1b26",
          clusterBorder: "#414868",
          titleColor: "#7dcfff",
          edgeLabelBackground: "#1a1b26",
          nodeTextColor: "#c0caf5",
          pie1: "#7aa2f7",
          pie2: "#7dcfff",
          pie3: "#9ece6a",
          pie4: "#e0af68",
          pie5: "#bb9af7",
          pie6: "#f7768e",
          pie7: "#73daca",
          pie8: "#ff9e64",
          pie9: "#2ac3de",
          pie10: "#ff007c",
          pie11: "#c0caf5",
          pie12: "#565f89"
        },
        fontFamily: "monospace",
        securityLevel: "loose"
      });
      return mermaid;
    });
  }
  return window.__mermaidReady;
}

export async function initMermaidDiagrams(): Promise<void> {
  // 从 DOM 获取未处理的图表，[data-processed] 属性在 DOM 层面去重
  const diagrams = document.querySelectorAll<HTMLElement>("pre.mermaid:not([data-processed])");
  if (diagrams.length === 0) return;

  const mermaid = await ensureMermaid();

  for (const diagram of diagrams) {
    const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
    try {
      const { svg } = await mermaid.render(id, diagram.textContent || "");
      diagram.innerHTML = svg;
      diagram.setAttribute("data-processed", "true");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      diagram.innerHTML =
        `<div style="color:var(--ansi-red, #f7768e);padding:1rem;border:1px solid var(--ansi-red, #f7768e);` +
        `font-family:var(--text-font, monospace);font-size:var(--text-size, 14px);">` +
        `Diagram error: ${message}</div>`;
      diagram.setAttribute("data-processed", "true");
    }
  }
}
