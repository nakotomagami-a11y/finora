import { z } from "zod";

/** GET /api/v1/health (architecture §5.1): liveness, the store's version, freshness, history size (P9), last jobs. */
export const HealthResponse = z
  .object({
    status: z.literal("ok"),
    version: z.string().min(1),
    store: z
      .object({
        schemaVersions: z.record(z.enum(["main", "user", "sa", "cc"]), z.number().int().nonnegative()),
        historyBytes: z.number().int().nonnegative(),
        historyMaxBytes: z.number().int().positive(),
        sources: z.array(z.object({ id: z.string().min(1), freshness: z.enum(["current", "stale", "never_loaded", "not_configured"]) }).strict()),
        jobs: z.array(z.object({ name: z.string().min(1), lastRunAt: z.string().nullable(), lastOutcome: z.enum(["ok", "failed"]).nullable() }).strict()),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type HealthResponse = z.infer<typeof HealthResponse>;
