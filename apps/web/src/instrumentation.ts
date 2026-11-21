import "server-only";

/**
 * Starts the server side once, in the Node.js runtime only. Next.js compiles this file for the Edge runtime as
 * well, and the server package (SQLite, workers) cannot load there. `process.env.NEXT_RUNTIME` is the one
 * environment read outside `env.ts`: Next.js replaces that exact expression at build time, so it cannot go
 * through a helper (the lint rule allows this file for it, and for nothing else).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { boot } = await import("@finora/server");
  boot();
}
