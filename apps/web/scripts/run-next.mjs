#!/usr/bin/env node
// Starts Next.js bound to 127.0.0.1 on FINORA_PORT (default 3000): Finora v1 is local and single-user.
// Usage: node scripts/run-next.mjs dev | start

import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const command = process.argv[2];
if (command !== "dev" && command !== "start") {
  console.error("usage: run-next.mjs dev|start");
  process.exit(2);
}

const port = process.env.FINORA_PORT && process.env.FINORA_PORT !== "" ? process.env.FINORA_PORT : "3000";
if (!/^\d+$/u.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error(`Invalid environment: FINORA_PORT: "${port}" is not a port number`);
  process.exit(1);
}

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, command, "--hostname", "127.0.0.1", "--port", port], {
  stdio: "inherit",
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
