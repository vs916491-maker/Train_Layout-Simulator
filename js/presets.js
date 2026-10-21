/* Train Layout Tool — presets (input sets). Add your own project here or save/load JSON from the UI. */
(function () {
  'use strict';
  const TLT = (globalThis.TLT = globalThis.TLT || {});

  const today = () => new Date().toISOString().slice(0, 10);

  TLT.PRESETS = {
    'dhaka-l5n': () => ({
      meta: { preset: 'dhaka-l5n', title: 'Dhaka MRT Line-5N CP-08 — 8-car train' },
      project: {
        company: 'CAF', project: 'Dhaka MRT Line-5 Northern Route — CP-08 Rolling Stock', client: 'DMTCL',
        drawingNo: 'L5N-CP08-ARR-001', revision: 'A', drawnBy: '', checkedBy: '', date: today(), paper: 'A3',
        status: 'BID STAGE — INDICATIVE',
      },
      formation: "Tc-M1-M2 | M1'-M2 | M1'-M2-Tc'",
      detail: { driving: 'Tc', intermediate: 'M1' },
      common: {
        bodyWidth: 2950, wallThk: 60, floorHeight: 1130, roofHeight: 3650, maxHeight: 4100,
        endWallThk: 150, gangwayWidth: 1100, doorWidth: 1500, doorHeight: 1850, cabDoorWidth: 600,
        wheelDia: 860, wheelbase: 2100,
      },
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
          equipment: [
            'AC1, roof, 4900, 3300, 450',
            'AC2, roof, -4900, 3300, 450',
            'BCU, under, 4300, 800',
            'CMP, under, 1900, 2200',
            'BAT, under, -1000, 2000',
            'MR, under, -3800, 1600',
          ].join('\n'),
        },
        {
          name: 'M1', desc: 'Motor car with pantographs', cab: false, couplerLength: 20000, bodyLength: 19500,
          bogieCentres: 13800, motorBogies: 2, doorsPerSide: 4, doorPitch: 4820, doorRearOffset: 2770, tare: 37.2,
          specSeats: 48, specStanding: 117,
          bays: '',
          equipment: [
            'PAN1, roof, 6900, 1600, 450, panto',
            'PAN2, roof, -6900, 1600, 450, panto',
            'AC1, roof, 3700, 3300, 450',
            'AC2, roof, -3700, 3300, 450',
            'VVVF, under, 1700, 3400',
            'FL, under, -2400, 1600',
            'HSCB, under, -4300, 900',
            'BCU, under, 4600, 800',
          ].join('\n'),
        },
        {
          name: 'M2', desc: 'Motor car with APU', cab: false, couplerLength: 20000, bodyLength: 19500,
          bogieCentres: 13800, motorBogies: 2, doorsPerSide: 4, doorPitch: 4820, doorRearOffset: 2770, tare: 37.2,
          specSeats: 48, specStanding: 117,
          bays: '',
          equipment: [
            'AC1, roof, 4900, 3300, 450',
            'AC2, roof, -4900, 3300, 450',
            'VVVF, under, 1700, 3400',
            'APU, under, -2800, 2600',
            'BCU, under, 4600, 800',
          ].join('\n'),
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
      detail: { driving: 'DM', intermediate: 'M' },
      common: {
        bodyWidth: 3100, wallThk: 70, floorHeight: 1100, roofHeight: 3700, maxHeight: 4050,
        endWallThk: 150, gangwayWidth: 1400, doorWidth: 1400, doorHeight: 1900, cabDoorWidth: 600,
        wheelDia: 840, wheelbase: 2300,
      },
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
          equipment: 'AC1, roof, 5200, 3300\nAC2, roof, -5200, 3300\nVVVF, under, 1500, 3400\nBCU, under, 5000, 800\nBAT, under, -2500, 1800',
        },
        {
          name: 'T', desc: 'Trailer car with pantograph', cab: false, couplerLength: 22710, bodyLength: 22010,
          bogieCentres: 15000, motorBogies: 0, doorsPerSide: 4, doorPitch: 5230, doorRearOffset: 3510, tare: 33,
          specSeats: '', specStanding: '', bays: '',
          equipment: 'PAN, roof, -7500, 1600, 450, panto\nAC1, roof, 5200, 3300\nAC2, roof, -4300, 3300\nAPU, under, 1000, 2800\nCMP, under, -3000, 2200',
        },
        {
          name: 'M', desc: 'Motor car', cab: false, couplerLength: 22710, bodyLength: 22010,
          bogieCentres: 15000, motorBogies: 2, doorsPerSide: 4, doorPitch: 5230, doorRearOffset: 3510, tare: 39,
          specSeats: '', specStanding: '', bays: '',
          equipment: 'AC1, roof, 5200, 3300\nAC2, roof, -5200, 3300\nVVVF, under, 1500, 3400\nBCU, under, 5000, 800',
        },
      ],
    }),
  };

  TLT.PRESET_LIST = [
    { id: 'dhaka-l5n', label: 'Dhaka MRT Line-5N CP-08 (8-car)' },
    { id: 'example-6car', label: 'Example 6-car unit (from sample drawing)' },
  ];
})();
