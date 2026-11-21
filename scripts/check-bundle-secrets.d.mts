export const SECRET_NAMES: string[];
export const SENTINEL_PREFIX: string;
export function sentinelFor(name: string): string;
export function findLeaks(files: { path: string; text: string }[], sentinels: Record<string, string>): string[];
