import * as RadixToast from "@radix-ui/react-toast";
import type { ReactNode } from "react";
import { IconButton } from "./icon-button.tsx";

type ToastProviderProps = {
  /** Names the notification region. F8 moves focus to it. */
  label: string;
  children: ReactNode;
};

export function ToastProvider({ label, children }: ToastProviderProps) {
  return (
    <RadixToast.Provider label={label} duration={5000}>
      {children}
      <RadixToast.Viewport className="fixed right-4 bottom-4 z-[60] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2 outline-none max-md:bottom-20" />
    </RadixToast.Provider>
  );
}

type ToastProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel: string;
};

/** The result of an action the person took ("Objection sent"). It never takes focus. */
export function Toast({ open, onOpenChange, title, description, closeLabel }: ToastProps) {
  return (
    <RadixToast.Root
      open={open}
      onOpenChange={onOpenChange}
      className="flex items-start justify-between gap-3 rounded-card border border-line-strong bg-surface-2 p-4 shadow-pop animate-fade-in"
    >
      <div className="flex flex-col gap-0.5">
        <RadixToast.Title className="text-body font-medium text-ink">{title}</RadixToast.Title>
        {description ? <RadixToast.Description className="text-small text-ink-2">{description}</RadixToast.Description> : null}
      </div>
      <RadixToast.Close asChild>
        <IconButton label={closeLabel} icon="close" />
      </RadixToast.Close>
    </RadixToast.Root>
  );
}
