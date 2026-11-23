// Load rule 2 at the field map (architecture §3.6): every target is a SHOW or CAVEAT item or a
// resolution key; a HIDE or LATER item can only appear as "dropped".
import { isLoadable, item } from "@finora/domain";
import type { FieldMap } from "./types.ts";

export function checkFieldMap(sourceId: string, fieldMap: FieldMap): string[] {
  const problems: string[] = [];
  // One column may feed a resolution key and a statement, or two props (M1-F2). A field is mapped
  // twice when the same target repeats, or when it is dropped and also feeds something.
  const uses = new Map<string, FieldMap[number][]>();
  for (const entry of fieldMap) uses.set(entry.field, [...(uses.get(entry.field) ?? []), entry]);
  for (const [field, entries] of uses) {
    const targets = entries.map((e) => JSON.stringify(e.target));
    if (new Set(targets).size < targets.length) problems.push(`${sourceId}: field ${field} is mapped twice to the same target`);
    else if (entries.length > 1 && entries.some((e) => "dropped" in e.target)) problems.push(`${sourceId}: field ${field} is mapped twice: a dropped field feeds nothing else`);
  }
  for (const entry of fieldMap) {
    const target = entry.target;
    if ("dropped" in target || "resolutionKey" in target) continue;
    if (!entry.itemId) {
      problems.push(`${sourceId}: field ${entry.field} has a target but no item`);
      continue;
    }
    if (!item(entry.itemId)) problems.push(`${sourceId}: field ${entry.field} targets unknown item ${entry.itemId}`);
    else if (!isLoadable(entry.itemId)) problems.push(`${sourceId}: field ${entry.field} targets ${entry.itemId}, a HIDE or LATER item`);
  }
  return problems;
}
