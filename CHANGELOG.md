# Changelog

Versions follow [Semantic Versioning](https://semver.org/): **MAJOR** for changes that break saved inputs or Excel templates, **MINOR** for new features, **PATCH** for fixes. The version is shown in the app header and on every PDF sheet (`TLT.VERSION` in `js/engine.js`); each release is a git tag `vX.Y.Z`.

## [1.1.0] – 2026-11-02
- **Equipment Inputs:** new **Description** column (full name of the equipment) next to **Equipment** (short form shown inside the boxes on the drawings). Read from / written to the equipment Excel file (header "Description"); older files without it still import.
- Grey suggestions for common short forms (VVVF, APS, HSCB, BCU, CMP, MR, CCD …): double-click an empty cell to take one, or **Fill empty descriptions** for the whole list. Presets and the power-collection template rows come with descriptions.
- **Underframe Layout:** the equipment table on each sheet (PDF / DXF) has a Description column.

## [1.0.0] – 2026-10-31
First version under version control on GitHub. Includes everything developed so far:

- **Step 1 Main Dimensions** – formation with multiple unit factor, product types (Metro, LRV, Mainline EMU/DMU) and templates, car body cross-section (5 CAF standard sections with preview and standing width at a reference height), car body & bogie, doors, HVAC, driver's cab (desk options, co-driver desk, auxiliary desk, GoA4), design speed and aerodynamic nose (mainline), power collection (25 kV / 1500 V / 750 V, pantograph / third rail), windows, windscreen & wipers, front view, interior & seating rules (mainline classes, toilets, vestibules), car variants with per-end settings, Jacobs / centre bogies and suspended modules, load cases; Excel import/export of all main inputs.
- **Step 2 Equipment Inputs** – equipment list from Excel, symbols Auto / Eq. Box / Panto / CCD / HVAC.
- **Step 3 Train Layouts & Capacity** – train formation sheet with front view, car sheets (side, plan, interior), capacity sheet; PDF and DXF.
- **Step 4 Underframe Layout** – underframe and roof plans.
- **Step 5 Weight Cal. (Fixed Tare)** – per car mass and axle load per load case.
- **Step 6 Weight Cal. (Actual Design)** – XYZ weight list, bogie lever rule, Jacobs and suspended modules, axle and wheel loads.
- Presets: Dhaka MRT Line-5N CP-08 and the Metro 6-car, LRV 2-car and Mainline 4-car templates.
