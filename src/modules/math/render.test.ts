/**
 * 数学公式渲染模块测试
 *
 * 验证行内公式、块级公式、编号和交叉引用的渲染正确性。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mathBlockHtml,
  processMathInText,
  replaceMathPlaceholders,
  resetEquationCounter,
  resetEquationLabels
} from "./render.ts";

describe("processMathInText", () => {
  it("应该正确提取块级公式", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("这是文本 $$\nx = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n$$ 更多文本");

    assert.equal(result.blockMath.length, 1);
    assert.equal(result.blockMath[0].display, true);
    assert.equal(result.blockMath[0].latex, "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}");
    assert.ok(result.blockMath[0].html.includes("katex"));
    assert.equal(result.blockMath[0].number, 1);
  });

  it("应该正确提取行内公式", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("这是 $E = mc^2$ 行内公式");

    assert.equal(result.inlineMath.size, 1);
    // 单字符占位符：第一个 PUA 字符 U+E000
    assert.ok(result.text.includes("\uE000"));
  });

  it("应该正确提取带标签的块级公式", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("文本 $$\nx = y\n$$ {#eq-test} 更多文本");

    assert.equal(result.blockMath.length, 1);
    assert.equal(result.blockMath[0].label, "eq-test");
    assert.equal(result.blockMath[0].number, 1);
  });

  it("应该处理无公式的纯文本", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("这是普通文本，没有公式");

    assert.equal(result.blockMath.length, 0);
    assert.equal(result.inlineMath.size, 0);
    assert.equal(result.text, "这是普通文本，没有公式");
  });

  it("应该处理多个公式混合", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("文本 $$\nx=1\n$$ 中间 $y=2$ 结尾");

    assert.equal(result.blockMath.length, 1);
    assert.equal(result.inlineMath.size, 1);
    assert.equal(result.blockMath[0].number, 1);
  });

  it("应该处理未闭合的公式", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("文本 $$ 未闭合的公式");

    assert.equal(result.blockMath.length, 0);
    assert.equal(result.inlineMath.size, 0);
  });
});

describe("mathBlockHtml", () => {
  it("应该生成正确的块级公式 HTML", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("$$\nx=1\n$$");
    const html = mathBlockHtml(result.blockMath[0]);

    assert.ok(html.includes("math-block-wrapper"));
    assert.ok(html.includes("math-block"));
    assert.ok(html.includes("math-number"));
    assert.ok(html.includes("(1)"));
  });

  it("应该为带标签的公式生成 id", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("$$\nx=1\n$$ {#my-eq}");
    const html = mathBlockHtml(result.blockMath[0]);

    assert.ok(html.includes('id="eq-my-eq"'));
  });
});

describe("replaceMathPlaceholders", () => {
  it("应该替换占位符为行内公式 HTML", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("前 $E=mc^2$ 后");
    const replaced = replaceMathPlaceholders(result.text, result.inlineMath);

    assert.ok(replaced.includes("math-inline"));
    assert.ok(replaced.includes("katex"));
    assert.ok(!replaced.includes("\uE000"));
  });
});

describe("复杂公式渲染", () => {
  it("应该渲染矩阵", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$");

    assert.equal(result.blockMath.length, 1);
    assert.ok(result.blockMath[0].html.includes("katex"));
  });

  it("应该渲染积分", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("$$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$");

    assert.equal(result.blockMath.length, 1);
    assert.ok(result.blockMath[0].html.includes("katex"));
  });

  it("应该渲染求和公式", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$$");

    assert.equal(result.blockMath.length, 1);
    assert.ok(result.blockMath[0].html.includes("katex"));
  });

  it("应该渲染多行公式", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("$$\\begin{aligned} x &= a + b \\\\ y &= c + d \\end{aligned}$$");

    assert.equal(result.blockMath.length, 1);
    assert.ok(result.blockMath[0].html.includes("katex"));
  });
});

describe("代码块保护", () => {
  it("应该保护围栏代码块中的 $ 不被解析", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("文本\n```bash\n$ echo hello\n$ echo world\n```\n更多文本");

    assert.equal(result.inlineMath.size, 0);
    assert.equal(result.blockMath.length, 0);
    assert.ok(result.text.includes("```bash"));
    assert.ok(result.text.includes("$ echo hello"));
  });

  it("应该保护行内代码中的 $ 不被解析", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("运行 `$x = 1` 命令");

    assert.equal(result.inlineMath.size, 0);
    assert.equal(result.blockMath.length, 0);
    assert.ok(result.text.includes("`$x = 1`"));
  });

  it("代码块外的公式仍应正常解析", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("代码 `$x` 外有公式 $y=2$");

    assert.equal(result.inlineMath.size, 1);
    assert.equal(result.blockMath.length, 0);
    assert.ok(result.text.includes("`$x`"));
    // 公式占位符应在代码外
    const placeholder = [...result.inlineMath.keys()][0];
    assert.ok(result.text.includes(placeholder));
  });

  it("应该保护混合代码块和公式", () => {
    resetEquationCounter();
    resetEquationLabels();

    const result = processMathInText("$$\nx=1\n$$\n\n```python\n$x = 1\n```\n\n$y=2$");

    assert.equal(result.inlineMath.size, 1);
    assert.equal(result.blockMath.length, 1);
    assert.ok(result.text.includes("```python"));
    assert.ok(result.text.includes("$x = 1"));
  });
});

describe("交叉引用", () => {
  it("\\ref 应该被替换为引用链接", () => {
    resetEquationCounter();
    resetEquationLabels();

    // 先处理带标签的公式
    processMathInText("$$\nx=1\n$$ {#eq-one}");
    // 再处理引用
    const result = processMathInText("如公式 \\ref{eq-one} 所示");

    assert.ok(result.text.includes("eq-one"));
    assert.ok(result.text.includes("math-ref"));
  });
});
