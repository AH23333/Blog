/**
 * CONTENTS 简化语法解析器
 *
 * 将缩进式编号列表自动转换为纯空格缩进排版格式的目录。
 *
 * ## 简化语法（输入）
 *
 *     CONTENTS
 *
 *     1.0 Summary
 *     1.1 Motivation
 *     2.0 Analysis
 *        2.1 Sub-section
 *        2.2 Another
 *     3.0 References
 *
 * 规则：
 * - 以单独一行的 CONTENTS 开头
 * - 每行格式：`[缩进]编号.编号[.编号] 标题`（支持 2~3 级编号，如 1.0、1.1、1.1.1）
 * - 缩进用 2 空格表示一级层级
 * - 块以空行或文件末尾结束
 * - 旧格式（含点号对齐）自动去除点号，转换为纯缩进格式
 *
 * ## 输出格式（纯缩进排版，无点号）
 *
 *     CONTENTS
 *
 *       1.0  Summary
 *            1.1  Motivation
 *       2.0  Analysis
 *                 2.1  Sub-section
 *                 2.2  Another
 *       3.0  References
 *
 * 输出缩进：基准 2 空格，每级缩进增加 5 空格。
 * 标题过长时自动换行，续行对齐标题起始位置。
 */

import { textmodeConfig } from "../../../config/textmode";
import { cellWidth } from "../core/layout";

/** 解析后的单条目录条目 */
interface ContentsEntry {
  /** 用户输入的原始缩进空格数 */
  indent: number;
  /** 章节编号，如 "1.0"、"2.1" */
  number: string;
  /** 章节标题 */
  title: string;
}

/** 解析结果 */
interface ParseResult {
  entries: ContentsEntry[];
  /** 解析出错时的警告信息 */
  warnings: string[];
  /** 解析结束位置（指向 CONTENTS 块之后第一个非条目行的索引） */
  endIndex: number;
}

/**
 * 对整段文本中的 CONTENTS 块进行格式转换。
 *
 * 如果文本包含简化语法格式的 CONTENTS 块，将其转换为点号对齐格式；
 * 如果文本包含已手动对齐的旧格式 CONTENTS 块，保持原样。
 * 如果没有找到 CONTENTS 块，返回原文本。
 *
 * @param text 原始文章文本
 * @returns 转换后的文本
 */
export function transformContents(text: string): string {
  // 归一化换行符：将 \r\n 和 \r 统一转换为 \n，确保后续正则匹配正确
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const contentsIndex = findContentsMarker(lines);

  if (contentsIndex === -1) {
    return text;
  }

  const result = parseEntries(lines, contentsIndex);

  if (result.entries.length === 0) {
    return text;
  }

  const formatted = formatEntries(result.entries);
  const before = lines.slice(0, contentsIndex).join("\n");
  // 使用解析器返回的实际结束位置，而非按条目数估算
  const after = lines.slice(result.endIndex).join("\n");

  // 构建输出：CONTENTS 条目包裹在 Plain Text 围栏代码块中，
  // 渲染时通过 <pre> 保留空格缩进和换行
  const parts: string[] = [];

  if (before.length > 0) {
    parts.push(before, "");
  }

  parts.push("CONTENTS", "", "```Plain Text", ...formatted, "```");

  if (after.length > 0) {
    parts.push("", after);
  }

  return parts.join("\n");
}

/**
 * 查找 CONTENTS 标记行（大小写不敏感，必须为单独一行或行内仅有空白）
 */
function findContentsMarker(lines: string[]): number {
  return lines.findIndex((line) => /^\s*CONTENTS\s*$/i.test(line));
}

/**
 * 从 CONTENTS 之后解析条目列表。
 *
 * 自动检测旧格式（含 ≥3 个连续点号的行），
 * 将其转换为纯缩进格式（去除点号）。
 */
function parseEntries(lines: string[], startIndex: number): ParseResult {
  const entries: ContentsEntry[] = [];
  const warnings: string[] = [];

  let i = startIndex + 1;

  // 跳过 CONTENTS 与第一条目之间的空行
  while (i < lines.length && lines[i].trim() === "") {
    i++;
  }

  // 解析条目：跳过无效行，遇空行或已解析条目后的非条目行时结束
  while (i < lines.length) {
    const line = lines[i];

    // 空行结束 CONTENTS 块
    if (line.trim() === "") {
      break;
    }

    const entry = parseEntryLine(line);

    if (entry) {
      entries.push(entry);
    } else if (entries.length > 0) {
      // 已有条目后再遇非条目行，结束解析
      warnings.push(`第 ${i + 1} 行不是有效的目录条目，CONTENTS 解析在此结束`);
      break;
    } else {
      // 尚无条目时的无效行：跳过并记录警告
      warnings.push(`第 ${i + 1} 行不是有效的目录条目，已跳过`);
    }

    i++;
  }

  return { entries, warnings, endIndex: i };
}

/**
 * 解析单行目录条目。
 *
 * 格式：`[缩进空格]编号.编号[.编号] 标题`
 * 支持 2 级（1.0）和 3 级（1.1.1）编号。
 * 自动去除标题末尾的点号和空格（兼容旧格式）。
 *
 * @returns 解析成功返回 ContentsEntry，失败返回 null
 */
function parseEntryLine(line: string): ContentsEntry | null {
  const match = line.match(/^(\s*)(\d+\.\d+(?:\.\d+)?)\s+(.+)$/);

  if (!match) {
    return null;
  }

  const indent = match[1].length;
  const number = match[2];
  // 去除标题末尾的点号和空格（兼容旧格式的手动对齐）
  const title = match[3].replace(/[.\s]+$/, "");

  if (title.length === 0) {
    return null;
  }

  return { indent, number, title };
}

/**
 * 将条目列表格式化为纯缩进排版的目录。
 *
 * 不添加任何点号，仅使用空格缩进体现层级结构。
 * 标题过长时自动换行，续行对齐标题起始位置。
 *
 * 输出缩进规则：
 * - 找到所有条目中的最小缩进作为基准层级
 * - 每级缩进（2 空格）对应输出缩进增加 5 空格
 * - 输出基准缩进为 2 空格
 */
function formatEntries(entries: ContentsEntry[]): string[] {
  if (entries.length === 0) {
    return [];
  }

  const minIndent = Math.min(...entries.map((e) => e.indent));
  const indentStep = 2;
  const outputIndentPerLevel = 5;
  const baseOutputIndent = 2;
  const bodyWidth = textmodeConfig.bodyWidth;

  // 计算每条目在输出中的缩进
  const outputIndents = entries.map((e) => {
    const level = (e.indent - minIndent) / indentStep;
    return baseOutputIndent + level * outputIndentPerLevel;
  });

  const result: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const outputIndent = outputIndents[i];

    // 首行前缀：缩进 + 编号 + "  "（两个空格分隔编号与标题）
    const firstPrefix = `${" ".repeat(outputIndent)}${entry.number}  `;
    const firstPrefixWidth = cellWidth(firstPrefix);

    // 续行前缀：缩进 + 编号宽度 + 2 空格，与标题起始位置对齐
    const contIndent = outputIndent + entry.number.length + 2;
    const contPrefix = " ".repeat(contIndent);
    const contPrefixWidth = cellWidth(contPrefix);

    const title = entry.title;
    const titleWidth = cellWidth(title);

    // 标题能在一行内放下
    if (titleWidth <= bodyWidth - firstPrefixWidth) {
      result.push(`${firstPrefix}${title}`);
      continue;
    }

    // 标题过长，需要换行
    let remaining = title;
    let isFirstLine = true;

    while (remaining.length > 0) {
      const prefix = isFirstLine ? firstPrefix : contPrefix;
      const prefixWidth = isFirstLine ? firstPrefixWidth : contPrefixWidth;
      const availableWidth = bodyWidth - prefixWidth;

      // 截取能放入当前行的标题部分
      let part = "";
      let partWidth = 0;

      for (const char of remaining) {
        const cw = cellWidth(char);
        if (partWidth + cw > availableWidth) break;
        part += char;
        partWidth += cw;
      }

      result.push(`${prefix}${part}`);

      remaining = remaining.slice(part.length);
      isFirstLine = false;
    }
  }

  return result;
}
