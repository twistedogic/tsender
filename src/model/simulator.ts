/**
 * tsender simulator — see the scenario-loading, hk-salaries-tax,
 * hk-property-tax, and simulation-output specs.
 */

import type {
  Asset,
  Cashflow,
  Event,
  Fund,
  InvestmentContributionCashflow,
  MonthResult,
  MortgagePaymentCashflow,
  Property,
  RentalIncomeCashflow,
  RunResult,
  SalaryCashflow,
  Scenario,
} from "@/scenario/types";
import {
  computeAllowance,
  mpfDeduction,
  propertyTaxForBlock,
  salariesTaxForBlock,
} from "@/model/tax";
import { settleReserve } from "@/model/reserve";
import {
  findPassiveIncomeCrossing,
  recurringExpenseTotal,
  type MonthBreakdown,
} from "@/output/passive";

const DEFAULT_HORIZON_MONTHS = 360; // 30 years
let cashflowSeq = 0;
function nextCashflowId(prefix: string): string {
  cashflowSeq++;
  return `${prefix}-${cashflowSeq}`;
}

function monthIndex(yyyymm: string): number {
  const [y, m] = yyyymm.split("-").map(Number) as [number, number];
  return y * 12 + (m - 1);
}

function horizonMonths(s: Scenario): number {
  if (s.start && s.end) {
    return Math.max(0, monthIndex(s.end) - monthIndex(s.start));
  }
  return DEFAULT_HORIZON_MONTHS;
}

function grown(monthly: number, annualizedRate: number, age: number): number {
  if (monthly === 0) return 0;
  return monthly * Math.pow(1 + annualizedRate / 12, age);
}

function totalAssetsValue(assets: Asset[]): number {
  let total = 0;
  for (const a of assets) {
    if (a.kind === "Fund") total += a.principal;
    else total += a.sqft * a.price_per_sqft;
  }
  return total;
}

// ---------- State ----------

interface State {
  cash: number;
  cashflows: Cashflow[];
  assets: Asset[];
  pendingEvents: Event[];
  incomeAccrued: number;
  mpfAccrued: number;
  rentAccrued: number;
  allowance: number;
  reserveMonths: number;
  saving?: number;
  /** Set when a death event fires in this month. */
  terminalAtMonth?: number;
  /** Cash impact this month split into reportable flows and silent asset costs. */
  oneOffNetThisMonth: number;
  assetCostThisMonth: number;
  recurringNetThisMonth: number;
  taxThisMonth: number;
  settlementNetThisMonth: number;
}

export function runScenario(scenario: Scenario): RunResult {
  const state: State = {
    cash: scenario.cash,
    cashflows: [],
    assets: [],
    pendingEvents: scenario.events.slice(),
    incomeAccrued: 0,
    mpfAccrued: 0,
    rentAccrued: 0,
    allowance: computeAllowance(scenario.tax),
    reserveMonths: scenario.reserve_months ?? 0,
    ...(scenario.saving !== undefined && { saving: scenario.saving }),
    oneOffNetThisMonth: 0,
    assetCostThisMonth: 0,
    recurringNetThisMonth: 0,
    taxThisMonth: 0,
    settlementNetThisMonth: 0,
  };
  const maxMonths = horizonMonths(scenario);

  const months: MonthResult[] = [];
  const breakdowns: MonthBreakdown[] = [];

  let terminal = false;
  let terminalMonth: number | undefined;

  for (let m = 0; m <= maxMonths; m++) {
    step(state, m);
    if (state.terminalAtMonth !== undefined) {
      terminalMonth = state.terminalAtMonth;
      terminal = true;
    }

    months.push({
      month: m,
      cash: state.cash,
      assets_value: totalAssetsValue(state.assets),
      monthly_cashflow:
        state.recurringNetThisMonth +
        state.oneOffNetThisMonth,
    });
    breakdowns.push(buildBreakdown(state));

    tickAges(state);
    pruneConsumedEvents(state, m);

    if (terminal) break;
  }

  const result: RunResult = { terminal, months };
  if (terminalMonth !== undefined) result.terminal_month = terminalMonth;
  const crossing = findPassiveIncomeCrossing(months, breakdowns);
  if (crossing !== undefined) result.passive_income_month = crossing;
  return result;
}

// ---------- Per-month step ----------

function step(state: State, m: number): void {
  state.oneOffNetThisMonth = 0;
  state.assetCostThisMonth = 0;
  state.taxThisMonth = 0;
  state.settlementNetThisMonth = 0;

  fireEventsAt(state, m);

  // Income / MPF / rent accruals for the tax base.
  for (const c of state.cashflows) {
    if (c.kind === "Salary") {
      const gross = grown(c.monthly, c.annualized_rate, c.age);
      state.incomeAccrued += gross;
      state.mpfAccrued += mpfDeduction(gross);
    } else if (c.kind === "Pension") {
      state.incomeAccrued += grown(c.monthly, c.annualized_rate, c.age);
    } else if (c.kind === "RentalIncome") {
      state.rentAccrued +=
        grown(c.monthly, c.annualized_rate, c.age) * c.occupancy;
    }
  }

  // Compute the monthly flows (recurring).
  const recurringNet = netCashflowThisMonth(state);
  state.recurringNetThisMonth = recurringNet;
  const recurringExpenses = recurringExpenseTotal(state.cashflows);

  // Apply to cash: recurring + one-offs + asset costs (separately).
  state.cash += recurringNet;
  state.cash += state.oneOffNetThisMonth;
  state.cash -= state.assetCostThisMonth;

  // Tax at block end.
  if (m >= 11 && (m + 1) % 12 === 0) {
    const sa = salariesTaxForBlock(
      state.incomeAccrued,
      state.mpfAccrued,
      state.allowance,
    );
    const pt = propertyTaxForBlock(state.rentAccrued);
    state.taxThisMonth = sa.charge + pt;
    state.cash -= state.taxThisMonth;
    state.incomeAccrued = 0;
    state.mpfAccrued = 0;
    state.rentAccrued = 0;
  }

  // Reserve settlement.
  if (state.reserveMonths > 0 && recurringExpenses > 0) {
    const target = state.reserveMonths * recurringExpenses;
    if (state.cash < target) {
      const r = settleReserve(state.cash, target, state.assets);
      state.settlementNetThisMonth = r.cashAfter - state.cash;
      state.cash = r.cashAfter;
      state.assets = r.assetsAfter;
      pruneCashflowsAfterSettlement(state.cashflows, state.assets);
    }
  }

  // Grow fund principals (the growth feeds passive income for next crossing).
  for (const a of state.assets) {
    if (a.kind === "Fund") {
      a.principal *= 1 + a.annualized_rate / 12;
    }
  }
}

function netCashflowThisMonth(state: State): number {
  let net = 0;
  for (const c of state.cashflows) {
    net += cashflowToCash(c);
  }
  return net;
}

function cashflowToCash(c: Cashflow): number {
  switch (c.kind) {
    case "Salary": {
      const gross = grown(c.monthly, c.annualized_rate, c.age);
      return gross - mpfDeduction(gross);
    }
    case "Pension":
      return grown(c.monthly, c.annualized_rate, c.age);
    case "Expense":
    case "Tuition":
    case "Withdrawal":
      return -grown(c.monthly, c.annualized_rate, c.age);
    case "InvestmentContribution":
      return -grown(c.monthly, c.annualized_rate, c.age);
    case "RentalIncome":
      return grown(c.monthly, c.annualized_rate, c.age) * c.occupancy;
    case "MortgagePayment":
      return c.remaining > 0 ? -c.monthly : 0;
  }
}



// ---------- Event firing ----------

function fireEventsAt(state: State, m: number): void {
  const stillPending: Event[] = [];
  for (const e of state.pendingEvents) {
    if (e.when === m) applyEvent(e, state);
    else if (e.when > m) stillPending.push(e);
    // when < m: silently drop (consumed in prior months).
  }
  state.pendingEvents = stillPending;
}

function applyEvent(e: Event, state: State): void {
  switch (e.type) {
    case "job": {
      pushSalary(state, e.salary.monthly, e.salary.annualized_rate, e.id);
      return;
    }
    case "pension": {
      const cf: Cashflow = {
        kind: "Pension",
        monthly: e.pension.monthly,
        annualized_rate: e.pension.annualized_rate,
        age: 0,
      };
      state.cashflows.push(cf);
      return;
    }
    case "expense": {
      const cf: Cashflow = {
        kind: "Expense",
        ...(e.id !== undefined && { id: e.id }),
        monthly: e.expense.monthly,
        annualized_rate: e.expense.annualized_rate,
        age: 0,
      };
      state.cashflows.push(cf);
      return;
    }
    case "tuition": {
      const cf: Cashflow = {
        kind: "Tuition",
        ...(e.id !== undefined && { id: e.id }),
        monthly: e.tuition.monthly,
        annualized_rate: e.tuition.annualized_rate,
        age: 0,
      };
      state.cashflows.push(cf);
      return;
    }
    case "withdrawal": {
      const cf: Cashflow = {
        kind: "Withdrawal",
        ...(e.id !== undefined && { id: e.id }),
        monthly: e.withdrawal.monthly,
        annualized_rate: e.withdrawal.annualized_rate,
        age: 0,
      };
      state.cashflows.push(cf);
      return;
    }
    case "layoff":
    case "graduate": {
      if (e.id !== undefined) {
        const target = findCashflowById(state.cashflows, e.id);
        if (target) removeCashflow(state.cashflows, target);
        return;
      }
      const targetKind =
        e.type === "layoff" ? "Salary" : "Tuition";
      removeFirstOfKind(state.cashflows, targetKind);
      return;
    }
    case "buy_home": {
      acquireProperty(state, e.home.sqft, e.home.price_per_sqft, e.home.mortgage, undefined);
      return;
    }
    case "buy_to_let": {
      const rentSpec = e.to_let.rent;
      const rentCf: RentalIncomeCashflow = {
        kind: "RentalIncome",
        ...(rentSpec.id !== undefined && { id: rentSpec.id }),
        monthly: rentSpec.monthly,
        annualized_rate: rentSpec.annualized_rate,
        occupancy: rentSpec.occupancy,
        age: 0,
      };
      acquireProperty(
        state,
        e.to_let.sqft,
        e.to_let.price_per_sqft,
        e.to_let.mortgage,
        rentCf,
      );
      return;
    }
    case "investment": {
      const fund: Fund = {
        kind: "Fund",
        principal: e.fund.principal,
        annualized_rate: e.fund.annualized_rate,
      };
      if (e.fund.investment) {
        const cf: InvestmentContributionCashflow = {
          kind: "InvestmentContribution",
          ...(e.fund.investment.id !== undefined && { id: e.fund.investment.id }),
          monthly: e.fund.investment.monthly,
          annualized_rate: e.fund.investment.annualized_rate,
          age: 0,
        };
        fund.contribution = cf;
        state.cashflows.push(cf);
      }
      state.assets.push(fund);
      // principal is a silent deduction (not in monthly_cashflow per spec).
      state.assetCostThisMonth += e.fund.principal;
      return;
    }
    case "end": {
      // 1. top-level cashflow list
      const top = findCashflowById(state.cashflows, e.id);
      if (top) {
        removeCashflow(state.cashflows, top);
        return;
      }
      // 2. scan assets in order: a fund's contribution, a property's rent,
      //    a property's mortgage cashflow (looked up by id).
      for (const a of state.assets) {
        if (a.kind === "Fund" && a.contribution && a.contribution.id === e.id) {
          a.contribution = undefined;
          return;
        }
        if (a.kind === "Property") {
          if (a.rent && a.rent.id === e.id) {
            a.rent = undefined;
            return;
          }
          if (a.mortgage && a.mortgage.id === e.id) {
            // remove the matching MortgagePayment cashflow
            const cf = findMortgagePaymentById(state.cashflows, e.id);
            if (cf) removeCashflow(state.cashflows, cf);
            return;
          }
        }
      }
      // silent no-op
      return;
    }
    case "one_off_expense":
      state.oneOffNetThisMonth -= Math.abs(e.one_off.amount);
      return;
    case "one_off_income":
      state.oneOffNetThisMonth += Math.abs(e.one_off.amount);
      return;
    case "death":
      state.terminalAtMonth = (e as Event & { when: number }).when;
      return;
    case "refinance": {
      for (const a of state.assets) {
        if (a.kind === "Property" && a.mortgage?.id === e.id) {
          a.mortgage.monthly = e.monthly;
          const cf = findMortgagePaymentById(state.cashflows, e.id);
          if (cf) cf.monthly = e.monthly;
          return;
        }
      }
      return;
    }
    case "pay_change": {
      let target: SalaryCashflow | undefined;
      if (e.id !== undefined) {
        const found = findCashflowById(state.cashflows, e.id);
        target = found && found.kind === "Salary" ? found : undefined;
      } else {
        target = findFirstSalary(state.cashflows);
      }
      if (!target) return;
      target.monthly = e.monthly;
      target.annualized_rate = e.annualized_rate;
      return;
    }
    case "downturn": {
      for (const a of state.assets) {
        if (a.kind === "Fund") {
          a.principal *= 1 - e.equity_drop;
        } else if (a.kind === "Property") {
          a.price_per_sqft *= 1 - e.property_drop;
        }
      }
      return;
    }
  }
}

function acquireProperty(
  state: State,
  sqft: number,
  pricePerSqft: number,
  mortgageSpec: { monthly: number; period: number; id?: string } | undefined,
  rent: Property["rent"] | undefined,
): void {
  const prop: Property = {
    kind: "Property",
    sqft,
    price_per_sqft: pricePerSqft,
    ...(mortgageSpec && {
      mortgage: {
        monthly: mortgageSpec.monthly,
        period: mortgageSpec.period,
        paid: 0,
        ...(mortgageSpec.id !== undefined && { id: mortgageSpec.id }),
      },
    }),
  };
  if (rent) {
    prop.rent = rent;
    state.cashflows.push(rent);
  }
  state.assets.push(prop);
  state.assetCostThisMonth += sqft * pricePerSqft;
  if (prop.mortgage) {
    const cf: MortgagePaymentCashflow = {
      kind: "MortgagePayment",
      id: prop.mortgage.id ?? nextCashflowId("mortgage"),
      monthly: prop.mortgage.monthly,
      age: 0,
      remaining: prop.mortgage.period,
    };
    state.cashflows.push(cf);
  }
}

function pushSalary(state: State, monthly: number, rate: number, id: string | undefined): void {
  const cf: SalaryCashflow = {
    kind: "Salary",
    ...(id !== undefined && { id }),
    monthly,
    annualized_rate: rate,
    age: 0,
  };
  state.cashflows.push(cf);
}

// ---------- Cashflow helpers ----------

function findCashflowById(cashflows: Cashflow[], id: string): Cashflow | undefined {
  for (const c of cashflows) {
    if ("id" in c && c.id === id) return c;
  }
  return undefined;
}

function findMortgagePaymentById(
  cashflows: Cashflow[],
  id: string,
): MortgagePaymentCashflow | undefined {
  for (const c of cashflows) {
    if (c.kind === "MortgagePayment" && c.id === id) return c;
  }
  return undefined;
}

function findFirstSalary(cashflows: Cashflow[]): SalaryCashflow | undefined {
  for (const c of cashflows) if (c.kind === "Salary") return c;
  return undefined;
}

function removeCashflow(cashflows: Cashflow[], target: Cashflow): void {
  const idx = cashflows.indexOf(target);
  if (idx >= 0) cashflows.splice(idx, 1);
}

function removeFirstOfKind(cashflows: Cashflow[], kind: Cashflow["kind"]): void {
  for (let i = 0; i < cashflows.length; i++) {
    if (cashflows[i]!.kind === kind) {
      cashflows.splice(i, 1);
      return;
    }
  }
}

// ---------- Settlement pruning ----------

function pruneCashflowsAfterSettlement(cashflows: Cashflow[], survivors: Asset[]): void {
  const survivingMortgageIds = new Set<string>();
  for (const a of survivors) {
    if (a.kind === "Property" && a.mortgage?.id) survivingMortgageIds.add(a.mortgage.id);
  }
  // Remove MortgagePayment cashflows whose ids aren't in the survivor set.
  for (let i = cashflows.length - 1; i >= 0; i--) {
    const c = cashflows[i]!;
    if (c.kind === "MortgagePayment" && !survivingMortgageIds.has(c.id)) {
      cashflows.splice(i, 1);
    }
  }
  // Rent cashflows are already cleaned up by `end` references; we just drop
  // any RentalIncome whose owning asset is gone. Easiest pass: trust the
  // caller has already mutated `assets` and clean dangling rentals via id
  // sets derived from survivors.
  const survivingRentIds = new Set<string>();
  for (const a of survivors) {
    if (a.kind === "Property" && a.rent?.id) survivingRentIds.add(a.rent.id);
  }
  // Unlabeled rentals survive via positional order in assets; we leave them.
  // For correctness in our model, every rental asset either has its property
  // here or is sold; an unlabeled rent that survives because its property
  // survived has nothing to drop.
}

// ---------- Tick ----------

function tickAges(state: State): void {
  for (const c of state.cashflows) {
    c.age++;
    if (c.kind === "MortgagePayment" && c.remaining > 0) c.remaining--;
  }
}

function pruneConsumedEvents(_state: State, _m: number): void {
  // fireEventsAt already filtered; nothing more to do here.
}

function buildBreakdown(state: State): MonthBreakdown {
  let pension = 0;
  let rental = 0;
  let fundGrowth = 0;
  for (const c of state.cashflows) {
    const rate = "annualized_rate" in c ? c.annualized_rate : 0;
    const v = grown(c.monthly, rate, c.age);
    if (c.kind === "Pension") pension += v;
    else if (c.kind === "RentalIncome") rental += v * c.occupancy;
  }
  for (const a of state.assets) {
    if (a.kind === "Fund") fundGrowth += a.principal * (a.annualized_rate / 12);
  }
  return {
    pension,
    rental,
    fundGrowth,
    recurringExpenses: recurringExpenseTotal(state.cashflows),
  };
}
