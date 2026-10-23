# Tasks

## 1. Candidate replay (red first)

- [x] 1.1 Write `src/ui/activeItems.test.ts` covering the spec's selection rules: an
      item defined at a later month is absent from an earlier event's choices; an item
      ended at month 24 is absent at month 36; a defining event precedes a consumer at
      the same month; `pay_change` offers salaries but not rents; `refinance` offers
      mortgages only; `end` offers every kind. Verify the suite fails — the module does
      not exist yet.
- [x] 1.2 Add `src/ui/activeItems.ts` exporting `activeItems(scenario, atMonth)` and an
      `ActiveItem` shape of `{ kind, name }`, walking events with `when <= atMonth` in
      `(when, insertion)` order and inserting/removing per design.md. Verify 1.1 passes.
- [x] 1.3 Add a case where an event names an item that no longer exists, verifying the
      replay ignores the miss rather than throwing — the simulator's own no-op behaviour.
- [x] 1.4 Verify the replay does not import from `src/model/`. Add a test asserting
      `activeItems.ts` has no `model` import, since fidelity is enforced by tests rather
      than shared code.

## 2. Name fields on defining events

- [x] 2.1 Relabel the free-text id field on defining events as "Name", keeping the
      `id` scenario key unchanged. Verify a test edits a `job` event's name and asserts
      the emitted scenario carries `id: <the name>` and no new key.
- [x] 2.2 Verify `humanize()` is not applied to the field's `value` — the stored string
      is the name the user typed, not a title.

## 3. Item select on targeting events

- [x] 3.1 Write a failing component test: an `end` event renders a `select`, not a text
      input, and its options are the items active at that event's month.
- [x] 3.2 Give `EventForm` the `scenario` it is editing and derive candidates with
      `candidatesFor(scenario, event.when, type)` inside `ItemSelect`. Verified against
      3.1. This replaced the pre-filtered `items` prop first drafted here: the filter key
      is the event type, which only the body component knows, so passing a pre-filtered
      list would have duplicated the allowed-kinds table. See design.md.
- [x] 3.3 Filter the offered kinds per event type using the table in design.md, and
      group the options by kind. Verify a `pay_change` test shows no rent option.
- [x] 3.4 When the list is empty, render a disabled select reading "No active items".
      Verify the `end`-with-nothing-active case.
- [x] 3.5 When a newly added `layoff` / `graduate` / `end` / `refinance` / `pay_change`
      event has candidates and no stored `id`, preselect the first. Verify by adding an
      event and reading the select's value.
- [x] 3.6 Keep a stored `id` the replay did not produce as an option. Verify by loading
      a scenario whose `end` targets an unknown id and asserting the option survives and
      the emitted scenario is byte-identical to the input.

## 4. Verification

- [x] 4.1 Run `npx vitest run` — full suite green (173 passed, 10 files).
- [x] 4.2 Run `npm run test:scenarios` — 7 passed. `git diff --stat src/model/` is empty,
      confirming the boundary held.
- [x] 4.3 Run `npx tsc --noEmit` — clean.
- [x] 4.4 Smoke test with lightpanda per AGENTS.md. All four checks pass on the default
      scenario, which now renders a `Name` textbox per defining event. The interactive
      half of this task — adding a named `job` and an `end` targeting it — cannot be done
      with `lightpanda fetch`, which cannot click or type; `lightpanda run` only replays a
      script produced by `lightpanda agent`, which needs an API key. That path is covered
      instead by `eventTarget.test.tsx`, which renders that exact scenario and asserts the
      select and its options against the real DOM. Note that lightpanda cannot render
      canvas, so chart checks stay as they are.