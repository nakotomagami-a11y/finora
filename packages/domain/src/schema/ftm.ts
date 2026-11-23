// The FollowTheMoney subset Finora stores (architecture §3.3). Names follow the upstream model so
// an FtM export needs no mapping. Properties Finora adds are prefixed `finora:`.

/**
 * Upstream FtM schemata and the properties Finora reads from them (FtM model, MIT), checked
 * against the schema files of the upstream repository on 2026-11-21.
 */
export const FTM_UPSTREAM = {
  Thing: ["name", "alias", "previousName", "weakAlias", "country", "address", "sourceUrl", "notes"],
  LegalEntity: [
    "registrationNumber", "idNumber", "taxNumber", "vatCode", "leiCode", "incorporationDate",
    "dissolutionDate", "status", "legalForm", "jurisdiction", "website", "email", "cikCode", "classification",
  ],
  Organization: [],
  Company: ["capital", "ticker", "isinCode"],
  Person: ["firstName", "lastName"],
  Address: ["full", "street", "city", "postalCode", "region"],
  Interval: ["startDate", "endDate", "summary"],
  Interest: ["role", "status"],
  Directorship: ["director", "organization"],
  Ownership: ["owner", "asset", "percentage", "sharesCount", "sharesValue"],
  Membership: ["member", "organization"],
  Representation: ["agent", "client"],
  Sanction: ["entity", "authority", "authorityId", "unscId", "program", "listingDate", "reason"],
  Security: ["isin", "ticker", "issuer"],
  Identification: ["holder", "number", "type"],
} as const;

export const FINORA_EXTENSIONS = [
  "finora:vatRegistered", "finora:roleSet", "finora:capitalCurrency", "finora:addressId",
  "finora:governingBody", "finora:signingRights", "finora:taxAuthorityRating",
] as const;

export const SCHEMAS = [
  "Company", "Organization", "LegalEntity", "Person", "Address", "Directorship",
  "Ownership", "Membership", "Sanction", "Security", "Identification", "Representation",
] as const;
export type SchemaName = (typeof SCHEMAS)[number];

/** Schemata whose entities are companies or other organisations: searchable, never persons. */
export const ORGANISATION_SCHEMAS: readonly SchemaName[] = ["Company", "Organization", "LegalEntity"];

/** Every property Finora may store, upstream or extension. */
export const PROPS: readonly string[] = [...new Set([...Object.values(FTM_UPSTREAM).flat(), ...FINORA_EXTENSIONS])];

export const isProp = (value: unknown): value is string => typeof value === "string" && PROPS.includes(value);

/** Properties whose values name the entity: they feed search for organisations. */
export const NAME_PROPS = ["name", "alias", "previousName"] as const;
