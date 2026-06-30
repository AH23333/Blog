import { textmodeConfig } from "../../config";
import {
  BLOCK_MATH_PLACEHOLDER,
  mathBlockHtml,
  processMathInText,
  replaceMathPlaceholders,
  resetEquationCounter,
  resetEquationLabels
} from "../math/render";
import {
  extractAndRenderInkBlocks,
  processAnsiInlineMarkup,
  restoreAnsiInlineMarkup,
  restoreInkBlocks
} from "../textmode/ansi/render";
import { escapeHtml, link, textHtml } from "../textmode/core/html";
import { wrapWordsCells } from "../textmode/core/layout";
import { lifeFrameHeight, lifeFrameHtml } from "../textmode/life/art";
import { extractFencedCodeBlocks } from "../textmode/markdown/codeblock";
import { highlightCodeBlocks } from "../textmode/markdown/highlight";
import { renderMarkdownToHtml, splitContainerSegments } from "../textmode/markdown/parser";
import type { Phile } from "./model";

// ── Plain Text 围栏块预处理 ────────────────────────────────────────────────

const PTBLOCK_REGEX = /```Plain Text\n([\s\S]*?)```/g;
const PTBLOCK_PLACEHOLDER_PREFIX = "\uE501";

/**
 * 从文本中提取所有 ```Plain Text ... ``` 围栏块，替换为占位符。
 *
 * 围栏块内的空格缩进不会被 markdown-it 的 4 空格代码块规则误解析。
 * 预渲染为 <pre class="plaintext-pre">，保留原始排版。
 */
function extractPlainTextBlocks(text: string): { processedText: string; blocks: string[] } {
  const blocks: string[] = [];

  const processedText = text.replace(PTBLOCK_REGEX, (_, content: string) => {
    const index = blocks.length;
    // 每行应用 textHtml（CJK 包裹），换行符保留
    const lines = content.split("\n");
    const htmlLines = lines.map((line) => textHtml(line));
    blocks.push(`<pre class="plaintext-pre">${htmlLines.join("\n")}</pre>`);
    return `${PTBLOCK_PLACEHOLDER_PREFIX}PTBLOCK_${index}${PTBLOCK_PLACEHOLDER_PREFIX}`;
  });

  return { processedText, blocks };
}

/**
 * 将占位符替换回预渲染的 HTML。
 */
function restorePlainTextBlocks(html: string, blocks: string[]): string {
  const placeholderRegex = new RegExp(
    `${escapeRegExp(PTBLOCK_PLACEHOLDER_PREFIX)}PTBLOCK_(\\d+)${escapeRegExp(PTBLOCK_PLACEHOLDER_PREFIX)}`,
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

/**
 * 将相对路径解析为 /images/ 下的绝对路径。
 *
 * - `./image.png` → `/images/<articleDir>/image.png`
 * - `../shared/icon.png` → `/images/<parentDir>/shared/icon.png`
 * - `/images/foo.png` 和 `https://...` 原样返回
 */
function resolveImagePath(src: string, articleDir: string): string {
  // 规范化路径分隔符：\ → /
  const normalized = src.replaceAll("\\", "/");

  // 绝对路径（以 / 或协议开头）原样返回
  if (normalized.startsWith("/") || /^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  // 包含 public/images/ 的路径，提取 /images/ 之后的部分
  const publicImagesMatch = normalized.match(/public\/images\/(.+)$/i);
  if (publicImagesMatch) {
    return `/images/${publicImagesMatch[1]}`;
  }

  // 相对于文章目录的路径
  const parts = articleDir ? articleDir.split("/").filter(Boolean) : [];
  const srcParts = normalized.split("/");

  for (const part of srcParts) {
    if (part === "..") {
      parts.pop();
    } else if (part !== ".") {
      parts.push(part);
    }
  }

  return `/images/${parts.join("/")}`;
}

/**
 * 从 sourcePath 中提取文章所在目录。
 * 例如 "volume-1/fuzz/article.md" → "volume-1/fuzz"
 */
function getArticleDir(sourcePath: string): string {
  const lastSlash = sourcePath.lastIndexOf("/");
  return lastSlash >= 0 ? sourcePath.slice(0, lastSlash) : "";
}

const titleWidth = textmodeConfig.articleArtIndent - textmodeConfig.textIndent;

export type PhileHeader = {
  metaHtml: string;
  sideHtml: string;
  lineCount: number;
  metaLineCount: number;
  titleLineCount: number;
};

export type PhileBodyBlock = {
  kind: "text" | "image" | "math";
  html: string;
  hasContainers?: boolean;
};

export function renderPhileHeader(phile: Phile): PhileHeader {
  const titleLines = wrapWordsCells(phile.data.title, titleWidth);
  const metaLines = [...titleLines, `~ ${phile.data.author}`];

  return {
    metaHtml: metaLines.map(textHtml).join("\n"),
    sideHtml: lifeFrameHtml(),
    lineCount: lifeFrameHeight,
    metaLineCount: metaLines.length,
    titleLineCount: titleLines.length
  };
}

/**
 * 将表格行内的 $$...$$ 块级公式转换为 $...$ 行内公式。
 *
 * 原因：processMathInText 在 Markdown 解析之前提取块级公式，
 * 若表格单元格内存在 $$...$$，公式会被提取并替换为占位符，
 * 导致表格行被分割，Markdown 解析器无法正确识别表格结构。
 *
 * 该函数逐行处理文本，将表格行（以 | 开头、非分隔行的行）
 * 中的 $$...$$ 替换为 $...$，使其作为行内公式保留在表格结构内。
 */
function convertBlockMathInTableRows(text: string): string {
  const lines = text.split("\n");
  return lines
    .map((line) => {
      const trimmed = line.trim();
      // 表格行：以 | 开头，且不是分隔行（如 |---|）
      if (trimmed.startsWith("|") && !/^\|[\s\-:]+\|/.test(trimmed)) {
        return line.replace(/\$\$(.+?)\$\$/g, (_: string, formula: string) => `$${formula}$`);
      }
      return line;
    })
    .join("\n");
}

export async function renderPhileBodyBlocks(phile: Phile): Promise<PhileBodyBlock[]> {
  resetEquationCounter();
  resetEquationLabels();

  const blocks = splitBodyBlocks(phile.body ?? "", getArticleDir(phile.route.sourcePath));
  const results: PhileBodyBlock[] = [];

  for (const block of blocks) {
    if (block.kind === "image") {
      results.push({
        kind: "image" as const,
        html: renderImage(block.src, block.alt)
      });
      continue;
    }

    // 预处理：将表格行内的 $$...$$ 转换为 $...$，
    // 避免块级公式提取破坏 Markdown 表格结构
    const preprocessedText = convertBlockMathInTableRows(block.text);

    // 处理数学公式
    const { text: cleanText, blockMath, inlineMath } = processMathInText(preprocessedText);

    // 处理块级公式：在文本前后插入 math 块
    if (blockMath.length > 0 || inlineMath.size > 0) {
      const textParts = cleanText.split(BLOCK_MATH_PLACEHOLDER);
      const mathBlocks = [...blockMath];

      const maxLen = Math.max(textParts.length, mathBlocks.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < textParts.length && textParts[i].trim().length > 0) {
          results.push(await renderTextBlock(textParts[i], inlineMath));
        }
        if (i < mathBlocks.length) {
          results.push({
            kind: "math",
            html: mathBlockHtml(mathBlocks[i])
          });
        }
      }
    } else {
      results.push(await renderTextBlock(cleanText, inlineMath));
    }
  }

  return results;
}

// ── 围栏代码块保护 ────────────────────────────────────────────────────────

const CODE_BLOCK_PLACEHOLDER = "\uE502";

/**
 * 保护围栏代码块：将 ```...``` 替换为占位符，避免 ANSI 解析器剥离
 * 代码块内的 LaTeX 反斜杠命令。
 */
function protectCodeBlocks(text: string): { protected: string; blocks: string[] } {
  const { processed, blocks } = extractFencedCodeBlocks(
    text,
    (i) => `${CODE_BLOCK_PLACEHOLDER}CB_${i}${CODE_BLOCK_PLACEHOLDER}`
  );
  return { protected: processed, blocks };
}

function restoreCodeBlocks(text: string, blocks: string[]): string {
  if (blocks.length === 0) return text;
  // 使用 split + join 替代 replaceAll，避免大字符串 replaceAll 的 RangeError
  const parts = text.split(`${CODE_BLOCK_PLACEHOLDER}CB_`);
  if (parts.length <= 1) return text;
  const result: string[] = [parts[0]];
  for (let i = 1; i < parts.length; i++) {
    const suffixIdx = parts[i].indexOf(CODE_BLOCK_PLACEHOLDER);
    if (suffixIdx === -1) {
      result.push(`${CODE_BLOCK_PLACEHOLDER}CB_${parts[i]}`);
      continue;
    }
    const blockIndex = parseInt(parts[i].slice(0, suffixIdx), 10);
    const remainder = parts[i].slice(suffixIdx + CODE_BLOCK_PLACEHOLDER.length);
    if (!Number.isNaN(blockIndex) && blockIndex < blocks.length) {
      result.push(blocks[blockIndex]);
    }
    result.push(remainder);
  }
  return result.join("");
}

/**
 * 将 markdown-it 渲染的 mermaid 代码块（<pre><code class="language-mermaid">）
 * 转换为 <pre class="mermaid">，供 astro-mermaid 客户端脚本渲染。
 */
function transformMermaidCodeBlocks(html: string): string {
  // 匹配 <pre><code class="language-mermaid">...</code></pre>
  return html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_, code: string) => `<pre class="mermaid">${code}</pre>`
  );
}

async function renderTextBlock(text: string, inlineMath: Map<string, string>): Promise<PhileBodyBlock> {
  // 提取 ```Plain Text 围栏块，避免 markdown-it 将 4+ 空格缩进误解析为代码块
  const { processedText, blocks: plainTextBlocks } = extractPlainTextBlocks(text);

  // 提取并渲染 --[ ink ]-- 块
  const { processedText: textWithoutInk, blocks: inkBlocks } = extractAndRenderInkBlocks(
    processedText,
    textmodeConfig.bodyWidth
  );

  // 保护围栏代码块，避免 ANSI 解析器剥离 LaTeX 命令的反斜杠
  const { protected: codeProtected, blocks: codeBlocks } = protectCodeBlocks(textWithoutInk);

  // 处理行内 ANSI 标记：#[role|text] → Unicode 占位符
  const { processed: textWithAnsi, markers: ansiMarkers } = processAnsiInlineMarkup(codeProtected);

  // 恢复代码块
  const textWithCode = restoreCodeBlocks(textWithAnsi, codeBlocks);

  // 使用新的 markdown-it 解析器，支持容器和代码块
  const segments = splitContainerSegments(textWithCode);
  const parts: string[] = [];
  let hasContainers = false;

  for (const segment of segments) {
    if (segment.kind === "container") {
      hasContainers = true;
      // 渲染容器内部 Markdown 内容，并处理语法高亮
      let innerHtml = renderMarkdownToHtml(segment.content);
      innerHtml = highlightCodeBlocks(innerHtml);
      // 恢复 ANSI 行内标记：Unicode 占位符 → HTML span
      innerHtml = restoreAnsiInlineMarkup(innerHtml, ansiMarkers);
      const typeLabel = segment.type.toUpperCase();
      const displayLabel = segment.title ? `${typeLabel}: ${escapeHtml(segment.title)}` : typeLabel;
      parts.push(
        `<div class="phile-container phile-container-${segment.type}" data-no-typewriter>`,
        `<div class="phile-container-label">${displayLabel}</div>`,
        `<div class="phile-container-content">${innerHtml}</div>`,
        `</div>`
      );
    } else {
      let segmentHtml = renderMarkdownToHtml(segment.content);
      segmentHtml = highlightCodeBlocks(segmentHtml);
      // 恢复 ```Plain Text 围栏块的预渲染 HTML
      segmentHtml = restorePlainTextBlocks(segmentHtml, plainTextBlocks);
      // 恢复 --[ ink ]-- 块的预渲染 HTML
      segmentHtml = restoreInkBlocks(segmentHtml, inkBlocks);
      // 恢复 ANSI 行内标记：Unicode 占位符 → HTML span
      segmentHtml = restoreAnsiInlineMarkup(segmentHtml, ansiMarkers);
      parts.push(segmentHtml);
    }
  }

  let html = parts.join("\n");

  // 替换行内公式占位符
  if (inlineMath.size > 0) {
    html = replaceMathPlaceholders(html, inlineMath);
  }

  // 将 markdown-it 生成的 mermaid 代码块转换为 <pre class="mermaid">，
  // 由 astro-mermaid 客户端脚本渲染为 SVG
  html = transformMermaidCodeBlocks(html);

  // 若 HTML 中包含 <div> 元素（来自 ::: 容器或 ``` 代码块），
  // 则必须使用 <div> 标签承载，因为 <pre> 内不允许嵌套 <div>，
  // 浏览器会自动提前闭合 <pre> 导致 DOM 结构损坏，打字机失效。
  const hasBlockElements = hasContainers || /<div[\s>]/i.test(html);

  return { kind: "text", html, hasContainers: hasBlockElements };
}

export function renderPhileFooterPre(phile: Phile): string {
  return `\n\nret ${link(phile.route.volumeHref, `<volume_${phile.route.volume}>`)}\n`;
}

type ParsedBodyBlock = { kind: "text"; text: string } | { kind: "image"; src: string; alt: string };

function splitBodyBlocks(input: string, articleDir: string): ParsedBodyBlock[] {
  const blocks: ParsedBodyBlock[] = [];
  const textLines: string[] = [];

  for (const line of input.split("\n")) {
    const image = parseImageLine(line);

    if (!image) {
      textLines.push(line);
      continue;
    }

    flushTextBlock(blocks, textLines);
    blocks.push({ kind: "image", src: resolveImagePath(image.src, articleDir), alt: image.alt });
  }

  flushTextBlock(blocks, textLines);
  return blocks;
}

function flushTextBlock(blocks: ParsedBodyBlock[], textLines: string[]): void {
  const text = textLines.join("\n").trim();

  if (text.length > 0) {
    blocks.push({ kind: "text", text });
  }

  textLines.length = 0;
}

function parseImageLine(line: string): { src: string; alt: string } | undefined {
  const markdownImage = line.match(/^\s*!\[([^\]]*)\]\((\S+?)(?:\s+["'][^"']*["'])?\)\s*$/);

  if (markdownImage) {
    return {
      alt: markdownImage[1],
      src: markdownImage[2]
    };
  }

  const htmlImage = line.match(/^\s*<img\b([^>]*)>\s*$/i);

  if (!htmlImage) {
    return undefined;
  }

  const attrs = htmlImage[1];
  const src = readHtmlAttr(attrs, "src");

  if (!src) {
    return undefined;
  }

  return {
    src,
    alt: readHtmlAttr(attrs, "alt") ?? ""
  };
}

function readHtmlAttr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function renderImage(src: string, alt: string): string {
  const safeSrc = escapeHtml(src);
  const safeAlt = escapeHtml(alt);
  const caption = alt.trim().length > 0 ? `\n<figcaption>${textHtml(alt)}</figcaption>` : "";

  return `<figure class="phile-image"><button class="phile-image-trigger" type="button" data-lightbox-image aria-label="Open image preview"><img src="${safeSrc}" alt="${safeAlt}" loading="lazy" decoding="async" /></button>${caption}</figure>`;
}
