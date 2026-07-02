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
import { renderBlockTokens } from "./tokens";

// 重新导出 container 类型，保持向后兼容
export type { MarkdownSegment } from "./container";
export { splitContainerSegments } from "./container";

// ── markdown-it 实例 ──────────────────────────────────────────────────────

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false
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

// ── 表格分隔行规范化 ──────────────────────────────────────────────────────

/**
 * 规范化表格分隔行，使其列数与表头行一致。
 *
 * 背景：ANSI 行内标记（如 #[C|text]）中包含 | 字符，在 processAnsiInlineMarkup
 * 处理之后这些 | 已被移除。但若原始 Markdown 内容中为"补偿"这些 | 而在分隔行
 * 中添加了额外的 |---| 列，则会导致分隔行列数多于表头行，破坏表格解析。
 *
 * 此函数在 ANSI 标记处理之后、markdown-it 解析之前调用，确保分隔行列数与
 * 表头行一致。支持任意数量的 - 符号（包括单破折号 |-|），保持对齐标记（:）。
 *
 * 示例：
 *   输入：
 *     | A | B |
 *     | --- | --- | --- |
 *     | 1 | 2 |
 *   输出：
 *     | A | B |
 *     | --- | --- |
 *     | 1 | 2 |
 */
function normalizeTableSeparators(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  // 分隔行检测正则：以 | 开头，仅包含 |、-、:、空格（不含 $ 锚点，
  // 因为需要匹配多列表格如 |---|----|，而 | 不在 [\s\-:] 字符类中）。
  // 使用 /^\|[\s\-:]+\|/ 匹配前缀即可判断是否为分隔行。
  const sepRowRegex = /^\|[\s\-:]+\|/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 检查当前行是否为潜在的表头行（以 | 开头，非分隔行）
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
      result.push(line);
      continue;
    }

    // 分隔行：整行仅由 |、-、:、空格组成
    if (sepRowRegex.test(trimmed)) {
      result.push(line);
      continue;
    }

    // 检查下一行是否存在且为分隔行
    if (i + 1 >= lines.length) {
      result.push(line);
      continue;
    }

    const nextLine = lines[i + 1];
    const nextTrimmed = nextLine.trim();
    if (!nextTrimmed.startsWith("|") || !sepRowRegex.test(nextTrimmed)) {
      result.push(line);
      continue;
    }

    // 计算表头行列数（去掉首尾 | 后按 | 分割）
    const headerCells = trimmed.slice(1, -1).split("|");
    const headerColCount = headerCells.length;

    // 计算分隔行列数
    const sepCells = nextTrimmed.slice(1, -1).split("|");
    const sepColCount = sepCells.length;

    if (sepColCount === headerColCount) {
      // 列数一致，无需处理
      result.push(line);
      continue;
    }

    // 规范化分隔行：截断或补齐至与表头列数一致
    let normalizedSepCells: string[];
    if (sepColCount > headerColCount) {
      // 分隔行列数过多：截断
      normalizedSepCells = sepCells.slice(0, headerColCount);
    } else {
      // 分隔行列数不足：补齐 ---
      normalizedSepCells = [...sepCells];
      while (normalizedSepCells.length < headerColCount) {
        normalizedSepCells.push("---");
      }
    }

    const normalizedSep = `|${normalizedSepCells.join("|")}|`;

    result.push(line);
    result.push(normalizedSep);
    i++; // 跳过原始分隔行
  }

  return result.join("\n");
}

// ── 主入口 ────────────────────────────────────────────────────────────────

/**
 * 将 Markdown 文本渲染为 HTML 字符串。
 * 这是推荐使用的主函数，使用 markdown-it 内置渲染器生成标准 HTML。
 *
 * 预处理：
 * 1. 规范化表格分隔行，使其列数与表头一致（解决 ANSI 标记中 | 导致的列数不匹配）
 * 2. 将行内代码中的 | 替换为占位符，避免 markdown-it 的表格解析器
 *    将 `#[color|text]` 等 ANSI 标记中的 | 误解析为表格列分隔符。
 */
export function renderMarkdownToHtml(text: string): string {
  // 规范化表格分隔行：确保分隔行列数与表头一致
  // 必须在 ANSI 标记处理（processAnsiInlineMarkup）之后调用，
  // 因为 ANSI 标记中的 | 已被替换为占位符，表头和数据行的列数已正确。
  const normalized = normalizeTableSeparators(text);

  // 保护行内代码中的 | 避免被表格解析器误解析
  // 注意：围栏代码块（```...```）中的 | 无需保护，因为 markdown-it 的
  // 围栏代码块解析器优先于表格解析器运行，不会被误解析为表格。
  const processed = normalized.replace(/`([^`\n]+)`/g, (_, content: string) => {
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
