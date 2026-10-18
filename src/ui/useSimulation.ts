/**
 * Debounced useSimulation hook.
 *
 * Spec: openspec/changes/add-tsender-v01/specs/results-display/spec.md —
 * "Dashboard updates when the scenario changes" — debounced to ≤ 10 Hz.
 */

import { useEffect, useRef, useState } from "react";
import { runScenario } from "@/model/simulator";
import type { RunResult, Scenario } from "@/scenario/types";

export interface UseSimulationResult {
  result: RunResult | null;
  /** Manual force-run (bypass debounce). */
  run: () => void;
  /** True while a debounced run is pending. */
  pending: boolean;
}

export function useSimulation(scenario: Scenario): UseSimulationResult {
  const [result, setResult] = useState<RunResult | null>(() => runScenario(scenario));
  const [pending, setPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;

  useEffect(() => {
    setPending(true);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const next = runScenario(scenarioRef.current);
      setResult(next);
      setPending(false);
    }, 100); // 10 Hz cap
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [scenario]);

  return {
    result,
    pending,
    run: () => {
      setPending(true);
      const next = runScenario(scenarioRef.current);
      setResult(next);
      setPending(false);
    },
  };
}
