/* Train Layout Tool — drawing builder
 * Turns the engine result into sheets made of simple vector entities.
 * Each sheet has one scale. View entities are in model millimetres; paper entities in paper millimetres.
 * Entity types: L line, R rect, P polyline, C circle, T text, H hatch (standing-area region).
 */
(function () {
  'use strict';
  const TLT = (globalThis.TLT = globalThis.TLT || {});
  const num = TLT.num;

  /* ---------- Layers (shared by SVG, PDF and DXF) ---------- */
  TLT.LAYERS = {
    FRAME: { color: '#000000', lw: 0.5, aci: 7 },
    TITLE: { color: '#000000', lw: 0.25, aci: 7 },
    BODY: { color: '#1d2b3a', lw: 0.35, aci: 7 },
    BODY_THIN: { color: '#3c4b5a', lw: 0.18, aci: 8 },
    DOOR: { color: '#8e24aa', lw: 0.3, aci: 6 },
    WINDOW: { color: '#1e5bd8', lw: 0.2, aci: 5 },
    BOGIE: { color: '#b3261e', lw: 0.25, aci: 1 },
    EQUIP: { color: '#0b6e8a', lw: 0.25, aci: 4, fill: '#e3f2f6' },
    ROOF: { color: '#9a5b12', lw: 0.25, aci: 30, fill: '#f6ead9' },
    SEAT: { color: '#0f7a63', lw: 0.2, aci: 3, fill: '#d5efe7' },
    FOOT: { color: '#0f7a63', lw: 0.13, aci: 3, dash: [1.2, 0.8] },
    STAND: { color: '#d6b300', lw: 0.1, aci: 2, fill: '#fbf0b4' },
    WC: { color: '#1565c0', lw: 0.25, aci: 5, fill: '#dce9fb' },
    WC_DASH: { color: '#1565c0', lw: 0.15, aci: 5, dash: [1.5, 1] },
    CABINET: { color: '#4a4a4a', lw: 0.25, aci: 8, fill: '#e2e2e2' },
    CAB: { color: '#4a4a4a', lw: 0.25, aci: 8 },
    CENTER: { color: '#8a8a8a', lw: 0.13, aci: 8, dash: [5, 1, 0.8, 1] },
    RAIL: { color: '#555555', lw: 0.35, aci: 8 },
    DIM: { color: '#222222', lw: 0.13, aci: 7 },
    TEXT: { color: '#111111', lw: 0.18, aci: 7 },
    NOTE: { color: '#b3261e', lw: 0.18, aci: 1 },
    TABLE: { color: '#333333', lw: 0.18, aci: 7, fill: '#eef1f4' },
    TABLE_HEAD: { color: '#333333', lw: 0.18, aci: 7, fill: '#dde4ea' },
  };

  /* ---------- Helvetica metrics (AFM widths, 1/1000 em) for text placement ---------- */
  const HW = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  TLT.textWidth = function (s, h, bold) {
    let w = 0;
    for (const ch of String(s)) {
      const c = ch.charCodeAt(0);
      w += c >= 32 && c <= 126 ? HW[c - 32] : 600;
    }
    return (w / 1000) * h * (bold ? 1.07 : 1);
  };

  TLT.PAPER = { A3: [420, 297], A2: [594, 420], A1: [841, 594] };
  const SCALES = [1, 2, 5, 10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 600, 750, 800, 1000, 1250, 1500, 2000, 2500];
  const pickScale = need => SCALES.find(s => s >= need) || Math.ceil(need);

  /* ---------- View ---------- */
  class View {
    constructor(scale, ox, oy) { this.s = scale; this.ox = ox; this.oy = oy; this.ents = []; this.tf = null; }
    setTf(tx, flip, L, yflip, ty) { this.tf = { tx, flip, L, yflip: !!yflip, ty: ty || 0 }; }
    clearTf() { this.tf = null; }
    X(x) { const t = this.tf; return t ? t.tx + (t.flip ? t.L - x : x) : x; }
    Y(y) { const t = this.tf; return t ? t.ty + (t.yflip && t.flip ? -y : y) : y; }
    add(e) { this.ents.push(e); return e; }
    line(x1, y1, x2, y2, ly, o) { return this.add(Object.assign({ t: 'L', x1: this.X(x1), y1: this.Y(y1), x2: this.X(x2), y2: this.Y(y2), ly }, o)); }
    _box(t, x0, y0, x1, y1, ly, o) {
      const a = this.X(x0), b = this.X(x1), c = this.Y(y0), d = this.Y(y1);
      return this.add(Object.assign({ t, x0: Math.min(a, b), x1: Math.max(a, b), y0: Math.min(c, d), y1: Math.max(c, d), ly }, o));
    }
    rect(x0, y0, x1, y1, ly, o) { return this._box('R', x0, y0, x1, y1, ly, o); }
    hatch(x0, y0, x1, y1, ly, o) { return this._box('H', x0, y0, x1, y1, ly, Object.assign({ sp: 2.5 * this.s }, o)); }
    poly(pts, closed, ly, o) { return this.add(Object.assign({ t: 'P', pts: pts.map(p => [this.X(p[0]), this.Y(p[1])]), closed: !!closed, ly }, o)); }
    circle(cx, cy, r, ly, o) { return this.add(Object.assign({ t: 'C', cx: this.X(cx), cy: this.Y(cy), r, ly }, o)); }
    text(x, y, s, hp, o) {
      o = o || {};
      let anchor = o.anchor || 'start';
      if (this.tf && this.tf.flip && o.keepAnchor !== true) anchor = anchor === 'start' ? 'end' : anchor === 'end' ? 'start' : anchor;
      return this.add({ t: 'T', x: this.X(x), y: this.Y(y), s: String(s), h: hp * this.s, anchor, valign: o.valign || 'base', rot: o.rot || 0, bold: !!o.bold, ly: o.ly || 'TEXT', color: o.color });
    }
    tw(s, hp, bold) { return TLT.textWidth(s, hp, bold) * this.s; }

    /* Horizontal chain dimension. xs absolute; yFeat number or array (feature y for each x). */
    dimChainH(xs, yFeat, yDim, o) {
      o = o || {};
      const s = this.s, th = o.h || 1.8;
      const pts = [];
      xs.forEach((x, i) => pts.push({ x, yf: Array.isArray(yFeat) ? yFeat[i] : yFeat }));
      pts.sort((a, b) => a.x - b.x);
      const P = pts.filter((p, i) => i === 0 || p.x - pts[i - 1].x > 0.5);
      if (P.length < 2) return;
      P.forEach(p => {
        const dir = Math.sign(yDim - p.yf) || 1;
        if (Math.abs(yDim - p.yf) > 1.5 * s) this.add({ t: 'L', x1: p.x, y1: p.yf + dir * 0.8 * s, x2: p.x, y2: yDim + dir * 1.2 * s, ly: 'DIM' });
        this.add({ t: 'L', x1: p.x - 0.7 * s, y1: yDim - 0.7 * s, x2: p.x + 0.7 * s, y2: yDim + 0.7 * s, ly: 'DIM', lw: 0.3 });
      });
      this.add({ t: 'L', x1: P[0].x, y1: yDim, x2: P[P.length - 1].x, y2: yDim, ly: 'DIM' });
      let lift = false;
      for (let i = 0; i < P.length - 1; i++) {
        const seg = P[i + 1].x - P[i].x;
        const label = o.labels && o.labels[i] != null ? o.labels[i] : String(Math.round(seg));
        const w = this.tw(label, th);
        let ty = yDim + 0.6 * s;
        if (w > seg - 0.4 * s) { if (lift) ty += (th + 0.4) * s; lift = !lift; } else lift = false;
        this.add({ t: 'T', x: (P[i].x + P[i + 1].x) / 2, y: ty, s: label, h: th * s, anchor: 'middle', valign: 'base', rot: 0, ly: 'DIM' });
      }
    }
    /* Vertical dimension between y0 and y1 at x = xDim; features at xFeat. Text on the left of the line. */
    dimV(xFeat, y0, y1, xDim, o) {
      o = o || {};
      const s = this.s, th = o.h || 1.8;
      [y0, y1].forEach(y => {
        const dir = Math.sign(xDim - xFeat) || 1;
        if (Math.abs(xDim - xFeat) > 1.5 * s) this.add({ t: 'L', x1: xFeat + dir * 0.8 * s, y1: y, x2: xDim + dir * 1.2 * s, y2: y, ly: 'DIM' });
        this.add({ t: 'L', x1: xDim - 0.7 * s, y1: y - 0.7 * s, x2: xDim + 0.7 * s, y2: y + 0.7 * s, ly: 'DIM', lw: 0.3 });
      });
      this.add({ t: 'L', x1: xDim, y1: y0, x2: xDim, y2: y1, ly: 'DIM' });
      const label = o.label != null ? o.label : String(Math.round(Math.abs(y1 - y0)));
      const left = o.side !== 'right';
      this.add({ t: 'T', x: xDim + (left ? -0.6 : 0.6 + th * 0.75) * s, y: (y0 + y1) / 2, s: label, h: th * s, anchor: 'middle', valign: 'base', rot: 90, ly: 'DIM' });
    }
  }
  TLT.View = View;

  /* ---------- Car side elevation (local coordinates, View transform set by caller) ---------- */
  function drawCarSide(v, lay, cfg, o) {
    const c = cfg.common;
    const fh = num(c.floorHeight, 1130), rh = num(c.roofHeight, 3650);
    const sole = fh - 250;
    const D = num(c.wheelDia, 860), wb = num(c.wheelbase, 2100);
    const dh = num(c.doorHeight, 1850), dw = lay.dw;
    const { bodyF, bodyR, Lc, type } = lay;
    const detail = !!o.detail;

    // Body outline
    let body;
    if (type.cab) {
      body = [[bodyF, sole], [bodyR, sole], [bodyR, rh - 100], [bodyR - 120, rh], [bodyF + 1150, rh], [bodyF + 820, rh - 140],
        [bodyF + 380, fh + 1600], [bodyF + 120, fh + 900], [bodyF, fh + 650]];
    } else {
      body = [[bodyF, sole], [bodyR, sole], [bodyR, rh - 100], [bodyR - 120, rh], [bodyF + 120, rh], [bodyF, rh - 100]];
    }
    v.poly(body, true, 'BODY', { fill: '#f7f8fa' });
    v.line(type.cab ? bodyF + 900 : bodyF, rh - 280, bodyR, rh - 280, 'BODY_THIN');
    v.line(bodyF + (type.cab ? 80 : 0), sole + 120, bodyR, sole + 120, 'BODY_THIN');
    if (type.cab) {
      v.poly([[bodyF + 380, fh + 1600], [bodyF + 820, rh - 140]], false, 'WINDOW', { lw: 0.5 });
      v.circle(bodyF + 90, fh + 450, 55, 'BODY_THIN');
      const cx = bodyF + Math.max(700, lay.cabLen * 0.6);
      const cw = num(c.cabDoorWidth, 600);
      v.rect(cx - cw / 2, fh, cx + cw / 2, fh + dh, 'DOOR');
      v.rect(cx - cw / 2 + 90, fh + 1000, cx + cw / 2 - 90, fh + 1650, 'WINDOW');
    }
    // Doors
    lay.doors.forEach(d => {
      v.rect(d - dw / 2, fh, d + dw / 2, fh + dh, 'DOOR');
      v.line(d, fh, d, fh + dh, 'DOOR');
      if (detail) {
        v.rect(d - dw / 2 + 110, fh + 950, d - 110, fh + 1700, 'WINDOW');
        v.rect(d + 110, fh + 950, d + dw / 2 - 110, fh + 1700, 'WINDOW');
      }
    });
    // Windows (one per bay)
    lay.bays.forEach(b => {
      const L = b.x1 - b.x0;
      if (L < 1000) return;
      const w = Math.min(L - 500, 2600);
      const m = (b.x0 + b.x1) / 2;
      v.rect(m - w / 2, fh + 820, m + w / 2, fh + 1700, 'WINDOW', { fill: '#e8f0fd' });
    });
    // Couplers
    const cy = fh - 420;
    if (type.cab) {
      v.rect(0, cy - 120, 160, cy + 120, 'BODY');
      v.rect(160, cy - 50, bodyF + 300, cy + 50, 'BODY_THIN');
    } else {
      v.rect(0, cy - 60, bodyF + 250, cy + 60, 'BODY_THIN');
    }
    v.rect(bodyR - 250, cy - 60, Lc, cy + 60, 'BODY_THIN');
    // Gangway bellows (non-cab ends)
    const gw = (x0, x1) => {
      v.rect(x0, fh - 120, x1, fh + 2150, 'BODY_THIN');
      if (detail) for (let x = Math.min(x0, x1) + 60; x < Math.max(x0, x1) - 20; x += 60) v.line(x, fh - 120, x, fh + 2150, 'BODY_THIN', { lw: 0.1 });
    };
    if (!type.cab && bodyF > 20) gw(0, bodyF);
    if (Lc - bodyR > 20) gw(bodyR, Lc);

    // Bogies
    lay.bogies.forEach((xb, bi) => {
      const motor = lay.motorBogies === 2 || (lay.motorBogies === 1 && bi === 1);
      v.rect(xb - wb / 2 - 420, D / 2 - 80, xb + wb / 2 + 420, D / 2 + 300, 'BOGIE', { fill: '#fbe9e7' });
      v.rect(xb - 350, D / 2 + 300, xb + 350, sole, 'BOGIE');
      [-1, 1].forEach(k => {
        v.circle(xb + k * wb / 2, D / 2, D / 2, 'BOGIE', { fill: '#ffffff' });
        v.circle(xb + k * wb / 2, D / 2, D * 0.12, 'BOGIE');
        if (motor) v.rect(xb + k * (wb / 2 - 520) - 260, D / 2 - 40, xb + k * (wb / 2 - 520) + 260, D / 2 + 260, 'BOGIE', { fill: '#f3c6c0' });
      });
      v.line(xb, -150, xb, sole + 250, 'CENTER');
      if (detail) v.text(xb, D / 2 + 110, motor ? 'M' : 'T', 2.2, { anchor: 'middle', valign: 'middle', bold: true, ly: 'BOGIE', color: '#b3261e' });
    });

    // Equipment
    lay.equipment.items.forEach(e => {
      const xc = lay.mid - e.x;
      const x0 = xc - e.length / 2, x1 = xc + e.length / 2;
      if (e.loc === 'under') {
        v.rect(x0, sole - e.height, x1, sole, 'EQUIP', { fill: true });
        labelIn(v, e.name, x0, x1, sole - e.height / 2, detail ? 1.8 : 1.3, 'EQUIP');
      } else if (e.kind === 'panto') {
        const top = rh + e.height, L = e.length;
        v.rect(x0, rh, x1, rh + 90, 'ROOF', { fill: true });
        v.poly([[xc - L * 0.38, rh + 90], [xc + L * 0.28, rh + e.height * 0.5], [xc - L * 0.3, top - 60]], false, 'ROOF');
        v.rect(xc - L * 0.48, top - 60, xc + L * 0.12, top, 'ROOF', { fill: true });
        if (detail) v.text(xc, top + 120, e.name, 1.6, { anchor: 'middle', ly: 'ROOF', color: '#9a5b12' });
      } else {
        v.poly([[x0, rh], [x1, rh], [x1, rh + e.height - 60], [x1 - 120, rh + e.height], [x0 + 120, rh + e.height], [x0, rh + e.height - 60]], true, 'ROOF', { fill: true });
        labelIn(v, e.name, x0, x1, rh + e.height / 2, detail ? 1.8 : 1.3, 'ROOF');
      }
    });
  }

  function labelIn(v, s, x0, x1, ym, hp, ly) {
    const w = v.tw(s, hp);
    if (w > Math.abs(x1 - x0) * 0.92) return;
    v.text((x0 + x1) / 2, ym, s, hp, { anchor: 'middle', valign: 'middle', ly, color: TLT.LAYERS[ly].color });
  }

  /* ---------- Car plan / interior layout ---------- */
  function drawCarPlan(v, lay, cfg, o) {
    const c = cfg.common, r = cfg.interior;
    const detail = !!o.detail;
    const { bodyF, bodyR, Lc, W, Wi, dw, type } = lay;
    const hw = W / 2, hi = Wi / 2;
    const gwW = num(c.gangwayWidth, 1100);
    const endWall = num(c.endWallThk, 150);

    // Standing area
    lay.standRects.forEach(q => v.hatch(q.x0, q.y0, q.x1, q.y1, 'STAND'));

    // Outer body
    if (type.cab) {
      v.poly([[bodyF + 650, hw], [bodyR, hw], [bodyR, -hw], [bodyF + 650, -hw], [bodyF + 200, -hw + 260], [bodyF, -hw + 750],
        [bodyF, hw - 750], [bodyF + 200, hw - 260]], true, 'BODY');
    } else {
      v.rect(bodyF, -hw, bodyR, hw, 'BODY');
    }
    // Inner wall lines broken at doors
    const xa = type.cab ? lay.salStart - 60 : bodyF + endWall, xb = bodyR - endWall;
    const gaps = lay.doors.map(d => [d - dw / 2, d + dw / 2]);
    [hi, -hi].forEach(y => {
      let cur = xa;
      gaps.forEach(([g0, g1]) => { if (g0 > cur) v.line(cur, y, g0, y, 'BODY_THIN'); cur = Math.max(cur, g1); });
      if (xb > cur) v.line(cur, y, xb, y, 'BODY_THIN');
    });
    // Doors: jambs and closed leaves
    lay.doors.forEach(d => {
      [1, -1].forEach(k => {
        v.line(d - dw / 2, k * hi, d - dw / 2, k * hw, 'DOOR');
        v.line(d + dw / 2, k * hi, d + dw / 2, k * hw, 'DOOR');
        v.rect(d - dw / 2, k * (hw - 35), d + dw / 2, k * (hw - 5), 'DOOR', { fill: '#efd9f4' });
        v.line(d, k * (hw - 40), d, k * hw, 'DOOR');
      });
    });
    // End walls with gangway opening
    const endWallAt = (xIn, xOut) => {
      [[hi, gwW / 2], [-gwW / 2, -hi]].forEach(([ya, yb]) => v.line(xIn, ya, xIn, yb, 'BODY_THIN'));
      v.line(xIn, gwW / 2, xOut, gwW / 2, 'BODY_THIN');
      v.line(xIn, -gwW / 2, xOut, -gwW / 2, 'BODY_THIN');
    };
    endWallAt(bodyR - endWall, bodyR);
    if (!type.cab) endWallAt(bodyF + endWall, bodyF);
    // Half gangways
    const bel = (x0, x1) => {
      v.rect(x0, -gwW / 2 - 140, x1, gwW / 2 + 140, 'BODY_THIN', { fill: '#f1f1f1' });
      if (detail) for (let x = Math.min(x0, x1) + 60; x < Math.max(x0, x1) - 20; x += 60) v.line(x, -gwW / 2 - 140, x, gwW / 2 + 140, 'BODY_THIN', { lw: 0.1 });
    };
    if (Lc - bodyR > 20) bel(bodyR, Lc);
    if (!type.cab && bodyF > 20) bel(0, bodyF);

    // Cab
    if (type.cab) {
      const xp = lay.salStart;
      v.line(xp - 60, hi, xp - 60, 380, 'CAB'); v.line(xp, hi, xp, 380, 'CAB');
      v.line(xp - 60, -380, xp - 60, -hi, 'CAB'); v.line(xp, -380, xp, -hi, 'CAB');
      v.line(xp - 60, 380, xp, 380, 'CAB'); v.line(xp - 60, -380, xp, -380, 'CAB');
      v.line(xp - 30, 380, xp - 30 - 700, 380 - 300, 'DOOR', { lw: 0.15 });
      const con0 = bodyF + 330, con1 = bodyF + Math.min(900, lay.cabLen * 0.42);
      v.rect(con0, 450, con1, hi - 120, 'CAB', { fill: '#ececec' });
      v.rect(con0, -hi + 120, con1, -450, 'CAB', { fill: '#ececec' });
      v.rect(bodyF - 10, -420, bodyF + 110, 420, 'DOOR', { fill: '#efd9f4' });
      const sx = bodyF + Math.min(lay.cabLen - 450, Math.max(1100, lay.cabLen * 0.62));
      v.circle(sx, -hi / 2 - 100, 230, 'CAB', { fill: '#ffffff' });
      v.circle(sx, hi / 2 + 100, 200, 'CAB', { fill: '#ffffff' });
      const cxd = bodyF + Math.max(700, lay.cabLen * 0.6), cw = num(c.cabDoorWidth, 600);
      [1, -1].forEach(k => {
        v.line(cxd - cw / 2, k * hi, cxd - cw / 2, k * hw, 'DOOR');
        v.line(cxd + cw / 2, k * hi, cxd + cw / 2, k * hw, 'DOOR');
        v.rect(cxd - cw / 2, k * (hw - 35), cxd + cw / 2, k * (hw - 5), 'DOOR', { fill: '#efd9f4' });
      });
      v.line(bodyF + 650, hi, cxd - cw / 2, hi, 'BODY_THIN'); v.line(cxd + cw / 2, hi, xp - 60, hi, 'BODY_THIN');
      v.line(bodyF + 650, -hi, cxd - cw / 2, -hi, 'BODY_THIN'); v.line(cxd + cw / 2, -hi, xp - 60, -hi, 'BODY_THIN');
      if (detail) v.text(bodyF + lay.cabLen * 0.55, 0, 'CAB', 2.2, { anchor: 'middle', valign: 'middle', ly: 'CAB', color: '#4a4a4a', bold: true });
    }

    // Seats
    const sy = (side, d) => (side === 'A' ? [hi - d, hi] : [-hi, -hi + d]);
    lay.seatBlocks.forEach(b => {
      if (!b.trans) {
        const w = (b.x1 - b.x0) / b.n;
        const [y0, y1] = sy(b.side, b.depth);
        for (let k = 0; k < b.n; k++) v.rect(b.x0 + k * w, y0, b.x0 + (k + 1) * w, y1, 'SEAT', { fill: true });
        const back = b.side === 'A' ? hi - 90 : -hi + 90;
        if (detail) v.line(b.x0, back, b.x1, back, 'SEAT', { lw: 0.13 });
        const fy = b.side === 'A' ? hi - b.depth - b.foot : -hi + b.depth + b.foot;
        if (b.foot > 0) v.line(b.x0, fy, b.x1, fy, 'FOOT');
      } else {
        const sw = num(r.seatWidth, 430), td = num(r.transSeatDepth, 450);
        const per = Math.round(b.depth / sw);
        b.groups.forEach(g => {
          [[g.x0, g.x0 + td], [g.x1 - td, g.x1]].forEach(([a, z]) => {
            for (let j = 0; j < per; j++) {
              const y0 = b.side === 'A' ? hi - (j + 1) * sw : -hi + j * sw;
              v.rect(a, y0, z, y0 + sw, 'SEAT', { fill: true });
            }
          });
        });
      }
    });
    // Draft screens + stanchions
    const sd = num(r.seatDepth, 550) + 80;
    lay.screens.forEach(scr => {
      const k = scr.side === 'A' ? 1 : -1;
      v.line(scr.x, k * hi, scr.x, k * (hi - sd), 'BODY_THIN', { lw: 0.25 });
      if (detail) v.circle(scr.x, k * (hi - sd), 25, 'BODY_THIN');
    });
    // Wheelchair spaces
    lay.wheelchairs.forEach(w => {
      const [y0, y1] = sy(w.side, w.depth);
      v.rect(w.x0, y0, w.x1, y1, 'WC', { fill: true });
      if (detail) {
        const R = num(r.wcTurning, 1500) / 2;
        const ym = w.side === 'A' ? hi - R : -hi + R;
        v.circle((w.x0 + w.x1) / 2, ym, R, 'WC_DASH');
        v.text((w.x0 + w.x1) / 2, (y0 + y1) / 2, 'WHEELCHAIR', 1.6, { anchor: 'middle', valign: 'middle', ly: 'WC', color: '#1565c0' });
      }
    });
    // Cabinets
    lay.cabinets.forEach(cb => {
      const [y0, y1] = sy(cb.side, cb.depth);
      v.rect(cb.x0, y0, cb.x1, y1, 'CABINET', { fill: true });
      v.line(cb.x0, y0, cb.x1, y1, 'CABINET', { lw: 0.13 }); v.line(cb.x0, y1, cb.x1, y0, 'CABINET', { lw: 0.13 });
      if (detail) labelIn(v, cb.label, cb.x0, cb.x1, (y0 + y1) / 2, 1.5, 'CABINET');
    });
    // Centre line & bay labels
    v.line(-150, 0, Lc + 150, 0, 'CENTER');
    if (detail) lay.bays.forEach(b => {
      if (b.x1 - b.x0 < 250) return;
      v.text((b.x0 + b.x1) / 2, 120, 'B' + b.i, 1.6, { anchor: 'middle', valign: 'base', ly: 'TEXT', color: '#777777' });
    });
  }

  /* ---------- Paper helpers ---------- */
  function frame(p, W, H) {
    p.rect(10, 10, W - 10, H - 10, 'FRAME');
    p.rect(5, 5, W - 5, H - 5, 'FRAME', { lw: 0.2 });
  }

  function titleBlock(p, W, cfg, sheet) {
    const pr = cfg.project || {};
    const x1 = W - 10, x0 = x1 - 180, y0 = 10, y1 = 48;
    p.rect(x0, y0, x1, y1, 'TITLE', { fill: '#ffffff', lw: 0.4 });
    const rows = [y1, y1 - 8, y1 - 16, y1 - 24, y1 - 31, y0];
    rows.slice(1, -1).forEach(y => p.line(x0, y, x1, y, 'TITLE'));
    p.text(x0 + 3, y1 - 5.6, pr.company || '', 4, { bold: true });
    p.text(x1 - 3, y1 - 5.4, pr.status || '', 2.2, { anchor: 'end', ly: 'NOTE', color: '#b3261e', bold: true });
    p.text(x0 + 3, y1 - 13.3, trunc(pr.project || '', 2.3, 174), 2.3);
    p.text(x0 + 3, y1 - 21.4, trunc(sheet.title, 3, 174), 3, { bold: true });
    p.line(x0 + 70, y1 - 24, x0 + 70, y0, 'TITLE'); p.line(x0 + 120, y1 - 24, x0 + 120, y0, 'TITLE'); p.line(x0 + 150, y1 - 24, x0 + 150, y0, 'TITLE');
    const cell = (x, y, lab, val, w) => { p.text(x + 1.5, y - 2.4, lab, 1.5, { color: '#666666' }); p.text(x + 1.5, y - 5.9, trunc(val, 2.3, w - 3), 2.3, { bold: true }); };
    cell(x0, y1 - 24, 'DRAWING No.', pr.drawingNo || '', 70);
    cell(x0 + 70, y1 - 24, 'CLIENT', pr.client || '', 50);
    cell(x0 + 120, y1 - 24, 'REV', pr.revision || '', 30);
    cell(x0 + 150, y1 - 24, 'SHEET', `${sheet.no} of ${sheet.of}`, 30);
    cell(x0, y1 - 31, 'SCALE', sheet.scale ? `1:${sheet.scale}  (A${String(cfg.project.paper || 'A3').slice(1)})` : 'NTS', 70);
    cell(x0 + 70, y1 - 31, 'DATE', pr.date || '', 50);
    cell(x0 + 120, y1 - 31, 'DRAWN / CHECKED', `${pr.drawnBy || '—'} / ${pr.checkedBy || '—'}`, 60);
    p.line(x0 + 150, y1 - 31, x0 + 150, y0, 'TITLE', { lw: 0 });
    p.text(14, 12.2, 'All dimensions in mm unless noted. Generated by Train Layout Tool — indicative layout, verify before issue.', 1.6, { color: '#666666' });
  }

  function trunc(s, h, maxW) {
    s = String(s);
    if (TLT.textWidth(s, h) <= maxW) return s;
    while (s.length > 1 && TLT.textWidth(s + '…', h) > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  TLT.trunc = trunc;

  /* Table on paper. cols: [{h, w, align}] ; rows: arrays of strings ; returns bottom y */
  function table(p, x, yTop, cols, rows, o) {
    o = o || {};
    const rh = o.rowH || 5, th = o.h || 2.1;
    const W = cols.reduce((s, c) => s + c.w, 0);
    const all = [cols.map(c => c.h)].concat(rows);
    all.forEach((row, ri) => {
      const y1 = yTop - ri * rh, y0 = y1 - rh;
      const head = ri === 0;
      const bold = head || (o.boldRows && o.boldRows.includes(ri - 1));
      if (head) p.rect(x, y0, x + W, y1, 'TABLE_HEAD', { fill: true, lw: 0.1 });
      else if (o.shade && o.shade.includes(ri - 1)) p.rect(x, y0, x + W, y1, 'TABLE', { fill: true, lw: 0.1 });
      let cx = x;
      cols.forEach((c, ci) => {
        const val = row[ci] == null ? '' : String(row[ci]);
        const al = head ? 'middle' : c.align || 'start';
        const tx = al === 'start' ? cx + 1.2 : al === 'end' ? cx + c.w - 1.2 : cx + c.w / 2;
        const color = o.colorFn ? o.colorFn(ri - 1, ci, val) : undefined;
        p.text(tx, y0 + rh / 2, trunc(val, th, c.w - 2), th, { anchor: al, valign: 'middle', bold, color });
        cx += c.w;
      });
    });
    const yBot = yTop - all.length * rh;
    p.rect(x, yBot, x + W, yTop, 'TABLE', { lw: 0.3 });
    for (let i = 1; i < all.length; i++) p.line(x, yTop - i * rh, x + W, yTop - i * rh, 'TABLE', { lw: i === 1 ? 0.3 : 0.1 });
    let cx = x;
    cols.slice(0, -1).forEach(c => { cx += c.w; p.line(cx, yBot, cx, yTop, 'TABLE', { lw: 0.1 }); });
    return yBot;
  }
  TLT.table = table;

  const f1 = v => (Number.isFinite(v) ? v.toFixed(1) : '—');
  const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : '—');
  const i0 = v => (Number.isFinite(v) ? String(Math.round(v)) : '—');

  function equipSummary(lay, loc) {
    const m = new Map();
    lay.equipment.items.filter(e => e.loc === loc).forEach(e => {
      const k = e.name.replace(/\d+$/, '');
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].map(([k, n]) => (n > 1 ? `${k}×${n}` : k)).join(', ') || '—';
  }

  function legend(p, x, y, items) {
    items.forEach((it, i) => {
      const yy = y - i * 5;
      const L = TLT.LAYERS[it.ly];
      if (it.kind === 'fill') p.rect(x, yy - 1.6, x + 7, yy + 1.6, it.ly, { fill: true, lw: 0.1 });
      else if (it.kind === 'line') p.line(x, yy, x + 7, yy, it.ly);
      else p.rect(x, yy - 1.6, x + 7, yy + 1.6, it.ly, { fill: L.fill ? true : undefined });
      p.text(x + 9, yy, it.label, 2, { valign: 'middle' });
    });
    return y - items.length * 5;
  }

  /* ================= Sheets ================= */
  TLT.buildSheets = function (R) {
    const cfg = R.cfg;
    const paper = TLT.PAPER[cfg.project.paper] || TLT.PAPER.A3;
    const sheets = [];
    if (!R.form.cars.length) return sheets;
    sheets.push(trainSheet(R, paper));
    const drv = R.layouts.get(cfg.detail && cfg.detail.driving) || [...R.layouts.values()].find(l => l.type.cab && R.used.includes(l.type.name));
    const mid = R.layouts.get(cfg.detail && cfg.detail.intermediate) || [...R.layouts.values()].find(l => !l.type.cab && R.used.includes(l.type.name));
    if (drv) sheets.push(carSheet(R, paper, drv, 'DRIVING CAR'));
    if (mid && mid !== drv) sheets.push(carSheet(R, paper, mid, 'INTERMEDIATE CAR'));
    sheets.push(capacitySheet(R, paper));
    sheets.forEach((s, i) => { s.no = i + 1; s.of = sheets.length; });
    sheets.forEach(s => { frame(s.paper, s.size[0], s.size[1]); titleBlock(s.paper, s.size[0], cfg, s); });
    return sheets;
  };

  /* ---------- Sheet 1: train formation / vehicle layout ---------- */
  function trainSheet(R, size) {
    const cfg = R.cfg, c = cfg.common;
    const [PW, PH] = size;
    const L = R.form.length;
    const n = R.form.cars.length;
    const cars = R.form.cars;
    // Split into rows (1 or 2), preferring a unit boundary near the middle
    const wantRows = String(cfg.project.trainRows || '1') === '2' && n > 1 ? 2 : 1;
    let rows = [cars];
    if (wantRows === 2) {
      let best = 1, bestScore = Infinity;
      for (let k = 1; k < n; k++) {
        const left = cars[k].x0;
        const score = Math.abs(left - L / 2) + (cars[k].unit !== cars[k - 1].unit ? 0 : 0.12 * L);
        if (score < bestScore) { bestScore = score; best = k; }
      }
      rows = [cars.slice(0, best), cars.slice(best)];
    }
    const rowLen = r => r[r.length - 1].x0 + r[r.length - 1].type.couplerLength - r[0].x0;
    const maxRow = Math.max(...rows.map(rowLen));
    const scale = pickScale(maxRow / (PW - 50));
    const s = scale;
    const maxH = Math.max(num(c.maxHeight, 4100), num(c.roofHeight, 3650) + 450);
    const Wb = num(c.bodyWidth, 2950);
    const p = new View(1, 0, 0);
    p.text(20, PH - 19, `TRAIN FORMATION & VEHICLE LAYOUT — ${n}-CAR TRAIN`, 4.2, { bold: true });
    p.text(20, PH - 24.5, `Formation: ${cfg.formation.replace(/\s+/g, ' ')}     ( | = unit boundary )     Overall length ${Math.round(L)} mm over couplers`, 2.2, { color: '#444444' });
    const units = [];
    cars.forEach(car => { (units[car.unit] = units[car.unit] || []).push(car); });

    const views = [];
    let top = PH - 44;
    let yAfter = top;
    rows.forEach((row, ri) => {
      const x0row = row[0].x0;
      const ox = (PW - rowLen(row) / s) / 2;
      const oyRail = top - maxH / s;
      const v = new View(scale, ox, oyRail);
      views.push(v);
      const RL = rowLen(row);
      v.line(-1500, 0, RL + 1500, 0, 'RAIL');
      const planY = -(23 * s) - Wb / 2;
      row.forEach(car => {
        const lay = R.layouts.get(car.type.name);
        const cx = car.x0 - x0row;
        v.setTf(cx, car.flip, lay.Lc, false, 0);
        drawCarSide(v, lay, cfg, { detail: false });
        v.setTf(cx, car.flip, lay.Lc, true, planY);
        drawCarPlan(v, lay, cfg, { detail: false });
        v.clearTf();
      });
      const yLab = maxH + 4.2 * s;
      row.forEach(car => {
        const xm = car.x0 - x0row + car.type.couplerLength / 2;
        const w = v.tw(car.label, 2.6, true) + 3 * s;
        v.rect(xm - w / 2, yLab - 1.6 * s, xm + w / 2, yLab + 2.6 * s, 'TEXT', { lw: 0.25, color: '#1e5bd8' });
        v.text(xm, yLab + 0.5 * s, car.label, 2.6, { anchor: 'middle', valign: 'middle', bold: true, color: '#1e5bd8' });
        v.text(xm, planY - Wb / 2 - 3.6 * s, `CAR ${car.no}`, 1.8, { anchor: 'middle', color: '#444444' });
      });
      if (units.length > 1) units.forEach((u, ui) => {
        const inRow = u.filter(cc => row.includes(cc));
        if (!inRow.length) return;
        const a = inRow[0].x0 - x0row + 300, b = inRow[inRow.length - 1].x0 - x0row + inRow[inRow.length - 1].type.couplerLength - 300;
        const y = yLab + 5 * s;
        v.line(a, y, b, y, 'TEXT', { lw: 0.2 }); v.line(a, y, a, y - 1.2 * s, 'TEXT', { lw: 0.2 }); v.line(b, y, b, y - 1.2 * s, 'TEXT', { lw: 0.2 });
        v.text((a + b) / 2, y + 0.8 * s, `UNIT ${ui + 1}${inRow.length < u.length ? ' (cont.)' : ''}`, 1.8, { anchor: 'middle', color: '#444444' });
      });
      // Dimensions — side view
      const xsB = [], xsC = [], xsD = [];
      row.forEach(car => {
        const lay = R.layouts.get(car.type.name);
        const cx = car.x0 - x0row;
        xsB.push(cx, cx + (car.flip ? lay.Lc - lay.bogies[1] : lay.bogies[0]), cx + (car.flip ? lay.Lc - lay.bogies[0] : lay.bogies[1]), cx + lay.Lc);
        xsC.push(cx, cx + lay.Lc);
        xsD.push(cx, cx + lay.Lc);
        lay.doors.forEach(d => xsD.push(cx + (car.flip ? lay.Lc - d : d)));
      });
      v.dimChainH(xsB, 0, -4.5 * s, { h: 1.7 });
      v.dimChainH(xsC, 0, -9 * s, { h: 1.8 });
      const label = rows.length > 1 ? [`${Math.round(RL)}  (cars ${row[0].no}–${row[row.length - 1].no}; train ${Math.round(L)})`] : null;
      v.dimChainH([0, RL], 0, -13.5 * s, { h: 2.1, labels: label });
      const planTop = planY + Wb / 2;
      v.dimChainH(xsD, planTop, planTop + 4 * s, { h: 1.5 });
      yAfter = oyRail + (planY - Wb / 2) / s - 6;
      top = yAfter - 15;
    });
    // Formation table
    const yTab = yAfter - 4;
    const awCase = (cfg.cases || []).find(q => q.kind === 'density');
    const key = awCase ? String(awCase.name).toLowerCase() : null;
    const cols = [
      { h: 'Car', w: 10, align: 'middle' }, { h: 'Type', w: 13, align: 'middle' }, { h: 'Unit', w: 10, align: 'middle' },
      { h: 'Description', w: 44 }, { h: 'L couplers', w: 20, align: 'end' }, { h: 'L body', w: 18, align: 'end' },
      { h: 'Bogie ctrs', w: 18, align: 'end' }, { h: 'Bogies', w: 16, align: 'middle' }, { h: 'Tare (t)', w: 16, align: 'end' },
      { h: 'Seats', w: 13, align: 'end' }, { h: key ? `Total ${awCase.name}` : 'Standing', w: 22, align: 'end' },
      { h: 'Roof equipment', w: 54 }, { h: 'Underframe equipment', w: PW - 40 - 254 },
    ];
    const tRows = R.form.cars.map(car => {
      const lay = R.layouts.get(car.type.name);
      const t = car.type;
      const bog = lay.motorBogies === 2 ? 'M + M' : lay.motorBogies === 1 ? 'T + M' : 'T + T';
      return [car.no, car.label, car.unit + 1, (t.desc || '') + (car.flip ? ' (reversed)' : ''), i0(lay.Lc), i0(lay.Lb), i0(lay.bc), bog, f1(num(t.tare, NaN)), lay.seats,
        key ? lay.capacity[key].total : '—', equipSummary(lay, 'roof'), equipSummary(lay, 'under')];
    });
    const tot = R.totals.find(t => key && t.name.toLowerCase() === key);
    tRows.push(['', '', '', 'TRAIN TOTAL', i0(R.form.length), '', '', `${R.form.cars.reduce((a, c) => a + R.layouts.get(c.type.name).motorBogies, 0)} motor`,
      f1(R.form.cars.reduce((a, c) => a + num(c.type.tare, 0), 0)), R.form.cars.reduce((a, c) => a + R.layouts.get(c.type.name).seats, 0),
      tot ? tot.total : '—', '', '']);
    const yB = table(p, 20, yTab, cols, tRows, { rowH: 5, h: 2, boldRows: [tRows.length - 1], shade: [tRows.length - 1] });

    // Legend + notes
    let yy = yB - 7;
    p.text(20, yy, 'LEGEND', 2.4, { bold: true });
    legend(p, 20, yy - 5, [
      { ly: 'DOOR', label: 'Passenger door / cab door', kind: 'box' },
      { ly: 'SEAT', label: 'Seats', kind: 'box' },
      { ly: 'STAND', label: 'Standing area', kind: 'fill' },
      { ly: 'WC', label: 'Wheelchair space', kind: 'box' },
    ]);
    legend(p, 85, yy - 5, [
      { ly: 'EQUIP', label: 'Underframe equipment', kind: 'box' },
      { ly: 'ROOF', label: 'Roof equipment / pantograph', kind: 'box' },
      { ly: 'BOGIE', label: 'Bogie (darker blocks = motored)', kind: 'box' },
      { ly: 'CENTER', label: 'Centre line', kind: 'line' },
    ]);
    const notes = [
      'NOTES',
      `1. Car lengths are over coupler faces. Bogie centres ${[...new Set(R.used.map(n => R.layouts.get(n).bc))].join(' / ')} mm; wheel Ø${num(c.wheelDia, 860)} new.`,
      `2. Floor ${num(c.floorHeight, 1130)} mm, roof ${num(c.roofHeight, 3650)} mm, max. height ${num(c.maxHeight, 4100)} mm above top of rail.`,
      `3. Equipment positions are indicative and taken from the tool inputs.`,
      `4. Passenger capacity: see the capacity sheet. "${key ? awCase.name : ''}" total shown above.`,
    ];
    notes.forEach((t, i) => p.text(165, yy - i * 4.6, t, i ? 2 : 2.4, { bold: i === 0 }));
    return { title: `Train formation & vehicle layout (${n} cars)`, short: 'Train layout', size, scale, views, paper: p };
  }

  /* ---------- Car detail sheet ---------- */
  function carSheet(R, size, lay, kindLabel) {
    const cfg = R.cfg, c = cfg.common;
    const [PW, PH] = size;
    const scale = pickScale((lay.Lc + 2500) / (PW - 60));
    const s = scale;
    const maxH = Math.max(num(c.maxHeight, 4100), num(c.roofHeight, 3650) + 450);
    const ox = 25 + ((PW - 60) - lay.Lc / s) / 2;
    const oy = PH - 42 - maxH / s;
    const v = new View(scale, ox, oy);
    const p = new View(1, 0, 0);
    const t = lay.type;
    p.text(20, PH - 19, `${kindLabel} — ${t.name.toUpperCase()} CAR: SIDE ELEVATION & INTERIOR SEAT LAYOUT`, 4.2, { bold: true });
    p.text(20, PH - 24.5, `${t.desc || ''}  ·  ${lay.seats} seats  ·  standing area ${lay.areas.standing.toFixed(2)} m²  ·  wheelchair spaces ${lay.wheelchairs.length}`, 2.2, { color: '#444444' });

    // Side elevation
    v.line(-1200, 0, lay.Lc + 1200, 0, 'RAIL');
    v.setTf(0, false, lay.Lc, false, 0);
    drawCarSide(v, lay, cfg, { detail: true });
    v.clearTf();
    v.text(-9 * s, num(c.floorHeight, 1130) + 1400, 'END 1', 2.2, { anchor: 'end', bold: true });
    v.text(lay.Lc + 19 * s, num(c.floorHeight, 1130) + 1400, 'END 2', 2.2, { anchor: 'start', bold: true });
    const fh = num(c.floorHeight, 1130), rh = num(c.roofHeight, 3650), mh = num(c.maxHeight, 4100);
    // body length above roof
    v.dimChainH([lay.bodyF, lay.bodyR], rh, maxH + 4 * s, { h: 2 });
    // below rail
    const wb = num(c.wheelbase, 2100);
    v.dimChainH([lay.bogies[0] - wb / 2, lay.bogies[0] + wb / 2], 0, -4.5 * s, { h: 1.8 });
    v.dimChainH([lay.bogies[1] - wb / 2, lay.bogies[1] + wb / 2], 0, -4.5 * s, { h: 1.8 });
    v.dimChainH([0, lay.bogies[0], lay.bogies[1], lay.Lc], 0, -9.5 * s, { h: 2 });
    v.dimChainH([0, lay.Lc], 0, -14.5 * s, { h: 2.2 });
    // heights at end 2
    v.dimV(lay.Lc, 0, fh, lay.Lc + 6 * s, { h: 1.8 });
    v.dimV(lay.Lc, 0, rh, lay.Lc + 11 * s, { h: 1.8 });
    if (mh > rh + 10) v.dimV(lay.Lc, 0, mh, lay.Lc + 16 * s, { h: 1.8 });
    v.dimV(lay.doors.length ? lay.doors[0] : lay.mid, fh, fh + num(c.doorHeight, 1850), -6 * s, { h: 1.8 });

    // Plan
    const W = lay.W;
    const planY = -(30 * s) - W / 2;
    v.setTf(0, false, lay.Lc, true, planY);
    drawCarPlan(v, lay, cfg, { detail: true });
    v.clearTf();
    const top = planY + W / 2, bot = planY - W / 2, hi = lay.Wi / 2;
    // door chain above
    v.dimChainH([0, ...lay.doors, lay.Lc], top, top + 4.5 * s, { h: 1.8 });
    // bottom: bays and doors
    const xsBay = [lay.salStart];
    lay.doors.forEach(d => xsBay.push(d - lay.dw / 2, d + lay.dw / 2));
    xsBay.push(lay.salEnd);
    if (t.cab) xsBay.unshift(lay.bodyF);
    v.dimChainH(xsBay, bot, bot - 5 * s, { h: 1.7 });
    // seat blocks side B (drawn at bottom)
    const blocksB = lay.seatBlocks.filter(b => b.side === 'B');
    const xsSeat = [];
    blocksB.forEach(b => xsSeat.push(b.x0, b.x1));
    if (xsSeat.length) {
      // chain of seat blocks only (gaps labelled blank)
      const xs = [...new Set(xsSeat)].sort((a, b) => a - b);
      const labels = [];
      for (let i = 0; i < xs.length - 1; i++) {
        const blk = blocksB.find(b => Math.abs(b.x0 - xs[i]) < 1 && Math.abs(b.x1 - xs[i + 1]) < 1);
        labels.push(blk ? `${Math.round(xs[i + 1] - xs[i])} (${blk.n})` : '');
      }
      v.dimChainH(xs, planY - hi, bot - 10 * s, { h: 1.6, labels });
    }
    // widths at end 2
    v.dimV(lay.Lc, planY - W / 2, planY + W / 2, lay.Lc + 6 * s, { h: 1.8 });
    v.dimV(lay.Lc, planY - hi, planY + hi, lay.Lc + 11 * s, { h: 1.8 });
    const blk = lay.seatBlocks.filter(b => b.side === 'A' && !b.trans && lay.seatBlocks.some(q => q.side === 'B' && q.bay === b.bay)).sort((a, b) => b.n - a.n)[0];
    if (blk) {
      const xm = (blk.x0 + blk.x1) / 2 + 300;
      const d = blk.depth;
      v.dimV(xm, planY - hi + d, planY + hi - d, xm, { h: 1.6, label: `AISLE ${Math.round(lay.Wi - 2 * d)}` });
      v.dimV(xm + 1600, planY + hi - d, planY + hi, xm + 1600, { h: 1.5 });
    }
    if (lay.cabinets.length || lay.wheelchairs.length) { /* labelled on the drawing */ }

    // Summary table + legend
    const yT = oy + (bot / s) - 19;
    const cases = cfg.cases || [];
    const cols = [{ h: 'Area / capacity item', w: 62 }, { h: 'Value', w: 26, align: 'end' }];
    const A = lay.areas;
    const rows = [
      ['Saloon floor area (between end walls / cab)', `${A.saloon.toFixed(2)} m²`],
      ['Seat footprint', `${A.seat.toFixed(2)} m²`],
      [`Foot zone in front of seats (${num(cfg.interior.footZone, 300)} mm)`, `${A.foot.toFixed(2)} m²`],
      [`Wheelchair space${cfg.interior.wcAsStanding ? ' (counted as standing)' : ''}`, `${A.wheelchair.toFixed(2)} m²`],
      ['Cubicles / cabinets', `${A.cabinet.toFixed(2)} m²`],
      ['STANDING AREA', `${A.standing.toFixed(2)} m²`],
      ['SEATS', String(lay.seats)],
    ];
    const yB1 = table(p, 20, yT, cols, rows, { rowH: 4.6, h: 2, boldRows: [5, 6], shade: [5, 6] });
    const cols2 = [{ h: 'Load case', w: 30 }, { h: 'Basis', w: 30 }, { h: 'Seated', w: 15, align: 'end' }, { h: 'Standing', w: 17, align: 'end' }, { h: 'Total', w: 15, align: 'end' }, { h: 'Axle load', w: 18, align: 'end' }];
    const rows2 = cases.map(cs => {
      const q = lay.capacity[String(cs.name).toLowerCase()];
      return [cs.name, caseBasis(cs), i0(q.seated), i0(q.standing), i0(q.total), Number.isFinite(q.axle) ? `${q.axle.toFixed(2)} t` : '—'];
    });
    table(p, 114, yT, cols2, rows2, { rowH: 4.6, h: 2 });
    legend(p, 20, yB1 - 6, [
      { ly: 'SEAT', label: `Seat ${num(cfg.interior.seatWidth, 430)} × ${num(cfg.interior.seatDepth, 550)} mm`, kind: 'box' },
      { ly: 'FOOT', label: 'Foot zone limit (excluded from standing)', kind: 'line' },
      { ly: 'STAND', label: 'Standing area', kind: 'fill' },
    ]);
    legend(p, 95, yB1 - 6, [
      { ly: 'WC', label: `Wheelchair space ${num(cfg.interior.wcLength, 1300)} × ${num(cfg.interior.wcWidth, 700)}`, kind: 'box' },
      { ly: 'WC_DASH', label: `Turning circle Ø${num(cfg.interior.wcTurning, 1500)}`, kind: 'line' },
      { ly: 'CABINET', label: 'Cubicle / cabinet', kind: 'box' },
    ]);
    p.text(20, yB1 - 22, 'Bays are numbered B0 … Bn from END 1. Seat blocks dimensioned along side B with seat count in brackets.', 1.8, { color: '#555555' });
    return { title: `${kindLabel.toLowerCase().replace(/^./, m => m.toUpperCase())} ${t.name} — interior layout`, short: `${t.name} car`, size, scale, views: [v], paper: p };
  }

  function caseBasis(cs) {
    if (cs.kind === 'seated') return 'Seated only';
    if (cs.kind === 'factor') return `${num(cs.factor, 1)} × ${cs.of}`;
    const d = num(cs.density, 0);
    return `${d} pax/m² (${(1 / d).toFixed(3)} m²/pax)`;
  }
  TLT.caseBasis = caseBasis;

  /* ---------- Capacity sheet ---------- */
  function capacitySheet(R, size) {
    const cfg = R.cfg;
    const [PW, PH] = size;
    const p = new View(1, 0, 0);
    p.text(20, PH - 19, 'PASSENGER CAPACITY CALCULATION', 4.2, { bold: true });
    p.text(20, PH - 24.5, `Formation ${cfg.formation.replace(/\s+/g, ' ')}  ·  ${R.form.cars.length} cars  ·  train length ${R.form.length} mm over couplers`, 2.2, { color: '#444444' });
    const I = cfg.interior, Ld = cfg.loads;
    const used = R.used.map(n => R.layouts.get(n));
    const cases = cfg.cases || [];
    let y = PH - 32;

    // 1. Assumptions
    p.text(20, y, '1. BASIS OF CALCULATION', 2.6, { bold: true });
    const ass = [
      ['Seat width × depth (per passenger)', `${num(I.seatWidth, 430)} × ${num(I.seatDepth, 550)} mm`],
      ['Seating arrangement', I.seatType === 'transverse' ? `Transverse ${I.transSeatsPerSide}+${I.transSeatsPerSide}, legroom ${I.transLegroom} mm between facing seats` : 'Longitudinal'],
      ['Foot zone in front of longitudinal seats', `${num(I.footZone, 300)} mm (not counted as standing)`],
      ['Clearance at door / end of seat bays', `${num(I.doorClearance, 330)} / ${num(I.endClearance, 0)} mm`],
      ['Wheelchair space', `${num(I.wcLength, 1300)} × ${num(I.wcWidth, 700)} mm, ${I.wcAsStanding ? 'counted as standing area' : 'excluded from standing area'}`],
      ['Interior width (body - 2 × wall)', `${num(cfg.common.bodyWidth, 2950) - 2 * num(cfg.common.wallThk, 60)} mm`],
      ['Passenger mass', `${num(Ld.paxMass, 60)} kg`],
      ['Max. axle load (limit)', `${num(Ld.maxAxleLoad, 16)} t, axles per car ${num(Ld.axlesPerCar, 4)}, load shared equally`],
      ['Rounding of standing passengers', Ld.rounding === 'round' ? 'Nearest' : Ld.rounding === 'ceil' ? 'Up' : 'Down (floor)'],
    ];
    const yA = table(p, 20, y - 3, [{ h: 'Parameter', w: 62 }, { h: 'Value', w: 108 }], ass, { rowH: 4.4, h: 1.9 });
    // Load cases (right of assumptions)
    p.text(205, y, '2. LOAD CASES', 2.6, { bold: true });
    const yC = table(p, 205, y - 3, [{ h: 'Case', w: 28 }, { h: 'Basis', w: 50 }, { h: 'Note', w: PW - 20 - 205 - 78 }],
      cases.map(cs => [cs.name, caseBasis(cs), cs.note || '']), { rowH: 4.4, h: 1.9 });
    y = Math.min(yA, yC) - 7;

    // 3. Area breakdown per car type
    p.text(20, y, '3. FLOOR AREA BREAKDOWN PER CAR TYPE (m²)', 2.6, { bold: true });
    const colsA = [{ h: 'Car type', w: 20 }, { h: 'Saloon', w: 20, align: 'end' }, { h: 'Seats', w: 20, align: 'end' }, { h: 'Foot zone', w: 20, align: 'end' },
      { h: 'Wheelchair', w: 20, align: 'end' }, { h: 'Cubicles', w: 20, align: 'end' }, { h: 'Standing', w: 22, align: 'end' }, { h: 'No. seats', w: 18, align: 'end' }, { h: 'Aisle (mm)', w: 18, align: 'end' }];
    const yAr = table(p, 20, y - 3, colsA, used.map(l => [l.type.name, f2(l.areas.saloon), f2(l.areas.seat), f2(l.areas.foot), f2(l.areas.wheelchair), f2(l.areas.cabinet), f2(l.areas.standing), l.seats, i0(l.aisle)]), { rowH: 4.4, h: 1.9 });
    // spec comparison
    const hasSpec = used.some(l => l.type.specSeats !== '' && l.type.specSeats != null && Number.isFinite(num(l.type.specSeats, NaN)));
    let yS = yAr;
    if (hasSpec) {
      const aw = cases.find(q => q.kind === 'density');
      p.text(205, y, `4. CHECK AGAINST SPECIFICATION${aw ? ` (${aw.name})` : ''}`, 2.6, { bold: true });
      const colsS = [{ h: 'Car type', w: 20 }, { h: 'Seats calc.', w: 22, align: 'end' }, { h: 'Seats spec', w: 22, align: 'end' }, { h: 'Standing calc.', w: 26, align: 'end' }, { h: 'Standing spec', w: 26, align: 'end' }, { h: 'Diff. standing', w: 22, align: 'end' }];
      const rowsS = used.map(l => {
        const q = aw ? l.capacity[aw.name.toLowerCase()] : null;
        const ss = num(l.type.specSeats, NaN), st = num(l.type.specStanding, NaN);
        const d = q && Number.isFinite(st) ? q.standing - st : NaN;
        return [l.type.name, l.seats, i0(ss), q ? q.standing : '—', i0(st), Number.isFinite(d) ? `${d > 0 ? '+' : ''}${d} (${((d / st) * 100).toFixed(1)}%)` : '—'];
      });
      yS = table(p, 205, y - 3, colsS, rowsS, { rowH: 4.4, h: 1.9, colorFn: (ri, ci, val) => (ci === 1 && rowsS[ri] && Number.isFinite(num(rowsS[ri][2], NaN)) && Number(val) !== Number(rowsS[ri][2]) ? '#b3261e' : undefined) });
    }
    y = Math.min(yAr, yS) - 7;

    // 5. Capacity per car type per case
    const secNo = hasSpec ? 5 : 4;
    p.text(20, y, `${secNo}. PASSENGER CAPACITY PER CAR TYPE (seated + standing = total)`, 2.6, { bold: true });
    const wCase = Math.min(34, (PW - 40 - 22) / Math.max(1, cases.length));
    const colsP = [{ h: 'Car type', w: 22 }].concat(cases.map(cs => ({ h: cs.name, w: wCase, align: 'middle' })));
    const rowsP = used.map(l => [l.type.name].concat(cases.map(cs => {
      const q = l.capacity[String(cs.name).toLowerCase()];
      return `${i0(q.seated)} + ${i0(q.standing)} = ${i0(q.total)}`;
    })));
    const yP = table(p, 20, y - 3, colsP, rowsP, { rowH: 4.6, h: 1.9 });
    y = yP - 7;

    // 6. Train totals
    p.text(20, y, `${secNo + 1}. TRAIN CAPACITY, MASS AND AXLE LOAD`, 2.6, { bold: true });
    const colsT = [{ h: 'Item', w: 40 }].concat(cases.map(cs => ({ h: cs.name, w: wCase, align: 'end' })));
    const rowsT = [
      ['Seated passengers'].concat(R.totals.map(t => i0(t.seated))),
      ['Standing passengers'].concat(R.totals.map(t => i0(t.standing))),
      ['TOTAL PASSENGERS'].concat(R.totals.map(t => i0(t.total))),
      ['Train mass (t)'].concat(R.totals.map(t => f1(t.mass))),
      ['Max. axle load (t)'].concat(R.totals.map(t => f2(t.axleMax))),
      [`Check ≤ ${num(Ld.maxAxleLoad, 16)} t`].concat(R.totals.map(t => (t.ok ? 'OK' : 'EXCEEDED'))),
    ];
    const yT = table(p, 20, y - 3, colsT, rowsT, { rowH: 4.6, h: 1.9, boldRows: [2, 5], shade: [2], colorFn: (ri, ci, val) => (val === 'EXCEEDED' ? '#b3261e' : val === 'OK' && ri === 5 ? '#0f7a63' : undefined) });
    y = yT - 7;

    // per-car breakdown for the first density case (train composition)
    p.text(20, y, `${secNo + 2}. CAR-BY-CAR (all load cases, total passengers / car mass t)`, 2.6, { bold: true });
    const colsC = [{ h: 'Car', w: 12, align: 'middle' }, { h: 'Type', w: 14, align: 'middle' }, { h: 'Tare (t)', w: 14, align: 'end' }].concat(cases.map(cs => ({ h: cs.name, w: Math.min(30, (PW - 230 - 40) / Math.max(1, cases.length)), align: 'end' })));
    const rowsC = R.form.cars.map(car => {
      const l = R.layouts.get(car.type.name);
      return [car.no, car.label, f1(num(car.type.tare, NaN))].concat(cases.map(cs => { const q = l.capacity[String(cs.name).toLowerCase()]; return `${i0(q.total)} / ${f1(q.mass)}`; }));
    });
    table(p, 20, y - 3, colsC, rowsC, { rowH: 4.2, h: 1.8 });

    // warnings
    if (R.warnings.length) {
      const x = 20 + colsC.reduce((a, c) => a + c.w, 0) + 8;
      if (x < PW - 80) {
        p.text(x, y, 'CHECKS / WARNINGS', 2.4, { bold: true, color: '#b3261e' });
        R.warnings.slice(0, 12).forEach((w, i) => {
          const yy = y - 5 - i * 4;
          if (yy > 52) p.text(x, yy, trunc('· ' + w, 1.8, PW - 15 - x), 1.8, { color: '#b3261e' });
        });
      }
    }
    return { title: 'Passenger capacity calculation', short: 'Capacity', size, scale: 0, dxfScale: 100, views: [], paper: p };
  }
})();
