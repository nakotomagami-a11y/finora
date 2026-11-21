// A fetch that answers every Crash monitor URL with a synthetic fixture layout, so tests and the demo
// run the real connectors with no network. Every value is made up (series.ts). Configured providers use
// placeholder hosts under the reserved .example domain (fixtureProviders), so the repo holds no real host.
import type { Providers } from "../providers.ts";
import type { Fetch } from "../types.ts";
import { c1Layout, c3Layout, fredLayout, o3Layout, treasuryLayout, e1Layout, worldBankLayout, x4Layout } from "./layouts.ts";

const XLSX_URL = "https://thedocs.worldbank.org/en/doc/fixture/related/CMO-Historical-Data-Monthly.xlsx";
const ok = (bytes: Uint8Array) => ({ status: 200, headers: {}, bytes });
const text = (s: string) => ok(new TextEncoder().encode(s));
const first = (a: { bytes: Uint8Array }[]) => (a[0] as { bytes: Uint8Array }).bytes;

/** A placeholder host per provider code, built from parts: `<code>.provider.example`. */
export const fixtureHost = (code: string) => [code.replace(/[^a-z0-9]/g, ""), "provider", "example"].join(".");
const at = (code: string, path: string) => `https://${fixtureHost(code)}${path}`;

const licence = (id: string, redistribution: boolean) => ({ id, name: `Fixture terms for ${id}`, redistribution, nonCommercial: !redistribution, attributionRequired: true, verifiedOn: "2026-11-19" });
const entry = (code: string, urls: Record<string, string>, redistribution = false) => ({
  hosts: [fixtureHost(code)],
  urls,
  licence: licence(`fixture-${code}`, redistribution),
  termsUrl: at(code, "/terms"),
  attribution: `Fixture attribution for ${code}`,
  homepage: at(code, "/"),
  publisher: `Fixture provider ${code}`,
});

/** A complete provider file for tests and the demo, every host a placeholder. */
export function fixtureProviders(): Providers {
  return {
    x4: entry("x4", { daily: at("x4", "/ohlc/{pair}/?step=86400&limit={limit}&start={start}"), latest: at("x4", "/ohlc/{pair}/?step=300&limit=1") }),
    c1: entry("c1", { global: at("c1", "/global"), ethereum: at("c1", "/coins/markets?ids=ethereum") }),
    c3: entry("c3", { global: at("c3", "/global") }),
    o3: entry("o3", { rpc: at("o3", "/rpc"), tip: at("o3", "/blocks/tip/hash"), block: at("o3", "/block/{hash}") }, true),
    e1: entry("e1", { month: at("e1", "/indices/month") }, true),
    "fred-cited": { ...entry("fredcited", { series: at("fredcited", "/graph.csv?id={id}&cosd={from}") }), series: [
        { id: "FIXTUREJP", rowKey: "M03.X.01:japan", attribution: "Fixture index owner, via the fixture provider" },
        { id: "FIXTUREUSL", rowKey: "M01.X.03:us_large", attribution: "Personal use; fixture index owner's copyright, via the fixture provider; 1-day lag" },
        { id: "FIXTUREUSB", rowKey: "M01.X.03:us_broad", attribution: "Personal use; fixture index owner's copyright, via the fixture provider; 1-day lag" },
        { id: "FIXTUREUST", rowKey: "M01.X.03:us_tech", attribution: "Personal use; fixture index owner's copyright, via the fixture provider; 1-day lag" },
      ],
    },
  };
}

/** The same file as JSON text, as a user would write it. */
export function fixtureProvidersJson(): string {
  return JSON.stringify({ version: 1, providers: fixtureProviders() });
}

type Respond = () => { status: number; headers: Record<string, string>; bytes: Uint8Array } | Promise<never>;

/** `overrides` answer a URL pattern first: tests use them to simulate a refusal, a schema change or an outage. */
export function fakeMarketFetch(overrides: { match: RegExp; respond: Respond }[] = []): Fetch {
  return async (url, init) => {
    for (const o of overrides) if (o.match.test(url)) return o.respond();
    const u = new URL(url);
    if (u.hostname === "api.fiscaldata.treasury.gov") return ok(first(treasuryLayout()));
    if (u.hostname === "fred.stlouisfed.org") return ok(first(fredLayout([u.searchParams.get("id") ?? ""])));
    if (u.hostname === "www.worldbank.org") return text(`<html><a href="${XLSX_URL}">Monthly prices</a></html>`);
    if (u.hostname === "thedocs.worldbank.org") return ok(first(worldBankLayout()));
    if (u.hostname === fixtureHost("x4")) {
      const pair = u.pathname.split("/")[2] ?? "";
      const latest = u.searchParams.get("step") === "300";
      const layout = x4Layout(latest ? "latest" : "daily").find((a) => a.name.startsWith(`${pair}.`));
      return ok(layout?.bytes ?? new TextEncoder().encode('{"data":{"ohlc":[]}}'));
    }
    if (u.hostname === fixtureHost("o3")) {
      if (u.pathname === "/rpc") {
        const method = (JSON.parse(init?.body ?? "{}") as { method?: string }).method;
        return method === "getbestblockhash" ? text(JSON.stringify({ result: "0".repeat(64), error: null, id: 1 })) : ok(first(o3Layout()));
      }
      return { status: 404, headers: {}, bytes: new Uint8Array() };
    }
    if (u.hostname === fixtureHost("c1")) {
      const daily = c1Layout("daily");
      return ok((u.pathname.endsWith("/global") ? daily[0] : daily[1])?.bytes ?? new Uint8Array());
    }
    if (u.hostname === fixtureHost("c3")) return ok(first(c3Layout()));
    if (u.hostname === fixtureHost("e1")) return ok(first(e1Layout()));
    if (u.hostname === fixtureHost("fredcited")) return ok(first(fredLayout([u.searchParams.get("id") ?? ""])));
    return { status: 404, headers: {}, bytes: new Uint8Array() };
  };
}
