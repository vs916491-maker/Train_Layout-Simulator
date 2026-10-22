# Train Layout Generator

A browser tool that draws a metro train's vehicle layout, interior seat layouts and passenger capacity from a set of inputs, and exports them as a multi-page **PDF** and a CAD-ready **DXF**.

It is plain HTML + JavaScript. There is nothing to install and no server: open it in Chrome or Edge, including on a locked-down work laptop.

## Workflow — six steps

| Step | Tab | What you do / get |
|---|---|---|
| 1 | **Main Dimensions** | Project and title block, product type and template, formation and number of car variants, power collection, car body and bogie, door system, HVAC, interior rules, one card per car variant (incl. END 1 / END 2 ends and supports), load cases. Ends with **Next**. |
| 2 | **Equipment Inputs** | Equipment list for **layout only** (positions and sizes of underframe and roof boxes), from Excel or edited in the table. **Generate Results** builds steps 3–5. |
| 3 | **Train Layouts & Capacity** | Train layout, one interior layout per car variant, passenger capacity calculation (uses the tare typed in step 1). |
| 4 | **Underframe Layout** | Per car variant: side elevation, roof plan (when the car has roof equipment), underframe plan with X from car centre, equipment table. Any roof or underframe row added in step 2 appears on these sheets and on the train and car layouts. |
| 5 | **Weight Cal. (Fixed Tare)** | Fixed (target) tare per car variant, passenger mass, axle-load limit and the load cases to calculate. Per car in the formation: car mass = tare + passengers × passenger mass; axle load = car mass ÷ axles of the car (equipment distribution not known; shared Jacobs bogie = 1 axle per car, suspended module half to each neighbour). Train totals and axle-load check; values to one decimal. Sheet as PDF / DXF. |
| 6 | **Weight Cal. (Actual Design)** | Separate weight list per car (Location, Item, L/W/H, X/Y/Z, Mass) entered in the table or uploaded from its own Excel file; **Add line item**; **Copy equipment from step 2**. Results: car body (sprung) and bogie (unsprung) mass, calculated vs target tare, CoG X/Y/Z, support / axle / wheel loads per load case, train bogie table including shared Jacobs bogies, axle-load and wheel-load-imbalance checks. Weight sheets as PDF / DXF. |

If inputs change after generating, steps 3–5 show a **Generate again** banner.

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

**Interior items** (per car variant) — added with the buttons on each card:

| Item | Settings | Effect |
|---|---|---|
| Wheelchair space | Bay, side (A / B / A+B), placement | Size from Interior rules (default 1300 × 700). Seats fill the rest of the bay. The Ø1500 turning circle is placed clear of seats and cabinets; a warning appears if that is not possible. |
| Electrical cabinet | Bay, side, placement, label, length, depth, height | Drawn with label and L × D × H on the layout, listed on the sheet, removed from the standing area; seats fill the rest of the bay. |
| Seat limit / No seats | Bay, side, max seats | Caps the seats on that bay side. |

Placement: next to the door (default), END 1 side, middle or END 2 side of the bay. Bays are numbered B0 … Bn from END 1 (B0 is between the cab / end wall and the first door); the bay list in each item shows the bay lengths. Side A is the top of the plan view. Older input files with text bay rules (`1 A wheelchair`) are converted automatically.

### Main inputs from Excel (step 1)

**Import / export main inputs (Excel)** at the top of step 1: **Download main-inputs template** writes one workbook filled with the current inputs — *Parameters* (Section, Parameter, Value, Unit, Allowed values, Key), *Car variants* (one row per variant), *Interior items*, *Load cases* and an *Instructions* sheet with the allowed values. Importing the workbook **replaces all step-1 inputs** (variants, interior items and load cases not in the file are removed); **Undo** in Train formation restores the previous inputs. Equipment (step 2) and design weight lists (step 6) keep their own Excel files.

### Product types and templates

**Train formation → Product type**: Metro, LRV or Mainline EMU / DMU. The product type switches the relevant inputs (mainline interior only for Mainline). **Load template** replaces all inputs (all steps) with an example of that type (Undo restores the previous inputs):

| Template | Formation | Shows |
|---|---|---|
| Metro — 6-car, 25 kV | `DM-T-M \| M'-T'-DM'` (3-car basic unit) | 2 bogies per car, gangways, 2 HVAC per car, 25 kV pantograph + main transformer on the T cars |
| LRV — 2-car | `A-B'` | double-ended, motor bogies at the cab ends, trailer Jacobs bogie under the joint, 750 V DC pantograph on car A |
| Mainline EMU — 4-car, 25 kV | `DM-T-M-T` | 1st / standard class, toilets, vestibules, pantograph + main transformer on the T cars |

Template values are indicative; replace them with project data.

### Car ends and running gear (per car variant)

* **END 1 / END 2 type**: driving cab, auxiliary driving desk, gangway to the next car, end wall (no gangway) or articulation joint. Cabs at both ends give a double-ended car; an END 2 cab is drawn turned round. The auxiliary desk (size and side in the Driver's cab card) is placed against the end wall and taken out of the seats and standing area.
* **Support per end**: own bogie, shared (Jacobs) bogie at the joint, or no bogie (cab overhang, or carried by the articulation). **Centre bogie** puts one bogie under the car centre (tram bogie module). A car with no bogie is a **suspended module**.
* **Motor bogies**: 0, 1 (END 2 side), 1 (END 1 side), 2 or 3.
* Axles per car come from the running gear (a shared bogie counts as one axle per car). Weights: two bogies share the body load by the lever rule; one bogie carries the whole module; a suspended module's load goes to its two joints and on to the neighbouring modules' bogies.

### Power collection

**Per car variant** table: pantographs per car (target, checked against the PAN… rows of the equipment list; blank = no check) and CCD shoes per car (total on both sides, placed on the bogies from END 1), with per-train totals. Supply 25 kV AC, 1500 V DC or 750 V DC; collection by pantograph, third rail (CCD shoe gear, top / bottom / side contact) or both (DC). Checks: pantograph per unit, maximum pantographs per train, 25 kV main transformer and VCB present, third-rail shoe span of the train and of each unit against the longest conductor-rail gap. **Add … equipment** adds the typical collection equipment to the equipment and weight lists (typical masses, to be replaced). Shoe gear is drawn on the bogies, and the conductor rail in the front view.

### Mainline interior (Mainline EMU / DMU only)

* Seat rows across the car: standard and 1st class abreast (2+2, 2+1, 3+2 …), seat pitch, facing bays or airline rows, 1st class seat width.
* Class per car variant: standard, 1st, or 1st class from END 1 for a given length then standard.
* Vestibules at the doors (length, internal door width), with partitions; extended to the end wall when less than 1200 mm would remain. Vestibule floor counts as standing area.
* Toilets (standard / PRM, length × depth) as interior items, with a passage check against the minimum aisle.

### Driver's cab, windows, front view

* **Driver's cab** (shown when a variant has a cab): side desk (on side A or B, observer seat opposite) or central desk (driver seat centred; the detrainment door moves towards side A). **GoA4** removes the cab back wall, the cab-to-saloon door and the driver seat; only a covered front console (depth input) remains and the rest of the cab floor counts as standing area.
* **Windows**: per bay type (between doors / end bays) single, two or no windows; window width, height and sill; drop-down (hopper) windows in end bays or all; windows in the door leaves with their own size.
* **Seats between doors** (per car variant): Auto, or a fixed 5 … 9-seater. With a fixed count the door clearance shrinks to fit, down to *Min. door clearance* (Interior rules); below that the tool warns. The card shows how many seats fit.
* **Front view** on sheet 1: wipers (0–3, single or pantograph arm), detrainment door, windscreen, head / tail lights, destination display, coupler, rails and a simplified vehicle gauge outline.

### Equipment Excel file

One sheet (named `Equipment`, or the first sheet) with a header row. Column order does not matter; headers are recognised by name.

| Column | Meaning |
|---|---|
| Car Type | Car variant name, e.g. `Tc`, `M1`, `M2` |
| Category | `Equipment` (drawn on the layouts) or `Mass item` (carbody, bogies, cables & cabinets, piping, ceiling, floor, seats, doors, … `Other items` last) |
| Equipment / Item | Name shown on the drawing or in the weight list |
| Location | `Underframe` or `Roof` |
| Length (mm) / Width (mm) / Height (mm) | Box size; underframe height is measured down from the mounting face, roof height up from the roof |
| X from car centre (mm) | Equipment centre, **+ towards END 1** |
| Y from centre line (mm) | Equipment centre, **+ towards side A** |
| Mass (kg) | Used for tare mass, centre of gravity and axle loads |
| Symbol | Optional `Auto`, `Eq. Box`, `Panto`, `CCD` or `HVAC` (Auto: roof rows starting PAN = Panto, AC / HVAC = HVAC; underframe rows starting CCD = CCD; else Eq. Box). CCD rows give the shoe positions of that car (otherwise the shoes per car in Power collection are placed on the bogies). |

The template you download contains the current list, so you can edit it and upload it again. CSV files with the same columns are also accepted.

### Design weight calculation (step 6)

Weight Excel file (separate from the equipment file), one sheet:

| Column | Meaning |
|---|---|
| Car Type | Car variant name |
| Location | `Car body`, `Roof`, `Interior`, `UF`, `Cab`, `End` or `Bogie` |
| Item | e.g. Carbody shell, Seats, VVVF, Bogie END 1 … `Other items` last |
| Length / Width / Height (mm) | Optional size |
| X from car centre (mm) | Item CoG, + towards END 1 |
| Y from centre line (mm) | Item CoG, + towards side A |
| Z above rail (mm) | Item CoG height above top of rail; blank = default for the location |
| Mass (kg) | Item mass |

Method:

* Car body mass = all rows except `Bogie`; bogie rows sit directly on the nearest support.
* Supports: own bogie at ± half the bogie centres, or a shared (Jacobs) bogie at the car end. Adjacent shared ends in the formation are merged into one bogie; enter a shared bogie's mass on one car only (the tool warns if it is entered twice).
* Passengers (step 1 load cases) are placed at the seat centroid and the standing-area centroid.
* Car-body reactions from the body CoG; bogie load = reaction(s) + bogie rows; axle load = bogie load ÷ 2.
* Wheel load imbalance = deviation of the wheel load from half the axle load, from the lateral moment and the wheel load spacing (default 1500 mm); checked against the limit (default 15 %).

### Capacity rules

* Seats are fitted per bay: available length = bay length − clearance at each door (draft screen) / end wall, divided by seat width.
* Standing area = saloon floor (interior width × length between end walls or cab partition) minus seats, the foot zone in front of longitudinal seats, cubicles, and the wheelchair space if it is not counted as standing.
* The standees target per car variant is checked at the load case you choose in Load cases & mass (or not at all). Load cases are either *seated only*, a *density* (pax/m²) or a *factor* of another case (e.g. TPN = 1.8 × AW2).
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
js/presets.js         input presets (Dhaka MRT Line-5N CP-08) and product templates (metro, LRV, tram, mainline EMU)
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
