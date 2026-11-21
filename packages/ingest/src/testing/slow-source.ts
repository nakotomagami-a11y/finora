// A slow fake source for the concurrency test: a worker thread imports it by module URL.
import { companies, fakeSource } from "./fake-source.ts";

export const slowSource = fakeSource({ id: "fake-slow" }, { records: companies(1, 40), delayMs: 15 });
