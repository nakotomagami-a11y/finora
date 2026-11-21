// Load rule 2 at the field map (architecture §3.6): every target is a SHOW or CAVEAT item or a
// resolution key; a HIDE or LATER item can only appear as "dropped".
import { isLoadable, item } from "@finora/domain";
import type { FieldMap } from "./types.ts";

export function checkFieldMap(sourceId: string, fieldMap: FieldMap): string[] {
  const problems: string[] = [];
  const fields = new Set<string>();
  for (const entry of fieldMap) {
    if (fields.has(entry.field)) problems.push(`${sourceId}: field ${entry.field} is mapped twice`);
    fields.add(entry.field);
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
