# scenario-authoring Specification

## Purpose
Lets users edit a `Scenario` via a typed web form (one subform per event type plus top-level fields and a tax block). The form state is the scenario object; there is no serialization.

## Requirements

### Requirement: Form edits the typed Scenario object
The system SHALL provide a form whose in-memory state is the `Scenario` object consumed by `runScenario` (capability `scenario-loading`). Editing any field SHALL produce a new `Scenario` with the same events, assets, reserve, dates, and tax block except for the edited field. The form SHALL NOT introduce fields, defaults, or naming choices that diverge from `scenario-loading`'s scenario object keys.

#### Scenario: Empty form yields a minimal scenario
- **WHEN** the user creates a new scenario with `cash: 20000` and no events
- **THEN** the form state is a scenario object with cash 20000 and an empty event list, and running it behaves identically to any other scenario with those values

#### Scenario: Full vocabulary is editable
- **WHEN** a scenario with all event types (`job`, `pension`, `expense`, `tuition`, `withdrawal`, `layoff`, `graduate`, `buy_home`, `buy_to_let`, `investment`, `end`, `pay_change`, `refinance`, `downturn`, `one_off_expense`, `one_off_income`, `death`) is loaded into the form
- **THEN** every event renders in its type-specific subform and editing nothing leaves the scenario unchanged

### Requirement: Top-level scenario fields are exposed
The form SHALL expose `cash`, `reserve_months`, `start` (`YYYY-MM`), `end` (`YYYY-MM`), and `saving`. Numeric fields SHALL use `type="number"` with `inputMode="decimal"`; date fields SHALL use `type="month"` with a `YYYY-MM` pattern and placeholder, degrading to a validated text field on browsers without month support (iOS Safari).

#### Scenario: Editing top-level fields re-serializes
- **WHEN** the user sets `cash: 50000`, `reserve_months: 6`, `start: 2026-08`, `end: 2056-08`, and `saving: 100000`
- **THEN** the form state carries those values and the next run uses them

### Requirement: Tax block is exposed as a subform
The form SHALL expose the `tax` block as a subform with `status` (radio: `single` / `married`), `children` (integer, ≥0), and a repeating list of `parents` entries (each with `age_band` radio `60+` or `55-59` and `living_with` boolean). An empty or absent `tax` block SHALL stay absent from the scenario.

#### Scenario: Married household round-trips
- **WHEN** the user sets `tax: { status: married, children: 2, parents: [{ age_band: 60+, living_with: false }, { age_band: 60+, living_with: false }] }`
- **THEN** the form state carries exactly that tax block and the allowance derived from it applies to the next run

### Requirement: Each event type has a dedicated subform
The form SHALL provide one subform per event type supported by `scenario-loading`. The subform for an event SHALL expose exactly the fields `scenario-loading` defines for that event type and SHALL NOT introduce extra fields. Required fields (e.g. `refinance` requires an `id`, `end` requires an `id`) SHALL use browser-native validation surfaced inline near the field.

#### Scenario: Refinance without id blocks export
- **WHEN** the user adds a `refinance` event without an `id`
- **THEN** the id field is flagged invalid inline (browser-native required validation); there is no export action to block

#### Scenario: Negative reserve blocks export
- **WHEN** the user sets `reserve_months` to a negative value
- **THEN** the number input constrains stepping to its `min` of 0; a typed negative value is not blocked — the simulator treats a non-positive reserve as absent (see `scenario-loading`)

### Requirement: Events are ordered and editable as a list
The form SHALL present events as an ordered list sorted by `when` (ties broken by insertion order), editable inline (add, remove, duplicate). Reordering SHALL update `when` values when the user moves a row. Each event row SHALL show its `when`, `type`, and a short label derived from its type-specific fields.

#### Scenario: Adding an event appends to the list
- **WHEN** the user adds a `job` event at `when: 12` with `monthly: 30000, annualized_rate: 0.03`
- **THEN** the event appears in the list as the last entry and the scenario object carries the event with those fields

### Requirement: Form is mobile-responsive
At viewport widths ≤ 640px, the form SHALL present fields as a single vertical stack with no horizontal scrolling. Tap targets SHALL be ≥ 44px on each axis. Section headers (top-level fields, tax block, each event type's list) SHALL be collapsible on small viewports and expanded on wide viewports.

#### Scenario: Narrow viewport stacks fields
- **WHEN** the viewport is 360px wide
- **THEN** the form's top-level fields render in a single column with no horizontal scroll, and the events list shows one event per row

### Requirement: Form state persists locally
The form SHALL persist its current state to `localStorage` (under a single key) as JSON on every change, and SHALL restore from `localStorage` on page load. The persisted state SHALL be ignored if it does not parse to a scenario-shaped object; in particular, state persisted by earlier YAML-based versions SHALL be ignored rather than migrated. The form SHALL provide a "reset" action that replaces the current state with a fresh scenario.

#### Scenario: Reload restores the form
- **WHEN** the user edits `cash` to 12345, reloads the page, and `localStorage` still has the prior state
- **THEN** the form renders with `cash: 12345`

#### Scenario: Corrupt localStorage is ignored
- **WHEN** `localStorage` contains a string that does not parse to a scenario-shaped object
- **THEN** the form renders as a fresh default scenario and does not throw
