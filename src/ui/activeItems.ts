/**
 * Which created items are alive at a given month.
 *
 * Spec: openspec/changes/event-target-picker/specs/scenario-authoring/spec.md —
 * a targeting event offers exactly the items active at its month.
 *
 * This is a lifecycle replay, not a simulation: only the id bookkeeping matters
 * for choosing a target, and there is no money arithmetic here. It deliberately
 * does not import src/model — fidelity to runScenario is enforced by
 * activeItems.test.ts rather than by shared code, so this can never be mistaken
 * for the simulator's own view of the world.
 *
 * Known gaps, both documented in design.md: a `death` event truncates the run
 * but its effect on liveness is not modelled, and the no-id "first of kind"
 * fallbacks remove items by position rather than by id, so they are invisible
 * here. The first event of each kind keeps an id if one was given.
 */

import type { Event, Scenario } from "@/scenario/types";

export type ItemKind =
  | "salary"
  | "expense"
  | "tuition"
  | "withdrawal"
  | "one-off"
  | "mortgage"
  | "rent"
  | "contribution";

export interface ActiveItem {
  /** The stored `id`. It is the item's name — there is no separate label. */
  name: string;
  kind: ItemKind;
}

/** Event types whose `id` addresses something that already exists. */
export const TARGETING_TYPES = [
  "layoff",
  "graduate",
  "end",
  "refinance",
  "pay_change",
] as const;

export type TargetingType = (typeof TARGETING_TYPES)[number];

export function isTargeting(type: Event["type"]): type is TargetingType {
  return (TARGETING_TYPES as readonly string[]).includes(type);
}

/**
 * Which kinds each targeting event can actually reach, matching how the
 * simulator resolves the id. Offering an expense to a `refinance` would offer a
 * choice that silently does nothing — the exact failure this replaces.
 */
const ADDRESSABLE: Record<TargetingType, readonly ItemKind[] | "all"> = {
  // found.kind === "Salary" guard
  pay_change: ["salary"],
  // a.kind === "Property" && a.mortgage?.id === e.id
  refinance: ["mortgage"],
  // walks cashflows, then fund contributions, rents, mortgages
  end: "all",
  // findCashflowById with no kind guard
  layoff: "all",
  graduate: "all",
};

/** Items a defining event introduces, as `[kind, name]` pairs it declares. */
function declaredItems(e: Event): [ItemKind, string][] {
  switch (e.type) {
    case "job":
      return e.id ? [["salary", e.id]] : [];
    case "expense":
      return e.id ? [["expense", e.id]] : [];
    case "tuition":
      return e.id ? [["tuition", e.id]] : [];
    case "withdrawal":
      return e.id ? [["withdrawal", e.id]] : [];
    case "one_off_expense":
    case "one_off_income":
      return e.id ? [["one-off", e.id]] : [];
    case "buy_home":
      return e.home.mortgage?.id ? [["mortgage", e.home.mortgage.id]] : [];
    case "buy_to_let": {
      const out: [ItemKind, string][] = [];
      if (e.to_let.rent.id) out.push(["rent", e.to_let.rent.id]);
      if (e.to_let.mortgage?.id) out.push(["mortgage", e.to_let.mortgage.id]);
      return out;
    }
    case "investment":
      return e.fund.investment?.id ? [["contribution", e.fund.investment.id]] : [];
    default:
      return [];
  }
}

/** Whether an event removes the item its `id` names. */
function consumes(e: Event): string | undefined {
  if (e.type === "layoff" || e.type === "graduate" || e.type === "end") {
    return e.id;
  }
  // refinance and pay_change mutate an item, never remove one.
  return undefined;
}

/**
 * Items alive at `atMonth`: declared by an event at or before it, minus those
 * consumed at or before it. Events are walked in `(when, insertion)` order so a
 * defining event precedes a consumer firing in the same month.
 */
export function activeItems(scenario: Scenario, atMonth: number): ActiveItem[] {
  const live = new Map<string, ItemKind>();

  scenario.events
    .map((e, index) => ({ e, index }))
    .filter(({ e }) => e.when <= atMonth)
    .sort((a, b) => a.e.when - b.e.when || a.index - b.index)
    .forEach(({ e }) => {
      const consumed = consumes(e);
      if (consumed !== undefined) {
        // An id that matches nothing is a no-op, exactly as in the simulator.
        live.delete(consumed);
        return;
      }
      for (const [kind, name] of declaredItems(e)) live.set(name, kind);
    });

  return [...live].map(([name, kind]) => ({ name, kind }));
}

/** The choices a targeting event may offer at `atMonth`. */
export function candidatesFor(
  scenario: Scenario,
  atMonth: number,
  type: TargetingType,
): ActiveItem[] {
  const allowed = ADDRESSABLE[type];
  const live = activeItems(scenario, atMonth);
  return allowed === "all"
    ? live
    : live.filter((i) => allowed.includes(i.kind));
}

const KIND_TITLE: Record<ItemKind, string> = {
  salary: "Salary",
  expense: "Expense",
  tuition: "Tuition",
  withdrawal: "Withdrawal",
  "one-off": "One-off",
  mortgage: "Mortgage",
  rent: "Rent",
  contribution: "Contribution",
};

export function kindTitle(kind: ItemKind): string {
  return KIND_TITLE[kind];
}