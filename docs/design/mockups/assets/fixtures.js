/* Fictional fixture data for the mockups. Every name, code, address and figure is made up.
   Codes carry "FX" so they can never match a real register entry. Section calls follow
   docs/plan/council/01-data.md Part G. */
(function () {
  "use strict";

  const S = {
    // Latvia
    urLV: { name: "Enterprise Register of Latvia, register file (data.gov.lv)", short: "Register LV", licence: "CC0 1.0", asOf: "19 Nov", asOfLong: "19 Nov 2026", cadence: "daily", url: true },
    urNames: { name: "Enterprise Register of Latvia, name history", short: "Register LV", licence: "CC0 1.0", asOf: "2 Apr 2025", asOfLong: "2 Apr 2025", cadence: "daily", url: true },
    urOfficers: { name: "Enterprise Register of Latvia, officers", short: "Register LV", licence: "CC0 1.0", asOf: "19 Nov", asOfLong: "19 Nov 2026", tier: "open data, shown after a stated purpose", url: true },
    urMembers: { name: "Enterprise Register of Latvia, members", short: "Register LV", licence: "CC0 1.0", asOf: "19 Nov", asOfLong: "19 Nov 2026", url: true },
    fsLV: { name: "Enterprise Register of Latvia, annual report financial data", short: "Annual reports LV", licence: "CC0 1.0", asOf: "FY 2025", asOfLong: "Financial year ending 31 Dec 2025, filed 28 Apr 2026", cadence: "daily", url: true },
    vid: { name: "State Revenue Service, quarterly taxes and employees", short: "Tax LV", licence: "CC0 1.0", asOf: "Q3 2026", asOfLong: "Third quarter 2026, published 3 Nov 2026", cadence: "quarterly" },
    vidRating: { name: "State Revenue Service, taxpayer rating", short: "Tax rating LV", licence: "CC0 1.0", asOf: "11 Nov", asOfLong: "11 Nov 2026", cadence: "monthly" },
    insLV: { name: "Insolvency register and securing measures (Enterprise Register)", short: "Insolvency LV", licence: "CC0 1.0", asOf: "19 Nov", asOfLong: "19 Nov 2026", url: true },
    fiuLV: { name: "Financial Intelligence Unit, sanctioned subjects with assets frozen in Latvia", short: "FIU list LV", licence: "CC0 1.0", asOf: "18 Nov", asOfLong: "18 Nov 2026" },
    // Estonia
    rik: { name: "e-Business Register open data (RIK)", short: "Register EE", licence: "CC BY 4.0", asOf: "19 Nov", asOfLong: "19 Nov 2026", cadence: "daily", url: true },
    rikFs: { name: "e-Business Register, annual report key figures", short: "Annual reports EE", licence: "CC BY 4.0", asOf: "FY 2025", asOfLong: "Financial year ending 31 Dec 2025", cadence: "monthly", url: true },
    emtaDebt: { name: "Tax and Customs Board, tax debtors", short: "Tax debtors EE", licence: "CC BY-SA 3.0 (share-alike, kept in its own store)", asOf: "19 Nov", asOfLong: "19 Nov 2026", cadence: "daily", tier: "open data, share-alike store" },
    emtaTax: { name: "Tax and Customs Board, taxes paid and employees", short: "Tax EE", licence: "CC BY-SA 3.0 (share-alike, kept in its own store)", asOf: "Q3 2026", asOfLong: "Third quarter 2026", cadence: "quarterly", tier: "open data, share-alike store" },
    // Lithuania
    jar: { name: "Registrų centras, Register of Legal Entities (open data)", short: "Register LT", licence: "CC BY 4.0", asOf: "19 Nov", asOfLong: "19 Nov 2026", cadence: "daily", url: true },
    jarFs: { name: "Registrų centras, financial statements", short: "Statements LT", licence: "CC BY 4.0", asOf: "FY 2025", asOfLong: "Financial year ending 31 Dec 2025, loaded 28 Oct 2026", cadence: "monthly", url: true },
    vmiArrears: { name: "State Tax Inspectorate (VMI), tax arrears", short: "Arrears LT", licence: "CC BY 4.0", asOf: "19 Nov", asOfLong: "19 Nov 2026", cadence: "daily" },
    vmiTax: { name: "State Tax Inspectorate (VMI), taxes paid", short: "Tax LT", licence: "CC BY 4.0", asOf: "Oct 2026", asOfLong: "Year to date, through October 2026", cadence: "monthly" },
    sodra: { name: "Sodra, public insurer data", short: "Sodra LT", licence: "No licence stated by the publisher (public by law)", asOf: "19 Nov", asOfLong: "19 Nov 2026", cadence: "daily" },
    // United States
    sec: { name: "SEC EDGAR, submissions and filings", short: "SEC", licence: "Public domain (US government work)", asOf: "18 Nov", asOfLong: "18 Nov 2026", url: true },
    secFacts: { name: "SEC EDGAR, XBRL company facts", short: "SEC XBRL", licence: "Public domain (US government work)", asOf: "FY 2025", asOfLong: "Fiscal year ending 28 Sep 2025 (10-K)", url: true },
    sec345: { name: "SEC EDGAR, Forms 3, 4 and 5", short: "SEC Forms 4", licence: "Public domain (US government work)", asOf: "17 Nov", asOfLong: "17 Nov 2026", tier: "open data, shown after a stated purpose", url: true },
    coSos: { name: "Colorado Secretary of State, business entities", short: "Colorado SOS", licence: "Public domain (state open data)", asOf: "18 Nov", asOfLong: "18 Nov 2026", cadence: "daily", url: true },
    coUcc: { name: "Colorado Secretary of State, UCC filings", short: "UCC CO", licence: "Public domain (state open data)", asOf: "18 Nov", asOfLong: "18 Nov 2026", cadence: "daily" },
    samEx: { name: "SAM.gov exclusions", short: "SAM exclusions", licence: "US government work", asOf: "19 Nov", asOfLong: "19 Nov 2026", cadence: "daily" },
    // Cross-border
    eu: { name: "EU consolidated financial sanctions list", short: "EU sanctions", licence: "CC BY 4.0, © European Union", asOf: "19 Nov", asOfLong: "19 Nov 2026" },
    ofac: { name: "OFAC SDN and non-SDN lists", short: "OFAC", licence: "US government work", asOf: "19 Nov", asOfLong: "19 Nov 2026" },
    uk: { name: "UK Sanctions List", short: "UK sanctions", licence: "Open Government Licence v3.0", asOf: "18 Nov", asOfLong: "18 Nov 2026" },
    esma: { name: "ESMA non-compliant crypto-asset providers", short: "ESMA", licence: "Reuse with credit to ESMA", asOf: "15 Nov", asOfLong: "15 Nov 2026" },
    gleif: { name: "GLEIF golden copy", short: "GLEIF", licence: "CC0 1.0", asOf: "19 Nov", asOfLong: "19 Nov 2026, 16:00 UTC" },
    derivedAddr: { kind: "derived", name: "Shared registered-office count", inputs: "Register addresses of companies only", short: "", licence: "Our own computation over CC0 data", asOf: "19 Nov" },
    // Agent sources (web)
    webHome: { kind: "web", name: "The company's own website, homepage", short: "web · paraugs-timber.example", licence: "Quoted up to 300 characters, with a link; not stored", asOf: "20 Nov", tier: "display only", retrieved: "20 Nov 2026, 09:42", by: "the web, domain and news agent", quote: "Kiln-dried construction timber from our sawmill near Rīga since 2014.", url: true },
    webCt: { kind: "web", name: "Certificate transparency logs", short: "web · certificate logs", licence: "Public logs", asOf: "20 Nov", tier: "query time", retrieved: "20 Nov 2026, 09:42", by: "the web, domain and news agent" },
    news: { kind: "web", name: "GDELT news index (titles and links)", short: "web · news index", licence: "Citation and link to the GDELT Project", asOf: "20 Nov", tier: "display only", retrieved: "20 Nov 2026, 09:43", by: "the web, domain and news agent", quote: "Regional sawmill expands drying capacity", url: true },
    court: { kind: "web", name: "Court rulings portal (anonymised rulings)", short: "web · court portal", licence: "Official publication, cited at query time", asOf: "20 Nov", tier: "query time", retrieved: "20 Nov 2026, 09:41", by: "the legal, insolvency and sanctions agent", url: true },
  };

  const LV = {
    key: "lv", country: "Latvia", cc: "LV",
    name: "Paraugs Timber SIA",
    longName: "Paraugs Timber, Kiln Drying, Planing and Construction Materials Trading and Logistics Company of the Northern Riga Industrial Example District, Limited Liability Company SIA (fictional long name)",
    form: ["SIA", "limited company"], status: ["Active", "", "good"],
    code: "40000FX0017", codeLabel: "Registration no.",
    registered: "12 Mar 2014", address: "Parauga iela 1, Rīga, LV-1000", activity: "16.10 Sawmilling and planing of wood",
    vat: "LV40000FX0017", lei: null,
    coverage: { official: "status, officers, company members, financial statements, taxes paid, tax rating, insolvency and securing measures, sanctions links", notOpen: "beneficial owners and members who are private individuals (restricted), tax debt amounts (manual lookup only)" },
    checks: [
      ["Pinned to a registry record", "ok", "Registration no. 40000FX0017"],
      ["Status current and active", "soft", "Active · renamed on 3 Sep 2026 (within 6 months)"],
      ["Officers on record", "ok", "2 board members"],
      ["Owners on record", "ok", "1 company member; private individuals not shown"],
      ["Accounts filed on time", "ok", "FY 2025 filed 28 Apr 2026"],
      ["Financial position", "ok", "Equity positive, profit in FY 2025"],
      ["Tax and social-insurance arrears", "ok", "Tax rating A; debt amounts are a manual lookup"],
      ["Insolvency, liquidation, pledges, securing measures", "soft", "1 open securing measure since 2 Oct 2026"],
      ["Sanctions and watchlists", "ok", "5 lists checked, none found"],
      ["Court cases", "ok", "Legal agent: 1 ruling found, company was the claimant"],
      ["Web presence consistent with the register", "ok", "Website names the same registration number"],
    ],
  };

  const EE = {
    key: "ee", country: "Estonia", cc: "EE",
    name: "Näidis Freight OÜ", form: ["OÜ", "private limited company"], status: ["Registrisse kantud", "entered in the register", "good"],
    code: "1FX000017", codeLabel: "Registry code", registered: "4 Jun 2019", address: "Näidise tn 1, Tallinn, 10111", activity: "49.41 Freight transport by road",
    vat: "EE10FX000017", lei: "5299FX00EXAMPLE00017",
    coverage: { official: "status, officers, company members, annual report figures, the daily tax-debtor list, taxes paid, pledges", notOpen: "beneficial owners and members who are private individuals (restricted), court cases (searched by the legal agent)" },
    checks: [
      ["Pinned to a registry record", "ok", "Registry code 1FX000017"],
      ["Status current and active", "ok", "Entered in the register since 4 Jun 2019"],
      ["Officers on record", "ok", "1 board member"],
      ["Owners on record", "notrun", "Owners: restricted in Estonia"],
      ["Accounts filed on time", "ok", "FY 2025 filed 30 Jun 2026"],
      ["Financial position", "ok", "Equity positive, small loss in FY 2025"],
      ["Tax and social-insurance arrears", "ok", "Not on the tax debtor list"],
      ["Insolvency, liquidation, pledges, securing measures", "soft", "1 commercial pledge registered 2024"],
      ["Sanctions and watchlists", "ok", "5 lists checked, none found"],
      ["Court cases", "ok", "Legal agent: none found"],
      ["Web presence consistent with the register", "ok", "Website matches the register's website field"],
    ],
  };

  const LT = {
    key: "lt", country: "Lithuania", cc: "LT",
    name: "Pavyzdys Bakery UAB", form: ["UAB", "private limited company"], status: ["Teisinis statusas neįregistruotas", "no legal proceedings", "good"],
    code: "30FX00017", codeLabel: "Company code", registered: "21 Jan 2011", address: "Pavyzdžio g. 1, Vilnius, LT-01100", activity: "10.71 Manufacture of bread and fresh pastry",
    vat: "LT30FX000171", lei: null,
    coverage: { official: "status, role facts (no names), financial statements, taxes paid, daily tax and social-insurance arrears, insured counts, bankruptcy reports", notOpen: "names of officers and owners (paid register extract), court cases (searched by the legal agent)" },
    checks: [
      ["Pinned to a registry record", "ok", "Company code 30FX00017"],
      ["Status current and active", "ok", "No legal proceedings"],
      ["Officers on record", "ok", "Has a manager since 21 Jan 2011 (no names in open data)"],
      ["Owners on record", "notrun", "Owners: paid register extract in Lithuania"],
      ["Accounts filed on time", "ok", "FY 2025 filed"],
      ["Financial position", "ok", "Equity positive"],
      ["Tax and social-insurance arrears", "soft", "On the tax arrears list: €3,420 since 2 Sep 2026; the 180-day age rule is not evaluated yet (tracked since 16 Nov 2026)"],
      ["Insolvency, liquidation, pledges, securing measures", "ok", "Bankruptcy reports checked (published up to Oct 2025)"],
      ["Sanctions and watchlists", "ok", "6 lists checked, none found"],
      ["Court cases", "notrun", "Legal agent did not finish (court portal timed out)"],
      ["Web presence consistent with the register", "ok", "Website names the same company code"],
    ],
  };

  const USPRIV = {
    key: "us-private", country: "the United States", cc: "US",
    name: "Sample Roofing LLC", form: ["LLC", "limited liability company, Colorado"], status: ["Good Standing", "", "good"],
    code: "2019FX00017", codeLabel: "Colorado entity ID", registered: "8 Jul 2019", address: "100 Example Ave, Denver, CO 80202", activity: "Not published by the state",
    vat: null, lei: null,
    coverage: { official: "registration and good standing in NY, CO, CT or PA, filing history where the state publishes it, UCC filings (CO and CT), federal exclusions, sanctions", notOpen: "owners, accounts and tax for private companies (no US source publishes them)" },
    checks: [
      ["Pinned to a registry record", "ok", "Colorado entity ID 2019FX00017"],
      ["Status current and active", "ok", "Good Standing"],
      ["Officers on record", "notrun", "Not published by Colorado"],
      ["Owners on record", "notrun", "No US source publishes owners of private companies"],
      ["Accounts filed on time", "notrun", "No US source publishes accounts of private companies"],
      ["Financial position", "notrun", "Not published in the US"],
      ["Tax and social-insurance arrears", "notrun", "The US publishes no tax debt data"],
      ["Insolvency, liquidation, pledges, securing measures", "ok", "UCC filings in Colorado: none found"],
      ["Sanctions and watchlists", "ok", "OFAC, SAM exclusions and 3 more lists: none found"],
      ["Court cases", "ok", "Legal agent: no federal case found"],
      ["Web presence consistent with the register", "ok", "Domain created 2019, same year as the registration"],
    ],
  };

  const USPUB = {
    key: "us-public", country: "the United States", cc: "US",
    name: "Example Instruments Inc.", form: ["Inc.", "corporation, Delaware"], status: ["Active filer", "", "good"],
    code: "99FX000017", codeLabel: "SEC CIK", registered: "Listed since 2004", address: "1 Sample Plaza, Austin, TX 78701", activity: "3825 Instruments for measuring electricity",
    vat: null, lei: "5493FX00EXAMPLE00017", ticker: "EXIN (fictional)",
    coverage: { official: "identity, filings and 8-K events, officers and insiders, XBRL financials, insider trades, sanctions", notOpen: "nothing else for public companies; court cases are searched by the legal agent" },
    checks: [
      ["Pinned to a registry record", "ok", "CIK 99FX000017"],
      ["Status current and active", "ok", "Filed a 10-Q on 6 Nov 2026"],
      ["Officers on record", "ok", "9 officers and directors (Forms 3/4/5)"],
      ["Owners on record", "ok", "3 holders above 5% (13D/G)"],
      ["Accounts filed on time", "ok", "10-K for FY 2025 filed on time"],
      ["Financial position", "ok", "Equity positive, net income positive"],
      ["Tax and social-insurance arrears", "notrun", "The US publishes no tax debt data"],
      ["Insolvency, liquidation, pledges, securing measures", "ok", "No bankruptcy filing; UCC not applicable"],
      ["Sanctions and watchlists", "ok", "OFAC and 4 more lists: none found"],
      ["Court cases", "soft", "Legal agent: 1 federal civil case, possible match by name, needs review"],
      ["Web presence consistent with the register", "ok", "Investor site links to the same CIK"],
    ],
  };

  const SOLE = {
    key: "sole-trader", country: "Lithuania", cc: "LT", natural: true,
    name: "IĮ Jonas Pavyzdys Carpentry", form: ["IĮ", "individual enterprise (sole trader)"], status: ["Teisinis statusas neįregistruotas", "no legal proceedings", "good"],
    code: "30FX00099", codeLabel: "Company code", registered: "15 May 2017", address: "Lithuania (address not shown for a sole trader)", activity: "16.23 Manufacture of other builders' carpentry",
    vat: null, lei: null,
    coverage: { official: "status, role facts, financial statements (after a stated purpose)", notOpen: "tax and arrears lines tied to a private individual (not shown), address (country only), names (paid register extract)" },
  };

  const LIBRARY = [
    { name: "Paraugs Timber SIA", cc: "LV", code: "40000FX0017", level: "points", cov: "11 of 11", when: "Today 09:44", cost: "$0.41", status: "done" },
    { name: "Näidis Freight OÜ", cc: "EE", code: "1FX000017", level: "none", cov: "10 of 11", when: "Today 08:12", cost: "$0.38", status: "done" },
    { name: "Pavyzdys Bakery UAB", cc: "LT", code: "30FX00017", level: "points", cov: "8 of 11", when: "Yesterday", cost: "$0.52", status: "partial" },
    { name: "Sample Roofing LLC", cc: "US", code: "2019FX00017", level: "insufficient", cov: "5 of 11", when: "Yesterday", cost: "$0.33", status: "done" },
    { name: "Example Instruments Inc.", cc: "US", code: "99FX000017", level: "points", cov: "10 of 11", when: "18 Nov", cost: "$0.47", status: "waiting" },
    { name: "Demo Logistics SIA", cc: "LV", code: "40000FX0042", level: "serious", cov: "9 of 11", when: "16 Nov", cost: "$1.50", status: "cap" },
    { name: "Fictional Fasteners OÜ", cc: "EE", code: "1FX000042", level: "none", cov: "10 of 11", when: "3 Nov", cost: "$0.36", status: "done" },
  ];

  window.FX = { S, LV, EE, LT, USPRIV, USPUB, SOLE, LIBRARY, SUBJECTS: { lv: LV, ee: EE, lt: LT, "us-private": USPRIV, "us-public": USPUB, "sole-trader": SOLE } };
})();
