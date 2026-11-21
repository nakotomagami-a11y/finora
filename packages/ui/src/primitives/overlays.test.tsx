// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenu } from "./menu.tsx";
import { Dialog, Popover, Sheet } from "./overlays.tsx";
import { Toast, ToastProvider } from "./toast.tsx";

function DialogHarness({ dismissible = true, sheet = false }: { dismissible?: boolean; sheet?: boolean }) {
  const [open, setOpen] = useState(false);
  const Layer = sheet ? Sheet : Dialog;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Layer
        open={open}
        onOpenChange={setOpen}
        title="Start investigation"
        description="Typically $0.46, at most $0.92"
        closeLabel="Close"
        dismissible={dismissible}
        footer={<button type="button" data-autofocus>Start</button>}
      >
        <p>Your own key pays.</p>
        <button type="button">First control</button>
      </Layer>
    </>
  );
}

describe.each([
  ["Dialog", false],
  ["Sheet", true],
])("%s", (_name, sheet) => {
  it("opens as a modal dialog with a title and a description", async () => {
    render(<DialogHarness sheet={sheet} />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog", { name: "Start investigation" });
    expect(dialog).toHaveAccessibleDescription("Typically $0.46, at most $0.92");
  });

  it("closes with Esc and returns focus to the button that opened it", async () => {
    render(<DialogHarness sheet={sheet} />);
    const opener = screen.getByRole("button", { name: "Open" });
    await userEvent.click(opener);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("puts focus on the primary action when it is marked", async () => {
    render(<DialogHarness sheet={sheet} />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");
    expect(screen.getByRole("button", { name: "Start" })).toHaveFocus();
  });

  it("keeps Tab inside while open", async () => {
    render(<DialogHarness sheet={sheet} />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog");
    for (let i = 0; i < 8; i += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("closes with its close button", async () => {
    render(<DialogHarness sheet={sheet} />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(await screen.findByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("refuses Esc and has no close button when it is not dismissible", async () => {
    render(<DialogHarness sheet={sheet} dismissible={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});

describe("Popover", () => {
  it("opens beside its trigger in a portal, is named, and closes with Esc returning focus", async () => {
    render(
      <Popover trigger={<button type="button">Register LV</button>} label="Source details">
        <p>Licence: CC0 1.0</p>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Register LV" });
    await userEvent.click(trigger);
    const panel = await screen.findByRole("dialog", { name: "Source details" });
    expect(panel).toHaveTextContent("Licence: CC0 1.0");
    expect(panel.parentElement?.closest("[data-radix-popper-content-wrapper]")).not.toBeNull();
    expect(document.body.contains(panel)).toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

describe("DropdownMenu", () => {
  it("opens with the keyboard, focuses the first item, selects with Enter and closes", async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        trigger={<button type="button">Finding actions</button>}
        items={[
          { id: "report", label: "Report an error or object", onSelect },
          { id: "copy", label: "Copy link", onSelect: () => {} },
        ]}
      />,
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("menu", { name: "Finding actions" })).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
});

describe("Toast", () => {
  it("shows its message, has a named close button and does not take focus", async () => {
    const onOpenChange = vi.fn();
    render(
      <ToastProvider label="Notifications">
        <button type="button">Page</button>
        <Toast open onOpenChange={onOpenChange} title="Objection sent" description="Under review" closeLabel="Dismiss" />
      </ToastProvider>,
    );
    screen.getByRole("button", { name: "Page" }).focus();
    expect(await screen.findByText("Objection sent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
