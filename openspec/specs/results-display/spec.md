# results-display Specification

## Purpose

Presents the results of running a `Scenario` as a web dashboard: key-stat summary, monthly chart of cash and assets over the horizon, and passive-income / end-solvency / terminal / insolvency / saving-breach callouts — all responsive on mobile viewports.

## Requirements

### Requirement: Dashboard renders the run summary
The dashboard SHALL display the run's key statistics: `final_cash`, `final_assets_value`, `final_monthly_cashflow`, `min_cash` (and the month it occurred), `first_insolvent_month` (or `never`), and `terminal_month` (or absent). The values SHALL be derived from the `months` array and wrapper fields of capability `simulation-output` for the same run.

#### Scenario: Summary matches JSON output
- **WHEN** the user runs a scenario in the web app
- **THEN** the dashboard summary's numeric fields equal the values in the corresponding `simulation-output` result object

### Requirement: Dashboard renders a monthly chart
The dashboard SHALL render a line chart of `cash` and `assets_value` over the simulated months. The chart SHALL have one x-tick per simulation month up to the horizon (or `terminal_month + 1` when the run terminated early). The chart SHALL reflow on window resize and SHALL remain legible at viewports as narrow as 320px (no horizontal page scroll induced by the chart).

#### Scenario: Chart updates with the scenario
- **WHEN** the user changes a cashflow value in the form
- **THEN** the chart re-renders with the new monthly series within the same UI frame

#### Scenario: Narrow viewport keeps the chart on-screen
- **WHEN** the viewport is 320px wide
- **THEN** the chart's bounding box is ≤ viewport width and no horizontal page scroll is induced

### Requirement: Insolvency, breach, and terminal markers are shown
The dashboard SHALL mark, on the chart and as text callouts above it: the first month `cash < 0` (insolvency, if any), the first month `cash < saving` (saving breach, if a `saving` target is set), the sustained passive-income crossing (`passive_income_month`, when present), and the terminal month (if a `death` event fired). When none of these apply, no marker SHALL be drawn.

#### Scenario: Insolvency marker
- **WHEN** the run goes insolvent at month 47
- **THEN** the chart shows a vertical marker at month 47 and a text callout reads "insolvent from month 47"

#### Scenario: No markers when nothing fires
- **WHEN** the run stays solvent, never breaches saving, never sustains passive-income coverage, and has no `death` event
- **THEN** no markers are drawn

### Requirement: Run outcomes are shown
The dashboard SHALL display two run outcomes as text callouts. First, the sustained passive-income crossing: "passive income covers expenses from month N" using the wrapper's `passive_income_month`, or "passive income never covers expenses" when the key is absent. Second, end solvency: the final month's net worth (`cash + assets_value` from the last `months` entry) with a met indicator when positive and a missed indicator when zero or negative.

#### Scenario: Crossing callout matches the wrapper
- **WHEN** a run's wrapper carries `passive_income_month: 120`
- **THEN** the dashboard shows "passive income covers expenses from month 120"

#### Scenario: Never-crossing callout
- **WHEN** the wrapper omits `passive_income_month`
- **THEN** the dashboard shows "passive income never covers expenses"

#### Scenario: End solvency derives from months
- **WHEN** the last `months` entry has `cash: -50000` and `assets_value: 200000`
- **THEN** the dashboard shows the final net worth 150000 with a met indicator

### Requirement: Dashboard updates when the scenario changes
The dashboard SHALL re-run the simulation and re-render whenever the form state changes, debounced to at most 10 runs per second while the user is typing. A "Run" button SHALL be available to force an immediate re-run on demand.

#### Scenario: Debounced re-run
- **WHEN** the user types rapidly into the `cash` field
- **THEN** the simulation runs at most 10 times per second and the chart reflects the latest form state

#### Scenario: Forced re-run
- **WHEN** the user clicks "Run"
- **THEN** the simulation runs immediately and the dashboard reflects the result without waiting for the debounce window

### Requirement: Dashboard is mobile-responsive
At viewport widths ≤ 640px, the dashboard SHALL present the summary as a vertical stack (one stat per row), the chart full-width, and the run-outcomes callouts full-width. No horizontal page scroll SHALL be induced.

#### Scenario: Narrow viewport stacks the summary
- **WHEN** the viewport is 360px wide
- **THEN** the summary's key stats render as a single column with no horizontal scroll

### Requirement: "Export scenario.yaml" action is available
The dashboard SHALL provide an action that downloads the current scenario as `scenario.yaml` (the YAML accepted by `scenario-loading`). The exported YAML follows the ender-compatible schema by convention; loading equivalence with `ender` is a nicety, not a gated requirement.

#### Scenario: Exported YAML reloads in tsender
- **WHEN** the user clicks "Export scenario.yaml", reloads the page, and imports the exported file via Import YAML
- **THEN** the loaded scenario is equal (per `scenario-loading`'s round-trip) to the one that was exported, and the dashboard renders identical results
