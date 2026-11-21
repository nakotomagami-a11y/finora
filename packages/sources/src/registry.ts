// Every loader Finora ships. Each loader slice (S05, S06, ...) adds its own here; the shared
// tests (licences, field maps, person fields) iterate this list, so a new loader is checked by
// adding it.
import { esmaNcasp } from "./intl/sanctions/esma.ts";
import { euFsf } from "./intl/sanctions/eu-fsf.ts";
import { usOfacCons, usOfacSdn } from "./intl/sanctions/ofac.ts";
import { ukSanctionsList } from "./intl/sanctions/uk.ts";
import { lvFidFrozen } from "./lv/fid/fid.ts";
import type { SourceLoader } from "./types.ts";

export const LOADERS: readonly SourceLoader[] = [euFsf, usOfacSdn, usOfacCons, ukSanctionsList, esmaNcasp, lvFidFrozen];
