import { useId } from "react";
import type { ParentAllowance, TaxBlock } from "@/scenario/types";

export function TaxBlockForm({
  value,
  onChange,
}: {
  value: TaxBlock | undefined;
  onChange: (t: TaxBlock | undefined) => void;
}) {
  const v: TaxBlock = value ?? {};
  const enabled = value !== undefined;
  const wrap = (patch: Partial<TaxBlock>) => onChange({ ...v, ...patch });
  return (
    <section className="tax-block-form">
      <header>
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange(e.currentTarget.checked ? v : undefined)}
          />{" "}
          Enable household-allowance tax block
        </label>
      </header>
      {enabled ? (
        <>
          <fieldset>
            <legend>Status</legend>
            <label>
              <input
                type="radio"
                name="tax-status"
                value="single"
                checked={v.status !== "married"}
                onChange={() => wrap({ status: "single" })}
              />{" "}
              single
            </label>
            <label>
              <input
                type="radio"
                name="tax-status"
                value="married"
                checked={v.status === "married"}
                onChange={() => wrap({ status: "married" })}
              />{" "}
              married
            </label>
          </fieldset>
          <NumberField
            label="Children"
            value={v.children ?? 0}
            onChange={(n) => wrap({ children: n })}
            min={0}
          />
          <fieldset>
            <legend>Parents (dependent allowance)</legend>
            {(v.parents ?? []).map((p, i) => (
              <ParentEntry
                key={i}
                value={p}
                onChange={(np) => {
                  const list = (v.parents ?? []).slice();
                  list[i] = np;
                  wrap({ parents: list });
                }}
                onRemove={() => {
                  const list = (v.parents ?? []).slice();
                  list.splice(i, 1);
                  wrap({ parents: list });
                }}
              />
            ))}
            <button
              type="button"
              onClick={() =>
                wrap({
                  parents: [...(v.parents ?? []), { age_band: "60+", living_with: false }],
                })
              }
            >
              Add parent
            </button>
          </fieldset>
        </>
      ) : null}
    </section>
  );
}

function ParentEntry({
  value,
  onChange,
  onRemove,
}: {
  value: ParentAllowance;
  onChange: (p: ParentAllowance) => void;
  onRemove: () => void;
}) {
  return (
    <div className="parent-row">
      <fieldset>
        <legend>Age band</legend>
        <label>
          <input
            type="radio"
            name={`age_band-${value.age_band}`}
            checked={value.age_band === "60+"}
            onChange={() => onChange({ ...value, age_band: "60+" })}
          />{" "}
          60+
        </label>
        <label>
          <input
            type="radio"
            name={`age_band-${value.age_band}`}
            checked={value.age_band === "55-59"}
            onChange={() => onChange({ ...value, age_band: "55-59" })}
          />{" "}
          55–59
        </label>
      </fieldset>
      <label>
        <input
          type="checkbox"
          checked={value.living_with}
          onChange={(e) => onChange({ ...value, living_with: e.currentTarget.checked })}
        />{" "}
        Living with you
      </label>
      <button type="button" onClick={onRemove}>Remove</button>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="field">
      <span>{label}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        onChange={(e) => onChange(Number(e.currentTarget.value) || 0)}
      />
    </label>
  );
}
