import { useId } from "react";
import type { Event, OneOffBody, Growth, MortgageSpec, RentSpec } from "@/scenario/types";

interface BaseProps {
  event: Event;
  onChange: (e: Event) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  index: number;
}

export function EventForm({ event, onChange, onRemove, onDuplicate, index }: BaseProps) {
  const setWhen = (when: number) => onChange({ ...event, when });
  return (
    <fieldset className="event-form" data-testid={`event-${index}`}>
      <legend>
        <code>{event.type}</code> @ month{" "}
        <input
          type="number"
          min={0}
          step={1}
          value={event.when}
          onChange={(e) => setWhen(Number(e.currentTarget.value))}
          aria-label="when"
        />
      </legend>
      <Body event={event} onChange={onChange} />
      <div className="event-actions">
        <button type="button" onClick={onDuplicate}>Duplicate</button>
        <button type="button" onClick={onRemove}>Remove</button>
      </div>
    </fieldset>
  );
}

function Body({ event, onChange }: { event: Event; onChange: (e: Event) => void }) {
  switch (event.type) {
    case "job":
      return <JobBody event={event} onChange={onChange} />;
    case "pension":
      return <PensionBody event={event} onChange={onChange} />;
    case "expense":
    case "tuition":
    case "withdrawal":
      return <GrowthBody event={event} onChange={onChange} />;
    case "layoff":
    case "graduate":
      return <IdOnly event={event} onChange={onChange} />;
    case "buy_home":
      return <BuyHomeBody event={event} onChange={onChange} />;
    case "buy_to_let":
      return <BuyToLetBody event={event} onChange={onChange} />;
    case "investment":
      return <InvestmentBody event={event} onChange={onChange} />;
    case "end":
      return <EndBody event={event} onChange={onChange} />;
    case "one_off_expense":
    case "one_off_income":
      return <OneOffBody event={event} onChange={onChange} />;
    case "death":
      return <p className="hint">No fields.</p>;
    case "refinance":
      return <RefinanceBody event={event} onChange={onChange} />;
    case "pay_change":
      return <PayChangeBody event={event} onChange={onChange} />;
    case "downturn":
      return <DownturnBody event={event} onChange={onChange} />;
  }
}

// ---------- Per-type bodies ----------

interface ChangedProps {
  event: Event;
  onChange: (e: Event) => void;
}

function JobBody({ event, onChange }: ChangedProps) {
  if (event.type !== "job") return null;
  return (
    <>
      <LabeledId event={event} onChange={onChange} label="id (optional)" />
      <GrowthFields
        value={event.salary}
        onChange={(g) => onChange({ ...event, salary: g })}
        prefix="salary"
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
      prefix="pension"
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
        prefix={event.type}
      />
    </>
  );
}

function IdOnly({ event, onChange }: ChangedProps) {
  if (event.type !== "layoff" && event.type !== "graduate") return null;
  return <LabeledId event={event} onChange={onChange} label="id (targets that cashflow; no id = first of kind)" />;
}

function BuyHomeBody({ event, onChange }: ChangedProps) {
  if (event.type !== "buy_home") return null;
  return (
    <PropertySpecEditor
      value={event.home}
      onChange={(home) => onChange({ ...event, home })}
      allowMortgage
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
      <NumberField label="principal" value={event.fund.principal} onChange={(v) => set({ principal: v })} step={1} />
      <NumberField label="annualized_rate" value={event.fund.annualized_rate} onChange={(v) => set({ annualized_rate: v })} step={0.01} />
      {event.fund.investment !== undefined ? (
        <>
          <h4>investment (monthly contribution)</h4>
          <NumberField
            label="monthly"
            value={event.fund.investment.monthly}
            onChange={(v) => set({ investment: { ...event.fund.investment!, monthly: v } })}
            step={1}
          />
          <NumberField
            label="annualized_rate"
            value={event.fund.investment.annualized_rate}
            onChange={(v) => set({ investment: { ...event.fund.investment!, annualized_rate: v } })}
            step={0.01}
          />
          <TextField
            label="id"
            value={event.fund.investment.id ?? ""}
            onChange={(s) =>
              set({
                investment: { ...event.fund.investment!, ...(s ? { id: s } : {}) },
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

function EndBody({ event, onChange }: ChangedProps) {
  if (event.type !== "end") return null;
  return (
    <TextField
      label="id"
      required
      value={event.id}
      onChange={(id) => onChange({ ...event, id })}
    />
  );
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

function RefinanceBody({ event, onChange }: ChangedProps) {
  if (event.type !== "refinance") return null;
  return (
    <>
      <TextField
        label="id (mortgage)"
        required
        value={event.id}
        onChange={(id) => onChange({ ...event, id })}
      />
      <NumberField
        label="monthly"
        value={event.monthly}
        onChange={(v) => onChange({ ...event, monthly: v })}
        step={1}
      />
    </>
  );
}

function PayChangeBody({ event, onChange }: ChangedProps) {
  if (event.type !== "pay_change") return null;
  return (
    <>
      <LabeledId event={event} onChange={onChange} />
      <NumberField
        label="monthly"
        value={event.monthly}
        onChange={(v) => onChange({ ...event, monthly: v })}
        step={1}
      />
      <NumberField
        label="annualized_rate"
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
        label="equity_drop (funds)"
        value={event.equity_drop}
        onChange={(v) => onChange({ ...event, equity_drop: v })}
        step={0.05}
        min={0}
        max={0.999}
      />
      <NumberField
        label="property_drop (properties)"
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

function LabeledId({
  event,
  onChange,
  label = "id (optional)",
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
      onChange={(v) => onChange({ ...event, ...(v ? { id: v } : {}) } as Event)}
    />
  );
}

function GrowthFields({
  value,
  onChange,
  prefix,
}: {
  value: Growth;
  onChange: (g: Growth) => void;
  prefix: string;
}) {
  return (
    <>
      <NumberField label={`${prefix}.monthly`} value={value.monthly} onChange={(v) => onChange({ ...value, monthly: v })} step={1} />
      <NumberField label={`${prefix}.annualized_rate`} value={value.annualized_rate} onChange={(v) => onChange({ ...value, annualized_rate: v })} step={0.01} />
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
      <NumberField label="sqft" value={value.sqft} onChange={(v) => onChange({ ...value, sqft: v })} step={1} min={1} />
      <NumberField
        label="price_per_sqft"
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
      <legend>mortgage</legend>
      <NumberField label="monthly" value={mortgage.monthly} onChange={(v) => onChange({ ...mortgage, monthly: v })} step={1} />
      <NumberField label="period" value={mortgage.period} onChange={(v) => onChange({ ...mortgage, period: v })} step={1} min={0} />
      <TextField label="id (optional)" value={mortgage.id ?? ""} onChange={(s) => onChange({ ...mortgage, ...(s ? { id: s } : {}) })} />
      <button type="button" onClick={() => onChange(undefined)}>Remove mortgage</button>
    </fieldset>
  );
}

function RentEditor({ value, onChange }: { value: RentSpec; onChange: (r: RentSpec) => void }) {
  return (
    <fieldset className="rent-block">
      <legend>rent</legend>
      <NumberField label="monthly" value={value.monthly} onChange={(v) => onChange({ ...value, monthly: v })} step={1} />
      <NumberField label="annualized_rate" value={value.annualized_rate} onChange={(v) => onChange({ ...value, annualized_rate: v })} step={0.01} />
      <NumberField label="occupancy (0..1)" value={value.occupancy} onChange={(v) => onChange({ ...value, occupancy: v })} step={0.1} min={0} max={1} />
      <TextField label="id (optional)" value={value.id ?? ""} onChange={(s) => onChange({ ...value, ...(s ? { id: s } : {}) })} />
    </fieldset>
  );
}

function OneOffAmount({ value, onChange }: { value: OneOffBody; onChange: (o: OneOffBody) => void }) {
  return (
    <NumberField label="amount" value={value.amount} onChange={(v) => onChange({ amount: v })} step={1} />
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
