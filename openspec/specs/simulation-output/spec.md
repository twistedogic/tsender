# simulation-output Specification

## Purpose

Defines the shape of the result object produced by tsender's `runScenario(s)` — an internal contract between `src/model/` and the React UI. The shape descends from `twistedogic/ender@32ab445`'s `--json` wrapper by convention; nothing asserts equivalence.

## Requirements

### Requirement: runScenario returns the wrapper shape
`runScenario(s: Scenario)` SHALL return a JSON-serializable object whose top-level fields are `terminal` (boolean), `terminal_month` (integer, present only when `terminal` is `true`), `months` (array), and `passive_income_month` (integer, present only when a sustained passive-income crossing exists — see its requirement below). The object SHALL round-trip via `JSON.parse(JSON.stringify(...))` to a deep-equal value.

#### Scenario: Wrapper fields when terminal
- **WHEN** the scenario has `{type: death, when: 24}` and a horizon greater than 24
- **THEN** `runScenario` returns `{ terminal: true, terminal_month: 24, months: [...] }` and `JSON.parse(JSON.stringify(result))` deep-equals `result`

#### Scenario: terminal_month absent when terminal is false
- **WHEN** the scenario has no `death` event
- **THEN** `terminal_month` is absent from the JSON output (`Object.keys(JSON.parse(JSON.stringify(result)))` does not contain `"terminal_month"`), and `terminal` is `false`

### Requirement: months array carries per-month stats
`months` SHALL be an array of `{month, cash, assets_value, monthly_cashflow}` objects in simulation order. `month` SHALL be a 0-based integer index; `cash`, `assets_value`, and `monthly_cashflow` SHALL be finite numbers. The array SHALL contain one element per simulated month inclusive of both endpoints — a 360-month horizon produces 361 elements (months 0..=360), and a horizon of 0 produces exactly one element (month 0).

#### Scenario: Per-month shape and length
- **WHEN** a scenario runs for 12 simulated months
- **THEN** `months.length === 13`, `months[i].month === i` for each `i ∈ [0, 12]`, and every `cash`, `assets_value`, `monthly_cashflow` is a finite number

### Requirement: passive_income_month reports the sustained passive-income crossing
The wrapper SHALL carry `passive_income_month` (integer) when a sustained crossing exists and SHALL omit the key otherwise. A month's **passive income** SHALL be the sum of that month's pension payouts, rental income (occupancy-applied), and fund growth — the month's increase in each fund's principal from its configured rate. Salary, one-off income, and all other flows SHALL NOT count. A month's **recurring expenses** SHALL be the same total the reserve settlement uses: all negative recurring flows of the month, excluding one-off firing amounts and taxes, including embedded asset flows such as mortgage payments and fund contributions. `passive_income_month` SHALL be the earliest month M such that passive income ≥ recurring expenses holds for every simulated month from M through the final month (the terminal month when the run ended early). When no such M exists, the key SHALL be absent from the JSON output.

#### Scenario: Sustained crossing is reported
- **WHEN** passive income ≥ recurring expenses holds for every month from 120 through the final month 360, after failing in some earlier month
- **THEN** `passive_income_month` is 120

#### Scenario: A later dip delays the crossing
- **WHEN** the condition first holds at month 100, fails at month 150, and holds from month 200 through the final month
- **THEN** `passive_income_month` is 200, not 100

#### Scenario: Never sustained
- **WHEN** the condition holds from month 100 through month 200, fails at month 201, and never holds again through the final month
- **THEN** `passive_income_month` is absent from the JSON output

#### Scenario: Salary does not count as passive income
- **WHEN** a salary alone covers all recurring expenses and no pension, rental income, or fund exists
- **THEN** `passive_income_month` is absent

#### Scenario: Death-terminated run evaluates through the terminal month
- **WHEN** a `{type: death, when: 24}` event ends the run and the condition holds from month 10 through month 24
- **THEN** `passive_income_month` is 10
