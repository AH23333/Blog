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
import type Token from "markdown-it/lib/token.mjs";
import { textHtml } from "../core/html";

// ── Box-drawing 字符 ──────────────────────────────────────────────────────

const boxChars = {
  tl: "\u250c",
  tr: "\u2510",
  bl: "\u2514",
  br: "\u2518",
  h: "\u2500",
  v: "\u2502",
  lt: "\u251c",
  rt: "\u2524",
  tt: "\u252c",
  bt: "\u2534",
  cr: "\u253c"
};

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

// ── ANSI 颜色辅助 ─────────────────────────────────────────────────────────

function ansiText(text: string, color: string): string {
  return `#[${color}|${text}]`;
}

function expandTabs(text: string, tabWidth = 4): string {
  return text.replace(/\t/g, " ".repeat(tabWidth));
}

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

// ── ::: 容器预处理 ────────────────────────────────────────────────────────

export type MarkdownSegment =
  | { kind: "text"; content: string }
  | { kind: "container"; type: string; title?: string; content: string };

/**
 * 将文本按 :::type / ::: 分割为普通文本段和容器段。
 * 支持 :::type、:::type[title]、:::type title 三种格式。
 * 代码块（```...```）内的 ::: 行不会被当作容器标记。
 */
export function splitContainerSegments(text: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];

  // 第一步：保护代码块，将 ```...``` 替换为占位符，避免代码块内的 ::: 被误解析
  const codeBlocks: string[] = [];
  const protectedText = text.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `\uE200CD${codeBlocks.length - 1}\uE200`;
  });

  const lines = protectedText.split("\n");
  let cursor = 0;
  const textLines: string[] = [];

  while (cursor < lines.length) {
    // 支持 :::type、:::type[title]、:::type title 三种格式
    const containerMatch = lines[cursor].match(/^:::(\w+)(?:\s*\[([^\]]*)\])?(?:\s+(.*))?$/);

    if (!containerMatch) {
      textLines.push(lines[cursor]);
      cursor++;
      continue;
    }

    // 遇到容器开始标记，先提交之前的文本
    if (textLines.length > 0) {
      segments.push({ kind: "text", content: textLines.join("\n") });
      textLines.length = 0;
    }

    const type = containerMatch[1];
    const title = containerMatch[2] || containerMatch[3] || undefined;
    const containerLines: string[] = [];
    cursor++;

    while (cursor < lines.length && !lines[cursor].match(/^:::\s*$/)) {
      containerLines.push(lines[cursor]);
      cursor++;
    }

    if (cursor < lines.length) cursor++; // 跳过 ::: 结束标记

    segments.push({ kind: "container", type, title, content: containerLines.join("\n") });
  }

  if (textLines.length > 0) {
    segments.push({ kind: "text", content: textLines.join("\n") });
  }

  // 第二步：恢复代码块占位符，并过滤空文本段
  return segments
    .map((segment) => {
      let content = segment.content;
      for (let i = 0; i < codeBlocks.length; i++) {
        content = content.replaceAll(`\uE200CD${i}\uE200`, codeBlocks[i]);
      }
      return { ...segment, content };
    })
    .filter((segment) => segment.kind !== "text" || segment.content.trim().length > 0);
}

// ── 块级 Token 渲染 ───────────────────────────────────────────────────────

function renderBlockTokens(tokens: Token[], start: number, end: number, width: number, output: string[]): void {
  let i = start;

  while (i < end) {
    const token = tokens[i];

    switch (token.type) {
      case "heading_open": {
        const level = parseInt(token.tag.slice(1), 10);
        const closeIdx = findClosingToken(tokens, i, "heading_close");
        const content = renderInlineTokens(tokens[i + 1]);
        output.push(...renderHeading(level, content, width));
        i = closeIdx + 1;
        break;
      }

      case "paragraph_open": {
        const closeIdx = findClosingToken(tokens, i, "paragraph_close");
        const content = renderInlineTokens(tokens[i + 1]);
        if (content.trim()) {
          output.push(...renderParagraph(content));
        }
        i = closeIdx + 1;
        break;
      }

      case "blockquote_open": {
        const closeIdx = findClosingToken(tokens, i, "blockquote_close");
        const innerOutput: string[] = [];
        renderBlockTokens(tokens, i + 1, closeIdx, Math.max(width - 4, 20), innerOutput);
        for (const line of innerOutput) {
          output.push(line ? `  > ${line}` : "  >");
        }
        i = closeIdx + 1;
        break;
      }

      case "bullet_list_open":
      case "ordered_list_open": {
        const isOrdered = token.type === "ordered_list_open";
        const closeType = isOrdered ? "ordered_list_close" : "bullet_list_close";
        const closeIdx = findClosingToken(tokens, i, closeType);
        let itemNum = 0;
        let j = i + 1;

        while (j < closeIdx && tokens[j].type === "list_item_open") {
          itemNum++;
          const itemClose = findClosingToken(tokens, j, "list_item_close");
          const marker = isOrdered ? `${itemNum}.` : "-";
          const itemContent = renderListItemContent(tokens, j + 1, itemClose, width);
          output.push(...itemContent.map((l) => `  ${marker} ${l}`));
          j = itemClose + 1;
        }

        i = closeIdx + 1;
        break;
      }

      case "fence":
      case "code_block": {
        const lang = token.info || "";
        output.push(...renderCodeBlock(lang, token.content, width));
        i++;
        break;
      }

      case "table_open": {
        const closeIdx = findClosingToken(tokens, i, "table_close");
        const rows = extractTableRows(tokens, i + 1, closeIdx);
        output.push(...renderTable(rows, width));
        i = closeIdx + 1;
        break;
      }

      case "hr": {
        output.push(boxChars.h.repeat(Math.min(width, 60)));
        i++;
        break;
      }

      case "html_block": {
        const trimmed = token.content.trim();
        if (trimmed) {
          output.push(trimmed);
        }
        i++;
        break;
      }

      default:
        i++;
        break;
    }
  }
}

// ── 内联 Token 渲染 ───────────────────────────────────────────────────────

function renderInlineTokens(token: Token | undefined): string {
  if (!token?.children || token.children.length === 0) return "";

  return walkInlineChildren(token.children);
}

function walkInlineChildren(children: Token[]): string {
  let result = "";
  let i = 0;

  while (i < children.length) {
    const token = children[i];

    switch (token.type) {
      case "text":
        result += token.content;
        i++;
        break;

      case "strong_open": {
        const end = findClosingToken(children, i, "strong_close");
        result += ansiText(walkInlineChildren(children.slice(i + 1, end)), "W");
        i = end + 1;
        break;
      }

      case "em_open": {
        const end = findClosingToken(children, i, "em_close");
        result += ansiText(walkInlineChildren(children.slice(i + 1, end)), "C");
        i = end + 1;
        break;
      }

      case "s_open": {
        const end = findClosingToken(children, i, "s_close");
        result += ansiText(walkInlineChildren(children.slice(i + 1, end)), "m");
        i = end + 1;
        break;
      }

      case "code_inline":
        result += ansiText(token.content, "G");
        i++;
        break;

      case "link_open": {
        const end = findClosingToken(children, i, "link_close");
        result += ansiText(walkInlineChildren(children.slice(i + 1, end)), "C");
        i = end + 1;
        break;
      }

      case "image":
        result += token.content || "[image]";
        i++;
        break;

      case "softbreak":
        result += " ";
        i++;
        break;

      case "hardbreak":
        result += "\n";
        i++;
        break;

      case "html_inline":
        if (/<br\s*\/?>/i.test(token.content)) {
          result += "\n";
        } else {
          result += token.content;
        }
        i++;
        break;

      default:
        i++;
        break;
    }
  }

  return result;
}

// ── Token 辅助 ─────────────────────────────────────────────────────────────

/**
 * 查找与 start 处 open token 匹配的 close token 索引。
 */
function findClosingToken(tokens: Token[], start: number, closeType: string): number {
  const openType = tokens[start].type;
  let depth = 1;

  for (let i = start + 1; i < tokens.length; i++) {
    if (tokens[i].type === openType) {
      depth++;
    } else if (tokens[i].type === closeType) {
      depth--;
      if (depth === 0) return i;
    }
  }

  return tokens.length - 1;
}

// ── 列表项内容提取 ────────────────────────────────────────────────────────

function renderListItemContent(tokens: Token[], start: number, end: number, width: number): string[] {
  const lines: string[] = [];

  for (let i = start; i < end; i++) {
    const token = tokens[i];

    if (token.type === "paragraph_open") {
      const closeIdx = findClosingToken(tokens, i, "paragraph_close");
      const content = renderInlineTokens(tokens[i + 1]);
      if (content.trim()) {
        lines.push(content);
      }
      i = closeIdx;
    } else if (token.type === "bullet_list_open" || token.type === "ordered_list_open") {
      // 嵌套列表
      const closeType = token.type === "ordered_list_open" ? "ordered_list_close" : "bullet_list_close";
      const closeIdx = findClosingToken(tokens, i, closeType);
      const innerOutput: string[] = [];
      renderBlockTokens(tokens, i, closeIdx + 1, width, innerOutput);
      for (const line of innerOutput) {
        lines.push(line);
      }
      i = closeIdx;
    } else if (token.type === "fence" || token.type === "code_block") {
      const innerLines = renderCodeBlock(token.info || "", token.content, width);
      for (const line of innerLines) {
        lines.push(line);
      }
    }
  }

  return lines;
}

// ── 表格提取 ──────────────────────────────────────────────────────────────

function extractTableRows(tokens: Token[], start: number, end: number): string[][] {
  const rows: string[][] = [];

  for (let i = start; i < end; i++) {
    const token = tokens[i];

    if (token.type === "tr_open") {
      const trClose = findClosingToken(tokens, i, "tr_close");
      const cells: string[] = [];

      for (let j = i + 1; j < trClose; j++) {
        if (tokens[j].type === "th_open" || tokens[j].type === "td_open") {
          const cellClose = findClosingToken(tokens, j, tokens[j].type === "th_open" ? "th_close" : "td_close");
          cells.push(renderInlineTokens(tokens[j + 1]));
          j = cellClose;
        }
      }

      rows.push(cells);
      i = trClose;
    }
  }

  return rows;
}

// ── 块级渲染函数 ──────────────────────────────────────────────────────────

function renderHeading(level: number, text: string, width: number): string[] {
  const lines: string[] = [];
  const color = level <= 2 ? "Y" : level <= 4 ? "y" : "c";

  lines.push("");

  if (level === 1) {
    const sep = boxChars.h.repeat(Math.min(width, 60));
    lines.push(sep);
    lines.push(`  ${ansiText(text, color)}`);
    lines.push(sep);
  } else if (level === 2) {
    lines.push(`  ~ ${ansiText(text, color)}`);
    lines.push(boxChars.h.repeat(Math.min(width - 4, 40)));
  } else {
    lines.push(`    ${ansiText(text, color)}`);
  }

  return lines;
}

function renderParagraph(text: string): string[] {
  return text.split("\n");
}

function renderCodeBlock(lang: string, text: string, width: number): string[] {
  const lines: string[] = [];
  const innerWidth = Math.min(width - 4, 60);

  const header = lang ? ` ${lang} ` : " code ";
  const headerPad = Math.max(0, innerWidth - header.length - 3);
  const topBorder = `${boxChars.tl}${boxChars.h}${header}${boxChars.h.repeat(headerPad)}${boxChars.tr}`;
  lines.push(ansiText(topBorder, "c"));

  for (const codeLine of text.split("\n")) {
    lines.push(`\u200B${textHtml(expandTabs(codeLine))}`);
  }

  const bottomBorder = boxChars.bl + boxChars.h.repeat(innerWidth - 2) + boxChars.br;
  lines.push(ansiText(bottomBorder, "c"));

  return lines;
}

function renderContainer(type: string, text: string, width: number, title?: string): string[] {
  const lines: string[] = [];
  const innerWidth = Math.min(width - 4, 60);

  const styles: Record<string, { color: string; label: string }> = {
    important: { color: "Y", label: "IMPORTANT" },
    note: { color: "C", label: "NOTE" },
    tip: { color: "G", label: "TIP" },
    warning: { color: "R", label: "WARNING" }
  };

  const style = styles[type] || { color: "W", label: type.toUpperCase() };
  const displayLabel = title ? `${style.label}: ${title}` : style.label;
  const labelPad = Math.max(0, innerWidth - displayLabel.length - 5);
  const topBorder = `${boxChars.tl}${boxChars.h} ${displayLabel} ${boxChars.h.repeat(labelPad)}${boxChars.tr}`;
  lines.push(ansiText(topBorder, style.color));

  for (const line of text.split("\n")) {
    lines.push(textHtml(expandTabs(line)));
  }

  const bottomBorder = boxChars.bl + boxChars.h.repeat(innerWidth - 2) + boxChars.br;
  lines.push(ansiText(bottomBorder, style.color));

  return lines;
}

function renderTable(rows: string[][], width: number): string[] {
  const lines: string[] = [];
  if (rows.length === 0) return lines;

  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidths: number[] = [];

  for (let i = 0; i < colCount; i++) {
    const maxLen = Math.max(...rows.map((r) => (r[i] || "").length));
    colWidths.push(Math.min(maxLen + 2, 18));
  }

  const totalWidth = colWidths.reduce((a, b) => a + b + 1, 1);
  const scale = totalWidth > width ? width / totalWidth : 1;
  const finalWidths = colWidths.map((w) => Math.max(3, Math.floor(w * scale)));

  const topBorder = boxChars.tl + finalWidths.map((w) => boxChars.h.repeat(w)).join(boxChars.tt) + boxChars.tr;
  const midBorder = boxChars.lt + finalWidths.map((w) => boxChars.h.repeat(w)).join(boxChars.cr) + boxChars.rt;
  const bottomBorder = boxChars.bl + finalWidths.map((w) => boxChars.h.repeat(w)).join(boxChars.bt) + boxChars.br;

  lines.push(topBorder);

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((cell, j) => {
      const w = finalWidths[j] || 10;
      const truncated = cell.length > w - 1 ? cell.slice(0, w - 1) : cell;
      const pad = Math.max(0, w - truncated.length - 1);
      return ` ${truncated}${" ".repeat(pad)}`;
    });

    lines.push(boxChars.v + cells.join(boxChars.v) + boxChars.v);

    if (i === 0) {
      lines.push(midBorder);
    }
  }

  lines.push(bottomBorder);
  return lines;
}
