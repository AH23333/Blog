/**
 * 简易 Markdown 解析器，将 Markdown 转换为 ANSI 标记文本，
 * 与项目现有的 ANSI 渲染管道兼容。
 *
 * 支持的语法：
 * - # 标题 (1-6级)
 * - **粗体** / <strong> 粗体
 * - *斜体* / <i> 斜体
 * - `代码`
 * - [链接](url)
 * - > 引用
 * - - 无序列表 / 1. 有序列表
 * - ``` 代码块
 * - :::type 容器 (important/note/tip/warning)
 * - | 表格
 * - --- 分隔线
 * - <br /> 换行
 */

import { textHtml } from "../core/html";

const boxChars = {
  tl: "\u250c", tr: "\u2510", bl: "\u2514", br: "\u2518",
  h: "\u2500", v: "\u2502", lt: "\u251c", rt: "\u2524",
  tt: "\u252c", bt: "\u2534", cr: "\u253c"
};

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

// ── 解析 ──────────────────────────────────────────────────────────────────

export function parseMarkdown(input: string): MdBlock[] {
  const lines = input.split("\n");
  const blocks: MdBlock[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const line = lines[cursor];

    // 空行
    if (line.trim() === "") {
      blocks.push({ kind: "blank" });
      cursor++;
      continue;
    }

    // 标题 # ## ### ...
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ kind: "heading", level: headingMatch[1].length, text: headingMatch[2].trim() });
      cursor++;
      continue;
    }

    // 分隔线 --- *** ___
    if (/^[-*_]{3,}\s*$/.test(line)) {
      blocks.push({ kind: "hr" });
      cursor++;
      continue;
    }

    // 代码块 ```
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      cursor++;
      while (cursor < lines.length && !lines[cursor].trimStart().startsWith("```")) {
        codeLines.push(lines[cursor]);
        cursor++;
      }
      if (cursor < lines.length) cursor++; // skip closing ```
      blocks.push({ kind: "code", lang, text: codeLines.join("\n") });
      continue;
    }

    // 容器 :::type
    const containerMatch = line.match(/^:::(\w+)$/);
    if (containerMatch) {
      const type = containerMatch[1];
      const containerLines: string[] = [];
      cursor++;
      while (cursor < lines.length && !lines[cursor].match(/^:::\s*$/)) {
        containerLines.push(lines[cursor]);
        cursor++;
      }
      if (cursor < lines.length) cursor++; // skip closing :::
      blocks.push({ kind: "container", type, text: containerLines.join("\n") });
      continue;
    }

    // 引用 >
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (cursor < lines.length && lines[cursor].startsWith(">")) {
        quoteLines.push(lines[cursor].slice(1).trim());
        cursor++;
      }
      blocks.push({ kind: "quote", text: quoteLines.join("\n") });
      continue;
    }

    // 表格 (需要下一行是分隔线)
    if (line.includes("|") && cursor + 1 < lines.length &&
        lines[cursor + 1].match(/^\|?\s*[-:]{3,}\s*(\|\s*[-:]{3,}\s*)+\|?\s*$/)) {
      const tableLines: string[] = [];
      while (cursor < lines.length && lines[cursor].includes("|")) {
        tableLines.push(lines[cursor]);
        cursor++;
      }
      const rows = tableLines
        .filter((l) => !l.match(/^\|?\s*[-:]{3,}\s*(\|\s*[-:]{3,}\s*)+\|?\s*$/))
        .map((l) => l.split("|").map((c) => c.trim()).filter((c) => c.length > 0));
      if (rows.length > 0) {
        blocks.push({ kind: "table", rows });
      }
      continue;
    }

    // 列表
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    const olMatch = line.match(/^(\s*)(\d+)[.)]\s+(.+)$/);
    if (ulMatch || olMatch) {
      const ordered = !!olMatch;
      const items: string[] = [];
      const indent = (ulMatch?.[1] || olMatch?.[1] || "").length;
      const pattern = ordered
        ? /^(\s*)(\d+)[.)]\s+(.+)$/
        : /^(\s*)[-*+]\s+(.+)$/;

      while (cursor < lines.length) {
        const m = lines[cursor].match(pattern);
        if (m && m[1].length >= indent) {
          items.push(m[ordered ? 3 : 2]);
          cursor++;
        } else if (lines[cursor].trim() === "") {
          cursor++;
          break;
        } else {
          break;
        }
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    // 默认：段落（安全兜底，确保 cursor 一定前进）
    const paraLines: string[] = [];
    while (cursor < lines.length && lines[cursor].trim() !== "") {
      const l = lines[cursor];
      // 遇到下一个块级元素则停止
      if (/^#{1,6}\s/.test(l) || /^[-*_]{3,}\s*$/.test(l) ||
          l.trimStart().startsWith("```") || /^:::/.test(l) ||
          l.startsWith(">") || /^(\s*)[-*+]\s/.test(l) ||
          /^(\s*)(\d+)[.)]\s/.test(l)) {
        break;
      }
      // 表格行（有 | 且下一行是分隔线）也停止
      if (l.includes("|") && cursor + 1 < lines.length &&
          lines[cursor + 1].match(/^\|?\s*[-:]{3,}\s*(\|\s*[-:]{3,}\s*)+\|?\s*$/)) {
        break;
      }
      paraLines.push(l);
      cursor++;
    }
    if (paraLines.length > 0) {
      blocks.push({ kind: "paragraph", text: paraLines.join("\n") });
    } else {
      // 安全兜底：无法识别的行，作为段落处理并前进
      blocks.push({ kind: "paragraph", text: line });
      cursor++;
    }
  }

  return blocks;
}

// ── 渲染为 ANSI 标记文本 ─────────────────────────────────────────────────

export function renderMarkdownToAnsi(blocks: MdBlock[], width: number): string[] {
  const output: string[] = [];

  for (const block of blocks) {
    switch (block.kind) {
      case "heading":
        output.push(...renderHeading(block.level, block.text, width));
        break;
      case "paragraph":
        output.push(...renderParagraph(block.text));
        break;
      case "quote":
        output.push(...renderQuote(block.text));
        break;
      case "code":
        output.push(...renderCodeBlock(block.lang, block.text, width));
        break;
      case "list":
        output.push(...renderList(block.ordered, block.items));
        break;
      case "container":
        output.push(...renderContainer(block.type, block.text, width));
        break;
      case "table":
        output.push(...renderTable(block.rows, width));
        break;
      case "hr":
        output.push(boxChars.h.repeat(Math.min(width, 60)));
        break;
      case "blank":
        output.push("");
        break;
    }
  }

  return output;
}

// ── 内联 Markdown 处理 ────────────────────────────────────────────────────

function ansiText(text: string, color: string): string {
  return `#[${color}|${text}]`;
}

function processInline(text: string): string {
  // 按顺序处理内联元素，转换为 ANSI 标记
  // <strong> / ** → bright-white
  // <em> / <i> / * → cyan
  // `code` → bright-green
  // [link](url) → bright-cyan

  let result = text
    // HTML 标签
    .replace(/<(?:strong|b)\b[^>]*>(.+?)<\/(?:strong|b)>/gi, (_, t) => ansiText(t, "W"))
    .replace(/<(?:em|i)\b[^>]*>(.+?)<\/(?:em|i)>/gi, (_, t) => ansiText(t, "C"))
    // Markdown 粗体 **text**
    .replace(/\*\*(.+?)\*\*/g, (_, t) => ansiText(t, "W"))
    // Markdown 斜体 *text* 或 _text_
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, (_, t) => ansiText(t, "C"))
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, (_, t) => ansiText(t, "C"))
    // 行内代码 `code`
    .replace(/`([^`\n]+)`/g, (_, t) => ansiText(t, "G"))
    // 链接 [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t) => ansiText(t, "C"))
    // <br /> → 换行
    .replace(/<br\s*\/?>/gi, "\n");

  return result;
}

// ── 块级渲染 ──────────────────────────────────────────────────────────────

function renderHeading(level: number, text: string, width: number): string[] {
  const lines: string[] = [];
  const processed = processInline(text);
  const color = level <= 2 ? "Y" : level <= 4 ? "y" : "c";

  lines.push("");

  if (level === 1) {
    // 一级标题：带装饰线
    const sep = boxChars.h.repeat(Math.min(width, 60));
    lines.push(`${sep}`);
    lines.push(`  ${ansiText(processed, color)}`);
    lines.push(`${sep}`);
  } else if (level === 2) {
    // 二级标题：带前缀和底线
    lines.push(`  ~ ${ansiText(processed, color)}`);
    lines.push(boxChars.h.repeat(Math.min(width - 4, 40)));
  } else {
    // 三级及以下：缩进
    const indent = "    ";
    lines.push(`${indent}${ansiText(processed, color)}`);
  }

  return lines;
}

function renderParagraph(text: string): string[] {
  return text.split("\n").map((line) => processInline(line));
}

function renderQuote(text: string): string[] {
  const lines = text.split("\n");
  return lines.map((line) => `  > ${processInline(line)}`);
}

function expandTabs(text: string, tabWidth = 4): string {
  return text.replace(/\t/g, " ".repeat(tabWidth));
}

function renderCodeBlock(lang: string, text: string, width: number): string[] {
  const lines: string[] = [];
  const innerWidth = Math.min(width - 4, 60);

  // 顶部边框：┌─ lang ───...──┐
  const header = lang ? ` ${lang} ` : " code ";
  const headerPad = Math.max(0, innerWidth - header.length - 3);
  const topBorder = boxChars.tl + boxChars.h + header + boxChars.h.repeat(headerPad) + boxChars.tr;
  lines.push(ansiText(topBorder, "c"));

  // 内容（无侧边框）
  for (const codeLine of text.split("\n")) {
    lines.push(textHtml(expandTabs(codeLine)));
  }

  // 底部边框：└──...──┘
  const bottomBorder = boxChars.bl + boxChars.h.repeat(innerWidth - 2) + boxChars.br;
  lines.push(ansiText(bottomBorder, "c"));

  return lines;
}

function renderList(ordered: boolean, items: string[]): string[] {
  const lines: string[] = [];
  const indent = "  ";

  for (let i = 0; i < items.length; i++) {
    const marker = ordered ? `${i + 1}.` : "-";
    lines.push(`${indent}${marker} ${processInline(items[i])}`);
  }

  return lines;
}

function renderContainer(type: string, text: string, width: number): string[] {
  const lines: string[] = [];
  const innerWidth = Math.min(width - 4, 60);

  const styles: Record<string, { color: string; label: string }> = {
    important: { color: "Y", label: "IMPORTANT" },
    note: { color: "C", label: "NOTE" },
    tip: { color: "G", label: "TIP" },
    warning: { color: "R", label: "WARNING" }
  };

  const style = styles[type] || { color: "W", label: type.toUpperCase() };

  // 顶部边框：┌─ LABEL ───...──┐
  const labelPad = Math.max(0, innerWidth - style.label.length - 5);
  const topBorder = boxChars.tl + boxChars.h + " " + style.label + " " + boxChars.h.repeat(labelPad) + boxChars.tr;
  lines.push(ansiText(topBorder, style.color));

  // 内容（无侧边框）
  for (const line of text.split("\n")) {
    lines.push(textHtml(expandTabs(line)));
  }

  // 底部边框：└──...──┘
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
      return ` ${processInline(truncated)}${" ".repeat(pad)}`;
    });

    lines.push(boxChars.v + cells.join(boxChars.v) + boxChars.v);

    if (i === 0) {
      lines.push(midBorder);
    }
  }

  lines.push(bottomBorder);
  return lines;
}