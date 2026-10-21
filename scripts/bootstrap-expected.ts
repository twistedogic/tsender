/**
 * Bootstrapper: writes fixtures/<name>.expected.json by running the simulator
 * on fixtures/<name>.json. Use once when adding a new fixture, then hand-verify
 * the key values per the relevant spec scenarios.
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { runScenario } from "@/model/simulator";

const FIXTURES_DIR = "fixtures";

const scenarioFiles = readdirSync(FIXTURES_DIR).filter(
  (f) => f.endsWith(".json") && !f.endsWith(".expected.json"),
);
let updated = 0;
for (const f of scenarioFiles) {
  const name = basename(f, ".json");
  const scenarioPath = join(FIXTURES_DIR, f);
  const jsonPath = join(FIXTURES_DIR, `${name}.expected.json`);
  const scenario = JSON.parse(readFileSync(scenarioPath, "utf8"));
  const result = runScenario(scenario);
  const json = JSON.stringify(result, null, 2);
  const existing = statSync(jsonPath, { throwIfNoEntry: false });
  if (existing) {
    console.log(`skipping ${name} (${jsonPath} exists)`);
    continue;
  }
  writeFileSync(jsonPath, json + "\n");
  console.log(`wrote ${jsonPath}`);
  updated++;
}
console.log(`\n${updated} written.`);
