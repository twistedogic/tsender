import type { RunResult } from "@/scenario/types";

export function RunOutcomes({ result }: { result: RunResult }) {
  const months = result.months;
  const last = months[months.length - 1];
  if (!last) return null;

  const finalNW = last.cash + last.assets_value;
  const crossing = result.passive_income_month;
  const met = finalNW > 0;

  return (
    <section className="run-outcomes" aria-label="run outcomes">
      <div className="callout" data-met={met}>
        <strong>End solvency:</strong>{" "}
        final net worth <code>{new Intl.NumberFormat("en-HK").format(finalNW)}</code>{" "}
        {met ? "(met)" : "(missed)"}
      </div>
      <div className="callout">
        <strong>Passive income crossing:</strong>{" "}
        {crossing !== undefined
          ? `passive income covers expenses from month ${crossing}`
          : "passive income never covers expenses"}
      </div>
    </section>
  );
}
