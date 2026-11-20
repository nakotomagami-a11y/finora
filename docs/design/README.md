# Design: the first prototype

> **Superseded** by `DESIGN.md` (v1) and the mockups in `docs/design/mockups/`. This page records the first prototype, made before any data existed.

A clickable prototype was made before we had any data, so treat every field in it as a hypothesis. It isn't published here because it contains example names. This page describes its flow. The data research decides what stays.

## Flow

1. **New investigation.** One large text box: "Who are we looking into?" The user pastes everything they know: name, website, address, people, handles, and why they're checking. The chips below it show the research agents that will run: registry and ownership, financial filings, legal/liens/sanctions, social media, reviews and sentiment, news and press, website and domain, key people, red flags and scam signals.
2. **Investigation running.** A 3×3 grid of agent cards. Each shows its status (queued, running, waiting, done), its current step, how many sources it has read, and a progress bar. Overall progress and the source count sit at the top, with "Skip to report".
3. **Agents ask the human.** When an agent is unsure (for example, three registered companies match the name), a highlighted card asks the user to pick one; the dependent agents wait.
4. **Report.**
   - A verdict ("Proceed with caution"), with a status for each agent: Clear, Caution or Risk.
   - Three numbered key findings, and "If you go ahead" advice.
   - A network summary (people, companies, addresses and cases linked to the subject) that opens a network explorer.
   - Evidence grouped by agent: findings marked ✓ / ! / ×, the source domains, and "Dig deeper" and "Re-run" buttons.
   - A side panel to ask follow-up questions, with answers citing the evidence.
5. **Library.** Past investigations listed in a sidebar, each with its verdict.

Top navigation: Search, Crash monitor, Profile templates.

## Visual language

A dark, warm near-black background with an editorial serif for headlines and a clean sans-serif for UI text. A monospace face is used for agent activity and counts. The single accent is warm sand/gold, and the status colours are green (Go/Clear), amber (Caution) and red (Avoid/Risk). Cards are rounded with hairline borders.
