import "server-only";

// The render seam: read functions for server components. They return the same DTOs as the API routes,
// so a page and a client of the API see one contract and there is no HTTP hop.
export { getAbout } from "./services/about.ts";
export { getHealth } from "./services/health.ts";
