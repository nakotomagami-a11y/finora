// Company search over the stored registers (architecture §3.8, §6). People are never indexed:
// natural persons and sole traders are found by registry code only (L2, L3).
import type { DatabaseSync } from "node:sqlite";
import { normalizeText } from "@finora/domain";
import { IDENTIFIER_INDEX_WHERE, IDENTIFIER_PROPS } from "./migrations.ts";

export type MatchKind = "code" | "prefix" | "substring" | "fuzzy";
export type SearchHit = {
  eid: string;
  caption: string;
  country: string;
  legalForm: string | null;
  status: string | null;
  code: string | null;
  match: MatchKind;
  score: number;
};

const TIER: Record<MatchKind, number> = { code: 0, prefix: 1, substring: 2, fuzzy: 3 };
const FUZZY_MIN_OVERLAP = 0.5;

const quote = (token: string) => `"${token.replaceAll('"', '""')}"`;

function trigrams(text: string): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i + 3 <= text.length; i++) grams.add(text.slice(i, i + 3));
  return grams;
}

export function searchCompanies(db: DatabaseSync, query: string, options: { country?: string; limit?: number } = {}): SearchHit[] {
  const limit = options.limit ?? 20;
  const q = normalizeText(query);
  if (!q) return [];
  const found = new Map<number, { match: MatchKind; score: number }>();
  const add = (id: number, match: MatchKind, score: number) => {
    const prev = found.get(id);
    if (!prev || TIER[match] < TIER[prev.match] || (TIER[match] === TIER[prev.match] && score > prev.score)) {
      found.set(id, { match, score });
    }
  };

  const code = query.replace(/[\s-]/g, "");
  if (/^\d{4,}$/.test(code)) {
    for (const row of db
      .prepare(
        `SELECT e.id FROM main.entities e JOIN main.schemas s ON s.id = e.schema_id
         WHERE e.code = ? AND s.name <> 'Person'`,
      )
      .all(code) as { id: number }[]) {
      add(row.id, "code", 1);
    }
  }

  const tokens = q.split(" ").filter(Boolean);
  const prefixQuery = tokens.map((t) => `${quote(t)}*`).join(" ");
  for (const row of db
    .prepare("SELECT rowid AS id, bm25(entities_fts) AS rank FROM main.entities_fts WHERE entities_fts MATCH ? ORDER BY rank LIMIT 200")
    .all(prefixQuery) as { id: number; rank: number }[]) {
    add(row.id, "prefix", -row.rank);
  }

  if (q.length >= 3) {
    for (const row of db
      .prepare("SELECT rowid AS id FROM main.entities_trigram WHERE entities_trigram MATCH ? LIMIT 200")
      .all(quote(q)) as { id: number }[]) {
      add(row.id, "substring", 1);
    }
    const grams = trigrams(q);
    const anyGram = [...grams].map(quote).join(" OR ");
    for (const row of db
      .prepare("SELECT rowid AS id, search_text FROM main.entities_trigram WHERE entities_trigram MATCH ? LIMIT 500")
      .all(anyGram) as { id: number; search_text: string }[]) {
      const have = trigrams(row.search_text);
      let shared = 0;
      for (const g of grams) if (have.has(g)) shared++;
      const overlap = shared / grams.size;
      if (overlap >= FUZZY_MIN_OVERLAP) add(row.id, "fuzzy", overlap);
    }
  }

  if (found.size === 0) return [];
  const ids = [...found.keys()];
  const rows = db
    .prepare(
      `SELECT id, eid, caption, country, legal_form, status, code FROM main.entities
       WHERE id IN (${ids.map(() => "?").join(", ")})${options.country ? " AND country = ?" : ""}`,
    )
    .all(...ids, ...(options.country ? [options.country] : [])) as {
    id: number; eid: string; caption: string; country: string; legal_form: string | null; status: string | null; code: string | null;
  }[];
  return rows
    .map((r) => {
      const hit = found.get(r.id)!;
      return { eid: r.eid, caption: r.caption, country: r.country, legalForm: r.legal_form, status: r.status, code: r.code, match: hit.match, score: hit.score };
    })
    .sort((a, b) => TIER[a.match] - TIER[b.match] || b.score - a.score || a.caption.localeCompare(b.caption) || a.eid.localeCompare(b.eid))
    .slice(0, limit);
}

/**
 * Companies holding an identifier value (LEI, VAT, CIK, ...). The query repeats the partial
 * index's own predicate, which is the only way SQLite will use it. Never returns a person or a sanctions list entry.
 */
export function findByIdentifier(db: DatabaseSync, prop: keyof typeof IDENTIFIER_PROPS, value: string): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT e.eid FROM main.statements st
       JOIN main.entities e ON e.id = st.entity_id JOIN main.schemas s ON s.id = e.schema_id
       WHERE st.prop_id = ? AND st.value = ? AND ${IDENTIFIER_INDEX_WHERE} AND s.name <> 'Person' AND e.eid NOT LIKE 'sanc-%'
       ORDER BY e.eid`,
    )
    .all(IDENTIFIER_PROPS[prop], value) as { eid: string }[];
  return rows.map((r) => r.eid);
}
