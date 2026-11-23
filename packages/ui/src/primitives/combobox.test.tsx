// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Combobox, type ComboboxGroup } from "./combobox.tsx";

const GROUPS: ComboboxGroup[] = [
  {
    id: "lv",
    label: "Latvia",
    options: [
      { id: "a", label: "Example Company A SIA", description: "40000FX0001 · active" },
      { id: "b", label: "Example Company B SIA", description: "40000FX0002 · active" },
    ],
  },
  { id: "ee", label: "Estonia", status: { kind: "loading", text: "Estonia: loading, 62%" }, options: [] },
  { id: "us", label: "United States", options: [{ id: "c", label: "Example Holdings Inc" }] },
];

function Harness({ onSelect = () => {}, groups = GROUPS }: { onSelect?: (id: string) => void; groups?: ComboboxGroup[] }) {
  const [value, setValue] = useState("exam");
  return (
    <Combobox
      label="Search companies"
      value={value}
      onValueChange={setValue}
      groups={groups}
      onSelect={(option) => onSelect(option.id)}
      listboxLabel="Results"
      resultCountText="3 results"
    />
  );
}

describe("Combobox", () => {
  it("follows the ARIA 1.2 combobox pattern", async () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Search companies" });
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { name: "Results" })).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
  });

  it("groups options under headings and keeps a loading group visible", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("group", { name: "Latvia" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Estonia" })).toHaveTextContent("Estonia: loading, 62%");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("moves with Up and Down, points aria-activedescendant at the option and chooses with Enter", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    const options = screen.getAllByRole("option");
    expect(options[2]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", options[2]?.id);
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("c");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveFocus();
  });

  it("jumps with Home and End and stops at the ends", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{ArrowDown}{End}");
    expect(screen.getAllByRole("option")[2]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[2]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Home}");
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
  });

  it("does not choose anything on Enter when nothing is highlighted", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{Enter}");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes on the first Esc and resets the text on the second", async () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("exam");
    await userEvent.keyboard("{Escape}");
    expect(input).toHaveValue("");
  });

  it("chooses with a click and keeps focus in the input", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: /Example Company B/u }));
    expect(onSelect).toHaveBeenCalledWith("b");
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("announces the result count while open", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("3 results")).toBeInTheDocument();
  });

  it("closes when focus leaves it", async () => {
    render(
      <>
        <Harness />
        <button type="button">Elsewhere</button>
      </>,
    );
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(input).toHaveAttribute("aria-expanded", "false");
  });
});
