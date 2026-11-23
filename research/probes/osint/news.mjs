// News probe: the news dataset P4's article search (rolling 3 months, no key, one request per 5
// seconds). Its endpoint comes from the local provider map (providers.mjs, C15).
// Returns article counts, languages and source countries for a company name, never article text.

import { fetchJson, sleep } from "./lib.mjs";
import { provider } from "./providers.mjs";
import { normalise } from "./sanctions.mjs";

let last = 0;
const GAP_MS = Number(process.env.NEWS_GAP_MS ?? 6000);

/** The display name an agent would search for: the register name without legal-form words or quotes. */
export function searchName(name) {
  const quoted = name.match(/["“„]([^"”“]+)["”“]/);
  const core = quoted ? quoted[1] : name;
  const words = core.split(/\s+/).filter((w) => normalise(w) !== "" || /\d/.test(w));
  return words.join(" ").replace(/[^\p{L}\p{N}&.\- ]/gu, "").trim();
}

export async function newsSearch(name, { attempts = 3 } = {}) {
  const phrase = searchName(name);
  if (phrase.length < 4) return { ok: false, ms: 0, bytes: 0, error: "name too short to search", phrase };
  const url = provider("P4").replaceAll("{query}", encodeURIComponent(`"${phrase}"`));
  for (let i = 0; i < attempts; i++) {
    const wait = last + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const r = await fetchJson(url, { timeoutMs: 45000 });
    if (r.ok && r.json) {
      const arts = r.json.articles ?? [];
      return {
        ok: true, ms: r.ms, bytes: r.bytes, phrase,
        articles: arts.length,
        languages: [...new Set(arts.map((a) => a.language))],
        countries: [...new Set(arts.map((a) => a.sourcecountry))],
        domains: new Set(arts.map((a) => a.domain)).size,
      };
    }
    if (!/limit requests/i.test(r.text) && r.status !== 429) return { ok: false, ms: r.ms, bytes: r.bytes, phrase, error: r.error ?? `http ${r.status}` };
    await sleep(GAP_MS * (i + 2));
  }
  return { ok: false, ms: 0, bytes: 0, phrase, error: "rate-limited" };
}
