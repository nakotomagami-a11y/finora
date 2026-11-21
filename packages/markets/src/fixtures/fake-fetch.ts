// A fetch that answers every Crash monitor URL with a synthetic fixture layout, so tests and the
// demo run the real connectors with no network. Every value is made up (series.ts).
import type { Fetch } from "../types.ts";
import { c1Layout, c3Layout, fredLayout, o3Layout, s3Layout, s7Layout, treasuryLayout, twseLayout, worldBankLayout, x4Layout } from "./layouts.ts";
import { FIXTURE_TICKERS } from "./series.ts";

const XLSX_URL = "https://thedocs.worldbank.org/en/doc/fixture/related/CMO-Historical-Data-Monthly.xlsx";
const ok = (bytes: Uint8Array) => ({ status: 200, headers: {}, bytes });
const text = (s: string) => ok(new TextEncoder().encode(s));
const first = (a: { bytes: Uint8Array }[]) => (a[0] as { bytes: Uint8Array }).bytes;

/** `overrides` answer a URL pattern first: tests use them to simulate a refusal, a schema change or an outage. */
export function fakeMarketFetch(overrides: { match: RegExp; respond: () => { status: number; headers: Record<string, string>; bytes: Uint8Array } | Promise<never> }[] = []): Fetch {
  return async (url, init) => {
    for (const o of overrides) if (o.match.test(url)) return o.respond();
    const u = new URL(url);
    if (u.hostname === "api.fiscaldata.treasury.gov") return ok(first(treasuryLayout()));
    if (u.hostname === "fred.stlouisfed.org") {
      const id = u.searchParams.get("id") ?? "";
      return ok(first(fredLayout([id])));
    }
    if (u.hostname === "openapi.twse.com.tw") return ok(first(twseLayout()));
    if (u.hostname === "www.worldbank.org") return text(`<html><a href="${XLSX_URL}">Monthly prices</a></html>`);
    if (u.hostname === "thedocs.worldbank.org") return ok(first(worldBankLayout()));
    if (u.hostname === "api.tiingo.com") {
      const symbol = decodeURIComponent(u.pathname.split("/")[3] ?? "");
      const index = FIXTURE_TICKERS.indexOf(symbol);
      const layout = s7Layout(13).find((a) => a.name.endsWith(`|${symbol}.json`));
      return index >= 0 && layout ? ok(layout.bytes) : { status: 404, headers: {}, bytes: new Uint8Array() };
    }
    if (u.hostname === "www.alphavantage.co") return ok(first(s3Layout()));
    if (u.hostname === "www.bitstamp.net") {
      const pair = u.pathname.split("/")[4] ?? "";
      const latest = u.searchParams.get("step") === "300";
      const layout = x4Layout(latest ? "latest" : "daily").find((a) => a.name.startsWith(`${pair}.`));
      return ok(layout?.bytes ?? new TextEncoder().encode('{"data":{"ohlc":[]}}'));
    }
    if (u.hostname === "bitcoin-rpc.publicnode.com") {
      const method = (JSON.parse(init?.body ?? "{}") as { method?: string }).method;
      return method === "getbestblockhash" ? text(JSON.stringify({ result: "0".repeat(64), error: null, id: 1 })) : ok(first(o3Layout()));
    }
    if (u.hostname === "api.coingecko.com") {
      const daily = c1Layout("daily");
      return ok((u.pathname.endsWith("/global") ? daily[0] : daily[1])?.bytes ?? new Uint8Array());
    }
    if (u.hostname === "api.coinpaprika.com") return ok(first(c3Layout()));
    return { status: 404, headers: {}, bytes: new Uint8Array() };
  };
}
