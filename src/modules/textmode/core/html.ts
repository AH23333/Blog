import { cjkAtlasStyle } from "../cjk/atlas";

const cjkSpanCache = new Map<string, string>();

export function escapeHtml(input: string): string {
  return input.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function textHtml(input: string): string {
  return escapeHtml(input).replace(
    /([\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]+)/gu,
    (match) => [...match].map((char) => cjkSpan(char)).join("")
  );
}

export function link(href: string, text: string): string {
  return `<a href="${escapeHtml(href)}">${textHtml(text)}</a>`;
}

export function externalLink(href: string, text: string): string {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${textHtml(text)}</a>`;
}

function cjkSpan(char: string): string {
  const cached = cjkSpanCache.get(char);

  if (cached) {
    return cached;
  }

  const style = cjkAtlasStyle(char);

  if (!style) {
    // 字形未在字体图集中，降级为普通文本（失去位图字体效果但不阻塞渲染）
    const html = escapeHtml(char);
    cjkSpanCache.set(char, html);
    return html;
  }

  const html = `<span class="cjk cjk-bitmap" style="${style}">${char}</span>`;

  cjkSpanCache.set(char, html);
  return html;
}
