# Proposal

## Why

`twistedogic/ender` (Rust CLI/TUI) is the canonical personal-finance scenario simulator for Hong Kong cashflows — MPF, salaries tax, property tax, reserve-driven liquidation. The CLI is powerful but its audience is the author; everyone else meets a terminal, a YAML schema, and a ratatui table. Ship a TypeScript PWA at `twistedogic.github.io/tsender` — a browser edition of the same domain — so anyone with a browser can author a scenario in a form, see a charted monthly trajectory, and run it offline on a phone — without a Rust toolchain.

## What Changes

- Port the `ender` simulator, HK tax logic, scenario loader, and the JSON output wrapper shape (now in `simulation-output`) from Rust to TypeScript.
- **Fully self-contained.** The deployed PWA has no Rust toolchain, no backend, no external services, and no runtime dependency on `ender`. All simulation runs in the browser; CI runs only TypeScript and the web toolchain.
- **No CLI.** tsender has no command-line entry point.
- Add a React + Vite + vite-plugin-pwa front-end with mobile-first responsive layout.
- Add a form-based scenario editor that covers every event type and round-trips with `scenario.yaml` (paste a YAML, edit it as a form, export it back as YAML).
- Add a results dashboard: summary stats, monthly chart with insolvency/death/breach markers, and two run outcomes — sustained passive-income crossing and end solvency.
- Adopt the three `ender` specs as tsender's own (provenance: `twistedogic/ender@32ab445`): `scenario-loading`, `hk-salaries-tax`, `hk-property-tax`. They describe the canonical YAML schema and HK tax rules, are tsender's behavior definition, and evolve independently — no mirror-sync obligation, no ender at build or runtime.
- Add three new tsender-native capabilities: `simulation-output` (the JSON wrapper contract between `src/model/` and the React UI), `scenario-authoring` (form ↔ YAML), and `results-display` (web dashboard).
- Lock simulator behavior at v0.1 by committing canonical scenarios (`fixtures/*.yaml`) plus hand-verified expected outputs (`fixtures/*.expected.json`); `npm run test:scenarios` runs `runScenario` against each fixture and diffs against the expected file (within `1e-9` numeric tolerance), failing on drift.
- Ship a GH Pages deployment workflow (build `dist/`, deploy on push to `main`).
- **BREAKING** for tsender (v0.1): no prior version exists.

## Capabilities

### New Capabilities

- `scenario-loading`: adopted from `twistedogic/ender@32ab445`. Defines the YAML scenario schema and loading semantics — tsender's behavior definition, evolving independently.
- `simulation-output`: NEW tsender-native spec. Defines the JSON result-object shape produced by `runScenario` — a contract between `src/model/` and the React UI. The shape (wrapper object with `terminal`, `terminal_month?`, `months`, `passive_income_month?`) was chosen for readability of per-month series and run outcomes. This is an internal contract; tsender has no runtime dependency on `ender`.
- `hk-salaries-tax`: adopted from `twistedogic/ender@32ab445`. Defines MPF deduction (5% cap 1,500/mo) and annual salaries-tax computation (progressive vs standard, with 2026/27 IRD household allowances).
- `hk-property-tax`: adopted from `twistedogic/ender@32ab445`. Defines annual property-tax computation (15% × 80% of accrued rent).
- `scenario-authoring`: form-based scenario authoring. Edits a `Scenario` via typed subforms (one per event type, plus top-level fields and the tax block). The form state MUST serialize to a YAML string that round-trips with `scenario-loading` (loading the exported YAML produces an equivalent `Scenario`).
- `results-display`: web results view. Shows final/min cash, final assets, final monthly cashflow, min-cash month, first-insolvent month, passive-income crossing, end solvency, terminal events; plus a monthly chart of `cash` and `assets_value` over the simulation horizon with markers for insolvency, saving-breach, and `death`.

### Modified Capabilities

None. The adopted specs are introduced with requirement text unchanged from `ender` at adoption time; future evolution is ordinary tsender spec maintenance via separate changes.

## Impact

- New repo `tsender` (no prior code) — no existing code broken.
- Affected systems:
  - User devices — PWA install + offline cache via vite-plugin-pwa service worker.
  - GH Pages — `dist/` published from Actions on push to `main`.
- New dependencies (npm): `react`, `react-dom`, `vite`, `vite-plugin-pwa`, `vitest`, `@testing-library/react`, `typescript`, `yaml` (scenario parsing), `uPlot` (chart), `@types/*`.
- No backend. The simulator runs entirely in the browser.
- Behavior is locked at v0.1 by committing canonical scenarios (`fixtures/*.yaml`) plus their hand-verified expected outputs (`fixtures/*.expected.json`). `npm run test:scenarios` runs `runScenario` against each fixture and diffs against the expected file (within `1e-9` numeric tolerance). Drift is caught in CI; no comparison to ender at any point.