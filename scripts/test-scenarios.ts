/**
 * Scenario regression: for each committed `fixtures/*.json` (a Scenario
 * object), run the simulator and diff against `fixtures/*.expected.json`
 * (within `1e-9` numeric tolerance).
 *
 * Per the simulation-output spec: both sides of the diff are JSON-serializable
 * wrapper objects; numbers carry IEEE 754 rounding. Float comparisons use
 * `1e-9` per the design decision.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { runScenario } from "@/model/simulator";
import type { RunResult, Scenario } from "@/scenario/types";

const FIXTURES_DIR = "fixtures";
const TOLERANCE = 1e-9;

function deepEqual(a: unknown, b: unknown): { ok: boolean; why?: string } {
  if (a === b) return { ok: true };
  if (typeof a !== typeof b) return { ok: false, why: `typeof ${typeof a} vs ${typeof b}` };
  if (a === null || b === null) return { ok: false, why: `null mismatch` };
  if (typeof a === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return { ok: true };
    if (Math.abs((a as number) - (b as number)) < TOLERANCE) return { ok: true };
    return { ok: false, why: `number ${a} vs ${b}` };
  }
  if (typeof a === "string") {
    return a === b ? { ok: true } : { ok: false, why: `string ${a} vs ${b}` };
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return { ok: false, why: `array vs non-array` };
    if (a.length !== b.length) return { ok: false, why: `array length ${a.length} vs ${b.length}` };
    for (let i = 0; i < a.length; i++) {
      const r = deepEqual(a[i], b[i]);
      if (!r.ok) return { ok: false, why: `array[${i}]: ${r.why}` };
    }
    return { ok: true };
  }
  if (typeof a === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ka = Object.keys(ao).sort();
    const kb = Object.keys(bo).sort();
    if (ka.length !== kb.length) return { ok: false, why: `key set differs: [${ka}] vs [${kb}]` };
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return { ok: false, why: `key differs at ${i}: ${ka[i]} vs ${kb[i]}` };
    }
    for (const k of ka) {
      const r = deepEqual(ao[k], bo[k]);
      if (!r.ok) return { ok: false, why: `obj.${k}: ${r.why}` };
    }
    return { ok: true };
  }
  return { ok: false, why: `unhandled types` };
}

function listFixturePairs(): Array<{ name: string; scenarioPath: string; expectedPath: string }> {
  const names = readdirSync(FIXTURES_DIR).filter(
    (f) => f.endsWith(".json") && !f.endsWith(".expected.json"),
  );
  return names.map((f) => {
    const name = basename(f, ".json");
    return {
      name,
      scenarioPath: join(FIXTURES_DIR, f),
      expectedPath: join(FIXTURES_DIR, `${name}.expected.json`),
    };
  });
}

let failed = 0;
let passed = 0;

for (const pair of listFixturePairs()) {
  if (!statSync(pair.expectedPath, { throwIfNoEntry: false })) {
    console.error(`✗ ${pair.name}: missing ${pair.expectedPath}`);
    failed++;
    continue;
  }
  const scenario: Scenario = JSON.parse(readFileSync(pair.scenarioPath, "utf8"));
  const expected: RunResult = JSON.parse(readFileSync(pair.expectedPath, "utf8"));
  let actual: RunResult;
  try {
    actual = runScenario(scenario);
  } catch (e) {
    console.error(`✗ ${pair.name}: ${e instanceof Error ? e.message : String(e)}`);
    failed++;
    continue;
  }
  const r = deepEqual(actual, expected);
  if (r.ok) {
    console.log(`✓ ${pair.name}`);
    passed++;
  } else {
    console.error(`✗ ${pair.name}: ${r.why}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
