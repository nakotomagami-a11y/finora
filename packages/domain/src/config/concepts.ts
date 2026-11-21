// Financial and workforce concepts (architecture §3.3). Each belongs to one report section; a
// loader's field map names the concept and the country's item in that section.

export const CONCEPTS = {
  revenue: "S06",
  net_profit: "S06",
  equity: "S06",
  total_assets: "S06",
  employees: "S07",
  insured_persons: "S07",
  taxes_paid: "S08",
  tax_arrears: "S08",
} as const;

export type Concept = keyof typeof CONCEPTS;

export function isConcept(value: string): value is Concept {
  return Object.hasOwn(CONCEPTS, value);
}
