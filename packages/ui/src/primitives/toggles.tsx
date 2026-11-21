import * as Checkbox_ from "@radix-ui/react-checkbox";
import * as Switch_ from "@radix-ui/react-switch";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useId, type ReactNode } from "react";
import { cn } from "../cn.ts";
import { Icon, type IconName } from "./icon.tsx";

type CheckedProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
  className?: string;
};

export function Checkbox({ label, checked, onCheckedChange, disabled, hint, className }: CheckedProps) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Checkbox_.Root
        id={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-chip border border-line-strong bg-surface-2 text-on-accent transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50 max-md:size-6"
      >
        <Checkbox_.Indicator>
          <Icon name="check" />
        </Checkbox_.Indicator>
      </Checkbox_.Root>
      <div className="flex flex-col">
        <label htmlFor={id} className="text-body text-ink">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-small text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function Switch({ label, checked, onCheckedChange, disabled, hint, className }: CheckedProps) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex flex-col">
        <label htmlFor={id} className="text-body text-ink">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-small text-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <Switch_.Root
        id={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-10 shrink-0 rounded-full border border-line-strong bg-surface-2 transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50 max-md:h-7 max-md:w-12"
      >
        <Switch_.Thumb className="block size-4 translate-x-1 rounded-full bg-ink-2 transition-transform duration-[var(--dur-fast)] data-[state=checked]:translate-x-5 data-[state=checked]:bg-on-accent max-md:size-5 max-md:data-[state=checked]:translate-x-6" />
      </Switch_.Root>
    </div>
  );
}

export type SegmentedOption<T extends string> = { value: T; label: ReactNode; icon?: IconName; text: string };

type SegmentedProps<T extends string> = {
  /** The group's accessible name. */
  label: string;
  value: T;
  onValueChange: (value: T) => void;
  /** `text` is the accessible name of each segment; `label` may be an icon alone. */
  options: readonly SegmentedOption<T>[];
  className?: string;
};

/** One choice from a few (theme, graph or list). An arrow key moves, and a selected segment cannot be unselected. */
export function SegmentedControl<T extends string>({ label, value, onValueChange, options, className }: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as T);
      }}
      className={cn("inline-flex w-fit rounded-btn border border-line bg-surface p-0.5", className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          aria-label={option.text}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-small text-ink-2 transition-colors hover:text-ink data-[state=on]:bg-surface-2 data-[state=on]:text-ink max-md:h-9"
        >
          {option.icon ? <Icon name={option.icon} /> : null}
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
