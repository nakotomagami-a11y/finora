// Why a value or a record was not loaded (architecture §4.4-§4.5). A sync report counts only these
// words, so no loader's free text can reach it (SEC-2). A loader slice adds its own reasons here.

export const DROP_REASONS = [
  // the pipeline's gates
  "hide_item",
  "later_item",
  "personal_code",
  "party_not_proven",
  "sole_trader_address",
  "sole_trader_vat",
  "natural_person_tax",
  "natural_person_insolvency",
  "natural_person_workforce",
  // records refused whole
  "invalid_record",
  "person_field",
  "entity_missing",
  "write_refused",
  "delete_not_allowed",
  // named by the loader specs so far
  "code_not_in_register",
  "invalid_code",
  "legacy_code",
  "no_code",
  "person_entry",
  "joint_owners",
  "role_not_item",
  "natural_person_name",
  "natural_person_type",
  "natural_person_form",
  "natural_person_vat",
  "natural_person_address",
  "unknown_legal_form",
  "unknown_status",
  "unknown_enum",
  "free_text",
  "gender",
  "duplicate_key",
  // the LV loaders (S05)
  "lv_person_rows_role_counts",
  "natural_person_party",
  "link_host",
  "struck_off_identity_only",
  "bad_period",
  "bad_nace",
  "bad_date",
  "person_document",
  "no_item",
  // the Crash monitor connectors (loaders/markets.md)
  "market_missing_value",
  "market_invalid_value",
  "market_outside_window",
  "unmapped_line",
  "consolidated_report",
  "conflicting_value",
  "conflicting_line",
  // sanctions lists (sanctions.md)
  "unknown_subject_type",
  "subject_out_of_scope",
  "unproven_party",
  "listed_person_name",
  "other",
] as const;

export type DropReason = (typeof DROP_REASONS)[number];

export function isDropReason(value: unknown): value is DropReason {
  return typeof value === "string" && (DROP_REASONS as readonly string[]).includes(value);
}
