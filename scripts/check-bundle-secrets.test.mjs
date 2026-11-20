import assert from "node:assert/strict";
import { test } from "node:test";
import { SECRET_NAMES, findLeaks, sentinelFor } from "./check-bundle-secrets.mjs";

const sentinels = Object.fromEntries(SECRET_NAMES.map((name) => [name, sentinelFor(name)]));

test("a clean bundle has no leak", () => {
  const files = [{ path: "apps/web/.next/static/chunks/a.js", text: "console.log('hello')" }];
  assert.deepEqual(findLeaks(files, sentinels), []);
});

test("a sentinel value in a client chunk is caught, by variable name and file", () => {
  const files = [{ path: "apps/web/.next/static/chunks/a.js", text: `fetch("/x",{headers:{k:"${sentinels.ANTHROPIC_API_KEY}"}})` }];
  const leaks = findLeaks(files, sentinels);
  assert.equal(leaks.length, 1);
  assert.match(leaks[0], /ANTHROPIC_API_KEY/u);
  assert.match(leaks[0], /a\.js/u);
});

test("the message never repeats the secret value", () => {
  const files = [{ path: "x.js", text: sentinels.SEC_USER_AGENT }];
  for (const leak of findLeaks(files, sentinels)) assert.ok(!leak.includes(sentinels.SEC_USER_AGENT));
});

test("a planted NEXT_PUBLIC_ copy of a secret name is caught even without its value", () => {
  const files = [{ path: "b.js", text: "process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY" }];
  const leaks = findLeaks(files, sentinels);
  assert.equal(leaks.length, 1);
  assert.match(leaks[0], /NEXT_PUBLIC_ANTHROPIC_API_KEY/u);
});

test("every secret name has a distinct sentinel", () => {
  assert.equal(new Set(Object.values(sentinels)).size, SECRET_NAMES.length);
});
