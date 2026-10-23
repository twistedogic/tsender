/**
 * App-level theme toggle.
 *
 * Design: openspec/changes/rework-style-inkwell/design.md — the toggle cycles
 * system → light → dark, reflects the mode on <html>, and persists under
 * `tsender.theme` without touching the scenario store.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { loadFromStorage, saveToStorage } from "@/ui/storage";
import { App } from "@/ui/App";

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserver;

vi.mock("uplot", () => {
  class FakeUPlot {
    series: unknown[];
    constructor(opts: { series?: unknown[] }) {
      this.series = opts.series ?? [];
    }
    setData() {}
    setSize() {}
    redraw() {}
    destroy() {}
  }
  return { default: FakeUPlot };
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("theme-dark");
});

describe("theme toggle", () => {
  it("cycles system → light → dark → system and reflects each on <html>", async () => {
    render(<App />);
    const button = screen.getByRole("button", { name: /Theme: system/i });
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);

    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: /Theme: light/i })).toBeTruthy();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("tsender.theme")).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: /Theme: light/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("theme-dark")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Theme: dark/i }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(document.documentElement.classList.contains("theme-dark")).toBe(false);
  });

  it("restores the stored preference on mount", async () => {
    localStorage.setItem("tsender.theme", "dark");
    render(<App />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(
      screen.getByRole("button", { name: /Theme: dark/i }),
    ).toBeTruthy();
  });

  it("falls back to system on a corrupt preference without throwing", () => {
    localStorage.setItem("tsender.theme", "{not json");
    expect(() => render(<App />)).not.toThrow();
    expect(screen.getByRole("button", { name: /Theme: system/i })).toBeTruthy();
  });

  it("does not disturb the scenario store", async () => {
    const scenario = { cash: 4242, events: [] };
    saveToStorage(scenario);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Theme: system/i }));

    expect(loadFromStorage()).toEqual(scenario);
    expect(localStorage.getItem("tsender.theme")).toBe("light");
  });
});