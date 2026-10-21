/* Train Layout Tool — browser UI */
(function () {
  'use strict';
  const TLT = globalThis.TLT;
  const $ = id => document.getElementById(id);
  const STORE_KEY = 'tlt-inputs-v1';
  const ALLOWED_IN_VIEWER = new Set(['pdf', 'json', 'zip', 'svg', 'csv', 'txt', 'md', 'html']);

  let cfg = null;
  let R = null, sheets = [];
  let current = 0;
  let zoom = 1;
  let timer = null;

  /* ---------- helpers ---------- */
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const set = (obj, path, val) => { const ks = path.split('.'); let o = obj; ks.slice(0, -1).forEach(k => { if (o[k] == null) o[k] = {}; o = o[k]; }); o[ks[ks.length - 1]] = val; };
  const fmt = n => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US').replace(/,/g, ' ') : '—');

  function toast(msg, err) {
    const t = $('toast');
    t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, err ? 6000 : 3000);
  }
  function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); } catch (e) { /* storage unavailable */ } }
  function restore() { try { const s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

  /* ---------- field builders ---------- */
  // f(label, path, kind, opts) — kind: num | text | select | check | area
  function field(base, label, path, kind, o) {
    o = o || {};
    const id = 'f-' + (base ? base.replace(/[^a-z0-9]/gi, '_') + '-' : '') + path.replace(/[^a-z0-9]/gi, '_');
    const full = base ? base + '.' + path : path;
    const v = get(cfg, full);
    const cls = 'f' + (o.wide || kind === 'area' ? ' wide' : '') + (kind === 'check' ? ' check' : '');
    let input;
    if (kind === 'select') input = `<div class="in"><select id="${id}" data-path="${full}" data-kind="${o.numeric ? 'num' : 'text'}">${o.options.map(op => { const [val, lab] = Array.isArray(op) ? op : [op, op]; return `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(lab)}</option>`; }).join('')}</select></div>`;
    else if (kind === 'check') return `<div class="${cls}"><input type="checkbox" id="${id}" data-path="${full}" data-kind="check"${v ? ' checked' : ''}><label for="${id}">${esc(label)}</label></div>`;
    else if (kind === 'area') input = `<div class="in"><textarea id="${id}" data-path="${full}" data-kind="text" rows="${o.rows || 4}" spellcheck="false">${esc(v)}</textarea></div>`;
    else input = `<div class="in"><input id="${id}" data-path="${full}" data-kind="${kind}" type="${kind === 'num' ? 'number' : 'text'}" step="any" value="${esc(v)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>${o.unit ? `<span class="unit">${esc(o.unit)}</span>` : ''}</div>`;
    return `<div class="${cls}"><label for="${id}">${esc(label)}</label>${input}${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</div>`;
  }
  const grp = (title, body, open) => `<details class="grp"${open ? ' open' : ''}><summary>${esc(title)}</summary>${body}</details>`;

  function renderInputs() {
    const openState = [...document.querySelectorAll('details.grp')].map(d => d.open);
    const F = (...a) => field('', ...a);
    const cabTypes = cfg.carTypes.filter(t => t.cab).map(t => t.name);
    const midTypes = cfg.carTypes.filter(t => !t.cab).map(t => t.name);
    let html = '';
    html += grp('Project & sheet', `<div class="fields">
      ${F('Company', 'project.company', 'text')}${F('Client', 'project.client', 'text')}
      ${F('Project', 'project.project', 'text', { wide: true })}
      ${F('Drawing No.', 'project.drawingNo', 'text')}${F('Revision', 'project.revision', 'text')}
      ${F('Drawn by', 'project.drawnBy', 'text')}${F('Checked by', 'project.checkedBy', 'text')}
      ${F('Date', 'project.date', 'text')}${F('Status stamp', 'project.status', 'text')}
      ${F('Paper size', 'project.paper', 'select', { options: ['A3', 'A2', 'A1'] })}
      ${F('Train layout rows', 'project.trainRows', 'select', { options: [['1', 'One row'], ['2', 'Two rows (larger scale)']] })}
    </div>`, true);
    html += grp('Train formation', `<div class="fields">
      ${F('Formation', 'formation', 'text', { wide: true, hint: 'Car types from END 1 to END 2, separated by <code>-</code>. Use <code>|</code> between units. <code>X\'</code> uses type X turned round; <code>X*</code> also turns a car. Driving cars at the train ends always face outwards.' })}
      ${F('Driving car sheet', 'detail.driving', 'select', { options: cabTypes.length ? cabTypes : ['—'] })}
      ${F('Intermediate car sheet', 'detail.intermediate', 'select', { options: midTypes.length ? midTypes : ['—'] })}
    </div>`, true);
    html += grp('Car body & bogie (all cars)', `<div class="fields">
      ${F('Body width', 'common.bodyWidth', 'num', { unit: 'mm' })}${F('Side wall + lining', 'common.wallThk', 'num', { unit: 'mm' })}
      ${F('Floor height ATR', 'common.floorHeight', 'num', { unit: 'mm' })}${F('Roof height ATR', 'common.roofHeight', 'num', { unit: 'mm' })}
      ${F('Max. height (AC / panto)', 'common.maxHeight', 'num', { unit: 'mm' })}${F('End wall thickness', 'common.endWallThk', 'num', { unit: 'mm' })}
      ${F('Gangway width', 'common.gangwayWidth', 'num', { unit: 'mm' })}${F('Door clear width', 'common.doorWidth', 'num', { unit: 'mm' })}
      ${F('Door height', 'common.doorHeight', 'num', { unit: 'mm' })}${F('Cab side door width', 'common.cabDoorWidth', 'num', { unit: 'mm' })}
      ${F('Wheel diameter (new)', 'common.wheelDia', 'num', { unit: 'mm' })}${F('Bogie wheelbase', 'common.wheelbase', 'num', { unit: 'mm' })}
    </div>`);
    const trans = cfg.interior.seatType === 'transverse';
    html += grp('Interior & seating rules', `<div class="fields">
      ${F('Seating', 'interior.seatType', 'select', { options: [['longitudinal', 'Longitudinal'], ['transverse', 'Transverse (facing bays)']] })}
      ${F('Seat width / pax', 'interior.seatWidth', 'num', { unit: 'mm' })}
      ${F('Seat depth', 'interior.seatDepth', 'num', { unit: 'mm' })}
      ${F('Foot zone in front of seats', 'interior.footZone', 'num', { unit: 'mm' })}
      ${F('Clearance at doors', 'interior.doorClearance', 'num', { unit: 'mm', hint: 'Each side of a door, for the draft screen.' })}
      ${F('Clearance at end wall / cab', 'interior.endClearance', 'num', { unit: 'mm' })}
      ${trans ? F('Seats per side (row)', 'interior.transSeatsPerSide', 'num') + F('Transverse seat depth', 'interior.transSeatDepth', 'num', { unit: 'mm' }) + F('Legroom, facing seats', 'interior.transLegroom', 'num', { unit: 'mm', hint: 'Seat front to seat front.' }) : ''}
      ${F('Wheelchair space length', 'interior.wcLength', 'num', { unit: 'mm' })}${F('Wheelchair space width', 'interior.wcWidth', 'num', { unit: 'mm' })}
      ${F('Turning circle Ø', 'interior.wcTurning', 'num', { unit: 'mm' })}${F('Min. aisle (check)', 'interior.minAisle', 'num', { unit: 'mm' })}
      ${F('Default cubicle depth', 'interior.cabinetDepth', 'num', { unit: 'mm' })}
      ${F('Count wheelchair space as standing area', 'interior.wcAsStanding', 'check', { wide: true })}
    </div><p class="hint">Default dimensions follow common EN / PRM practice (wheelchair space 1300 × 700, Ø1500 turning circle). Confirm the exact values against the standard that applies to the project.</p>`);
    html += grp('Car types', `<p class="hint">Each car type is edited once and used wherever it appears in the formation. Positions run from END 1 (cab end of a driving car).</p><div id="types">${cfg.carTypes.map((t, i) => typeCard(t, i)).join('')}</div><button class="btn small" id="addType">Add car type</button>`, true);
    html += grp('Load cases & mass', `<div class="fields">
      ${F('Passenger mass', 'loads.paxMass', 'num', { unit: 'kg' })}${F('Max. axle load', 'loads.maxAxleLoad', 'num', { unit: 't' })}
      ${F('Axles per car', 'loads.axlesPerCar', 'num')}${F('Round standing pax', 'loads.rounding', 'select', { options: [['floor', 'Down'], ['round', 'Nearest'], ['ceil', 'Up']] })}
    </div>
    <div style="overflow-x:auto"><table class="cases"><thead><tr><th>Case</th><th>Type</th><th>pax/m² or factor</th><th>Of case</th><th>Note</th><th></th></tr></thead><tbody>
    ${cfg.cases.map((c, i) => `<tr>
      <td><input id="case-${i}-name" data-path="cases.${i}.name" data-kind="text" value="${esc(c.name)}"></td>
      <td><select id="case-${i}-kind" data-path="cases.${i}.kind" data-kind="text" data-rerender="1">${[['seated', 'Seated'], ['density', 'Density'], ['factor', 'Factor']].map(([v, l]) => `<option value="${v}"${c.kind === v ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
      <td>${c.kind === 'density' ? `<input class="num" id="case-${i}-d" type="number" step="any" data-path="cases.${i}.density" data-kind="num" value="${esc(c.density)}">` : c.kind === 'factor' ? `<input class="num" id="case-${i}-f" type="number" step="any" data-path="cases.${i}.factor" data-kind="num" value="${esc(c.factor)}">` : ''}</td>
      <td>${c.kind === 'factor' ? `<input id="case-${i}-of" data-path="cases.${i}.of" data-kind="text" value="${esc(c.of)}">` : ''}</td>
      <td><input id="case-${i}-note" data-path="cases.${i}.note" data-kind="text" value="${esc(c.note || '')}"></td>
      <td><button class="btn small" data-delcase="${i}" title="Remove case" aria-label="Remove case ${esc(c.name)}">×</button></td></tr>`).join('')}
    </tbody></table></div>
    <p class="hint">Density cases give standees = standing area × pax/m². A factor case multiplies the total of another case (Dhaka TPN = 1.8 × AW2).</p>
    <button class="btn small" id="addCase">Add load case</button>`, true);
    $('inputs').innerHTML = html;
    document.querySelectorAll('details.grp').forEach((d, i) => { if (openState[i] != null) d.open = openState[i]; });
  }

  function typeCard(t, i) {
    const B = 'carTypes.' + i;
    const F = (...a) => field(B, ...a);
    return `<div class="card" data-type="${i}">
      <div class="card-head"><b>${esc(t.name || '?')}</b><span class="stats" id="tstat-${i}"></span>
        <span class="acts"><button class="btn small" data-duptype="${i}">Duplicate</button><button class="btn small" data-deltype="${i}">Delete</button></span></div>
      <div class="fields">
        ${F('Type name', 'name', 'text')}${F('Description', 'desc', 'text')}
        ${F('Driving car (with cab)', 'cab', 'check', { wide: true })}
        ${F('Length over couplers', 'couplerLength', 'num', { unit: 'mm' })}${F('Body length', 'bodyLength', 'num', { unit: 'mm' })}
        ${t.cab ? F('Cab length (body end → partition)', 'cabLength', 'num', { unit: 'mm', wide: true }) : ''}
        ${F('Bogie centres', 'bogieCentres', 'num', { unit: 'mm' })}${F('Motor bogies', 'motorBogies', 'select', { numeric: true, options: [['0', '0 (trailer)'], ['1', '1'], ['2', '2']] })}
        ${F('Doors per side', 'doorsPerSide', 'num')}${F('Door pitch in car', 'doorPitch', 'num', { unit: 'mm' })}
        ${F('END 2 coupler face → nearest door ctr', 'doorRearOffset', 'num', { unit: 'mm', wide: true, hint: 'Half the car-to-car end door pitch for equal spacing across the gangway.' })}
        ${F('Tare mass AW0', 'tare', 'num', { unit: 't' })}<div></div>
        ${F('Spec. seats (check)', 'specSeats', 'num')}${F('Spec. standees AW2 (check)', 'specStanding', 'num')}
        ${F('Bay rules', 'bays', 'area', { rows: 3, hint: 'One per line: <code>bay side value</code>. Side A (top of plan), B or AB. Value: max seats (e.g. <code>3</code>), <code>none</code>, <code>wheelchair</code>, or <code>cabinet:800:600:LABEL</code>. Example: <code>1 A wheelchair</code>' })}
        ${F('Equipment', 'equipment', 'area', { rows: 6, hint: 'One per line: <code>NAME, roof|under, x, length[, height[, box|ac|panto]]</code>. x = centre offset from car centre, + towards END 1 (mm).' })}
      </div></div>`;
  }

  function refreshTypeStats() {
    if (!R) return;
    cfg.carTypes.forEach((t, i) => {
      const el = $('tstat-' + i); if (!el) return;
      const l = R.layouts.get(t.name);
      el.textContent = l ? `${l.seats} seats · ${l.areas.standing.toFixed(1)} m² · B0–B${l.bays.length - 1}` : '';
    });
  }

  /* ---------- compute & render ---------- */
  function recompute() {
    try {
      R = TLT.compute(cfg);
      sheets = TLT.buildSheets(R);
    } catch (e) {
      console.error(e);
      R = null; sheets = [];
      toast('Could not build the layout: ' + e.message, true);
    }
    if (current >= sheets.length) current = Math.max(0, sheets.length - 1);
    renderTabs(); renderSummary(); renderSheet(); refreshTypeStats(); renderDxfSelect();
    persist();
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(recompute, 220); }

  function renderTabs() {
    $('tabs').innerHTML = sheets.map((s, i) => `<button class="tab" role="tab" id="tab-${i}" aria-selected="${i === current}" data-sheet="${i}">${i + 1} · ${esc(s.short)}</button>`).join('') +
      `<span class="grow"></span><span class="zoom"><button class="btn small" id="zOut" aria-label="Zoom out">−</button><span id="zLab">${Math.round(zoom * 100)}%</span><button class="btn small" id="zIn" aria-label="Zoom in">+</button><button class="btn small" id="zFit">Fit</button></span>`;
  }
  function renderSheet() {
    const el = $('sheet');
    if (!sheets.length) { el.innerHTML = '<p style="padding:24px;color:#555">Add at least one car to the formation to see the drawings.</p>'; return; }
    el.innerHTML = TLT.renderSVG(sheets[current]);
    applyZoom();
  }
  function applyZoom() {
    const desk = $('desk'), sh = $('sheet');
    const w = Math.max(200, (desk.clientWidth - 28) * zoom);
    sh.style.width = w + 'px';
    const lab = $('zLab'); if (lab) lab.textContent = Math.round(zoom * 100) + '%';
  }
  function renderSummary() {
    if (!R) { $('summary').innerHTML = ''; return; }
    const seats = R.form.cars.reduce((a, c) => a + R.layouts.get(c.type.name).seats, 0);
    const kp = (k, v, cls) => `<div class="kpi${cls ? ' ' + cls : ''}"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`;
    let h = kp('Cars', R.form.cars.length) + kp('Length', fmt(R.form.length) + ' mm') + kp('Seats', seats) + kp('Wheelchair', R.wcCount);
    R.totals.forEach(t => { if (t.kind !== 'seated') h += kp(t.name, fmt(t.total)); });
    const worst = R.totals.reduce((m, t) => (t.axleMax > (m ? m.axleMax : -1) ? t : m), null);
    if (worst) h += kp(`Max axle (${worst.name})`, worst.axleMax.toFixed(2) + ' t', worst.ok ? 'ok' : 'bad');
    if (R.warnings.length) h += `<div class="warns"><b>${R.warnings.length} check${R.warnings.length > 1 ? 's' : ''} to review</b><ul>${R.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
    $('summary').innerHTML = h;
  }
  function renderDxfSelect() {
    const sel = $('dxfWhich');
    const prev = sel.value;
    sel.innerHTML = '<option value="all">DXF: all sheets</option>' + sheets.map((s, i) => `<option value="${i}">DXF: ${i + 1} · ${esc(s.short)}</option>`).join('');
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  }

  /* ---------- files ---------- */
  const downloadsCap = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
  const inViewer = !!(window.claude && typeof window.claude.use === 'function');

  async function offerFile(name, bytes, mime) {
    const dl = inViewer ? await downloadsCap : null;
    if (dl) {
      let fname = name, data = bytes;
      const ext = name.split('.').pop().toLowerCase();
      if (!ALLOWED_IN_VIEWER.has(ext)) { data = TLT.zipStore([{ name, data: bytes }]); fname = name.replace(/\.[^.]+$/, '') + '.zip'; }
      try {
        const res = await dl.save({ filename: fname, data: new Blob([data]) });
        if (res && res.status === 'saved') toast(`Saved ${fname}${fname !== name ? ' (contains ' + name + ')' : ''}`);
      } catch (e) {
        if (e && e.code === 'declined') toast('Download cancelled.');
        else if (e && e.code === 'rate_limited') toast('Another download is waiting for confirmation. Try again in a moment.', true);
        else toast('Downloads are not available in this view. Open the tool from GitHub Pages or the downloaded HTML file.', true);
      }
      return;
    }
    if (inViewer) { toast('Downloads are not available in this view. Open the tool from GitHub Pages or the downloaded HTML file.', true); return; }
    const url = URL.createObjectURL(new Blob([bytes], { type: mime || 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const baseName = () => String(cfg.project.drawingNo || 'train-layout').replace(/[^\w.-]+/g, '_') + (cfg.project.revision ? '_Rev' + String(cfg.project.revision).replace(/[^\w]+/g, '') : '');

  function downloadPdf() {
    if (!sheets.length) return toast('Nothing to export yet.', true);
    offerFile(baseName() + '.pdf', TLT.exportPDF(sheets, { title: cfg.project.project }), 'application/pdf');
  }
  function downloadDxf() {
    if (!sheets.length) return toast('Nothing to export yet.', true);
    const w = $('dxfWhich').value;
    const idx = w === 'all' ? null : parseInt(w, 10);
    const suffix = idx == null ? '' : '_sheet' + (idx + 1);
    offerFile(baseName() + suffix + '.dxf', TLT.exportDXF(sheets, idx), 'application/dxf');
  }
  function saveInputs() {
    const data = new TextEncoder().encode(JSON.stringify(cfg, null, 2));
    offerFile(baseName() + '_inputs.json', data, 'application/json');
  }
  function loadInputs(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result);
        if (!o || !Array.isArray(o.carTypes) || !o.formation) throw new Error('This file has no car types or formation.');
        cfg = normalise(o); renderInputs(); recompute(); toast('Inputs loaded from ' + file.name + '.');
      } catch (e) { toast('Could not read ' + file.name + ': ' + e.message, true); }
    };
    rd.readAsText(file);
  }
  function normalise(o) {
    const base = TLT.PRESETS['dhaka-l5n']();
    ['project', 'common', 'interior', 'loads', 'detail'].forEach(k => { o[k] = Object.assign({}, base[k], o[k] || {}); });
    if (!Array.isArray(o.cases)) o.cases = base.cases;
    if (o.project.trainRows == null) o.project.trainRows = '1';
    return o;
  }

  /* ---------- events ---------- */
  function onInput(e) {
    const el = e.target;
    const path = el.dataset && el.dataset.path;
    if (!path) return;
    let v;
    if (el.dataset.kind === 'check') v = el.checked;
    else if (el.dataset.kind === 'num') { v = el.value === '' ? '' : parseFloat(el.value); if (Number.isNaN(v)) v = ''; }
    else v = el.value;
    const oldName = /^carTypes\.\d+\.name$/.test(path) ? get(cfg, path) : null;
    set(cfg, path, v);
    if (oldName != null && cfg.detail) {
      if (cfg.detail.driving === oldName) cfg.detail.driving = v;
      if (cfg.detail.intermediate === oldName) cfg.detail.intermediate = v;
    }
    const structural = el.dataset.rerender || /\.cab$|interior\.seatType$/.test(path);
    if (structural && e.type === 'change') { renderInputs(); recompute(); return; }
    if (/^carTypes\.\d+\.name$/.test(path) && e.type === 'change') { renderInputs(); }
    schedule();
  }

  function bind() {
    const inputs = $('inputs');
    inputs.addEventListener('input', onInput);
    inputs.addEventListener('change', onInput);
    inputs.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'addType') {
        const t = clone(cfg.carTypes[cfg.carTypes.length - 1] || TLT.PRESETS['dhaka-l5n']().carTypes[1]);
        t.name = uniqueName(t.name + 'x'); cfg.carTypes.push(t); renderInputs(); recompute();
      } else if (b.dataset.duptype != null) {
        const t = clone(cfg.carTypes[+b.dataset.duptype]); t.name = uniqueName(t.name + '-copy'); cfg.carTypes.splice(+b.dataset.duptype + 1, 0, t); renderInputs(); recompute();
      } else if (b.dataset.deltype != null) {
        const i = +b.dataset.deltype;
        if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirm delete'; setTimeout(() => { if (b.isConnected) { b.dataset.confirm = ''; b.textContent = 'Delete'; } }, 3000); return; }
        cfg.carTypes.splice(i, 1); renderInputs(); recompute();
      } else if (b.id === 'addCase') {
        cfg.cases.push({ name: 'Case ' + (cfg.cases.length + 1), kind: 'density', density: 5, note: '' }); renderInputs(); recompute();
      } else if (b.dataset.delcase != null) {
        cfg.cases.splice(+b.dataset.delcase, 1); renderInputs(); recompute();
      }
    });
    $('tabs').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sheet != null) { current = +b.dataset.sheet; renderTabs(); renderSheet(); try { localStorage.setItem(STORE_KEY + '-tab', String(current)); } catch (x) { /* */ } }
      else if (b.id === 'zIn') { zoom = Math.min(6, zoom * 1.25); applyZoom(); }
      else if (b.id === 'zOut') { zoom = Math.max(0.5, zoom / 1.25); applyZoom(); }
      else if (b.id === 'zFit') { zoom = 1; applyZoom(); }
    });
    $('btnPdf').addEventListener('click', downloadPdf);
    $('btnDxf').addEventListener('click', downloadDxf);
    $('btnSave').addEventListener('click', saveInputs);
    $('btnLoad').addEventListener('click', () => $('fileLoad').click());
    $('fileLoad').addEventListener('change', e => { const f = e.target.files[0]; if (f) loadInputs(f); e.target.value = ''; });
    $('btnReset').addEventListener('click', () => {
      const b = $('btnReset');
      if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Discard edits?'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = 'Load preset'; }, 3000); return; }
      b.dataset.confirm = ''; b.textContent = 'Load preset';
      cfg = normalise(TLT.PRESETS[$('preset').value]()); current = 0; renderInputs(); recompute(); toast('Preset loaded.');
    });
    window.addEventListener('resize', () => applyZoom());
    // drag to pan
    const desk = $('desk');
    let drag = null;
    desk.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, l: desk.scrollLeft, t: desk.scrollTop }; desk.classList.add('drag'); });
    window.addEventListener('pointermove', e => { if (!drag) return; desk.scrollLeft = drag.l - (e.clientX - drag.x); desk.scrollTop = drag.t - (e.clientY - drag.y); });
    window.addEventListener('pointerup', () => { drag = null; desk.classList.remove('drag'); });
    desk.addEventListener('wheel', e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoom = Math.min(6, Math.max(0.5, zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); applyZoom();
    }, { passive: false });
  }
  function uniqueName(n) { let s = n, k = 2; while (cfg.carTypes.some(t => t.name === s)) s = n + k++; return s; }

  /* ---------- start ---------- */
  function start() {
    $('preset').innerHTML = TLT.PRESET_LIST.map(p => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
    const saved = restore();
    cfg = saved && Array.isArray(saved.carTypes) ? normalise(saved) : normalise(TLT.PRESETS['dhaka-l5n']());
    if (cfg.meta && cfg.meta.preset) $('preset').value = cfg.meta.preset;
    try { const t = parseInt(localStorage.getItem(STORE_KEY + '-tab'), 10); if (Number.isFinite(t)) current = t; } catch (e) { /* */ }
    renderInputs();
    bind();
    recompute();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
