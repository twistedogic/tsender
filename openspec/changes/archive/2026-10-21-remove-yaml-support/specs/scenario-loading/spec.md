# Spec Delta

## Purpose

Define the scenario as a typed `Scenario` object — starting cash plus events — and the behavioral semantics of every event type. There is no file format and no text parsing; the object is authored by the form (capability `scenario-authoring`) and consumed by `runScenario`.

## ADDED Requirements

### Requirement: Scenario is a typed object
The system SHALL accept a scenario as a typed object containing starting `cash` and a list of `events`, where each event has a `when` (month index, 0-based) and a `type` discriminator. Supported event types SHALL include `job`, `pension`, `expense`, `tuition`, `withdrawal`, `layoff`, `graduate`, `buy_home`, `buy_to_let`, `investment`, `end`, `one_off_expense`, `one_off_income`, and `death`. There SHALL be no text serialization of a scenario; consumers construct the object directly.

#### Scenario: Minimal scenario
- **WHEN** a scenario object has `cash: 20000` and an empty `events` list
- **THEN** running it starts with 20000 cash, no cashflows, no assets, and no events

#### Scenario: Full event vocabulary
- **WHEN** a scenario object uses each event type — `job`, `pension`, `expense`, `tuition`, `withdrawal`, `buy_home`, `buy_to_let`, `investment`, `end`, `one_off_expense`, `one_off_income`, `death` — with their required fields
- **THEN** running it produces a state whose cashflow and asset lists contain the corresponding items, and whose event list contains the `end` and `death` events

### Requirement: Simulation state is not part of the scenario object
Fields that are runtime simulation state SHALL be initialized by the simulator and SHALL NOT appear in the scenario object. Specifically, a mortgage's paid counter SHALL start at `0` and a one-off's fired state SHALL start unfired.

#### Scenario: Mortgage without paid counter
- **WHEN** a scenario's mortgage specifies only `monthly` and `period`
- **THEN** the run behaves as if nothing has been paid yet

#### Scenario: One-off without fired flag
- **WHEN** a scenario's one-off specifies only `amount`
- **THEN** the run behaves as if it has not fired yet

## MODIFIED Requirements

### Requirement: Pension event adds a non-MPF income cashflow
The scenario SHALL accept an event type `pension` alongside `job`, `expense`, `tuition`, and the other existing variants. The event SHALL carry a body `pension: {monthly, annualized_rate}` mirroring the shape of `salary`. When the event fires, the system SHALL add a `Pension` cashflow item to the scenario's cashflow list whose `monthly` and `annualized_rate` equal the body's fields. The pension's `monthly` SHALL grow by `(1 + annualized_rate)^(1/12)` per simulated month, identical to how `salary` / `rent` / `tuition` grow, and SHALL be paid in full into cash with no MPF deduction. Pension gross SHALL feed the salaries-tax base; see capability `hk-salaries-tax` for the tax treatment.

#### Scenario: Pension event adds a non-MPF income cashflow
- **WHEN** a scenario declares a pension event `{ monthly: 15000, annualized_rate: 0.025 }` at month 0 and the run reaches month 360
- **THEN** after month 360 the cashflow list contains a `Pension` item with `monthly: 15000.0` and `annualized_rate: 0.025`, and the next simulated month reports a `monthly_cashflow` of `+15000.0` (not `+15000 - MPF`) and `cash` increases by 15000 from the prior month.

#### Scenario: Pension event rejected without body
- **WHEN** the user authors a pension event in the form
- **THEN** the pension subform always supplies a `{monthly, annualized_rate}` body; a body-less pension cannot be authored, and no runtime rejection path exists

### Requirement: Scenario may declare a cash reserve
The scenario object SHALL accept an optional top-level `reserve_months` field: a non-negative integer number of months of recurring expenses to hold as cash. When the field is absent, the reserve requirement SHALL not apply.

#### Scenario: Reserve loads
- **WHEN** a scenario object specifies `reserve_months: 3` alongside `cash` and `events`
- **THEN** the scenario carries a 3-month reserve requirement

#### Scenario: Absent reserve disables settlement
- **WHEN** a scenario with no `reserve_months` field runs a month whose flows take cash negative while a fund asset exists
- **THEN** nothing is liquidated and cash simply goes negative, exactly as before this change

#### Scenario: Negative reserve fails to load
- **WHEN** a scenario object carries a non-positive `reserve_months`
- **THEN** the simulator treats it as absent: no reserve requirement applies and no error is reported

### Requirement: Refinance event replaces a mortgage's monthly payment
A `refinance` event SHALL replace the `monthly` value of a mortgage identified by `id` at the month the event fires. The event SHALL carry an `id` (the label on the target mortgage's enclosing property asset) and a `monthly` (the new payment amount, non-negative). The replacement SHALL leave `period`, `paid`, and the property's other fields untouched. The event SHALL be a silent no-op when no asset's mortgage carries the matching id. Refinance SHALL NOT appear in `monthly_cashflow`; the new payment takes effect in the firing month's own cashflow (events fire before the month's flows settle).

#### Scenario: Refinance updates the monthly on the matching property
- **WHEN** a property asset has a mortgage with `id: home-loan`, `monthly: 30000, period: 300`, and a refinance event with `id: home-loan, monthly: 42000` fires
- **THEN** the property's mortgage `monthly` becomes 42000 in the firing month and subsequent months, and the firing month's `monthly_cashflow` reflects the higher payment

#### Scenario: Unknown refinance id is a no-op
- **WHEN** a refinance event with `id: ghost` fires and no asset carries that id
- **THEN** no mortgage is modified, the scenario continues, and no error is reported

#### Scenario: Refinance without an id fails to load
- **WHEN** a refinance event without an `id` reaches the simulator
- **THEN** it is a silent no-op (no mortgage carries an undefined id) and no error is reported

### Requirement: Scenario declares a start date, end date, and saving target
The scenario object SHALL accept three optional top-level fields alongside `cash` and `events`: `start` (a `"YYYY-MM"` string anchoring month 0 of the run), `end` (a `"YYYY-MM"` string limiting the run horizon in months from `start`, inclusive), and `saving` (a cash floor the run tracks). When `start` is absent, month 0 is the implied anchor and the field is informational only. When `end` is present, the simulator SHALL stop after `months(end) − months(start) + 1` simulated months; when absent, the run uses the default 360-month horizon. When `saving` is present, the run SHALL record whether `cash` ever dropped below it and the first month it did; when absent, no target is tracked.

#### Scenario: End truncates the run
- **WHEN** a scenario declares `start: 2026-08, end: 2029-08`
- **THEN** the simulator runs 37 months (months 0..=36) and the reported `final_monthly_cashflow` corresponds to month 36

#### Scenario: Saving target is tracked
- **WHEN** a scenario declares `saving: 100000` and a month ends with cash at 80,000
- **THEN** the run records that the saving target was breached at that month and reports it in the summary

#### Scenario: Absent end uses default 360-month horizon
- **WHEN** a scenario declares no `end` field
- **THEN** the run executes 361 simulated months (months 0..=360), as before

#### Scenario: Negative saving fails to load
- **WHEN** a scenario object carries a negative `saving` value
- **THEN** the simulator applies it as the cash floor as-is; in a solvent run the floor sits below every balance and no breach is reported

## REMOVED Requirements

### Requirement: Scenario is defined in a YAML file
Replaced by "Scenario is a typed object" — no file format or deserialization exists.

### Requirement: Simulation state is not part of the file format
Replaced by "Simulation state is not part of the scenario object" — same rule, no file.

### Requirement: Invalid files fail with a clear error
No text format exists, so there is nothing to parse and no parse-error reporting. The form constrains input at authoring time (see `scenario-authoring`).
