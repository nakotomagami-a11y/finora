import { legalForm } from "../config/legal-forms.ts";

/**
 * Legal rule 5: a sole trader is a natural person. Decided by legal form only. An unknown form
 * counts as a natural person, so a gap in the form table can only over-protect.
 */
export function isNaturalPerson(entity: { schema: string; legalForm: string | null }): boolean {
  if (entity.schema === "Person") return true;
  if (entity.legalForm === null) return false;
  return legalForm(entity.legalForm)?.naturalPerson ?? true;
}

/** How a natural-person entity is titled: legal form and registry code, never the name (L3, P6). */
export function naturalPersonCaption(entity: { legalForm: string | null; code: string }): string {
  const label = entity.legalForm ? (legalForm(entity.legalForm)?.label ?? "") : "";
  return `${label} ${entity.code}`.trim();
}
