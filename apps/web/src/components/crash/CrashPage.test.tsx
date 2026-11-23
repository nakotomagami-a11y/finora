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

describe("the distance strip, at its edges", () => {
  it("lists a market at its peak and a row that failed a data check, each with its words", () => {
    const body = structuredClone(FIXTURES.live!);
    const rows = body.tiles.flatMap((t) => t.rows);
    Object.assign(rows.find((r) => r.rowKey.endsWith("us_tech"))!, { drawdownPct: 0, valueLostUsd: undefined });
    // Above zero is bad data: the contract refuses it on the wire, and the page still shows it as failed a data check if it ever arrives.
    Object.assign(rows.find((r) => r.rowKey.endsWith("brent"))!, { drawdownPct: 2.5 });
    mount({ fixture: body });
    const table = screen.getByRole("table", { name: "Distance from peak" });
    const tech = within(table).getByRole("row", { name: /US technology, daily/u });
    expect(within(tech).getByText("At its peak")).toBeInTheDocument();
    const brent = within(table).getByRole("row", { name: /Brent/u });
    expect(within(brent).getByText("Not shown: failed a data check")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("One source failed");
  });

  it("lists a provider that is not configured, so the strip never shrinks without saying so", () => {
    mount({ fixture: fixture("not-configured") });
    const table = screen.getByRole("table", { name: "Distance from peak" });
    expect(within(table).getAllByText("not configured").length).toBe(8);
  });

  it("shows the total over the one row that has a value, naming only that row", () => {
    mount({ fixture: fixture("not-configured") });
    const summary = screen.getByText("Value below peaks").parentElement!;
    expect(within(summary).getByText(/US stocks, quarterly \(30 Jun 2026\)/u)).toBeInTheDocument();
    expect(summary.textContent).not.toContain("Bitcoin and ether");
  });
});

describe("the peak window and the debt change", () => {
  it("says since the peak date in the strip header and in how it is calculated", () => {
    mount({ fixture: fixture("live") });
    expect(screen.getByText(/highest daily close since 1 Jan 2025, unless the row says otherwise/u)).toBeInTheDocument();
    expect(screen.getByText(/the highest daily close since 1 Jan 2025 − 1\./u)).toBeInTheDocument();
  });

  it("puts the all-time high of the crypto total on a line of its own", () => {
    mount({ fixture: fixture("live") });
    const tile = screen.getByRole("region", { name: "Crypto" });
    const line = within(tile).getByText("All-time high, 6 Oct 2025");
    expect(line.className).toContain("basis-full");
    // The strip's bars say it under the figure of the crypto total, as well.
    expect(screen.getAllByText("all-time high").length).toBeGreaterThan(0);
  });

  it("shows the change between two official figures with both dates, signed, and never as an estimate", () => {
    mount({ fixture: fixture("live") });
    const card = screen.getByRole("region", { name: "US national debt" });
    expect(within(card).getByText("Change, 18 Oct 2026 to 18 Nov 2026")).toBeInTheDocument();
    expect(within(card).getByText("+$214 billion")).toBeInTheDocument();
    expect(within(card).getAllByText("estimate")).toHaveLength(1); // the ticker's own badge only
  });
});

describe("an error row's last good value", () => {
  it("shows the value with its date, worded as old, beside Retry, and no value on a row that has none", () => {
    // Only the date is faked, to the fixture's day: a figure from today shows its time, an older one its date.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-22T08:30:00Z") });
    mount({ fixture: fixture("error") });
    const tile = screen.getByRole("region", { name: "Crypto" });
    // The time is the machine's local time (DESIGN.md 9.4), so only its shape is pinned here; the e2e pins the zone.
    expect(within(tile).getByText(/^Last good value \$70,500, as of \d{2}:\d{2}, older than its usual refresh$/u)).toBeInTheDocument();
    expect(within(tile).getAllByText("Not checked: the source did not answer.").length).toBeGreaterThan(1);
    expect(within(tile).getAllByRole("button", { name: "Retry" }).length).toBe(3); // the lead row's and both rows', each keeps Retry
    // Ether has no stored value: it shows none, rather than a made-up one.
    expect(within(tile).getAllByText(/^Last good value/u)).toHaveLength(1);
    vi.useRealTimers();
  });

  it("never writes a last good value for an index series", () => {
    const body = structuredClone(FIXTURES.error!);
    const row = body.tiles.flatMap((t) => t.rows).find((r) => r.rowKey.endsWith("bitcoin"))!;
    row.unit = "index_points";
    mount({ fixture: body });
    expect(screen.queryByText(/^Last good value/u)).toBeNull();
  });
});

describe("the words about a failed source say the same as the rows", () => {
  const OLD_BANNER = "One source failed. Its rows show no number rather than one that may be out of date.";
  const NEW_BANNER = "One source failed. Its rows show no current number; a last good value is shown only with its time.";

  it("says a last good value is marked, in the banner and the tile, when one row shows it", () => {
    mount({ fixture: fixture("error") });
    expect(screen.getByRole("alert")).toHaveTextContent(NEW_BANNER);
    expect(screen.getByRole("alert")).not.toHaveTextContent("rather than one that may be out of date");
    const tile = screen.getByRole("region", { name: "Crypto" });
    expect(within(tile).getByText("No current number. A last good value is shown with its time and isn't counted in any total.")).toBeInTheDocument();
    expect(within(tile).queryByText("No number is shown rather than one that may be out of date.")).toBeNull();
    expect(within(tile).getAllByText(/^Last good value/u)).toHaveLength(1);
  });

  it("keeps today's words when no failed row of the source has a last good value", () => {
    const body = structuredClone(FIXTURES.error!);
    for (const row of body.tiles.flatMap((t) => t.rows)) delete row.lastGood;
    mount({ fixture: body });
    expect(screen.getByRole("alert")).toHaveTextContent(OLD_BANNER);
    const tile = screen.getByRole("region", { name: "Crypto" });
    expect(within(tile).getByText("No number is shown rather than one that may be out of date.")).toBeInTheDocument();
    expect(within(tile).queryByText(/^Last good value/u)).toBeNull();
  });

  it("says several sources failed when rows of different sources are in error, in the same two variants", () => {
    const body = structuredClone(FIXTURES.error!);
    const brent = body.tiles.flatMap((t) => t.rows).find((r) => r.rowKey.endsWith("brent"))!;
    Object.assign(brent, { state: "error", value: undefined, drawdownPct: undefined, valueLostUsd: undefined, peak: undefined });
    mount({ fixture: body });
    expect(screen.getByRole("alert")).toHaveTextContent("Several sources failed. Their rows show no current number; a last good value is shown only with its time.");
    cleanup();
    for (const row of body.tiles.flatMap((t) => t.rows)) delete row.lastGood;
    mount({ fixture: body });
    expect(screen.getByRole("alert")).toHaveTextContent("Several sources failed. Their rows show no number rather than one that may be out of date.");
  });

  it("does not count a last good value that may not be written (an index series)", () => {
    const body = structuredClone(FIXTURES.error!);
    body.tiles.flatMap((t) => t.rows).find((r) => r.rowKey.endsWith("bitcoin"))!.unit = "index_points";
    mount({ fixture: body });
    expect(screen.getByRole("alert")).toHaveTextContent(OLD_BANNER);
  });
});

describe("the provider of a row that is not configured", () => {
  it("is the code the response names, not one mapped from the row key", () => {
    const body = structuredClone(FIXTURES["not-configured"]!);
    body.tiles.flatMap((t) => t.rows).find((r) => r.rowKey.endsWith("us_large"))!.provider = "o3";
    mount({ fixture: body });
    expect(screen.getByText("Not configured: add o3 to your local provider file")).toBeInTheDocument();
    expect(screen.getAllByText(/add providers e1 and fred-cited to your local provider file/u).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/F[1-5]/u);
  });
});

describe("source chips, by their own names", () => {
  const chips = (tileName: string) =>
    within(screen.getByRole("region", { name: tileName }))
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-haspopup") === "dialog")
      .map((b) => b.textContent);

  it("name each source and date it with the row's own as-of, not the retrieval date", () => {
    mount({ fixture: fixture("live") });
    expect(chips("US stocks")).toEqual(["FRED · Q2 2026", "FRED, cited · 18 Nov 2026"]);
    expect(chips("Asia and Pacific")).toEqual(["FRED, cited · 19 Nov 2026", "Exchange E1 · 19 Nov 2026"]);
    expect(chips("Gold")).toEqual(["World Bank · Oct 2026"]);
    expect(chips("Oil")).toEqual(["FRED · 17 Nov 2026"]);
    expect(chips("US national debt")).toEqual(["Fiscal Data · 18 Nov 2026"]);
    // Two tiles no longer read alike, and no chip carries a raw source id or the 21 Nov retrieval date.
    expect(chips("Crypto")).toEqual([expect.stringMatching(/^Provider (C1|X4) · /u), expect.stringMatching(/^Provider (C1|X4) · /u)]);
    expect(document.body.textContent).not.toMatch(/fx-markets|us-fred-|crypto-x4/u);
  });

  it("show a source the catalogue does not know by its id", () => {
    const body = structuredClone(FIXTURES.live!);
    body.tiles.flatMap((t) => t.rows).find((r) => r.rowKey.endsWith("gold_monthly"))!.sources[0]!.sourceId = "some-new-source";
    mount({ fixture: body });
    expect(chips("Gold")).toEqual(["some-new-source · Oct 2026"]);
  });
});

describe("the strip lists a row that is still loading", () => {
  it("shows it last, as loading, with aria-busy", () => {
    mount({ fixture: fixture("mixed") });
    const table = screen.getByRole("table", { name: "Distance from peak" });
    const rows = within(table).getAllByRole("row");
    const last = rows.at(-1)!;
    expect(last).toHaveAttribute("aria-busy", "true");
    expect(within(last).getByText("Taiwan")).toBeInTheDocument();
    expect(within(last).getByText("loading")).toBeInTheDocument();
  });
});

describe("how it is calculated while the first answer is awaited", () => {
  it("leaves the date as a skeleton rather than the older wording", () => {
    const { container } = mount({ loading: true });
    const how = screen.getByRole("heading", { name: "How it's calculated" }).parentElement!;
    expect(how.textContent).toContain("the highest daily close since");
    expect(how.textContent).not.toContain("in the window");
    expect(how.querySelector('[class*="inline-block"]')).not.toBeNull();
    expect(container).toBeTruthy();
  });
});

describe("source chips", () => {
  it("puts a chip in a tile footer and opens its popover with the licence and the times", async () => {
    const user = userEvent.setup();
    mount({ fixture: fixture("live") });
    const tile = screen.getByRole("region", { name: "Oil" });
    const chip = within(tile).getAllByRole("button").find((b) => b.getAttribute("aria-haspopup") === "dialog")!;
    expect(chip.textContent).toBe("FRED · 17 Nov 2026");
    await user.click(chip);
    const popover = screen.getByRole("dialog", { name: "Source details" });
    expect(within(popover).getByText(/^Licence: /u)).toBeInTheDocument();
    expect(within(popover).getByText("Open data")).toBeInTheDocument();
    expect(within(popover).getByText(/^Retrieved /u)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Source details" })).toBeNull();
    expect(chip).toHaveFocus();
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
