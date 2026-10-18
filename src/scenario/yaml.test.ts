import { describe, expect, it } from "vitest";
import { loadScenario, ScenarioLoadError, serializeScenario } from "@/scenario/yaml";
import type { Scenario } from "@/scenario/types";

describe("loadScenario — happy paths", () => {
  it("loads a minimal scenario", () => {
    const s = loadScenario("cash: 20000\nevents: []\n");
    expect(s.cash).toBe(20000);
    expect(s.events).toEqual([]);
    expect(s.reserve_months).toBeUndefined();
    expect(s.tax).toBeUndefined();
  });

  it("loads the full event vocabulary", () => {
    const yaml = `
cash: 100000
events:
  - type: job
    when: 0
    id: me
    salary: { monthly: 30000, annualized_rate: 0.03 }
  - type: pension
    when: 360
    pension: { monthly: 15000, annualized_rate: 0.025 }
  - type: expense
    when: 0
    id: rent
    expense: { monthly: 8000, annualized_rate: 0.02 }
  - type: tuition
    when: 36
    id: kid1
    tuition: { monthly: 5000, annualized_rate: 0.0 }
  - type: withdrawal
    when: 24
    id: helper
    withdrawal: { monthly: 1500, annualized_rate: 0.0 }
  - type: layoff
    when: 48
  - type: graduate
    when: 60
    id: kid1
  - type: buy_home
    when: 12
    home:
      sqft: 600
      price_per_sqft: 20000
      mortgage: { monthly: 18000, period: 240, id: home-loan }
  - type: buy_to_let
    when: 24
    to_let:
      sqft: 400
      price_per_sqft: 30000
      mortgage: { monthly: 12000, period: 240 }
      rent: { monthly: 18000, annualized_rate: 0.04, occupancy: 0.9 }
  - type: investment
    when: 0
    fund:
      principal: 500000
      annualized_rate: 0.06
      investment: { monthly: 5000, annualized_rate: 0.0, id: contrib }
  - type: end
    when: 60
    id: me
  - type: one_off_expense
    when: 12
    one_off: { amount: 50000 }
  - type: one_off_income
    when: 24
    one_off: { amount: 30000 }
  - type: death
    when: 600
  - type: refinance
    when: 36
    id: home-loan
    monthly: 22000
  - type: pay_change
    when: 36
    id: me
    monthly: 40000
    annualized_rate: 0.0
  - type: downturn
    when: 120
    equity_drop: 0.22
    property_drop: 0.15
`;
    const s = loadScenario(yaml);
    expect(s.events).toHaveLength(17);
    expect(s.events.map((e) => e.type)).toEqual([
      "job", "pension", "expense", "tuition", "withdrawal",
      "layoff", "graduate", "buy_home", "buy_to_let", "investment",
      "end", "one_off_expense", "one_off_income", "death",
      "refinance", "pay_change", "downturn",
    ]);
  });

  it("loads a labeled job", () => {
    const s = loadScenario(`
cash: 0
events:
  - type: job
    when: 0
    id: partner
    salary: { monthly: 6000, annualized_rate: 0.03 }
`);
    expect(s.events[0]).toMatchObject({
      type: "job",
      id: "partner",
      salary: { monthly: 6000, annualized_rate: 0.03 },
    });
  });

  it("loads a one-off without an id", () => {
    const s = loadScenario(`
cash: 0
events:
  - type: one_off_expense
    when: 3
    one_off: { amount: 5000 }
`);
    expect(s.events[0]).toMatchObject({
      type: "one_off_expense",
      when: 3,
      one_off: { amount: 5000 },
    });
  });

  it("accepts negative amount in one_off (sign comes from event type)", () => {
    const s = loadScenario(`
cash: 0
events:
  - type: one_off_expense
    when: 3
    one_off: { amount: -5000 }
`);
    expect(s.events[0]).toMatchObject({ one_off: { amount: -5000 } });
  });

  it("loads mortgage without paid counter (no field required)", () => {
    const s = loadScenario(`
cash: 0
events:
  - type: buy_home
    when: 0
    home:
      sqft: 100
      price_per_sqft: 1000
      mortgage: { monthly: 100, period: 12 }
`);
    // The mortgage field on PropertySpec has period + monthly; runtime state lives elsewhere.
    expect(s.events[0]).toMatchObject({
      type: "buy_home",
      home: { sqft: 100, price_per_sqft: 1000, mortgage: { monthly: 100, period: 12 } },
    });
  });

  it("loads a non-MPF pension", () => {
    const s = loadScenario(`
cash: 0
events:
  - type: pension
    when: 360
    pension: { monthly: 15000, annualized_rate: 0.025 }
`);
    expect(s.events[0]).toMatchObject({
      type: "pension",
      pension: { monthly: 15000, annualized_rate: 0.025 },
    });
  });
});

describe("loadScenario — optional top-level fields", () => {
  it("loads reserve_months", () => {
    const s = loadScenario(`cash: 100\nreserve_months: 3\nevents: []\n`);
    expect(s.reserve_months).toBe(3);
  });

  it("loads start / end / saving", () => {
    const s = loadScenario(`
cash: 100
start: 2026-08
end: 2029-08
saving: 100000
events: []
`);
    expect(s.start).toBe("2026-08");
    expect(s.end).toBe("2029-08");
    expect(s.saving).toBe(100000);
  });

  it("rejects negative reserve_months", () => {
    expect(() =>
      loadScenario(`cash: 100\nreserve_months: -1\nevents: []\n`),
    ).toThrow(ScenarioLoadError);
  });

  it("rejects negative saving", () => {
    expect(() =>
      loadScenario(`cash: 100\nsaving: -1\nevents: []\n`),
    ).toThrow(ScenarioLoadError);
  });

  it("rejects malformed start", () => {
    expect(() =>
      loadScenario(`cash: 100\nstart: 2026/foo\nevents: []\n`),
    ).toThrow(ScenarioLoadError);
  });
});

describe("loadScenario — tax block", () => {
  it("loads a married-with-household-allowance tax block", () => {
    const s = loadScenario(`
cash: 0
events: []
tax:
  status: married
  children: 2
  parents:
    - age_band: 60+
      living_with: false
    - age_band: 60+
      living_with: false
`);
    expect(s.tax).toEqual({
      status: "married",
      children: 2,
      parents: [
        { age_band: "60+", living_with: false },
        { age_band: "60+", living_with: false },
      ],
    });
  });

  it("rejects unknown tax fields", () => {
    expect(() =>
      loadScenario(`cash: 0\nevents: []\ntax: { shoe_size: 42 }\n`),
    ).toThrow(ScenarioLoadError);
  });

  it("rejects parent entry missing age_band", () => {
    expect(() =>
      loadScenario(`
cash: 0
events: []
tax:
  parents: [{ living_with: false }]
`),
    ).toThrow(ScenarioLoadError);
  });

  it("rejects status other than single/married", () => {
    expect(() =>
      loadScenario(`cash: 0\nevents: []\ntax: { status: divorced }\n`),
    ).toThrow(ScenarioLoadError);
  });

  it("treats empty tax block as undefined for round-trip", () => {
    const s = loadScenario(`cash: 0\nevents: []\ntax: {}\n`);
    expect(s.tax).toEqual({});
  });
});

describe("loadScenario — failure modes", () => {
  it("rejects unknown event type with source-named error", () => {
    expect(() =>
      loadScenario(`cash: 100\nevents:\n  - { type: lottery_win, when: 0 }\n`, "test.yaml"),
    ).toThrow(/test\.yaml.*unknown event type/);
  });

  it("rejects malformed YAML with source-named error", () => {
    expect(() =>
      loadScenario("cash: [unclosed\n", "broken.yaml"),
    ).toThrow(/broken\.yaml/);
  });

  it("rejects pension without body", () => {
    expect(() =>
      loadScenario(`cash: 0\nevents:\n  - { type: pension, when: 0 }\n`),
    ).toThrow(/pension.*body is required/);
  });

  it("rejects refinance without id", () => {
    expect(() =>
      loadScenario(`cash: 0\nevents:\n  - { type: refinance, when: 0, monthly: 100 }\n`),
    ).toThrow(/refinance.*id/);
  });

  it("uses 'pasted YAML' as the source for malformed paste", () => {
    expect(() => loadScenario("not: valid: [", "pasted YAML")).toThrow(/pasted YAML/);
  });
});

describe("serializeScenario round-trip", () => {
  const full: Scenario = {
    cash: 100000,
    reserve_months: 3,
    start: "2026-08",
    end: "2029-08",
    saving: 100000,
    events: [
      { type: "job", when: 0, id: "me", salary: { monthly: 30000, annualized_rate: 0.03 } },
      { type: "pension", when: 360, pension: { monthly: 15000, annualized_rate: 0.025 } },
      { type: "expense", when: 0, id: "rent", expense: { monthly: 8000, annualized_rate: 0.02 } },
      { type: "tuition", when: 36, id: "kid1", tuition: { monthly: 5000, annualized_rate: 0 } },
      { type: "withdrawal", when: 24, id: "helper", withdrawal: { monthly: 1500, annualized_rate: 0 } },
      { type: "layoff", when: 48 },
      { type: "graduate", when: 60, id: "kid1" },
      {
        type: "buy_home",
        when: 12,
        home: {
          sqft: 600,
          price_per_sqft: 20000,
          mortgage: { monthly: 18000, period: 240, id: "home-loan" },
        },
      },
      {
        type: "buy_to_let",
        when: 24,
        to_let: {
          sqft: 400,
          price_per_sqft: 30000,
          mortgage: { monthly: 12000, period: 240 },
          rent: { monthly: 18000, annualized_rate: 0.04, occupancy: 0.9 },
        },
      },
      {
        type: "investment",
        when: 0,
        fund: {
          principal: 500000,
          annualized_rate: 0.06,
          investment: { monthly: 5000, annualized_rate: 0, id: "contrib" },
        },
      },
      { type: "end", when: 60, id: "me" },
      { type: "one_off_expense", when: 12, one_off: { amount: 50000 } },
      { type: "one_off_income", when: 24, one_off: { amount: 30000 } },
      { type: "death", when: 600 },
      { type: "refinance", when: 36, id: "home-loan", monthly: 22000 },
      { type: "pay_change", when: 36, id: "me", monthly: 40000, annualized_rate: 0 },
      { type: "downturn", when: 120, equity_drop: 0.22, property_drop: 0.15 },
    ],
    tax: {
      status: "married",
      children: 2,
      parents: [
        { age_band: "60+", living_with: false },
        { age_band: "60+", living_with: false },
      ],
    },
  };

  it("parse(serialize(s)) deep-equals s for the full vocabulary", () => {
    const yaml = serializeScenario(full);
    const parsed = loadScenario(yaml);
    expect(parsed).toEqual(full);
  });

  it("omits an empty tax block from the serialized form", () => {
    const yaml = serializeScenario({ cash: 0, events: [] });
    expect(yaml).not.toMatch(/tax:/);
  });

  it("round-trips a minimal scenario", () => {
    const yaml = serializeScenario({ cash: 20000, events: [] });
    expect(loadScenario(yaml)).toEqual({ cash: 20000, events: [] });
  });
});
