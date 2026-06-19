/**
 * 代码块语法高亮测试 - 验证 ``` 代码块的解析与渲染
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { highlightCodeBlocks } from "./highlight.ts";
import { renderMarkdownToHtml } from "./parser.ts";

// ── highlightCodeBlocks 测试 ──────────────────────────────────────────────

describe("highlightCodeBlocks", () => {
  it("应该为 JavaScript 代码块添加语法高亮", () => {
    const markdown = "```javascript\nconst x = 1;\nconsole.log(x);\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    assert.ok(result.includes("phile-codeblock"));
    assert.ok(result.includes("phile-codeblock-label"));
    assert.ok(result.includes("JavaScript"));
    assert.ok(result.includes("hljs"));
    assert.ok(result.includes("language-javascript"));
    // 语言标签应包含盒绘字符
    assert.ok(result.includes("┌─ JavaScript"));
    // 不应该再有裸的 <pre><code> 结构
    assert.ok(!result.match(/<pre><code[^>]*>const/));
  });

  it("应该为 C 代码块添加语法高亮", () => {
    const markdown = "```c\nint main() {\n  return 0;\n}\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    assert.ok(result.includes("phile-codeblock"));
    assert.ok(result.includes("┌─ C"));
    assert.ok(result.includes("language-c"));
  });

  it("应该为 Python 代码块添加语法高亮", () => {
    const markdown = "```python\ndef hello():\n    print('world')\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    assert.ok(result.includes("phile-codeblock"));
    assert.ok(result.includes("┌─ Python"));
    assert.ok(result.includes("language-python"));
  });

  it("无语言标识的代码块应显示为 Plain Text", () => {
    const markdown = "```\nplain text\nno language\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    assert.ok(result.includes("phile-codeblock"));
    assert.ok(result.includes("┌─ Plain Text"));
  });

  it("应该支持语言别名（js → JavaScript）", () => {
    const markdown = "```js\nconst a = 1;\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    assert.ok(result.includes("┌─ JavaScript"));
  });

  it("应该支持语言别名（py → Python）", () => {
    const markdown = "```py\nprint(1)\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    assert.ok(result.includes("┌─ Python"));
  });

  it("应该处理代码块中的 HTML 特殊字符", () => {
    const markdown = '```html\n<div class="test">\n  <span>hello</span>\n</div>\n```';
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    assert.ok(result.includes("phile-codeblock"));
    assert.ok(result.includes("┌─ HTML"));
    // 不应包含原始 HTML 实体
    assert.ok(!result.includes("&lt;div"));
  });

  it("应该处理代码块中的特殊符号", () => {
    const markdown = "```bash\n$ echo 'hello' | grep 'world'\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    assert.ok(result.includes("phile-codeblock"));
    assert.ok(result.includes("┌─ Bash"));
  });

  it("多行代码块应该完整保留所有行", () => {
    const markdown = "```\nline1\nline2\nline3\nline4\nline5\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    assert.ok(result.includes("line1"));
    assert.ok(result.includes("line2"));
    assert.ok(result.includes("line3"));
    assert.ok(result.includes("line4"));
    assert.ok(result.includes("line5"));
  });

  it("应该处理混合内容中的代码块", () => {
    const markdown = "文本段落\n\n```js\nconst x = 1;\n```\n\n更多文本";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    // 验证文本段落存在
    assert.ok(result.includes("文本段落") || result.includes("cjk"), "应包含文本段落");
    // 验证代码块被包裹
    assert.ok(result.includes("phile-codeblock"), "应包含代码块包装");
    // 验证更多文本存在
    assert.ok(result.includes("更多文本") || result.includes("cjk"), "应包含更多文本");
  });

  it("多个代码块应该各自独立包裹", () => {
    const markdown = "```js\nconst a = 1;\n```\n\n```python\nprint('hello')\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    // 应该有两个独立的 codeblock 容器（只匹配外层 phile-codeblock 语言类，不包括 label 和 content）
    const codeblockMatches = result.match(/<div class="phile-codeblock phile-codeblock-\w+"/g);
    assert.ok(codeblockMatches);
    assert.equal(codeblockMatches.length, 2);

    assert.ok(result.includes("JavaScript"));
    assert.ok(result.includes("Python"));
  });

  it("空代码块应该正常处理", () => {
    const markdown = "```bash\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    assert.ok(result.includes("phile-codeblock"));
    assert.ok(result.includes("┌─ Bash"));
  });

  it("不支持的语言应该回退到自动检测", () => {
    const markdown = "```unknownlang\nsome code here\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    // 应该仍然包裹在 codeblock 中
    assert.ok(result.includes("phile-codeblock"));
    assert.ok(result.includes("┌─ Unknownlang"));
  });

  it("应该包含正确的 HTML 结构", () => {
    const markdown = "```javascript\nconst x = 1;\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    // 验证结构完整性
    assert.ok(result.includes('<div class="phile-codeblock'));
    assert.ok(result.includes('<div class="phile-codeblock-label">'));
    assert.ok(result.includes("┌─ JavaScript"));
    assert.ok(result.includes('<div class="phile-codeblock-content">'));
    assert.ok(result.includes('<pre><code class="hljs'));
  });

  it("不包含代码块的 HTML 应保持不变", () => {
    const html = "<p>普通文本</p><p>没有代码块</p>";
    const result = highlightCodeBlocks(html);

    assert.equal(result, html);
  });
});

// ── 集成测试：renderMarkdownToHtml + highlightCodeBlocks ──────────────────

describe("集成: Markdown 渲染 + 语法高亮", () => {
  it("C 代码块中的指针和类型应正确高亮", () => {
    const markdown = "```c\nint *p = NULL;\nchar buf[256];\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    assert.ok(result.includes("phile-codeblock"));
    assert.ok(result.includes("┌─ C"));
    assert.ok(result.includes("hljs"));
  });

  it("代码块内不应被 ANSI 处理破坏", () => {
    // 代码块内的 #[ 是示例内容，不应被 ANSI 后处理
    const markdown = "```\n#[r|this is not ansi]\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    assert.ok(result.includes("#[r|this is not ansi]"));
  });

  it("代码块使用 green 强调色条，与 ::: 容器区分", () => {
    const markdown = "```javascript\nconst x = 1;\n```";
    const html = renderMarkdownToHtml(markdown);
    const result = highlightCodeBlocks(html);

    // 代码块应有独立的 class 结构
    assert.ok(result.includes("phile-codeblock"));
    // 不应包含 ::: 容器的 class(在没有容器的情况下)
    assert.ok(!result.includes("phile-container"));
  });
});
