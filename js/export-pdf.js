/* Train Layout Tool — vector PDF writer (no external libraries).
 * One page per sheet, Helvetica base fonts with WinAnsi encoding.
 */
(function () {
  'use strict';
  const TLT = (globalThis.TLT = globalThis.TLT || {});
  const PT = 72 / 25.4;
  const f = v => (Math.round(v * PT * 1000) / 1000).toString();
  const g = v => (Math.round(v * 1000) / 1000).toString();

  const WIN = { '–': 0x96, '—': 0x97, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '€': 0x80 };
  function pdfString(s) {
    let out = '';
    for (const ch of String(s).replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/Δ/g, 'd').replace(/[^\u0000-ÿ–—…‘’“”•€]/g, '?')) {
      let c = WIN[ch] != null ? WIN[ch] : ch.charCodeAt(0);
      const o = String.fromCharCode(c);
      if (o === '(' || o === ')' || o === '\\') out += '\\' + o;
      else if (c < 32) out += ' ';
      else out += o;
    }
    return '(' + out + ')';
  }
  function rgb(hex) {
    const h = String(hex || '#000').replace('#', '');
    const v = h.length === 3 ? h.split('').map(x => x + x).join('') : h.padEnd(6, '0');
    return [0, 2, 4].map(i => g(parseInt(v.substr(i, 2), 16) / 255)).join(' ');
  }

  function pageContent(sheet) {
    const c = [];
    let cur = { s: null, f: null, lw: null, d: null };
    const setStroke = (st) => {
      if (cur.s !== st.stroke) { c.push(rgb(st.stroke) + ' RG'); cur.s = st.stroke; }
      const lw = Math.max(st.lw, 0.08);
      if (cur.lw !== lw) { c.push(f(lw) + ' w'); cur.lw = lw; }
      const d = st.dash ? '[' + st.dash.map(f).join(' ') + '] 0 d' : '[] 0 d';
      if (cur.d !== d) { c.push(d); cur.d = d; }
    };
    const setFill = (col) => { if (cur.f !== col) { c.push(rgb(col) + ' rg'); cur.f = col; } };
    c.push('1 J 1 j');
    TLT.eachEntity(sheet, (e, P) => {
      const st = TLT.style(e);
      const paint = (hasFill) => {
        const stroke = st.lw > 0;
        if (hasFill && stroke) return 'B';
        if (hasFill) return 'f';
        return 'S';
      };
      switch (e.t) {
        case 'L':
          setStroke(st);
          c.push(`${f(P.x(e.x1))} ${f(P.y(e.y1))} m ${f(P.x(e.x2))} ${f(P.y(e.y2))} l S`);
          break;
        case 'R':
        case 'H': {
          const fill = e.t === 'H' ? (st.layer.fill || '#ffffcc') : st.fill;
          if (fill) setFill(fill);
          if (e.t === 'R' && st.lw > 0) setStroke(st);
          const op = e.t === 'H' ? 'f' : paint(!!fill);
          c.push(`${f(P.x(e.x0))} ${f(P.y(e.y0))} ${f(P.d(e.x1 - e.x0))} ${f(P.d(e.y1 - e.y0))} re ${op}`);
          break;
        }
        case 'P': {
          const fill = e.closed ? st.fill : null;
          if (fill) setFill(fill);
          setStroke(st);
          const pts = e.pts.map((p, i) => `${f(P.x(p[0]))} ${f(P.y(p[1]))} ${i ? 'l' : 'm'}`).join(' ');
          c.push(pts + (e.closed ? ' h ' : ' ') + (fill ? 'B' : 'S'));
          break;
        }
        case 'C': {
          const fill = st.fill;
          if (fill) setFill(fill);
          setStroke(st);
          const x = P.x(e.cx), y = P.y(e.cy), r = P.d(e.r), k = 0.5523 * r;
          c.push(`${f(x + r)} ${f(y)} m ${f(x + r)} ${f(y + k)} ${f(x + k)} ${f(y + r)} ${f(x)} ${f(y + r)} c ${f(x - k)} ${f(y + r)} ${f(x - r)} ${f(y + k)} ${f(x - r)} ${f(y)} c ${f(x - r)} ${f(y - k)} ${f(x - k)} ${f(y - r)} ${f(x)} ${f(y - r)} c ${f(x + k)} ${f(y - r)} ${f(x + r)} ${f(y - k)} ${f(x + r)} ${f(y)} c ${fill ? 'B' : 'S'}`);
          break;
        }
        case 'T': {
          const tp = TLT.textPlacement(e, P);
          setFill(e.color || st.layer.color || '#111111');
          const a = tp.rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
          c.push(`BT /${e.bold ? 'F2' : 'F1'} ${f(tp.h)} Tf ${g(ca)} ${g(sa)} ${g(-sa)} ${g(ca)} ${f(tp.xs)} ${f(tp.ys)} Tm ${pdfString(e.s)} Tj ET`);
          break;
        }
      }
    });
    return c.join('\n');
  }

  TLT.exportPDF = function (sheets, meta) {
    meta = meta || {};
    const objs = [];
    const add = s => { objs.push(s); return objs.length; };
    const catalog = add(null), pagesId = add(null);
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = [];
    sheets.forEach(sh => {
      const content = pageContent(sh);
      const cid = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      const [W, H] = sh.size;
      kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f(W)} ${f(H)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${cid} 0 R >>`));
    });
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
    const info = add(`<< /Title ${pdfString(meta.title || 'Train layout')} /Creator (Train Layout Tool) /Producer (Train Layout Tool) >>`);
    let out = '%PDF-1.4\n%âãÏÓ\n';
    const offs = [];
    objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  };
})();
