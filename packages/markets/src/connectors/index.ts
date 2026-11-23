// Every Crash monitor source: the official ones in the tree, and the ones the user's local provider
// file configures (human ruling H4). Key-gated sources are gone (H5). The oracle route (M05.X.02a,
// M06.X.01a) and macro tiles (M09.X.01) are LATER: no connector exists for them (items.test.ts).
import type { Providers } from "../providers.ts";
import type { MarketConnector } from "../types.ts";
import { configuredConnectors } from "./configured.ts";
import { fredOpen, treasuryDebt, worldBankGold } from "./official.ts";

export const OFFICIAL_CONNECTORS: readonly MarketConnector[] = [treasuryDebt, fredOpen, worldBankGold];

export function marketConnectors(providers: Providers): MarketConnector[] {
  return [...OFFICIAL_CONNECTORS, ...configuredConnectors(providers)];
}

export function connector(id: string, providers: Providers = {}): MarketConnector | undefined {
  return marketConnectors(providers).find((c) => c.meta.id === id);
}

export { citedSeriesKey, configuredConnectors, PROVIDER_SOURCE, providerLicences, rocToIso, X4_PAGE } from "./configured.ts";
export { DEBT_HISTORY_DAYS, quarterEnd, updatedOn } from "./official.ts";
export { ProviderRefused, SchemaChanged } from "./common.ts";
