// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button.tsx";
import { IconButton } from "./icon-button.tsx";
import { ICON_NAMES, Icon } from "./icon.tsx";

describe("Button", () => {
  it.each(["primary", "secondary", "ghost", "danger"] as const)("renders the %s variant as a button", (variant) => {
    render(<Button variant={variant}>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("runs onClick, and skips it when disabled", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("when loading keeps its label, is busy, stays focusable and ignores clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Start investigation
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Start investigation" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).not.toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    button.focus();
    expect(button).toHaveFocus();
  });

  it("activates with Enter and Space", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

describe("IconButton", () => {
  it("is named by its label and calls onClick", async () => {
    const onClick = vi.fn();
    render(<IconButton label="Close" icon="close" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows its label as a tooltip on keyboard focus", async () => {
    render(<IconButton label="Reset the search" icon="close" />);
    await userEvent.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Reset the search");
  });
});

describe("Icon", () => {
  it.each(ICON_NAMES)("%s is decorative", (name) => {
    const { container } = render(<Icon name={name} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
