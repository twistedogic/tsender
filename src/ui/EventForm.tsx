import { useId } from "react";
import type { Event, OneOffBody, Growth, MortgageSpec, RentSpec } from "@/scenario/types";
import { humanize } from "@/ui/labels";
import {
  candidatesFor,
  isTargeting,
  kindTitle,
  type ActiveItem,
  type ItemKind,
} from "@/ui/activeItems";
import type { Scenario } from "@/scenario/types";

interface BaseProps {
  event: Event;
  onChange: (e: Event) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  index: number;
  scenario: Scenario;
}

export function EventForm({ event, onChange, onRemove, onDuplicate, index, scenario }: BaseProps) {
  const setWhen = (when: number) => onChange({ ...event, when });
  return (
    <fieldset className="event-form" data-testid={`event-${index}`}>
      <legend>
        <code>{humanize(event.type)}</code> at month{" "}
        <input
          type="number"
          min={0}
          step={1}
          value={event.when}
          onChange={(e) => setWhen(Number(e.currentTarget.value))}
          aria-label="Month"
        />
      </legend>
      <Body event={event} onChange={onChange} scenario={scenario} />
      <div className="event-actions">
        <button type="button" onClick={onDuplicate}>Duplicate</button>
        <button type="button" onClick={onRemove}>Remove</button>
      </div>
    </fieldset>
  );
}

function Body({
  event,
  onChange,
  scenario,
}: {
  event: Event;
  onChange: (e: Event) => void;
  scenario: Scenario;
}) {
  switch (event.type) {
    case "job":
      return <JobBody event={event} onChange={onChange} scenario={scenario} />;
    case "pension":
      return <PensionBody event={event} onChange={onChange} scenario={scenario} />;
    case "expense":
    case "tuition":
    case "withdrawal":
      return <GrowthBody event={event} onChange={onChange} scenario={scenario} />;
    case "layoff":
    case "graduate":
      return <IdOnly event={event} onChange={onChange} scenario={scenario} />;
    case "buy_home":
      return <BuyHomeBody event={event} onChange={onChange} scenario={scenario} />;
    case "buy_to_let":
      return <BuyToLetBody event={event} onChange={onChange} scenario={scenario} />;
    case "investment":
      return <InvestmentBody event={event} onChange={onChange} scenario={scenario} />;
    case "end":
      return <EndBody event={event} onChange={onChange} scenario={scenario} />;
    case "one_off_expense":
    case "one_off_income":
      return <OneOffBody event={event} onChange={onChange} scenario={scenario} />;
    case "death":
      return <p className="hint">No fields.</p>;
    case "refinance":
      return <RefinanceBody event={event} onChange={onChange} scenario={scenario} />;
    case "pay_change":
      return <PayChangeBody event={event} onChange={onChange} scenario={scenario} />;
    case "downturn":
      return <DownturnBody event={event} onChange={onChange} scenario={scenario} />;
  }
}

// ---------- Per-type bodies ----------

interface ChangedProps {
  event: Event;
  onChange: (e: Event) => void;
  scenario: Scenario;
}

function JobBody({ event, onChange }: ChangedProps) {
  if (event.type !== "job") return null;
  return (
    <>
      <LabeledId event={event} onChange={onChange} />
      <GrowthFields
        value={event.salary}
        onChange={(g) => onChange({ ...event, salary: g })}
      />
    </>
  );
}

function PensionBody({ event, onChange }: ChangedProps) {
  if (event.type !== "pension") return null;
  return (
    <GrowthFields
      value={event.pension}
      onChange={(g) => onChange({ ...event, pension: g })}
    />
  );
}

function GrowthBody({ event, onChange }: ChangedProps) {
  if (
    event.type !== "expense" &&
    event.type !== "tuition" &&
    event.type !== "withdrawal"
  ) {
    return null;
  }
  const bodyKey = event.type;
  const bodyValue =
    bodyKey === "expense"
      ? event.expense
      : bodyKey === "tuition"
        ? event.tuition
        : event.withdrawal;
  return (
    <>
      <LabeledId event={event} onChange={onChange} />
      <GrowthFields
        value={bodyValue}
        onChange={(g) =>
          onChange(
            bodyKey === "expense"
              ? { ...event, expense: g }
              : bodyKey === "tuition"
                ? { ...event, tuition: g }
                : { ...event, withdrawal: g },
          )
        }
      />
    </>
  );
}

function IdOnly({ event, onChange, scenario }: ChangedProps) {
  if (event.type !== "layoff" && event.type !== "graduate") return null;
  return (
    <>
      <ItemSelect event={event} onChange={onChange} scenario={scenario} optional />
    </>
  );
}

function BuyHomeBody({ event, onChange }: ChangedProps) {
  if (event.type !== "buy_home") return null;
  return (
    <PropertySpecEditor
      value={event.home}
      onChange={(home) => onChange({ ...event, home })}
      allowMortgage
      mortgage={event.home.mortgage}
      onMortgageChange={(m) =>
        onChange({
          ...event,
          home: { ...event.home, ...(m ? { mortgage: m } : {}) },
        })
      }
    />
  );
}

function BuyToLetBody({ event, onChange }: ChangedProps) {
  if (event.type !== "buy_to_let") return null;
  return (
    <>
      <PropertySpecEditor
        value={{ sqft: event.to_let.sqft, price_per_sqft: event.to_let.price_per_sqft }}
        onChange={(p) => onChange({ ...event, to_let: { ...event.to_let, ...p } })}
        allowMortgage
        mortgage={event.to_let.mortgage}
        onMortgageChange={(m) => onChange({ ...event, to_let: { ...event.to_let, ...(m ? { mortgage: m } : {}) } })}
      />
      <RentEditor
        value={event.to_let.rent}
        onChange={(r) => onChange({ ...event, to_let: { ...event.to_let, rent: r } })}
      />
    </>
  );
}

function InvestmentBody({ event, onChange }: ChangedProps) {
  if (event.type !== "investment") return null;
  const set = (patch: Partial<typeof event.fund>) =>
    onChange({ ...event, fund: { ...event.fund, ...patch } });
  return (
    <>
      <NumberField label="Principal" value={event.fund.principal} onChange={(v) => set({ principal: v })} step={1} />
      <NumberField label="Annual growth rate" value={event.fund.annualized_rate} onChange={(v) => set({ annualized_rate: v })} step={0.01} />
      {event.fund.investment !== undefined ? (
        <>
          <h4>Monthly contribution</h4>
          <NumberField
            label="Monthly"
            value={event.fund.investment.monthly}
            onChange={(v) => set({ investment: { ...event.fund.investment!, monthly: v } })}
            step={1}
          />
          <NumberField
            label="Annual growth rate"
            value={event.fund.investment.annualized_rate}
            onChange={(v) => set({ investment: { ...event.fund.investment!, annualized_rate: v } })}
            step={0.01}
          />
          <TextField
            label="ID"
            value={event.fund.investment.id ?? ""}
            onChange={(s) =>
              set({
                investment: withId(event.fund.investment!, s),
              })
            }
          />
          <button type="button" onClick={() => set({ investment: undefined })}>
            Remove contribution
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() =>
            set({ investment: { monthly: 0, annualized_rate: 0 } })
          }
        >
          Add monthly contribution
        </button>
      )}
    </>
  );
}

function EndBody({ event, onChange, scenario }: ChangedProps) {
  if (event.type !== "end") return null;
  return <ItemSelect event={event} onChange={onChange} scenario={scenario} />;
}

function OneOffBody({ event, onChange }: ChangedProps) {
  if (event.type !== "one_off_expense" && event.type !== "one_off_income") return null;
  return (
    <>
      <LabeledId event={event} onChange={onChange} />
      <OneOffAmount value={event.one_off} onChange={(one_off) => onChange({ ...event, one_off })} />
    </>
  );
}

function RefinanceBody({ event, onChange, scenario }: ChangedProps) {
  if (event.type !== "refinance") return null;
  return (
    <>
      <ItemSelect event={event} onChange={onChange} scenario={scenario} />
      <NumberField
        label="Monthly"
        value={event.monthly}
        onChange={(v) => onChange({ ...event, monthly: v })}
        step={1}
      />
    </>
  );
}

function PayChangeBody({ event, onChange, scenario }: ChangedProps) {
  if (event.type !== "pay_change") return null;
  return (
    <>
      <ItemSelect event={event} onChange={onChange} scenario={scenario} optional />
      <NumberField
        label="Monthly"
        value={event.monthly}
        onChange={(v) => onChange({ ...event, monthly: v })}
        step={1}
      />
      <NumberField
        label="Annual growth rate"
        value={event.annualized_rate}
        onChange={(v) => onChange({ ...event, annualized_rate: v })}
        step={0.01}
      />
    </>
  );
}

function DownturnBody({ event, onChange }: ChangedProps) {
  if (event.type !== "downturn") return null;
  return (
    <>
      <NumberField
        label="Fund drop (fraction)"
        value={event.equity_drop}
        onChange={(v) => onChange({ ...event, equity_drop: v })}
        step={0.05}
        min={0}
        max={0.999}
      />
      <NumberField
        label="Property drop (fraction)"
        value={event.property_drop}
        onChange={(v) => onChange({ ...event, property_drop: v })}
        step={0.05}
        min={0}
        max={0.999}
      />
    </>
  );
}

// ---------- Field primitives ----------

/**
 * The choice a targeting event offers: items alive at this event's month,
 * filtered to the kinds the simulator can actually reach.
 *
 * A stored id the replay did not produce stays in the list, so a scenario
 * restored from localStorage is never silently rewritten by opening the form.
 */
function ItemSelect({
  event,
  onChange,
  scenario,
  optional,
}: {
  event: Event;
  onChange: (e: Event) => void;
  scenario: Scenario;
  optional?: boolean;
}) {
  const type = event.type;
  if (!isTargeting(type)) return null;

  const candidates = candidatesFor(scenario, event.when, type);
  const stored = "id" in event ? event.id : undefined;
  // An empty id is how "Add event" seeds a targeting event; treat it as unset
  // so an unbuildable target falls through to the disabled branch below.
  const hasStored = stored !== undefined && stored !== "";
  const known = candidates.some((c) => c.name === stored);
  const options = hasStored && !known
    ? [...candidates, { name: stored, kind: "salary" as ItemKind }]
    : candidates;

  const id = useId();
  const label = `${humanize(type)} item${optional ? " (optional — blank takes the first of kind)" : ""}`;
  const setId = (value: string) =>
    onChange({ ...event, ...(value ? { id: value } : { id: undefined }) } as Event);

  if (options.length === 0) {
    return (
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <select id={id} disabled value="">
          <option value="">No active items</option>
        </select>
      </div>
    );
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={hasStored ? stored : ""}
        onChange={(e) => setId(e.currentTarget.value)}
      >
        {optional ? <option value="">{optionalLabel()}</option> : null}
        {!optional && !hasStored ? <option value="">{unsetLabel()}</option> : null}
        {groupByKind(options).map(([kind, group]) => (
          <optgroup key={kind} label={kindTitle(kind)}>
            {group.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

function optionalLabel(): string {
  return "First of kind";
}

/** The state of a required target that has not been chosen yet. */
function unsetLabel(): string {
  return "Choose an item…";
}

function groupByKind(items: ActiveItem[]): [ItemKind, ActiveItem[]][] {
  const groups = new Map<ItemKind, ActiveItem[]>();
  for (const item of items) {
    const list = groups.get(item.kind);
    if (list) list.push(item);
    else groups.set(item.kind, [item]);
  }
  return [...groups];
}

function LabeledId({
  event,
  onChange,
  label = "Name",
}: {
  event: Event;
  onChange: (e: Event) => void;
  label?: string;
}) {
  const id = "id" in event ? event.id ?? "" : "";
  return (
    <TextField
      label={label}
      value={id}
      onChange={(v) => onChange(withId(event as { id?: string }, v) as Event)}
    />
  );
}

/**
 * Set an id, or drop it when the field is emptied — an emptied field must
 * not keep the old name.
 */
function withId<T extends { id?: string }>(base: T, value: string): T {
  return { ...base, ...(value ? { id: value } : { id: undefined }) };
}

function GrowthFields({
  value,
  onChange,
}: {
  value: Growth;
  onChange: (g: Growth) => void;
}) {
  return (
    <>
      <NumberField label="Monthly" value={value.monthly} onChange={(v) => onChange({ ...value, monthly: v })} step={1} />
      <NumberField label="Annual growth rate" value={value.annualized_rate} onChange={(v) => onChange({ ...value, annualized_rate: v })} step={0.01} />
    </>
  );
}

function PropertySpecEditor({
  value,
  onChange,
  allowMortgage,
  mortgage,
  onMortgageChange,
}: {
  value: { sqft: number; price_per_sqft: number };
  onChange: (p: { sqft: number; price_per_sqft: number }) => void;
  allowMortgage?: boolean;
  mortgage?: MortgageSpec;
  onMortgageChange?: (m: MortgageSpec | undefined) => void;
}) {
  return (
    <>
      <NumberField label="Floor area (sq ft)" value={value.sqft} onChange={(v) => onChange({ ...value, sqft: v })} step={1} min={1} />
      <NumberField
        label="Price per sqft"
        value={value.price_per_sqft}
        onChange={(v) => onChange({ ...value, price_per_sqft: v })}
        step={1}
      />
      {allowMortgage && onMortgageChange ? <MortgageEditor mortgage={mortgage} onChange={onMortgageChange} /> : null}
    </>
  );
}

function MortgageEditor({
  mortgage,
  onChange,
}: {
  mortgage?: MortgageSpec;
  onChange: (m: MortgageSpec | undefined) => void;
}) {
  if (mortgage === undefined) {
    return (
      <button
        type="button"
        onClick={() => onChange({ monthly: 0, period: 0 })}
      >
        Add mortgage
      </button>
    );
  }
  return (
    <fieldset className="mortgage-block">
      <legend>Mortgage</legend>
      <NumberField label="Monthly" value={mortgage.monthly} onChange={(v) => onChange({ ...mortgage, monthly: v })} step={1} />
      <NumberField label="Term (months)" value={mortgage.period} onChange={(v) => onChange({ ...mortgage, period: v })} step={1} min={0} />
      <TextField label="ID (optional)" value={mortgage.id ?? ""} onChange={(s) => onChange(withId(mortgage, s))} />
      <button type="button" onClick={() => onChange(undefined)}>Remove mortgage</button>
    </fieldset>
  );
}

function RentEditor({ value, onChange }: { value: RentSpec; onChange: (r: RentSpec) => void }) {
  return (
    <fieldset className="rent-block">
      <legend>Rent</legend>
      <NumberField label="Monthly" value={value.monthly} onChange={(v) => onChange({ ...value, monthly: v })} step={1} />
      <NumberField label="Annual growth rate" value={value.annualized_rate} onChange={(v) => onChange({ ...value, annualized_rate: v })} step={0.01} />
      <NumberField label="Occupancy (0-1)" value={value.occupancy} onChange={(v) => onChange({ ...value, occupancy: v })} step={0.1} min={0} max={1} />
      <TextField label="ID (optional)" value={value.id ?? ""} onChange={(s) => onChange(withId(value, s))} />
    </fieldset>
  );
}

function OneOffAmount({ value, onChange }: { value: OneOffBody; onChange: (o: OneOffBody) => void }) {
  return (
    <NumberField label="Amount" value={value.amount} onChange={(v) => onChange({ amount: v })} step={1} />
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="field">
      <span>{label}{required ? " *" : ""}</span>
      <input id={id} type="text" value={value} required={required} onChange={(e) => onChange(e.currentTarget.value)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="field">
      <span>{label}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ""}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          const n = raw === "" ? 0 : Number(raw);
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
    </label>
  );
}
