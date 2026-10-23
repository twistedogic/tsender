# Spec Delta

## ADDED Requirements

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