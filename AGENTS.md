# AGENTS.md

## Git

- `master` is stable. Do not commit feature work directly on it.
- `dev` is the integration branch for normal development.
- Start new work from `dev`:
  - `feat/<short-name>` for features
  - `fix/<short-name>` for bug fixes
  - `ci/<short-name>` for CI-only changes
  - `docs/<short-name>` for docs-only changes
- Merge feature and fix branches into `dev`.
- Promote `dev` into `master` only when the site is ready to publish.
- For urgent production fixes, branch `hotfix/<short-name>` from `master`, then merge it into both `master` and `dev`.
- Use squash merge for pull requests.
- Commit with `git commit -S` (fall back to `git -c commit.gpgsign=false commit` when no signing key is available).
- Use Conventional Commits: `<type>[optional scope]: <description>`.
- Write a commit body when the subject alone does not explain the why, tradeoff, or verification.

## Commands

- `pnpm install --frozen-lockfile`
- `pnpm format`
- `pnpm lint`
- `pnpm check`
- `pnpm build`
- `pnpm assets:fonts` after changing CJK font coverage
- Full validation chain for content or rendering changes: `pnpm lint` → `pnpm check` → `pnpm build` → scan `dist/` for PUA placeholder leaks (no char in U+E000–U+E5FF may appear in built HTML).

## Routes and themes

- `/` is the default textmode theme. Do not change its look or behavior for theme work.
- `/themes/<name>/...` mirrors default routes for `erudite`, `paper`, `retypeset` (built via `renderPhileForThemes` in `src/modules/themes/render.ts`).
- `/themes` is the theme hub page.
- SEO isolation: theme pages are `noindex` with canonical pointing at the default-theme URL. `rss.xml` and sitemaps must never contain `/themes/` URLs.
- Theme CSS lives in `src/modules/themes/content.css` (shared) plus `src/themes/<name>/styles.css` (per-theme variables). Keep the token set in sync: every color token used by `content.css` (e.g. `--link`, `--link-hover`, `--ansi-*`) must have a value in all three themes, light and dark.

## Module map

- `src/modules/textmode/` — default theme pipeline: `markdown/` (markdown-it + fenced code), `ansi/` (ANSI/INK art), `shared/placeholder.ts` (Plain Text block manager), math handling.
- `src/modules/themes/` — theme-neutral phile renderer shared by erudite/paper/retypeset.
- `src/modules/philes/` — article body splitting (`splitBodyBlocks`) shared by all pipelines.
- `src/modules/math/` — KaTeX rendering, PUA glyph escaping.

## PUA placeholder convention

Private Use Area codepoints carry state between pipeline passes. Never emit them into final HTML:

- U+E000–E0FF — inline math placeholders
- U+E100–E1FF — code protection placeholders
- U+E200 — tall-formula marker; U+E202 — block math placeholder
- U+E400–E4FF — ANSI art
- U+E500–E5FF — theme INK/PT markers
- KaTeX HTML output itself contains PUA glyph chars (e.g. `\ne` = `=` + U+E020); all KaTeX exits must go through `escapePuaGlyphs()`.

## Fence-awareness invariants

Every extraction/protection layer (INK, Plain Text, code, image-line splitting in `splitBodyBlocks`) must use the same fence-pairing semantics as markdown-it/CommonMark: an opening fence is a line of 3+ backticks (optionally indented) whose info string has no spaces; the closing fence is a later line at the same indent with at least as many backticks; an unclosed fence is treated as plain lines. Use `fencedLineIndices()` / `extractPlainTextFences()` from `src/modules/textmode/markdown/codeblock.ts` instead of writing new regex-based extractors. A protection layer that pairs fences differently from the render layer corrupts documents downstream.

## Content authoring rules

- Do not indent prose by 4 spaces; markdown-it treats it as an indented code block in every theme.
- When nesting a fenced block inside another, use a longer outer fence (4 backticks). Same-length nested fences pair sequentially and corrupt both themes.
- No comment system exists; never add one back.

## Verification

- After rendering changes, diff the same article across all four routes (`/`, `/themes/erudite/`, `/themes/paper/`, `/themes/retypeset/`) in `dist/`: KaTeX formula counts, ANSI span counts, and PT/INK block structure must match unless a theme adds deliberate chrome.
