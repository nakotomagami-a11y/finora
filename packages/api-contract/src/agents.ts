// GET /api/v1/agents/status (architecture §5.1, C18, C19): the Investigate sheet's states.
import { z } from "zod";

export const AgentsStatusResponse = z
  .object({
    backend: z.enum(["off", "cli", "local"]),
    cli: z.enum(["ready", "missing", "signed_out", "unsafe"]).nullable(),
    cliVersion: z.string().min(1).optional(),
    provenVersion: z.string().min(1).optional(),
    overage: z.enum(["off", "permitted", "in_use", "unknown"]),
    running: z.string().min(1).nullable(),
  })
  .strict()
  .refine((s) => (s.backend === "cli") === (s.cli !== null), { message: "the CLI state is reported only for the cli backend" });
export type AgentsStatusResponse = z.infer<typeof AgentsStatusResponse>;
