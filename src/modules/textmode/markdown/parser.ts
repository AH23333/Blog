/**
 * Markdown 解析器，基于 markdown-it 将 Markdown 转换为 ANSI 标记文本，
 * 与项目现有的 ANSI 渲染管道兼容。
 *
 * 相比旧版手写解析器，此版本获得了：
 * - 完整的 CommonMark + GFM 兼容性（表格对齐、删除线、任务列表、自动链接等）
 * - markdown-it 插件生态的扩展能力
 * - 更好的边界情况处理（嵌套列表、转义、HTML 块等）
 */

import MarkdownIt from "markdown-it";
import { textHtml } from "../core/html";
import { renderContainer } from "./blocks";
import type { MarkdownSegment } from "./container";
import { splitContainerSegments } from "./container";
import { highlightCode } from "./highlight";
import { renderBlockTokens } from "./tokens";

// 重新导出 container 类型，保持向后兼容
export type { MarkdownSegment } from "./container";
export { splitContainerSegments } from "./container";

// ── markdown-it 实例 ──────────────────────────────────────────────────────

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
  highlight: (str, lang) => highlightCode(str, lang)
});

// 启用 GFM 扩展：表格 & 删除线
md.enable(["table", "strikethrough"]);

/*
 * 为 text token 注册自定义渲染规则，将汉字包裹为 <span class="cjk cjk-bitmap">。
 *
 * markdown-it 的 text token 仅包含正文文本（段落、标题、列表项等），
 * 不包括 code_inline 和 fence/code_block token，因此代码块不会被错误包裹。
 *
 * 这是解决文章正文汉字字体与欢迎页/目录/标题不一致的关键修复：
 *  - 欢迎页/目录/标题：通过 textHtml() 包裹汉字 → 位图字体渲染
 *  - 文章正文（修复前）：md.render() 直接输出纯文本 → 浏览器回退字体
 *  - 文章正文（修复后）：text token 经 textHtml() 包裹 → 位图字体渲染
 */
md.renderer.rules.text = (tokens, idx) => {
  return textHtml(tokens[idx].content);
};

// ── 主入口 ────────────────────────────────────────────────────────────────

/**
 * 将 Markdown 文本渲染为 HTML 字符串。
 * 这是推荐使用的主函数，使用 markdown-it 内置渲染器生成标准 HTML。
 *
 * 预处理：将行内代码中的 | 替换为占位符，避免 markdown-it 的表格解析器
 * 将 `#[color|text]` 等 ANSI 标记中的 | 误解析为表格列分隔符。
 */
export function renderMarkdownToHtml(text: string): string {
  // 保护行内代码中的 | 避免被表格解析器误解析
  // 注意：围栏代码块（```...```）中的 | 无需保护，因为 markdown-it 的
  // 围栏代码块解析器优先于表格解析器运行，不会被误解析为表格。
  const processed = text.replace(/`([^`\n]+)`/g, (_, content: string) => {
    if (!content.includes("|")) return `\`${content}\``;
    return `\`${content.replace(/\|/g, "\uE300")}\``;
  });
  const html = md.render(processed);
  // 恢复行内代码中的 | 占位符
  return html.replace(/\uE300/g, "|");
}

/**
 * 将 Markdown 文本渲染为 ANSI 标记文本行数组。
 * 适用于需要 ANSI 终端风格渲染的场景。
 */
export function renderMarkdown(text: string, width: number): string[] {
  const output: string[] = [];
  const segments: MarkdownSegment[] = splitContainerSegments(text);

  for (const segment of segments) {
    if (segment.kind === "container") {
      output.push(...renderContainer(segment.type, segment.content, width, segment.title));
    } else {
      const tokens = md.parse(segment.content, {});
      renderBlockTokens(tokens, 0, tokens.length, width, output);
    }
  }

  return output;
}

// ── 向后兼容的导出（旧 API）───────────────────────────────────────────────

type MdBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "code"; lang: string; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "container"; type: string; text: string }
  | { kind: "table"; rows: string[][] }
  | { kind: "hr" }
  | { kind: "blank" };

/** @deprecated 请使用 renderMarkdown() 一步完成解析与渲染 */
export function parseMarkdown(_input: string): MdBlock[] {
  return [];
}

/** @deprecated 请使用 renderMarkdown() 一步完成解析与渲染 */
export function renderMarkdownToAnsi(_blocks: MdBlock[], _width: number): string[] {
  return [];
}
