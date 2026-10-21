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
      if (!c.type.cab) return;
      if (i === 0) c.flip = false;
      else if (i === cars.length - 1) c.flip = true;
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
  TLT.guessKind = (name, loc) => (loc === 'roof' && /^pan/i.test(name) ? 'panto' : loc === 'roof' && /^(ac|hvac|a\/c)/i.test(name) ? 'ac' : 'box');
  TLT.normEquipRow = function (r) {
    const loc = /^r/i.test(String(r.loc || '')) ? 'roof' : 'under';
    const kind = String(r.kind || '').trim().toLowerCase();
    return {
      cat: /^(m|w)/i.test(String(r.cat || '').trim()) ? 'mass' : 'equip',
      car: String(r.car == null ? '' : r.car).trim(),
      name: String(r.name == null ? '' : r.name).trim(),
      loc,
      length: num(r.length, NaN), width: num(r.width, NaN), height: num(r.height, NaN),
      x: num(r.x, NaN), y: num(r.y, 0), mass: num(r.mass, NaN),
      kind: ['box', 'ac', 'panto'].includes(kind) ? kind : TLT.guessKind(String(r.name || ''), loc),
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
    const bc = num(type.bogieCentres, 13800);
    const bogies = [mid - bc / 2, mid + bc / 2];
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

    const cabLen = type.cab ? num(type.cabLength, 2000) : 0;
    const endWall = num(c.endWallThk, 150);
    const salStart = type.cab ? bodyF + cabLen : bodyF + endWall;
    const salEnd = bodyR - endWall;
    if (salEnd <= salStart) warn.push(`${type.name}: saloon length is zero or negative — check body/cab length.`);

    doors.forEach((d, i) => {
      if (d - dw / 2 < salStart - EPS || d + dw / 2 > salEnd + EPS)
        warn.push(`${type.name}: door ${i + 1} (centre ${Math.round(d)} mm) is outside the saloon.`);
    });
    for (let i = 1; i < doors.length; i++) if (doors[i] - doors[i - 1] < dw) warn.push(`${type.name}: doors ${i} and ${i + 1} overlap.`);

    // Bays: saloon start → door 1, door i → door i+1, last door → saloon end
    const bays = [];
    let prev = { x: salStart, kind: type.cab ? 'cab' : 'end' };
    doors.forEach(d => { bays.push({ i: bays.length, x0: prev.x, x1: d - dw / 2, k0: prev.kind, k1: 'door' }); prev = { x: d + dw / 2, kind: 'door' }; });
    bays.push({ i: bays.length, x0: prev.x, x1: salEnd, k0: prev.kind, k1: 'end' });

    const bayParse = TLT.parseBays(type.bays);
    bayParse.errors.forEach(e => warn.push(`${type.name}: ${e}`));
    bayParse.rules.forEach(rule => { if (rule.bay < 0 || rule.bay >= bays.length) warn.push(`${type.name}: bay rule refers to B${rule.bay}, but this car has B0–B${bays.length - 1}.`); });

    const seatW = num(r.seatWidth, 430), seatD = num(r.seatDepth, 550), foot = num(r.footZone, 300);
    const dClr = num(r.doorClearance, 330), eClr = num(r.endClearance, 0);
    const trans = r.seatType === 'transverse';
    const tPerSide = Math.max(1, Math.round(num(r.transSeatsPerSide, 2)));
    const tDepth = num(r.transSeatDepth, 450);
    const tLeg = num(r.transLegroom, 600);
    const wcL = num(r.wcLength, 1300), wcW = num(r.wcWidth, 700);
    const cabDepthDef = num(r.cabinetDepth, 600);
    const clr = k => (k === 'door' ? dClr : eClr);

    const seatBlocks = [];   // longitudinal: {side,x0,x1,n}; transverse: {side,x0,x1,n,rows:[...]}
    const wheelchairs = [];  // {side,x0,x1,depth}
    const cabinets = [];     // {side,x0,x1,depth,label}
    const screens = [];      // draft screens {side,x}

    bays.forEach(bay => {
      ['A', 'B'].forEach(side => {
        let a = bay.x0 + clr(bay.k0), b = bay.x1 - clr(bay.k1);
        if (b - a <= EPS) return;
        const rules = bayParse.rules.filter(q => q.bay === bay.i && q.side === side);
        // Things placed against the door end of the bay first (wheelchair next to the door)
        const atStart = bay.k0 === 'door' || bay.k1 !== 'door';
        rules.filter(q => q.kind === 'wheelchair' || q.kind === 'cabinet').forEach(q => {
          const len = q.kind === 'wheelchair' ? wcL : q.length;
          if (b - a < len - EPS) { warn.push(`${type.name}: B${bay.i} side ${side} is too short for the ${q.kind} (${Math.round(len)} mm).`); return; }
          const x0 = atStart ? a : b - len, x1 = x0 + len;
          if (q.kind === 'wheelchair') wheelchairs.push({ side, x0, x1, depth: wcW, bay: bay.i });
          else cabinets.push({ side, x0, x1, depth: Number.isFinite(q.depth) ? q.depth : cabDepthDef, label: q.label, bay: bay.i });
          if (atStart) a = x1; else b = x0;
        });
        const maxRule = rules.filter(q => q.kind === 'max').reduce((m, q) => Math.min(m, q.n), Infinity);
        const avail = b - a;
        if (avail <= EPS) return;
        if (!trans) {
          let n = Math.floor(avail / seatW + EPS);
          n = Math.min(n, maxRule);
          if (n <= 0) return;
          const len = n * seatW, x0 = a + (avail - len) / 2;
          seatBlocks.push({ side, x0, x1: x0 + len, n, bay: bay.i, depth: seatD, foot });
        } else {
          const groupL = 2 * tDepth + tLeg;
          let g = Math.floor(avail / groupL + EPS);
          let maxN = maxRule;
          if (Number.isFinite(maxN)) g = Math.min(g, Math.floor(maxN / (2 * tPerSide)));
          if (g <= 0) return;
          const len = g * groupL, x0 = a + (avail - len) / 2;
          const groups = [];
          for (let k = 0; k < g; k++) groups.push({ x0: x0 + k * groupL, x1: x0 + (k + 1) * groupL });
          seatBlocks.push({ side, x0, x1: x0 + len, n: g * 2 * tPerSide, bay: bay.i, depth: tPerSide * seatW, foot: 0, groups, trans: true });
        }
      });
      // draft screens at door ends of the bay
      if (bay.k0 === 'door') { screens.push({ side: 'A', x: bay.x0 + Math.min(dClr, 150) }); screens.push({ side: 'B', x: bay.x0 + Math.min(dClr, 150) }); }
      if (bay.k1 === 'door') { screens.push({ side: 'A', x: bay.x1 - Math.min(dClr, 150) }); screens.push({ side: 'B', x: bay.x1 - Math.min(dClr, 150) }); }
    });

    const seats = seatBlocks.reduce((s, b) => s + b.n, 0);
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
    const standRects = TLT.freeRects(salStart, salEnd, -half, half, occ);
    const aStand = standRects.reduce((s, q) => s + (q.x1 - q.x0) * (q.y1 - q.y0), 0);
    const aSaloon = Math.max(0, salEnd - salStart) * Wi;

    // Aisle check
    const maxDepth = seatBlocks.reduce((m, s) => Math.max(m, s.depth), 0);
    const aisle = Wi - 2 * maxDepth;
    if (seatBlocks.length && aisle < num(r.minAisle, 900)) warn.push(`${type.name}: aisle between seat fronts is ${Math.round(aisle)} mm (minimum set to ${num(r.minAisle, 900)} mm).`);
    if (type.cab && cabLen < 1200) warn.push(`${type.name}: cab length ${cabLen} mm looks too short.`);
    let cabDoorX = NaN;
    if (type.cab && DC.cabSide.on) {
      cabDoorX = bodyF + (Number.isFinite(DC.cabSide.pos) ? DC.cabSide.pos : Math.max(700, cabLen * 0.6));
      if (cabDoorX - DC.cabSide.width / 2 < bodyF + 600 || cabDoorX + DC.cabSide.width / 2 > salStart - 60)
        warn.push(`${type.name}: cab side door (${DC.cabSide.width} mm at ${Math.round(cabDoorX - bodyF)} mm) does not fit in the ${cabLen} mm cab.`);
    }
    if (type.cab && DC.cabSaloon.on && Math.abs(DC.cabSaloon.y) + DC.cabSaloon.width / 2 > Wi / 2 - 50)
      warn.push(`${type.name}: cab-to-saloon door does not fit across the car at offset ${DC.cabSaloon.y} mm.`);

    return {
      type, Lc, Lb, bodyF, bodyR, mid, bogies, bc, W, Wi, doors, dw, cabLen, salStart, salEnd, bays,
      seatBlocks, wheelchairs, cabinets, screens, standRects, seats, doorCfg: DC, cabDoorX,
      areas: { saloon: aSaloon / 1e6, seat: aSeat / 1e6, foot: aFoot / 1e6, wheelchair: aWc / 1e6, cabinet: aCab / 1e6, standing: aStand / 1e6 },
      aisle, warnings: warn,
      equipment: TLT.equipmentFor(type, cfg),
      motorBogies: Math.max(0, Math.min(2, Math.round(num(type.motorBogies, 0)))),
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
    const axles = Math.max(1, Math.round(num(L.axlesPerCar, 4)));
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
      res[String(cs.name).toLowerCase()] = { name: cs.name, seated, standing, total, mass, axle: mass / axles };
    });
    return res;
  };

  /* ---------------- Whole train ---------------- */
  TLT.compute = function (cfg) {
    const warnings = [];
    const types = (cfg.carTypes || []).filter(t => t && t.name);
    const names = new Set();
    types.forEach(t => { if (names.has(t.name)) warnings.push(`Car type name "${t.name}" is used twice.`); names.add(t.name); });
    const form = TLT.parseFormation(cfg.formation, types);
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
    const totals = (cfg.cases || []).map(cs => {
      const key = String(cs.name).toLowerCase();
      let seated = 0, standing = 0, total = 0, mass = 0, axleMax = 0;
      form.cars.forEach(c => {
        const r = layouts.get(c.type.name).capacity[key];
        seated += r.seated; standing += r.standing; total += r.total; mass += r.mass; axleMax = Math.max(axleMax, r.axle);
      });
      if (axleMax > maxAxle + 1e-9) warnings.push(`${cs.name}: maximum axle load ${axleMax.toFixed(2)} t exceeds the ${maxAxle} t limit.`);
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
      if (l.type.cab) {
        const cabAc = l.equipment.items.some(e => /cab/i.test(e.name) && (e.kind === 'ac' || /ac|hvac/i.test(e.name)));
        if (hv.cabHvac && !cabAc) warnings.push(`${n}: cab HVAC is applicable but no CAB HVAC item is in the equipment list.`);
      }
    });
    const res = { cfg, form, layouts, used, totals, warnings, wcCount, maxAxle };
    res.weights = TLT.weights(res);
    return res;
  };

  /* ---------------- Weight calculation ----------------
   * Tare from the equipment list (drawn equipment + mass items), passenger mass placed at the
   * seat and standing-area centroids, bogie loads from the centre of gravity along the car.
   * x convention: from car centre, + towards END 1.
   */
  TLT.weights = function (R) {
    const cfg = R.cfg;
    const L = cfg.loads || {};
    const paxKg = num(L.paxMass, 60);
    const maxAxle = num(L.maxAxleLoad, 16);
    const rows = Array.isArray(cfg.equipment) ? cfg.equipment.map(TLT.normEquipRow) : [];
    const perType = new Map();
    R.used.forEach(name => {
      const lay = R.layouts.get(name);
      const items = rows.filter(r => r.car === name).map(r => ({
        cat: r.cat, name: r.name, loc: r.loc, x: Number.isFinite(r.x) ? r.x : 0, mass: Number.isFinite(r.mass) ? r.mass : 0, hasMass: Number.isFinite(r.mass),
      }));
      const ordered = items.filter(i => i.cat === 'mass' && !/^other/i.test(i.name))
        .concat(items.filter(i => i.cat === 'equip' && i.loc === 'under'), items.filter(i => i.cat === 'equip' && i.loc === 'roof'), items.filter(i => i.cat === 'mass' && /^other/i.test(i.name)));
      const tareKg = ordered.reduce((a, i) => a + i.mass, 0);
      const momTare = ordered.reduce((a, i) => a + i.mass * i.x, 0);
      const xg0 = tareKg > 0 ? momTare / tareKg : 0;
      // passenger centroids (car-centre coordinates)
      const seatN = lay.seatBlocks.reduce((a, b) => a + b.n, 0);
      const seatX = seatN ? lay.seatBlocks.reduce((a, b) => a + b.n * (lay.mid - (b.x0 + b.x1) / 2), 0) / seatN : 0;
      const stA = lay.standRects.reduce((a, q) => a + (q.x1 - q.x0) * (q.y1 - q.y0), 0);
      const standX = stA ? lay.standRects.reduce((a, q) => a + (q.x1 - q.x0) * (q.y1 - q.y0) * (lay.mid - (q.x0 + q.x1) / 2), 0) / stA : 0;
      const half = lay.bc / 2;
      const cases = (cfg.cases || []).map(cs => {
        const cap = lay.capacity[String(cs.name).toLowerCase()];
        const seated = Number.isFinite(cap.seated) ? cap.seated : 0, standing = Number.isFinite(cap.standing) ? cap.standing : 0;
        const paxMass = (seated + standing) * paxKg;
        const M = tareKg + paxMass;
        const mom = momTare + seated * paxKg * seatX + standing * paxKg * standX;
        const xg = M > 0 ? mom / M : 0;
        const b1 = M * (half + xg) / (2 * half), b2 = M - b1;   // b1 = END 1 bogie
        const axle = Math.max(b1, b2) / 2;
        return { name: cs.name, seated, standing, pax: seated + standing, paxMass, mass: M, xg, b1, b2, axle, ok: axle / 1000 <= maxAxle + 1e-9 };
      });
      const target = num(lay.type.tare, NaN) * 1000;
      perType.set(name, { name, lay, items: ordered, tareKg, xg0, target, diff: Number.isFinite(target) ? tareKg - target : NaN, seatX, standX, cases, missing: items.filter(i => !i.hasMass).length });
      if (!items.length) R.warnings.push(`${name}: no rows in the equipment / mass list, so the weight calculation is empty.`);
    });
    const train = (cfg.cases || []).map((cs, ci) => {
      let mass = 0, axle = 0, pax = 0;
      R.form.cars.forEach(car => { const w = perType.get(car.type.name); if (!w) return; const q = w.cases[ci]; mass += q.mass; pax += q.pax; axle = Math.max(axle, q.axle); });
      return { name: cs.name, mass, pax, axle, ok: axle / 1000 <= maxAxle + 1e-9 };
    });
    const tareTrain = R.form.cars.reduce((a, car) => a + (perType.get(car.type.name) ? perType.get(car.type.name).tareKg : 0), 0);
    return { perType, train, tareTrain, maxAxle, paxKg };
  };
})();
