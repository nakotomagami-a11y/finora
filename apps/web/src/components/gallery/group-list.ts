export const GROUPS = {
  buttons: "Buttons, labels and status",
  forms: "Forms and combobox",
  overlays: "Dialog, sheet, popover, menu, toast",
  data: "Tables, status lines, progress, tabs",
  typography: "Type, fonts and colour",
} as const;

export type GroupId = keyof typeof GROUPS;

export function isGroup(value: string): value is GroupId {
  return Object.hasOwn(GROUPS, value);
}
