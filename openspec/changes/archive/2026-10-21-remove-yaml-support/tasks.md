# Tasks

Retroactive change: implementation landed before this change was written. Every task below is complete; evidence noted per task.

- [x] 1. Convert `fixtures/*.yaml` to `fixtures/*.json` through `loadScenario` (validated Scenario objects); `.expected.json` files unchanged. Evidence: 7 fixture pairs, `npm run test:scenarios` → 7 passed, 0 failed.
- [x] 2. Convert the 31 YAML literals in `src/model/simulator.test.ts` to JSON via the loader; helper `scn()` becomes `JSON.parse`. Evidence: 42/42 tests green before and after, zero expectation changes.
- [x] 3. Delete `src/scenario/yaml.ts` and `src/scenario/yaml.test.ts`; move `monthIndex` back into `src/model/simulator.ts` as a private helper. Evidence: no references remain (`grep` clean), typecheck passes.
- [x] 4. Rewrite `src/ui/storage.ts` to JSON persistence with a shallow structural guard; persisted-YAML and corrupt payloads fall back to the default scenario. Evidence: new round-trip + corrupt-rejection test in `ScenarioForm.test.tsx` green.
- [x] 5. Remove the "Import YAML" and "Export scenario.yaml" toolbar actions and their handlers from `src/ui/App.tsx`. Evidence: buttons absent from the rendered page (lightpanda semantic-tree smoke).
- [x] 6. Remove the `yaml` dependency from `package.json` and update the lockfile. Evidence: `npm ls yaml` empty, `npm install` clean.
- [x] 7. Update `scripts/test-scenarios.ts` and `scripts/bootstrap-expected.ts` to read `.json` scenario fixtures (excluding `*.expected.json`). Evidence: harness runs and skips-existing behavior preserved.
- [x] 8. Update `AGENTS.md` fixture-pair documentation (`fixtures/<name>.json` + `.expected.json`).
- [x] 9. Full verification: `vitest run` (46 passed), `npm run test:scenarios` (7/7), `npm run typecheck`, `npm run build`, and the lightpanda smoke (default scenario renders `500000` → final cash `9,979,095`, run outcomes present).
