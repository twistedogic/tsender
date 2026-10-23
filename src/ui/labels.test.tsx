/**
 * Field titles are human-readable.
 *
 * The scenario schema is snake_case, but the form is read by a person: a field
 * titled `reserve_months` or `annualized_rate` reads like a leaked key. Every
 * visible title — labels, legends, headings and option text — must be prose.
 *
 * One scenario containing every event type exercises every title the form can
 * render, so a single assertion covers the whole surface.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScenarioForm } from "@/ui/ScenarioForm";
import { humanize } from "@/ui/labels";
import type { Scenario } from "@/scenario/types";

const EVERYTHING: Scenario = {
  cash: 500_000,
  reserve_months: 6,
  start: "2025-01",
  end: "2055-01",
  saving: 100_000,
  events: [
    { type: "job", when: 0, id: "a", salary: { monthly: 30_000, annualized_rate: 0.03 } },
    { type: "pension", when: 1, pension: { monthly: 10_000, annualized_rate: 0 } },
    { type: "expense", when: 2, id: "b", expense: { monthly: 12_000, annualized_rate: 0.02 } },
    { type: "tuition", when: 3, tuition: { monthly: 5_000, annualized_rate: 0.02 } },
    { type: "withdrawal", when: 4, withdrawal: { monthly: 1_000, annualized_rate: 0 } },
    { type: "layoff", when: 5, id: "c" },
    { type: "graduate", when: 6, id: "d" },
    { type: "buy_home", when: 7, home: { sqft: 500, price_per_sqft: 8_000, mortgage: { monthly: 10_000, period: 240, id: "m" } } },
    {
      type: "buy_to_let",
      when: 8,
      to_let: {
        sqft: 400,
        price_per_sqft: 6_000,
        rent: { monthly: 12_000, annualized_rate: 0.02, occupancy: 0.95, id: "r" },
      },
    },
    {
      type: "investment",
      when: 9,
      fund: {
        principal: 200_000,
        annualized_rate: 0.07,
        investment: { monthly: 5_000, annualized_rate: 0.07, id: "i" },
      },
    },
    { type: "end", when: 10, id: "e" },
    { type: "one_off_expense", when: 11, id: "f", one_off: { amount: 50_000 } },
    { type: "one_off_income", when: 12, one_off: { amount: 20_000 } },
    { type: "death", when: 13 },
    { type: "refinance", when: 14, id: "g", monthly: 9_000 },
    { type: "pay_change", when: 15, monthly: 35_000, annualized_rate: 0.04 },
    { type: "downturn", when: 16, equity_drop: 0.3, property_drop: 0.2 },
  ],
  tax: {
    status: "married",
    children: 2,
    parents: [{ age_band: "55-59", living_with: true }],
  },
};

/**
 * A title leaks the schema when it contains an underscored key or a bare
 * lowercase `id` / `when`. Case-sensitive on purpose: "ID (optional)" and
 * "Monthly" are correct prose; "id (optional)" is a leaked key.
 */
const LEAKED_KEY = /_[a-z]|\bid\b|\bwhen\b/;

/** Every place the form can put a visible title. */
function visibleTitles(): string[] {
  return [...document.querySelectorAll("label, legend, h2, h3, h4, option, summary")]
    .map((el) => (el.textContent ?? "").trim())
    .filter(Boolean);
}

describe("field titles", () => {
  it("never shows a schema key verbatim", () => {
    render(<ScenarioForm scenario={EVERYTHING} onChange={() => {}} />);
    const offenders = visibleTitles().filter((t) => LEAKED_KEY.test(t));
    expect(offenders, `leaked keys: ${offenders.join(" | ")}`).toEqual([]);
  });

  it("covers every event type's own fields", () => {
    render(<ScenarioForm scenario={EVERYTHING} onChange={() => {}} />);
    const titles = visibleTitles();
    expect(titles.length).toBeGreaterThan(40);
  });

  it("offers event types in prose while submitting the schema key", () => {
    render(<ScenarioForm scenario={EVERYTHING} onChange={() => {}} />);
    const options = [...document.querySelectorAll("option")];
    const oneOff = options.find(
      (o) => (o as HTMLOptionElement).value === "one_off_expense",
    );
    expect(oneOff, "one_off_expense option missing").toBeTruthy();
    expect(oneOff!.textContent).toBe("One off expense");

    const buyToLet = options.find(
      (o) => (o as HTMLOptionElement).value === "buy_to_let",
    );
    expect(buyToLet!.textContent).toBe("Buy to let");
  });

  it("does not rename the key an edited field writes to", () => {
    const onChange = vi.fn();
    render(<ScenarioForm scenario={EVERYTHING} onChange={onChange} />);

    // Locate the reserve field by its human-readable title. Field wraps its
    // label and control as siblings, so follow htmlFor to the input.
    const label = screen.getByText("Reserve months") as HTMLLabelElement;
    const input = document.getElementById(
      label.htmlFor,
    )!.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "9" } });

    expect(onChange).toHaveBeenCalled();
    const emitted = onChange.mock.calls[0]![0] as Scenario;
    expect(emitted.reserve_months).toBe(9);
    // No prose-derived key may appear in the object.
    expect(Object.keys(emitted)).toContain("reserve_months");
    expect(Object.keys(emitted)).not.toContain("Reserve months");
  });
});

describe("humanize", () => {
  it("turns a snake_case key into prose", () => {
    expect(humanize("reserve_months")).toBe("Reserve months");
    expect(humanize("cash")).toBe("Cash");
    expect(humanize("annualized_rate")).toBe("Annualized rate");
    expect(humanize("price_per_sqft")).toBe("Price per sqft");
    expect(humanize("one_off_expense")).toBe("One off expense");
    expect(humanize("buy_to_let")).toBe("Buy to let");
  });

  it("keeps a trailing hint in parentheses", () => {
    expect(humanize("occupancy (0..1)")).toBe("Occupancy (0..1)");
    expect(humanize("equity_drop (funds)")).toBe("Equity drop (funds)");
  });

  it("uppercases the ID abbreviation", () => {
    expect(humanize("id")).toBe("ID");
    expect(humanize("id (optional)")).toBe("ID (optional)");
  });

  it("leaves an already-prose label alone", () => {
    expect(humanize("Annualized rate")).toBe("Annualized rate");
    expect(humanize("rent")).toBe("Rent");
  });
});