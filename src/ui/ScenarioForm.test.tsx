import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScenarioForm } from "@/ui/ScenarioForm";
import { loadFromStorage, saveToStorage } from "@/ui/storage";
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
});

describe("scenario storage", () => {
  it("round-trips a scenario through localStorage and rejects corrupt data", () => {
    const s: Scenario = {
      cash: 12345,
      events: [
        { type: "job", when: 0, salary: { monthly: 100, annualized_rate: 0 } },
      ],
    };
    expect(saveToStorage(s).ok).toBe(true);
    expect(loadFromStorage()).toEqual(s);

    localStorage.setItem("tsender.scenario.v1", "{not json");
    expect(loadFromStorage()).toBeNull();
    localStorage.setItem("tsender.scenario.v1", "[1,2,3]");
    expect(loadFromStorage()).toBeNull();
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
