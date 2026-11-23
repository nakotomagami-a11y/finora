// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isEditableTarget, matchShortcut, type ShortcutContext, type ShortcutKeyEvent } from "./shortcuts.ts";

const key = (k: string, over: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...over });
const context = (over: Partial<ShortcutContext> = {}): ShortcutContext => ({
  enabled: true,
  inEditable: false,
  dialogOpen: false,
  onCompanyPage: true,
  onReadingPage: true,
  questionPending: true,
  ...over,
});

describe("matchShortcut", () => {
  it("maps each single-character key to its action", () => {
    expect(matchShortcut(key("/"), context())).toBe("search");
    expect(matchShortcut(key("?"), context())).toBe("shortcut-list");
    expect(matchShortcut(key("i"), context())).toBe("investigate");
    expect(matchShortcut(key("q"), context())).toBe("question");
    expect(matchShortcut(key("j"), context())).toBe("next");
    expect(matchShortcut(key("k"), context())).toBe("previous");
  });

  it("ignores an unknown key", () => {
    expect(matchShortcut(key("x"), context())).toBeNull();
    expect(matchShortcut(key("Enter"), context())).toBeNull();
    expect(matchShortcut(key("Escape"), context())).toBeNull();
  });

  it("ignores a single-character key in an editable field", () => {
    for (const k of ["/", "?", "i", "q", "j", "k"]) expect(matchShortcut(key(k), context({ inEditable: true })), k).toBeNull();
  });

  it("ignores a single-character key while a modifier is held", () => {
    for (const k of ["/", "i", "q", "j"]) {
      expect(matchShortcut(key(k, { ctrlKey: true }), context()), `ctrl ${k}`).toBeNull();
      expect(matchShortcut(key(k, { metaKey: true }), context()), `meta ${k}`).toBeNull();
      expect(matchShortcut(key(k, { altKey: true }), context()), `alt ${k}`).toBeNull();
    }
  });

  it("ignores a single-character key while a dialog is open, and when the switch is off", () => {
    for (const k of ["/", "i", "q", "j", "k", "?"]) {
      expect(matchShortcut(key(k), context({ dialogOpen: true })), `dialog ${k}`).toBeNull();
      expect(matchShortcut(key(k), context({ enabled: false })), `off ${k}`).toBeNull();
    }
  });

  it("keeps Ctrl or Cmd plus K working everywhere: in a field, in a dialog, with the shortcuts off", () => {
    for (const over of [{ inEditable: true }, { dialogOpen: true }, { enabled: false }, {}]) {
      expect(matchShortcut(key("k", { ctrlKey: true }), context(over))).toBe("command-bar");
      expect(matchShortcut(key("K", { metaKey: true }), context(over))).toBe("command-bar");
    }
  });

  it("does not take Ctrl+Alt+K, which some keyboards use to type a character", () => {
    expect(matchShortcut(key("k", { ctrlKey: true, altKey: true }), context())).toBeNull();
  });

  it("ignores keys that belong to an input method composition", () => {
    expect(matchShortcut(key("/", { isComposing: true }), context())).toBeNull();
  });

  it("acts only where the action makes sense", () => {
    expect(matchShortcut(key("i"), context({ onCompanyPage: false }))).toBeNull();
    expect(matchShortcut(key("q"), context({ questionPending: false }))).toBeNull();
    expect(matchShortcut(key("j"), context({ onReadingPage: false }))).toBeNull();
    expect(matchShortcut(key("k"), context({ onReadingPage: false }))).toBeNull();
    expect(matchShortcut(key("/"), context({ onCompanyPage: false, onReadingPage: false, questionPending: false }))).toBe("search");
  });
});

describe("isEditableTarget", () => {
  const make = (html: string) => {
    document.body.innerHTML = html;
    return document.body.firstElementChild as HTMLElement;
  };

  it("is true for a text field, a textarea, a select and a content-editable element", () => {
    expect(isEditableTarget(make('<input type="text">'))).toBe(true);
    expect(isEditableTarget(make("<input>"))).toBe(true);
    expect(isEditableTarget(make('<input type="search">'))).toBe(true);
    expect(isEditableTarget(make("<textarea></textarea>"))).toBe(true);
    expect(isEditableTarget(make("<select></select>"))).toBe(true);
    expect(isEditableTarget(make('<div contenteditable="true"></div>'))).toBe(true);
  });

  it("is true for the combobox and textbox roles, which also take typing", () => {
    expect(isEditableTarget(make('<div role="combobox"></div>'))).toBe(true);
    expect(isEditableTarget(make('<div role="textbox"></div>'))).toBe(true);
  });

  it("is false for a button, a checkbox, a link and the page", () => {
    expect(isEditableTarget(make("<button></button>"))).toBe(false);
    expect(isEditableTarget(make('<input type="checkbox">'))).toBe(false);
    expect(isEditableTarget(make('<input type="radio">'))).toBe(false);
    expect(isEditableTarget(make('<a href="/x">x</a>'))).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
