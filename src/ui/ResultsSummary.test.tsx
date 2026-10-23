/**
 * Summary hierarchy.
 *
 * Spec: openspec/changes/rework-style-inkwell/specs/results-display/spec.md —
 * numeric values render with tabular figures, and the two high-severity rows
 * are distinguished by typographic weight or scale rather than by color alone,
 * so they stay legible in grayscale.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ResultsSummary } from "@/ui/ResultsSummary";
import type { RunResult } from "@/scenario/types";

const CSS = readFileSync(join(__dirname, "styles.css"), "utf8");

const RESULT: RunResult = {
  months: [
    { month: 0, cash: 500_000, assets_value: 0, monthly_cashflow: 50_000 },
    { month: 1, cash: 550_000, assets_value: 10_000, monthly_cashflow: 50_000 },
    { month: 2, cash: 600_000, assets_value: 20_000, monthly_cashflow: 50_000 },
  ],
} as RunResult;

describe("ResultsSummary", () => {
  it("marks the two high-severity rows", () => {
    render(<ResultsSummary result={RESULT} />);
    const keyRows = document.querySelectorAll(".results-summary tr.key");
    expect(keyRows).toHaveLength(2);
    const labels = [...keyRows].map((r) => r.querySelector("th")?.textContent);
    expect(labels).toEqual(["Final cash", "Minimum cash"]);
  });

  it("leaves the supporting rows unmarked", () => {
    render(<ResultsSummary result={RESULT} />);
    const allRows = document.querySelectorAll(".results-summary tbody tr");
    const keyRows = document.querySelectorAll(".results-summary tbody tr.key");
    expect(allRows.length).toBeGreaterThan(keyRows.length);
    for (const row of keyRows) {
      expect(row.querySelector("th")).toBeTruthy();
    }
  });

  it("keeps the other key statistics visible", () => {
    render(<ResultsSummary result={RESULT} />);
    expect(screen.getByText("Final assets")).toBeTruthy();
    expect(screen.getByText("First insolvent month")).toBeTruthy();
    expect(screen.getByText("never")).toBeTruthy();
  });
});

describe("summary styling", () => {
  it("renders numeric cells with tabular figures", () => {
    const rule = CSS.match(/\.results-summary td\s*\{[^}]*\}/);
    expect(rule, "results-summary td rule not found").not.toBeNull();
    expect(rule![0]).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });

  it("distinguishes key rows by weight or scale, never by color", () => {
    const rule = CSS.match(/\.results-summary tr\.key[\s\S]*?\n\}/);
    expect(rule, "key-row rule not found").not.toBeNull();
    expect(rule![0]).toMatch(/font-weight:\s*600|font-size/);
    // The point of the spec delta: no color-based emphasis.
    expect(rule![0]).not.toMatch(/^\s*(color|background|border)/m);
  });
});