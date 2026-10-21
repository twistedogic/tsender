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
    };
  }

  const workingAssets = assets.slice(); // shallow copy; Funds get mutated in place
  let c = cash;
  const sold = new Set<Property>();

  // Funds first: drain in asset order, partially, floored at zero.
  for (const a of workingAssets) {
    if (a.kind !== "Fund") continue;
    if (c >= reserveTargetAmount) break;
    const draw = Math.min(a.principal, reserveTargetAmount - c);
    if (draw > 0) {
      a.principal -= draw;
      c += draw;
    }
  }

  // Properties next: sell whole in asset order.
  for (const a of workingAssets) {
    if (c >= reserveTargetAmount) break;
    if (a.kind !== "Property") continue;
    c += propertySaleProceeds(a);
    sold.add(a);
  }

  return {
    cashAfter: c,
    assetsAfter: workingAssets.filter((a) => !sold.has(a as Property)),
  };
}
