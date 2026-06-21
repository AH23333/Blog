import fs from 'fs';
const html = fs.readFileSync('dist/volume/0/mermaid-test/index.html', 'utf-8');

// Check for mermaid elements
const idx = html.indexOf('class="mermaid"');
if (idx !== -1) {
  console.log('Found mermaid class at:', idx);
  console.log(html.substring(idx, idx + 500));
} else {
  console.log('class="mermaid" not found');
}