import { z } from "zod";

/**
 * In a browser the page's Content-Security-Policy has no `unsafe-eval`, and Zod probes for it with `Function("")` when it
 * builds an object schema (the probe is caught, but Firefox logs a CSP error for it). A browser build asks Zod not to
 * compile its fast path, so it never probes. The server keeps the compiled path. This module must run before any schema
 * is built: Zod reads the setting at that moment, so `common.ts` and `index.ts` import it first.
 */
// `globalThis`, not `window`: this package is typed without the DOM library.
if ("window" in globalThis) z.config({ jitless: true });
