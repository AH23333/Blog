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
 * 对 HTML 中的代码块进行语法高亮后处理。
 * 找到所有 <pre><code> 块，应用 highlight.js 高亮，并包裹为带语言标签的容器。
 *
 * 同时保护 ::: 容器内的代码块，避免被包裹两次。
 */
export function highlightCodeBlocks(html: string): string {
  // 保护已有的容器结构（::: 容器内的 <pre> 不重复包裹）
  // 只处理顶层的 <pre><code>，跳过已被 .phile-container-content 包裹的
  let result = html;

  // 匹配 <pre><code class="language-xxx">...</code></pre> 结构
  result = result.replace(
    /<pre><code(?:\s+class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_match, lang: string | undefined, code: string) => {
      // 跳过已在容器内的代码块
      // 检查是否在 phile-container-content 内部（通过检查上下文）
      // 查找匹配的 <pre><code> 块前的最近的父元素
      const matchIndex = result.indexOf(_match);
      if (matchIndex === -1) return _match;

      // 查找匹配块前的最近的 .phile-container-content
      const beforeMatch = result.substring(0, matchIndex);
      const containerContentMatch = beforeMatch.match(/<div class="phile-container-content">.*?$/s);

      // 如果在容器内，跳过处理
      if (containerContentMatch) {
        return _match;
      }

      // 解码 HTML 实体
      const decoded = decodeHtmlEntities(code.trimEnd());

      // 确定语言
      let language = lang || detectLanguage(decoded);

      // 将通用 asm 映射到 x86asm（highlight.js 使用 x86asm）
      if (language === "asm") {
        language = "x86asm";
      }

      // 应用语法高亮
      let highlighted: string;
      try {
        if (language && hljs.getLanguage(language)) {
          const result = hljs.highlight(decoded, { language });
          highlighted = result.value;
        } else {
          // 未知语言，仅做 HTML 转义
          highlighted = hljs.highlightAuto(decoded).value;
        }
      } catch {
        // 高亮失败时回退到纯文本
        highlighted = escapeHtmlContent(decoded);
      }

      const displayName =
        languageDisplayNames[language] ?? (language ? language.charAt(0).toUpperCase() + language.slice(1) : "Code");

      // 生成类似容器的标题：┌─ Python ─────────────────────────────────────────────┐
      const titleWidth = 60; // 与容器一致的内部宽度
      const header = ` ${displayName} `;
      const headerPad = Math.max(0, titleWidth - header.length - 3);
      const topBorder = `┌─${header}─${"─".repeat(headerPad)}┐`;

      return [
        `<div class="phile-codeblock phile-codeblock-${language}" data-no-typewriter>`,
        `<div class="phile-codeblock-label">${topBorder}</div>`,
        `<div class="phile-codeblock-content">`,
        `<pre><code class="hljs${language ? ` language-${language}` : ""}">${highlighted}</code></pre>`,
        `</div>`,
        `</div>`
      ].join("\n");
    }
  );

  return result;
}

/**
 * 解码常见的 HTML 实体。
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

/**
 * 简单的 HTML 内容转义（回退用）。
 */
function escapeHtmlContent(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 根据代码内容推测语言（用于无语言标识的代码块）。
 */
function detectLanguage(_code: string): string {
  return "plaintext";
}
