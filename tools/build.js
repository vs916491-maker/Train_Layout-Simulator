// Builds single-file versions of the tool by inlining the scripts.
//   dist/train-layout-generator.html  — complete standalone page (double-click to open, works offline)
//   dist/artifact.html                — body-only version for publishing as a claude.ai artifact
// Usage: node tools/build.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const inline = html.replace(/<!--SCRIPTS-->([\s\S]*?)<!--\/SCRIPTS-->/, (m, block) => {
  const srcs = [...block.matchAll(/<script src="([^"]+)"><\/script>/g)].map(x => x[1]);
  return srcs.map(s => `<script>\n/* ${s} */\n${fs.readFileSync(path.join(root, s), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`).join('\n');
});
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'train-layout-generator.html'), inline);

const head = inline.match(/<!--ARTIFACT-HEAD-->([\s\S]*?)<!--\/ARTIFACT-HEAD-->/)[1];
const body = inline.match(/<!--ARTIFACT-BODY-->([\s\S]*?)<!--\/ARTIFACT-BODY-->/)[1];
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), head.trim() + '\n' + body.trim() + '\n');
console.log('Built dist/train-layout-generator.html and dist/artifact.html');
