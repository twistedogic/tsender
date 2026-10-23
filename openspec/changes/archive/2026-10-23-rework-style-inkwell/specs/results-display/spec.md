# Spec Delta

## MODIFIED Requirements

### Requirement: Dashboard renders the run summary
The dashboard SHALL display the run's key statistics: `final_cash`, `final_assets_value`, `final_monthly_cashflow`, `min_cash` (and the month it occurred), `first_insolvent_month` (or `never`), and `terminal_month` (or absent). The values SHALL be derived from the `months` array and wrapper fields of capability `simulation-output` for the same run.

Numeric values SHALL render with tabular figures so digits align in columns across rows. Stat rows SHALL establish hierarchy through typographic weight and scale before color, so that the terminal cash figure and the minimum-cash figure remain distinguishable from the supporting statistics without relying on a color difference alone.

#### Scenario: Summary matches JSON output
- **WHEN** the user runs a scenario in the web app
- **THEN** the dashboard summary's numeric fields equal the values in the corresponding `simulation-output` result object

#### Scenario: Key statistics are distinguishable without color
- **WHEN** the summary renders with the two highest-severity figures (`final_cash`, `min_cash`)
- **THEN** those rows are visually distinguished by typographic weight or scale rather than by a color swap alone, and remain distinguishable when the page is rendered in grayscale

### Requirement: Dashboard renders a monthly chart
The dashboard SHALL render a line chart of `cash` and `assets_value` over the simulated months. The chart SHALL have one x-tick per simulation month up to the horizon (or `terminal_month + 1` when the run terminated early). The chart SHALL reflow on window resize and SHALL remain legible at viewports as narrow as 320px (no horizontal page scroll induced by the chart).

Both series SHALL be drawn with strokes that are distinguishable from each other by a means other than hue alone (line style, weight, or luma), so the two series remain separable under dichromatic vision and in grayscale rendering. Every drawn element — both series strokes, all axis tick labels, and all vertical markers — SHALL reach a contrast ratio of at least 3:1 against the chart's background. Axis tick labels and marker strokes are graphical objects rather than body text and are therefore held to the 3:1 graphical-object threshold rather than the 4.5:1 text threshold.

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