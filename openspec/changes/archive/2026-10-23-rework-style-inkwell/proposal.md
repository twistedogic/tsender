# Proposal

## Why
The current stylesheet uses a slate-blue palette with chart strokes and markers
hardcoded as literal hex (`#0b3a5b`, `#777`, `#b91c1c`, `#d97706`). Those literals
ignore `prefers-color-scheme`, sit at ~3:1 contrast on the dark background, and
make both the chart and the muted summary table hard to read. The user wants a
full visual rework — single coherent identity, light/dark parity, all numbers
traceable.

## What Changes

- Replace the slate palette with a paper-and-ink ("Inkwell") system: warm stone
  neutrals (Tailwind `stone-*`, OKLCH) for surfaces, amber for accents, semantic
  red/green for danger/success. Adopt a Primer-shape two-tier token model — a
  raw palette layer (`--stone-50…950`, `--amber-*`, `--red-*`, `--green-*`) and a
  role layer (`--fg-*`, `--bg-*`, `--accent-*`) on top — so a single rule like
  `background: var(--bg-danger-muted); color: var(--fg-danger)` works in either
  theme.
- Wire the chart (`uPlot`) through the same tokens via a 15-line shim: read the
  resolved CSS values with `getComputedStyle`, pass them into
  `series[].stroke`, and rebuild the canvas with `redraw(true)` when the theme
  changes. No new dependency.
- Add a toolbar theme chip with light/dark/system options. System is the
  default; the choice persists in `localStorage`.
- Reshape summary hierarchy: emphasize the two most-important rows (Final cash,
  Minimum cash) using weight + tabular numerals, with color as a secondary
  signal — not the primary one.
- Replace shadow-only panel separation with 1px borders on a slightly-lifted
  panel surface, so cards read on any background and print cleanly.
- Add focus-visible rings, a 4px baseline spacing scale, and `font-variant:
  tabular-nums` on the summary table.
- Title every form field, section, legend, and event-type choice in prose
  instead of exposing scenario keys (`reserve_months`, `annualized_rate`,
  `one_off_expense`), derived mechanically so new event types are readable
  without a hand-maintained label table.
- No new runtime dependency. One CSS rewrite, ~25 lines of TS touched.

## Capabilities

### Modified Capabilities
- `results-display` — extend `Dashboard renders the run summary` to require
  visual hierarchy on key rows (not color-only); extend `Dashboard renders a
  monthly chart` to require AA contrast on chart strokes and markers in both
  light and dark themes.
- `scenario-authoring` — add `Field titles are human-readable`: visible titles
  are derived mechanically from the scenario keys and never display one
  verbatim, while the keys themselves and control values are unaffected.

### New Capabilities
None. A standalone `theme-and-styling` capability is intentionally not created;
visual contracts belong with the capability whose output they describe.

## Impact

| File | Change |
|---|---|
| `src/ui/styles.css` | full rewrite of `:root` + `.theme-dark` token blocks, plus selector updates |
| `src/ui/App.tsx` | theme chip + className toggle, `localStorage` persistence (~10 lines) |
| `src/ui/ResultsChart.tsx` | token-bridge shim + `redraw` effect on theme change (~15 lines) |
| `src/ui/ResultsSummary.tsx` | emphasis on key rows + tabular-nums (~5 lines) |
| `src/ui/labels.ts` | mechanical `snake_case` → prose title helper (~10 lines) |
| `src/ui/ScenarioForm.tsx`, `EventForm.tsx`, `TaxBlockForm.tsx` | titles routed through the helper; `GrowthFields` loses its now-redundant `prefix` prop |
| `openspec/specs/results-display/spec.md` | delta on R1 (hierarchy) and R2 (contrast parity) |
| `openspec/specs/scenario-authoring/spec.md` | delta adding `Field titles are human-readable` |

No dependency changes. No simulator/model changes. Existing fixtures (`fixtures/*.expected.json`) keep passing — the change is purely presentational.
