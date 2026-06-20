/**
 * CONTENTS 简化语法解析器 — 全面测试
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { transformContents } from "./parser.ts";

/** 提取输出中所有条目行（以空格 + 数字开头） */
function extractEntries(output: string): string[] {
  return output.split("\n").filter((l) => /^\s+\d+\.\d+/.test(l));
}

/** 提取 CONTENTS 之后的所有内容行（包括续行，不含空行、CONTENTS 标记和围栏代码块标记） */
function extractContentLines(output: string): string[] {
  const lines = output.split("\n");
  const contentsIdx = lines.findIndex((l) => /^\s*CONTENTS\s*$/i.test(l));
  if (contentsIdx === -1) return [];

  return lines
    .slice(contentsIdx + 1)
    .filter((l) => l.trim().length > 0)
    .filter((l) => !/^```/.test(l.trim()));
}

// ─── 基础功能 ────────────────────────────────────────────────────────────

describe("transformContents — 基础功能", () => {
  it("无 CONTENTS 标记时返回原文", () => {
    const input = "# 标题\n\n正文内容\n";
    assert.equal(transformContents(input), input);
  });

  it("大小写不敏感：contents / CONTENTS / Contents 均可识别", () => {
    for (const marker of ["contents", "CONTENTS", "Contents"]) {
      const input = [marker, "", "1.0 Summary", ""].join("\n");
      const result = transformContents(input);
      assert.ok(result.includes("CONTENTS"), `${marker} 应被识别`);
      assert.ok(result.includes("Summary"));
    }
  });

  it("CONTENTS 前后有内容时保留", () => {
    const input = [
      "---",
      "title: Test",
      "---",
      "",
      "CONTENTS",
      "",
      "1.0 Summary",
      "2.0 Analysis",
      "",
      "──[ 1.0 ]──[ Summary ]",
      "",
      "正文内容"
    ].join("\n");

    const result = transformContents(input);

    assert.ok(result.startsWith("---"));
    assert.ok(result.includes("title: Test"));
    assert.ok(result.includes("──[ 1.0 ]──[ Summary ]"));
    assert.ok(result.includes("正文内容"));
  });

  it("空 CONTENTS 块（无条目）返回原文", () => {
    const input = ["CONTENTS", "", "", "──[ 1.0 ]──[ Summary ]"].join("\n");
    assert.equal(transformContents(input), input);
  });

  it("CONTENTS 后只有空行无条目时返回原文", () => {
    const input = ["before", "", "CONTENTS", "", "", "after"].join("\n");
    const result = transformContents(input);
    assert.ok(result.includes("before"));
    assert.ok(result.includes("after"));
  });
});

// ─── 旧格式兼容 ──────────────────────────────────────────────────────────

describe("transformContents — 旧格式兼容", () => {
  it("含点号对齐的旧格式自动去除点号", () => {
    const input = [
      "CONTENTS",
      "",
      "  1.0  Summary ............",
      "  2.0  Analysis ...........",
      "",
      "──[ 1.0 ]──[ Summary ]"
    ].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    assert.equal(entries.length, 2);
    // 旧格式中的点号应被去除
    for (const entry of entries) {
      assert.ok(!/\.{3,}/.test(entry), `不应包含点号填充：${entry}`);
    }
    assert.ok(result.includes("Summary"));
    assert.ok(result.includes("Analysis"));
  });

  it("密集点号的旧格式自动去除点号", () => {
    const input = [
      "CONTENTS",
      "",
      "  1.0  Summary ..............................................................",
      "  2.0  Analysis .............................................................",
      ""
    ].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    assert.equal(entries.length, 2);
    for (const entry of entries) {
      assert.ok(!/\.{3,}/.test(entry), `不应包含点号填充：${entry}`);
    }
  });
});

// ─── 纯缩进排版 ──────────────────────────────────────────────────────────

describe("transformContents — 纯缩进排版", () => {
  it("输出不含任何点号填充", () => {
    const input = ["CONTENTS", "", "1.0 Summary", "2.0 Analysis", ""].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    assert.equal(entries.length, 2);
    for (const entry of entries) {
      assert.ok(!/\.{3,}/.test(entry), `不应包含点号填充：${entry}`);
    }
  });

  it("输出以标题结尾，无多余字符", () => {
    const input = ["CONTENTS", "", "1.0 Test", ""].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    const entry = entries[0].trimEnd();
    assert.ok(entry.endsWith("Test"), `应以标题结尾，实际：${entry}`);
  });

  it("条目行仅包含缩进、编号和标题", () => {
    const input = ["CONTENTS", "", "1.0 Hello World", ""].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    // 去除首尾空白后，应只有编号和标题
    const trimmed = entries[0].trim();
    assert.ok(/^\d+\.\d+\s\s.+$/.test(trimmed), `格式应为"编号  标题"：${trimmed}`);
  });
});

// ─── 多级缩进 ────────────────────────────────────────────────────────────

describe("transformContents — 多级缩进", () => {
  it("2 空格缩进表示子级", () => {
    const input = ["CONTENTS", "", "1.0 Top Level", "  2.1 Sub Level", "  2.2 Another Sub", "2.0 Back to Top", ""].join(
      "\n"
    );

    const result = transformContents(input);
    const entries = extractEntries(result);

    assert.equal(entries.length, 4);

    const topIndent = entries[0].match(/^( +)/)?.[1].length ?? 0;
    const subIndent = entries[1].match(/^( +)/)?.[1].length ?? 0;

    assert.ok(subIndent > topIndent, `子级缩进(${subIndent})应大于顶级缩进(${topIndent})`);
  });

  it("3 级嵌套缩进正确", () => {
    const input = [
      "CONTENTS",
      "",
      "1.0 Top",
      "  2.1 Mid",
      "    3.1 Deep",
      "    3.2 Deep2",
      "  2.2 Mid2",
      "2.0 Top2",
      ""
    ].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    assert.equal(entries.length, 6);

    const indents = entries.map((e) => e.match(/^( +)/)?.[1].length ?? 0);
    assert.ok(indents[2] > indents[1], "第 3 层缩进应大于第 2 层");
  });

  it("缩进以最小缩进为基准（非零起始）", () => {
    const input = ["CONTENTS", "", "  1.0 Item", "  2.0 Item2", ""].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    const indent = entries[0].match(/^( +)/)?.[1].length ?? 0;
    assert.equal(indent, 2, `基准缩进应为 2，实际：${indent}`);
  });
});

// ─── 编号格式 ────────────────────────────────────────────────────────────

describe("transformContents — 编号格式", () => {
  it("无编号的行被跳过", () => {
    const input = ["CONTENTS", "", "1.0 Summary", "这是一段普通文本", "2.0 Analysis", ""].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    assert.equal(entries.length, 1, "普通文本行应结束 CONTENTS 解析");
  });

  it("编号格式不符合的不被解析", () => {
    const input = ["CONTENTS", "", "1 Summary", "2.0 Analysis", ""].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    assert.equal(entries.length, 1, "只有 2.0 Analysis 被解析");
  });

  it("仅有编号无标题的不被解析", () => {
    const input = ["CONTENTS", "", "1.0", "2.0 Title", ""].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    assert.equal(entries.length, 1);
  });

  it("多级编号如 1.2.3 正常解析", () => {
    const input = ["CONTENTS", "", "1.2.3 Deep", "1.0 Valid", ""].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    assert.equal(entries.length, 2, "多级编号 1.2.3 应被解析");
  });

  it("中文标题正常解析", () => {
    const input = ["CONTENTS", "", "1.0 文件管理", "2.0 元数据配置", ""].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    assert.equal(entries.length, 2);
    assert.ok(entries[0].includes("文件管理"));
    assert.ok(entries[1].includes("元数据配置"));
  });

  it("混合中英文标题正常解析", () => {
    const input = ["CONTENTS", "", "1.0 Summary 概述", "2.0 Analysis", ""].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    assert.equal(entries.length, 2);
    assert.ok(entries[0].includes("Summary 概述"));
  });
});

// ─── after 切片修复验证 ─────────────────────────────────────────────────

describe("transformContents — after 切片正确性", () => {
  it("CONTENTS 后的正文内容不被截断或重复", () => {
    const input = [
      "---",
      "title: Test",
      "---",
      "",
      "CONTENTS",
      "",
      "1.0 Summary",
      "2.0 Analysis",
      "",
      "──[ 1.0 ]──[ Summary ]",
      "",
      "这是正文第一段。",
      "",
      "这是正文第二段。"
    ].join("\n");

    const result = transformContents(input);

    assert.ok(result.includes("这是正文第一段。"));
    assert.ok(result.includes("这是正文第二段。"));
    assert.ok(result.includes("──[ 1.0 ]──[ Summary ]"));

    const firstParaCount = result.split("这是正文第一段。").length - 1;
    assert.equal(firstParaCount, 1, "正文不应重复");
  });

  it("无空行分隔的紧凑 CONTENTS 块", () => {
    const input = ["CONTENTS", "1.0 Summary", "2.0 Analysis", "", "正文"].join("\n");

    const result = transformContents(input);
    assert.ok(result.includes("正文"), "CONTENTS 后的正文应保留");
    assert.ok(result.includes("Summary"));
    assert.ok(result.includes("Analysis"));
  });

  it("多空行分隔的 CONTENTS 块", () => {
    const input = ["CONTENTS", "", "", "1.0 Summary", "", "正文"].join("\n");

    const result = transformContents(input);
    assert.ok(result.includes("正文"));
    assert.ok(result.includes("Summary"));
  });
});

// ─── 边界情况 ────────────────────────────────────────────────────────────

describe("transformContents — 边界情况", () => {
  it("文章仅有 CONTENTS 和条目无其他内容", () => {
    const input = ["CONTENTS", "", "1.0 Summary", ""].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    assert.equal(entries.length, 1);
    assert.ok(entries[0].includes("Summary"));
  });

  it("CONTENTS 在文件末尾", () => {
    const input = ["before", "", "CONTENTS", "", "1.0 End"].join("\n");

    const result = transformContents(input);
    assert.ok(result.includes("1.0"));
    assert.ok(result.includes("End"));
  });

  it("大量条目（50 条）", () => {
    const lines = ["CONTENTS", ""];
    for (let i = 1; i <= 50; i++) {
      lines.push(`${i}.0 Entry ${i}`);
    }
    lines.push("");

    const result = transformContents(lines.join("\n"));
    const entries = extractEntries(result);

    assert.equal(entries.length, 50);
  });

  it("标题中包含特殊字符", () => {
    const input = ["CONTENTS", "", "1.0 Hello & World", "2.0 <test>", ""].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    assert.equal(entries.length, 2);
    assert.ok(entries[0].includes("Hello & World"));
    assert.ok(entries[1].includes("<test>"));
  });

  it("中文标题正常输出", () => {
    const input = ["CONTENTS", "", "1.0 文件管理", ""].join("\n");

    const result = transformContents(input);
    const entries = extractEntries(result);

    assert.equal(entries.length, 1);
    assert.ok(entries[0].includes("文件管理"));
  });
});

// ─── 跨平台换行符 ────────────────────────────────────────────────────────

describe("transformContents — 跨平台", () => {
  it("CRLF 换行符正确处理", () => {
    const input = "CONTENTS\r\n\r\n1.0 Summary\r\n2.0 Analysis\r\n";

    const result = transformContents(input);
    assert.ok(result.includes("Summary"));
    assert.ok(result.includes("Analysis"));
  });
});

// ─── 长标题换行 ──────────────────────────────────────────────────────────

describe("transformContents — 长标题换行", () => {
  it("标题过长时自动换行，续行对齐标题起始位置", () => {
    const longTitle = "A".repeat(100);
    const input = ["CONTENTS", "", `1.0 ${longTitle}`, ""].join("\n");

    const result = transformContents(input);
    const contentLines = extractContentLines(result);

    // 应产生多行（首行 + 续行）
    assert.ok(contentLines.length >= 2, `长标题应产生多行，实际：${contentLines.length}`);

    // 首行应以编号开头
    assert.ok(contentLines[0].includes("1.0"), "首行应包含编号");

    // 续行不应以编号开头（只有空格缩进）
    assert.ok(/^\s{2,}[A-Z]/.test(contentLines[1]), "续行应以缩进开头，不含编号");
  });

  it("换行后不含任何点号", () => {
    const longTitle = "A".repeat(100);
    const input = ["CONTENTS", "", `1.0 ${longTitle}`, ""].join("\n");

    const result = transformContents(input);
    const contentLines = extractContentLines(result);

    for (const line of contentLines) {
      assert.ok(!/\.{3,}/.test(line), `不应包含点号：${line}`);
    }
  });

  it("续行缩进对齐标题起始位置", () => {
    const longTitle = "A".repeat(80);
    const input = ["CONTENTS", "", `1.0 ${longTitle}`, ""].join("\n");

    const result = transformContents(input);
    const contentLines = extractContentLines(result);

    // 首行缩进：2（基准）+ 0（level 0）= 2，加上 "1.0  " = 5 个字符
    // 续行缩进应与标题起始位置对齐 = 2 + 3 + 2 = 7
    const firstIndent = contentLines[0].match(/^( +)/)?.[1].length ?? 0;
    const contIndent = contentLines[1].match(/^( +)/)?.[1].length ?? 0;

    assert.ok(contIndent > firstIndent, "续行缩进应大于首行缩进");
  });
});
