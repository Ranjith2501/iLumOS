import type { DocPage, EvidenceDoc, SourceClass } from "../types";
import { uid } from "./util";

/** Classify a document by name and content so retrieval can rank it. */
export function classify(name: string, text: string): SourceClass {
  const n = name.toLowerCase();
  const t = text.toLowerCase().slice(0, 4000);
  if (/api|developer|source[-_ ]?code|firmware/.test(n) || /\bget \/v\d/.test(t)) return "api";
  if (/brochure|marketing|flyer|product[-_ ]page|ad[-_ ]copy/.test(n) || /marketing brochure/.test(t)) return "marketing";
  if (/spec|whitepaper|datasheet|technical|manual|teardown|report|guide/.test(n) || /specification|whitepaper/.test(t)) return "technical";
  return "other";
}

/** Short label used in citations. */
export function labelFor(name: string): string {
  const n = name.replace(/\.(pdf|docx|txt|md)$/i, "");
  if (/AT-SPEC-3200/i.test(n)) return "AT-SPEC-3200 spec sheet";
  if (/AT-WP-07/i.test(n)) return "AT-WP-07 whitepaper";
  if (/brochure/i.test(n)) return "SmartTherm Pro brochure";
  if (/api/i.test(n)) return "Acme API reference v3";
  return n.replace(/[_-]+/g, " ").slice(0, 48);
}

export function makeDoc(name: string, fileType: EvidenceDoc["fileType"], pages: DocPage[], origin: EvidenceDoc["origin"]): EvidenceDoc {
  const all = pages.flatMap((p) => p.lines.map((l) => l.text)).join("\n");
  return {
    id: uid("doc"),
    name,
    label: labelFor(name),
    fileType,
    sourceClass: classify(name, all),
    pages,
    addedAt: Date.now(),
    origin,
  };
}
