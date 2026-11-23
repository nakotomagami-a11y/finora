export function childEnv(command: "dev" | "build" | "start", env: Record<string, string | undefined>): Record<string, string | undefined>;
export function childArgs(command: "dev" | "build" | "start", env: Record<string, string | undefined>): string[];
