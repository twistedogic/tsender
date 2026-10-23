/**
 * Candidate replay.
 *
 * Spec: openspec/changes/event-target-picker/specs/scenario-authoring/spec.md —
 * a targeting event offers exactly the items active at its month.
 *
 * The replay lives in src/ui/ rather than src/model/ because it is presentational
 * bookkeeping with no financial meaning. That makes fidelity to runScenario a
 * property enforced here rather than by shared code, which is what task 1.4 pins.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { activeItems, candidatesFor } from "@/ui/activeItems";
import type { Scenario } from "@/scenario/types";

const base: Scenario = { cash: 100_000, events: [] };

function at(...events: Scenario["events"]): Scenario {
  return { ...base, events };
}

function names(items: { name: string }[]): string[] {
  return items.map((i) => i.name).sort();
}

describe("activeItems", () => {
  it("omits an item defined after the month", () => {
    // Spec: a job named "main job" at month 12 is absent from a layoff at month 6.
    const s = at(
      { type: "layoff", when: 6 },
      { type: "job", when: 12, id: "main job", salary: { monthly: 30_000, annualized_rate: 0 } },
    );
    expect(names(activeItems(s, 6))).toEqual([]);
    expect(names(activeItems(s, 12))).toEqual(["main job"]);
  });

  it("drops an item consumed by an earlier event", () => {
    // Spec: "school" ends at month 24 and is absent at month 36.
    const s = at(
      { type: "expense", when: 0, id: "school", expense: { monthly: 5_000, annualized_rate: 0 } },
      { type: "end", when: 24, id: "school" },
    );
    expect(names(activeItems(s, 24))).toEqual([]);
    expect(names(activeItems(s, 36))).toEqual([]);
  });

  it("orders a defining event before a consumer at the same month", () => {
    // Insertion order decides within a month, per scenario-loading. A defining
    // event listed first is live when the consumer fires.
    const definedFirst = at(
      { type: "expense", when: 24, id: "school", expense: { monthly: 5_000, annualized_rate: 0 } },
      { type: "end", when: 24, id: "school" },
    );
    expect(names(activeItems(definedFirst, 24))).toEqual([]);

    // Listed the other way round, the consumer fires before the item exists and
    // misses — the same no-op the simulator would perform.
    const consumedFirst = at(
      { type: "end", when: 24, id: "school" },
      { type: "expense", when: 24, id: "school", expense: { monthly: 5_000, annualized_rate: 0 } },
    );
    expect(names(activeItems(consumedFirst, 24))).toEqual(["school"]);
  });

  it("ignores an end that names nothing", () => {
    // Task 1.3: a miss is a no-op, not a throw.
    const s = at(
      { type: "job", when: 0, id: "main job", salary: { monthly: 30_000, annualized_rate: 0 } },
      { type: "end", when: 6, id: "ghost" },
    );
    expect(() => activeItems(s, 6)).not.toThrow();
    expect(names(activeItems(s, 6))).toEqual(["main job"]);
  });

  it("ignores a layoff that names nothing and does not remove the first job", () => {
    const s = at(
      { type: "job", when: 0, id: "main job", salary: { monthly: 30_000, annualized_rate: 0 } },
      { type: "layoff", when: 6 },
    );
    // The simulator's no-id fallback is not id-addressed, so the replay cannot
    // model it and leaves the item listed. Documented in design.md.
    expect(names(activeItems(s, 6))).toEqual(["main job"]);
  });

  it("collects every kind a defining event can name", () => {
    const s = at(
      { type: "job", when: 0, id: "job-1", salary: { monthly: 1, annualized_rate: 0 } },
      { type: "expense", when: 0, id: "exp-1", expense: { monthly: 1, annualized_rate: 0 } },
      { type: "tuition", when: 0, id: "tui-1", tuition: { monthly: 1, annualized_rate: 0 } },
      { type: "withdrawal", when: 0, id: "wd-1", withdrawal: { monthly: 1, annualized_rate: 0 } },
      { type: "one_off_expense", when: 0, id: "oo-1", one_off: { amount: 1 } },
      { type: "buy_home", when: 0, home: { sqft: 400, price_per_sqft: 1, mortgage: { monthly: 1, period: 12, id: "mt-1" } } },
      { type: "buy_to_let", when: 0, to_let: { sqft: 400, price_per_sqft: 1, rent: { monthly: 1, annualized_rate: 0, occupancy: 1, id: "rt-1" } } },
      { type: "investment", when: 0, fund: { principal: 1, annualized_rate: 0, investment: { monthly: 1, annualized_rate: 0, id: "ct-1" } } },
    );
    expect(names(activeItems(s, 0))).toEqual([
      "ct-1", "exp-1", "job-1", "mt-1", "oo-1", "rt-1", "tui-1", "wd-1",
    ]);
  });

  it("does not list an item a defining event left unnamed", () => {
    // Spec: naming is optional and an unnamed item appears in no list.
    const s = at({ type: "job", when: 0, salary: { monthly: 30_000, annualized_rate: 0 } });
    expect(names(activeItems(s, 0))).toEqual([]);
  });

  it("keeps a mortgage alive across a refinance", () => {
    const s = at(
      { type: "buy_home", when: 0, home: { sqft: 400, price_per_sqft: 1, mortgage: { monthly: 1, period: 12, id: "mt-1" } } },
      { type: "refinance", when: 12, id: "mt-1", monthly: 2 },
    );
    expect(names(activeItems(s, 24))).toEqual(["mt-1"]);
  });

  it("returns items in creation order", () => {
    const s = at(
      { type: "job", when: 0, id: "zeta", salary: { monthly: 1, annualized_rate: 0 } },
      { type: "job", when: 5, id: "alpha", salary: { monthly: 1, annualized_rate: 0 } },
    );
    expect(activeItems(s, 10).map((i) => i.name)).toEqual(["zeta", "alpha"]);
  });
});

describe("candidatesFor", () => {
  const both = at(
    { type: "job", when: 0, id: "the job", salary: { monthly: 1, annualized_rate: 0 } },
    { type: "buy_to_let", when: 0, to_let: { sqft: 400, price_per_sqft: 1, rent: { monthly: 1, annualized_rate: 0, occupancy: 1, id: "the rent" } } },
  );

  it("offers a pay_change only salaries", () => {
    // Spec: a named salary and a named rent are both live; pay_change offers one.
    expect(names(candidatesFor(both, 30, "pay_change"))).toEqual(["the job"]);
  });

  it("offers a refinance only mortgages", () => {
    const s = at(
      { type: "buy_home", when: 0, home: { sqft: 400, price_per_sqft: 1, mortgage: { monthly: 1, period: 12, id: "mt-1" } } },
      { type: "job", when: 0, id: "job-1", salary: { monthly: 1, annualized_rate: 0 } },
    );
    expect(names(candidatesFor(s, 30, "refinance"))).toEqual(["mt-1"]);
  });

  it("offers an end every kind", () => {
    expect(names(candidatesFor(both, 30, "end"))).toEqual(["the job", "the rent"]);
  });

  it("offers a layoff any created item", () => {
    expect(names(candidatesFor(both, 30, "layoff"))).toEqual(["the job", "the rent"]);
  });
});

describe("boundary", () => {
  // Task 1.4: the replay must not reach into the simulator. Matched against
  // import statements only — the prose above refers to runScenario on purpose.
  const src = readFileSync(join(__dirname, "activeItems.ts"), "utf8");
  const imports = src.match(/^\s*import\b[\s\S]*?from\s+["'][^"']+["'];?/gm) ?? [];

  it("imports nothing from src/model", () => {
    expect(imports.join("\n")).not.toMatch(/model/);
  });

  it("does not import runScenario", () => {
    expect(imports.join("\n")).not.toMatch(/runScenario/);
  });
});