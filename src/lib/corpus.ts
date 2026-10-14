import type { Citation, EvidenceDoc, SourceClass } from "../types";
import { norm } from "./util";

/** Source ranking used everywhere: stronger classes are searched and preferred first. */
export const SOURCE_RANK: SourceClass[] = ["api", "technical", "other", "marketing"];

export const SOURCE_LABEL: Record<SourceClass, string> = {
  api: "API or source documentation",
  technical: "Technical document",
  marketing: "Marketing copy",
  other: "Other",
};

export interface FindOptions {
  role?: Citation["role"];
  exclude?: (lineText: string) => boolean;
  classes?: SourceClass[];
}

export function ranked(docs: EvidenceDoc[]): EvidenceDoc[] {
  return [...docs].sort((a, b) => SOURCE_RANK.indexOf(a.sourceClass) - SOURCE_RANK.indexOf(b.sourceClass));
}

/** Find the first line in the corpus containing the anchor text. Returns null when it isn't there. */
export function findAnchor(docs: EvidenceDoc[], anchor: string, opts: FindOptions = {}): Citation | null {
  const a = norm(anchor);
  for (const d of ranked(docs)) {
    if (opts.classes && !opts.classes.includes(d.sourceClass)) continue;
    for (const p of d.pages) {
      for (const l of p.lines) {
        if (!norm(l.text).includes(a)) continue;
        if (opts.exclude && opts.exclude(l.text)) continue;
        return {
          docId: d.id,
          docName: d.name,
          docLabel: d.label,
          fileType: d.fileType,
          page: p.num,
          line: l.n,
          text: l.text,
          role: opts.role ?? "support",
        };
      }
    }
  }
  return null;
}

/** Resolve a list of anchors. `ok` is false if any required anchor is missing. */
export function resolveAll(docs: EvidenceDoc[], required: string[], optional: string[] = [], opts: FindOptions = {}) {
  const found: Citation[] = [];
  const missing: string[] = [];
  for (const a of required) {
    const c = findAnchor(docs, a, opts);
    if (c) found.push(c); else missing.push(a);
  }
  for (const a of optional) {
    const c = findAnchor(docs, a, { ...opts, role: opts.role ?? "support" });
    if (c) found.push(c);
  }
  return { ok: missing.length === 0, found, missing };
}

/** Pull the first quoted passage from a cell, used to resolve citations for the uploaded draft. */
export function quotedPassages(text: string): string[] {
  const out: string[] = [];
  const re = /["\u201c]([^"\u201d]{12,})["\u201d]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[1].replace(/[.\s]+$/, ""));
  return out;
}

export const dedupe = (cs: Citation[]) =>
  cs.filter((c, i) => cs.findIndex((d) => d.docId === c.docId && d.page === c.page && d.line === c.line) === i);
