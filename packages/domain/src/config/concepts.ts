// Financial and workforce concepts (architecture §3.3). Each belongs to one report section; a
// loader's field map names the concept and the country's item in that section.

export const CONCEPTS = {
  revenue: "S06",
  net_profit: "S06",
  profit_before_tax: "S06",
  equity: "S06",
  total_assets: "S06",
  current_assets: "S06",
  non_current_assets: "S06",
  liabilities: "S06",
  current_liabilities: "S06",
  non_current_liabilities: "S06",
  cash: "S06",
  employees: "S07",
  employees_avg: "S07",
  insured_persons: "S07",
  taxes_paid: "S08",
  labour_taxes: "S08",
  state_taxes: "S08",
  vat_paid: "S08",
  taxable_turnover: "S08",
  tax_arrears: "S08",
  tax_arrears_overdue: "S08",
  tax_arrears_deferred: "S08",
  tax_arrears_disputed: "S08",
} as const;

export type Concept = keyof typeof CONCEPTS;

export function isConcept(value: string): value is Concept {
  return Object.hasOwn(CONCEPTS, value);
}
