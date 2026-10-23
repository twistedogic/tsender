/**
 * Yearly trajectory table.
 *
 * Spec: openspec/changes/remove-chart/specs/results-display/spec.md —
 * one row per 12-month bucket from month 0, each row showing its bucket's
 * last month; a short final row carries its month count; marker months are
 * noted on the row whose year contains them.
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TrajectoryTable, yearRows } from "@/ui/TrajectoryTable";
import type { MonthResult } from "@/scenario/types";

const CSS = readFileSync(join(__dirname, "styles.css"), "utf8");

/** A run of `count` months with recognisable figures at every index. */
function months(count: number): MonthResult[] {
  return Array.from({ length: count }, (_, i) => ({
    month: i,
    cash: 1000 * (i + 1),
    assets_value: 10 * (i + 1),
    monthly_cashflow: 100 + i,
  }));
}

describe("yearRows", () => {
  it("buckets the run into one row per year", () => {
    const rows = yearRows(months(361));
    expect(rows).toHaveLength(31);
    expect(rows[0]).toMatchObject({
      label: "Year 1",
      month: 11,
      cash: 12_000,
      assets: 120,
      flow: 111,
    });
    expect(rows[29]).toMatchObject({
      label: "Year 30",
      month: 359,
      cash: 360_000,
      assets: 3600,
      flow: 459,
    });
  });

  it("marks a final row that covers fewer than twelve months", () => {
    const rows = yearRows(months(25));
    expect(rows).toHaveLength(3);
    expect(rows[1]!.label).toBe("Year 2");
    expect(rows[2]!.label).toBe("Year 3 · 1 mo");
    expect(rows[2]!.month).toBe(24);
  });

  it("handles a run of a single month", () => {
    const rows = yearRows(months(1));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.label).toBe("Year 1 · 1 mo");
  });

  it("notes each marker on the row whose year contains it", () => {
    const rows = yearRows(months(361), {
      insolvencyMonth: 47,
      savingBreachMonth: 96,
      terminalMonth: 240,
      passiveIncomeMonth: 120,
    });
    const rowFor = (month: number) => rows[Math.floor(month / 12)];
    expect(rowFor(47)!.notes).toEqual(["insolvent"]);
    expect(rowFor(96)!.notes).toEqual(["saving breached"]);
    expect(rowFor(120)!.notes).toEqual(["passive covers"]);
    expect(rowFor(240)!.notes).toEqual(["terminal"]);
    expect(rows.flatMap((r) => r.notes)).toHaveLength(4);
  });

  it("leaves every row unnoted when no marker fires", () => {
    const rows = yearRows(months(361));
    expect(rows.flatMap((r) => r.notes)).toEqual([]);
  });
});

describe("TrajectoryTable", () => {
  it("renders a header and one row per year", () => {
    render(<TrajectoryTable months={months(25)} />);
    const headers = [
      ...document.querySelectorAll(".trajectory-table thead th"),
    ].map((th) => th.textContent);
    expect(headers).toEqual([
      "Year",
      "Cash",
      "Assets",
      "Net worth",
      "Monthly flow",
      "Notes",
    ]);
    expect(document.querySelectorAll(".trajectory-table tbody tr")).toHaveLength(3);
  });

  it("shows the bucket's last month, with net worth as cash plus assets", () => {
    render(<TrajectoryTable months={months(25)} />);
    const row = document.querySelectorAll(".trajectory-table tbody tr")[0]!;
    expect(row.querySelector("th")?.textContent).toBe("Year 1");
    const cells = [...row.querySelectorAll("td")].map((td) => td.textContent);
    expect(cells).toEqual(["12,000", "120", "12,120", "111", ""]);
  });

  it("shows a marker's note in its row", () => {
    render(
      <TrajectoryTable months={months(361)} markers={{ insolvencyMonth: 47 }} />,
    );
    const rows = [...document.querySelectorAll(".trajectory-table tbody tr")];
    expect(rows[3]!.querySelector("td.trajectory-notes")?.textContent).toBe(
      "insolvent",
    );
    expect(rows.filter((r) => r.querySelector("td.trajectory-notes")?.textContent)).toHaveLength(1);
  });
});

describe("trajectory table styling", () => {
  it("scrolls inside its own column rather than scrolling the page", () => {
    const rule = CSS.match(/\.trajectory-scroll\s*\{[^}]*\}/);
    expect(rule, "trajectory-scroll rule not found").not.toBeNull();
    expect(rule![0]).toMatch(/overflow-x:\s*auto/);
    expect(rule![0]).toMatch(/max-height:/);
  });

  it("renders numeric cells with tabular figures", () => {
    const rule = CSS.match(/\.trajectory-table td\s*\{[^}]*\}/);
    expect(rule, "trajectory-table td rule not found").not.toBeNull();
    expect(rule![0]).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });
});
