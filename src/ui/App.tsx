import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { RunResult, Scenario } from "@/scenario/types";
import { ScenarioForm } from "@/ui/ScenarioForm";
import { ResultsSummary } from "@/ui/ResultsSummary";
import { TrajectoryTable } from "@/ui/TrajectoryTable";
import { RunOutcomes } from "@/ui/RunOutcomes";
import { useSimulation } from "@/ui/useSimulation";
import { loadFromStorage, saveToStorage } from "@/ui/storage";
import { applyTheme, loadTheme, saveTheme, THEME_LABEL, type Theme } from "@/ui/theme";

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
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const { result, run, pending } = useSimulation(scenario);

  // Apply the theme before the chart's paint effect reads its canvas colors.
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const cycleTheme = () =>
    setTheme((prev) => {
      const next: Theme =
        prev === "system" ? "light" : prev === "light" ? "dark" : "system";
      saveTheme(next);
      return next;
    });

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
            theme={theme}
            onCycleTheme={cycleTheme}
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
      <TrajectoryTable
        months={result.months}
        markers={{
          insolvencyMonth,
          savingBreachMonth,
          terminalMonth: result.terminal_month,
          passiveIncomeMonth: result.passive_income_month,
        }}
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
  theme,
  onCycleTheme,
}: {
  onReset: () => void;
  onRun: () => void;
  pending: boolean;
  storageToast: string | null;
  theme: Theme;
  onCycleTheme: () => void;
}) {
  return (
    <div className="toolbar">
      <button type="button" onClick={onRun}>Run</button>
      <button type="button" onClick={onReset}>Reset</button>
      <button
        type="button"
        onClick={onCycleTheme}
        aria-label={THEME_LABEL[theme]}
      >
        {THEME_LABEL[theme]}
      </button>
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
