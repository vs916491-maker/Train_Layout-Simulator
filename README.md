# Train Layout Generator

A browser tool that draws a metro train's vehicle layout, interior seat layouts and passenger capacity from a set of inputs, and exports them as a multi-page **PDF** and a CAD-ready **DXF**.

It is plain HTML + JavaScript. There is nothing to install and no server: open it in Chrome or Edge, including on a locked-down work laptop.

## What it produces

| Sheet | Content |
|---|---|
| 1 · Train layout | Side elevation and plan of the full trainset, car labels and units, chain dimensions (coupler–bogie–bogie–coupler, car lengths, overall length, door positions), formation table with lengths, bogies, tare, seats, capacity and equipment |
| 2 · Driving car | Side elevation (doors, windows, bogies, roof and underframe equipment, heights) and interior plan (cab, seats, foot zones, standing area, wheelchair space with turning circle, cubicles, bay numbers) with dimensions and an area / capacity table |
| 3 · Intermediate car | Same as sheet 2 for the chosen intermediate car type |
| 4 · Capacity | Basis of calculation, load cases, floor-area breakdown per car type, check against specification values, capacity per car type and per train, train mass and maximum axle load check, car-by-car table |

Paper size A3 / A2 / A1; the scale is chosen automatically to fit.

## Using it

1. Open `index.html` (or `dist/train-layout-generator.html`, a single self-contained file).
2. Pick a preset, or edit the inputs on the left. The drawing updates as you type.
3. **Download PDF** for all sheets. **Download DXF** for all sheets in one file, or one sheet.
4. **Save inputs** writes a JSON file of every input; **Open inputs…** loads it back. Use this to keep one input file per bid.

Edits are also remembered in the browser between visits.

### Formation

`Tc-M1-M2 | M1'-M2 | M1'-M2-Tc'`

* Car types are listed from END 1 to END 2 and separated by `-`.
* `|` marks a unit boundary (shown as unit brackets on sheet 1).
* `X'` uses car type `X` turned round, if no type called `X'` exists. `X*` also turns a car.
* Driving cars at the train ends always face outwards.

### Car types

Each car type has its own lengths, bogie centres, door count and pitch, tare mass, bay rules and equipment list. Door positions are set by the **door pitch** and the distance from the **END 2 coupler face to the nearest door centre** (half the car-to-car end-door pitch gives equal door spacing across the gangway).

**Bay rules** — one per line, `bay side value`:

```
1 A wheelchair        wheelchair space in bay 1, side A (seats fill the rest)
0 A cabinet:900:600:ELEC   900 mm long, 600 mm deep cubicle labelled ELEC
4 AB 2                at most 2 seats per side in bay 4
3 B none              no seats in bay 3, side B
```

Bays are numbered B0 … Bn from END 1 (B0 is between the cab / end wall and the first door). Side A is the top of the plan view.

**Equipment** — one per line, `NAME, roof|under, x, length[, height[, box|ac|panto]]`. `x` is the centre offset from the car centre, positive towards END 1. Names starting `AC` on the roof are drawn as air-conditioning units and `PAN` as pantographs.

### Capacity rules

* Seats are fitted per bay: available length = bay length − clearance at each door (draft screen) / end wall, divided by seat width.
* Standing area = saloon floor (interior width × length between end walls or cab partition) minus seats, the foot zone in front of longitudinal seats, cubicles, and the wheelchair space if it is not counted as standing.
* Load cases are either *seated only*, a *density* (pax/m²) or a *factor* of another case (e.g. TPN = 1.8 × AW2).
* Mass = tare + passengers × passenger mass; axle load = mass ÷ axles per car (equal sharing).

Default seat, foot-zone and wheelchair dimensions follow common EN / PRM practice. Confirm them against the standard that applies to each project.

## DXF notes

* AutoCAD R12 (AC1009) format, millimetres, model space at 1:1. Opens in AutoCAD, BricsCAD, DraftSight, LibreCAD and others.
* Each sheet is placed side by side. The frame, title block and tables are scaled by the sheet scale, so a sheet plots at the scale shown in its title block.
* Layers: `BODY`, `DOOR`, `WINDOW`, `BOGIE`, `EQUIP`, `ROOF`, `SEAT`, `FOOT`, `STAND` (standing area hatch lines), `WC`, `CABINET`, `CAB`, `DIM`, `TEXT`, `TABLE`, `TITLE`, `FRAME`, `CENTER`, `RAIL`.
* When the tool runs inside the claude.ai viewer, the DXF is delivered inside a `.zip` because the viewer only accepts certain file types.

## Publishing with GitHub Pages

1. Create a repository (e.g. `train-layout-generator`) and upload all files in this folder, keeping the `js/` folder.
2. In the repository: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / root → Save**.
3. After a minute the tool is live at `https://<your-user>.github.io/train-layout-generator/`.

On a free GitHub plan, Pages needs a **public** repository. If the repository must stay private, download `dist/train-layout-generator.html` and open it directly; it works offline.

## Project structure

```
index.html            page and styles
js/engine.js          geometry, seat fitting, standing area, capacity, mass
js/presets.js         input presets (Dhaka MRT Line-5N CP-08, example 6-car)
js/drawing.js         sheet composition, views, dimensions, tables, title block
js/render-svg.js      on-screen preview
js/export-pdf.js      vector PDF writer (no libraries)
js/export-dxf.js      DXF R12 writer (no libraries)
js/zip.js             ZIP writer used for DXF inside the claude.ai viewer
js/app.js             user interface
tools/build.js        builds dist/ single-file versions   (node tools/build.js)
test/smoke.js         builds every preset to PDF/DXF/SVG   (node test/smoke.js out)
```

## Adding a project preset

Copy the `dhaka-l5n` block in `js/presets.js`, give it a new id, edit the values and add it to `TLT.PRESET_LIST`. Or simply keep a saved JSON input file per project.

## Status

Bid-stage tool. Layouts are indicative and must be checked by the responsible engineer before issue.
