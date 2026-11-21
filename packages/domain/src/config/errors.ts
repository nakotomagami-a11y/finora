export const ERROR_CODES = [
  "agents_unavailable",
  "bad_request",
  "entity_not_found",
  "forbidden",
  "host_not_allowed",
  "internal_error",
  "investigation_running",
  "method_not_allowed",
  "not_found",
  "not_implemented",
  "purpose_blocked",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}
