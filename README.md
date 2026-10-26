# AH's Blog

个人博客，线上地址：<https://www.cubeyond.net>

基于 [Astro](https://astro.build) 的静态博客。默认主题是复古终端（textmode）风格，另提供三套阅读主题（erudite / paper / retypeset），通过 `/themes/` 路径访问。

## 特性

- **四套主题**：默认 textmode 终端风 + erudite（学术）、paper（纸面）、retypeset（杂志）三套阅读主题
- **Markdown 写作**：frontmatter + 正文，按卷（volume）组织文章
- **图表**：Mermaid 图表客户端懒加载渲染，支持点击放大灯箱、宽图滚动
- **公式与代码**：KaTeX 数学公式、highlight.js 代码高亮
- **ANSI / INK 艺术**：支持 ANSI 转义序列与自定义 ink 块语法
- **SEO**：RSS、sitemap；主题页 `noindex` + canonical 指向默认主题，互不干扰
- **零后端**：纯静态构建，可部署到任意静态托管

## 技术栈

[Astro](https://astro.build) · [TypeScript](https://www.typescriptlang.org) · [markdown-it](https://github.com/markdown-it/markdown-it) · [Mermaid](https://mermaid.js.org) · [KaTeX](https://katex.org) · [highlight.js](https://highlightjs.org) · [Biome](https://biomejs.dev) · pnpm

## 快速开始

```bash
# 环境要求：Node >= 22.12，pnpm >= 9
pnpm install --frozen-lockfile

pnpm dev        # 本地开发服务器
pnpm build      # astro check + 构建，产物在 dist/
pnpm preview    # 预览构建产物
pnpm lint       # Biome lint
pnpm check      # astro check + Biome check
pnpm format     # 格式化
```

## 写文章

文章是带 frontmatter 的 Markdown 文件，放在：

```
src/content/philes/volume-<n>/<分类>/<文章名>.md
```

frontmatter 字段：

| 字段 | 必填 | 说明 |
| ---- | ---- | ---- |
| `title` | 是 | 标题 |
| `date` | 是 | 日期 |
| `author` | 是 | 作者 |
| `order` | 否 | 卷内排序 |
| `subtitle` | 否 | 副标题 |
| `redacted` | 否 | `true` 时渲染为涂黑保密稿 |

卷号来自目录名（`volume-0`、`volume-1`…），路由为 `/volume/<n>/<文章名>/`，主题路由为 `/themes/<主题名>/volume/<n>/<文章名>/`。

## 目录结构

```
src/config/            站点、卷、外观、特效配置
src/content/philes/    文章源文件（按卷组织）
src/components/        Astro 组件
src/layouts/           页面骨架
src/pages/             路由入口
src/modules/textmode/  默认主题管线：ANSI、布局、打字机、mermaid 等
src/modules/themes/    多主题渲染管线（erudite / paper / retypeset 共用）
src/modules/philes/    文章加载、解析与分块
src/modules/math/      KaTeX 渲染
src/modules/seo/       RSS、robots 等
src/themes/            各主题的组件与样式
scripts/               维护脚本（字体子集、CJK 图集等）
```

## 字体资源

字体产物已提交，正常构建不需要本地字体工具链。仅当修改 `fonts/` 下的字体源文件或 CJK 字符覆盖范围时，需要运行：

```bash
pnpm assets:fonts
```

（依赖 `fonttools`，若 `pyftsubset` 不在 PATH 上，安装了 `uv` 的环境会自动解析。）

## License

MIT
