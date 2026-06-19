/**
 * ANSI 颜色辅助函数。
 */

/** 将文本包裹为 ANSI 颜色标记 */
export function ansiText(text: string, color: string): string {
  return `#[${color}|${text}]`;
}

/** 将制表符扩展为空格 */
export function expandTabs(text: string, tabWidth = 4): string {
  return text.replace(/\t/g, " ".repeat(tabWidth));
}
