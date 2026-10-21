# Proposal

## Why

tsender's only input surface is the in-browser form; nobody authors YAML by hand anymore. The YAML stack — the `yaml` npm dependency, a 648-line loader/serializer, a 368-line test file, YAML round-trip requirements in three specs, and Import/Export toolbar actions — existed to mirror `ender`'s file format, but it cost ~1,000 lines of validation code whose only untrusted input was a paste box. Removing it shrinks the app, deletes a dependency, and leaves one canonical input shape: the typed `Scenario` object built by the form, persisted as JSON.

## What Changes

- **REMOVED** the `yaml` npm dependency and `src/scenario/yaml.ts` (loader, validator, serializer) with its test file. There is no text scenario format and no scenario validation layer; the `Scenario` type (`src/scenario/types.ts`) is the sole input contract.
- **REMOVED** the "Import YAML" and "Export scenario.yaml" toolbar actions. The form is the only authoring path; no file/paste import or export exists.
- localStorage persistence switches from YAML text to JSON (`JSON.stringify` on save; on load, a shallow structural check — `cash` a number, `events` an array — falls back to the default scenario on anything else, including previously persisted YAML).
- Canonical regression fixtures become `fixtures/<name>.json` (a `Scenario` object) paired with the existing hand-verified `fixtures/<name>.expected.json`; the harness and bootstrapper read JSON directly.
- Simulator, tax, reserve, and output behavior are unchanged — this change touches loading/authoring surfaces only. (The settlement fixes landed alongside this work brought the simulator INTO compliance with the existing `scenario-loading` requirements; they need no spec delta.)

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `scenario-loading`: the scenario is a typed `Scenario` object, not a YAML file. Load-time validation requirements (unknown event type, malformed document, negative-value rejections, missing required fields) are removed with the loader; all behavioral requirements (event semantics, settlement, refinance, pay-change, horizon, saving) are unchanged.
- `scenario-authoring`: the form edits the `Scenario` object directly; the YAML round-trip requirement becomes a state-equivalence requirement. Validation is browser-native on the subforms (e.g. required ids); there is no export to block. Persistence is JSON under one key; the "Import accepts pasted YAML" requirement is removed.
- `results-display`: the "Export scenario.yaml" action requirement is removed. All dashboard, chart, marker, outcome, and debounce requirements are unchanged.

## Impact

- `package.json`: −1 dependency (`yaml`); lockfile updated.
- `AGENTS.md`: fixture pairs documented as `.json` + `.expected.json`.
- Stored scenarios from earlier versions (YAML text under `tsender.scenario.v1`) fail the JSON parse and fall back to the default scenario — accepted migration behavior, not silently corrupt state.
