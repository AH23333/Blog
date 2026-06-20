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
