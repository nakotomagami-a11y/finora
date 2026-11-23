import { z } from "zod";

/** The source-code link is a legal requirement (R18, AGPL-3.0 section 13). */
export const AboutResponse = z.object({
  name: z.literal("Finora"),
  version: z.string().min(1),
  commit: z.string().nullable(),
  sourceUrl: z.url({ protocol: /^https?$/u }),
  licence: z.literal("AGPL-3.0-or-later"),
});
export type AboutResponse = z.infer<typeof AboutResponse>;
