import { readFileSync } from "fs"

const c = readFileSync("dist/volume/1/java后端生态全景/index.html", "utf8")

console.log("=== Structure Check ===")
console.log("Has lazy-initial-content:", c.includes("lazy-initial-content"))
console.log("Has lazy-pending-content:", c.includes("lazy-pending-content"))
console.log("Initial chunks present:")
for (let i = 0; i < 5; i++) {
  console.log(`  chunk-${i}:`, c.includes(`data-chunk-id="chunk-${i}"`))
}
console.log("Has initMermaidDiagrams:", c.includes("initMermaidDiagrams"))
console.log("Has initLazyRender:", c.includes("initLazyRender"))
console.log("Has bootstrapTypewriter:", c.includes("bootstrapTypewriter"))
console.log("")

console.log("=== Mermaid Check ===")
console.log("Has installMermaidLightbox:", c.includes("installMermaidLightbox"))
console.log(
  'class="mermaid" count:',
  (c.match(/class="mermaid"/g) || []).length
)
console.log(
  "data-has-mermaid count:",
  (c.match(/data-has-mermaid/g) || []).length
)
console.log("")

console.log("=== Lazy Loading Check ===")
console.log(
  "lazy-initial-content:",
  (c.match(/lazy-initial-content/g) || []).length
)
console.log(
  "lazy-chunk-initial:",
  (c.match(/lazy-chunk-initial/g) || []).length
)
console.log("lazy-placeholder:", (c.match(/lazy-placeholder/g) || []).length)
console.log("lazy-template:", (c.match(/lazy-template/g) || []).length)
console.log("data-chunk-id:", (c.match(/data-chunk-id/g) || []).length)
console.log("")

console.log("=== Content Check ===")
console.log(
  "textmode-pre phile-body:",
  (c.match(/textmode-pre phile-body/g) || []).length
)
console.log("phile-media:", (c.match(/phile-media/g) || []).length)
console.log("Total size:", (c.length / 1024).toFixed(1), "KB")
