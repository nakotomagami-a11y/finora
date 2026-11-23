import { useId, type KeyboardEvent, type Ref } from "react";
import { cn } from "../cn.ts";
import { controlClasses } from "./field.tsx";
import { Icon } from "./icon.tsx";
import { IconButton } from "./icon-button.tsx";

export type SearchInputProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name of the reset button. */
  resetLabel: string;
  placeholder?: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
};

/** A text field with a search icon. Esc resets it when it has text; "Reset", never "Clear". */
export function SearchInput({ label, value, onValueChange, resetLabel, placeholder, className, ref }: SearchInputProps) {
  const id = useId();

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && value !== "") {
      event.preventDefault();
      onValueChange("");
    }
  };

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={onKeyDown}
        className={cn(controlClasses, "h-9 pr-10 pl-9 max-md:h-10 [&::-webkit-search-cancel-button]:hidden")}
      />
      {value !== "" ? (
        <span className="absolute top-1/2 right-1 -translate-y-1/2">
          <IconButton label={resetLabel} icon="close" onClick={() => onValueChange("")} className="size-7 max-md:size-8" />
        </span>
      ) : null}
    </div>
  );
}
