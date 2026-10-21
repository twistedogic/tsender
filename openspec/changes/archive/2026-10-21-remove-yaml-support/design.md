# Design

## Context

The implementation for this change has already landed (retroactive change). What follows records the decisions made during removal so future work doesn't re-litigate them. Before the change: `src/scenario/yaml.ts` (648 lines) loaded/validated/serialized YAML text; storage persisted YAML; Import/Export moved YAML in and out; fixtures were `.yaml` files; 26 loader tests + 31 YAML literals in simulator tests depended on the parser.

## Goals / Non-Goals

**Goals:**
- One input shape: the typed `Scenario` object, everywhere (form state, storage, fixtures, tests).
- Delete the `yaml` dependency and the validation layer wholesale.
- Keep the fixture regression harness and its hand-verified expectations intact.

**Non-Goals:**
- No JSON import/export toolbar actions (nothing asked for them; the form is the authoring surface).
- No per-field scenario validation layer to replace the loader's (no untrusted text input remains).
- No migration of previously persisted YAML state (fall back to default instead).
- No simulator behavior change (settlement fixes that landed alongside are spec-compliance fixes under the existing requirements, not part of this design).

## Decisions

1. **Conversions ran through the loader before it was deleted.** Fixtures `.yaml` → `.json` and the 31 test literals YAML → JSON were converted by loading each with `loadScenario` and dumping the validated object — mechanical, verified by green suites (42/42 before and after) rather than hand transcription. The `.expected.json` files stayed byte-identical.

2. **Storage uses a shallow structural guard, not a validator.** The app is the only writer of the persisted JSON, so `loadFromStorage` checks only `JSON.parse` succeeds, `cash` is a number, and `events` is an array; anything else falls back to the default scenario. The 600-line validator existed for untrusted pasted text — that input path is gone. Marked with a `ponytail:` comment naming the upgrade path (add per-event validation if scenarios ever enter from outside the form).

3. **Old persisted YAML fails the JSON parse and falls back.** A migration would be code for a format we just deleted; a one-time default restore is cheaper and observable.

4. **Subform validation stays browser-native.** `required` attributes on `end`/`refinance` ids remain; the loader's deep validation (negative values, unknown types) has no equivalent because malformed scenarios can no longer be constructed from text — the form's inputs constrain authoring.

5. **`monthIndex` moved back into the simulator as a private function.** Its only remaining caller is the horizon computation; the shared export existed only for the loader.

## Risks / Trade-offs

- **No external interchange format.** Users who want to move a scenario between devices have no export. Accepted: nothing requires it; adding JSON export later is additive.
- **Form can now author values the loader would have rejected** (e.g. negative `cash` via typing). The simulator tolerates them (no crashes, just arithmetic); if guardrails are wanted, they belong in the form as a follow-up.
- **Spec divergence is closed by this change** — `scenario-loading`, `scenario-authoring`, and `results-display` deltas match the shipped behavior.
