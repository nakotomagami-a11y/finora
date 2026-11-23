import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "../cn.ts";

type TableProps = {
  /** Names the scroll region (the section the table belongs to). */
  label: string;
  /** Names the table for assistive technology; shown to no one. */
  caption: string;
  children: ReactNode;
  className?: string;
  /**
   * The region scrolls sideways and takes the keyboard (the default). A table that is shown to no one (`sr-only`) has
   * nothing to scroll, so it passes `false`: otherwise it is one Tab stop with no visible focus.
   */
  scrollable?: boolean;
};

/**
 * A real table inside a focusable, labelled scroll region: below 768 px it scrolls sideways inside its own
 * box and the first column stays in view, so the page never scrolls sideways.
 */
export function Table({ label, caption, children, className, scrollable = true }: TableProps) {
  return (
    <div role="region" aria-label={label} tabIndex={scrollable ? 0 : undefined} className={cn(scrollable && "overflow-x-auto", "rounded-card", className)}>
      <table className="w-full border-collapse text-body [&_td:first-child]:max-md:sticky [&_td:first-child]:max-md:left-0 [&_td:first-child]:max-md:bg-surface [&_th:first-child]:max-md:sticky [&_th:first-child]:max-md:left-0 [&_th:first-child]:max-md:bg-surface">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ className, scope = "col", ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope={scope} className={cn("px-3 py-2 text-left text-mono font-medium text-muted", className)} {...rest} />;
}

export function Td({ className, numeric, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td className={cn("border-t border-line px-3 py-2 align-top", numeric && "text-right tabular-nums", className)} {...rest} />;
}
