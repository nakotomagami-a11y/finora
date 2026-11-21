export { EMPTY_STATE_KEYS, ITEM_CAVEATS_EN, ITEMS } from "./items/items.generated.ts";
export type { EmptyStateKey, Item, ItemCall, ItemId } from "./items/items.generated.ts";
export { ERROR_CODES, isErrorCode } from "./config/errors.ts";
export type { ErrorCode } from "./config/errors.ts";
export { BANNED_STEMS, BANNED_WORDS_EN, findBannedTerms } from "./config/banned-terms.ts";
export type { BannedLocale, BannedMatch } from "./config/banned-terms.ts";
export { HIDE_ITEM_IDS, isLoadable, item } from "./items/policy.ts";
export { CONCEPTS, isConcept, type Concept } from "./config/concepts.ts";
export { eidKind, isInternalEid, type EidKind } from "./ids/eid.ts";
export { COUNTRIES, isCountry, type Country } from "./config/countries.ts";
export { LEGAL_FORMS, legalForm, type LegalForm } from "./config/legal-forms.ts";
export {
  BLOCKED_PURPOSES,
  isBlockedPurpose,
  isPurposeId,
  PURPOSE_SESSION_HOURS,
  PURPOSES,
  type PurposeId,
} from "./config/purposes.ts";
export { isNaturalPerson, naturalPersonCaption } from "./policy/persons.ts";
export { balticCheckDigit, COMPANY_ID_PROPS, findPersonalCodes, idIsPersonalCode, isBalticPersonalCode, PERSON_EID, type PersonalCodeHit } from "./policy/personal-codes.ts";
export {
  FINORA_EXTENSIONS,
  FTM_UPSTREAM,
  isProp,
  NAME_PROPS,
  ORGANISATION_SCHEMAS,
  PROPS,
  SCHEMAS,
  type SchemaName,
} from "./schema/ftm.ts";
export { normalizeText } from "./text/normalize.ts";
export type { SourceRef, SourcedValue } from "./types/provenance.ts";
