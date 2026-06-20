/**
 * Verification test for ANSI color rendering integration.
 * Tests that #[role|text] syntax is converted to HTML spans,
 * ink blocks are rendered correctly, and other syntax is not affected.
 */
import {
  processAnsiInlineMarkup,
  restoreAnsiInlineMarkup,
  extractAndRenderInkBlocks,
  restoreInkBlocks
} from "./src/modules/textmode/ansi/render";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.log(`  FAIL: ${label}`);
  }
}

// ── Test 1: Inline ANSI processing + restore ────────────────────────────

console.log("=== Test 1: Inline ANSI processing + restore ===\n");

const { processed: p1, markers: m1 } = processAnsiInlineMarkup(
  "#[G|r--] maps read-only, #[R|PF_X] marks execution."
);
console.log("Input:  #[G|r--] maps read-only, #[R|PF_X] marks execution.");
console.log("Processed:", p1);
console.log("Markers:", m1);

const restored1 = restoreAnsiInlineMarkup(p1, m1);
console.log("Restored:", restored1);
assert(restored1.includes('<span class="ansi ansi-bright-green">r--</span>'), "bright-green span present");
assert(restored1.includes('<span class="ansi ansi-bright-red">PF_X</span>'), "bright-red span present");
assert(!restored1.includes("#[G|"), "no raw ANSI marker left");
assert(restored1.includes("maps read-only"), "plain text preserved");
assert(restored1.includes("marks execution"), "plain text preserved");
console.log();

// Test 1b: Escaped #[ should NOT be processed
const { processed: p1b, markers: m1b } = processAnsiInlineMarkup(
  "source : \\#[G|r--] maps read-only"
);
const restored1b = restoreAnsiInlineMarkup(p1b, m1b);
console.log("Input:  source : \\#[G|r--] maps read-only");
console.log("Restored:", restored1b);
assert(!restored1b.includes("ansi-"), "escaped marker NOT colored");
assert(restored1b.includes("#[G|r--]"), "escaped marker shows literal #[G|r--]");
console.log();

// Test 1c: Short role names
const { processed: p1c, markers: m1c } = processAnsiInlineMarkup(
  "#[r|red] #[g|green] #[y|yellow] #[b|blue]"
);
const restored1c = restoreAnsiInlineMarkup(p1c, m1c);
console.log("Input:  #[r|red] #[g|green] #[y|yellow] #[b|blue]");
console.log("Restored:", restored1c);
assert(restored1c.includes("ansi-red"), "short red role");
assert(restored1c.includes("ansi-green"), "short green role");
assert(restored1c.includes("ansi-yellow"), "short yellow role");
assert(restored1c.includes("ansi-blue"), "short blue role");
console.log();

// Test 1d: Long role names
const { processed: p1d, markers: m1d } = processAnsiInlineMarkup(
  "#[bright-cyan|field boundary]"
);
const restored1d = restoreAnsiInlineMarkup(p1d, m1d);
console.log("Input:  #[bright-cyan|field boundary]");
console.log("Restored:", restored1d);
assert(restored1d.includes("ansi-bright-cyan"), "long role name");
assert(restored1d.includes("field boundary"), "text preserved");
console.log();

// Test 1e: Escape pipe and bracket in text
const { processed: p1e, markers: m1e } = processAnsiInlineMarkup(
  "#[c|escape a pipe: \\| and bracket: \\]]"
);
const restored1e = restoreAnsiInlineMarkup(p1e, m1e);
console.log("Input:  #[c|escape a pipe: \\| and bracket: \\]]");
console.log("Restored:", restored1e);
assert(restored1e.includes("escape a pipe: |"), "escaped pipe shows as |");
assert(restored1e.includes("bracket: ]"), "escaped bracket shows as ]");
console.log();

// Test 1e2: Escape backslash and hash in ANSI text
const { processed: p1e2, markers: m1e2 } = processAnsiInlineMarkup(
  "#[c|backslash: \\\\ and hash: \\#]"
);
const restored1e2 = restoreAnsiInlineMarkup(p1e2, m1e2);
console.log("Input:  #[c|backslash: \\\\ and hash: \\#]");
console.log("Restored:", restored1e2);
assert(restored1e2.includes("backslash: \\"), "escaped backslash preserved");
assert(restored1e2.includes("hash: #"), "escaped hash preserved");
console.log();

// Test 1e3: ANSI escape of [ and ] in text
const { processed: p1e3, markers: m1e3 } = processAnsiInlineMarkup(
  "#[c|literal \\[ and \\]]"
);
const restored1e3 = restoreAnsiInlineMarkup(p1e3, m1e3);
console.log("Input:  #[c|literal \\[ and \\]]");
console.log("Restored:", restored1e3);
assert(restored1e3.includes("literal [ and ]"), "escaped brackets preserved");
console.log();

// Test 1f: Plain text with no ANSI
const { processed: p1f, markers: m1f } = processAnsiInlineMarkup(
  "This is plain text with no ANSI codes."
);
const restored1f = restoreAnsiInlineMarkup(p1f, m1f);
console.log("Input:  This is plain text with no ANSI codes.");
console.log("Restored:", restored1f);
assert(restored1f === "This is plain text with no ANSI codes.", "plain text unchanged");
assert(m1f.size === 0, "no markers for plain text");
console.log();

// Test 1g: Special characters in ANSI text should be HTML-escaped
const { processed: p1g, markers: m1g } = processAnsiInlineMarkup(
  "#[R|<script>alert(1)</script>]"
);
const restored1g = restoreAnsiInlineMarkup(p1g, m1g);
console.log("Input:  #[R|<script>alert(1)</script>]");
console.log("Restored:", restored1g);
assert(restored1g.includes("&lt;script&gt;"), "HTML special chars escaped in span");
assert(!restored1g.includes("<script>"), "no raw HTML in output");
console.log();

// ── Test 2: Ink block extraction and rendering ──────────────────────────

console.log("=== Test 2: Ink block extraction and rendering ===\n");

const inkBlockInput = `Some text before the ink block.

--[ ink ]--
| e_ident  7f 45 4c 46 02 01 01 00  00 00 00 00 00 00 00 00
~          RR RR RR RR CC GG GG KK  KK KK KK KK KK KK KK KK

Some text after the ink block.`;

const { processedText, blocks } = extractAndRenderInkBlocks(inkBlockInput, 80);
assert(processedText.includes("INKBLOCK_"), "ink block replaced with placeholder");
assert(!processedText.includes("--[ ink ]--"), "no raw ink marker in processed text");
assert(blocks.length === 1, "one ink block extracted");
assert(blocks[0].includes("ansi-"), "ink block HTML contains ANSI classes");
console.log("Ink block HTML snippet:", blocks[0].substring(0, 200));
console.log();

// Test 2b: Restore ink blocks
const mockHtml = "\uE500INKBLOCK_0\uE500";
const restored2 = restoreInkBlocks(mockHtml, blocks);
assert(restored2.includes("ansi-"), "restored ink block has ANSI");
assert(!restored2.includes("INKBLOCK_"), "no placeholder in restored output");
console.log();

// ── Test 3: Markdown syntax preservation ────────────────────────────────

console.log("=== Test 3: Markdown syntax preservation ===\n");

// Bold and links in plain text (not inside ANSI)
const { processed: p3a, markers: m3a } = processAnsiInlineMarkup(
  "**bold text** and [link](url) should remain intact."
);
const restored3a = restoreAnsiInlineMarkup(p3a, m3a);
console.log("Input:  **bold text** and [link](url) should remain intact.");
console.log("Restored:", restored3a);
assert(restored3a.includes("**bold"), "bold markdown preserved");
assert(restored3a.includes("[link]"), "link markdown preserved");
console.log();

// Mixed ANSI and Markdown
const { processed: p3b, markers: m3b } = processAnsiInlineMarkup(
  "#[G|**bold green**] and #[R|[red link](url)]"
);
const restored3b = restoreAnsiInlineMarkup(p3b, m3b);
console.log("Input:  #[G|**bold green**] and #[R|[red link](url)]");
console.log("Restored:", restored3b);
assert(restored3b.includes("ansi-bright-green"), "green span present");
assert(restored3b.includes("ansi-bright-red"), "red span present");
// Inside the ANSI span, markdown syntax is treated as literal text
assert(restored3b.includes("**bold green**"), "markdown inside ANSI is literal text");
console.log();

// ── Test 4: Code block preservation ─────────────────────────────────────

console.log("=== Test 4: Code block preservation ===\n");

const codeText = "```\n#[G|code should not be colored]\n```";
const { processed: p4, markers: m4 } = processAnsiInlineMarkup(codeText);
const restored4 = restoreAnsiInlineMarkup(p4, m4);
console.log("Input:  ", codeText);
console.log("Restored:", restored4);
assert(restored4.includes("```"), "code block fences preserved");
console.log("Note: Inline ANSI is processed pre-Markdown, so code block content\n      will have placeholders. The actual code block protection happens\n      in the full phile rendering pipeline.");
console.log();

// ── Test 5: Real content from ansi-ink-phile.md ─────────────────────────

console.log("=== Test 5: Real content from ansi-ink-phile.md ===\n");

// Line 53: render : #[G|r--] maps read-only, #[R|PF_X] marks execution.
const { processed: p5a, markers: m5a } = processAnsiInlineMarkup(
  "#[G|r--] maps read-only, #[R|PF_X] marks execution."
);
const restored5a = restoreAnsiInlineMarkup(p5a, m5a);
console.log("Input:  #[G|r--] maps read-only, #[R|PF_X] marks execution.");
console.log("Restored:", restored5a);
assert(restored5a.includes('<span class="ansi ansi-bright-green">r--</span>'), "r-- is green");
assert(restored5a.includes('<span class="ansi ansi-bright-red">PF_X</span>'), "PF_X is red");
assert(!restored5a.includes("#[G|"), "no raw ANSI marker");
console.log();

// Line 52: source : \#[G|r--] maps read-only, \#[R|PF_X] marks execution.
const { processed: p5b, markers: m5b } = processAnsiInlineMarkup(
  "source : \\#[G|r--] maps read-only, \\#[R|PF_X] marks execution."
);
const restored5b = restoreAnsiInlineMarkup(p5b, m5b);
console.log("Input:  source : \\#[G|r--] maps read-only, \\#[R|PF_X] marks execution.");
console.log("Restored:", restored5b);
assert(!restored5b.includes("ansi-"), "escaped source line has NO color");
assert(restored5b.includes("#[G|r--]"), "shows literal #[G|r--]");
console.log();

// Line 61: #[r|red] #[g|green] #[y|yellow] #[b|blue] #[m|magenta] #[c|cyan]
const { processed: p5c, markers: m5c } = processAnsiInlineMarkup(
  "#[r|red] #[g|green] #[y|yellow] #[b|blue] #[m|magenta] #[c|cyan]"
);
const restored5c = restoreAnsiInlineMarkup(p5c, m5c);
console.log("Input:  #[r|red] #[g|green] #[y|yellow] #[b|blue] #[m|magenta] #[c|cyan]");
console.log("Restored:", restored5c);
assert(restored5c.includes("ansi-red"), "red");
assert(restored5c.includes("ansi-green"), "green");
assert(restored5c.includes("ansi-yellow"), "yellow");
assert(restored5c.includes("ansi-blue"), "blue");
assert(restored5c.includes("ansi-magenta"), "magenta");
assert(restored5c.includes("ansi-cyan"), "cyan");
assert(!restored5c.includes("#[r|"), "no raw ANSI markers");
console.log();

// Line 215: pwndbg> x/gx #[c|$rsp]
const { processed: p5d, markers: m5d } = processAnsiInlineMarkup(
  "pwndbg> x/gx #[c|$rsp]"
);
const restored5d = restoreAnsiInlineMarkup(p5d, m5d);
console.log("Input:  pwndbg> x/gx #[c|$rsp]");
console.log("Restored:", restored5d);
assert(restored5d.includes("ansi-cyan"), "cyan color");
assert(restored5d.includes("$rsp"), "register name preserved");
console.log();

// ── Test 6: LaTeX backslash preservation ────────────────────────────────

console.log("=== Test 6: LaTeX backslash preservation ===\n");

// LaTeX commands should NOT be stripped by ANSI parser
const { processed: p6a, markers: m6a } = processAnsiInlineMarkup(
  "H = -\\sum_{i=1}^{n} p_i \\log_2 p_i \\label{eq-entropy}"
);
const restored6a = restoreAnsiInlineMarkup(p6a, m6a);
console.log("Input:  H = -\\sum_{i=1}^{n} p_i \\log_2 p_i \\label{eq-entropy}");
console.log("Restored:", restored6a);
assert(restored6a.includes("\\sum"), "\\sum preserved");
assert(restored6a.includes("\\log"), "\\log preserved");
assert(restored6a.includes("\\label"), "\\label preserved");
assert(m6a.size === 0, "no ANSI markers for LaTeX text");
console.log();

// Mixed LaTeX and ANSI
const { processed: p6b, markers: m6b } = processAnsiInlineMarkup(
  "The formula $\\sum_{i=1}^{n}$ with #[G|green text]"
);
const restored6b = restoreAnsiInlineMarkup(p6b, m6b);
console.log("Input:  The formula $\\sum_{i=1}^{n}$ with #[G|green text]");
console.log("Restored:", restored6b);
assert(restored6b.includes("\\sum"), "\\sum preserved in mixed content");
assert(restored6b.includes("ansi-bright-green"), "ANSI color applied");
console.log();

// LaTeX \binom, \frac, \alpha, \beta
const { processed: p6c, markers: m6c } = processAnsiInlineMarkup(
  "\\binom{n}{k} \\frac{a}{b} \\alpha + \\beta = \\gamma"
);
const restored6c = restoreAnsiInlineMarkup(p6c, m6c);
console.log("Input:  \\binom{n}{k} \\frac{a}{b} \\alpha + \\beta = \\gamma");
console.log("Restored:", restored6c);
assert(restored6c.includes("\\binom"), "\\binom preserved");
assert(restored6c.includes("\\frac"), "\\frac preserved");
assert(restored6c.includes("\\alpha"), "\\alpha preserved");
assert(restored6c.includes("\\beta"), "\\beta preserved");
assert(restored6c.includes("\\gamma"), "\\gamma preserved");
console.log();

// LaTeX with \begin and \end
const { processed: p6d, markers: m6d } = processAnsiInlineMarkup(
  "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}"
);
const restored6d = restoreAnsiInlineMarkup(p6d, m6d);
console.log("Input:  \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}");
console.log("Restored:", restored6d);
assert(restored6d.includes("\\begin"), "\\begin preserved");
assert(restored6d.includes("\\end"), "\\end preserved");
// \\ in raw text is treated as ANSI escape (produces single \),
// which is expected behavior. LaTeX inside code blocks is protected
// by the code block protection layer in philes/render.ts.
console.log("Note: \\\\ in raw text → \\ (ANSI escape). Code blocks are protected separately.");
console.log();

// ── Summary ─────────────────────────────────────────────────────────────

console.log("=== Results ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}