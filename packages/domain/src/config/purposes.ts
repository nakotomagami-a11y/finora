// Policy P2: person data is shown only after the user states a purpose from this list.
// Policy P7: uses blocked for natural-person subjects (credit, employment, insurance, tenancy,
// licensing, credit servicing) are not in the list at all, on any surface.

export const PURPOSES = [
  "counterparty_check",
  "supplier_check",
  "customer_check",
  "invoice_or_offer_check",
  "investment_research",
  "compliance_screening",
  "journalism_or_research",
] as const;
export type PurposeId = (typeof PURPOSES)[number];

export const BLOCKED_PURPOSES = [
  "credit_decision",
  "employment_decision",
  "insurance_decision",
  "tenancy_decision",
  "licensing_decision",
  "credit_servicing",
] as const;

export const isPurposeId = (value: unknown): value is PurposeId =>
  typeof value === "string" && (PURPOSES as readonly string[]).includes(value);

export const isBlockedPurpose = (value: unknown): boolean =>
  typeof value === "string" && (BLOCKED_PURPOSES as readonly string[]).includes(value);

/** A purpose session lasts this long in the UI, or until the app restarts (P2). */
export const PURPOSE_SESSION_HOURS = 12;
