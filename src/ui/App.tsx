import { useEffect, useMemo, useState } from "react";
import type { RunResult, Scenario } from "@/scenario/types";
import { ScenarioForm } from "@/ui/ScenarioForm";
import { ResultsSummary } from "@/ui/ResultsSummary";
import { ResultsChart } from "@/ui/ResultsChart";
import { RunOutcomes } from "@/ui/RunOutcomes";
import { useSimulation } from "@/ui/useSimulation";
import { loadFromStorage, saveToStorage } from "@/ui/storage";

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
            onReset={() => setScenario({ cash: 0, events: [] })}
            onRun={run}
            pending={pending}
            storageToast={storageToast}
          />
          <ScenarioForm scenario={scenario} onChange={setScenario} />
        </div>
        <div className="results">
          {result ? <Results result={result} scenario={scenario} /> : null}
        </div>
      </section>
    </div>
  );
}

function Results({ result, scenario }: { result: RunResult; scenario: Scenario }) {
  const insolvencyMonth = firstInsolvent(result.months);
  const savingBreachMonth = savingBreach(result, scenario.saving);
  return (
    <>
      <ResultsSummary result={result} />
      <ResultsChart
        months={result.months}
        insolvencyMonth={insolvencyMonth}
        savingBreachMonth={savingBreachMonth}
        terminalMonth={result.terminal_month}
      />
      <Markers
        insolvencyMonth={insolvencyMonth}
        savingBreachMonth={savingBreachMonth}
        terminal={result.terminal}
        terminalMonth={result.terminal_month}
      />
      <RunOutcomes result={result} />
    </>
  );
}

function Toolbar({
  onReset,
  onRun,
  pending,
  storageToast,
}: {
  onReset: () => void;
  onRun: () => void;
  pending: boolean;
  storageToast: string | null;
}) {
  return (
    <div className="toolbar">
      <button type="button" onClick={onRun}>Run</button>
      <button type="button" onClick={onReset}>Reset</button>
      {pending ? <span className="pending">running…</span> : null}
      {storageToast ? <span className="toast">{storageToast}</span> : null}
    </div>
  );
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

function Markers({
  insolvencyMonth,
  savingBreachMonth,
  terminal,
  terminalMonth,
}: {
  insolvencyMonth?: number;
  savingBreachMonth?: number;
  terminal: boolean;
  terminalMonth?: number;
}) {
  if (insolvencyMonth === undefined && savingBreachMonth === undefined && !terminal) {
    return null;
  }
  return (
    <ul className="markers">
      {insolvencyMonth !== undefined ? (
        <li data-marker="insolvency">insolvent from month {insolvencyMonth}</li>
      ) : null}
      {savingBreachMonth !== undefined ? (
        <li data-marker="saving">saving target breached from month {savingBreachMonth}</li>
      ) : null}
      {terminal ? (
        <li data-marker="terminal">terminal at month {terminalMonth}</li>
      ) : null}
    </ul>
  );
}
