import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "../cn.ts";
import { Icon, type IconName } from "./icon.tsx";

export type MenuItem = { id: string; label: string; icon?: IconName; onSelect: () => void; destructive?: boolean };

type DropdownMenuProps = {
  /** The button that opens the menu. It needs an accessible name: the menu takes its name from it. */
  trigger: ReactNode;
  items: readonly MenuItem[];
};

/** An overflow menu: arrow keys move, a typed letter jumps, Esc closes and returns focus. */
export function DropdownMenu({ trigger, items }: DropdownMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 min-w-44 rounded-card border border-line-strong bg-surface-2 p-1 text-body shadow-pop"
        >
          {items.map((item) => (
            <Menu.Item
              key={item.id}
              onSelect={item.onSelect}
              className={cn(
                "flex cursor-default items-center gap-2 rounded-chip px-3 py-2 outline-none data-[highlighted]:bg-surface max-md:py-2.5",
                item.destructive ? "text-bad" : "text-ink",
              )}
            >
              {item.icon ? <Icon name={item.icon} /> : null}
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
