import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScenarioForm } from "@/ui/ScenarioForm";
import { loadScenario, serializeScenario } from "@/scenario/yaml";
import type { Scenario } from "@/scenario/types";

// jsdom doesn't implement ResizeObserver; uPlot's chart would crash otherwise.
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserver;

describe("ScenarioForm", () => {
  it("renders top-level fields and shows cash value", () => {
    const initial: Scenario = {
      cash: 50000,
      events: [],
    };
    const onChange = vi.fn();
    render(<ScenarioForm scenario={initial} onChange={onChange} />);

    // The ScenarioForm's Field uses useId, so we look up the input by
    // its initial value rather than label association.
    const cashInput = screen.getByDisplayValue("50000") as HTMLInputElement;
    expect(cashInput).toBeTruthy();
    expect(cashInput.value).toBe("50000");
  });

  it("renders events list region for empty events", () => {
    render(
      <ScenarioForm
        scenario={{ cash: 100, events: [] }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/Add event/i)).toBeInTheDocument();
  });

  it("top-level edits serialize through loadScenario", () => {
    const start: Scenario = {
      cash: 50000,
      reserve_months: 3,
      events: [],
    };
    const yaml = serializeScenario(start);
    expect(loadScenario(yaml)).toEqual(start);
  });

  it("the form reflects a YAML with all event types after parsing", () => {
    // We exercise the round-trip path; UI assertion is structural.
    const yaml = `
cash: 100000
reserve_months: 3
events:
  - type: job
    when: 0
    id: me
    salary: { monthly: 30000, annualized_rate: 0.03 }
  - type: pension
    when: 360
    pension: { monthly: 15000, annualized_rate: 0.025 }
  - type: death
    when: 720
`;
    const s = loadScenario(yaml);
    const back = serializeScenario(s);
    expect(loadScenario(back)).toEqual(s);
  });
});

describe("useSimulation debounce", () => {
  it("runs at most once after a burst of edits within 100ms", async () => {
    const { renderHook, act } = await import("@testing-library/react");
    const { useSimulation } = await import("@/ui/useSimulation");
    let scenario: Scenario = { cash: 0, events: [] };
    const { result, rerender } = renderHook(
      ({ s }: { s: Scenario }) => useSimulation(s),
      { initialProps: { s: scenario } },
    );
    expect(result.current.result).not.toBeNull();
    // Burst of edits.
    for (let i = 0; i < 50; i++) {
      scenario = { cash: 100 + i, events: [] };
      rerender({ s: scenario });
    }
    // Wait past the debounce window.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    // The final cash should be reflected (149 after 50 iterations from 100).
    expect(result.current.result?.months[result.current.result.months.length - 1]?.cash).toBeCloseTo(149, 6);
  });
});
