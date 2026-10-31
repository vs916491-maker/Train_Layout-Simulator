/* Train Layout Tool — layout engine
 * Pure geometry + capacity calculations. No DOM access, so it also runs in Node for tests.
 * Units: millimetres for geometry, tonnes for mass.
 * Car local coordinates: x = 0 at the end-1 coupler face (cab end of a driving car),
 * x = couplerLength at the end-2 coupler face. y = 0 on the car centre line,
 * side A is +y (top of the plan view), side B is -y.
 */
(function () {
  'use strict';
  const TLT = (globalThis.TLT = globalThis.TLT || {});
  const EPS = 1e-6;

  const num = (v, d) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : d;
  };
  TLT.num = num;

  /* ---------------- Formation ---------------- */
  /* Formation text with the multiple-unit factor: unit, then the unit turned round, alternately (DM-T-M-T | T'-M'-T'-DM') */
  TLT.muFactor = cfg => Math.max(1, Math.min(6, Math.round(num(cfg.muFactor, 1))));
  TLT.formationText = function (cfg) {
    const base = String(cfg.formation || '').replace(/\s+/g, ' ').trim();
    const n = TLT.muFactor(cfg);
    if (n === 1) return base;
    const turn = tok => (tok.endsWith('*') ? tok.slice(0, -1) : tok.endsWith("'") ? tok.slice(0, -1) : tok + "'");
    const rev = base.split('|').map(u => u.trim().split(/[\s,\-]+/).filter(Boolean)).reverse().map(u => u.reverse().map(turn).join('-')).join(' | ');
    const parts = [];
    for (let k = 0; k < n; k++) parts.push(k % 2 ? rev : base);
    return parts.join(' | ');
  };
  TLT.parseFormation = function (str, types) {
    const errors = [];
    const cars = [];
    const units = String(str || '').split('|').map(s => s.trim()).filter(Boolean);
    units.forEach((u, ui) => {
      u.split(/[\s,\-]+/).map(s => s.trim()).filter(Boolean).forEach(tok => {
        let name = tok, flip = false;
        if (name.endsWith('*')) { flip = true; name = name.slice(0, -1); }
        let type = types.find(t => t.name === name);
        if (!type && name.endsWith("'")) {
          // X' not defined → use type X turned round (Japanese "dash" convention)
          type = types.find(t => t.name === name.slice(0, -1));
          if (type) flip = !flip;
        }
        if (!type) { errors.push(`Car type "${name}" used in the formation is not defined.`); return; }
        cars.push({ label: name, type, flip, unit: ui });
      });
    });
    // Driving cars always face outwards at the train ends.
    cars.forEach((c, i) => {
      const E = TLT.carEnds(c.type);
      if (E.cab1 === E.cab2) return;            // no cab, or cabs at both ends
      if (i === 0) c.flip = !E.cab1;
      else if (i === cars.length - 1) c.flip = E.cab1;
    });
    let x = 0;
    cars.forEach((c, i) => { c.index = i; c.no = i + 1; c.x0 = x; x += num(c.type.couplerLength, 0); });
    return { cars, units: units.length, length: x, errors };
  };

  /* ---------------- Bay directives ----------------
   * One directive per line:  <bay> <side A|B|AB> <value>
   * value: integer (max seats) | none | wheelchair | cabinet[:length[:depth[:label]]]
   */
  TLT.parseBays = function (text) {
    const out = [];
    const errors = [];
    String(text || '').split(/\n|;/).forEach((raw, li) => {
      const line = raw.replace(/#.*/, '').trim();
      if (!line) return;
      const p = line.split(/\s+/);
      if (p.length < 3) { errors.push(`Bay rule "${line}": expected <bay> <side> <value>.`); return; }
      const bay = parseInt(p[0].replace(/^B/i, ''), 10);
      const side = p[1].toUpperCase();
      const val = p.slice(2).join(' ');
      if (!Number.isFinite(bay) || !/^(A|B|AB|BA)$/.test(side)) { errors.push(`Bay rule "${line}": bay number or side not recognised.`); return; }
      const sides = side.length === 2 ? ['A', 'B'] : [side];
      let d;
      if (/^\d+$/.test(val)) d = { kind: 'max', n: parseInt(val, 10) };
      else if (/^none$/i.test(val)) d = { kind: 'max', n: 0 };
      else if (/^(wheelchair|wc|pmr)$/i.test(val)) d = { kind: 'wheelchair' };
      else if (/^(cabinet|cab|cupboard)/i.test(val)) {
        const q = val.split(':');
        d = { kind: 'cabinet', length: num(q[1], 800), depth: num(q[2], NaN), label: q[3] || 'CUBICLE' };
      } else { errors.push(`Bay rule "${line}": value "${val}" not recognised.`); return; }
      sides.forEach(s => out.push(Object.assign({ bay, side: s }, d)));
    });
    return { rules: out, errors };
  };

  /* ---------------- Equipment list ----------------
   * One item per line:  NAME, roof|under, x-from-car-centre, length[, height[, kind]]
   * +x points towards end 1. kind: box | ac | panto (guessed from the name when omitted)
   */
  TLT.parseEquipment = function (text) {
    const items = [];
    const errors = [];
    String(text || '').split('\n').forEach(raw => {
      const line = raw.replace(/#.*/, '').trim();
      if (!line) return;
      const p = line.split(',').map(s => s.trim());
      if (p.length < 4) { errors.push(`Equipment "${line}": expected NAME, roof|under, x, length.`); return; }
      const loc = /^r/i.test(p[1]) ? 'roof' : 'under';
      let kind = (p[5] || '').toLowerCase();
      if (!kind) kind = loc === 'roof' && /^pan/i.test(p[0]) ? 'panto' : loc === 'roof' && /^(ac|hvac|a\/c)/i.test(p[0]) ? 'ac' : 'box';
      const height = num(p[4], loc === 'roof' ? 450 : 550);
      items.push({ name: p[0], loc, x: num(p[2], 0), y: 0, width: 800, mass: NaN, length: Math.max(50, num(p[3], 1000)), height, kind });
    });
    return { items, errors };
  };

  /* ---------------- Equipment table (Excel rows) ----------------
   * Row: { car, name, loc: 'roof'|'under', length, width, height, x, y, mass, kind }
   * x = centre offset from car centre, + towards END 1; y = offset from centre line, + towards side A.
   */
  TLT.guessKind = (name, loc) => (loc === 'roof' && /^pan/i.test(name) ? 'panto' : loc === 'roof' && /^(ac|hvac|a\/c)/i.test(name) ? 'ac' : loc === 'under' && /^ccd/i.test(name) ? 'ccd' : 'box');
  /* Symbol column: Auto, Eq. Box, Panto, CCD, HVAC (older files: box / ac / panto) */
  TLT.SYMBOLS = [['', 'Auto'], ['box', 'Eq. Box'], ['panto', 'Panto'], ['ccd', 'CCD'], ['ac', 'HVAC']];
  TLT.normKind = function (v) {
    const s = String(v == null ? '' : v).trim().toLowerCase();
    if (!s || s === 'auto') return '';
    if (/^(hvac|ac\b|a\/c|air)/.test(s)) return 'ac';
    if (/^pan/.test(s)) return 'panto';
    if (/^(ccd|shoe|current coll)/.test(s)) return 'ccd';
    if (/box|^eq/.test(s)) return 'box';
    return '';
  };
  TLT.symbolLabel = k => (TLT.SYMBOLS.find(q => q[0] === (k || '')) || TLT.SYMBOLS[0])[1];
  TLT.normEquipRow = function (r) {
    const loc = /^r/i.test(String(r.loc || '')) ? 'roof' : 'under';
    const kind = TLT.normKind(r.kind);
    return {
      cat: /^(m|w)/i.test(String(r.cat || '').trim()) ? 'mass' : 'equip',
      car: String(r.car == null ? '' : r.car).trim(),
      name: String(r.name == null ? '' : r.name).trim(),
      loc,
      length: num(r.length, NaN), width: num(r.width, NaN), height: num(r.height, NaN),
      x: num(r.x, NaN), y: num(r.y, 0), mass: num(r.mass, NaN),
      kind: kind || TLT.guessKind(String(r.name || ''), loc),
    };
  };
  TLT.equipmentFor = function (type, cfg) {
    if (!Array.isArray(cfg.equipment)) return TLT.parseEquipment(type.equipment);
    const items = [], errors = [];
    cfg.equipment.map(TLT.normEquipRow).filter(r => r.car === type.name && r.cat === 'equip').forEach(r => {
      if (!r.name || !Number.isFinite(r.x) || !(r.length > 0)) { errors.push(`Equipment row "${r.name || '?'}" needs a name, X and length.`); return; }
      items.push({
        name: r.name, loc: r.loc, x: r.x, y: r.y, length: r.length,
        width: Number.isFinite(r.width) && r.width > 0 ? r.width : 800,
        height: Number.isFinite(r.height) && r.height > 0 ? r.height : (r.loc === 'roof' ? 450 : 550),
        mass: r.mass, kind: r.kind,
      });
    });
    return { items, errors };
  };

  /* ---------------- Interior items (per car variant) ----------------
   * type.interiorItems: [{ kind: wheelchair|cabinet|max|none, bay, side: A|B|AB, place: door|end1|middle|end2, length, depth, height, label, n }]
   * Older inputs used a text field type.bays ("1 A wheelchair"); it is converted here.
   */
  TLT.interiorItems = function (type) {
    const out = [], errors = [];
    let src = type.interiorItems;
    if (!Array.isArray(src)) {
      const p = TLT.parseBays(type.bays);
      p.errors.forEach(e => errors.push(e));
      src = p.rules.map(q => ({ kind: q.kind === 'max' ? (q.n === 0 ? 'none' : 'max') : q.kind, bay: q.bay, side: q.side, place: 'door', length: q.length, depth: q.depth, label: q.label, n: q.n }));
    }
    src.forEach(q => {
      const kind = ['wheelchair', 'cabinet', 'max', 'none', 'toilet', 'toiletPrm'].includes(q.kind) ? q.kind : 'cabinet';
      if (kind === 'toilet' || kind === 'toiletPrm') {
        const prm = kind === 'toiletPrm';
        const side = String(q.side || 'A').toUpperCase() === 'B' ? 'B' : 'A';
        out.push({ kind: 'cabinet', toilet: prm ? 'prm' : 'std', bay: Math.round(num(q.bay, 0)), sides: [side], place: ['door', 'end1', 'middle', 'end2'].includes(q.place) ? q.place : 'door',
          length: num(q.length, prm ? 2100 : 1100), depth: num(q.depth, prm ? 1800 : 1200), height: NaN, label: prm ? 'PRM TOILET' : 'TOILET', n: 0 });
        return;
      }
      const bay = Math.round(num(q.bay, 0));
      const side = String(q.side || 'A').toUpperCase();
      const sides = side === 'AB' || side === 'BA' ? ['A', 'B'] : side === 'B' ? ['B'] : ['A'];
      const it = { kind: kind === 'none' ? 'max' : kind, bay, sides, place: ['door', 'end1', 'middle', 'end2'].includes(q.place) ? q.place : 'door',
        length: num(q.length, 900), depth: num(q.depth, 600), height: num(q.height, NaN), label: String(q.label || 'ELEC. CABINET'), n: kind === 'none' ? 0 : Math.max(0, Math.round(num(q.n, 0))) };
      if (kind === 'cabinet' && !(it.length > 0 && it.depth > 0)) { errors.push(`cabinet "${it.label}" needs a length and depth.`); return; }
      out.push(it);
    });
    return { items: out, errors };
  };

  /* ---------------- Product type, car ends, running gear ----------------
   * END types: cab (full driving cab), aux (auxiliary / shunting desk in the saloon end), gangway (open gangway to the
   * next car), wall (closed end wall), artic (articulation joint, tram / LRV).
   * Supports per end: own bogie, shared (Jacobs) bogie at the joint, none (overhang or carried by the articulation).
   * centreBogie: one bogie under the car centre (bogie module of a multi-module tram).
   */
  TLT.PRODUCT_TYPES = [['metro', 'Metro'], ['lrv', 'Light rail vehicle (LRV)'], ['mainline', 'Mainline EMU / DMU']];
  TLT.productType = cfg => (['metro', 'lrv', 'mainline'].includes(cfg.productType) ? cfg.productType : cfg.productType === 'tram' ? 'lrv' : 'metro');
  TLT.END_TYPES = [['cab', 'Driving cab'], ['aux', 'Auxiliary driving desk'], ['gangway', 'Gangway to next car'], ['wall', 'End wall (no gangway)'], ['artic', 'Articulation joint']];
  TLT.carEnds = function (type) {
    const ok = v => (['cab', 'aux', 'gangway', 'wall', 'artic'].includes(v) ? v : null);
    const e1 = ok(type.end1) || (type.cab === true || type.cab === 'true' ? 'cab' : 'gangway');
    const e2 = ok(type.end2) || 'gangway';
    const sp = v => (v === 'shared' || v === 'none' ? v : 'own');
    return { e1, e2, cab1: e1 === 'cab', cab2: e2 === 'cab', s1: sp(type.support1), s2: sp(type.support2), centre: type.centreBogie === true || type.centreBogie === 'true' };
  };
  TLT.hasCab = t => { const E = TLT.carEnds(t); return E.cab1 || E.cab2; };

  /* Power collection: 25 kV AC / 1500 V DC / 750 V DC; pantograph, third rail (CCD shoe gear) or both */
  TLT.POWER_SYSTEMS = [['25kV', '25 kV AC 50 Hz'], ['1500DC', '1500 V DC'], ['750DC', '750 V DC']];
  TLT.powerCfg = function (cfg) {
    const p = cfg.power || {};
    const system = ['25kV', '1500DC', '750DC'].includes(p.system) ? p.system : '1500DC';
    let collector = ['panto', 'third', 'both'].includes(p.collector) ? p.collector : 'panto';
    if (system === '25kV') collector = 'panto';
    const label = TLT.POWER_SYSTEMS.find(q => q[0] === system)[1];
    return { system, collector, label, panto: collector !== 'third', third: collector !== 'panto',
      contact: ['top', 'bottom', 'side'].includes(p.contact) ? p.contact : 'bottom',
      shoeCars: String(p.shoeCars == null ? '' : p.shoeCars).trim(), railOffset: num(p.railOffset, 1450), maxGap: num(p.maxGap, 0),
      maxPantos: Math.round(num(p.maxPantos, 0)), hvClearance: num(p.hvClearance, 270) };
  };

  /* Pantograph target per car variant (check only; blank = no check) */
  TLT.pantoTarget = t => { const v = num(t.pantos, NaN); return Number.isFinite(v) ? Math.max(0, Math.round(v)) : null; };
  /* Third-rail shoes of one car: total shoes per car (both sides) from the variant, placed on the bogies from END 1.
   * Returns the x positions (car local) of one side; the other side mirrors them. */
  TLT.shoeLayout = function (lay, cfg) {
    const P = TLT.powerCfg(cfg);
    const B = lay.bogieInfo;
    if (!P.third) return [];
    const rows = lay.equipment.items.filter(e => e.kind === 'ccd');
    if (rows.length) return [...new Set(rows.map(e => Math.round(lay.mid - e.x)))].sort((a, b) => a - b);   // CCD rows of the equipment list
    if (!B.length) return [];
    const anySet = (cfg.carTypes || []).some(t => num(t.ccd, 0) > 0);
    let n;
    if (anySet) n = Math.max(0, Math.round(num(lay.type.ccd, 0)));
    else {   // older inputs: list of car variants, one shoe per bogie side
      const list = P.shoeCars && !/^all$/i.test(P.shoeCars) ? P.shoeCars.split(/[\s,;]+/).filter(Boolean) : null;
      n = list && !list.includes(lay.type.name) ? 0 : 2 * B.length;
    }
    const perSide = Math.ceil(n / 2);
    if (!perSide) return [];
    const per = B.map(() => 0);
    for (let i = 0; i < perSide; i++) per[i % B.length]++;
    const xs = [];
    B.forEach((bg, i) => { const k = per[i]; for (let j = 0; j < k; j++) xs.push(bg.x + (j - (k - 1) / 2) * 700); });
    return xs.sort((a, b) => a - b);
  };

  /* Aerodynamic nose (mainline only): nose length and shape follow the design speed.
   * Classes: <=160 km/h blunt, 200 rounded, 250 streamlined, >=300 long high-speed nose; lengths interpolated in between. */
  TLT.aeroCfg = function (cfg) {
    const a = cfg.aero || {};
    const on = TLT.productType(cfg) === 'mainline';
    const V = Math.max(80, Math.min(400, num(a.speed, 160)));
    const tbl = [[120, 1200], [160, 1600], [200, 2600], [250, 4200], [300, 6800], [350, 9000], [400, 11000]];
    let auto = tbl[tbl.length - 1][1];
    for (let i = 1; i < tbl.length; i++) if (V <= tbl[i][0]) { const [v0, l0] = tbl[i - 1], [v1, l1] = tbl[i]; auto = l0 + ((Math.max(V, v0) - v0) * (l1 - l0)) / (v1 - v0); break; }
    const man = num(a.noseLength, 0);
    const f = Math.max(0, Math.min(1, (V - 160) / 140));        // 0 = blunt (160 km/h) … 1 = high speed (300 km/h)
    const cls = V <= 170 ? 'Blunt nose (≤ 160 km/h)' : V <= 220 ? 'Rounded nose (200 km/h)' : V <= 275 ? 'Streamlined nose (250 km/h)' : 'Long high-speed nose (≥ 300 km/h)';
    return { on, speed: V, noseLen: Math.round(man > 0 ? man : auto), auto: Math.round(auto), manual: man > 0, f, cls };
  };

  /* Car body cross-section (CAF standard sections). Side wall: inclined from the floor (Types 1, 5), vertical
   * (Type 2), or vertical up to the arc start z0 (= height of the arc centre) then R2000 turning into a straight
   * wall at the top angle (Types 3, 4; z0 = crossing of the extensions − R·tan(angle/2): 920 → 869.4, 874 → 769.2). */
  TLT.PROFILES = [
    { id: 't1', label: 'Type 1 – inclined wall 2.2°', kind: 'incl', z0: 0, angle: 2.2, R: 0, roofR: 420, camber: 0 },
    { id: 't2', label: 'Type 2 – vertical wall', kind: 'vert', z0: 0, angle: 0, R: 0, roofR: 420, camber: 0 },
    { id: 't3', label: 'Type 3 – R2000 wall, 2.9°', kind: 'arc', z0: 869.4, angle: 2.9, R: 2000, roofR: 420, camber: 0 },
    { id: 't4', label: 'Type 4 – R2000 wall 6°, cambered roof', kind: 'arc', z0: 769.2, angle: 6, R: 2000, roofR: 330, camber: 160 },
    { id: 't5', label: 'Type 5 – inclined wall 4°', kind: 'incl', z0: 0, angle: 4, R: 0, roofR: 420, camber: 0 },
  ];
  TLT.profileCfg = function (cfg) {
    const id = (cfg.common || {}).profile;
    const P = TLT.PROFILES.find(p => p.id === id) || TLT.PROFILES[1];
    return Object.assign({}, P, { refH: num((cfg.interior || {}).widthRefHeight, 1200) });
  };
  // horizontal inset of the side wall at height h above the floor (mm, each side)
  TLT.profileInset = function (P, h) {
    if (P.kind === 'vert' || h <= P.z0) return 0;
    const dz = h - P.z0, a = (P.angle * Math.PI) / 180;
    if (P.kind === 'incl') return dz * Math.tan(a);
    const dza = P.R * Math.sin(a);
    if (dz <= dza) return P.R - Math.sqrt(P.R * P.R - dz * dz);
    return P.R * (1 - Math.cos(a)) + (dz - dza) * Math.tan(a);
  };
  // right half of the section, floor (z = 0) up to the roof centre (z = H), half width at floor = halfW
  TLT.profileOutline = function (P, halfW, H) {
    const pts = [];
    const zw = H - P.camber - P.roofR;
    for (let z = 0; z < zw; z += 50) pts.push([halfW - TLT.profileInset(P, z), z]);
    const xw = halfW - TLT.profileInset(P, zw);
    pts.push([xw, zw]);
    const r = P.roofR, xc = xw - r, zc = zw;
    if (!(P.camber > 0)) {
      for (let k = 1; k <= 8; k++) { const t = (Math.PI / 2) * (k / 8); pts.push([xc + r * Math.cos(t), zc + r * Math.sin(t)]); }
      for (let k = 1; k <= 8; k++) pts.push([xc * (1 - k / 8), H]);
      return pts;
    }
    // cambered roof: large radius through the roof centre, tangent to the shoulder radius
    const d = H - zc, Rr = (xc * xc + d * d - r * r) / (2 * (d - r)), zr = H - Rr;
    const tt = Math.atan2(zc - zr, xc);
    for (let k = 1; k <= 8; k++) { const t = tt * (k / 8); pts.push([xc + r * Math.cos(t), zc + r * Math.sin(t)]); }
    for (let k = 1; k <= 10; k++) { const t = tt + (Math.PI / 2 - tt) * (k / 10); pts.push([Rr * Math.cos(t), zr + Rr * Math.sin(t)]); }
    return pts;
  };

  /* ---------------- Driver's cab, windows, front view ---------------- */
  TLT.cabCfg = function (cfg) {
    const c = cfg.cab || {};
    const on = v => v === true || v === 'true';
    return { desk: c.desk === 'central' ? 'central' : 'side', deskSide: c.deskSide === 'A' ? 'A' : 'B', observer: c.observer == null ? true : on(c.observer),
      goa4: on(c.goa4), consoleDepth: num(c.consoleDepth, 700), deskDepth: num(c.deskDepth, 800), deskWidth: num(c.deskWidth, 1400),
      auxLength: num(c.auxLength, 700), auxDepth: num(c.auxDepth, 1000), auxSide: c.auxSide === 'A' ? 'A' : 'B',
      coDesk: on(c.coDesk), coDeskWidth: num(c.coDeskWidth, 650) };
  };
  TLT.windowCfg = function (cfg) {
    const w = cfg.windows || {};
    const t = v => (['single', 'double', 'none'].includes(v) ? v : 'single');
    return { inner: t(w.inner), end: t(w.end), singleWidth: num(w.singleWidth, 0), doubleWidth: num(w.doubleWidth, 1000), height: num(w.height, 900), sill: num(w.sill, 820),
      drop: ['none', 'ends', 'all'].includes(w.drop) ? w.drop : 'ends', dropDepth: num(w.dropDepth, 400),
      doorWin: w.doorWin == null ? true : (w.doorWin === true || w.doorWin === 'true'), doorWinWidth: num(w.doorWinWidth, 0), doorWinHeight: num(w.doorWinHeight, 750), doorWinSill: num(w.doorWinSill, 950) };
  };
  TLT.frontCfg = function (cfg) {
    const f = cfg.front || {}, c = cfg.common || {};
    return { wipers: Math.max(0, Math.min(3, Math.round(num(f.wipers, 2)))), wiperType: f.wiperType === 'pantograph' ? 'pantograph' : 'single',
      lightsZ: num(f.lightsZ, 350), lightsInset: num(f.lightsInset, 420), destination: f.destination == null ? true : (f.destination === true || f.destination === 'true'),
      couplerHeight: num(f.couplerHeight, 720), gaugeWidth: num(f.gaugeWidth, 3000), gaugeHeight: num(f.gaugeHeight, num(c.maxHeight, 4100)),
      showGauge: f.showGauge == null ? true : (f.showGauge === true || f.showGauge === 'true'),
      // windscreen: bottom / top above floor (top 0 = up to the destination display), split, gap to an offset detrainment door
      wsBottom: num(f.wsBottom, 900), wsTop: num(f.wsTop, 0), wsSplit: f.wsSplit === 'two' ? 'two' : 'single', wsDoorGap: num(f.wsDoorGap, 150),
      wiperLength: num(f.wiperLength, 0) };
  };

  /* Mainline interior (product type Mainline EMU / DMU only) */
  TLT.mainlineCfg = function (cfg) {
    const r = cfg.interior || {};
    const ab = v => { const m = String(v || '').match(/^(\d)\s*\+\s*(\d)$/); return m ? [Math.min(4, +m[1]), Math.min(4, +m[2])] : null; };
    return {
      on: TLT.productType(cfg) === 'mainline',
      std: { abreast: ab(r.mlStdAbreast) || [2, 2], pitch: num(r.mlStdPitch, 850), seatW: num(r.seatWidth, 450) },
      first: { abreast: ab(r.mlFirstAbreast) || [2, 1], pitch: num(r.mlFirstPitch, 1000), seatW: num(r.mlFirstSeatWidth, 520) },
      arrangement: r.mlArrangement === 'airline' ? 'airline' : 'facing',
      seatLen: num(r.mlSeatLength, 520),
      vestibules: r.mlVestibules == null ? true : (r.mlVestibules === true || r.mlVestibules === 'true'),
      vestLength: num(r.mlVestLength, 2500), vestDoor: num(r.mlVestDoor, 900),
    };
  };

  /* ---------------- Door system ---------------- */
  TLT.doorCfg = function (cfg) {
    const c = cfg.common || {}, d = cfg.doors || {};
    const on = v => v === true || v === 'true' || v === 1;
    const ds = d.detrain || {}, cs = d.cabSide || {}, cd = d.cabSaloon || {};
    return {
      type: d.type || 'Bi-parting sliding (pocket)',
      width: num(d.width, num(c.doorWidth, 1500)),
      height: num(d.height, num(c.doorHeight, 1850)),
      detrain: { on: ds.on == null ? true : on(ds.on), width: num(ds.width, 800), height: num(ds.height, 1800) },
      cabSide: { on: cs.on == null ? true : on(cs.on), width: num(cs.width, num(c.cabDoorWidth, 600)), height: num(cs.height, num(d.height, 1850)), pos: num(cs.pos, NaN) },
      cabSaloon: { on: cd.on == null ? true : on(cd.on), width: num(cd.width, 700), height: num(cd.height, 1900), y: num(cd.y, 0), type: cd.type || 'Hinged' },
    };
  };

  /* ---------------- Car geometry & interior ---------------- */
  TLT.layoutCar = function (type, cfg) {
    const c = cfg.common, r = cfg.interior;
    const warn = [];
    const Lc = num(type.couplerLength, 20000);
    const Lb = Math.min(num(type.bodyLength, Lc), Lc);
    const prot = (Lc - Lb) / 2;
    const bodyF = prot, bodyR = Lc - prot, mid = Lc / 2;
    const E = TLT.carEnds(type);
    // Running gear: own bogie at ± half the bogie centres, shared (Jacobs) bogie at the joint, none, and/or a centre bogie
    const sh1 = E.s1 === 'shared', sh2 = E.s2 === 'shared', h1 = E.s1 === 'none', h2 = E.s2 === 'none';
    const bcIn = num(type.bogieCentres, 13800);
    const bogieInfo = [];
    if (!h1) bogieInfo.push({ x: sh1 ? 0 : mid - bcIn / 2, end: 1, shared: sh1 });
    if (E.centre) {
      if (!h1 && !h2) warn.push(`${type.name}: centre bogie is ignored because both ends already have a bogie.`);
      else bogieInfo.push({ x: mid, end: 0, shared: false });
    }
    if (!h2) bogieInfo.push({ x: sh2 ? Lc : mid + bcIn / 2, end: 2, shared: sh2 });
    bogieInfo.sort((p, q) => p.x - q.x);
    // motor bogies counted from END 2 ('1e1' = one motor bogie at the END 1 side)
    const e1Motor = String(type.motorBogies) === '1e1';
    const nMot = e1Motor ? 1 : Math.max(0, Math.min(bogieInfo.length, Math.round(num(type.motorBogies, 0))));
    bogieInfo.forEach((bg, i) => { bg.motor = e1Motor ? i === 0 : i >= bogieInfo.length - nMot; });
    const bogies = bogieInfo.map(bg => bg.x);
    const bc = bogies.length >= 2 ? bogies[bogies.length - 1] - bogies[0] : 0;
    const axles = bogieInfo.reduce((a, bg) => a + (bg.shared ? 1 : 2), 0);
    if (!bogieInfo.length && !(E.e1 === 'artic' && E.e2 === 'artic')) warn.push(`${type.name}: car has no bogie; a suspended module needs articulation joints at both ends.`);
    [[1, E.s1, E.e1], [2, E.s2, E.e2]].forEach(([k, sp, et]) => {
      if (sp === 'shared' && et !== 'artic' && et !== 'gangway') warn.push(`${type.name}: shared (Jacobs) bogie at END ${k} needs an articulation joint or gangway at that end.`);
    });

    const W = num(c.bodyWidth, 2950);
    const Wi = W - 2 * num(c.wallThk, 60);
    const DC = TLT.doorCfg(cfg);
    const dw = DC.width;
    const nDoors = Math.max(0, Math.round(num(type.doorsPerSide, 4)));
    const pitch = num(type.doorPitch, 4820);
    const rearOff = num(type.doorRearOffset, 2770);
    const doors = [];
    for (let k = 0; k < nDoors; k++) doors.push(Lc - rearOff - k * pitch);
    doors.sort((a, b) => a - b);

    const cabLen = E.cab1 ? num(type.cabLength, 2000) : 0;
    const cabLen2 = E.cab2 ? num(type.cabLength2, num(type.cabLength, 2000)) : 0;
    const endWall = num(c.endWallThk, 150);
    const salStart = E.cab1 ? bodyF + cabLen : bodyF + endWall;
    const salEnd = E.cab2 ? bodyR - cabLen2 : bodyR - endWall;
    // GoA4: cab back wall removed, cab floor behind the covered front console counts as standing area
    const CB = TLT.cabCfg(cfg);
    const openCab = !!(E.cab1 && CB.goa4), openCab2 = !!(E.cab2 && CB.goa4);
    const standStart = openCab ? Math.min(salStart, bodyF + Math.max(300, CB.consoleDepth)) : salStart;
    const standEnd = openCab2 ? Math.max(salEnd, bodyR - Math.max(300, CB.consoleDepth)) : salEnd;
    if ((openCab || openCab2) && CB.consoleDepth < 650) warn.push(`${type.name}: front console zone ${CB.consoleDepth} mm is shorter than the cab nose (about 650 mm).`);
    if (salEnd <= salStart) warn.push(`${type.name}: saloon length is zero or negative — check body/cab length.`);

    doors.forEach((d, i) => {
      if (d - dw / 2 < salStart - EPS || d + dw / 2 > salEnd + EPS)
        warn.push(`${type.name}: door ${i + 1} (centre ${Math.round(d)} mm) is outside the saloon.`);
    });
    for (let i = 1; i < doors.length; i++) if (doors[i] - doors[i - 1] < dw) warn.push(`${type.name}: doors ${i} and ${i + 1} overlap.`);

    // Bays: saloon start → door 1, door i → door i+1, last door → saloon end
    const bays = [];
    let prev = { x: salStart, kind: E.cab1 ? 'cab' : 'end' };
    doors.forEach(d => { bays.push({ i: bays.length, x0: prev.x, x1: d - dw / 2, k0: prev.kind, k1: 'door' }); prev = { x: d + dw / 2, kind: 'door' }; });
    bays.push({ i: bays.length, x0: prev.x, x1: salEnd, k0: prev.kind, k1: E.cab2 ? 'cab' : 'end' });
    const lastBay = bays.length - 1;

    const itemsIn = TLT.interiorItems(type);
    itemsIn.errors.forEach(e => warn.push(`${type.name}: ${e}`));
    // Auxiliary driving desk: a fixed block against the end wall of an end bay
    [[1, E.e1], [2, E.e2]].forEach(([k, et]) => {
      if (et !== 'aux') return;
      itemsIn.items.push({ kind: 'cabinet', aux: true, bay: k === 1 ? 0 : lastBay, sides: [CB.auxSide], place: k === 1 ? 'end1' : 'end2',
        length: CB.auxLength, depth: CB.auxDepth, height: 1100, label: 'AUX. DESK', n: 0 });
    });
    itemsIn.items.forEach(it => { if (it.bay < 0 || it.bay >= bays.length) warn.push(`${type.name}: interior item refers to B${it.bay}, but this car has B0–B${bays.length - 1}.`); });

    const seatW = num(r.seatWidth, 430), seatD = num(r.seatDepth, 550), foot = num(r.footZone, 300);
    const dClr = num(r.doorClearance, 330), eClr = num(r.endClearance, 0);
    const ML = TLT.mainlineCfg(cfg);
    const trans = !ML.on && r.seatType === 'transverse';
    const tPerSide = Math.max(1, Math.round(num(r.transSeatsPerSide, 2)));
    const tDepth = num(r.transSeatDepth, 450);
    const tLeg = num(r.transLegroom, 600);
    const wcL = num(r.wcLength, 1300), wcW = num(r.wcWidth, 700);
    const clr = k => (k === 'door' ? dClr : eClr);
    // Seats per bay between doors (6 / 7 / 8 …): door clearance shrinks to fit, down to a minimum
    const nSel = ML.on ? NaN : Math.round(num(type.seatsPerBay, NaN));
    const minClr = num(r.minDoorClearance, 100);
    let warnedSel = false;

    // Mainline: vestibules around the doors (extended to the end wall when the remaining space is short), classes
    const vestibules = [];
    if (ML.on && ML.vestibules) {
      doors.forEach(d => {
        const half = Math.max(dw / 2 + 100, ML.vestLength / 2);
        let v0 = Math.max(salStart, d - half), v1 = Math.min(salEnd, d + half);
        if (v0 - salStart < 1200) v0 = salStart;
        if (salEnd - v1 < 1200) v1 = salEnd;
        const last = vestibules[vestibules.length - 1];
        if (last && v0 <= last.x1 + 600) last.x1 = Math.max(last.x1, v1); else vestibules.push({ x0: v0, x1: v1 });
      });
    }
    const cls = ['first', 'mixed'].includes(type.seatClass) ? type.seatClass : 'std';
    const xFirst = !ML.on ? NaN : cls === 'first' ? salEnd + 1 : cls === 'mixed' ? salStart + num(type.firstLength, 0) : NaN;

    const seatBlocks = [];   // {side,x0,x1,n,bay,depth,foot[,groups,trans][,rowSeats,per,sw,cls]}
    const wheelchairs = [];  // {side,x0,x1,depth,bay,place}
    const cabinets = [];     // {side,x0,x1,depth,height,label,bay,place[,toilet][,aux]}
    const screens = [];      // draft screens {side,x}
    const placeName = { door: 'next to door', end1: 'END 1 side', middle: 'middle', end2: 'END 2 side' };
    const nameOf = q => (q.kind === 'wheelchair' ? 'wheelchair space' : q.toilet ? q.label.toLowerCase() : q.aux ? 'auxiliary desk' : 'cabinet "' + q.label + '"');

    // Mainline seat rows in [f0, f1] on one side: facing pairs or airline rows at the class pitch
    const mlRows = (side, f0, f1, bayI, left) => {
      const parts = Number.isFinite(xFirst) && xFirst > f0 + EPS && xFirst < f1 - EPS ? [[f0, xFirst], [xFirst, f1]] : [[f0, f1]];
      let used = 0;
      parts.forEach(([a, b]) => {
        const isFirst = Number.isFinite(xFirst) && (a + b) / 2 < xFirst;
        const C = isFirst ? ML.first : ML.std;
        const per = C.abreast[side === 'A' ? 0 : 1];
        if (per <= 0) return;
        const P = C.pitch, sl = Math.min(ML.seatLen, P - 150);
        const rowSeats = [];
        if (ML.arrangement === 'facing') {
          const g = Math.floor((b - a) / (2 * P) + EPS);
          let x = a + ((b - a) - g * 2 * P - ((b - a) - g * 2 * P >= P ? P : 0)) / 2;
          for (let k = 0; k < g; k++) { rowSeats.push([x, x + sl]); rowSeats.push([x + 2 * P - sl, x + 2 * P]); x += 2 * P; }
          if (b - a - g * 2 * P >= P - EPS) rowSeats.push([x + P - sl, x + P]);
        } else {
          const n = Math.floor((b - a) / P + EPS);
          const x0 = a + ((b - a) - n * P) / 2;
          for (let k = 0; k < n; k++) rowSeats.push([x0 + (k + 1) * P - sl, x0 + (k + 1) * P]);
        }
        let rows = rowSeats.length;
        if (Number.isFinite(left)) rows = Math.min(rows, Math.floor((left - used) / per));
        if (rows <= 0) return;
        const rs = rowSeats.slice(0, rows);
        seatBlocks.push({ side, x0: rs[0][0], x1: rs[rs.length - 1][1], n: rows * per, bay: bayI, depth: per * C.seatW, foot: 0, rowSeats: rs, per, sw: C.seatW, cls: isFirst ? 'first' : 'std' });
        used += rows * per;
      });
      return used;
    };

    bays.forEach(bay => {
      ['A', 'B'].forEach(side => {
        let ca = clr(bay.k0), cb = clr(bay.k1);
        const inner = bay.k0 === 'door' && bay.k1 === 'door';
        if (inner && nSel > 0 && !trans) {
          const c = (bay.x1 - bay.x0 - nSel * seatW) / 2;
          if (c < minClr - EPS && !warnedSel) { warn.push(`${type.name}: ${nSel} seats need ${Math.round(nSel * seatW + 2 * minClr)} mm between doors; the bay is ${Math.round(bay.x1 - bay.x0)} mm (min. clearance ${minClr} mm each side).`); warnedSel = true; }
          ca = cb = Math.max(minClr, c);
        }
        let a = bay.x0 + ca, b = bay.x1 - cb;
        if (vestibules.length) {
          a = bay.x0 + (bay.k0 === 'door' ? 0 : ca); b = bay.x1 - (bay.k1 === 'door' ? 0 : cb);
          vestibules.forEach(vz => {
            if (vz.x0 <= a + EPS && vz.x1 > a) a = Math.max(a, vz.x1 + 80);
            if (vz.x1 >= b - EPS && vz.x0 < b) b = Math.min(b, vz.x0 - 80);
          });
        }
        const mine = itemsIn.items.filter(q => q.bay === bay.i && q.sides.includes(side));
        if (b - a <= EPS) {
          mine.filter(q => q.kind !== 'max').forEach(q => warn.push(`${type.name}: B${bay.i} side ${side} has no free length (${Math.round(bay.x1 - bay.x0)} mm bay${vestibules.length ? ', vestibule' : ''}) for the ${nameOf(q)}.`));
          return;
        }
        const boxes = mine.filter(q => q.kind === 'wheelchair' || q.kind === 'cabinet').map(q => {
          let place = q.place;
          if (place === 'door') place = bay.k0 === 'door' ? 'end1' : bay.k1 === 'door' ? 'end2' : 'middle';
          return Object.assign({}, q, { at: place, len: q.kind === 'wheelchair' ? wcL : q.length });
        });
        let lo = a, hi = b;
        const mids = [];
        const put = (q, x0) => {
          const x1 = x0 + q.len;
          if (q.kind === 'wheelchair') wheelchairs.push({ side, x0, x1, depth: wcW, bay: bay.i, place: q.place });
          else cabinets.push({ side, x0, x1, depth: q.depth, height: q.height, label: q.label, bay: bay.i, place: q.place, toilet: q.toilet, aux: q.aux });
        };
        const tooShort = q => warn.push(`${type.name}: B${bay.i} side ${side} has no room for the ${nameOf(q)} (${Math.round(q.len)} mm, ${placeName[q.place] || q.place}).`);
        boxes.filter(q => q.at === 'end1').forEach(q => { if (hi - lo < q.len - EPS) return tooShort(q); put(q, lo); lo += q.len; });
        boxes.filter(q => q.at === 'end2').forEach(q => { if (hi - lo < q.len - EPS) return tooShort(q); put(q, hi - q.len); hi -= q.len; });
        boxes.filter(q => q.at === 'middle').forEach(q => {
          const x0 = (a + b) / 2 - q.len / 2;
          if (x0 < lo - EPS || x0 + q.len > hi + EPS || mids.some(m => x0 < m[1] - EPS && x0 + q.len > m[0] + EPS)) return tooShort(q);
          put(q, x0); mids.push([x0, x0 + q.len]);
        });
        // Free intervals between the placed boxes → seat blocks
        const free = [];
        let cur = lo;
        mids.sort((p, q) => p[0] - q[0]).forEach(([m0, m1]) => { if (m0 > cur + EPS) free.push([cur, m0]); cur = Math.max(cur, m1); });
        if (hi > cur + EPS) free.push([cur, hi]);
        let left = mine.filter(q => q.kind === 'max').reduce((m, q) => Math.min(m, q.n), Infinity);
        if (inner && nSel > 0 && !trans) left = Math.min(left, nSel);
        free.forEach(([f0, f1]) => {
          const avail = f1 - f0;
          if (avail <= EPS || left <= 0) return;
          if (ML.on) { left -= mlRows(side, f0, f1, bay.i, left); return; }
          if (!trans) {
            const n = Math.min(Math.floor(avail / seatW + EPS), left);
            if (n <= 0) return;
            const len = n * seatW, x0 = f0 + (avail - len) / 2;
            seatBlocks.push({ side, x0, x1: x0 + len, n, bay: bay.i, depth: seatD, foot });
            left -= n;
          } else {
            const groupL = 2 * tDepth + tLeg;
            let g = Math.floor(avail / groupL + EPS);
            if (Number.isFinite(left)) g = Math.min(g, Math.floor(left / (2 * tPerSide)));
            if (g <= 0) return;
            const len = g * groupL, x0 = f0 + (avail - len) / 2;
            const groups = [];
            for (let k = 0; k < g; k++) groups.push({ x0: x0 + k * groupL, x1: x0 + (k + 1) * groupL });
            seatBlocks.push({ side, x0, x1: x0 + len, n: g * 2 * tPerSide, bay: bay.i, depth: tPerSide * seatW, foot: 0, groups, trans: true });
            left -= g * 2 * tPerSide;
          }
        });
      });
      // draft screens at door ends of the bay (not with vestibules)
      if (!vestibules.length) {
        if (bay.k0 === 'door') { screens.push({ side: 'A', x: bay.x0 + Math.min(dClr, 150) }); screens.push({ side: 'B', x: bay.x0 + Math.min(dClr, 150) }); }
        if (bay.k1 === 'door') { screens.push({ side: 'A', x: bay.x1 - Math.min(dClr, 150) }); screens.push({ side: 'B', x: bay.x1 - Math.min(dClr, 150) }); }
      }
    });

    // Wheelchair turning circle: find a centre inside the wheelchair space whose circle stays clear of seats and cabinets
    {
      const R = num(r.wcTurning, 1500) / 2, hh = Wi / 2;
      const obst = seatBlocks.map(q => ({ x0: q.x0, x1: q.x1, y0: q.side === 'A' ? hh - q.depth : -hh, y1: q.side === 'A' ? hh : -hh + q.depth }))
        .concat(cabinets.map(q => ({ x0: q.x0, x1: q.x1, y0: q.side === 'A' ? hh - q.depth : -hh, y1: q.side === 'A' ? hh : -hh + q.depth })));
      const hits = (cx, cy) => cx - R < salStart - EPS || cx + R > salEnd + EPS || obst.some(o => {
        const dx = Math.max(o.x0 - cx, 0, cx - o.x1), dy = Math.max(o.y0 - cy, 0, cy - o.y1);
        return dx * dx + dy * dy < (R - 1) * (R - 1);
      });
      wheelchairs.forEach(w => {
        const cy = w.side === 'A' ? hh - R : -hh + R, mid = (w.x0 + w.x1) / 2;
        let best = null;
        for (let d = 0; d <= (w.x1 - w.x0) / 2 + EPS && best == null; d += 25) {
          if (!hits(mid - d, cy)) best = mid - d; else if (!hits(mid + d, cy)) best = mid + d;
        }
        w.cx = best == null ? mid : best; w.cy = cy; w.clear = best != null;
        if (!w.clear) warn.push(`${type.name}: Ø${Math.round(2 * R)} turning circle at the B${w.bay} side ${w.side} wheelchair space overlaps seats, a cabinet or the end wall. Try another placement.`);
      });
    }

    const seats = seatBlocks.reduce((s, b) => s + b.n, 0);
    const seatsFirst = seatBlocks.filter(b => b.cls === 'first').reduce((s, b) => s + b.n, 0);
    const half = Wi / 2;
    const sideY = (side, depth) => (side === 'A' ? [half - depth, half] : [-half, -half + depth]);

    // Occupied (non-standing) rectangles
    const occ = [];
    let aSeat = 0, aFoot = 0, aWc = 0, aCab = 0;
    seatBlocks.forEach(s => {
      const L = s.x1 - s.x0;
      aSeat += L * s.depth;
      aFoot += L * s.foot;
      const [y0, y1] = sideY(s.side, s.depth + s.foot);
      occ.push({ x0: s.x0, x1: s.x1, y0, y1 });
    });
    cabinets.forEach(cb => { aCab += (cb.x1 - cb.x0) * cb.depth; const [y0, y1] = sideY(cb.side, cb.depth); occ.push({ x0: cb.x0, x1: cb.x1, y0, y1 }); });
    wheelchairs.forEach(w => {
      aWc += (w.x1 - w.x0) * w.depth;
      if (!r.wcAsStanding) { const [y0, y1] = sideY(w.side, w.depth); occ.push({ x0: w.x0, x1: w.x1, y0, y1 }); }
    });
    const PF = TLT.profileCfg(cfg);
    const insetRef = Math.max(0, TLT.profileInset(PF, PF.refH));
    const standRects = TLT.freeRects(standStart, standEnd, -half + insetRef, half - insetRef, occ);
    const aStand = standRects.reduce((s, q) => s + (q.x1 - q.x0) * (q.y1 - q.y0), 0);
    const aSaloon = Math.max(0, standEnd - standStart) * Wi;
    const aVest = vestibules.reduce((s, q) => s + (q.x1 - q.x0) * Wi, 0);

    // Aisle check
    const dA = Math.max(0, ...seatBlocks.filter(s => s.side === 'A').map(s => s.depth)), dB = Math.max(0, ...seatBlocks.filter(s => s.side === 'B').map(s => s.depth));
    const aisle = Wi - (ML.on ? dA + dB : 2 * Math.max(dA, dB));
    if (seatBlocks.length && aisle < num(r.minAisle, 900)) warn.push(`${type.name}: aisle between seat fronts is ${Math.round(aisle)} mm (minimum set to ${num(r.minAisle, 900)} mm).`);
    cabinets.filter(q => q.toilet).forEach(q => { if (Wi - q.depth < num(r.minAisle, 900) - EPS) warn.push(`${type.name}: passage beside the ${q.label.toLowerCase()} in B${q.bay} is ${Math.round(Wi - q.depth)} mm (minimum ${num(r.minAisle, 900)} mm).`); });
    if (E.cab1 && cabLen < 1200) warn.push(`${type.name}: END 1 cab length ${cabLen} mm looks too short.`);
    if (E.cab2 && cabLen2 < 1200) warn.push(`${type.name}: END 2 cab length ${cabLen2} mm looks too short.`);
    let cabDoorX = NaN, cabDoorX2 = NaN;
    const AE = TLT.aeroCfg(cfg);
    const noseLen = AE.on && (E.cab1 || E.cab2) ? AE.noseLen : 0;
    const noseDesk = noseLen > 1600 ? Math.round(noseLen * 0.5) : 300;     // desk starts behind the narrow tip of a long nose
    if (noseLen) [[E.cab1, cabLen, 1], [E.cab2, cabLen2, 2]].forEach(([on, L, k]) => {
      const need = Math.round(Math.max(noseDesk + num(cfg.cab && cfg.cab.deskDepth, 800) + 1100, DC.cabSide.on ? noseLen * 0.7 + DC.cabSide.width / 2 + 150 : 0));
      if (on && L < need) warn.push(`${type.name}: END ${k} cab length ${L} mm is short for the ${noseLen} mm nose at ${AE.speed} km/h (desk and seat need about ${need} mm).`);
    });
    const cdPos = L => (Number.isFinite(DC.cabSide.pos) ? DC.cabSide.pos : Math.min(Math.max(700, L * 0.6, noseLen ? noseLen * 0.7 : 0), L - DC.cabSide.width / 2 - 150));
    if (noseLen && DC.cabSide.on && Number.isFinite(DC.cabSide.pos) && DC.cabSide.pos - DC.cabSide.width / 2 < noseLen * 0.6)
      warn.push(`${type.name}: cab side door at ${DC.cabSide.pos} mm lies in the tapered part of the ${noseLen} mm nose.`);
    if (DC.cabSide.on) {
      if (E.cab1) {
        cabDoorX = bodyF + cdPos(cabLen);
        if (cabDoorX - DC.cabSide.width / 2 < bodyF + 600 || cabDoorX + DC.cabSide.width / 2 > salStart - 60)
          warn.push(`${type.name}: cab side door (${DC.cabSide.width} mm at ${Math.round(cabDoorX - bodyF)} mm) does not fit in the ${cabLen} mm cab.`);
      }
      if (E.cab2) {
        cabDoorX2 = bodyR - cdPos(cabLen2);
        if (bodyR - cabDoorX2 - DC.cabSide.width / 2 < 600 || cabDoorX2 - DC.cabSide.width / 2 < salEnd + 60)
          warn.push(`${type.name}: END 2 cab side door (${DC.cabSide.width} mm) does not fit in the ${cabLen2} mm cab.`);
      }
    }
    if (((E.cab1 && !openCab) || (E.cab2 && !openCab2)) && DC.cabSaloon.on && Math.abs(DC.cabSaloon.y) + DC.cabSaloon.width / 2 > Wi / 2 - 50)
      warn.push(`${type.name}: cab-to-saloon door does not fit across the car at offset ${DC.cabSaloon.y} mm.`);

    return {
      noseLen, noseDesk, aeroF: AE.f,
      type, Lc, Lb, bodyF, bodyR, mid, bogies, bogieInfo, bc, axles, shared: [sh1, sh2], hinge: [h1, h2], ends: E, cab1: E.cab1, cab2: E.cab2,
      W, Wi, doors, dw, cabLen, cabLen2, salStart, salEnd, bays,
      seatBlocks, wheelchairs, cabinets, screens, standRects, seats, seatsFirst, vestibules, xFirst, mainline: ML.on,
      doorCfg: DC, cabDoorX, cabDoorX2, cabCfg: CB, openCab, openCab2, standStart, standEnd,
      areas: { saloon: aSaloon / 1e6, seat: aSeat / 1e6, foot: aFoot / 1e6, wheelchair: aWc / 1e6, cabinet: aCab / 1e6, standing: aStand / 1e6, vestibule: aVest / 1e6 },
      aisle, warnings: warn, profile: PF, insetRef, usableWidth: Wi - 2 * insetRef,
      equipment: TLT.equipmentFor(type, cfg),
      motorBogies: bogieInfo.filter(bg => bg.motor).length,
    };
  };

  /* Free (standing) area = rectangle minus union of occupied rectangles, as merged rectangles. */
  TLT.freeRects = function (x0, x1, y0, y1, occ) {
    if (x1 - x0 <= EPS || y1 - y0 <= EPS) return [];
    const clampX = v => Math.min(x1, Math.max(x0, v));
    const xs = [x0, x1];
    occ.forEach(o => { if (o.x1 > x0 && o.x0 < x1) { xs.push(clampX(o.x0)); xs.push(clampX(o.x1)); } });
    const X = [...new Set(xs.map(v => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
    const out = [];
    let open = new Map();
    for (let i = 0; i < X.length - 1; i++) {
      const xa = X[i], xb = X[i + 1];
      if (xb - xa <= EPS) continue;
      const blocked = occ.filter(o => o.x0 < xb - EPS && o.x1 > xa + EPS)
        .map(o => [Math.max(y0, o.y0), Math.min(y1, o.y1)]).filter(b => b[1] > b[0]).sort((a, b) => a[0] - b[0]);
      const free = [];
      let cur = y0;
      blocked.forEach(([b0, b1]) => { if (b0 > cur + EPS) free.push([cur, b0]); cur = Math.max(cur, b1); });
      if (y1 > cur + EPS) free.push([cur, y1]);
      const next = new Map();
      free.forEach(([fa, fb]) => {
        const key = fa.toFixed(3) + '|' + fb.toFixed(3);
        const o = open.get(key);
        if (o && Math.abs(o.x1 - xa) < EPS) { o.x1 = xb; next.set(key, o); }
        else { const nr = { x0: xa, x1: xb, y0: fa, y1: fb }; out.push(nr); next.set(key, nr); }
      });
      open = next;
    }
    return out;
  };

  /* ---------------- Capacity ---------------- */
  TLT.capacity = function (lay, cfg) {
    const L = cfg.loads || {};
    const paxMass = num(L.paxMass, 60) / 1000;
    const axles = lay.axles;   // from the running gear (a shared bogie counts as one axle per car)
    const round = L.rounding === 'round' ? Math.round : L.rounding === 'ceil' ? Math.ceil : Math.floor;
    const tare = num(lay.type.tare, 0);
    const res = {};
    (cfg.cases || []).forEach(cs => {
      let seated = lay.seats, standing = 0, total;
      if (cs.kind === 'seated') { standing = 0; total = seated; }
      else if (cs.kind === 'factor') {
        const base = res[String(cs.of || '').toLowerCase()];
        const f = num(cs.factor, 1);
        if (!base) { total = NaN; seated = NaN; standing = NaN; }
        else { total = round(base.total * f + 1e-9); standing = total - seated; }
      } else {
        const dens = num(cs.density, 0);
        standing = round(lay.areas.standing * dens + 1e-9);
        total = seated + standing;
      }
      const mass = tare + (Number.isFinite(total) ? total : 0) * paxMass;
      res[String(cs.name).toLowerCase()] = { name: cs.name, seated, standing, total, mass, axle: axles > 0 ? mass / axles : NaN };
    });
    return res;
  };

  /* ---------------- Whole train ---------------- */
  TLT.compute = function (cfg) {
    const warnings = [];
    const types = (cfg.carTypes || []).filter(t => t && t.name);
    const names = new Set();
    types.forEach(t => { if (names.has(t.name)) warnings.push(`Car type name "${t.name}" is used twice.`); names.add(t.name); });
    const form = TLT.parseFormation(TLT.formationText(cfg), types);
    form.text = TLT.formationText(cfg);
    form.errors.forEach(e => warnings.push(e));
    const layouts = new Map();
    types.forEach(t => { const l = TLT.layoutCar(t, cfg); layouts.set(t.name, l); l.capacity = TLT.capacity(l, cfg); });
    const used = [...new Set(form.cars.map(c => c.type.name))];
    used.forEach(n => {
      const l = layouts.get(n);
      l.warnings.forEach(w => warnings.push(w));
      l.equipment.errors.forEach(e => warnings.push(`${n}: ${e}`));
    });
    // Train totals per case
    const maxAxle = num((cfg.loads || {}).maxAxleLoad, 16);
    // Suspended modules (no bogie): half their mass goes to each neighbour for the simple axle-load check
    const lay = c => layouts.get(c.type.name);
    form.cars.forEach((c, i) => {
      c.extra = [];
      if (lay(c).axles > 0) return;
      [form.cars[i - 1], form.cars[i + 1]].forEach(n => {
        if (!n) { warnings.push(`Car ${c.no} (${c.label}) has no bogie and no neighbour at one end to carry it.`); return; }
        if (lay(n).axles === 0) warnings.push(`Cars ${c.no} and ${n.no} are both suspended modules; a suspended module must hang between modules with bogies.`);
      });
    });
    const totals = (cfg.cases || []).map(cs => {
      const key = String(cs.name).toLowerCase();
      let seated = 0, standing = 0, total = 0, mass = 0, axleMax = 0;
      form.cars.forEach((c, i) => {
        const r = lay(c).capacity[key];
        seated += r.seated; standing += r.standing; total += r.total; mass += r.mass;
        if (lay(c).axles > 0) {
          let m = r.mass;
          [form.cars[i - 1], form.cars[i + 1]].forEach(n => { if (n && lay(n).axles === 0) m += lay(n).capacity[key].mass / 2; });
          axleMax = Math.max(axleMax, m / lay(c).axles);
        }
      });
      return { name: cs.name, kind: cs.kind, seated, standing, total, mass, axleMax, ok: axleMax <= maxAxle + 1e-9 };
    });
    const wcCount = form.cars.reduce((s, c) => s + layouts.get(c.type.name).wheelchairs.length, 0);
    // HVAC count checks against the equipment list
    const hv = cfg.hvac || {};
    if (Array.isArray(cfg.equipment)) used.forEach(n => {
      const l = layouts.get(n);
      const ac = l.equipment.items.filter(e => e.kind === 'ac' && !/cab/i.test(e.name));
      const want = Math.round(num(hv.unitsPerCar, 2));
      if (ac.length !== want) warnings.push(`${n}: ${ac.length} saloon HVAC unit(s) in the equipment list, ${want} per car set in HVAC.`);
      if (TLT.hasCab(l.type)) {
        const cabAc = l.equipment.items.some(e => /cab/i.test(e.name) && (e.kind === 'ac' || /ac|hvac/i.test(e.name)));
        if (hv.cabHvac && !cabAc) warnings.push(`${n}: cab HVAC is applicable but no CAB HVAC item is in the equipment list.`);
      }
    });
    const res = { cfg, form, layouts, used, totals, warnings, wcCount, maxAxle };
    res.power = TLT.powerCheck(res);
    res.weights = TLT.weights(res);
    res.fixed = TLT.fixedTare(res);
    return res;
  };

  /* Weight calculation with the fixed (target) tare: tare at the car centre, passengers at their centroids,
   * lever rule per bogie (shared Jacobs bogies and suspended modules as in the design weight calculation). */
  TLT.fixedTare = function (R) {
    // Fixed (target) tare: the equipment distribution is not known, so each car is taken as a whole:
    // car mass = tare + passengers × passenger mass; axle load = car mass ÷ axles of the car
    // (a shared Jacobs bogie counts as one axle per car; a suspended module adds half its mass to each neighbour).
    const cfg = R.cfg, L = cfg.loads || {};
    const cases = (cfg.cases || []).filter(c => c.inFixed !== false);
    const paxKg = num(L.paxMass, 60), maxAxle = num(L.maxAxleLoad, 16);
    const warnings = [];
    const lay = c => R.layouts.get(c.type.name);
    R.used.forEach(n => { if (!(num(R.layouts.get(n).type.tare, 0) > 0)) warnings.push(`${n}: no fixed tare mass entered.`); });
    const cars = R.form.cars.map((car, i) => {
      const l = lay(car), tare = num(car.type.tare, 0);
      const rows = cases.map(cs => {
        const cap = l.capacity[String(cs.name).toLowerCase()];
        const seated = Number.isFinite(cap.seated) ? cap.seated : 0, standing = Number.isFinite(cap.standing) ? cap.standing : 0;
        const mass = tare + ((seated + standing) * paxKg) / 1000;
        return { name: cs.name, pax: seated + standing, seated, standing, mass };
      });
      return { car, no: car.no, label: car.label, type: car.type.name, tare, axles: l.axles, rows };
    });
    cars.forEach((c, i) => c.rows.forEach((r, ci) => {
      if (!c.axles) { r.axle = NaN; return; }
      let m = r.mass;
      [cars[i - 1], cars[i + 1]].forEach(n => { if (n && !n.axles) m += n.rows[ci].mass / 2; });
      r.axleMass = m; r.axle = m / c.axles;
    }));
    const train = cases.map((cs, ci) => {
      const mass = cars.reduce((a, c) => a + c.rows[ci].mass, 0), pax = cars.reduce((a, c) => a + c.rows[ci].pax, 0);
      const axle = cars.reduce((m, c) => (Number.isFinite(c.rows[ci].axle) ? Math.max(m, c.rows[ci].axle) : m), 0);
      const ok = axle <= maxAxle + 1e-9;
      if (!ok) warnings.push(`${cs.name}: maximum axle load ${axle.toFixed(1)} t exceeds the ${maxAxle} t limit.`);
      return { name: cs.name, mass, pax, axle, ok };
    });
    return { cases, cars, train, warnings, maxAxle, paxKg, tareTrain: cars.reduce((a, c) => a + c.tare, 0) };
  };


  /* Power collection check: pantographs per unit and per train, third-rail shoe span */
  TLT.powerCheck = function (R) {
    const P = TLT.powerCfg(R.cfg), warn = R.warnings;
    const tx = (car, x) => car.x0 + (car.flip ? R.layouts.get(car.type.name).Lc - x : x);
    const pantos = [];
    R.form.cars.forEach(car => {
      const l = R.layouts.get(car.type.name);
      l.equipment.items.filter(e => e.loc === 'roof' && e.kind === 'panto').forEach(e => pantos.push({ car, tx: tx(car, l.mid - e.x), unit: car.unit }));
    });
    pantos.sort((a, b) => a.tx - b.tx);
    if (P.panto && !pantos.length) warn.push(`Power collection: ${P.label} pantograph is selected, but there is no pantograph (PAN…) row in the equipment list.`);
    if (!P.panto && pantos.length) warn.push(`Power collection is third rail only, but the equipment list has ${pantos.length} pantograph(s).`);
    // pantographs per car variant: target (power card) against the equipment list
    const perVariant = R.used.map(n => {
      const l = R.layouts.get(n), cars = R.form.cars.filter(c => c.type.name === n).length;
      const actual = l.equipment.items.filter(e => e.loc === 'roof' && e.kind === 'panto').length;
      const target = TLT.pantoTarget(l.type);
      const ccdRows = l.equipment.items.filter(e => e.kind === 'ccd').length;
      const shoesPerCar = ccdRows || 2 * TLT.shoeLayout(l, R.cfg).length;
      const ccdT = num(l.type.ccd, NaN);
      if (P.third && ccdRows && Number.isFinite(ccdT) && ccdT > 0 && ccdRows !== ccdT) warn.push(`${n}: ${ccdT} CCD shoes per car set in Power collection, the equipment list has ${ccdRows} CCD row(s).`);
      if (!P.third && ccdRows) warn.push(`${n}: CCD rows in the equipment list, but power collection is pantograph only.`);
      if (P.panto && target != null && target !== actual) warn.push(`${n}: ${target} pantograph(s) per car required (Power collection), the equipment list has ${actual}.`);
      if (P.third && num(l.type.ccd, 0) % 2 === 1) warn.push(`${n}: ${l.type.ccd} CCD shoes per car is odd; ${shoesPerCar} are placed (same number on both sides).`);
      return { name: n, cars, target, actual, shoesPerCar };
    });
    const targetTrain = perVariant.some(q => q.target != null) ? perVariant.reduce((a, q) => a + (q.target || 0) * q.cars, 0) : null;
    if (P.panto && P.maxPantos > 0 && targetTrain != null && targetTrain > P.maxPantos) warn.push(`Pantograph target ${targetTrain} per train exceeds the maximum of ${P.maxPantos}.`);
    if (P.panto && pantos.length) {
      for (let u = 0; u < R.form.units; u++) if (!pantos.some(q => q.unit === u)) warn.push(`Unit ${u + 1} has no pantograph.`);
      if (P.maxPantos > 0 && pantos.length > P.maxPantos) {
        const by = new Map(); pantos.forEach(q => by.set(q.car.type.name, (by.get(q.car.type.name) || 0) + 1));
        const per = [...by.entries()].map(([n, k]) => { const cars = R.form.cars.filter(c => c.type.name === n).length; return `${n}: ${k / cars} per car × ${cars}`; }).join(', ');
        warn.push(`${pantos.length} pantographs in the train (${per}); the maximum is ${P.maxPantos}. Check the pantograph (PAN…) rows in the equipment list.`);
      }
    }
    const eqAll = R.used.flatMap(n => R.layouts.get(n).equipment.items);
    if (P.system === '25kV') {
      if (!eqAll.some(e => /transf|^MTR?\b|^TFR?\b/i.test(e.name))) warn.push('25 kV AC: no main transformer row in the equipment list.');
      if (!eqAll.some(e => /VCB|MCB|circuit/i.test(e.name))) warn.push('25 kV AC: no main circuit breaker (VCB) row in the equipment list.');
    }
    // third-rail shoe gear on the bogies of the selected car variants (both sides)
    const shoes = [];
    if (P.third) {
      R.form.cars.forEach(car => TLT.shoeLayout(R.layouts.get(car.type.name), R.cfg).forEach(x => shoes.push({ car, tx: tx(car, x), unit: car.unit })));
      shoes.sort((a, b) => a.tx - b.tx);
      const nShoes = R.used.reduce((a, n) => { const l = R.layouts.get(n); const c = R.form.cars.filter(q => q.type.name === n).length; const rows = l.equipment.items.filter(e => e.kind === 'ccd').length; return a + c * (rows || 2 * TLT.shoeLayout(l, R.cfg).length); }, 0);
      shoes.total = nShoes;
      if (!shoes.length) warn.push('Third rail: no CCD shoes — set the shoes per car in Power collection.');
    }
    const span = shoes.length ? shoes[shoes.length - 1].tx - shoes[0].tx : 0;
    let maxSpacing = 0;
    for (let i = 1; i < shoes.length; i++) maxSpacing = Math.max(maxSpacing, shoes[i].tx - shoes[i - 1].tx);
    const unitSpans = [];
    for (let u = 0; u < R.form.units; u++) {
      const us = shoes.filter(q => q.unit === u);
      unitSpans.push(us.length ? us[us.length - 1].tx - us[0].tx : 0);
    }
    if (P.third && P.maxGap > 0 && shoes.length) {
      if (span <= P.maxGap) warn.push(`Third rail: shoe span ${Math.round(span)} mm is not longer than the ${P.maxGap} mm conductor-rail gap — the train can be gapped.`);
      unitSpans.forEach((us, u) => { if (R.form.units > 1 && us <= P.maxGap) warn.push(`Third rail: unit ${u + 1} shoe span ${Math.round(us)} mm ≤ ${P.maxGap} mm gap — the unit can be gapped when running alone.`); });
    }
    let pantoSpacing = 0;
    for (let i = 1; i < pantos.length; i++) pantoSpacing = Math.max(pantoSpacing, pantos[i].tx - pantos[i - 1].tx);
    return { cfg: P, pantos, shoes, span, maxSpacing, unitSpans, pantoSpacing, perVariant, targetTrain, shoesTrain: shoes.total || 2 * shoes.length,
      pantoSpan: pantos.length > 1 ? pantos[pantos.length - 1].tx - pantos[0].tx : 0 };
  };

  /* ---------------- Weight calculation ----------------
   * Weight list rows: { car, loc, name, length, width, height, x, y, z, mass }
   * x from car centre (+ towards END 1), y from centre line (+ towards side A), z above top of rail.
   * loc 'Bogie' rows sit directly on the nearest support (bogie); all other rows are carried by the car body.
   */
  TLT.WEIGHT_LOCS = ['Car body', 'Roof', 'Interior', 'UF', 'Cab', 'End', 'Bogie'];
  TLT.normWeightLoc = function (v) {
    const s = String(v || '').trim().toLowerCase();
    if (/^bog/.test(s)) return 'Bogie';
    if (/^roof/.test(s)) return 'Roof';
    if (/^int/.test(s)) return 'Interior';
    if (/^(uf|under)/.test(s)) return 'UF';
    if (/^cab/.test(s)) return 'Cab';
    if (/^end/.test(s)) return 'End';
    return 'Car body';
  };
  TLT.weightZ = function (loc, h, cfg) {
    const c = cfg.common || {};
    const fh = num(c.floorHeight, 1130), rh = num(c.roofHeight, 3650), sole = fh - num(c.mountDepth, 250);
    const H = Number.isFinite(h) && h > 0 ? h : 0;
    switch (loc) {
      case 'Roof': return rh + (H ? H / 2 : 200);
      case 'UF': return sole - (H ? H / 2 : 250);
      case 'Bogie': return num(c.wheelDia, 860) / 2 + 250;
      case 'Interior': case 'Cab': case 'End': return fh + (H ? H / 2 : 900);
      default: return (fh + rh) / 2;
    }
  };

  TLT.weights = function (R, opt) {
    opt = opt || {};
    const cfg = R.cfg;
    const CASES = opt.cases || cfg.cases || [];
    const L = cfg.loads || {};
    const paxKg = num(L.paxMass, 60);
    const maxAxle = num(L.maxAxleLoad, 16) * 1000;
    const b = num(L.wheelSpacing, 1500);
    const limit = num(L.imbalanceLimit, 15);
    const fh = num((cfg.common || {}).floorHeight, 1130);
    const rows = (opt.rows || (Array.isArray(cfg.weightItems) ? cfg.weightItems : [])).map(r => {
      const loc = TLT.normWeightLoc(r.loc);
      const h = num(r.height, NaN);
      const z = num(r.z, NaN);
      return {
        car: String(r.car == null ? '' : r.car).trim(), loc, name: String(r.name || '').trim(),
        length: num(r.length, NaN), width: num(r.width, NaN), height: h,
        x: num(r.x, 0), y: num(r.y, 0), z: Number.isFinite(z) ? z : TLT.weightZ(loc, h, cfg), zAuto: !Number.isFinite(z),
        mass: num(r.mass, 0), hasMass: Number.isFinite(num(r.mass, NaN)),
      };
    });
    const isOther = r => /^other/i.test(r.name);
    const perType = new Map();
    const warn = [];
    const supName = bg => (bg.end === 0 ? 'Centre' : `END ${bg.end}`) + (bg.shared ? ' (shared)' : '');
    R.used.forEach(name => {
      const lay = R.layouts.get(name);
      const all = rows.filter(r => r.car === name);
      const order = TLT.WEIGHT_LOCS.flatMap(lc => all.filter(r => r.loc === lc && !isOther(r))).concat(all.filter(isOther));
      // supports in car-centre coordinates (+ END 1)
      const B = lay.bogieInfo;
      const sx = B.map(bg => lay.mid - bg.x);
      const sum = (a, f) => a.reduce((t, r) => t + f(r), 0);
      if (!B.length) order.filter(r => r.loc === 'Bogie').forEach(r => warn.push(`${name}: "${r.name}" is a Bogie row, but this car has no bogie; it is counted with the car body.`));
      const isBog = r => r.loc === 'Bogie' && B.length > 0;
      const bodyItems = order.filter(r => !isBog(r)), bogItems = order.filter(isBog);
      const Mb = sum(bodyItems, r => r.mass);
      const bogAt = B.map(() => 0), bogLat = B.map(() => 0);
      bogItems.forEach(r => { let k = 0; sx.forEach((x, j) => { if (Math.abs(r.x - x) < Math.abs(r.x - sx[k])) k = j; }); bogAt[k] += r.mass; bogLat[k] += r.mass * r.y; });
      const Mbog = sum(bogAt, v => v);
      const tare = Mb + Mbog;
      const cg = a => { const m = sum(a, r => r.mass); return m > 0 ? { x: sum(a, r => r.mass * r.x) / m, y: sum(a, r => r.mass * r.y) / m, z: sum(a, r => r.mass * r.z) / m } : { x: 0, y: 0, z: 0 }; };
      const cgAll = cg(order), cgBody = cg(bodyItems);
      // passenger centroids
      const seatN = lay.seatBlocks.reduce((a, q) => a + q.n, 0);
      const seatX = seatN ? lay.seatBlocks.reduce((a, q) => a + q.n * (lay.mid - (q.x0 + q.x1) / 2), 0) / seatN : 0;
      const stA = lay.standRects.reduce((a, q) => a + (q.x1 - q.x0) * (q.y1 - q.y0), 0);
      const standX = stA ? lay.standRects.reduce((a, q) => a + (q.x1 - q.x0) * (q.y1 - q.y0) * (lay.mid - (q.x0 + q.x1) / 2), 0) / stA : 0;
      // body support points: two outer bogies (lever rule), one bogie (all), or the two articulation joints (suspended module)
      const iA = 0, iB = B.length - 1;
      const cases = CASES.map(cs => {
        const cap = lay.capacity[String(cs.name).toLowerCase()];
        const seated = Number.isFinite(cap.seated) ? cap.seated : 0, standing = Number.isFinite(cap.standing) ? cap.standing : 0;
        const pm = (seated + standing) * paxKg;
        const MB = Mb + pm;
        const xB = MB > 0 ? (Mb * cgBody.x + seated * paxKg * seatX + standing * paxKg * standX) / MB : 0;
        const yB = MB > 0 ? (Mb * cgBody.y) / MB : 0;
        const zAll = (tare * cgAll.z + seated * paxKg * (fh + 600) + standing * paxKg * (fh + 1000)) / Math.max(1, tare + pm);
        const Rb = B.map(() => 0);
        let hinge = null;
        if (B.length >= 2) { const span = sx[iA] - sx[iB]; Rb[iA] = span ? MB * (xB - sx[iB]) / span : MB / 2; Rb[iB] = MB - Rb[iA]; }
        else if (B.length === 1) Rb[0] = MB;
        else { const e1 = lay.mid, e2 = -lay.mid; const H1 = MB * (xB - e2) / (e1 - e2); hinge = [{ F: H1, lat: H1 * yB }, { F: MB - H1, lat: (MB - H1) * yB }]; }
        const sup = B.map((bg, k) => {
          const F = Rb[k] + bogAt[k];
          const lat = Rb[k] * yB + bogLat[k];
          return { F, lat, shared: bg.shared, end: bg.end, label: supName(bg), x: sx[k], axle: F / 2, imb: F > 0 ? (200 * Math.abs(lat)) / (b * F) : 0 };
        });
        return { name: cs.name, pax: seated + standing, paxMass: pm, mass: tare + pm, xg: (tare * cgAll.x + seated * paxKg * seatX + standing * paxKg * standX) / Math.max(1, tare + pm),
          yg: (tare * cgAll.y) / Math.max(1, tare + pm), zg: zAll, sup, hinge, bodyMass: MB };
      });
      const target = num(lay.type.tare, NaN) * 1000;
      perType.set(name, { name, lay, items: order, sx, supLabels: B.map(supName), bodyMass: Mb, bogieMass: Mbog, bogAt, tareKg: tare, cg: cgAll, target, diff: Number.isFinite(target) ? tare - target : NaN,
        seatX, standX, cases, missing: all.filter(r => !r.hasMass).length, suspended: !B.length });
      if (!all.length) warn.push(`${name}: the weight list has no rows for this car.`);
    });

    // Physical bogies along the train (shared supports at a joint are merged)
    const sup = [];
    R.form.cars.forEach(car => {
      const w = perType.get(car.type.name); if (!w) return;
      const lay = w.lay;
      lay.bogieInfo.forEach((bg, k) => sup.push({ car, k, end: bg.end, tx: car.x0 + (car.flip ? lay.Lc - bg.x : bg.x), shared: bg.shared, w }));
    });
    sup.sort((a, b2) => a.tx - b2.tx);
    const bogies = [];
    sup.forEach(sp => {
      const last = bogies[bogies.length - 1];
      if (sp.shared && last && last.shared && Math.abs(last.tx - sp.tx) < 1 && last.parts.every(q => q.car !== sp.car)) { last.parts.push(sp); return; }
      bogies.push({ tx: sp.tx, shared: sp.shared, parts: [sp] });
    });
    const nc = CASES.length;
    bogies.forEach((bg, i) => {
      bg.no = i + 1;
      bg.F = new Array(nc).fill(0); bg.lat = new Array(nc).fill(0); bg.via = [];
      const endName = q => `car ${q.car.no} END ${q.end}`;
      if (bg.shared && bg.parts.length === 1) warn.push(`Shared bogie at ${endName(bg.parts[0])} has no matching shared end on the next car.`);
      if (bg.parts.length > 1 && bg.parts.filter(q => q.w.bogAt[q.k] > 0).length > 1) warn.push(`Shared bogie ${bg.no} (${bg.parts.map(endName).join(' + ')}): bogie mass is entered on both cars. Enter it on one car only.`);
      const p0 = bg.parts[0];
      const pos = p0.end === 0 ? 'centre' : (p0.end === 1) !== p0.car.flip ? 'front' : 'rear';
      bg.label = bg.parts.length > 1 ? `Cars ${bg.parts.map(q => q.car.no).join('/')} (shared)` : `Car ${p0.car.no}, ${pos}`;
      bg.parts.forEach(q => q.w.cases.forEach((cs, ci) => { const s0 = cs.sup[q.k]; bg.F[ci] += s0.F; bg.lat[ci] += q.car.flip ? -s0.lat : s0.lat; }));
    });
    // Suspended modules: joint loads go to the neighbouring car's bogies (lever rule over that car's bogies)
    R.form.cars.forEach((car, i) => {
      const w = perType.get(car.type.name); if (!w || !w.suspended) return;
      [[0, car.x0], [1, car.x0 + w.lay.Lc]].forEach(([side, tj]) => {
        const n = side === 0 ? R.form.cars[i - 1] : R.form.cars[i + 1];
        const end = (side === 0) !== car.flip ? 0 : 1;   // hinge index: END 1 or END 2 of this car
        if (!n) return;
        const nb = bogies.filter(bg => bg.parts.some(q => q.car === n));
        if (!nb.length) { warn.push(`Car ${car.no}: the neighbouring car ${n.no} has no bogie to carry the joint load.`); return; }
        const ba = nb[0], bb = nb[nb.length - 1];
        w.cases.forEach((cs, ci) => {
          const H = cs.hinge[end].F, Hl = (car.flip ? -1 : 1) * cs.hinge[end].lat;
          if (ba === bb) { ba.F[ci] += H; ba.lat[ci] += Hl; return; }
          const fa = (bb.tx - tj) / (bb.tx - ba.tx);
          ba.F[ci] += H * fa; bb.F[ci] += H * (1 - fa); ba.lat[ci] += Hl * fa; bb.lat[ci] += Hl * (1 - fa);
        });
        [ba, bb].forEach(bg => { if (!bg.via.includes(car.no)) bg.via.push(car.no); });
      });
    });
    bogies.forEach(bg => {
      if (bg.via.length) bg.label += ` + car ${bg.via.join('/')}`;
      bg.cases = CASES.map((cs, ci) => {
        const F = bg.F[ci], lat = bg.lat[ci];
        const imb = F > 0 ? (200 * Math.abs(lat)) / (b * F) : 0;
        return { name: cs.name, F, axle: F / 2, imb, ok: F / 2 <= maxAxle + 1e-6, imbOk: imb <= limit + 1e-9 };
      });
    });
    const train = CASES.map((cs, ci) => {
      const mass = R.form.cars.reduce((a, car) => { const w = perType.get(car.type.name); return a + (w ? w.cases[ci].mass : 0); }, 0);
      const pax = R.form.cars.reduce((a, car) => { const w = perType.get(car.type.name); return a + (w ? w.cases[ci].pax : 0); }, 0);
      const axle = bogies.reduce((m, bg) => Math.max(m, bg.cases[ci].axle), 0);
      const imb = bogies.reduce((m, bg) => Math.max(m, bg.cases[ci].imb), 0);
      return { name: cs.name, mass, pax, axle, imb, ok: axle <= maxAxle + 1e-6, imbOk: imb <= limit + 1e-9 };
    });
    const tareTrain = R.form.cars.reduce((a, car) => a + (perType.get(car.type.name) ? perType.get(car.type.name).tareKg : 0), 0);
    return { perType, bogies, train, tareTrain, maxAxle: maxAxle / 1000, paxKg, wheelSpacing: b, limit, warnings: warn };
  };
})();
