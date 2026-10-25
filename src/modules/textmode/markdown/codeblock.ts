/**
 * 围栏代码块提取工具
 *
 * 使用逐行扫描方式从文本中提取围栏代码块（```...```），
 * 正确处理变长反引号围栏（如 4-backtick、5-backtick 等）。
 * 被多个模块共享使用，避免重复实现。
 */

/**
 * 从文本中提取所有围栏代码块，替换为占位符。
 *
 * 关键规则：
 * - 开启围栏：` (>2个) + 可选语言标识
 * - 关闭围栏：相同缩进 + 至少与开启围栏相同数量的反引号
 *
 * @param text 原始文本
 * @param makePlaceholder 占位符生成函数，接收索引返回占位符字符串
 * @returns 处理后的文本和提取的代码块数组
 */
export function extractFencedCodeBlocks(
  text: string,
  makePlaceholder: (index: number) => string
): { processed: string; blocks: string[] } {
  const blocks: string[] = [];
  const lines = text.split("\n");
  const fenceLineRegex = /^([ \t]*)(`{3,})(\S*)\s*$/;
  const outputLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(fenceLineRegex);

    if (!match) {
      outputLines.push(line);
      i++;
      continue;
    }

    const indent = match[1];
    const backticks = match[2];
    const openCount = backticks.length;

    // 查找匹配的关闭围栏：相同缩进 + 至少 openCount 个反引号
    let j = i + 1;
    let found = false;
    while (j < lines.length) {
      const closeLine = lines[j];
      const closeMatch = closeLine.match(/^([ \t]*)(`{3,})\s*$/);
      if (closeMatch && closeMatch[1] === indent && closeMatch[2].length >= openCount) {
        found = true;
        break;
      }
      j++;
    }

    if (!found) {
      outputLines.push(line);
      i++;
      continue;
    }

    // 提取整个代码块并替换为占位符
    const codeBlock = lines.slice(i, j + 1).join("\n");
    const index = blocks.length;
    blocks.push(codeBlock);
    outputLines.push(makePlaceholder(index));
    i = j + 1;
  }

  return { processed: outputLines.join("\n"), blocks };
}

/**
 * 计算位于围栏代码块内部的行号集合（0 起，含开栏/闭栏行）。
 *
 * 配对规则与 extractFencedCodeBlocks 一致，供后续处理阶段
 * （如 INK 块提取）判断某行是否处于围栏保护内，
 * 避免围栏内的示例语法（--[ ink ]-- 等）被误提取并吞掉闭栏行。
 *
 * 未找到闭栏行的开栏行不标记任何范围（与提取器行为一致：按普通行处理）。
 */
export function fencedLineIndices(text: string): Set<number> {
  const indices = new Set<number>();
  const lines = text.split("\n");
  const fenceLineRegex = /^([ \t]*)(`{3,})(\S*)\s*$/;

  let i = 0;
  while (i < lines.length) {
    const match = lines[i].match(fenceLineRegex);

    if (!match) {
      i++;
      continue;
    }

    const indent = match[1];
    const openCount = match[2].length;
    let j = i + 1;
    let found = false;

    while (j < lines.length) {
      const closeMatch = lines[j].match(/^([ \t]*)(`{3,})\s*$/);
      if (closeMatch && closeMatch[1] === indent && closeMatch[2].length >= openCount) {
        found = true;
        break;
      }
      j++;
    }

    if (!found) {
      i++;
      continue;
    }

    for (let k = i; k <= j; k++) {
      indices.add(k);
    }
    i = j + 1;
  }

  return indices;
}

/**
 * 提取所有 ```Plain Text 围栏块（行扫描 + 围栏感知），替换为占位符。
 *
 * 与旧版正则（/```Plain Text\n([\s\S]*?)```/）的差异：
 * - 开栏行必须独占一行（允许缩进），不再匹配行内片段；
 * - 位于普通围栏代码块内部的 ```Plain Text 是文档示例，跳过不提取，
 *   避免吞掉外层闭栏行导致围栏配对级联失衡；
 * - 内容为开栏行与闭栏行之间的原始行，由调用方自行渲染。
 *
 * 闭栏行 = 开栏之后第一处以 ``` 开头的行（与旧版"最近的 ```"语义一致）。
 * 找不到闭栏行时按普通文本处理（与旧版行为一致）。
 */
export function extractPlainTextFences(
  text: string,
  makePlaceholder: (index: number) => string
): { processed: string; blocks: string[] } {
  const blocks: string[] = [];
  const lines = text.split("\n");
  const fencedLines = fencedLineIndices(text);
  const openerRegex = /^([ \t]*)```Plain Text[ \t]*$/;
  const closerRegex = /^[ \t]*```/;
  const outputLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    if (!openerRegex.test(lines[i]) || fencedLines.has(i)) {
      outputLines.push(lines[i]);
      i++;
      continue;
    }

    let j = i + 1;
    let found = false;
    while (j < lines.length) {
      if (closerRegex.test(lines[j])) {
        found = true;
        break;
      }
      j++;
    }

    if (!found) {
      outputLines.push(lines[i]);
      i++;
      continue;
    }

    blocks.push(lines.slice(i + 1, j).join("\n"));
    outputLines.push(makePlaceholder(blocks.length - 1));
    i = j + 1;
  }

  return { processed: outputLines.join("\n"), blocks };
}
