/* Train Layout Tool — presets (input sets). Add your own project here or save/load JSON from the UI. */
(function () {
  'use strict';
  const TLT = (globalThis.TLT = globalThis.TLT || {});

  const today = () => new Date().toISOString().slice(0, 10);
  // Equipment row for layout positioning: [car, name, location, L, W, H, x, y, (mass kg for the weight example)]
  const rowObj = r => ({ car: r[0], name: r[1], loc: /^r/i.test(r[2]) ? 'roof' : 'under', length: r[3], width: r[4], height: r[5], x: r[6], y: r[7], kind: '' });
  // Example weight list for one car: structure, interior, bogies and the drawn equipment with masses.
  const W = (car, loc, name, L, Wd, H, x, y, z, mass) => ({ car, loc, name, length: L, width: Wd, height: H, x, y, z, mass });
  const weightRows = (car, Lc, bc, equipRows, bogieMass, extras) => [
    W(car, 'Car body', 'Carbody shell', Lc - 500, 2950, 2700, 0, 0, '', 8400),
    W(car, 'Car body', 'Passenger doors & operators', '', '', '', 0, 0, 2050, 1600),
    W(car, 'Car body', 'Glazing', '', '', '', 0, 0, 2400, 700),
    W(car, 'Interior', 'Interior ceiling & lining', '', '', '', 0, 0, 3200, 1350),
    W(car, 'Interior', 'Floor', '', '', '', 0, 0, 1100, 1100),
    W(car, 'Interior', 'Seats', '', '', '', 0, 0, 1400, 560),
    W(car, 'UF', 'Electrical cables & cabinets', '', '', '', 0, 0, 1000, 1900),
    W(car, 'UF', 'Pneumatic piping', '', '', '', 0, 0, 800, 600),
    W(car, 'End', 'Coupler & draft gear END 1', 800, 400, 300, Lc / 2 - 400, 0, 720, 400),
    W(car, 'End', 'Coupler & draft gear END 2', 800, 400, 300, -(Lc / 2 - 400), 0, 720, 400),
  ].concat(
    equipRows.filter(r => r[0] === car).map(r => W(car, /^r/i.test(r[2]) ? 'Roof' : 'UF', r[1], r[3], r[4], r[5], r[6], r[7], '', r[8])),
    extras || [],
    [W(car, 'Bogie', 'Bogie END 1', 3000, 2400, 900, bc / 2, 0, '', bogieMass), W(car, 'Bogie', 'Bogie END 2', 3000, 2400, 900, -bc / 2, 0, '', bogieMass)],
    [W(car, 'Car body', 'Other items', '', '', '', 0, 0, '', 1500)]);

  const DHAKA_EQ = [
    // EXAMPLE values — replace with your Excel lists
    ['Tc', 'AC1', 'Roof', 3300, 2000, 450, 4900, 0, 700],
    ['Tc', 'AC2', 'Roof', 3300, 2000, 450, -4900, 0, 700],
    ['Tc', 'BCU', 'Underframe', 800, 600, 450, 4300, 900, 60],
    ['Tc', 'CMP', 'Underframe', 2200, 1100, 550, 1900, -750, 450],
    ['Tc', 'BAT', 'Underframe', 2000, 900, 500, -1000, 800, 600],
    ['Tc', 'MR', 'Underframe', 1600, 500, 500, -3800, -950, 150],
    ['M1', 'PAN1', 'Roof', 1600, 1800, 450, 6900, 0, 200],
    ['M1', 'PAN2', 'Roof', 1600, 1800, 450, -6900, 0, 200],
    ['M1', 'AC1', 'Roof', 3300, 2000, 450, 3700, 0, 700],
    ['M1', 'AC2', 'Roof', 3300, 2000, 450, -3700, 0, 700],
    ['M1', 'VVVF', 'Underframe', 3400, 1400, 600, 1700, -700, 900],
    ['M1', 'FL', 'Underframe', 1600, 1000, 550, -2400, 800, 500],
    ['M1', 'HSCB', 'Underframe', 900, 700, 450, -4300, -950, 120],
    ['M1', 'BCU', 'Underframe', 800, 600, 450, 4600, 900, 60],
    ['M2', 'AC1', 'Roof', 3300, 2000, 450, 4900, 0, 700],
    ['M2', 'AC2', 'Roof', 3300, 2000, 450, -4900, 0, 700],
    ['M2', 'VVVF', 'Underframe', 3400, 1400, 600, 1700, -700, 900],
    ['M2', 'APU', 'Underframe', 2600, 1300, 600, -2800, 650, 800],
    ['M2', 'BCU', 'Underframe', 800, 600, 450, 4600, 900, 60],
  ];

  TLT.PRESETS = {
    'dhaka-l5n': () => ({
      meta: { preset: 'dhaka-l5n', title: 'Dhaka MRT Line-5N CP-08 — 8-car train' },
      productType: 'metro',
      power: { system: '1500DC', collector: 'panto', contact: 'bottom', shoeCars: 'all', railOffset: 1450, maxGap: 0, maxPantos: 6, hvClearance: 270 },
      project: {
        company: 'CAF', project: 'Dhaka MRT Line-5 Northern Route — CP-08 Rolling Stock', client: 'DMTCL',
        drawingNo: 'L5N-CP08-ARR-001', revision: 'A', drawnBy: '', checkedBy: '', date: today(), paper: 'A3',
        status: 'BID STAGE — INDICATIVE',
      },
      formation: "Tc-M1-M2 | M1'-M2 | M1'-M2-Tc'",
      equipment: DHAKA_EQ.map(rowObj),
      weightItems: [].concat(
        weightRows('Tc', 20400, 13800, DHAKA_EQ, 5600, [W('Tc', 'Cab', 'Cab equipment & desk', 1500, 2600, 1000, 8950, 0, 1700, 900), W('Tc', 'Cab', 'Signalling (CBTC) equipment', 600, 600, 1200, 8950, -900, 1700, 400)]),
        weightRows('M1', 20000, 13800, DHAKA_EQ, 7200),
        weightRows('M2', 20000, 13800, DHAKA_EQ, 7200)),
      weightSource: 'Example values (preset)',
      equipmentSource: 'Example values (preset)',
      common: {
        bodyWidth: 2950, wallThk: 60, floorHeight: 1130, roofHeight: 3650, maxHeight: 4100,
        endWallThk: 150, gangwayWidth: 1100,
        wheelDia: 860, wheelbase: 2100, mountDepth: 250, profile: 't2',
      },
      doors: {
        type: 'Bi-parting sliding (pocket)', width: 1500, height: 1850,
        detrain: { on: true, width: 800, height: 1800 },
        cabSide: { on: true, width: 600, height: 1850, pos: 1200 },
        cabSaloon: { on: true, width: 700, height: 1900, y: 0, type: 'Hinged' },
      },
      cab: { desk: 'side', deskSide: 'B', observer: true, goa4: false, consoleDepth: 700, deskDepth: 800, deskWidth: 1400, auxLength: 700, auxDepth: 1000, auxSide: 'B', coDesk: false, coDeskWidth: 650 },
      windows: { inner: 'single', end: 'single', singleWidth: 0, doubleWidth: 1000, height: 900, sill: 820, drop: 'ends', dropDepth: 400, doorWin: true, doorWinWidth: 0, doorWinHeight: 750, doorWinSill: 950 },
      front: { wsSplit: 'single', wsDoorGap: 150, wsTop: 0, wsWidth: 0, wiperLength: 0, wsBottom: 900, wipers: 2, wiperType: 'single', lightsZ: 350, lightsInset: 420, destination: true, couplerHeight: 720, showGauge: true, gaugeWidth: 3000, gaugeHeight: 4100 },
      hvac: { unitsPerCar: 2, cabHvac: false },
      interior: {
        widthRefHeight: 1200,
        seatType: 'longitudinal', seatWidth: 430, seatDepth: 550, footZone: 300, doorClearance: 330, endClearance: 0, minDoorClearance: 100,
        transSeatsPerSide: 2, transSeatDepth: 450, transLegroom: 600,
        wcLength: 1300, wcWidth: 700, wcTurning: 1500, wcAsStanding: true, minAisle: 900, cabinetDepth: 600,
      },
      loads: { paxMass: 60, maxAxleLoad: 15.77, axlesPerCar: 4, standCase: 'AW2', rounding: 'floor', wheelSpacing: 1500, imbalanceLimit: 15 },
      cases: [
        { name: 'AW1', kind: 'seated', note: 'Seated passengers only' },
        { name: 'AW2', kind: 'density', density: 3.333, note: 'Normal capacity, 0.3 m²/pax' },
        { name: '4 pax/m²', kind: 'density', density: 4, note: '' },
        { name: '6 pax/m²', kind: 'density', density: 6, note: '' },
        { name: 'TPN', kind: 'factor', of: 'AW2', factor: 1.8, note: '180% of AW2 (spec 4.3.2)' },
        { name: 'AW3', kind: 'density', density: 10, note: 'Crush load, 10 pax/m²' },
      ],
      carTypes: [
        {
          name: 'Tc', desc: 'Driving trailer car', cab: true, pantos: 0, ccd: '', couplerLength: 20400, bodyLength: 19900, cabLength: 2000,
          support1: 'own', support2: 'own', bogieCentres: 13800, motorBogies: 0, doorsPerSide: 4, doorPitch: 4820, doorRearOffset: 2770, tare: 34.8,
          specSeats: 39, specStanding: 113,
          interiorItems: [{ kind: 'wheelchair', bay: 1, side: 'A', place: 'door' }],
        },
        {
          name: 'M1', desc: 'Motor car with pantographs', cab: false, pantos: 2, ccd: '', couplerLength: 20000, bodyLength: 19500,
          support1: 'own', support2: 'own', bogieCentres: 13800, motorBogies: 2, doorsPerSide: 4, doorPitch: 4820, doorRearOffset: 2770, tare: 37.2,
          specSeats: 48, specStanding: 117,
          interiorItems: [],
        },
        {
          name: 'M2', desc: 'Motor car with APU', cab: false, pantos: 0, ccd: '', couplerLength: 20000, bodyLength: 19500,
          support1: 'own', support2: 'own', bogieCentres: 13800, motorBogies: 2, doorsPerSide: 4, doorPitch: 4820, doorRearOffset: 2770, tare: 37.2,
          specSeats: 48, specStanding: 117,
          interiorItems: [],
        },
      ],
    }),
  };

  /* ---- Templates for other product types (indicative values — replace with project data) ---- */
  // Simple weight list from a body mass and bogie positions [x from car centre (+ END 1), kg]
  const simpleWeights = (car, bodyKg, bogies, eq, extras) => [
    W(car, 'Car body', 'Carbody shell', '', '', '', 0, 0, '', Math.round(bodyKg * 0.42)),
    W(car, 'Car body', 'Doors, glazing & operators', '', '', '', 0, 0, '', Math.round(bodyKg * 0.12)),
    W(car, 'Interior', 'Floor, lining, ceiling & seats', '', '', '', 0, 0, '', Math.round(bodyKg * 0.18)),
    W(car, 'UF', 'Cables, piping & cabinets', '', '', '', 0, 0, '', Math.round(bodyKg * 0.12)),
  ].concat(
    eq.filter(r => r[0] === car).map(r => W(car, /^r/i.test(r[2]) ? 'Roof' : 'UF', r[1], r[3], r[4], r[5], r[6], r[7], '', r[8])),
    extras || [],
    bogies.map(([x, m], i) => W(car, 'Bogie', bogies.length > 1 ? `Bogie ${i + 1}` : 'Bogie', 2600, 2200, 800, x, 0, '', m)),
    [W(car, 'Car body', 'Other items', '', '', '', 0, 0, '', Math.round(bodyKg * 0.08))]);
  const baseWindows = { inner: 'single', end: 'single', singleWidth: 0, doubleWidth: 1000, height: 1000, sill: 750, drop: 'none', dropDepth: 400, doorWin: true, doorWinWidth: 0, doorWinHeight: 1000, doorWinSill: 850 };
  const baseCab = { desk: 'central', deskSide: 'B', observer: false, goa4: false, consoleDepth: 700, deskDepth: 800, deskWidth: 1300, auxLength: 700, auxDepth: 1000, auxSide: 'B', coDesk: false, coDeskWidth: 650 };

  // Metro 6-car, 25 kV AC: pantograph, VCB and main transformer on the T cars, traction converters on DM / M
  const METRO_EQ = [
    ['DM', 'AC1', 'Roof', 3300, 2000, 450, 5400, 0, 700], ['DM', 'AC2', 'Roof', 3300, 2000, 450, -5600, 0, 700],
    ['DM', 'VVVF', 'Underframe', 3600, 1400, 600, 1500, -700, 1100], ['DM', 'BCU', 'Underframe', 900, 600, 450, 5000, 900, 70],
    ['DM', 'BAT', 'Underframe', 2000, 900, 500, -2600, 800, 650], ['DM', 'CMP', 'Underframe', 2200, 1100, 550, -4600, -750, 450],
    ['T', 'PAN', 'Roof', 1700, 1800, 500, 7700, 0, 260], ['T', 'VCB', 'Roof', 1000, 800, 400, 5800, 0, 180], ['T', 'ES', 'Roof', 600, 500, 300, 5800, 800, 40],
    ['T', 'ARR', 'Roof', 400, 400, 450, 6700, -750, 25], ['T', 'AC1', 'Roof', 3300, 2000, 450, 1500, 0, 700], ['T', 'AC2', 'Roof', 3300, 2000, 450, -5600, 0, 700],
    ['T', 'MAIN TRANSFORMER', 'Underframe', 4200, 2200, 750, 0, 0, 6800], ['T', 'APU', 'Underframe', 2600, 1300, 600, -5000, 650, 800],
    ['M', 'AC1', 'Roof', 3300, 2000, 450, 5600, 0, 700], ['M', 'AC2', 'Roof', 3300, 2000, 450, -5600, 0, 700],
    ['M', 'VVVF', 'Underframe', 3600, 1400, 600, 1500, -700, 1100], ['M', 'BCU', 'Underframe', 900, 600, 450, 5000, 900, 70],
  ];
  // LRV 2-car: motor bogies at the cab ends, trailer Jacobs bogie under the joint; pantograph on car A
  const LRV_EQ = [
    ['A', 'PAN', 'Roof', 1500, 1600, 400, -2800, 0, 180], ['A', 'HSCB', 'Roof', 900, 700, 350, -4600, 0, 120],
    ['A', 'AC1', 'Roof', 2600, 1700, 400, 2200, 0, 750], ['A', 'VVVF', 'Underframe', 2400, 1200, 500, -1200, -500, 650], ['A', 'BCU', 'Underframe', 800, 600, 400, -3800, 700, 60],
    ['B', 'AC1', 'Roof', 2600, 1700, 400, 2200, 0, 750], ['B', 'APU', 'Roof', 2200, 1300, 450, -3000, 0, 600],
    ['B', 'VVVF', 'Underframe', 2400, 1200, 500, -1200, -500, 650], ['B', 'BAT', 'Underframe', 1400, 800, 450, -3800, 650, 400],
  ];
  // Mainline 4-car EMU DM-T-M-T, 25 kV AC: pantograph, VCB and main transformer on the T cars
  const ML_EQ = [
    ['DM', 'CAB AC', 'Roof', 1300, 1100, 380, 10300, 0, 300], ['DM', 'AC1', 'Roof', 3200, 2000, 450, 5000, 0, 750], ['DM', 'AC2', 'Roof', 3200, 2000, 450, -5500, 0, 750],
    ['DM', 'TRACTION CONV', 'Underframe', 3800, 1600, 650, 1500, -500, 1400], ['DM', 'BAT', 'Underframe', 2200, 1000, 550, -3200, 700, 700], ['DM', 'BCU', 'Underframe', 900, 600, 450, 4600, 900, 80],
    ['T', 'PAN', 'Roof', 1700, 1800, 500, 7800, 0, 260], ['T', 'VCB', 'Roof', 1000, 800, 400, 5700, 0, 180], ['T', 'ES', 'Roof', 600, 500, 300, 5700, 800, 40],
    ['T', 'ARR', 'Roof', 400, 400, 450, 6600, -700, 25], ['T', 'AC1', 'Roof', 3200, 2000, 450, 1200, 0, 750], ['T', 'AC2', 'Roof', 3200, 2000, 450, -5500, 0, 750],
    ['T', 'MAIN TRANSFORMER', 'Underframe', 4200, 2200, 750, 0, 0, 7200], ['T', 'AUX CONV', 'Underframe', 2400, 1300, 550, -5000, 600, 900],
    ['M', 'AC1', 'Roof', 3200, 2000, 450, 5500, 0, 750], ['M', 'AC2', 'Roof', 3200, 2000, 450, -5500, 0, 750],
    ['M', 'TRACTION CONV', 'Underframe', 3800, 1600, 650, 2200, -500, 1400], ['M', 'CMP', 'Underframe', 2200, 1100, 550, -3600, -700, 500], ['M', 'BCU', 'Underframe', 900, 600, 450, -5600, 900, 80],
  ];

  Object.assign(TLT.PRESETS, {
    'metro-6car': () => ({
      meta: { preset: 'metro-6car', title: 'Metro — 6-car, 25 kV AC (template)' },
      productType: 'metro',
      project: { company: 'CAF', project: 'Metro — 6-car train, 25 kV AC (template)', client: '—', drawingNo: 'MET-ARR-001', revision: 'A', drawnBy: '', checkedBy: '', date: today(), paper: 'A3', status: 'TEMPLATE — INDICATIVE', trainRows: '1' },
      formation: "DM-T-M | M'-T'-DM'",
      power: { system: '25kV', collector: 'panto', contact: 'bottom', shoeCars: 'all', railOffset: 1450, maxGap: 0, maxPantos: 0, hvClearance: 270 },
      equipment: METRO_EQ.map(rowObj),
      weightItems: [].concat(
        weightRows('DM', 22600, 15000, METRO_EQ, 7400, [W('DM', 'Cab', 'Cab equipment & desk', 1500, 2700, 1000, 10000, 0, 1700, 900)]),
        weightRows('T', 22000, 15000, METRO_EQ, 5800),
        weightRows('M', 22000, 15000, METRO_EQ, 7400)),
      weightSource: 'Template values', equipmentSource: 'Template values',
      common: { bodyWidth: 2900, wallThk: 60, floorHeight: 1100, roofHeight: 3800, maxHeight: 4250, endWallThk: 150, gangwayWidth: 1300, wheelDia: 860, wheelbase: 2300, mountDepth: 250, profile: 't1' },
      doors: { type: 'Bi-parting sliding (pocket)', width: 1400, height: 1900, detrain: { on: true, width: 800, height: 1800 }, cabSide: { on: true, width: 600, height: 1900, pos: 1200 }, cabSaloon: { on: true, width: 700, height: 1900, y: 0, type: 'Hinged' } },
      cab: { desk: 'side', deskSide: 'B', observer: true, goa4: false, consoleDepth: 700, deskDepth: 800, deskWidth: 1400, auxLength: 700, auxDepth: 1000, auxSide: 'B', coDesk: false, coDeskWidth: 650 },
      windows: { inner: 'single', end: 'single', singleWidth: 0, doubleWidth: 1000, height: 900, sill: 820, drop: 'ends', dropDepth: 400, doorWin: true, doorWinWidth: 0, doorWinHeight: 750, doorWinSill: 950 },
      front: { wsSplit: 'single', wsDoorGap: 150, wsTop: 0, wsWidth: 0, wiperLength: 0, wsBottom: 900, wipers: 2, wiperType: 'single', lightsZ: 350, lightsInset: 420, destination: true, couplerHeight: 720, showGauge: true, gaugeWidth: 3100, gaugeHeight: 4250 },
      hvac: { unitsPerCar: 2, cabHvac: false },
      interior: { widthRefHeight: 1200, seatType: 'longitudinal', seatWidth: 450, seatDepth: 550, footZone: 300, doorClearance: 330, endClearance: 0, minDoorClearance: 100, transSeatsPerSide: 2, transSeatDepth: 450, transLegroom: 600,
        wcLength: 1300, wcWidth: 750, wcTurning: 1500, wcAsStanding: true, minAisle: 900, cabinetDepth: 600 },
      loads: { paxMass: 65, maxAxleLoad: 17, axlesPerCar: 4, standCase: '', rounding: 'floor', wheelSpacing: 1500, imbalanceLimit: 15 },
      cases: [
        { name: 'AW1', kind: 'seated', note: 'Seated passengers only' },
        { name: 'AW2', kind: 'density', density: 4, note: 'Normal load, 4 pax/m²' },
        { name: 'AW3', kind: 'density', density: 6, note: 'Crush load, 6 pax/m²' },
        { name: '8 pax/m²', kind: 'density', density: 8, note: 'Dense crush' },
      ],
      carTypes: [
        { name: 'DM', desc: 'Driving motor car', end1: 'cab', end2: 'gangway', cab: true, couplerLength: 22600, bodyLength: 22000, cabLength: 2000,
          support1: 'own', support2: 'own', centreBogie: false, bogieCentres: 15000, motorBogies: 2, doorsPerSide: 4, doorPitch: 4900, doorRearOffset: 2900, tare: 0,
          pantos: 0, specSeats: '', specStanding: '', interiorItems: [{ kind: 'wheelchair', bay: 1, side: 'A', place: 'door' }] },
        { name: 'T', desc: 'Trailer car with pantograph and main transformer', end1: 'gangway', end2: 'gangway', cab: false, couplerLength: 22000, bodyLength: 21400,
          support1: 'own', support2: 'own', centreBogie: false, bogieCentres: 15000, motorBogies: 0, doorsPerSide: 4, doorPitch: 5400, doorRearOffset: 2900, tare: 0,
          pantos: 1, specSeats: '', specStanding: '', interiorItems: [] },
        { name: 'M', desc: 'Motor car', end1: 'gangway', end2: 'gangway', cab: false, couplerLength: 22000, bodyLength: 21400,
          support1: 'own', support2: 'own', centreBogie: false, bogieCentres: 15000, motorBogies: 2, doorsPerSide: 4, doorPitch: 5400, doorRearOffset: 2900, tare: 0,
          pantos: 0, specSeats: '', specStanding: '', interiorItems: [] },
      ],
    }),

    'lrv-2car': () => ({
      meta: { preset: 'lrv-2car', title: 'LRV — 2-car, Jacobs bogie (template)' },
      productType: 'lrv',
      project: { company: 'CAF', project: 'Light rail vehicle — 2-car, double-ended (template)', client: '—', drawingNo: 'LRV-ARR-001', revision: 'A', drawnBy: '', checkedBy: '', date: today(), paper: 'A3', status: 'TEMPLATE — INDICATIVE', trainRows: '1' },
      formation: "A-B'",
      power: { system: '750DC', collector: 'panto', contact: 'bottom', shoeCars: 'all', railOffset: 1450, maxGap: 0, maxPantos: 0, hvClearance: 270 },
      equipment: LRV_EQ.map(rowObj),
      weightItems: [].concat(
        simpleWeights('A', 11500, [[4500, 4600], [-7500, 3900]], LRV_EQ, [W('A', 'Cab', 'Cab equipment & desk', 1200, 2400, 1000, 6200, 0, 1500, 600)]),
        simpleWeights('B', 11500, [[4500, 4600]], LRV_EQ, [W('B', 'Cab', 'Cab equipment & desk', 1200, 2400, 1000, 6200, 0, 1500, 600)])),
      weightSource: 'Template values', equipmentSource: 'Template values',
      common: { bodyWidth: 2650, wallThk: 60, floorHeight: 900, roofHeight: 3400, maxHeight: 3800, endWallThk: 100, gangwayWidth: 1300, wheelDia: 660, wheelbase: 1900, mountDepth: 200, profile: 't2' },
      doors: { type: 'Bi-parting sliding plug', width: 1300, height: 1900, detrain: { on: true, width: 700, height: 1700 }, cabSide: { on: false, width: 600, height: 1800, pos: 1000 }, cabSaloon: { on: true, width: 650, height: 1900, y: -600, type: 'Hinged' } },
      cab: Object.assign({}, baseCab),
      windows: Object.assign({}, baseWindows),
      front: { wsSplit: 'single', wsDoorGap: 150, wsTop: 0, wsWidth: 0, wiperLength: 0, wsBottom: 900, wipers: 1, wiperType: 'pantograph', lightsZ: 300, lightsInset: 380, destination: true, couplerHeight: 600, showGauge: true, gaugeWidth: 2750, gaugeHeight: 3800 },
      hvac: { unitsPerCar: 1, cabHvac: false },
      interior: { widthRefHeight: 1200, seatType: 'transverse', seatWidth: 450, seatDepth: 500, footZone: 300, doorClearance: 200, endClearance: 0, minDoorClearance: 100, transSeatsPerSide: 2, transSeatDepth: 450, transLegroom: 600,
        wcLength: 1300, wcWidth: 750, wcTurning: 1500, wcAsStanding: true, minAisle: 600, cabinetDepth: 600 },
      loads: { paxMass: 70, maxAxleLoad: 11, axlesPerCar: 4, standCase: '', rounding: 'floor', wheelSpacing: 1500, imbalanceLimit: 15 },
      cases: [
        { name: 'Seated', kind: 'seated', note: 'All seats occupied (folding seats in use)' },
        { name: 'EL4', kind: 'density', density: 4, fold: 'yes', note: 'Design load: fixed seats + 4 pax/m²; folding seats, wheelchair and bicycle areas standing' },
        { name: 'EL6', kind: 'density', density: 6, fold: 'yes', note: 'Crush load: fixed seats + 6 pax/m²' },
        { name: 'PXD', kind: 'kgm2', density: 500, fold: 'yes', note: 'Exceptional load: fixed seats + 500 kg/m²' },
      ],
      carTypes: [
        { name: 'A', desc: 'Car A: cab, motor bogie at the cab end, pantograph', end1: 'cab', end2: 'artic', cab: true, couplerLength: 15000, bodyLength: 14700, cabLength: 1800,
          support1: 'own', support2: 'shared', centreBogie: false, bogieCentres: 6000, motorBogies: '1e1', doorsPerSide: 2, doorPitch: 5500, doorRearOffset: 3500, tare: 0,
          pantos: 1, specSeats: '', specStanding: '', interiorItems: [{ kind: 'wheelchair', bay: 1, side: 'A', place: 'door' }, { kind: 'folding', bay: 1, side: 'B', place: 'door', n: 3, stand: 'yes' }] },
        { name: 'B', desc: 'Car B: cab, motor bogie at the cab end', end1: 'cab', end2: 'artic', cab: true, couplerLength: 15000, bodyLength: 14700, cabLength: 1800,
          support1: 'own', support2: 'shared', centreBogie: false, bogieCentres: 6000, motorBogies: '1e1', doorsPerSide: 2, doorPitch: 5500, doorRearOffset: 3500, tare: 0,
          pantos: 0, specSeats: '', specStanding: '', interiorItems: [{ kind: 'wheelchair', bay: 1, side: 'A', place: 'door' }, { kind: 'bicycle', bay: 1, side: 'B', place: 'door', length: 1800, depth: 700, stand: 'yes' }] },
      ],
    }),

    'mainline-emu4': () => ({
      meta: { preset: 'mainline-emu4', title: 'Mainline EMU — 4-car, 25 kV (template)' },
      productType: 'mainline',
      project: { company: 'CAF', project: 'Regional EMU — 4-car, 25 kV AC (template)', client: '—', drawingNo: 'EMU-ARR-001', revision: 'A', drawnBy: '', checkedBy: '', date: today(), paper: 'A3', status: 'TEMPLATE — INDICATIVE', trainRows: '2' },
      formation: 'DM-T-M-T',
      muFactor: 2,
      aero: { speed: 160, noseLength: 0 },
      power: { system: '25kV', collector: 'panto', contact: 'top', shoeCars: 'all', railOffset: 1450, maxGap: 0, maxPantos: 0, hvClearance: 270 },
      equipment: ML_EQ.map(rowObj),
      weightItems: [].concat(
        simpleWeights('DM', 26000, [[8600, 8600], [-8600, 8600]], ML_EQ, [W('DM', 'Cab', 'Cab equipment & desk', 2000, 2700, 1100, 10800, 0, 1900, 1400), W('DM', 'Interior', 'PRM toilet module', 2100, 1800, 2200, 5500, 480, '', 900)]),
        simpleWeights('T', 25000, [[8600, 6800], [-8600, 6800]], ML_EQ, [W('T', 'Interior', 'Toilet module', 1100, 1200, 2200, 6500, 800, '', 600)]),
        simpleWeights('M', 26000, [[8600, 8600], [-8600, 8600]], ML_EQ)),
      weightSource: 'Template values', equipmentSource: 'Template values',
      common: { bodyWidth: 2900, wallThk: 70, floorHeight: 1150, roofHeight: 3850, maxHeight: 4300, endWallThk: 150, gangwayWidth: 1100, wheelDia: 920, wheelbase: 2500, mountDepth: 200, profile: 't3' },
      doors: { type: 'Bi-parting sliding plug', width: 1300, height: 2000, detrain: { on: false, width: 700, height: 1800 }, cabSide: { on: true, width: 650, height: 1900, pos: 1700 }, cabSaloon: { on: true, width: 700, height: 1950, y: 0, type: 'Sliding' } },
      cab: Object.assign({}, baseCab),
      windows: Object.assign({}, baseWindows, { inner: 'double', doubleWidth: 1500, sill: 800, height: 900, drop: 'none' }),
      front: { wsSplit: 'single', wsDoorGap: 150, wsTop: 0, wsWidth: 0, wiperLength: 0, wsBottom: 1050, wipers: 2, wiperType: 'pantograph', lightsZ: 300, lightsInset: 420, destination: true, couplerHeight: 1025, showGauge: true, gaugeWidth: 3150, gaugeHeight: 4300 },
      hvac: { unitsPerCar: 2, cabHvac: true },
      interior: { widthRefHeight: 1200, seatType: 'transverse', seatWidth: 450, seatDepth: 500, footZone: 300, doorClearance: 200, endClearance: 0, minDoorClearance: 100, transSeatsPerSide: 2, transSeatDepth: 450, transLegroom: 600,
        wcLength: 1300, wcWidth: 750, wcTurning: 1500, wcAsStanding: true, minAisle: 600, cabinetDepth: 600,
        mlStdAbreast: '2+2', mlStdPitch: 850, mlFirstAbreast: '2+1', mlFirstPitch: 1000, mlFirstSeatWidth: 520, mlArrangement: 'facing', mlSeatLength: 520,
        mlVestibules: true, mlVestLength: 2600, mlVestDoor: 900 },
      loads: { paxMass: 75, maxAxleLoad: 18, axlesPerCar: 4, standCase: '', rounding: 'floor', wheelSpacing: 1500, imbalanceLimit: 15 },
      cases: [
        { name: 'Seated', kind: 'seated', note: 'All seats occupied' },
        { name: '2 pax/m²', kind: 'density', density: 2, note: 'Standing, normal (check EN 15663 / spec)' },
        { name: '4 pax/m²', kind: 'density', density: 4, note: 'Standing, exceptional' },
      ],
      carTypes: [
        { name: 'DM', desc: 'Driving motor car, 1st + standard class, PRM toilet', end1: 'cab', end2: 'gangway', cab: true, couplerLength: 24900, bodyLength: 24300, cabLength: 2800,
          support1: 'own', support2: 'own', centreBogie: false, bogieCentres: 17200, motorBogies: 2, doorsPerSide: 2, doorPitch: 18300, doorRearOffset: 2700, tare: 0,
          pantos: 0, seatClass: 'mixed', firstLength: 6500, specSeats: '', specStanding: '',
          interiorItems: [{ kind: 'toiletPrm', bay: 1, side: 'A', place: 'end1', length: 2100, depth: 1800 }, { kind: 'wheelchair', bay: 1, side: 'B', place: 'end2' }] },
        { name: 'T', desc: 'Trailer with pantograph and main transformer, standard class, toilet', end1: 'gangway', end2: 'gangway', cab: false, couplerLength: 24600, bodyLength: 24000,
          support1: 'own', support2: 'own', centreBogie: false, bogieCentres: 17200, motorBogies: 0, doorsPerSide: 2, doorPitch: 19200, doorRearOffset: 2700, tare: 0,
          pantos: 1, seatClass: 'std', firstLength: 0, specSeats: '', specStanding: '',
          interiorItems: [{ kind: 'toilet', bay: 1, side: 'A', place: 'end1', length: 1100, depth: 1200 }] },
        { name: 'M', desc: 'Motor car, standard class', end1: 'gangway', end2: 'gangway', cab: false, couplerLength: 24600, bodyLength: 24000,
          support1: 'own', support2: 'own', centreBogie: false, bogieCentres: 17200, motorBogies: 2, doorsPerSide: 2, doorPitch: 19200, doorRearOffset: 2700, tare: 0,
          pantos: 0, seatClass: 'std', firstLength: 0, specSeats: '', specStanding: '', interiorItems: [] },
      ],
    }),
  });
  // Template tare = sum of the template weight list (so steps 5 and 6 agree at the start)
  ['metro-6car', 'lrv-2car', 'mainline-emu4'].forEach(id => {
    const f = TLT.PRESETS[id];
    TLT.PRESETS[id] = () => { const c = f(); c.carTypes.forEach(t => { if (!t.tare) t.tare = Math.round(c.weightItems.filter(r => r.car === t.name).reduce((a, r) => a + (+r.mass || 0), 0) / 100) / 10; }); return c; };
  });

  // equipment descriptions (full names) for the short forms used in the presets
  Object.keys(TLT.PRESETS).forEach(id => {
    const f = TLT.PRESETS[id];
    TLT.PRESETS[id] = () => { const c = f(); (c.equipment || []).forEach(r => { if (!r.desc) r.desc = TLT.equipDescFor(r.name); }); return c; };
  });

  // Template per product type (used by "Load template" in Train formation)
  TLT.PRODUCT_TEMPLATES = { metro: 'metro-6car', lrv: 'lrv-2car', mainline: 'mainline-emu4' };

  TLT.PRESET_LIST = [
    { id: 'dhaka-l5n', label: 'Dhaka MRT Line-5N CP-08 (8-car)' },
    { id: 'metro-6car', label: 'Metro — 6-car, 25 kV (template)' },
    { id: 'lrv-2car', label: 'LRV — 2-car, Jacobs bogie (template)' },
    { id: 'mainline-emu4', label: 'Mainline EMU — 4-car, 25 kV (template)' },
  ];
})();
