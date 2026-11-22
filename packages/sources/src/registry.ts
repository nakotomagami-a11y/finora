// Every loader Finora ships. Each loader slice (S05, S06, ...) adds its own here; the shared
// tests (licences, field maps, person fields) iterate this list, so a new loader is checked by
// adding it.
import { esmaNcasp } from "./intl/sanctions/esma.ts";
import { euFsf } from "./intl/sanctions/eu-fsf.ts";
import { usOfacCons, usOfacSdn } from "./intl/sanctions/ofac.ts";
import { ukSanctionsList } from "./intl/sanctions/uk.ts";
import { lvFidFrozen } from "./lv/fid/fid.ts";
import { LV_FINANCIALS_LOADERS } from "./lv/lv-financials/lv-financials.ts";
import { lvPeopleLoaders, type LvPersonRows } from "./lv/lv-people/lv-people.ts";
import { LV_RISK_LOADERS } from "./lv/lv-risk/lv-risk.ts";
import { LV_TAX_LOADERS } from "./lv/lv-tax/lv-tax.ts";
import { lvUrEquityCapitals, lvUrLiquidations, lvUrMemorandumDates, lvUrNameHistory, lvUrRegister, lvUrReorganizations } from "./lv/lv-ur-register/lv-ur-register.ts";
import type { SourceLoader, SourceMeta } from "./types.ts";

/** Settings a loader is built with: the lawyer switches that change what a loader keeps (§10.2). */
export type LoaderConfig = { lvPersonRows: LvPersonRows };
export const DEFAULT_LOADER_CONFIG: LoaderConfig = { lvPersonRows: "names_no_id" };

/** The LV register loads before every other LV source (lv-register.md § Identity and joins). */
const lvLoaders = (config: LoaderConfig): SourceLoader[] => [
  lvUrRegister, lvUrNameHistory, lvUrLiquidations, lvUrReorganizations, lvUrEquityCapitals, lvUrMemorandumDates,
  ...lvPeopleLoaders({ personRows: config.lvPersonRows }), ...LV_RISK_LOADERS, ...LV_FINANCIALS_LOADERS, ...LV_TAX_LOADERS,
];

/** Every shipped loader, built for one config: a sync job passes its own, never a default (SEC-1 on S05; qa, legal). */
export const loadersFor = (config: LoaderConfig): SourceLoader[] => [
  euFsf, usOfacSdn, usOfacCons, ukSanctionsList, esmaNcasp, ...lvLoaders(config), lvFidFrozen,
];

/**
 * Every shipped source's meta, for listings: nothing here can be fetched or parsed, so no caller can
 * run a sync on a default config (legal, qa on S05). A sync builds its loaders with `loadersFor(config)`.
 */
export const SOURCE_METAS: readonly SourceMeta[] = loadersFor(DEFAULT_LOADER_CONFIG).map((loader) => loader.meta);
