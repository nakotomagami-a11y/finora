// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UsageMeter } from "./usage-meter.tsx";

describe("UsageMeter", () => {
  it("is a named progress bar whose value text is the share, and draws used solid and held as a band", () => {
    const { container } = render(<UsageMeter label="Usage of this investigation's cap" solid={24} band={4} valueText="28% of the cap" />);
    const bar = screen.getByRole("progressbar", { name: "Usage of this investigation's cap" });
    expect(bar).toHaveAttribute("aria-valuenow", "28");
    expect(bar).toHaveAttribute("aria-valuetext", "28% of the cap");
    const [solid, band] = Array.from(bar.children) as HTMLElement[];
    expect(solid?.style.width).toBe("24%");
    expect(band?.style.width).toBe("4%");
    expect(container.querySelector("[data-band]")).not.toBeNull();
  });

  it("has no band by default", () => {
    render(<UsageMeter label="x" solid={10} valueText="10%" />);
    expect((screen.getByRole("progressbar").children[1] as HTMLElement).style.width).toBe("0%");
  });

  it("keeps the two parts inside 100 and never below 0, and keeps the fraction of each", () => {
    render(<UsageMeter label="x" solid={90.9} band={40} valueText="100%" />);
    const bar = screen.getByRole("progressbar");
    expect((bar.children[0] as HTMLElement).style.width).toBe("90.9%");
    expect((bar.children[1] as HTMLElement).style.width).toBe("9.1%");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });

  it("draws a small run as a sliver", () => {
    render(<UsageMeter label="x" solid={0.2} valueText="under 1%" />);
    expect((screen.getByRole("progressbar").children[0] as HTMLElement).style.width).toBe("0.2%");
  });

  it("clamps negative input", () => {
    render(<UsageMeter label="x" solid={-5} band={-1} valueText="0%" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});
