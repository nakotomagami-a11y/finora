import * as RadixDialog from "@radix-ui/react-dialog";
import * as RadixPopover from "@radix-ui/react-popover";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../cn.ts";
import { IconButton } from "./icon-button.tsx";

let lastClicked: HTMLElement | null = null;
let lastClickedAt = 0;
let tracking = false;

/**
 * Safari does not focus a button when it is clicked, so `document.activeElement` is the page body when a dialog
 * opens. The last clicked control is remembered as well, so focus can still go back to it on close.
 */
function trackClicks(): void {
  if (tracking || typeof document === "undefined") return;
  tracking = true;
  document.addEventListener(
    "click",
    (event) => {
      lastClicked = event.target instanceof Element ? event.target.closest<HTMLElement>("button, a[href], [role='button'], [tabindex]") : null;
      lastClickedAt = performance.now();
    },
    true,
  );
}

type LayerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required: it names the dialog for assistive technology, and it is the visible heading. */
  title: string;
  description?: string | undefined;
  /** Accessible name of the close button. */
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  /** A dialog that must be answered (a cost confirmation) can refuse Esc and outside clicks. Default true. */
  dismissible?: boolean;
  className?: string | undefined;
};

function Layer({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  footer,
  dismissible = true,
  className,
  placement,
}: LayerProps & { placement: string }) {
  const refuse = dismissible ? undefined : (event: Event) => event.preventDefault();
  const content = useRef<HTMLDivElement>(null);
  useEffect(trackClicks, []);
  const opener = useRef<HTMLElement | null>(null);

  // Focus lands on the primary action (`data-autofocus`) when there is one, else on the first control.
  // The element that had focus before is remembered, because the opener is outside this component.
  const focusPrimary = (event: Event) => {
    // A control clicked a moment ago is the opener: Safari moves focus to the nearest focusable ancestor on a click.
    const clickedJustNow = lastClicked?.isConnected === true && performance.now() - lastClickedAt < 1000;
    const active = document.activeElement;
    opener.current = clickedJustNow ? lastClicked : active instanceof HTMLElement && active !== document.body ? active : null;
    const primary = content.current?.querySelector<HTMLElement>("[data-autofocus]");
    if (primary) {
      event.preventDefault();
      primary.focus();
    }
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-[var(--scrim)]" />
        <RadixDialog.Content
          ref={content}
          onOpenAutoFocus={focusPrimary}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // After the dialog has left the page: WebKit ignores a focus call made while its trap is still unwinding.
            setTimeout(() => opener.current?.focus(), 0);
          }}
          onEscapeKeyDown={refuse}
          onPointerDownOutside={refuse}
          onInteractOutside={refuse}
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed z-50 flex max-h-[calc(100dvh-32px)] flex-col gap-4 overflow-y-auto border border-line-strong bg-surface p-6 text-ink shadow-pop outline-none",
            placement,
            className,
          )}
        >
          <RadixDialog.Title className={cn("font-serif text-h2 text-ink", dismissible && "pr-10")}>{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="text-body text-ink-2">{description}</RadixDialog.Description>
          ) : null}
          <div className="flex flex-col gap-4">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 pt-2">{footer}</div> : null}
          {dismissible ? (
            <IconButton label={closeLabel} icon="close" tooltip={false} onClick={() => onOpenChange(false)} className="absolute top-4 right-4" />
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** A centred modal on desktop and a bottom sheet under 768 px. Focus is trapped; Esc closes and returns focus to the opener. */
export function Dialog(props: LayerProps) {
  return (
    <Layer
      {...props}
      placement="top-1/2 left-1/2 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 animate-fade-in rounded-verdict max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:w-full max-md:translate-x-0 max-md:translate-y-0 max-md:animate-slide-in-bottom max-md:rounded-b-none max-md:pb-[calc(24px+env(safe-area-inset-bottom))]"
    />
  );
}

/** A panel from the right on screens from 1024 px, and from the bottom below. */
export function Sheet(props: LayerProps) {
  return (
    <Layer
      {...props}
      placement="inset-x-0 bottom-0 w-full animate-slide-in-bottom rounded-t-verdict pb-[calc(24px+env(safe-area-inset-bottom))] lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[420px] lg:animate-slide-in-right lg:rounded-none lg:pb-6"
    />
  );
}

type PopoverProps = {
  /** The element that opens it: a button. */
  trigger: ReactNode;
  /** Names the panel for assistive technology. */
  label: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
};

/**
 * A non-modal panel in a portal at the document body, so no scrolling parent can clip it. It opens beside its
 * trigger and flips to stay inside the viewport with an 8 px margin. Esc closes it and focus returns to the trigger.
 */
export function Popover({ trigger, label, children, side = "bottom", className }: PopoverProps) {
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          aria-label={label}
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-50 max-h-[var(--radix-popover-content-available-height)] w-[min(360px,calc(100vw-16px))] overflow-y-auto rounded-card border border-line-strong bg-surface-2 p-4 text-body text-ink shadow-pop outline-none",
            className,
          )}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
