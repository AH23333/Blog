/**
 * 块级渲染函数：标题、段落、代码块、容器、表格。
 */

import { textHtml } from "../core/html";
import { ansiText, expandTabs } from "./ansi";
import { boxChars } from "./box-chars";

/** 渲染各级标题 */
export function renderHeading(level: number, text: string, width: number): string[] {
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

/** 渲染段落 */
export function renderParagraph(text: string): string[] {
  return text.split("\n");
}

/** 渲染代码块（ANSI 路径） */
export function renderCodeBlock(lang: string, text: string, width: number): string[] {
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

/** 渲染 ::: 容器 */
export function renderContainer(type: string, text: string, width: number, title?: string): string[] {
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

/** 渲染表格 */
export function renderTable(rows: string[][], width: number): string[] {
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
