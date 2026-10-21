/* Train Layout Tool — presets (input sets). Add your own project here or save/load JSON from the UI. */
(function () {
  'use strict';
  const TLT = (globalThis.TLT = globalThis.TLT || {});

  const today = () => new Date().toISOString().slice(0, 10);
  const rowObj = r => ({ cat: 'Equipment', car: r[0], name: r[1], loc: /^r/i.test(r[2]) ? 'roof' : 'under', length: r[3], width: r[4], height: r[5], x: r[6], y: r[7], mass: r[8], kind: '' });
  // Mass items (not drawn): [name, x from car centre, mass kg]
  const massRows = (car, list) => list.map(([name, x, mass]) => ({ cat: 'Mass item', car, name, loc: 'under', length: '', width: '', height: '', x, y: 0, mass, kind: '' }));
  const commonMass = (bogie, bc, extra) => [
    ['Carbody shell', 0, 8400],
    ['Bogie END 1', bc / 2, bogie], ['Bogie END 2', -bc / 2, bogie],
    ['Electrical cables & cabinets', 0, 1900],
    ['Pneumatic piping', 0, 600],
    ['Interior ceiling & lining', 0, 1350],
    ['Floor', 0, 1100],
    ['Seats', 0, 560],
    ['Passenger doors & operators', 0, 1600],
    ['Glazing', 0, 700],
    ['Couplers & draft gear', 0, 800],
  ].concat(extra || [], [['Other items', 0, 1500]]);

  TLT.PRESETS = {
    'dhaka-l5n': () => ({
      meta: { preset: 'dhaka-l5n', title: 'Dhaka MRT Line-5N CP-08 — 8-car train' },
      project: {
        company: 'CAF', project: 'Dhaka MRT Line-5 Northern Route — CP-08 Rolling Stock', client: 'DMTCL',
        drawingNo: 'L5N-CP08-ARR-001', revision: 'A', drawnBy: '', checkedBy: '', date: today(), paper: 'A3',
        status: 'BID STAGE — INDICATIVE',
      },
      formation: "Tc-M1-M2 | M1'-M2 | M1'-M2-Tc'",
      equipment: [
        // car, name, loc, length, width, height, x, y, mass(kg)  — EXAMPLE values, replace with your Excel list
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
      ].map(rowObj).concat(
        massRows('Tc', commonMass(5600, 13800, [['Cab equipment & desk', 8950, 900], ['Signalling (CBTC) equipment', 8950, 400]])),
        massRows('M1', commonMass(7200, 13800)),
        massRows('M2', commonMass(7200, 13800))),
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
      hvac: { unitsPerCar: 2, cabHvac: false },
      interior: {
        seatType: 'longitudinal', seatWidth: 430, seatDepth: 550, footZone: 300, doorClearance: 330, endClearance: 0,
        transSeatsPerSide: 2, transSeatDepth: 450, transLegroom: 600,
        wcLength: 1300, wcWidth: 700, wcTurning: 1500, wcAsStanding: true, minAisle: 900, cabinetDepth: 600,
      },
      loads: { paxMass: 60, maxAxleLoad: 15.77, axlesPerCar: 4, rounding: 'floor' },
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
          bogieCentres: 13800, motorBogies: 0, doorsPerSide: 4, doorPitch: 4820, doorRearOffset: 2770, tare: 34.8,
          specSeats: 39, specStanding: 113,
          bays: '1 A wheelchair',
        },
        {
          name: 'M1', desc: 'Motor car with pantographs', cab: false, couplerLength: 20000, bodyLength: 19500,
          bogieCentres: 13800, motorBogies: 2, doorsPerSide: 4, doorPitch: 4820, doorRearOffset: 2770, tare: 37.2,
          specSeats: 48, specStanding: 117,
          bays: '',
        },
        {
          name: 'M2', desc: 'Motor car with APU', cab: false, couplerLength: 20000, bodyLength: 19500,
          bogieCentres: 13800, motorBogies: 2, doorsPerSide: 4, doorPitch: 4820, doorRearOffset: 2770, tare: 37.2,
          specSeats: 48, specStanding: 117,
          bays: '',
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
      equipment: [
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
      ].map(rowObj).concat(
        massRows('DM', commonMass(7400, 15000, [['Cab equipment & desk', 10000, 900]])),
        massRows('T', commonMass(5700, 15000)),
        massRows('M', commonMass(7400, 15000))),
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
      hvac: { unitsPerCar: 2, cabHvac: false },
      interior: {
        seatType: 'longitudinal', seatWidth: 450, seatDepth: 550, footZone: 300, doorClearance: 340, endClearance: 0,
        transSeatsPerSide: 2, transSeatDepth: 450, transLegroom: 600,
        wcLength: 1300, wcWidth: 700, wcTurning: 1500, wcAsStanding: true, minAisle: 900, cabinetDepth: 600,
      },
      loads: { paxMass: 70, maxAxleLoad: 16, axlesPerCar: 4, rounding: 'floor' },
      cases: [
        { name: 'Seated', kind: 'seated', note: '' },
        { name: '4 pax/m²', kind: 'density', density: 4, note: '' },
        { name: '6 pax/m²', kind: 'density', density: 6, note: '' },
        { name: '8 pax/m²', kind: 'density', density: 8, note: '' },
      ],
      carTypes: [
        {
          name: 'DM', desc: 'Driving motor car', cab: true, couplerLength: 22610, bodyLength: 22010, cabLength: 2050,
          bogieCentres: 15000, motorBogies: 2, doorsPerSide: 4, doorPitch: 5230, doorRearOffset: 3260, tare: 40,
          specSeats: '', specStanding: '', bays: '1 B wheelchair',
        },
        {
          name: 'T', desc: 'Trailer car with pantograph', cab: false, couplerLength: 22710, bodyLength: 22010,
          bogieCentres: 15000, motorBogies: 0, doorsPerSide: 4, doorPitch: 5230, doorRearOffset: 3510, tare: 33,
          specSeats: '', specStanding: '', bays: '',
        },
        {
          name: 'M', desc: 'Motor car', cab: false, couplerLength: 22710, bodyLength: 22010,
          bogieCentres: 15000, motorBogies: 2, doorsPerSide: 4, doorPitch: 5230, doorRearOffset: 3510, tare: 39,
          specSeats: '', specStanding: '', bays: '',
        },
      ],
    }),
  };

  TLT.PRESET_LIST = [
    { id: 'dhaka-l5n', label: 'Dhaka MRT Line-5N CP-08 (8-car)' },
    { id: 'example-6car', label: 'Example 6-car unit (from sample drawing)' },
  ];
})();
