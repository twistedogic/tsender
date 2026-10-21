import { describe, expect, it } from "vitest";
import { runScenario } from "@/model/simulator";
import { computeAllowance, mpfDeduction, progressiveTax, propertyTaxForBlock, salariesTaxForBlock, standardTax } from "@/model/tax";
import type { Scenario } from "@/scenario/types";

function scn(json: string): Scenario {
  return JSON.parse(json);
}

const y = (s: string) => scn(s);

describe("cashflow iteration", () => {
  it("a single salary at age 0 contributes gross-minus-MPF", () => {
    const r = runScenario(y(`{"cash":100000,"events":[{"type":"job","when":0,"salary":{"monthly":20000,"annualized_rate":0}}]}`));
    expect(r.months[0]?.monthly_cashflow).toBeCloseTo(19000, 6); // 20000 - 1000 MPF (5%)
  });

  it("salary compounds each month", () => {
    const r = runScenario(y(`{"cash":0,"events":[{"type":"job","when":0,"salary":{"monthly":1000,"annualized_rate":0.12}}]}`));
    const m0 = r.months[0]?.monthly_cashflow ?? 0;
    const m11 = r.months[11]?.monthly_cashflow ?? 0;
    expect(m0).toBeCloseTo(1000 - 50, 6);
    // After 11 months of growth at 1%/mo each.
    const expected = 1000 * Math.pow(1.01, 11) - mpfDeduction(1000 * Math.pow(1.01, 11));
    expect(m11).toBeCloseTo(expected, 4);
  });

  it("an expense deducts from cash and is not MPF-affected", () => {
    const r = runScenario(y(`{"cash":0,"events":[{"type":"expense","when":0,"expense":{"monthly":8000,"annualized_rate":0}}]}`));
    expect(r.months[0]?.monthly_cashflow).toBeCloseTo(-8000, 6);
    expect(r.months[0]?.cash).toBeCloseTo(-8000, 6);
  });

  it("a pension is paid gross with no MPF deduction", () => {
    const r = runScenario(y(`{"cash":0,"events":[{"type":"pension","when":0,"pension":{"monthly":10000,"annualized_rate":0}}]}`));
    expect(r.months[0]?.monthly_cashflow).toBeCloseTo(10000, 6);
  });
});

describe("MPF deduction", () => {
  it("deducts 5% below the cap", () => {
    expect(mpfDeduction(20000)).toBe(1000);
  });
  it("caps at 1500 above the threshold", () => {
    expect(mpfDeduction(40000)).toBe(1500);
  });
  it("returns 0 for zero or negative", () => {
    expect(mpfDeduction(0)).toBe(0);
  });
});

describe("salaries tax (progressive vs standard) and property tax", () => {
  it("progressive worked example matches the spec", () => {
    // gross 350000, MPF 18000, basic allowance 145000 → chargeable 187000.
    // Progressive: 50k@2% = 1000, 50k@6% = 3000, 50k@10% = 5000, 37k@14% = 5180 → 14180.
    const result = salariesTaxForBlock(350_000, 18_000, 145_000);
    expect(result.chargeable).toBe(187_000);
    expect(result.charge).toBe(14_180);
  });
  it("income below the allowance charges nothing", () => {
    const result = salariesTaxForBlock(100_000, 0, 145_000);
    expect(result.charge).toBe(0);
  });
  it("progressive brackets add up correctly", () => {
    expect(progressiveTax(0)).toBe(0);
    expect(progressiveTax(50_000)).toBe(1000);
    expect(progressiveTax(150_000)).toBe(1000 + 3000 + 5000);
  });
  it("standard tax applies 15% to first 5M and 16% above", () => {
    expect(standardTax(5_000_000)).toBe(750_000);
    expect(standardTax(6_000_000)).toBe(750_000 + 160_000);
  });
  it("property tax is 15% × 80% of accrued rent", () => {
    expect(propertyTaxForBlock(300_000)).toBe(36_000);
  });
  it("pension accrues into the salaries tax base with no salary", () => {
    // pension of 20000/mo for 12 months → salary_accrued = 240_000, mpf = 0
    const result = salariesTaxForBlock(240_000, 0, 145_000);
    expect(result.charge).toBeGreaterThan(0);
  });
});

describe("household allowance derivation", () => {
  it("uses BASIC_ALLOWANCE when no tax block is set", () => {
    expect(computeAllowance(undefined)).toBe(145_000);
  });
  it("computes married-with-children-and-parents", () => {
    // 290_000 + 2*140_000 + 2*55_000 = 680_000
    expect(
      computeAllowance({
        status: "married",
        children: 2,
        parents: [
          { age_band: "60+", living_with: false },
          { age_band: "60+", living_with: false },
        ],
      }),
    ).toBe(680_000);
  });
  it("cohabiting 55-59 parent doubles allowance", () => {
    // 145_000 + 1*27_500*2 = 200_000
    expect(
      computeAllowance({
        status: "single",
        parents: [{ age_band: "55-59", living_with: true }],
      }),
    ).toBe(200_000);
  });
});

describe("asset acquisition deducts price exactly once", () => {
  it("buy_home deducts the price and not in monthly_cashflow", () => {
    const r = runScenario(y(`{"cash":50000,"events":[{"type":"buy_home","when":0,"home":{"sqft":1200,"price_per_sqft":300}}]}`));
    // 50000 - 360000 = -310000
    expect(r.months[0]?.cash).toBeCloseTo(-310_000, 4);
    // monthly_cashflow contains no purchase amount
    expect(r.months[0]?.monthly_cashflow).toBe(0);
    // subsequent month: no buy deduction re-applies
    expect(r.months[1]?.cash).toBeCloseTo(-310_000, 4);
  });

  it("investment's principal is deducted, monthly_cashflow is unaffected", () => {
    const r = runScenario(y(`{"cash":20000,"events":[{"type":"investment","when":0,"fund":{"principal":5000,"annualized_rate":0}}]}`));
    expect(r.months[0]?.cash).toBeCloseTo(15_000, 4);
    expect(r.months[0]?.monthly_cashflow).toBe(0);
  });
});

describe("event firing", () => {
  it("end with id removes the targeted cashflow", () => {
    const r = runScenario(y(`{"cash":100000,"events":[{"type":"job","when":0,"id":"me","salary":{"monthly":1000,"annualized_rate":0}},{"type":"job","when":0,"id":"partner","salary":{"monthly":2000,"annualized_rate":0}},{"type":"end","when":12,"id":"partner"}]}`));
    const m11 = r.months[11]?.monthly_cashflow ?? 0; // before end
    const m12 = r.months[12]?.monthly_cashflow ?? 0; // end fires
    // 1000 - MPF(50) + 2000 - MPF(100) = 2850
    expect(m11).toBeCloseTo(2850, 6);
    // only me remains: 1000 - 50 = 950
    expect(m12).toBeCloseTo(950, 6);
  });

  it("end stops a fund contribution by id", () => {
    const r = runScenario(y(`{"cash":100000,"events":[{"type":"investment","when":0,"fund":{"principal":0,"annualized_rate":0,"investment":{"monthly":1000,"annualized_rate":0,"id":"contrib"}}},{"type":"end","when":6,"id":"contrib"}]}`));
    const m5 = r.months[5]?.monthly_cashflow ?? 0;
    const m6 = r.months[6]?.monthly_cashflow ?? 0;
    expect(m5).toBeCloseTo(-1000, 6);
    expect(m6).toBe(0);
  });

  it("end with unknown id is a silent no-op", () => {
    const r = runScenario(y(`{"cash":0,"events":[{"type":"job","when":0,"salary":{"monthly":1000,"annualized_rate":0}},{"type":"end","when":12,"id":"ghost"}]}`));
    expect(r.months[12]?.monthly_cashflow).toBeCloseTo(950, 6);
  });

  it("layoff without id removes the first salary; with id targets the labeled one", () => {
    const r1 = runScenario(y(`{"cash":0,"events":[{"type":"job","when":0,"salary":{"monthly":1000,"annualized_rate":0}},{"type":"job","when":0,"salary":{"monthly":2000,"annualized_rate":0}},{"type":"layoff","when":6}]}`));
    expect(r1.months[5]?.monthly_cashflow).toBeCloseTo(1000 - 50 + 2000 - 100, 6);
    expect(r1.months[6]?.monthly_cashflow).toBeCloseTo(2000 - 100, 6); // only 2nd salary remains

    const r2 = runScenario(y(`{"cash":0,"events":[{"type":"job","when":0,"id":"a","salary":{"monthly":1000,"annualized_rate":0}},{"type":"job","when":0,"id":"b","salary":{"monthly":2000,"annualized_rate":0}},{"type":"layoff","when":6,"id":"b"}]}`));
    expect(r2.months[6]?.monthly_cashflow).toBeCloseTo(1000 - 50, 6); // only a remains
  });

  it("refinance replaces the mortgage's monthly in the firing month", () => {
    const r = runScenario(y(`{"cash":1000000,"events":[{"type":"buy_home","when":0,"home":{"sqft":1000,"price_per_sqft":1000,"mortgage":{"monthly":30000,"period":300,"id":"home-loan"}}},{"type":"refinance","when":12,"id":"home-loan","monthly":42000}]}`));
    expect(r.months[11]?.monthly_cashflow).toBeCloseTo(-30_000, 2);
    expect(r.months[12]?.monthly_cashflow).toBeCloseTo(-42_000, 2);
  });

  it("pay_change without id updates the first salary in the firing month", () => {
    const r = runScenario(y(`{"cash":1000000,"events":[{"type":"job","when":0,"salary":{"monthly":100000,"annualized_rate":0}},{"type":"job","when":0,"salary":{"monthly":50000,"annualized_rate":0}},{"type":"pay_change","when":6,"monthly":200000,"annualized_rate":0}]}`));
    // 100000 - 1500 (capped at cap) + 50000 - 1500 (5% = 2500, capped to 1500) = 147000
    expect(r.months[5]?.monthly_cashflow).toBeCloseTo(147_000, 2);
    // 200000 - 1500 (capped) + 50000 - 1500 = 247000
    expect(r.months[6]?.monthly_cashflow).toBeCloseTo(247_000, 2);
  });

  it("downturn drops funds and property values in one month", () => {
    const r = runScenario(y(`{"cash":1000000,"events":[{"type":"investment","when":0,"fund":{"principal":1000000,"annualized_rate":0}},{"type":"buy_home","when":0,"home":{"sqft":100,"price_per_sqft":30000}},{"type":"downturn","when":36,"equity_drop":0.5,"property_drop":0.5}]}`));
    const preFund = r.months[35]?.assets_value ?? 0;
    const postFund = r.months[36]?.assets_value ?? 0;
    // Property halves (1500000 → 750000) and fund halves (1000000 → 500000)
    // Wait: sqft=100, price_per_sqft=30000 → value 3_000_000, halved = 1_500_000.
    expect(preFund).toBeCloseTo(4_000_000, 4);
    expect(postFund).toBeCloseTo(2_000_000, 2);
  });
});

describe("death event", () => {
  it("death ends the run and reports terminal_month", () => {
    const r = runScenario(y(`{"cash":0,"events":[{"type":"job","when":0,"salary":{"monthly":1000,"annualized_rate":0}},{"type":"death","when":60}]}`));
    expect(r.terminal).toBe(true);
    expect(r.terminal_month).toBe(60);
    // 61 months from 0..=60
    expect(r.months.length).toBe(61);
  });

  it("death with no other events reports one month", () => {
    const r = runScenario(y(`{"cash":0,"events":[{"type":"death","when":0}]}`));
    expect(r.terminal).toBe(true);
    expect(r.terminal_month).toBe(0);
    expect(r.months.length).toBe(1);
  });

  it("scheduled one-off at the death month fires before termination", () => {
    const r = runScenario(y(`{"cash":0,"events":[{"type":"one_off_income","when":24,"one_off":{"amount":1000}},{"type":"death","when":24}]}`));
    expect(r.terminal).toBe(true);
    expect(r.terminal_month).toBe(24);
    expect(r.months[24]?.monthly_cashflow).toBe(1000);
    expect(r.months[24]?.cash).toBe(1000);
    expect(r.months.length).toBe(25);
  });
});

describe("one-off events", () => {
  it("one_off_expense at when=3 fires once", () => {
    const r = runScenario(y(`{"cash":20000,"events":[{"type":"one_off_expense","when":3,"one_off":{"amount":5000}}]}`));
    expect(r.months[3]?.monthly_cashflow).toBe(-5000);
    expect(r.months[3]?.cash).toBeCloseTo(15_000, 4);
    expect(r.months[4]?.monthly_cashflow).toBe(0);
  });
  it("negative amount behaves identically to positive for one_off_expense", () => {
    const r = runScenario(y(`{"cash":20000,"events":[{"type":"one_off_expense","when":3,"one_off":{"amount":-5000}}]}`));
    expect(r.months[3]?.monthly_cashflow).toBe(-5000);
  });
});

describe("reserve settlement", () => {
  it("absent reserve_months leaves cash untouched even when negative", () => {
    const r = runScenario(y(`{"cash":100,"events":[{"type":"expense","when":0,"expense":{"monthly":200,"annualized_rate":0}}]}`));
    expect(r.months[0]?.cash).toBeCloseTo(-100, 4);
  });

  it("fund is drawn to top up the reserve", () => {
    // fund bought first (asset cost paid from a separate cash bucket);
    // expense then drains cash below the reserve target; settlement draws.
    const r = runScenario(y(`{"cash":10000,"events":[{"type":"investment","when":0,"fund":{"principal":5000,"annualized_rate":0}},{"type":"expense","when":1,"expense":{"monthly":1500,"annualized_rate":0}}],"reserve_months":3}`));
    // M0: investment cost 5000 → cash 5000, no cashflows.
    // M1: expense fires, monthly -1500, cash = 5000 - 1500 = 3500.
    // Reserve target = 3 * 1500 = 4500. Shortfall 1000.
    // Fund draw 1000 → cash 4500. ✓ target reached.
    expect(r.months[1]?.cash).toBeCloseTo(4500, 4);
  });

  it("reserve is breached when no asset can cover the shortfall", () => {
    const r = runScenario(y(`{"cash":100,"events":[{"type":"expense","when":0,"expense":{"monthly":200,"annualized_rate":0}}],"reserve_months":3}`));
    // cash = 100 - 200 = -100; target 600; no assets; breached.
    expect(r.months[0]?.cash).toBeCloseTo(-100, 4);
  });

  it("sale proceeds count payments already made (spec: 28900 after first month)", () => {
    // Spec scenario "Property sold after funds are exhausted": value 30000,
    // mortgage 100 x 12. One payment made in the firing month, so 11 remain
    // and proceeds are 30000 - 1100 = 28900. Cash: 100 - 300 (flows)
    // - 30000 (home) - 100 (fund principal) + 100 (fund draw) + 28900 = -1300.
    const r = runScenario(y(`{"cash":100,"events":[{"type":"expense","when":0,"expense":{"monthly":200,"annualized_rate":0}},{"type":"investment","when":0,"fund":{"principal":100,"annualized_rate":0}},{"type":"buy_home","when":0,"home":{"sqft":100,"price_per_sqft":300,"mortgage":{"monthly":100,"period":12}}}],"reserve_months":3}`));
    expect(r.months[0]?.cash).toBeCloseTo(-1300, 4);
  });

  it("a sold property's rent and mortgage flows stop in later months", () => {
    // Spec: "the sale SHALL remove the asset so its mortgage and rental
    // flows stop in later months".
    const r = runScenario(y(`{"cash":100,"events":[{"type":"expense","when":0,"expense":{"monthly":200,"annualized_rate":0}},{"type":"buy_to_let","when":0,"to_let":{"sqft":100,"price_per_sqft":300,"rent":{"monthly":500,"annualized_rate":0,"occupancy":1},"mortgage":{"monthly":100,"period":12}}}],"reserve_months":3}`));
    // M0: flows +200 (500 rent - 200 expense - 100 mortgage), purchase -30000,
    // settlement sells the property for 28900 -> cash -800.
    expect(r.months[0]?.cash).toBeCloseTo(-800, 4);
    // M1: only the -200 expense remains; sold rent (+500) and mortgage (-100)
    // must be gone.
    expect(r.months[1]?.monthly_cashflow).toBeCloseTo(-200, 4);
    expect(r.months[1]?.cash).toBeCloseTo(-1000, 4);
  });

  it("a surviving property's unlabeled mortgage keeps paying after a fund draw", () => {
    // Settlement that only draws a fund must not touch the surviving
    // property's mortgage payment (unlabeled mortgages have auto ids).
    const r = runScenario(y(`{"cash":36100,"events":[{"type":"investment","when":0,"fund":{"principal":5000,"annualized_rate":0}},{"type":"buy_home","when":0,"home":{"sqft":100,"price_per_sqft":300,"mortgage":{"monthly":100,"period":12}}},{"type":"expense","when":1,"expense":{"monthly":200,"annualized_rate":0}}],"reserve_months":3}`));
    // M0: fund -5000, home -30000, mortgage -100 -> cash 1000, above the
    // 300 target — no settlement yet, property and fund intact.
    expect(r.months[0]?.cash).toBeCloseTo(1000, 4);
    expect(r.months[0]?.assets_value).toBeCloseTo(35000, 4);
    // M1: expense -200 and mortgage -100 -> cash 700 below the 900 target;
    // the fund covers it, the property SURVIVES. M2 must still pay both.
    expect(r.months[1]?.monthly_cashflow).toBeCloseTo(-300, 4);
    expect(r.months[2]?.monthly_cashflow).toBeCloseTo(-300, 4);
  });
});

describe("simulation-output wrapper", () => {
  it("returns the wrapper shape and round-trips through JSON", () => {
    const r = runScenario(y(`{"cash":0,"events":[{"type":"death","when":24}]}`));
    expect(r.terminal).toBe(true);
    expect(r.terminal_month).toBe(24);
    expect(Object.keys(r).sort()).toEqual(expect.arrayContaining(["months", "terminal"]));
    const round = JSON.parse(JSON.stringify(r));
    expect(round).toEqual(r);
  });

  it("terminal_month is absent when terminal is false", () => {
    const r = runScenario(y(`{"cash":0,"events":[{"type":"job","when":0,"salary":{"monthly":1000,"annualized_rate":0}}]}`));
    const round = JSON.parse(JSON.stringify(r));
    expect(round.terminal).toBe(false);
    expect("terminal_month" in round).toBe(false);
    expect("passive_income_month" in round).toBe(false);
  });

  it("passive_income_month is reported when pension covers expenses", () => {
    // From month 12 onward, pension of 5000 covers the 1000 expense.
    const r = runScenario(y(`{"cash":0,"events":[{"type":"expense","when":0,"expense":{"monthly":1000,"annualized_rate":0}},{"type":"pension","when":12,"pension":{"monthly":5000,"annualized_rate":0}}]}`));
    expect(r.passive_income_month).toBe(12);
  });

  it("passive_income_month is absent when salary alone covers expenses", () => {
    const r = runScenario(y(`{"cash":0,"events":[{"type":"job","when":0,"salary":{"monthly":5000,"annualized_rate":0}}]}`));
    expect(r.passive_income_month).toBeUndefined();
  });
});

describe("property tax combines with salaries tax in the same block", () => {
  it("a buy_to_let accruing 12000/month of rent triggers property tax", () => {
    // rent 12000/mo for 12 months = 144_000. Property tax = 144_000 × 0.8 × 0.15 = 17_280.
    // No salary. Salaries tax = 0 (no salary nor pension to tax).
    const r = runScenario(y(`{"cash":1000000,"events":[{"type":"buy_to_let","when":0,"to_let":{"sqft":100,"price_per_sqft":10000,"rent":{"monthly":12000,"annualized_rate":0,"occupancy":1}}}]}`));
    // End of month 10: 11 months of rent accumulated = 132_000 (after the M0
    // asset cost of 1_000_000 depleted cash to 0 then rent flowed in).
    const cashBefore = r.months[10]?.cash ?? 0;
    expect(cashBefore).toBeCloseTo(132_000, 0);
    // M11: +12_000 rent, then 17_280 property tax charged.
    const cashAfter = r.months[11]?.cash ?? 0;
    expect(cashAfter).toBeCloseTo(132_000 + 12_000 - 17_280, 0);
  });
});

describe("event does not refire", () => {
  it("expense event with when=3 is added exactly once", () => {
    const r = runScenario(y(`{"cash":0,"events":[{"type":"expense","when":3,"expense":{"monthly":1000,"annualized_rate":0}}]}`));
    // Months 0..2: monthly_cashflow = 0
    expect(r.months[0]?.monthly_cashflow).toBe(0);
    expect(r.months[1]?.monthly_cashflow).toBe(0);
    expect(r.months[2]?.monthly_cashflow).toBe(0);
    // Month 3..X: monthly_cashflow = -1000
    expect(r.months[3]?.monthly_cashflow).toBe(-1000);
    expect(r.months[4]?.monthly_cashflow).toBe(-1000);
    expect(r.months[5]?.monthly_cashflow).toBe(-1000);
  });
});
