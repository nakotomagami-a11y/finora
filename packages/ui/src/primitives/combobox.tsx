import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../cn.ts";
import { controlClasses } from "./field.tsx";
import { Icon } from "./icon.tsx";

export type ComboboxOption = { id: string; label: string; description?: string; disabled?: boolean };

export type ComboboxGroup = {
  id: string;
  /** Heading of the group (a country, a register). */
  label: string;
  /** What the group is doing besides listing options: still loading, failed, or nothing to list. */
  status?: { kind: "loading" | "error" | "empty"; text: string };
  options: readonly ComboboxOption[];
};

export type ComboboxProps = {
  label: string;
  hideLabel?: boolean;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  groups: readonly ComboboxGroup[];
  onSelect: (option: ComboboxOption, groupId: string) => void;
  /** Names the result list. */
  listboxLabel: string;
  /** Read once when the list opens or its size changes ("5 results"). */
  resultCountText?: string;
  className?: string;
};

type Flat = { option: ComboboxOption; groupId: string; domId: string };

/**
 * The ARIA 1.2 combobox with a listbox popup: the input keeps focus and `aria-activedescendant` points at the
 * highlighted option. Up and Down move, Home and End jump, Enter chooses, Esc closes and then resets.
 */
export function Combobox({
  label,
  hideLabel = false,
  placeholder,
  value,
  onValueChange,
  groups,
  onSelect,
  listboxLabel,
  resultCountText,
  className,
}: ComboboxProps) {
  const base = useId();
  const listId = `${base}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const flat = useMemo<Flat[]>(
    () =>
      groups.flatMap((group) =>
        group.options.filter((option) => !option.disabled).map((option) => ({ option, groupId: group.id, domId: `${base}-opt-${group.id}-${option.id}` })),
      ),
    [groups, base],
  );

  // A new set of results starts with nothing highlighted: Enter then submits the text, not a stale row.
  useEffect(() => setActive(-1), [groups]);

  const choose = (item: Flat | undefined) => {
    if (!item) return;
    onSelect(item.option, item.groupId);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        setActive((index) => Math.min(flat.length - 1, index + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setOpen(true);
        setActive((index) => (index <= 0 ? -1 : index - 1));
        break;
      case "Home":
        if (open && flat.length > 0) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open && flat.length > 0) {
          event.preventDefault();
          setActive(flat.length - 1);
        }
        break;
      case "Enter":
        if (open && active >= 0) {
          event.preventDefault();
          choose(flat[active]);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        } else if (value !== "") {
          event.preventDefault();
          onValueChange("");
        }
        break;
    }
  };

  const activeId = open && active >= 0 ? flat[active]?.domId : undefined;
  const showList = open && groups.length > 0;

  return (
    <div
      className={cn("relative", className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={`${base}-input`} className={hideLabel ? "sr-only" : "mb-1 block text-small font-medium text-ink"}>
        {label}
      </label>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          id={`${base}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          {...(activeId ? { "aria-activedescendant": activeId } : {})}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(controlClasses, "h-9 pl-9 max-md:h-10")}
        />
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {showList ? resultCountText : ""}
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label={listboxLabel}
        hidden={!showList}
        className="absolute top-full right-0 left-0 z-40 mt-1 max-h-[min(70vh,480px)] overflow-y-auto rounded-card border border-line-strong bg-surface-2 p-1 shadow-pop"
      >
        {groups.map((group) => (
          <div key={group.id} role="group" aria-labelledby={`${base}-group-${group.id}`} className="py-1">
            <p id={`${base}-group-${group.id}`} className="px-3 py-1 text-label font-medium tracking-[0.08em] text-muted uppercase">
              {group.label}
            </p>
            {group.options.map((option) => {
              const index = flat.findIndex((item) => item.groupId === group.id && item.option.id === option.id);
              const item = flat[index];
              const selected = index === active;
              return (
                <div
                  key={option.id}
                  id={item?.domId ?? `${base}-opt-${group.id}-${option.id}`}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={option.disabled || undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => item && index !== active && setActive(index)}
                  onClick={() => choose(item)}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-chip border-l-2 border-transparent px-3 py-2 text-body text-ink max-md:py-2.5",
                    selected && "border-accent bg-surface",
                    option.disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span className="line-clamp-2">{option.label}</span>
                  {option.description ? <span className="font-mono text-mono text-muted">{option.description}</span> : null}
                </div>
              );
            })}
            {group.status ? (
              <p
                role="status"
                className={cn("flex items-center gap-2 px-3 py-2 text-small", group.status.kind === "error" ? "text-warn" : "text-muted")}
              >
                <Icon name={group.status.kind === "error" ? "warn" : group.status.kind === "loading" ? "clock" : "dash"} />
                {group.status.text}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
