/**
 * 代码块语法高亮后处理模块
 *
 * 在 markdown-it 渲染 HTML 后，对 <pre><code> 代码块进行语法高亮处理，
 * 并包裹为带语言标签的容器，与 ::: 容器在视觉上明显区分。
 */

import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import shell from "highlight.js/lib/languages/shell";
import typescript from "highlight.js/lib/languages/typescript";
import x86asm from "highlight.js/lib/languages/x86asm";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { decodeHtmlEntities, escapeHtml } from "../core/html";

// 注册常用语言
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("css", css);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("text", plaintext);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("shell", shell);
hljs.registerLanguage("sh", shell);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("x86asm", x86asm);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);

// 语言名称映射：code class → 显示名称
const languageDisplayNames: Record<string, string> = {
  asm: "Assembly",
  bash: "Bash",
  c: "C",
  cpp: "C++",
  css: "CSS",
  javascript: "JavaScript",
  js: "JavaScript",
  json: "JSON",
  markdown: "Markdown",
  md: "Markdown",
  plaintext: "Plain Text",
  text: "Plain Text",
  python: "Python",
  py: "Python",
  shell: "Shell",
  sh: "Shell",
  typescript: "TypeScript",
  ts: "TypeScript",
  x86asm: "Assembly (x86)",
  xml: "XML",
  html: "HTML",
  yaml: "YAML",
  yml: "YAML"
};

/**
 * 对单个代码块应用语法高亮。
 * 可作为 markdown-it 的 highlight 选项使用。
 */
export function highlightCode(code: string, lang: string): string {
  // 归一化语言标识
  let language = lang || "plaintext";
  if (language === "asm") {
    language = "x86asm";
  }

  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

/**
 * 对 HTML 中的代码块进行语法高亮后处理。
 * 找到所有 <pre><code> 块，应用 highlight.js 高亮，并包裹为带语言标签的容器。
 *
 * 使用 matchAll + 反向处理，避免 O(n²) 字符串查找。
 */
export function highlightCodeBlocks(html: string): string {
  // 匹配已高亮的代码块（hljs class 表明已由 markdown-it highlight 选项处理过）
  const regex = /<pre><code(?:\s+class="[^"]*language-(\w+)[^"]*")?[^>]*>([\s\S]*?)<\/code><\/pre>/g;
  const matches = [...html.matchAll(regex)];

  if (matches.length === 0) return html;

  // 使用数组拼接避免 O(n*m) 字符串拼接
  const parts: string[] = [];
  let lastEnd = 0;
  let skippedInContainer = false;

  for (const match of matches) {
    const matchIndex = match.index;
    if (matchIndex === undefined) continue;

    const fullMatch = match[0];
    const lang = match[1];
    const codeContent = match[2];

    // 检查是否在 phile-container-content 内部
    const beforeMatch = html.substring(lastEnd, matchIndex);
    const containerContentMatch = /<div class="phile-container-content">[^<]*$/.test(beforeMatch);

    if (containerContentMatch) {
      skippedInContainer = true;
      continue;
    }

    // 追加匹配前的文本
    parts.push(beforeMatch);

    // 如果内容已包含 HTML 标签，说明已被 markdown-it highlight 选项高亮
    const isHighlighted = /<span\b/.test(codeContent);
    const highlighted = isHighlighted
      ? codeContent
      : highlightCode(decodeHtmlEntities(codeContent.trimEnd()), lang || "");

    const language = lang || "plaintext";
    const displayName =
      languageDisplayNames[language] ?? (language ? language.charAt(0).toUpperCase() + language.slice(1) : "Code");

    const titleWidth = 60;
    const header = ` ${displayName} `;
    const headerPad = Math.max(0, titleWidth - header.length - 3);
    const topBorder = `┌─${header}─${"─".repeat(headerPad)}┐`;

    parts.push(
      `<div class="phile-codeblock phile-codeblock-${language}" data-no-typewriter>`,
      `<div class="phile-codeblock-label">${topBorder}</div>`,
      `<div class="phile-codeblock-content">`,
      `<pre><code class="hljs${language ? ` language-${language}` : ""}">${highlighted}</code></pre>`,
      `</div>`,
      `</div>`
    );

    lastEnd = matchIndex + fullMatch.length;
  }

  // 如果所有匹配都在容器内，直接返回原 HTML
  if (skippedInContainer && parts.length === 0) return html;

  // 追加剩余文本
  parts.push(html.substring(lastEnd));

  return parts.join("\n");
}
