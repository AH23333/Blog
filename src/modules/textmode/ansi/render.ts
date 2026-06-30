import { escapeHtml, textHtml } from "../core/html";
import { cellWidth } from "../core/layout";
import { normalizeText } from "../core/text";

type AnsiToken = {
  text: string;
  role?: string;
};

type RenderChunk = {
  text: string;
  role?: string;
};

const colorAliases: Record<string, string> = {
  k: "black",
  r: "red",
  g: "green",
  y: "yellow",
  b: "blue",
  m: "magenta",
  c: "cyan",
  w: "white",
  K: "bright-black",
  "br-black": "bright-black",
  R: "bright-red",
  "br-red": "bright-red",
  G: "bright-green",
  "br-green": "bright-green",
  Y: "bright-yellow",
  "br-yellow": "bright-yellow",
  B: "bright-blue",
  "br-blue": "bright-blue",
  M: "bright-magenta",
  "br-magenta": "bright-magenta",
  C: "bright-cyan",
  "br-cyan": "bright-cyan",
  W: "bright-white",
  "br-white": "bright-white"
};

const ansiRoles = new Map<string, string>([
  ["black", "black"],
  ["red", "red"],
  ["green", "green"],
  ["yellow", "yellow"],
  ["blue", "blue"],
  ["magenta", "magenta"],
  ["cyan", "cyan"],
  ["white", "white"],
  ["bright-black", "bright-black"],
  ["bright-red", "bright-red"],
  ["bright-green", "bright-green"],
  ["bright-yellow", "bright-yellow"],
  ["bright-blue", "bright-blue"],
  ["bright-magenta", "bright-magenta"],
  ["bright-cyan", "bright-cyan"],
  ["bright-white", "bright-white"]
]);

function resolveColorRole(alias: string): string | undefined {
  const standardKey = colorAliases[alias] ?? alias;
  return ansiRoles.get(standardKey);
}

const inkBlockPattern = /^\s*--\[ ink \]--\s*$/;
const inkMaskPrefixPattern = /^~(.*)$/;
const inkTextPrefixPattern = /^\|(.*)$/;

export function renderAnsiText(input: string, width: number): string {
  return renderBlocks(normalizeText(input).trim(), width).join("\n");
}

// ANSI 行内标记占位符起始码点（U+E400–U+E4FF，256 个）
const ANSI_PLACEHOLDER_START = 0xe400;
const ANSI_PLACEHOLDER_MAX = 0xe4ff;

function makeAnsiPlaceholder(index: number): string {
  const codePoint = ANSI_PLACEHOLDER_START + index;
  if (codePoint > ANSI_PLACEHOLDER_MAX) {
    return `\uE400AN${index}\uE401`;
  }
  return String.fromCodePoint(codePoint);
}

export interface AnsiInlineMarker {
  role: string;
  text: string;
}

/**
 * 处理行内 ANSI 标记：将 #[role|text] 替换为 Unicode 占位符。
 * 占位符会在 Markdown 渲染后通过 restoreAnsiInlineMarkup 恢复为 HTML span。
 * 这样避免了 Markdown 解析器对 HTML 标签的转义，也避免了 4 空格缩进
 * 被误解析为代码块导致 ANSI 颜色失效。
 */
export function processAnsiInlineMarkup(text: string): { processed: string; markers: Map<string, AnsiInlineMarker> } {
  const tokens = parseInlineAnsi(text);
  const markers = new Map<string, AnsiInlineMarker>();
  let counter = 0;
  let result = "";

  for (const token of tokens) {
    if (token.role) {
      const placeholder = makeAnsiPlaceholder(counter);
      markers.set(placeholder, { role: token.role, text: token.text });
      result += placeholder;
      counter++;
    } else {
      result += token.text;
    }
  }

  return { processed: result, markers };
}

/**
 * 恢复 ANSI 行内标记占位符为 HTML span。
 * 在 Markdown 渲染后调用，将 Unicode 占位符替换为带颜色的 HTML。
 */
export function restoreAnsiInlineMarkup(html: string, markers: Map<string, AnsiInlineMarker>): string {
  let result = html;

  for (const [placeholder, { role, text }] of markers) {
    const escaped = escapeHtml(text);
    const replacement = `<span class="ansi ansi-${role}">${escaped}</span>`;
    result = result.replaceAll(placeholder, replacement);
  }

  return result;
}

// ink 块占位符分隔符（U+E500，Private Use Area）
// 避免使用 __INKBLOCK_N__ 格式，因为双下划线会被 markdown-it 解析为粗体 <strong>
const INKBLOCK_PLACEHOLDER_PREFIX = "\uE500";

/**
 * 从文本中提取并渲染所有 --[ ink ]-- 块。
 * 返回处理后的文本（ink 块替换为占位符）和渲染后的 HTML 块数组。
 */
export function extractAndRenderInkBlocks(text: string, width: number): { processedText: string; blocks: string[] } {
  const blocks: string[] = [];
  const lines = text.split("\n");
  const outputLines: string[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const match = lines[cursor].match(inkBlockPattern);

    if (!match) {
      outputLines.push(lines[cursor]);
      cursor += 1;
      continue;
    }

    // 提取 ink 块内容（直到空行或结束）
    const blockLines: string[] = [];
    cursor += 1;

    while (cursor < lines.length && lines[cursor].trim().length > 0) {
      blockLines.push(lines[cursor]);
      cursor += 1;
    }

    // 渲染 ink 块
    const rendered = renderInkBlock(blockLines, width);
    const index = blocks.length;
    blocks.push(rendered.join("\n"));
    outputLines.push(`${INKBLOCK_PLACEHOLDER_PREFIX}INKBLOCK_${index}${INKBLOCK_PLACEHOLDER_PREFIX}`);

    // 跳过后续空行（这些空行会在 Markdown 中自然分隔）
    while (cursor < lines.length && lines[cursor].trim().length === 0) {
      cursor += 1;
    }

    // 在占位符后添加空行以保持段落分隔
    if (cursor < lines.length && lines[cursor - 1]?.trim().length === 0) {
      // 空行已被跳过，占位符后的行会自然接续
    }
  }

  return {
    processedText: outputLines.join("\n"),
    blocks
  };
}

/**
 * 恢复 ink 块占位符为渲染后的 HTML。
 * 占位符格式：\uE500INKBLOCK_N\uE500（不会被 markdown-it 解析为粗体）
 */
export function restoreInkBlocks(html: string, blocks: string[]): string {
  const placeholderRegex = new RegExp(
    `${escapeRegExp(INKBLOCK_PLACEHOLDER_PREFIX)}INKBLOCK_(\\d+)${escapeRegExp(INKBLOCK_PLACEHOLDER_PREFIX)}`,
    "g"
  );
  return html.replace(placeholderRegex, (_, index: string) => {
    const i = parseInt(index, 10);
    return blocks[i] ?? "";
  });
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderBlocks(input: string, width: number): string[] {
  const lines = input.split("\n");
  const rendered: string[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const match = lines[cursor].match(inkBlockPattern);

    if (!match) {
      const textLines: string[] = [];

      while (cursor < lines.length && !lines[cursor].match(inkBlockPattern)) {
        textLines.push(lines[cursor]);
        cursor += 1;
      }

      rendered.push(...renderPlainAnsiLines(textLines.join("\n"), width));
      continue;
    }

    const blockLines: string[] = [];
    cursor += 1;

    while (cursor < lines.length && lines[cursor].trim().length > 0) {
      blockLines.push(lines[cursor]);
      cursor += 1;
    }

    rendered.push(...renderInkBlock(blockLines, width));

    if (cursor < lines.length && lines[cursor].trim().length === 0) {
      rendered.push("");
      cursor += 1;
    }
  }

  return rendered;
}

function renderPlainAnsiLines(input: string, width: number): string[] {
  const output: string[] = [];
  let lineChunks: RenderChunk[] = [];
  let lineWidth = 0;

  for (const token of parseInlineAnsi(input)) {
    for (const char of token.text) {
      if (char === "\n") {
        flushLine();
        continue;
      }

      const charWidth = cellWidth(char);

      if (lineWidth + charWidth > width && lineWidth > 0) {
        flushLine();
      }

      appendChunk(lineChunks, { text: char, role: token.role });
      lineWidth += charWidth;
    }
  }

  flushLine();
  return output;

  function flushLine(): void {
    output.push(renderChunks(lineChunks));
    lineChunks = [];
    lineWidth = 0;
  }
}

function renderInkBlock(lines: string[], width: number): string[] {
  const output: string[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const textMatch = lines[cursor].match(inkTextPrefixPattern);
    const maskMatch = lines[cursor + 1]?.match(inkMaskPrefixPattern);

    if (textMatch && maskMatch) {
      output.push(...renderInkTextLine(textMatch[1] ?? "", maskMatch[1] ?? "", width));
      cursor += 2;
      continue;
    }

    if (lines[cursor].match(inkMaskPrefixPattern)) {
      cursor += 1;
      continue;
    }

    output.push(...renderPlainAnsiLines(lines[cursor], width));
    cursor += 1;
  }

  return output;
}

function renderInkTextLine(text: string, mask: string, width: number): string[] {
  const chunks: RenderChunk[] = [];
  let index = 0;

  for (const char of text) {
    const role = roleForMask(mask[index]);
    appendChunk(chunks, { text: char, role });
    index += 1;
  }

  return renderWrappedChunks(chunks, width);
}

function parseInlineAnsi(input: string): AnsiToken[] {
  const tokens: AnsiToken[] = [];
  let cursor = 0;
  let plain = "";

  /** ANSI 上下文中需要转义的字符集合 */
  const ANSI_ESCAPE_CHARS = new Set(["#", "[", "]", "\\", "|"]);

  while (cursor < input.length) {
    if (input[cursor] === "\\" && cursor + 1 < input.length) {
      const next = input[cursor + 1];
      if (ANSI_ESCAPE_CHARS.has(next)) {
        // 仅对 ANSI 特殊字符进行转义：\# → #, \[ → [, \] → ], \\ → \, \| → |
        plain += next;
        cursor += 2;
        continue;
      }
      // 其他字符（如 LaTeX 命令 \sum, \label 等）保留反斜杠
      plain += "\\";
      cursor += 1;
      continue;
    }

    if (input.startsWith("#[", cursor)) {
      const parsed = parseMarker(input, cursor);

      if (parsed) {
        flushPlain();
        tokens.push({ text: parsed.text, role: parsed.role });
        cursor = parsed.end;
        continue;
      }
    }

    plain += input[cursor];
    cursor += 1;
  }

  flushPlain();
  return tokens;

  function flushPlain(): void {
    if (plain.length > 0) {
      tokens.push({ text: plain });
      plain = "";
    }
  }
}

function parseMarker(input: string, start: number): { role: string; text: string; end: number } | undefined {
  const pipe = findUnescaped(input, "|", start + 2);

  if (pipe === -1) {
    return undefined;
  }

  const close = findUnescaped(input, "]", pipe + 1);

  if (close === -1) {
    return undefined;
  }

  const alias = input.slice(start + 2, pipe).trim();
  const role = resolveColorRole(alias);

  if (!role) {
    // 未知角色：降级为普通文本（不抛异常，避免阻塞渲染）
    return undefined;
  }

  return {
    role,
    text: unescapeAnsiText(input.slice(pipe + 1, close)),
    end: close + 1
  };
}

function findUnescaped(input: string, needle: string, start: number): number {
  for (let index = start; index < input.length; index += 1) {
    if (input[index] === "\\" && index + 1 < input.length) {
      index += 1;
      continue;
    }

    if (input[index] === needle) {
      return index;
    }
  }

  return -1;
}

function unescapeAnsiText(input: string): string {
  return input.replace(/\\([#[\]|\\])/g, "$1");
}

function roleForMask(char: string | undefined): string | undefined {
  if (!char || char === "." || char === " ") {
    return undefined;
  }

  const role = resolveColorRole(char);

  if (!role) {
    // 未知掩码字符：降级为无颜色（不抛异常，避免阻塞渲染）
    return undefined;
  }

  return role;
}

function appendChunk(chunks: RenderChunk[], chunk: RenderChunk): void {
  const previous = chunks[chunks.length - 1];

  if (previous && previous.role === chunk.role) {
    previous.text += chunk.text;
    return;
  }

  chunks.push(chunk);
}

function renderChunks(chunks: RenderChunk[]): string {
  return chunks
    .map((chunk) =>
      chunk.role ? `<span class="ansi ansi-${chunk.role}">${textHtml(chunk.text)}</span>` : textHtml(chunk.text)
    )
    .join("");
}

function renderWrappedChunks(chunks: RenderChunk[], width: number): string[] {
  const output: string[] = [];
  let lineChunks: RenderChunk[] = [];
  let lineWidth = 0;

  for (const chunk of chunks) {
    for (const char of chunk.text) {
      const charWidth = cellWidth(char);

      if (lineWidth + charWidth > width && lineWidth > 0) {
        flushLine();
      }

      appendChunk(lineChunks, { text: char, role: chunk.role });
      lineWidth += charWidth;
    }
  }

  flushLine();
  return output;

  function flushLine(): void {
    output.push(renderChunks(lineChunks));
    lineChunks = [];
    lineWidth = 0;
  }
}
