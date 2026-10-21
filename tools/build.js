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
// Standalone file: Excel reader inlined so it works offline. Artifact: Excel reader from the CDN.
const vendor = fs.readFileSync(path.join(root, 'js', 'vendor', 'xlsx.full.min.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const standalone = inline.replace(/<!--XLSX-->[\s\S]*?<!--\/XLSX-->/, () => `<script>\n/* SheetJS xlsx 0.18.5 (Apache-2.0) */\n${vendor}\n</script>`);
fs.writeFileSync(path.join(root, 'dist', 'train-layout-generator.html'), standalone);

const artifactSrc = inline.replace(/<script>window\.XLSX[^\n]*\n/, '');
const head = artifactSrc.match(/<!--ARTIFACT-HEAD-->([\s\S]*?)<!--\/ARTIFACT-HEAD-->/)[1];
const body = artifactSrc.match(/<!--ARTIFACT-BODY-->([\s\S]*?)<!--\/ARTIFACT-BODY-->/)[1];
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), head.trim() + '\n' + body.trim() + '\n');
console.log('Built dist/train-layout-generator.html and dist/artifact.html');
