// A file may import a workspace package (@finora/*) only if its own package.json declares it.
// Which edges may be declared at all is checked by scripts/check-deps.mjs against architecture §2.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const manifests = new Map();

function nearestManifest(dir) {
  if (manifests.has(dir)) return manifests.get(dir);
  const file = join(dir, "package.json");
  let found = null;
  if (existsSync(file)) {
    const pkg = JSON.parse(readFileSync(file, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    found = { name: pkg.name, deps: new Set(Object.keys(deps)) };
  } else if (dirname(dir) !== dir) {
    found = nearestManifest(dirname(dir));
  }
  manifests.set(dir, found);
  return found;
}

function workspacePackage(source) {
  if (typeof source !== "string" || !source.startsWith("@finora/")) return null;
  return source.split("/").slice(0, 2).join("/");
}

export default {
  meta: {
    type: "problem",
    docs: { description: "Workspace imports must be declared dependencies (architecture §2)" },
    messages: {
      undeclared:
        "{{target}} is not a dependency of {{owner}}. Declare it in package.json only if architecture §2 allows that edge.",
    },
    schema: [],
  },
  create(context) {
    const manifest = nearestManifest(dirname(context.filename));
    if (!manifest) return {};
    const check = (node) => {
      const target = workspacePackage(node?.value);
      if (!target || target === manifest.name || manifest.deps.has(target)) return;
      context.report({ node, messageId: "undeclared", data: { target, owner: manifest.name } });
    };
    return {
      ImportDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => node.source && check(node.source),
      ImportExpression: (node) => node.source.type === "Literal" && check(node.source),
    };
  },
};
