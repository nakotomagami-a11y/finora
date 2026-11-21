// Every Crash monitor source. The oracle route (M05.X.02a, M06.X.01a) and macro tiles (M09.X.01)
// are LATER: no connector exists for them (items.test.ts).
import type { MarketConnector } from "../types.ts";
import { fredCited, fredOpen, treasuryDebt, twseIndex, worldBankGold } from "./official.ts";
import { btcHeight, cryptoC1, cryptoC3, cryptoX4, goldS3, stocksS7 } from "./priced.ts";

export const MARKET_CONNECTORS: readonly MarketConnector[] = [treasuryDebt, fredOpen, fredCited, twseIndex, worldBankGold, stocksS7, goldS3, cryptoX4, btcHeight, cryptoC1, cryptoC3];

export function connector(id: string): MarketConnector | undefined {
  return MARKET_CONNECTORS.find((c) => c.meta.id === id);
}

export { DEBT_HISTORY_DAYS, quarterEnd, rocToIso, updatedOn } from "./official.ts";
export { C1_KEY, S3_KEY, S7_KEY, X4_PAGE } from "./priced.ts";
export { ProviderRefused, SchemaChanged } from "./common.ts";
