import type { Ref, SelectHTMLAttributes } from "react";
import { cn } from "../cn.ts";
import { Field, controlClasses, type FieldChrome } from "./field.tsx";

export type SelectOption = { value: string; label: string };

export type SelectProps = FieldChrome &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "aria-label" | "aria-describedby" | "children"> & {
    options: readonly SelectOption[];
    ref?: Ref<HTMLSelectElement>;
  };

/** A native select: the platform already gets keyboard, screen reader and mobile behaviour right. */
export function Select({ label, hideLabel, hint, error, options, className, ref, ...rest }: SelectProps) {
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error} className={className}>
      {({ control, describedBy, invalid }) => (
        <select
          ref={ref}
          id={control}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlClasses, "h-9 max-md:h-10")}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
