import { describe, expect, it, beforeEach } from "vitest";
import { applyTheme, loadTheme, saveTheme, type Theme } from "@/ui/theme";

const THEMES: Theme[] = ["system", "light", "dark"];

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("theme-dark");
});

describe("theme preference", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("theme-dark");
  });

  it("defaults to system when nothing is stored", () => {
    expect(loadTheme()).toBe("system");
  });

  it("round-trips each mode", () => {
    for (const t of THEMES) {
      saveTheme(t);
      expect(loadTheme()).toBe(t);
    }
  });

  it("falls back to system on unparseable input", () => {
    localStorage.setItem("tsender.theme", "{not json");
    expect(loadTheme()).toBe("system");
  });

  it("falls back to system on an out-of-range value", () => {
    localStorage.setItem("tsender.theme", "sepia");
    expect(loadTheme()).toBe("system");
    localStorage.setItem("tsender.theme", "");
    expect(loadTheme()).toBe("system");
    localStorage.setItem("tsender.theme", "42");
    expect(loadTheme()).toBe("system");
  });

  it("marks explicit choices and clears the marker for system", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("theme-dark")).toBe(true);

    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("theme-dark")).toBe(false);

    applyTheme("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(document.documentElement.classList.contains("theme-dark")).toBe(false);
  });

  it("leaves the scenario store untouched", () => {
    saveTheme("dark");
    expect(localStorage.getItem("tsender.scenario.v1")).toBeNull();
  });
});