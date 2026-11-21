// Each source's raw layout, filled with synthetic series (loaders/markets.md, Fixtures per source).
// The shapes follow the responses measured in research/probes/markets/shapes.py; the values are made up.
import type { RawArtifact } from "../types.ts";
import { writeZip } from "@finora/formats/testing";
import { FIXTURE_TODAY, plantedSeries } from "./series.ts";

const enc = new TextEncoder();
const at = `${FIXTURE_TODAY}T22:00:00Z`;
const a = (name: string, body: string | Uint8Array): RawArtifact => ({ name, bytes: typeof body === "string" ? enc.encode(body) : body, fetchedAt: at });
const epoch = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);

export function treasuryLayout(seed = 1): RawArtifact[] {
  const s = plantedSeries({ seed, calendar: "weekdays", from: "2023-11-01", peak: 30e12, drawdown: 0.05 }).reverse();
  return [a("debt_to_penny.json", JSON.stringify({ data: s.map((o) => ({ record_date: o.date, tot_pub_debt_out_amt: o.value.toFixed(2) })), meta: { "total-count": s.length }, links: {} }))];
}

export function fredLayout(ids: readonly string[], seed = 2): RawArtifact[] {
  return ids.map((id, i) => {
    const quarterly = id.endsWith("Q");
    const s = plantedSeries({ seed: seed + i, calendar: quarterly ? "quarter_end" : "weekdays", from: "2024-12-22", peak: quarterly ? 100_000_000 : 80 });
    const rows = s.map((o, k) => {
      const date = quarterly ? `${o.date.slice(0, 5)}${String(Number(o.date.slice(5, 7)) - 2).padStart(2, "0")}-01` : o.date;
      // Every 40th row is a holiday with no value, as FRED writes it.
      return `${date},${k % 40 === 39 ? "." : o.value}`;
    });
    return a(`${id}.csv`, [`observation_date,${id}`, ...rows].join("\n"));
  });
}

export function twLayout(seed = 3): RawArtifact[] {
  const s = plantedSeries({ seed, calendar: "weekdays", from: "2026-11-01", peak: 25000 });
  const roc = (d: string) => `${Number(d.slice(0, 4)) - 1911}${d.slice(5, 7)}${d.slice(8, 10)}`;
  const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return [a("month.json", JSON.stringify(s.map((o) => ({ Date: roc(o.date), OpeningIndex: fmt(o.value), HighestIndex: fmt(o.value), LowestIndex: fmt(o.value), ClosingIndex: fmt(o.value) }))))];
}

/** A minimal workbook with the measured layout: the "Updated on" line in A4, names in row 5, units in row 6, months from row 7. */
export function worldBankLayout(seed = 4, options: { goldHeader?: string; goldUnit?: string } = {}): RawArtifact[] {
  const s = plantedSeries({ seed, calendar: "month_end", from: "2024-11-01", peak: 2500 });
  const strings = ["World Bank Commodity Price Data (The Pink Sheet)", "Updated on November 03, 2026", "Crude oil, Brent", "($/bbl)", options.goldHeader ?? "Gold", options.goldUnit ?? "($/troy oz)"];
  const si = (t: string) => strings.indexOf(t);
  const cell = (ref: string, v: string | number) => (typeof v === "number" ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="s"><v>${si(v)}</v></c>`);
  const rows = [
    `<row r="1">${cell("A1", strings[0] as string)}</row>`,
    `<row r="4">${cell("A4", strings[1] as string)}</row>`,
    `<row r="5">${cell("B5", strings[2] as string)}${cell("BR5", strings[4] as string)}</row>`,
    `<row r="6">${cell("B6", strings[3] as string)}${cell("BR6", strings[5] as string)}</row>`,
    ...s.map((o, i) => {
      const label = `${o.date.slice(0, 4)}M${o.date.slice(5, 7)}`;
      return `<row r="${7 + i}"><c r="A${7 + i}" t="inlineStr"><is><t>${label}</t></is></c>${cell(`B${7 + i}`, 70)}${i === 2 ? `<c r="BR${7 + i}" t="inlineStr"><is><t>…</t></is></c>` : cell(`BR${7 + i}`, o.value)}</row>`;
    }),
  ];
  const files = new Map<string, Uint8Array>([
    ["xl/workbook.xml", enc.encode(`<workbook xmlns:r="r"><sheets><sheet name="Description" sheetId="1" r:id="rId1"/><sheet name="Monthly Prices" sheetId="2" r:id="rId2"/></sheets></workbook>`)],
    ["xl/_rels/workbook.xml.rels", enc.encode(`<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>`)],
    ["xl/sharedStrings.xml", enc.encode(`<sst>${strings.map((t) => `<si><t>${t.replace(/&/g, "&amp;")}</t></si>`).join("")}</sst>`)],
    ["xl/worksheets/sheet1.xml", enc.encode(`<worksheet><sheetData/></worksheet>`)],
    ["xl/worksheets/sheet2.xml", enc.encode(`<worksheet><sheetData>${rows.join("")}</sheetData></worksheet>`)],
  ]);
  return [a("CMO-Historical-Data-Monthly.xlsx", writeZip([...files].map(([name, data]) => ({ name, data }))))];
}

export function x4Layout(mode: "daily" | "latest", seed = 7): RawArtifact[] {
  return (["btcusd", "ethusd"] as const).map((pair, i) => {
    const s = plantedSeries({ seed: seed + i, calendar: "all", from: "2024-12-22", peak: i === 0 ? 100_000 : 4_000 });
    const rows = mode === "latest" ? [s.at(-1) as { date: string; value: number }] : s;
    const ohlc = rows.map((o) => ({ timestamp: String(mode === "latest" ? epoch(o.date) + 79_200 : epoch(o.date)), open: String(o.value), high: String(o.value), low: String(o.value), close: String(o.value), volume: "1.0" }));
    return a(mode === "latest" ? `${pair}.latest.json` : `${pair}.daily.0.json`, JSON.stringify({ data: { pair: pair.toUpperCase(), ohlc } }));
  });
}

export function o3Layout(height = 976_000): RawArtifact[] {
  return [a("header.json", JSON.stringify({ result: { hash: "0".repeat(64), height, time: epoch(FIXTURE_TODAY) + 79_200, mediantime: epoch(FIXTURE_TODAY) }, error: null, id: 1 }))];
}

export function c1Layout(mode: "daily" | "latest", totalCap = 3.0e12): RawArtifact[] {
  const out = [a("global.json", JSON.stringify({ data: { active_cryptocurrencies: 100, total_market_cap: { usd: totalCap }, market_cap_change_percentage_24h_usd: -1, updated_at: epoch(FIXTURE_TODAY) + 79_200 } }))];
  if (mode === "daily") out.push(a("markets.json", JSON.stringify([{ id: "ethereum", symbol: "eth", circulating_supply: 120_000_000, last_updated: `${FIXTURE_TODAY}T21:59:00.000Z` }])));
  return out;
}

export function c3Layout(athValue = 4.0e12): RawArtifact[] {
  return [a("global.json", JSON.stringify({ market_cap_usd: 3e12, market_cap_ath_value: athValue, market_cap_ath_date: "2025-10-06T00:00:00Z", last_updated: epoch(FIXTURE_TODAY) + 79_000 }))];
}
