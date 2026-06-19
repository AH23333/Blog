/**
 * LaTeX 数学公式渲染模块
 *
 * 使用 KaTeX 在服务端将 LaTeX 公式渲染为 HTML，
 * 支持行内公式 ($...$) 和块级公式 ($$...$$)，
 * 以及公式编号和交叉引用。
 */

import katex from "katex";

// ── 公式计数器 ────────────────────────────────────────────────────────────

let equationCounter = 0;

export function resetEquationCounter(): void {
  equationCounter = 0;
}

export function getNextEquationNumber(): number {
  equationCounter += 1;
  return equationCounter;
}

// ── 公式引用注册表 ────────────────────────────────────────────────────────

const equationLabels = new Map<string, number>();

export function registerEquationLabel(label: string, number: number): void {
  equationLabels.set(label, number);
}

export function resolveEquationRef(label: string): string {
  const num = equationLabels.get(label);
  if (num === undefined) {
    return `<span class="math-ref math-ref-unknown">(??)</span>`;
  }
  return `<a href="#eq-${label}" class="math-ref">(${num})</a>`;
}

export function resetEquationLabels(): void {
  equationLabels.clear();
}

// ── 公式渲染 ──────────────────────────────────────────────────────────────

export interface MathBlock {
  kind: "math";
  display: boolean;
  latex: string;
  label?: string;
  html: string;
  number?: number;
}

export interface InlineMathResult {
  kind: "inline-math";
  latex: string;
  html: string;
  /** 是否为高公式（需要特殊样式处理） */
  isTall: boolean;
}

export type MathSegment = MathBlock | InlineMathResult;

/**
 * 检测公式是否包含多行结构（cases, aligned, array 等）
 * 这些结构在行内显示时会导致高度过大，需要特殊处理
 */
function detectTallFormula(latex: string): boolean {
  const tallPatterns = [
    /\\begin\s*\{cases\}/,
    /\\begin\s*\{aligned\}/,
    /\\begin\s*\{array\}/,
    /\\begin\s*\{matrix\}/,
    /\\begin\s*\{pmatrix\}/,
    /\\begin\s*\{bmatrix\}/,
    /\\begin\s*\{vmatrix\}/,
    /\\begin\s*\{Vmatrix\}/,
    /\\begin\s*\{split\}/,
    /\\begin\s*\{gather\}/,
    /\\begin\s*\{multline\}/,
    /\\begin\s*\{eqnarray\}/,
    /\\[{}\s]*\\[{}\s]*\\[{}\s]*\\[{}]/ // 多行换行
  ];

  if (tallPatterns.some((pattern) => pattern.test(latex))) {
    return true;
  }

  // 检测包含分数的运算符组合：\lim, \sum, \int, \prod 等结合 \frac
  // 这类公式在行内高度过大，需要提升为块级渲染
  const hasOperator =
    /\\(?:lim|sum|prod|coprod|int|iint|iiint|oint|bigcup|bigcap|bigvee|bigwedge|bigotimes|bigoplus|bigodot)\b/.test(
      latex
    );
  const hasFrac = /\\frac\s*\{/.test(latex);

  if (hasOperator && hasFrac) {
    return true;
  }

  // 检测嵌套分数（\frac 内部再包含 \frac）
  const fracCount = (latex.match(/\\frac\s*\{/g) || []).length;
  if (fracCount >= 2) {
    return true;
  }

  return false;
}

function renderMathBlock(latex: string, display: boolean, label?: string): MathBlock {
  const number = display ? getNextEquationNumber() : undefined;

  if (display && label && number !== undefined) {
    registerEquationLabel(label, number);
  }

  const html = katex.renderToString(latex, {
    displayMode: display,
    throwOnError: false,
    output: "html",
    trust: false,
    strict: false
  });

  return {
    kind: "math",
    display,
    latex,
    label,
    html,
    number
  };
}

function renderInlineMath(latex: string): InlineMathResult {
  const isTall = detectTallFormula(latex);

  const html = katex.renderToString(latex, {
    displayMode: false,
    throwOnError: false,
    output: "html",
    trust: false,
    strict: false
  });

  return {
    kind: "inline-math",
    latex,
    html,
    isTall
  };
}

// ── 公式 HTML 生成 ────────────────────────────────────────────────────────

export function mathBlockHtml(block: MathBlock): string {
  const parts: string[] = [];

  if (block.label) {
    parts.push(`<div class="math-block" id="eq-${block.label}">`);
  } else {
    parts.push('<div class="math-block">');
  }

  parts.push(block.html);

  if (block.number !== undefined) {
    parts.push(`<span class="math-number">(${block.number})</span>`);
  }

  parts.push("</div>");

  return parts.join("\n");
}

export function inlineMathHtml(inline: InlineMathResult): string {
  return `<span class="math-inline">${inline.html}</span>`;
}

/**
 * 将高公式（cases/aligned 等）渲染为块级 HTML。
 * 使用 KaTeX 的 inline 模式（displayMode: false）以保持较小的字体，
 * 但外部包裹块级容器以独立成行。
 */
function mathBlockHtmlForTall(latex: string): string {
  const html = katex.renderToString(latex, {
    displayMode: false,
    throwOnError: false,
    output: "html",
    trust: false,
    strict: false
  });

  return `<div class="math-block math-block-tall"><span class="math-inline-tall-block">${html}</span></div>`;
}

// ── 从文本中提取公式 ──────────────────────────────────────────────────────

// 使用 Unicode 私用区单字符作为占位符，确保不会被 ANSI 行宽换行打断
// U+E000 ~ U+E0FF 共 256 个字符，用于数学公式占位
const PLACEHOLDER_START = 0xe000;
const PLACEHOLDER_MAX = 0xe0ff;

// U+E100 ~ U+E1FF 共 256 个字符，用于代码块保护占位
const CODE_PLACEHOLDER_START = 0xe100;
const CODE_PLACEHOLDER_MAX = 0xe1ff;

function makePlaceholder(index: number): string {
  const codePoint = PLACEHOLDER_START + index;
  if (codePoint > PLACEHOLDER_MAX) {
    return `\uE000MT${index}\uE001`;
  }
  return String.fromCodePoint(codePoint);
}

function makeCodePlaceholder(index: number): string {
  const codePoint = CODE_PLACEHOLDER_START + index;
  if (codePoint > CODE_PLACEHOLDER_MAX) {
    return `\uE100CD${index}\uE101`;
  }
  return String.fromCodePoint(codePoint);
}

export interface ProcessedMathText {
  /** 去除公式后的纯文本，行内公式被替换为占位符（单字符） */
  text: string;
  /** 块级公式列表 */
  blockMath: MathBlock[];
  /** 行内公式映射表：单字符占位符 → 渲染后的 HTML */
  inlineMath: Map<string, string>;
  /** 代码块映射表：代码占位符 → 原始代码文本 */
  codeBlocks: Map<string, string>;
  /** 高公式映射表：特殊标记 → 渲染后的 HTML（需在文本外渲染为块级元素） */
  tallBlockMath: Map<string, string>;
}

/** 高公式在文本中的标记符 */
const TALL_MARKER = "\uE200";

/**
 * 保护代码区域：将围栏代码块和行内代码替换为占位符，
 * 避免其中的 $ 被误解析为数学公式。
 */
function protectCodeRegions(text: string): { protected: string; codeBlocks: Map<string, string> } {
  const codeBlocks = new Map<string, string>();
  let codeCounter = 0;
  let result = text;

  // 第一步：保护围栏代码块 ```...```
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = makeCodePlaceholder(codeCounter);
    codeBlocks.set(placeholder, match);
    codeCounter++;
    return placeholder;
  });

  // 第二步：保护行内代码 `...`
  result = result.replace(/`([^`\n]+)`/g, (match) => {
    const placeholder = makeCodePlaceholder(codeCounter);
    codeBlocks.set(placeholder, match);
    codeCounter++;
    return placeholder;
  });

  return { protected: result, codeBlocks };
}

/**
 * 恢复代码区域：将占位符替换回原始代码文本。
 */
function restoreCodeRegions(text: string, codeBlocks: Map<string, string>): string {
  let result = text;
  for (const [placeholder, code] of codeBlocks) {
    result = result.replaceAll(placeholder, code);
  }
  return result;
}

/**
 * 从文本中提取 LaTeX 公式。
 * - 块级公式 ($$...$$) 被移除并返回为 MathBlock 列表
 * - 行内公式 ($...$) 被替换为占位符，返回占位符到 HTML 的映射
 * - 代码块和行内代码中的 $ 不会被解析为公式
 *
 * 支持块级公式标签：$$...$$ {#label}
 */
export function processMathInText(text: string): ProcessedMathText {
  const blockMath: MathBlock[] = [];
  const inlineMath = new Map<string, string>();
  const tallBlockMath = new Map<string, string>();
  let inlineCounter = 0;
  let tallCounter = 0;

  // 第零步：保护代码区域，避免 $ 误解析
  const { protected: protectedText, codeBlocks } = protectCodeRegions(text);

  // 第一步：处理块级公式 $$...$$
  let processed = protectedText;
  let cursor = 0;
  let result = "";

  while (cursor < processed.length) {
    const blockStart = processed.indexOf("$$", cursor);

    if (blockStart === -1) {
      result += processed.slice(cursor);
      break;
    }

    result += processed.slice(cursor, blockStart);

    const end = processed.indexOf("$$", blockStart + 2);
    if (end === -1) {
      // 未闭合的块级公式，保留原文
      result += "$$";
      cursor = blockStart + 2;
      continue;
    }

    let latex = processed.slice(blockStart + 2, end).trim();

    // 检测标签：可能在公式内部末尾，也可能在 $$ 闭合之后
    let label: string | undefined;
    const inlineLabelMatch = latex.match(/\s*\{#([\w-]+)\}\s*$/);
    if (inlineLabelMatch) {
      label = inlineLabelMatch[1];
      latex = latex.slice(0, inlineLabelMatch.index).trim();
    } else {
      // 检查 $$ 闭合标签之后是否有 {#label}
      const afterEnd = processed.slice(end + 2).trimStart();
      const afterLabelMatch = afterEnd.match(/^\{#([\w-]+)\}/);
      if (afterLabelMatch) {
        label = afterLabelMatch[1];
        // 跳过标签部分，调整 cursor
        const labelEnd = processed.indexOf("}", end + 2);
        if (labelEnd !== -1) {
          cursor = labelEnd + 1;
          if (latex.length > 0) {
            const block = renderMathBlock(latex, true, label);
            blockMath.push(block);
          }
          continue;
        }
      }
    }

    if (latex.length > 0) {
      const block = renderMathBlock(latex, true, label);
      blockMath.push(block);
    }

    cursor = end + 2;
  }

  // 第二步：处理行内公式 $...$（在去除块级公式后的文本中）
  processed = result;
  result = "";
  cursor = 0;

  while (cursor < processed.length) {
    const dollar = findInlineStart(processed, cursor);

    if (dollar === -1) {
      result += processed.slice(cursor);
      break;
    }

    result += processed.slice(cursor, dollar);

    const end = findInlineEnd(processed, dollar + 1);
    if (end === -1) {
      result += "$";
      cursor = dollar + 1;
      continue;
    }

    const latex = processed.slice(dollar + 1, end).trim();
    if (latex.length > 0) {
      const mathResult = renderInlineMath(latex);
      if (mathResult.isTall) {
        // 高公式：使用特殊标记符，将在文本外渲染为块级元素
        const marker = `${TALL_MARKER}${tallCounter}${TALL_MARKER}`;
        tallBlockMath.set(marker, mathBlockHtmlForTall(latex));
        result += marker;
        tallCounter++;
      } else {
        const placeholder = makePlaceholder(inlineCounter);
        inlineMath.set(placeholder, inlineMathHtml(mathResult));
        result += placeholder;
        inlineCounter++;
      }
    }

    cursor = end + 1;
  }

  // 第三步：处理 \ref{label} 交叉引用
  processed = result;
  result = "";
  cursor = 0;

  while (cursor < processed.length) {
    const refStart = processed.indexOf("\\ref{", cursor);

    if (refStart === -1) {
      result += processed.slice(cursor);
      break;
    }

    result += processed.slice(cursor, refStart);

    const closeBrace = processed.indexOf("}", refStart + 5);
    if (closeBrace === -1) {
      result += "\\ref{";
      cursor = refStart + 5;
      continue;
    }

    const label = processed.slice(refStart + 5, closeBrace).trim();
    if (label.length > 0) {
      result += resolveEquationRef(label);
    }

    cursor = closeBrace + 1;
  }

  // 第四步：恢复代码区域
  result = restoreCodeRegions(result, codeBlocks);

  return { text: result, blockMath, inlineMath, codeBlocks, tallBlockMath };
}

/**
 * 将文本中的数学占位符替换为渲染后的 HTML
 */
export function replaceMathPlaceholders(html: string, inlineMath: Map<string, string>): string {
  let result = html;

  for (const [placeholder, mathHtml] of inlineMath) {
    result = result.replaceAll(placeholder, mathHtml);
  }

  return result;
}

function findInlineStart(text: string, start: number): number {
  let cursor = start;

  while (cursor < text.length) {
    const dollar = text.indexOf("$", cursor);
    if (dollar === -1) return -1;

    // 跳过 $$ 块级
    if (text[dollar + 1] === "$") {
      cursor = dollar + 2;
      continue;
    }

    // 跳过转义的 $
    if (dollar > 0 && text[dollar - 1] === "\\") {
      cursor = dollar + 1;
      continue;
    }

    return dollar;
  }

  return -1;
}

function findInlineEnd(text: string, start: number): number {
  let cursor = start;

  while (cursor < text.length) {
    const dollar = text.indexOf("$", cursor);
    if (dollar === -1) return -1;

    // 跳过转义的 $
    if (dollar > 0 && text[dollar - 1] === "\\") {
      cursor = dollar + 1;
      continue;
    }

    return dollar;
  }

  return -1;
}

// ── 清理：去除文本中的公式标记，返回纯文本 ────────────────────────────────

export function stripMathFromText(text: string): string {
  let result = text;

  // 先处理块级公式
  result = result.replace(/\$\$[\s\S]*?\$\$/g, "");

  // 再处理行内公式
  result = result.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, "");

  return result;
}
