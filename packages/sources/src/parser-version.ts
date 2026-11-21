// A loader's parserVersion (architecture §4.4, A1): its own revision, its field map and the call
// of every item it fills, so an edit to any of them re-parses the source.
import { createHash } from "node:crypto";
import { item } from "@finora/domain";
import type { FieldMap } from "./types.ts";

export function parserVersion(sourceId: string, revision: number, fieldMap: FieldMap, items: readonly string[]): string {
  const calls = items.map((id) => `${id}:${item(id)?.call ?? "unknown"}`);
  const hash = createHash("sha256").update(JSON.stringify([fieldMap, calls])).digest("hex").slice(0, 12);
  return `${sourceId}-${revision}-${hash}`;
}
