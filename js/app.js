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
    { key: 'name', head: 'Equipment', hint: 'Short form shown inside the box on the drawings, e.g. VVVF' },
    { key: 'desc', head: 'Description', hint: 'Optional full name, listed in the underframe equipment table, e.g. Traction inverter (VVVF)' },
    { key: 'loc', head: 'Location', hint: 'Underframe or Roof' },
    { key: 'length', head: 'Length (mm)', hint: 'Along the car' },
    { key: 'width', head: 'Width (mm)', hint: 'Across the car' },
    { key: 'height', head: 'Height (mm)', hint: 'Box height below the mounting face (roof: above roof)' },
    { key: 'x', head: 'X from car centre (mm)', hint: 'Centre of the box; + towards END 1' },
    { key: 'y', head: 'Y from centre line (mm)', hint: 'Centre of the box; + towards side A' },
    { key: 'kind', head: 'Symbol', hint: 'Optional: Auto, Eq. Box, Panto, CCD or HVAC (Auto: PAN… on the roof = Panto, AC… / HVAC… on the roof = HVAC, CCD… under the floor = CCD, else Eq. Box)' },
  ];
  const WT_COLS = [
    { key: 'car', head: 'Car Type', hint: 'Car variant name, e.g. Tc, M1, M2' },
    { key: 'loc', head: 'Location', hint: 'Car body, Roof, Interior, UF, Cab, End or Bogie (Bogie rows sit directly on the nearest bogie)' },
    { key: 'name', head: 'Item', hint: 'e.g. Carbody shell, VVVF, Seats, Bogie END 1 … put Other items last' },
    { key: 'length', head: 'Length (mm)', hint: 'Optional, along the car' },
    { key: 'width', head: 'Width (mm)', hint: 'Optional, across the car' },
    { key: 'height', head: 'Height (mm)', hint: 'Optional, vertical size' },
    { key: 'x', head: 'X from car centre (mm)', hint: 'Centre of gravity of the item; + towards END 1' },
    { key: 'y', head: 'Y from centre line (mm)', hint: 'Centre of gravity; + towards side A' },
    { key: 'z', head: 'Z above rail (mm)', hint: 'Centre of gravity height above top of rail; blank = default for the location' },
    { key: 'mass', head: 'Mass (kg)', hint: 'Item mass' },
  ];
  const LISTS = {
    equipment: { key: 'equipment', cols: null, sheet: 'Equipment', suffix: '_equipment', srcKey: 'equipmentSource', required: ['car', 'name', 'x', 'length'], sheetRe: /equip/i },
    weights: { key: 'weightItems', cols: null, sheet: 'Weights', suffix: '_weights', srcKey: 'weightSource', required: ['car', 'name', 'mass'], sheetRe: /weigh|mass/i },
  };

  let cfg = null;
  const gen = { main: null, uf: null, wt: null };
  LISTS.equipment.cols = EQ_COLS; LISTS.weights.cols = WT_COLS;
  const ui = { pane: 1, sheet: { main: 0, uf: 0, wt: 0, ft: 0 }, zoom: { main: 1, uf: 1, wt: 1, ft: 1 }, wcar: null };
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
    const id = (o.idp || 'f-') + full.replace(/[^a-z0-9]/gi, '_');
    const v = get(cfg, full);
    const cls = 'f' + (o.wide || kind === 'area' ? ' wide' : '') + (kind === 'check' ? ' check' : '');
    if (kind === 'check') return `<div class="${cls}"><input type="checkbox" id="${id}" data-path="${full}" data-kind="check"${v ? ' checked' : ''}${o.re ? ' data-rerender="1"' : ''}><label for="${id}">${esc(label)}</label></div>`;
    let input;
    if (kind === 'select') input = `<div class="in"><select id="${id}" data-path="${full}" data-kind="${o.numeric ? 'num' : 'text'}"${o.re ? ' data-rerender="1"' : ''}>${o.options.map(op => { const [val, lab] = Array.isArray(op) ? op : [op, op]; return `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(lab)}</option>`; }).join('')}</select></div>`;
    else if (kind === 'area') input = `<div class="in"><textarea id="${id}" data-path="${full}" data-kind="text" rows="${o.rows || 3}" spellcheck="false">${esc(v)}</textarea></div>`;
    else input = `<div class="in"><input id="${id}" data-path="${full}" data-kind="${kind}" type="${kind === 'num' ? 'number' : 'text'}" step="any" value="${esc(v)}"${o.re ? ' data-rerender="1"' : ''}>${o.unit ? `<span class="unit">${esc(o.unit)}</span>` : ''}</div>`;
    return `<div class="${cls}"><label for="${id}">${esc(label)}</label>${input}${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</div>`;
  }
  const card = (title, body, extra) => `<div class="card"${extra || ''}><h3>${esc(title)}</h3>${body}</div>`;

  /* car body cross-section preview (SVG, mm coordinates, z up) */
  function profileSvg(P, o) {
    o = o || {};
    const c = cfg.common || {}, W = TLT.num(c.bodyWidth, 2900), wt = TLT.num(c.wallThk, 60);
    const fh = TLT.num(c.floorHeight, 1100), rh = TLT.num(c.roofHeight, 3800), H = rh - fh;
    const hw = W / 2, out = TLT.profileOutline(P, hw, H), inn = TLT.profileOutline(P, hw - wt, H - 120);
    const full = pts => pts.map(([x, z]) => [-x, z]).concat(pts.slice(0, -1).reverse()).map(([x, z]) => `${x.toFixed(0)},${(-z).toFixed(0)}`).join(' ');
    const sole = -Math.min(fh - 250, 450);
    const pad = o.mini ? 120 : 900, x0 = -hw - pad, y0 = -H - 180, w = W + 2 * pad, h = H - sole + 420;
    let g = `<polygon points="${full(out)} ${hw},${-sole} ${-hw},${-sole}" fill="var(--soft)" stroke="var(--ink)" stroke-width="${o.mini ? 40 : 18}" stroke-linejoin="round"/>`;
    if (!o.mini) {
      g += `<polyline points="${full(inn)}" fill="none" stroke="var(--muted)" stroke-width="8" stroke-dasharray="40 30"/>`;
      g += `<line x1="${-hw - 250}" y1="0" x2="${hw + 250}" y2="0" stroke="var(--ink)" stroke-width="10"/><text x="${-hw - 260}" y="-20" text-anchor="end" font-size="110" fill="var(--muted)">floor</text>`;
      // wall start height
      if (P.z0 > 0) { const xs = hw - TLT.profileInset(P, P.z0); g += `<line x1="${xs}" y1="${-P.z0}" x2="${hw + 300}" y2="${-P.z0}" stroke="var(--muted)" stroke-width="6"/><text x="${hw + 320}" y="${-P.z0 + 35}" font-size="105" fill="var(--muted)">${P.z0} (R2000 start)</text>`; }
      // reference height and usable width
      const ins = TLT.profileInset(P, P.refH), xu = hw - wt - ins;
      g += `<line x1="${-xu}" y1="${-P.refH}" x2="${xu}" y2="${-P.refH}" stroke="var(--accent)" stroke-width="14"/>`;
      g += `<polygon points="${-xu},${-P.refH} ${-xu + 90},${-P.refH - 35} ${-xu + 90},${-P.refH + 35}" fill="var(--accent)"/><polygon points="${xu},${-P.refH} ${xu - 90},${-P.refH - 35} ${xu - 90},${-P.refH + 35}" fill="var(--accent)"/>`;
      g += `<text x="0" y="${-P.refH - 50}" text-anchor="middle" font-size="125" font-weight="600" fill="var(--accent)">usable ${Math.round(2 * xu)} mm</text>`;
      g += `<text x="${-hw - 260}" y="${-P.refH + 40}" text-anchor="end" font-size="105" fill="var(--accent)">${P.refH} AFL</text>`;
      g += `<text x="0" y="${-H + 330 + P.camber}" text-anchor="middle" font-size="120" fill="var(--muted)">${P.kind === 'vert' ? 'vertical wall' : P.kind === 'incl' ? 'inclined ' + P.angle + '°' : 'R' + P.R + ' → ' + P.angle + '°'}${P.camber ? ' · cambered roof' : ''}</text>`;
      g += `<text x="0" y="${-sole + 190}" text-anchor="middle" font-size="110" fill="var(--muted)">body ${W} · interior at floor ${W - 2 * wt}</text>`;
    }
    return `<svg viewBox="${x0} ${y0} ${w} ${h}" width="100%" role="img" aria-label="${esc(P.label)}" style="display:block;max-height:${o.mini ? 70 : 300}px;font-family:var(--f-body)">${g}</svg>`;
  }
  function profilePreviewHtml() {
    const P = TLT.profileCfg(cfg);
    return `<div class="prof-main">${profileSvg(P)}<div class="prof-cap"><b>${esc(P.label)}</b></div></div>
      <div class="prof-thumbs">${TLT.PROFILES.map(Q => `<button type="button" class="prof-thumb${Q.id === P.id ? ' on' : ''}" data-profile="${Q.id}" title="${esc(Q.label)}">${profileSvg(Object.assign({}, Q, { refH: P.refH }), { mini: true })}<span>${esc(Q.label.split(' – ')[0])}</span></button>`).join('')}</div>`;
  }

  /* ================= Pane 1: Main Dimensions ================= */
  function renderPane1() {
    const F = (...a) => field('', ...a);
    const trans = cfg.interior.seatType === 'transverse';
    let h = `<div class="pane-head"><h2>Main Dimensions</h2><p>Enter the train formation, car body data and one set of data per car variant, then press Generate Results.</p></div>`;
    h += `<div class="card excel-main" style="margin-bottom:14px"><h3>Import / export main inputs (Excel)</h3>
      <div class="excel-row"><div><p class="hint" style="margin-top:0">One workbook with all inputs of this step: <b>Parameters</b> (project, formation, car body & bogie, doors, HVAC, power, cab, windows, front view, interior rules, masses), <b>Car variants</b>, <b>Interior items</b> and <b>Load cases</b>, plus an Instructions sheet with the allowed values. The template is filled with the current inputs.</p>
      <p class="hint">Importing <b>replaces all inputs of this step</b> with the file (car variants, interior items and load cases not in the file are removed). Save inputs first if you want to keep the current set.</p>
      <button class="btn" id="mainTpl">Download main-inputs template</button></div>
      ${dropZone('main', '.xlsx')}</div></div>`;
    h += `<div class="card prof-card" style="margin-bottom:14px"><h3>Car body cross-section</h3><div class="prof-row"><div class="fields">
      ${F('Car body section', 'common.profile', 'select', { wide: true, options: TLT.PROFILES.map(Q => [Q.id, Q.label]) })}
      ${F('Reference height for standing width', 'interior.widthRefHeight', 'num', { unit: 'mm AFL' })}
      <div class="f wide"><div class="hint" id="profileInfo" style="margin:0"></div></div>
      <p class="hint" style="grid-column:1/-1;margin:0">The section sets the side-wall shape of the front view and the usable interior width for the standing area (taken at the reference height above floor; seats and the aisle are at the floor / seat level, where the wall inset is still small). Set the reference height to 0 to count the plain floor area.</p>
    </div><div id="profilePreview">${profilePreviewHtml()}</div></div></div>`;
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
    const PT = TLT.productType(cfg), ptLabel = (TLT.PRODUCT_TYPES.find(q => q[0] === PT) || ['', ''])[1];
    h += card('Train formation', `<div class="fields">
      ${F('Product type', 'productType', 'select', { re: true, options: TLT.PRODUCT_TYPES })}
      <div class="f"><label>Template</label><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;min-height:36px"><button class="btn small" data-template="${PT}" title="Replace all inputs with the ${esc(ptLabel)} example">Load ${esc(PT === 'mainline' ? 'mainline' : PT === 'lrv' ? 'LRV' : PT)} template</button>${ui.undoCfg ? '<button class="btn small" data-undotpl="1">Undo</button>' : ''}</div></div>
      <p class="hint" style="grid-column:1/-1;margin-top:0">Product type switches the relevant inputs (mainline interior only for Mainline EMU / DMU). The template replaces all inputs with an example of that product type (Save inputs first to keep yours).</p>
      ${F('Formation', 'formation', 'text', { wide: true, hint: 'Car variants from END 1 to END 2, separated by <code>-</code>; <code>|</code> between units. <code>X\'</code> = variant X turned round; <code>X*</code> also turns a car. Driving cars at the train ends face outwards.' })}
      ${F('Multiple unit factor', 'muFactor', 'num', { re: true, hint: `Number of units coupled: 2 gives <code>${esc(TLT.formationText(Object.assign({}, cfg, { muFactor: 2 })))}</code>; every second unit is turned round.` })}
      <div class="f"><label>Train formation used</label><div class="hint" style="margin:6px 0 0"><code id="formationUsed">${esc(TLT.formationText(cfg))}</code></div></div>
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
    </div><p class="hint">Position and size of each unit come from the equipment list (step 2), its mass from the design weight list (step 6): saloon units are roof rows named AC…, the cab unit a row named CAB AC or CAB HVAC. The tool checks the counts.</p>`);
    const anyCab = cfg.carTypes.some(t => TLT.hasCab(t));
    const anyAux = cfg.carTypes.some(t => { const E = TLT.carEnds(t); return E.e1 === 'aux' || E.e2 === 'aux'; });
    const CB = TLT.cabCfg(cfg);
    if (anyCab || anyAux) h += card("Driver's cab", `<div class="fields">
      ${anyAux ? `<div class="f wide"><span class="sub">Auxiliary driving desk (car ends set to "Auxiliary driving desk")</span></div>
      ${F('Desk length along car', 'cab.auxLength', 'num', { unit: 'mm' })}${F('Desk depth across car', 'cab.auxDepth', 'num', { unit: 'mm' })}
      ${F('Desk on side', 'cab.auxSide', 'select', { options: [['B', 'Side B'], ['A', 'Side A']] })}<div></div>` : ''}
      ${anyCab ? '<div class="f wide"><span class="sub">Driving cab</span></div>' : ''}
      ${anyCab ? `${F('Driving desk', 'cab.desk', 'select', { re: true, options: [['side', 'Side driving desk'], ['central', 'Central driving desk']] })}
      ${CB.desk === 'side' ? F('Desk on side', 'cab.deskSide', 'select', { options: [['B', 'Side B'], ['A', 'Side A']] }) : '<div></div>'}
      ${F('Desk depth', 'cab.deskDepth', 'num', { unit: 'mm' })}${F('Desk width', 'cab.deskWidth', 'num', { unit: 'mm' })}
      ${F('Co-driver seat', 'cab.observer', 'check', { re: true })}${CB.observer ? F('Co-driver desk', 'cab.coDesk', 'check', { re: true }) : '<div></div>'}
      ${CB.observer && CB.coDesk ? F('Co-driver desk width (across car)', 'cab.coDeskWidth', 'num', { unit: 'mm' }) + '<div></div>' : ''}
      ${F('GoA4 (driverless): remove cab back wall', 'cab.goa4', 'check', { wide: true, re: true })}
      ${CB.goa4 ? F('Covered front console depth', 'cab.consoleDepth', 'num', { unit: 'mm', wide: true, hint: 'The cab floor behind the console becomes standing area. Partition, cab-to-saloon door and driver seat are removed.' }) : ''}` : ''}
    </div><p class="hint">Driver seat follows the desk: centred behind a central desk (detrainment door moves to side A), or on the desk side with the co-driver seat (and optional co-driver desk) opposite. A cab at END 2 is drawn turned round, so the desk keeps its hand in the direction of travel.</p>`);
    const WC = TLT.windowCfg(cfg);
    const winOpts = [['single', 'Single window'], ['double', 'Two windows'], ['none', 'No window']];
    h += card('Windows (side wall)', `<div class="fields">
      ${F('Bays between doors', 'windows.inner', 'select', { re: true, options: winOpts })}${F('End bays', 'windows.end', 'select', { re: true, options: winOpts })}
      ${F('Single window width (0 = fill bay)', 'windows.singleWidth', 'num', { unit: 'mm' })}${F('Width of each of two windows', 'windows.doubleWidth', 'num', { unit: 'mm' })}
      ${F('Window height', 'windows.height', 'num', { unit: 'mm' })}${F('Sill height above floor', 'windows.sill', 'num', { unit: 'mm' })}
      ${F('Drop-down (openable) windows', 'windows.drop', 'select', { re: true, options: [['none', 'None'], ['ends', 'End bays only'], ['all', 'All windows']] })}
      ${WC.drop !== 'none' ? F('Drop-down depth (top hopper)', 'windows.dropDepth', 'num', { unit: 'mm' }) : '<div></div>'}
      ${F('Windows in passenger door leaves', 'windows.doorWin', 'check', { wide: true, re: true })}
      ${WC.doorWin ? F('Door window width (0 = auto)', 'windows.doorWinWidth', 'num', { unit: 'mm' }) + F('Door window height', 'windows.doorWinHeight', 'num', { unit: 'mm' }) + F('Door window sill above floor', 'windows.doorWinSill', 'num', { unit: 'mm' }) : ''}
    </div>`);
    if (anyCab) h += card('Windscreen & wipers', `<div class="fields">
      ${F('Windscreen', 'front.wsSplit', 'select', { options: [['single', 'One pane'], ['two', 'Two panes (centre mullion)']] })}${F('Gap to side detrainment door', 'front.wsDoorGap', 'num', { unit: 'mm' })}
      ${F('Windscreen bottom above floor', 'front.wsBottom', 'num', { unit: 'mm' })}${F('Windscreen top above floor (0 = auto)', 'front.wsTop', 'num', { unit: 'mm' })}
      ${F('Wipers', 'front.wipers', 'select', { numeric: true, options: [['0', 'None'], ['1', '1'], ['2', '2'], ['3', '3']] })}${F('Wiper type', 'front.wiperType', 'select', { options: [['single', 'Single arm'], ['pantograph', 'Pantograph arm']] })}
      ${F('Windscreen width (0 = auto)', 'front.wsWidth', 'num', { unit: 'mm', hint: 'Overall glass width across the front; with a centred door, outer edge to outer edge of the two side windows.' })}${F('Wiper blade length (0 = auto)', 'front.wiperLength', 'num', { unit: 'mm' })}
    </div><p class="hint">With a centred detrainment door the windscreen is split into two side windows around it. With the door at the side, the windscreen ends before the door (gap above) and the door has its own window at the same height; the lamps become slim columns at both outer edges. Wipers are shared evenly over the panes (one wiper goes in front of the driver).</p>`);
    if (anyCab) h += card('Front view (sheet 1)', `<div class="fields">
      ${F('Head / tail lights above floor', 'front.lightsZ', 'num', { unit: 'mm' })}${F('Lights inset from body side', 'front.lightsInset', 'num', { unit: 'mm' })}
      ${F('Coupler height ATR', 'front.couplerHeight', 'num', { unit: 'mm' })}${F('Destination display', 'front.destination', 'check')}
      ${F('Show vehicle gauge outline', 'front.showGauge', 'check', { wide: true, re: true })}
      ${TLT.frontCfg(cfg).showGauge ? F('Gauge width', 'front.gaugeWidth', 'num', { unit: 'mm' }) + F('Gauge height ATR', 'front.gaugeHeight', 'num', { unit: 'mm' }) : ''}
    </div><p class="hint">Windscreen is split around the detrainment door (Door system). The gauge outline is simplified (rectangle with chamfered corners); use the project's kinematic gauge for checks.</p>`);
    if (PT === 'mainline') {
      const AE = TLT.aeroCfg(cfg);
      h += card('Design speed & nose (mainline)', `<div class="fields">
        ${F('Design speed', 'aero.speed', 'select', { re: true, numeric: true, options: [['120', '120 km/h'], ['160', '160 km/h'], ['200', '200 km/h'], ['250', '250 km/h'], ['300', '300 km/h'], ['350', '350 km/h']] })}
        ${F('Nose length (0 = from speed)', 'aero.noseLength', 'num', { unit: 'mm', re: true })}
      </div>${(() => { const L = AE.noseLen, dd = TLT.num(cfg.cab.deskDepth, 800), DCx = TLT.doorCfg(cfg);
        const need = Math.round(Math.max((L > 1600 ? L * 0.5 : 300) + dd + 1100, DCx.cabSide.on ? L * 0.7 + DCx.cabSide.width / 2 + 150 : 0));
        const door = Math.round(L * 0.7);
        return `<div class="hint" style="background:var(--soft);border-radius:6px;padding:8px 10px;margin:8px 0"><b>Nose length</b> = horizontal distance from the front tip of the body to where the nose reaches full roof height and full car width. Leave <b>0</b> to use the value for the design speed (now ${AE.auto} mm); enter your own value only to match a reference train or your CAD nose, e.g. 3500.<br>For this nose the driving car needs a <b>cab length of at least ${need} mm</b> (car variant card) and a <b>cab side door centre at about ${door} mm or more</b> from the cab-end body face (Door system), otherwise the desk or the door would sit in the tapered nose. A longer cab also moves the first passenger door back: lengthen the car (Length over couplers and Body length) by the same amount, or shorten the door pitch.</div>`; })()}<p class="hint">Aerodynamic model: <b>${esc(AE.cls)}</b>, nose ${AE.noseLen} mm${AE.manual ? ' (entered)' : ' (from the design speed)'}. The side view, plan and front view follow it: higher speed gives a longer, lower and rounder nose, a smaller raked windscreen and slim swept lamps. Lengths used: ≤ 160 km/h about 1.6 m, 200 km/h 2.6 m, 250 km/h 4.2 m, 300 km/h 6.8 m, 350 km/h 9 m. Check the cab length of the driving car (the tool warns if the desk and the cab side door do not fit behind the nose).</p>`);
    }
    const PC = TLT.powerCfg(cfg);
    h += card('Power collection', `<div class="fields">
      ${F('Supply system', 'power.system', 'select', { re: true, options: TLT.POWER_SYSTEMS })}
      ${PC.system === '25kV' ? '<div class="f"><label>Current collection</label><div class="hint" style="margin:8px 0 0">Pantograph (overhead line)</div></div>'
        : F('Current collection', 'power.collector', 'select', { re: true, options: [['panto', 'Pantograph (overhead line)'], ['third', 'Third rail (CCD shoe gear)'], ['both', 'Pantograph + third rail']] })}
      ${PC.panto ? F('Max. pantographs per train (0 = no check)', 'power.maxPantos', 'num') + '<div></div>' : ''}
      ${PC.third ? F('Third rail contact', 'power.contact', 'select', { options: [['bottom', 'Bottom contact'], ['top', 'Top contact'], ['side', 'Side contact']] }) + '<div></div>'
        + F('Conductor rail centre from track centre', 'power.railOffset', 'num', { unit: 'mm' }) + F('Longest conductor-rail gap (check)', 'power.maxGap', 'num', { unit: 'mm', hint: '0 = no check' }) : ''}
      ${PC.system === '25kV' ? F('HV clearance on roof (note)', 'power.hvClearance', 'num', { unit: 'mm', hint: 'Shown as a note; confirm per EN 50119 / EN 50124-1 and the specification.' }) : ''}
    </div>
    <h4 style="margin:12px 0 6px;font-size:13px">Per car variant</h4><div id="powerTable">${powerTableHtml()}</div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px"><button class="btn small" id="powerTpl">Add ${esc(PC.label)} equipment</button></div>
    <p class="hint">Adds the typical collection equipment to the equipment list (step 2) and the design weight list (step 6) with typical masses: ${PC.system === '25kV' ? 'pantograph, VCB, earthing switch and arrester on the roof, main transformer under the floor' : `${PC.panto ? 'pantograph and arrester on the roof, HSCB under the floor' : 'HSCB under the floor'}${PC.third ? '; shoe fuses and CCD shoe gear on each bogie of the shoe cars' : ''}`}. Rows that already exist are kept. The checks count pantographs per unit and the shoe span along the train.</p>`, ' style="grid-column:1/-1"');
    const MLon = PT === 'mainline', MLc = TLT.mainlineCfg(cfg);
    const abOpts = [['2+2', '2+2'], ['2+1', '2+1'], ['3+2', '3+2'], ['1+1', '1+1'], ['2+0', '2 + 0']];
    h += card('Interior & seating rules', `<div class="fields">
      ${MLon ? `<div class="f wide"><span class="sub">Mainline seating, classes and vestibules</span></div>
      ${F('Seat arrangement', 'interior.mlArrangement', 'select', { options: [['facing', 'Facing bays (2 rows)'], ['airline', 'Airline (rows one way)']] })}${F('Seat length along car', 'interior.mlSeatLength', 'num', { unit: 'mm' })}
      ${F('Standard class abreast', 'interior.mlStdAbreast', 'select', { options: abOpts })}${F('Standard class seat pitch', 'interior.mlStdPitch', 'num', { unit: 'mm' })}
      ${F('1st class abreast', 'interior.mlFirstAbreast', 'select', { options: abOpts })}${F('1st class seat pitch', 'interior.mlFirstPitch', 'num', { unit: 'mm' })}
      ${F('1st class seat width', 'interior.mlFirstSeatWidth', 'num', { unit: 'mm' })}<div></div>
      ${F('Vestibules at the doors', 'interior.mlVestibules', 'check', { wide: true, re: true })}
      ${MLc.vestibules ? F('Vestibule length (centred on door)', 'interior.mlVestLength', 'num', { unit: 'mm' }) + F('Vestibule internal door width', 'interior.mlVestDoor', 'num', { unit: 'mm' }) : ''}
      <p class="hint" style="grid-column:1/-1;margin-top:0">Class per car variant is set in the variant card; toilets (standard / PRM) are added as interior items. A vestibule is extended to the end wall when less than 1200 mm would remain.</p>
      <div class="f wide"><span class="sub">General</span></div>` : ''}
      ${MLon ? '' : F('Seating', 'interior.seatType', 'select', { re: true, options: [['longitudinal', 'Longitudinal'], ['transverse', 'Transverse (facing bays)']] })}
      ${F('Seat width / pax', 'interior.seatWidth', 'num', { unit: 'mm' })}
      ${F('Seat depth', 'interior.seatDepth', 'num', { unit: 'mm' })}${F('Foot zone in front of seats', 'interior.footZone', 'num', { unit: 'mm' })}
      ${F('Clearance at doors', 'interior.doorClearance', 'num', { unit: 'mm' })}${F('Clearance at end wall / cab', 'interior.endClearance', 'num', { unit: 'mm' })}
      ${F('Min. door clearance (fixed seats per bay)', 'interior.minDoorClearance', 'num', { unit: 'mm', wide: true, hint: 'Used when a car variant asks for 6 / 7 / 8 seats between doors: the door clearance shrinks to fit, down to this value.' })}
      ${trans && !MLon ? F('Seats per side (row)', 'interior.transSeatsPerSide', 'num') + F('Transverse seat depth', 'interior.transSeatDepth', 'num', { unit: 'mm' }) + F('Legroom, facing seats', 'interior.transLegroom', 'num', { unit: 'mm' }) : ''}
      ${F('Wheelchair space length', 'interior.wcLength', 'num', { unit: 'mm' })}${F('Wheelchair space width', 'interior.wcWidth', 'num', { unit: 'mm' })}
      ${F('Turning circle Ø', 'interior.wcTurning', 'num', { unit: 'mm' })}${F('Min. aisle (check)', 'interior.minAisle', 'num', { unit: 'mm' })}
      ${F('Default cubicle depth', 'interior.cabinetDepth', 'num', { unit: 'mm' })}<div></div>
      ${F('Count wheelchair space as standing area (default for each wheelchair space)', 'interior.wcAsStanding', 'check', { wide: true })}
    </div><p class="hint">Defaults follow common EN / PRM practice (wheelchair space 1300 × 700, Ø1500 turning circle). Confirm against the standard for each project.</p>`);
    h += '</div>';

    h += `<div class="section-title"><h3>Car variants</h3><span class="hint" style="margin:0">One card per car variant. Positions run from END 1 (cab end of a driving car). Equipment positions are entered in step 2; tare mass in step 5, the design weight list in step 6.</span></div>`;
    h += `<div class="cards" id="types">${cfg.carTypes.map((t, i) => typeCard(t, i)).join('')}${interiorGuide()}</div>`;

    h += `<div class="section-title"><h3>Load cases</h3></div><div class="cards"><div class="card" style="grid-column:1/-1"><div class="fields" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
      ${F('Round standing pax', 'loads.rounding', 'select', { options: [['floor', 'Down'], ['round', 'Nearest'], ['ceil', 'Up']] })}
    </div>
    ${(() => { const aw = cfg.cases.find(q => String(q.name) === String(cfg.loads.standCase || '') && q.kind !== 'seated'); return `<h4 style="margin:14px 0 6px;font-size:13px">Per car variant</h4>
    <div class="fields" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));margin-bottom:8px">${F('Check standees target at load case', 'loads.standCase', 'select', { re: true, options: [['', '— no standees check —']].concat(cfg.cases.filter(q => q.kind !== 'seated').map(q => [q.name, q.name])) })}</div>
    <div class="scroll-x"><table class="data"><thead><tr><th>Variant</th><th>Description</th><th>Standees target${aw ? ` at ${esc(aw.name)}` : ' (choose the load case above)'}</th></tr></thead><tbody>
    ${cfg.carTypes.map((t, i) => `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.desc || '')}</td>
      <td><input class="num" id="mt-${i}-st" type="number" step="any" data-path="carTypes.${i}.specStanding" data-kind="num" value="${esc(t.specStanding)}"></td></tr>`).join('')}
    </tbody></table></div>
    <p class="hint">Tare mass, passenger mass and axle-load limit are entered in step 5 (Weight Cal. Fixed Tare). ${aw ? `The standees target is checked against ${esc(aw.name)} on the capacity sheet.` : 'Choose the load case for the standees check; without one only the seats are checked.'}</p>`; })()}
    <div class="scroll-x" style="margin-top:10px"><table class="data"><thead><tr><th>Case</th><th>Type</th><th>Density or factor</th><th>Of case</th><th title="Folding seats marked as standing area are folded: their area counts as standing and they are not counted as seats">Folding seats folded</th><th>Note</th><th></th></tr></thead><tbody>
    ${cfg.cases.map((c, i) => `<tr>
      <td><input id="case-${i}-name" data-path="cases.${i}.name" data-kind="text" value="${esc(c.name)}"></td>
      <td><select id="case-${i}-kind" data-path="cases.${i}.kind" data-kind="text" data-rerender="1">${[['seated', 'Seated only'], ['density', 'Density (pax/m²)'], ['kgm2', 'Density (kg/m²)'], ['factor', 'Factor of case']].map(([v, l]) => `<option value="${v}"${c.kind === v ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
      <td>${c.kind === 'density' || c.kind === 'kgm2' ? `<div class="in" style="display:flex;align-items:center;gap:6px"><input class="num" id="case-${i}-d" type="number" step="any" data-path="cases.${i}.density" data-kind="num" value="${esc(c.density)}"><span class="unit">${c.kind === 'kgm2' ? 'kg/m²' : 'pax/m²'}</span></div>` : c.kind === 'factor' ? `<input class="num" id="case-${i}-f" type="number" step="any" data-path="cases.${i}.factor" data-kind="num" value="${esc(c.factor)}">` : ''}</td>
      <td>${c.kind === 'factor' ? `<input id="case-${i}-of" data-path="cases.${i}.of" data-kind="text" value="${esc(c.of)}">` : ''}</td>
      <td><select id="case-${i}-fold" data-path="cases.${i}.fold" data-kind="text">${[['', `Default (${c.kind === 'seated' ? 'No' : 'Yes'})`], ['yes', 'Yes'], ['no', 'No']].map(([v, l]) => `<option value="${v}"${String(c.fold || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
      <td><input id="case-${i}-note" data-path="cases.${i}.note" data-kind="text" value="${esc(c.note || '')}"></td>
      <td><button class="btn small" data-delcase="${i}" aria-label="Remove case ${esc(c.name)}">×</button></td></tr>`).join('')}
    </tbody></table></div>
    <p class="hint">Density: standees = standing area × pax/m². Density (kg/m²): standees = standing area × kg/m² ÷ passenger mass (e.g. PXD 500 kg/m²). Factor: multiplies the total of another case (TPN = 1.8 × AW2). Folding seats folded: folding seats marked as standing area count as standing area instead of seats (default: Yes except for seated-only cases).</p>
    <button class="btn small" id="addCase">Add load case</button></div></div>`;

    h += `<div class="genbar"><p>All inputs are saved in this browser. Next, check the equipment list, then generate all drawings and calculations.</p><button class="btn primary big" data-pane="2">Next: Equipment Inputs →</button></div>`;
    $('pane-1').innerHTML = h;
    refreshPane1Info();
  }

  function typeCard(t, i) {
    const B = 'carTypes.' + i;
    const F = (...a) => field(B, ...a);
    const E = TLT.carEnds(t), ML = TLT.productType(cfg) === 'mainline';
    return `<div class="card" data-type="${i}">
      <div class="card-head"><b>Variant ${i + 1}: ${esc(t.name || '?')}</b><span class="stats" id="tstat-${i}"></span>
        <span class="acts"><button class="btn small" data-duptype="${i}">Duplicate</button><button class="btn small" data-deltype="${i}">Delete</button></span></div>
      <div class="fields">
        ${F('Variant name', 'name', 'text')}${F('Description', 'desc', 'text')}
        <div class="f wide"><span class="sub">Car ends & running gear</span></div>
        ${F('END 1', 'end1', 'select', { re: true, options: TLT.END_TYPES })}${F('END 2', 'end2', 'select', { re: true, options: TLT.END_TYPES })}
        ${F('END 1 support', 'support1', 'select', { re: true, options: SUPPORTS })}${F('END 2 support', 'support2', 'select', { re: true, options: SUPPORTS })}
        ${F('Centre bogie (bogie module)', 'centreBogie', 'check', { wide: true, re: true })}
        <p class="hint" style="grid-column:1/-1;margin-top:0">${esc(runningGearText(t))}</p>
        ${F('Length over couplers / joints', 'couplerLength', 'num', { unit: 'mm' })}${F('Body length', 'bodyLength', 'num', { unit: 'mm' })}
        ${E.cab1 ? F('END 1 cab length (body end → partition)', 'cabLength', 'num', { unit: 'mm', wide: true }) : ''}
        ${E.cab2 ? F('END 2 cab length (body end → partition)', 'cabLength2', 'num', { unit: 'mm', wide: true }) : ''}
        ${E.s1 === 'own' || E.s2 === 'own' ? F('Bogie centres (own bogies)', 'bogieCentres', 'num', { unit: 'mm' }) : '<div></div>'}${F('Motor bogies', 'motorBogies', 'select', { options: [['0', '0 (trailer)'], ['1', '1 (END 2 side)'], ['1e1', '1 (END 1 side)'], ['2', '2'], ['3', '3']] })}
        ${F('Doors per side', 'doorsPerSide', 'num')}${F('Door pitch in car', 'doorPitch', 'num', { unit: 'mm' })}
        ${F('END 2 coupler face → nearest door centre', 'doorRearOffset', 'num', { unit: 'mm', wide: true })}
        ${ML ? F('Seating class', 'seatClass', 'select', { re: true, options: [['std', 'Standard class'], ['first', '1st class'], ['mixed', '1st class from END 1, then standard']] })
          + (t.seatClass === 'mixed' ? F('1st class length from END 1 saloon start', 'firstLength', 'num', { unit: 'mm' }) : '<div></div>') : ''}
        ${ML ? '' : F('Seats between two doors (per side)', 'seatsPerBay', 'select', { re: true, options: [['', 'Auto (fill with clearance)'], ['5', '5-seater'], ['6', '6-seater'], ['7', '7-seater'], ['8', '8-seater'], ['9', '9-seater']], wide: true, hint: seatFitHint(t) })}
        ${F('Seated passengers target (check)', 'specSeats', 'num', { wide: true, hint: 'Compared with the calculated seats on the capacity sheet. Tare mass and standees target are in Load cases & mass.' })}
        <div class="f wide"><span class="sub">Interior items</span>${interiorItemsHtml(t, i)}</div>
      </div></div>`;
  }

  /* Power collection: pantographs (target, checked against the equipment list) and CCD shoes per car, with train totals */
  function powerTableHtml() {
    const P = TLT.powerCfg(cfg);
    let R = null; try { R = TLT.compute(cfg); } catch (e) { /* */ }
    const pv = R ? new Map(R.power.perVariant.map(q => [q.name, q])) : new Map();
    const nCars = n => (R ? R.form.cars.filter(c => c.type.name === n).length : 0);
    let tT = 0, tA = 0, tS = 0, anyT = false;
    const rows = cfg.carTypes.map((t, i) => {
      const q = pv.get(t.name), cars = nCars(t.name);
      const target = TLT.pantoTarget(t), actual = q ? q.actual : 0, shoes = q ? q.shoesPerCar : 0;
      if (target != null) { anyT = true; tT += target * cars; }
      tA += actual * cars; tS += shoes * cars;
      const bad = P.panto && target != null && target !== actual;
      return `<tr><td><b>${esc(t.name)}</b></td><td class="num">${cars}</td>
        ${P.panto ? `<td><input class="num" id="pw-${i}-p" type="number" min="0" step="1" data-path="carTypes.${i}.pantos" data-kind="num" value="${esc(t.pantos == null ? '' : t.pantos)}" placeholder="—"></td>
        <td class="num"${bad ? ' style="color:var(--warn);font-weight:600"' : ''}>${actual}</td><td class="num">${target != null ? target * cars : '—'}</td>` : ''}
        ${P.third ? `<td><input class="num" id="pw-${i}-c" type="number" min="0" step="2" data-path="carTypes.${i}.ccd" data-kind="num" value="${esc(t.ccd == null ? '' : t.ccd)}" placeholder="0"></td><td class="num">${shoes * cars}</td>` : ''}</tr>`;
    }).join('');
    const badA = P.panto && P.maxPantos > 0 && tA > P.maxPantos, badT = P.panto && P.maxPantos > 0 && anyT && tT > P.maxPantos;
    const red = ' style="color:var(--warn);font-weight:600"';
    return `<div class="scroll-x"><table class="data"><thead><tr><th>Variant</th><th>Cars in train</th>
      ${P.panto ? '<th>Pantographs per car (target)</th><th>In equipment list (per car)</th><th>Pantographs per train (target)</th>' : ''}${P.third ? '<th>CCD shoes per car (both sides)</th><th>CCD shoes per train</th>' : ''}</tr></thead><tbody>${rows}
      <tr class="total"><td>Train</td><td class="num">${R ? R.form.cars.length : ''}</td>
      ${P.panto ? `<td></td><td class="num"${badA ? red : ''}>${tA} in list</td><td class="num"${badT ? red : ''}>${anyT ? tT : '—'}${P.maxPantos > 0 ? ` (max. ${P.maxPantos})` : ''}</td>` : ''}
      ${P.third ? `<td></td><td class="num">${tS}</td>` : ''}</tr></tbody></table></div>
      <p class="hint">${P.panto ? 'Pantograph target: blank = no check; the drawings use the pantograph (PAN…) rows of the equipment list. ' : ''}${P.third ? 'CCD shoes: total per car on both sides, placed on the bogies from END 1 (e.g. 4 = one each side of both bogies, 2 = END 1 bogie only).' : ''}</p>`;
  }
  const SUPPORTS = [['own', 'Own bogie'], ['shared', 'Shared (Jacobs) bogie at the joint'], ['none', 'No bogie (overhang / carried by joint)']];
  function runningGearText(t) {
    let lay = null; try { lay = TLT.layoutCar(t, cfg); } catch (e) { return ''; }
    const B = lay.bogieInfo;
    if (!B.length) return 'Suspended module: no bogie; carried by the neighbouring modules through the articulation joints.';
    const d = B.map(bg => `${bg.motor ? 'motor' : 'trailer'} bogie ${bg.end === 0 ? 'at the car centre' : bg.shared ? `shared at the END ${bg.end} joint` : `at END ${bg.end}`}`).join(', ');
    return `${B.length} bogie${B.length > 1 ? 's' : ''}: ${d}${B.length >= 2 ? ` · ${Math.round(lay.bc)} mm apart` : ''} · ${lay.axles} axle${lay.axles === 1 ? '' : 's'} for the axle load.`;
  }
  function seatFitHint(t) {
    let lay = null; try { lay = TLT.layoutCar(t, cfg); } catch (e) { return ''; }
    const inner = lay.bays.filter(b => b.k0 === 'door' && b.k1 === 'door');
    if (!inner.length) return 'No bay between two doors.';
    const L = Math.min(...inner.map(b => b.x1 - b.x0));
    const sw = TLT.num(cfg.interior.seatWidth, 430), mc = TLT.num(cfg.interior.minDoorClearance, 100), dc = TLT.num(cfg.interior.doorClearance, 150);
    return `Bay between doors ${Math.round(L)} mm: up to <b>${Math.floor((L - 2 * mc) / sw)}</b> seats at ${mc} mm min. clearance (${Math.floor((L - 2 * dc) / sw)} at the normal ${dc} mm).`;
  }

  /* Interior items editor (wheelchair spaces, electrical cabinets, seat limits) */
  const ITEM_KINDS_BASE = [['wheelchair', 'Wheelchair space'], ['bicycle', 'Bicycle space'], ['folding', 'Folding seats'], ['cabinet', 'Electrical cabinet'], ['max', 'Seat limit'], ['none', 'No seats']];
  const itemKinds = () => (TLT.productType(cfg) === 'mainline' ? ITEM_KINDS_BASE.concat([['toilet', 'Toilet (standard)'], ['toiletPrm', 'Toilet (PRM)']]) : ITEM_KINDS_BASE);
  const PLACES = [['door', 'Next to door'], ['end1', 'END 1 side of bay'], ['middle', 'Middle of bay'], ['end2', 'END 2 side of bay']];
  function interiorItemsHtml(t, i) {
    let lay = null; try { lay = TLT.layoutCar(t, cfg); } catch (e) { /* */ }
    const bays = lay ? lay.bays : Array.from({ length: Math.round(TLT.num(t.doorsPerSide, 4)) + 1 }, (x, k) => ({ i: k, x0: 0, x1: 0 }));
    const items = Array.isArray(t.interiorItems) ? t.interiorItems : [];
    const sel = (id, path, opts, val, re) => `<select id="${id}" data-path="${path}" data-kind="text"${re ? ' data-rerender="1"' : ''}>${opts.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const inp = (id, path, val, lab, unit) => `<div class="f"><label for="${id}">${lab}</label><div class="in"><input id="${id}" data-path="${path}" data-kind="${unit === '' ? 'text' : 'num'}" ${unit === '' ? '' : 'type="number" step="any"'} value="${esc(val)}">${unit ? `<span class="unit">${unit}</span>` : ''}</div></div>`;
    let h = '<div class="items">';
    items.forEach((it, j) => {
      const base = `carTypes.${i}.interiorItems.${j}`, idb = `ii-${i}-${j}`;
      const bayOpts = bays.map(b => [b.i, `B${b.i}${b.x1 > b.x0 ? ' (' + Math.round(b.x1 - b.x0) + ')' : ''}`]);
      h += `<div class="item"><div class="row">
        <div class="f"><label for="${idb}-k">Item</label><div class="in">${sel(idb + '-k', base + '.kind', itemKinds(), it.kind, true)}</div></div>
        <div class="f"><label for="${idb}-b">Bay</label><div class="in">${sel(idb + '-b', base + '.bay', bayOpts, it.bay)}</div></div>
        <div class="f"><label for="${idb}-s">Side</label><div class="in">${sel(idb + '-s', base + '.side', [['A', 'A'], ['B', 'B'], ['AB', 'A + B']], it.side)}</div></div>
        <button class="btn small" data-delitem="${i}:${j}" aria-label="Remove item" style="align-self:end">×</button></div>`;
      if (['wheelchair', 'bicycle', 'folding', 'cabinet', 'toilet', 'toiletPrm'].includes(it.kind)) {
        const plc = `<div class="f"><label for="${idb}-p">Placement</label><div class="in">${sel(idb + '-p', base + '.place', PLACES, it.place || 'door')}</div></div>`;
        const dflt = it.kind === 'wheelchair' ? (cfg.interior.wcAsStanding ? 'yes' : 'no') : 'yes';
        const stand = `<div class="f"><label for="${idb}-st">${it.kind === 'folding' ? 'Standing area when folded' : 'Use as standing area'}</label><div class="in">${sel(idb + '-st', base + '.stand', [['', `Default (${dflt === 'yes' ? 'Yes' : 'No'})`], ['yes', 'Yes'], ['no', 'No']], it.stand == null ? '' : it.stand)}</div></div>`;
        const prm = it.kind === 'toiletPrm';
        h += it.kind === 'toilet' || prm
          ? `<div class="row2 c3">${plc}${inp(idb + '-l', base + '.length', it.length != null ? it.length : (prm ? 2100 : 1100), 'Length', 'mm')}${inp(idb + '-d', base + '.depth', it.depth != null ? it.depth : (prm ? 1800 : 1200), 'Depth', 'mm')}</div>`
          : it.kind === 'cabinet'
          ? `<div class="row2 c2">${plc}${inp(idb + '-lab', base + '.label', it.label, 'Label', '')}</div><div class="row2 c3">${inp(idb + '-l', base + '.length', it.length, 'Length', 'mm') + inp(idb + '-d', base + '.depth', it.depth, 'Depth', 'mm') + inp(idb + '-h', base + '.height', it.height, 'Height', 'mm')}</div>`
          : it.kind === 'bicycle'
          ? `<div class="row2 c2">${plc}${stand}</div><div class="row2 c2">${inp(idb + '-l', base + '.length', it.length != null ? it.length : 1800, 'Length', 'mm')}${inp(idb + '-d', base + '.depth', it.depth != null ? it.depth : 700, 'Depth', 'mm')}</div>`
          : it.kind === 'folding'
          ? `<div class="row2 c2">${plc}${stand}</div><div class="row2 c2">${inp(idb + '-n', base + '.n', it.n != null ? it.n : 2, 'Folding seats', 'pax')}<p class="hint" style="margin:16px 0 0">${Math.round((TLT.num(it.n, 2)) * TLT.num(cfg.interior.seatWidth, 430))} mm long (seat width × seats)</p></div>`
          : `<div class="row2 c2">${plc}${stand}</div><p class="hint" style="margin:4px 0 0">${TLT.num(cfg.interior.wcLength, 1300)} × ${TLT.num(cfg.interior.wcWidth, 700)} mm, Ø${TLT.num(cfg.interior.wcTurning, 1500)} circle (Interior rules)</p>`;
      }
      if (it.kind === 'max') h += `<div class="row2">${inp(idb + '-n', base + '.n', it.n, 'Max. seats per side', 'pax')}</div>`;
      h += '</div>';
    });
    h += `<div class="additems"><button class="btn small" data-additem="${i}:wheelchair">+ Wheelchair space</button><button class="btn small" data-additem="${i}:bicycle">+ Bicycle space</button><button class="btn small" data-additem="${i}:folding">+ Folding seats</button><button class="btn small" data-additem="${i}:cabinet">+ Electrical cabinet</button><button class="btn small" data-additem="${i}:max">+ Seat limit</button>${TLT.productType(cfg) === 'mainline' ? `<button class="btn small" data-additem="${i}:toilet">+ Toilet</button><button class="btn small" data-additem="${i}:toiletPrm">+ PRM toilet</button>` : ''}</div></div>`;
    return h;
  }
  function interiorGuide() {
    const bayX = [12, 52, 112, 172, 232, 268];
    const doors = [52, 112, 172, 232];
    let svg = `<svg viewBox="0 0 300 120" role="img" aria-label="Bay numbering on a car plan" style="width:100%;height:auto;display:block">
      <rect x="10" y="30" width="270" height="56" rx="4" fill="var(--soft)" stroke="var(--ink)" stroke-width="1"/>`;
    doors.forEach(d => { svg += `<rect x="${d - 7}" y="27" width="14" height="6" fill="var(--panel)" stroke="#8e24aa"/><rect x="${d - 7}" y="83" width="14" height="6" fill="var(--panel)" stroke="#8e24aa"/>`; });
    for (let k = 0; k < bayX.length - 1; k++) {
      const m = (bayX[k] + bayX[k + 1]) / 2;
      svg += `<text x="${m}" y="62" font-size="11" text-anchor="middle" fill="var(--ink)" font-weight="600">B${k}</text>`;
      if (k > 0 && k < 4) svg += `<rect x="${bayX[k] + 12}" y="31" width="${bayX[k + 1] - bayX[k] - 24}" height="9" fill="#d5efe7" stroke="#0f7a63" stroke-width=".6"/><rect x="${bayX[k] + 12}" y="76" width="${bayX[k + 1] - bayX[k] - 24}" height="9" fill="#d5efe7" stroke="#0f7a63" stroke-width=".6"/>`;
    }
    svg += `<rect x="64" y="31" width="22" height="13" fill="#dce9fb" stroke="#1565c0"/><rect x="244" y="74" width="16" height="11" fill="#e2e2e2" stroke="#4a4a4a"/>
      <text x="4" y="22" font-size="10" fill="var(--muted)">END 1</text><text x="296" y="22" font-size="10" fill="var(--muted)" text-anchor="end">END 2</text>
      <text x="150" y="22" font-size="10" fill="var(--muted)" text-anchor="middle">Side A (top of plan)</text><text x="150" y="104" font-size="10" fill="var(--muted)" text-anchor="middle">Side B</text>
      <text x="75" y="116" font-size="9" fill="#1565c0" text-anchor="middle">wheelchair</text><text x="252" y="116" font-size="9" fill="#4a4a4a" text-anchor="middle">cabinet</text></svg>`;
    return `<div class="card guide"><h3>Interior items — how they work</h3>${svg}
      <ul class="hint" style="padding-left:18px;margin:8px 0 0;line-height:1.5">
        <li><b>Bays</b> are the spaces between doors, numbered B0…Bn from END 1. B0 runs from the cab partition or end wall to the first door. Side A is the top of the plan.</li>
        <li><b>Seats</b> fill each bay side automatically: bay length minus the door clearance at each door, divided by the seat width.</li>
        <li><b>Wheelchair space</b> takes its length from the bay (size set in Interior rules); seats fill the rest. The tool places the turning circle clear of seats and warns if it cannot.</li>
        <li><b>Bicycle space</b> (default 1,800 × 700 mm) and <b>folding seats</b> (number of seats × seat width) are placed like a wheelchair space. <b>Use as standing area</b> counts the space as standing area; folding seats marked so count as standing area (and not as seats) in the load cases where <b>Folding seats folded</b> is ticked.</li>
        <li><b>Electrical cabinet</b>: give label, length, depth and height. It is drawn and dimensioned on the layout, removed from the standing area, and seats fill the rest of the bay.</li>
        <li><b>Placement</b>: next to the door (default), END 1 side, middle or END 2 side of the bay.</li>
        <li><b>Seat limit / No seats</b> caps the seats on that bay side.</li>
      </ul></div>`;
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
    const fu = $('formationUsed'); if (fu) fu.textContent = TLT.formationText(cfg);
    const pp = $('profilePreview'); if (pp) pp.innerHTML = profilePreviewHtml();
    const pi = $('profileInfo');
    if (pi && R) { const l = R.layouts.get(R.used[0]); if (l) pi.innerHTML = `Standing width at ${l.profile.refH} mm: <b>${Math.round(l.usableWidth)} mm</b> (wall inset ${Math.round(l.insetRef)} mm each side) · ${esc(l.type.name)} standing area ${l.areas.standing.toFixed(2)} m²`; }
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
      const t = clone(last); t.name = uniqueName(TLT.hasCab(last) ? 'M' : (last.name.replace(/\d+$/, '') || 'M')); t.cab = false;
      const E = TLT.carEnds(last); ['end1', 'end2'].forEach((k, j) => { const e = j ? E.e2 : E.e1; t[k] = e === 'cab' || e === 'aux' ? 'gangway' : e; });
      t.interiorItems = []; t.specSeats = ''; t.specStanding = '';
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
    let h = `<div class="pane-head"><h2>Equipment Inputs</h2><p>Load the equipment list from Excel. It positions the underframe and roof equipment on the layouts. Masses are entered in steps 5 and 6.</p></div>`;
    h += '<div class="cards">';
    h += card('1. Excel format', `<div class="scroll-x"><table class="data"><thead><tr><th>Column</th><th>Meaning</th></tr></thead><tbody>${EQ_COLS.map(c => `<tr><td class="cols">${esc(c.head)}</td><td>${esc(c.hint)}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">One sheet with all cars. Column order does not matter; headers are recognised by name. The template contains the current list, so you can edit it and upload it again.</p>
      <button class="btn" data-tpl="equipment">Download Excel template</button>`);
    h += card('2. Upload equipment list', dropZone('equipment') + `<p class="hint" style="margin-top:10px">Current list: <b>${esc(cfg.equipmentSource || '—')}</b><br>${rows.length} rows · ${esc(perCar)}${bad ? ` · <span class="pill bad">${bad} row${bad > 1 ? 's' : ''} to fix</span>` : ''}</p>`);
    h += '</div>';
    h += `<div class="section-title"><h3>3. Equipment list</h3><span class="hint" style="margin:0">Small corrections can be made here; the Excel file stays your master copy.</span><span class="grow"></span><button class="btn small" id="fillDesc" title="Fills only empty Description cells with the usual full name of the short form (grey suggestion)">Fill empty descriptions</button><button class="btn small" id="addRow">Add row</button></div>`;
    h += `<div class="card"><div class="scroll-x"><table class="data"><thead><tr><th>Status</th>${EQ_COLS.map(c => `<th>${esc(c.head)}</th>`).join('')}<th></th></tr></thead><tbody>`;
    rows.forEach((r, i) => {
      const [cls, txt] = st[i];
      h += `<tr><td><span class="pill ${cls}">${esc(txt)}</span></td>` + EQ_COLS.map(c => {
        const id = `eq-${i}-${c.key}`;
        if (c.key === 'car') return `<td>${carSelect(id, `equipment.${i}.car`, r.car)}</td>`;
        if (c.key === 'loc') return `<td><select id="${id}" data-path="equipment.${i}.loc" data-kind="text"><option value="under"${r.loc !== 'roof' ? ' selected' : ''}>Underframe</option><option value="roof"${r.loc === 'roof' ? ' selected' : ''}>Roof</option></select></td>`;
        if (c.key === 'kind') return `<td><select id="${id}" data-path="equipment.${i}.kind" data-kind="text">${TLT.SYMBOLS.map(([v, l]) => `<option value="${v}"${TLT.normKind(r.kind) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></td>`;
        if (c.key === 'desc') { const sug = TLT.equipDescFor(r.name); return `<td><input id="${id}" class="desc" data-path="equipment.${i}.desc" data-kind="text" value="${esc(r.desc)}"${sug ? ` placeholder="${esc(sug)}" title="Empty: double-click to use “${esc(sug)}”"` : ''}></td>`; }
        const numeric = c.key !== 'name';
        return `<td><input id="${id}" ${numeric ? 'class="num" type="number" step="any"' : ''} data-path="equipment.${i}.${c.key}" data-kind="${numeric ? 'num' : 'text'}" value="${esc(r[c.key])}"></td>`;
      }).join('') + `<td><button class="btn small" data-delrow="${i}" aria-label="Delete row ${i + 1}">×</button></td></tr>`;
    });
    if (!rows.length) h += `<tr><td colspan="${EQ_COLS.length + 2}" class="hint" style="padding:16px">No equipment yet. Download the template, fill it in and upload it.</td></tr>`;
    h += '</tbody></table></div></div>';
    h += `<div class="genbar"><p>Generates the train layouts and capacity (step 3), the underframe layouts (step 4) and the weight calculations with fixed tare (step 5) and from the design weight list (step 6).</p><button class="btn primary big" id="genAll">Generate Results →</button></div>`;
    $('pane-2').innerHTML = h;
  }
  const dropZone = (list, what) => `<div class="drop" data-drop="${list}"><p><b>Drop the ${what || '.xlsx or .csv'} file here</b></p><p class="hint">or</p><button class="btn primary" data-pick="${list}">Choose file…</button><input type="file" id="file-${list}" data-file="${list}" accept=".xlsx,.xls,.csv" hidden></div>`;
  const carSelect = (id, path, val) => `<select id="${id}" data-path="${path}" data-kind="text">${[...new Set(cfg.carTypes.map(t => t.name).concat([String(val)]))].map(n => `<option${n === String(val) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  function refreshRowStatus() {
    let R = null; try { R = TLT.compute(cfg); } catch (e) { /* */ }
    (cfg.equipment || []).forEach((r, i) => {
      const el = $('eq-' + i + '-car'); if (!el) return;
      const pill = el.closest('tr').querySelector('.pill');
      const [cls, txt] = rowStatus(r, R);
      pill.className = 'pill ' + cls; pill.textContent = txt;
    });
  }

  /* ---------- Excel / CSV (equipment list and weight list) ---------- */
  function headerKey(h, spec) {
    const s = String(h || '').trim().toLowerCase();
    if (!s) return null;
    if (spec && spec.cols.some(c => c.key === 'desc') && /descr|full\s*(name|form)/.test(s)) return 'desc';
    if (/^x(\s|$|\(|_)|x\s*from|longitud/.test(s)) return 'x';
    if (/^y(\s|$|\(|_)|y\s*from|lateral|transvers/.test(s)) return 'y';
    if (/^z(\s|$|\(|_)|z\s*(from|above)|above rail|vertical/.test(s)) return 'z';
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
  function rowsFromAoa(aoa, spec) {
    let hi = -1, map = null;
    for (let i = 0; i < Math.min(aoa.length, 15); i++) {
      const m = {};
      (aoa[i] || []).forEach((h, j) => { const k = headerKey(h, spec); if (k && m[k] == null) m[k] = j; });
      if (spec.required.every(k => m[k] != null)) { hi = i; map = m; break; }
    }
    if (hi < 0) throw new Error(`No header row found. It needs at least ${spec.required.map(k => spec.cols.find(c => c.key === k).head).join(', ')} columns.`);
    const out = [];
    const clean = v => (typeof v === 'string' ? v.replace(/[,\s]/g, '') : v);
    aoa.slice(hi + 1).forEach(r => {
      if (!r || r.every(c => c === '' || c == null)) return;
      const o = {};
      spec.cols.concat([{ key: 'cat' }]).forEach(c => { if (map[c.key] != null) o[c.key] = r[map[c.key]]; });
      if (!String(o.car || '').trim() && !String(o.name || '').trim()) return;
      if (spec.key === 'equipment' && /^(m|w)/i.test(String(o.cat || '').trim())) return; // old mass-item rows are not equipment
      ['length', 'width', 'height', 'x', 'y', 'z', 'mass'].forEach(k => { if (!(k in o)) return; const v = parseFloat(clean(o[k])); o[k] = Number.isFinite(v) ? v : ''; });
      o.car = String(o.car == null ? '' : o.car).trim(); o.name = String(o.name == null ? '' : o.name).trim();
      if ('desc' in o) o.desc = String(o.desc == null ? '' : o.desc).trim();
      delete o.cat;
      if (spec.key === 'equipment') {
        o.loc = /^r/i.test(String(o.loc || '')) ? 'roof' : 'under';
        o.kind = TLT.normKind(o.kind);
        delete o.mass;
      } else {
        o.loc = TLT.normWeightLoc(o.loc);
      }
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
  function importFile(file, listName) {
    if (listName === 'main') return importMain(file);
    const spec = LISTS[listName];
    const isCsv = /\.csv$/i.test(file.name);
    if (!isCsv && !window.XLSX) { toast('The Excel reader could not load (no internet connection). Save the sheet as CSV and upload that instead.', true); return; }
    const rd = new FileReader();
    rd.onload = () => {
      try {
        let aoa;
        if (isCsv) aoa = parseCsv(String(rd.result));
        else {
          const wb = window.XLSX.read(new Uint8Array(rd.result), { type: 'array' });
          const name = wb.SheetNames.find(n => spec.sheetRe.test(n)) || wb.SheetNames[0];
          aoa = window.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true });
        }
        const rows = rowsFromAoa(aoa, spec);
        if (!rows.length) throw new Error('The sheet has a header row but no data rows.');
        cfg[spec.key] = rows;
        cfg[spec.srcKey] = `${file.name} (${new Date().toISOString().slice(0, 10)})`;
        if (listName === 'equipment') renderPane2(); else renderWeightEdit();
        markChanged();
        const unknown = [...new Set(rows.map(r => r.car).filter(c => !cfg.carTypes.some(t => t.name === c)))];
        toast(`${rows.length} rows loaded from ${file.name}.` + (unknown.length ? ` Unknown car variants: ${unknown.join(', ')}.` : ''), unknown.length > 0);
      } catch (e) { toast(`Could not read ${file.name}: ${e.message}`, true); }
    };
    if (isCsv) rd.readAsText(file); else rd.readAsArrayBuffer(file);
  }
  /* ---------- Main inputs (step 1) to / from Excel ---------- */
  const YN = ['Yes', 'No'];
  // [section, parameter, key, type, unit]; type: 'num' | 'text' | 'bool' | [allowed values]
  const MAIN_PARAMS = [
    ['Project', 'Company', 'project.company', 'text'], ['Project', 'Client', 'project.client', 'text'], ['Project', 'Project', 'project.project', 'text'],
    ['Project', 'Drawing No.', 'project.drawingNo', 'text'], ['Project', 'Revision', 'project.revision', 'text'], ['Project', 'Drawn by', 'project.drawnBy', 'text'],
    ['Project', 'Checked by', 'project.checkedBy', 'text'], ['Project', 'Date', 'project.date', 'text'], ['Project', 'Status stamp', 'project.status', 'text'],
    ['Project', 'Paper size', 'project.paper', ['A3', 'A2', 'A1']], ['Project', 'Train layout rows', 'project.trainRows', ['1', '2']],
    ['Train', 'Product type', 'productType', ['metro', 'lrv', 'mainline']], ['Train', 'Formation', 'formation', 'text'], ['Train', 'Multiple unit factor', 'muFactor', 'num'],
    ['Design speed & nose (mainline)', 'Design speed', 'aero.speed', 'num', 'km/h'], ['Design speed & nose (mainline)', 'Nose length (0 = from speed)', 'aero.noseLength', 'num', 'mm'],
    ['Car body & bogie', 'Car body section (t1 = Type 1 inclined 2.2°, t2 = Type 2 vertical, t3 = Type 3 R2000 2.9°, t4 = Type 4 R2000 6° cambered roof, t5 = Type 5 inclined 4°)', 'common.profile', 'text', ''],
    ['Car body & bogie', 'Reference height for standing width (above floor)', 'interior.widthRefHeight', 'num', 'mm'],
    ['Car body & bogie', 'Body width', 'common.bodyWidth', 'num', 'mm'], ['Car body & bogie', 'Side wall + lining', 'common.wallThk', 'num', 'mm'],
    ['Car body & bogie', 'Floor height ATR', 'common.floorHeight', 'num', 'mm'], ['Car body & bogie', 'Roof height ATR', 'common.roofHeight', 'num', 'mm'],
    ['Car body & bogie', 'Max. height (AC / panto)', 'common.maxHeight', 'num', 'mm'], ['Car body & bogie', 'Floor to equipment mounting face', 'common.mountDepth', 'num', 'mm'],
    ['Car body & bogie', 'End wall thickness', 'common.endWallThk', 'num', 'mm'], ['Car body & bogie', 'Gangway width', 'common.gangwayWidth', 'num', 'mm'],
    ['Car body & bogie', 'Wheel diameter (new)', 'common.wheelDia', 'num', 'mm'], ['Car body & bogie', 'Bogie wheelbase', 'common.wheelbase', 'num', 'mm'],
    ['Doors', 'Passenger door type', 'doors.type', ['Bi-parting sliding (pocket)', 'Bi-parting sliding plug', 'Bi-parting external sliding', 'Single-leaf sliding']],
    ['Doors', 'Passenger door clear width', 'doors.width', 'num', 'mm'], ['Doors', 'Passenger door clear height', 'doors.height', 'num', 'mm'],
    ['Doors', 'Detrainment door', 'doors.detrain.on', 'bool'], ['Doors', 'Detrainment door width', 'doors.detrain.width', 'num', 'mm'], ['Doors', 'Detrainment door height', 'doors.detrain.height', 'num', 'mm'],
    ['Doors', 'Cab side doors', 'doors.cabSide.on', 'bool'], ['Doors', 'Cab side door width', 'doors.cabSide.width', 'num', 'mm'], ['Doors', 'Cab side door height', 'doors.cabSide.height', 'num', 'mm'],
    ['Doors', 'Cab side door centre from cab-end body face', 'doors.cabSide.pos', 'num', 'mm'],
    ['Doors', 'Cab-to-saloon door', 'doors.cabSaloon.on', 'bool'], ['Doors', 'Cab-to-saloon door type', 'doors.cabSaloon.type', ['Hinged', 'Sliding']],
    ['Doors', 'Cab-to-saloon door width', 'doors.cabSaloon.width', 'num', 'mm'], ['Doors', 'Cab-to-saloon door height', 'doors.cabSaloon.height', 'num', 'mm'],
    ['Doors', 'Cab-to-saloon door offset from centre line (+ side A)', 'doors.cabSaloon.y', 'num', 'mm'],
    ['HVAC', 'Saloon HVAC units per car', 'hvac.unitsPerCar', 'num'], ['HVAC', 'Cab HVAC applicable', 'hvac.cabHvac', 'bool'],
    ['Power collection', 'Supply system', 'power.system', ['25kV', '1500DC', '750DC']], ['Power collection', 'Current collection', 'power.collector', ['panto', 'third', 'both']],
    ['Power collection', 'Max. pantographs per train (0 = no check)', 'power.maxPantos', 'num'], ['Power collection', 'Third rail contact', 'power.contact', ['bottom', 'top', 'side']],
    ['Power collection', 'Conductor rail centre from track centre', 'power.railOffset', 'num', 'mm'], ['Power collection', 'Longest conductor-rail gap (0 = no check)', 'power.maxGap', 'num', 'mm'],
    ['Power collection', 'HV clearance on roof (25 kV, note)', 'power.hvClearance', 'num', 'mm'],
    ['Driver\'s cab', 'Driving desk', 'cab.desk', ['side', 'central']], ['Driver\'s cab', 'Desk on side', 'cab.deskSide', ['B', 'A']],
    ['Driver\'s cab', 'Desk depth', 'cab.deskDepth', 'num', 'mm'], ['Driver\'s cab', 'Desk width', 'cab.deskWidth', 'num', 'mm'],
    ['Driver\'s cab', 'Co-driver seat', 'cab.observer', 'bool'], ['Driver\'s cab', 'Co-driver desk', 'cab.coDesk', 'bool'], ['Driver\'s cab', 'Co-driver desk width', 'cab.coDeskWidth', 'num', 'mm'],
    ['Driver\'s cab', 'GoA4 (remove cab back wall)', 'cab.goa4', 'bool'], ['Driver\'s cab', 'Covered front console depth (GoA4)', 'cab.consoleDepth', 'num', 'mm'],
    ['Driver\'s cab', 'Auxiliary desk length along car', 'cab.auxLength', 'num', 'mm'], ['Driver\'s cab', 'Auxiliary desk depth across car', 'cab.auxDepth', 'num', 'mm'], ['Driver\'s cab', 'Auxiliary desk on side', 'cab.auxSide', ['B', 'A']],
    ['Windows', 'Bays between doors', 'windows.inner', ['single', 'double', 'none']], ['Windows', 'End bays', 'windows.end', ['single', 'double', 'none']],
    ['Windows', 'Single window width (0 = fill bay)', 'windows.singleWidth', 'num', 'mm'], ['Windows', 'Width of each of two windows', 'windows.doubleWidth', 'num', 'mm'],
    ['Windows', 'Window height', 'windows.height', 'num', 'mm'], ['Windows', 'Sill height above floor', 'windows.sill', 'num', 'mm'],
    ['Windows', 'Drop-down windows', 'windows.drop', ['none', 'ends', 'all']], ['Windows', 'Drop-down depth', 'windows.dropDepth', 'num', 'mm'],
    ['Windows', 'Windows in door leaves', 'windows.doorWin', 'bool'], ['Windows', 'Door window width (0 = auto)', 'windows.doorWinWidth', 'num', 'mm'],
    ['Windows', 'Door window height', 'windows.doorWinHeight', 'num', 'mm'], ['Windows', 'Door window sill above floor', 'windows.doorWinSill', 'num', 'mm'],
    ['Windscreen & wipers', 'Windscreen', 'front.wsSplit', ['single', 'two']], ['Windscreen & wipers', 'Gap to side detrainment door', 'front.wsDoorGap', 'num', 'mm'],
    ['Windscreen & wipers', 'Windscreen bottom above floor', 'front.wsBottom', 'num', 'mm'], ['Windscreen & wipers', 'Windscreen top above floor (0 = auto)', 'front.wsTop', 'num', 'mm'],
    ['Windscreen & wipers', 'Windscreen width (0 = auto)', 'front.wsWidth', 'num', 'mm'],
    ['Windscreen & wipers', 'Wipers', 'front.wipers', ['0', '1', '2', '3']], ['Windscreen & wipers', 'Wiper type', 'front.wiperType', ['single', 'pantograph']],
    ['Windscreen & wipers', 'Wiper blade length (0 = auto)', 'front.wiperLength', 'num', 'mm'],
    ['Front view', 'Head / tail lights above floor', 'front.lightsZ', 'num', 'mm'], ['Front view', 'Lights inset from body side', 'front.lightsInset', 'num', 'mm'],
    ['Front view', 'Coupler height ATR', 'front.couplerHeight', 'num', 'mm'], ['Front view', 'Destination display', 'front.destination', 'bool'],
    ['Front view', 'Show vehicle gauge outline', 'front.showGauge', 'bool'], ['Front view', 'Gauge width', 'front.gaugeWidth', 'num', 'mm'], ['Front view', 'Gauge height ATR', 'front.gaugeHeight', 'num', 'mm'],
    ['Interior', 'Seating', 'interior.seatType', ['longitudinal', 'transverse']], ['Interior', 'Seat width / pax', 'interior.seatWidth', 'num', 'mm'],
    ['Interior', 'Seat depth', 'interior.seatDepth', 'num', 'mm'], ['Interior', 'Foot zone in front of seats', 'interior.footZone', 'num', 'mm'],
    ['Interior', 'Clearance at doors', 'interior.doorClearance', 'num', 'mm'], ['Interior', 'Clearance at end wall / cab', 'interior.endClearance', 'num', 'mm'],
    ['Interior', 'Min. door clearance (fixed seats per bay)', 'interior.minDoorClearance', 'num', 'mm'],
    ['Interior', 'Transverse: seats per side', 'interior.transSeatsPerSide', 'num'], ['Interior', 'Transverse seat depth', 'interior.transSeatDepth', 'num', 'mm'], ['Interior', 'Legroom, facing seats', 'interior.transLegroom', 'num', 'mm'],
    ['Interior', 'Wheelchair space length', 'interior.wcLength', 'num', 'mm'], ['Interior', 'Wheelchair space width', 'interior.wcWidth', 'num', 'mm'],
    ['Interior', 'Turning circle diameter', 'interior.wcTurning', 'num', 'mm'], ['Interior', 'Min. aisle (check)', 'interior.minAisle', 'num', 'mm'],
    ['Interior', 'Count wheelchair space as standing area', 'interior.wcAsStanding', 'bool'],
    ['Mainline interior', 'Seat arrangement', 'interior.mlArrangement', ['facing', 'airline']], ['Mainline interior', 'Seat length along car', 'interior.mlSeatLength', 'num', 'mm'],
    ['Mainline interior', 'Standard class abreast', 'interior.mlStdAbreast', ['2+2', '2+1', '3+2', '1+1', '2+0']], ['Mainline interior', 'Standard class seat pitch', 'interior.mlStdPitch', 'num', 'mm'],
    ['Mainline interior', '1st class abreast', 'interior.mlFirstAbreast', ['2+2', '2+1', '3+2', '1+1', '2+0']], ['Mainline interior', '1st class seat pitch', 'interior.mlFirstPitch', 'num', 'mm'],
    ['Mainline interior', '1st class seat width', 'interior.mlFirstSeatWidth', 'num', 'mm'], ['Mainline interior', 'Vestibules at the doors', 'interior.mlVestibules', 'bool'],
    ['Mainline interior', 'Vestibule length', 'interior.mlVestLength', 'num', 'mm'], ['Mainline interior', 'Vestibule internal door width', 'interior.mlVestDoor', 'num', 'mm'],
    ['Load cases', 'Round standing passengers', 'loads.rounding', ['floor', 'round', 'ceil']], ['Load cases', 'Check standees target at load case (blank = no check)', 'loads.standCase', 'text'],
    ['Masses (step 5)', 'Passenger mass', 'loads.paxMass', 'num', 'kg'], ['Masses (step 5)', 'Max. axle load', 'loads.maxAxleLoad', 'num', 't'],
  ];
  const VAR_COLS = [
    ['name', 'Variant name', 'text'], ['desc', 'Description', 'text'],
    ['end1', 'END 1', ['cab', 'aux', 'gangway', 'wall', 'artic']], ['end2', 'END 2', ['cab', 'aux', 'gangway', 'wall', 'artic']],
    ['support1', 'END 1 support', ['own', 'shared', 'none']], ['support2', 'END 2 support', ['own', 'shared', 'none']], ['centreBogie', 'Centre bogie', 'bool'],
    ['couplerLength', 'Length over couplers / joints (mm)', 'num'], ['bodyLength', 'Body length (mm)', 'num'],
    ['cabLength', 'END 1 cab length (mm)', 'num'], ['cabLength2', 'END 2 cab length (mm)', 'num'], ['bogieCentres', 'Bogie centres (mm)', 'num'],
    ['motorBogies', 'Motor bogies', ['0', '1', '1e1', '2', '3']], ['doorsPerSide', 'Doors per side', 'num'], ['doorPitch', 'Door pitch (mm)', 'num'],
    ['doorRearOffset', 'END 2 coupler face to nearest door centre (mm)', 'num'], ['seatsPerBay', 'Seats between two doors (blank = auto)', 'num'],
    ['seatClass', 'Seating class (mainline)', ['std', 'first', 'mixed']], ['firstLength', '1st class length from END 1 (mm)', 'num'],
    ['specSeats', 'Seated passengers target', 'num'], ['specStanding', 'Standees target', 'num'], ['tare', 'Tare mass AW0 (t)', 'num'],
    ['pantos', 'Pantographs per car (target)', 'num'], ['ccd', 'CCD shoes per car', 'num'],
  ];
  const ITEM_COLS = [['car', 'Variant', 'text'], ['kind', 'Item', ['wheelchair', 'bicycle', 'folding', 'cabinet', 'max', 'none', 'toilet', 'toiletPrm']], ['bay', 'Bay (0 = END 1)', 'num'],
    ['side', 'Side', ['A', 'B', 'AB']], ['place', 'Placement', ['door', 'end1', 'middle', 'end2']], ['length', 'Length (mm)', 'num'], ['depth', 'Depth (mm)', 'num'],
    ['height', 'Height (mm)', 'num'], ['label', 'Label', 'text'], ['n', 'Max. seats per side', 'num'], ['stand', 'Standing area (yes / no / blank = default)', ['yes', 'no']]];
  const CASE_COLS = [['name', 'Load case', 'text'], ['kind', 'Type', ['seated', 'density', 'kgm2', 'factor']], ['density', 'Density (pax/m², or kg/m² for kgm2)', 'num'], ['factor', 'Factor', 'num'],
    ['of', 'Of case', 'text'], ['note', 'Note', 'text'], ['inFixed', 'In fixed-tare calculation', 'bool'], ['fold', 'Folding seats folded (yes / no / blank = default)', ['yes', 'no']]];
  const xlVal = (v, type) => (type === 'bool' ? (v === false ? 'No' : v === true || v === 'true' ? 'Yes' : v == null || v === '' ? '' : 'Yes') : v == null ? '' : v);
  const parseVal = (raw, type, label, errs) => {
    const s = String(raw == null ? '' : raw).trim();
    if (type === 'num') { if (s === '') return ''; const n = parseFloat(s.replace(',', '.')); if (!Number.isFinite(n)) { errs.push(`${label}: "${s}" is not a number`); return ''; } return n; }
    if (type === 'bool') return /^(y|yes|true|1|x|on)$/i.test(s);
    if (Array.isArray(type)) { if (s === '') return ''; const m = type.find(o => o.toLowerCase() === s.toLowerCase()); if (!m) { errs.push(`${label}: "${s}" is not one of ${type.join(' / ')}`); return ''; } return m; }
    return s;
  };
  function downloadMainTemplate() {
    if (!window.XLSX) { toast('The Excel library could not load (no internet connection). Use the single-file version, which works offline.', true); return; }
    const X = window.XLSX, wb = X.utils.book_new();
    const params = [['Section', 'Parameter', 'Value', 'Unit', 'Allowed values', 'Key (do not change)']].concat(MAIN_PARAMS.map(([sec, lab, key, type, unit]) =>
      [sec, lab, xlVal(get(cfg, key), type), unit || '', type === 'bool' ? 'Yes / No' : Array.isArray(type) ? type.join(' / ') : type === 'num' ? 'number' : 'text', key]));
    const ws = X.utils.aoa_to_sheet(params); ws['!cols'] = [{ wch: 20 }, { wch: 44 }, { wch: 34 }, { wch: 7 }, { wch: 40 }, { wch: 30 }];
    X.utils.book_append_sheet(wb, ws, 'Parameters');
    const tbl = (cols, rows) => { const w = X.utils.aoa_to_sheet([cols.map(c => c[1])].concat(rows.map(r => cols.map(([k, , t]) => xlVal(r[k], t))))); w['!cols'] = cols.map(c => ({ wch: Math.max(10, Math.min(36, c[1].length + 2)) })); return w; };
    X.utils.book_append_sheet(wb, tbl(VAR_COLS, cfg.carTypes.map(t => Object.assign({}, t, TLT.carEnds(t) && { end1: TLT.carEnds(t).e1, end2: TLT.carEnds(t).e2 }))), 'Car variants');
    X.utils.book_append_sheet(wb, tbl(ITEM_COLS, cfg.carTypes.flatMap(t => (t.interiorItems || []).map(it => Object.assign({ car: t.name }, it)))), 'Interior items');
    X.utils.book_append_sheet(wb, tbl(CASE_COLS, cfg.cases.map(c => Object.assign({}, c, { inFixed: c.inFixed !== false }))), 'Load cases');
    const allowed = c => (c[2] === 'bool' ? 'Yes / No' : Array.isArray(c[2]) ? c[2].join(' / ') : c[2] === 'num' ? 'number' : 'text');
    const ins = [['Sheet', 'Column', 'Allowed values / meaning']]
      .concat([['All', '', 'Importing replaces all step-1 inputs with this workbook. Keep the header rows; the Key column of Parameters must not be changed. Blank number = default.']])
      .concat(VAR_COLS.map(c => ['Car variants', c[1], allowed(c)]),
        [['Car variants', 'END 1 / END 2', 'cab = driving cab, aux = auxiliary driving desk, gangway, wall = end wall without gangway, artic = articulation joint']],
        [['Car variants', 'Supports', 'own = own bogie, shared = Jacobs bogie at the joint, none = no bogie (overhang / carried by the joint)']],
        [['Car variants', 'Motor bogies', '1 = one motor bogie at the END 2 side, 1e1 = one at the END 1 side']],
        ITEM_COLS.map(c => ['Interior items', c[1], allowed(c)]),
        [['Interior items', 'Item', 'wheelchair, cabinet (electrical cabinet), max (seat limit), none (no seats), toilet, toiletPrm (mainline)']],
        CASE_COLS.map(c => ['Load cases', c[1], allowed(c)]));
    const wi = X.utils.aoa_to_sheet(ins); wi['!cols'] = [{ wch: 16 }, { wch: 44 }, { wch: 110 }];
    X.utils.book_append_sheet(wb, wi, 'Instructions');
    offerFile(baseName() + '_main_inputs.xlsx', new Uint8Array(X.write(wb, { type: 'array', bookType: 'xlsx' })), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  function importMain(file) {
    if (!window.XLSX) { toast('The Excel reader could not load (no internet connection). Use the single-file version, which works offline.', true); return; }
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const X = window.XLSX, wb = X.read(new Uint8Array(rd.result), { type: 'array' });
        const sheet = re => { const n = wb.SheetNames.find(x => re.test(x)); return n ? X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true }) : null; };
        const P = sheet(/^param/i), V = sheet(/variant/i), I = sheet(/interior/i), C = sheet(/load/i);
        if (!P || !V) throw new Error('the workbook needs the sheets "Parameters" and "Car variants" (download the template).');
        const errs = [];
        const next = clone(cfg);
        // parameters: by Key column (or by parameter name)
        const hp = P[0].map(h => String(h).toLowerCase());
        const iKey = hp.findIndex(h => /^key/.test(h)), iVal = hp.findIndex(h => /^value/.test(h)), iLab = hp.findIndex(h => /^param/.test(h));
        if (iVal < 0) throw new Error('the Parameters sheet has no "Value" column.');
        let nP = 0;
        P.slice(1).forEach(row => {
          const key = iKey >= 0 ? String(row[iKey] || '').trim() : '';
          const def = MAIN_PARAMS.find(d => d[2] === key) || (iLab >= 0 && MAIN_PARAMS.find(d => d[1].toLowerCase() === String(row[iLab] || '').trim().toLowerCase()));
          if (!def) return;
          set(next, def[2], parseVal(row[iVal], def[3], def[1], errs)); nP++;
        });
        // table sheets: header names → columns
        const readTable = (aoa, cols, what) => {
          if (!aoa || !aoa.length) return [];
          const head = aoa[0].map(h => String(h).trim().toLowerCase());
          const idx = cols.map(c => head.indexOf(c[1].toLowerCase()));
          return aoa.slice(1).filter(r => r.some(v => String(v).trim() !== '')).map((r, ri) => {
            const o = {};
            cols.forEach((c, k) => { if (idx[k] >= 0) o[c[0]] = parseVal(r[idx[k]], c[2], `${what} row ${ri + 2}, ${c[1]}`, errs); });
            return o;
          });
        };
        const vars = readTable(V, VAR_COLS, 'Car variants').filter(v => v.name);
        if (!vars.length) throw new Error('the Car variants sheet has no variants.');
        const items = readTable(I, ITEM_COLS, 'Interior items');
        const cases = readTable(C, CASE_COLS, 'Load cases').filter(c => c.name);
        next.carTypes = vars.map(v => {
          const t = Object.assign({ interiorItems: [] }, v);
          t.cab = t.end1 === 'cab' || t.end2 === 'cab';
          ['end1', 'end2'].forEach(k => { if (!t[k]) t[k] = 'gangway'; });
          ['support1', 'support2'].forEach(k => { if (!t[k]) t[k] = 'own'; });
          t.interiorItems = items.filter(it => String(it.car) === String(v.name)).map(it => { const q = Object.assign({}, it); delete q.car; Object.keys(q).forEach(k => { if (q[k] === '') delete q[k]; }); return q; });
          return t;
        });
        const lost = items.filter(it => !vars.some(v => String(v.name) === String(it.car)));
        if (lost.length) errs.push(`${lost.length} interior item(s) refer to unknown variants and were skipped.`);
        if (cases.length) next.cases = cases.map(c => Object.assign({ kind: c.kind || 'density' }, c));
        else errs.push('No load cases in the file; the current load cases were kept.');
        ui.undoCfg = clone(cfg);
        cfg = normalise(next); ui.sheet = { main: 0, uf: 0, wt: 0, ft: 0 };
        renderAllInputs(); showPane(1); persist(); markChanged();
        toast(`Imported ${nP} parameters, ${next.carTypes.length} car variants, ${next.carTypes.reduce((a, t) => a + t.interiorItems.length, 0)} interior items and ${next.cases.length} load cases from ${file.name}.` + (errs.length ? ` ${errs.length} value(s) not recognised: ${errs.slice(0, 3).join('; ')}${errs.length > 3 ? ' …' : ''}` : ' Undo is available in Train formation.'), errs.length > 0);
      } catch (e) { toast(`Could not read ${file.name}: ${e.message}`, true); }
    };
    rd.readAsArrayBuffer(file);
  }

  function downloadTemplate(listName) {
    const spec = LISTS[listName];
    const head = spec.cols.map(c => c.head);
    const body = (cfg[spec.key] || []).map(r => spec.cols.map(c => (listName === 'equipment' && c.key === 'loc' ? (r.loc === 'roof' ? 'Roof' : 'Underframe') : listName === 'equipment' && c.key === 'kind' ? TLT.symbolLabel(TLT.normKind(r.kind)) : r[c.key] == null ? '' : r[c.key])));
    const notes = listName === 'equipment'
      ? [['Sign convention', 'X + towards END 1 (cab end of a driving car); Y + towards side A (top of the plan view)'], ['Mounting face', `${cfg.common.mountDepth} mm below floor; Height is measured down from it`]]
      : [['Sign convention', 'X + towards END 1; Y + towards side A; Z above top of rail'], ['Locations', TLT.WEIGHT_LOCS.join(', ')],
        ['Bogie rows', 'Location Bogie; X = bogie centre (e.g. +6900 / -6900). For a shared (Jacobs) bogie enter its mass on one car only, with X at that car end (± half the length over couplers).'],
        ['Typical rows', 'Carbody shell, doors, glazing, interior ceiling & lining, floor, seats, cables & cabinets, piping, couplers, cab equipment, each equipment box, bogies … Other items last']];
    if (window.XLSX) {
      const X = window.XLSX;
      const wb = X.utils.book_new();
      const ws = X.utils.aoa_to_sheet([head].concat(body));
      ws['!cols'] = head.map(h => ({ wch: Math.max(10, h.length + 2) }));
      X.utils.book_append_sheet(wb, ws, spec.sheet);
      const wi = X.utils.aoa_to_sheet([['Column', 'Meaning']].concat(spec.cols.map(c => [c.head, c.hint]), [[], ['Car variants', cfg.carTypes.map(t => t.name).join(', ')]], notes));
      wi['!cols'] = [{ wch: 26 }, { wch: 90 }];
      X.utils.book_append_sheet(wb, wi, 'Instructions');
      offerFile(baseName() + spec.suffix + '.xlsx', new Uint8Array(X.write(wb, { type: 'array', bookType: 'xlsx' })), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else {
      const csv = [head].concat(body).map(r => r.map(v => (/[",;\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v)).join(',')).join('\r\n');
      offerFile(baseName() + spec.suffix + '.csv', new TextEncoder().encode(csv), 'text/csv');
      toast('Excel library unavailable offline — downloaded the template as CSV.');
    }
  }

  /* ================= Pane 5: Weight calculations ================= */
  /* ================= Pane 5: weight calculation with fixed tare ================= */
  function renderFixedEdit() {
    let R = null; try { R = TLT.compute(cfg); } catch (e) { /* */ }
    const F = (...a) => field('', ...a);
    const nCars = n => (R ? R.form.cars.filter(c => c.type.name === n).length : 0);
    let h = '<div class="cards">';
    h += card('Settings', `<div class="fields">
      ${F('Passenger mass', 'loads.paxMass', 'num', { unit: 'kg', idp: 'ff-' })}${F('Max. axle load', 'loads.maxAxleLoad', 'num', { unit: 't', idp: 'ff-' })}
    </div><p class="hint">Mass per car and axle load = car mass ÷ axles. The load per bogie and wheel from the equipment distribution is in step 6.</p>`);
    h += card('Load cases to calculate', `<div class="checks">${cfg.cases.map((c, i) => `<label class="f check" style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" id="fc-${i}" data-path="cases.${i}.inFixed" data-kind="check" data-rerender="1"${c.inFixed !== false ? ' checked' : ''}><span><b>${esc(c.name)}</b> <span class="hint" style="margin:0">${esc(TLT.caseBasis(c, cfg))}</span></span></label>`).join('')}</div>
      <p class="hint">Load cases are defined in step 1 (Load cases).</p>`);
    h += '</div>';
    h += `<div class="cards" style="margin-top:14px"><div class="card" style="grid-column:1/-1"><h3>Fixed tare mass per car variant</h3><div class="scroll-x"><table class="data"><thead><tr><th>Variant</th><th>Description</th><th>Cars in train</th><th>Bogies</th><th>Axles (for this car)</th><th>Tare mass AW0 (t)</th></tr></thead><tbody>
      ${cfg.carTypes.map((t, i) => { let l = null; try { l = TLT.layoutCar(t, cfg); } catch (e) { /* */ }
        const bg = !l ? '' : !l.bogieInfo.length ? 'suspended' : l.bogieInfo.map(b => (b.shared ? 'shared' : b.end === 0 ? 'centre' : 'own')).join(' / ');
        return `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.desc || '')}</td><td class="num">${nCars(t.name)}</td><td>${bg}</td><td class="num">${l ? l.axles : ''}</td>
        <td><input class="num" id="ft-${i}-tare" type="number" step="any" data-path="carTypes.${i}.tare" data-kind="num" value="${esc(t.tare)}"></td></tr>`; }).join('')}
      </tbody></table></div></div>
      <div class="card" style="grid-column:1/-1"><h3>Mass and axle load per car</h3><div class="scroll-x" id="ft-cars"></div><div id="ft-warn"></div>
      <p class="hint">Car mass = tare + passengers × passenger mass. Axle load = car mass ÷ axles of the car (the equipment distribution is not known at this stage). A shared Jacobs bogie counts as one axle per car; a suspended module adds half its mass to each neighbour.</p></div></div>`;
    $('fixed-edit').innerHTML = h;
    refreshFixedResults();
  }
  function refreshFixedResults() {
    let R = null; try { R = TLT.compute(cfg); } catch (e) { return; }
    const F = R.fixed; if (!$('ft-cars')) return;
    const d1 = v => (Number.isFinite(v) ? v.toFixed(1) : '—');
    const cs = F.cases;
    if (!cs.length) { $('ft-cars').innerHTML = '<p class="hint">Select at least one load case.</p>'; $('ft-warn').innerHTML = ''; return; }
    const bad = v => (v > F.maxAxle + 1e-9 ? ' class="bad"' : '');
    let h = `<table class="grid"><thead><tr><th rowspan="2">Car</th><th rowspan="2">Type</th><th rowspan="2">Tare (t)</th><th rowspan="2">Axles</th>${cs.map(c => `<th colspan="3" class="grp">${esc(c.name)}</th>`).join('')}</tr>
      <tr>${cs.map(() => '<th class="g0">Pax</th><th>Mass (t)</th><th>Axle (t)</th>').join('')}</tr></thead><tbody>`;
    F.cars.forEach(c => { h += `<tr><td class="c">${c.no}</td><td class="c"><b>${esc(c.label)}</b></td><td>${d1(c.tare)}</td><td class="c">${c.axles || '—'}</td>${c.rows.map(r => `<td class="g0">${fmt(r.pax)}</td><td>${d1(r.mass)}</td><td${bad(r.axle)}>${d1(r.axle)}</td>`).join('')}</tr>`; });
    h += `<tr class="tot"><td></td><td class="c">Train</td><td>${d1(F.tareTrain)}</td><td class="c">${F.cars.reduce((a, c) => a + c.axles, 0)}</td>${F.train.map(q => `<td class="g0">${fmt(q.pax)}</td><td>${d1(q.mass)}</td><td${bad(q.axle)}>${d1(q.axle)}</td>`).join('')}</tr>
      <tr class="tot"><td></td><td class="c" colspan="3">Check: axle ≤ ${F.maxAxle} t</td>${F.train.map(q => `<td colspan="3" class="c g0"><span class="pill ${q.ok ? 'ok' : 'bad'}">${q.ok ? 'OK' : 'Exceeded'}</span></td>`).join('')}</tr></tbody></table>`;
    $('ft-cars').innerHTML = h;
    $('ft-warn').innerHTML = F.warnings.length ? `<div class="warns" style="margin-top:10px"><ul>${F.warnings.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    if (gen.ft) { const st = $('stale-ft'); if (st) st.innerHTML = gen.ft.stamp !== stamp() ? `<div class="stale"><span>Inputs have changed since the fixed-tare sheet was generated.</span><button class="btn primary small" data-regen="all">Generate again</button></div>` : ''; }
  }

  function weightOrder(car) {
    const list = cfg.weightItems || [];
    const idx = list.map((r, i) => i).filter(i => String(list[i].car).trim() === car);
    const other = i => /^other/i.test(list[i].name || '');
    return TLT.WEIGHT_LOCS.flatMap(lc => idx.filter(i => TLT.normWeightLoc(list[i].loc) === lc && !other(i))).concat(idx.filter(other));
  }
  function renderWeightEdit() {
    let R = null; try { R = TLT.compute(cfg); } catch (e) { /* */ }
    const names = R ? R.used : cfg.carTypes.map(t => t.name);
    if (!names.includes(ui.wcar)) ui.wcar = names[0];
    const car = ui.wcar;
    const list = cfg.weightItems || [];
    const F = (...a) => field('', ...a);
    let h = '<div class="cards">';
    h += card('Settings', `<div class="fields">
      ${F('Wheel load spacing (rail contact)', 'loads.wheelSpacing', 'num', { unit: 'mm', idp: 'wf-' })}${F('Wheel load imbalance limit', 'loads.imbalanceLimit', 'num', { unit: '%', idp: 'wf-' })}
    </div><p class="hint">Passenger mass (${esc(cfg.loads.paxMass)} kg) and axle-load limit (${esc(cfg.loads.maxAxleLoad)} t) are set in step 5. Bogie supports are set per car variant in step 1. The target tare from step 5 is compared with the calculated tare.</p>`);
    h += card('Weight list from Excel', `<p class="hint">A separate Excel file: Car Type, Location (Car body, Roof, Interior, UF, Cab, End, Bogie), Item, L, W, H, X, Y, Z, Mass. The template contains the current list.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn" data-tpl="weights">Download weight template</button><button class="btn" id="copyEq" title="Add rows for equipment boxes from step 2 that are not in the weight list yet">Copy equipment from step 2</button></div>
      ${dropZone('weights')}<p class="hint" style="margin-top:8px">Current list: <b>${esc(cfg.weightSource || '—')}</b> · ${list.length} rows</p>`);
    h += '</div>';
    h += `<div class="section-title"><h3>Weight list per car</h3></div><div class="chips" role="group" aria-label="Car variant">${names.map(n => `<button class="chip" data-wcar="${esc(n)}" aria-pressed="${n === car}">${esc(n)}</button>`).join('')}</div>`;
    h += `<div class="card"><div class="scroll-x"><table class="data"><thead><tr><th>Location</th><th>Item</th><th>L (mm)</th><th>W (mm)</th><th>H (mm)</th><th>X (mm)</th><th>Y (mm)</th><th>Z above rail (mm)</th><th>Mass (kg)</th><th></th></tr></thead><tbody>`;
    weightOrder(car).forEach(i => {
      const r = list[i];
      const loc = TLT.normWeightLoc(r.loc);
      const num = (k, ph) => `<td><input class="num" id="w-${i}-${k}" type="number" step="any" data-path="weightItems.${i}.${k}" data-kind="num" value="${esc(r[k])}"${ph ? ` placeholder="${ph}"` : ''}></td>`;
      h += `<tr class="${loc === 'Bogie' ? 'cat-mass' : ''}"><td><select id="w-${i}-loc" data-path="weightItems.${i}.loc" data-kind="text" data-rerender5="1">${TLT.WEIGHT_LOCS.map(l => `<option${l === loc ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
        <td><input id="w-${i}-name" data-path="weightItems.${i}.name" data-kind="text" value="${esc(r.name)}"></td>
        ${num('length')}${num('width')}${num('height')}${num('x')}${num('y')}${num('z', 'auto ' + Math.round(TLT.weightZ(loc, TLT.num(r.height, NaN), cfg)))}${num('mass')}
        <td><button class="btn small" data-delw="${i}" aria-label="Delete ${esc(r.name)}">×</button></td></tr>`;
    });
    h += `<tr class="total"><td></td><td>Car body (sprung)</td><td colspan="6"></td><td class="num-out" id="wt-body"></td><td></td></tr>`;
    h += `<tr class="total"><td></td><td>Bogies (unsprung)</td><td colspan="6"></td><td class="num-out" id="wt-bog"></td><td></td></tr>`;
    h += `<tr class="total"><td></td><td>Calculated tare · CoG X / Y / Z</td><td colspan="3"></td><td class="num-out" id="wt-cx"></td><td class="num-out" id="wt-cy"></td><td class="num-out" id="wt-cz"></td><td class="num-out" id="wt-tare"></td><td></td></tr>`;
    h += `<tr><td></td><td>Target tare (step 5) · difference</td><td colspan="6" class="num-out" id="wt-diff"></td><td class="num-out" id="wt-target"></td><td></td></tr>`;
    h += `</tbody></table></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px"><button class="btn primary small" id="addMass">Add line item</button><span class="hint" style="margin:0">New items go above "Other items". Blank Z uses the default height for the location.</span></div></div>`;
    h += `<div class="cards" style="margin-top:14px"><div class="card" style="grid-column:1/-1"><h3>Support, axle and wheel loads — ${esc(car)}</h3><div class="scroll-x" id="wt-cases"></div></div>
      <div class="card" style="grid-column:1/-1"><h3>Train — axle load per bogie (t) / wheel load imbalance</h3><div class="scroll-x" id="wt-train"></div><div id="wt-warn"></div></div></div>`;
    $('weight-edit').innerHTML = h;
    refreshWeightResults();
  }
  function refreshWeightResults() {
    let R = null; try { R = TLT.compute(cfg); } catch (e) { return; }
    const W = R.weights;
    const w = W.perType.get(ui.wcar); if (!w || !$('wt-tare')) return;
    const t = kg => (kg / 1000).toFixed(2) + ' t';
    const sg = v => (v > 0 ? '+' : '') + Math.round(v);
    $('wt-body').textContent = t(w.bodyMass);
    $('wt-bog').textContent = `${t(w.bogieMass)}  (${w.supLabels.map((l, k) => `${l} ${t(w.bogAt[k])}`).join(' · ') || 'no bogie'})`;
    $('wt-tare').textContent = t(w.tareKg);
    $('wt-cx').textContent = sg(w.cg.x); $('wt-cy').textContent = sg(w.cg.y); $('wt-cz').textContent = sg(w.cg.z);
    $('wt-target').textContent = Number.isFinite(w.target) ? t(w.target) : '—';
    $('wt-diff').innerHTML = Number.isFinite(w.diff) ? `<span class="pill ${Math.abs(w.diff) > 0.03 * w.target ? 'bad' : 'ok'}">${w.diff > 0 ? '+' : ''}${(w.diff / 1000).toFixed(2)} t (${((w.diff / w.target) * 100).toFixed(1)} %)</span>` : '—';
    const lim = W.limit, maxA = W.maxAxle * 1000;
    const heads = w.suspended ? ['END 1 joint', 'END 2 joint'] : w.supLabels;
    const own = !w.lay.shared[0] && !w.lay.shared[1] && !w.lay.hinge[0] && !w.lay.hinge[1];
    $('wt-cases').innerHTML = `<table class="data"><thead><tr><th>Case</th><th>Pax</th><th>Gross</th><th>CoG X / Y / Z</th>${heads.map(l => `<th>${esc(l)}</th>`).join('')}<th>Max axle</th><th>Wheel imbalance</th><th></th></tr></thead><tbody>${w.cases.map(q => {
      const ax = q.sup.reduce((m, sp) => Math.max(m, sp.axle), 0), im = q.sup.reduce((m, sp) => Math.max(m, sp.imb), 0);
      const ok = ax <= maxA + 1e-6 && im <= lim + 1e-9;
      const vals = w.suspended ? q.hinge.map(h => h.F) : q.sup.map(sp => sp.F);
      return `<tr><td>${esc(q.name)}</td><td class="num">${q.pax}</td><td class="num">${t(q.mass)}</td><td class="num">${sg(q.xg)} / ${sg(q.yg)} / ${sg(q.zg)}</td>${vals.map(F => `<td class="num">${t(F)}</td>`).join('')}<td class="num"><b>${w.suspended ? '—' : t(ax)}</b></td><td class="num">${w.suspended ? '—' : im.toFixed(1) + ' %'}</td><td>${own ? `<span class="pill ${ok ? 'ok' : 'bad'}">${ok ? 'OK' : 'Check'}</span>` : '<span class="pill info">see train</span>'}</td></tr>`;
    }).join('')}</tbody></table>`;
    const cs = cfg.cases || [];
    $('wt-train').innerHTML = `<table class="data"><thead><tr><th>Bogie</th><th>Location</th>${cs.map(c => `<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${W.bogies.map(bg => `<tr><td>${bg.no}</td><td>${esc(bg.label)}</td>${bg.cases.map(q => `<td class="num"${q.ok && q.imbOk ? '' : ' style="color:var(--warn);font-weight:600"'}>${(q.axle / 1000).toFixed(2)} / ${q.imb.toFixed(1)}%</td>`).join('')}</tr>`).join('')}
      <tr class="total"><td></td><td>Train mass</td>${W.train.map(q => `<td class="num">${t(q.mass)}</td>`).join('')}</tr>
      <tr class="total"><td></td><td>Check (axle ≤ ${W.maxAxle} t, imbalance ≤ ${lim} %)</td>${W.train.map(q => `<td><span class="pill ${q.ok && q.imbOk ? 'ok' : 'bad'}">${q.ok && q.imbOk ? 'OK' : 'Exceeded'}</span></td>`).join('')}</tr></tbody></table>`;
    $('wt-warn').innerHTML = W.warnings.length ? `<div class="warns" style="margin-top:10px"><ul>${W.warnings.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    if (gen.wt) { const st = $('stale-wt'); if (st) st.innerHTML = gen.wt.stamp !== stamp() ? `<div class="stale"><span>Inputs have changed since the weight sheets were generated.</span><button class="btn primary small" data-regen="all">Generate again</button></div>` : ''; }
  }
  /* Add typical power-collection equipment (layout rows + weight rows with typical masses) */
  function addPowerEquipment() {
    const P = TLT.powerCfg(cfg);
    const eq = cfg.equipment = cfg.equipment || [], wt = cfg.weightItems = cfg.weightItems || [];
    const names = s => String(s || '').split(/[\s,;]+/).filter(Boolean);
    let pCars = cfg.carTypes.filter(t => (TLT.pantoTarget(t) || 0) > 0).map(t => t.name);
    if (!pCars.length && P.panto) { toast('Set the pantographs per car in the Power collection table first.', true); return; }
    let nE = 0, nW = 0;
    // an item counts as present when the car already has a row of that type (PAN1 / PAN2 are pantographs, LA is an arrester …)
    const SAME = { PAN: /^(PAN|PANTO)/i, ARR: /^(ARR|LA\b|SA\b)|arrest/i, VCB: /VCB|MCB|circuit/i, ES: /^ES\b|earth/i, 'MAIN TRANSFORMER': /transf|^MTR?\b|^TFR?\b/i, HSCB: /HSCB/i, 'SHOE FUSE': /shoe/i };
    const has = (car, name) => eq.some(r => String(r.car).trim() === car && (name === 'PAN' && TLT.normEquipRow(r).kind === 'panto' || (SAME[name] || new RegExp('^' + name + '$', 'i')).test(String(r.name).trim())));
    const addW = (car, loc, name, L, Wd, H, x, y, mass) => {
      const oi = wt.findIndex(r => String(r.car).trim() === car && /^other/i.test(r.name || ''));
      const row = { car, loc, name, length: L, width: Wd, height: H, x, y, z: '', mass };
      if (oi >= 0) wt.splice(oi, 0, row); else wt.push(row); nW++;
    };
    const add = (car, name, loc, L, Wd, H, x, y, mass, kind) => {
      if (has(car, name)) return;
      eq.push({ car, name, desc: TLT.equipDescFor(name), loc, length: L, width: Wd, height: H, x, y, kind: kind || '' }); nE++;
      addW(car, loc === 'roof' ? 'Roof' : 'UF', name, L, Wd, H, x, y, mass);
    };
    if (P.panto) pCars.forEach(car => {
      const t = cfg.carTypes.find(q => q.name === car); const half = TLT.num(t.couplerLength, 20000) / 2;
      const xp = Math.round(half - 2600);
      // pantographs up to the target count (PAN1 towards END 1, PAN2 towards END 2, PAN3 at the centre)
      const want = TLT.pantoTarget(t) || 0;
      const haveP = eq.filter(r => String(r.car).trim() === car && TLT.normEquipRow(r).kind === 'panto').length;
      const pos = [xp, -xp, 0, Math.round(xp / 2)];
      for (let k = haveP; k < want; k++) {
        let nm = 'PAN' + (k + 1); while (eq.some(r => String(r.car).trim() === car && String(r.name).trim() === nm)) nm += "'";
        eq.push({ car, name: nm, desc: 'Pantograph', loc: 'roof', length: 1700, width: 1800, height: 450, x: pos[k % 4], y: 0, kind: 'panto' }); nE++;
        addW(car, 'Roof', nm, 1700, 1800, 450, pos[k % 4], 0, P.system === '25kV' ? 260 : 200);
      }
      add(car, 'ARR', 'roof', 400, 400, 450, xp - 1500, -700, 25, 'box');
      if (P.system === '25kV') {
        add(car, 'VCB', 'roof', 1000, 800, 400, xp - 1700, 0, 180, 'box');
        add(car, 'ES', 'roof', 600, 500, 300, xp - 1700, 800, 40, 'box');
        add(car, 'MAIN TRANSFORMER', 'under', 4200, 2200, 750, 0, 0, 7200, 'box');
      } else add(car, 'HSCB', 'under', 900, 700, 450, xp - 2500, -900, 150, 'box');
    });
    if (P.third) {
      cfg.carTypes.forEach(t => {
        const car = t.name;
        let lay = null; try { lay = TLT.layoutCar(t, cfg); } catch (e) { return; }
        const xs = TLT.shoeLayout(lay, cfg);
        if (!xs.length) return;
        if (!P.panto) add(car, 'HSCB', 'under', 900, 700, 450, Math.round(lay.mid - lay.Lc * 0.35), -900, 150, 'box');
        add(car, 'SHOE FUSE', 'under', 700, 500, 400, 0, 900, 40, 'box');
        if (!wt.some(r => String(r.car).trim() === car && /shoe gear/i.test(r.name || ''))) xs.forEach((x, k) => addW(car, 'Bogie', `CCD shoe gear ${k + 1} (both sides)`, 600, 3000, 300, Math.round(lay.mid - x), 0, 120));
      });
    }
    renderPane1(); markChanged();
    toast(nE + nW ? `Added ${nE} equipment rows and ${nW} weight rows (typical masses — replace with supplier data).` : 'Nothing added: the rows already exist.');
  }

  function copyEquipmentToWeights() {
    const W = cfg.weightItems = cfg.weightItems || [];
    let added = 0;
    (cfg.equipment || []).forEach(r => {
      const loc = r.loc === 'roof' ? 'Roof' : 'UF';
      if (W.some(w => String(w.car).trim() === String(r.car).trim() && String(w.name).trim() === String(r.name).trim())) return;
      const oi = W.findIndex(w => String(w.car).trim() === String(r.car).trim() && /^other/i.test(w.name || ''));
      const row = { car: r.car, loc, name: r.name, length: r.length, width: r.width, height: r.height, x: r.x, y: r.y, z: '', mass: '' };
      if (oi >= 0) W.splice(oi, 0, row); else W.push(row);
      added++;
    });
    renderWeightEdit(); markChanged();
    toast(added ? `Added ${added} equipment rows. Enter their masses.` : 'All equipment from step 2 is already in the weight list.');
  }

  /* ================= Results panes (3, 4, 5) ================= */
  function generate(which) {
    try {
      const R = TLT.compute(cfg);
      const sheets = which === 'main' ? TLT.buildSheets(R) : which === 'uf' ? TLT.buildUnderframeSheets(R) : which === 'ft' ? TLT.buildFixedSheets(R) : TLT.buildWeightSheets(R);
      gen[which] = { R, sheets, stamp: stamp() };
      if (ui.sheet[which] >= sheets.length) ui.sheet[which] = 0;
    } catch (e) {
      console.error(e);
      toast('Could not build the drawings: ' + e.message, true);
      return false;
    }
    return true;
  }
  function generateAll() { return ['main', 'uf', 'ft', 'wt'].every(generate); }
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
    if (which !== 'wt') h += `<div class="summary">${which === 'main' ? summaryMain(g.R) : which === 'ft' ? summaryFixed(g.R) : summaryUf(g.R)}</div>`;
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
    if (R.warnings.length) h += `<div class="warns"><b>${R.warnings.length} check${R.warnings.length > 1 ? 's' : ''} to review</b><ul>${R.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
    return h;
  }
  function summaryFixed(R) {
    const F = R.fixed;
    let h = kp('Train tare', F.tareTrain.toFixed(1) + ' t');
    F.train.forEach(t => { h += kp(`${t.name} mass / axle`, `${t.mass.toFixed(1)} t · ${t.axle.toFixed(1)} t`, t.ok ? 'ok' : 'bad'); });
    if (F.warnings.length) h += `<div class="warns"><b>${F.warnings.length} check${F.warnings.length > 1 ? 's' : ''} to review</b><ul>${F.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
    return h;
  }
  function summaryUf(R) {
    let h = '';
    R.used.forEach(n => {
      const l = R.layouts.get(n);
      const u = l.equipment.items.filter(e => e.loc === 'under'), rf = l.equipment.items.filter(e => e.loc === 'roof');
      h += kp(`${n}`, `${u.length} underframe · ${rf.length} roof`, u.length ? '' : 'bad');
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
  const suffixOf = w => (w === 'uf' ? '_underframe' : w === 'wt' ? '_weight_design' : w === 'ft' ? '_weight_fixed' : '');
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
    ['project', 'common', 'interior', 'loads', 'hvac', 'cab', 'windows', 'front', 'power'].forEach(k => { o[k] = Object.assign({}, base[k], o[k] || {}); });
    if (!o.productType) o.productType = 'metro';
    if (o.muFactor == null || o.muFactor === '') o.muFactor = 1;
    o.aero = Object.assign({ speed: 160, noseLength: 0 }, o.aero || {});
    if (o.productType === 'tram') o.productType = 'lrv';
    // earlier versions of "Add equipment" added a second set of pantographs (PAN) to cars that already had PAN1 / PAN2
    if (Array.isArray(o.equipment)) {
      const dupCars = new Set(o.equipment.filter(r => String(r.name).trim() === 'PAN' && o.equipment.some(q => q !== r && q.car === r.car && /^PAN.+/i.test(String(q.name).trim()))).map(r => r.car));
      if (dupCars.size) {
        o.equipment = o.equipment.filter(r => !(dupCars.has(r.car) && String(r.name).trim() === 'PAN'));
        if (Array.isArray(o.weightItems)) o.weightItems = o.weightItems.filter(r => !(dupCars.has(r.car) && String(r.name).trim() === 'PAN'));
      }
    }
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
    // equipment list is for layout only; older files kept masses there — move them to the weight list
    if (!Array.isArray(o.weightItems)) {
      o.weightItems = [];
      o.equipment.forEach(r => {
        const m = parseFloat(r.mass);
        const isMass = /^m/i.test(r.cat || '');
        if (!isMass && !Number.isFinite(m)) return;
        const loc = isMass ? (/bogie/i.test(r.name) ? 'Bogie' : /seat|floor|ceiling|lining|interior/i.test(r.name) ? 'Interior' : /cab/i.test(r.name) ? 'Cab' : /coupler/i.test(r.name) ? 'End' : 'Car body') : (r.loc === 'roof' ? 'Roof' : 'UF');
        o.weightItems.push({ car: r.car, loc, name: r.name, length: isMass ? '' : r.length, width: isMass ? '' : r.width, height: isMass ? '' : r.height, x: r.x, y: r.y || 0, z: '', mass: Number.isFinite(m) ? m : '' });
      });
      o.weightSource = o.weightItems.length ? 'Converted from the earlier equipment list' : '—';
    }
    o.equipment = o.equipment.filter(r => !/^m/i.test(r.cat || '')).map(r => { const q = Object.assign({}, r); delete q.cat; delete q.mass; return q; });
    o.carTypes.forEach(t => {
      delete t.equipment; if (!t.support1) t.support1 = 'own'; if (!t.support2) t.support2 = 'own';
      const E = TLT.carEnds(t); t.end1 = E.e1; t.end2 = E.e2; t.cab = E.cab1 || E.cab2; if (t.centreBogie == null) t.centreBogie = false;
      if (!Array.isArray(t.interiorItems)) {
        t.interiorItems = TLT.parseBays(t.bays).rules.map(q => q.kind === 'wheelchair' ? { kind: 'wheelchair', bay: q.bay, side: q.side, place: 'door' }
          : q.kind === 'cabinet' ? { kind: 'cabinet', bay: q.bay, side: q.side, place: 'door', label: q.label, length: q.length, depth: Number.isFinite(q.depth) ? q.depth : 600, height: '' }
            : { kind: q.n === 0 ? 'none' : 'max', bay: q.bay, side: q.side, n: q.n });
      }
      delete t.bays;
    });
    delete o.detail;
    return o;
  }

  /* ---------- navigation ---------- */
  function showPane(n) {
    ui.pane = n;
    [1, 2, 3, 4, 5, 6].forEach(i => { $('pane-' + i).hidden = i !== n; $('step-' + i).setAttribute('aria-selected', String(i === n)); });
    if (n === 2) renderPane2();
    if (n === 3) renderResults('main');
    if (n === 4) renderResults('uf');
    if (n === 5) { renderFixedEdit(); renderResults('ft'); }
    if (n === 6) { renderWeightEdit(); renderResults('wt'); }
    persist();
    window.scrollTo({ top: 0 });
  }
  function renderAllInputs() { renderPane1(); renderPane2(); }
  function markChanged() {
    persist();
    clearTimeout(timer);
    timer = setTimeout(() => { if (ui.pane === 1) { refreshPane1Info(); const pt = $('powerTable'); if (pt && !pt.contains(document.activeElement)) pt.innerHTML = powerTableHtml(); } if (ui.pane === 2) refreshRowStatus(); if (ui.pane === 5) refreshFixedResults(); if (ui.pane === 6) refreshWeightResults(); }, 250);
  }

  /* ---------- events ---------- */
  function onInput(e) {
    const el = e.target;
    if (el.dataset && el.dataset.file) return;
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
    const endMatch = /^carTypes\.(\d+)\.end[12]$/.exec(path);
    if (endMatch) { const t = cfg.carTypes[+endMatch[1]]; t.cab = TLT.hasCab(t); }
    if (nameMatch && oldName !== v) [cfg.equipment || [], cfg.weightItems || []].forEach(L => L.forEach(r => { if (String(r.car).trim() === oldName) r.car = v; }));
    if (e.type === 'change' && (el.dataset.rerender || nameMatch)) { if (ui.pane === 1) renderPane1(); else if (ui.pane === 5) renderFixedEdit(); }
    if (e.type === 'change' && el.dataset.rerender5) renderWeightEdit();
    if (e.type === 'change' && /^carTypes\.\d+\.(pantos|ccd)$/.test(path) && $('powerTable')) $('powerTable').innerHTML = powerTableHtml();
    markChanged();
  }

  function bind() {
    document.addEventListener('dblclick', e => {
      const el = e.target.closest('input.desc');
      if (el && !el.value && el.placeholder) { el.value = el.placeholder; el.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    document.addEventListener('input', e => { if (e.target.closest('#pane-1, #pane-2, #weight-edit, #fixed-edit')) onInput(e); });
    document.addEventListener('change', e => { if (e.target.closest('#pane-1, #pane-2, #weight-edit, #fixed-edit')) onInput(e); });
    document.addEventListener('click', e => {
      const pb = e.target.closest('[data-profile]');
      if (pb) { cfg.common.profile = pb.dataset.profile; const sel = $('f-common_profile'); if (sel) sel.value = pb.dataset.profile; markChanged(); const pp = $('profilePreview'); if (pp) pp.innerHTML = profilePreviewHtml(); return; }
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pane) return showPane(+b.dataset.pane);
      if (b.dataset.goto) return showPane(+b.dataset.goto);
      if (b.id === 'genAll') { if (generateAll()) { showPane(3); toast(`Generated ${gen.main.sheets.length} layout, ${gen.uf.sheets.length} underframe, ${gen.ft.sheets.length} fixed-tare and ${gen.wt.sheets.length} design weight sheets.`); } return; }
      if (b.dataset.regen) { if (generateAll()) showPane(ui.pane); return; }
      if (b.dataset.wcar) { ui.wcar = b.dataset.wcar; renderWeightEdit(); return; }
      if (b.id === 'addMass') {
        const car = ui.wcar; const list = cfg.weightItems = cfg.weightItems || [];
        const oi = list.findIndex(r => String(r.car).trim() === car && /^other/i.test(r.name || ''));
        const row = { car, loc: 'Car body', name: 'New item', length: '', width: '', height: '', x: 0, y: 0, z: '', mass: 0 };
        if (oi >= 0) list.splice(oi, 0, row); else list.push(row);
        renderWeightEdit(); markChanged();
        const el = $('w-' + (oi >= 0 ? oi : list.length - 1) + '-name'); if (el) { el.focus(); el.select(); }
        return;
      }
      if (b.dataset.delw != null) { cfg.weightItems.splice(+b.dataset.delw, 1); renderWeightEdit(); markChanged(); return; }
      if (b.id === 'copyEq') return copyEquipmentToWeights();
      if (b.dataset.tpl) return downloadTemplate(b.dataset.tpl);
      if (b.dataset.pick) return $('file-' + b.dataset.pick).click();
      if (b.dataset.sheet) { const [w, i] = b.dataset.sheet.split(':'); ui.sheet[w] = +i; renderResults(w); return; }
      if (b.dataset.zoom) {
        const [w, op] = b.dataset.zoom.split(':');
        ui.zoom[w] = op === 'in' ? Math.min(6, ui.zoom[w] * 1.25) : op === 'out' ? Math.max(0.5, ui.zoom[w] / 1.25) : 1;
        applyZoom(w); return;
      }
      if (b.dataset.pdf) return downloadPdf(b.dataset.pdf);
      if (b.dataset.dxf) return downloadDxf(b.dataset.dxf);
      if (b.dataset.template) {
        if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Replace all inputs?'; setTimeout(() => { if (b.isConnected) { b.dataset.confirm = ''; renderPane1(); } }, 3000); return; }
        const id = TLT.PRODUCT_TEMPLATES[b.dataset.template] || 'metro-6car';
        ui.undoCfg = clone(cfg);
        cfg = normalise(TLT.PRESETS[id]()); ui.sheet = { main: 0, uf: 0, wt: 0, ft: 0 };
        if ($('preset')) $('preset').value = id;
        renderAllInputs(); generateAll(); showPane(1); persist(); toast('Template loaded. Undo is available in Train formation.');
        return;
      }
      if (b.dataset.undotpl) { if (ui.undoCfg) { cfg = normalise(ui.undoCfg); ui.undoCfg = null; renderAllInputs(); generateAll(); showPane(1); persist(); toast('Previous inputs restored.'); } return; }
      if (b.id === 'powerTpl') return addPowerEquipment();
      if (b.id === 'mainTpl') return downloadMainTemplate();
      if (b.id === 'addCase') { cfg.cases.push({ name: 'Case ' + (cfg.cases.length + 1), kind: 'density', density: 5, note: '' }); renderPane1(); markChanged(); return; }
      if (b.dataset.delcase != null) { cfg.cases.splice(+b.dataset.delcase, 1); renderPane1(); markChanged(); return; }
      if (b.dataset.additem) {
        const [i, kind] = b.dataset.additem.split(':');
        const t = cfg.carTypes[+i]; t.interiorItems = t.interiorItems || [];
        t.interiorItems.push(kind === 'wheelchair' ? { kind, bay: 1, side: 'A', place: 'door' }
          : kind === 'bicycle' ? { kind, bay: 1, side: 'B', place: 'door', length: 1800, depth: 700, stand: '' }
          : kind === 'folding' ? { kind, bay: 1, side: 'A', place: 'door', n: 2, stand: '' }
          : kind === 'toilet' ? { kind, bay: 1, side: 'A', place: 'end1', length: 1100, depth: 1200 }
          : kind === 'toiletPrm' ? { kind, bay: 1, side: 'A', place: 'end1', length: 2100, depth: 1800 }
          : kind === 'cabinet' ? { kind, bay: 0, side: 'A', place: 'end1', label: 'ELEC. CABINET', length: 900, depth: 600, height: 1900 }
            : { kind, bay: 1, side: 'A', n: 3 });
        renderPane1(); markChanged(); return;
      }
      if (b.dataset.delitem) { const [i, j] = b.dataset.delitem.split(':').map(Number); cfg.carTypes[i].interiorItems.splice(j, 1); renderPane1(); markChanged(); return; }
      if (b.dataset.duptype != null) {
        const i = +b.dataset.duptype; const t = clone(cfg.carTypes[i]); t.name = uniqueName(t.name.replace(/\d+$/, '') || 'V');
        cfg.carTypes.splice(i + 1, 0, t);
        (cfg.equipment || []).filter(r => r.car === cfg.carTypes[i].name).forEach(r => cfg.equipment.push(Object.assign({}, r, { car: t.name })));
        (cfg.weightItems || []).filter(r => r.car === cfg.carTypes[i].name).forEach(r => cfg.weightItems.push(Object.assign({}, r, { car: t.name })));
        renderPane1(); markChanged(); return;
      }
      if (b.dataset.deltype != null) {
        if (cfg.carTypes.length <= 1) { toast('At least one car variant is needed.', true); return; }
        if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirm delete'; setTimeout(() => { if (b.isConnected) { b.dataset.confirm = ''; b.textContent = 'Delete'; } }, 3000); return; }
        cfg.carTypes.splice(+b.dataset.deltype, 1); renderPane1(); markChanged(); return;
      }
      if (b.id === 'fillDesc') { let n = 0; (cfg.equipment || []).forEach(r => { if (!String(r.desc || '').trim()) { const d = TLT.equipDescFor(r.name); if (d) { r.desc = d; n++; } } }); renderPane2(); markChanged(); toast(n ? `${n} description(s) filled — check them, the suggestions are generic.` : 'No empty description with a known short form.'); return; }
      if (b.id === 'addRow') { (cfg.equipment = cfg.equipment || []).push({ cat: 'Equipment', car: cfg.carTypes[0].name, name: 'NEW', loc: 'under', length: 1000, width: 800, height: 500, x: 0, y: 0, mass: '', kind: '' }); renderPane2(); markChanged(); return; }
      if (b.dataset.delrow != null) { cfg.equipment.splice(+b.dataset.delrow, 1); renderPane2(); markChanged(); return; }
    });
    document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.file) { const f = e.target.files[0]; if (f) importFile(f, e.target.dataset.file); e.target.value = ''; } });
    document.addEventListener('dragover', e => { const d = e.target.closest && e.target.closest('[data-drop]'); if (d) { e.preventDefault(); d.classList.add('over'); } });
    document.addEventListener('dragleave', e => { const d = e.target.closest && e.target.closest('[data-drop]'); if (d) d.classList.remove('over'); });
    document.addEventListener('drop', e => { const d = e.target.closest && e.target.closest('[data-drop]'); if (!d) return; e.preventDefault(); d.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) importFile(f, d.dataset.drop); });

    $('btnSave').addEventListener('click', () => offerFile(baseName() + '_inputs.json', new TextEncoder().encode(JSON.stringify(cfg, null, 2)), 'application/json'));
    $('btnLoad').addEventListener('click', () => $('fileLoad').click());
    $('fileLoad').addEventListener('change', e => { const f = e.target.files[0]; if (f) loadInputs(f); e.target.value = ''; });
    $('btnReset').addEventListener('click', () => {
      const b = $('btnReset');
      if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Discard all edits?'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = 'Load preset'; }, 3000); return; }
      b.dataset.confirm = ''; b.textContent = 'Load preset';
      cfg = normalise(TLT.PRESETS[$('preset').value]()); ui.sheet = { main: 0, uf: 0, wt: 0, ft: 0 };
      renderAllInputs(); generateAll(); showPane(1); toast('Preset loaded.');
    });
    window.addEventListener('resize', () => { applyZoom('main'); applyZoom('uf'); applyZoom('ft'); applyZoom('wt'); });
  }

  /* ---------- start ---------- */
  function start() {
    if ($('appVersion')) $('appVersion').textContent = 'v' + TLT.VERSION;
    $('preset').innerHTML = TLT.PRESET_LIST.map(p => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
    const saved = restore();
    cfg = normalise(saved && Array.isArray(saved.carTypes) ? saved : TLT.PRESETS['dhaka-l5n']());
    if (cfg.meta && cfg.meta.preset) $('preset').value = cfg.meta.preset;
    renderAllInputs();
    bind();
    generateAll();
    const u = restoreUi();
    showPane([1, 2, 3, 4, 5, 6].includes(u.pane) ? u.pane : 1);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
