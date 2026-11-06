# FinDeependence UI — use for every page, app, report and artifact

Always brand as **FinDeependence**, with the round logo (`site/logo_circle.png`) and **"Created by CA Deep Dalal"**.

- **Header:** navy band `#0E2740`, round logo on a white circle with a teal ring, mono label "FinDeependence" in `#7FD3D6`, byline "CA Deep Dalal · Chartered Accountant · Fund Manager".
- **Colours (light):** bg `#F6F2E8`, surface `#FFFFFF`, ink `#14273D`, muted `#5D6B7A`, line `#E2DACA`, chip `#EAE3D2`, navy `#0E2740`, green `#3C9A08` (primary buttons, active tab), teal `#2C8F93`, pen blue `#1D5FA8`.
- **Colours (dark):** bg `#0B1B2C`, surface `#122840`, ink `#EEF3F7`, muted `#9FB0C2`, line `#23405F`, navy `#06121F`, green `#5FC22A`, teal `#7FD3D6`, chip `#1B3553`.
- **Chart categories (validated for colour-blind safety):** Retail `#C47A00` / dark `#BA7E10`, sHNI `#14979C` / `#009490`, bHNI `#1D5FA8` / `#6C7FF0`, 4th `#3C9A08` / `#4B9C1E`.
- **Type:** Bricolage Grotesque 800 headings, Inter body, JetBrains Mono 700 uppercase labels; mono for numbers.
- **Shapes:** panels 14px radius with 1px line border; pills 5px radius, mono, uppercase.
- **PDF / Excel exports:** navy title band with "FINDEEPENDENCE" + "Created by CA Deep Dalal", navy table headers, chip-coloured total rows.

## Code map
- `site/js/calc.js` — SEBI lot sizes, allotment probability, deal settlement maths (tested in `test/calc.test.js`).
- `site/js/parse.js` — ipopremium.in list + IPO page parser (shared by app, bookmarklet and sync).
- `site/js/merge.js` — merges IPO records from sources. `scripts/sync.js` + `src/sources.js` — GitHub Actions sync.
- Data (investors, PANs, deals) stays in the browser's localStorage; never commit it.
