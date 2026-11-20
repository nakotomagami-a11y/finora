// Entity ids (architecture §3.4). Person and relationship rows have internal ids that never
// leave the store; every other eid is public and stable across rebuilds.

const PUBLIC_EIDS = {
  lv: /^lv-\d{11}$/,
  ee: /^ee-\d{8}$/,
  lt: /^lt-\d{9}$/,
  org: /^org-[0-9a-f]{20}$/,
  sec: /^us-cik-\d{10}$/,
  usState: /^us-[a-z]{2}-[A-Za-z0-9]+$/,
  lei: /^lei-[A-Z0-9]{20}$/,
  sanctions: /^sanc-[a-z0-9]+-[A-Za-z0-9.]+$/,
} as const;

const INTERNAL_EIDS = { person: /^p-\d+-\d+$/, relationship: /^rel-\d+-\d+$/ } as const;

export type EidKind = keyof typeof PUBLIC_EIDS | keyof typeof INTERNAL_EIDS;

export function eidKind(eid: string): EidKind | null {
  for (const [kind, re] of Object.entries({ ...PUBLIC_EIDS, ...INTERNAL_EIDS })) {
    if (re.test(eid)) return kind as EidKind;
  }
  return null;
}

/** Person and relationship row ids: never in a URL, title, log, index, export or MCP list (PS5). */
export function isInternalEid(eid: string): boolean {
  return Object.values(INTERNAL_EIDS).some((re) => re.test(eid));
}
