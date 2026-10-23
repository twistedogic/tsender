import { useId, useState } from "react";
import type { Event, Scenario } from "@/scenario/types";
import { EventForm } from "@/ui/EventForm";
import { TaxBlockForm } from "@/ui/TaxBlockForm";
import { humanize } from "@/ui/labels";

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
  const [newEventType, setNewEventType] = useState<EventTypeChoice>("job");

  return (
    <form
      className="scenario-form"
      onSubmit={(e) => e.preventDefault()}
      aria-label="tsender scenario editor"
    >
      <TopFields scenario={scenario} onPatch={top} />

      <details open>
        <summary>
          <h2>Events ({scenario.events.length})</h2>
        </summary>
        <div className="events-add">
          <label htmlFor="event-type">
            Add event:&nbsp;
            <select
              id="event-type"
              value={newEventType}
              onChange={(e) => setNewEventType(e.currentTarget.value as EventTypeChoice)}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{humanize(t)}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => addEvent(newEventType)}>
            Add
          </button>
        </div>
        <ol className="event-list">
          {scenario.events.map((e, idx) => (
            <li key={idx}>
              <EventForm
                event={e}
                index={idx}
                scenario={scenario}
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
          <h2>Tax block (household allowance)</h2>
        </summary>
        <TaxBlockForm value={scenario.tax} onChange={(tax) => top({ tax })} />
      </details>
    </form>
  );

  function addEvent(type: EventTypeChoice) {
    const when = scenario.events.length === 0 ? 0 : Math.max(...scenario.events.map((e) => e.when)) + 1;
    top({ events: [...scenario.events, makeEmptyEvent(type, when)] });
  }
}

function makeEmptyEvent(type: EventTypeChoice, when: number): Event {
  switch (type) {
    case "job":
      return { type, when, salary: { monthly: 0, annualized_rate: 0 } };
    case "pension":
      return { type, when, pension: { monthly: 0, annualized_rate: 0 } };
    case "expense":
      return { type, when, expense: { monthly: 0, annualized_rate: 0 } };
    case "tuition":
      return { type, when, tuition: { monthly: 0, annualized_rate: 0 } };
    case "withdrawal":
      return { type, when, withdrawal: { monthly: 0, annualized_rate: 0 } };
    case "layoff":
    case "graduate":
    case "death":
      return { type, when };
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
      <Field label="Cash">
        <NumberInput value={scenario.cash} onChange={(n) => onPatch({ cash: n })} step={1} min={0} />
      </Field>
      <Field label="Reserve months">
        <NumberInput value={scenario.reserve_months ?? 0} onChange={(n) => onPatch({ reserve_months: n })} step={1} min={0} />
      </Field>
      <Field label="Start (YYYY-MM)">
        <MonthInput value={scenario.start ?? ""} onChange={(s) => onPatch({ start: s || undefined })} />
      </Field>
      <Field label="End (YYYY-MM)">
        <MonthInput value={scenario.end ?? ""} onChange={(s) => onPatch({ end: s || undefined })} />
      </Field>
      <Field label="Saving target">
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
