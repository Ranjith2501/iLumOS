import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";
import type { DocPage, EvidenceDoc } from "../types";
import { makeDoc } from "./docmeta";
export { DEMO_FILES, DEMO_URL } from "./demo";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type ParsedFile =
  | { kind: "chart"; file: File; html: string; text: string }
  | { kind: "evidence"; doc: EvidenceDoc };

const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

async function pdfPages(buf: ArrayBuffer): Promise<DocPage[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  const pages: DocPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    // group text items into visual lines by their baseline
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of tc.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push({ x: it.transform[4], s: it.str });
    }
    const lines = [...rows.keys()]
      .sort((a, b) => b - a)
      .map((y) => rows.get(y)!.sort((a, b) => a.x - b.x).map((r) => r.s).join(" ").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .map((text, idx) => ({ n: idx + 1, text }));
    pages.push({ num: i, lines });
  }
  return pages;
}

function textPages(text: string): DocPage[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((t, i) => ({ n: i + 1, text: t }));
  return [{ num: 1, lines }];
}

export function looksLikeChart(name: string, text: string): boolean {
  const n = name.toLowerCase();
  return /claim[-_ ]?chart/.test(n) || /claim element/i.test(text) && /reasoning/i.test(text);
}

export async function parseFile(file: File, origin: EvidenceDoc["origin"], forceKind?: "chart" | "evidence"): Promise<ParsedFile> {
  const e = ext(file.name);
  const buf = await file.arrayBuffer();

  if (e === "docx") {
    const [html, raw] = await Promise.all([
      mammoth.convertToHtml({ arrayBuffer: buf }),
      mammoth.extractRawText({ arrayBuffer: buf.slice(0) }),
    ]);
    const isChart = forceKind ? forceKind === "chart" : looksLikeChart(file.name, raw.value);
    if (isChart) return { kind: "chart", file, html: html.value, text: raw.value };
    return {
      kind: "evidence",
      doc: makeDoc(file.name, "docx", textPages(raw.value), origin),
    };
  }

  if (e === "pdf") {
    const pages = await pdfPages(buf);
    return { kind: "evidence", doc: makeDoc(file.name, "pdf", pages, origin) };
  }

  if (e === "txt" || e === "md") {
    const text = new TextDecoder().decode(buf);
    return { kind: "evidence", doc: makeDoc(file.name, "txt", textPages(text), origin) };
  }

  throw new Error(`${file.name} is a .${e || "unknown"} file. Upload PDF, Word (.docx), or plain text.`);
}

// ---------------------------------------------------------------------------
// Demo files bundled in /public/demo-files
// ---------------------------------------------------------------------------
export async function fetchDemoFile(name: string): Promise<File> {
  const res = await fetch(`${import.meta.env.BASE_URL}demo-files/${name}`);
  if (!res.ok) throw new Error(`Couldn't load demo file ${name} (HTTP ${res.status}).`);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type });
}
