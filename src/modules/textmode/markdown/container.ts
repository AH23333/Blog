/**
 * ::: 容器预处理模块
 *
 * 将文本按 :::type / ::: 分割为普通文本段和容器段。
 * 支持 :::type、:::type[title]、:::type title 三种格式。
 * 代码块（```...```）内的 ::: 行不会被当作容器标记。
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
