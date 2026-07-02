import { renderMarkdownToHtml } from "../src/modules/textmode/markdown/parser.ts";

// Test 4: alignment markers
const html1 = renderMarkdownToHtml("| 左对齐 | 居中 | 右对齐 |\n|:---|---:|:---:|\n| a | b | c |");
console.log("=== Alignment markers test ===");
console.log("has table:", html1.includes("<table>"));
const tdMatches = html1.match(/<td[^>]*>[^<]*<\/td>/g);
console.log("td matches:", tdMatches);
console.log("Full HTML:");
console.log(html1);

// Test 5: non-table content
const html2 = renderMarkdownToHtml("这是普通文本\n\n- 列表项\n\n# 标题");
console.log("\n=== Non-table content test ===");
console.log("has table:", html2.includes("<table>"));
console.log("Full HTML:");
console.log(html2);