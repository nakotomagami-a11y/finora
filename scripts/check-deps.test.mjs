import assert from "node:assert/strict";
import { test } from "node:test";
import { checkManifests, workspaceManifests } from "./check-deps.mjs";

const pkg = (name, deps = {}, extra = {}) => ({
  path: `${name}/package.json`,
  pkg: { name, private: true, license: "AGPL-3.0-or-later", dependencies: deps, ...extra },
});

test("an allowed edge passes", () => {
  assert.deepEqual(checkManifests([pkg("@finora/store", { "@finora/domain": "workspace:*" })]), []);
});

test("a forbidden edge fails", () => {
  const problems = checkManifests([pkg("@finora/domain", { "@finora/store": "workspace:*" })]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /@finora\/domain may not depend on @finora\/store/);
});

test("a forbidden edge in devDependencies fails too", () => {
  const manifest = pkg("@finora/web", {}, { devDependencies: { "@finora/store": "workspace:*" } });
  assert.match(checkManifests([manifest])[0], /may not depend on @finora\/store/);
});

test("@finora/tooling as a dev dependency and third-party packages are always allowed", () => {
  const manifest = pkg("@finora/domain", { zod: "^4" }, { devDependencies: { "@finora/tooling": "workspace:*" } });
  assert.deepEqual(checkManifests([manifest]), []);
});

test("@finora/tooling as a runtime dependency fails", () => {
  const [problem] = checkManifests([pkg("@finora/domain", { "@finora/tooling": "workspace:*" })]);
  assert.match(problem, /@finora\/tooling is a dev dependency only/);
});

test("a package missing from the table fails", () => {
  assert.match(checkManifests([pkg("@finora/mystery")])[0], /not in the dependency table/);
});

test("licence and private are required", () => {
  const problems = checkManifests([pkg("@finora/domain", {}, { license: "MIT", private: false })]);
  assert.equal(problems.length, 2);
});

test("the workspace itself passes", () => {
  assert.deepEqual(checkManifests(workspaceManifests()), []);
});
