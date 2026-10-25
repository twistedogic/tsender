/**
 * Targeting events and item names.
 *
 * Spec: openspec/changes/event-target-picker/specs/scenario-authoring/spec.md —
 * a defining event's free-text field is the item's name; a targeting event's id
 * is a choice among the items active at that month.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { ScenarioForm } from "@/ui/ScenarioForm";
import type { Scenario } from "@/scenario/types";

/** A job named "main job" at month 0, an unnamed one at month 0. */
const BASE: Scenario = {
  cash: 100_000,
  events: [
    { type: "job", when: 0, id: "main job", salary: { monthly: 30_000, annualized_rate: 0 } },
    { type: "job", when: 0, salary: { monthly: 5_000, annualized_rate: 0 } },
  ],
};

function withEvents(...events: Scenario["events"]): Scenario {
  return { ...BASE, events: [...BASE.events, ...events] };
}

/** The form wired to its own state, the way the app drives it. */
function Harness({ initial }: { initial: Scenario }) {
  const [scenario, setScenario] = useState(initial);
  return <ScenarioForm scenario={scenario} onChange={setScenario} />;
}

/**
 * The input behind a visible label. `TextField` nests its input inside the
 * label, while ScenarioForm's `Field` uses a sibling div, so handle both.
 */
function textboxFor(labelText: string): HTMLInputElement {
  const text = screen.getAllByText(labelText)[0]!;
  const label = text.closest("label") as HTMLLabelElement;
  const control = label.querySelector("input")
    ?? document.getElementById(label.htmlFor)?.querySelector("input");
  return control as HTMLInputElement;
}

describe("defining events expose a name", () => {
  it("labels the free-text field as the item's name", () => {
    render(<ScenarioForm scenario={BASE} onChange={() => {}} />);
    expect(screen.getAllByText("Name").length).toBeGreaterThan(0);
  });

  it("stores the typed name under the id key and adds no new key", () => {
    const onChange = vi.fn();
    render(<ScenarioForm scenario={BASE} onChange={onChange} />);

    const name = textboxFor("Name");
    fireEvent.change(name, { target: { value: "side gig" } });

    expect(onChange).toHaveBeenCalled();
    const emitted = onChange.mock.calls[0]![0] as Scenario;
    const job = emitted.events.find((e) => "id" in e && e.id === "side gig")!;
    expect(job).toBeTruthy();
    // Only `id` — no `name` key introduced.
    expect(Object.keys(job)).not.toContain("name");
    expect(Object.keys(emitted.events[1]!)).not.toContain("name");
  });

  it("lets the name be cleared", () => {
    const onChange = vi.fn();
    render(<ScenarioForm scenario={BASE} onChange={onChange} />);

    fireEvent.change(textboxFor("Name"), { target: { value: "" } });

    const emitted = onChange.mock.calls[0]![0] as Scenario;
    const job = emitted.events[0]!;
    expect("id" in job && job.id).toBeFalsy();
  });

  it("lets an embedded item's id be cleared", () => {
    const onChange = vi.fn();
    const s: Scenario = {
      cash: 1,
      events: [
        {
          type: "buy_home",
          when: 0,
          home: {
            sqft: 100,
            price_per_sqft: 100,
            mortgage: { monthly: 1, period: 12, id: "mt" },
          },
        },
      ],
    };
    render(<ScenarioForm scenario={s} onChange={onChange} />);

    const label = screen.getAllByText("ID (optional)")[0]!;
    const input = label.closest("label")!.querySelector("input")!;
    fireEvent.change(input, { target: { value: "" } });

    const emitted = onChange.mock.calls[0]![0] as Scenario;
    const home = emitted.events[0] as Extract<
      Scenario["events"][number],
      { type: "buy_home" }
    >;
    expect(home.home.mortgage?.id).toBeFalsy();
  });

  it("stores the name verbatim rather than humanized", () => {
    const onChange = vi.fn();
    render(<ScenarioForm scenario={BASE} onChange={onChange} />);
    fireEvent.change(textboxFor("Name"), { target: { value: "one_off thing" } });
    const emitted = onChange.mock.calls[0]![0] as Scenario;
    expect(emitted.events.some((e) => "id" in e && e.id === "one_off thing")).toBe(true);
  });

  it("keeps an unnamed item out of every choice list", () => {
    render(
      <ScenarioForm scenario={withEvents({ type: "end", when: 12, id: "main job" })} onChange={() => {}} />,
    );
    const options = [...document.querySelectorAll("option")].map((o) => o.textContent);
    // The unnamed second job has no id, so it cannot be offered.
    expect(options).toContain("main job");
    expect(options.filter((o) => o === "")).toHaveLength(0);
  });
});

describe("targeting events offer a choice", () => {
  it("renders a select rather than a text input for an end event", () => {
    render(
      <ScenarioForm scenario={withEvents({ type: "end", when: 12, id: "main job" })} onChange={() => {}} />,
    );
    // Scope to the end event's own fieldset: the job row legitimately holds
    // "main job" in its Name box, which is a text input by design.
    const row = document.querySelector('[data-testid="event-2"]')!;
    expect(row.querySelector('input[type="text"]')).toBeNull();

    const select = row.querySelector("select")!;
    expect([...select.options].map((o) => o.value)).toContain("main job");
    expect(select.getAttribute("id")).toBe(
      (row.querySelector("label") as HTMLLabelElement).htmlFor,
    );
  });

  it("filters a pay_change to salaries only", () => {
    const s = withEvents(
      { type: "buy_to_let", when: 0, to_let: { sqft: 400, price_per_sqft: 1, rent: { monthly: 1, annualized_rate: 0, occupancy: 1, id: "the rent" } } },
      { type: "pay_change", when: 30, monthly: 1, annualized_rate: 0 },
    );
    render(<ScenarioForm scenario={s} onChange={() => {}} />);
    const select = screen.getByRole("combobox", { name: /Pay change item|Target/i });
    const values = [...(select as HTMLSelectElement).options].map((o) => o.value);
    expect(values).toContain("main job");
    expect(values).not.toContain("the rent");
  });

  it("offers a refinance only mortgages", () => {
    const s = withEvents(
      { type: "buy_home", when: 0, home: { sqft: 400, price_per_sqft: 1, mortgage: { monthly: 1, period: 12, id: "mt-1" } } },
      { type: "refinance", when: 30, id: "mt-1", monthly: 2 },
    );
    render(<ScenarioForm scenario={s} onChange={() => {}} />);
    const select = screen.getByRole("combobox", { name: /Refinance item|Target/i });
    const values = [...(select as HTMLSelectElement).options].map((o) => o.value);
    expect(values).toEqual(["mt-1"]);
  });

  it("disables the select when nothing is active", () => {
    // What "Add event" produces for an end: an empty id. The spec forbids
    // constructing a target the simulator would resolve to a no-op.
    const s: Scenario = {
      cash: 1_000,
      events: [
        { type: "job", when: 0, salary: { monthly: 1, annualized_rate: 0 } },
        { type: "end", when: 12, id: "" },
      ],
    };
    render(<ScenarioForm scenario={s} onChange={() => {}} />);
    const select = screen.getByRole("combobox", { name: /End item|Target/i });
    expect((select as HTMLSelectElement).disabled).toBe(true);
    expect([...(select as HTMLSelectElement).options].map((o) => o.value)).toEqual([""]);
    expect(screen.getByText("No active items")).toBeTruthy();
  });

  it("keeps a disabled select enabled when a stored id survives", () => {
    // Two spec rules meet here: nothing is active, but the stored id must not
    // be rewritten away. The stored id wins, so the select stays usable.
    const s: Scenario = {
      cash: 1_000,
      events: [
        { type: "job", when: 0, salary: { monthly: 1, annualized_rate: 0 } },
        { type: "end", when: 12, id: "legacy target" },
      ],
    };
    render(<ScenarioForm scenario={s} onChange={() => {}} />);
    const select = screen.getByRole("combobox", { name: /End item|Target/i });
    expect((select as HTMLSelectElement).disabled).toBe(false);
    expect((select as HTMLSelectElement).value).toBe("legacy target");
  });

  it("keeps a stored id the replay did not produce", () => {
    const s: Scenario = {
      cash: 1_000,
      events: [
        { type: "job", when: 0, id: "main job", salary: { monthly: 1, annualized_rate: 0 } },
        { type: "end", when: 12, id: "legacy target" },
      ],
    };
    const onChange = vi.fn();
    render(<ScenarioForm scenario={s} onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: /End item|Target/i });
    const values = [...(select as HTMLSelectElement).options].map((o) => o.value);
    expect(values).toContain("legacy target");
    // Rendering alone must not rewrite the scenario.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows no target until one is chosen", () => {
    // The select must not display a name the scenario does not carry: the
    // simulator would resolve that name to nothing.
    const s = withEvents({ type: "layoff", when: 30 });
    render(<ScenarioForm scenario={s} onChange={() => {}} />);
    const select = screen.getByRole("combobox", { name: /Layoff item|Target/i });
    expect((select as HTMLSelectElement).value).toBe("");
  });

  it("an unset target stays unset when another item is renamed", () => {
    render(
      <Harness initial={withEvents({ type: "end", when: 12, id: "" })} />,
    );
    const select = () =>
      screen.getByRole("combobox", { name: /End item|Target/i }) as HTMLSelectElement;
    expect(select().value).toBe("");

    fireEvent.change(textboxFor("Name"), { target: { value: "renamed" } });

    expect(select().value).toBe("");
  });
});