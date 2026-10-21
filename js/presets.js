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
  const EX_EQ = [
    ['DM', 'AC1', 'Roof', 3300, 2000, 450, 5200, 0, 700],
    ['DM', 'AC2', 'Roof', 3300, 2000, 450, -5200, 0, 700],
    ['DM', 'VVVF', 'Underframe', 3400, 1400, 600, 1500, -700, 900],
    ['DM', 'BCU', 'Underframe', 800, 600, 450, 5000, 900, 60],
    ['DM', 'BAT', 'Underframe', 1800, 900, 500, -2500, 800, 600],
    ['T', 'PAN', 'Roof', 1600, 1800, 450, -7500, 0, 200],
    ['T', 'AC1', 'Roof', 3300, 2000, 450, 5200, 0, 700],
    ['T', 'AC2', 'Roof', 3300, 2000, 450, -4300, 0, 700],
    ['T', 'APU', 'Underframe', 2800, 1300, 600, 1000, 650, 800],
    ['T', 'CMP', 'Underframe', 2200, 1100, 550, -3000, -750, 450],
    ['M', 'AC1', 'Roof', 3300, 2000, 450, 5200, 0, 700],
    ['M', 'AC2', 'Roof', 3300, 2000, 450, -5200, 0, 700],
    ['M', 'VVVF', 'Underframe', 3400, 1400, 600, 1500, -700, 900],
    ['M', 'BCU', 'Underframe', 800, 600, 450, 5000, 900, 60],
  ];

  TLT.PRESETS = {
    'dhaka-l5n': () => ({
      meta: { preset: 'dhaka-l5n', title: 'Dhaka MRT Line-5N CP-08 — 8-car train' },
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
        wheelDia: 860, wheelbase: 2100, mountDepth: 250,
      },
      doors: {
        type: 'Bi-parting sliding (pocket)', width: 1500, height: 1850,
        detrain: { on: true, width: 800, height: 1800 },
        cabSide: { on: true, width: 600, height: 1850, pos: 1200 },
        cabSaloon: { on: true, width: 700, height: 1900, y: 0, type: 'Hinged' },
      },
      cab: { desk: 'side', deskSide: 'B', observer: true, goa4: false, consoleDepth: 700, deskDepth: 800, deskWidth: 1400 },
      windows: { inner: 'single', end: 'single', singleWidth: 0, doubleWidth: 1000, height: 900, sill: 820, drop: 'ends', dropDepth: 400, doorWin: true, doorWinWidth: 0, doorWinHeight: 750, doorWinSill: 950 },
      front: { wipers: 2, wiperType: 'single', lightsZ: 350, lightsInset: 420, destination: true, couplerHeight: 720, showGauge: true, gaugeWidth: 3000, gaugeHeight: 4100 },
      hvac: { unitsPerCar: 2, cabHvac: false },
      interior: {
        seatType: 'longitudinal', seatWidth: 430, seatDepth: 550, footZone: 300, doorClearance: 330, endClearance: 0, minDoorClearance: 100,
        transSeatsPerSide: 2, transSeatDepth: 450, transLegroom: 600,
        wcLength: 1300, wcWidth: 700, wcTurning: 1500, wcAsStanding: true, minAisle: 900, cabinetDepth: 600,
      },
      loads: { paxMass: 60, maxAxleLoad: 15.77, axlesPerCar: 4, rounding: 'floor', wheelSpacing: 1500, imbalanceLimit: 15 },
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
          name: 'Tc', desc: 'Driving trailer car', cab: true, couplerLength: 20400, bodyLength: 19900, cabLength: 2000,
          support1: 'own', support2: 'own', bogieCentres: 13800, motorBogies: 0, doorsPerSide: 4, doorPitch: 4820, doorRearOffset: 2770, tare: 34.8,
          specSeats: 39, specStanding: 113,
          interiorItems: [{ kind: 'wheelchair', bay: 1, side: 'A', place: 'door' }],
        },
        {
          name: 'M1', desc: 'Motor car with pantographs', cab: false, couplerLength: 20000, bodyLength: 19500,
          support1: 'own', support2: 'own', bogieCentres: 13800, motorBogies: 2, doorsPerSide: 4, doorPitch: 4820, doorRearOffset: 2770, tare: 37.2,
          specSeats: 48, specStanding: 117,
          interiorItems: [],
        },
        {
          name: 'M2', desc: 'Motor car with APU', cab: false, couplerLength: 20000, bodyLength: 19500,
          support1: 'own', support2: 'own', bogieCentres: 13800, motorBogies: 2, doorsPerSide: 4, doorPitch: 4820, doorRearOffset: 2770, tare: 37.2,
          specSeats: 48, specStanding: 117,
          interiorItems: [],
        },
      ],
    }),

    'example-6car': () => ({
      meta: { preset: 'example-6car', title: 'Example 6-car unit (approx. from reference drawing)' },
      project: {
        company: 'CAF', project: 'Example metro — 6-car unit', client: '—', drawingNo: 'EX-ARR-001', revision: 'A',
        drawnBy: '', checkedBy: '', date: today(), paper: 'A3', status: 'EXAMPLE',
      },
      formation: 'DM-T-M | M*-T*-DM',
      equipment: EX_EQ.map(rowObj),
      weightItems: [].concat(
        weightRows('DM', 22610, 15000, EX_EQ, 7400, [W('DM', 'Cab', 'Cab equipment & desk', 1500, 2700, 1000, 10000, 0, 1700, 900)]),
        weightRows('T', 22710, 15000, EX_EQ, 5700),
        weightRows('M', 22710, 15000, EX_EQ, 7400)),
      weightSource: 'Example values (preset)',
      equipmentSource: 'Example values (preset)',
      common: {
        bodyWidth: 3100, wallThk: 70, floorHeight: 1100, roofHeight: 3700, maxHeight: 4050,
        endWallThk: 150, gangwayWidth: 1400,
        wheelDia: 840, wheelbase: 2300, mountDepth: 250,
      },
      doors: {
        type: 'Bi-parting sliding (pocket)', width: 1400, height: 1900,
        detrain: { on: true, width: 800, height: 1800 },
        cabSide: { on: true, width: 600, height: 1900, pos: 1250 },
        cabSaloon: { on: true, width: 700, height: 1900, y: 0, type: 'Hinged' },
      },
      cab: { desk: 'side', deskSide: 'B', observer: true, goa4: false, consoleDepth: 700, deskDepth: 800, deskWidth: 1400 },
      windows: { inner: 'single', end: 'single', singleWidth: 0, doubleWidth: 1000, height: 900, sill: 820, drop: 'ends', dropDepth: 400, doorWin: true, doorWinWidth: 0, doorWinHeight: 750, doorWinSill: 950 },
      front: { wipers: 2, wiperType: 'single', lightsZ: 350, lightsInset: 420, destination: true, couplerHeight: 720, showGauge: true, gaugeWidth: 3200, gaugeHeight: 4050 },
      hvac: { unitsPerCar: 2, cabHvac: false },
      interior: {
        seatType: 'longitudinal', seatWidth: 450, seatDepth: 550, footZone: 300, doorClearance: 340, endClearance: 0, minDoorClearance: 100,
        transSeatsPerSide: 2, transSeatDepth: 450, transLegroom: 600,
        wcLength: 1300, wcWidth: 700, wcTurning: 1500, wcAsStanding: true, minAisle: 900, cabinetDepth: 600,
      },
      loads: { paxMass: 70, maxAxleLoad: 16, axlesPerCar: 4, rounding: 'floor', wheelSpacing: 1500, imbalanceLimit: 15 },
      cases: [
        { name: 'Seated', kind: 'seated', note: '' },
        { name: '4 pax/m²', kind: 'density', density: 4, note: '' },
        { name: '6 pax/m²', kind: 'density', density: 6, note: '' },
        { name: '8 pax/m²', kind: 'density', density: 8, note: '' },
      ],
      carTypes: [
        {
          name: 'DM', desc: 'Driving motor car', cab: true, couplerLength: 22610, bodyLength: 22010, cabLength: 2050,
          support1: 'own', support2: 'own', bogieCentres: 15000, motorBogies: 2, doorsPerSide: 4, doorPitch: 5230, doorRearOffset: 3260, tare: 40,
          specSeats: '', specStanding: '', interiorItems: [{ kind: 'wheelchair', bay: 1, side: 'B', place: 'door' }],
        },
        {
          name: 'T', desc: 'Trailer car with pantograph', cab: false, couplerLength: 22710, bodyLength: 22010,
          support1: 'own', support2: 'own', bogieCentres: 15000, motorBogies: 0, doorsPerSide: 4, doorPitch: 5230, doorRearOffset: 3510, tare: 33,
          specSeats: '', specStanding: '', interiorItems: [],
        },
        {
          name: 'M', desc: 'Motor car', cab: false, couplerLength: 22710, bodyLength: 22010,
          support1: 'own', support2: 'own', bogieCentres: 15000, motorBogies: 2, doorsPerSide: 4, doorPitch: 5230, doorRearOffset: 3510, tare: 39,
          specSeats: '', specStanding: '', interiorItems: [],
        },
      ],
    }),
  };

  TLT.PRESET_LIST = [
    { id: 'dhaka-l5n', label: 'Dhaka MRT Line-5N CP-08 (8-car)' },
    { id: 'example-6car', label: 'Example 6-car unit (from sample drawing)' },
  ];
})();
