// Shared by the sanctions loader tests: the committed fixtures and one parse that collects records,
// the person-index entries and the whole-entry drops.
import { readFileSync } from "node:fs";
import type { DropReason, ParsedRecord, PersonEntry, RawArtifact, SourceLoader } from "../types.ts";

export function fixture(path: string, name = path.split("/").at(-1) ?? path): RawArtifact {
  return { name, bytes: new Uint8Array(readFileSync(new URL(`../../../../fixtures/sources/${path}`, import.meta.url))), fetchedAt: "2026-11-21T00:00:00Z" };
}

export async function parseAll(loader: SourceLoader, raw: RawArtifact[]): Promise<{ records: ParsedRecord[]; persons: PersonEntry[]; drops: DropReason[] }> {
  const persons: PersonEntry[] = [];
  const drops: DropReason[] = [];
  const records: ParsedRecord[] = [];
  for await (const r of loader.parse(raw, { now: "2026-11-21T00:00:00Z", onPerson: (p) => persons.push(p), onDrop: (d) => drops.push(d) })) records.push(r);
  return { records, persons, drops };
}

export const values = (record: ParsedRecord | undefined, prop: string, eidSuffix = "") =>
  (record?.entities ?? []).filter((e) => e.eid.endsWith(eidSuffix)).flatMap((e) => e.statements.filter((s) => s.prop === prop).map((s) => s.value));
