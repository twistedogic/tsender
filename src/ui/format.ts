/**
 * Number formatting shared by the results panels.
 *
 * The summary and the trajectory table show the same figures; formatting
 * them once keeps the two panels from drifting apart.
 */

export function fmt(n: number): string {
  return new Intl.NumberFormat("en-HK", { maximumFractionDigits: 0 }).format(n);
}
