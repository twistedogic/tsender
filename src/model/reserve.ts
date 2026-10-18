/**
 * Cash-reserve settlement.
 *
 * Spec: openspec/changes/add-tsender-v01/specs/scenario-loading/spec.md —
 * "Requirement: Settlement restores the cash reserve by liquidation in order".
 *
 * Fund draws come first (partially, in asset order, each fund floored at zero);
 * if still under target, sell whole properties in asset order until cash reaches
 * the target. Liquidation proceeds do NOT appear in `monthly_cashflow`.
 */

import type { Asset, Property } from "@/scenario/types";

export function propertySaleProceeds(property: Property): number {
  const value = property.sqft * property.price_per_sqft;
  const remainingTotal =
    property.mortgage !== undefined
      ? property.mortgage.monthly *
        Math.max(0, property.mortgage.period - property.mortgage.paid)
      : 0;
  return Math.max(0, value - remainingTotal);
}

export interface SettlementResult {
  cashAfter: number;
  assetsAfter: Asset[];
  fundDrawTotal: number;
  propertySaleTotal: number;
  /** Whether settlement could not reach the target (assets exhausted). */
  breached: boolean;
}

export function settleReserve(
  cash: number,
  reserveTargetAmount: number,
  assets: Asset[],
): SettlementResult {
  if (reserveTargetAmount <= 0 || cash >= reserveTargetAmount) {
    return {
      cashAfter: cash,
      assetsAfter: assets.slice(),
      fundDrawTotal: 0,
      propertySaleTotal: 0,
      breached: false,
    };
  }

  const workingAssets = assets.slice(); // shallow copy; Funds get mutated in place
  let c = cash;
  let fundDrawTotal = 0;
  let propertySaleTotal = 0;
  const sold = new Set<Property>();

  // Funds first: drain in asset order, partially, floored at zero.
  for (const a of workingAssets) {
    if (a.kind !== "Fund") continue;
    if (c >= reserveTargetAmount) break;
    const shortfall = reserveTargetAmount - c;
    const draw = Math.min(a.principal, shortfall);
    if (draw > 0) {
      a.principal -= draw;
      c += draw;
      fundDrawTotal += draw;
    }
  }

  // Properties next: sell whole in asset order.
  for (const a of workingAssets) {
    if (c >= reserveTargetAmount) break;
    if (a.kind !== "Property") continue;
    const proceeds = propertySaleProceeds(a);
    c += proceeds;
    propertySaleTotal += proceeds;
    sold.add(a);
  }

  const assetsAfter = workingAssets.filter((a) => !sold.has(a as Property));
  const breached = c < reserveTargetAmount;

  return {
    cashAfter: c,
    assetsAfter,
    fundDrawTotal,
    propertySaleTotal,
    breached,
  };
}
