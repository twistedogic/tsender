# Tasks

## 1. Row builder (pure function)

- [x] 1.1 Write a failing test in `src/ui/TrajectoryTable.test.tsx` for an exported `yearRows(months)`: a run of 361 simulated months yields 31 rows, `Year 1` carries month 11's `cash` / `assets_value` / `monthly_cashflow`, and `Year 30` carries month 359's. Verify the test fails because the module does not exist yet.
- [x] 1.2 Implement `yearRows(months)` in `src/ui/TrajectoryTable.tsx`: bucket the months into 12-month groups from month 0, take each bucket's last month as the row's figures, and label the row `Year N`. Verify 1.1 passes.
- [x] 1.3 Extend the test to the short final row: a 25-month run yields 3 rows and the third is labelled with its 1 month; a 1-month run yields a single row. Verify the new cases pass.
- [x] 1.4 Extend the test to the marker mapping: given `insolvent`, `savingBreach`, `terminal`, and `passiveIncome` months, each marker lands as a note on the row whose year contains that month and on no other row. Verify the new cases pass.

## 2. The table component

- [x] 2.1 Write a failing component test that renders `TrajectoryTable` and asserts a header row (`Year`, `Cash`, `Assets`, `Net worth`, `Monthly flow`, `Notes`), one row per year, and a net worth equal to `cash + assets_value`. Verify it fails.
- [x] 2.2 Implement the `TrajectoryTable` component rendering the rows from `yearRows`, with the marker notes in the last cell. Verify 2.1 passes.
- [x] 2.3 Move the number formatter out of `ResultsSummary.tsx` into `src/ui/format.ts` and import it from both `ResultsSummary` and `TrajectoryTable`. Verify both suites pass and the summary's rendered numbers are unchanged.

## 3. Styles

- [x] 3.1 Add `.trajectory-table` styles in `src/ui/styles.css`: the wrapper scrolls horizontally within its own column (`overflow-x: auto`), caps its height and scrolls vertically, the numeric cells use `font-variant-numeric: tabular-nums`, and the Notes cell uses the muted foreground token. Verify with a test that reads `styles.css` and asserts the wrapper's `overflow-x: auto` and `max-height` rules exist.

## 4. Dashboard wiring

- [x] 4.1 Render `TrajectoryTable` in `App.tsx` in the slot the chart occupied, passing `result.months` and the marker months. Verify an `App` test asserts the trajectory table is on the page.
- [x] 4.2 Pass `result.passive_income_month` into the table so the passive-income crossing is noted on its row. Verify the test asserts the note appears on the row for the crossing's year.
- [x] 4.3 Drop the `theme` prop from `App.tsx`'s `Results` component and its call site; it existed only to restyle the canvas. Verify the app still compiles and the theme toggle tests pass.

## 5. Remove the chart

- [x] 5.1 Delete `src/ui/ResultsChart.tsx` and `src/ui/ResultsChart.test.tsx`, and remove the `ResultsChart` import and usage from `App.tsx`. Verify `grep -rn "ResultsChart" src/` returns nothing.
- [x] 5.2 Remove the `uplot` mock and the `constructed` array from `App.test.tsx`, and retarget the two theme-ordering tests at the `<html>` `data-theme` attribute instead of the canvas paint order. Verify the App suite passes.
- [x] 5.3 Remove the `ResizeObserver` mock from `src/ui/ScenarioForm.test.tsx` — only the chart used it. Verify the form suite passes without it.
- [x] 5.4 Remove the `.results-chart` rules and the `--chart-cash` / `--chart-assets` tokens from `src/ui/styles.css`, and drop those two tokens from the contrast contract in `src/ui/tokens.test.ts`. Verify the token suite passes and `grep -rn "chart-cash" src/` returns nothing.
- [x] 5.5 Drop `uplot` from `package.json` and run `npm install`. Verify `npm run build` succeeds and the built bundle no longer contains uPlot code.
- [x] 5.6 Update `AGENTS.md`'s end-to-end smoke section: remove the lightpanda `Path2D is not defined` caveat and the chart-specific checks, keeping the heading, cash-field, final-cash, and run-outcomes checks. Verify the file no longer mentions the chart.

## 6. Verification

- [x] 6.1 Run `npm test` and `npm run test:scenarios`; verify both are green and all seven fixtures still match (`runScenario` is untouched).
- [x] 6.2 Run `npm run typecheck` and `npm run build`; verify both are clean.
- [x] 6.3 Manual smoke: serve the production build and fetch it with lightpanda; verify the heading `tsender`, the populated cash spinbutton, the final-cash figure, and the yearly trajectory table are present, and that no canvas element is rendered.
