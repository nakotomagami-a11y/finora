// POST /api/v1/disputes (architecture §5.1, §3.3): the target is pinned by content hash server-side;
// the note is the user's own text, length-capped, and never echoed into another surface.
import { z } from "zod";
import { Eid, ItemId } from "./common.ts";

export const DisputeRequest = z
  .object({ companyEid: Eid, itemId: ItemId, kind: z.enum(["correction", "objection"]), note: z.string().trim().max(2000).default("") })
  .strict();
export const DisputeResponse = z.object({ disputeId: z.string().min(1), status: z.enum(["open"]) }).strict();
export type DisputeResponse = z.infer<typeof DisputeResponse>;
