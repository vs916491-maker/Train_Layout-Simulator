/* Train Layout Tool — SVG renderer (preview) + shared paper-space iterator */
(function () {
  'use strict';
  const TLT = (globalThis.TLT = globalThis.TLT || {});

  /* Calls cb(e, toPaper) for every entity; toPaper maps model coordinates to paper mm. */
  TLT.eachEntity = function (sheet, cb) {
    sheet.views.forEach(v => {
      const P = { s: v.s, x: x => v.ox + x / v.s, y: y => v.oy + y / v.s, d: d => d / v.s };
      v.ents.forEach(e => cb(e, P, v));
    });
    const I = { s: 1, x: x => x, y: y => y, d: d => d };
    sheet.paper.ents.forEach(e => cb(e, I, sheet.paper));
  };

  TLT.style = function (e) {
    const L = TLT.LAYERS[e.ly] || TLT.LAYERS.TEXT;
    let fill = null;
    if (e.fill === true) fill = L.fill || null;
    else if (typeof e.fill === 'string') fill = e.fill;
    return {
      stroke: e.color || L.color || '#000',
      lw: e.lw != null ? e.lw : L.lw != null ? L.lw : 0.18,
      dash: e.dash || L.dash || null,
      fill,
      layer: L,
    };
  };

  /* Baseline point of a text entity in paper coordinates (y up), after valign and anchor. */
  TLT.textPlacement = function (e, P) {
    const h = P.d(e.h);
    const rot = (e.rot || 0) * Math.PI / 180;
    let x = P.x(e.x), y = P.y(e.y);
    if (e.valign === 'middle') { x += 0.35 * h * Math.sin(rot); y -= 0.35 * h * Math.cos(rot); }
    else if (e.valign === 'top') { x += 0.72 * h * Math.sin(rot); y -= 0.72 * h * Math.cos(rot); }
    const w = TLT.textWidth(e.s, h, e.bold);
    const k = e.anchor === 'middle' ? 0.5 : e.anchor === 'end' ? 1 : 0;
    return { x, y, h, rot: e.rot || 0, w, xs: x - k * w * Math.cos(rot), ys: y - k * w * Math.sin(rot) };
  };

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n = v => (Math.round(v * 1000) / 1000).toString();

  TLT.renderSVG = function (sheet) {
    const [W, H] = sheet.size;
    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" font-family="Helvetica, Arial, sans-serif">`);
    out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);
    TLT.eachEntity(sheet, (e, P) => {
      const st = TLT.style(e);
      const strokeAttr = st.lw > 0 ? ` stroke="${st.stroke}" stroke-width="${n(Math.max(st.lw, 0.08))}"${st.dash ? ` stroke-dasharray="${st.dash.join(' ')}"` : ''}` : ' stroke="none"';
      const fillAttr = ` fill="${st.fill || 'none'}"`;
      const Y = y => H - P.y(y);
      switch (e.t) {
        case 'L':
          out.push(`<line x1="${n(P.x(e.x1))}" y1="${n(Y(e.y1))}" x2="${n(P.x(e.x2))}" y2="${n(Y(e.y2))}"${strokeAttr} stroke-linecap="round"/>`);
          break;
        case 'R':
          out.push(`<rect x="${n(P.x(e.x0))}" y="${n(Y(e.y1))}" width="${n(P.d(e.x1 - e.x0))}" height="${n(P.d(e.y1 - e.y0))}"${fillAttr}${strokeAttr}/>`);
          break;
        case 'H':
          out.push(`<rect x="${n(P.x(e.x0))}" y="${n(Y(e.y1))}" width="${n(P.d(e.x1 - e.x0))}" height="${n(P.d(e.y1 - e.y0))}" fill="${st.layer.fill || '#ffffcc'}" stroke="none"/>`);
          break;
        case 'P':
          out.push(`<${e.closed ? 'polygon' : 'polyline'} points="${e.pts.map(p => n(P.x(p[0])) + ',' + n(Y(p[1]))).join(' ')}"${e.closed ? fillAttr : ' fill="none"'}${strokeAttr} stroke-linejoin="round"/>`);
          break;
        case 'C':
          out.push(`<circle cx="${n(P.x(e.cx))}" cy="${n(Y(e.cy))}" r="${n(P.d(e.r))}"${fillAttr}${strokeAttr}/>`);
          break;
        case 'T': {
          const tp = TLT.textPlacement(e, P);
          const anchor = e.anchor === 'middle' ? 'middle' : e.anchor === 'end' ? 'end' : 'start';
          const rot = tp.rot ? ` transform="rotate(${-tp.rot} ${n(tp.x)} ${n(H - tp.y)})"` : '';
          out.push(`<text x="${n(tp.x)}" y="${n(H - tp.y)}" font-size="${n(tp.h)}" text-anchor="${anchor}" fill="${e.color || st.layer.color || '#111'}"${e.bold ? ' font-weight="bold"' : ''}${rot}>${esc(e.s)}</text>`);
          break;
        }
      }
    });
    out.push('</svg>');
    return out.join('\n');
  };
})();
