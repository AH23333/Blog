/**
 * LazyRender 内容分块模块
 *
 * 将已渲染的文章块（PhileBodyBlock[]）分组为可独立加载的 chunks。
 * 首屏只渲染前 N 个 chunk，后续 chunk 存储在 template 中，
 * 滚动时动态激活。
 *
 * 与 renderPhileBodyBlocks 使用相同的渲染管线，确保渲染效果一致。
 */

import type { LazyChunk, PhileBodyBlock } from "../philes/render";

/**
 * 渲染单个块为 HTML 字符串，使用与 PhileShell.astro 完全相同的标签结构。
 *
 * 非懒加载路径中 PhileShell.astro 对每种 block.kind 使用的标签：
 *   - image → <div class="phile-media">
 *   - math  → <div class="phile-media">
 *   - text  → <div class="textmode-pre phile-body">
 */
function renderBlockHtml(block: PhileBodyBlock): string {
  if (block.kind === "image" || block.kind === "math") {
    return `<div class="phile-media">${block.html}</div>`;
  }
  return `<div class="textmode-pre phile-body">${block.html}</div>`;
}

/**
 * 渲染首屏块（直接插入 DOM 的 HTML）
 *
 * 使用与 PhileShell.astro 非懒加载路径完全相同的 HTML 结构，
 * 每个块单独包裹，额外添加 data-chunk-id 用于懒加载激活追踪。
 *
 * @param chunks - 所有内容块
 * @param initialCount - 首屏显示的块数
 * @returns 首屏 HTML 和待加载的 chunks
 */
export function renderInitialChunks(
  chunks: LazyChunk[],
  initialCount: number
): { initialHtml: string; pendingChunks: LazyChunk[] } {
  const initialChunks = chunks.slice(0, initialCount);
  const pendingChunks = chunks.slice(initialCount);

  const initialHtml = initialChunks
    .map((chunk) => {
      const blocksHtml = chunk.blocks.map((block) => renderBlockHtml(block)).join("\n");
      // 用 data-chunk-id 标记整个 chunk 范围，供懒加载运行时追踪
      return `<div class="lazy-chunk-initial" data-chunk-id="${chunk.id}">${blocksHtml}</div>`;
    })
    .join("\n");

  return { initialHtml, pendingChunks };
}

/**
 * 渲染待加载块的 template 标签
 *
 * 每个待加载 chunk 包含：
 * 1. 一个占位元素（用于 IntersectionObserver 监测）
 * 2. 一个 template 元素（存储实际内容）
 *
 * template 中存储的是与 PhileShell.astro 非懒加载路径完全相同的 HTML 结构，
 * 即每个块单独包裹在 <div class="textmode-pre phile-body"> 或 <div class="phile-media"> 中。
 *
 * @param pendingChunks - 待加载的内容块
 * @returns template 和 placeholder 的 HTML 字符串
 */
export function renderPendingTemplates(pendingChunks: LazyChunk[]): string {
  return pendingChunks
    .map((chunk) => {
      // 占位元素：用于 IntersectionObserver 监测
      // 使用固定最小高度，避免布局跳动
      const placeholderHeight = Math.max(50, Math.min(chunk.estimatedHeight, 300));
      const placeholder =
        `<div class="lazy-placeholder" data-chunk-id="${chunk.id}"` +
        ` style="--placeholder-height: ${placeholderHeight}px;"></div>`;

      // Template 存储实际内容 - 与 PhileShell.astro 非懒加载路径相同结构
      const blocksHtml = chunk.blocks.map((block) => renderBlockHtml(block)).join("\n");
      const template =
        `<template class="lazy-template" data-chunk-id="${chunk.id}"` +
        ` data-has-mermaid="${chunk.hasMermaid}">${blocksHtml}</template>`;

      return placeholder + template;
    })
    .join("\n");
}
