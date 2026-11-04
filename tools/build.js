#!/usr/bin/env node
// Bundles the game into one self-contained HTML file: dist/wingbreaker.html
// Usage: node tools/build.js [--fragment out.html]
//   --fragment writes the page without <!doctype>/<html>/<head>/<body> wrappers,
//   for hosts that supply their own document skeleton.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let html = read('index.html');
const css = read('css/style.css');
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}</style>`);

const block = html.match(/<!--SCRIPTS-->([\s\S]*?)<!--\/SCRIPTS-->/);
if (!block) throw new Error('Script markers not found in index.html');
const srcs = [...block[1].matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const js = srcs.map((s) => `// ---- ${s} ----\n${read(s)}`).join('\n');
if (js.includes('</script')) throw new Error('A script contains "</script", which would break inlining');
html = html.replace(block[0], () => `<script>\n${js}\n</script>`);

const args = process.argv.slice(2);
const fragIdx = args.indexOf('--fragment');
if (fragIdx >= 0) {
  const out = args[fragIdx + 1];
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<meta charset[^>]*>\s*/, '')
    .replace(/<meta name="viewport"[^>]*>\s*/, '');
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  fs.writeFileSync(out, head.trim() + '\n' + body.trim() + '\n');
  console.log('Wrote fragment', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
} else {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  const out = path.join(root, 'dist', 'wingbreaker.html');
  fs.writeFileSync(out, html);
  console.log('Wrote', path.relative(root, out), (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
}
