/* Train Layout Tool — browser UI (4 steps) */
(function () {
  'use strict';
  const TLT = globalThis.TLT;
  const $ = id => document.getElementById(id);
  const STORE_KEY = 'tlt-inputs-v2';
  const UI_KEY = 'tlt-ui-v2';
  const ALLOWED_IN_VIEWER = new Set(['pdf', 'json', 'zip', 'svg', 'csv', 'txt', 'md', 'html', 'xlsx']);
  const EQ_COLS = [
    { key: 'car', head: 'Car Type', hint: 'Must match a car variant name, e.g. Tc, M1, M2' },
    { key: 'cat', head: 'Category', hint: 'Equipment (drawn on the layouts) or Mass item (carbody, bogies, cables, interior … weight only)' },
    { key: 'name', head: 'Equipment / Item', hint: 'Name shown on the drawing or in the weight list, e.g. VVVF, Carbody shell' },
    { key: 'loc', head: 'Location', hint: 'Underframe or Roof (equipment only)' },
    { key: 'length', head: 'Length (mm)', hint: 'Along the car' },
    { key: 'width', head: 'Width (mm)', hint: 'Across the car' },
    { key: 'height', head: 'Height (mm)', hint: 'Box height below the mounting face (roof: above roof)' },
    { key: 'x', head: 'X from car centre (mm)', hint: 'Centre of the item; + towards END 1. Used for drawing and for the centre of gravity' },
    { key: 'y', head: 'Y from centre line (mm)', hint: 'Equipment centre; + towards side A' },
    { key: 'mass', head: 'Mass (kg)', hint: 'Used for the tare mass and axle loads' },
    { key: 'kind', head: 'Symbol', hint: 'Optional: box, ac or panto' },
  ];

  let cfg = null;
  const gen = { main: null, uf: null, wt: null };
  const ui = { pane: 1, sheet: { main: 0, uf: 0, wt: 0 }, zoom: { main: 1, uf: 1, wt: 1 }, wcar: null };
  let timer = null;

  /* ---------- helpers ---------- */
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const set = (obj, path, val) => { const ks = path.split('.'); let o = obj; ks.slice(0, -1).forEach(k => { if (o[k] == null) o[k] = {}; o = o[k]; }); o[ks[ks.length - 1]] = val; };
  const fmt = n => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US').replace(/,/g, ' ') : '—');
  const stamp = () => JSON.stringify(cfg);

  function toast(msg, err) {
    const t = $('toast');
    t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, err ? 6500 : 3200);
  }
  function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); localStorage.setItem(UI_KEY, JSON.stringify({ pane: ui.pane })); } catch (e) { /* storage unavailable */ } }
  function restore() { try { const s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function restoreUi() { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch (e) { return {}; } }

  /* ---------- field builder ---------- */
  function field(base, label, path, kind, o) {
    o = o || {};
    const full = base ? base + '.' + path : path;
    const id = 'f-' + full.replace(/[^a-z0-9]/gi, '_');
    const v = get(cfg, full);
    const cls = 'f' + (o.wide || kind === 'area' ? ' wide' : '') + (kind === 'check' ? ' check' : '');
    if (kind === 'check') return `<div class="${cls}"><input type="checkbox" id="${id}" data-path="${full}" data-kind="check"${v ? ' checked' : ''}${o.re ? ' data-rerender="1"' : ''}><label for="${id}">${esc(label)}</label></div>`;
    let input;
    if (kind === 'select') input = `<div class="in"><select id="${id}" data-path="${full}" data-kind="${o.numeric ? 'num' : 'text'}"${o.re ? ' data-rerender="1"' : ''}>${o.options.map(op => { const [val, lab] = Array.isArray(op) ? op : [op, op]; return `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(lab)}</option>`; }).join('')}</select></div>`;
    else if (kind === 'area') input = `<div class="in"><textarea id="${id}" data-path="${full}" data-kind="text" rows="${o.rows || 3}" spellcheck="false">${esc(v)}</textarea></div>`;
    else input = `<div class="in"><input id="${id}" data-path="${full}" data-kind="${kind}" type="${kind === 'num' ? 'number' : 'text'}" step="any" value="${esc(v)}">${o.unit ? `<span class="unit">${esc(o.unit)}</span>` : ''}</div>`;
    return `<div class="${cls}"><label for="${id}">${esc(label)}</label>${input}${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</div>`;
  }
  const card = (title, body, extra) => `<div class="card"${extra || ''}><h3>${esc(title)}</h3>${body}</div>`;

  /* ================= Pane 1: Main Dimensions ================= */
  function renderPane1() {
    const F = (...a) => field('', ...a);
    const trans = cfg.interior.seatType === 'transverse';
    let h = `<div class="pane-head"><h2>Main Dimensions</h2><p>Enter the train formation, car body data and one set of data per car variant, then press Generate Results.</p></div>`;
    h += '<div class="cards">';
    h += card('Project & sheet', `<div class="fields">
      ${F('Company', 'project.company', 'text')}${F('Client', 'project.client', 'text')}
      ${F('Project', 'project.project', 'text', { wide: true })}
      ${F('Drawing No.', 'project.drawingNo', 'text')}${F('Revision', 'project.revision', 'text')}
      ${F('Drawn by', 'project.drawnBy', 'text')}${F('Checked by', 'project.checkedBy', 'text')}
      ${F('Date', 'project.date', 'text')}${F('Status stamp', 'project.status', 'text')}
      ${F('Paper size', 'project.paper', 'select', { options: ['A3', 'A2', 'A1'] })}
      ${F('Train layout rows', 'project.trainRows', 'select', { options: [['1', 'One row'], ['2', 'Two rows (larger scale)']] })}
    </div>`);
    h += card('Train formation', `<div class="fields">
      ${F('Formation', 'formation', 'text', { wide: true, hint: 'Car variants from END 1 to END 2, separated by <code>-</code>; <code>|</code> between units. <code>X\'</code> = variant X turned round; <code>X*</code> also turns a car. Driving cars at the train ends face outwards.' })}
      <div class="f"><label for="variantCount">Number of car variants</label><div class="in"><input id="variantCount" type="number" min="1" max="12" step="1" value="${cfg.carTypes.length}"></div></div>
      <div class="f"><label>Variants in formation</label><div class="hint" id="formationInfo" style="margin:6px 0 0"></div></div>
    </div>`);
    h += card('Car body & bogie (all cars)', `<div class="fields">
      ${F('Body width', 'common.bodyWidth', 'num', { unit: 'mm' })}${F('Side wall + lining', 'common.wallThk', 'num', { unit: 'mm' })}
      ${F('Floor height ATR', 'common.floorHeight', 'num', { unit: 'mm' })}${F('Roof height ATR', 'common.roofHeight', 'num', { unit: 'mm' })}
      ${F('Max. height (AC / panto)', 'common.maxHeight', 'num', { unit: 'mm' })}${F('Floor to equipment mounting face', 'common.mountDepth', 'num', { unit: 'mm' })}
      ${F('End wall thickness', 'common.endWallThk', 'num', { unit: 'mm' })}${F('Gangway width', 'common.gangwayWidth', 'num', { unit: 'mm' })}
      ${F('Wheel diameter (new)', 'common.wheelDia', 'num', { unit: 'mm' })}${F('Bogie wheelbase', 'common.wheelbase', 'num', { unit: 'mm' })}
    </div>`);
    const D = cfg.doors;
    h += card('Door system', `<div class="fields">
      <div class="f wide"><span class="sub">Passenger doors</span></div>
      ${F('Door type', 'doors.type', 'select', { wide: true, options: ['Bi-parting sliding (pocket)', 'Bi-parting sliding plug', 'Bi-parting external sliding', 'Single-leaf sliding'] })}
      ${F('Clear width', 'doors.width', 'num', { unit: 'mm' })}${F('Clear height', 'doors.height', 'num', { unit: 'mm' })}
      <p class="hint wide" style="grid-column:1/-1">Number of doors per side and door pitch are set per car variant.</p>
      ${F('Front detrainment (emergency) door', 'doors.detrain.on', 'check', { wide: true, re: true })}
      ${D.detrain.on ? F('Detrainment door width', 'doors.detrain.width', 'num', { unit: 'mm' }) + F('Detrainment door height', 'doors.detrain.height', 'num', { unit: 'mm' }) : ''}
      ${F('Cab side doors (both sides)', 'doors.cabSide.on', 'check', { wide: true, re: true })}
      ${D.cabSide.on ? F('Cab side door width', 'doors.cabSide.width', 'num', { unit: 'mm' }) + F('Cab side door height', 'doors.cabSide.height', 'num', { unit: 'mm' }) + F('Cab side door centre from cab-end body face', 'doors.cabSide.pos', 'num', { unit: 'mm', wide: true }) : ''}
      ${F('Cab-to-saloon door', 'doors.cabSaloon.on', 'check', { wide: true, re: true })}
      ${D.cabSaloon.on ? F('Type', 'doors.cabSaloon.type', 'select', { options: ['Hinged', 'Sliding'] }) + F('Clear width', 'doors.cabSaloon.width', 'num', { unit: 'mm' }) + F('Height', 'doors.cabSaloon.height', 'num', { unit: 'mm' }) + F('Offset from centre line (+ side A)', 'doors.cabSaloon.y', 'num', { unit: 'mm' }) : ''}
    </div>`);
    h += card('HVAC', `<div class="fields">
      ${F('Saloon HVAC units per car', 'hvac.unitsPerCar', 'num')}<div></div>
      ${F('Cab HVAC applicable (driving cars)', 'hvac.cabHvac', 'check', { wide: true })}
    </div><p class="hint">Position, size and mass of each unit come from the equipment list (step 2): saloon units are roof rows named AC…, the cab unit a row named CAB AC or CAB HVAC. The tool checks the counts.</p>`);
    h += card('Interior & seating rules', `<div class="fields">
      ${F('Seating', 'interior.seatType', 'select', { re: true, options: [['longitudinal', 'Longitudinal'], ['transverse', 'Transverse (facing bays)']] })}
      ${F('Seat width / pax', 'interior.seatWidth', 'num', { unit: 'mm' })}
      ${F('Seat depth', 'interior.seatDepth', 'num', { unit: 'mm' })}${F('Foot zone in front of seats', 'interior.footZone', 'num', { unit: 'mm' })}
      ${F('Clearance at doors', 'interior.doorClearance', 'num', { unit: 'mm' })}${F('Clearance at end wall / cab', 'interior.endClearance', 'num', { unit: 'mm' })}
      ${trans ? F('Seats per side (row)', 'interior.transSeatsPerSide', 'num') + F('Transverse seat depth', 'interior.transSeatDepth', 'num', { unit: 'mm' }) + F('Legroom, facing seats', 'interior.transLegroom', 'num', { unit: 'mm' }) : ''}
      ${F('Wheelchair space length', 'interior.wcLength', 'num', { unit: 'mm' })}${F('Wheelchair space width', 'interior.wcWidth', 'num', { unit: 'mm' })}
      ${F('Turning circle Ø', 'interior.wcTurning', 'num', { unit: 'mm' })}${F('Min. aisle (check)', 'interior.minAisle', 'num', { unit: 'mm' })}
      ${F('Default cubicle depth', 'interior.cabinetDepth', 'num', { unit: 'mm' })}<div></div>
      ${F('Count wheelchair space as standing area', 'interior.wcAsStanding', 'check', { wide: true })}
    </div><p class="hint">Defaults follow common EN / PRM practice (wheelchair space 1300 × 700, Ø1500 turning circle). Confirm against the standard for each project.</p>`);
    h += '</div>';

    h += `<div class="section-title"><h3>Car variants</h3><span class="hint" style="margin:0">One card per car variant. Positions run from END 1 (cab end of a driving car). Equipment and mass items are entered in step 2.</span></div>`;
    h += `<div class="cards" id="types">${cfg.carTypes.map((t, i) => typeCard(t, i)).join('')}</div>`;

    h += `<div class="section-title"><h3>Load cases & mass</h3></div><div class="cards"><div class="card" style="grid-column:1/-1"><div class="fields" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
      ${F('Passenger mass', 'loads.paxMass', 'num', { unit: 'kg' })}${F('Max. axle load', 'loads.maxAxleLoad', 'num', { unit: 't' })}
      ${F('Axles per car', 'loads.axlesPerCar', 'num')}${F('Round standing pax', 'loads.rounding', 'select', { options: [['floor', 'Down'], ['round', 'Nearest'], ['ceil', 'Up']] })}
    </div>
    <div class="scroll-x" style="margin-top:10px"><table class="data"><thead><tr><th>Case</th><th>Type</th><th>pax/m² or factor</th><th>Of case</th><th>Note</th><th></th></tr></thead><tbody>
    ${cfg.cases.map((c, i) => `<tr>
      <td><input id="case-${i}-name" data-path="cases.${i}.name" data-kind="text" value="${esc(c.name)}"></td>
      <td><select id="case-${i}-kind" data-path="cases.${i}.kind" data-kind="text" data-rerender="1">${[['seated', 'Seated only'], ['density', 'Density'], ['factor', 'Factor of case']].map(([v, l]) => `<option value="${v}"${c.kind === v ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
      <td>${c.kind === 'density' ? `<input class="num" id="case-${i}-d" type="number" step="any" data-path="cases.${i}.density" data-kind="num" value="${esc(c.density)}">` : c.kind === 'factor' ? `<input class="num" id="case-${i}-f" type="number" step="any" data-path="cases.${i}.factor" data-kind="num" value="${esc(c.factor)}">` : ''}</td>
      <td>${c.kind === 'factor' ? `<input id="case-${i}-of" data-path="cases.${i}.of" data-kind="text" value="${esc(c.of)}">` : ''}</td>
      <td><input id="case-${i}-note" data-path="cases.${i}.note" data-kind="text" value="${esc(c.note || '')}"></td>
      <td><button class="btn small" data-delcase="${i}" aria-label="Remove case ${esc(c.name)}">×</button></td></tr>`).join('')}
    </tbody></table></div>
    <p class="hint">Density: standees = standing area × pax/m². Factor: multiplies the total of another case (TPN = 1.8 × AW2).</p>
    <button class="btn small" id="addCase">Add load case</button></div></div>`;

    h += `<div class="genbar"><p>All inputs are saved in this browser. Next, check the equipment and mass list, then generate all drawings and calculations.</p><button class="btn primary big" data-pane="2">Next: Equipment Inputs →</button></div>`;
    $('pane-1').innerHTML = h;
    refreshPane1Info();
  }

  function typeCard(t, i) {
    const B = 'carTypes.' + i;
    const F = (...a) => field(B, ...a);
    return `<div class="card" data-type="${i}">
      <div class="card-head"><b>Variant ${i + 1}: ${esc(t.name || '?')}</b><span class="stats" id="tstat-${i}"></span>
        <span class="acts"><button class="btn small" data-duptype="${i}">Duplicate</button><button class="btn small" data-deltype="${i}">Delete</button></span></div>
      <div class="fields">
        ${F('Variant name', 'name', 'text')}${F('Description', 'desc', 'text')}
        ${F('Driving car (with cab)', 'cab', 'check', { wide: true, re: true })}
        ${F('Length over couplers', 'couplerLength', 'num', { unit: 'mm' })}${F('Body length', 'bodyLength', 'num', { unit: 'mm' })}
        ${t.cab ? F('Cab length (body end → partition)', 'cabLength', 'num', { unit: 'mm', wide: true }) : ''}
        ${F('Bogie centres', 'bogieCentres', 'num', { unit: 'mm' })}${F('Motor bogies', 'motorBogies', 'select', { numeric: true, options: [['0', '0 (trailer)'], ['1', '1'], ['2', '2']] })}
        ${F('Doors per side', 'doorsPerSide', 'num')}${F('Door pitch in car', 'doorPitch', 'num', { unit: 'mm' })}
        ${F('END 2 coupler face → nearest door centre', 'doorRearOffset', 'num', { unit: 'mm', wide: true })}
        ${F('Tare mass AW0', 'tare', 'num', { unit: 't' })}<div></div>
        ${F('Spec. seats (check)', 'specSeats', 'num')}${F('Spec. standees AW2 (check)', 'specStanding', 'num')}
        ${F('Bay rules', 'bays', 'area', { rows: 2, hint: 'One per line: <code>bay side value</code> — side A, B or AB; value = max seats, <code>none</code>, <code>wheelchair</code> or <code>cabinet:800:600:LABEL</code>. Bays B0…Bn from END 1.' })}
      </div></div>`;
  }

  function refreshPane1Info() {
    let R = null;
    try { R = TLT.compute(cfg); } catch (e) { /* shown on generate */ }
    cfg.carTypes.forEach((t, i) => {
      const el = $('tstat-' + i); if (!el || !R) return;
      const l = R.layouts.get(t.name);
      const n = R.form.cars.filter(c => c.type === t).length;
      el.textContent = l ? `${n}× in train · ${l.seats} seats · ${l.areas.standing.toFixed(1)} m²` : '';
    });
    const info = $('formationInfo');
    if (info && R) {
      const counts = R.used.map(nm => `${nm} ×${R.form.cars.filter(c => c.type.name === nm).length}`).join(', ');
      info.innerHTML = R.form.errors.length ? `<span class="pill bad">${esc(R.form.errors[0])}</span>` : `${R.form.cars.length} cars, ${R.used.length} variants: ${esc(counts)}`;
    }
  }

  function setVariantCount(n) {
    n = Math.max(1, Math.min(12, Math.round(n)));
    while (cfg.carTypes.length < n) {
      const last = cfg.carTypes[cfg.carTypes.length - 1];
      const t = clone(last); t.name = uniqueName(last.cab ? 'M' : (last.name.replace(/\d+$/, '') || 'M')); t.cab = false; t.bays = ''; t.specSeats = ''; t.specStanding = '';
      cfg.carTypes.push(t);
    }
    if (cfg.carTypes.length > n) cfg.carTypes.splice(n);
    renderPane1(); markChanged();
  }
  function uniqueName(n) { let k = 1, s = n + k; while (cfg.carTypes.some(t => t.name === s)) s = n + ++k; return s; }

  /* ================= Pane 2: Equipment inputs ================= */
  function rowStatus(r, R) {
    const n = TLT.normEquipRow(r);
    const types = cfg.carTypes.map(t => t.name);
    if (!n.car || !types.includes(n.car)) return ['bad', 'Unknown car variant'];
    if (!n.name) return ['bad', 'No name'];
    if (n.cat === 'mass') return Number.isFinite(n.mass) ? (R && !R.used.includes(n.car) ? ['info', 'Not in formation'] : ['ok', 'OK']) : ['bad', 'Mass missing'];
    if (!Number.isFinite(n.x) || !(n.length > 0)) return ['bad', 'X or length missing'];
    const hw = TLT.num(cfg.common.bodyWidth, 2950) / 2;
    if (Number.isFinite(n.width) && Math.abs(n.y) + n.width / 2 > hw + 1) return ['bad', 'Outside body width'];
    if (R && !R.used.includes(n.car)) return ['info', 'Not in formation'];
    return ['ok', 'OK'];
  }
  function renderPane2() {
    let R = null; try { R = TLT.compute(cfg); } catch (e) { /* */ }
    const rows = cfg.equipment || [];
    const st = rows.map(r => rowStatus(r, R));
    const bad = st.filter(s => s[0] === 'bad').length;
    const perCar = cfg.carTypes.map(t => `${t.name}: ${rows.filter(r => String(r.car).trim() === t.name).length}`).join(' · ');
    let h = `<div class="pane-head"><h2>Equipment Inputs</h2><p>Load the equipment and mass list from Excel. Equipment rows are drawn on the layouts; mass items (carbody, bogies, cables, interior …) are used only in the weight calculation.</p></div>`;
    h += '<div class="cards">';
    h += card('1. Excel format', `<div class="scroll-x"><table class="data"><thead><tr><th>Column</th><th>Meaning</th></tr></thead><tbody>${EQ_COLS.map(c => `<tr><td class="cols">${esc(c.head)}</td><td>${esc(c.hint)}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">One sheet with all cars. Column order does not matter; headers are recognised by name. Mass items only need Car Type, Category, Item, X and Mass. The template contains the current list, so you can edit it and upload it again.</p>
      <button class="btn" id="dlTemplate">Download Excel template</button>`);
    h += card('2. Upload equipment list', `<div class="drop" id="drop"><p><b>Drop the .xlsx or .csv file here</b></p><p class="hint">or</p><button class="btn primary" id="pickXls">Choose file…</button><input type="file" id="fileXls" accept=".xlsx,.xls,.csv" hidden></div>
      <p class="hint" style="margin-top:10px">Current list: <b>${esc(cfg.equipmentSource || '—')}</b><br>${rows.length} rows · ${esc(perCar)}${bad ? ` · <span class="pill bad">${bad} row${bad > 1 ? 's' : ''} to fix</span>` : ''}</p>`);
    h += '</div>';
    h += `<div class="section-title"><h3>3. Equipment &amp; mass list</h3><span class="hint" style="margin:0">Small corrections can be made here; the Excel file stays your master copy.</span><span class="grow"></span><button class="btn small" id="addRow">Add row</button></div>`;
    h += `<div class="card"><div class="scroll-x"><table class="data"><thead><tr><th>Status</th>${EQ_COLS.map(c => `<th>${esc(c.head)}</th>`).join('')}<th></th></tr></thead><tbody>`;
    rows.forEach((r, i) => {
      const [cls, txt] = st[i];
      h += `<tr class="${/^m/i.test(r.cat || '') ? 'cat-mass' : ''}"><td><span class="pill ${cls}">${esc(txt)}</span></td>` + EQ_COLS.map(c => {
        const id = `eq-${i}-${c.key}`;
        if (c.key === 'car') return `<td><select id="${id}" data-path="equipment.${i}.car" data-kind="text" data-eq="1">${[...new Set(cfg.carTypes.map(t => t.name).concat([String(r.car)]))].map(n => `<option${n === String(r.car) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></td>`;
        if (c.key === 'cat') return `<td><select id="${id}" data-path="equipment.${i}.cat" data-kind="text" data-eq="1" data-rerender2="1"><option${!/^m/i.test(r.cat || '') ? ' selected' : ''}>Equipment</option><option${/^m/i.test(r.cat || '') ? ' selected' : ''}>Mass item</option></select></td>`;
        if (c.key === 'loc') return `<td><select id="${id}" data-path="equipment.${i}.loc" data-kind="text" data-eq="1"><option value="under"${r.loc !== 'roof' ? ' selected' : ''}>Underframe</option><option value="roof"${r.loc === 'roof' ? ' selected' : ''}>Roof</option></select></td>`;
        if (c.key === 'kind') return `<td><select id="${id}" data-path="equipment.${i}.kind" data-kind="text" data-eq="1">${[['', 'auto'], ['box', 'box'], ['ac', 'ac'], ['panto', 'panto']].map(([v, l]) => `<option value="${v}"${String(r.kind || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></td>`;
        const numeric = c.key !== 'name';
        return `<td><input id="${id}" ${numeric ? 'class="num" type="number" step="any"' : ''} data-path="equipment.${i}.${c.key}" data-kind="${numeric ? 'num' : 'text'}" data-eq="1" value="${esc(r[c.key])}"></td>`;
      }).join('') + `<td><button class="btn small" data-delrow="${i}" aria-label="Delete row ${i + 1}">×</button></td></tr>`;
    });
    if (!rows.length) h += `<tr><td colspan="${EQ_COLS.length + 2}" class="hint" style="padding:16px">No equipment yet. Download the template, fill it in and upload it.</td></tr>`;
    h += '</tbody></table></div></div>';
    h += `<div class="genbar"><p>Generates the train and car layouts with capacity (step 3), the underframe layouts (step 4) and the weight calculation (step 5).</p><button class="btn primary big" id="genAll">Generate Results →</button></div>`;
    $('pane-2').innerHTML = h;
  }
  function refreshRowStatus() {
    let R = null; try { R = TLT.compute(cfg); } catch (e) { /* */ }
    (cfg.equipment || []).forEach((r, i) => {
      const el = $('eq-' + i + '-car'); if (!el) return;
      const pill = el.closest('tr').querySelector('.pill');
      const [cls, txt] = rowStatus(r, R);
      pill.className = 'pill ' + cls; pill.textContent = txt;
    });
  }

  /* ---------- Excel / CSV ---------- */
  function headerKey(h) {
    const s = String(h || '').trim().toLowerCase();
    if (!s) return null;
    if (/^x(\s|$|\(|_)|x\s*from|longitud/.test(s)) return 'x';
    if (/^y(\s|$|\(|_)|y\s*from|lateral|transvers/.test(s)) return 'y';
    if (/^l(\s|$|\()|length/.test(s)) return 'length';
    if (/^w(\s|$|\()|width/.test(s)) return 'width';
    if (/^h(\s|$|\()|height/.test(s)) return 'height';
    if (/mass|weight|\bkg\b/.test(s)) return 'mass';
    if (/categ|class/.test(s)) return 'cat';
    if (/locat|mount|roof|underframe/.test(s)) return 'loc';
    if (/symbol|kind|shape/.test(s)) return 'kind';
    if (/car|vehicle|variant/.test(s)) return 'car';
    if (/equip|name|item|descr/.test(s)) return 'name';
    return null;
  }
  function rowsFromAoa(aoa) {
    let hi = -1, map = null;
    for (let i = 0; i < Math.min(aoa.length, 15); i++) {
      const m = {};
      (aoa[i] || []).forEach((h, j) => { const k = headerKey(h); if (k && m[k] == null) m[k] = j; });
      if (['car', 'name', 'x'].every(k => m[k] != null) && (m.length != null || m.mass != null)) { hi = i; map = m; break; }
    }
    if (hi < 0) throw new Error('No header row found. It needs at least Car Type, Equipment / Item, X from car centre and Length or Mass columns.');
    const out = [];
    const clean = v => (typeof v === 'string' ? v.replace(/[,\s]/g, '') : v);
    aoa.slice(hi + 1).forEach(r => {
      if (!r || r.every(c => c === '' || c == null)) return;
      const o = {};
      EQ_COLS.forEach(c => { if (map[c.key] != null) o[c.key] = r[map[c.key]]; });
      if (!String(o.car || '').trim() && !String(o.name || '').trim()) return;
      ['length', 'width', 'height', 'x', 'y', 'mass'].forEach(k => { const v = parseFloat(clean(o[k])); o[k] = Number.isFinite(v) ? v : ''; });
      o.car = String(o.car == null ? '' : o.car).trim(); o.name = String(o.name == null ? '' : o.name).trim();
      o.loc = /^r/i.test(String(o.loc || '')) ? 'roof' : 'under';
      o.cat = /^(m|w)/i.test(String(o.cat || '').trim()) ? 'Mass item' : 'Equipment';
      o.kind = String(o.kind || '').trim().toLowerCase();
      if (!['box', 'ac', 'panto'].includes(o.kind)) o.kind = '';
      out.push(o);
    });
    return out;
  }
  function parseCsv(text) {
    const rows = []; let row = [], cur = '', q = false;
    const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  function importFile(file) {
    const isCsv = /\.csv$/i.test(file.name);
    if (!isCsv && !window.XLSX) { toast('The Excel reader could not load (no internet connection). Save the sheet as CSV and upload that instead.', true); return; }
    const rd = new FileReader();
    rd.onload = () => {
      try {
        let aoa;
        if (isCsv) aoa = parseCsv(String(rd.result));
        else {
          const wb = window.XLSX.read(new Uint8Array(rd.result), { type: 'array' });
          const name = wb.SheetNames.find(n => /equip/i.test(n)) || wb.SheetNames[0];
          aoa = window.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true });
        }
        const rows = rowsFromAoa(aoa);
        if (!rows.length) throw new Error('The sheet has a header row but no equipment rows.');
        cfg.equipment = rows;
        cfg.equipmentSource = `${file.name} (${new Date().toISOString().slice(0, 10)})`;
        renderPane2(); markChanged();
        const unknown = [...new Set(rows.map(r => r.car).filter(c => !cfg.carTypes.some(t => t.name === c)))];
        toast(`${rows.length} rows loaded from ${file.name}.` + (unknown.length ? ` Unknown car variants: ${unknown.join(', ')}.` : ''), unknown.length > 0);
      } catch (e) { toast(`Could not read ${file.name}: ${e.message}`, true); }
    };
    if (isCsv) rd.readAsText(file); else rd.readAsArrayBuffer(file);
  }
  function downloadTemplate() {
    const head = EQ_COLS.map(c => c.head);
    const isMass = r => /^m/i.test(r.cat || '');
    const body = (cfg.equipment || []).map(r => EQ_COLS.map(c => (c.key === 'cat' ? (isMass(r) ? 'Mass item' : 'Equipment') : c.key === 'loc' ? (isMass(r) ? '' : r.loc === 'roof' ? 'Roof' : 'Underframe') : r[c.key] == null ? '' : r[c.key])));
    if (!body.length) body.push([cfg.carTypes[0] ? cfg.carTypes[0].name : 'Tc', 'Equipment', 'VVVF', 'Underframe', 3400, 1400, 600, 1700, -700, 900, '']);
    if (window.XLSX) {
      const X = window.XLSX;
      const wb = X.utils.book_new();
      const ws = X.utils.aoa_to_sheet([head].concat(body));
      ws['!cols'] = head.map(h => ({ wch: Math.max(10, h.length + 2) }));
      X.utils.book_append_sheet(wb, ws, 'Equipment');
      const ins = [['Column', 'Meaning']].concat(EQ_COLS.map(c => [c.head, c.hint]),
        [[], ['Car variants', cfg.carTypes.map(t => t.name).join(', ')], ['Sign convention', 'X + towards END 1 (cab end of a driving car); Y + towards side A (top of the plan view)'], ['Mounting face', `${cfg.common.mountDepth} mm below floor; Height is measured down from it`],
          ['Mass items', 'Typical rows: Carbody shell, Bogie END 1, Bogie END 2, Electrical cables & cabinets, Pneumatic piping, Interior ceiling & lining, Floor, Seats, Passenger doors & operators, Glazing, Couplers & draft gear, … and Other items last'],
          ['Bogie X', 'Bogie END 1 at + half the bogie centres, Bogie END 2 at - half (e.g. +6900 / -6900)']]);
      const wi = X.utils.aoa_to_sheet(ins); wi['!cols'] = [{ wch: 26 }, { wch: 80 }];
      X.utils.book_append_sheet(wb, wi, 'Instructions');
      const out = X.write(wb, { type: 'array', bookType: 'xlsx' });
      offerFile(baseName() + '_equipment.xlsx', new Uint8Array(out), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else {
      const csv = [head].concat(body).map(r => r.map(v => (/[",;\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v)).join(',')).join('\r\n');
      offerFile(baseName() + '_equipment.csv', new TextEncoder().encode(csv), 'text/csv');
      toast('Excel library unavailable offline — downloaded the template as CSV.');
    }
  }

  /* ================= Pane 5: Weight calculations (editable list + live results) ================= */
  function renderWeightEdit() {
    let R = null; try { R = TLT.compute(cfg); } catch (e) { /* */ }
    const names = R ? R.used : cfg.carTypes.map(t => t.name);
    if (!names.includes(ui.wcar)) ui.wcar = names[0];
    const car = ui.wcar;
    const list = cfg.equipment || [];
    const isMass = r => /^m/i.test(r.cat || '');
    const idx = list.map((r, i) => i).filter(i => list[i].car === car);
    const order = idx.filter(i => isMass(list[i]) && !/^other/i.test(list[i].name))
      .concat(idx.filter(i => !isMass(list[i]) && list[i].loc !== 'roof'), idx.filter(i => !isMass(list[i]) && list[i].loc === 'roof'), idx.filter(i => isMass(list[i]) && /^other/i.test(list[i].name)));
    let h = `<div class="chips" role="group" aria-label="Car variant">${names.map(n => `<button class="chip" data-wcar="${esc(n)}" aria-pressed="${n === car}">${esc(n)}</button>`).join('')}</div>`;
    h += `<div class="wgrid"><div class="card"><h3>Mass list — ${esc(car)}</h3><div class="scroll-x"><table class="data"><thead><tr><th>Category</th><th>Item</th><th>X from centre (mm)</th><th>Mass (kg)</th><th></th></tr></thead><tbody>`;
    order.forEach(i => {
      const r = list[i];
      const m = isMass(r);
      h += `<tr class="${m ? 'cat-mass' : ''}"><td>${m ? 'Mass item' : (r.loc === 'roof' ? 'Equipment · roof' : 'Equipment · underframe')}</td>
        <td><input id="w-${i}-name" data-path="equipment.${i}.name" data-kind="text" value="${esc(r.name)}"></td>
        <td><input class="num" id="w-${i}-x" type="number" step="any" data-path="equipment.${i}.x" data-kind="num" value="${esc(r.x)}"></td>
        <td><input class="num" id="w-${i}-m" type="number" step="any" data-path="equipment.${i}.mass" data-kind="num" value="${esc(r.mass)}"></td>
        <td>${m ? `<button class="btn small" data-delw="${i}" aria-label="Delete ${esc(r.name)}">×</button>` : ''}</td></tr>`;
    });
    h += `<tr class="total"><td></td><td>Calculated tare (AW0)</td><td class="num-out" id="wt-xg"></td><td class="num-out" id="wt-tare"></td><td></td></tr>`;
    h += `<tr><td></td><td>Target tare (Main Dimensions)</td><td></td><td class="num-out" id="wt-target"></td><td></td></tr>`;
    h += `<tr><td></td><td>Difference</td><td></td><td class="num-out" id="wt-diff"></td><td></td></tr>`;
    h += `</tbody></table></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px"><button class="btn primary small" id="addMass">Add line item</button><span class="hint" style="margin:0">New items go above "Other items". Equipment rows (drawn) are edited in step 2.</span></div></div>`;
    h += `<div class="card"><h3>Axle load per load case — ${esc(car)}</h3><div class="scroll-x" id="wt-cases"></div>
      <p class="hint">Passengers ${TLT.num(cfg.loads.paxMass, 60)} kg each, seated at the seat centroid and standing at the standing-area centroid. Bogie loads from the centre of gravity; axle load = heavier bogie ÷ 2. Limit ${TLT.num(cfg.loads.maxAxleLoad, 16)} t.</p>
      <h3 style="margin-top:14px">Train</h3><div class="scroll-x" id="wt-train"></div></div></div>`;
    $('weight-edit').innerHTML = h;
    refreshWeightResults();
  }
  function refreshWeightResults() {
    let R = null; try { R = TLT.compute(cfg); } catch (e) { return; }
    const w = R.weights.perType.get(ui.wcar); if (!w || !$('wt-tare')) return;
    const t = kg => (kg / 1000).toFixed(2) + ' t';
    $('wt-tare').textContent = t(w.tareKg);
    $('wt-xg').textContent = (w.xg0 > 0 ? '+' : '') + Math.round(w.xg0);
    $('wt-target').textContent = Number.isFinite(w.target) ? t(w.target) : '—';
    $('wt-diff').innerHTML = Number.isFinite(w.diff) ? `<span class="pill ${Math.abs(w.diff) > 0.03 * w.target ? 'bad' : 'ok'}">${w.diff > 0 ? '+' : ''}${(w.diff / 1000).toFixed(2)} t (${((w.diff / w.target) * 100).toFixed(1)} %)</span>` : '—';
    $('wt-cases').innerHTML = `<table class="data"><thead><tr><th>Case</th><th>Pax</th><th>Gross</th><th>CoG X</th><th>Bogie 1</th><th>Bogie 2</th><th>Max axle</th><th></th></tr></thead><tbody>${w.cases.map(q => `<tr><td>${esc(q.name)}</td><td class="num">${q.pax}</td><td class="num">${t(q.mass)}</td><td class="num">${q.xg > 0 ? '+' : ''}${Math.round(q.xg)}</td><td class="num">${t(q.b1)}</td><td class="num">${t(q.b2)}</td><td class="num"><b>${t(q.axle)}</b></td><td><span class="pill ${q.ok ? 'ok' : 'bad'}">${q.ok ? 'OK' : 'Exceeded'}</span></td></tr>`).join('')}</tbody></table>`;
    $('wt-train').innerHTML = `<table class="data"><thead><tr><th>Case</th><th>Train mass</th><th>Max axle</th><th></th></tr></thead><tbody>${R.weights.train.map(q => `<tr><td>${esc(q.name)}</td><td class="num">${t(q.mass)}</td><td class="num">${t(q.axle)}</td><td><span class="pill ${q.ok ? 'ok' : 'bad'}">${q.ok ? 'OK' : 'Exceeded'}</span></td></tr>`).join('')}</tbody></table>`;
    if (gen.wt) { const st = $('stale-wt'); if (st) st.innerHTML = gen.wt.stamp !== stamp() ? `<div class="stale"><span>Inputs have changed since the weight sheets were generated.</span><button class="btn primary small" data-regen="all">Generate again</button></div>` : ''; }
  }

  /* ================= Results panes (3, 4, 5) ================= */
  function generate(which) {
    try {
      const R = TLT.compute(cfg);
      const sheets = which === 'main' ? TLT.buildSheets(R) : which === 'uf' ? TLT.buildUnderframeSheets(R) : TLT.buildWeightSheets(R);
      gen[which] = { R, sheets, stamp: stamp() };
      if (ui.sheet[which] >= sheets.length) ui.sheet[which] = 0;
    } catch (e) {
      console.error(e);
      toast('Could not build the drawings: ' + e.message, true);
      return false;
    }
    return true;
  }
  function generateAll() { return ['main', 'uf', 'wt'].every(generate); }
  function renderResults(which) {
    const g = gen[which];
    const stale = $('stale-' + which), body = $('body-' + which);
    if (!g || !g.sheets.length) {
      stale.innerHTML = '';
      body.innerHTML = `<div class="empty"><p><b>No drawings yet.</b></p><p>Enter the inputs in steps 1 and 2, then press Generate Results at the end of step 2.</p><button class="btn primary" data-goto="2">Go to step 2</button></div>`;
      return;
    }
    stale.innerHTML = g.stamp !== stamp() ? `<div class="stale"><span>Inputs have changed since these drawings were generated.</span><button class="btn primary small" data-regen="all">Generate again</button></div>` : '';
    const cur = ui.sheet[which];
    let h = `<div class="toolbar"><div class="tabs">${g.sheets.map((s, i) => `<button class="tab" role="tab" aria-selected="${i === cur}" data-sheet="${which}:${i}">${i + 1} · ${esc(s.short)}</button>`).join('')}</div>
      <span class="grow"></span>
      <span class="zoom"><button class="btn small" data-zoom="${which}:out" aria-label="Zoom out">-</button><span id="zlab-${which}">${Math.round(ui.zoom[which] * 100)}%</span><button class="btn small" data-zoom="${which}:in" aria-label="Zoom in">+</button><button class="btn small" data-zoom="${which}:fit">Fit</button></span>
      <button class="btn primary" data-pdf="${which}">Download PDF</button>
      <select class="sel" id="dxfWhich-${which}" aria-label="DXF sheets"><option value="all">DXF: all sheets</option>${g.sheets.map((s, i) => `<option value="${i}">DXF: ${i + 1} · ${esc(s.short)}</option>`).join('')}</select>
      <button class="btn primary" data-dxf="${which}">Download DXF</button></div>`;
    if (which !== 'wt') h += `<div class="summary">${which === 'main' ? summaryMain(g.R) : summaryUf(g.R)}</div>`;
    h += `<div class="desk" id="desk-${which}"><div class="sheet" id="sheet-${which}">${TLT.renderSVG(g.sheets[cur])}</div></div>`;
    body.innerHTML = h;
    applyZoom(which);
    bindDesk($('desk-' + which), which);
  }
  const kp = (k, v, cls) => `<div class="kpi${cls ? ' ' + cls : ''}"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`;
  function summaryMain(R) {
    const seats = R.form.cars.reduce((a, c) => a + R.layouts.get(c.type.name).seats, 0);
    let h = kp('Cars', R.form.cars.length) + kp('Variants', R.used.length) + kp('Length', fmt(R.form.length) + ' mm') + kp('Seats', seats) + kp('Wheelchair', R.wcCount);
    R.totals.forEach(t => { if (t.kind !== 'seated') h += kp(t.name, fmt(t.total)); });
    const worst = R.totals.reduce((m, t) => (t.axleMax > (m ? m.axleMax : -1) ? t : m), null);
    if (worst) h += kp(`Max axle (${worst.name})`, worst.axleMax.toFixed(2) + ' t', worst.ok ? 'ok' : 'bad');
    if (R.warnings.length) h += `<div class="warns"><b>${R.warnings.length} check${R.warnings.length > 1 ? 's' : ''} to review</b><ul>${R.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
    return h;
  }
  function summaryUf(R) {
    let h = '';
    R.used.forEach(n => {
      const l = R.layouts.get(n);
      const u = l.equipment.items.filter(e => e.loc === 'under');
      const m = u.reduce((a, e) => a + (Number.isFinite(e.mass) ? e.mass : 0), 0);
      h += kp(`${n} underframe`, `${u.length} items · ${fmt(m)} kg`, u.length ? '' : 'bad');
    });
    const errs = [];
    R.used.forEach(n => R.layouts.get(n).equipment.errors.forEach(e => errs.push(`${n}: ${e}`)));
    if (errs.length) h += `<div class="warns"><b>${errs.length} equipment row${errs.length > 1 ? 's' : ''} skipped</b><ul>${errs.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
    return h;
  }
  function applyZoom(which) {
    const desk = $('desk-' + which), sh = $('sheet-' + which);
    if (!desk || !sh) return;
    sh.style.width = Math.max(200, (desk.clientWidth - 28) * ui.zoom[which]) + 'px';
    const lab = $('zlab-' + which); if (lab) lab.textContent = Math.round(ui.zoom[which] * 100) + '%';
  }
  function bindDesk(desk, which) {
    let drag = null;
    desk.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, l: desk.scrollLeft, t: desk.scrollTop }; desk.classList.add('drag'); });
    desk.addEventListener('pointermove', e => { if (!drag) return; desk.scrollLeft = drag.l - (e.clientX - drag.x); desk.scrollTop = drag.t - (e.clientY - drag.y); });
    const end = () => { drag = null; desk.classList.remove('drag'); };
    desk.addEventListener('pointerup', end); desk.addEventListener('pointerleave', end);
    desk.addEventListener('wheel', e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      ui.zoom[which] = Math.min(6, Math.max(0.5, ui.zoom[which] * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); applyZoom(which);
    }, { passive: false });
  }

  /* ---------- files ---------- */
  const inViewer = !!(window.claude && typeof window.claude.use === 'function');
  const downloadsCap = inViewer ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
  async function offerFile(name, bytes, mime) {
    if (inViewer) {
      const dl = await downloadsCap;
      if (!dl) { toast('Downloads are not available in this view. Open the tool from GitHub Pages or the standalone HTML file.', true); return; }
      let fname = name, data = bytes;
      const ext = name.split('.').pop().toLowerCase();
      if (!ALLOWED_IN_VIEWER.has(ext)) { data = TLT.zipStore([{ name, data: bytes }]); fname = name.replace(/\.[^.]+$/, '') + '.zip'; }
      try {
        const res = await dl.save({ filename: fname, data: new Blob([data]) });
        if (res && res.status === 'saved') toast(`Saved ${fname}${fname !== name ? ' (contains ' + name + ')' : ''}.`);
      } catch (e) {
        if (e && e.code === 'declined') toast('Download cancelled.');
        else if (e && e.code === 'rate_limited') toast('Another download is waiting for confirmation. Try again in a moment.', true);
        else toast('Downloads are not available in this view. Open the tool from GitHub Pages or the standalone HTML file.', true);
      }
      return;
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: mime || 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const baseName = () => String(cfg.project.drawingNo || 'train-layout').replace(/[^\w.-]+/g, '_') + (cfg.project.revision ? '_Rev' + String(cfg.project.revision).replace(/[^\w]+/g, '') : '');
  const suffixOf = w => (w === 'uf' ? '_underframe' : w === 'wt' ? '_weight' : '');
  function downloadPdf(which) {
    const g = gen[which]; if (!g) return;
    offerFile(baseName() + suffixOf(which) + '.pdf', TLT.exportPDF(g.sheets, { title: cfg.project.project }), 'application/pdf');
  }
  function downloadDxf(which) {
    const g = gen[which]; if (!g) return;
    const w = $('dxfWhich-' + which).value;
    const idx = w === 'all' ? null : parseInt(w, 10);
    offerFile(baseName() + suffixOf(which) + (idx == null ? '' : '_sheet' + (idx + 1)) + '.dxf', TLT.exportDXF(g.sheets, idx), 'application/dxf');
  }
  function loadInputs(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result);
        if (!o || !Array.isArray(o.carTypes) || !o.formation) throw new Error('This file has no car variants or formation.');
        cfg = normalise(o); renderAllInputs(); generateAll(); showPane(ui.pane); persist();
        toast('Inputs loaded from ' + file.name + '.');
      } catch (e) { toast('Could not read ' + file.name + ': ' + e.message, true); }
    };
    rd.readAsText(file);
  }
  function normalise(o) {
    const base = TLT.PRESETS['dhaka-l5n']();
    ['project', 'common', 'interior', 'loads', 'hvac'].forEach(k => { o[k] = Object.assign({}, base[k], o[k] || {}); });
    if (!o.doors) {
      const c = o.common || {};
      o.doors = clone(base.doors);
      if (c.doorWidth) o.doors.width = c.doorWidth;
      if (c.doorHeight) o.doors.height = c.doorHeight;
      if (c.cabDoorWidth) o.doors.cabSide.width = c.cabDoorWidth;
    } else {
      o.doors = Object.assign({}, base.doors, o.doors);
      ['detrain', 'cabSide', 'cabSaloon'].forEach(k => { o.doors[k] = Object.assign({}, base.doors[k], o.doors[k] || {}); });
    }
    if (!Array.isArray(o.cases)) o.cases = base.cases;
    if (o.project.trainRows == null) o.project.trainRows = '1';
    if (o.common.mountDepth == null || o.common.mountDepth === '') o.common.mountDepth = 250;
    if (!Array.isArray(o.equipment)) {
      // older input files kept equipment as text per car type
      o.equipment = [];
      o.carTypes.forEach(t => TLT.parseEquipment(t.equipment).items.forEach(e => o.equipment.push({ car: t.name, name: e.name, loc: e.loc, length: e.length, width: e.width, height: e.height, x: e.x, y: e.y, mass: '', kind: e.kind })));
      o.equipmentSource = o.equipmentSource || 'Converted from an older input file';
    }
    o.equipment.forEach(r => { r.cat = /^m/i.test(r.cat || '') ? 'Mass item' : 'Equipment'; });
    o.carTypes.forEach(t => { delete t.equipment; });
    delete o.detail;
    return o;
  }

  /* ---------- navigation ---------- */
  function showPane(n) {
    ui.pane = n;
    [1, 2, 3, 4, 5].forEach(i => { $('pane-' + i).hidden = i !== n; $('step-' + i).setAttribute('aria-selected', String(i === n)); });
    if (n === 2) renderPane2();
    if (n === 3) renderResults('main');
    if (n === 4) renderResults('uf');
    if (n === 5) { renderWeightEdit(); renderResults('wt'); }
    persist();
    window.scrollTo({ top: 0 });
  }
  function renderAllInputs() { renderPane1(); renderPane2(); }
  function markChanged() {
    persist();
    clearTimeout(timer);
    timer = setTimeout(() => { if (ui.pane === 1) refreshPane1Info(); if (ui.pane === 2) refreshRowStatus(); if (ui.pane === 5) refreshWeightResults(); }, 250);
  }

  /* ---------- events ---------- */
  function onInput(e) {
    const el = e.target;
    if (el.id === 'variantCount') { if (e.type === 'change') setVariantCount(parseFloat(el.value) || 1); return; }
    const path = el.dataset && el.dataset.path;
    if (!path) return;
    let v;
    if (el.dataset.kind === 'check') v = el.checked;
    else if (el.dataset.kind === 'num') { v = el.value === '' ? '' : parseFloat(el.value); if (Number.isNaN(v)) v = ''; }
    else v = el.value;
    const nameMatch = /^carTypes\.(\d+)\.name$/.exec(path);
    const oldName = nameMatch ? get(cfg, path) : null;
    set(cfg, path, v);
    if (nameMatch && oldName !== v) (cfg.equipment || []).forEach(r => { if (String(r.car).trim() === oldName) r.car = v; });
    if (e.type === 'change' && (el.dataset.rerender || nameMatch)) { if (ui.pane === 1) renderPane1(); }
    if (e.type === 'change' && el.dataset.rerender2) renderPane2();
    markChanged();
  }

  function bind() {
    document.addEventListener('input', e => { if (e.target.closest('#pane-1, #pane-2, #weight-edit')) onInput(e); });
    document.addEventListener('change', e => { if (e.target.closest('#pane-1, #pane-2, #weight-edit')) onInput(e); });
    document.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pane) return showPane(+b.dataset.pane);
      if (b.dataset.goto) return showPane(+b.dataset.goto);
      if (b.id === 'genAll') { if (generateAll()) { showPane(3); toast(`Generated ${gen.main.sheets.length} layout, ${gen.uf.sheets.length} underframe and ${gen.wt.sheets.length} weight sheets.`); } return; }
      if (b.dataset.regen) { if (generateAll()) showPane(ui.pane); return; }
      if (b.dataset.wcar) { ui.wcar = b.dataset.wcar; renderWeightEdit(); return; }
      if (b.id === 'addMass') {
        const car = ui.wcar; const list = cfg.equipment = cfg.equipment || [];
        const oi = list.findIndex(r => r.car === car && /^m/i.test(r.cat || '') && /^other/i.test(r.name));
        const row = { cat: 'Mass item', car, name: 'New item', loc: 'under', length: '', width: '', height: '', x: 0, y: 0, mass: 0, kind: '' };
        if (oi >= 0) list.splice(oi, 0, row); else list.push(row);
        renderWeightEdit(); markChanged(); return;
      }
      if (b.dataset.delw != null) { cfg.equipment.splice(+b.dataset.delw, 1); renderWeightEdit(); markChanged(); return; }
      if (b.dataset.sheet) { const [w, i] = b.dataset.sheet.split(':'); ui.sheet[w] = +i; renderResults(w); return; }
      if (b.dataset.zoom) {
        const [w, op] = b.dataset.zoom.split(':');
        ui.zoom[w] = op === 'in' ? Math.min(6, ui.zoom[w] * 1.25) : op === 'out' ? Math.max(0.5, ui.zoom[w] / 1.25) : 1;
        applyZoom(w); return;
      }
      if (b.dataset.pdf) return downloadPdf(b.dataset.pdf);
      if (b.dataset.dxf) return downloadDxf(b.dataset.dxf);
      if (b.id === 'addCase') { cfg.cases.push({ name: 'Case ' + (cfg.cases.length + 1), kind: 'density', density: 5, note: '' }); renderPane1(); markChanged(); return; }
      if (b.dataset.delcase != null) { cfg.cases.splice(+b.dataset.delcase, 1); renderPane1(); markChanged(); return; }
      if (b.dataset.duptype != null) {
        const i = +b.dataset.duptype; const t = clone(cfg.carTypes[i]); t.name = uniqueName(t.name.replace(/\d+$/, '') || 'V');
        cfg.carTypes.splice(i + 1, 0, t);
        (cfg.equipment || []).filter(r => r.car === cfg.carTypes[i].name).forEach(r => cfg.equipment.push(Object.assign({}, r, { car: t.name })));
        renderPane1(); markChanged(); return;
      }
      if (b.dataset.deltype != null) {
        if (cfg.carTypes.length <= 1) { toast('At least one car variant is needed.', true); return; }
        if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirm delete'; setTimeout(() => { if (b.isConnected) { b.dataset.confirm = ''; b.textContent = 'Delete'; } }, 3000); return; }
        cfg.carTypes.splice(+b.dataset.deltype, 1); renderPane1(); markChanged(); return;
      }
      if (b.id === 'dlTemplate') return downloadTemplate();
      if (b.id === 'pickXls') return $('fileXls').click();
      if (b.id === 'addRow') { (cfg.equipment = cfg.equipment || []).push({ cat: 'Equipment', car: cfg.carTypes[0].name, name: 'NEW', loc: 'under', length: 1000, width: 800, height: 500, x: 0, y: 0, mass: '', kind: '' }); renderPane2(); markChanged(); return; }
      if (b.dataset.delrow != null) { cfg.equipment.splice(+b.dataset.delrow, 1); renderPane2(); markChanged(); return; }
    });
    document.addEventListener('change', e => { if (e.target.id === 'fileXls') { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; } });
    document.addEventListener('dragover', e => { const d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
    document.addEventListener('dragleave', e => { const d = e.target.closest && e.target.closest('#drop'); if (d) d.classList.remove('over'); });
    document.addEventListener('drop', e => { const d = e.target.closest && e.target.closest('#drop'); if (!d) return; e.preventDefault(); d.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) importFile(f); });

    $('btnSave').addEventListener('click', () => offerFile(baseName() + '_inputs.json', new TextEncoder().encode(JSON.stringify(cfg, null, 2)), 'application/json'));
    $('btnLoad').addEventListener('click', () => $('fileLoad').click());
    $('fileLoad').addEventListener('change', e => { const f = e.target.files[0]; if (f) loadInputs(f); e.target.value = ''; });
    $('btnReset').addEventListener('click', () => {
      const b = $('btnReset');
      if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Discard all edits?'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = 'Load preset'; }, 3000); return; }
      b.dataset.confirm = ''; b.textContent = 'Load preset';
      cfg = normalise(TLT.PRESETS[$('preset').value]()); ui.sheet = { main: 0, uf: 0, wt: 0 };
      renderAllInputs(); generateAll(); showPane(1); toast('Preset loaded.');
    });
    window.addEventListener('resize', () => { applyZoom('main'); applyZoom('uf'); applyZoom('wt'); });
  }

  /* ---------- start ---------- */
  function start() {
    $('preset').innerHTML = TLT.PRESET_LIST.map(p => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
    const saved = restore();
    cfg = normalise(saved && Array.isArray(saved.carTypes) ? saved : TLT.PRESETS['dhaka-l5n']());
    if (cfg.meta && cfg.meta.preset) $('preset').value = cfg.meta.preset;
    renderAllInputs();
    bind();
    generateAll();
    const u = restoreUi();
    showPane([1, 2, 3, 4, 5].includes(u.pane) ? u.pane : 1);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
