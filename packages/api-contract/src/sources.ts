// GET /api/v1/sources (architecture §5.1): the source registry with licences and freshness.
import { DROP_REASONS } from "@finora/domain";
import { z } from "zod";
import { Country } from "./common.ts";

export const StorageClass = z.enum(["store", "share-alike-store", "live-cached", "live-no-store", "agent-only", "connector-cache"]);

export const SyncSummary = z
  .object({
    kind: z.enum(["content", "unchanged", "partial", "failed", "running"]),
    startedAt: z.string().min(1),
    finishedAt: z.string().nullable(),
    read: z.number().int().nonnegative(),
    written: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
    deleted: z.number().int().nonnegative(),
    dropped: z.partialRecord(z.enum(DROP_REASONS), z.number().int().nonnegative()),
    reason: z.string().optional(),
  })
  .strict();

export const SourceInfo = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
    country: z.union([Country, z.literal("intl")]),
    publisher: z.string().min(1),
    licenceId: z.string().min(1),
    licenceName: z.string().min(1),
    attribution: z.string().nullable(),
    storage: StorageClass,
    cadence: z.string().min(1),
    freshness: z.enum(["current", "stale", "never_loaded", "not_configured"]),
    asOf: z.string().nullable(),
    lastSync: SyncSummary.nullable(),
  })
  .strict();

export const SourcesResponse = z.object({ sources: z.array(SourceInfo) }).strict();
export type SourcesResponse = z.infer<typeof SourcesResponse>;
