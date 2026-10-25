/**
 * Passive-income crossing detection.
 *
 * Spec: openspec/changes/add-tsender-v01/specs/simulation-output/spec.md —
 * "earliest month M such that passive income >= recurring expenses holds for
 * every simulated month from M through the end".
 */

import type { MonthResult } from "@/scenario/types";

export interface MonthBreakdown {
  /** Pension payouts this month. */
  pension: number;
  /** Rental income, occupancy-applied, this month. */
  rental: number;
  /** Sum of fund growth this month (principal × rate/12 per fund). */
  fundGrowth: number;
  /** Recurring expenses (negative flows excluding one-offs and tax). */
  recurringExpenses: number;
}

export function passiveIncome(b: MonthBreakdown): number {
  return b.pension + b.rental + b.fundGrowth;
}

/**
 * Compute the earliest month from which `passive >= expenses` holds continuously
 * through the last simulated month. `undefined` if no such month exists.
 *
 * `undefined` also when no month has any recurring expense — there's nothing
 * for passive income to cover and the spec's "Salary does not count as passive
 * income" scenario expects an absent key when only salary is in play.
 */
export function findPassiveIncomeCrossing(
  months: MonthResult[],
  breakdowns: MonthBreakdown[],
): number | undefined {
  const last = months.length - 1;
  if (last < 0) return undefined;
  let totalExpenses = 0;
  for (const b of breakdowns) totalExpenses += b.recurringExpenses;
  if (totalExpenses === 0) return undefined;

  let candidate = -1;
  for (let m = 0; m <= last; m++) {
    const b = breakdowns[m];
    if (!b) continue;
    if (passiveIncome(b) < b.recurringExpenses) {
      candidate = -1;
    } else if (candidate === -1) {
      candidate = m;
    }
    if (candidate !== -1 && m === last) return candidate;
  }
  return undefined;
}
