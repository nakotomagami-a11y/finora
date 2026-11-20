# web-qa review: the design mockups

`web-qa` tested `docs/design/mockups/` at `7dc2e76` on 2026-11-20: 8 pages, 56 state URLs, 390x844, 768x1024, 1280x800 and 1920x1080, dark and light (448 renders), Chromium only, plus interaction tests on popovers, sheets, the purpose gate, question cards, the network graph, search, theme and keyboard. Screenshots stay local. Committed by the coordinator.

**Clean:** 0 console errors or warnings, 0 failed requests, 0 horizontal overflow, 0 unnamed buttons, 0 unlabelled inputs, 0 duplicate ids, 0 banned words; logical tab order with a visible focus ring everywhere; the skip link first; focusable network nodes; reduced motion stops all animation; long names clamp to 3 lines.

## Blocking web-qa's sign-off (owner: designer)

| # | Severity | Finding | Status |
|---|---|---|---|
| W1 | MAJOR | Source popovers run off-screen at 390 wide: 16 of 20 chips open a 320px popover starting left of the screen (left -21 to -97 px), so the licence, as-of date and record link are unreachable on a phone | open |
| W2 | MAJOR | About 4,000 px of dead vertical space on mobile company pages: `.row-value { flex: 1 1 240px }` becomes a height once rows stack (LV page 11,130 px tall, ~40% empty); mobile only | open |
| W3 | MAJOR | Agent lanes sit at the bottom of the page below 1024 wide (y=9586 of 10812 at 390), so the live parallel work is out of sight on a phone. Suggestion: a sticky "Agents: 2 running, 1 needs you" bar that jumps to the lanes | open |
| W4 | MAJOR | Search result rows crush the name at 390 (74 px wide, ellipsised, facts wrap to four lines), so candidates can't be told apart: the wrong-company risk. Suggestion: stack the status pill under the name | open |
| W5 | MINOR (blocking) | A source popover's `aria-expanded` stays "true" after Esc | open |
| W6 | MINOR (blocking) | Sheets are not modal: focus isn't trapped, Esc doesn't close, the "change" link is `href="#"`. DESIGN §14 requires both, so the build slice needs an acceptance test | open |

## Smaller findings
1. Touch targets at 390 below 40 px: source chips 22 px (421 across pages), "Retry" links 22 px, theme toggle 42x28, section index pills 56x30, filter chips 30 px, `btn-sm` 28 px, "Show people" 28 px, citation links 28x16, `select` 30 px.
2. Contrast: `.co-meta .sep` uses `--faint` at 4.40:1 in dark, against DESIGN §3.1's rule that `--faint` is never text.
3. Headings: no h1 in `company.html?state=loading` and `?state=error`; `crash.html?state=loading` jumps from h1 to h3.
4. `/` and Ctrl+K do nothing outside search; there is no command bar mockup, though DESIGN §7 promises one.
5. Light theme doesn't follow the OS setting (a build item).
6. Inert controls: "Stop and write the report", "Report a problem", "All line items", "Open"; no URL for the lane-level "stopped" state.

**Missing mockup states:** the reconnecting banner, stopped by the user and the report after Stop, retry of a single failed agent, the command bar open, and a standalone `not_evaluated` state (acceptable as text rows).

**Not tested:** Firefox and WebKit, screen readers, failure injection, 200% text zoom, print. web-qa re-runs the full sweep when the designer posts the fixes.

## Status (2026-11-20)

- The designer fixed W1-W6 and most smaller findings in `05237c2` (popovers flip or become a bottom sheet; `.row-value { flex: none }` when rows stack; a compact lane list under the header plus a sticky run bar; the status pill under the name in search rows; `aria-expanded` reset; modal sheets), and added the missing states (`?state=reconnecting`, `?state=report&stopped=yes`, `?state=partial&country=lt`, `?cmd=open`, `?problem=open`).
- web-qa's second run used `b9e961f`, which predates `05237c2`, so it re-measured the old files. Its Firefox and WebKit pass on that commit: 0 console errors, 0 failed requests, 0 overflow. A re-run from the tip is pending.

## Re-test 2 (web-qa at `05237c2`, 2026-11-20)

61 state URLs; Chromium at 4 viewports in both themes (488 renders), targeted checks in Chromium, Firefox and WebKit; Firefox and WebKit render all 61 URLs at 4 viewports with 0 console errors and 0 overflow. **W2-W6 verified fixed**, and so are the smaller findings (contrast, headings, OS theme, command bar opens) and the new states (`?cmd=open`, `?problem=open`, stopped, retry, reconnecting).

| # | Severity | Finding | Status |
|---|---|---|---|
| W1b | MAJOR | Source popovers inside tables (People in LV and EE) are clipped by the table's `overflow: auto` scroll box at 768, 1280 and 1920 in all three browsers: about 40 px of a 286 px popover shows, so licence, as-of date and record link are unreachable (LV 2 of 20 chips, EE 1 of 14). The designer's measure checked the viewport, not the clipping ancestor | open (designer) |
| W7 | MINOR | Command bar: Up, Down and Enter do nothing; no `combobox`/`listbox` roles or `aria-selected` | open; a build acceptance test if not in the mockup |
| W8 | MINOR | Command bar Esc returns focus to the body, not the opener | open |
| W9 | MINOR | "Show agents": focus stays on the body | **closed**: verified at `8f5b8f1` in all three engines |
| - | resolved | WebKit sheet focus trap | **closed**: 0 of 12 Tabs escape in WebKit at `8f5b8f1` |

**Re-test 3 (web-qa at `8f5b8f1`):** 488 Chromium renders clean; WebKit trap and "Show agents" focus closed. W1b (table popover clip) is unchanged and is the only blocker; W7 and W8 stay MINOR.
