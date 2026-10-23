# Tasks

## 1. Tokens (red first)

- [x] 1.1 Write a failing test in `src/ui/tokens.test.ts` that resolves every role token
      from `styles.css` under both themes and asserts each data-bearing token
      (`--fg`, `--fg-muted`, `--accent`, `--danger`, `--success`, `--warning`,
      `--chart-cash`, `--chart-assets`) reaches ≥ 4.5:1 against `--bg-panel`, `--bg`, and
      `--bg-inset`. Verify it fails against the current stylesheet.
- [x] 1.2 Rewrite the `:root` block in `src/ui/styles.css` with the two-tier token model
      (palette layer + role layer) using the values in design.md. Verify 1.1 passes.
- [x] 1.3 Add the `.theme-dark` role mapping and the
      `@media (prefers-color-scheme: dark) { :root:not([data-theme]) }` block. Add a comment
      warning that dropping the `:not()` selector silently overrides an explicit user choice.
      Verify 1.1 passes for the dark mapping.
- [x] 1.4 Replace every literal hex and every `--color-*` reference in the rest of
      `styles.css` with a role token. Verify `grep -nE '#[0-9a-fA-F]{6}' styles.css` returns
      only lines inside the palette layer.

## 2. Chart theming

- [x] 2.1 Write a failing test in `src/ui/ResultsChart.test.tsx` that renders the chart with a
      themed root and asserts the resolved stroke on `plot.series[1]` and `plot.series[2]`
      differs between light and dark. Verify it fails against the current hardcoded `#0b3a5b` / `#777`.
- [x] 2.2 Replace the hardcoded stroke colors and marker colors in `ResultsChart.tsx` with
      `getComputedStyle(document.documentElement).getPropertyValue(...)` lookups. Verify 2.1 passes.
- [x] 2.3 On theme change, mutate `series[i].stroke` and call `redraw(true)` rather than
      re-instantiating. Verify the chart instance is the same object identity before and
      after a theme switch.
- [x] 2.4 Assert the dash pattern on `assets_value` (`[5,3]`) survives the token change.
      Verify with a test that `series[2].dash` is defined.

## 3. Theme control

- [x] 3.1 Add a theme toggle to the toolbar in `App.tsx` cycling `system → light → dark`,
      writing `tsender.theme` to `localStorage`. Verify a component test asserts the attribute
      on `<html>` updates and the label reflects the current mode.
- [x] 3.2 Verify a missing, non-JSON, or out-of-range `tsender.theme` value falls back to
      `system` without throwing. Add a test per malformed-input case.
- [x] 3.3 Verify the existing scenario persistence test still passes — the theme key must not
      interfere with the scenario store. Run `npx vitest run src/ui`.

## 4. Summary hierarchy

- [x] 4.1 Add `font-variant-numeric: tabular-nums` to `.results-summary td` and confirm
      column alignment across rows with a render test.
- [x] 4.2 Distinguish the `final_cash` and `min_cash` rows by weight/scale, not color alone.
      Verify a test asserts those rows carry a different computed font-weight from the others.
- [x] 4.3 Verify the rows remain distinguishable when hue is collapsed — assert the differing
      property is `font-weight` or `font-size`, not `color`.

## 5. Surfaces and interaction

- [x] 5.1 Replace `box-shadow` panel separation with `1px solid var(--border)`. Verify the
      computed `border-top-width` is `1px` and `box-shadow` is `none` on `.editor` / `.results`.
- [x] 5.2 Add `:focus-visible` rings using `--accent` on every interactive element. Verify a
      test asserts the outline color resolves to the accent token.
- [x] 5.3 Check tap targets stay ≥ 44px at ≤ 480px after the spacing rework, per
      `scenario-authoring`. Run `npx vitest run`.

## 6. Verification

- [x] 6.1 Run `npx vitest run` — full suite green.
- [x] 6.2 Run `npm run test:scenarios` — fixture regressions unchanged (this change touches
      no model code, so any diff here means something leaked).
- [x] 6.3 Production smoke test per AGENTS.md. Confirm `heading 'tsender'`, `<cash spinbutton>`
      = `500000`, `<Final cash>` = `9,979,095`, and the `run outcomes` region are all present.
      Note that lightpanda cannot render the canvas — chart pixels are not checkable here; the
      unit test in task 1.1 is what covers chart contrast.

## 7. Human-readable field titles

- [x] 7.1 Add `src/ui/labels.ts` with a mechanical `snake_case` → prose helper, and
      route every field label, legend, heading, and event-type option through it. Verify
      the exhaustive-form test in `labels.test.tsx` passes.
- [x] 7.2 Drop the now-redundant `prefix` prop from `GrowthFields` (the event type is
      already in the legend above it). Verify the chart test still asserts the dash
      pattern on `assets_value`.
- [x] 7.3 Pin the behavior in the spec: add a `scenario-authoring` delta with a
      `Field titles are human-readable` requirement. Verify `openspec validate --strict`
      passes and the proposal's Capabilities section lists the capability.