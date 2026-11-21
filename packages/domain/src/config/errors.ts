export const ERROR_CODES = [
  "bad_request",
  "forbidden",
  "host_not_allowed",
  "internal_error",
  "method_not_allowed",
  "not_found",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}
