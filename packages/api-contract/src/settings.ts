// GET /api/v1/settings/status and GET/PUT /api/v1/settings/startup (architecture §5.1). No setting
// value, provider host or credential is ever in a response: presence and codes only.
import { z } from "zod";
import { Usage } from "./common.ts";
import { AgentsStatusResponse } from "./agents.ts";
import { SourceInfo } from "./sources.ts";

export const SettingsStatusResponse = z
  .object({
    agents: AgentsStatusResponse,
    secContactSet: z.boolean(),
    providersConfigured: z.array(z.string().regex(/^[a-z0-9-]{2,20}$/)),
    shareAlikeMode: z.enum(["store", "live-no-store"]),
    lawyerSwitches: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    historyBytes: z.number().int().nonnegative(),
    historyMaxBytes: z.number().int().positive(),
    sources: z.array(SourceInfo),
    usage: z.object({ today: Usage, month: Usage }).strict(),
  })
  .strict();
export type SettingsStatusResponse = z.infer<typeof SettingsStatusResponse>;

export const StartupSetting = z.object({ enabled: z.boolean() }).strict();
export const StartupResponse = z.object({ enabled: z.boolean(), supported: z.boolean() }).strict();
