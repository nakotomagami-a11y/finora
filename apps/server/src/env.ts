import "server-only";
import { z } from "zod";
import pkg from "../package.json" with { type: "json" };

/** Where the source code lives: shown in the footer and in `GET /api/v1/about` (R18, AGPL-3.0 section 13). */
const DEFAULT_SOURCE_URL = pkg.repository.url;

const EnvSchema = z.object({
  // A missing value means production: the relaxed development policy must be asked for.
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  FINORA_DATA_DIR: z.string().min(1).default("./.data"),
  FINORA_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  FINORA_DEMO: z.literal("1").optional(),
  FINORA_SOURCE_URL: z.url({ protocol: /^https?$/u }).default(DEFAULT_SOURCE_URL),
  FINORA_COMMIT: z.string().min(1).optional(),
  // Crash monitor keys, the user's own (docs/plan/loaders/markets.md §1.5). All optional: without one the
  // tiles it unlocks show "Add your key".
  MARKETS_S7_API_KEY: z.string().min(8).optional(),
  MARKETS_S3_API_KEY: z.string().min(8).optional(),
  MARKETS_C1_DEMO_KEY: z.string().min(8).optional(),
});

/** The market keys a connector reads, by env name; values never leave the server (R17). */
export function marketKeys(env: Env): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const name of ["MARKETS_S7_API_KEY", "MARKETS_S3_API_KEY", "MARKETS_C1_DEMO_KEY"] as const) {
    const value = env[name];
    if (value) keys[name] = value;
  }
  return keys;
}

export type Env = z.infer<typeof EnvSchema>;

export class EnvError extends Error {
  readonly variables: string[];
  constructor(variables: string[], message: string) {
    super(message);
    this.name = "EnvError";
    this.variables = variables;
  }
}

/** Validates an environment once and names every invalid variable. An empty value counts as unset. */
export function loadEnv(source: Record<string, string | undefined>): Env {
  const present = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value !== ""));
  const parsed = EnvSchema.safeParse(present);
  if (parsed.success) return parsed.data;
  const variables = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
  const detail = parsed.error.issues.map((issue) => `${String(issue.path[0])}: ${issue.message}`).join("; ");
  throw new EnvError(variables, `Invalid environment: ${detail}`);
}

let cached: Env | undefined;

/** The process environment, validated on first use. This is the only place `process.env` is read. */
export function getEnv(): Env {
  cached ??= loadEnv(process.env);
  return cached;
}
