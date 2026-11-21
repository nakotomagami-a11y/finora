// POST /api/v1/purpose (architecture §5.1, P2, P7): the purpose list holds no blocked purpose, so a
// blocked id fails this schema and the route answers 400 purpose_blocked.
import { z } from "zod";
import { PurposeId } from "./common.ts";

export const PurposeRequest = z.object({ purposeId: PurposeId }).strict();
export const PurposeResponse = z.object({ purposeId: PurposeId, expiresAt: z.string().min(1) }).strict();
export type PurposeResponse = z.infer<typeof PurposeResponse>;
