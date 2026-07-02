---
title: "mermaid-error-summary"
date: 2026-07-03
author: "AH"
order: 0
lang: zh
redacted: false
---
# Mermaid 序列图渲染错误排查总结

## 问题背景

在 `Java后端生态全景.md` 的 16.1 节「Micrometer 指标埋点」中，Mermaid 序列图渲染失败，报错：

```
Parse error on line 7:
Expecting '()', 'SOLID_OPEN_ARROW', ... got 'NEWLINE'
```

## 排查过程

### 第一轮：假设花括号 `{ }` 是问题

初步怀疑 Mermaid Note 文本中的 Lambda 表达式 `{ seckillService.execute(); }` 包含 `{` 和 `}`，被 Mermaid 解析器误识别为语法标记。

尝试的修复方案：
- 替换为 HTML 实体 `&#123;` / `&#125;` → ❌ 无效。原因：`textContent` 会解码 HTML 实体，Mermaid 收到后仍是 `{` 和 `}`
- 替换为全角花括号 `｛` / `｝` (U+FF5B/FF5D) → ❌ 无效。Mermaid 同样将其解析为语法标记
- 替换为圆括号 `(` / `)` → ❌ 无效。报错转移到其他位置

### 第二轮：逐字符隔离测试

通过 Puppeteer 浏览器环境，对 Mermaid Note 文本中的每种特殊字符进行隔离测试：

| 测试用例 | Note 内容 | 结果 |
|---------|----------|------|
| baseline | `hello world` | ✅ |
| parentheses | `func(arg1, arg2)` | ✅ |
| arrow | `x -> y` | ✅ |
| **semicolon** | **`x; y;`** | **❌** |
| curly_open | `code { block` | ✅ |
| curly_close | `} end block` | ✅ |
| curly_pair | `code { block } end` | ✅ |
| double_quote | `key="value"` | ✅ |
| colon_in_text | `text: more text` | ✅ |
| lambda_arrow | `() -> result` | ✅ |
| **lambda_full** | **`() -> { body; }`** | **❌** |

### 第三轮：确认分号 `;` 是根因

| 测试用例 | Note 内容 | 结果 |
|---------|----------|------|
| no_semicolon | `() -> { body }` | ✅ |
| with_semicolon | `() -> { body; }` | ❌ |
| semicolon_only | `x;y` | ❌ |
| semicolon_space | `x; y` | ❌ |
| semicolon_end | `end;` | ✅ |
| lambda_real (无分号) | `timer.record(() -> { seckillService.execute() })` | ✅ |

## 根因结论

**Mermaid 序列图解析器将分号 `;` 解释为语句终止符，即使在 Note 文本中也会触发解析错误。**

- `{` 和 `}` 在 Note 文本中是安全的，只要内部不包含 `;`
- `;` 出现在行末（如 `end;`）时不会触发错误，因为 `end` 是 Mermaid 关键字
- `;` 出现在 Note 文本其他位置时，Mermaid 会将其后的内容当作新语句解析，导致语法错误

## 最终修复方案

将 Note 文本中的分号移除：

```diff
- timer.record(() → { seckillService.execute(); })
+ timer.record(() → { seckillService.execute() })
```

同时将 Mermaid 初始化配置中的 `htmlLabels` 改为 `true`，确保 `<br/>` 等 HTML 标签在 Note 文本中正确渲染：

```diff
- htmlLabels: false,
+ htmlLabels: true,
```

## 涉及文件

| 文件 | 修改内容 |
|------|---------|
| `src/modules/textmode/mermaid/init.ts` | `htmlLabels: false` → `htmlLabels: true` |
| `src/content/philes/volume-1/Java-Backend/Java后端生态全景.md` (L2311) | 移除 Lambda 表达式中的分号 |
| `scripts/debug_mermaid.ts` | 更新为最终修复版本，含注释说明 |

## 调试工具

- `scripts/debug_mermaid.ts` — Node.js 端快速验证（需 DOM 环境，与实际有差异）
- Puppeteer + 隔离测试 HTML 页面 — 浏览器端精确排查，逐字符确认问题

## 经验教训

1. **不要假设问题字符** — 最初怀疑 `{`/`}`，实际是 `;`。通过隔离测试逐个排除才是可靠方法
2. **HTML 实体在 textContent 中会被解码** — `&#123;` 在 `<pre>` 的 `textContent` 中会变成 `{`，无法绕过 Mermaid 解析器
3. **Mermaid 不同图表类型的解析规则不同** — 序列图对 `;` 敏感，其他图表类型（如 flowchart）可能不受影响
4. **浏览器环境测试比 Node.js 更可靠** — Mermaid 在 Node.js 中缺少 DOM 环境，测试结果可能不准确