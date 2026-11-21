/**
 * The keyboard shortcuts (docs/plan/ui-build-plan.md §8.1). Single-character shortcuts follow WCAG 2.1.4: they can
 * be turned off in Settings, and they are ignored while a modifier is held, while focus is in an editable control,
 * and while a dialog is open. `Ctrl/Cmd+K` is a modifier shortcut and always works. `Esc` and `Enter` belong to the
 * component that has focus, not to this file.
 */

export type ShortcutAction = "search" | "command-bar" | "shortcut-list" | "investigate" | "question" | "next" | "previous";

export type ShortcutKeyEvent = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey?: boolean; isComposing?: boolean };

export type ShortcutContext = {
  /** The Settings switch "Keyboard shortcuts", on by default. */
  enabled: boolean;
  /** Focus is in an input, a textarea, a select or a content-editable element. */
  inEditable: boolean;
  dialogOpen: boolean;
  onCompanyPage: boolean;
  /** Company pages and reports, where `j` and `k` move between findings and sections. */
  onReadingPage: boolean;
  questionPending: boolean;
};

/** Whether focus is somewhere the user types, so a letter key must reach the field. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).tagName !== "string") return false;
  const element = target as HTMLElement;
  const tag = element.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (element as HTMLInputElement).type;
    // A checkbox or a button is not a place to type: `/` there should still open the search.
    return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "image"].includes(type);
  }
  return element.isContentEditable || element.getAttribute("contenteditable") === "true" || element.getAttribute("role") === "textbox" || element.getAttribute("role") === "combobox";
}

/** The action a key press asks for, or null when it asks for none (or when it must be left alone). */
export function matchShortcut(event: ShortcutKeyEvent, context: ShortcutContext): ShortcutAction | null {
  if (event.isComposing) return null;
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && !event.altKey && event.key.toLowerCase() === "k") return "command-bar";
  if (modifier || event.altKey) return null;
  if (!context.enabled || context.inEditable || context.dialogOpen) return null;
  switch (event.key) {
    case "/":
      return "search";
    case "?":
      return "shortcut-list";
    case "i":
      return context.onCompanyPage ? "investigate" : null;
    case "q":
      return context.questionPending ? "question" : null;
    case "j":
      return context.onReadingPage ? "next" : null;
    case "k":
      return context.onReadingPage ? "previous" : null;
    default:
      return null;
  }
}
