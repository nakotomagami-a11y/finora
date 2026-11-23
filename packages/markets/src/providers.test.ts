import { describe, expect, it } from "vitest";
import { fixtureHost, fixtureProviders, fixtureProvidersJson } from "./fixtures/fake-fetch.ts";
import { fillUrl, parseProviders, PROVIDERS_MAX_BYTES } from "./providers.ts";

type Json = Record<string, unknown>;
const file = (mutate: (providers: Json) => void): string => {
  const providers = JSON.parse(JSON.stringify(fixtureProviders())) as Json;
  mutate(providers);
  return JSON.stringify({ version: 1, providers });
};
const x4 = (p: Json) => p.x4 as Json;

describe("the local provider file (H4; qa 7066883380)", () => {
  it("accepts a complete file with placeholder hosts", () => {
    const { providers, problems } = parseProviders(fixtureProvidersJson());
    expect(problems).toEqual([]);
    expect(Object.keys(providers).sort()).toEqual(["c1", "c3", "e1", "fred-cited", "o3", "x4"]);
  });

  const refusals: [string, (p: Json) => void][] = [
    ["a host with a scheme", (p) => void (x4(p).hosts = [`https://${fixtureHost("x4")}`])],
    ["an IP literal host", (p) => void (x4(p).hosts = ["192.0.2.10"])],
    ["localhost", (p) => void (x4(p).hosts = ["localhost"])],
    ["a wildcard host", (p) => void (x4(p).hosts = [`*.${fixtureHost("x4")}`])],
    ["a URL template over http", (p) => void ((x4(p).urls as Json).latest = `http://${fixtureHost("x4")}/ohlc/{pair}/`)],
    ["a URL template on another host", (p) => void ((x4(p).urls as Json).latest = `https://${fixtureHost("c1")}/ohlc/{pair}/`)],
    ["a URL with credentials", (p) => void ((x4(p).urls as Json).latest = `https://user:pw@${fixtureHost("x4")}/x`)],
    ["a terms URL off the entry's hosts", (p) => void (x4(p).termsUrl = `https://${fixtureHost("c1")}/terms`)],
    ["an unknown key in an entry", (p) => void (x4(p).extra = 1)],
    ["an unknown provider code", (p) => void (p.zz = x4(p))],
    ["a missing URL template", (p) => void delete (x4(p).urls as Json).daily],
    ["a missing licence", (p) => void delete x4(p).licence],
    ["a licence without a verified date", (p) => void ((x4(p).licence as Json).verifiedOn = "soon")],
    ["a cited series on an unknown row", (p) => void ((p["fred-cited"] as Json).series = [{ id: "X", rowKey: "M09.X.01:macro", attribution: "a" }])],
    ["a daily US row whose attribution doesn't state personal use (legal 7066891816)", (p) => void ((p["fred-cited"] as Json).series = [{ id: "X", rowKey: "M01.X.03:us_large", attribution: "the owner's copyright, via the fixture provider" }])],
    ...[
      "Not for personal use only. Fixture owner's copyright, via FRED; 1-day lag",
      "not for personal use",
      "Personal use; not for personal use by others",
      "Personal use excluded. Fixture owner's copyright, via FRED; 1-day lag",
      "For personal use. Fixture owner's copyright, via FRED; 1-day lag",
      "For personal use only, Fixture owner's copyright, via FRED; 1-day lag",
      "For personal use only. Fixture owner's copyright, via FRED; 1-day lag. Redistribution permitted.",
      "Redistribution permitted. For personal use only. Fixture owner's copyright, via FRED; 1-day lag",
      "For personal use only. Redistribution permitted. Fixture owner's copyright, via FRED; 1-day lag",
      "For personal use only. Fixture; owner's copyright, via FRED; 1-day lag",
      "Fixture owner's copyright, via FRED; 1-day lag",
      "For personal use only. Fixture owner's copyright, via FRED",
      "For personal use only. 's copyright, via FRED; 1-day lag",
      "For personal use only.",
      "For personal use only. Owner's copyright. Redistribution permitted.",
      "For personal use only. Commercial use allowed",
      "For personal use only. x",
      "For personal use only. Redistribution permitted.",
      "For personal use only. Fixture owner; 1-day lag",
    ].map((attribution): [string, (p: Json) => void] => [`a daily US row whose attribution is "${attribution}" (legal 7070658489)`, (p) => void ((p["fred-cited"] as Json).series = [{ id: "X", rowKey: "M01.X.03:us_large", attribution }])]),
    ["an attribution with a line break (N2)", (p) => void (x4(p).attribution = "first line\nsecond line")],
    ["a publisher with a bidi override (N2)", (p) => void (x4(p).publisher = "Fixture \u202eprovider")],
    ["a licence name with a zero-width mark (N2)", (p) => void ((x4(p).licence as Json).name = "Fixture\u200bterms")],
    ["a cited series attribution with a control character (N2)", (p) => void (((p["fred-cited"] as Json).series as Json[])[0] = { id: "X", rowKey: "M03.X.01:japan", attribution: "owner\u0007" })],
    ["a placeholder in a URL's host (N5)", (p) => void ((x4(p).urls as Json).latest = `https://{pair}.${fixtureHost("x4")}/ohlc/`)],
    ["a placeholder the connector doesn't fill (N5)", (p) => void ((x4(p).urls as Json).latest = `https://${fixtureHost("x4")}/ohlc/{pair}/?k={key}`)],
    ["a placeholder in a template that takes none (N5)", (p) => void (((p.c1 as Json).urls as Json).global = `https://${fixtureHost("c1")}/global?{pair}`)],
    ["two entries with one licence id (N4)", (p) => void (((p.c1 as Json).licence as Json).id = "fixture-x4")],
    ["two cited series on one row", (p) => void ((p["fred-cited"] as Json).series = [{ id: "X", rowKey: "M03.X.01:japan", attribution: "a" }, { id: "Y", rowKey: "M03.X.01:japan", attribution: "b" }])],
  ];
  it.each(refusals)("refuses %s, and then configures nothing at all", (_name, mutate) => {
    const { providers, problems } = parseProviders(file(mutate));
    expect(problems.length).toBeGreaterThan(0);
    expect(providers).toEqual({});
  });

  it("accepts the approved line whatever its case and spacing, with the owner as its only free slot", () => {
    const text = file((p) => void ((p["fred-cited"] as Json).series = [{ id: "X", rowKey: "M01.X.03:us_large", attribution: "for  PERSONAL use only.  Fixture Owner, Inc.'s COPYRIGHT, via fred;  1-day lag" }]));
    expect(parseProviders(text).problems).toEqual([]);
  });

  it("reads __proto__, constructor and toString as unknown codes and never throws (N1)", () => {
    const text = '{"version":1,"providers":{"__proto__":{},"constructor":{},"toString":{}}}';
    const { providers, problems } = parseProviders(text);
    expect(problems).toEqual(["providers.?: unknown provider code", "providers.?: unknown provider code", "providers.?: unknown provider code"]);
    expect(providers).toEqual({});
  });

  it("refuses a licence id that is already a built-in licence (N4)", () => {
    const { providers, problems } = parseProviders(fixtureProvidersJson(), { reservedLicenceIds: ["fixture-c3"] });
    expect(problems).toEqual(["providers.c3.licence.id: already used by a built-in licence or another entry"]);
    expect(providers).toEqual({});
  });

  it("refuses a file over the size cap, a file that is not JSON, and a file without version 1", () => {
    expect(parseProviders("x".repeat(PROVIDERS_MAX_BYTES + 1)).problems).toEqual(["file: too large"]);
    expect(parseProviders("{").problems).toEqual(["file: not JSON"]);
    expect(parseProviders(JSON.stringify({ providers: {} })).problems).toEqual(["file: needs version 1 and a providers object"]);
  });

  it("reports problems by path only, never echoing a value from the file", () => {
    const secretHost = ["secret", "provider", "example"].join(".");
    const { problems } = parseProviders(file((p) => void (x4(p).hosts = [`https://${secretHost}`])));
    expect(problems.join(" ")).not.toContain(secretHost);
  });

  it("fills URL templates with encoded values", () => {
    expect(fillUrl("https://h.example/a/{pair}/?s={start}", { pair: "btc usd", start: 5 })).toBe("https://h.example/a/btc%20usd/?s=5");
  });
});
