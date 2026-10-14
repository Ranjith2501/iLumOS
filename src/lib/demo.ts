/** Demo files bundled in /public/demo-files. */
export const DEMO_FILES = {
  chart: "US123456_vs_Acme_SmartTherm_Claim_Chart_DRAFT.docx",
  evidence: [
    "Acme_SmartTherm_Technical_Specifications_AT-SPEC-3200.pdf",
    "Acme_AutoSchedule_Engineering_Whitepaper_AT-WP-07.pdf",
    "Acme_SmartTherm_Pro_Brochure.pdf",
  ],
  /** Held back on purpose: upload it mid-chat to resolve the "no evidence found" edge case. */
  heldBack: "Acme_Developer_API_Reference_v3.pdf",
};

/** The one URL the offline build can "fetch" (served from a bundled snapshot). */
export const DEMO_URL = "https://developer.acme-home.example/api/v3/autoschedule";
