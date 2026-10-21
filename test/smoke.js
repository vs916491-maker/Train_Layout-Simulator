// Node smoke test: builds every sheet for each preset and writes PDF, DXF and SVG files.
// Usage: node test/smoke.js <outDir>
const fs = require('fs'); const path = require('path');
['engine','presets','drawing','render-svg','export-pdf','export-dxf'].forEach(f => require(path.join(__dirname, '..', 'js', f + '.js')));
const out = process.argv[2] || path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
let fail = 0;
for (const id of Object.keys(TLT.PRESETS)) {
  const cfg = TLT.PRESETS[id](); const R = TLT.compute(cfg); const sheets = TLT.buildSheets(R);
  fs.writeFileSync(path.join(out, id + '.pdf'), TLT.exportPDF(sheets, { title: id }));
  fs.writeFileSync(path.join(out, id + '.dxf'), TLT.exportDXF(sheets));
  sheets.forEach((s, i) => fs.writeFileSync(path.join(out, `${id}-${i + 1}.svg`), TLT.renderSVG(s)));
  console.log(id, sheets.map(s => `${s.short} 1:${s.scale} ents=${s.views.reduce((a, v) => a + v.ents.length, 0) + s.paper.ents.length}`).join(' | '));
  console.log('  warnings:', R.warnings);
  if (!sheets.length) fail++;
}
process.exit(fail);
