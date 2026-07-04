import { textmodeConfig } from "../../config";
import { renderInitialChunks, renderPendingTemplates } from "../lazy/chunk";
import {
  BLOCK_MATH_PLACEHOLDER,
  mathBlockHtml,
  processMathInText,
  replaceMathPlaceholders,
  resetEquationCounter,
  resetEquationLabels
} from "../math/render";
import { escapeHtml, link, textHtml } from "../textmode/core/html";
import { wrapWordsCells } from "../textmode/core/layout";

import { highlightCodeBlocks } from "../textmode/markdown/highlight";
import { renderMarkdownToHtml, splitContainerSegments } from "../textmode/markdown/parser";
import { createPhilePipeline } from "../textmode/shared/placeholder";
import type { Phile } from "./model";

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
    sideHtml: "",
    lineCount: 0,
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

// ── 占位符管道 ────────────────────────────────────────────────────────────

/** 需在 Markdown 解析前恢复的占位符（代码块） */
const CODE_BLOCK_IDS = new Set(["code-block"]);

/** 需在 Markdown 解析后恢复的占位符（ANSI / Ink / Plain Text） */
const POST_MARKDOWN_IDS = new Set(["ansi-marker", "ink-block", "plain-text"]);

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

export async function renderTextBlock(text: string, inlineMath: Map<string, string>): Promise<PhileBodyBlock> {
  // 创建占位符管道，按注册顺序提取所有占位符（plain-text → ink → code → ansi）
  const pipeline = createPhilePipeline(textmodeConfig.bodyWidth);
  const { processed: textWithPlaceholders, contexts } = pipeline.extract(text);

  // 恢复代码块占位符（必须在 Markdown 解析前恢复，避免内部内容被转义）
  const textWithCode = pipeline.restoreSome(textWithPlaceholders, contexts, CODE_BLOCK_IDS);

  // 使用 markdown-it 解析器，支持容器和代码块
  const segments = splitContainerSegments(textWithCode);
  const parts: string[] = [];
  let hasContainers = false;

  for (const segment of segments) {
    if (segment.kind === "container") {
      hasContainers = true;
      let innerHtml = renderMarkdownToHtml(segment.content);
      innerHtml = highlightCodeBlocks(innerHtml);
      innerHtml = pipeline.restoreSome(innerHtml, contexts, POST_MARKDOWN_IDS);
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
      // 恢复 ANSI、Ink、Plain Text 占位符
      segmentHtml = pipeline.restoreSome(segmentHtml, contexts, POST_MARKDOWN_IDS);
      parts.push(segmentHtml);
    }
  }

  let html = parts.join("\n");

  if (inlineMath.size > 0) {
    html = replaceMathPlaceholders(html, inlineMath);
  }

  html = transformMermaidCodeBlocks(html);

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

// ── 懒加载渲染配置 ────────────────────────────────────────────────────────

/** 懒加载阈值：超过此行数的文章启用懒加载 */
const LAZY_THRESHOLD_LINES = 400;

/** 首屏渲染块数 */
const INITIAL_CHUNK_COUNT = 5;

/** 懒加载渲染结果 */
export type LazyRenderResult = {
  isLazy: boolean;
  initialHtml: string;
  pendingHtml: string;
  totalChunks: number;
  hasImages: boolean;
  hasMermaid: boolean;
};

/**
 * 检查文章是否需要懒加载
 *
 * 根据文章行数、内容复杂度（Mermaid 图表数量）和估算 HTML 大小综合判断。
 */
export function shouldUseLazyLoad(phile: Phile): boolean {
  const body = phile.body ?? "";
  const lineCount = body.split("\n").length;

  // 超过阈值行数启用懒加载
  if (lineCount > LAZY_THRESHOLD_LINES) {
    return true;
  }

  // 包含多个 Mermaid 图表的长文章（Mermaid 渲染开销大）
  const mermaidCount = (body.match(/```mermaid/g) || []).length;
  if (mermaidCount > 3 && lineCount > 200) {
    return true;
  }

  // 估算 HTML 大小：大量代码块或表格也会增加渲染开销
  const codeBlockCount = (body.match(/```/g) || []).length;
  if (codeBlockCount > 20) {
    return true;
  }

  return false;
}

/** 懒加载分块：每个 chunk 包含的 PhileBodyBlock 列表 */
export type LazyChunk = {
  id: string;
  blocks: PhileBodyBlock[];
  hasMermaid: boolean;
  estimatedHeight: number;
};

/**
 * 将渲染后的块按估算行数分组为 chunks
 *
 * 每 ~200 行估算为一组，确保滚动时有合理的粒度。
 * 如果单个 text 块太大（超过目标），在 <h1-h6> 标签处分割。
 */
function groupBlocksIntoChunks(blocks: PhileBodyBlock[]): LazyChunk[] {
  const TARGET_LINES_PER_CHUNK = 200;
  const chunks: LazyChunk[] = [];
  let currentBlocks: PhileBodyBlock[] = [];
  let currentLines = 0;
  let chunkIndex = 0;
  let currentHasMermaid = false;

  for (const block of blocks) {
    const html = block.html;

    // 如果不是 text 块（image 或 math），直接添加
    if (block.kind !== "text") {
      let blockLines = html.split("\n").length;
      if (/<pre[\s>]/.test(html)) blockLines += 10;
      if (/<table[\s>]/.test(html)) blockLines += 5;
      if (/class="mermaid"/.test(html)) {
        blockLines += 15;
        currentHasMermaid = true;
      }
      if (/<figure[\s>]/.test(html)) blockLines += 8;

      // 如果加上这个块超过目标，先提交当前 chunk
      if (currentLines + blockLines > TARGET_LINES_PER_CHUNK && currentBlocks.length > 0) {
        chunks.push({
          id: `chunk-${chunkIndex}`,
          blocks: currentBlocks,
          hasMermaid: currentHasMermaid,
          estimatedHeight: currentLines * 1.5
        });
        chunkIndex++;
        currentBlocks = [];
        currentLines = 0;
        currentHasMermaid = false;
      }

      currentBlocks.push(block);
      currentLines += blockLines;
      continue;
    }

    // text 块：估算行数
    let totalBlockLines = html.split("\n").length;
    if (/<pre[\s>]/.test(html)) totalBlockLines += 10;
    if (/<table[\s>]/.test(html)) totalBlockLines += 5;
    const hasMermaidHere = /class="mermaid"/.test(html);
    if (hasMermaidHere) {
      totalBlockLines += 15;
    }
    if (/<figure[\s>]/.test(html)) totalBlockLines += 8;

    // 如果当前 chunk 为空，且这个块小于目标，直接添加
    if (currentLines === 0 && totalBlockLines <= TARGET_LINES_PER_CHUNK) {
      currentBlocks.push(block);
      currentLines = totalBlockLines;
      if (hasMermaidHere) currentHasMermaid = true;
      continue;
    }

    // 如果这个块本身大于目标，尝试在 heading 标签处分割
    if (totalBlockLines > TARGET_LINES_PER_CHUNK) {
      // 分割文本块：在 <h[1-6] 标签处分割
      const lines = html.split("\n");
      let subBuffer: string[] = [];
      let subLines = 0;
      let subHasMermaid = hasMermaidHere;

      for (const line of lines) {
        // 遇到 heading 标签且当前 buffer 非空且超过目标，提交当前 chunk
        if (line.includes("<h") && line.includes(">") && subLines > 0 && subLines >= TARGET_LINES_PER_CHUNK / 2) {
          const splitHtml = subBuffer.join("\n");
          const splitBlock: PhileBodyBlock = {
            kind: "text",
            html: splitHtml,
            hasContainers: block.hasContainers
          };

          // 先提交当前累积的块，如果有就提交
          if (currentBlocks.length > 0) {
            chunks.push({
              id: `chunk-${chunkIndex}`,
              blocks: currentBlocks,
              hasMermaid: currentHasMermaid,
              estimatedHeight: currentLines * 1.5
            });
            chunkIndex++;
            currentBlocks = [];
            currentLines = 0;
            currentHasMermaid = false;
          }

          currentBlocks.push(splitBlock);
          currentLines = subLines;
          currentHasMermaid = subHasMermaid;

          subBuffer = [];
          subLines = 0;
          subHasMermaid = false;
        }

        subBuffer.push(line);
        subLines++;
        if (line.includes('class="mermaid"')) {
          subLines += 15;
          subHasMermaid = true;
        }
      }

      // 处理剩余子块内容
      if (subBuffer.length > 0) {
        if (currentLines + subLines > TARGET_LINES_PER_CHUNK && currentBlocks.length > 0) {
          chunks.push({
            id: `chunk-${chunkIndex}`,
            blocks: currentBlocks,
            hasMermaid: currentHasMermaid,
            estimatedHeight: currentLines * 1.5
          });
          chunkIndex++;
          currentBlocks = [];
          currentLines = 0;
          currentHasMermaid = false;
        }
        const remainingBlock: PhileBodyBlock = {
          kind: "text",
          html: subBuffer.join("\n"),
          hasContainers: block.hasContainers
        };
        currentBlocks.push(remainingBlock);
        currentLines += subLines;
        if (subHasMermaid) currentHasMermaid = true;
      }
    } else {
      // 小块：如果加上超过目标，先提交当前 chunk
      if (currentLines + totalBlockLines > TARGET_LINES_PER_CHUNK && currentBlocks.length > 0) {
        chunks.push({
          id: `chunk-${chunkIndex}`,
          blocks: currentBlocks,
          hasMermaid: currentHasMermaid,
          estimatedHeight: currentLines * 1.5
        });
        chunkIndex++;
        currentBlocks = [];
        currentLines = 0;
        currentHasMermaid = false;
      }
      currentBlocks.push(block);
      currentLines += totalBlockLines;
      if (hasMermaidHere) currentHasMermaid = true;
    }
  }

  // 最后一块
  if (currentBlocks.length > 0) {
    chunks.push({
      id: `chunk-${chunkIndex}`,
      blocks: currentBlocks,
      hasMermaid: currentHasMermaid,
      estimatedHeight: currentLines * 1.5
    });
  }

  return chunks;
}

/**
 * 懒加载渲染文章内容
 *
 * 使用与 renderPhileBodyBlocks 完全相同的渲染管线，
 * 唯一区别是渲染结果被分块后，首屏只输出前 N 个块，
 * 后续块存储在 template 中，滚动时按需激活。
 */
export async function renderPhileBodyBlocksLazy(phile: Phile): Promise<LazyRenderResult> {
  // 使用与普通渲染完全相同的管线，确保渲染效果一致
  const allBlocks = await renderPhileBodyBlocks(phile);

  // 判断是否有图片和 Mermaid
  const hasImages = allBlocks.some((block) => block.kind === "image");
  const hasMermaid = allBlocks.some((block) => block.kind === "text" && block.html.includes('class="mermaid"'));

  // 将渲染后的块分组为 chunks
  const chunks = groupBlocksIntoChunks(allBlocks);

  // 计算首屏块数
  const initialCount = Math.min(INITIAL_CHUNK_COUNT, Math.max(1, Math.floor(chunks.length / 3)));

  // 渲染首屏块
  const { initialHtml, pendingChunks } = renderInitialChunks(chunks, initialCount);

  // 渲染待加载块（template 存储）
  const pendingHtml = renderPendingTemplates(pendingChunks);

  return {
    isLazy: true,
    initialHtml,
    pendingHtml,
    totalChunks: chunks.length,
    hasImages,
    hasMermaid
  };
}
