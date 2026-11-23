// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Badge, Chip, Kbd, Meter, Skeleton, Sparkline, StatusLine, StatusPill } from "./display.tsx";
import { LiveRegion } from "./live-region.tsx";
import { Table, Td, Th } from "./table.tsx";
import { Disclosure, Tabs } from "./tabs-disclosure.tsx";

describe("StatusPill", () => {
  it.each(["neutral", "info", "warn", "bad", "good", "muted"] as const)("shows an icon and text in the %s tone", (tone) => {
    const { container } = render(
      <StatusPill tone={tone} icon="check">
        Active
      </StatusPill>,
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Badge, Chip, Kbd and Skeleton", () => {
  it("renders a label, a static chip and a key hint", () => {
    render(
      <>
        <Badge tone="info">AI-written</Badge>
        <Chip>Register LV · 19 Nov</Chip>
        <Kbd>/</Kbd>
      </>,
    );
    expect(screen.getByText("AI-written")).toBeInTheDocument();
    expect(screen.getByText("Register LV · 19 Nov").tagName).toBe("SPAN");
    expect(screen.getByText("/").tagName).toBe("KBD");
  });

  it("makes a chip with an action a pressable button", async () => {
    const onClick = vi.fn();
    render(
      <Chip selected onClick={onClick}>
        Latvia
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Latvia" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("hides a skeleton from assistive technology", () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Meter", () => {
  it("is a named progress bar with its value", () => {
    render(<Meter label="Overall progress" value={62} />);
    const bar = screen.getByRole("progressbar", { name: "Overall progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "62");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("is indeterminate without a value", () => {
    render(<Meter label="Loading" />);
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });
});

describe("Sparkline", () => {
  it("carries the numbers as text for assistive technology", () => {
    render(<Sparkline values={[1720, 1960, 2185, 2410]} title="Revenue" summary="1,720 in 2021 to 2,410 in 2025" />);
    expect(screen.getByRole("img", { name: "Revenue: 1,720 in 2021 to 2,410 in 2025" })).toBeInTheDocument();
  });

  it("draws nothing for fewer than two values", () => {
    const { container } = render(<Sparkline values={[1]} title="Revenue" summary="one value" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("StatusLine", () => {
  it("says why a row is empty and offers an action", () => {
    render(<StatusLine icon="lock" action={<button type="button">Order</button>}>Available as a paid register extract</StatusLine>);
    expect(screen.getByText("Available as a paid register extract")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Order" })).toBeInTheDocument();
  });
});

describe("Table", () => {
  it("takes no Tab stop when it is not scrollable (a table shown to no one)", () => {
    render(
      <Table label="Hidden" caption="Shown to no one" scrollable={false}>
        <tbody>
          <tr>
            <Td>Only for a screen reader</Td>
          </tr>
        </tbody>
      </Table>,
    );
    const region = screen.getByRole("region", { name: "Hidden" });
    expect(region).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("table", { name: "Shown to no one" })).toBeInTheDocument();
  });

  it("is a real table in a labelled, focusable scroll region", () => {
    render(
      <Table label="Financials" caption="Key figures by year">
        <thead>
          <tr>
            <Th>Item</Th>
            <Th>2025</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td>Revenue</Td>
            <Td numeric>2,410</Td>
          </tr>
        </tbody>
      </Table>,
    );
    const region = screen.getByRole("region", { name: "Financials" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("table", { name: "Key figures by year" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "2025" })).toHaveAttribute("scope", "col");
  });
});

describe("Tabs and Disclosure", () => {
  it("moves between tabs with the arrow keys and shows the matching panel", async () => {
    render(
      <Tabs
        label="View"
        tabs={[
          { value: "graph", label: "Graph", content: <p>The graph</p> },
          { value: "list", label: "List", content: <p>The list</p> },
        ]}
      />,
    );
    expect(screen.getByRole("tab", { name: "Graph" })).toHaveAttribute("aria-selected", "true");
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "List" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("The list");
  });

  it("opens and closes a disclosure with Enter", async () => {
    render(<Disclosure summary="All line items">Detail rows</Disclosure>);
    const trigger = screen.getByRole("button", { name: "All line items" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Detail rows")).toBeVisible();
  });
});

describe("LiveRegion", () => {
  it("is a polite status region that announces a new message once", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<LiveRegion message="" />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("");
    rerender(<LiveRegion message="Registry: done" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(80);
    });
    expect(region).toHaveTextContent("Registry: done");
    vi.useRealTimers();
  });
});
