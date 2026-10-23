# Design

## Context

The dashboard's results panel currently renders, top to bottom: a stats
table (`ResultsSummary`), a `uPlot` canvas (`ResultsChart`), a list of text
callouts for markers, and the run-outcome callouts (`RunOutcomes`).

The trajectory the chart draws is `RunResult.months` — an array of
`{month, cash, assets_value, monthly_cashflow}`, one entry per simulated
month. It is already consumed by the summary, the marker callouts, and the
passive-income crossing, so nothing new has to be computed by the
simulator; this change only changes how the trajectory is *rendered*.

Constraints that shape the approach:

- `runScenario` and its output are untouched — `fixtures/*.expected.json`
  must keep passing unchanged.
- The results panel sits in a two-column grid (`minmax(0, 1.1fr)` editor,
  `minmax(0, .9fr)` results) that collapses to one column below 900px, and
  the app must stay free of horizontal page scroll down to 320px.
- `results-display` requires numeric output to use tabular figures and to
  be distinguishable without relying on colour alone.
- `openspec/specs/scenario-loading/spec.md` makes `start` optional and
  informational: the run's month 0 has no calendar anchor unless the user
  supplied one.

See `proposal.md` for the motivation and `specs/results-display/spec.md` for
the behaviour this design implements.

## Goals / Non-Goals

**Goals:**

- The trajectory stays visible after the chart is gone.
- The results panel gains no runtime dependency and no canvas.
- Every number in the table is derivable from `RunResult.months` alone, so
  the table and the callouts cannot disagree.
- The chart's marker capability survives in the place where the numbers
  are, not only in a callout above them.

**Non-Goals:**

- Monthly granularity. The table samples one row per year; it does not try
  to show every month.
- Any change to `runScenario`, `RunResult`, the scenario shape, or the
  simulator's money flow.
- A responsive/mobile redesign of the results panel beyond replacing the
  chart's box with the table's box.
- Exporting the table. If the trajectory is to leave the app, that is a
  separate change (see `proposal.md`'s notes on scenario serialization).

## Decisions

### Rows are 12-month buckets from month 0; each row shows its last month

Month 0 anchors the run, so buckets are `[0..11]`, `[12..23]`, … and a
final bucket holding whatever months remain. Each row reports the state at
its bucket's **last** month, so cash, assets, net worth, and the monthly
flow are four readings of the same instant and cannot disagree with each
other.

*Alternative — sample from the end of the run backwards* so the last row is
always full: rejected. It makes the first row partial instead of the last,
and users read a trajectory forwards; a short final row is also the honest
picture of a run that ended early.

*Alternative — one row per calendar year, using `start`*: rejected. `start`
is optional, so calendar labels would be unavailable for any scenario that
omits it, and the table would need two label schemes.

### Rows are labelled `Year N`; a short final row carries its month count

`Year 1` is months 0–11. A row covering fewer than 12 months is labelled
`Year 31 · 1 mo`. This case is the norm, not an edge case: the default
360-month horizon simulates 361 months (30 full rows plus one month), and a
death-terminated run usually ends mid-bucket.

*Alternative — label rows by their last month (`m360`)*: rejected. It is
unambiguous but reads as a data dump; the year index is what a user scans
for ("which year do I run out of money"). The month count in the suffix
removes the ambiguity the year index would otherwise create.

### The chart's vertical markers become notes on the row that fired them

A marker month `m` belongs to the row for year `floor(m / 12) + 1`. That
row's Notes cell carries a short tag: `insolvent`, `saving breached`,
`terminal`, or `passive covers`. Only the row where the marker *fires* is
noted — insolvency persists afterwards, but noting every later year would
mean the same tag on every row, which is noise.

The existing text callouts stay, unchanged, and remain the authoritative
statement of the exact month. The table note says *which year*.

*Alternative — drop the Notes column and rely on the callouts alone*:
rejected. The chart's markers were the one place where the "when" sat next
to the numbers; keeping the notes preserves that, at the cost of one cell.

### Net worth and monthly flow are defined to match what already exists

Net worth is `cash + assets_value` — the same expression the end-solvency
callout uses, so the table's last row and the callout cannot disagree.
Monthly flow is the bucket's last month's `monthly_cashflow` — the same
figure the summary labels "Final monthly cashflow" — which reads as a run
rate at year end.

*Alternative — the year's total flow, or its average*: rejected. A sum is
not comparable with a monthly figure, and an average hides the run rate a
retiree actually needs. The summary already reports a point-in-time flow;
the table stays consistent with it.

### One shared number formatter

`ResultsSummary` already formats money with
`Intl.NumberFormat("en-HK", { maximumFractionDigits: 0 })`. That moves to
`src/ui/format.ts` and is imported by both the summary and the table, so
the two panels cannot drift apart. Both use `font-variant-numeric:
tabular-nums` so digits align down the column.

### The table is a plain `<table>` in a scroll container

The wrapper carries `overflow-x: auto`, so at 320px the table scrolls inside
its own column and the page does not. The wrapper also caps its height
(`max-height` with `overflow-y: auto`) so a 90-year run does not push the
run-outcome callouts off the screen; the table stays inside the results
panel and the panel scrolls.

### Deleting uPlot touches more than the component

Removing the chart removes the app's only canvas, so the following go with
it, not as optional cleanup:

- `uplot` from `package.json` (the only non-React runtime dependency).
- The `--chart-cash` and `--chart-assets` tokens from `styles.css`, and
  their entries in `tokens.test.ts`'s contrast contract — they exist only
  to colour the chart.
- The `uplot` mock in `App.test.tsx` and the `ResizeObserver` mock in
  `ScenarioForm.test.tsx` (only the chart needed them).
- The `theme` prop on `App.tsx`'s `Results` component, which existed only
  to restyle the canvas. `applyTheme` stays: it sets the `<html>`
  attribute that drives the CSS custom properties the rest of the app
  uses, and the two theme-ordering tests in `App.test.tsx` are retargeted
  at that attribute rather than at the canvas.

### The row builder is a pure function

`TrajectoryTable.tsx` exports a pure `yearRows(months)` that turns
`MonthResult[]` into the row objects, plus the component that renders
them. The arithmetic — bucketing, the last month of each bucket, the
partial-row month count, the marker-to-row mapping — is testable without
a DOM, and the component test only has to check that the rows reach the
screen.

## Risks / Trade-offs

- **Intra-year detail is lost.** A dip in month 3 that recovers by month 11
  is invisible in the table. → The `min_cash` statistic still reports the
  worst balance and its month, and the callouts still name the exact
  insolvency and breach months, so the two events that matter most remain
  visible at month resolution. Accepting this is the point of the change:
  one readable row per year beats 361 unreadable points.
- **The final row is usually short.** 361 simulated months means 31 rows
  with a 1-month row at the end. → The month-count suffix states it on the
  row itself; the table is not left to imply a full year.
- **Six columns at 320px.** → `overflow-x: auto` on the wrapper keeps the
  page itself free of horizontal scroll, which is what the requirement
  actually constrains.
- **A long horizon makes a long table.** → The wrapper caps its height and
  scrolls vertically, so the run-outcome callouts stay reachable.
- **Losing the chart removes a contrast requirement that was hard to
  verify anyway.** → The removed requirement's scenarios disappear with it;
  `tokens.test.ts` keeps enforcing ≥4.5:1 for the remaining tokens, which
  it can check by reading the stylesheet.
