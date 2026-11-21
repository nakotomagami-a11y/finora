// Downloads the three Baltic company files the store benchmarks read, into research/.cache/cto/.
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { CACHE_DIR, cachePath, seconds, unzipFirstEntry } from "./lib.mjs";

const FILES = [
  {
    country: "LV",
    url: "https://data.gov.lv/dati/dataset/4de9697f-850b-45ec-8bba-61fa09ce932f/resource/25e80bf3-f107-4ab4-89ef-251b5b9374e9/download/register.csv",
    file: "lv_register.csv",
  },
  {
    country: "EE",
    url: "https://avaandmed.ariregister.rik.ee/sites/default/files/avaandmed/ettevotja_rekvisiidid__lihtandmed.csv.zip",
    file: "ee_lihtandmed.csv.zip",
    unzipTo: "ee_lihtandmed.csv",
  },
  {
    country: "LT",
    url: "https://get.data.gov.lt/datasets/gov/rc/jar/iregistruoti/JuridinisAsmuo/:format/csv",
    file: "lt_ja.csv",
  },
];

mkdirSync(CACHE_DIR, { recursive: true });
for (const { country, url, file, unzipTo } of FILES) {
  const started = performance.now();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${country}: HTTP ${response.status} for ${url}`);
  writeFileSync(cachePath(file), Buffer.from(await response.arrayBuffer()));
  if (unzipTo) unzipFirstEntry(cachePath(file), cachePath(unzipTo));
  console.log(JSON.stringify({
    country,
    bytes: statSync(cachePath(file)).size,
    seconds: seconds(started),
    lastModified: response.headers.get("last-modified"),
    etag: response.headers.get("etag"),
  }));
}
