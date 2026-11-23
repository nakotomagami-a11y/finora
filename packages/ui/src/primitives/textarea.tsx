import type { Ref, TextareaHTMLAttributes } from "react";
import { cn } from "../cn.ts";
import { Field, controlClasses, type FieldChrome } from "./field.tsx";

export type TextareaProps = FieldChrome &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "aria-label" | "aria-describedby"> & {
    ref?: Ref<HTMLTextAreaElement>;
  };

/** The counter appears at 90% of `maxLength` and reads `used/max`. */
export function Textarea({ label, hideLabel, hint, error, className, ref, maxLength, value, ...rest }: TextareaProps) {
  const used = typeof value === "string" ? value.length : 0;
  const showCounter = maxLength !== undefined && used >= maxLength * 0.9;

  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error} className={className}>
      {({ control, describedBy, invalid }) => (
        <>
          <textarea
            ref={ref}
            id={control}
            rows={4}
            value={value}
            {...(maxLength === undefined ? {} : { maxLength })}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(controlClasses, "min-h-24 resize-y py-2 [field-sizing:content] max-h-[12lh]")}
            {...rest}
          />
          {showCounter ? (
            <p className="self-end font-mono text-mono text-muted" aria-hidden>
              {used}/{maxLength}
            </p>
          ) : null}
        </>
      )}
    </Field>
  );
}
