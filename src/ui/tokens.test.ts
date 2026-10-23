/**
 * Token contrast contract.
 *
 * Spec: openspec/changes/rework-style-inkwell/specs/results-display/spec.md —
 * every data-bearing token reaches AA (4.5:1) against every surface it can land on.
 *
 * jsdom does not resolve stylesheet custom properties, so this reads styles.css
 * and parses the token blocks directly. That is the source of truth anyway:
 * no browser is in the test loop, so nothing downstream verifies these ratios.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(join(__dirname, "styles.css"), "utf8");

/** Relative luminance per WCAG 2.1. */
function luminance(color: string): number {
  const hex = color.trim().replace("#", "");
  expect(hex, `unparseable color "${color}"`).toMatch(/^[0-9a-f]{6}$/i);
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
  );
}

function contrast(a: string, b: string): number {
  const lums = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lums[0]! + 0.05) / (lums[1]! + 0.05);
}

/**
 * Tokens in effect for one theme block, with `var()` aliases resolved.
 * Each theme block is self-contained, so no cross-block merge is needed.
 */
function tokensInBlock(openPattern: RegExp): Map<string, string> {
  const open = CSS.match(openPattern);
  expect(open, `no token block matching ${openPattern}`).not.toBeNull();
  const start = open!.index! + open![0].length;
  const body = CSS.slice(start, CSS.indexOf("}", start));
  const raw = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    raw.set(name!, value!.trim());
  }

  const resolved = new Map<string, string>();
  for (const name of raw.keys()) {
    let value = raw.get(name)!;
    for (let i = 0; i < 5 && value.startsWith("var("); i++) {
      const match = value.match(/var\((--[\w-]+)\)/);
      if (!match) break;
      const next = raw.get(match[1]!);
      if (next === undefined) break;
      value = next;
    }
    resolved.set(name, value);
  }
  return resolved;
}

const LIGHT = tokensInBlock(/:root\s*\{/);
const DARK = tokensInBlock(/:root\.theme-dark\s*\{/);

/** Tokens that carry data and therefore must clear the text threshold. */
const DATA_TOKENS = [
  "--fg",
  "--fg-muted",
  "--accent",
  "--danger",
  "--success",
  "--warning",
];

const SURFACES = ["--bg-panel", "--bg", "--bg-inset"];

describe.each([
  ["light", LIGHT],
  ["dark", DARK],
])("token contrast (%s theme)", (_name, theme) => {
  for (const token of DATA_TOKENS) {
    it(`defines ${token}`, () => {
      expect(theme.has(token), `${token} missing`).toBe(true);
    });

    for (const surface of SURFACES) {
      it(`${token} clears 4.5:1 against ${surface}`, () => {
        const value = theme.get(token)!;
        const bg = theme.get(surface)!;
        const ratio = contrast(value, bg);
        expect(
          ratio,
          `${token} ${value} on ${surface} ${bg} is ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe("token structure", () => {
  it("keeps every literal hex inside a theme block", () => {
    // A literal outside the theme blocks means a component reached past the
    // role layer — see design.md, "Two-tier token model".
    const outside = CSS.replace(
      /(:root\s*\{|:root\.theme-dark\s*\{|:root:not\(\[data-theme\]\)\s*\{)[\s\S]*?\n  \}/g,
      "",
    );
    const stray = outside.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    expect(stray, `stray hex literals: ${stray.join(", ")}`).toEqual([]);
  });

  it("scopes the prefers-color-scheme block to :not([data-theme])", () => {
    // Dropping the guard lets the system override an explicit user choice.
    expect(CSS).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)[\s\S]*:root:not\(\[data-theme\]\)/);
  });

  it("uses tabular numerals for the summary table", () => {
    expect(CSS).toMatch(/\.results-summary td[\s\S]*?font-variant-numeric:\s*tabular-nums/);
  });

  it("separates panels with a border rather than a shadow", () => {
    const panelRule = CSS.match(/\.editor,\s*\.results\s*\{[\s\S]*?\n\}/);
    expect(panelRule, "panel rule not found").not.toBeNull();
    expect(panelRule![0]).toMatch(/border:\s*1px solid var\(--border\)/);
    expect(panelRule![0]).not.toMatch(/box-shadow/);
  });

  it("marks the two high-severity summary rows by weight, not color", () => {
    const rule = CSS.match(/\.results-summary tr\.key[\s\S]*?\n\}/);
    expect(rule, "key-row rule not found").not.toBeNull();
    expect(rule![0]).toMatch(/font-weight:\s*600/);
    expect(rule![0]).not.toMatch(/(color|background)/);
  });

  it("gives every interactive element a focus ring from the accent token", () => {
    const rule = CSS.match(/button:focus-visible[\s\S]*?\n\}/);
    expect(rule, "focus-visible rule not found").not.toBeNull();
    expect(rule![0]).toMatch(/outline:\s*2px solid var\(--accent\)/);
    // Inputs, selects and summaries must be keyboard-reachable too.
    expect(CSS).toMatch(/input:focus-visible/);
    expect(CSS).toMatch(/select:focus-visible/);
    expect(CSS).toMatch(/summary:focus-visible/);
  });

  it("keeps tap targets at 44px on narrow viewports", () => {
    const rule = CSS.match(/@media \(max-width: 480px\)\s*\{[^}]*\}/);
    expect(rule, "narrow-viewport block not found").not.toBeNull();
    expect(rule![0]).toMatch(/min-height:\s*44px/);
  });

  it("reads no pre-rework token names", () => {
    expect(CSS).not.toMatch(/--color-/);
    expect(CSS).not.toMatch(/var\(--shadow\)/);
  });
});