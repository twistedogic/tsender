import { useEffect, useMemo, useState } from "react";
import type { RunResult, Scenario } from "@/scenario/types";
import { loadScenario, serializeScenario, ScenarioLoadError } from "@/scenario/yaml";
import { ScenarioForm } from "@/ui/ScenarioForm";
import { ResultsSummary } from "@/ui/ResultsSummary";
import { ResultsChart } from "@/ui/ResultsChart";
import { RunOutcomes } from "@/ui/RunOutcomes";
import { useSimulation } from "@/ui/useSimulation";
import { clearStorage, loadFromStorage, saveToStorage } from "@/ui/storage";

const DEFAULT_SCENARIO: Scenario = {
  cash: 500_000,
  events: [
    { type: "job", when: 0, salary: { monthly: 30_000, annualized_rate: 0.03 } },
    { type: "expense", when: 0, expense: { monthly: 12_000, annualized_rate: 0.02 } },
  ],
};

export function App() {
  const initial = useMemo<Scenario>(() => loadFromStorage() ?? DEFAULT_SCENARIO, []);
  const [scenario, setScenario] = useState<Scenario>(initial);
  const [storageToast, setStorageToast] = useState<string | null>(null);
  const { result, run, pending } = useSimulation(scenario);

  // Persist on every change.
  useEffect(() => {
    const r = saveToStorage(scenario);
    if (!r.ok) setStorageToast(`Storage: ${r.reason}`);
    else setStorageToast(null);
  }, [scenario]);

  return (
    <div className="app">
      <header>
        <h1>tsender</h1>
        <p className="hint">
          Hong Kong personal-finance scenario simulator. Edit a scenario,
          see the monthly trajectory.
        </p>
      </header>

      <section className="layout">
        <div className="editor">
          <Toolbar
            onReset={() => {
              clearStorage();
              setScenario({ cash: 0, events: [] });
            }}
            onRun={run}
            onImport={importScenario(setScenario, setStorageToast)}
            onExport={exportScenario(scenario)}
            pending={pending}
            storageToast={storageToast}
          />
          <ScenarioForm scenario={scenario} onChange={setScenario} />
        </div>
        <div className="results">
          {result ? (
            <>
              <ResultsSummary result={result} />
              <ResultsChart
                months={result.months}
                {...(savingBreach(result, scenario.saving) !== undefined && {
                  savingBreachMonth: savingBreach(result, scenario.saving),
                })}
                {...(firstInsolvent(result.months) !== undefined && {
                  insolvencyMonth: firstInsolvent(result.months),
                })}
                {...(result.terminal_month !== undefined && {
                  terminalMonth: result.terminal_month,
                })}
              />
              <Markers result={result} saving={scenario.saving} />
              <RunOutcomes result={result} />
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Toolbar({
  onReset,
  onRun,
  onImport,
  onExport,
  pending,
  storageToast,
}: {
  onReset: () => void;
  onRun: () => void;
  onImport: () => void;
  onExport: () => void;
  pending: boolean;
  storageToast: string | null;
}) {
  return (
    <div className="toolbar">
      <button type="button" onClick={onRun}>Run</button>
      <button type="button" onClick={onImport}>Import YAML</button>
      <button type="button" onClick={onExport}>Export scenario.yaml</button>
      <button type="button" onClick={onReset}>Reset</button>
      {pending ? <span className="pending">running…</span> : null}
      {storageToast ? <span className="toast">{storageToast}</span> : null}
    </div>
  );
}

function importScenario(
  setScenario: (s: Scenario) => void,
  setToast: (s: string | null) => void,
): () => void {
  return () => {
    const pasted = window.prompt("Paste scenario YAML:");
    if (pasted === null) return;
    try {
      const parsed = loadScenario(pasted, "pasted YAML");
      setScenario(parsed);
      setToast(null);
    } catch (e) {
      const msg = e instanceof ScenarioLoadError ? e.message : String(e);
      setToast(msg);
    }
  };
}

function exportScenario(s: Scenario): () => void {
  return () => {
    const yaml = serializeScenario(s);
    const blob = new Blob([yaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scenario.yaml";
    a.click();
    URL.revokeObjectURL(url);
  };
}

function firstInsolvent(months: { month: number; cash: number }[]): number | undefined {
  for (const m of months) {
    if (m.cash < 0) return m.month;
  }
  return undefined;
}

function savingBreach(
  result: RunResult,
  saving: number | undefined,
): number | undefined {
  if (saving === undefined) return undefined;
  for (const m of result.months) {
    if (m.cash < saving) return m.month;
  }
  return undefined;
}

function Markers({ result, saving }: { result: RunResult; saving: number | undefined }) {
  const ins = firstInsolvent(result.months);
  const breach = savingBreach(result, saving);
  if (ins === undefined && breach === undefined && !result.terminal) return null;
  return (
    <ul className="markers">
      {ins !== undefined ? (
        <li data-marker="insolvency">insolvent from month {ins}</li>
      ) : null}
      {breach !== undefined ? (
        <li data-marker="saving">saving target breached from month {breach}</li>
      ) : null}
      {result.terminal ? (
        <li data-marker="terminal">terminal at month {result.terminal_month}</li>
      ) : null}
    </ul>
  );
}
