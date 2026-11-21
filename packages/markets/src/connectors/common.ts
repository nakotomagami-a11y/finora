// Helpers the market connectors share. Parsers never throw on one bad value: they drop it and count
// the reason; a whole artifact that doesn't have the expected shape throws `SchemaChanged`.
import { createHash } from "node:crypto";
import type { MarketFieldMapEntry, RawArtifact } from "../types.ts";

export class SchemaChanged extends Error {
  readonly code = "schema_changed";
}
export class ProviderRefused extends Error {
  readonly code: "rate_limited" | "provider_error";
  constructor(code: "rate_limited" | "provider_error", detail: string) {
    super(detail);
    this.code = code;
  }
}

const decoder = new TextDecoder();
export const textOf = (raw: RawArtifact) => decoder.decode(raw.bytes);

export function jsonOf(raw: RawArtifact): unknown {
  try {
    return JSON.parse(textOf(raw));
  } catch {
    throw new SchemaChanged(`${raw.name}: not JSON`);
  }
}

export function artifact(raw: readonly RawArtifact[], name: string): RawArtifact {
  const a = raw.find((r) => r.name === name);
  if (!a) throw new SchemaChanged(`missing artifact ${name}`);
  return a;
}

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** A finite number from a number or a decimal string (thousands separators allowed); null otherwise. */
export function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const isoDay = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v.slice(0, 10))) ? v.slice(0, 10) : null);
export const epochIso = (seconds: number) => new Date(seconds * 1000).toISOString();
export const epochSeconds = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 1000);

export function maxOf(values: readonly (string | null)[]): string | null {
  const present = values.filter((v): v is string => v !== null);
  return present.length ? present.sort().at(-1) ?? null : null;
}

/**
 * The parser version (A1): the parser revision, the field map, the item list and the tile rows the
 * connector feeds. Any change re-parses stored artifacts.
 */
export function parserVersion(id: string, revision: number, fieldMap: readonly MarketFieldMapEntry[], items: readonly string[], tiles: unknown): string {
  const h = createHash("sha256").update(JSON.stringify({ id, revision, fieldMap, items, tiles })).digest("hex").slice(0, 16);
  return `${id}@${revision}:${h}`;
}

export const concept = (field: string, name: string, itemId: string): MarketFieldMapEntry => ({ field, target: { concept: name }, itemId, personal: false });
export const notRead = (field: string): MarketFieldMapEntry => ({ field, target: { dropped: "no_item" }, personal: false });
