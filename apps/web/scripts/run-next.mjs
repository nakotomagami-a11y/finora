#!/usr/bin/env node
// Runs Next.js for Finora: `dev`, `build` and `start`, with an environment that does not depend on the
// shell it was started from. `dev` and `start` bind to 127.0.0.1 on FINORA_PORT (default 3000), because v1 is
// local and single-user.
//
// Usage: node scripts/run-next.mjs dev | build | start

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const NODE_ENV_FOR = { dev: "development", build: "production", start: "production" };

/**
 * The environment Next.js runs in. `NODE_ENV` is set per command and replaces whatever the shell had: an inherited
 * `development` would serve the relaxed development policy from a production server, and an inherited
 * `production` would break `dev`. Next.js internals another app leaked into the shell (`__NEXT_PRIVATE_*`) are
 * removed, because they point Next.js at that other app's folders.
 */
export function childEnv(command, env) {
  const clean = Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith("__NEXT_PRIVATE_")));
  return { ...clean, NODE_ENV: NODE_ENV_FOR[command] };
}

/** The arguments after the Next.js command: the local address for `dev` and `start`, none for `build`. */
export function childArgs(command, env) {
  if (command === "build") return [];
  const port = env.FINORA_PORT && env.FINORA_PORT !== "" ? env.FINORA_PORT : "3000";
  if (!/^\d+$/u.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error(`Invalid environment: FINORA_PORT: "${port}" is not a port number`);
  }
  return ["--hostname", "127.0.0.1", "--port", port];
}

function main() {
  const command = process.argv[2];
  if (!(command in NODE_ENV_FOR)) {
    console.error("usage: run-next.mjs dev|build|start");
    process.exit(2);
  }
  let args;
  try {
    args = childArgs(command, process.env);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, command, ...args], { stdio: "inherit", env: childEnv(command, process.env) });
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
