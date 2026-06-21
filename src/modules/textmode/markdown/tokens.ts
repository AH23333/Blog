/**
 * Token 渲染模块：处理 markdown-it 的块级和内联 token 渲染。
 *
 * 直接声明 Token 接口而非从 markdown-it 导入，因为 @types/markdown-it 的 Token 类
 * 未作为命名导出暴露，且 verbatimModuleSyntax 要求类型导入必须显式标注。
 */

// markdown-it Token 类型（与 @types/markdown-it 中的 Token 类结构兼容）
export interface Token {
  type: string;
  tag: string;
  attrs: [string, string][] | null;
  map: [number, number] | null;
  nesting: number;
  level: number;
  children: Token[] | null;
  content: string;
  markup: string;
  info: string;
  meta: any;
  block: boolean;
  hidden: boolean;
}
import { ansiText } from "./ansi";
import { renderCodeBlock, renderHeading, renderParagraph, renderTable } from "./blocks";
import { boxChars } from "./box-chars";

// ── 块级 Token 渲染 ───────────────────────────────────────────────────────

export function renderBlockTokens(tokens: Token[], start: number, end: number, width: number, output: string[]): void {
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

export function renderInlineTokens(token: Token | undefined): string {
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
export function findClosingToken(tokens: Token[], start: number, closeType: string): number {
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

export function renderListItemContent(tokens: Token[], start: number, end: number, width: number): string[] {
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

export function extractTableRows(tokens: Token[], start: number, end: number): string[][] {
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
