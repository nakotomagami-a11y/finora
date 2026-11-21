import type { ButtonHTMLAttributes, MouseEvent, Ref } from "react";
import { cn } from "../cn.ts";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** The label stays, a pulse shows, and clicks are ignored. The button stays focusable. */
  loading?: boolean;
  type?: "button" | "submit" | "reset";
  ref?: Ref<HTMLButtonElement>;
};

export const buttonClasses = {
  base: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-btn text-small font-medium no-underline transition-colors duration-[var(--dur-fast)] disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress",
  size: {
    md: "h-9 px-4 max-md:h-10",
    sm: "h-7 px-3 max-md:h-9",
  },
  variant: {
    primary: "bg-accent text-on-accent hover:brightness-110 active:brightness-95",
    secondary: "border border-line-strong bg-transparent text-ink hover:bg-surface-2 active:bg-surface",
    ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-surface",
    danger: "border border-bad bg-transparent text-bad hover:bg-bad-tint active:bg-bad-tint",
  },
} as const;

export function Button({ variant = "secondary", size = "md", loading = false, type = "button", className, onClick, children, ref, ...rest }: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      className={cn(buttonClasses.base, buttonClasses.size[size], buttonClasses.variant[variant], className)}
      onClick={handleClick}
      {...rest}
    >
      {loading ? <span aria-hidden className="size-1.5 animate-pulse-dot rounded-full bg-current" /> : null}
      {children}
    </button>
  );
}
