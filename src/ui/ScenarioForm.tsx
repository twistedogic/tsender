import { useId } from "react";
import type { Event, Scenario } from "@/scenario/types";
import { EventForm } from "@/ui/EventForm";
import { TaxBlockForm } from "@/ui/TaxBlockForm";

const EVENT_TYPES = [
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
] as const satisfies readonly Event["type"][];

export type EventTypeChoice = (typeof EVENT_TYPES)[number];

export interface ScenarioFormProps {
  scenario: Scenario;
  onChange: (s: Scenario) => void;
}

export function ScenarioForm({ scenario, onChange }: ScenarioFormProps) {
  const top = (patch: Partial<Scenario>) => onChange({ ...scenario, ...patch });

  return (
    <form
      className="scenario-form"
      onSubmit={(e) => e.preventDefault()}
      aria-label="tsender scenario editor"
    >
      <TopFields scenario={scenario} onPatch={top} />

      <details open>
        <summary>
          <h2>events ({scenario.events.length})</h2>
        </summary>
        <div className="events-add">
          <label htmlFor="event-type">
            Add event:&nbsp;
            <select id="event-type" defaultValue="job">
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => addEvent()}>
            Add
          </button>
        </div>
        <ol className="event-list">
          {scenario.events.map((e, idx) => (
            <li key={idx}>
              <EventForm
                event={e}
                index={idx}
                onChange={(event) => {
                  const next = scenario.events.slice();
                  next[idx] = event;
                  top({ events: next });
                }}
                onRemove={() => {
                  const next = scenario.events.slice();
                  next.splice(idx, 1);
                  top({ events: next });
                }}
                onDuplicate={() => {
                  const next = scenario.events.slice();
                  next.splice(idx + 1, 0, { ...e, when: e.when + 1 });
                  top({ events: next });
                }}
              />
            </li>
          ))}
        </ol>
      </details>

      <details>
        <summary>
          <h2>tax block (household allowance)</h2>
        </summary>
        <TaxBlockForm value={scenario.tax} onChange={(tax) => top({ tax })} />
      </details>
    </form>
  );

  function addEvent() {
    const select = document.getElementById("event-type") as HTMLSelectElement | null;
    const t = (select?.value as EventTypeChoice) ?? "job";
    const when = scenario.events.length === 0 ? 0 : Math.max(...scenario.events.map((e) => e.when)) + 1;
    const event = makeEmptyEvent(t, when);
    top({ events: [...scenario.events, event] });
  }
}

function makeEmptyEvent(type: EventTypeChoice, when: number): Event {
  const base = { type, when } as Event;
  switch (type) {
    case "job":
      return { ...base, type, when, salary: { monthly: 0, annualized_rate: 0 } } as Event;
    case "pension":
      return { ...base, type, when, pension: { monthly: 0, annualized_rate: 0 } } as Event;
    case "expense":
        return { ...base, type, when, expense: { monthly: 0, annualized_rate: 0 } } as Event;
    case "tuition":
      return { ...base, type, when, tuition: { monthly: 0, annualized_rate: 0 } } as Event;
    case "withdrawal":
      return { ...base, type, when, withdrawal: { monthly: 0, annualized_rate: 0 } } as Event;
    case "layoff":
    case "graduate":
      return { ...base, type, when } as Event;
    case "buy_home":
      return {
        type,
        when,
        home: { sqft: 100, price_per_sqft: 1000 },
      };
    case "buy_to_let":
      return {
        type,
        when,
        to_let: {
          sqft: 100,
          price_per_sqft: 1000,
          rent: { monthly: 0, annualized_rate: 0, occupancy: 1 },
        },
      };
    case "investment":
      return {
        type,
        when,
        fund: { principal: 0, annualized_rate: 0 },
      };
    case "end":
      return { type, when, id: "" };
    case "one_off_expense":
    case "one_off_income":
      return { type, when, one_off: { amount: 0 } };
    case "death":
      return { type, when };
    case "refinance":
      return { type, when, id: "", monthly: 0 };
    case "pay_change":
      return { type, when, monthly: 0, annualized_rate: 0 };
    case "downturn":
      return { type, when, equity_drop: 0, property_drop: 0 };
  }
}

function TopFields({
  scenario,
  onPatch,
}: {
  scenario: Scenario;
  onPatch: (p: Partial<Scenario>) => void;
}) {
  return (
    <section className="top-fields">
      <h2>Scenario</h2>
      <Field label="cash">
        <NumberInput value={scenario.cash} onChange={(n) => onPatch({ cash: n })} step={1} min={0} />
      </Field>
      <Field label="reserve_months">
        <NumberInput value={scenario.reserve_months ?? 0} onChange={(n) => onPatch({ reserve_months: n })} step={1} min={0} />
      </Field>
      <Field label="start (YYYY-MM)">
        <MonthInput value={scenario.start ?? ""} onChange={(s) => onPatch({ start: s || undefined })} />
      </Field>
      <Field label="end (YYYY-MM)">
        <MonthInput value={scenario.end ?? ""} onChange={(s) => onPatch({ end: s || undefined })} />
      </Field>
      <Field label="saving">
        <NumberInput value={scenario.saving ?? 0} onChange={(n) => onPatch({ saving: n })} step={1} min={0} />
      </Field>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div id={id}>{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  step = 1,
  min,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={Number.isFinite(value) ? value : 0}
      step={step}
      min={min}
      onChange={(e) => onChange(Number(e.currentTarget.value) || 0)}
    />
  );
}

function MonthInput({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <input
      type="month"
      pattern="[0-9]{4}-[0-9]{2}"
      placeholder="YYYY-MM"
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}
