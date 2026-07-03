/**
 * 占位符管理抽象层
 *
 * 统一管理文本渲染管道中的各类占位符提取和恢复，
 * 消除分散在 render.ts 和 ansi/render.ts 中的重复模式。
 *
 * 已注册的占位符类型：
 *  - plain-text ：```Plain Text ... ``` 围栏块
 *  - ink-block  ：--[ ink ]-- 块
 *  - code-block ：```...``` 围栏代码块（需在 Markdown 解析前恢复）
 *  - ansi-marker：#[role|text] 行内颜色标记
 */

import {
  type AnsiInlineMarker,
  extractAndRenderInkBlocks,
  processAnsiInlineMarkup,
  restoreInkBlocks
} from "../ansi/render";
import { escapeHtml, textHtml } from "../core/html";
import { extractFencedCodeBlocks } from "../markdown/codeblock";

// ── 接口 ─────────────────────────────────────────────────────────────────

/**
 * 占位符管理器接口。
 * 每个实现负责一种占位符类型的一对提取/恢复操作。
 */
export interface PlaceholderManager<T = string> {
  /** 唯一标识符，用于管道中选择性恢复 */
  readonly id: string;
  /** 从文本中提取占位符，返回处理后文本和提取的项 */
  extract(text: string): { processed: string; items: T[] };
  /** 将占位符恢复为最终内容（反向操作） */
  restore(text: string, items: T[]): string;
}

// ── 管道 ─────────────────────────────────────────────────────────────────

/**
 * 占位符管道。
 *
 * 按注册顺序依次提取占位符，按逆序恢复。
 * 支持选择性恢复：通过 restoreSome() 可仅恢复指定 id 的管理器。
 */
export class PlaceholderPipeline {
  private managers: PlaceholderManager<unknown>[] = [];

  /** 注册一个占位符管理器（返回 this 以支持链式调用） */
  register<T>(manager: PlaceholderManager<T>): this {
    this.managers.push(manager);
    return this;
  }

  /**
   * 按注册顺序依次提取所有占位符。
   * @returns 处理后的文本和上下文映射（id → items）
   */
  extract(text: string): { processed: string; contexts: Map<string, unknown[]> } {
    const contexts = new Map<string, unknown[]>();
    let current = text;

    for (const manager of this.managers) {
      const result = manager.extract(current);
      contexts.set(manager.id, result.items);
      current = result.processed;
    }

    return { processed: current, contexts };
  }

  /**
   * 按逆序恢复所有占位符。
   */
  restore(text: string, contexts: Map<string, unknown[]>): string {
    let current = text;

    for (let i = this.managers.length - 1; i >= 0; i--) {
      const manager = this.managers[i];
      const items = contexts.get(manager.id) ?? [];
      current = manager.restore(current, items);
    }

    return current;
  }

  /**
   * 按逆序恢复部分占位符（仅恢复 id 在指定集合中的管理器）。
   *
   * 典型用法：
   *  - 代码块需在 Markdown 解析前恢复  → restoreSome(text, ctx, new Set(["code-block"]))
   *  - ANSI/Ink/PlainText 在解析后恢复 → restoreSome(html, ctx, new Set(["ansi-marker", "ink-block", "plain-text"]))
   */
  restoreSome(text: string, contexts: Map<string, unknown[]>, ids: Set<string>): string {
    let current = text;

    for (let i = this.managers.length - 1; i >= 0; i--) {
      const manager = this.managers[i];
      if (!ids.has(manager.id)) continue;
      const items = contexts.get(manager.id) ?? [];
      current = manager.restore(current, items);
    }

    return current;
  }
}

// ── 管理器实现 ───────────────────────────────────────────────────────────

// ─ Plain Text 块管理器 ─

const PTBLOCK_REGEX = /```Plain Text\n([\s\S]*?)```/g;
const PTBLOCK_PREFIX = "\uE501";

/**
 * Plain Text 围栏块管理器。
 *
 * 提取 ```Plain Text ... ``` 块，预渲染为 <pre class="plaintext-pre">，
 * 避免 markdown-it 的 4 空格缩进规则误解析。
 */
class PlainTextBlockManager implements PlaceholderManager<string> {
  readonly id = "plain-text";

  extract(text: string): { processed: string; items: string[] } {
    const items: string[] = [];

    const processed = text.replace(PTBLOCK_REGEX, (_, content: string) => {
      const index = items.length;
      const lines = (content as string).split("\n");
      const htmlLines = lines.map((line: string) => textHtml(line));
      items.push(`<pre class="plaintext-pre">${htmlLines.join("\n")}</pre>`);
      return `${PTBLOCK_PREFIX}PTBLOCK_${index}${PTBLOCK_PREFIX}`;
    });

    return { processed, items };
  }

  restore(text: string, items: string[]): string {
    if (items.length === 0) return text;
    const regex = new RegExp(`${escapeRegExp(PTBLOCK_PREFIX)}PTBLOCK_(\\d+)${escapeRegExp(PTBLOCK_PREFIX)}`, "g");
    return text.replace(regex, (_, index: string) => items[parseInt(index, 10)] ?? "");
  }
}

// ─ Ink 块管理器 ─

/**
 * Ink 块管理器。
 *
 * 提取 --[ ink ]-- 块，预渲染为 ASCII 艺术 HTML。
 * 需要 width 参数以正确渲染文本布局。
 */
class InkBlockManager implements PlaceholderManager<string> {
  readonly id = "ink-block";

  constructor(private readonly width: number) {}

  extract(text: string): { processed: string; items: string[] } {
    const { processedText, blocks } = extractAndRenderInkBlocks(text, this.width);
    return { processed: processedText, items: blocks };
  }

  restore(text: string, items: string[]): string {
    return restoreInkBlocks(text, items);
  }
}

// ─ 代码块管理器 ─

const CODEBLOCK_PREFIX = "\uE502";

/**
 * 围栏代码块管理器。
 *
 * 提取 ```...``` 围栏块，避免 ANSI 解析器剥离代码块内的 LaTeX 反斜杠命令。
 * 此管理器需要在 Markdown 解析前恢复（与 ANSI/Ink/PlainText 不同）。
 */
class CodeBlockManager implements PlaceholderManager<string> {
  readonly id = "code-block";

  extract(text: string): { processed: string; items: string[] } {
    const { processed, blocks } = extractFencedCodeBlocks(text, (i) => `${CODEBLOCK_PREFIX}CB_${i}${CODEBLOCK_PREFIX}`);
    return { processed, items: blocks };
  }

  restore(text: string, items: string[]): string {
    if (items.length === 0) return text;
    // 使用 split + join 替代 replaceAll，避免大字符串 replaceAll 的 RangeError
    const parts = text.split(`${CODEBLOCK_PREFIX}CB_`);
    if (parts.length <= 1) return text;
    const result: string[] = [parts[0]];
    for (let i = 1; i < parts.length; i++) {
      const suffixIdx = parts[i].indexOf(CODEBLOCK_PREFIX);
      if (suffixIdx === -1) {
        result.push(`${CODEBLOCK_PREFIX}CB_${parts[i]}`);
        continue;
      }
      const blockIndex = parseInt(parts[i].slice(0, suffixIdx), 10);
      const remainder = parts[i].slice(suffixIdx + CODEBLOCK_PREFIX.length);
      if (!Number.isNaN(blockIndex) && blockIndex < items.length) {
        result.push(items[blockIndex]);
      }
      result.push(remainder);
    }
    return result.join("");
  }
}

// ─ ANSI 行内标记管理器 ─

/**
 * ANSI 行内标记管理器。
 *
 * 提取 #[role|text] 标记为 Unicode 占位符（U+E400–U+E4FF），
 * 在 Markdown 渲染后恢复为 HTML span。
 */
class AnsiMarkerManager implements PlaceholderManager<AnsiInlineMarker> {
  readonly id = "ansi-marker";

  extract(text: string): { processed: string; items: AnsiInlineMarker[] } {
    const { processed, markers } = processAnsiInlineMarkup(text);
    return { processed, items: [...markers.values()] };
  }

  restore(text: string, items: AnsiInlineMarker[]): string {
    // 按 processAnsiInlineMarkup 的占位符生成规则，从数组重建映射并恢复
    return restoreAnsiInlineMarkupFromItems(text, items);
  }
}

/**
 * 从 AnsiInlineMarker 数组恢复 ANSI 行内标记占位符。
 *
 * 与 restoreAnsiInlineMarkup 的区别：后者使用 Map<placeholder, marker>，
 * 此处从数组重建映射，占位符生成规则与 processAnsiInlineMarkup 一致。
 */
function restoreAnsiInlineMarkupFromItems(html: string, items: AnsiInlineMarker[]): string {
  const ANSI_PLACEHOLDER_START = 0xe400;
  const ANSI_PLACEHOLDER_MAX = 0xe4ff;
  let result = html;

  for (let i = 0; i < items.length; i++) {
    const codePoint = ANSI_PLACEHOLDER_START + i;
    const placeholder = codePoint > ANSI_PLACEHOLDER_MAX ? `\uE400AN${i}\uE401` : String.fromCodePoint(codePoint);
    const { role, text } = items[i];
    const escaped = escapeHtml(text);
    const replacement = `<span class="ansi ansi-${role}">${escaped}</span>`;
    result = result.replaceAll(placeholder, replacement);
  }

  return result;
}

// ── 工厂函数 ─────────────────────────────────────────────────────────────

/**
 * 创建标准占位符管道（用于文章渲染）。
 *
 * 注册顺序（也是提取顺序）：
 *   1. plain-text  → 提取 Plain Text 围栏块
 *   2. ink-block   → 提取 ink 块
 *   3. code-block  → 保护围栏代码块（需在 Markdown 前恢复）
 *   4. ansi-marker → 提取行内 ANSI 颜色标记
 */
export function createPhilePipeline(width: number): PlaceholderPipeline {
  return new PlaceholderPipeline()
    .register(new PlainTextBlockManager())
    .register(new InkBlockManager(width))
    .register(new CodeBlockManager())
    .register(new AnsiMarkerManager());
}

/**
 * 创建轻量占位符管道（用于懒加载分块渲染）。
 *
 * 仅包含 code-block 和 ansi-marker，因为懒加载分块不需要
 * Plain Text 和 Ink 块的预处理（它们在分块阶段已处理）。
 */
export function createLazyPipeline(): PlaceholderPipeline {
  return new PlaceholderPipeline().register(new CodeBlockManager()).register(new AnsiMarkerManager());
}

// ── 工具 ─────────────────────────────────────────────────────────────────

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
