// GET /api/v1/companies/:eid/export (architecture §5.1): redistributable, non-personal values only;
// never share-alike or connector-cache rows (R4, P1, R17), so every source's tier is "open".
import { z } from "zod";
import { Eid, ItemId, SourceRef } from "./common.ts";

export const ExportQuery = z.object({ format: z.enum(["json", "ftm"]).default("json") }).strict();

const OpenSource = SourceRef.refine((s) => s.accessTier === "open", { message: "an export holds open data only" });

export const ExportResponse = z
  .object({
    eid: Eid,
    generatedAt: z.string().min(1),
    statements: z
      .array(z.object({ itemId: ItemId, prop: z.string().min(1), value: z.union([z.string(), z.number()]), sources: z.array(OpenSource).min(1) }).strict()),
    licences: z.array(z.object({ licenceId: z.string().min(1), attribution: z.string().nullable() }).strict()),
  })
  .strict();
export type ExportResponse = z.infer<typeof ExportResponse>;
