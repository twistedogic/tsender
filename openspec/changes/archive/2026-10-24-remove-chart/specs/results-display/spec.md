# Spec Delta

## REMOVED Requirements

### Requirement: Dashboard renders a monthly chart
The dashboard SHALL render a line chart of `cash` and `assets_value` over the simulated months, with one x-tick per simulation month up to the horizon.

**Reason**: The `uPlot` chart was the dashboard's only canvas and the app's only non-React runtime dependency. Its contrast floor and its one-tick-per-month rule could not be verified by the end-to-end smoke test — the canvas renders blank there — and 361 monthly points were unreadable at phone widths. The yearly trajectory table carries the same trajectory in a form that prints, scrolls inside its own column, and needs no dependency.

**Migration**: The trajectory is still shown, in the same panel where the chart stood, as a yearly table. Code referencing `ResultsChart` or the `uplot` package is deleted, and the `--chart-cash` / `--chart-assets` tokens go with it.

#### Scenario: Chart updates with the scenario
- **WHEN** the user changes a cashflow value in the form
- **THEN** the chart re-renders with the new monthly series within the same UI frame

#### Scenario: Narrow viewport keeps the chart on-screen
- **WHEN** the viewport is 320px wide
- **THEN** the chart's bounding box is ≤ viewport width and no horizontal page scroll is induced

#### Scenario: Series remain separable in grayscale
- **WHEN** the chart is rendered with all hues collapsed to a single channel
- **THEN** the `cash` series and the `assets_value` series remain distinguishable from each other

#### Scenario: Chart meets the graphical-object contrast floor in every theme
- **WHEN** the page renders under each supported theme
- **THEN** both series strokes, every axis tick label, and every drawn marker reach a contrast ratio of at least 3:1 against the chart background measured from the resolved color values

## ADDED Requirements

### Requirement: Dashboard renders a yearly trajectory table
The dashboard SHALL render the run's trajectory as a table and SHALL NOT render a chart. The table SHALL have one row per 12-month bucket counted from month 0, plus a final row for any simulated months that remain — a run of 361 simulated months yields 31 rows.

Each row SHALL show the state at that bucket's last month, taken from the `months` array of the run: the month's `cash`, the month's `assets_value`, their sum as net worth, and the month's `monthly_cashflow`. The values SHALL be the same figures the summary and the run-outcome callouts derive from, so the table and the callouts cannot disagree.

Rows SHALL be labelled by their year index (`Year 1` for months 0–11). A row covering fewer than 12 months SHALL carry its month count alongside the label (`Year 31 · 1 mo`), because a run normally ends mid-bucket.

Numeric cells SHALL render with tabular figures so digits align down each column, and SHALL be formatted the same way as the summary's figures.

#### Scenario: One row per simulated year
- **WHEN** a run simulates 361 months (a 360-month horizon)
- **THEN** the table has 31 rows, `Year 1` shows month 11's figures, and `Year 30` shows month 359's figures

#### Scenario: The final row may cover fewer months
- **WHEN** a run is terminated by a `death` event at month 24, so 25 months were simulated
- **THEN** the table has 3 rows, and the third row is labelled with its 1 month

#### Scenario: A row shows that bucket's last month
- **WHEN** month 11 of a run has `cash: 100000`, `assets_value: 50000`, and `monthly_cashflow: 12000`
- **THEN** the `Year 1` row shows cash 100000, assets 50000, net worth 150000, and monthly cashflow 12000

#### Scenario: The trajectory renders without a chart
- **WHEN** the dashboard renders a run
- **THEN** the trajectory is rendered as a table and no chart element is present

## MODIFIED Requirements

### Requirement: Insolvency, breach, and terminal markers are shown
The dashboard SHALL show, as text callouts and as notes on the yearly trajectory table, the first month `cash < 0` (insolvency, if any), the first month `cash < saving` (saving breach, if a `saving` target is set), the sustained passive-income crossing (`passive_income_month`, when present), and the terminal month (if a `death` event fired). The callouts SHALL name the month (for example "insolvent from month 47"), and the note for a marker SHALL appear on the row whose year contains that month. When none of these apply, no callout and no note SHALL be shown.

#### Scenario: Insolvency marker
- **WHEN** the run goes insolvent at month 47
- **THEN** a text callout reads "insolvent from month 47" and the trajectory table's row for the year containing month 47 carries an insolvency note

#### Scenario: Saving breach marker
- **WHEN** the run first drops below its `saving` target at month 96
- **THEN** a text callout names month 96 and the trajectory table's row for the year containing month 96 carries a saving-breach note

#### Scenario: Terminal marker
- **WHEN** a `death` event terminates the run at month 240
- **THEN** a text callout names month 240 and the trajectory table's row for the year containing month 240 carries a terminal note

#### Scenario: No markers when nothing fires
- **WHEN** the run stays solvent, never breaches saving, never sustains passive-income coverage, and has no `death` event
- **THEN** no callout and no note is shown

### Requirement: Dashboard updates when the scenario changes
The dashboard SHALL re-run the simulation and re-render whenever the form state changes, debounced to at most 10 runs per second while the user is typing. A "Run" button SHALL be available to force an immediate re-run on demand.

#### Scenario: Debounced re-run
- **WHEN** the user types rapidly into the `cash` field
- **THEN** the simulation runs at most 10 times per second and the yearly trajectory table reflects the latest form state

#### Scenario: Forced re-run
- **WHEN** the user clicks "Run"
- **THEN** the simulation runs immediately and the dashboard reflects the result without waiting for the debounce window

### Requirement: Dashboard is mobile-responsive
At viewport widths ≤ 640px, the dashboard SHALL present the summary as a vertical stack (one stat per row), the yearly trajectory table full-width, and the run-outcomes callouts full-width. When the trajectory table's columns do not fit the viewport, the table SHALL scroll horizontally within its own column. No horizontal page scroll SHALL be induced.

#### Scenario: Narrow viewport stacks the summary
- **WHEN** the viewport is 360px wide
- **THEN** the summary's key stats render as a single column with no horizontal scroll

#### Scenario: The table scrolls inside its column, not the page
- **WHEN** the viewport is 320px wide and the trajectory table's columns do not fit
- **THEN** the table scrolls horizontally within its own column and the page does not scroll horizontally
