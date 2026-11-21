// @vitest-environment jsdom
// The rules below are enforced by the compiler: `pnpm typecheck` fails if a `@ts-expect-error` stops being an error.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IconButton, Input, StatusPill, Dialog } from "./index.ts";

describe("what the types forbid", () => {
  it("rejects an icon-only button without a label", () => {
    // @ts-expect-error an icon-only button needs an accessible name
    const bad = <IconButton icon="close" />;
    expect(bad).toBeDefined();
  });

  it("rejects a status pill without an icon, so a status is never colour alone", () => {
    // @ts-expect-error the icon is required
    const bad = <StatusPill tone="warn">Waiting</StatusPill>;
    expect(bad).toBeDefined();
  });

  it("rejects a form control without a label", () => {
    // @ts-expect-error every control has a label
    const bad = <Input />;
    expect(bad).toBeDefined();
  });

  it("rejects a dialog without a title", () => {
    // @ts-expect-error a dialog needs a title
    const bad = <Dialog open onOpenChange={() => {}} closeLabel="Close">content</Dialog>;
    expect(bad).toBeDefined();
  });

  it("accepts the complete forms", () => {
    const { container } = render(
      <>
        <IconButton label="Close" icon="close" />
        <StatusPill icon="check">Active</StatusPill>
        <Input label="Name" />
      </>,
    );
    expect(container.querySelectorAll("button, input").length).toBe(2);
  });
});
