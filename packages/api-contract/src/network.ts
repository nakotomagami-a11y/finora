// GET /api/v1/companies/:eid/network (architecture §5.5): company to company, one hop, no person nodes.
import { z } from "zod";
import { Country, Eid, SourceRef } from "./common.ts";

export const NetworkResponse = z
  .object({
    nodes: z.array(z.object({ eid: Eid, name: z.string().min(1), code: z.string().min(1), status: z.string(), country: Country }).strict()),
    edges: z.array(
      z
        .object({
          from: Eid,
          to: Eid,
          relation: z.enum(["shared_address", "corporate_member"]),
          source: SourceRef,
          since: z.string().optional(),
          share: z.number().min(0).max(100).optional(),
        })
        .strict()
        .refine((e) => e.share === undefined || e.relation === "corporate_member", { message: "only a member edge has a share" }),
    ),
    hubs: z.array(z.object({ addressKey: z.string().min(1), companyCount: z.number().int().positive(), collapsed: z.boolean() }).strict()),
    truncated: z.boolean(),
  })
  .strict();
export type NetworkResponse = z.infer<typeof NetworkResponse>;
