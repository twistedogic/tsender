/**
 * App-level theme toggle.
 *
 * Design: openspec/changes/rework-style-inkwell/design.md — the toggle cycles
 * system → light → dark, reflects the mode on <html>, and persists under
 * `tsender.theme` without touching the scenario store.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { loadFromStorage, saveToStorage } from "@/ui/storage";
import { App } from "@/ui/App";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("theme-dark");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("trajectory table", () => {
  it("shows the run's trajectory as a table", () => {
    render(<App />);
    expect(screen.getByTestId("trajectory-table")).toBeTruthy();
    expect(
      document.querySelectorAll(".trajectory-table tbody tr").length,
    ).toBeGreaterThan(0);
  });

  it("notes the passive-income crossing on its row", () => {
    saveToStorage({
      cash: 2_000_000,
      events: [
        {
          type: "investment",
          when: 0,
          fund: { principal: 1_000_000, annualized_rate: 0.05 },
        },
        {
          type: "expense",
          when: 0,
          expense: { monthly: 1000, annualized_rate: 0 },
        },
      ],
    });
    render(<App />);
    const rows = [...document.querySelectorAll(".trajectory-table tbody tr")];
    expect(rows[0]!.querySelector("td.trajectory-notes")?.textContent).toBe(
      "passive covers",
    );
  });
});

describe("theme toggle", () => {
  it("cycles system → light → dark → system and reflects each on <html>", () => {
    render(<App />);
    const button = screen.getByRole("button", { name: /Theme: system/i });
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);

    fireEvent.click(button);
    expect(screen.getByRole("button", { name: /Theme: light/i })).toBeTruthy();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("tsender.theme")).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: /Theme: light/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("theme-dark")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Theme: dark/i }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(document.documentElement.classList.contains("theme-dark")).toBe(false);
  }, 15_000);

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

  it("applies the theme to <html> before the results panel renders", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Theme: system/i }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(screen.getByTestId("trajectory-table")).toBeTruthy();
  });

  it("applies a stored theme before the results panel renders", () => {
    localStorage.setItem("tsender.theme", "dark");
    render(<App />);

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByTestId("trajectory-table")).toBeTruthy();
  });
});
