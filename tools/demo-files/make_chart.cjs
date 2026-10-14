// Generates the demo claim chart (.docx) for the iLumos prototype.
// Not needed to run the app; the output already lives in public/demo-files/.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  HeadingLevel, ShadingType, BorderStyle, PageOrientation, AlignmentType,
} = require("docx");

const OUT = process.argv[2] || ".";
const FONT = "Calibri";
const NAVY = "0B1F3F";

const p = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 80 },
    children: [new TextRun({ text, font: FONT, size: opts.size ?? 21, bold: opts.bold, color: opts.color, italics: opts.italics })],
  });

const border = { style: BorderStyle.SINGLE, size: 4, color: "9AA4B2" };
const borders = { top: border, bottom: border, left: border, right: border };

// widths in DXA, landscape letter content width = 15840 - 2*1080 = 13680
const COLS = [900, 3300, 4980, 4500];

const cell = (paras, width, header = false) =>
  new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: "E8EDF5" } : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: paras.map((t) =>
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: t, font: FONT, size: header ? 20 : 20, bold: header, color: header ? NAVY : "1F2430" })],
      })
    ),
  });

const rows = [
  ["SNo", "Patent Claim Element", "Accused Product Feature (Evidence)", "Reasoning"],
  [
    "1",
    "[1a] A temperature control device with a wireless communication module",
    'Acme SmartTherm Pro product page states: "WiFi-enabled smart thermostat connects to your home network."|Source: SmartTherm Pro product page',
    "The Acme device has WiFi capability which satisfies the wireless communication module requirement.",
  ],
  [
    "2",
    "[1b] A motion sensor for detecting occupancy",
    'Acme technical specifications document shows: "Built-in motion sensor detects when people are home."|Source: AT-SPEC-3200 Technical Specifications',
    "Motion sensor explicitly mentioned in specs directly maps to the claim element for occupancy detection.",
  ],
  [
    "3",
    "[1c] Machine learning algorithm that learns user temperature preferences over time",
    'Acme marketing materials claim: "Auto-Schedule learns your preferred temperatures."|Source: SmartTherm Pro brochure',
    "The learning behavior described suggests ML algorithm, though technical implementation details are not disclosed. May need stronger technical evidence.",
  ],
];

const table = new Table({
  width: { size: COLS.reduce((a, b) => a + b, 0), type: WidthType.DXA },
  columnWidths: COLS,
  rows: rows.map((r, i) =>
    new TableRow({
      tableHeader: i === 0,
      children: r.map((c, j) => cell(c.split("|"), COLS[j], i === 0)),
    })
  ),
});

const doc = new Document({
  creator: "iLumos prototype (demo data)",
  title: "Claim Chart: US 123,456 v. Acme SmartTherm Pro",
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        },
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 160 },
          children: [new TextRun({ text: "Claim Chart: U.S. Patent No. 123,456 v. Acme Corp. SmartTherm Pro", font: FONT, size: 32, bold: true, color: NAVY })],
        }),
        p('Patent: US 123,456, "Adaptive Climate Control System with Occupancy Sensing"'),
        p("Accused product: Acme SmartTherm Pro (Model AT-3200)"),
        p("Asserted claim: Claim 1"),
        p("Status: DRAFT v0.3, prepared for internal review", { after: 200, color: "6B7280" }),
        p("Claim 1", { bold: true, after: 60 }),
        p("1. A climate control system, comprising:", { after: 40 }),
        p("[1a] a temperature control device with a wireless communication module;", { after: 40 }),
        p("[1b] a motion sensor for detecting occupancy;", { after: 40 }),
        p("[1c] a machine learning algorithm that learns user temperature preferences over time; and", { after: 40 }),
        p("[1d] a plurality of temperature sensors positioned at different locations within a structure.", { after: 240 }),
        table,
        p("", { after: 120 }),
        p("Fictional demo data created for the iLumos prototype. Patent, parties and products are invented.", { size: 17, italics: true, color: "6B7280" }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const f = path.join(OUT, "US123456_vs_Acme_SmartTherm_Claim_Chart_DRAFT.docx");
  fs.writeFileSync(f, buf);
  console.log("wrote", f);
});
