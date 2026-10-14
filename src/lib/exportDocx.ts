import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer, PageOrientation, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import type { Author, RowStatus, Session } from "../types";
import { current, visibleRows } from "./chart";
import { exportIssues } from "./engine";
import { citeLabel, dateTimeLabel } from "./util";

const FONT = "Calibri";
const NAVY = "0B1F3F";
const MUTED = "5B6577";
const border = { style: BorderStyle.SINGLE, size: 4, color: "A3ADBD" };
const borders = { top: border, bottom: border, left: border, right: border };

const run = (text: string, o: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}) =>
  new TextRun({ text, font: FONT, size: o.size ?? 20, bold: o.bold, color: o.color, italics: o.italics });
const para = (children: TextRun[], after = 80) => new Paragraph({ spacing: { after }, children });
const line = (text: string, o: Parameters<typeof run>[1] & { after?: number } = {}) => para([run(text, o)], o.after ?? 80);

const STATUS: Record<RowStatus, string> = {
  technical: "Technical source",
  weak: "Marketing copy only",
  missing: "No evidence",
  asserted: "Analyst-asserted, unverified",
};
const AUTHOR: Record<Author, string> = {
  original: "Uploaded draft",
  ai: "AI-proposed, analyst-approved",
  analyst: "Analyst-authored",
  revert: "Analyst revert",
};

function cell(paras: Paragraph[], width: number, fill?: string) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: fill ? { type: ShadingType.CLEAR, color: "auto", fill } : undefined,
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    children: paras,
  });
}

export async function exportDocx(s: Session, override?: string) {
  const { chart } = s;
  const rows = visibleRows(chart);
  const issues = exportIssues(s);
  const COLS = [800, 3000, 5180, 4700]; // sums to 13680 (landscape letter, 0.75in margins)

  const header = new TableRow({
    tableHeader: true,
    children: ["SNo", "Patent Claim Element", "Accused Product Feature (Evidence)", "Reasoning"].map((h, i) =>
      cell([para([run(h, { bold: true, color: NAVY })], 0)], COLS[i], "E8EDF5")
    ),
  });

  const body = rows.map((r, i) => {
    const cv = current(r);
    const flags = [STATUS[cv.status], `${AUTHOR[cv.author]}, row v${cv.v}`];
    if (r.disputed) flags.push(`Disputed: ${r.disputed}`);
    const gap = s.gaps.find((g) => g.rowId === r.id && !g.resolved);
    if (gap) flags.push(`Evidence gap: ${gap.text}`);
    return new TableRow({
      children: [
        cell([line(String(i + 1), { after: 0 })], COLS[0]),
        cell([line(`${r.tag} ${r.element}`, { after: 0 })], COLS[1]),
        cell([
          line(cv.evidence || "No evidence identified."),
          ...(cv.source ? [line(`Source: ${cv.source}`, { color: MUTED, size: 18 })] : []),
          line(flags.join(". ") + ".", { color: MUTED, size: 16, italics: true, after: 0 }),
        ], COLS[2]),
        cell([line(cv.reasoning || "", { after: 0 })], COLS[3]),
      ],
    });
  });

  const table = new Table({
    width: { size: COLS.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: COLS,
    rows: [header, ...body],
  });

  // citation appendix
  const citeParas: Paragraph[] = [];
  let citeCount = 0;
  for (const r of rows) {
    const cs = current(r).citations;
    if (!cs.length) continue;
    citeParas.push(line(`${r.tag} ${r.element}`, { bold: true, color: NAVY, after: 40 }));
    for (const c of cs) {
      citeCount++;
      citeParas.push(para([
        run(`${citeLabel(c)}${c.role === "context" ? " (context)" : ""}: `, { bold: true, size: 18 }),
        run(`“${c.text}”`, { size: 18 }),
      ], 40));
    }
    citeParas.push(line("", { after: 60 }));
  }

  // change log
  const LOGW = [1300, 1200, 4600, 3300, 3280];
  const logRows = [
    new TableRow({ tableHeader: true, children: ["Chart version", "Element", "Change", "Author", "Time"].map((h, i) => cell([para([run(h, { bold: true, color: NAVY, size: 18 })], 0)], LOGW[i], "E8EDF5")) }),
    ...s.changeLog.map((e) => new TableRow({
      children: [
        `v${e.chartVersion}`, e.tag, e.action, AUTHOR[e.author], dateTimeLabel(e.at),
      ].map((t, i) => cell([para([run(t, { size: 18 })], 0)], LOGW[i])),
    })),
  ];
  const logTable = new Table({ width: { size: LOGW.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: LOGW, rows: logRows });

  const H = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 }, children: [run(text, { bold: true, color: NAVY, size: 26 })] });

  const doc = new Document({
    creator: "iLumos prototype",
    title: `${chart.title} (refined v${chart.version})`,
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 140 }, children: [run(chart.title, { bold: true, color: NAVY, size: 32 })] }),
        line(`Patent: ${chart.patent}${chart.patentTitle ? `, “${chart.patentTitle}”` : ""}`),
        line(`Accused product: ${chart.product}`),
        line(`Asserted claim: ${chart.claimLabel}`),
        line(`Refined chart version ${chart.version}, exported ${dateTimeLabel(Date.now())} from iLumos`, { color: MUTED, after: 200 }),
        ...(chart.preamble ? [line(chart.preamble, { bold: true, after: 40 })] : []),
        ...chart.elements.map((e) => line(`${e.tag} ${e.text}`, { after: 40 })),
        line("", { after: 160 }),
        table,
        ...(issues.length || override
          ? [
              H("Open items for counsel"),
              ...issues.map((i) => line(`• ${i.text}`)),
              ...(override ? [line(`Exported with open items. Analyst’s reason: “${override}”`, { italics: true, color: MUTED })] : []),
            ]
          : []),
        H("Citation appendix"),
        line("Every quotation in the chart, with the document, page and line it was taken from.", { color: MUTED, after: 140 }),
        ...citeParas,
        H("Change log"),
        logTable,
        H("Session record"),
        line(`Instructions: ${s.instructions.tone === "formal" ? "formal legal tone" : "plain English"}; claim construction risks ${s.instructions.flagClaimConstruction ? "flagged" : "not flagged"}.${s.instructions.custom ? ` Additional: “${s.instructions.custom}”` : ""}`),
        line(`Sources searched: ${s.docs.map((d) => d.name).join("; ")}.`),
        ...(s.corrections.length ? [line(`Analyst corrections logged: ${s.corrections.length} (${[...new Set(s.corrections.map((c) => c.kind))].join(", ")}).`)] : []),
        new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 240 }, children: [run("Fictional demo data created for the iLumos prototype. Patent, parties and products are invented.", { italics: true, size: 16, color: MUTED })] }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const base = chart.fileName.replace(/\.docx$/i, "").replace(/_?draft$/i, "");
  const fileName = `${base}_refined_v${chart.version}.docx`;
  return { blob, fileName, citations: citeCount, changes: s.changeLog.length };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
