import "server-only";

export async function register(): Promise<void> {
  const { boot } = await import("@finora/server");
  boot();
}
