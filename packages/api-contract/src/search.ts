// GET /api/v1/search and /search/live/:register (architecture §5.1). Companies only: there is no
// person search (L2, R4), and a sole trader is a result only as legal form + code (L3).
import { z } from "zod";
import { Country, Eid } from "./common.ts";

export const SearchQuery = z.object({ q: z.string().trim().min(1).max(200), country: Country.optional() }).strict();
export const LiveRegister = z.enum(["ny", "co", "ct", "pa"]);

export const SearchHit = z
  .object({
    eid: Eid,
    caption: z.string().min(1),
    code: z.string().min(1),
    country: Country,
    legalForm: z.string().nullable(),
    status: z.string().nullable(),
    match: z.enum(["exact", "prefix", "fuzzy", "code"]),
    isNaturalPerson: z.boolean(),
  })
  .strict();

export const SearchGroup = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["bulk", "live"]),
    country: Country,
    state: z.enum(["ready", "loading", "error"]),
    percent: z.number().min(0).max(100).optional(),
    results: z.array(SearchHit),
  })
  .strict()
  .refine((g) => g.state !== "loading" || g.percent !== undefined, { message: "a loading group says how far it is" })
  .refine((g) => g.state !== "error" || g.kind === "live", { message: "only a live group can fail" });

export const SearchResponse = z.object({ groups: z.array(SearchGroup) }).strict();
export type SearchResponse = z.infer<typeof SearchResponse>;
