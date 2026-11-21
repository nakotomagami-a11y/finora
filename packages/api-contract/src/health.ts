import { z } from "zod";

/** `store` stays null until the store exists (S04); S04b widens it. */
export const HealthResponse = z.object({
  status: z.literal("ok"),
  version: z.string().min(1),
  store: z.null(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
