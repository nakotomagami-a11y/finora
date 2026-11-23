// @vitest-environment jsdom
import { CrashResponse } from "@finora/api-contract";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../../../packages/i18n/messages/en.json" with { type: "json" };
import lv from "../../../../../packages/i18n/messages/lv.json" with { type: "json" };
import { crashFixtures } from "../../fixtures/ui-fixtures.ts";
import { CrashPage, POLL_MS } from "./CrashPage.tsx";

// The same builders the demo page and the committed JSON come from: no second copy of the data.
const FIXTURES = crashFixtures();
const fixture = (name: string): CrashResponse => CrashResponse.parse(FIXTURES[name]);

function mount(options: { fixture?: CrashResponse; loading?: boolean; locale?: "en" | "lv"; client?: QueryClient } = {}) {
  const messages = options.locale === "lv" ? lv : en;
  const client = options.client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={options.locale ?? "en"} messages={messages} timeZone="UTC">
      <QueryClientProvider client={client}>
        <CrashPage fixture={options.fixture} loading={options.loading ?? false} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

afterEach(() => cleanup());

describe("the crash page, by state", () => {
  it("draws five tiles, a drop with a real minus, and the total above them", () => {
    mount({ fixture: fixture("live") });
    for (const name of ["US stocks", "Asia and Pacific", "Gold", "Crypto", "Oil"]) expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    expect(screen.getAllByText("−8.4%")[0]).toBeInTheDocument();
    expect(screen.queryByText("-8.4%")).toBeNull();
    const total = screen.getByText("Value below peaks");
    const first = screen.getByRole("heading", { level: 2, name: "US stocks" });
    expect(total.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("not configured: the words and the help, and no percentage that is 0", () => {
    mount({ fixture: fixture("not-configured") });
    expect(screen.getAllByText(/Not configured: add provider/u).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "How to set it up" }).length).toBeGreaterThan(0);
    const text = document.body.textContent ?? "";
    expect(text.replace(/never 0%/gu, "")).not.toMatch(/(^|[^\d.])0(\.0)?%/u);
  });

  it("peak not known yet: the words, and no drop for that row", () => {
    mount({ fixture: fixture("peak-unknown") });
    expect(screen.getAllByText(/Peak not known yet: tracking since/u).length).toBeGreaterThan(0);
  });

  it("stale: amber words and a status banner; error: an alert with a retry", () => {
    mount({ fixture: fixture("stale") });
    expect(screen.getAllByText(/older than its usual refresh/u).length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent("Some values are older than their usual refresh");
    cleanup();
    mount({ fixture: fixture("error") });
    expect(screen.getByRole("alert")).toHaveTextContent("One source failed");
    expect(screen.getAllByRole("button", { name: "Retry" }).length).toBeGreaterThan(0);
  });

  it("delayed: the lag chip says what the delay is", () => {
    mount({ fixture: fixture("delayed") });
    expect(screen.getAllByText("15 min delayed").length).toBeGreaterThan(0);
  });

  it("loading: a busy skeleton and no figure", () => {
    mount({ loading: true });
    expect(screen.getByLabelText("Loading the markets")).toHaveAttribute("aria-busy", "true");
    expect(document.body.textContent).not.toMatch(/\d%/u);
  });

  it("attribution is text: no link and no image in a tile", () => {
    const { container } = mount({ fixture: fixture("live") });
    expect(container.querySelectorAll("section a, section img")).toHaveLength(0);
    expect(screen.getAllByText("Citation required. Kept on this machine.").length).toBeGreaterThan(0);
  });

  it("the debt estimate has its static line, so the ticking digits are not read out", () => {
    mount({ fixture: fixture("live") });
    const card = screen.getByRole("region", { name: "US national debt" });
    expect(within(card).getByText("estimate")).toBeInTheDocument();
    expect(card.querySelector('[aria-hidden="true"]')?.textContent).toMatch(/^\$38,610,2\d\d,\d{3},\d{3}$/u);
    expect(card.querySelector(".sr-only")?.textContent).toContain("Official figure $38,610,227,451,903, as of");
  });

  it("opens the set-up help from a not configured tile and closes it with Escape", async () => {
    const user = userEvent.setup();
    mount({ fixture: fixture("not-configured") });
    const [opener] = screen.getAllByRole("button", { name: "How to set it up" });
    await user.click(opener!);
    expect(screen.getByRole("dialog", { name: "Set up a provider" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("is localised: Latvian has its own words and no catalogue key shows", () => {
    mount({ fixture: fixture("mixed"), locale: "lv" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cik tālu tirgi ir no saviem virsotnēm");
    expect(document.body.textContent).not.toMatch(/\bcrash\.[a-z]+/u);
  });
});

describe("the poll", () => {
  it("fetches once at first, then every minute, and shows the new value in place", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    try {
      let value = 71_000;
      const answer = () => {
        const body = structuredClone(FIXTURES.live!);
        const row = body.tiles.find((t) => t.tileId === "M06")!.rows.find((r) => r.rowKey.endsWith("bitcoin"))!;
        row.value = value;
        row.drawdownPct = value === 71_000 ? -24.5 : -22.8;
        return body;
      };
      const fetchMock = vi.fn(async () => new Response(JSON.stringify(answer()), { status: 200, headers: { "Content-Type": "application/json" } }));
      vi.stubGlobal("fetch", fetchMock);
      mount();
      await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getAllByText("−24.5%").length).toBeGreaterThan(0);

      value = 72_600;
      for (let i = 0; i < 12; i++) await act(async () => void (await vi.advanceTimersByTimeAsync(POLL_MS / 12)));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.getAllByText("−22.8%").length).toBeGreaterThan(0);
      expect(screen.queryByText("−24.5%")).toBeNull();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
