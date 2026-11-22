// Every loader Finora ships. Each loader slice (S05, S06, ...) adds its own here; the shared
// tests (licences, field maps, person fields) iterate this list, so a new loader is checked by
// adding it.
import { esmaNcasp } from "./intl/sanctions/esma.ts";
import { euFsf } from "./intl/sanctions/eu-fsf.ts";
import { usOfacCons, usOfacSdn } from "./intl/sanctions/ofac.ts";
import { ukSanctionsList } from "./intl/sanctions/uk.ts";
import { lvFidFrozen } from "./lv/fid/fid.ts";
import { LV_FINANCIALS_LOADERS } from "./lv/lv-financials/lv-financials.ts";
import { LV_PEOPLE_LOADERS } from "./lv/lv-people/lv-people.ts";
import { LV_RISK_LOADERS } from "./lv/lv-risk/lv-risk.ts";
import { LV_TAX_LOADERS } from "./lv/lv-tax/lv-tax.ts";
import { lvUrEquityCapitals, lvUrLiquidations, lvUrMemorandumDates, lvUrNameHistory, lvUrRegister, lvUrReorganizations } from "./lv/lv-ur-register/lv-ur-register.ts";
import type { SourceLoader } from "./types.ts";

/** The LV register loads before every other LV source (lv-register.md § Identity and joins). */
export const LV_LOADERS: readonly SourceLoader[] = [
  lvUrRegister, lvUrNameHistory, lvUrLiquidations, lvUrReorganizations, lvUrEquityCapitals, lvUrMemorandumDates,
  ...LV_PEOPLE_LOADERS, ...LV_RISK_LOADERS, ...LV_FINANCIALS_LOADERS, ...LV_TAX_LOADERS,
];

export const LOADERS: readonly SourceLoader[] = [euFsf, usOfacSdn, usOfacCons, ukSanctionsList, esmaNcasp, ...LV_LOADERS, lvFidFrozen];
