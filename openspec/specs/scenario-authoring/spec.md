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

For an event type that addresses an already-created item — `layoff`, `graduate`, `end`, `refinance`, `pay_change` — the `id` SHALL be presented as a choice among the items active at that event's month rather than as free text, per the requirement below. An event type that creates an item SHALL keep a free-text field for the item's `id`, presented as that item's name.

#### Scenario: Refinance without id blocks export
- **WHEN** the user adds a `refinance` event without an `id`
- **THEN** the id field is flagged invalid inline (browser-native required validation); there is no export action to block

#### Scenario: Negative reserve blocks export
- **WHEN** the user sets `reserve_months` to a negative value
- **THEN** the number input constrains stepping to its `min` of 0; a typed negative value is not blocked — the simulator treats a non-positive reserve as absent (see `scenario-loading`)

#### Scenario: A targeting event offers a choice rather than a text box
- **WHEN** the form renders an `end` event
- **THEN** the event's `id` is a select listing the items active at that month, not a free-text input

### Requirement: Targeting events choose from items active at their month
For an event that addresses an already-created item, the form SHALL offer exactly the items that are active at that event's month, where an item is active when a defining event at or before that month named it and no earlier event of the same or an earlier month consumed it. Events at the same month SHALL be ordered so that a defining event precedes a targeting event that consumes it.

Candidates SHALL be restricted to the kinds the event can actually address, matching the simulator's resolution: `pay_change` addresses salaries only; `refinance` addresses property mortgages only; `end` addresses every kind; `layoff` and `graduate` address any created item.

When no item is active, the select SHALL be disabled and SHALL present no selectable choice, so an `end` or `refinance` — whose `id` is required — cannot be added as a target that the simulator would resolve to a no-op.

An `id` already held by the event that the candidate list does not contain SHALL remain present as an option. A scenario restored from `localStorage` SHALL NOT be rewritten by candidate selection.

#### Scenario: A later event does not offer an item that does not exist yet
- **WHEN** a `job` event named "main job" starts at month 12 and a `layoff` event sits at month 6
- **THEN** the layoff's choices do not include "main job"

#### Scenario: An already-ended item drops out of later choices
- **WHEN** an `expense` event named "school" starts at month 0 and an `end` event targeting "school" fires at month 24
- **THEN** an `end` event at month 36 does not offer "school"

#### Scenario: Choices are filtered to what the event can address
- **WHEN** a `pay_change` event sits at month 30 and a named salary and a named rent are both active
- **THEN** the pay_change offers the salary and not the rent

#### Scenario: An event with nothing to target cannot be added
- **WHEN** no item is active at a given month
- **THEN** an `end` event at that month presents a disabled select and no selectable choice

#### Scenario: A stored id outside the candidate list survives
- **WHEN** a scenario restored from `localStorage` carries an `end` event whose `id` matches nothing active
- **THEN** that id is still offered as an option and the scenario is left unchanged

### Requirement: Items are addressed by name
A created item's `id` is its name: the form SHALL label the free-text field on a defining event as the item's name, and SHALL list that name in the choices offered to any event that addresses the item. The value stored under the scenario key `id` SHALL be unchanged by this presentation.

Naming SHALL remain optional. An item created without a name SHALL NOT appear in any choice list, and SHALL remain addressable only by the "first of kind" fallback the simulator already specifies.

#### Scenario: A name is what a later event shows
- **WHEN** the user names a `job` event "main job"
- **THEN** a later `layoff` event's choices include the entry "main job"

#### Scenario: Naming is optional and unnamed items are unlisted
- **WHEN** the user leaves a `job` event's name blank
- **THEN** the job runs as before and appears in no choice list

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

### Requirement: Field titles are human-readable
The form SHALL title every visible field, section heading, legend, and event-type
choice in prose, and SHALL NOT display a scenario object key verbatim. A title
SHALL NOT contain an underscored key fragment (`reserve_months`, `annualized_rate`,
`one_off_expense`) and SHALL NOT present a bare lowercase key such as `id` or `when`.

A title MAY abbreviate a key to a shorter phrase (`annualized_rate` as "Annual growth
rate"), expand it (`living_with` as "Living with you"), or rename the concept outright
where the key is an implementation name (`sqft` as "Floor area (sq ft)"). Titles SHALL
be derived mechanically from the key so that an event type added later is readable
without a separate label table.

Renaming is presentational only: the scenario object SHALL keep its original keys, and
the `value` of a form control that identifies data — the event-type option, for
example — SHALL remain the schema key rather than its prose title.

#### Scenario: Event-type choices are titled in prose
- **WHEN** the user opens the event-type chooser
- **THEN** `one_off_expense` is offered as "One off expense" and `buy_to_let` as "Buy to let", while the value each option submits remains the schema key

#### Scenario: No key fragment is visible in a title
- **WHEN** any event type's subform, the top-level field group, or the tax block is rendered
- **THEN** no visible title contains an underscored key fragment or a bare lowercase key such as `id` or `when`

#### Scenario: Renaming a title does not rename the edited key
- **WHEN** the user edits the field titled "Reserve months"
- **THEN** the scenario object carries the new value under the key `reserve_months`, and no additional or renamed key appears in the object
