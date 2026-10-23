# Proposal

## Why

The dashboard's only canvas is a `uPlot` chart, and it is the app's most
expensive surface: the sole non-React runtime dependency, ~460 lines of
component plus test, and a requirement set (`results-display`) that the
tooling cannot verify — the end-to-end smoke test renders it blank
(`Path2D is not defined`), so its contrast floor and its "one x-tick per
simulated month" rule are checked by reading CSS by hand rather than by
looking at the thing. On a 320px phone it draws 361 monthly points.

The data the chart draws is already in `RunResult.months`, and a yearly
table shows the same trajectory in a form that prints, scrolls inside its
own column, needs no dependency, and survives grayscale and
`prefers-reduced-motion` for free. The chart is replaced, not merely
dropped: the trajectory stays visible.

## What Changes

- **BREAKING** The dashboard renders a **yearly trajectory table** instead of
  a monthly chart. One row per 12-month bucket from month 0, showing the
  state at that bucket's last month: cash, assets, net worth, and the
  monthly cashflow at that month.
- The chart's vertical markers are relocated into the table: the row whose
  year contains the insolvency, saving-breach, terminal, or
  passive-income-crossing month carries a short note. The existing text
  callouts stay as they are.
- The `Dashboard renders a monthly chart` requirement is removed and
  replaced by `Dashboard renders a yearly trajectory table`. The marker,
  mobile-responsiveness, and dashboard-updates requirements are narrowed to
  the table.
- `uplot` is dropped from `package.json` — the app returns to two runtime
  dependencies (`react`, `react-dom`). The `--chart-cash` / `--chart-assets`
  tokens and the `.results-chart` styles go with it.
- A partial final row is labelled with its month count (`Year 31 · 1 mo`),
  because the default 360-month horizon yields 361 simulated months and a
  death-terminated run usually ends mid-bucket.
- No simulator change. `RunResult.months` still carries the trajectory and
  still feeds the summary, the markers, and the passive-income crossing.

## Capabilities

### New Capabilities

None. The trajectory is an output of the existing `results-display`
capability, so it is specified there rather than in a new capability.

### Modified Capabilities

- `results-display` — replace the requirement `Dashboard renders a monthly
  chart` with `Dashboard renders a yearly trajectory table`; narrow
  `Insolvency, breach, and terminal markers are shown` to text callouts plus
  the table's per-row notes; narrow `Dashboard is mobile-responsive` to the
  table scrolling inside its column; narrow `Dashboard updates when the
  scenario changes` to the table reflecting the latest form state.

## Impact

| File | Change |
|---|---|
| `src/ui/TrajectoryTable.tsx` | new — the yearly table component (~60 lines) |
| `src/ui/format.ts` | new — shared `fmt` number formatter, moved out of `ResultsSummary.tsx` |
| `src/ui/ResultsChart.tsx` | deleted (199 lines) |
| `src/ui/ResultsChart.test.tsx` | deleted (262 lines) |
| `src/ui/App.tsx` | drop the `ResultsChart` import and usage; drop the now-unused `theme` prop on `Results` |
| `src/ui/App.test.tsx` | drop the `uplot` mock; retarget the two theme-ordering tests at the `<html>` attribute |
| `src/ui/ScenarioForm.test.tsx` | drop the `ResizeObserver` mock (only the chart used it) |
| `src/ui/ResultsSummary.tsx` | import `fmt` from `src/ui/format.ts` instead of defining it locally |
| `src/ui/styles.css` | drop `.results-chart` rules and the `--chart-cash` / `--chart-assets` tokens |
| `src/ui/tokens.test.ts` | drop `--chart-cash` / `--chart-assets` from the contrast contract |
| `package.json` | drop the `uplot` dependency |
| `AGENTS.md` | drop the lightpanda `Path2D` caveat from the smoke-test notes |
| `openspec/specs/results-display/spec.md` | delta: chart requirement replaced by the table requirement; three requirements narrowed |

No simulator/model changes, no fixture changes — `fixtures/*.expected.json`
keep passing because `runScenario` and its output are untouched. The
dependency count drops from three runtime packages to two.
