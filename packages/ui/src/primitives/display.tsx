import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../cn.ts";
import { Icon, type IconName } from "./icon.tsx";

export type Tone = "neutral" | "info" | "warn" | "bad" | "good" | "muted";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-ink",
  info: "text-info",
  warn: "text-warn",
  bad: "text-bad",
  good: "text-good",
  muted: "text-muted",
};

const TONE_FILL: Record<Tone, string> = {
  neutral: "bg-surface-2",
  info: "bg-info-tint",
  warn: "bg-warn-tint",
  bad: "bg-bad-tint",
  good: "bg-good-tint",
  muted: "bg-surface-2",
};

/** A block the size of a typical value while data loads. It is not announced. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-shimmer rounded-chip bg-surface-2", className)} />;
}

/** A small label for a kind of thing ("Rule-based", "AI-written"). Text only; use `StatusPill` for a state. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-chip border border-line px-1.5 text-label font-medium tracking-[0.08em] uppercase",
        TONE_FILL[tone],
        TONE_TEXT[tone],
      )}
    >
      {children}
    </span>
  );
}

type StatusPillProps = {
  tone?: Tone;
  /** A status is never carried by colour alone: the icon is required. */
  icon: IconName;
  children: ReactNode;
};

export function StatusPill({ tone = "neutral", icon, children }: StatusPillProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-small font-medium", TONE_FILL[tone], TONE_TEXT[tone])}>
      <Icon name={icon} className="size-3.5" />
      {children}
    </span>
  );
}

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  selected?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

/**
 * The mono chip used by source chips and filters. It is a button when it has an action, or when it is the
 * trigger of a popover; otherwise a plain label.
 */
export function Chip({ children, selected, className, ref, onClick, ...rest }: ChipProps) {
  const interactive = onClick !== undefined || "aria-haspopup" in rest;
  const classes = cn(
    "inline-flex items-center gap-1 rounded-chip border px-2 font-mono text-mono",
    selected ? "border-accent bg-accent-tint text-ink" : "border-line bg-surface-2 text-muted",
    interactive && "min-h-6 cursor-pointer transition-colors hover:border-line-strong hover:text-ink max-md:min-h-7",
    className,
  );
  if (!interactive) return <span className={classes}>{children}</span>;
  return (
    <button ref={ref} type="button" aria-pressed={selected} onClick={onClick} className={classes} {...rest}>
      {children}
    </button>
  );
}

type MeterProps = {
  /** Names what the bar measures. */
  label: string;
  value?: number;
  max?: number;
  className?: string;
};

/** A determinate bar, or an indeterminate one when `value` is missing. */
export function Meter({ label, value, max = 100, className }: MeterProps) {
  const indeterminate = value === undefined;
  const percent = indeterminate ? 40 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      {...(indeterminate ? {} : { "aria-valuenow": value })}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}
    >
      <div
        className={cn("h-full rounded-full bg-accent transition-[width] duration-[var(--dur-base)]", indeterminate && "animate-shimmer")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

type SparklineProps = {
  values: readonly number[];
  /** What the line shows. */
  title: string;
  /** The numbers behind it, as text ("2,410 in 2025, 1,720 in 2021"), for assistive technology. */
  summary: string;
  className?: string;
};

/** A small line chart. The table beside it carries the numbers; this only shows the shape. */
export function Sparkline({ values, title, summary, className }: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 96;
  const height = 24;
  const points = values
    .map((value, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((value - min) / span) * (height - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg role="img" aria-label={`${title}: ${summary}`} viewBox={`0 0 ${width} ${height}`} className={cn("h-6 w-24 text-ink-2", className)}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

type StatusLineProps = {
  icon: IconName;
  tone?: Tone;
  children: ReactNode;
  /** A button or a link. */
  action?: ReactNode;
};

/** One row that says why something is empty, checked or waiting: an icon, a sentence and perhaps an action. */
export function StatusLine({ icon, tone = "muted", children, action }: StatusLineProps) {
  return (
    <div className="flex items-start gap-2 text-small text-muted">
      <Icon name={icon} className={cn("mt-0.5", tone === "muted" ? "text-faint" : TONE_TEXT[tone])} />
      <p className={cn("min-w-0 flex-1", tone !== "muted" && TONE_TEXT[tone])}>{children}</p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** A key hint such as `/` or `Ctrl K`. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[4px] border border-line-strong px-1.5 font-mono text-label text-muted">{children}</kbd>;
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
