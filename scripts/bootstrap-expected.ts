/**
 * Bootstrapper: writes fixtures/<name>.expected.json by running the simulator
 * on fixtures/<name>.yaml. Use once when adding a new fixture, then hand-verify
 * the key values per the relevant spec scenarios.
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { loadScenario } from "@/scenario/yaml";
import { runScenario } from "@/model/simulator";

const FIXTURES_DIR = "fixtures";

const yamlFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".yaml"));
let updated = 0;
for (const f of yamlFiles) {
  const name = basename(f, extname(f));
  const yamlPath = join(FIXTURES_DIR, f);
  const jsonPath = join(FIXTURES_DIR, `${name}.expected.json`);
  const yaml = readFileSync(yamlPath, "utf8");
  const scenario = loadScenario(yaml, yamlPath);
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
