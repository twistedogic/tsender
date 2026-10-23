# Design

## Context
Facts that constrain the approach, read from `src/scenario/types.ts` and
`src/model/simulator.ts`. Motivation is in proposal.md.

**Only mortgages auto-generate an id.** `acquireProperty` uses
`mortgageSpec.id ?? nextCashflowId("mortgage")`. Every other created item gets an
`id` solely when its defining event supplies one, and 17 of the event body's `id`
fields are `id?: string`. An unnamed item is therefore invisible to any id-based
lookup and falls back to "first of kind" — `removeFirstOfKind` for `layoff` /
`graduate`, `findFirstSalary` for `pay_change`.

**An unmatched id is a silent no-op.** `end` walks the cashflows, then the assets,
then returns; `refinance` iterates the properties and falls out of the loop. Neither
reports a miss. The form is the only place this is catchable.

**Two different failure modes, one field.** The same `id` on `job` *names* something
new; on `layoff` it *points at* something existing. Today both render as the same free
text box, which is why the two jobs read the same.

**No component reads live state.** `EventForm` receives a single `Event` and an
`index`; nothing above it threads the `Scenario`. A candidate list needs the sibling
events, so the data has to flow down.

## Goals / Non-Goals

**Goals:**
- The user picks an existing item from what exists, never from memory.
- A misspelled target becomes impossible through the UI.
- Zero change to `src/model/` and to the `Scenario` type.

**Non-Goals:**
- Making names mandatory. Ids stay optional, so the simulator's "first of kind"
  fallback stays reachable and saved scenarios keep loading.
- Surfacing the simulator's no-op as an error or a warning. The form prevents the
  common case; it does not audit an already-stored scenario.

## Decisions

### Static lifecycle replay in `src/ui/`, not a simulation replay

`activeItems(scenario, atMonth)` walks events with `when <= atMonth` in
`(when, insertion)` order and keeps a live set of `{ kind, name }`:

```
defining  job, expense, tuition, withdrawal, one_off_expense, one_off_income
          buy_home.mortgage, buy_to_let.rent, buy_to_let.mortgage,
          investment.contribution        -> insert the item when the event names one
consuming layoff, graduate, end          -> remove the named item if present
neutral   refinance, pay_change          -> mutate an item, never remove one
```

**Why not replay the simulator.** `runScenario` returns a month series, not an item
list, so a correct answer would mean adding liveness reporting to `src/model/` and
running a partial simulation per event row on every keystroke. For a dropdown the
arithmetic is irrelevant — only the id lifecycle matters, and that is a dozen lines of
set manipulation with no money in it. The replay also matches the simulator's own
ordering rule, which `scenario-loading` already specifies as `(when, then insertion)`.

**Known gap:** a `death` event truncates the run, so items after it are still offered.
So are items removed by the no-id "first of kind" fallbacks, which are not id-addressed
and so cannot be tracked. Both are accepted; the alternative is dragging the model in.

### Candidate kinds are filtered per event type, not shown as one flat list

| Event | Kinds offered | Simulator basis |
|---|---|---|
| `pay_change` | salary | `found.kind === "Salary"` guard |
| `refinance` | mortgage | `a.kind === "Property" && a.mortgage?.id === e.id` |
| `end` | all | searches cashflows, contributions, rents, mortgages |
| `layoff`, `graduate` | all created kinds | `findCashflowById` with no kind guard |

**Why not one flat list.** The filter is what the simulator actually accepts. Showing
an expense to a `refinance` offers a choice that silently does nothing — the exact
failure this change exists to remove. Being faithful to the simulator's looseness on
`layoff` / `graduate` is deliberate: the id path really does remove any cashflow there.

### The item name *is* the id string; no separate label field

`{ kind, name }` where `name` is the stored `id`. A second field would mean keeping
two things in sync for no gain — the id is already the only identifier a later event
can match on.

### An unmodelled id stays selectable

The stored value is added to the option list when the replay did not produce it,
labelled as stored. This is the only way a loaded scenario survives intact: its ids
were written by an earlier version, or by a hand-edited `localStorage` entry, and
silently dropping one would change the scenario the user is looking at.

### Candidate list lives in `src/ui/`, not `src/model/`

`activeItems` is presentational bookkeeping with no financial meaning, and putting it
next to the simulator would invite someone to treat it as authoritative. Its fidelity
to `runScenario` is enforced by tests, not by shared code.

### The form derives candidates from the scenario it is editing

`EventForm` gains a `scenario` prop and `ItemSelect` calls
`candidatesFor(scenario, event.when, type)` for itself.

**Why not pre-filter an `items` prop in `ScenarioForm`.** The first draft of this
design passed a pre-filtered list. It turns out the filtering key is the event
type, and only the body component knows which type it is rendering — so
`ScenarioForm` would have to repeat the `TargetingType` → allowed-kinds table, and
the two copies would drift. Passing the scenario and letting the one component that
needs the filter own the table keeps a single source.

**Why not compute once in `ScenarioForm`.** It would be the same call N times, but
hoisting means threading a per-event map through the tree and re-deriving it
whenever any field changes. The event list is bounded by scenario size — tens of
rows, each a set walk — so the cost does not justify the plumbing.

### An empty-string id counts as unset

`makeEmptyEvent("end")` seeds `id: ""`, not `undefined`, so "Add event" produces a
targeting event whose id is an empty string. Treating that as a stored id would keep
one blank option and leave the select enabled, which defeats the rule that an
unbuildable target must not be selectable. `ItemSelect` normalises it first.

### Two spec rules meet when nothing is active but an id is stored

The spec says an empty candidate list disables the select, and that a stored id
outside the list stays as an option. With no candidates and no stored id the select
disables; with a stored id the stored id wins and the select stays usable, because
the alternative is silently rewriting a loaded scenario. Both cases are tested.

## Risks / Trade-offs

**[The replay and the simulator can drift]** → Two tests assert the same ids resolve
the same way: one over the replay, one asserting a stored scenario's ids survive a
round-trip through the form. A future simulator change that alters id resolution
should fail the latter rather than silently diverge.

**[A stale dropdown offers an item that dies at the same month]** → Candidates are
computed for `when`, and a consuming event at that same `when` is ordered after the
defining one, so the item is genuinely live when the target event fires. Events later
in the same month that consume it are the user's ordering to manage.

**[Many events means many replays per render]** → Bounded by scenario size and cheap
(set operations, no allocation beyond the result). If a scenario ever reaches
thousands of events, hoist a single pass — noted rather than pre-built.

**[`death` truncation is not modelled]** → Accepted; an event after `death` is already
specified as irrelevant by `scenario-loading`.

## Migration Plan

None. No stored shape changes, no schema change, no key rename. Rollback is
`git revert` and users keep the scenarios they already had.

## Open Questions

None. The one question that could have changed the specs — whether to require names —
is resolved as an explicit non-goal in proposal.md, because making a previously
optional field required would break saved scenarios and would delete the "first of
kind" fallback that `scenario-loading` specifies.