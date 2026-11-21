import { useId, type ReactNode } from "react";
import { cn } from "../cn.ts";
import { Icon } from "./icon.tsx";

export type FieldChrome = {
  /** Every control has a label. `hideLabel` keeps it for assistive technology and removes it from view. */
  label: string;
  hideLabel?: boolean | undefined;
  hint?: string | undefined;
  error?: string | undefined;
};

type Ids = { control: string; hint: string; error: string };

/** The label, hint and error line around a control, and the ids that tie them together. */
export function Field({
  label,
  hideLabel,
  hint,
  error,
  children,
  className,
}: FieldChrome & { children: (ids: Ids & { describedBy: string | undefined; invalid: boolean }) => ReactNode; className?: string | undefined }) {
  const base = useId();
  const ids: Ids = { control: `${base}-control`, hint: `${base}-hint`, error: `${base}-error` };
  const describedBy = [hint ? ids.hint : null, error ? ids.error : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={ids.control} className={hideLabel ? "sr-only" : "text-small font-medium text-ink"}>
        {label}
      </label>
      {children({ ...ids, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={ids.hint} className="text-small text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={ids.error} role="alert" className="flex items-start gap-1.5 text-small text-bad">
          <Icon name="warn" className="mt-0.5" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export const controlClasses =
  "w-full rounded-chip border border-line bg-surface-2 px-3 text-body text-ink placeholder:text-muted transition-colors duration-[var(--dur-fast)] hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-bad read-only:bg-surface";
