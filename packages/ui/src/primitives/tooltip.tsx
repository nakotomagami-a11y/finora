import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactElement } from "react";

type TooltipProps = {
  /** Short text. It repeats something that is also reachable without hover; it is never the only place a fact appears. */
  content: string;
  children: ReactElement;
};

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={300} skipDelayDuration={100}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            sideOffset={6}
            collisionPadding={8}
            className="z-50 max-w-[260px] rounded-chip border border-line-strong bg-surface-2 px-2 py-1 text-small text-ink shadow-pop"
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
