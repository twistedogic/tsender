# Design

## Context

The whole visual layer is one hand-written stylesheet (`src/ui/styles.css`) with a single
`:root` token block and a `prefers-color-scheme` override. The chart is `uPlot` 1.6.32,
which draws to a canvas and therefore cannot consume CSS variables natively. See
proposal.md for the motivation.

Constraints that shape this design:

- **Canvas cannot read CSS vars.** `uPlot` series strokes are `CanvasRenderingContext2D['strokeStyle']`,
  a paint-time string the canvas resolves itself. A `var(--x)` there paints as nothing.
  Any theming bridge must resolve the variable to a literal first.
- **No build step for CSS.** Vite handles the stylesheet as-is; `@theme`, CSS Modules, and
  PostCSS palettes are unavailable. OKLCH literals are used instead of Tailwind's `@theme` block.
- **System fonts only.** A finance PWA that installs offline should not fetch a webfont.
- **Lightpanda 1.6.0 cannot render canvas** (`Path2D is not defined`), so chart contrast
  cannot be verified by screenshot in the smoke test. It has to be verified by resolving
  the token values and computing ratios — which is why the ratios below are recorded here
  rather than eyeballed.

## Goals / Non-Goals

**Goals:**
- One token vocabulary, two theme mappings, no per-component color literals.
- Every data-bearing token clears WCAG AA (4.5:1) against every surface it can land on.
- The chart inherits the token layer exactly like any other element.
- The whole change fits in one commit with no dependency movement.

**Non-Goals:**
- A standalone `theme-and-styling` capability or spec. Visual contracts live with the
  capability whose output they describe.
- Replacing `uPlot`. Verified in `node_modules/uplot/dist/uPlot.d.ts` that it exposes
  everything this change needs: per-series `stroke`, `class`, `dash`, `width`, the `draw`
  hook already in use, and `redraw(rebuildPaths)` for live restyle. Chart.js adds ~30KB
  and ECharts ~900KB to solve a problem the installed library does not have.
- Animations, transitions, or chart interaction affordances.
- Hex-only token authoring. `color-mix()` is already used in this codebase and resolves
  in both themes, so it stays.

## Decisions

### Two-tier token model, not one flat block

Primer's shape: a raw palette layer plus a role layer on top. The role layer is what
components consume; the palette layer is what a rebrand edits.

```css
:root {
  /* palette — the only place a literal hex appears */
  --stone-50 …  --stone-950
  --amber-500 … --amber-700
  --red-700, --green-700, --yellow-700

  /* roles — the only thing components reference */
  --bg, --bg-panel, --bg-inset
  --fg, --fg-muted, --fg-on-emphasis
  --accent, --danger, --success, --warning
  --chart-cash, --chart-assets
  --border
}
```

**Why:** the current block has `--color-fg` and `--color-danger` doing double duty as
"text color" and "marker color", so a marker can never be tuned independently of text.
Role separation is what makes the chart a first-class token consumer.

**Alternative:** flat semantic tokens only. Fewer lines, but a rebrand means editing every
role by hand and the palette stops being a single source of truth.

### Theme selection via `.theme-light` / `.theme-dark` on `<html>`, not media queries

The current file relies on `@media (prefers-color-scheme: dark)`. A user-selectable toggle
cannot express "light, even though my OS is dark" with a media query — it would need a
second competing rule.

```css
:root            { /* light tokens */ }
:root.theme-dark { /* dark tokens */ }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) { /* dark tokens */ }
}
```

`data-theme` absent means "follow the system". The media query is scoped to
`:not([data-theme])` so an explicit choice always wins.

**Why:** three states, one rule each, no specificity war.

**Alternative:** keep media queries only and skip the toggle. Smaller diff, but the user
asked for a complete rework and a theme you cannot override is a theme you do not control.

### Chart reads tokens once per draw cycle, not per paint

```ts
const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
```

Called inside the effect that also owns `plotRef`. On theme change the effect re-runs,
mutates `series[i].stroke` and calls `plotRef.current.redraw(true)` — `rebuildPaths = true`
discards the cached `Path2D` so the new stroke actually repaints.

**Why:** one read site, one invalidation path. A `matchMedia` listener or a `MutationObserver`
on the `<html>` class would both be more code for the same result, because the effect
already depends on everything that changes the chart.

**Alternative:** re-instantiate `uPlot` on theme change. Correct, but tears down and rebuilds
the canvas, loses any internal state, and re-fires the `draw` hook for every marker. `redraw`
is the narrower operation.

### Dash pattern carries the series distinction, hue carries emphasis

`cash` is solid, `assets_value` is `[5,3]`. This is already true today; the delta keeps it
and adds the rationale to the spec so it is not "tidied away" later.

**Why:** the spec delta now requires the two series to be separable without hue. A dash
pattern survives grayscale and dichromatic vision for free, whereas two similar-hue strokes
do not. Making it a spec requirement rather than a style choice is the point.

### Contrast ratios are computed and recorded, not assumed

Values below are the resolved token contrasts against every surface they can appear on.
Recorded so a future rebrand can check against a number instead of an opinion.

```
LIGHT (panel #ffffff, bg #faf9f7, inset #f4f2ee)
  fg       #1a1815   17.72 : 1   AAA
  muted    #57534e    7.63 : 1   AAA
  cash     #1a1815   17.72 : 1   AAA
  assets   #6e685f    5.51 : 1   AA
  accent   #a8540e    5.33 : 1   AA
  danger   #a12929    7.33 : 1   AAA
  success  #1f6f3a    6.19 : 1   AA
  warning  #8a6200    5.49 : 1   AA
  border   #ddd8ce    1.42 : 1   vs bg — panel edge, non-text

DARK (panel #16140f, bg #0e0d0a, inset #1f1c14)
  fg       #f5f1e8   16.33 : 1   AAA
  muted    #a8a195    7.18 : 1   AAA
  cash     #f5f1e8   16.33 : 1   AAA
  assets   #a39a8c    6.62 : 1   AA
  accent   #e88a2b    7.10 : 1   AAA
  danger   #e76f6f    6.05 : 1   AA
  success  #5ab870    7.47 : 1   AAA
  warning  #e0b341    9.37 : 1   AAA
  border   #3a352a    1.51 : 1   vs bg — panel edge, non-text
```

`--chart-cash` aliases `--fg` and `--chart-assets` is deliberately a distinct muted step,
not `--fg-muted` — the asset line should read as subordinate to the cash line, not as
secondary text.

**Note on the graphical-object floor.** The spec delta holds chart strokes, tick labels,
and markers to 3:1 (WCAG 1.4.11, non-text contrast) rather than 4.5:1. Every one of them
clears 4.5:1 anyway, so the floor is a regression guard, not a target.

### Theme preference persists under its own key

`tsender.theme` in `localStorage`, separate from the existing single-key scenario store
governed by capability `scenario-authoring`. A missing, unparseable, or out-of-range value
falls back to `"system"` without throwing.

**Why:** the scenario store's contract is "ignore anything that is not scenario-shaped".
Mixing a theme enum into that object would make the existing corrupt-state scenario
ambiguous and would need a migration story for states already in the wild.

**Alternative:** add `theme` to the persisted scenario object. Fewer keys, but it couples
two unrelated lifetimes — resetting a scenario should not reset the reader's contrast
preference, and that coupling would be a bug waiting for a user to find.

## Risks / Trade-offs

**[Two token layers is more indirection than a flat block]** → The palette layer is nine
lines and is touched only on rebrand. If a future edit needs a color that no role expresses,
add a role rather than reaching past it — otherwise the layering has already failed.

**[`getComputedStyle` on every effect run forces a style recalc** → Irrelevant at this
cadence: the effect runs on scenario data change, at most 10×/sec under the existing
debounce, and the read is a handful of custom properties on the root element.

**[`:not([data-theme])` is subtle and easy to break when editing the media query]** → The
token blocks are duplicated by necessity. A comment marks the media-query block with an
explicit warning that dropping the `:not()` selector silently overrides a user's explicit
choice.

**[lightpanda cannot render canvas, so the chart is unverifiable by the documented smoke test]** →
Contrast is asserted in a unit test against resolved token values instead, which is stronger
than the screenshot it replaces: the screenshot never checked the ratio, only that a number
appeared.

**[Tokens get authored as OKLCH but the existing file uses hex]** → Consistent enough —
both are valid CSS colors, and OKLCH is used because the palette was copied from Tailwind 4
verbatim, so hex values would be hand-converted and lose their provenance.

## Migration Plan

Single commit, no staged rollout. Nothing persisted depends on the old token names, and
nothing in `src/model/` or `src/scenario/` is touched. Rollback is `git revert`.

The one behavioral change visible to an existing user is that `tsender.theme` may appear in
`localStorage` on first visit. No existing code reads that key, so an old app version
ignores it.

## Open Questions

None. The remaining choices are token values within the ranges fixed above, and those are
testable rather than debatable.