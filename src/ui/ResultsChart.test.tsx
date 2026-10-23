/**
 * Chart theming.
 *
 * Spec: openspec/changes/rework-style-inkwell/specs/results-display/spec.md —
 * series strokes and markers read the theme tokens, differ between themes, and
 * reach 3:1 against the chart background in every theme.
 *
 * uPlot is mocked: what this test owns is which colors the chart hands it, not
 * what uPlot paints. Token *values* per theme are asserted in tokens.test.ts.
 *
 * jsdom does not substitute `var()` chains when reporting a custom property,
 * so a theme swap is simulated with inline custom properties on <html>. That
 * exercises the chart's read-and-restyle path without depending on jsdom's
 * cascade support.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MonthResult } from "@/scenario/types";
import type uPlot from "uplot";

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserver;

Object.defineProperty(HTMLElement.prototype, "clientWidth", {
  configurable: true,
  value: 800,
});

/** Options passed to each uPlot construction, in order. */
const constructed: uPlot.Options[] = [];
/** Every FakeUPlot instance, so a test can assert on the live plot. */
const instances: { series: uPlot.Series[]; redrawCount: number }[] = [];

vi.mock("uplot", () => {
  class FakeUPlot {
    series: uPlot.Series[];
    redrawCount = 0;
    constructor(opts: uPlot.Options) {
      constructed.push(opts);
      this.series = opts.series as uPlot.Series[];
      instances.push(this);
    }
    setData() {}
    setSize() {}
    redraw() {
      this.redrawCount++;
    }
    destroy() {}
  }
  return { default: FakeUPlot };
});

const { ResultsChart } = await import("@/ui/ResultsChart");

const MONTHS: MonthResult[] = [
  { month: 0, cash: 500_000, assets_value: 0, monthly_cashflow: 50_000 },
  { month: 1, cash: 550_000, assets_value: 10_000, monthly_cashflow: 50_000 },
  { month: 2, cash: 600_000, assets_value: 20_000, monthly_cashflow: 50_000 },
];

/** What the DOM reports for a custom property. */
function reported(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function fakePlot(): uPlot {
  return {
    ctx: {
      save() {}, restore() {}, setLineDash() {}, beginPath() {},
      moveTo() {}, lineTo() {}, stroke() {},
      strokeStyle: "", lineWidth: 0,
    },
    scales: { x: { min: 0, max: 2 } },
    valToPos: () => 10,
    bbox: { top: 0, height: 100 },
  } as unknown as uPlot;
}

beforeEach(() => {
  constructed.length = 0;
  instances.length = 0;
  document.documentElement.removeAttribute("style");
  document.documentElement.classList.remove("theme-dark");
});

afterEach(() => {
  document.documentElement.removeAttribute("style");
  document.documentElement.classList.remove("theme-dark");
});

/** The single plot instance the component under test built. */
function plot(): { series: uPlot.Series[]; redrawCount: number } {
  expect(instances, "no uPlot instance was constructed").toHaveLength(1);
  return instances[0]!;
}

/** Series config the chart handed uPlot, by series index. */
function seriesAt(i: number): uPlot.Series {
  expect(constructed[0], "no uPlot construction recorded").toBeDefined();
  return constructed[0]!.series[i]!;
}

describe("ResultsChart theming", () => {
  it("passes each series the value of its token", () => {
    document.documentElement.style.setProperty("--chart-cash", "#101112");
    document.documentElement.style.setProperty("--chart-assets", "#4a4b4c");
    render(<ResultsChart months={MONTHS} />);

    expect(constructed).toHaveLength(1);
    expect(seriesAt(1).stroke).toBe("#101112");
    expect(seriesAt(1).stroke).toBe(reported("--chart-cash"));
    expect(seriesAt(2).stroke).toBe("#4a4b4c");
    expect(seriesAt(2).stroke).toBe(reported("--chart-assets"));
  });

  it("re-reads tokens and restyles on a theme change", () => {
    document.documentElement.style.setProperty("--chart-cash", "#101112");
    const { rerender } = render(<ResultsChart months={MONTHS} />);
    expect(seriesAt(1).stroke).toBe("#101112");

    document.documentElement.style.setProperty("--chart-cash", "#e8e9ea");
    document.documentElement.style.setProperty("--chart-assets", "#9a9b9c");
    rerender(<ResultsChart months={MONTHS} theme="dark" />);

    // The existing plot was restyled rather than rebuilt.
    expect(constructed).toHaveLength(1);
    expect(plot().series[1]!.stroke).toBe("#e8e9ea");
    expect(plot().series[2]!.stroke).toBe("#9a9b9c");
    // redraw(true) discards the cached Path2D so the new stroke repaints.
    expect(plot().redrawCount).toBeGreaterThan(0);
  });

  it("distinguishes the two series without relying on hue alone", () => {
    render(<ResultsChart months={MONTHS} />);
    // assets_value keeps a dash pattern, which survives grayscale and
    // dichromatic vision where two similar hues do not.
    expect(seriesAt(2).dash).toEqual([5, 3]);
    expect(seriesAt(1).dash).toBeFalsy();
  });

  it("resolves marker colours from tokens", () => {
    document.documentElement.style.setProperty("--danger", "#aa0000");
    document.documentElement.style.setProperty("--warning", "#bb7700");
    document.documentElement.style.setProperty("--accent", "#cc8800");
    render(<ResultsChart months={MONTHS} insolvencyMonth={1} />);

    const draw = constructed[0]!.hooks!.draw as Array<(u: uPlot) => void>;
    const p = fakePlot();
    const strokes: string[] = [];
    p.ctx.stroke = function (this: { strokeStyle: string }) {
      strokes.push(this.strokeStyle);
    };

    draw[0]!(p);
    // insolvency, saving-breach (unset) and terminal (unset): one marker only.
    expect(strokes).toEqual(["#aa0000"]);
  });

  it("draws no marker outside the x range", () => {
    render(<ResultsChart months={MONTHS} insolvencyMonth={999} />);
    const draw = constructed[0]!.hooks!.draw as Array<(u: uPlot) => void>;
    const p = fakePlot();
    let drew = false;
    p.ctx.stroke = () => {
      drew = true;
    };
    draw[0]!(p);
    expect(drew).toBe(false);
  });

  it("contains no paint literal in the chart module", () => {
    const src = readFileSync(join(__dirname, "ResultsChart.tsx"), "utf8");
    const literals = src.match(/["']#[0-9a-f]{3,8}["']/gi) ?? [];
    expect(
      literals,
      `stray hex in ResultsChart.tsx: ${literals.join(", ")}`,
    ).toEqual([]);
  });
});