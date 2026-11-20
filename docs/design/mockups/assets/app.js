/* Finora mockups: shell, state switcher and shared components.
   Plain browser JavaScript, no build step. Component names match DESIGN.md. */
(function () {
  "use strict";

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const params = new URLSearchParams(location.search);
  const param = (k, d) => params.get(k) ?? d;

  /* ---------- Icons (inline SVG, 16px grid, currentColor) ---------- */
  const P = {
    search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/>',
    check: '<path d="M3.5 8.5 6.5 11.5 12.5 4.5"/>',
    dash: '<path d="M4 8h8"/>',
    lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/>',
    warn: '<path d="M8 2.5 14 13H2Z"/><path d="M8 6.5v3"/><path d="M8 11.4v.1"/>',
    x: '<path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/>',
    bang: '<path d="M8 3.5v6"/><path d="M8 12.2v.1"/>',
    q: '<path d="M6 6a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3v.4"/><path d="M8 12.2v.1"/>',
    info: '<circle cx="8" cy="8" r="6"/><path d="M8 7.2V11"/><path d="M8 5v.1"/>',
    key: '<circle cx="5.5" cy="10.5" r="2.5"/><path d="m7.3 8.7 5.2-5.2M10.5 5.5l1.5 1.5"/>',
    euro: '<path d="M11.5 4.5A4 4 0 1 0 11.5 11.5"/><path d="M3 7h6M3 9h6"/>',
    hand: '<path d="M5 8V4.5a1 1 0 0 1 2 0V8M7 7.5V3.5a1 1 0 0 1 2 0v4M9 7.5V4.5a1 1 0 0 1 2 0V9c0 2.5-1.5 4.5-4 4.5S3.5 12 3 10l-.5-2a1 1 0 0 1 2-.5L5 9"/>',
    agent: '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="1.8"/>',
    clock: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2l2 1.3"/>',
    ext: '<path d="M9 3h4v4M13 3 7.5 8.5"/><path d="M11 9.5V13H3V5h3.5"/>',
    explorer: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/><path d="M5 7h4"/>',
    library: '<path d="M3 3h3v10H3zM7 3h3v10H7z"/><path d="m11 3.5 2.6.7-2.4 9-2.6-.7"/>',
    crash: '<path d="M2 4l4 4 3-2 5 6"/><path d="M10 12h4V8"/>',
    sources: '<path d="M3 4.5C3 3.7 5.2 3 8 3s5 .7 5 1.5S10.8 6 8 6 3 5.3 3 4.5Z"/><path d="M3 4.5v7C3 12.3 5.2 13 8 13s5-.7 5-1.5v-7"/><path d="M3 8c0 .8 2.2 1.5 5 1.5S13 8.8 13 8"/>',
    settings: '<circle cx="8" cy="8" r="2"/><path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M3.6 12.4l1.2-1.2M11.2 4.8l1.2-1.2"/>',
    network: '<circle cx="4" cy="4" r="1.8"/><circle cx="12" cy="5" r="1.8"/><circle cx="7" cy="12" r="1.8"/><path d="M5.6 4.3 10.2 4.8M5 5.6l1.4 4.7M10.9 6.5l-2.8 4"/>',
    moon: '<path d="M12.5 10A5.5 5.5 0 0 1 6 3.5a5.5 5.5 0 1 0 6.5 6.5Z"/>',
    flag: '<path d="M4 14V2.5M4 3h7.5L10 5.8 11.5 8.5H4"/>',
    stop: '<rect x="4" y="4" width="8" height="8" rx="1"/>',
    play: '<path d="M5 3.5v9l7-4.5Z"/>',
    chev: '<path d="m6 4 4 4-4 4"/>',
    arrowUp: '<path d="M8 13V3.5M4 7.5l4-4 4 4"/>',
    arrowDown: '<path d="M8 3v9.5M4 8.5l4 4 4-4"/>',
    file: '<path d="M4 2.5h5l3 3v8H4Z"/><path d="M9 2.5v3h3"/>',
    skip: '<path d="M4 4l5 4-5 4zM11 4v8"/>',
  };
  const icon = (name, cls = "icon", label) =>
    `<svg class="${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${P[name] || ""}</svg>`;

  /* ---------- Theme ---------- */
  const theme = param("theme", localStorage.getItem("finora-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  document.documentElement.dataset.theme = theme;

  /* ---------- Shell: tool rail + top bar ---------- */
  const TOOLS = [
    { id: "explorer", label: "Explorer", href: "search.html", icon: "explorer" },
    { id: "library", label: "Library", href: "library.html", icon: "library" },
    { id: "crash", label: "Crash", href: "crash.html", icon: "crash", title: "Crash monitor" },
  ];
  const UTIL = [
    { id: "sources", label: "Sources", href: "sources.html", icon: "sources" },
    { id: "settings", label: "Settings", href: "settings.html", icon: "settings" },
  ];
  function shell(active, content, opts = {}) {
    const item = (t) => `<a class="rail-item" href="${t.href}" ${t.id === active ? 'aria-current="page"' : ""} title="${esc(t.title || t.label)}">${icon(t.icon)}<span>${esc(t.label)}</span></a>`;
    return `
      <a class="sr-only" href="#main">Skip to content</a>
      <div class="shell">
        <nav class="rail" aria-label="Tools">
          <a class="rail-logo" href="index.html" aria-label="Finora, all mockups">F</a>
          ${TOOLS.map(item).join("")}
          <span class="rail-spacer"></span>
          ${UTIL.map(item).join("")}
        </nav>
        <div class="main">
          <header class="topbar">
            <button class="cmd" type="button" aria-haspopup="dialog" onclick="Finora.openCmd()">
              ${icon("search")}<span>Search companies, tools, investigations</span><span style="margin-left:auto" class="kbd">/</span>
            </button>
            <div class="topbar-end">
              ${opts.spend === false ? "" : `<span class="spend-pill" title="Agent spend today against the daily cap">today $${opts.spendToday ?? "1.84"} of $10.00</span>`}
              <button class="btn btn-quiet btn-sm" type="button" aria-label="Switch between dark and light theme" onclick="Finora.toggleTheme()">${icon("moon")}</button>
            </div>
          </header>
          <main id="main" tabindex="-1">${content}</main>
        </div>
      </div>`;
  }
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("finora-theme", next);
    const u = new URL(location.href);
    u.searchParams.set("theme", next);
    location.href = u.toString();
  }

  /* ---------- State switcher (mockup only) ---------- */
  function switcher(controls) {
    const sel = (c) => {
      const cur = param(c.key, c.options[0][0]);
      return `<label>${esc(c.label)}<select data-key="${c.key}">${c.options
        .map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`)
        .join("")}</select></label>`;
    };
    const el = document.createElement("details");
    el.className = "switcher";
    if (param("panel", "closed") === "open") el.open = true;
    el.innerHTML = `<summary>${icon("settings", "icon icon-sm")} Mockup states</summary>
      <div class="switcher-body">
        ${controls.map(sel).join("")}
        ${sel({ key: "theme", label: "Theme", options: [["dark", "Dark"], ["light", "Light"]] })}
        <p class="fixture-note">Fictional data. Every name, code and number on this page is made up. URL parameters reproduce each state.</p>
      </div>`;
    el.addEventListener("change", (e) => {
      const s = e.target.closest("select");
      if (!s) return;
      const u = new URL(location.href);
      u.searchParams.set(s.dataset.key, s.value);
      if (s.dataset.key === "theme") localStorage.setItem("finora-theme", s.value);
      location.href = u.toString();
    });
    document.body.appendChild(el);
  }

  /* ---------- Source chip with popover ---------- */
  let chipSeq = 0;
  function chip(src, extra = {}) {
    if (!src) return "";
    const id = `pop-${++chipSeq}`;
    const kind = src.kind === "web" ? "web" : src.kind === "derived" ? "derived-chip" : "";
    const stale = extra.stale ? "stale" : "";
    const label = src.kind === "derived" ? "Derived by Finora" : src.short;
    return `<span class="chip-wrap">
      <button type="button" class="chip ${kind} ${stale}" aria-expanded="false" aria-controls="${id}" data-chip>
        ${src.kind === "derived" ? icon("info", "icon icon-sm") : ""}${esc(label)} · ${esc(src.asOf)}
      </button>
      <span class="pop" id="${id}" role="dialog" aria-label="Source details" hidden>
        <dl>
          <div><dt>Source</dt><dd>${esc(src.name)}</dd></div>
          ${src.kind === "derived" ? `<div><dt>Computed from</dt><dd>${esc(src.inputs)}</dd></div>` : ""}
          <div><dt>Licence</dt><dd>${esc(src.licence)}</dd></div>
          <div><dt>Access</dt><dd>${esc(src.tier || "open data")}</dd></div>
          <div><dt>As of</dt><dd>${esc(src.asOfLong || src.asOf)}${extra.stale ? ` <span class="stale-date">· older than this source's ${esc(src.cadence || "daily")} cycle</span>` : ""}</dd></div>
          <div><dt>Retrieved</dt><dd>${esc(src.retrieved || "19 Nov 2026, 06:10")} by ${esc(src.by || "the register loader")}</dd></div>
        </dl>
        ${src.quote ? `<blockquote>${esc(src.quote)}</blockquote>` : ""}
        <span style="display:flex;gap:12px;flex-wrap:wrap">
          ${src.url ? `<a href="#" onclick="return false">${icon("ext", "icon icon-sm")} Open the record</a>` : ""}
          <a href="sources.html">How this source is used</a>
        </span>
      </span>
    </span>`;
  }
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-chip]");
    document.querySelectorAll(".pop:not([hidden])").forEach((p) => {
      if (!btn || p.id !== btn.getAttribute("aria-controls")) {
        p.hidden = true;
        const b = document.querySelector(`[aria-controls="${p.id}"]`);
        if (b) b.setAttribute("aria-expanded", "false");
      }
    });
    if (btn) {
      const pop = document.getElementById(btn.getAttribute("aria-controls"));
      pop.hidden = !pop.hidden;
      btn.setAttribute("aria-expanded", String(!pop.hidden));
      if (!pop.hidden) placePop(pop);
    }
    const problem = e.target.closest("[data-problem]");
    if (problem) openProblem(problem.getAttribute("data-problem"));
  });
  // Desktop: anchor under the chip, flipped so it never leaves the viewport. Phones: CSS turns it into a bottom sheet.
  // Desktop: fixed to the viewport next to the chip, so a scrolling table can never clip it; flips up or
  // sideways to stay on screen. Phones: CSS turns it into a bottom sheet.
  function placePop(pop) {
    ["left", "right", "top", "bottom", "position", "width"].forEach((k) => { pop.style[k] = ""; });
    if (matchMedia("(max-width: 767px)").matches) return;
    const chipRect = pop.parentElement.getBoundingClientRect();
    pop.style.position = "fixed";
    pop.style.right = "auto";
    const w = Math.min(320, innerWidth - 16);
    pop.style.width = w + "px";
    const h = pop.getBoundingClientRect().height;
    const left = Math.max(8, Math.min(chipRect.right - w, innerWidth - w - 8));
    const below = chipRect.bottom + 6;
    const top = below + h > innerHeight - 8 && chipRect.top - 6 - h >= 8 ? chipRect.top - 6 - h : Math.max(8, Math.min(below, innerHeight - h - 8));
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }
  // On scroll the popover follows its chip; it closes only when the chip leaves the viewport.
  addEventListener("scroll", () => {
    const pop = document.querySelector(".pop:not([hidden])");
    if (!pop || matchMedia("(max-width: 767px)").matches) return;
    const r = pop.parentElement.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) closePops(false); else placePop(pop);
  }, { passive: true, capture: true });
  function closePops(refocus = true) {
    document.querySelectorAll(".pop:not([hidden])").forEach((p) => {
      p.hidden = true;
      const b = document.querySelector(`[aria-controls="${p.id}"]`);
      if (b) { b.setAttribute("aria-expanded", "false"); if (refocus) b.focus(); }
    });
  }
  document.addEventListener("keydown", (e) => {
    const typing = /input|textarea|select/i.test(document.activeElement.tagName);
    if (e.key === "Escape") {
      if (document.querySelector(".pop:not([hidden])")) return closePops();
      const layer = document.querySelector("[data-layer]");
      if (layer) return closeLayer(layer);
      const cancel = document.querySelector(".scrim .sheet-actions [data-cancel]");
      if (cancel) return cancel.click();
    }
    if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      const box = document.querySelector("#q");
      if (box && e.key === "/") box.focus(); else openCmd();
    }
    if (e.key === "Tab") trapFocus(e);
  });
  // Modal layers (sheets, the command bar, the problem form) keep focus inside themselves.
  function trapFocus(e) {
    const layers = document.querySelectorAll("[data-layer] .sheet, [data-layer] .palette, .scrim .sheet");
    const layer = layers[layers.length - 1];
    if (!layer) return;
    const f = [...layer.querySelectorAll('a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    // Move focus ourselves on every Tab: engines differ on whether links are tabbable.
    e.preventDefault();
    const i = f.indexOf(document.activeElement);
    const next = i === -1 ? 0 : (i + (e.shiftKey ? -1 : 1) + f.length) % f.length;
    f[next].focus();
  }

  /* ---------- Command bar (mockup of the real palette) ---------- */
  let layerOpener = null;
  function closeLayer(layer) {
    layer.remove();
    if (layerOpener && document.contains(layerOpener)) layerOpener.focus();
    layerOpener = null;
  }
  const CMD_ITEMS = [
    ["Companies", "company.html?country=lv", "Paraugs Timber SIA", "LV · 40000FX0017 · SIA · Rīga · 2014", "LV"],
    ["Companies", "company.html?country=lv", "Paraugs Timber SIA", "LV · 40000FX0058 · SIA · Valmiera · 2022", "LV"],
    ["Companies", "company.html?country=ee", "Paraugs Timber Eesti OÜ", "EE · 1FX000033 · OÜ · Tartu · 2020", "EE"],
    ["Companies", "company.html?country=lt", "Pavyzdys Bakery UAB", "LT · 30FX00017 · UAB · Vilnius · 2011", "LT"],
    ["Investigations", "company.html?country=lv&state=report", "Paraugs Timber SIA", "Points to check · today 09:44", ""],
    ["Investigations", "company.html?country=ee&state=report", "Näidis Freight OÜ", "Points to check · today 08:12", ""],
    ["Tools and pages", "crash.html", "Crash monitor", "Markets from their peaks", ""],
    ["Tools and pages", "library.html", "Library", "Every investigation you ran", ""],
    ["Tools and pages", "sources.html", "Sources", "Licences and freshness", ""],
    ["Tools and pages", "settings.html", "Settings", "Keys, caps, language", ""],
  ];
  function openCmd() {
    if (document.querySelector("[data-layer='cmd']")) return;
    layerOpener = document.activeElement && document.activeElement !== document.body ? document.activeElement : document.querySelector(".cmd");
    const el = document.createElement("div");
    el.className = "scrim pal-scrim";
    el.setAttribute("data-layer", "cmd");
    el.innerHTML = `<div class="palette" role="dialog" aria-modal="true" aria-label="Command bar">
      <div class="search-box" style="height:48px;border-radius:10px">${icon("search")}<label class="sr-only" for="cmd-q">Search companies, investigations and tools</label><input id="cmd-q" role="combobox" aria-expanded="true" aria-controls="cmd-list" aria-autocomplete="list" autocomplete="off" placeholder="Company, code, investigation or tool" value="paraugs"><span class="kbd">Esc</span></div>
      <div id="cmd-list" role="listbox" aria-label="Results"></div>
      <p class="small muted" id="cmd-hint">↑ ↓ to move · Enter to open · Esc to close</p>
    </div>`;
    el.addEventListener("click", (e) => { if (e.target === el) closeLayer(el); });
    document.body.appendChild(el);
    const input = el.querySelector("input");
    const list = el.querySelector("#cmd-list");
    let active = 0, shown = [];
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      shown = CMD_ITEMS.filter((it) => !q || (it[2] + " " + it[3]).toLowerCase().includes(q) || it[0] === "Tools and pages");
      active = Math.min(active, Math.max(0, shown.length - 1));
      let html = "", group = "";
      shown.forEach((it, i) => {
        if (it[0] !== group) { group = it[0]; html += `<div class="label pal-head" role="presentation">${esc(group)}</div>`; }
        html += `<a class="pal-item" id="cmd-opt-${i}" role="option" aria-selected="${i === active}" href="${it[1]}" tabindex="-1">${it[4] ? `<span class="cc">${it[4]}</span>` : icon("chev", "icon icon-sm")}<span class="pal-main"><span>${esc(it[2])}</span><span class="small muted">${esc(it[3])}</span></span></a>`;
      });
      list.innerHTML = html || `<p class="small muted" role="presentation" style="padding:8px">No match. Press Enter to search the registers for “${esc(input.value)}”.</p>`;
      if (shown.length) input.setAttribute("aria-activedescendant", `cmd-opt-${active}`); else input.removeAttribute("aria-activedescendant");
    };
    input.addEventListener("input", () => { active = 0; draw(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!shown.length) return;
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
        draw();
        el.querySelector(`#cmd-opt-${active}`).scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        location.href = shown.length ? shown[active][1] : `search.html?state=typing`;
      }
    });
    draw();
    input.focus();
    input.select();
  }

  /* ---------- Report a problem (legal rule 10) ---------- */
  function openProblem(what) {
    layerOpener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    const el = document.createElement("div");
    el.className = "scrim";
    el.setAttribute("data-layer", "problem");
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pb-h"><form style="display:flex;flex-direction:column;gap:16px">
      <h2 id="pb-h">Report a problem</h2>
      <p class="small ink2">About: <strong>${esc(what)}</strong></p>
      <fieldset style="border:0;margin:0;padding:0;display:flex;flex-direction:column;gap:8px"><legend class="small" style="margin-bottom:6px;padding:0">What is wrong?</legend>
        <label class="radio"><input type="radio" name="k" checked> <span>A value is wrong or out of date</span></label>
        <label class="radio"><input type="radio" name="k"> <span>It is about the wrong company</span></label>
        <label class="radio"><input type="radio" name="k"> <span>I object to a statement about me</span></label>
      </fieldset>
      <label class="small" for="pb-d" style="display:flex;flex-direction:column;gap:6px">Details<textarea id="pb-d" class="input" style="height:96px;padding:8px 12px;resize:vertical" placeholder="What should it say, and where did you see the correct value?"></textarea></label>
      <p class="small muted">An objected statement is hidden while it is reviewed. This report stays on this machine until you export or send it.</p>
      <div class="sheet-actions"><button class="btn" type="button" data-cancel onclick="Finora.closeLayer(this.closest('[data-layer]'))">Cancel</button><button class="btn btn-primary" type="submit">Send report</button></div>
    </form></div>`;
    document.body.appendChild(el);
    el.querySelector("form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      ev.target.innerHTML = `<h2>Thank you</h2><p class="ink2">Your report is logged. If it objects to a statement about you, that statement is hidden while it is reviewed.</p><div class="sheet-actions"><button class="btn btn-primary" type="button" data-cancel>Close</button></div>`;
      const close = ev.target.querySelector("[data-cancel]");
      close.addEventListener("click", () => closeLayer(el));
      close.focus();
    });
    el.querySelector("input").focus();
  }

  /* ---------- Confidence, tags, severity ---------- */
  const CONF = {
    official: { label: "Official", dots: '<circle cx="4" cy="4" r="3" fill="currentColor"/>' },
    corroborated: { label: "Corroborated", dots: '<circle cx="4" cy="4" r="3" fill="currentColor"/><circle cx="11" cy="4" r="3" fill="currentColor"/>' },
    single: { label: "Single source", dots: '<circle cx="4" cy="4" r="2.4" fill="none" stroke="currentColor" stroke-width="1.2"/>' },
    inferred: { label: "Inferred", dots: '<circle cx="4" cy="4" r="2.4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="1.6 1.4"/>' },
    derived: { label: "Derived by Finora", dots: '<rect x="1.5" y="1.5" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.2"/>' },
  };
  const conf = (k) => `<span class="conf" title="Confidence: ${CONF[k].label}"><svg viewBox="0 0 14 8" aria-hidden="true">${CONF[k].dots}</svg>${CONF[k].label}</span>`;
  const aiTag = () => `<span class="tag tag-ai" title="Written by an AI model from the cited findings">${icon("agent", "icon icon-sm")}AI-written</span>`;
  const ruleTag = () => `<span class="tag tag-rule" title="Set by fixed rules from the checks below; the same inputs give the same level">Rule-based</span>`;
  const agentTag = (name) => `<span class="tag tag-agent">${icon("agent", "icon icon-sm")}Agent finding${name ? ` · ${esc(name)}` : ""}</span>`;
  const SEV = {
    none_found: ["sev-none", "check", "None found"],
    point_to_check: ["sev-point", "bang", "Point to check"],
    concern: ["sev-concern", "x", "Concern"],
    not_checked: ["sev-notchecked", "dash", "Not checked"],
  };
  const sev = (k) => `<span class="sev ${SEV[k][0]}">${icon(SEV[k][1], "icon icon-sm")}${SEV[k][2]}</span>`;

  /* ---------- FieldRow: one row, every display state ----------
     state: data | checked_none | not_published | not_checked | disputed | loading
     not_checked.reason: later | error | skipped | paid_only | needs_key | needs_purpose | agent_only | manual_lookup | restricted */
  function stateLine(r) {
    switch (r.state) {
      case "checked_none":
        return `<span class="state-line checked">${icon("check", "icon icon-sm")}<span>Checked ${esc(r.sourceName)} as of ${esc(r.asOf)}: none found</span></span>`;
      case "not_published":
        return `<span class="state-line">${icon("dash", "icon icon-sm")}<span>${esc(r.text || `Not published in ${r.country}`)}</span></span>`;
      case "disputed":
        return `<span class="state-line">${icon("flag", "icon icon-sm")}<span>Under review after an objection, since ${esc(r.since)}</span></span>`;
      case "loading":
        return `<span class="sk" style="width:${r.w || 60}%" aria-hidden="true"></span><span class="sr-only">Loading</span>`;
      case "not_checked":
        return notChecked(r);
      default:
        return "";
    }
  }
  function notChecked(r) {
    switch (r.reason) {
      case "paid_only":
        return `<span class="state-line">${icon("euro", "icon icon-sm")}<span>${esc(r.text || "Available as a paid register extract")}${r.orderUrl ? ` · <a href="#" onclick="return false">Order from the register ${icon("ext", "icon icon-sm")}</a>` : ""}</span></span>`;
      case "needs_key":
        return `<span class="state-line">${icon("key", "icon icon-sm")}<span>${esc(r.text || "Add your key to check")} · <a href="settings.html?state=keys-missing">Settings</a></span></span>`;
      case "agent_only":
        return `<span class="state-line">${icon("agent", "icon icon-sm")}<span>Not checked here: the ${esc(r.agent)} agent checks this when you investigate</span></span>`;
      case "manual_lookup":
        return `<span class="state-line">${icon("hand", "icon icon-sm")}<span>Check manually at ${esc(r.site)} · <a href="#" onclick="return false">Open ${icon("ext", "icon icon-sm")}</a></span></span>`;
      case "restricted":
        return `<span class="state-line lock">${icon("lock", "icon icon-sm")}<span>${esc(r.text || `Not shown in ${r.country}: restricted by ${r.basis}`)}</span></span>`;
      case "error":
        return `<span class="state-line error">${icon("warn", "icon icon-sm")}<span>Not checked: ${esc(r.text || "the register did not answer")} · <button class="link-btn" type="button">Retry</button></span></span>`;
      case "later":
        return `<span class="state-line">${icon("dash", "icon icon-sm")}<span>Not checked in this version</span></span>`;
      case "not_evaluated":
        return `<span class="state-line">${icon("clock", "icon icon-sm")}<span>Not evaluated: tracked since ${esc(r.since)}</span></span>`;
      default:
        return `<span class="state-line">${icon("dash", "icon icon-sm")}<span>Not checked${r.text ? `: ${esc(r.text)}` : ""}</span></span>`;
    }
  }
  function fieldRow(label, r) {
    const value =
      r.state === "data"
        ? `<span class="row-main"><span class="${r.partial ? "partial-mark" : ""}" ${r.partial ? `title="${esc(r.partial)}"` : ""}>${r.html ?? esc(r.value)}</span>${r.note ? `<span class="muted small">${esc(r.note)}</span>` : ""}</span>
           ${r.partial ? `<span class="caveat">${icon("info", "icon icon-sm")}<span>${esc(r.partial)}</span></span>` : ""}`
        : stateLine(r);
    const caveat = r.caveat ? `<span class="caveat">${icon("info", "icon icon-sm")}<span>${esc(r.caveat)}</span></span>` : "";
    const end = r.src ? `<span class="row-end">${r.conf ? conf(r.conf) : ""}${chip(r.src, { stale: r.stale })}</span>` : "";
    return `<div class="row" data-item="${esc(r.item || "")}"><span class="row-label">${esc(label)}</span><span class="row-value">${value}${caveat}</span>${end}</div>`;
  }

  /* ---------- Section ---------- */
  function section({ id, sid, title, body, end = "", cls = "" }) {
    return `<section class="section ${cls}" id="${id}" aria-labelledby="${id}-h">
      <div class="section-head"><h2 id="${id}-h">${esc(title)}</h2><span class="sid">${esc(sid)}</span>
        <span class="end">${end}<button class="link-btn" type="button" data-problem="${esc(title)} (${esc(sid)})" title="Report an error or object to this section">Report a problem</button></span></div>
      ${body}
    </section>`;
  }

  function sparkline(values, w = 72, h = 20) {
    const v = values.filter((x) => x != null);
    if (v.length < 2) return "";
    const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
    const pts = values.map((x, i) => (x == null ? null : `${((i / (values.length - 1)) * (w - 2) + 1).toFixed(1)},${(h - 2 - ((x - min) / span) * (h - 4)).toFixed(1)}`)).filter(Boolean);
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts.join(" ")}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" opacity="0.8"/></svg>`;
  }

  function sheet({ title, body, actions, label }) {
    return `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label || title)}"><h2>${esc(title)}</h2>${body}<div class="sheet-actions">${actions}</div></div></div>`;
  }

  function mount(active, render, controls, opts) {
    document.body.innerHTML = shell(active, render(), opts);
    document.querySelectorAll(".tbl-scroll").forEach((el) => {
      el.tabIndex = 0;
      el.setAttribute("role", "region");
      const sec = el.closest("section");
      const h = sec && sec.querySelector("h2");
      el.setAttribute("aria-label", `${h ? h.textContent.trim() + " table" : "Table"}, scrolls sideways on small screens`);
    });
    if (controls) switcher(controls);
    const s = document.querySelector(".scrim .sheet");
    if (s) (s.querySelector(".btn-primary") || s.querySelector("a, button")).focus();
    if (param("cmd", "") === "open") openCmd();
    if (param("problem", "") === "open") openProblem("Paraugs Timber SIA, Securing measures (S09)");
  }

  window.Finora = { esc, param, icon, chip, conf, aiTag, ruleTag, agentTag, sev, fieldRow, stateLine, notChecked, section, sparkline, sheet, mount, toggleTheme, openCmd, openProblem, closeLayer };
})();
