/**
 * The household-allowance tax block.
 *
 * Spec: openspec/specs/scenario-authoring/spec.md — "Tax block is exposed as
 * a subform": status, children, and a repeating list of parents, each with
 * an age band and a living-with flag.
 */

import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { TaxBlockForm } from "@/ui/TaxBlockForm";
import type { TaxBlock } from "@/scenario/types";

/** The form wired to its own state, the way the app drives it. */
function Harness({ initial }: { initial: TaxBlock }) {
  const [tax, setTax] = useState<TaxBlock | undefined>(initial);
  return <TaxBlockForm value={tax} onChange={setTax} />;
}

function parentRows(): HTMLElement[] {
  return [...document.querySelectorAll(".parent-row")] as HTMLElement[];
}

function bandRadios(row: number): HTMLInputElement[] {
  return [...parentRows()[row]!.querySelectorAll('input[type="radio"]')] as HTMLInputElement[];
}

describe("TaxBlockForm", () => {
  it("keeps each parent's age band independent", () => {
    render(
      <Harness
        initial={{
          status: "single",
          parents: [
            { age_band: "60+", living_with: false },
            { age_band: "60+", living_with: false },
          ],
        }}
      />,
    );
    expect(bandRadios(0)[0]!.checked).toBe(true);
    expect(bandRadios(1)[0]!.checked).toBe(true);

    fireEvent.click(bandRadios(1)[1]!);

    expect(bandRadios(1)[1]!.checked).toBe(true);
    expect(bandRadios(0)[0]!.checked).toBe(true);
  });

  it("reports the chosen age band", () => {
    const onChange = vi.fn();
    render(
      <TaxBlockForm
        value={{
          status: "single",
          parents: [{ age_band: "60+", living_with: false }],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(bandRadios(0)[1]!);

    const tax = onChange.mock.calls[0]![0];
    expect(tax.parents[0].age_band).toBe("55-59");
  });
});
