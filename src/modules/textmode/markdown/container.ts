/**
 * ::: 容器预处理模块
 *
 * 将文本按 :::type / ::: 分割为普通文本段和容器段。
 * 支持 :::type、:::type[title]、:::type title 三种格式。
 * 代码块（```...``` 及变长反引号）内的 ::: 行不会被当作容器标记。
 */

export type MarkdownSegment =
  | { kind: "text"; content: string }
  | { kind: "container"; type: string; title?: string; content: string };

/**
 * 将文本按 :::type / ::: 分割为普通文本段和容器段。
 */
export function splitContainerSegments(text: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];

  // 第一步：保护代码块，将 ```...``` 替换为占位符，避免代码块内的 ::: 被误解析
  // 使用逐行扫描方式，正确处理变长反引号围栏（如 4-backtick 围栏）。
  const codeBlocks: string[] = [];
  const codePlaceholder = (i: number) => `\uE200CD${i}\uE200`;
  const fenceLineRegex = /^([ \t]*)(`{3,})(\S*)\s*$/;
  const originalLines = text.split("\n");
  const protectedLines: string[] = [];
  let codeCounter = 0;

  let i = 0;
  while (i < originalLines.length) {
    const line = originalLines[i];
    const match = line.match(fenceLineRegex);

    if (!match) {
      protectedLines.push(line);
      i++;
      continue;
    }

    const indent = match[1];
    const backticks = match[2];
    const openCount = backticks.length;

    // 查找匹配的关闭围栏：相同缩进 + 至少 openCount 个反引号
    let j = i + 1;
    let found = false;
    while (j < originalLines.length) {
      const closeLine = originalLines[j];
      const closeMatch = closeLine.match(/^([ \t]*)(`{3,})\s*$/);
      if (closeMatch && closeMatch[1] === indent && closeMatch[2].length >= openCount) {
        found = true;
        break;
      }
      j++;
    }

    if (!found) {
      protectedLines.push(line);
      i++;
      continue;
    }

    // 提取整个代码块并替换为占位符
    const codeBlock = originalLines.slice(i, j + 1).join("\n");
    codeBlocks.push(codeBlock);
    protectedLines.push(codePlaceholder(codeCounter));
    codeCounter++;
    i = j + 1;
  }

  const protectedText = protectedLines.join("\n");

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
  const codeReplaceRegex = /\uE200CD(\d+)\uE200/g;
  return segments
    .map((segment) => {
      const content = segment.content.replace(codeReplaceRegex, (_, index: string) => {
        return codeBlocks[parseInt(index, 10)] ?? "";
      });
      return { ...segment, content };
    })
    .filter((segment) => segment.kind !== "text" || segment.content.trim().length > 0);
}
