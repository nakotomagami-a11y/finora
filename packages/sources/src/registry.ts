// Every loader Finora ships. Each loader slice (S05, S06, ...) adds its own here; the shared
// tests (licences, field maps, person fields) iterate this list, so a new loader is checked by
// adding it.
import type { SourceLoader } from "./types.ts";

export const LOADERS: readonly SourceLoader[] = [];
