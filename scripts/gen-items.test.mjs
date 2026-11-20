import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parsePartG, render } from "./gen-items.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const partG = readFileSync(join(ROOT, "docs/plan/council/01-data.md"), "utf8");

test("Part G gives 155 items with the council's counts", () => {
  const items = parsePartG(partG);
  assert.equal(items.length, 155);
  const count = (call) => items.filter((i) => i.call === call).length;
  assert.deepEqual(
    { show: count("show"), caveat: count("caveat"), later: count("later"), hide: count("hide") },
    { show: 41, caveat: 56, later: 53, hide: 5 },
  );
});

test("a label in brackets after an id is stripped", () => {
  const ids = parsePartG(partG).map((i) => i.id);
  assert.ok(ids.includes("S01.US.03a"));
  assert.ok(ids.every((id) => !/[()\s]/.test(id)));
});

test("section and country come from the id", () => {
  const md = "## Part G\n| item_id | call | caveat text | empty-state |\n|---|---|---|---|\n| S08.EE.01a (tax debtors) | SHOW | - | CN |\n| M06.X.02 | CAVEAT | personal use | NC |\n";
  assert.deepEqual(parsePartG(md), [
    { id: "S08.EE.01a", section: "S08", country: "ee", call: "show", caveat: null, emptyState: "CN" },
    { id: "M06.X.02", section: "M06", country: "x", call: "caveat", caveat: "personal use", emptyState: "NC" },
  ]);
});

test("a duplicate id or an unknown call is refused", () => {
  const head = "## Part G\n";
  assert.throws(() => parsePartG(`${head}| S01.LV.01 | SHOW | - | NP |\n| S01.LV.01 | SHOW | - | NP |\n`), /twice/);
  assert.throws(() => parsePartG(`${head}| S01.LV.01 | MAYBE | - | NP |\n`), /unknown call/);
});

test("the committed file is current", () => {
  const committed = readFileSync(join(ROOT, "packages/domain/src/items/items.generated.ts"), "utf8");
  assert.equal(committed, render(parsePartG(partG)));
});
