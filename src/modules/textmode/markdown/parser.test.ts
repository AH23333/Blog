/**
 * Markdown 解析器测试 - 区域块渲染验证
 *
 * 验证代码块（```）和容器块（:::）的解析与渲染正确性。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderMarkdownToHtml, splitContainerSegments } from "./parser.ts";

// ── splitContainerSegments 测试 ──────────────────────────────────────────

describe("splitContainerSegments", () => {
  it("应该正确解析基本 :::type 容器", () => {
    const text = "前文本\n\n:::note\n这是备注内容\n:::\n\n后文本";
    const segments = splitContainerSegments(text);

    assert.equal(segments.length, 3);
    assert.equal(segments[0].kind, "text");
    assert.ok(segments[0].content.includes("前文本"));

    assert.equal(segments[1].kind, "container");
    assert.equal(segments[1].type, "note");
    assert.equal(segments[1].title, undefined);
    assert.equal(segments[1].content, "这是备注内容");

    assert.equal(segments[2].kind, "text");
    assert.ok(segments[2].content.includes("后文本"));
  });

  it("应该支持 :::type[title] 格式", () => {
    const text = ":::note[History]\n历史记录内容\n:::";
    const segments = splitContainerSegments(text);

    assert.equal(segments.length, 1);
    assert.equal(segments[0].kind, "container");
    assert.equal(segments[0].type, "note");
    assert.equal(segments[0].title, "History");
    assert.equal(segments[0].content, "历史记录内容");
  });

  it("应该支持 :::type title 格式（空格分隔）", () => {
    const text = ":::warning 危险操作\n请勿执行\n:::";
    const segments = splitContainerSegments(text);

    assert.equal(segments.length, 1);
    assert.equal(segments[0].kind, "container");
    assert.equal(segments[0].type, "warning");
    assert.equal(segments[0].title, "危险操作");
    assert.equal(segments[0].content, "请勿执行");
  });

  it("应该支持所有四种容器类型", () => {
    const types = ["important", "note", "tip", "warning"];

    for (const type of types) {
      const text = `:::${type}\n内容\n:::`;
      const segments = splitContainerSegments(text);

      assert.equal(segments.length, 1);
      assert.equal(segments[0].kind, "container");
      assert.equal(segments[0].type, type);
    }
  });

  it("应该正确解析多个连续容器", () => {
    const text = ":::note\n第一个备注\n:::\n\n:::warning\n第一个警告\n:::";
    const segments = splitContainerSegments(text);

    assert.equal(segments.length, 2);
    assert.equal(segments[0].kind, "container");
    assert.equal(segments[0].type, "note");
    assert.equal(segments[1].kind, "container");
    assert.equal(segments[1].type, "warning");
  });

  it("应该保护代码块内的 ::: 不被误解析", () => {
    const text = ':::note\n前置备注\n:::\n\n```bash\n:::tip\necho "这不是容器"\n:::\n```\n\n:::warning\n后置警告\n:::';
    const segments = splitContainerSegments(text);

    // 应该只有两个容器：note 和 warning，代码块内的 ::: 不应被解析
    assert.equal(segments.length, 3); // note, text(含代码块), warning

    assert.equal(segments[0].kind, "container");
    assert.equal(segments[0].type, "note");

    assert.equal(segments[1].kind, "text");
    // 代码块内容应完整保留
    assert.ok(segments[1].content.includes("```bash"));
    assert.ok(segments[1].content.includes(":::tip"));
    assert.ok(segments[1].content.includes('echo "这不是容器"'));
    assert.ok(segments[1].content.includes(":::"));

    assert.equal(segments[2].kind, "container");
    assert.equal(segments[2].type, "warning");
  });

  it("应该保护代码块内的 :::[title] 格式不被误解析", () => {
    const text = "```markdown\n:::note[示例]\n# 这是代码示例\n:::\n```";
    const segments = splitContainerSegments(text);

    // 代码块内容不应被解析为容器
    assert.equal(segments.length, 1);
    assert.equal(segments[0].kind, "text");
    assert.ok(segments[0].content.includes(":::note[示例]"));
    assert.ok(segments[0].content.includes("```markdown"));
  });

  it("应该处理空容器", () => {
    const text = ":::note\n:::";
    const segments = splitContainerSegments(text);

    assert.equal(segments.length, 1);
    assert.equal(segments[0].kind, "container");
    assert.equal(segments[0].type, "note");
    assert.equal(segments[0].content, "");
  });

  it("应该处理只有文本无容器的情况", () => {
    const text = "这是普通文本\n没有任何容器";
    const segments = splitContainerSegments(text);

    assert.equal(segments.length, 1);
    assert.equal(segments[0].kind, "text");
    assert.equal(segments[0].content, text);
  });

  it("不完整的三冒号不应被识别为容器", () => {
    const text = "::notacontainer\n内容\n::";
    const segments = splitContainerSegments(text);

    // :: 不是 ::: ，不应被识别
    assert.equal(segments.length, 1);
    assert.equal(segments[0].kind, "text");
  });
});

// ── renderMarkdownToHtml 测试 ────────────────────────────────────────────

describe("renderMarkdownToHtml - 代码块", () => {
  it("应该正确渲染围栏代码块", () => {
    const html = renderMarkdownToHtml("```javascript\nconsole.log('hello');\n```");

    assert.ok(html.includes("<pre>"));
    assert.ok(html.includes("<code"));
    assert.ok(html.includes("console.log"));
  });

  it("应该正确渲染带语言标识的代码块", () => {
    const html = renderMarkdownToHtml("```python\nprint('hello')\n```");

    assert.ok(html.includes("language-python"));
    assert.ok(html.includes("print('hello')"));
  });

  it("应该正确渲染无语言标识的代码块", () => {
    const html = renderMarkdownToHtml("```\nplain code\n```");

    assert.ok(html.includes("<pre>"));
    assert.ok(html.includes("<code>"));
    assert.ok(html.includes("plain code"));
  });

  it("应该渲染代码块内的特殊字符", () => {
    const html = renderMarkdownToHtml("```bash\n$ echo <hello> | grep 'world'\n```");

    assert.ok(html.includes("&lt;hello&gt;"));
    assert.ok(html.includes("|"));
  });

  it("应该渲染多行代码块", () => {
    const html = renderMarkdownToHtml("```\nline1\nline2\nline3\n```");

    assert.ok(html.includes("line1"));
    assert.ok(html.includes("line2"));
    assert.ok(html.includes("line3"));
  });

  it("应该渲染代码块中的 ANSI 标记（不应被处理）", () => {
    const html = renderMarkdownToHtml("```\n#[r|error]\n```");

    // 代码块内的 ANSI 标记应作为普通文本保留
    assert.ok(html.includes("#[r|error]"));
  });
});

describe("renderMarkdownToHtml - 混合内容", () => {
  it("应该同时渲染代码块和普通文本", () => {
    const html = renderMarkdownToHtml("这是文本\n\n```js\ncode\n```\n\n更多文本");

    assert.ok(html.includes("<p>这是文本</p>"));
    assert.ok(html.includes("<pre>"));
    assert.ok(html.includes("code"));
    assert.ok(html.includes("更多文本"));
  });

  it("应该渲染文本中的行内代码", () => {
    const html = renderMarkdownToHtml("使用 `console.log()` 函数");

    assert.ok(html.includes("<code>"));
    assert.ok(html.includes("console.log()"));
  });

  it("应该渲染行内代码中的 | 字符", () => {
    const html = renderMarkdownToHtml("运行 `#[r|error]` 标记");

    // 行内代码中的 | 不应被表格解析器处理
    assert.ok(html.includes("#[r|error]"));
    assert.ok(html.includes("<code>"));
  });

  it("应该渲染代码块和容器混合内容", () => {
    // 模拟 renderTextBlock 处理后的内容
    const html = renderMarkdownToHtml("说明文字\n\n```js\nconst x = 1;\n```");

    assert.ok(html.includes("说明文字"));
    assert.ok(html.includes("const x = 1"));
    assert.ok(html.includes("<pre>"));
    assert.ok(html.includes("<code"));
  });
});

// ── 表格与代码块边界测试 ─────────────────────────────────────────────────

describe("表格与代码块边界", () => {
  it("表格中的行内代码应有 | 保护", () => {
    const html = renderMarkdownToHtml("| 列1 | 列2 |\n|-----|-----|\n| `#[r|a]` | `#[g|b]` |");

    assert.ok(html.includes("<table>"));
    assert.ok(html.includes("#[r|a]"));
    assert.ok(html.includes("#[g|b]"));
  });

  it("代码块后的表格应正常渲染", () => {
    const html = renderMarkdownToHtml("```\ncode\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |");

    assert.ok(html.includes("<pre>"));
    assert.ok(html.includes("code"));
    assert.ok(html.includes("<table>"));
    assert.ok(html.includes("<td>1</td>"));
  });
});
