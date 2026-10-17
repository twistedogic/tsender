# AGENTS.md

## Project

tsender — TypeScript PWA port of the `ender` HK personal-finance simulator. React + Vite + vite-plugin-pwa, runs entirely in the browser. Behavior is specified in `openspec/specs/` — read the relevant spec before touching simulator, tax, or loading logic.

## Priority order

When qualities trade off, decide in this order:

1. **Correctness** — output matches `openspec/specs/` and the `fixtures/*.expected.json` regression files. A fast, elegant, wrong answer is a bug.
2. **Readability** — the next reader must follow the money flow without decoding it.
3. **Performance** — only after 1 and 2, and only for a measured gap. One user's scenario on a phone; speculative optimization is dead weight.

## Testing

Vitest is the test runner (`npx vitest`, or `npm run test:scenarios` for fixture regression).

Work test-first, red-green-refactor:

1. **Red** — write the smallest failing test that pins the behavior you're about to add. Run it and confirm it fails for the expected reason.
2. **Green** — write the minimum code that passes. Run the suite.
3. **Refactor** — clean up under a green suite; re-run before moving on.

Done means: full suite green (`vitest run` + `test:scenarios`), including a test that fails without your change.

- Money and tax logic in `src/model/` lands with a test pinning it. Scenario comparisons use `1e-9` float tolerance.
- Canonical scenarios are committed pairs: `fixtures/<name>.yaml` + hand-verified `fixtures/<name>.expected.json`. A new simulator path gets a new fixture pair.
- UI components: test behavior (render → interact → assert), not implementation details.
