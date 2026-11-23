import { cn } from "../cn.ts";

export type UsageMeterProps = {
  /** What the bar measures, for assistive technology: "Usage of this investigation's cap". */
  label: string;
  /** Percent of the cap already spent (drawn solid), exact, from 0 to 100: a small run is a sliver, never an empty bar. */
  solid: number;
  /** Percent of the cap reserved for running agents (a lighter band after the solid part), exact. */
  band?: number;
  /** The text a reader gets as the value, for example "28% of the cap" (the share is the label's job, not this bar's). */
  valueText: string;
  className?: string;
};

const width = (percent: number) => `${Number(percent.toFixed(3))}%`;

/**
 * The cap meter (DESIGN.md §9.4): `used` is the solid fill and `held` a lighter band after it, so reserved usage never
 * looks spent. The widths are exact; the two parts together never pass 100.
 */
export function UsageMeter({ label, solid, band = 0, valueText, className }: UsageMeterProps) {
  const spent = Math.max(0, Math.min(100, solid));
  const reserved = Math.max(0, Math.min(100 - spent, band));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(spent + reserved)}
      aria-valuetext={valueText}
      className={cn("flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}
    >
      <div className="h-full bg-accent transition-[width] duration-[var(--dur-base)]" style={{ width: width(spent) }} />
      <div data-band="" className="h-full bg-accent opacity-35 transition-[width] duration-[var(--dur-base)]" style={{ width: width(reserved) }} />
    </div>
  );
}
