/**
 * Scenario YAML loader + serializer.
 *
 * Spec: openspec/changes/add-tsender-v01/specs/scenario-loading/spec.md
 * (Error reporting names the source. Unknown types fail loading. Missing
 * required fields fail loading.)
 */

import { parse as parseYaml, stringify as yamlStringify } from "yaml";
import type {
  Event,
  Growth,
  InvestmentEvent,
  JobEvent,
  MortgageSpec,
  OneOffBody,
  OneOffExpenseEvent,
  OneOffIncomeEvent,
  ParentAllowance,
  PropertySpec,
  RentSpec,
  Scenario,
  TaxBlock,
  ToLetSpec,
} from "@/scenario/types";

const KNOWN_EVENT_TYPES = new Set([
  "job",
  "pension",
  "expense",
  "tuition",
  "withdrawal",
  "layoff",
  "graduate",
  "buy_home",
  "buy_to_let",
  "investment",
  "end",
  "one_off_expense",
  "one_off_income",
  "death",
  "refinance",
  "pay_change",
  "downturn",
]);

// ---------- Errors ----------

export class ScenarioLoadError extends Error {
  constructor(message: string, public readonly source: string) {
    super(`${source}: ${message}`);
    this.name = "ScenarioLoadError";
  }
}

// ---------- Loader ----------

export function loadScenario(yaml: string, source = "scenario.yaml"): Scenario {
  let raw: unknown;
  try {
    raw = parseYaml(yaml);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ScenarioLoadError(`malformed YAML: ${msg}`, source);
  }
  if (raw === null || raw === undefined) {
    throw new ScenarioLoadError("document is empty", source);
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new ScenarioLoadError("root must be a mapping", source);
  }

  const r = raw as Record<string, unknown>;
  const cash = requireNumber(r.cash, "cash", source);
  if (cash < 0) throw new ScenarioLoadError("cash must be >= 0", source);

  let reserve_months: number | undefined;
  if ("reserve_months" in r && r.reserve_months !== undefined) {
    reserve_months = requireNonNegativeInt(r.reserve_months, "reserve_months", source);
  }

  let start: string | undefined;
  if ("start" in r && r.start !== undefined) {
    start = requireMonthString(r.start, "start", source);
  }
  let end: string | undefined;
  if ("end" in r && r.end !== undefined) {
    end = requireMonthString(r.end, "end", source);
  }
  if (start && end && monthIndex(start) > monthIndex(end)) {
    throw new ScenarioLoadError(`start (${start}) is after end (${end})`, source);
  }

  let saving: number | undefined;
  if ("saving" in r && r.saving !== undefined) {
    saving = requireNumber(r.saving, "saving", source);
    if (saving < 0) throw new ScenarioLoadError("saving must be >= 0", source);
  }

  const tax = "tax" in r && r.tax !== undefined ? parseTax(r.tax, source) : undefined;

  const eventsRaw = r.events;
  if (eventsRaw === undefined) {
    throw new ScenarioLoadError("events list is required", source);
  }
  if (!Array.isArray(eventsRaw)) {
    throw new ScenarioLoadError("events must be a list", source);
  }
  const events: Event[] = eventsRaw.map((e, i) => parseEvent(e, source, i));

  const scenario: Scenario = {
    cash,
    events,
    ...(reserve_months !== undefined && { reserve_months }),
    ...(start && { start }),
    ...(end && { end }),
    ...(saving !== undefined && { saving }),
    ...(tax && { tax }),
  };
  return scenario;
}

function parseEvent(raw: unknown, source: string, index: number): Event {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ScenarioLoadError(`event ${index}: must be a mapping`, source);
  }
  const e = raw as Record<string, unknown>;
  const type = e.type;
  if (typeof type !== "string") {
    throw new ScenarioLoadError(`event ${index}: type is required`, source);
  }
  if (!KNOWN_EVENT_TYPES.has(type)) {
    throw new ScenarioLoadError(`event ${index}: unknown event type '${type}'`, source);
  }
  const when = requireNonNegativeInt(e.when, `event ${index} (${type}).when`, source);

  switch (type) {
    case "job":
      return {
        type,
        when,
        ...(typeof e.id === "string" && { id: e.id }),
        salary: requireGrowth(e.salary, `event ${index} (${type}).salary`, source),
      } satisfies JobEvent;

    case "pension":
      if (e.pension === undefined) {
        throw new ScenarioLoadError(
          `event ${index} (pension): pension body is required`,
          source,
        );
      }
      return {
        type,
        when,
        pension: requireGrowth(e.pension, `event ${index} (pension).pension`, source),
      };

    case "expense":
    case "tuition":
    case "withdrawal": {
      const body = requireGrowth(e[type], `event ${index} (${type}).${type}`, source);
      return {
        type,
        when,
        ...(typeof e.id === "string" && { id: e.id }),
        [type]: body,
      } as Event;
    }

    case "layoff":
    case "graduate":
      return {
        type,
        when,
        ...(typeof e.id === "string" && { id: e.id }),
      } as Event;

    case "buy_home":
      return {
        type,
        when,
        home: parsePropertySpec(e.home, `event ${index} (buy_home).home`, source),
      };

    case "buy_to_let":
      return {
        type,
        when,
        to_let: parseToLetSpec(e.to_let, `event ${index} (buy_to_let).to_let`, source),
      };

    case "investment":
      return {
        type,
        when,
        fund: parseFundSpec(e.fund, `event ${index} (investment).fund`, source),
      };

    case "end": {
      const id = requireString(e.id, `event ${index} (end).id`, source);
      return { type, when, id };
    }

    case "one_off_expense":
      return parseOneOff("one_off_expense", when, e, index, source) as OneOffExpenseEvent;
    case "one_off_income":
      return parseOneOff("one_off_income", when, e, index, source) as OneOffIncomeEvent;

    case "death":
      return { type, when };

    case "refinance": {
      const id = requireString(e.id, `event ${index} (refinance).id`, source);
      const monthly = requireNumber(
        e.monthly,
        `event ${index} (refinance).monthly`,
        source,
      );
      if (monthly < 0) {
        throw new ScenarioLoadError(
          `event ${index} (refinance).monthly: must be >= 0`,
          source,
        );
      }
      return { type, when, id, monthly };
    }

    case "pay_change": {
      const monthly = requireNumber(
        e.monthly,
        `event ${index} (pay_change).monthly`,
        source,
      );
      const annualized_rate = requireNumber(
        e.annualized_rate,
        `event ${index} (pay_change).annualized_rate`,
        source,
      );
      return {
        type,
        when,
        monthly,
        annualized_rate,
        ...(typeof e.id === "string" && { id: e.id }),
      };
    }

    case "downturn": {
      const equity_drop = requireNumber(
        e.equity_drop,
        `event ${index} (downturn).equity_drop`,
        source,
      );
      const property_drop = requireNumber(
        e.property_drop,
        `event ${index} (downturn).property_drop`,
        source,
      );
      if (equity_drop < 0 || equity_drop >= 1) {
        throw new ScenarioLoadError(
          `event ${index} (downturn).equity_drop: must be in [0, 1)`,
          source,
        );
      }
      if (property_drop < 0 || property_drop >= 1) {
        throw new ScenarioLoadError(
          `event ${index} (downturn).property_drop: must be in [0, 1)`,
          source,
        );
      }
      return { type, when, equity_drop, property_drop };
    }
  }
  throw new ScenarioLoadError(`event ${index}: unknown type '${type}'`, source);
}

function parseOneOff(
  type: "one_off_expense" | "one_off_income",
  when: number,
  e: Record<string, unknown>,
  index: number,
  source: string,
): OneOffExpenseEvent | OneOffIncomeEvent {
  if (e.one_off === undefined) {
    throw new ScenarioLoadError(`event ${index} (${type}): one_off body is required`, source);
  }
  const body = requireOneOff(e.one_off, `event ${index} (${type}).one_off`, source);
  const out = {
    type,
    when,
    ...(typeof e.id === "string" && { id: e.id }),
    one_off: body,
  };
  return out as OneOffExpenseEvent | OneOffIncomeEvent;
}

function parsePropertySpec(raw: unknown, path: string, source: string): PropertySpec {
  const obj = requireObject(raw, path, source);
  const sqft = requireNumber(obj.sqft, `${path}.sqft`, source);
  const price_per_sqft = requireNumber(obj.price_per_sqft, `${path}.price_per_sqft`, source);
  if (sqft <= 0 || price_per_sqft < 0) {
    throw new ScenarioLoadError(`${path}: sqft must be > 0 and price_per_sqft >= 0`, source);
  }
  const mortgage =
    obj.mortgage !== undefined
      ? parseMortgageSpec(obj.mortgage, `${path}.mortgage`, source)
      : undefined;
  const out: PropertySpec = { sqft, price_per_sqft };
  if (mortgage) Object.assign(out, { mortgage });
  return out;
}

function parseToLetSpec(raw: unknown, path: string, source: string): ToLetSpec {
  const obj = requireObject(raw, path, source);
  const sqft = requireNumber(obj.sqft, `${path}.sqft`, source);
  const price_per_sqft = requireNumber(obj.price_per_sqft, `${path}.price_per_sqft`, source);
  if (sqft <= 0 || price_per_sqft < 0) {
    throw new ScenarioLoadError(`${path}: sqft must be > 0 and price_per_sqft >= 0`, source);
  }
  const mortgage =
    obj.mortgage !== undefined
      ? parseMortgageSpec(obj.mortgage, `${path}.mortgage`, source)
      : undefined;
  const rent = parseRentSpec(obj.rent, `${path}.rent`, source);
  const out: ToLetSpec = { sqft, price_per_sqft, rent };
  if (mortgage) Object.assign(out, { mortgage });
  return out;
}

function parseRentSpec(raw: unknown, path: string, source: string): RentSpec {
  const obj = requireObject(raw, path, source);
  const monthly = requireNumber(obj.monthly, `${path}.monthly`, source);
  const annualized_rate = requireNumber(
    obj.annualized_rate,
    `${path}.annualized_rate`,
    source,
  );
  const occupancy = requireNumber(obj.occupancy, `${path}.occupancy`, source);
  if (occupancy < 0 || occupancy > 1) {
    throw new ScenarioLoadError(`${path}.occupancy: must be in [0, 1]`, source);
  }
  return {
    monthly,
    annualized_rate,
    occupancy,
    ...(typeof obj.id === "string" && { id: obj.id }),
  };
}

function parseFundSpec(raw: unknown, path: string, source: string): InvestmentEvent["fund"] {
  const obj = requireObject(raw, path, source);
  const principal = requireNumber(obj.principal, `${path}.principal`, source);
  const annualized_rate = requireNumber(
    obj.annualized_rate,
    `${path}.annualized_rate`,
    source,
  );
  let investment: InvestmentEvent["fund"]["investment"];
  if (obj.investment !== undefined) {
    const invObj = requireObject(obj.investment, `${path}.investment`, source);
    const monthly = requireNumber(invObj.monthly, `${path}.investment.monthly`, source);
    const inv_rate = requireNumber(
      invObj.annualized_rate,
      `${path}.investment.annualized_rate`,
      source,
    );
    investment = {
      monthly,
      annualized_rate: inv_rate,
      ...(typeof invObj.id === "string" && { id: invObj.id }),
    };
  }
  const out: InvestmentEvent["fund"] = { principal, annualized_rate };
  if (investment) Object.assign(out, { investment });
  return out;
}

function parseMortgageSpec(raw: unknown, path: string, source: string): MortgageSpec {
  const obj = requireObject(raw, path, source);
  const monthly = requireNumber(obj.monthly, `${path}.monthly`, source);
  const period = requireNonNegativeInt(obj.period, `${path}.period`, source);
  if (monthly < 0) {
    throw new ScenarioLoadError(`${path}.monthly: must be >= 0`, source);
  }
  return {
    monthly,
    period,
    ...(typeof obj.id === "string" && { id: obj.id }),
  };
}

function parseTax(raw: unknown, source: string): TaxBlock {
  const obj = requireObject(raw, "tax", source);
  const allowed = new Set(["status", "children", "parents"]);
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) {
      throw new ScenarioLoadError(`tax: unknown field '${k}'`, source);
    }
  }
  const out: TaxBlock = {};
  if (obj.status !== undefined) {
    if (obj.status !== "single" && obj.status !== "married") {
      throw new ScenarioLoadError(`tax.status: must be 'single' or 'married'`, source);
    }
    out.status = obj.status;
  }
  if (obj.children !== undefined) {
    out.children = requireNonNegativeInt(obj.children, "tax.children", source);
  }
  if (obj.parents !== undefined) {
    if (!Array.isArray(obj.parents)) {
      throw new ScenarioLoadError("tax.parents: must be a list", source);
    }
    out.parents = obj.parents.map((p, i) => parseParent(p, i, source));
  }
  return out;
}

function parseParent(raw: unknown, index: number, source: string): ParentAllowance {
  const obj = requireObject(raw, `tax.parents[${index}]`, source);
  if (obj.age_band === undefined) {
    throw new ScenarioLoadError(
      `tax.parents[${index}].age_band: required (use '60+' or '55-59')`,
      source,
    );
  }
  if (obj.age_band !== "60+" && obj.age_band !== "55-59") {
    throw new ScenarioLoadError(
      `tax.parents[${index}].age_band: must be '60+' or '55-59'`,
      source,
    );
  }
  if (typeof obj.living_with !== "boolean") {
    throw new ScenarioLoadError(
      `tax.parents[${index}].living_with: required boolean`,
      source,
    );
  }
  return { age_band: obj.age_band, living_with: obj.living_with };
}

// ---------- Helpers ----------

function requireNumber(v: unknown, path: string, source: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new ScenarioLoadError(`${path}: must be a finite number`, source);
  }
  return v;
}

function requireString(v: unknown, path: string, source: string): string {
  if (typeof v !== "string") {
    throw new ScenarioLoadError(`${path}: required string`, source);
  }
  return v;
}

function requireNonNegativeInt(v: unknown, path: string, source: string): number {
  const n = requireNumber(v, path, source);
  if (!Number.isInteger(n) || n < 0) {
    throw new ScenarioLoadError(`${path}: must be a non-negative integer`, source);
  }
  return n;
}

function requireObject(v: unknown, path: string, source: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new ScenarioLoadError(`${path}: must be a mapping`, source);
  }
  return v as Record<string, unknown>;
}

function requireGrowth(v: unknown, path: string, source: string): Growth {
  const obj = requireObject(v, path, source);
  return {
    monthly: requireNumber(obj.monthly, `${path}.monthly`, source),
    annualized_rate: requireNumber(
      obj.annualized_rate,
      `${path}.annualized_rate`,
      source,
    ),
  };
}

function requireOneOff(v: unknown, path: string, source: string): OneOffBody {
  const obj = requireObject(v, path, source);
  return { amount: requireNumber(obj.amount, `${path}.amount`, source) };
}

function requireMonthString(v: unknown, path: string, source: string): string {
  const s = requireString(v, path, source);
  if (!/^\d{4}-\d{2}$/.test(s)) {
    throw new ScenarioLoadError(`${path}: must match YYYY-MM`, source);
  }
  return s;
}

function monthIndex(yyyymm: string): number {
  const [y, m] = yyyymm.split("-").map(Number) as [number, number];
  return y * 12 + (m - 1);
}

// ---------- Serializer (round-trip) ----------

export function serializeScenario(s: Scenario): string {
  const obj: Record<string, unknown> = {
    cash: s.cash,
    events: s.events.map(serializeEvent),
  };
  if (s.reserve_months !== undefined) obj.reserve_months = s.reserve_months;
  if (s.start) obj.start = s.start;
  if (s.end) obj.end = s.end;
  if (s.saving !== undefined) obj.saving = s.saving;
  if (s.tax && (s.tax.status || s.tax.children || s.tax.parents)) {
    obj.tax = serializeTax(s.tax);
  }
  return yamlStringify(obj, { lineWidth: 0 });
}

function serializeEvent(e: Event): Record<string, unknown> {
  const base: Record<string, unknown> = { type: e.type, when: e.when };
  switch (e.type) {
    case "job":
      if (e.id) base.id = e.id;
      base.salary = { monthly: e.salary.monthly, annualized_rate: e.salary.annualized_rate };
      return base;
    case "pension":
      base.pension = {
        monthly: e.pension.monthly,
        annualized_rate: e.pension.annualized_rate,
      };
      return base;
    case "expense":
      if (e.id) base.id = e.id;
      base.expense = {
        monthly: e.expense.monthly,
        annualized_rate: e.expense.annualized_rate,
      };
      return base;
    case "tuition":
      if (e.id) base.id = e.id;
      base.tuition = {
        monthly: e.tuition.monthly,
        annualized_rate: e.tuition.annualized_rate,
      };
      return base;
    case "withdrawal":
      if (e.id) base.id = e.id;
      base.withdrawal = {
        monthly: e.withdrawal.monthly,
        annualized_rate: e.withdrawal.annualized_rate,
      };
      return base;
    case "layoff":
    case "graduate":
      if (e.id) base.id = e.id;
      return base;
    case "buy_home":
      base.home = serializePropertySpec(e.home);
      return base;
    case "buy_to_let":
      base.to_let = serializeToLetSpec(e.to_let);
      return base;
    case "investment":
      base.fund = serializeFundSpec(e.fund);
      return base;
    case "end":
      base.id = e.id;
      return base;
    case "one_off_expense":
    case "one_off_income":
      if (e.id) base.id = e.id;
      base.one_off = { amount: e.one_off.amount };
      return base;
    case "death":
      return base;
    case "refinance":
      base.id = e.id;
      base.monthly = e.monthly;
      return base;
    case "pay_change":
      if (e.id) base.id = e.id;
      base.monthly = e.monthly;
      base.annualized_rate = e.annualized_rate;
      return base;
    case "downturn":
      base.equity_drop = e.equity_drop;
      base.property_drop = e.property_drop;
      return base;
  }
}

function serializePropertySpec(p: PropertySpec): Record<string, unknown> {
  const o: Record<string, unknown> = {
    sqft: p.sqft,
    price_per_sqft: p.price_per_sqft,
  };
  if (p.mortgage) o.mortgage = serializeMortgage(p.mortgage);
  return o;
}

function serializeToLetSpec(p: ToLetSpec): Record<string, unknown> {
  const o: Record<string, unknown> = {
    sqft: p.sqft,
    price_per_sqft: p.price_per_sqft,
    rent: {
      monthly: p.rent.monthly,
      annualized_rate: p.rent.annualized_rate,
      occupancy: p.rent.occupancy,
    },
  };
  if (p.mortgage) o.mortgage = serializeMortgage(p.mortgage);
  if (p.rent.id) (o.rent as Record<string, unknown>).id = p.rent.id;
  return o;
}

function serializeFundSpec(f: InvestmentEvent["fund"]): Record<string, unknown> {
  const o: Record<string, unknown> = {
    principal: f.principal,
    annualized_rate: f.annualized_rate,
  };
  if (f.investment) {
    const inv: Record<string, unknown> = {
      monthly: f.investment.monthly,
      annualized_rate: f.investment.annualized_rate,
    };
    if (f.investment.id) inv.id = f.investment.id;
    o.investment = inv;
  }
  return o;
}

function serializeMortgage(m: MortgageSpec): Record<string, unknown> {
  const o: Record<string, unknown> = { monthly: m.monthly, period: m.period };
  if (m.id) o.id = m.id;
  return o;
}

function serializeTax(tax: TaxBlock): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (tax.status) o.status = tax.status;
  if (tax.children !== undefined) o.children = tax.children;
  if (tax.parents) {
    o.parents = tax.parents.map((p) => ({ age_band: p.age_band, living_with: p.living_with }));
  }
  return o;
}
