"use client";

import {
  Badge,
  Button,
  ButtonLink,
  Checkbox,
  Chip,
  Combobox,
  Dialog,
  Disclosure,
  DropdownMenu,
  IconButton,
  Icon,
  ICON_NAMES,
  Input,
  Kbd,
  Meter,
  Popover,
  SearchInput,
  SegmentedControl,
  Select,
  Sheet,
  Skeleton,
  Sparkline,
  StatusLine,
  StatusPill,
  Switch,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  Toast,
  ToastProvider,
  Tooltip,
  type ComboboxGroup,
} from "@finora/ui";
import { useState, type ReactNode } from "react";
import type { GroupId } from "./group-list.ts";

// The state gallery: every primitive in every state, with fictional data. It exists only in demo and test
// builds (`FINORA_DEMO=1`) and is the target of the accessibility, keyboard, motion and visual tests.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <h2 className="font-serif text-h2 text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-28 shrink-0 font-mono text-mono text-muted">{label}</span>
      {children}
    </div>
  );
}

function ButtonsGroup() {
  return (
    <>
      <Section title="Buttons">
        {(["primary", "secondary", "ghost", "danger"] as const).map((variant) => (
          <Row key={variant} label={variant}>
            <Button variant={variant}>Investigate</Button>
            <Button variant={variant} disabled>
              Disabled
            </Button>
            <Button variant={variant} loading>
              Working
            </Button>
            <Button variant={variant} size="sm">
              Small
            </Button>
          </Row>
        ))}
        <Row label="icon buttons">
          <IconButton label="Close" icon="close" />
          <IconButton label="Settings" icon="settings" variant="secondary" />
          <IconButton label="Search" icon="search" disabled />
        </Row>
      </Section>
      <Section title="Labels and status">
        <Row label="badges">
          <Badge>Rule-based</Badge>
          <Badge tone="info">AI-written</Badge>
          <Badge tone="warn">Needs you</Badge>
        </Row>
        <Row label="status pills">
          <StatusPill icon="dot">Active</StatusPill>
          <StatusPill tone="warn" icon="bang">
            Points to check
          </StatusPill>
          <StatusPill tone="bad" icon="close">
            Serious concerns
          </StatusPill>
          <StatusPill tone="good" icon="check">
            Recovered
          </StatusPill>
          <StatusPill tone="muted" icon="unknown">
            Not enough data
          </StatusPill>
        </Row>
        <Row label="chips">
          <Chip>Register LV · 19 Nov</Chip>
          <Chip selected onClick={() => {}}>
            Latvia
          </Chip>
          <Chip onClick={() => {}}>Estonia</Chip>
          <Kbd>/</Kbd>
        </Row>
        <Row label="icons">
          <div className="flex flex-wrap gap-3 text-ink-2">
            {ICON_NAMES.map((name) => (
              <span key={name} className="flex items-center gap-1 font-mono text-mono">
                <Icon name={name} />
                {name}
              </span>
            ))}
          </div>
        </Row>
      </Section>
    </>
  );
}

const COMBO_GROUPS: ComboboxGroup[] = [
  {
    id: "lv",
    label: "Latvia",
    options: [
      { id: "a", label: "Example Company A SIA", description: "40000FX0001 · SIA · active · Riga · 2014" },
      { id: "b", label: "Example Company B SIA", description: "40000FX0002 · SIA · active · Jelgava · 2019" },
    ],
  },
  { id: "ee", label: "Estonia", status: { kind: "loading", text: "Estonia: loading, 62%" }, options: [] },
  { id: "lt", label: "Lithuania", status: { kind: "empty", text: "Lithuania: no match" }, options: [] },
  { id: "us", label: "United States (live registers)", status: { kind: "error", text: "Not checked: Colorado registry did not answer" }, options: [] },
];

function FormsGroup() {
  const [query, setQuery] = useState("exam");
  const [search, setSearch] = useState("Example");
  const [note, setNote] = useState("a".repeat(92));
  const [accepted, setAccepted] = useState(false);
  const [startup, setStartup] = useState(false);
  const [view, setView] = useState<"graph" | "list">("graph");
  const [picked, setPicked] = useState("none");

  return (
    <>
      <Section title="Text fields">
        <Input label="Company name" placeholder="Example Company A SIA" />
        <Input label="Registry code" hint="Eleven digits for Latvia" defaultValue="40000FX0001" />
        <Input label="Domain on the offer or invoice" error="Enter a domain without https://" defaultValue="https://shop.example" />
        <Input label="Read only" readOnly defaultValue="Read-only value" />
        <Input label="Disabled" disabled defaultValue="Disabled value" />
        <SearchInput label="Search companies" value={search} onValueChange={setSearch} resetLabel="Reset search" placeholder="Name, code or paste what you know" />
        <Textarea label="Note" maxLength={100} value={note} onChange={(event) => setNote(event.target.value)} hint="Why you are checking this company" />
        <Select
          label="Purpose"
          options={[
            { value: "partner", label: "Checking a business partner" },
            { value: "supplier", label: "Checking a supplier" },
          ]}
        />
      </Section>
      <Section title="Choices">
        <Checkbox label="Remember my choice" hint="Kept on this machine" checked={accepted} onCheckedChange={setAccepted} />
        <Switch label="Start Finora at login" hint="Off by default" checked={startup} onCheckedChange={setStartup} />
        <SegmentedControl
          label="View"
          value={view}
          onValueChange={setView}
          options={[
            { value: "graph", label: "Graph", text: "Graph" },
            { value: "list", label: "List", text: "List" },
          ]}
        />
      </Section>
      <Section title="Combobox">
        <Combobox
          label="Search companies"
          value={query}
          onValueChange={setQuery}
          groups={COMBO_GROUPS}
          onSelect={(option) => setPicked(option.label)}
          listboxLabel="Companies"
          resultCountText="2 results"
          placeholder="Name, code or paste what you know"
        />
        <p className="text-small text-muted" data-testid="combobox-picked">
          Chosen: {picked}
        </p>
      </Section>
    </>
  );
}

function OverlaysGroup({ open }: { open: string | undefined }) {
  const [dialog, setDialog] = useState(open === "dialog");
  const [sheet, setSheet] = useState(open === "sheet");
  const [toast, setToast] = useState(false);

  return (
    <ToastProvider label="Notifications">
      <Section title="Dialog, sheet, popover, menu, tooltip, toast">
        <Row label="dialog">
          <Button onClick={() => setDialog(true)}>Open dialog</Button>
          <Dialog
            open={dialog}
            onOpenChange={setDialog}
            title="Start investigation"
            description="About 150k standard tokens of your subscription, up to about 310k. Cap 500k. Today: 2.9M of 3.3M left."
            closeLabel="Close"
            footer={
              <>
                <Button onClick={() => setDialog(false)}>Cancel</Button>
                <Button variant="primary" data-autofocus onClick={() => setDialog(false)}>
                  Start investigation
                </Button>
              </>
            }
          >
            <p className="text-ink-2">This run uses your subscription.</p>
          </Dialog>
        </Row>
        <Row label="sheet">
          <Button onClick={() => setSheet(true)}>Open sheet</Button>
          <Sheet open={sheet} onOpenChange={setSheet} title="Ask about this report" closeLabel="Close">
            <p className="text-ink-2">Answers cite the findings; each question is capped at 85k standard tokens.</p>
            <Input label="Your question" />
          </Sheet>
        </Row>
        <Row label="popover">
          <Popover trigger={<Chip aria-haspopup="dialog">Register LV · 19 Nov</Chip>} label="Source details">
            <div className="flex flex-col gap-2">
              <p className="font-medium text-ink">Register of Enterprises</p>
              <p className="text-small text-ink-2">Licence: CC0 1.0 · open data</p>
              <p className="text-small text-ink-2">As of 19 Nov 2026, retrieved 20 Nov 2026 06:10</p>
            </div>
          </Popover>
        </Row>
        <Row label="menu">
          <DropdownMenu
            trigger={<Button>Finding actions</Button>}
            items={[
              { id: "report", label: "Report an error or object", icon: "flag", onSelect: () => setToast(true) },
              { id: "link", label: "Open the record", icon: "external", onSelect: () => {} },
            ]}
          />
        </Row>
        <Row label="tooltip">
          <Tooltip content="Reset the search">
            <Button>Hover or focus me</Button>
          </Tooltip>
        </Row>
        <Row label="toast">
          <Button onClick={() => setToast(true)}>Show toast</Button>
          <Toast open={toast} onOpenChange={setToast} title="Objection sent" description="The value is under review." closeLabel="Dismiss" />
        </Row>
      </Section>
      <Section title="A popover inside a scrolling table">
        <Table label="Sources in a table" caption="People with the source of each role">
          <thead>
            <tr>
              <Th>Role</Th>
              <Th>Since</Th>
              <Th>Source</Th>
            </tr>
          </thead>
          <tbody>
            {["Board member (chair)", "Board member"].map((role) => (
              <tr key={role}>
                <Td>{role}</Td>
                <Td>12 Mar 2014</Td>
                <Td>
                  <Popover trigger={<Chip aria-haspopup="dialog">Register EE · 19 Nov</Chip>} label="Source details">
                    <p className="text-small text-ink-2">Licence: CC BY 4.0 · open data</p>
                  </Popover>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </ToastProvider>
  );
}

function DataGroup() {
  return (
    <>
      <Section title="Table">
        <Table label="Financials" caption="Key figures by year, euro thousands">
          <thead>
            <tr>
              <Th>EUR k</Th>
              <Th className="text-right">2025</Th>
              <Th className="text-right">2024</Th>
              <Th className="text-right">2023</Th>
              <Th>5 years</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>Revenue</Td>
              <Td numeric>2,410</Td>
              <Td numeric>2,185</Td>
              <Td numeric>1,960</Td>
              <Td>
                <Sparkline values={[1720, 1800, 1960, 2185, 2410]} title="Revenue" summary="1,720 in 2021 to 2,410 in 2025" />
              </Td>
            </tr>
            <tr>
              <Td>Net result</Td>
              <Td numeric>142</Td>
              <Td numeric>118</Td>
              <Td numeric>96</Td>
              <Td>
                <Sparkline values={[61, 70, 96, 118, 142]} title="Net result" summary="61 in 2021 to 142 in 2025" />
              </Td>
            </tr>
          </tbody>
        </Table>
      </Section>
      <Section title="Status lines">
        <StatusLine icon="check">Checked the debtor list as of 19 Nov 2026: none found</StatusLine>
        <StatusLine icon="dash">Not published in Lithuania</StatusLine>
        <StatusLine
          icon="euro"
          action={
            <ButtonLink href="https://register.example/order" external>
              Order from the register
            </ButtonLink>
          }
        >
          Available as a paid register extract
        </StatusLine>
        <StatusLine icon="lock">Not shown in Latvia: restricted by legal rule 1</StatusLine>
        <StatusLine icon="clock">Not evaluated: tracked since 16 Nov 2026</StatusLine>
        <StatusLine icon="warn" tone="warn" action={<Button size="sm">Retry</Button>}>
          Not checked: the register did not answer
        </StatusLine>
      </Section>
      <Section title="Progress and loading">
        <Meter label="Overall progress" value={62} />
        <Meter label="Loading" />
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex items-center gap-2 text-small font-medium text-accent">
          <span aria-hidden className="size-2 animate-pulse-dot rounded-full bg-accent" />
          RUNNING
        </div>
      </Section>
      <Section title="Tabs and disclosure">
        <Tabs
          label="Network view"
          tabs={[
            { value: "graph", label: "Graph", content: <p className="text-ink-2">The graph view.</p> },
            { value: "list", label: "List", content: <p className="text-ink-2">The list view, with the same data.</p> },
          ]}
        />
        <Disclosure summary="All line items">
          <p className="text-ink-2">Every line of the statement, in the filed currency.</p>
        </Disclosure>
      </Section>
    </>
  );
}

const SWATCHES = ["bg", "surface", "surface-2", "ink", "ink-2", "muted", "faint", "accent", "good", "warn", "bad", "info"] as const;

function TypographyGroup() {
  return (
    <>
      <Section title="Type">
        <p className="font-serif text-display text-ink">Points to check</p>
        <p className="font-serif text-h1 text-ink">Example Company A SIA</p>
        <p className="font-serif text-h2 text-ink">Status and history</p>
        <p className="text-h3 font-semibold text-ink">Card title in the sans face</p>
        <p className="text-body text-ink">Body text in the sans face, 14 on 22.</p>
        <p className="text-small text-ink-2">Small text, 13 on 20.</p>
        <p className="text-label font-medium tracking-[0.08em] text-muted uppercase">Label overline</p>
        <p className="font-mono text-mono text-ink-2">Register LV · 40000FX0001 · 31 sources</p>
        <p className="text-body text-ink tabular-nums">1,234,567.89 · 2,410 · 142</p>
      </Section>
      <Section title="Baltic letters in every face">
        <p data-testid="font-sans" className="text-body text-ink">
          ĄČĘĖĮŠŲŪŽ ąčęėįšųūž · ĀČĒĢĪĶĻŅŠŪŽ āčēģīķļņšūž · ÕÄÖÜŠŽ õäöüšž
        </p>
        <p data-testid="font-serif" className="font-serif text-h2 text-ink">
          ĄČĘĖĮŠŲŪŽ ĀČĒĢĪĶĻŅŠŪŽ ÕÄÖÜŠŽ
        </p>
        <p data-testid="font-mono" className="font-mono text-mono text-ink-2">
          ĄČĘĖĮŠŲŪŽ ĀČĒĢĪĶĻŅŠŪŽ ÕÄÖÜŠŽ
        </p>
      </Section>
      <Section title="Colour tokens">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {SWATCHES.map((token) => (
            <div key={token} className="flex items-center gap-2">
              <span aria-hidden className="size-8 rounded-chip border border-line-strong" style={{ background: `var(--${token})` }} />
              <span className="font-mono text-mono text-ink-2">--{token}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

export function GalleryGroup({ group, open }: { group: GroupId; open?: string | undefined }) {
  switch (group) {
    case "buttons":
      return <ButtonsGroup />;
    case "forms":
      return <FormsGroup />;
    case "overlays":
      return <OverlaysGroup open={open} />;
    case "data":
      return <DataGroup />;
    case "typography":
      return <TypographyGroup />;
  }
}
