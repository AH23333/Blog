/**
 * 多主题文章渲染器
 *
 * 将 phile 正文渲染为主题中立的 HTML（class 约定由各主题 CSS 负责视觉），
 * 与 textmode 渲染管线共享同一套底层能力：
 *  - KaTeX 服务端数学公式（modules/math）
 *  - ANSI 行内颜色标记 #[role|text]
 *  - INK 渐变块 --[ ink ]--
 *  - ::: 容器
 *  - ```Plain Text 块
 *  - mermaid 围栏 → <pre class="mermaid">（客户端渲染）
 *  - highlight.js 代码高亮
 *  - ──[ N ]──[ Title ] 章节分隔 / ┌─ N ─[ Title ]─┐ 框线小节 → 语义化标题
 *
 * 与 textmode 管线的差异：
 *  - 不做位图 CJK 包裹（textHtml），输出标准 HTML 文本
 *  - 不做定宽单元格布局，交给浏览器流式排版
 *  - 框线绘制的 ASCII 艺术（流程图/证明链/框线表格）自动转为等宽 <pre class="ascii-art">
 */

import MarkdownIt from "markdown-it";
import {
  BLOCK_MATH_PLACEHOLDER,
  type MathBlock,
  mathBlockHtml,
  processMathInText,
  replaceMathPlaceholders,
  resetEquationCounter,
  resetEquationLabels
} from "../math/render";
import type { Phile } from "../philes/model";
import { convertBlockMathInTableRows, getArticleDir, resolveImagePath } from "../philes/render";
import { type AnsiInlineMarker, processAnsiInlineMarkup, roleForMask } from "../textmode/ansi/render";
import { escapeHtml } from "../textmode/core/html";
import { extractFencedCodeBlocks, extractPlainTextFences, fencedLineIndices } from "../textmode/markdown/codeblock";
import { splitContainerSegments } from "../textmode/markdown/container";
import { highlightCode } from "../textmode/markdown/highlight";
import { normalizeTableSeparators } from "../textmode/markdown/parser";

// ── markdown-it 实例 ──────────────────────────────────────────────────────

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
  highlight: (code: string, lang: string): string => {
    // mermaid 源码不做语法高亮，避免污染客户端 mermaid 解析
    if (lang === "mermaid") {
      return "";
    }
    return highlightCode(code, lang ?? "");
  }
});

// GFM：表格 & 删除线
md.enable(["table", "strikethrough"]);

// ── 占位符 ────────────────────────────────────────────────────────────────

/** 代码块占位符前缀（与 textmode 管线约定一致，PUA 区） */
const CODE_PREFIX = "\uE502";

/** INK 块占位符 */
const INK_PREFIX = "\uE500";

/** Plain Text 块占位符 */
const PT_PREFIX = "\uE501";

export type ThemeHeading = {
  depth: number;
  slug: string;
  text: string;
};

export type ThemeArticleContent = {
  html: string;
  hasMermaid: boolean;
  /** 目录数据（h2–h4，带 id，客户端 scrollspy 用） */
  headings: ThemeHeading[];
};

// ── 章节分隔转换 ──────────────────────────────────────────────────────────

/**
 * 将 phile 结构化分隔线转为 Markdown 标题。
 * 必须在围栏代码块已替换为占位符后调用，避免示例代码被误转换。
 *
 *  - ──[ 1.0 ]────...──[ Summary ]   → ## 1.0 Summary
 *  - ──[ EOF ]─────...                → ---（水平分隔线）
 *  - ┌─ 1.1 ─────...[ Title ]─┐      → ### 1.1 Title
 *  - [ 0. Summary ]────...───        → ## 0. Summary
 */
function convertSectionHeaders(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      // ──[ N ]──...──[ Title ]
      let match = line.match(/^\s*─+\[\s*([^\]]+?)\s*\](?:\s*─+\s*\[\s*([^\]]*?)\s*\])?\s*$/);
      if (match) {
        const num = match[1].trim();
        const title = (match[2] ?? "").trim();

        if (num.toLowerCase() === "eof") {
          return "---";
        }
        if (title.length > 0) {
          return `## ${num} ${title}`;
        }
        return `## ${num}`;
      }

      // ┌─ N ────...[ Title ]─┐
      match = line.match(/^\s*┌─+\s*([\d.]+)\s*─*\[?\s*([^\]┐]*?)\s*\]?\s*─*┐\s*$/);
      if (match) {
        const num = match[1].trim();
        const title = (match[2] ?? "").trim();
        return title.length > 0 ? `### ${num} ${title}` : `### ${num}`;
      }

      // [ N. Title ]────────...（ANSI Ink 风格章节头）
      match = line.match(/^\s*\[\s*(\d+(?:\.\d+)?\.?\s+[^\]]*?)\s*\]\s*─{4,}\s*(?:\/\/\s*)?(?:─+)?\s*$/);
      if (match) {
        return `## ${match[1].trim()}`;
      }

      return line;
    })
    .join("\n");
}

// ── INK 块（主题中立渲染） ────────────────────────────────────────────────

const inkBlockPattern = /^\s*--\[ ink \]--\s*$/;
const inkTextPrefixPattern = /^\|(.*)$/;
const inkMaskPrefixPattern = /^~(.*)$/;

function inkSpan(text: string, role: string | undefined): string {
  return role ? `<span class="ansi ansi-${role}">${escapeHtml(text)}</span>` : escapeHtml(text);
}

/** 渲染 INK 单行：按掩码逐字符着色，连续同色合并为一个 span */
function renderInkLine(text: string, mask: string): string {
  let result = "";
  let currentRole: string | undefined;
  let buffer = "";

  for (let i = 0; i < text.length; i++) {
    const role = roleForMask(mask[i]);

    if (role === currentRole) {
      buffer += text[i];
      continue;
    }

    if (buffer.length > 0) {
      result += inkSpan(buffer, currentRole);
    }

    currentRole = role;
    buffer = text[i];
  }

  if (buffer.length > 0) {
    result += inkSpan(buffer, currentRole);
  }

  return result;
}

function renderThemeInkBlock(lines: string[]): string {
  const rendered: string[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const textMatch = lines[cursor].match(inkTextPrefixPattern);
    const maskMatch = lines[cursor + 1]?.match(inkMaskPrefixPattern);

    if (textMatch && maskMatch) {
      rendered.push(`<div class="ink-line">${renderInkLine(textMatch[1] ?? "", maskMatch[1] ?? "")}</div>`);
      cursor += 2;
      continue;
    }

    if (lines[cursor].match(inkMaskPrefixPattern)) {
      cursor += 1;
      continue;
    }

    rendered.push(`<div class="ink-line">${escapeHtml(lines[cursor])}</div>`);
    cursor += 1;
  }

  return `<div class="ink-block">${rendered.join("")}</div>`;
}

/** 提取所有 --[ ink ]-- 块并渲染，替换为占位符 */
function extractThemeInkBlocks(text: string, blocks: string[]): string {
  const lines = text.split("\n");
  // 围栏代码块内的 --[ ink ]-- 是文档示例，不是 INK 块标记；
  // 若不跳过，提取会吞掉闭栏行导致围栏失衡（下游 Markdown 渲染级联错乱）
  const fencedLines = fencedLineIndices(text);
  const outputLines: string[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    if (!lines[cursor].match(inkBlockPattern) || fencedLines.has(cursor)) {
      outputLines.push(lines[cursor]);
      cursor += 1;
      continue;
    }

    cursor += 1;
    const blockLines: string[] = [];
    while (cursor < lines.length && lines[cursor].trim().length > 0) {
      blockLines.push(lines[cursor]);
      cursor += 1;
    }

    blocks.push(renderThemeInkBlock(blockLines));
    outputLines.push(`${INK_PREFIX}INK_${blocks.length - 1}${INK_PREFIX}`);
  }

  return outputLines.join("\n");
}

function restoreThemeInkBlocks(html: string, blocks: string[]): string {
  if (blocks.length === 0) return html;
  const regex = new RegExp(`${INK_PREFIX}INK_(\\d+)${INK_PREFIX}`, "g");
  return html.replace(regex, (_, index: string) => blocks[parseInt(index, 10)] ?? "");
}

// ── Plain Text 块 ─────────────────────────────────────────────────────────

function extractPlainTextBlocks(text: string, blocks: string[]): string {
  const { processed, blocks: rawBlocks } = extractPlainTextFences(text, (i) => `${PT_PREFIX}PT_${i}${PT_PREFIX}`);

  for (const content of rawBlocks) {
    blocks.push(`<pre class="ascii-art">${escapeHtml(content.replace(/\n$/, ""))}</pre>`);
  }

  return processed;
}

function restorePlainTextBlocks(html: string, blocks: string[]): string {
  if (blocks.length === 0) return html;
  const regex = new RegExp(`${PT_PREFIX}PT_(\\d+)${PT_PREFIX}`, "g");
  return html.replace(regex, (_, index: string) => blocks[parseInt(index, 10)] ?? "");
}

// ── 代码块保护 ────────────────────────────────────────────────────────────

function extractCodeBlocks(text: string): { processed: string; blocks: string[] } {
  return extractFencedCodeBlocks(text, (i) => `${CODE_PREFIX}CB_${i}${CODE_PREFIX}`);
}

function restoreCodeBlocks(text: string, blocks: string[]): string {
  if (blocks.length === 0) return text;
  const parts = text.split(`${CODE_PREFIX}CB_`);
  if (parts.length <= 1) return text;

  const result: string[] = [parts[0]];
  for (let i = 1; i < parts.length; i++) {
    const suffixIdx = parts[i].indexOf(CODE_PREFIX);
    if (suffixIdx === -1) {
      result.push(`${CODE_PREFIX}CB_${parts[i]}`);
      continue;
    }
    const blockIndex = parseInt(parts[i].slice(0, suffixIdx), 10);
    const remainder = parts[i].slice(suffixIdx + CODE_PREFIX.length);
    if (!Number.isNaN(blockIndex) && blockIndex < blocks.length) {
      result.push(blocks[blockIndex]);
    }
    result.push(remainder);
  }
  return result.join("");
}

// ── ANSI 行内标记 ─────────────────────────────────────────────────────────

function restoreAnsiMarkers(html: string, markers: Map<string, AnsiInlineMarker>): string {
  let result = html;

  for (const [placeholder, marker] of markers) {
    result = result.replaceAll(
      placeholder,
      () => `<span class="ansi ansi-${marker.role}">${escapeHtml(marker.text)}</span>`
    );
  }

  return result;
}

// ── HTML 后处理 ───────────────────────────────────────────────────────────

/** 图片路径规范化 + 懒加载 */
function normalizeImages(html: string, articleDir: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcMatch = tag.match(/\bsrc="([^"]*)"/i);
    if (!srcMatch) {
      return tag;
    }

    const resolved = escapeHtml(resolveImagePath(srcMatch[1], articleDir));
    let result = tag.replace(srcMatch[0], `src="${resolved}"`);

    if (!/\bloading=/.test(result)) {
      result = result.replace(/\/?>$/, ' loading="lazy" decoding="async" />');
    }

    return result;
  });
}

/** mermaid 围栏代码块 → <pre class="mermaid">（客户端渲染） */
function transformMermaidCodeBlocks(html: string): string {
  return html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_, code: string) => `<pre class="mermaid">${code}</pre>`
  );
}

/**
 * 本地图片包成灯箱触发按钮（与 textmode 管线的 phile-image 契约一致）：
 *  - 行内 / 表格内图片 → <button data-lightbox-image> 行内触发器
 *  - 整段图片 → <figure class="phile-image"> + figcaption（alt 非空时）
 * 外部图片（https 等）保持原样。
 */
function wrapLightboxImages(html: string): string {
  const inlineTrigger =
    '<button class="phile-image-trigger phile-image-trigger-inline" type="button" data-lightbox-image aria-label="Open image preview">';

  const wrapped = html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!/\bsrc="\/images\//.test(tag)) {
      return tag;
    }
    return `${inlineTrigger}${tag}</button>`;
  });

  return wrapped.replace(
    new RegExp(`<p>${escapeRegExp(inlineTrigger)}(<img\\b[^>]*>)</button></p>`, "g"),
    (_match, img: string) => {
      const alt = img.match(/\balt="([^"]*)"/i)?.[1] ?? "";
      const caption = alt.trim().length > 0 ? `<figcaption>${escapeHtml(alt)}</figcaption>` : "";
      return `<figure class="phile-image">${inlineTrigger.replace("phile-image-trigger-inline", "phile-image-trigger")}${img}</button>${caption}</figure>`;
    }
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── 标题 id / 目录数据 ────────────────────────────────────────────────────

const HEADING_TAG_PATTERN = /<h([1-6])>([\s\S]*?)<\/h\1>/g;

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

/** GitHub 风格 slug：小写、空白转 -、去除标点（保留中日韩文字与字母数字） */
function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "");
}

/**
 * 为正文标题补 id 与悬浮锚点链接，并抽取目录数据（h2–h4）。
 * 在全部占位符恢复之后调用，标题文本已是最终 HTML。
 */
function annotateHeadings(html: string, headings: ThemeHeading[]): string {
  const usedSlugs = new Map<string, number>();

  return html.replace(HEADING_TAG_PATTERN, (_match: string, depthText: string, inner: string) => {
    const depth = parseInt(depthText, 10);
    const text = stripTags(inner).trim();

    let slug = slugifyHeading(text);
    if (slug.length === 0) {
      slug = "section";
    }
    const seen = usedSlugs.get(slug) ?? 0;
    usedSlugs.set(slug, seen + 1);
    const id = seen === 0 ? slug : `${slug}-${seen}`;

    if (depth >= 2 && depth <= 4 && text.length > 0) {
      headings.push({ depth, slug: id, text });
    }

    const anchor = depth >= 2 ? `<a data-heading-anchor href="#${id}" aria-hidden="true"></a>` : "";

    return `<h${depth} id="${id}">${inner}${anchor}</h${depth}>`;
  });
}

const BOX_ART_CHARS = /[─│┌┐└┘├┤┬┴┼►▼✓✗═║╔╗╚╝╠╣╦╩╬]/g;

/**
 * 将框线绘制密集的段落（流程图 / 证明链 / 框线表格）转为等宽 <pre class="ascii-art">。
 * 在 ANSI 占位符恢复前调用，占位符（PUA 字符）不影响密度判定。
 */
function transformAsciiArtParagraphs(html: string): string {
  return html.replace(/<p>([\s\S]*?)<\/p>/g, (match, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "");
    const boxCount = (text.match(BOX_ART_CHARS) || []).length;
    const nonSpaceLength = text.replace(/\s/g, "").length;

    if (boxCount >= 3 || (boxCount > 0 && nonSpaceLength > 0 && boxCount / nonSpaceLength > 0.12)) {
      return `<pre class="ascii-art">${inner}</pre>`;
    }

    return match;
  });
}

/**
 * 将无语言标注的代码块（缩进代码块 / 裸围栏）转为 <pre class="ascii-art">。
 * 此类内容在本站多为 ASCII 艺术或对齐示例，等宽展示更合适。
 */
function transformBareCodeBlocks(html: string): string {
  return html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (_, inner: string) => {
    return `<pre class="ascii-art">${inner}</pre>`;
  });
}

// ── 文本块渲染 ────────────────────────────────────────────────────────────

/**
 * 渲染已提取数学公式后的文本块（可能含行内公式占位符）。
 */
function renderTextChunk(text: string, articleDir: string): string {
  // 1. Plain Text 围栏块
  const plainBlocks: string[] = [];
  let current = extractPlainTextBlocks(text, plainBlocks);

  // 2. INK 块
  const inkBlocks: string[] = [];
  current = extractThemeInkBlocks(current, inkBlocks);

  // 3. 围栏代码块保护
  const { processed: withCodePlaceholders, blocks: codeBlocks } = extractCodeBlocks(current);

  // 4. ANSI 行内标记提取（代码块已被占位符替换，不会被误处理）
  const { processed: ansiProcessed, markers } = processAnsiInlineMarkup(withCodePlaceholders);

  // 5. 章节分隔 → Markdown 标题（在代码保护之后调用）
  const headered = convertSectionHeaders(ansiProcessed);

  // 6. 恢复代码块（必须在 Markdown 解析前）
  const restored = restoreCodeBlocks(headered, codeBlocks);

  // 7. 容器分割 + Markdown 渲染
  const segments = splitContainerSegments(restored);
  const parts: string[] = [];

  for (const segment of segments) {
    if (segment.kind === "container") {
      const type = escapeHtml(segment.type);
      const title = segment.title ? escapeHtml(segment.title) : escapeHtml(segment.type.toUpperCase());
      const inner = renderMarkdownHtml(segment.content, articleDir);
      parts.push(
        `<div class="callout callout-${type}">`,
        `<div class="callout-title">${title}</div>`,
        `<div class="callout-body">${inner}</div>`,
        `</div>`
      );
    } else if (segment.content.trim().length > 0) {
      parts.push(renderMarkdownHtml(segment.content, articleDir));
    }
  }

  let html = parts.join("\n");

  // 8. 恢复 ANSI / INK / Plain Text
  html = restoreAnsiMarkers(html, markers);
  html = restoreThemeInkBlocks(html, inkBlocks);
  html = restorePlainTextBlocks(html, plainBlocks);

  return html;
}

function renderMarkdownHtml(text: string, articleDir: string): string {
  // 规范化表格分隔行：ANSI 标记（#[C|text]）内的 | 被提取后，
  // 作者为"补偿"而多写的分隔列会导致分隔行与表头列数不一致，整表降级为段落
  const normalized = normalizeTableSeparators(text);
  // 保护行内代码中的 | 避免被表格解析器误解析（与 textmode 管线一致）
  const protectedCode = normalized.replace(/`([^`\n]+)`/g, (match, content: string) => {
    if (!content.includes("|")) return match;
    return `\`${content.replace(/\|/g, "\uE300")}\``;
  });
  let html = md.render(protectedCode).replace(/\uE300/g, "|");
  html = normalizeImages(html, articleDir);
  html = wrapLightboxImages(html);
  html = transformAsciiArtParagraphs(html);
  html = transformBareCodeBlocks(html);
  html = transformMermaidCodeBlocks(html);
  return html;
}

// ── 主入口 ────────────────────────────────────────────────────────────────

/** 渲染缓存：同一篇文章被多个主题页面复用时只渲染一次 */
const renderCache = new Map<string, ThemeArticleContent>();

/**
 * 将 phile 正文渲染为主题中立 HTML。
 * 输出的 class 契约（由各主题 CSS 实现）：
 *   .ansi.ansi-<role>          ANSI 颜色（16 角色）
 *   .ink-block / .ink-line     INK 渐变块
 *   .callout.callout-<type>    ::: 容器（important/note/tip/warning/...）
 *   .ascii-art                 等宽 ASCII 艺术块
 *   .math-block / .math-inline KaTeX 公式
 *   pre.mermaid                Mermaid 图（客户端渲染）
 *   pre code.hljs              highlight.js 代码块
 */
export function renderPhileForThemes(phile: Phile): ThemeArticleContent {
  const cached = renderCache.get(phile.id);
  if (cached) {
    return cached;
  }

  resetEquationCounter();
  resetEquationLabels();

  const articleDir = getArticleDir(phile.route.sourcePath);
  const body = phile.body ?? "";

  // 表格行内块级公式降级为行内公式，避免破坏表格结构
  const preprocessed = convertBlockMathInTableRows(body);

  // 数学公式提取（KaTeX 服务端渲染）
  const { text: cleanText, blockMath, inlineMath, tallBlockMath } = processMathInText(preprocessed);

  // 文本块与块级公式交错渲染
  const textParts = cleanText.split(BLOCK_MATH_PLACEHOLDER);
  const parts: string[] = [];
  const maxLen = Math.max(textParts.length, blockMath.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < textParts.length && textParts[i].trim().length > 0) {
      parts.push(renderTextChunk(textParts[i], articleDir));
    }
    if (i < blockMath.length) {
      parts.push(mathBlockHtml(blockMath[i] as MathBlock));
    }
  }

  let html = parts.join("\n");

  // 高公式（cases/aligned 等）恢复为块级元素
  for (const [marker, tallHtml] of tallBlockMath) {
    html = html.replaceAll(marker, () => tallHtml);
  }

  // 行内公式占位符恢复
  if (inlineMath.size > 0) {
    html = replaceMathPlaceholders(html, inlineMath);
  }

  // 标题 id + 目录数据
  const headings: ThemeHeading[] = [];
  html = annotateHeadings(html, headings);

  const result: ThemeArticleContent = {
    html,
    hasMermaid: /class="mermaid"/.test(html),
    headings
  };

  renderCache.set(phile.id, result);
  return result;
}
