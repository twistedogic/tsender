/**
 * localStorage persistence for the scenario editor.
 *
 * Spec: openspec/changes/add-tsender-v01/specs/scenario-authoring/spec.md,
 * "Form state persists locally" requirement.
 *
 * One key (`tsender.scenario.v1`) carries the JSON-serialized scenario.
 * Corrupt or missing storage is silently ignored — the form renders a
 * fresh empty scenario.
 */

import type { Scenario } from "@/scenario/types";
import { loadScenario, serializeScenario } from "@/scenario/yaml";

const STORAGE_KEY = "tsender.scenario.v1";
const MAX_BYTES = 256 * 1024;

export function loadFromStorage(): Scenario | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // Round-trip via the YAML loader so the same validation that rejects
    // bad form input also rejects corrupt persisted data.
    return loadScenario(raw, "localStorage");
  } catch {
    return null;
  }
}

export function saveToStorage(scenario: Scenario): { ok: true } | { ok: false; reason: string } {
  try {
    const yaml = serializeScenario(scenario);
    if (yaml.length > MAX_BYTES) {
      return { ok: false, reason: "exceeds 256 KB" };
    }
    localStorage.setItem(STORAGE_KEY, yaml);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
