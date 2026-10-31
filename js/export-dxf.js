/* Train Layout Tool — DXF writer (AutoCAD R12 / AC1009, ANSI_1252).
 * Geometry is written at 1:1 in millimetres (model space). Each sheet is placed side by side;
 * its frame, title block and tables are scaled by the sheet scale so the file plots at 1:scale.
 * Standing areas are written as 45° hatch lines on layer STAND.
 */
(function () {
  'use strict';
  const TLT = (globalThis.TLT = globalThis.TLT || {});
  const r = v => (Math.round(v * 1000) / 1000).toString();

  function dxfText(s) {
    return String(s).replace(/Ø/g, '%%c').replace(/°/g, '%%d').replace(/±/g, '%%p').replace(/≤/g, '<=').replace(/≥/g, '>=')
      .replace(/Δ/g, 'd').replace(/[^\u0000-ÿ–—…‘’“”•€]/g, '?');
  }
  const WIN = { '–': 0x96, '—': 0x97, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '€': 0x80 };

  TLT.exportDXF = function (sheets, which) {
    const list = which == null ? sheets : [sheets[which]];
    const E = [];        // entity group strings
    const lts = new Map(); // linetype name -> pattern (model units)
    const layers = new Set(['0']);
    const out = (...pairs) => { for (let i = 0; i < pairs.length; i += 2) E.push(String(pairs[i]), String(pairs[i + 1])); };
    const ltFor = (st, S) => {
      if (!st.dash) return null;
      const name = `${st.layerName}_${S}`.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      if (!lts.has(name)) lts.set(name, st.dash.map((d, i) => (i % 2 ? -d : d) * S));
      return name;
    };
    let offX = 0;
    let ext = [Infinity, Infinity, -Infinity, -Infinity];
    const grow = (x, y) => { ext[0] = Math.min(ext[0], x); ext[1] = Math.min(ext[1], y); ext[2] = Math.max(ext[2], x); ext[3] = Math.max(ext[3], y); };

    list.forEach(sheet => {
      const S = sheet.scale || sheet.dxfScale || 1;
      const [PW] = sheet.size;
      const tx = (P, isPaper) => (isPaper ? (x => offX + x * S) : (x => offX + P.ox * S + x));
      const forEach = (ents, isPaper, v) => {
        const X = isPaper ? (x => offX + x * S) : (x => offX + v.ox * S + x);
        const Y = isPaper ? (y => y * S) : (y => v.oy * S + y);
        const D = isPaper ? (d => d * S) : (d => d);
        ents.forEach(e => {
          const st = TLT.style(e);
          st.layerName = e.ly || 'TEXT';
          const ly = (e.ly || 'TEXT');
          layers.add(ly);
          const lt = ltFor(st, S);
          const head = (type) => { out(0, type, 8, ly); if (lt) out(6, lt); };
          switch (e.t) {
            case 'L':
              head('LINE'); out(10, r(X(e.x1)), 20, r(Y(e.y1)), 30, 0, 11, r(X(e.x2)), 21, r(Y(e.y2)), 31, 0);
              grow(X(e.x1), Y(e.y1)); grow(X(e.x2), Y(e.y2));
              break;
            case 'R':
              head('POLYLINE'); out(66, 1, 10, 0, 20, 0, 30, 0, 70, 1);
              [[e.x0, e.y0], [e.x1, e.y0], [e.x1, e.y1], [e.x0, e.y1]].forEach(([x, y]) => { out(0, 'VERTEX', 8, ly, 10, r(X(x)), 20, r(Y(y)), 30, 0); grow(X(x), Y(y)); });
              out(0, 'SEQEND', 8, ly);
              break;
            case 'P':
              head('POLYLINE'); out(66, 1, 10, 0, 20, 0, 30, 0, 70, e.closed ? 1 : 0);
              e.pts.forEach(([x, y]) => { out(0, 'VERTEX', 8, ly, 10, r(X(x)), 20, r(Y(y)), 30, 0); grow(X(x), Y(y)); });
              out(0, 'SEQEND', 8, ly);
              break;
            case 'C':
              head('CIRCLE'); out(10, r(X(e.cx)), 20, r(Y(e.cy)), 30, 0, 40, r(D(e.r)));
              break;
            case 'H': {
              // 45° hatch lines, globally aligned so adjacent rectangles join up
              const sp = isPaper ? 2.5 * S : (e.sp || 2.5 * S);
              const x0 = X(e.x0), x1 = X(e.x1), y0 = Y(e.y0), y1 = Y(e.y1);
              for (let k = Math.ceil((x0 - y1) / sp); k <= Math.floor((x1 - y0) / sp); k++) {
                const c = k * sp;
                const xa = Math.max(x0, y0 + c), xb = Math.min(x1, y1 + c);
                if (xb - xa > 1e-6) { out(0, 'LINE', 8, ly, 10, r(xa), 20, r(xa - c), 30, 0, 11, r(xb), 21, r(xb - c), 31, 0); }
              }
              break;
            }
            case 'T': {
              const h = D(e.h);
              const capH = h * 0.72;
              let x = X(e.x), y = Y(e.y);
              const a = (e.rot || 0) * Math.PI / 180;
              const h72 = e.anchor === 'middle' ? 1 : e.anchor === 'end' ? 2 : 0;
              const v73 = e.valign === 'middle' ? 2 : e.valign === 'top' ? 3 : 0;
              out(0, 'TEXT', 8, ly, 10, r(x), 20, r(y), 30, 0, 40, r(capH), 1, dxfText(e.s));
              if (e.rot) out(50, r(e.rot));
              if (h72 || v73) { out(72, h72, 11, r(x), 21, r(y), 31, 0); if (v73) out(73, v73); }
              grow(x, y);
              break;
            }
          }
        });
      };
      sheet.views.forEach(v => forEach(v.ents, false, v));
      forEach(sheet.paper.ents, true, null);
      offX += PW * S * 1.08;
    });

    // ---- assemble file ----
    const H = [];
    const put = (...pairs) => { for (let i = 0; i < pairs.length; i += 2) H.push(String(pairs[i]), String(pairs[i + 1])); };
    if (!Number.isFinite(ext[0])) ext = [0, 0, 1000, 1000];
    put(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$DWGCODEPAGE', 3, 'ANSI_1252', 9, '$INSBASE', 10, 0, 20, 0, 30, 0,
      9, '$EXTMIN', 10, r(ext[0]), 20, r(ext[1]), 30, 0, 9, '$EXTMAX', 10, r(ext[2]), 20, r(ext[3]), 30, 0, 9, '$LTSCALE', 40, 1, 0, 'ENDSEC');
    put(0, 'SECTION', 2, 'TABLES');
    put(0, 'TABLE', 2, 'LTYPE', 70, lts.size + 1);
    put(0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, 0);
    lts.forEach((pat, name) => {
      put(0, 'LTYPE', 2, name, 70, 0, 3, name, 72, 65, 73, pat.length, 40, r(pat.reduce((a, b) => a + Math.abs(b), 0)));
      pat.forEach(p => put(49, r(p)));
    });
    put(0, 'ENDTAB');
    put(0, 'TABLE', 2, 'LAYER', 70, layers.size);
    layers.forEach(name => {
      const L = TLT.LAYERS[name] || { aci: 7 };
      put(0, 'LAYER', 2, name, 70, 0, 62, L.aci || 7, 6, 'CONTINUOUS');
    });
    put(0, 'ENDTAB');
    put(0, 'TABLE', 2, 'STYLE', 70, 1, 0, 'STYLE', 2, 'STANDARD', 70, 0, 40, 0, 41, 0.9, 50, 0, 71, 0, 42, 2.5, 3, 'txt', 4, '', 0, 'ENDTAB');
    put(0, 'ENDSEC');
    put(0, 'SECTION', 2, 'BLOCKS', 0, 'ENDSEC');
    const all = H.concat(['0', 'SECTION', '2', 'ENTITIES'], E, ['0', 'ENDSEC', '0', 'EOF']);
    const txt = all.join('\r\n') + '\r\n';
    const bytes = new Uint8Array(txt.length);
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      bytes[i] = WIN[ch] != null ? WIN[ch] : txt.charCodeAt(i) & 0xff;
    }
    return bytes;
  };
})();
