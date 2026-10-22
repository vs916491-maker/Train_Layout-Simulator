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
    GAUGE: { color: '#6a1b9a', lw: 0.2, aci: 6, dash: [3, 1.5] },
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

  /* Mirror helper: draws through v with x → L - x (and y → -y for a point mirror); used for END 2 cabs and ends */
  function mirrorView(v, L, point) {
    const mx = x => L - x, my = y => (point ? -y : y);
    const swap = a => (a === 'start' ? 'end' : a === 'end' ? 'start' : a);
    return {
      s: v.s, tw: (a, b, c) => v.tw(a, b, c),
      line: (x1, y1, x2, y2, ly, o) => v.line(mx(x1), my(y1), mx(x2), my(y2), ly, o),
      rect: (x0, y0, x1, y1, ly, o) => v.rect(mx(x0), my(y0), mx(x1), my(y1), ly, o),
      hatch: (x0, y0, x1, y1, ly, o) => v.hatch(mx(x0), my(y0), mx(x1), my(y1), ly, o),
      poly: (pts, cl, ly, o) => v.poly(pts.map(q => [mx(q[0]), my(q[1])]), cl, ly, o),
      circle: (cx, cy, r, ly, o) => v.circle(mx(cx), my(cy), r, ly, o),
      text: (x, y, t, hp, o) => v.text(mx(x), my(y), t, hp, Object.assign({}, o, { anchor: swap((o && o.anchor) || 'start') })),
    };
  }
  /* Plan outline with cab noses at END 1 and / or END 2 */
  function planOutline(lay) {
    const { bodyF, bodyR } = lay, hw = lay.W / 2;
    const e1 = lay.cab1 ? [[bodyF + 650, hw], [bodyF + 200, hw - 260], [bodyF, hw - 750], [bodyF, -hw + 750], [bodyF + 200, -hw + 260], [bodyF + 650, -hw]] : [[bodyF, hw], [bodyF, -hw]];
    const e2 = lay.cab2 ? [[bodyR - 650, -hw], [bodyR - 200, -hw + 260], [bodyR, -hw + 750], [bodyR, hw - 750], [bodyR - 200, hw - 260], [bodyR - 650, hw]] : [[bodyR, -hw], [bodyR, hw]];
    return e1.concat(e2);
  }
  /* Couplers, joints and gangway bellows at both ends, plan or side (draw(vv, endType, shared)) */
  function eachEnd(v, lay, point, draw) {
    draw(v, lay.ends.e1, lay.shared[0], lay.hinge[0]);
    draw(mirrorView(v, lay.Lc, point), lay.ends.e2, lay.shared[1], lay.hinge[1]);
  }

  /* ---------- Car side elevation (local coordinates, View transform set by caller) ---------- */
  function drawCarSide(v, lay, cfg, o) {
    const c = cfg.common;
    const fh = num(c.floorHeight, 1130), rh = num(c.roofHeight, 3650);
    const sole = fh - num(c.mountDepth, 250);
    const D = num(c.wheelDia, 860), wb = num(c.wheelbase, 2100);
    const DC = lay.doorCfg;
    const dh = DC.height, dw = lay.dw;
    const { bodyF, bodyR, Lc, type } = lay;
    const detail = !!o.detail;

    // Body outline (cab nose at END 1 and / or END 2)
    const prof = (cab, xF, d) => (cab ? [[xF, sole], [xF, fh + 650], [xF + d * 120, fh + 900], [xF + d * 380, fh + 1600], [xF + d * 820, rh - 140], [xF + d * 1150, rh]]
      : [[xF, sole], [xF, rh - 100], [xF + d * 120, rh]]);
    v.poly(prof(lay.cab2, bodyR, -1).concat(prof(lay.cab1, bodyF, 1).reverse()), true, 'BODY', { fill: '#f7f8fa' });
    v.line(lay.cab1 ? bodyF + 900 : bodyF, rh - 280, lay.cab2 ? bodyR - 900 : bodyR, rh - 280, 'BODY_THIN');
    v.line(bodyF + (lay.cab1 ? 80 : 0), sole + 120, bodyR - (lay.cab2 ? 80 : 0), sole + 120, 'BODY_THIN');
    const sideCab = (vv, cdx) => {
      vv.poly([[bodyF + 380, fh + 1600], [bodyF + 820, rh - 140]], false, 'WINDOW', { lw: 0.5 });
      vv.circle(bodyF + 90, fh + 450, 55, 'BODY_THIN');
      if (DC.cabSide.on && Number.isFinite(cdx)) {
        const cw = DC.cabSide.width, ch = DC.cabSide.height;
        vv.rect(cdx - cw / 2, fh, cdx + cw / 2, fh + ch, 'DOOR');
        vv.rect(cdx - cw / 2 + 90, fh + 1000, cdx + cw / 2 - 90, fh + Math.min(1650, ch - 150), 'WINDOW');
      }
    };
    if (lay.cab1) sideCab(v, lay.cabDoorX);
    if (lay.cab2) sideCab(mirrorView(v, Lc, false), Lc - lay.cabDoorX2);
    // Doors (with leaf windows)
    const WC = TLT.windowCfg(cfg);
    lay.doors.forEach(d => {
      v.rect(d - dw / 2, fh, d + dw / 2, fh + dh, 'DOOR');
      v.line(d, fh, d, fh + dh, 'DOOR');
      if (WC.doorWin) {
        const leaf = dw / 2, ww = WC.doorWinWidth > 0 ? Math.min(WC.doorWinWidth, leaf - 100) : leaf - 220;
        const z0 = fh + WC.doorWinSill, z1 = Math.min(fh + dh - 80, z0 + WC.doorWinHeight);
        [d - leaf / 2, d + leaf / 2].forEach(cx => v.rect(cx - ww / 2, z0, cx + ww / 2, z1, 'WINDOW', detail ? undefined : { lw: 0.13 }));
      }
    });
    // Side windows per bay: single / double / none; end bays separately; drop-down windows marked
    const z0 = fh + WC.sill, z1 = fh + WC.sill + WC.height;
    const lastBay = lay.bays.length - 1;
    lay.bays.forEach(b => {
      const L = b.x1 - b.x0;
      const isEnd = b.i === 0 || b.i === lastBay;
      const kind = isEnd ? WC.end : WC.inner;
      if (kind === 'none' || L < 900) return;
      const m = (b.x0 + b.x1) / 2;
      let wins = [];
      if (L > 5600) {
        // long saloon bay (mainline, LRV): a row of windows at the chosen width
        const w = kind === 'double' ? WC.doubleWidth : WC.singleWidth > 0 ? WC.singleWidth : 2000, gap = 300;
        const n = Math.max(1, Math.floor((L - 400 + gap) / (w + gap)));
        const x0 = m - (n * w + (n - 1) * gap) / 2;
        for (let k = 0; k < n; k++) wins.push([x0 + k * (w + gap), x0 + k * (w + gap) + w]);
      } else if (kind === 'single' || L < 2 * WC.doubleWidth + 400) {
        const w = WC.singleWidth > 0 ? Math.min(WC.singleWidth, L - 300) : Math.min(L - 500, 2600);
        if (w > 300) wins = [[m - w / 2, m + w / 2]];
      } else {
        const w = Math.min(WC.doubleWidth, (L - 500) / 2), gap = Math.max(150, Math.min(400, L - 2 * w - 400));
        wins = [[m - gap / 2 - w, m - gap / 2], [m + gap / 2, m + gap / 2 + w]];
      }
      const drop = WC.drop === 'all' || (WC.drop === 'ends' && isEnd);
      wins.forEach(([a, c], k) => {
        v.rect(a, z0, c, z1, 'WINDOW', { fill: '#e8f0fd' });
        // the window nearest the car end drops (Dhaka: 2 per side, one at each end)
        const isOuter = wins.length === 1 || (b.i === 0 ? k === 0 : b.i === lastBay ? k === wins.length - 1 : true);
        if (drop && isOuter) {
          v.line(a, z1 - WC.dropDepth, c, z1 - WC.dropDepth, 'WINDOW', { dash: [1.2, 0.8] });
          if (detail) v.text((a + c) / 2, z1 - WC.dropDepth / 2, 'DROP', 1.4, { anchor: 'middle', valign: 'middle', ly: 'WINDOW', color: '#1e5bd8' });
        }
      });
    });
    // Couplers, articulation joints and gangway bellows at each end
    const cy = fh - 420;
    eachEnd(v, lay, false, (vv, et, shared) => {
      if (et === 'cab' || et === 'aux') { vv.rect(0, cy - 120, 160, cy + 120, 'BODY'); vv.rect(160, cy - 50, bodyF + 300, cy + 50, 'BODY_THIN'); }
      else if (et === 'artic') { vv.circle(0, fh - 260, 90, 'BODY', { fill: '#ffffff' }); vv.line(0, fh - 260, bodyF + 250, fh - 260, 'BODY_THIN'); }
      else if (!shared) vv.rect(0, cy - 60, bodyF + 250, cy + 60, 'BODY_THIN');
      if ((et === 'gangway' || et === 'artic') && bodyF > 20) {
        const top = et === 'artic' ? rh - 250 : fh + 2150;
        vv.rect(0, fh - 120, bodyF, top, 'BODY_THIN');
        if (detail) for (let x = 60; x < bodyF - 20; x += 60) vv.line(x, fh - 120, x, top, 'BODY_THIN', { lw: 0.1 });
      }
    });

    // Bogies (own, shared or centre) and third-rail shoe gear
    TLT.shoeLayout(lay, cfg).forEach(xs => { v.rect(xs - 260, 90, xs + 260, 180, 'BOGIE', { fill: '#5a5a5a' }); v.line(xs, 180, xs, D / 2 - 80, 'BOGIE'); });
    lay.bogieInfo.forEach(bg => {
      const xb = bg.x, motor = bg.motor;
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
    v.poly(planOutline(lay), true, 'BODY');
    // Inner wall lines broken at doors
    const xa = lay.cab1 ? lay.salStart - 60 : bodyF + endWall, xb = lay.cab2 ? lay.salEnd + 60 : bodyR - endWall;
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
    // End walls: gangway opening, wide articulation portal, or closed wall (end wall / auxiliary desk end)
    eachEnd(v, lay, false, (vv, et) => {
      if (et === 'cab') return;
      const open = et === 'gangway' ? gwW : et === 'artic' ? Math.max(gwW, Wi - 400) : 0;
      const xIn = bodyF + endWall;
      if (!open) { vv.line(xIn, hi, xIn, -hi, 'BODY_THIN'); return; }
      [[hi, open / 2], [-open / 2, -hi]].forEach(([ya, yb]) => vv.line(xIn, ya, xIn, yb, 'BODY_THIN'));
      vv.line(xIn, open / 2, bodyF, open / 2, 'BODY_THIN');
      vv.line(xIn, -open / 2, bodyF, -open / 2, 'BODY_THIN');
      if (bodyF > 20) {
        const bw = Math.min(open / 2 + 140, hw - 20);
        vv.rect(0, -bw, bodyF, bw, 'BODY_THIN', { fill: '#f1f1f1' });
        if (detail) for (let x = 60; x < bodyF - 20; x += 60) vv.line(x, -bw, x, bw, 'BODY_THIN', { lw: 0.1 });
      }
      if (et === 'artic') vv.circle(0, 0, 90, 'BODY', { fill: '#ffffff' });
    });

    // Cabs (END 2 drawn as a point mirror of END 1, so the desk keeps its hand in the direction of travel)
    if (lay.cab1) drawCabPlan(v, lay);
    if (lay.cab2) drawCabPlan(mirrorView(v, Lc, true), Object.assign({}, lay, { salStart: Lc - lay.salEnd, cabLen: lay.cabLen2, cabDoorX: Lc - lay.cabDoorX2, openCab: lay.openCab2 }));
    function drawCabPlan(v, lay) {
      const xp = lay.salStart;
      const DC = lay.doorCfg, CB = lay.cabCfg;
      const detY = DC.detrain.on ? TLT.detrainY(lay, cfg) : 0;
      if (!lay.openCab) {
        // cab partition, with the cab-to-saloon door opening when applicable
        const g0 = DC.cabSaloon.on ? DC.cabSaloon.y - DC.cabSaloon.width / 2 : 0, g1 = DC.cabSaloon.on ? DC.cabSaloon.y + DC.cabSaloon.width / 2 : 0;
        const segs = DC.cabSaloon.on ? [[g1, hi], [-hi, g0]] : [[-hi, hi]];
        segs.forEach(([a, b]) => { v.line(xp - 60, a, xp - 60, b, 'CAB'); v.line(xp, a, xp, b, 'CAB'); });
        if (DC.cabSaloon.on) {
          v.line(xp - 60, g1, xp, g1, 'CAB'); v.line(xp - 60, g0, xp, g0, 'CAB');
          if (/slid/i.test(DC.cabSaloon.type)) v.rect(xp - 45, g1, xp - 15, g1 + DC.cabSaloon.width * 0.9, 'DOOR', { fill: '#efd9f4' });
          else v.line(xp - 30, g1, xp - 30 - DC.cabSaloon.width * 0.95, g1 - DC.cabSaloon.width * 0.3, 'DOOR', { lw: 0.15 });
        }
      }
      const dz = DC.detrain.on ? [detY - DC.detrain.width / 2 - 40, detY + DC.detrain.width / 2 + 40] : null;
      const freeSpans = (y0, y1) => { // [y0,y1] minus the detrainment door zone
        if (!dz || dz[1] <= y0 || dz[0] >= y1) return [[y0, y1]];
        const out = []; if (dz[0] > y0 + 150) out.push([y0, dz[0]]); if (dz[1] < y1 - 150) out.push([dz[1], y1]); return out;
      };
      // co-driver desk: console in front of the co-driver seat, clear of the detrainment door and the main desk
      const coDesk = (ks, d1, block) => {
        const outer = hi - 120, inner = hi - 120 - CB.coDeskWidth;
        const y0 = ks > 0 ? inner : -outer, y1 = ks > 0 ? outer : -inner;
        freeSpans(y0, y1).forEach(([a, b]) => {
          if (block) { if (b > block[0] && a < block[1]) { if (ks > 0) a = Math.max(a, block[1]); else b = Math.min(b, block[0]); } }
          if (b - a > 150) v.rect(bodyF + 300, a, d1, b, 'CAB', { fill: '#e4e4e4' });
        });
      };
      if (lay.openCab) {
        // GoA4: covered console across the front, no driver seat; the rest of the cab is passenger area
        const c1 = bodyF + CB.consoleDepth;
        freeSpans(-hi + 120, hi - 120).forEach(([y0, y1]) => v.rect(bodyF + 300, y0, c1, y1, 'CAB', { fill: '#ececec' }));
        v.line(c1, -hi, c1, hi, 'CAB', { dash: [1.5, 1] });
        if (detail) v.text(bodyF + 300 + (CB.consoleDepth - 300) / 2, dz && dz[0] < 0 && dz[1] > 0 ? hi - 520 : 0, 'COVERED CONSOLE', 1.3, { anchor: 'middle', valign: 'middle', rot: 90, ly: 'CAB', color: '#4a4a4a' });
      } else if (CB.desk === 'central') {
        const d1 = bodyF + Math.min(lay.cabLen * 0.55, 300 + CB.deskDepth);
        freeSpans(-CB.deskWidth / 2, CB.deskWidth / 2).forEach(([y0, y1]) => v.rect(bodyF + 300, y0, d1, y1, 'CAB', { fill: '#ececec' }));
        v.circle(d1 + 380, 0, 240, 'CAB', { fill: '#ffffff' });
        if (detail) v.text(d1 + 380, 0, 'DRIVER', 1.2, { anchor: 'middle', valign: 'middle', ly: 'CAB', color: '#4a4a4a' });
        if (CB.observer) {
          const ko = DC.detrain.on && detY < 0 ? 1 : -1;
          v.circle(d1 + 380, ko * (hi - 380), 190, 'CAB', { fill: '#ffffff' });
          if (detail) v.text(d1 + 380, ko * (hi - 380), 'CO-DRV', 1.0, { anchor: 'middle', valign: 'middle', ly: 'CAB', color: '#4a4a4a' });
          if (CB.coDesk) coDesk(ko, d1, [-CB.deskWidth / 2 - 80, CB.deskWidth / 2 + 80]);
        }
      } else {
        const k = CB.deskSide === 'A' ? 1 : -1;
        const d1 = bodyF + Math.min(lay.cabLen * 0.55, 300 + CB.deskDepth);
        const yIn = dz ? (k > 0 ? Math.max(dz[1], 120) : Math.min(dz[0], -120)) : k * 120;
        v.rect(bodyF + 300, k > 0 ? yIn : -hi + 120, d1, k > 0 ? hi - 120 : yIn, 'CAB', { fill: '#ececec' });
        const sy = k * (Math.abs(yIn) + (hi - 120 - Math.abs(yIn)) / 2);
        v.circle(d1 + 360, sy, 240, 'CAB', { fill: '#ffffff' });
        if (detail) v.text(d1 + 360, sy, 'DRIVER', 1.2, { anchor: 'middle', valign: 'middle', ly: 'CAB', color: '#4a4a4a' });
        if (CB.observer) {
          v.circle(d1 + 360, -k * (hi - 380), 190, 'CAB', { fill: '#ffffff' });
          if (detail) v.text(d1 + 360, -k * (hi - 380), 'CO-DRV', 1.0, { anchor: 'middle', valign: 'middle', ly: 'CAB', color: '#4a4a4a' });
          if (CB.coDesk) coDesk(-k, d1, null);
        }
      }
      if (DC.detrain.on) v.rect(bodyF - 10, detY - DC.detrain.width / 2, bodyF + 110, detY + DC.detrain.width / 2, 'DOOR', { fill: '#efd9f4' });
      if (DC.cabSide.on) {
        const cxd = lay.cabDoorX, cw = DC.cabSide.width;
        [1, -1].forEach(k => {
          v.line(cxd - cw / 2, k * hi, cxd - cw / 2, k * hw, 'DOOR');
          v.line(cxd + cw / 2, k * hi, cxd + cw / 2, k * hw, 'DOOR');
          v.rect(cxd - cw / 2, k * (hw - 35), cxd + cw / 2, k * (hw - 5), 'DOOR', { fill: '#efd9f4' });
        });
        v.line(bodyF + 650, hi, cxd - cw / 2, hi, 'BODY_THIN'); v.line(cxd + cw / 2, hi, xp - 60, hi, 'BODY_THIN');
        v.line(bodyF + 650, -hi, cxd - cw / 2, -hi, 'BODY_THIN'); v.line(cxd + cw / 2, -hi, xp - 60, -hi, 'BODY_THIN');
      } else {
        v.line(bodyF + 650, hi, xp - 60, hi, 'BODY_THIN'); v.line(bodyF + 650, -hi, xp - 60, -hi, 'BODY_THIN');
      }
      if (detail && !lay.openCab) {
        if (CB.desk === 'central') v.text(bodyF + lay.cabLen * 0.78, (DC.detrain.on && detY < 0 ? -1 : 1) * (hi - 260), 'CAB', 2.2, { anchor: 'middle', valign: 'middle', ly: 'CAB', color: '#4a4a4a', bold: true });
        else v.text(bodyF + lay.cabLen * 0.6, 0, 'CAB', 2.2, { anchor: 'middle', valign: 'middle', ly: 'CAB', color: '#4a4a4a', bold: true });
      }
    }

    // Mainline: vestibule partitions and class boundary
    const MLc = TLT.mainlineCfg(cfg);
    (lay.vestibules || []).forEach(vz => {
      [vz.x0, vz.x1].forEach(x => {
        if (x <= lay.salStart + 1 || x >= lay.salEnd - 1) return;
        const vd = MLc.vestDoor / 2;
        [[hi, vd], [-vd, -hi]].forEach(([a, b]) => { v.line(x - 30, a, x - 30, b, 'BODY_THIN'); v.line(x + 30, a, x + 30, b, 'BODY_THIN'); });
        v.line(x, vd, x, -vd, 'DOOR', { dash: [1, 0.8] });
      });
      if (detail) v.text((vz.x0 + vz.x1) / 2, -380, 'VESTIBULE', 1.4, { anchor: 'middle', valign: 'middle', color: '#555555' });
    });
    if (lay.mainline && Number.isFinite(lay.xFirst)) {
      const xF = lay.xFirst;
      if (xF > lay.salStart + 1 && xF < lay.salEnd - 1) v.line(xF, hi, xF, -hi, 'BODY_THIN', { dash: [2, 1] });
      const lab = (cl, t) => {
        const bl = lay.seatBlocks.filter(q => q.cls === cl);
        if (!detail || !bl.length) return;
        const x0 = Math.min(...bl.map(q => q.x0)), x1 = Math.max(...bl.map(q => q.x1));
        v.text((x0 + x1) / 2, -230, t, 1.6, { anchor: 'middle', valign: 'middle', bold: true, color: '#7a5b00' });
      };
      lab('first', '1st CLASS');
      lab('std', 'STANDARD CLASS');
    }

    // Seats
    const sy = (side, d) => (side === 'A' ? [hi - d, hi] : [-hi, -hi + d]);
    lay.seatBlocks.forEach(b => {
      if (b.rowSeats) {
        b.rowSeats.forEach(([a, z]) => {
          for (let j = 0; j < b.per; j++) {
            const y0 = b.side === 'A' ? hi - (j + 1) * b.sw : -hi + j * b.sw;
            v.rect(a, y0, z, y0 + b.sw, 'SEAT', { fill: b.cls === 'first' ? '#f6e7b8' : true });
          }
        });
        return;
      }
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
        const ym = Number.isFinite(w.cy) ? w.cy : (w.side === 'A' ? hi - R : -hi + R);
        const xm = Number.isFinite(w.cx) ? w.cx : (w.x0 + w.x1) / 2;
        v.circle(xm, ym, R, 'WC_DASH', w.clear === false ? { color: '#b3261e' } : undefined);
        v.text((w.x0 + w.x1) / 2, (y0 + y1) / 2, 'WHEELCHAIR', 1.6, { anchor: 'middle', valign: 'middle', ly: 'WC', color: '#1565c0' });
      }
    });
    // Cabinets, toilets, auxiliary desks
    lay.cabinets.forEach(cb => {
      const [y0, y1] = sy(cb.side, cb.depth);
      const k = cb.side === 'A' ? -1 : 1, yWall = cb.side === 'A' ? y1 : y0, yAisle = cb.side === 'A' ? y0 : y1, xm = (cb.x0 + cb.x1) / 2;
      if (cb.toilet) {
        v.rect(cb.x0, y0, cb.x1, y1, 'CABINET', { fill: '#eef5f7' });
        const dwT = Math.max(300, Math.min(cb.toilet === 'prm' ? 900 : 650, cb.x1 - cb.x0 - 200));
        v.line(xm - dwT / 2, yAisle, xm + dwT / 2, yAisle, 'DOOR', { lw: 0.4 });
        v.circle(cb.x0 + 330, yWall + k * 330, 190, 'CABINET', { fill: '#ffffff' });
        v.rect(cb.x1 - 560, yWall, cb.x1 - 120, yWall + k * 380, 'CABINET', { fill: '#ffffff' });
        const R2 = 750;
        if (cb.toilet === 'prm' && detail && Math.min(cb.x1 - cb.x0, cb.depth) >= 2 * R2 - 50) v.circle(xm, (y0 + y1) / 2, R2, 'WC_DASH');
        if (detail) labelIn(v, cb.toilet === 'prm' ? 'PRM WC' : 'WC', cb.x0, cb.x1, (y0 + y1) / 2, 1.5, 'CABINET');
        return;
      }
      if (cb.aux) {
        v.rect(cb.x0, y0, cb.x1, y1, 'CAB', { fill: '#ececec' });
        v.circle(xm, yAisle + k * -260, 200, 'CAB', { fill: '#ffffff' });
        if (detail) v.text(xm, (y0 + y1) / 2, 'AUX', 1.3, { anchor: 'middle', valign: 'middle', ly: 'CAB', color: '#4a4a4a', bold: true });
        return;
      }
      v.rect(cb.x0, y0, cb.x1, y1, 'CABINET', { fill: true });
      v.line(cb.x0, y0, cb.x1, y1, 'CABINET', { lw: 0.13 }); v.line(cb.x0, y1, cb.x1, y0, 'CABINET', { lw: 0.13 });
      if (detail) {
        const dims = `${Math.round(cb.x1 - cb.x0)}×${Math.round(cb.depth)}${Number.isFinite(cb.height) ? '×' + Math.round(cb.height) : ''}`;
        const ym = (y0 + y1) / 2;
        if (v.tw(cb.label, 1.4) < (cb.x1 - cb.x0) * 0.92 && (y1 - y0) / v.s > 4.2) {
          v.text((cb.x0 + cb.x1) / 2, ym + 0.9 * v.s, cb.label, 1.4, { anchor: 'middle', valign: 'middle', ly: 'CABINET', color: '#333333', bold: true });
          v.text((cb.x0 + cb.x1) / 2, ym - 1.1 * v.s, dims, 1.25, { anchor: 'middle', valign: 'middle', ly: 'CABINET', color: '#333333' });
        } else labelIn(v, cb.label, cb.x0, cb.x1, ym, 1.4, 'CABINET');
      }
    });
    // Centre line & bay labels
    v.line(-150, 0, Lc + 150, 0, 'CENTER');
    if (detail) lay.bays.forEach(b => {
      if (b.x1 - b.x0 < 250) return;
      v.text((b.x0 + b.x1) / 2, 120, 'B' + b.i, 1.6, { anchor: 'middle', valign: 'base', ly: 'TEXT', color: '#777777' });
    });
  }

  /* ---------- Front elevation of a driving car (looking at END 1; x = lateral, + = side B, z above rail) ---------- */
  function drawFront(v, lay, cfg) {
    const c = cfg.common, F = TLT.frontCfg(cfg), DC = lay.doorCfg, CB = lay.cabCfg;
    const fh = num(c.floorHeight, 1130), rh = num(c.roofHeight, 3650), sole = fh - num(c.mountDepth, 250);
    const D = num(c.wheelDia, 860), hw = lay.W / 2, s = v.s;
    const g = 1435;
    // roof equipment seen from the front (behind the body outline)
    lay.equipment.items.filter(e => e.loc === 'roof').forEach(e => {
      const x0 = -e.y - e.width / 2, x1 = -e.y + e.width / 2;
      v.rect(x0, rh - 200, x1, rh + e.height, 'ROOF', { fill: true });
    });
    // gauge outline
    if (F.showGauge) {
      const gw = F.gaugeWidth / 2, gh = F.gaugeHeight;
      v.poly([[-gw + 250, 120], [-gw, 400], [-gw, gh - 600], [-gw + 600, gh], [gw - 600, gh], [gw, gh - 600], [gw, 400], [gw - 250, 120]], true, 'GAUGE');
    }
    // rails, wheels, bogie
    [-1, 1].forEach(k => {
      const xi = k * g / 2, xo = k * (g / 2 + 72);
      v.rect(Math.min(xi, xo), -40, Math.max(xi, xo), 0, 'RAIL', { fill: '#888888' });
      v.rect(k * (g / 2 + 36) - 8, -150, k * (g / 2 + 36) + 8, -40, 'RAIL');
      v.rect(k * (g / 2 + 36) - 75, -172, k * (g / 2 + 36) + 75, -150, 'RAIL', { fill: '#888888' });
      v.rect(k * 680, 0, k * 815, D, 'BOGIE', { fill: '#ffffff' });
      v.rect(k * 650, 0, k * 680, 30, 'BOGIE', { fill: '#b3261e' });
    });
    v.rect(-1080, D / 2 - 120, 1080, D / 2 + 320, 'BOGIE', { fill: '#fbe9e7' });
    // third rail and shoe gear (drawn on both sides)
    const PWf = TLT.powerCfg(cfg);
    if (PWf.third) [-1, 1].forEach(k => {
      const xr = k * PWf.railOffset;
      const top = PWf.contact === 'top', bot = PWf.contact === 'bottom';
      v.rect(xr - 40, 60, xr + 40, 220, 'RAIL', { fill: '#888888' });
      if (bot) v.rect(xr - 160, 230, xr + 160, 280, 'RAIL', { fill: '#cfcfcf' });            // cover board
      const zs = top ? 220 : bot ? 60 : 140;
      const xs = PWf.contact === 'side' ? xr - k * 40 - k * 120 : xr;
      v.rect(xs - 120, top ? zs : zs - 60, xs + 120, top ? zs + 60 : zs, 'BOGIE', { fill: '#5a5a5a' });
      v.line(xs, top ? zs + 60 : zs, k * 1000, D / 2, 'BOGIE');
    });
    // body outline: straight lower sides, slight tumblehome, arched roof
    const pts = [];
    const roofHalf = hw - 260;
    for (let k = 0; k <= 10; k++) { const x = -roofHalf + (2 * roofHalf * k) / 10; pts.push([x, rh - 230 * Math.pow(x / roofHalf, 2)]); }
    const body = [[-(hw - 160), sole], [-(hw - 10), fh + 250], [-hw, fh + 1500], [-(hw - 70), rh - 420], [-(hw - 160), rh - 300]].concat(pts, [[hw - 160, rh - 300], [hw - 70, rh - 420], [hw, fh + 1500], [hw - 10, fh + 250], [hw - 160, sole]]);
    v.poly(body, true, 'BODY', { fill: '#f7f8fa' });
    // anticlimber, obstacle deflector, coupler
    v.rect(-1150, sole - 60, 1150, sole + 120, 'BODY_THIN', { fill: '#e6e8eb' });
    v.poly([[-(hw - 350), 160], [hw - 350, 160], [hw - 250, 480], [-(hw - 250), 480]], true, 'BODY_THIN', { fill: '#eef0f2' });
    const ch = F.couplerHeight;
    v.rect(-260, ch - 150, 260, ch + 150, 'BODY', { fill: '#dfe3e7' });
    v.rect(-110, ch - 230, 110, ch - 150, 'BODY_THIN');
    // windscreen band, split around the detrainment door
    const wz0 = fh + 950, wz1 = rh - 470, wx = hw - 300;
    const detX = DC.detrain.on ? -TLT.detrainY(lay, cfg) : null;
    const dw2 = DC.detrain.width / 2, dTop = fh + DC.detrain.height;
    let panes = [[-wx, wx]];
    if (DC.detrain.on) panes = [[-wx, detX - dw2 - 60], [detX + dw2 + 60, wx]].filter(([a, b]) => b - a > 200);
    panes.forEach(([a, b]) => v.poly([[a, wz0], [b, wz0], [b - (b > 0 ? 80 : 0), wz1], [a + (a < 0 ? 80 : 0), wz1]], true, 'WINDOW', { fill: '#dfe9fb', lw: 0.3 }));
    if (DC.detrain.on) {
      v.rect(detX - dw2, fh - 60, detX + dw2, dTop, 'DOOR', { fill: '#f3e5f7', lw: 0.35 });
      v.rect(detX - dw2 + 60, Math.max(wz0, fh + 300), detX + dw2 - 60, Math.min(wz1, dTop - 120), 'WINDOW', { fill: '#dfe9fb' });
      v.line(detX + dw2 - 120, fh + 900, detX + dw2 - 120, fh + 1150, 'DOOR', { lw: 0.4 });
    }
    // destination indicator
    if (F.destination) {
      const dx = DC.detrain.on && Math.abs(detX) > 300 ? -Math.sign(detX) * 450 : 0;
      v.rect(dx - 650, wz1 + 60, dx + 650, wz1 + 230, 'BODY_THIN', { fill: '#2b2b2b' });
    }
    // head and tail lights
    const lz = fh + F.lightsZ;
    [-1, 1].forEach(k => {
      v.circle(k * (hw - F.lightsInset), lz, 95, 'BODY', { fill: '#fffbe6' });
      v.circle(k * (hw - F.lightsInset - 240), lz, 70, 'NOTE', { fill: '#f6b3ad' });
    });
    // wipers
    const n = F.wipers;
    if (n > 0) {
      const pz = wz0 + 70;
      const centres = [];
      const pc = p => (p[0] + p[1]) / 2;
      if (n === 1) { const drvSide = CB.desk === 'central' ? 0 : (CB.deskSide === 'B' ? 1 : -1); const p = panes.reduce((best, q) => (Math.abs(pc(q) - drvSide * wx / 2) < Math.abs(pc(best) - drvSide * wx / 2) ? q : best), panes[0]); centres.push(pc(p)); }
      else if (n === 2 && panes.length === 2) { centres.push(pc(panes[0]), pc(panes[1])); }
      else {
        for (let k = 0; k < n; k++) {
          let x = -wx + (2 * wx * (k + 0.5)) / n;
          const inDoor = DC.detrain.on && Math.abs(x - detX) < dw2 + 80;
          if (inDoor) { const p = panes.reduce((best, q) => (Math.abs(pc(q) - x) < Math.abs(pc(best) - x) ? q : best), panes[0]); x = pc(p); }
          centres.push(x);
        }
      }
      centres.forEach(x => {
        if (F.wiperType === 'pantograph') {
          v.line(x - 90, pz, x - 30, pz + 620, 'BODY', { lw: 0.35 }); v.line(x + 60, pz, x + 120, pz + 620, 'BODY', { lw: 0.35 });
          v.line(x + 45, pz + 330, x + 45, pz + 1000, 'BODY', { lw: 0.6 });
        } else {
          v.line(x, pz, x - 110, pz + 700, 'BODY', { lw: 0.35 });
          v.line(x - 150, pz + 280, x - 150, pz + 1020, 'BODY', { lw: 0.6 });
        }
        v.circle(x, pz, 35, 'BODY', { fill: '#333333' });
      });
    }
    // centre line and dimensions
    v.line(0, -350, 0, Math.max(F.gaugeHeight, rh) + 250, 'CENTER');
    v.dimChainH([-g / 2, g / 2], -40, -380, { h: 1.7 });
    v.dimChainH([-hw, hw], sole, -380 - 4.5 * s, { h: 1.7 });
    if (F.showGauge) v.dimChainH([-F.gaugeWidth / 2, F.gaugeWidth / 2], F.gaugeHeight, F.gaugeHeight + 3.5 * s, { h: 1.6 });
    const xr = Math.max(hw, F.gaugeWidth / 2);
    v.dimV(xr, 0, fh, xr + 4.5 * s, { h: 1.6, side: 'right' });
    v.dimV(xr, 0, rh, xr + 9 * s, { h: 1.6, side: 'right' });
    if (DC.detrain.on) {
      v.dimChainH([detX - dw2, detX + dw2], dTop, dTop + 2.6 * s, { h: 1.5 });
      v.dimV(detX - dw2, fh - 60, dTop, detX - dw2 - 2.5 * s, { h: 1.5 });
    }
    v.text(-xr, -380 - 9.5 * s, 'SIDE A', 1.6, { anchor: 'start', color: '#555555', bold: true });
    v.text(xr, -380 - 9.5 * s, 'SIDE B', 1.6, { anchor: 'end', color: '#555555', bold: true });
    const info = [`Wipers: ${n ? `${n} × ${F.wiperType === 'pantograph' ? 'pantograph' : 'single-arm'}` : 'none'}`, `Detrainment door: ${DC.detrain.on ? `${DC.detrain.width} × ${DC.detrain.height}${Math.abs(detX) > 1 ? ', offset ' + Math.round(Math.abs(detX)) : ', centred'}` : 'none'}`,
      `Desk: ${CB.goa4 ? 'GoA4, covered console' : (CB.desk === 'central' ? 'central' : 'side ' + CB.deskSide) + (CB.observer ? (CB.coDesk ? ', co-driver seat + desk' : ', co-driver seat') : '')}`, `Power: ${PWf.label}${PWf.third ? ', third rail ' + PWf.contact + ' contact' : ''}${PWf.panto ? ', pantograph' : ''}`];
    info.forEach((tx, i) => v.text(-xr, -380 - (13.5 + i * 3.2) * s, tx, 1.6, { color: '#333333' }));
  }

  // Detrainment door: centred, or moved to side A when the driving desk is central
  TLT.detrainY = function (lay, cfg) {
    const CB = TLT.cabCfg(cfg), DC = lay.doorCfg;
    if (CB.desk !== 'central' || CB.goa4) return 0;
    return lay.Wi / 2 - 200 - DC.detrain.width / 2;
  };

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
    cell(x0, y1 - 24, 'DRAWING No.', sheet.drawingNo != null ? sheet.drawingNo : (pr.drawingNo || ''), 70);
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
    // One layout sheet per car variant used in the formation, in formation order
    R.used.forEach(name => {
      const lay = R.layouts.get(name);
      const pt = TLT.productType(cfg), noun = pt === 'tram' ? 'MODULE' : pt === 'lrv' ? 'SECTION' : 'CAR';
      sheets.push(carSheet(R, paper, lay, lay.cab1 || lay.cab2 ? `DRIVING ${noun}` : pt === 'tram' || pt === 'lrv' ? `INTERMEDIATE ${noun}` : 'INTERMEDIATE CAR'));
    });
    sheets.push(capacitySheet(R, paper));
    finish(sheets, cfg, '');
    return sheets;
  };

  function finish(sheets, cfg, suffix) {
    sheets.forEach((s, i) => { s.no = i + 1; s.of = sheets.length; s.drawingNo = (cfg.project.drawingNo || '') + suffix; });
    sheets.forEach(s => { frame(s.paper, s.size[0], s.size[1]); titleBlock(s.paper, s.size[0], cfg, s); });
  }

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
    const ptype = TLT.productType(cfg);
    p.text(20, PH - 19, `TRAIN FORMATION & VEHICLE LAYOUT — ${ptype === 'tram' ? `${n}-MODULE TRAM` : ptype === 'lrv' ? `${n}-SECTION LRV` : `${n}-CAR ${ptype === 'mainline' ? 'EMU / DMU' : 'TRAIN'}`}`, 4.2, { bold: true });
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
        xsB.push(cx, ...lay.bogies.map(xb => cx + (car.flip ? lay.Lc - xb : xb)), cx + lay.Lc);
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
    const cols = [
      { h: 'Car', w: 14, align: 'middle' }, { h: 'Type', w: 18, align: 'middle' }, { h: 'Unit', w: 14, align: 'middle' },
      { h: 'Description', w: 120 }, { h: 'Cab', w: 16, align: 'middle' }, { h: 'L over couplers', w: 32, align: 'end' }, { h: 'L body', w: 28, align: 'end' },
      { h: 'Bogie centres', w: 28, align: 'end' }, { h: 'Doors / side', w: 24, align: 'middle' }, { h: 'Bogies', w: PW - 40 - 294, align: 'middle' },
    ];
    const tRows = R.form.cars.map(car => {
      const lay = R.layouts.get(car.type.name);
      const t = car.type;
      const bog = lay.bogieInfo.length ? lay.bogieInfo.map(bg => (bg.motor ? 'M' : 'T') + (bg.shared ? ' (Jacobs)' : bg.end === 0 ? ' (centre)' : '')).join(' + ') : 'suspended';
      const cabTxt = lay.cab1 && lay.cab2 ? 'Both' : lay.cab1 ? 'END 1' : lay.cab2 ? 'END 2' : lay.ends.e1 === 'aux' || lay.ends.e2 === 'aux' ? 'Aux.' : '—';
      return [car.no, car.label, car.unit + 1, (t.desc || '') + (car.flip ? ' (reversed)' : ''), cabTxt, i0(lay.Lc), i0(lay.Lb), lay.bogieInfo.length >= 2 ? i0(lay.bc) : '—', lay.doors.length, bog];
    });
    tRows.push(['', '', '', 'TRAIN TOTAL', R.form.cars.reduce((a, c) => { const l = R.layouts.get(c.type.name); return a + (l.cab1 ? 1 : 0) + (l.cab2 ? 1 : 0); }, 0), i0(R.form.length), '', '', '', `${R.form.cars.reduce((a, c) => a + R.layouts.get(c.type.name).motorBogies, 0)} motor bogies`]);
    const drv = R.form.cars.find(cc => TLT.hasCab(cc.type));
    const colW = drv ? Math.min(150, Math.max(105, PW * 0.27)) : 0;
    const fac = (PW - 40 - (colW ? colW + 8 : 0)) / cols.reduce((a, c) => a + c.w, 0);
    cols.forEach(c => { c.w *= fac; });
    const yB = table(p, 20, yTab, cols, tRows, { rowH: 5, h: 2, boldRows: [tRows.length - 1], shade: [tRows.length - 1] });
    let frontView = null;
    if (drv) {
      const lay = R.layouts.get(drv.type.name);
      const F = TLT.frontCfg(cfg);
      const cx0 = PW - 10 - colW, cw = colW - 6;
      const top = yTab, bottom = 54;
      const needW = Math.max(lay.W, F.gaugeWidth) + 1900, needH = Math.max(F.gaugeHeight, num(c.maxHeight, 4100)) + 1700;
      const fs = pickScale(Math.max(needW / cw, needH / (top - bottom - 10)));
      const spare = Math.max(0, (top - bottom - 12) - needH / fs);
      frontView = new View(fs, cx0 + cw / 2 - 300 / fs, top - 9 - (needH - 1000) / fs - Math.min(spare, 6));
      drawFront(frontView, lay, cfg);
      p.text(cx0 + 2, top - 3, `FRONT VIEW — ${drv.type.name} (END 1)   1:${fs}`, 2.4, { bold: true });
      views.push(frontView);
    }

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
      `1. Car lengths are over coupler faces / joint centres.${(() => { const b = [...new Set(R.used.map(n => R.layouts.get(n)).filter(l => l.bogieInfo.length >= 2).map(l => l.bc))]; return b.length ? ` Bogie centres ${b.join(' / ')} mm;` : ''; })()} wheel Ø${num(c.wheelDia, 860)} new.`,
      `2. Floor ${num(c.floorHeight, 1130)} mm, roof ${num(c.roofHeight, 3650)} mm, max. height ${num(c.maxHeight, 4100)} mm above top of rail.`,
      `3. ${powerNote(R)}`,
    ];
    const noteW = (drv ? PW - 10 - colW - 6 : PW - 20) - 165;
    notes.forEach((t, i) => p.text(165, yy - i * 4.6, trunc(t, i ? 2 : 2.4, noteW), i ? 2 : 2.4, { bold: i === 0 }));
    return { title: `Train formation & vehicle layout (${n} cars)`, short: 'Train layout', size, scale, views, paper: p };
  }

  function powerNote(R) {
    const P = R.power.cfg, Q = R.power;
    const m = v => (v / 1000).toFixed(1);
    let t = `Power: ${P.label}, ${P.collector === 'panto' ? 'pantograph' : P.collector === 'third' ? `third rail (${P.contact} contact)` : `pantograph + third rail (${P.contact} contact)`}.`;
    if (P.panto) t += ` ${Q.pantos.length} pantograph(s)${Q.pantos.length > 1 ? `, outermost ${m(Q.pantoSpan)} m apart` : ''}.`;
    if (P.third) t += ` ${Q.shoesTrain} CCD shoes (${Q.shoes.length} per side), span ${m(Q.span)} m, max. spacing ${m(Q.maxSpacing)} m.`;
    return t;
  }
  TLT.powerNote = powerNote;

  /* ---------- Car detail sheet ---------- */
  function carSheet(R, size, lay, kindLabel) {
    const cfg = R.cfg, c = cfg.common;
    const [PW, PH] = size;
    const maxH = Math.max(num(c.maxHeight, 4100), num(c.roofHeight, 3650) + 450);
    // fit the width, and the height of side view + plan + tables (short tram modules would otherwise overflow)
    const scale = pickScale(Math.max((lay.Lc + 2500) / (PW - 60), (maxH + lay.W) / (PH - 165)));
    const s = scale;
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
    lay.bogies.forEach(xb => v.dimChainH([xb - wb / 2, xb + wb / 2], 0, -4.5 * s, { h: 1.8 }));
    v.dimChainH([0, ...lay.bogies, lay.Lc], 0, -9.5 * s, { h: 2 });
    v.dimChainH([0, lay.Lc], 0, -14.5 * s, { h: 2.2 });
    // heights at end 2
    v.dimV(lay.Lc, 0, fh, lay.Lc + 6 * s, { h: 1.8 });
    v.dimV(lay.Lc, 0, rh, lay.Lc + 11 * s, { h: 1.8 });
    if (mh > rh + 10) v.dimV(lay.Lc, 0, mh, lay.Lc + 16 * s, { h: 1.8 });
    v.dimV(lay.doors.length ? lay.doors[0] : lay.mid, fh, fh + lay.doorCfg.height, -6 * s, { h: 1.8 });

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
    if (lay.cab1) xsBay.unshift(lay.bodyF);
    if (lay.cab2) xsBay.push(lay.bodyR);
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
      ['SEATS', lay.mainline && lay.seatsFirst ? `${lay.seats} (1st ${lay.seatsFirst} / std ${lay.seats - lay.seatsFirst})` : String(lay.seats)],
    ];
    if (lay.mainline) rows.splice(5, 0, ['Vestibules (included in standing)', `${A.vestibule.toFixed(2)} m²`]);
    const bR = rows.length;
    const yB1 = table(p, 20, yT, cols, rows, { rowH: 4.6, h: 2, boldRows: [bR - 2, bR - 1], shade: [bR - 2, bR - 1] });
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
    if (lay.mainline) p.text(20, yB1 - 22, `Mainline seating ${TLT.mainlineCfg(cfg).arrangement}: standard ${TLT.mainlineCfg(cfg).std.abreast.join('+')} at ${TLT.mainlineCfg(cfg).std.pitch} mm pitch, 1st class ${TLT.mainlineCfg(cfg).first.abreast.join('+')} at ${TLT.mainlineCfg(cfg).first.pitch} mm (1st class seats shaded).`, 1.8, { color: '#555555' });
    else p.text(20, yB1 - 22, 'Bays are numbered B0 … Bn from END 1. Seat blocks dimensioned along side B with seat count in brackets.', 1.8, { color: '#555555' });
    const plc = { door: 'next to door', end1: 'END 1 side', middle: 'middle', end2: 'END 2 side' };
    const itemLines = lay.wheelchairs.map(w => `Wheelchair space ${Math.round(w.x1 - w.x0)} × ${Math.round(w.depth)}: B${w.bay} side ${w.side}, ${plc[w.place] || ''}; turning circle ${w.clear === false ? 'NOT clear of seats' : 'clear'}`)
      .concat(lay.cabinets.map(c => `${c.toilet ? (c.toilet === 'prm' ? 'PRM toilet' : 'Toilet') : c.aux ? 'Auxiliary driving desk' : c.label} ${Math.round(c.x1 - c.x0)} × ${Math.round(c.depth)}${Number.isFinite(c.height) ? ' × ' + Math.round(c.height) : ''} mm (L × D × H): B${c.bay} side ${c.side}, ${plc[c.place] || ''}`));
    if (itemLines.length) {
      const x2 = 240, yI = yT;
      p.text(x2 + 10, yI - 32, 'INTERIOR ITEMS', 2.2, { bold: true });
      itemLines.slice(0, 6).forEach((tx, k) => p.text(x2 + 10, yI - 37 - k * 3.8, trunc('· ' + tx, 1.75, PW - 20 - x2 - 10), 1.75, { color: /NOT clear/.test(tx) ? '#b3261e' : '#333333' }));
    }
    return { title: `${kindLabel.toLowerCase().replace(/^./, m => m.toUpperCase())} ${t.name} — interior layout`, short: `${t.name} layout`, size, scale, views: [v], paper: p };
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
      ['Seating arrangement', TLT.mainlineCfg(cfg).on ? (() => { const M = TLT.mainlineCfg(cfg); return `Mainline ${M.arrangement}: std ${M.std.abreast.join('+')} / ${M.std.pitch} mm, 1st ${M.first.abreast.join('+')} / ${M.first.pitch} mm${M.vestibules ? ', vestibules' : ''}`; })() : I.seatType === 'transverse' ? `Transverse ${I.transSeatsPerSide}+${I.transSeatsPerSide}, legroom ${I.transLegroom} mm between facing seats` : 'Longitudinal'],
      ['Foot zone in front of longitudinal seats', `${num(I.footZone, 300)} mm (not counted as standing)`],
      ['Clearance at door / end of seat bays', `${num(I.doorClearance, 330)} / ${num(I.endClearance, 0)} mm`],
      ['Wheelchair space', `${num(I.wcLength, 1300)} × ${num(I.wcWidth, 700)} mm, ${I.wcAsStanding ? 'counted as standing area' : 'excluded from standing area'}`],
      ['Interior width (body - 2 × wall)', `${num(cfg.common.bodyWidth, 2950) - 2 * num(cfg.common.wallThk, 60)} mm`],
      ['Passenger mass', `${num(Ld.paxMass, 60)} kg`],
      ['Max. axle load (limit)', `${num(Ld.maxAxleLoad, 16)} t; axles from the running gear (shared bogie = 1 axle per car), suspended module mass split to neighbours`],
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

  /* ================= Underframe sheets ================= */
  TLT.buildUnderframeSheets = function (R) {
    const cfg = R.cfg;
    const paper = TLT.PAPER[cfg.project.paper] || TLT.PAPER.A3;
    const sheets = R.used.map(n => underframeSheet(R, paper, R.layouts.get(n)));
    finish(sheets, cfg, '-UF');
    return sheets;
  };

  function drawUnderframePlan(v, lay, cfg) {
    const c = cfg.common;
    const { bodyF, bodyR, Lc, W, type, mid } = lay;
    const hw = W / 2;
    const D = num(c.wheelDia, 860), wb = num(c.wheelbase, 2100);
    // body outline
    v.poly(planOutline(lay), true, 'BODY', { fill: '#fafbfc' });
    // couplers / articulation joints
    eachEnd(v, lay, false, (vv, et, shared) => {
      if (et === 'artic') vv.circle(0, 0, 90, 'BODY', { fill: '#ffffff' });
      else if (et === 'cab' || et === 'aux') vv.rect(0, -110, 160, 110, 'BODY');
      if (et !== 'artic' && !(shared && et !== 'cab')) vv.rect(et === 'cab' || et === 'aux' ? 160 : 0, -60, bodyF + 250, 60, 'BODY_THIN');
    });
    const PWc = TLT.powerCfg(cfg);
    TLT.shoeLayout(lay, cfg).forEach(xs => [-1, 1].forEach(k => { const yo = Math.min(PWc.railOffset, hw + 150); v.rect(xs - 260, k * (yo - 120), xs + 260, k * (yo + 120), 'BOGIE', { fill: '#5a5a5a' }); v.line(xs, k * 1050, xs, k * (yo - 120), 'BOGIE'); }));
    // centre lines
    v.line(-200, 0, Lc + 200, 0, 'CENTER');
    v.line(mid, -hw - 400, mid, hw + 400, 'CENTER');
    // bogies
    lay.bogieInfo.forEach(bg => {
      const xb = bg.x, motor = bg.motor;
      v.rect(xb - wb / 2 - 420, -1050, xb + wb / 2 + 420, 1050, 'BOGIE', { fill: '#fdf1ef' });
      [-1, 1].forEach(k => {
        const xa = xb + k * wb / 2;
        v.line(xa, -900, xa, 900, 'BOGIE');
        [-1, 1].forEach(sd => v.rect(xa - D / 2, sd * 717.5, xa + D / 2, sd * 852.5, 'BOGIE', { fill: '#ffffff' }));
        if (motor) v.rect(xb + k * (wb / 2 - 520) - 260, -550, xb + k * (wb / 2 - 520) + 260, 550, 'BOGIE', { fill: '#f3c6c0' });
      });
      v.line(xb, -hw - 250, xb, hw + 250, 'CENTER');
    });
    // equipment boxes (underframe only)
    lay.equipment.items.filter(e => e.loc === 'under').forEach(e => {
      const xc = mid - e.x, x0 = xc - e.length / 2, x1 = xc + e.length / 2;
      const y0 = e.y - e.width / 2, y1 = e.y + e.width / 2;
      v.rect(x0, y0, x1, y1, 'EQUIP', { fill: true });
      labelIn(v, e.name, x0, x1, e.y, 1.8, 'EQUIP');
    });
  }

  function drawRoofPlan(v, lay, cfg) {
    const { bodyF, bodyR, Lc, W, type, mid } = lay;
    const hw = W / 2;
    v.poly(planOutline(lay), true, 'BODY', { fill: '#fafbfc' });
    v.rect(bodyF + (lay.cab1 ? 900 : 150), -hw + 180, bodyR - (lay.cab2 ? 900 : 150), hw - 180, 'BODY_THIN');
    v.line(-200, 0, Lc + 200, 0, 'CENTER');
    v.line(mid, -hw - 400, mid, hw + 400, 'CENTER');
    lay.bogies.forEach(xb => v.line(xb, -hw - 250, xb, hw + 250, 'CENTER'));
    lay.equipment.items.filter(e => e.loc === 'roof').forEach(e => {
      const xc = mid - e.x, x0 = xc - e.length / 2, x1 = xc + e.length / 2, y0 = e.y - e.width / 2, y1 = e.y + e.width / 2;
      v.rect(x0, y0, x1, y1, 'ROOF', { fill: true });
      if (e.kind === 'ac') { const r = Math.min(e.width, e.length) * 0.18; v.circle(xc - e.length / 4, e.y, r, 'ROOF'); v.circle(xc + e.length / 4, e.y, r, 'ROOF'); }
      if (e.kind === 'panto') { v.line(x0, y0, x1, y1, 'ROOF', { lw: 0.13 }); v.line(x0, y1, x1, y0, 'ROOF', { lw: 0.13 }); }
      labelIn(v, e.name, x0, x1, e.y, 1.8, 'ROOF');
    });
  }

  function underframeSheet(R, size, lay) {
    const cfg = R.cfg, c = cfg.common;
    const [PW, PH] = size;
    const maxH = Math.max(num(c.maxHeight, 4100), num(c.roofHeight, 3650) + 450);
    const hasRoof = lay.equipment.items.some(e => e.loc === 'roof');
    const nRows = lay.equipment.items.length + 1;
    let scale = pickScale((lay.Lc + 2500) / (PW - 60));
    const need = sc => maxH / sc + 30 + lay.W / sc + (hasRoof ? 26 + lay.W / sc : 0) + 26 + Math.min(4.4, 3.4) * nRows;
    while (need(scale) > PH - 42 - 52 && scale < 400) scale = pickScale(scale + 1);
    const s = scale;
    const ox = 25 + ((PW - 60) - lay.Lc / s) / 2;
    const oy = PH - 42 - maxH / s;
    const v = new View(scale, ox, oy);
    const p = new View(1, 0, 0);
    const t = lay.type;
    const items = lay.equipment.items;
    const under = items.filter(e => e.loc === 'under'), roof = items.filter(e => e.loc === 'roof');
    const fh = num(c.floorHeight, 1130), sole = fh - num(c.mountDepth, 250);
    p.text(20, PH - 19, `UNDERFRAME & ROOF EQUIPMENT LAYOUT — ${t.name.toUpperCase()} CAR`, 4.2, { bold: true });
    p.text(20, PH - 24.5, `${t.desc || ''}  ·  ${under.length} underframe items  ·  ${roof.length} roof items  ·  source: ${cfg.equipmentSource || 'equipment list'}`, 2.2, { color: '#444444' });

    // Side elevation
    v.line(-1200, 0, lay.Lc + 1200, 0, 'RAIL');
    v.setTf(0, false, lay.Lc, false, 0);
    drawCarSide(v, lay, cfg, { detail: true });
    v.clearTf();
    v.line(lay.mid, -300, lay.mid, maxH + 300, 'CENTER');
    v.text(lay.mid, maxH + 2.2 * s, 'CAR CENTRE', 1.8, { anchor: 'middle', color: '#555555' });
    v.text(-9 * s, fh + 1400, 'END 1', 2.2, { anchor: 'end', bold: true });
    v.text(lay.Lc + 19 * s, fh + 1400, 'END 2', 2.2, { anchor: 'start', bold: true });
    v.dimChainH([...new Set([0, ...lay.bogies, lay.mid, lay.Lc])].sort((a, b) => a - b), 0, -5 * s, { h: 1.9 });
    v.dimChainH([0, lay.Lc], 0, -10 * s, { h: 2.1 });
    v.dimV(lay.Lc, 0, fh, lay.Lc + 6 * s, { h: 1.8 });
    v.dimV(lay.Lc, 0, sole, lay.Lc + 11 * s, { h: 1.8 });
    const low = under.reduce((m, e) => (!m || e.height > m.height ? e : m), null);
    if (low) {
      const xc = lay.mid - low.x;
      v.dimV(xc - low.length / 2, 0, sole - low.height, xc - low.length / 2 - 2.5 * s, { h: 1.7, label: `${Math.round(sole - low.height)}` });
    }

    const W = lay.W;
    // Roof plan (viewed from above)
    let planRY = null;
    if (hasRoof) {
      planRY = -(26 * s) - W / 2;
      v.setTf(0, false, lay.Lc, true, planRY);
      drawRoofPlan(v, lay, cfg);
      v.clearTf();
    }
    // Underframe plan (viewed from above, floor removed)
    const planY = hasRoof ? planRY - W - 30 * s : -(30 * s) - W / 2;
    v.setTf(0, false, lay.Lc, true, planY);
    drawUnderframePlan(v, lay, cfg);
    v.clearTf();
    const top = planY + W / 2, bot = planY - W / 2;
    // ordinate dimensions of box centres from car centre: side A above, side B below
    const ord = (list, sign, pYArg) => {
      const pY = pYArg == null ? planY : pYArg;
      if (!list.length && pYArg != null) return;
      const top = pY + W / 2, bot = pY - W / 2;
      const yRow = sign > 0 ? top + 5 * s : bot - 5 * s;
      v.add({ t: 'L', x1: lay.mid, y1: pY + sign * W / 2, x2: lay.mid, y2: yRow + sign * 1 * s, ly: 'DIM' });
      v.add({ t: 'T', x: lay.mid - 0.6 * s, y: yRow + sign * 1.2 * s + (sign > 0 ? 0 : -1.4 * s), s: '0', h: 1.7 * s, anchor: 'end', valign: 'base', rot: 0, ly: 'DIM' });
      list.forEach(e => {
        const xc = lay.mid - e.x;
        const yEdge = pY + e.y + sign * e.width / 2;
        v.add({ t: 'L', x1: xc, y1: yEdge + sign * 0.6 * s, x2: xc, y2: yRow + sign * 1 * s, ly: 'DIM' });
        v.add({ t: 'L', x1: xc - 0.6 * s, y1: yRow - 0.6 * s, x2: xc + 0.6 * s, y2: yRow + 0.6 * s, ly: 'DIM', lw: 0.3 });
        const lab = `${e.x > 0 ? '+' : ''}${Math.round(e.x)}`;
        const tw = v.tw(lab, 1.7);
        v.add({ t: 'T', x: xc - 0.5 * s, y: sign > 0 ? yRow + 1.2 * s : yRow - 1.2 * s - tw, s: lab, h: 1.7 * s, anchor: 'start', valign: 'base', rot: 90, ly: 'DIM' });
      });
      if (list.length) {
        const xs = list.map(e => lay.mid - e.x).concat([lay.mid]);
        v.add({ t: 'L', x1: Math.min(...xs), y1: yRow, x2: Math.max(...xs), y2: yRow, ly: 'DIM' });
      }
    };
    ord(under.filter(e => e.y >= 0), 1);
    ord(under.filter(e => e.y < 0), -1);
    if (hasRoof) {
      ord(roof.filter(e => e.y >= 0), 1, planRY);
      ord(roof.filter(e => e.y < 0), -1, planRY);
      v.text(-9 * s, planRY + 200, 'ROOF', 1.9, { anchor: 'end', bold: true, color: '#9a5b12' });
      v.text(-9 * s, planRY + W / 2 - 300, 'SIDE A', 1.8, { anchor: 'end', bold: true, color: '#555555' });
      v.text(-9 * s, planRY - W / 2 + 100, 'SIDE B', 1.8, { anchor: 'end', bold: true, color: '#555555' });
      v.text(-9 * s, planY + 200, 'UNDERFRAME', 1.9, { anchor: 'end', bold: true, color: '#0b6e8a' });
      v.dimV(lay.Lc, planRY - W / 2, planRY + W / 2, lay.Lc + 6 * s, { h: 1.8 });
    }
    v.text(-9 * s, planY + W / 2 - 300, 'SIDE A', 1.8, { anchor: 'end', bold: true, color: '#555555' });
    v.text(-9 * s, planY - W / 2 + 100, 'SIDE B', 1.8, { anchor: 'end', bold: true, color: '#555555' });
    v.dimV(lay.Lc, planY - W / 2, planY + W / 2, lay.Lc + 6 * s, { h: 1.8 });
    v.text(0, bot - 14 * s, `${hasRoof ? 'ROOF PLAN and ' : ''}UNDERFRAME PLAN — viewed from above${hasRoof ? '' : ', floor removed'}. X values = equipment centre from car centre (+ towards END 1).`, 1.8, { color: '#555555' });

    // Equipment table
    const yT = oy + (bot / s) - 22;
    const all = under.concat(roof);
    const avail = yT - 52;
    const rowH = Math.min(4.4, avail / Math.max(1, all.length + 1));
    const th = Math.min(1.9, rowH * 0.45);
    const cols = [{ h: 'No.', w: 9, align: 'middle' }, { h: 'Equipment', w: 30 }, { h: 'Location', w: 20 }, { h: 'L', w: 14, align: 'end' }, { h: 'W', w: 14, align: 'end' },
      { h: 'H', w: 14, align: 'end' }, { h: 'X from centre', w: 22, align: 'end' }, { h: 'Y from CL', w: 20, align: 'end' }, { h: 'Bottom / top ATR', w: 30, align: 'end' }];
    const rows = all.map((e, i) => [i + 1, e.name, e.loc === 'roof' ? 'Roof' : 'Underframe', i0(e.length), i0(e.width), i0(e.height), `${e.x > 0 ? '+' : ''}${Math.round(e.x)}`, `${e.y > 0 ? '+' : ''}${Math.round(e.y)}`,
      e.loc === 'roof' ? `top ${Math.round(num(c.roofHeight, 3650) + e.height)}` : `${Math.round(sole - e.height)}`]);
    if (all.length) table(p, 20, yT, cols, rows, { rowH, h: th });
    else p.text(20, yT - 5, 'No equipment rows for this car type. Upload or edit the equipment list in the Underframe Input tab.', 2.2, { color: '#b3261e' });
    legend(p, 240, yT - 2, [
      { ly: 'EQUIP', label: 'Underframe equipment', kind: 'box' },
      { ly: 'ROOF', label: 'Roof equipment (side view)', kind: 'box' },
      { ly: 'BOGIE', label: 'Bogie envelope / motor', kind: 'box' },
      { ly: 'CENTER', label: 'Car / bogie centre line', kind: 'line' },
    ]);
    p.text(240, yT - 26, `Mounting face ${num(c.mountDepth, 250)} mm below floor (${Math.round(sole)} mm ATR).`, 1.8, { color: '#555555' });
    return { title: `Underframe & roof equipment — ${t.name}`, short: `${t.name} underframe`, size, scale, views: [v], paper: p };
  }
  const fmtKg = m => `${Math.round(m).toLocaleString('en-US')} kg`;

  /* ================= Weight sheets ================= */
  TLT.buildWeightSheets = function (R) {
    const cfg = R.cfg;
    const paper = TLT.PAPER[cfg.project.paper] || TLT.PAPER.A3;
    const W = R.weights;
    const sheets = R.used.map(n => weightSheet(R, paper, W.perType.get(n)));
    sheets.push(weightTrainSheet(R, paper));
    finish(sheets, cfg, '-WT');
    return sheets;
  };
  const t2 = kg => (Number.isFinite(kg) ? (kg / 1000).toFixed(2) : '—');
  const sgn = v => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${Math.round(v)}` : '—');
  const okC = (val) => (val === 'EXCEEDED' ? '#b3261e' : val === 'OK' ? '#0f7a63' : undefined);

  function weightSheet(R, size, w) {
    const cfg = R.cfg, W = R.weights;
    const [PW, PH] = size;
    const p = new View(1, 0, 0);
    const lay = w.lay, t = lay.type;
    p.text(20, PH - 19, `WEIGHT CALCULATION — ${t.name.toUpperCase()} CAR`, 4.2, { bold: true });
    p.text(20, PH - 24.5, `${t.desc || ''}  ·  calculated tare ${t2(w.tareKg)} t (car body ${t2(w.bodyMass)} t + bogies ${t2(w.bogieMass)} t)  ·  target ${Number.isFinite(w.target) ? t2(w.target) + ' t' : '—'}  ·  source: ${cfg.weightSource || 'weight list'}`, 2.2, { color: '#444444' });
    const yTop = PH - 32;
    p.text(20, yTop, '1. MASS LIST (AW0) — X from car centre (+ END 1), Y from centre line (+ side A), Z above top of rail', 2.4, { bold: true });
    const nRows = w.items.length + 6;
    const cases = w.cases;
    const avail = yTop - 3 - 52 - (cases.length + 1) * 4.4 - 22;
    const rowH = Math.max(2.6, Math.min(4.2, avail / nRows));
    const th = Math.min(1.85, rowH * 0.47);
    const cols = [{ h: 'No.', w: 8, align: 'middle' }, { h: 'Location', w: 18 }, { h: 'Item', w: 64 }, { h: 'L', w: 14, align: 'end' }, { h: 'W', w: 14, align: 'end' }, { h: 'H', w: 14, align: 'end' },
      { h: 'X', w: 17, align: 'end' }, { h: 'Y', w: 15, align: 'end' }, { h: 'Z', w: 15, align: 'end' }, { h: 'Mass (kg)', w: 21, align: 'end' },
      { h: 'm·X (kg·m)', w: 22, align: 'end' }, { h: 'm·Y (kg·m)', w: 22, align: 'end' }, { h: 'm·Z (kg·m)', w: 22, align: 'end' }, { h: 'Carried by', w: PW - 40 - 266, align: 'start' }];
    const iv = v => (Number.isFinite(v) && v !== 0 ? fmtInt(v) : '—');
    const rows = w.items.map((it, i) => [i + 1, it.loc, it.name, iv(it.length), iv(it.width), iv(it.height), sgn(it.x), sgn(it.y), sgn(it.z) + (it.zAuto ? '*' : ''),
      it.hasMass ? fmtInt(it.mass) : 'missing', fmtInt(it.mass * it.x / 1000), fmtInt(it.mass * it.y / 1000), fmtInt(it.mass * it.z / 1000),
      it.loc === 'Bogie' && w.sx.length ? `Bogie ${w.supLabels[w.sx.reduce((k, x, j) => (Math.abs(it.x - x) < Math.abs(it.x - w.sx[k]) ? j : k), 0)]}` : 'Car body']);
    const base = rows.length;
    const body = w.items.filter(i => i.loc !== 'Bogie' || !w.sx.length);
    rows.push(['', '', 'CAR BODY (sprung)', '', '', '', '', '', '', fmtInt(w.bodyMass), fmtInt(body.reduce((a, i) => a + i.mass * i.x, 0) / 1000), fmtInt(body.reduce((a, i) => a + i.mass * i.y, 0) / 1000), fmtInt(body.reduce((a, i) => a + i.mass * i.z, 0) / 1000), '']);
    rows.push(['', '', 'BOGIES (unsprung)', '', '', '', '', '', '', fmtInt(w.bogieMass), '', '', '', w.supLabels.map((l, k) => `${l} ${fmtInt(w.bogAt[k])}`).join(' · ') || 'no bogie']);
    rows.push(['', '', 'CALCULATED TARE (AW0)  /  CoG', '', '', '', sgn(w.cg.x), sgn(w.cg.y), sgn(w.cg.z), fmtInt(w.tareKg), fmtInt(w.tareKg * w.cg.x / 1000), fmtInt(w.tareKg * w.cg.y / 1000), fmtInt(w.tareKg * w.cg.z / 1000), '']);
    rows.push(['', '', 'Target tare (Main Dimensions)', '', '', '', '', '', '', Number.isFinite(w.target) ? fmtInt(w.target) : '—', '', '', '', '']);
    rows.push(['', '', 'Difference (calculated - target)', '', '', '', '', '', '', Number.isFinite(w.diff) ? (w.diff > 0 ? '+' : '') + fmtInt(w.diff) : '—', Number.isFinite(w.diff) && w.target ? `${((w.diff / w.target) * 100).toFixed(1)} %` : '', '', '', '']);
    const yI = table(p, 20, yTop - 3, cols, rows, { rowH, h: th, boldRows: [base, base + 1, base + 2], shade: [base, base + 1, base + 2, base + 3, base + 4],
      colorFn: (ri, ci, val) => (val === 'missing' ? '#b3261e' : ri === base + 4 && ci === 9 && Number.isFinite(w.diff) && Math.abs(w.diff) > 0.03 * (w.target || 1) ? '#b3261e' : undefined) });
    p.text(20, yI - 3.2, '* Z not given: default height for the location. Bogie rows sit on the nearest support; all other rows are carried by the car body.', 1.6, { color: '#555555' });

    let y = yI - 9;
    p.text(20, y, '2. SUPPORT, AXLE AND WHEEL LOADS PER LOAD CASE (this car)', 2.4, { bold: true });
    // support columns: bogies of this car, or the two articulation joints of a suspended module
    const supCols = w.suspended ? ['END 1 joint', 'END 2 joint'] : w.supLabels;
    const supW = Math.max(26, Math.min(34, 68 / Math.max(1, supCols.length) + 10));
    const colsL = [{ h: 'Case', w: 24 }, { h: 'Pax', w: 14, align: 'end' }, { h: 'Gross (t)', w: 20, align: 'end' }, { h: 'CoG X', w: 17, align: 'end' }, { h: 'CoG Y', w: 15, align: 'end' }, { h: 'CoG Z', w: 15, align: 'end' }]
      .concat(supCols.map(l => ({ h: `${l} (t)`, w: supW, align: 'end' })), [{ h: 'Max axle (t)', w: 22, align: 'end' }, { h: 'Wheel imbal.', w: 22, align: 'end' }, { h: 'Axle check', w: 22, align: 'middle' }, { h: 'Imbal. check', w: 22, align: 'middle' }]);
    const ownOnly = !lay.shared[0] && !lay.shared[1] && !w.suspended && !R.form.cars.some((c, i) => c.type === t && [R.form.cars[i - 1], R.form.cars[i + 1]].some(n => n && R.layouts.get(n.type.name).axles === 0));
    const rowsL = cases.map(q => {
      const vals = w.suspended ? q.hinge.map(h => t2(h.F)) : q.sup.map(sp => t2(sp.F));
      const ax = q.sup.reduce((m, sp) => Math.max(m, sp.axle), 0), im = q.sup.reduce((m, sp) => Math.max(m, sp.imb), 0);
      return [q.name, q.pax, t2(q.mass), sgn(q.xg), sgn(q.yg), sgn(q.zg)].concat(vals, [w.suspended ? '—' : t2(ax), w.suspended ? '—' : `${im.toFixed(1)} %`,
        ownOnly ? (ax <= W.maxAxle * 1000 + 1e-6 ? 'OK' : 'EXCEEDED') : 'see train', ownOnly ? (im <= W.limit + 1e-9 ? 'OK' : 'EXCEEDED') : 'see train']);
    });
    const yL = table(p, 20, y - 3, colsL, rowsL, { rowH: 4.4, h: 1.85, colorFn: (ri, ci, val) => okC(val) });
    const notes = [
      `Passengers ${W.paxKg} kg: seated at the seat centroid (X ${sgn(w.seatX)}), standing at the standing-area centroid (X ${sgn(w.standX)}), on the centre line.`,
      w.suspended ? 'Suspended module (no bogie): body load goes to the two articulation joints by the lever rule and is carried by the neighbouring modules (see train sheet).'
        : `Supports at X ${w.sx.map((x, k) => `${sgn(x)} (${w.supLabels[k]})`).join(', ')}. ${w.sx.length === 1 ? 'One bogie carries the whole car body; the articulation joints transmit moments only.' : 'Car-body reactions from the body CoG by the lever rule.'} Bogie rows added to their support. Axle load = support load ÷ 2.`,
      `Wheel load imbalance = |lateral moment| ÷ (wheel spacing ${W.wheelSpacing} mm × support load / 2), i.e. deviation of the wheel load from half the axle load. Limit ${W.limit} %, axle load limit ${W.maxAxle} t.`,
      lay.shared[0] || lay.shared[1] ? 'Shared (Jacobs) supports: values are this car\'s share only; the train sheet adds the neighbouring car.' : '',
    ].filter(Boolean);
    notes.forEach((tx, i) => p.text(20, yL - 5 - i * 3.8, tx, 1.75, { color: '#444444' }));
    return { title: `Weight calculation — ${t.name}`, short: `${t.name} weight`, size, scale: 0, dxfScale: 100, views: [], paper: p };
  }

  function weightTrainSheet(R, size) {
    const cfg = R.cfg, W = R.weights;
    const [PW, PH] = size;
    const p = new View(1, 0, 0);
    const cases = cfg.cases || [];
    p.text(20, PH - 19, 'WEIGHT CALCULATION — TRAIN, BOGIE AND AXLE LOADS', 4.2, { bold: true });
    p.text(20, PH - 24.5, `Formation ${cfg.formation.replace(/\s+/g, ' ')}  ·  ${W.bogies.length} bogies (${W.bogies.filter(b => b.parts.length > 1).length} shared)  ·  calculated train tare ${t2(W.tareTrain)} t`, 2.2, { color: '#444444' });
    let y = PH - 32;
    p.text(20, y, '1. AXLE LOAD PER BOGIE (t)  /  WHEEL LOAD IMBALANCE (%)', 2.6, { bold: true });
    const wc = Math.min(36, (PW - 40 - 84) / Math.max(1, cases.length));
    const cols = [{ h: 'Bogie', w: 14, align: 'middle' }, { h: 'Location', w: 48 }, { h: 'Pos. (mm)', w: 22, align: 'end' }].concat(cases.map(cs => ({ h: cs.name, w: wc, align: 'end' })));
    const n = W.bogies.length + 1;
    const rowH = Math.min(4.8, (y - 3 - 110) / n);
    const rows = W.bogies.map(bg => [bg.no, bg.label, fmtInt(bg.tx)].concat(bg.cases.map(q => `${t2(q.axle)} / ${q.imb.toFixed(1)}%`)));
    const yB = table(p, 20, y - 3, cols, rows, { rowH, h: Math.min(1.9, rowH * 0.45),
      colorFn: (ri, ci, val) => { if (ci < 3 || ri < 0) return undefined; const q = W.bogies[ri].cases[ci - 3]; return q.ok && q.imbOk ? undefined : '#b3261e'; } });
    y = yB - 9;
    p.text(20, y, '2. TRAIN CHECK', 2.6, { bold: true });
    const cols2 = [{ h: 'Item', w: 62 }].concat(cases.map(cs => ({ h: cs.name, w: wc, align: 'end' })));
    const rows2 = [
      ['Passengers'].concat(W.train.map(q => fmtInt(q.pax))),
      ['Train mass (t)'].concat(W.train.map(q => t2(q.mass))),
      ['Max. axle load (t)'].concat(W.train.map(q => t2(q.axle))),
      [`Axle load ≤ ${W.maxAxle} t`].concat(W.train.map(q => (q.ok ? 'OK' : 'EXCEEDED'))),
      ['Max. wheel load imbalance'].concat(W.train.map(q => `${q.imb.toFixed(1)} %`)),
      [`Imbalance ≤ ${W.limit} %`].concat(W.train.map(q => (q.imbOk ? 'OK' : 'EXCEEDED'))),
    ];
    const y2 = table(p, 20, y - 3, cols2, rows2, { rowH: 4.8, h: 1.95, boldRows: [3, 5], colorFn: (ri, ci, val) => okC(val) });
    y = y2 - 9;
    p.text(20, y, '3. CAR MASSES (t)', 2.6, { bold: true });
    const cols3 = [{ h: 'Car', w: 12, align: 'middle' }, { h: 'Type', w: 16, align: 'middle' }, { h: 'Supports', w: 34, align: 'middle' }, { h: 'Car body', w: 20, align: 'end' }, { h: 'Bogies', w: 20, align: 'end' },
      { h: 'Tare calc.', w: 20, align: 'end' }, { h: 'Tare target', w: 20, align: 'end' }].concat(cases.map(cs => ({ h: cs.name, w: Math.min(24, (PW - 40 - 142) / Math.max(1, cases.length)), align: 'end' })));
    const rows3 = R.form.cars.map(car => {
      const w = W.perType.get(car.type.name);
      const sp = w.suspended ? 'suspended' : w.lay.bogieInfo.map(bg => (bg.shared ? 'shared' : bg.end === 0 ? 'centre' : 'own')).join(' / ');
      return [car.no, car.label, sp, t2(w.bodyMass), t2(w.bogieMass), t2(w.tareKg), t2(w.target)].concat(w.cases.map(q => t2(q.mass)));
    });
    const y3 = table(p, 20, y - 3, cols3, rows3, { rowH: Math.min(4.6, (y - 3 - 56) / (rows3.length + 1)), h: 1.85 });
    if (W.warnings.length) W.warnings.slice(0, 4).forEach((wn, i) => p.text(20, y3 - 5 - i * 3.8, '· ' + wn, 1.8, { color: '#b3261e' }));
    return { title: 'Weight calculation — train summary', short: 'Train weight', size, scale: 0, dxfScale: 100, views: [], paper: p };
  }
  const fmtInt = v => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '—');
})();
