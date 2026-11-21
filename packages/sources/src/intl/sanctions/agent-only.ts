// The live-only lists (sanctions.md §9): no loader and no stored row. The legal agent reads the
// official page at query time and keeps only the investigation's citation. These entries let the
// licence registry, the source page and the citations know each list; the licence test proves
// none of them can be stored.
import type { FieldMap, SourceMeta } from "../../types.ts";

type AgentList = { meta: SourceMeta; fieldMap: FieldMap };

function list(id: string, country: SourceMeta["country"], itemId: string, url: string, hosts: string[], licence: string, publisher: string): AgentList {
  return {
    meta: {
      id,
      country,
      publisher,
      homepage: url,
      officialHosts: hosts,
      licence,
      attribution: publisher,
      storage: "agent-only",
      cadence: "on-view",
      publishedAtUtc: null,
      asOf: ["http_last_modified"],
      maxPurgeShare: 0,
      purgeScope: "none",
      deepLink: null,
      rawCache: false,
      orderUrl: null,
      requires: [],
      limits: { requestsPerSecond: 1 },
      items: [itemId],
    },
    // What the agent reads: the page, cited in the investigation document only.
    fieldMap: [{ field: "page", target: { prop: "sourceUrl" }, itemId, personal: false }],
  };
}

export const AGENT_ONLY_LISTS: readonly AgentList[] = [
  list("un-sc", "intl", "S11.ALL.05", "https://scsanctions.un.org/resources/xml/en/consolidated.xml", ["scsanctions.un.org", "unsolprodfiles.blob.core.windows.net"], "un-site-terms", "United Nations Security Council"),
  list("lt-fntt", "lt", "S11.LT.01", "https://fntt.lrv.lt/en/international-financial-sanctions/a-list-of-sanctioned-subjects/", ["fntt.lrv.lt"], "none-stated", "Financial Crime Investigation Service (LT)"),
  list("lt-lb-sites", "lt", "S11.LT.02", "https://www.lb.lt/illegalwww?export=csv", ["www.lb.lt"], "lb-credit-source", "Bank of Lithuania"),
  list("lt-gambling", "lt", "S11.LT.02", "https://blokuojama.lpt.lt/wp-content/uploads/bankams.txt", ["blokuojama.lpt.lt"], "none-stated", "Gambling Supervisory Authority (LT)"),
  list("lv-bank-warnings", "lv", "S11.LV.03", "https://www.bank.lv/", ["www.bank.lv"], "all-rights-reserved-link-quote", "Latvijas Banka"),
  list("lv-ptac", "lv", "S11.LV.03", "https://registri.ptac.gov.lv/register/suspicious-internet-and-communication", ["registri.ptac.gov.lv"], "all-rights-reserved-link-quote", "Consumer Rights Protection Centre (LV)"),
  list("ee-mfa", "ee", "S11.EE.01", "https://www.vm.ee/en/list-subjects-sanction-government-republic-protect-estonias-security-and-interests-and-against", ["www.vm.ee"], "none-stated", "Ministry of Foreign Affairs (EE)"),
  list("ee-fi-alerts", "ee", "S11.EE.02", "https://www.fi.ee/en/alerts", ["www.fi.ee"], "none-stated", "Finantsinspektsioon (EE)"),
  list("ee-ttja", "ee", "S11.EE.02", "https://jvis.ttja.ee/modules/tarbijavaidluskomisjoni-otsused/mustnimekiri", ["jvis.ttja.ee"], "none-stated", "Consumer Protection and Technical Regulatory Authority (EE)"),
];
