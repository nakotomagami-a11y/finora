import { z } from "zod";
import { ERROR_CODES } from "@finora/domain";

export const ErrorResponse = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    detail: z.string().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
