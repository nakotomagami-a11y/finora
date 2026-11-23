import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "../cn.ts";
import { Field, controlClasses, type FieldChrome } from "./field.tsx";

export type InputProps = FieldChrome &
  Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "aria-label" | "aria-describedby"> & { ref?: Ref<HTMLInputElement> };

export function Input({ label, hideLabel, hint, error, className, ref, ...rest }: InputProps) {
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error} className={className}>
      {({ control, describedBy, invalid }) => (
        <input
          ref={ref}
          id={control}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlClasses, "h-9 max-md:h-10")}
          {...rest}
        />
      )}
    </Field>
  );
}
