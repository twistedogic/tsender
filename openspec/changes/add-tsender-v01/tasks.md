# Tasks

## 1. Project scaffold

- [ ] 1.1 Initialize Vite project (react-ts template) in repo root and confirm `npm run dev` serves a blank page at localhost
- [ ] 1.2 Add `vite-plugin-pwa`, `vitest`, `@testing-library/react`, `yaml`, `uplot`, and TypeScript types to `package.json`; confirm `npm install` succeeds and `npm run build` produces `dist/`
- [ ] 1.3 Configure `vite.config.ts` for GH Pages subpath deployment (`base: '/tsender/'`) and PWA (manifest path, registerType: 'autoUpdate', workbox precache) and confirm the built `dist/manifest.webmanifest` and `dist/sw.js` exist and load from `/tsender/`
- [ ] 1.4 Add `tsconfig.json` strict mode + path aliases (`@/model`, `@/scenario`, `@/output`, `@/ui`, `@/test`) and confirm `tsc --noEmit` passes on an empty `src/`

## 2. Scenario types and YAML loader (scenario-loading)

- [ ] 2.1 Define TS types for `Scenario`, every event variant, `TaxBlock`, and supporting types in `src/scenario/types.ts` and verify `tsc --noEmit` passes
- [ ] 2.2 Implement `loadScenario(yaml: string): Scenario` in `src/scenario/yaml.ts` using the `yaml` package; cover every event variant and the tax block and verify a vitest suite passes (one test per `scenario-loading` scenario)
- [ ] 2.3 Implement `serializeScenario(s: Scenario): string` (round-trip) and verify a vitest asserts `parse(serialize(s))` deep-equals `s` for a fixture covering all event types

## 3. Simulator core

- [ ] 3.1 Implement cashflow iteration (apply each active cashflow's grown `monthly` to cash, apply embedded asset flows like mortgage + fund contributions) in `src/model/simulator.ts` and verify with unit tests against the simple recurring scenarios in `scenario-loading`
- [ ] 3.2 Implement event firing (add/remove cashflows and assets at `when`) in `src/model/simulator.ts` and verify with vitest cases for `one_off_*`, `end`, `layoff`, `graduate`, `pay_change`, `refinance`, `downturn`, `death`
- [ ] 3.3 Implement reserve settlement (funds → properties in asset order; sale proceeds = value − remaining mortgage) in `src/model/reserve.ts` and verify with vitest cases matching the `scenario-loading` settlement scenarios
- [ ] 3.4 Implement MPF deduction (5% cap 1,500) and monthly salary/pension cashflow application in `src/model/tax.ts` and verify with the `hk-salaries-tax` cap/non-cap scenarios
- [ ] 3.5 Implement annual salaries-tax charge (progressive vs standard, household allowance from `tax:` block) at month 11 / 23 / 35 / ... in `src/model/tax.ts` and verify with vitest cases for the progressive example, partial-year layoff, pension-only, pension+salary stacking, and household allowance scenarios
- [ ] 3.6 Implement annual property-tax charge (15% × 80% of accrued rent) and combine with salaries tax in the same block in `src/model/tax.ts`; verify with the `hk-property-tax` scenarios and the combined-bill scenario

## 4. JSON output and scenario regression

- [ ] 4.1 Implement `runScenario(s: Scenario): { terminal, terminal_month?, months, passive_income_month? }` matching the `simulation-output` wrapper shape — tracking per-month passive income (pension + rental + fund growth) against the recurring expense total and reporting the earliest month from which coverage holds through the end — and verify every scenario in `simulation-output` passes as a vitest case (wrapper fields, terminal/terminal_month presence, months shape, passive_income_month presence/absence/dip semantics)
- [ ] 4.2 Commit 5 canonical fixtures under `fixtures/*.yaml` (minimal, full-event-vocabulary, reserve settlement, death event, household-tax) plus hand-verified expected outputs as `fixtures/*.expected.json`; verify each expected file parses as JSON and that hand-checked values (e.g., the progressive-tax worked example from `hk-salaries-tax`, and a trivial arithmetic scenario with no tax) match the spec
- [ ] 4.3 Add `npm run test:scenarios` that diffs `JSON.stringify(runScenario(loadScenario(fixtures/<name>.yaml)))` against `fixtures/<name>.expected.json` (within `1e-9` numeric tolerance); verify the script passes locally and fails when a fixture or its expected file is intentionally mutated

## 5. Form (scenario-authoring)

- [ ] 5.1 Build `<ScenarioForm>` top-level fields (cash, reserve_months, start, end, saving) with native input types and inline validation; verify by mounting in a test harness and asserting the serialized YAML loads to the same scenario
- [ ] 5.2 Build `<TaxBlockForm>` (status radio, children number, parents list) and verify by round-tripping the married-with-two-children scenario
- [ ] 5.3 Build `<EventsList>` and one `<EventForm>` per event type (all 17 variants) with type-specific fields and inline validation matching `scenario-loading`'s failure modes; verify by adding each event type through a test and asserting the round-trip
- [ ] 5.4 Wire `localStorage` persistence (`saveScenario` / `loadScenario` on every change) and the "Reset" action; verify by reload-restores and corrupt-storage-is-ignored tests
- [ ] 5.5 Add the "Import YAML" action with the same loader used in step 2.2; verify by pastes-valid-replaces-state and pastes-malformed-leaves-state tests

## 6. Results dashboard (results-display)

- [ ] 6.1 Implement a debounced `useSimulation(scenario)` hook (≤ 10 Hz) plus a `run` callback for the "Run" button; verify with a vitest that 50 rapid calls produce ≤ 10 simulator runs
- [ ] 6.2 Build `<ResultsSummary>` rendering final/min cash, assets, cashflow, first-insolvent, terminal; verify by snapshot test against a canned `runScenario` result
- [ ] 6.3 Build `<ResultsChart>` using uPlot with `cash` and `assets_value` series, reflowing on resize; verify by mounting at 320px viewport with a canvas mock (jsdom has no 2d context) and asserting the chart bbox is ≤ viewport width
- [ ] 6.4 Render markers (insolvency / saving breach / terminal) on the chart and as text callouts; verify by scenario with month-47 insolvency
- [ ] 6.5 Build `<RunOutcomes>` rendering the passive-income crossing callout and the end-solvency (final net worth) callout; verify by scenarios with a sustained crossing, a never-crossing run, and a negative-final-net-worth run

## 7. PWA and deployment

- [ ] 7.1 Author `public/manifest.webmanifest` and add at least two icon sizes; verify Lighthouse PWA installability check passes against the built `dist/`
- [ ] 7.2 Verify the service worker registers in production build and that the app renders after going offline (DevTools "Offline" toggle); add a vitest using `workbox-window` or a fetch-mock to assert the precache covers the app shell
- [ ] 7.3 Add `.github/workflows/deploy.yml` (build + deploy `dist/` to Pages on `main`, build-only on PRs); verify the workflow file is well-formed by pushing a draft branch and watching the run

## 8. Docs and conventions

- [ ] 8.1 Add `AGENTS.md` mirroring ender's conventions (acronyms, Task runner, no-agent-names in commits, structured logging, regression tests for bug fixes, update-in-same-change)
- [ ] 8.2 Add `skills/ender-web/SKILL.md` in Agent Skills format describing the web UI, the scenario schema, decision rules, and deliberate simplifications (MPF ignores the real scheme's income floor; no CLI references — there is none); verify by `openspec validate` and an agent-skills linter if one is available
- [ ] 8.3 Add a license file at repo root (mirror `ender`'s eventual choice — raise at archive if still `null`) and verify the file is committed