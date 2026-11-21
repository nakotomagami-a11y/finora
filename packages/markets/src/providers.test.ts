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
    ["two cited series on one row", (p) => void ((p["fred-cited"] as Json).series = [{ id: "X", rowKey: "M03.X.01:japan", attribution: "a" }, { id: "Y", rowKey: "M03.X.01:japan", attribution: "b" }])],
  ];
  it.each(refusals)("refuses %s, and then configures nothing at all", (_name, mutate) => {
    const { providers, problems } = parseProviders(file(mutate));
    expect(problems.length).toBeGreaterThan(0);
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
