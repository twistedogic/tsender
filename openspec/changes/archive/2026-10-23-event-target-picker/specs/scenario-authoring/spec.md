# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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

## ADDED Requirements

### Requirement: Items are addressed by name
A created item's `id` is its name: the form SHALL label the free-text field on a defining event as the item's name, and SHALL list that name in the choices offered to any event that addresses the item. The value stored under the scenario key `id` SHALL be unchanged by this presentation.

Naming SHALL remain optional. An item created without a name SHALL NOT appear in any choice list, and SHALL remain addressable only by the "first of kind" fallback the simulator already specifies.

#### Scenario: A name is what a later event shows
- **WHEN** the user names a `job` event "main job"
- **THEN** a later `layoff` event's choices include the entry "main job"

#### Scenario: Naming is optional and unnamed items are unlisted
- **WHEN** the user leaves a `job` event's name blank
- **THEN** the job runs as before and appears in no choice list