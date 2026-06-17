import { textmodeConfig } from "../../config";
import {
  mathBlockHtml,
  processMathInText,
  replaceMathPlaceholders,
  resetEquationCounter,
  resetEquationLabels
} from "../math/render";
import { renderAnsiText } from "../textmode/ansi/render";
import { escapeHtml, link, textHtml } from "../textmode/core/html";
import { wrapWordsCells } from "../textmode/core/layout";
import { lifeFrameHeight, lifeFrameHtml } from "../textmode/life/art";
import { parseMarkdown, renderMarkdownToAnsi } from "../textmode/markdown/parser";
import type { Phile } from "./model";

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

export function renderPhileBodyBlocks(phile: Phile): PhileBodyBlock[] {
  resetEquationCounter();
  resetEquationLabels();

  return splitBodyBlocks(phile.body ?? "").flatMap((block) => {
    if (block.kind === "image") {
      return [
        {
          kind: "image" as const,
          html: renderImage(block.src, block.alt)
        }
      ];
    }

    // 处理数学公式
    const { text: cleanText, blockMath, inlineMath } = processMathInText(block.text);

    const results: PhileBodyBlock[] = [];

    // 处理块级公式：在文本前后插入 math 块
    // 这里简化处理：如果文本包含块级公式，将文本分割为多个段落
    if (blockMath.length > 0 || inlineMath.size > 0) {
      // 将文本按块级公式位置分割
      const textParts = cleanText.split(/\$\$[\s\S]*?\$\$/g);
      const mathBlocks = [...blockMath];

      // 交替插入文本块和公式块
      const maxLen = Math.max(textParts.length, mathBlocks.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < textParts.length && textParts[i].trim().length > 0) {
          results.push(renderTextBlock(textParts[i], inlineMath));
        }
        if (i < mathBlocks.length) {
          results.push({
            kind: "math",
            html: mathBlockHtml(mathBlocks[i])
          });
        }
      }
    } else {
      results.push(renderTextBlock(cleanText, inlineMath));
    }

    return results;
  });
}

function renderTextBlock(text: string, inlineMath: Map<string, string>): PhileBodyBlock {
  const isAnsiStyle = text.includes("#[") || text.includes("──[");
  let rawText: string;
  if (isAnsiStyle) {
    rawText = text;
  } else {
    try {
      const blocks = parseMarkdown(text);
      rawText = renderMarkdownToAnsi(blocks, textmodeConfig.bodyWidth).join("\n");
    } catch {
      rawText = text;
    }
  }
  let html = `${renderAnsiText(rawText, textmodeConfig.bodyWidth)}\n`;

  // 替换行内公式占位符
  if (inlineMath.size > 0) {
    html = replaceMathPlaceholders(html, inlineMath);
  }

  return { kind: "text", html };
}

export function renderPhileFooterPre(phile: Phile): string {
  return `\n\nret ${link(phile.route.volumeHref, `<volume_${phile.route.volume}>`)}\n`;
}

type ParsedBodyBlock = { kind: "text"; text: string } | { kind: "image"; src: string; alt: string };

function splitBodyBlocks(input: string): ParsedBodyBlock[] {
  const blocks: ParsedBodyBlock[] = [];
  const textLines: string[] = [];

  for (const line of input.split("\n")) {
    const image = parseImageLine(line);

    if (!image) {
      textLines.push(line);
      continue;
    }

    flushTextBlock(blocks, textLines);
    blocks.push({ kind: "image", ...image });
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
