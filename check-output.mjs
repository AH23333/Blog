import fs from "fs"

const html = fs.readFileSync("dist/volume/0/mermaid-test/index.html", "utf8")

// Extract diagram sizes from viewBox attributes
const svgPattern =
  /<svg class="mermaid-svg"[^>]*?viewBox="([^"]*)"[^>]*?aria-roledescription="([^"]*)"/g
let m
console.log("=== Mermaid Diagram Sizes ===")
let diagramCount = 0
while ((m = svgPattern.exec(html)) !== null) {
  diagramCount++
  const vbox = m[1]
  const type = m[2]
  const parts = vbox.split(/\s+/)
  if (parts.length >= 4) {
    const w = Number(parts[2])
    const h = Number(parts[3])
    console.log(`  ${type}: ${w.toFixed(0)}x${h.toFixed(0)}`)
  }
}

// Also try reversed attribute order
const svgPattern2 =
  /<svg class="mermaid-svg"[^>]*?aria-roledescription="([^"]*)"[^>]*?viewBox="([^"]*)"/g
while ((m = svgPattern2.exec(html)) !== null) {
  diagramCount++
  const type = m[1]
  const vbox = m[2]
  const parts = vbox.split(/\s+/)
  if (parts.length >= 4) {
    const w = Number(parts[2])
    const h = Number(parts[3])
    console.log(`  ${type}: ${w.toFixed(0)}x${h.toFixed(0)}`)
  }
}

// Count diagrams and errors
const diagramDivs = (html.match(/<div class="mermaid-diagram">/g) || []).length
const errorDivs = (html.match(/<div class="mermaid-error">/g) || []).length
console.log(`\n=== Diagram Status ===`)
console.log(`  Diagrams rendered: ${diagramDivs}`)
console.log(`  Errors: ${errorDivs}`)
console.log(`  SVG diagrams found: ${diagramCount}`)

// Check for <p> wrapping (should be fixed)
const pWrapped = (html.match(/<p>\s*<div class="mermaid-diagram">/g) || [])
  .length
console.log(`  <p> wrapping issues: ${pWrapped}`)

// Check lightbox script
const lightboxScript =
  html.includes("installMermaidLightbox") || html.includes("mermaid-lightbox")
console.log(`\n=== Lightbox Status ===`)
console.log(`  Lightbox script present: ${lightboxScript}`)

// Check for potential occlusion issues
const overflowCount = (html.match(/overflow:\s*visible/g) || []).length
console.log(`\n=== Potential Issues ===`)
console.log(`  overflow:visible elements: ${overflowCount}`)
console.log(
  `  (Note: primarily from Mermaid's internal CSS .label-icon, safe within SVG)`
)
