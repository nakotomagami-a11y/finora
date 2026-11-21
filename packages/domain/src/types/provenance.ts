/** The provenance every displayed value carries (R3, R16; architecture §3.2). */
export type SourceRef = {
  sourceId: string;
  licenceId: string;
  retrievedAt: string;
  asOf: string | null;
  asOfBasis: string | null;
  checkedAt: string | null;
  accessTier: "open" | "purpose";
  derived: boolean;
};

export type SourcedValue<T> = { value: T; sources: [SourceRef, ...SourceRef[]] };
