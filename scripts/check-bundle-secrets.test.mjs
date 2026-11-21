import assert from "node:assert/strict";
import { test } from "node:test";
import { SECRET_NAMES, findLeaks, sentinelFor } from "./check-bundle-secrets.mjs";

const sentinels = Object.fromEntries(SECRET_NAMES.map((name) => [name, sentinelFor(name)]));
// The checker takes any set of names, so the cases below use two invented ones.
const two = { EXAMPLE_ONE: sentinelFor("EXAMPLE_ONE"), EXAMPLE_TWO: sentinelFor("EXAMPLE_TWO") };

test("v1 has no API key to guard, only the contact header", () => {
  assert.deepEqual(SECRET_NAMES, ["SEC_USER_AGENT"]);
});

test("a clean bundle has no leak", () => {
  const files = [{ path: "apps/web/.next/static/chunks/a.js", text: "console.log('hello')" }];
  assert.deepEqual(findLeaks(files, sentinels), []);
});

test("a sentinel value in a client chunk is caught, by variable name and file", () => {
  const files = [{ path: "apps/web/.next/static/chunks/a.js", text: `fetch("/x",{headers:{k:"${two.EXAMPLE_ONE}"}})` }];
  const leaks = findLeaks(files, two);
  assert.equal(leaks.length, 1);
  assert.match(leaks[0], /EXAMPLE_ONE/u);
  assert.match(leaks[0], /a\.js/u);
});

test("the message never repeats the secret value", () => {
  const files = [{ path: "x.js", text: sentinels.SEC_USER_AGENT }];
  const leaks = findLeaks(files, sentinels);
  assert.equal(leaks.length, 1);
  for (const leak of leaks) assert.ok(!leak.includes(sentinels.SEC_USER_AGENT));
});

test("a planted NEXT_PUBLIC_ copy of a secret name is caught even without its value", () => {
  const files = [{ path: "b.js", text: "process.env.NEXT_PUBLIC_SEC_USER_AGENT" }];
  const leaks = findLeaks(files, sentinels);
  assert.equal(leaks.length, 1);
  assert.match(leaks[0], /NEXT_PUBLIC_SEC_USER_AGENT/u);
});

test("every secret name has a distinct sentinel", () => {
  assert.equal(new Set(Object.values(two)).size, 2);
});
