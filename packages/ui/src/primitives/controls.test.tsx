// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./input.tsx";
import { SearchInput } from "./search-input.tsx";
import { Select } from "./select.tsx";
import { Textarea } from "./textarea.tsx";
import { Checkbox, SegmentedControl, Switch } from "./toggles.tsx";

describe("Input", () => {
  it("is labelled, and the hint describes it", () => {
    render(<Input label="Company name" hint="As in the register" />);
    const input = screen.getByRole("textbox", { name: "Company name" });
    expect(input).toHaveAccessibleDescription("As in the register");
  });

  it("shows an error as an alert with an icon, marks the field invalid and links the text", () => {
    render(<Input label="Domain" error="Enter a domain without https://" />);
    const input = screen.getByRole("textbox", { name: "Domain" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a domain without https://");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a domain without https://");
  });

  it("keeps a hidden label for assistive technology", () => {
    render(<Input label="Search" hideLabel />);
    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByText("Search")).toHaveClass("sr-only");
  });
});

describe("SearchInput", () => {
  function Harness({ initial = "" }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return <SearchInput label="Search companies" value={value} onValueChange={setValue} resetLabel="Reset search" />;
  }

  it("shows the reset button only when there is text, and resets", async () => {
    render(<Harness initial="exam" />);
    await userEvent.click(screen.getByRole("button", { name: "Reset search" }));
    expect(screen.getByRole("searchbox", { name: "Search companies" })).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Reset search" })).not.toBeInTheDocument();
  });

  it("resets on Esc when it has text", async () => {
    render(<Harness initial="exam" />);
    screen.getByRole("searchbox").focus();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });
});

describe("Textarea", () => {
  it("shows the counter at 90% of the limit and not before", () => {
    const { rerender } = render(<Textarea label="Note" maxLength={100} value={"a".repeat(80)} onChange={() => {}} />);
    expect(screen.queryByText("80/100")).not.toBeInTheDocument();
    rerender(<Textarea label="Note" maxLength={100} value={"a".repeat(90)} onChange={() => {}} />);
    expect(screen.getByText("90/100")).toBeInTheDocument();
  });
});

describe("Select", () => {
  it("lists its options under a label", async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Purpose"
        defaultValue="a"
        onChange={onChange}
        options={[
          { value: "a", label: "Checking a company" },
          { value: "b", label: "Checking a supplier" },
        ]}
      />,
    );
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Purpose" }), "b");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Checkbox and Switch", () => {
  it("toggle with Space and report their state", async () => {
    const onCheckbox = vi.fn();
    const onSwitch = vi.fn();
    render(
      <>
        <Checkbox label="Remember" checked={false} onCheckedChange={onCheckbox} />
        <Switch label="Start at login" hint="Off by default" checked={false} onCheckedChange={onSwitch} />
      </>,
    );
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(onCheckbox).toHaveBeenCalledWith(true);
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(onSwitch).toHaveBeenCalledWith(true);
    expect(screen.getByRole("switch", { name: "Start at login" })).toHaveAccessibleDescription("Off by default");
  });
});

describe("SegmentedControl", () => {
  function Harness() {
    const [value, setValue] = useState<"system" | "dark" | "light">("system");
    return (
      <SegmentedControl
        label="Theme"
        value={value}
        onValueChange={setValue}
        options={[
          { value: "system", label: "System", text: "System" },
          { value: "dark", label: "Dark", text: "Dark" },
          { value: "light", label: "Light", text: "Light" },
        ]}
      />
    );
  }

  it("moves with the arrow keys and selects", async () => {
    render(<Harness />);
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  });

  it("does not let the selected segment be unselected", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("radio", { name: "System" }));
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
  });
});
