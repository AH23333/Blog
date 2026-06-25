---
title: "文章书写格式参考手册-en"
date: 2026-06-20
author: "AH"
order: 0
lang: en
redacted: false
---

CONTENTS

- 1.0  Overview
- 2.0  Custom Syntax System
  - 2.1  Frontmatter
  - 2.2  Chapter Dividers
  - 2.3  ANSI Colour Markers
  - 2.4  INK Gradient Text
  - 2.5  Box-Drawing Structures
  - 2.6  ::: Containers
  - 2.7  ```Plain Text Blocks
- 3.0  Markdown Elements
  - 3.1  Headings
  - 3.2  Paragraphs and Line Breaks
  - 3.3  Inline Formatting
  - 3.4  Links
  - 3.5  Blockquotes
  - 3.6  Fenced Code Blocks
  - 3.7  Tables
  - 3.8  Images
  - 3.9  LaTeX Mathematics
- 4.0  Writing Workflow
  - 4.1  File Setup
  - 4.2  Metadata Configuration
  - 4.3  Structuring the CONTENTS
  - 4.4  Writing the Body
  - 4.5  Embedding Visuals
  - 4.6  Final Review
- 5.0  Pitfalls and Conflicts
  - 5.1  Syntax Conflicts
  - 5.2  Common Mistakes
  - 5.3  Error Handling
- 6.0  Extensive Examples
  - 6.1  Minimal Article
  - 6.2  Full-Featured Article
  - 6.3  ANSI-Only Structures
  - 6.4  Mathematics-Heavy Article
  - 6.5  Code-Heavy Article

──[ 1.0 ]──────────────────────────────────────────────────────────[ Overview ]

The project uses a hybrid document format that combines **custom terminal-style syntax**
with **standard CommonMark + GFM Markdown**. The rendering pipeline processes
documents server-side through:

1. **Frontmatter Parsing** — YAML metadata at the top of every article
2. **Math Preprocessing** — KaTeX extraction of `$...$` and `$$...$$`
3. **Plain Text Block Extraction** — ````Plain Text` fences route to `<pre>`
4. **Container Segmentation** — `:::type` blocks are parsed into styled containers
5. **Markdown-to-HTML** — markdown-it renders the remainder with custom token rules
6. **Syntax Highlighting** — highlight.js post-processes code blocks
7. **CJK Bitmap Wrapping** — Chinese characters are wrapped in `<span class="cjk cjk-bitmap">`

The result is a terminal-inspired aesthetic with monospace bitmap fonts for CJK
characters, ANSI colour emulation, and box-drawing structural elements.

──[ 2.0 ]──────────────────────────────────────────────[ Custom Syntax System ]

The project defines several syntax elements that extend beyond standard Markdown.
These are processed by the custom pipeline layers before markdown-it sees the text.

┌─ 2.1 ───────────────────────────────────────────────────[ Frontmatter ]─┐

    Every article must begin with a YAML frontmatter block enclosed in `---`:

    ```yaml
    ---
    title: "Article Title"
    date: 2026-06-20
    author: "Author Name"
    lang: zh
    order: 0
    redacted: false
    ---
    ```

    | Field      | Required | Type    | Description                                        |
    |------------|----------|---------|----------------------------------------------------|
    | `title`    | Yes      | string  | Article title displayed in header and browser tab  |
    | `date`     | Yes      | date    | Publication date, YYYY-MM-DD format               |
    | `author`   | Yes      | string  | Author name shown below the title                  |
    | `lang`     | No       | `en`|`zh`| Language identifier; defaults to `en`              |
    | `order`    | No       | number  | Manual sort weight (lower = first); default `0`    |
    | `redacted` | No       | boolean | If `true`, article is hidden from the volume index |

    **Sorting Priority:** `order` field → `date` field (newest first).

    **Special Characters:** Avoid `:` in title values unless quoted. YAML
    strings with special characters must be enclosed in double quotes.

    **Conflict Warning:** The `---` delimiters must be on their own lines with
    no trailing whitespace. A stray `---` in the body will be interpreted as
    frontmatter closure and corrupt the parse.

┌─ 2.2 ───────────────────────────────────────────────[ Chapter Dividers ]─┐

    The `──[` syntax is a project-specific convention for chapter separators.
    It is rendered as a styled horizontal rule with embedded chapter number
    and title:

      ──[ 1.0 ]──────────────────────────────────────────────────[ Summary ]

    **Format:**
    ```
    ──[ <number> ]──<separator>──[ <title> ]
    ```

    **Rules:**
    - The divider must be on its own line
    - There must be a blank line before and after the divider
    - `<number>` uses the format `X.Y` (e.g., `1.0`, `2.1`, `3.2`)
    - `<separator>` is composed of `─` characters (U+2500)
    - `<title>` is the chapter name, typically in English

    **Convention:**
    - `0.0` — Summary / Overview
    - `1.0` — First chapter
    - `2.0` — Second chapter
    - `2.1`, `2.2` — Sub-chapters

    **Rendering:** The divider is rendered as a horizontal rule (`<hr>`) with
    the chapter number and title embedded as styled text.

    **Conflict Note:** Do NOT use `──[` at the start of a line inside code
    blocks or containers unless you intend it as a chapter divider. The render
    pipeline interprets it as a structural element.

┌─ 2.3 ───────────────────────────────────────────[ ANSI Colour Markers ]─┐

    The `#[x|text]` syntax emulates ANSI terminal colour codes. Each marker
    applies a colour to the enclosed text.

    **Syntax:**
    ```
    #[<colour_code>|<text>]
    ```

    **Standard Colours (lowercase):**
    | Code | Colour  | Hex       | Usage                           |
    |------|---------|-----------|---------------------------------|
    | `r`  | Red     | `#cd0000` | Errors, warnings, negative info |
    | `g`  | Green   | `#00cd00` | Success, validated data         |
    | `y`  | Yellow  | `#cdcd00` | Attention, offsets, boundaries  |
    | `b`  | Blue    | `#0000ee` | Secondary info, emphasis        |
    | `m`  | Magenta | `#cd00cd` | Special markers, strikethrough  |
    | `c`  | Cyan    | `#00cdcd` | Format markers, containers      |
    | `w`  | White   | `#e5e5e5` | Default body text               |
    | `k`  | Black   | `#000000` | (rarely used)                   |

    **Bright Colours (uppercase):**
    | Code | Colour       | Hex       |
    |------|-------------|-----------|
    | `R`  | Bright Red   | `#ff0000` |
    | `G`  | Bright Green | `#00ff00` |
    | `Y`  | Bright Yellow| `#ffff00` |
    | `B`  | Bright Blue  | `#5c5cff` |
    | `M`  | Bright Magenta| `#ff00ff`|
    | `C`  | Bright Cyan  | `#00ffff` |
    | `W`  | Bright White | `#ffffff` |
    | `K`  | Grey         | `#7f7f7f` |

    **Examples:**
    ```
    #[G|validated data]    → bright green "validated data"
    #[R|critical error]     → bright red "critical error"
    #[y|offset 0x1000]      → yellow "offset 0x1000"
    ```

    **Critical Rules:**
    - ANSI markers **cannot be nested**. `#[R|outer #[G|inner]]` will NOT work.
    - The pipe `|` inside a marker is the delimiter. To display a literal `|`,
      escape it: `#[c|a \| b]` → cyan "a | b".
    - To display literal `#`, `[`, `]`, `\` at the start of a line, escape
      with backslash: `\#`, `\[`, `\]`, `\\`.
    - ANSI markers are processed by the text pipeline before markdown-it.
      They are NOT supported inside fenced code blocks (which is intentional).

    **Conflict Warning:** The `#[` at the start of a line will be interpreted
    as an ANSI marker. If you need to display `#[` literally (e.g., in
    documentation about the syntax itself), use `\#\` to escape it.

┌─ 2.4 ───────────────────────────────────────────[ INK Gradient Text ]─┐

    The INK block syntax creates per-character colour gradients for
    decorative text (e.g., ASCII art titles).

    **Syntax:**
    ```
    --[ ink ]--
    |<text line 1>
    ~<colour mask 1>
    |<text line 2>
    ~<colour mask 2>
    ```

    **Rules:**
    - Starts with `--[ ink ]--` on its own line
    - Ends with a blank line
    - `|` lines: the text to display (the `|` is not rendered)
    - `~` lines: the colour mask, one character per text character
      - `.` or ` ` (space) → default colour
      - `R`, `G`, `C`, `Y`, etc. → corresponding ANSI colour

    **Example:**
    ```
    --[ ink ]--
    |Hello World
    ~WWWWW.GGGGG
    ```

    Renders: "Hello" in bright white, a space in default colour, "World"
    in bright green.

    **Use Case:** ASCII art titles, decorative headers, logo text.

    **Conflict:** The `|` prefix is only interpreted as INK text when inside
    an `--[ ink ]--` block. Outside of it, `|` is treated as regular text.

┌─ 2.5 ───────────────────────────────────────[ Box-Drawing Structures ]─┐

    The project uses Unicode Box Drawing characters to construct terminal-style
    diagrams, tables, and tree structures. These are NOT custom syntax — they
    are literal Unicode characters — but their usage follows strict conventions.

    **Common Characters:**
    ```
    ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼    Box borders
    ▲ ▼ ► ◄                     Arrows
    ✓ ✗                         Check / cross marks
    ```

    **Structure Types:**

    (1) **Hand-Drawn Tables** (see Section 3.7):
    ```
        ┌──────────────────┬──────────────┬──────────────────┐
        │ Field            │ Offset       │ Value            │
        ├──────────────────┼──────────────┼──────────────────┤
        │ magic            │ 0x00000000   │ #[G|ENCR]        │
        └──────────────────┴──────────────┴──────────────────┘
    ```

    (2) **Tree Structures** (INK KEY, PROOF CHAIN):
    ```
      INK KEY:
      ├─ #[C|C]  format markers
      ├─ #[G|G]  validated data
      └─ #[R|R]  wrong paths
    ```

    (3) **Flow Diagrams**:
    ```
      FLOW:
      root node
          │
          ▼
      child node
          ├─ offset  #[C|description]
          └─ offset  #[G|description]
    ```

    **Critical Rule:** All box-drawing characters are full-width. You MUST use
    a monospace/等宽 font in your editor to see correct alignment. Misalignment
    in the editor WILL result in misalignment in the rendered output.

┌─ 2.6 ───────────────────────────────────────────────[ ::: Containers ]─┐

    The `:::` fence syntax creates styled callout containers with coloured
    borders and labels. These are visually distinct from code blocks.

    **Basic Syntax:**
    ```
    :::important
    This is important content.
    Supports **Markdown** and #[Y|ANSI colours].
    :::
    ```

    **With Title:**
    ```
    :::warning[Security Alert]
    Do not run this in production.
    :::
    ```

    **Alternative Title Format:**
    ```
    :::note Additional Info
    This also works.
    :::
    ```

    **Container Types:**
    | Type         | Colour   | Border   | Use Case                |
    |-------------|----------|----------|-------------------------|
    | `important`  | Yellow   | `#[Y]`   | Critical information    |
    | `note`       | Cyan     | `#[C]`   | Supplementary notes     |
    | `tip`        | Green    | `#[G]`   | Tips and best practices |
    | `warning`    | Red      | `#[R]`   | Warnings and cautions   |

    **Rules:**
    - Container content supports full Markdown, ANSI colours, and inline math
    - Containers CAN contain fenced code blocks
    - Containers CANNOT be nested (the first `:::` closes the container)
    - The `:::` close marker must be on its own line
    - Container content is rendered through markdown-it independently

    **Conflict Warning:** A `:::` inside a fenced code block is NOT treated
    as a container marker. The parser protects code blocks before segmentation.

┌─ 2.7 ───────────────────────────────────────────[ ```Plain Text Blocks ]─┐

    The project defines a special fenced code block language: `Plain Text`.
    Content inside a ````Plain Text` fence is rendered inside `<pre>` tags,
    which **preserve whitespace and line breaks exactly as written**.

    **Syntax:**
    ```plaintext
    ```Plain Text
      1.0  Summary
           1.1  Motivation
      2.0  Analysis
    ```
    ```

    **Use Cases:**
    - Preserving ASCII art alignment
    - Displaying whitespace-sensitive content
    - CONTENTS block with custom indentation (recommended method)

    **Rendering:** The content is extracted from the Markdown pipeline before
    markdown-it processes it, wrapped in `<pre class="plaintext-pre">`, and
    re-inserted into the final HTML. Each line is processed through `textHtml`
    for CJK bitmap wrapping.

    **Difference from Regular Code Blocks:** Regular ```` ``` ```` blocks
    receive syntax highlighting and are wrapped in styled containers.
    ````Plain Text` blocks are rendered as raw `<pre>` with no highlighting.

──[ 3.0 ]──────────────────────────────────────────────[ Markdown Elements ]

The project uses markdown-it with CommonMark + GFM (GitHub Flavoured Markdown)
extensions. The following table summarises all supported Markdown features.

┌─ 3.1 ─────────────────────────────────────────────────────[ Headings ]─┐

    Standard ATX headings (`#` through `######`) are supported and rendered
    with ANSI-style formatting:

    | Markdown      | Rendered Style                        |
    |---------------|---------------------------------------|
    | `# H1`        | Bold separator line + bright yellow   |
    | `## H2`       | `~` prefix + bright yellow + underline|
    | `### H3`      | Yellow text (indented)                |
    | `#### H4`     | Cyan text (indented)                  |
    | `##### H5`    | Cyan text (indented)                  |
    | `###### H6`   | Cyan text (indented)                  |

    **Note:** For chapter-level separation, use the `──[ N ]──[ Title ]`
    custom syntax instead of `#` headings. The `#` heading is best reserved
    for the article's main title or major section breaks.

    **Conflict:** A `#` at the start of a line is ALWAYS interpreted as a
    heading. To display a literal `#`, escape it: `\#`.

┌─ 3.2 ───────────────────────────────────────────[ Paragraphs and Line Breaks ]─┐

    - **Paragraphs:** Separated by one or more blank lines
    - **Hard Line Break:** End a line with two or more spaces, then newline
    - **Soft Wrap:** Lines without blank lines between them are merged into
      one paragraph

    ```markdown
    This is paragraph one.

    This is paragraph two.

    Line one (hard break)··
    Line two (continuation of same paragraph)
    ```

    **Note:** The `breaks: false` option is set in markdown-it, meaning a
    single newline within a paragraph does NOT create a `<br>`. Use two
    trailing spaces for an explicit line break.

┌─ 3.3 ───────────────────────────────────────────[ Inline Formatting ]─┐

    | Markdown        | Rendered As            | HTML                     |
    |-----------------|------------------------|--------------------------|
    | `**bold**`      | Bright white emphasis  | `<strong>`               |
    | `*italic*`      | Cyan emphasis          | `<em>`                   |
    | `` `code` ``    | Bright green monospace | `<code>`                 |
    | `~~strike~~`    | Magenta strikethrough  | `<del>`                  |
    | `***bold italic***` | Combined            | `<em><strong>`           |

    **Important:** The GFM `strikethrough` extension is enabled. `~~text~~`
    produces a `<del>` element styled with magenta colour.

    **Conflict with ANSI:** Avoid using `**[` or `*[` at the start of inline
    formatted text, as it may be ambiguous with ANSI marker parsing. Write
    `**text**` rather than `**[text]**`.

┌─ 3.4 ─────────────────────────────────────────────────────[ Links ]─┐

    **Standard Links:**
    ```markdown
    [link text](https://example.com)
    ```

    Rendered as a cyan clickable link. The `linkify: true` option in
    markdown-it means bare URLs (`https://example.com`) are also
    auto-linked.

    **Internal Anchors:**
    ```markdown
    [Go to formula](#eq-entropy)
    ```

    **Equation References:**
    ```markdown
    \ref{eq-entropy}
    ```
    Renders as a clickable equation number, e.g., `(3)`.

    **Best Practice:** Link text should describe the destination. Avoid
    "click here" or "read more".

┌─ 3.5 ───────────────────────────────────────────────[ Blockquotes ]─┐

    ```markdown
    > This is a blockquote.
    > It can span multiple lines.
    >
    > > Nested quotes are supported.
    ```

    Blockquotes are rendered with a left border and slightly muted text.

    **Common Pattern:** Use blockquotes for metadata in the Summary section:
    ```
    > target  : NETGEAR EXS27-0
    > result  : encryption key recovered
    > date    : 2026-01-15
    ```

┌─ 3.6 ───────────────────────────────────────────[ Fenced Code Blocks ]─┐

    **Syntax:**
    ```markdown
    ```python
    def hello():
        print("Hello, world!")
    ```
    ```

    **Features:**
    - Syntax highlighting via highlight.js
    - Language label displayed in the top border
    - Styled with terminal-inspired box borders
    - Content is NOT parsed for ANSI markers or Markdown

    **Supported Languages (partial list):**
    `bash`, `c`, `cpp`, `css`, `html`, `javascript`, `js`, `json`,
    `markdown`, `md`, `plaintext`, `python`, `py`, `shell`, `sh`,
    `typescript`, `ts`, `x86asm`, `xml`, `yaml`, `yml`

    **Language Aliases:**
    - `js` → JavaScript
    - `ts` → TypeScript
    - `py` → Python
    - `sh` → Shell
    - `yml` → YAML
    - `asm` → Assembly (x86)

    **Special Language: `Plain Text`** (see Section 2.7) — uses `<pre>` instead
    of the styled code container, preserving whitespace and disabling
    highlighting.

    **Conflict:** The `|` character inside inline code (`` `...` ``) is
    protected from table parsing. However, complex ANSI markers like
    `` `#[c|text]` `` inside inline code may cause unexpected behaviour
    because the `|` is replaced with a placeholder during preprocessing.

┌─ 3.7 ─────────────────────────────────────────────────────[ Tables ]─┐

    GFM pipe tables are supported:

    ```markdown
    | Column A | Column B | Column C |
    |----------|:--------:|---------:|
    | left     | center   |     right|
    | data     | data     |      data|
    ```

    **Alignment:**
    - `|------|` — default (left)
    - `|:-----|` — left
    - `|:----:|` — center
    - `|-----:|` — right

    **Note:** The pipe `|` character inside inline code is automatically
    protected from being interpreted as a table column separator. However,
    ANSI markers like `#[c|text]` in table cells will cause misalignment
    because the `|` inside the marker is processed as a table delimiter.
    **Use ANSI markers outside of pipe tables**, or use hand-drawn box
    tables instead.

    **Hand-Drawn Tables:** For content that includes ANSI markers, use
    Unicode box-drawing characters to create a table manually (see
    Section 2.5). This gives full control over column widths and allows
    ANSI markers in any cell.

┌─ 3.8 ───────────────────────────────────────────────────[ Images ]─┐

    Images must be on their own line (preceded and followed by blank
    lines).

    **Markdown Syntax:**
    ```markdown
    ![alt text](Blog\public\images\volume-1\article-slug\image.png)
    ```

    **HTML Syntax:**
    ```html
    <img src="Blog\public\images\volume-1\article-slug\image.png" alt="alt text">
    ```

    **Path Resolution:**
    - Full paths starting with `Blog\public\images\` are served directly
    - Relative paths (`./image.png`) are resolved relative to the article
    - `../` navigates up one directory level
    - External URLs (`https://...`) are passed through unchanged

    **Rendering:** Images are wrapped in `<figure>` with a `<figcaption>`
    from the alt text. Clicking opens a lightbox viewer with:
    - Mouse wheel zoom (10% per step)
    - Button zoom (±25% per click)
    - Drag to pan (when zoomed in)
    - Keyboard: ← → to navigate, +/- to zoom, 0 to reset, Esc to close
    - Touch: pinch-to-zoom on mobile
    - Zoom range: 12% – 800%

    **Supported Formats:** PNG, JPG, WebP, SVG, GIF.

    **Conflict:** Do NOT put images inline within paragraphs. The image
    parser expects images on dedicated lines. An image in the middle of
    a paragraph will be extracted and the surrounding text will be split
    into separate blocks.

┌─ 3.9 ───────────────────────────────────────[ LaTeX Mathematics ]─┐

    The project uses KaTeX for server-side rendering of LaTeX math.

    **Inline Math:**
    ```markdown
    The entropy is $H = -\sum p_i \log_2 p_i$.
    ```

    **Block Math:**
    ```markdown
    $$
    H = -\sum_{i=1}^{n} p_i \log_2 p_i
    $$
    ```

    **Equation Numbering and References:**
    ```markdown
    $$
    S = k \log W \label{eq-entropy}
    $$

    As shown in \ref{eq-entropy}, ...
    ```

    **Supported LaTeX Features:**
    - Fractions: `\frac{a}{b}`
    - Sums/Integrals: `\sum`, `\int`, `\prod`
    - Greek letters: `\alpha`, `\beta`, `\gamma`
    - Matrices: `\begin{pmatrix} ... \end{pmatrix}`
    - Cases: `\begin{cases} ... \end{cases}`
    - Aligned equations: `\begin{aligned} ... \end{aligned}`
    - All standard KaTeX-supported notation

    **Auto-Promotion:** Certain tall structures in inline math are
    automatically promoted to block-level rendering:
    - `\begin{cases}`, `\begin{aligned}`, `\begin{array}`, etc.
    - Operators with fractions (e.g., `\lim_{x \to 0} \frac{1}{x}`)
    - Nested fractions (two or more `\frac` commands)

    **Conflict:** The `$` sign is ONLY interpreted as math when it is NOT
    inside a code block or inline code span. Code blocks and inline code
    are protected before math processing to prevent false positives.

    **Escaping:** To display a literal `$`, escape it: `\$`. This is
    standard LaTeX behaviour.

    **Error Handling:** If KaTeX fails to render a formula (e.g., invalid
    LaTeX), the raw LaTeX source is displayed as fallback text. The
    `throwOnError: false` option ensures the page does not break.

──[ 4.0 ]──────────────────────────────────────────────[ Writing Workflow ]

This section provides a step-by-step guide for creating a new article.

┌─ 4.1 ─────────────────────────────────────────────────[ File Setup ]─┐

    **Step 1:** Create the article file in the correct directory:

    ```
    src/content/philes/volume-<N>/<topic>/<Article-Name>.md
    ```

    **Naming Rules:**
    - Use PascalCase: `NETGEAR-EXS27-0.md`, `Pwn-Trick-Notes.md`
    - Words separated by hyphens `-`
    - No spaces, underscores, or Chinese characters
    - Extension must be `.md`

    **Step 2:** Create the corresponding image directory:

    ```
    public/images/volume-<N>/<topic>/<article-slug>/
    ```

    Place all article images in this directory. The slug should match the
    article filename (without `.md`), lowercased: `netgear-exs27-0/`.

┌─ 4.2 ───────────────────────────────────────[ Metadata Configuration ]─┐

    **Step 3:** Add the frontmatter block at the very top of the file:

    ```yaml
    ---
    title: "Your Article Title"
    date: 2026-06-20
    author: "Your Name"
    lang: zh
    order: 0
    ---
    ```

    **Tips:**
    - `title`: Keep under 60 characters for SEO. Include primary keywords.
    - `date`: Use today's date during drafting; update on publication.
    - `lang`: Set to `zh` for Chinese articles. This affects CJK bitmap
      rendering and typography settings.
    - `order`: Use `0` for most articles. Set to `-1` for sticky/pinned
      articles, `1` or higher to push articles down.
    - `redacted`: Set to `true` during drafting, then remove or set to
      `false` when ready to publish.

┌─ 4.3 ───────────────────────────────────────[ Structuring the CONTENTS ]─┐

    **Step 4:** Immediately after the frontmatter `---`, add a CONTENTS
    block. The CONTENTS block is rendered as standard Markdown.

    **Recommended Format (Markdown Unordered List):**
    ```markdown
    CONTENTS

    - 1.0  Summary
      - 1.1  Background
    - 2.0  Analysis
      - 2.1  Methodology
      - 2.2  Results
    - 3.0  References
    ```

    **Alternative Format (Plain Text Block):**
    ```markdown
    CONTENTS

    ```Plain Text
      1.0  Summary
           1.1  Background
      2.0  Analysis
           2.1  Methodology
           2.2  Results
      3.0  References
    ```
    ```

    **Rules:**
    - The word `CONTENTS` must be on its own line (case-insensitive)
    - The block ends with a blank line
    - The chapter divider `──[ N ]──[ Title ]` in the body must match
      the numbers listed in CONTENTS

┌─ 4.4 ───────────────────────────────────────────[ Writing the Body ]─┐

    **Step 5:** Write the article body, starting with the first chapter
    divider:

    ```markdown
    ──[ 1.0 ]──────────────────────────────────────────────────[ Summary ]

    Your summary content here. One to three paragraphs.

      INK KEY:
      ├─ #[C|C]  format markers
      ├─ #[G|G]  validated data
      └─ #[R|R]  wrong paths
    ```

    **Recommended Structure:**
    1. **Summary (1.0):** Overview, INK KEY, key findings, proof chain
    2. **Background (1.1):** Context, prior work, terminology
    3. **Methodology (2.0):** Approach, tools, setup
    4. **Analysis (2.1+):** Detailed findings, data, flow diagrams
    5. **Discussion (3.0):** Interpretation, limitations
    6. **References (N.0):** External links, citations

    **Writing Tips:**
    - Use ANSI colour markers to highlight critical data points
    - Use blockquotes (`> key: value`) for metadata in the Summary
    - Use `──[ N ]──[ Title ]` dividers for major sections
    - Use `##` or `###` Markdown headings for sub-sections within a chapter
    - Use `:::tip`, `:::warning`, etc. for callout boxes
    - Use ```` ``` ```` code blocks for code snippets
    - Use `$...$` and `$$...$$` for mathematical notation

┌─ 4.5 ─────────────────────────────────────────[ Embedding Visuals ]─┐

    **Step 6:** Add images, diagrams, and tables.

    **Images:**
    ```markdown
    ![Description of the diagram](Blog\public\images\volume-1\article-slug\diagram.png)
    ```

    **Hand-Drawn Tables (for ANSI-coloured data):**
    ```
        ┌──────────────────┬──────────────┬──────────────────┐
        │ Field            │ Offset       │ Value            │
        ├──────────────────┼──────────────┼──────────────────┤
        │ magic            │ 0x00000000   │ #[G|ENCR]        │
        └──────────────────┴──────────────┴──────────────────┘
    ```

    **Flow Diagrams:**
    ```
      FLOW:
      input
          │
          ▼
      #[G|process]
          ├─ result A  #[C|ok]
          └─ result B  #[R|fail]
    ```

    **Markdown Pipe Tables (for plain data):**
    ```markdown
    | Field    | Offset     | Value |
    |----------|:----------:|------:|
    | magic    | 0x00000000 | ENCR  |
    | version  | 0x00000004 | 1     |
    ```

┌─ 4.6 ───────────────────────────────────────────────[ Final Review ]─┐

    **Step 7:** Review and validate before publishing.

    **Checklist:**
    - [ ] Frontmatter has all required fields (title, date, author)
    - [ ] `redacted: true` is removed or set to `false`
    - [ ] CONTENTS block correctly lists all chapters
    - [ ] Chapter dividers match CONTENTS entries
    - [ ] All images have descriptive `alt` text
    - [ ] All image paths are correct
    - [ ] No unescaped `#` at the start of lines (unless intentional)
    - [ ] ANSI markers are not nested
    - [ ] `|` characters in ANSI markers are inside code blocks or escaped
    - [ ] Box-drawing characters are properly aligned
    - [ ] All links are valid and use descriptive text
    - [ ] `\ref{...}` labels match `\label{...}` definitions
    - [ ] No stray `---` in the body (could close frontmatter early)
    - [ ] `::: containers` are properly closed with `:::`
    - [ ] Fenced code blocks are properly closed with ```` ``` ````

──[ 5.0 ]────────────────────────────────────────────[ Pitfalls and Conflicts ]

This section documents known conflicts between the custom syntax and Markdown,
common mistakes, and how the system handles errors.

┌─ 5.1 ───────────────────────────────────────────[ Syntax Conflicts ]─┐

    **Conflict Matrix:**

    | Syntax A       | Syntax B       | Conflict Description              | Resolution                         |
    |----------------|----------------|-----------------------------------|------------------------------------|
    | `#[c|text]`    | `|` in tables  | `|` inside ANSI markers breaks GFM pipe tables | Use hand-drawn box tables, or avoid ANSI in pipe tables |
    | `#[c|text]`    | `` `code` ``  | `#[` inside inline code is escaped | Code blocks are protected before ANSI parsing |
    | `---`          | Frontmatter    | Stray `---` in body closes frontmatter | Avoid `---` on its own line; use `***` for horizontal rules |
    | `──[`          | Markdown text  | Line starting with `──[` is treated as chapter divider | Escape or avoid at line start |
    | `|` (INK)      | Table `|`      | `|` at line start in INK blocks vs table cells | Only valid inside `--[ ink ]--` block |
    | `$...$`        | `` `code` ``  | `$` inside inline code is not math | Code regions are protected before math processing |
    | `:::`          | ```` ``` ```` | `:::` inside fenced code is not a container | Code blocks are protected before container segmentation |
    | `    ` (4 spaces)| Code block    | markdown-it treats 4-space indent as code block | Use ````Plain Text` fence to preserve indentation |

    **Detailed Explanations:**

    **(1) ANSI Markers in GFM Pipe Tables:**
    The `#[c|text]` syntax contains a `|` character. markdown-it's table
    parser also uses `|` as a column delimiter. When both appear in the
    same line, the table parser sees the `|` inside the ANSI marker as a
    column boundary, breaking the table layout.

    **Workaround:** Use hand-drawn box-drawing tables (Section 2.5) for
    content that requires ANSI colour markers. Reserve GFM pipe tables
    for plain text data.

    **(2) Frontmatter Closure:**
    The frontmatter block is delimited by `---` on its own line. If the
    article body contains a line with exactly `---`, the system interprets
    it as the end of frontmatter, corrupting the parse of subsequent
    content.

    **Workaround:** Use `***` or `* * *` for thematic breaks instead of
    `---`. If you must display three dashes, use `\-\\-\\-` or wrap them in
    a code span.

    **(3) Indentation and Code Blocks:**
    markdown-it's default behaviour interprets 4+ spaces of indentation as
    an indented code block. If you use indentation for visual layout (e.g.,
    in a CONTENTS block or ASCII art), the content may be rendered as a
    code block instead of plain text.

    **Workaround:** Wrap indented content in a ````Plain Text` fenced
    block. The `extractPlainTextBlocks` preprocessor extracts these blocks
    before markdown-it sees them, preserving the indentation via `<pre>`.

    **(4) ANSI Nested Markers:**
    The ANSI parser does not support nesting. `#[R|outer #[G|inner]]` will
    NOT produce red text with a green inner segment. The parser will match
    the first `]` it finds, producing malformed output.

    **Workaround:** Use separate markers adjacent to each other:
    `#[R|red text] #[G|green text]`. There is no way to nest colours.

┌─ 5.2 ───────────────────────────────────────────────[ Common Mistakes ]─┐

    **Mistake 1: Forgetting Blank Lines Before/After Images**
    ```
    Some text
    ![image](path.png)    ← Image will NOT be detected
    More text
    ```
    **Fix:**
    ```
    Some text

    ![image](path.png)

    More text
    ```

    **Mistake 2: Unclosed Fenced Code Blocks**
    ```
    ```python
    def foo():
        pass
                         ← Missing closing ```
    Next paragraph
    ```
    **Fix:** Always close fenced blocks with a matching ```` ``` ```` line.

    **Mistake 3: Unclosed ::: Containers**
    ```
    :::warning
    Important content
                         ← Missing :::
    ```
    **Fix:** Always close containers with `:::` on its own line.

    **Mistake 4: Using `---` in the Body**
    ```
    ──[ 1.0 ]──[ Summary ]
    Some text
    ---                    ← Closes frontmatter early!
    More text
    ```
    **Fix:** Use `***` or a chapter divider (`──[ N ]──[ Title ]`) instead.

    **Mistake 5: ANSI Markers in GFM Pipe Tables**
    ```
    | Field | Value       |
    |-------|-------------|
    | magic | #[G|ENCR]   |  ← | inside ANSI breaks table
    ```
    **Fix:** Use hand-drawn box tables for ANSI-coloured content.

    **Mistake 6: Mismatched `\ref` and `\label`**
    ```
    $$ x = 1 \label{eq-x} $$
    ...
    See \ref{eq-y}           ← Label "eq-y" does not exist
    ```
    **Fix:** Ensure `\ref{...}` labels match `\label{...}` definitions
    exactly. Unknown references render as `(??)`.

    **Mistake 7: Indentation Without `Plain Text` Fence**
    ```
    CONTENTS

      1.0  Summary           ← 4+ spaces → rendered as code block
        1.1  Detail
    ```
    **Fix:** Wrap in ````Plain Text` fence or use Markdown list syntax.

    **Mistake 8: Chinese Characters in File Names**
    ```
    固件分析.md              ← Will cause routing issues
    ```
    **Fix:** Use English names: `Firmware-Analysis.md`.

┌─ 5.3 ───────────────────────────────────────────────[ Error Handling ]─┐

    The system employs several defensive mechanisms to handle errors
    gracefully:

    **(1) KaTeX Fallback:**
    If a LaTeX formula is invalid, KaTeX returns the raw LaTeX source
    as plain text. The page does not crash. The `throwOnError: false`
    option ensures this behaviour.

    **(2) Highlight.js Fallback:**
    If a code block language is not recognised, highlight.js attempts
    auto-detection. If that fails, the code is HTML-escaped and
    displayed without highlighting.

    **(3) Unknown Container Types:**
    If an unknown `:::type` is used, the container is rendered with
    the type name in uppercase as the label, using a default grey
    colour scheme.

    **(4) Unknown Equation References:**
    If `\ref{unknown-label}` references a label that does not exist,
    it renders as `<span class="math-ref-unknown">(??)</span>`.

    **(5) CJK Font Fallback:**
    If a Chinese character is not found in the bitmap font atlas,
    it falls back to the browser's default font for that character
    without blocking rendering.

    **(6) Unclosed Inline Math:**
    If `$` is opened but not closed before the end of the line, the
    `$` is treated as literal text. The same applies to `$$` blocks.

    **(7) Code Block Protection:**
    Fenced code blocks and inline code spans are protected via
    placeholder substitution before math processing and container
    segmentation. This prevents `$` inside code from being parsed
    as math, and `:::` inside code from being parsed as containers.

──[ 6.0 ]────────────────────────────────────────────[ Extensive Examples ]

This section provides complete, copy-pasteable examples demonstrating
correct usage of all syntax elements.

┌─ 6.1 ───────────────────────────────────────────────[ Minimal Article ]─┐

    A minimal article with only the essential elements:

    ```markdown
    ---
    title: "Quick Note"
    date: 2026-06-20
    author: "AH"
    ---

    CONTENTS

    - 1.0  Summary

    ──[ 1.0 ]──────────────────────────────────────────────[ Summary ]

    This is a minimal article. It has a title, a date, an author, a
    CONTENTS block, and a single chapter.

    **Bold text** and *italic text* are supported.

    Inline math: $E = mc^2$.

    [External link](https://example.com)
    ```

┌─ 6.2 ─────────────────────────────────────────[ Full-Featured Article ]─┐

    A comprehensive example demonstrating all major features:

    ```markdown
    ---
    title: "Firmware Encryption Analysis"
    date: 2026-06-20
    author: "AH"
    lang: zh
    order: 0
    ---

    CONTENTS

    - 1.0  Summary
      - 1.1  Background
    - 2.0  Static Analysis
      - 2.1  Header Structure
      - 2.2  Decryption Routine
    - 3.0  Dynamic Verification
    - 4.0  References

    ──[ 1.0 ]──────────────────────────────────────[ Summary ]

    > target  : NETGEAR EXS27-0
    > version : V1.0.2.94
    > result  : encryption key recovered

      INK KEY:
      ├─ #[C|C]  format markers and structure labels
      ├─ #[G|G]  validated or recovered data
      ├─ #[Y|Y]  offsets, sizes, boundary values
      └─ #[R|R]  wrong paths, hazards, negative controls

    This article documents the process of reverse-engineering the
    firmware encryption scheme used by the #[G|NETGEAR EXS27-0].

      PROOF CHAIN:
      ├─ [1] #[C|header identification]  ✓
      ├─ [2] #[G|key extraction]  ✓
      ├─ [3] #[G|decryption test]  ✓
      └─ [4] #[R|signature bypass]  ✗

    ## 1.1 Background

    The encryption uses a modified AES-128-CBC scheme with a
    hardware-derived key.

    ──[ 2.0 ]────────────────────────────────────[ Static Analysis ]

    ## 2.1 Header Structure

    The firmware header contains the following fields:

        ┌──────────────────┬──────────────┬──────────────────┐
        │ Field            │ Offset       │ Value            │
        ├──────────────────┼──────────────┼──────────────────┤
        │ magic            │ 0x00000000   │ #[G|ENCR]        │
        │ version          │ 0x00000004   │ #[C|0x00000001]  │
        │ size             │ 0x00000008   │ #[Y|0x00C00000]  │
        │ checksum         │ 0x0000000C   │ #[G|0xA5F3E01C]  │
        └──────────────────┴──────────────┴──────────────────┘

    ## 2.2 Decryption Routine

    The decryption flow is as follows:

      DECRYPTION FLOW:
      encrypted data
          │
          ▼
      #[G|AES-128-CBC decrypt]
          │
          ├─ block 0  #[C|OK]
          ├─ block 1  #[C|OK]
          └─ block 2  #[R|padding error]
          │
          ▼
      plaintext output

    The key derivation function:

    ```c
    void derive_key(uint8_t *uid, uint8_t *key_out) {
        uint8_t buffer[32];
        memcpy(buffer, uid, 16);
        memcpy(buffer + 16, FIXED_SALT, 16);

        AES_KEY aes_key;
        AES_set_encrypt_key(MASTER_KEY, 128, &aes_key);
        AES_encrypt(buffer, key_out, &aes_key);
    }
    ```

    :::warning[Important]
    The #[Y|MASTER_KEY] constant is device-specific. The value shown
    here is for the EXS27-0 only. Other models may use different keys.
    :::

    :::tip
    Setting a breakpoint at `0x80004000` and dumping `key_out` after
    `derive_key` returns is the fastest way to verify the key.
    :::

    ──[ 3.0 ]────────────────────────────────[ Dynamic Verification ]

    To verify the key, we can use the following Python script:

    ```python
    from Crypto.Cipher import AES

    key = bytes.fromhex("A5F3E01C...")
    iv  = bytes.fromhex("00000000000000000000000000000000")

    with open("firmware.bin", "rb") as f:
        ciphertext = f.read()

    cipher = AES.new(key, AES.MODE_CBC, iv=iv)
    plaintext = cipher.decrypt(ciphertext)
    ```

    The entropy of the decrypted data confirms the key is correct:

    $$
    H = -\sum_{i=1}^{n} p_i \log_2 p_i \label{eq-entropy}
    $$

    As shown in \ref{eq-entropy}, the entropy of the decrypted output
    is #[G|7.2 bits/byte], which is consistent with compressed data.

    ──[ 4.0 ]──────────────────────────────────────[ References ]

    - [AES Specification](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf)
    - [PyCryptodome Documentation](https://pycryptodome.readthedocs.io/)
    ```

┌─ 6.3 ─────────────────────────────────────────[ ANSI-Only Structures ]─┐

    This example focuses on the custom ANSI structures:

    ```markdown
    ──[ 1.0 ]──────────────────────────────────────[ Structure Examples ]

      INK KEY:
      ├─ #[C|C]  format markers and container nodes
      ├─ #[G|G]  validated or recovered data
      ├─ #[Y|Y]  offsets, sizes, boundary values
      └─ #[R|R]  wrong paths, hazards, negative controls

      FLOW:
      root node
          │
          ▼
      #[G|child node A]
          ├─ 0x1000  #[C|description one]
          ├─ 0x2000  #[Y|description two]
          └─ 0x3000  #[R|description three]

      PROOF CHAIN:
      ├─ [1] #[C|header parse]  signal : magic matches
      │  signal : version is valid
      ├─ [2] #[G|key recovery]  signal : key matches expected
      │  signal : decryption succeeds
      └─ [3] #[R|signature check]  signal : signature mismatch
         signal : possible tampering detected

      TABLE:
        ┌──────────────────┬──────────────┬──────────────────┐
        │ Field            │ Offset       │ Value            │
        ├──────────────────┼──────────────┼──────────────────┤
        │ magic            │ 0x00000000   │ #[G|ENCR]        │
        │ version          │ 0x00000004   │ #[C|0x00000001]  │
        │ size             │ 0x00000008   │ #[Y|0x00C00000]  │
        │ checksum         │ 0x0000000C   │ #[R|MISMATCH]    │
        └──────────────────┴──────────────┴──────────────────┘
    ```

┌─ 6.4 ─────────────────────────────────────[ Mathematics-Heavy Article ]─┐

    This example demonstrates the full mathematics capabilities:

    ```markdown
    ──[ 1.0 ]──────────────────────────────────────[ Mathematical Analysis ]

    The probability mass function is defined as:

    $$
    P(X = k) = \binom{n}{k} p^k (1-p)^{n-k} \label{eq-binomial}
    $$

    For the entropy calculation, we use the Shannon entropy formula:

    $$
    H(X) = -\sum_{i=1}^{n} P(x_i) \log_2 P(x_i) \label{eq-shannon}
    $$

    The relationship between \ref{eq-binomial} and \ref{eq-shannon}
    can be expressed as a system of equations:

    $$
    \begin{cases}
      H(X) \geq 0 \\
      H(X) \leq \log_2 n \\
      H(X) = 0 \iff X \text{ is deterministic}
    \end{cases} \label{eq-bounds}
    ```

    Inline examples: $\alpha + \beta = \gamma$, $x \in \mathbb{R}$,
    and $\frac{dy}{dx} = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}$.

    The matrix representation:

    $$
    \begin{pmatrix}
      a_{11} & a_{12} & a_{13} \\
      a_{21} & a_{22} & a_{23} \\
      a_{31} & a_{32} & a_{33}
    \end{pmatrix}
    \begin{pmatrix}
      x_1 \\ x_2 \\ x_3
    \end{pmatrix}
    =
    \begin{pmatrix}
      b_1 \\ b_2 \\ b_3
    \end{pmatrix}
    \label{eq-matrix}
    ```

    From \ref{eq-bounds} we derive the upper bound of $\log_2 n$,
    which is achieved when all outcomes are equally likely.

    > **Note:** The auto-promotion rule means that $\begin{cases}...$
    > inside inline `$...$` will be rendered as a block. Use `$$...$$`
    > explicitly for multi-line structures to avoid surprises.
    ```

┌─ 6.5 ───────────────────────────────────────[ Code-Heavy Article ]─┐

    This example demonstrates code blocks and containers:

    ```markdown
    ──[ 1.0 ]──────────────────────────────────────[ Implementation ]

    The following C code demonstrates the vulnerability:

    ```c
    #include <string.h>
    #include <stdio.h>

    void process_input(char *user_data) {
        char buffer[64];
        // BUG: no bounds checking
        strcpy(buffer, user_data);
        printf("Processed: %s\n", buffer);
    }

    int main(int argc, char **argv) {
        if (argc < 2) return 1;
        process_input(argv[1]);
        return 0;
    }
    ```

    :::warning[Buffer Overflow]
    The `strcpy` call at line 6 copies user input into a fixed-size
    buffer without checking the input length. Inputs longer than 64
    bytes will overwrite the stack frame.
    :::

    The fix uses `strncpy` with explicit bounds checking:

    ```c
    void process_input_safe(char *user_data) {
        char buffer[64];
        size_t len = strlen(user_data);
        if (len >= sizeof(buffer)) {
            fprintf(stderr, "Input too long\n");
            return;
        }
        strncpy(buffer, user_data, sizeof(buffer) - 1);
        buffer[sizeof(buffer) - 1] = '\0';
        printf("Processed: %s\n", buffer);
    }
    ```

    :::tip
    Modern alternatives like `strlcpy` (BSD) or `strcpy_s` (C11 Annex K)
    provide safer string copy semantics. However, these are not universally
    available across all platforms.
    :::

    The assembly output confirms the vulnerability:

    ```x86asm
    ; strcpy(buffer, user_data) compiles to:
    lea     rdi, [rbp-0x48]      ; buffer address
    mov     rsi, [rbp-0x08]      ; user_data pointer
    call    strcpy               ; no length check!
    ```

    Python equivalent for exploitation testing:

    ```python
    import struct

    # Craft payload: 64 bytes padding + return address
    payload  = b"A" * 64
    payload += struct.pack("<Q", 0x0000000000401156)  # target address

    with open("payload.bin", "wb") as f:
        f.write(payload)
    ```
    ```

──[ EOF ]─────────────────────────────────────────────────────────────────────