// PS6: no person identifier is ever a record key, hash input or stored value: a personal code, an
// SEC reporting owner's CIK, or an id that embeds one (an accession number filed by an individual
// starts with that person's CIK). Every person loader's records pass this check in its tests.
import { findPersonalCodes, PERSON_EID } from "@finora/domain";
import type { ParsedRecord } from "./types.ts";

const ACCESSION = /\b(\d{10})-\d{2}-\d{6}\b/g;

/** Problems in one parsed record; `issuerCiks` are the company CIKs an accession may start with. */
export function personFieldProblems(record: ParsedRecord, options: { issuerCiks?: readonly string[] } = {}): string[] {
  const problems: string[] = [];
  const keys = [record.recordKey, ...record.hashInput, ...(record.lineIds ?? []).filter((x): x is string => x !== null), record.rowRef ?? ""];
  for (const value of keys) {
    if (findPersonalCodes(value).length > 0) problems.push(`${record.recordKey}: a key or hash input holds a personal-code pattern`);
    if (PERSON_EID.test(value)) problems.push(`${record.recordKey}: a key or hash input holds a person row id`);
    for (const m of value.matchAll(ACCESSION)) {
      if (m[1] && !(options.issuerCiks ?? []).includes(m[1])) problems.push(`${record.recordKey}: an accession number not filed by the issuer`);
    }
  }
  for (const entity of record.entities) {
    if (entity.schema !== "Person") continue;
    for (const s of entity.statements) {
      if (["idNumber", "taxNumber", "cikCode", "registrationNumber", "vatCode"].includes(s.prop)) {
        problems.push(`${record.recordKey}: a person carries ${s.prop}; the field map must drop it as personal_code`);
      }
    }
  }
  return [...new Set(problems)];
}
