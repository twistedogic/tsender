# Proposal

## Why
Five event types (`layoff`, `graduate`, `end`, `refinance`, `pay_change`) address
an existing item by `id`, and the form asks the user to type that id blind. Nothing
on screen shows which items exist, so the user must already know an id exists and
reproduce it exactly — and a typo is swallowed silently. `src/model/simulator.ts`
resolves an unmatched id to a no-op (`end` returns after finding nothing; `refinance`
falls through its loop), so a misspelled target produces a scenario that runs cleanly
and is silently wrong. An `id` is already the item's name; the form just never presents
it that way.

## What Changes
- A pure function computes the items alive at a given month by replaying the scenario's
  event list: ids declared by earlier defining events, minus ids consumed by earlier
  `layoff` / `graduate` / `end`. No money arithmetic — pure id bookkeeping, driven by
  `when` and insertion order.
- Targeting events replace the free-text id input with a `select` of those live items,
  filtered to the kinds each event can actually address, with the first candidate
  preselected when the event is added.
- Defining events keep their free-text field but present it as a name ("Name"), since
  the id *is* the name. No schema change: ids stay optional strings.
- When nothing is alive, the `select` is disabled and reads "No active items". For
  `end` and `refinance`, whose `id` is required, that is the correct state — the event
  would be a silent no-op.
- An id held by a stored scenario that the replay does not model stays in the list,
  marked as-is, so a scenario loaded from `localStorage` round-trips unchanged instead
  of being silently rewritten.

## Capabilities

### New Capabilities
None. Candidate selection is part of authoring a scenario, not a separate concern.

### Modified Capabilities
- `scenario-authoring` — the subform requirement changes so that a targeting event's
  id is chosen from live items rather than typed; two requirements are added covering
  candidate selection and the name-is-the-id semantics for defining events.

## Impact

| File | Change |
|---|---|
| `src/ui/activeItems.ts` | new — `activeItems(scenario, atMonth)` and its item shape (~45 lines) |
| `src/ui/activeItems.test.ts` | new — replay, ordering, and kind-filter tests |
| `src/ui/EventForm.tsx` | `LabeledId` split: a name field for defining events, an item `select` for targeting ones |
| `src/ui/ScenarioForm.tsx` | pass the scenario down so an event can compute its own candidates |
| `openspec/specs/scenario-authoring/spec.md` | delta: 1 modified requirement, 2 added |

No change to `src/model/`, `src/scenario/types.ts`, or the simulator. No new
dependency. Fixture scenarios are unaffected — they never go through the form.

## Non-goals
Making names mandatory. Ids stay optional exactly as they are today, so an unnamed item
remains addressable only by the simulator's "first of kind" fallback, and scenarios
already saved in `localStorage` keep working untouched. Requiring a name would be a
schema change with a migration story, and it would also remove the fallback the
simulator is specified to have.