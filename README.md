# Train Layout Generator

A browser tool that draws a metro train's vehicle layout, interior seat layouts and passenger capacity from a set of inputs, and exports them as a multi-page **PDF** and a CAD-ready **DXF**.

It is plain HTML + JavaScript. There is nothing to install and no server: open it in Chrome or Edge, including on a locked-down work laptop.

## Workflow — four steps

| Step | Tab | What you do / get |
|---|---|---|
| 1 | **Main Dimensions** | Project and title block, formation, number of car variants, car body and bogie data, interior rules, one card per car variant, load cases. Press **Generate Results**. |
| 2 | **Layout & Calculations** | Sheet 1 train layout (side elevation + plan of the full train, dimension chains, formation table); one interior layout sheet **per car variant** (side elevation, seats, standing area, wheelchair space, bays, dimensions, area/capacity table); last sheet the passenger capacity calculation. Download PDF / DXF. |
| 3 | **Underframe Input** | Download the Excel template, fill in the equipment list (underframe and roof), upload it. Rows are checked (unknown car variant, missing values, outside body width) and can be corrected in the table. Press **Generate Underframe Layout**. |
| 4 | **Underframe Layout** | One sheet per car variant: side elevation with all equipment, underframe plan (viewed from above, floor removed) with X positions from car centre, and an equipment table with sizes, positions, height above rail and mass. Download PDF / DXF. |

If inputs change after generating, steps 2 and 4 show a **Generate again** banner.

Paper size A3 / A2 / A1; the scale is chosen automatically to fit.

## Using it

1. Open `index.html` (or `dist/train-layout-generator.html`, a single self-contained file that also reads Excel offline).
2. Pick a preset or edit the inputs; work through the four steps.
3. **Save inputs** writes a JSON file of every input including the equipment list; **Open inputs…** loads it back. Keep one input file per bid.

Edits are also remembered in the browser between visits.

### Formation

`Tc-M1-M2 | M1'-M2 | M1'-M2-Tc'`

* Car variants are listed from END 1 to END 2 and separated by `-`.
* `|` marks a unit boundary (shown as unit brackets on sheet 1).
* `X'` uses variant `X` turned round, if no variant called `X'` exists. `X*` also turns a car.
* Driving cars at the train ends always face outwards.

### Car variants

Set **Number of car variants** in the formation card; a card appears for each. Each variant has its own lengths, bogie centres, door count and pitch, tare mass and bay rules. Door positions come from the **door pitch** and the distance from the **END 2 coupler face to the nearest door centre**.

**Bay rules** — one per line, `bay side value`:

```
1 A wheelchair             wheelchair space in bay 1, side A (seats fill the rest)
0 A cabinet:900:600:ELEC   900 mm long, 600 mm deep cubicle labelled ELEC
4 AB 2                     at most 2 seats per side in bay 4
3 B none                   no seats in bay 3, side B
```

Bays are numbered B0 … Bn from END 1 (B0 is between the cab / end wall and the first door). Side A is the top of the plan view.

### Equipment Excel file

One sheet (named `Equipment`, or the first sheet) with a header row. Column order does not matter; headers are recognised by name.

| Column | Meaning |
|---|---|
| Car Type | Car variant name, e.g. `Tc`, `M1`, `M2` |
| Equipment | Name shown on the drawing |
| Location | `Underframe` or `Roof` |
| Length (mm) / Width (mm) / Height (mm) | Box size; underframe height is measured down from the mounting face, roof height up from the roof |
| X from car centre (mm) | Equipment centre, **+ towards END 1** |
| Y from centre line (mm) | Equipment centre, **+ towards side A** |
| Mass (kg) | Optional, totalled on the sheet |
| Symbol | Optional `box`, `ac` or `panto` (otherwise guessed from names starting `AC` / `PAN`) |

The template you download contains the current list, so you can edit it and upload it again. CSV files with the same columns are also accepted.

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
js/presets.js         input presets (Dhaka MRT Line-5N CP-08, example 6-car) incl. example equipment lists
js/drawing.js         sheet composition, views, dimensions, tables, title block
js/render-svg.js      on-screen preview
js/export-pdf.js      vector PDF writer (no libraries)
js/export-dxf.js      DXF R12 writer (no libraries)
js/zip.js             ZIP writer used for DXF inside the claude.ai viewer
js/app.js             user interface (4 steps, Excel import/export)
js/vendor/            SheetJS xlsx 0.18.5 (Apache-2.0), offline fallback for the Excel reader
tools/build.js        builds dist/ single-file versions   (node tools/build.js)
test/smoke.js         builds every preset to PDF/DXF/SVG   (node test/smoke.js out)
```

## Adding a project preset

Copy the `dhaka-l5n` block in `js/presets.js`, give it a new id, edit the values and add it to `TLT.PRESET_LIST`. Or simply keep a saved JSON input file per project.

## Status

Bid-stage tool. Layouts are indicative and must be checked by the responsible engineer before issue.
