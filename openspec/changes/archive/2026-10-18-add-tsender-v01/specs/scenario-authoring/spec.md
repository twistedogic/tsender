# Spec Delta

## Purpose

Lets users edit a `Scenario` via a typed web form (one subform per event type plus top-level fields and a tax block) and round-trip with the YAML schema defined by capability `scenario-loading`.

## ADDED Requirements

### Requirement: Form round-trips with the canonical YAML schema
The system SHALL provide a form whose in-memory state SHALL serialize to a YAML document that, when loaded by capability `scenario-loading`, produces a `Scenario` with the same cashflows, assets, events, reserve, dates, and tax block. Conversely, loading any YAML accepted by `scenario-loading` and feeding it into the form SHALL produce a form state that re-serializes to a YAML document which, when loaded by `scenario-loading`, produces an equivalent `Scenario`. The form SHALL NOT introduce fields, defaults, or naming choices that diverge from `scenario-loading`'s accepted YAML keys.

#### Scenario: Empty form round-trips
- **WHEN** the user creates a new scenario with `cash: 20000` and no events
- **THEN** the form serializes to a YAML document whose loaded form state produces the same YAML, and that YAML is accepted by `scenario-loading` with cash 20000 and zero events

#### Scenario: Full vocabulary round-trips
- **WHEN** a YAML file with all event types (`job`, `pension`, `expense`, `tuition`, `withdrawal`, `layoff`, `graduate`, `buy_home`, `buy_to_let`, `investment`, `end`, `pay_change`, `refinance`, `downturn`, `one_off_expense`, `one_off_income`, `death`) is loaded into the form
- **THEN** editing nothing and exporting produces a YAML document that loads back to an equivalent `Scenario`

### Requirement: Top-level scenario fields are exposed
The form SHALL expose `cash`, `reserve_months`, `start` (`YYYY-MM`), `end` (`YYYY-MM`), and `saving`. Numeric fields SHALL use `type="number"` with `inputMode="decimal"`; date fields SHALL use `type="month"` with a `YYYY-MM` pattern and placeholder, degrading to a validated text field on browsers without month support (iOS Safari).

#### Scenario: Editing top-level fields re-serializes
- **WHEN** the user sets `cash: 50000`, `reserve_months: 6`, `start: 2026-08`, `end: 2056-08`, and `saving: 100000`
- **THEN** the form serializes to a YAML document whose loaded form state shows the same values

### Requirement: Tax block is exposed as a subform
The form SHALL expose the `tax` block as a subform with `status` (radio: `single` / `married`), `children` (integer, ≥0), and a repeating list of `parents` entries (each with `age_band` radio `60+` or `55-59` and `living_with` boolean). An empty or absent `tax` block SHALL round-trip as absent in the exported YAML.

#### Scenario: Married household round-trips
- **WHEN** the user sets `tax: { status: married, children: 2, parents: [{ age_band: 60+, living_with: false }, { age_band: 60+, living_with: false }] }`
- **THEN** the form serializes to a YAML document whose loaded form state shows the same tax block

### Requirement: Each event type has a dedicated subform
The form SHALL provide one subform per event type supported by `scenario-loading`. The subform for an event SHALL expose exactly the fields accepted by `scenario-loading` for that event type and SHALL NOT introduce extra fields. The subform SHALL validate the same way `scenario-loading` does (e.g., `pension` requires a body; `refinance` requires an `id`; `reserve_months` must be ≥0). Invalid input SHALL be surfaced inline near the offending field and SHALL block export.

#### Scenario: Refinance without id blocks export
- **WHEN** the user adds a `refinance` event without an `id`
- **THEN** the form marks the field invalid and the export action is disabled until the user supplies a non-empty `id`

#### Scenario: Negative reserve blocks export
- **WHEN** the user sets `reserve_months: -1`
- **THEN** the form marks the field invalid and the export action is disabled

### Requirement: Events are ordered and editable as a list
The form SHALL present events as an ordered list sorted by `when` (ties broken by insertion order), editable inline (add, remove, duplicate). Reordering SHALL update `when` values when the user moves a row. Each event row SHALL show its `when`, `type`, and a short label derived from its type-specific fields.

#### Scenario: Adding an event appends to the list
- **WHEN** the user adds a `job` event at `when: 12` with `monthly: 30000, annualized_rate: 0.03`
- **THEN** the event appears in the list as the last entry and the exported YAML contains the event with those fields

### Requirement: Form is mobile-responsive
At viewport widths ≤ 640px, the form SHALL present fields as a single vertical stack with no horizontal scrolling. Tap targets SHALL be ≥ 44px on each axis. Section headers (top-level fields, tax block, each event type's list) SHALL be collapsible on small viewports and expanded on wide viewports.

#### Scenario: Narrow viewport stacks fields
- **WHEN** the viewport is 360px wide
- **THEN** the form's top-level fields render in a single column with no horizontal scroll, and the events list shows one event per row

### Requirement: Form state persists locally
The form SHALL persist its current state to `localStorage` (under a single key) on every change, and SHALL restore from `localStorage` on page load. The persisted state SHALL be ignored if it does not parse to a valid `Scenario`. The form SHALL provide a "reset" action that clears the persisted state.

#### Scenario: Reload restores the form
- **WHEN** the user edits `cash` to 12345, reloads the page, and `localStorage` still has the prior state
- **THEN** the form renders with `cash: 12345`

#### Scenario: Corrupt localStorage is ignored
- **WHEN** `localStorage` contains a string that does not parse to a `Scenario`
- **THEN** the form renders as a fresh empty scenario and does not throw

### Requirement: Import accepts pasted YAML
The form SHALL provide an "Import YAML" action that accepts a pasted YAML string, parses it via the same loader used by `scenario-loading`, and replaces the form state on success. On parse failure, the action SHALL display the error message (including the source slot replaced with "pasted YAML") and SHALL leave the existing form state untouched.

#### Scenario: Import replaces state on success
- **WHEN** the user pastes a valid YAML document into Import and confirms
- **THEN** the form state matches the parsed scenario and the exported YAML matches the input

#### Scenario: Import leaves state on failure
- **WHEN** the user pastes malformed YAML and confirms
- **THEN** the form state is unchanged and an error message identifies the parse failure