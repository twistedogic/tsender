/**
 * Theme preference.
 *
 * Design: openspec/changes/rework-style-inkwell/design.md — the theme lives
 * under its own `tsender.theme` key, separate from the scenario store, so
 * resetting a scenario never resets the reader's contrast preference.
 *
 * Any missing, unparseable, or out-of-range value falls back to "system"
 * without throwing.
 */

const KEY = "tsender.theme";
export type Theme = "system" | "light" | "dark";
const THEMES: Theme[] = ["system", "light", "dark"];

export function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(KEY);
    return THEMES.includes(raw as Theme) ? (raw as Theme) : "system";
  } catch {
    return "system";
  }
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(KEY, theme);
}

/** Reflect the mode on <html>: a class for explicit choices, nothing for system. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("theme-dark", theme === "dark");
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export const THEME_LABEL: Record<Theme, string> = {
  system: "Theme: system",
  light: "Theme: light",
  dark: "Theme: dark",
};
