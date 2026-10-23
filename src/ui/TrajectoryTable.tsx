/**
 * Yearly trajectory table.
 *
 * Spec: openspec/changes/remove-chart/specs/results-display/spec.md —
 * one row per 12-month bucket from month 0, each row showing its bucket's
 * last month; a short final row carries its month count; marker months are
 * noted on the row whose year contains them.
 */

import type { MonthResult } from "@/scenario/types";
import { fmt } from "@/ui/format";

/** Months per row. */
const BUCKET = 12;

export interface TrajectoryMarkers {
  insolvencyMonth?: number;
  savingBreachMonth?: number;
  terminalMonth?: number;
  passiveIncomeMonth?: number;
}

export interface TrajectoryRow {
  /** 1-based year index. */
  year: number;
  /** `Year N`, or `Year N · K mo` when the row covers fewer than 12 months. */
  label: string;
  /** The bucket's last month. */
  month: number;
  /** How many months the row covers. */
  monthCount: number;
  cash: number;
  assets: number;
  netWorth: number;
  /** The bucket's last month's cashflow. */
  flow: number;
  /** Marker notes that fire in this row's year. */
  notes: string[];
}

export interface TrajectoryTableProps {
  months: MonthResult[];
  markers?: TrajectoryMarkers;
}

/**
 * The run's trajectory as one row per 12-month bucket counted from month 0.
 * Every figure on a row is a reading of that bucket's last month, so the
 * columns cannot disagree with each other.
 */
export function yearRows(
  months: MonthResult[],
  markers: TrajectoryMarkers = {},
): TrajectoryRow[] {
  const rows: TrajectoryRow[] = [];

  for (let start = 0; start < months.length; start += BUCKET) {
    const bucket = months.slice(start, start + BUCKET);
    const last = bucket[bucket.length - 1]!;
    const year = rows.length + 1;
    rows.push({
      year,
      label:
        bucket.length < BUCKET
          ? `Year ${year} · ${bucket.length} mo`
          : `Year ${year}`,
      month: last.month,
      monthCount: bucket.length,
      cash: last.cash,
      assets: last.assets_value,
      netWorth: last.cash + last.assets_value,
      flow: last.monthly_cashflow,
      notes: [],
    });
  }

  // A marker lands on the row whose year contains its month.
  const tagged: { month: number; note: string }[] = [];
  if (markers.insolvencyMonth !== undefined) {
    tagged.push({ month: markers.insolvencyMonth, note: "insolvent" });
  }
  if (markers.savingBreachMonth !== undefined) {
    tagged.push({ month: markers.savingBreachMonth, note: "saving breached" });
  }
  if (markers.terminalMonth !== undefined) {
    tagged.push({ month: markers.terminalMonth, note: "terminal" });
  }
  if (markers.passiveIncomeMonth !== undefined) {
    tagged.push({ month: markers.passiveIncomeMonth, note: "passive covers" });
  }
  tagged.sort((a, b) => a.month - b.month);
  for (const { month, note } of tagged) {
    rows[Math.floor(month / BUCKET)]?.notes.push(note);
  }

  return rows;
}

export function TrajectoryTable({
  months,
  markers,
}: TrajectoryTableProps) {
  const rows = yearRows(months, markers);
  if (rows.length === 0) return null;
  return (
    <div className="trajectory-scroll">
      <table className="trajectory-table" data-testid="trajectory-table">
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Cash</th>
            <th scope="col">Assets</th>
            <th scope="col">Net worth</th>
            <th scope="col">Monthly flow</th>
            <th scope="col">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year}>
              <th scope="row">{row.label}</th>
              <td>{fmt(row.cash)}</td>
              <td>{fmt(row.assets)}</td>
              <td>{fmt(row.netWorth)}</td>
              <td>{fmt(row.flow)}</td>
              <td className="trajectory-notes">{row.notes.join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
