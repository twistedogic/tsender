/**
 * tsender scenario types.
 *
 * Source-of-truth mirrors openspec/changes/add-tsender-v01/specs/scenario-loading/spec.md,
 * hk-salaries-tax/spec.md, hk-property-tax/spec.md.
 */

export interface Scenario {
  cash: number;
  events: Event[];
  reserve_months?: number;
  start?: string;
  end?: string;
  saving?: number;
  tax?: TaxBlock;
}

export interface TaxBlock {
  status?: "single" | "married";
  children?: number;
  parents?: ParentAllowance[];
}

export interface ParentAllowance {
  age_band: "60+" | "55-59";
  living_with: boolean;
}

// ---------- Events ----------

export type Event =
  | JobEvent
  | PensionEvent
  | ExpenseEvent
  | TuitionEvent
  | WithdrawalEvent
  | LayoffEvent
  | GraduateEvent
  | BuyHomeEvent
  | BuyToLetEvent
  | InvestmentEvent
  | EndEvent
  | OneOffExpenseEvent
  | OneOffIncomeEvent
  | DeathEvent
  | RefinanceEvent
  | PayChangeEvent
  | DownturnEvent;

export interface JobEvent {
  type: "job";
  when: number;
  id?: string;
  salary: Growth;
}

export interface PensionEvent {
  type: "pension";
  when: number;
  pension: Growth;
}

export interface ExpenseEvent {
  type: "expense";
  when: number;
  id?: string;
  expense: Growth;
}

export interface TuitionEvent {
  type: "tuition";
  when: number;
  id?: string;
  tuition: Growth;
}

export interface WithdrawalEvent {
  type: "withdrawal";
  when: number;
  id?: string;
  withdrawal: Growth;
}

export interface LayoffEvent {
  type: "layoff";
  when: number;
  id?: string;
}

export interface GraduateEvent {
  type: "graduate";
  when: number;
  id?: string;
}

export interface BuyHomeEvent {
  type: "buy_home";
  when: number;
  home: PropertySpec;
}

export interface BuyToLetEvent {
  type: "buy_to_let";
  when: number;
  to_let: ToLetSpec;
}

export interface InvestmentEvent {
  type: "investment";
  when: number;
  fund: FundSpec;
}

export interface EndEvent {
  type: "end";
  when: number;
  id: string;
}

export interface OneOffExpenseEvent {
  type: "one_off_expense";
  when: number;
  id?: string;
  one_off: OneOffBody;
}

export interface OneOffIncomeEvent {
  type: "one_off_income";
  when: number;
  id?: string;
  one_off: OneOffBody;
}

export interface DeathEvent {
  type: "death";
  when: number;
}

export interface RefinanceEvent {
  type: "refinance";
  when: number;
  id: string;
  monthly: number;
}

export interface PayChangeEvent {
  type: "pay_change";
  when: number;
  id?: string;
  monthly: number;
  annualized_rate: number;
}

export interface DownturnEvent {
  type: "downturn";
  when: number;
  equity_drop: number;
  property_drop: number;
}

// ---------- Bodies / supporting types ----------

export interface Growth {
  monthly: number;
  annualized_rate: number;
}

export interface OneOffBody {
  amount: number;
}

export interface MortgageSpec {
  monthly: number;
  period: number;
  id?: string;
}

export interface RentSpec {
  monthly: number;
  annualized_rate: number;
  occupancy: number;
  id?: string;
}

export interface PropertySpec {
  sqft: number;
  price_per_sqft: number;
  mortgage?: MortgageSpec;
}

export interface ToLetSpec {
  sqft: number;
  price_per_sqft: number;
  mortgage?: MortgageSpec;
  rent: RentSpec;
}

export interface FundSpec {
  principal: number;
  annualized_rate: number;
  investment?: Growth & { id?: string };
}

// ---------- Simulator-state types (not in YAML) ----------

export type Cashflow =
  | SalaryCashflow
  | PensionCashflow
  | ExpenseCashflow
  | TuitionCashflow
  | WithdrawalCashflow
  | InvestmentContributionCashflow
  | RentalIncomeCashflow
  | MortgagePaymentCashflow;

export interface SalaryCashflow {
  kind: "Salary";
  id?: string;
  monthly: number;
  annualized_rate: number;
  age: number;
}

export interface PensionCashflow {
  kind: "Pension";
  monthly: number;
  annualized_rate: number;
  age: number;
}

export interface ExpenseCashflow {
  kind: "Expense";
  id?: string;
  monthly: number;
  annualized_rate: number;
  age: number;
}

export interface TuitionCashflow {
  kind: "Tuition";
  id?: string;
  monthly: number;
  annualized_rate: number;
  age: number;
}

export interface WithdrawalCashflow {
  kind: "Withdrawal";
  id?: string;
  monthly: number;
  annualized_rate: number;
  age: number;
}

export interface InvestmentContributionCashflow {
  kind: "InvestmentContribution";
  id?: string;
  monthly: number;
  annualized_rate: number;
  age: number;
}

export interface RentalIncomeCashflow {
  kind: "RentalIncome";
  id?: string;
  monthly: number;
  annualized_rate: number;
  occupancy: number;
  age: number;
}

export interface MortgagePaymentCashflow {
  kind: "MortgagePayment";
  /** Stable id matching the owning Mortgage.id, or an auto-generated fallback. */
  id: string;
  monthly: number;
  age: number;
  /** Total remaining periods; once 0, the cashflow contributes nothing. */
  remaining: number;
}

export type Asset = Fund | Property;

export interface Fund {
  kind: "Fund";
  principal: number;
  annualized_rate: number;
  contribution?: InvestmentContributionCashflow;
}

export interface Property {
  kind: "Property";
  sqft: number;
  price_per_sqft: number;
  mortgage?: Mortgage;
  rent?: RentalIncomeCashflow;
}

export interface Mortgage {
  monthly: number;
  period: number;
  paid: number;
  id?: string;
}

// ---------- Output wrapper ----------

export interface MonthResult {
  month: number;
  cash: number;
  assets_value: number;
  monthly_cashflow: number;
}

export interface RunResult {
  terminal: boolean;
  terminal_month?: number;
  months: MonthResult[];
  passive_income_month?: number;
}
