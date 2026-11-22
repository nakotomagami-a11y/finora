#!/usr/bin/env node
// finora-cli: `data sync`, `data status`, `search`, `show`, `resolve --sanctions` (S06), `doctor`, `backup` (S04f).
import { backup, dataStatus, dataSync, doctor, resolveSanctions, search, show, type Io } from "./commands.ts";
import { loadCliEnv } from "./env.ts";

const USAGE = `usage: finora-cli <command>
  data sync [source] [--profile fixtures|core] [--country lv|ee|lt|us] [--allow-mass-purge]
  data status
  search <query> [--country lv|ee|lt|us]
  show <eid>
  resolve --sanctions <name|eid>
  doctor
  backup`;

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(argv: string[]): Promise<number> {
  const io: Io = { env: loadCliEnv(), out: (line) => process.stdout.write(`${line}\n`) };
  const [command, sub, ...rest] = argv;
  if (command === "data" && sub === "sync") {
    const source = rest.find((a, i) => !a.startsWith("--") && rest[i - 1] !== "--profile" && rest[i - 1] !== "--country");
    const country = flag(rest, "--country");
    return dataSync(io, { profile: flag(rest, "--profile") ?? "core", ...(source ? { source } : {}), ...(country ? { country } : {}), allowMassPurge: rest.includes("--allow-mass-purge") });
  }
  if (command === "data" && sub === "status") return dataStatus(io);
  if (command === "search" && sub) {
    const words = [sub, ...rest.filter((a, i) => a !== "--country" && rest[i - 1] !== "--country")];
    return search(io, words.join(" "), flag(rest, "--country"));
  }
  if (command === "show" && sub) return show(io, sub);
  if (command === "resolve" && sub === "--sanctions" && rest.length > 0) return resolveSanctions(io, rest.join(" "));
  if (command === "doctor") return doctor(io);
  if (command === "backup") return backup(io);
  process.stderr.write(`${USAGE}\n`);
  return 2;
}

process.exitCode = await main(process.argv.slice(2));
