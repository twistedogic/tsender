/**
 * localStorage persistence for the scenario editor.
 *
 * Spec: openspec/specs/scenario-authoring/spec.md,
 * "Form state persists locally" requirement.
 *
 * One key (`tsender.scenario.v1`) carries the JSON-serialized scenario.
 * Corrupt or malformed storage is ignored — the form falls back to a fresh
 * default. The app is the only writer, so a structural check suffices.
 */

import type { Scenario } from "@/scenario/types";

const STORAGE_KEY = "tsender.scenario.v1";
const MAX_BYTES = 256 * 1024;

export function loadFromStorage(): Scenario | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const s = parsed as Partial<Scenario>;
    if (typeof s.cash !== "number" || !Array.isArray(s.events)) return null;
    // ponytail: shallow shape check only — the app is the sole writer; add
    // per-event validation if scenarios ever enter from outside the form.
    return parsed as Scenario;
  } catch {
    return null;
  }
}

export function saveToStorage(scenario: Scenario): { ok: true } | { ok: false; reason: string } {
  try {
    const json = JSON.stringify(scenario);
    if (json.length > MAX_BYTES) {
      return { ok: false, reason: "exceeds 256 KB" };
    }
    localStorage.setItem(STORAGE_KEY, json);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
