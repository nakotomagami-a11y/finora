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
 * What the Next.js child may inherit. A list of what is wanted, not of what is feared: a shell can carry the
 * internals of another app (`__NEXT_PRIVATE_*`, `NEXT_RUNTIME`, `NEXT_DEPLOYMENT_ID`, `PORT`, `HOSTNAME`,
 * `TURBOPACK`) that point Next.js at that app's folders, and a denylist would need a new entry for each. Names
 * are matched ignoring case, because Windows does. Finora's own settings and the contact header pass.
 */
const INHERITED = [
  // Finora's own settings, the contact header, and the public prefix Next.js inlines. v1 has no API keys (H5):
  // none is passed, so a key left in the shell never reaches the server.
  /^FINORA_/iu,
  /^NEXT_PUBLIC_/iu,
  /^SEC_USER_AGENT$/iu,
  /^NEXT_TELEMETRY_DISABLED$/iu,
  // What a process needs to run and to find things, on Windows, macOS and Linux.
  /^(?:PATH|PATHEXT|HOME|HOMEDRIVE|HOMEPATH|USER|USERNAME|USERDOMAIN|USERPROFILE|LOGNAME|SHELL|TMP|TEMP|TMPDIR)$/iu,
  /^(?:SYSTEMROOT|SYSTEMDRIVE|WINDIR|COMSPEC|OS|COMPUTERNAME|NUMBER_OF_PROCESSORS|PROCESSOR_\w+)$/iu,
  /^(?:APPDATA|LOCALAPPDATA|PROGRAMDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMW6432|COMMONPROGRAMFILES|COMMONPROGRAMFILES\(X86\))$/iu,
  /^(?:LANG|LANGUAGE|LC_\w+|TZ|TERM|COLORTERM|NO_COLOR|FORCE_COLOR|CI)$/iu,
  // Node.js and the network.
  /^(?:NODE_OPTIONS|NODE_EXTRA_CA_CERTS|SSL_CERT_FILE|SSL_CERT_DIR|HTTP_PROXY|HTTPS_PROXY|NO_PROXY)$/iu,
];

/**
 * The environment Next.js runs in. `NODE_ENV` is set per command and replaces whatever the shell had: an inherited
 * `development` would serve the relaxed development policy from a production server, and an inherited
 * `production` would break `dev`. Everything the list above does not name is left behind.
 */
export function childEnv(command, env) {
  const kept = Object.fromEntries(Object.entries(env).filter(([name]) => name !== "NODE_ENV" && INHERITED.some((pattern) => pattern.test(name))));
  return { ...kept, NODE_ENV: NODE_ENV_FOR[command] };
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
