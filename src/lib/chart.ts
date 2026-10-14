import type { Chart, ChartRow, ClaimElement, RowStatus } from "../types";

export interface ChartParseResult {
  chart: Chart;
  mapping: { column: string; mappedTo: string }[];
  unreadRows: number;
  warnings: string[];
}

const cellText = (el: Element) =>
  [...el.querySelectorAll("p")].map((p) => p.textContent?.trim() ?? "").filter(Boolean).join("\n") ||
  (el.textContent ?? "").trim();

function classifyOriginal(evidence: string, source: string): RowStatus {
  const s = `${evidence} ${source}`.toLowerCase();
  if (!evidence.trim()) return "missing";
  if (/brochure|product page|marketing|website|ad copy/.test(s)) return "weak";
  return "technical";
}

export function parseChart(html: string, rawText: string, fileName: string): ChartParseResult {
  const dom = new DOMParser().parseFromString(html, "text/html");
  const warnings: string[] = [];
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const h1 = dom.querySelector("h1")?.textContent?.trim();
  const title = h1 || lines[0] || fileName;
  const find = (re: RegExp) => lines.map((l) => l.match(re)).find(Boolean) as RegExpMatchArray | undefined;

  const pm = find(/^Patent:\s*(US\s*[\d,]+)\s*,?\s*["\u201c]?([^"\u201d]*)["\u201d]?/i);
  const product = find(/^Accused product:\s*(.+)$/i)?.[1] ?? "Accused product";
  const claimLabel = find(/^Asserted claim:\s*(.+)$/i)?.[1] ?? "Claim 1";
  const preamble = find(/^(\d+\.\s+.+comprising:?)$/i)?.[1] ?? "";

  const elements: ClaimElement[] = [];
  for (const l of lines) {
    const m = l.match(/^\[(\d+[a-z])\]\s*(.+?)\s*(?:;\s*(?:and)?|\.)?$/i);
    // the claim text lists each element once; table cells repeat the tags, so keep the first occurrence
    if (m && !elements.some((e) => e.tag === `[${m[1].toLowerCase()}]`))
      elements.push({ tag: `[${m[1].toLowerCase()}]`, text: m[2].replace(/;\s*and$/i, "").replace(/[;.]$/, "") });
  }

  // ---- table
  const table = dom.querySelector("table");
  const rows: ChartRow[] = [];
  const mapping: ChartParseResult["mapping"] = [];
  let columns: string[] = [];
  let unreadRows = 0;

  if (!table) {
    warnings.push("No table found in the document. A claim chart needs a table with claim element, evidence and reasoning columns.");
  } else {
    const trs = [...table.querySelectorAll("tr")];
    const header = trs[0] ? [...trs[0].querySelectorAll("th,td")].map(cellText) : [];
    columns = header;
    const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
    const iNo = idx(/^s\.?\s?no|^no\.?$|^#|serial/i);
    const iEl = idx(/claim element|element|limitation/i);
    const iEv = idx(/evidence|accused|feature/i);
    const iRe = idx(/reasoning|analysis|rationale/i);
    header.forEach((h, i) => {
      const to = i === iNo ? "Row number" : i === iEl ? "Claim element" : i === iEv ? "Evidence" : i === iRe ? "Reasoning" : "Not used";
      mapping.push({ column: h || `Column ${i + 1}`, mappedTo: to });
    });
    if (iEl < 0 || iEv < 0 || iRe < 0) warnings.push("Couldn't identify all three of claim element, evidence and reasoning columns.");

    trs.slice(1).forEach((tr, r) => {
      const cells = [...tr.querySelectorAll("th,td")].map(cellText);
      const elText = cells[iEl] ?? "";
      if (!elText) { unreadRows++; return; }
      const tagM = elText.match(/\[(\d+[a-z])\]/i);
      const tag = tagM ? `[${tagM[1].toLowerCase()}]` : elements[r]?.tag ?? `[${r + 1}]`;
      const element = elText.replace(/\[(\d+[a-z])\]\s*/i, "").trim();
      const evParts = (cells[iEv] ?? "").split("\n");
      const srcLine = evParts.find((p) => /^source:/i.test(p)) ?? "";
      const evidence = evParts.filter((p) => !/^source:/i.test(p)).join(" ").trim();
      const source = srcLine.replace(/^source:\s*/i, "").trim();
      const letter = tag.match(/\d+([a-z])/i)?.[1] ?? "";
      const id = letter ? `e${letter.charCodeAt(0) - 96}` : `e${r + 1}`;
      rows.push({
        id,
        tag,
        element,
        disputed: null,
        lastChangedAt: null,
        versions: [{
          v: 1,
          evidence,
          reasoning: (cells[iRe] ?? "").replace(/\n/g, " ").trim(),
          source,
          status: classifyOriginal(evidence, source),
          author: "original",
          summary: "Uploaded draft",
          at: Date.now(),
          citations: [],
          chartVersion: 1,
          keys: [],
        }],
      });
    });
  }

  const text = rawText.toLowerCase();
  const isDemoMatter = /123,?456/.test(text) && /acme/.test(text) && /smarttherm/.test(text);

  return {
    chart: {
      title,
      patent: pm?.[1]?.replace(/\s+/g, " ").replace(/,+$/, "") ?? "Patent",
      patentTitle: pm?.[2]?.trim() ?? "",
      product,
      claimLabel,
      preamble,
      elements,
      rows,
      version: 1,
      isDemoMatter,
      fileName,
      columns,
    },
    mapping,
    unreadRows,
    warnings,
  };
}

export const current = (row: ChartRow) => row.versions[row.versions.length - 1];
export const visibleRows = (chart: Chart) => chart.rows.filter((r) => !current(r).removed);
export const rowById = (chart: Chart, id: string) => chart.rows.find((r) => r.id === id);
export const unmappedElements = (chart: Chart) =>
  chart.elements.filter((e) => !visibleRows(chart).some((r) => r.tag === e.tag));
