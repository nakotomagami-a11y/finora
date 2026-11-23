// @vitest-environment jsdom
import { useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { createQueryClient, Providers } from "./Providers.ts";

function Probe() {
  const { data } = useQuery({ queryKey: ["probe"], queryFn: () => Promise.resolve("loaded") });
  return createElement("p", null, data ?? "waiting");
}

describe("Providers", () => {
  it("gives its children a working query client", async () => {
    render(createElement(Providers, null, createElement(Probe)));
    expect(screen.getByText("waiting")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("loaded")).toBeInTheDocument());
  });

  it("does not refetch when the window gains focus", () => {
    expect(createQueryClient().getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });

  it("retries a dropped connection once, and never a refusal", () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry as (count: number, error: Error) => boolean;
    expect(retry(0, new Error("network"))).toBe(true);
    expect(retry(1, new Error("network"))).toBe(false);
    for (const code of ["http_404", "not_found", "forbidden", "purpose_blocked", "bad_request"]) expect(retry(0, new Error(code)), code).toBe(false);
  });
});
