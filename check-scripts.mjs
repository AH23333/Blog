import fs from 'fs';
const html = fs.readFileSync('dist/volume/0/mermaid-test/index.html', 'utf-8');

// Search for all script tags
const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
let match;
let count = 0;
while ((match = script.exec(html)) !== null && count < 20) {
  console.log('=== Script', count + 1, '===');
  console.log(match[0].substring(0, 300));
  console.log('---');
  count++;
}
console.log('Total scripts:', count);