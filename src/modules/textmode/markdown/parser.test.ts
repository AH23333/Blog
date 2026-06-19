/**
 * Markdown 解析器测试 - 区域块渲染验证
 *
 * 验证代码块（```）和容器块（:::）的解析与渲染正确性。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderMarkdown, renderMarkdownToHtml, splitContainerSegments } from "./parser.ts";

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
    // highlight.js 会将 console.log 包裹在 <span> 中，所以检查高亮标记
    assert.ok(html.includes("hljs"), "应包含 highlight.js 高亮标记");
    assert.ok(html.includes("console"), "应包含 console");
    assert.ok(html.includes("log"), "应包含 log");
  });

  it("应该正确渲染带语言标识的代码块", () => {
    const html = renderMarkdownToHtml("```python\nprint('hello')\n```");

    assert.ok(html.includes("language-python"));
    // highlight.js 会将 print 包裹在 <span> 中，检查高亮标记和片段
    assert.ok(html.includes("hljs"), "应包含 highlight.js 高亮标记");
    assert.ok(html.includes("print"), "应包含 print");
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

    assert.ok(html.includes("这是文本") || html.includes("cjk"), "应包含文本内容");
    assert.ok(html.includes("<pre>"), "应包含代码块");
    assert.ok(html.includes("code"), "应包含代码内容");
    assert.ok(html.includes("更多文本") || html.includes("cjk"), "应包含更多文本");
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

    assert.ok(html.includes("说明文字") || html.includes("cjk"), "应包含说明文字");
    // highlight.js 会将 const x = 1 包裹在 <span> 中，检查高亮标记和片段
    assert.ok(html.includes("hljs"), "应包含 highlight.js 高亮标记");
    assert.ok(html.includes("const"), "应包含 const");
    assert.ok(html.includes("<pre>"), "应包含代码块包装");
    assert.ok(html.includes("<code"), "应包含代码标签");
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

// ── renderMarkdown (ANSI 路径) 测试 ──────────────────────────────────────

describe("renderMarkdown - 表格", () => {
  it("应该渲染基本表格并使用 box-drawing 字符", () => {
    const lines = renderMarkdown("| A | B |\n|---|---|\n| 1 | 2 |", 60);

    assert.ok(lines.length > 0);
    assert.ok(
      lines.some((l) => l.includes("\u250c")),
      "应包含左上角 box-drawing 字符"
    );
    assert.ok(
      lines.some((l) => l.includes("A") && l.includes("B")),
      "应包含表头"
    );
    assert.ok(
      lines.some((l) => l.includes("1") && l.includes("2")),
      "应包含数据行"
    );
  });

  it("应该渲染带对齐的表格", () => {
    const lines = renderMarkdown("| 左 | 中 | 右 |\n|:---|---:|:---:|\n| a | b | c |", 80);

    assert.ok(lines.length > 0);
    assert.ok(
      lines.some((l) => l.includes("a")),
      "应包含左对齐单元格"
    );
    assert.ok(
      lines.some((l) => l.includes("b")),
      "应包含右对齐单元格"
    );
    assert.ok(
      lines.some((l) => l.includes("c")),
      "应包含居中单元格"
    );
  });

  it("应该渲染空表格不抛出错误", () => {
    const lines = renderMarkdown("", 60);
    assert.ok(Array.isArray(lines));
  });

  it("应该渲染单列表格", () => {
    const lines = renderMarkdown("| 唯一 |\n|------|\n| 值 |", 60);

    assert.ok(lines.length > 0);
    assert.ok(
      lines.some((l) => l.includes("唯一")),
      "应包含表头"
    );
    assert.ok(
      lines.some((l) => l.includes("值")),
      "应包含数据"
    );
  });

  it("表格应包含表头分隔线", () => {
    const lines = renderMarkdown("| H1 | H2 |\n|----|----|\n| d1 | d2 |", 60);

    // 应该有三行以上：顶部边框、表头行、分隔线、数据行、底部边框
    assert.ok(lines.length >= 4);
    // 表头和数据之间应有分隔线
    const headerIdx = lines.findIndex((l) => l.includes("H1"));
    const dataIdx = lines.findIndex((l) => l.includes("d1"));
    assert.ok(headerIdx >= 0);
    assert.ok(dataIdx > headerIdx);
  });
});

describe("renderMarkdown - 内联格式", () => {
  it("应该渲染粗体文本", () => {
    const lines = renderMarkdown("这是 **粗体** 文本", 60);

    assert.ok(
      lines.some((l) => l.includes("粗体")),
      "应包含粗体文本"
    );
  });

  it("应该渲染斜体文本", () => {
    const lines = renderMarkdown("这是 *斜体* 文本", 60);

    assert.ok(
      lines.some((l) => l.includes("斜体")),
      "应包含斜体文本"
    );
  });

  it("应该渲染删除线文本", () => {
    const lines = renderMarkdown("这是 ~~删除~~ 文本", 60);

    assert.ok(
      lines.some((l) => l.includes("删除")),
      "应包含删除线文本"
    );
  });

  it("应该渲染行内代码", () => {
    const lines = renderMarkdown("使用 `const x = 1` 代码", 60);

    assert.ok(
      lines.some((l) => l.includes("const x = 1")),
      "应包含行内代码"
    );
  });

  it("应该渲染链接（保留链接文本）", () => {
    const lines = renderMarkdown("访问 [Example](https://example.com) 网站", 60);

    assert.ok(
      lines.some((l) => l.includes("Example")),
      "应包含链接文本"
    );
  });

  it("应该渲染嵌套格式（粗体中的斜体）", () => {
    const lines = renderMarkdown("这是 ***粗斜体*** 文本", 60);

    assert.ok(
      lines.some((l) => l.includes("粗斜体")),
      "应包含嵌套格式文本"
    );
  });
});

describe("renderMarkdown - 标题", () => {
  it("应该渲染一级标题", () => {
    const lines = renderMarkdown("# 一级标题", 60);

    assert.ok(
      lines.some((l) => l.includes("一级标题")),
      "应包含标题文本"
    );
  });

  it("应该渲染二级标题", () => {
    const lines = renderMarkdown("## 二级标题", 60);

    assert.ok(
      lines.some((l) => l.includes("二级标题")),
      "应包含二级标题"
    );
  });

  it("应该渲染三级标题", () => {
    const lines = renderMarkdown("### 三级标题", 60);

    assert.ok(
      lines.some((l) => l.includes("三级标题")),
      "应包含三级标题"
    );
  });
});

describe("renderMarkdown - 列表", () => {
  it("应该渲染无序列表", () => {
    const lines = renderMarkdown("- 项目一\n- 项目二", 60);

    assert.ok(
      lines.some((l) => l.includes("项目一")),
      "应包含第一个项目"
    );
    assert.ok(
      lines.some((l) => l.includes("项目二")),
      "应包含第二个项目"
    );
  });

  it("应该渲染有序列表", () => {
    const lines = renderMarkdown("1. 第一项\n2. 第二项", 60);

    assert.ok(
      lines.some((l) => l.includes("第一项")),
      "应包含第一个有序项"
    );
    assert.ok(
      lines.some((l) => l.includes("第二项")),
      "应包含第二个有序项"
    );
  });
});

describe("renderMarkdown - 引用块", () => {
  it("应该渲染引用块", () => {
    const lines = renderMarkdown("> 这是一段引用", 60);

    assert.ok(
      lines.some((l) => l.includes("这是一段引用")),
      "应包含引用内容"
    );
  });
});

describe("renderMarkdown - 代码块", () => {
  it("应该渲染围栏代码块并使用 box-drawing 边框", () => {
    const lines = renderMarkdown("```js\nconsole.log('hello');\n```", 60);

    assert.ok(
      lines.some((l) => l.includes("console.log")),
      "应包含代码内容"
    );
    assert.ok(
      lines.some((l) => l.includes("js")),
      "应包含语言标识"
    );
  });

  it("应该渲染无语言标识的代码块", () => {
    const lines = renderMarkdown("```\ncode\n```", 60);

    assert.ok(
      lines.some((l) => l.includes("code")),
      "应包含代码内容"
    );
  });
});

describe("renderMarkdown - 容器", () => {
  // 辅助函数：从 ANSI 渲染输出中提取纯文本（去除 ANSI 标记和 HTML 标签）
  const stripTags = (s: string) =>
    s
      .replace(/<[^>]*>/g, "")
      .replace(/#\[\w+\|/g, "")
      .replace(/\]/g, "");

  it("应该渲染 note 容器", () => {
    const lines = renderMarkdown(":::note\nhello\n:::", 60);

    assert.ok(
      lines.some((l) => l.includes("NOTE")),
      "应包含 NOTE 标签"
    );
    assert.ok(
      lines.some((l) => stripTags(l).includes("hello")),
      "应包含容器内容"
    );
  });

  it("应该渲染 warning 容器", () => {
    const lines = renderMarkdown(":::warning\ndanger\n:::", 60);

    assert.ok(
      lines.some((l) => l.includes("WARNING")),
      "应包含 WARNING 标签"
    );
    assert.ok(
      lines.some((l) => stripTags(l).includes("danger")),
      "应包含容器内容"
    );
  });

  it("应该渲染 important 容器", () => {
    const lines = renderMarkdown(":::important\nimportant content\n:::", 60);

    assert.ok(
      lines.some((l) => l.includes("IMPORTANT")),
      "应包含 IMPORTANT 标签"
    );
    assert.ok(
      lines.some((l) => stripTags(l).includes("important content")),
      "应包含容器内容"
    );
  });

  it("应该渲染 tip 容器", () => {
    const lines = renderMarkdown(":::tip\npro tip here\n:::", 60);

    assert.ok(
      lines.some((l) => l.includes("TIP")),
      "应包含 TIP 标签"
    );
    assert.ok(
      lines.some((l) => stripTags(l).includes("pro tip here")),
      "应包含容器内容"
    );
  });

  it("应该渲染带标题的容器", () => {
    const lines = renderMarkdown(":::note[History]\nhistory content\n:::", 60);

    assert.ok(
      lines.some((l) => l.includes("NOTE") && l.includes("History")),
      "应包含标题"
    );
    assert.ok(
      lines.some((l) => stripTags(l).includes("history content")),
      "应包含容器内容"
    );
  });
});

describe("renderMarkdown - 混合内容", () => {
  it("应该渲染混合了段落、标题和列表的文本", () => {
    const lines = renderMarkdown("# 标题\n\n这是段落\n\n- 列表项", 60);

    assert.ok(
      lines.some((l) => l.includes("标题")),
      "应包含标题"
    );
    assert.ok(
      lines.some((l) => l.includes("这是段落")),
      "应包含段落"
    );
    assert.ok(
      lines.some((l) => l.includes("列表项")),
      "应包含列表项"
    );
  });

  it("应该渲染容器和代码块的混合内容", () => {
    const lines = renderMarkdown(":::note\n备注\n:::\n\n```js\ncode\n```", 60);

    assert.ok(
      lines.some((l) => l.includes("NOTE")),
      "应包含容器标签"
    );
    assert.ok(
      lines.some((l) => l.includes("code")),
      "应包含代码内容"
    );
  });
});

describe("renderMarkdown - 边界情况", () => {
  it("空字符串应返回空数组", () => {
    const lines = renderMarkdown("", 60);
    assert.ok(Array.isArray(lines));
    assert.equal(lines.length, 0);
  });

  it("极窄宽度应不崩溃", () => {
    const lines = renderMarkdown("# 标题\n\n| A | B |\n|---|---|\n| 1 | 2 |", 10);

    assert.ok(Array.isArray(lines));
    assert.ok(lines.length > 0);
  });

  it("水平线应渲染", () => {
    const lines = renderMarkdown("---", 60);

    assert.ok(lines.length > 0);
  });
});
