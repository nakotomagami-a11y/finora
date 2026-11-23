"use client";

import type { CrashResponse, InvestigationSnapshot } from "@finora/api-contract";
import { Badge, StatusPill, Table, Td, Th, UsageMeter, type IconName, type Tone } from "@finora/ui";
import type { ReactNode } from "react";
import { describeShare, formatTime, formatTokens, meterParts, usageShare } from "../../lib/format.ts";
import { fromSnapshot, isActive, type InvestigationState } from "../../lib/investigation-reducer.ts";

/** Status is an icon and a word, never colour alone. */
const STATUS: Record<string, { tone: Tone; icon: IconName }> = {
  queued: { tone: "muted", icon: "clock" },
  planning: { tone: "info", icon: "clock" },
  running: { tone: "info", icon: "play" },
  synthesising: { tone: "info", icon: "play" },
  waiting: { tone: "warn", icon: "hand" },
  paused: { tone: "warn", icon: "stop" },
  done: { tone: "good", icon: "check" },
  failed: { tone: "bad", icon: "close" },
  stopped: { tone: "muted", icon: "stop" },
  budget_exceeded: { tone: "warn", icon: "warn" },
};
const statusOf = (status: string) => STATUS[status] ?? { tone: "neutral" as Tone, icon: "dot" as IconName };

/** English count words for the gallery only; the real screens use the catalogue's ICU plurals. */
function plural(count: number, one: string, other: string): string {
  return `${count} ${count === 1 ? one : other}`;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <h2 className="font-serif text-h2 text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Investigation({ snapshot }: { snapshot: InvestigationSnapshot }) {
  const state: InvestigationState = fromSnapshot(snapshot, "live");
  const settled = !isActive(state.status);
  const parts = meterParts(state.usage, settled);
  const share = usageShare(state.usage, settled);
  // DESIGN.md §9.4: running reads "held for running work"; settled leaves the held part out; under 1% says so.
  const shareText = share.underOne ? "Under 1%" : describeShare("en", share, "under 1%");
  const meterText = `${shareText} of the cap: ${formatTokens("en", state.usage.used)} used, ${settled ? "" : `${formatTokens("en", state.usage.held)} held for running work, `}cap ${formatTokens("en", state.usage.cap)} standard tokens`;
  const pending = Object.values(state.questions).filter((question) => question.answer === undefined);
  return (
    <>
      <Card title="Investigation">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill {...statusOf(state.status)}>{state.status}</StatusPill>
          {state.code ? <Badge tone="warn">{state.code}</Badge> : null}
          {state.resetsAt ? <span className="text-small text-muted">resumes after {formatTime("en", state.resetsAt, "UTC")} UTC</span> : null}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-small text-ink-2">
            {describeShare("en", share, "under 1%")} of the cap · {formatTokens("en", state.usage.used)} used, {formatTokens("en", state.usage.held)} held, cap {formatTokens("en", state.usage.cap)} standard tokens
          </p>
          <UsageMeter label="Usage of this investigation's cap" solid={parts.solid} band={parts.band} valueText={meterText} />
        </div>
      </Card>
      <Card title="Lanes">
        <Table label="Lanes" caption="One row per agent run">
          <thead>
            <tr>
              <Th>Agent</Th>
              <Th>Status</Th>
              <Th>Step</Th>
              <Th className="text-right">Sources</Th>
              <Th className="text-right">Usage</Th>
            </tr>
          </thead>
          <tbody>
            {state.order.map((id) => {
              const run = state.runs[id];
              if (!run) return null;
              const runShare = usageShare(run.usage, settled);
              return (
                <tr key={id}>
                  <Td>{run.role}</Td>
                  <Td>
                    <StatusPill {...statusOf(run.status)}>{run.waitingOn ? `waiting: ${run.waitingOn}` : run.status}</StatusPill>
                  </Td>
                  <Td className="font-mono text-mono text-muted">{run.stepKey ?? "-"}</Td>
                  <Td numeric>{run.sourcesRead}</Td>
                  <Td numeric>{describeShare("en", runShare, "under 1%")}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Card title="Findings, questions and verdict">
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-body text-ink-2">
          <li>{plural(Object.keys(state.findings).length, "finding", "findings")}, each AI-written and cited</li>
          <li>{pending.length === 0 ? "No question is waiting" : `Waiting for you: ${pending.map((question) => question.kind).join(", ")}`}</li>
          <li>{state.verdict ? `Verdict: ${state.verdict.level.replaceAll("_", " ")}, ${state.verdict.coverage.ran} of ${state.verdict.coverage.total} checks ran` : "No verdict yet"}</li>
        </ul>
      </Card>
    </>
  );
}

function Crash({ response }: { response: CrashResponse }) {
  return (
    <Card title="Markets">
      <Table label="Markets" caption="One row per market">
        <thead>
          <tr>
            <Th>Market</Th>
            <Th>State</Th>
            <Th className="text-right">Drawdown</Th>
            <Th>Source line</Th>
          </tr>
        </thead>
        <tbody>
          {response.tiles.flatMap((tile) =>
            tile.rows.map((row) => (
              <tr key={row.rowKey}>
                <Td>{row.label}</Td>
                <Td>
                  <StatusPill tone={row.state === "ok" ? "good" : row.state === "error" ? "bad" : "muted"} icon={row.state === "ok" ? "check" : row.state === "error" ? "warn" : row.state === "not_configured" ? "settings" : "clock"}>{row.state.replaceAll("_", " ")}</StatusPill>
                </Td>
                <Td numeric>{row.drawdownPct === undefined ? "none" : `${row.drawdownPct}%`}</Td>
                <Td>{row.state === "not_configured" ? "Not configured: add this provider to your local provider file" : (row.attribution ?? "-")}</Td>
              </tr>
            )),
          )}
        </tbody>
      </Table>
    </Card>
  );
}

/** One fixture, drawn from the same reducer and formatters the real screens use. Other screens show their data as text for now. */
export function FixtureView({ screen, data }: { screen: string; data: unknown }) {
  if (screen === "investigation") return <Investigation snapshot={data as InvestigationSnapshot} />;
  if (screen === "crash") return <Crash response={data as CrashResponse} />;
  return (
    <Card title={screen}>
      <pre tabIndex={0} aria-label={`${screen} data`} className="m-0 max-h-[480px] overflow-auto rounded-chip bg-surface-2 p-3 font-mono text-mono text-ink-2">{JSON.stringify(data, null, 2)}</pre>
    </Card>
  );
}
