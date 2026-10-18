import type { RunResult } from "@/scenario/types";

export function ResultsSummary({ result }: { result: RunResult }) {
  const months = result.months;
  const last = months[months.length - 1];
  if (!last) return null;

  let minCash = Infinity;
  let minCashMonth = -1;
  let firstInsolventMonth = -1;
  for (let i = 0; i < months.length; i++) {
    const m = months[i]!;
    if (m.cash < minCash) {
      minCash = m.cash;
      minCashMonth = m.month;
    }
    if (firstInsolventMonth === -1 && m.cash < 0) firstInsolventMonth = m.month;
  }

  return (
    <table className="results-summary">
      <tbody>
        <tr><th>Final cash</th><td data-testid="final-cash">{fmt(last.cash)}</td></tr>
        <tr><th>Final assets</th><td>{fmt(last.assets_value)}</td></tr>
        <tr><th>Final monthly cashflow</th><td>{fmt(last.monthly_cashflow)}</td></tr>
        <tr><th>Minimum cash</th><td>{fmt(minCash)} (month {minCashMonth})</td></tr>
        <tr>
          <th>First insolvent month</th>
          <td>{firstInsolventMonth === -1 ? "never" : `month ${firstInsolventMonth}`}</td>
        </tr>
        <tr>
          <th>Terminal month</th>
          <td>{result.terminal_month ?? "—"}</td>
        </tr>
      </tbody>
    </table>
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-HK", { maximumFractionDigits: 0 }).format(n);
}
