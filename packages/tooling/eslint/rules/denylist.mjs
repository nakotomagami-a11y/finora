// Flags identifiers and strings that the publish guard would block, so a builder learns it at lint
// time instead of at commit. The terms come from the same private sources as the guard and are
// never printed: a report names only the entry number.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { compileDenylist, normalize } from "../../../../scripts/guard/rules.mjs";

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function denylistFile() {
  const root = git(["rev-parse", "--show-toplevel"]);
  if (!root) return null;
  const own = join(root, ".guard", "denylist.txt");
  if (existsSync(own)) return own;
  const common = git(["rev-parse", "--git-common-dir"]);
  if (!common) return null;
  const main = join(dirname(resolve(root, common)), ".guard", "denylist.txt");
  return existsSync(main) ? main : null;
}

let terms;
function loadTerms() {
  if (terms) return terms;
  const sources = [];
  if (process.env.FINORA_GUARD_DENYLIST) sources.push(process.env.FINORA_GUARD_DENYLIST.replace(/,/g, "\n"));
  const file = denylistFile();
  if (file) sources.push(readFileSync(file, "utf8"));
  terms = compileDenylist(sources.join("\n"));
  return terms;
}

export default {
  meta: {
    type: "problem",
    docs: { description: "No name or term from the publish guard's private denylist" },
    messages: {
      denylisted:
        "Denylist entry {{id}} matched; the guard would block this commit. See docs/contributing/publishing-checklist.md.",
    },
    schema: [],
  },
  create(context) {
    const list = loadTerms();
    if (list.length === 0) return {};
    const check = (node, text) => {
      if (!text) return;
      const value = normalize(text);
      const hit = list.find((term) => term.re.test(value));
      if (hit) context.report({ node, messageId: "denylisted", data: { id: String(hit.id) } });
    };
    return {
      Identifier: (node) => check(node, node.name),
      Literal: (node) => typeof node.value === "string" && check(node, node.value),
      TemplateElement: (node) => check(node, node.value.cooked ?? node.value.raw),
      JSXText: (node) => check(node, node.value),
    };
  },
};
