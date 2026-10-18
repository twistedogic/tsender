/**
 * Hong Kong tax helpers: MPF, salaries tax (progressive vs standard),
 * property tax, and household-allowance derivation.
 *
 * Spec: openspec/changes/add-tsender-v01/specs/hk-salaries-tax/spec.md,
 * hk-property-tax/spec.md.
 */

import type { TaxBlock } from "@/scenario/types";

export const MPF_RATE = 0.05;
export const MPF_CAP_MONTHLY = 1500;
export const BASIC_ALLOWANCE = 145000; // 2026/27 IRD code constant
export const MARRIED_ALLOWANCE = 290000;
export const CHILD_ALLOWANCE = 140000;
export const PARENT_60_PLUS = 55_000;
export const PARENT_55_59 = 27_500;

// Progressive tax brackets (HK salaries tax).
// Five slabs: 50k @ 2%, 50k @ 6%, 50k @ 10%, 50k @ 14%, remainder @ 17%.
const PROGRESSIVE_BRACKETS: Array<[number, number]> = [
  [50_000, 0.02],
  [50_000, 0.06],
  [50_000, 0.10],
  [50_000, 0.14],
  [Number.POSITIVE_INFINITY, 0.17],
];

const STANDARD_BRACKETS: Array<[number, number]> = [
  [5_000_000, 0.15],
  [Number.POSITIVE_INFINITY, 0.16],
];

export function mpfDeduction(grossMonthlySalary: number): number {
  if (grossMonthlySalary <= 0) return 0;
  return Math.min(MPF_RATE * grossMonthlySalary, MPF_CAP_MONTHLY);
}

/**
 * Compute the salaries-tax allowance total to use for a scenario.
 * Defaults to BASIC_ALLOWANCE; the `tax:` block overrides with the household
 * total when populated.
 */
export function computeAllowance(tax: TaxBlock | undefined): number {
  if (!tax) return BASIC_ALLOWANCE;
  const status = tax.status;
  const children = tax.children ?? 0;
  const parents = tax.parents ?? [];

  const hasAny =
    status !== undefined || children > 0 || parents.length > 0;
  if (!hasAny) return BASIC_ALLOWANCE;

  let total = status === "married" ? MARRIED_ALLOWANCE : BASIC_ALLOWANCE;
  total += children * CHILD_ALLOWANCE;
  for (const p of parents) {
    const base = p.age_band === "60+" ? PARENT_60_PLUS : PARENT_55_59;
    total += p.living_with ? base * 2 : base;
  }
  return total;
}

export function progressiveTax(chargeable: number): number {
  if (chargeable <= 0) return 0;
  let remaining = chargeable;
  let tax = 0;
  for (const [cap, rate] of PROGRESSIVE_BRACKETS) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, cap);
    tax += slice * rate;
    remaining -= slice;
  }
  return tax;
}

export function standardTax(netAssessable: number): number {
  if (netAssessable <= 0) return 0;
  let remaining = netAssessable;
  let tax = 0;
  for (const [cap, rate] of STANDARD_BRACKETS) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, cap);
    tax += slice * rate;
    remaining -= slice;
  }
  return tax;
}

/**
 * Compute salaries tax for a 12-month block.
 * `salaryGrossTotal` is the sum of all 12 monthly gross amounts (including
 * pension, which is treated as income but not subject to MPF).
 * `mpfTotal` is the sum of all 12 monthly MPF deductions (from salaries only).
 */
export function salariesTaxForBlock(
  salaryGrossTotal: number,
  mpfTotal: number,
  allowance: number,
): { progressive: number; standard: number; chargeable: number; charge: number } {
  const chargeable = Math.max(0, salaryGrossTotal - mpfTotal - allowance);
  const progressive = progressiveTax(chargeable);
  const netAssessable = Math.max(0, salaryGrossTotal - mpfTotal);
  const standard = standardTax(netAssessable);
  return {
    progressive,
    standard,
    chargeable,
    charge: Math.min(progressive, standard),
  };
}

/**
 * Annual property tax: 15% of 80% of accrued gross rent.
 */
export function propertyTaxForBlock(rentAccrued: number): number {
  return rentAccrued * 0.8 * 0.15;
}
