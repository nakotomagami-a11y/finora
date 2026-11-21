import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { EMPTY_STATE_KEYS, emptyStateKeys, parsePartG, render } from "./gen-items.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const partG = readFileSync(join(ROOT, "docs/plan/council/01-data.md"), "utf8");

test("Part G gives 156 items with the council's counts", () => {
  const items = parsePartG(partG);
  assert.equal(items.length, 156);
  const count = (call) => items.filter((i) => i.call === call).length;
  assert.deepEqual(
    { show: count("show"), caveat: count("caveat"), later: count("later"), hide: count("hide") },
    { show: 40, caveat: 51, later: 60, hide: 5 },
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
    { id: "S08.EE.01a", section: "S08", country: "ee", call: "show", caveatKey: null, emptyStates: ["CN"], personal: false, accessTier: "open", caveatEn: null },
    {
      id: "M06.X.02",
      section: "M06",
      country: "x",
      call: "caveat",
      caveatKey: "items.M06.X.02.caveat",
      emptyStates: ["NC"],
      personal: false,
      accessTier: "open",
      caveatEn: "personal use",
    },
  ]);
});

test("empty states become keys; quoted copy never yields one", () => {
  assert.deepEqual(emptyStateKeys("needs_purpose; then NP"), ["PURPOSE", "NP"]);
  assert.deepEqual(emptyStateKeys('KEY / "Choose a fund in settings"'), ["KEY"]);
  assert.deepEqual(emptyStateKeys('MANUAL (amount); CN (rating)'), ["MANUAL", "CN"]);
  assert.deepEqual(emptyStateKeys('"Not checked: NC here is copy" / —'), []);
  assert.deepEqual(emptyStateKeys("— (banks only)"), []);
});

test("every item's empty states are EmptyStateKey members, and only purpose-gated items are personal", () => {
  const items = parsePartG(partG);
  for (const item of items) {
    for (const key of item.emptyStates) assert.ok(EMPTY_STATE_KEYS.includes(key), `${item.id}: ${key}`);
    assert.equal(item.accessTier, item.personal ? "purpose" : "open");
  }
  assert.deepEqual(
    items.filter((i) => i.personal).map((i) => i.id),
    ["S03.LT.01", "S03.LV.01", "S03.EE.01", "S03.US.01", "S03.US.02", "S03.US.03", "S04.US.01", "S04.US.02", "S14.US.01"],
  );
});

test("parsing stops at the heading after Part G", () => {
  const md = "## Part G\n| S01.LV.01 | SHOW | - | NP |\n\n## Part H\n| S99.LV.01 | SHOW | - | NP |\n";
  assert.deepEqual(parsePartG(md).map((i) => i.id), ["S01.LV.01"]);
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
