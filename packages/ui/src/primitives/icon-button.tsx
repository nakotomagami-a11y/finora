import type { Ref } from "react";
import { cn } from "../cn.ts";
import { Icon, type IconName } from "./icon.tsx";
import { Tooltip } from "./tooltip.tsx";

export type IconButtonProps = {
  /** Required: the accessible name, and the tooltip text. */
  label: string;
  icon: IconName;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "ghost" | "secondary";
  /** A tooltip with the label on hover and focus. Off inside dialogs, where an open tooltip would take the first Esc. */
  tooltip?: boolean;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
};

export function IconButton({ label, icon, onClick, disabled, variant = "ghost", tooltip = true, className, ref }: IconButtonProps) {
  const button = (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-btn text-ink-2 transition-colors duration-[var(--dur-fast)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 max-md:size-10",
          variant === "secondary" ? "border border-line-strong hover:bg-surface-2" : "hover:bg-surface-2",
          className,
        )}
      >
        <Icon name={icon} className="size-[18px]" />
      </button>
  );
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
}
