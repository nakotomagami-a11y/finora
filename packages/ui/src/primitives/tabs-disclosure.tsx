import * as Collapsible from "@radix-ui/react-collapsible";
import * as RadixTabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "../cn.ts";
import { Icon } from "./icon.tsx";

export type TabItem = { value: string; label: string; content: ReactNode };

type TabsProps = {
  /** Names the tab list. */
  label: string;
  tabs: readonly TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
};

/** Arrow keys move between tabs (roving focus); the panel follows the selected tab. */
export function Tabs({ label, tabs, value, defaultValue, onValueChange, className }: TabsProps) {
  const first = tabs[0]?.value;
  const controlled = value !== undefined ? { value } : { defaultValue: defaultValue ?? first };
  return (
    <RadixTabs.Root {...controlled} {...(onValueChange ? { onValueChange } : {})} className={className}>
      <RadixTabs.List aria-label={label} className="inline-flex rounded-btn border border-line bg-surface p-0.5">
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className="inline-flex h-8 items-center rounded-[8px] px-3 text-small text-ink-2 transition-colors hover:text-ink data-[state=active]:bg-surface-2 data-[state=active]:text-ink max-md:h-9"
          >
            {tab.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab) => (
        <RadixTabs.Content key={tab.value} value={tab.value} className="mt-4 rounded-chip">
          {tab.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}

type DisclosureProps = {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

/** "All line items", "Show all 12": a button that opens more content in place. */
export function Disclosure({ summary, children, defaultOpen = false, className }: DisclosureProps) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen} className={className}>
      <Collapsible.Trigger className="group inline-flex min-h-7 items-center gap-1.5 rounded-chip text-small font-medium text-ink-2 hover:text-ink max-md:min-h-9">
        <Icon name="next" className="transition-transform duration-[var(--dur-base)] group-data-[state=open]:rotate-90" />
        {summary}
      </Collapsible.Trigger>
      <Collapsible.Content className={cn("mt-3")}>{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}
