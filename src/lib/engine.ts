import type {
  Action, Chart, ChartRow, Chip, Citation, EvidenceDoc, Instructions, Message, Mods, OpKind,
  Proposal, RejectReason, RowVersion, ScenarioKey, Session,
} from "../types";
import { current, rowById, unmappedElements, visibleRows } from "./chart";
import { findAnchor, quotedPassages } from "./corpus";
import { build, scenarioFor, type NoEvidence } from "./scenarios";
import { DEMO_FILES, DEMO_URL } from "./demo";
import { plural, uid } from "./util";

// ---------------------------------------------------------------------------
// Predefined commands (also shown in the in-app command menu and README)
// ---------------------------------------------------------------------------
export const C = {
  ML: "The AI reasoning for the ML algorithm element is weak - add more technical details",
  E2: "Add technical documentation for the motion sensor claim",
  E1: "Strengthen the evidence for element 1",
  LITE: "That's the SmartTherm Lite spec, not the Pro",
  E4: "AI missed that Acme also has a temperature sensor array",
  LEGAL: "Rewrite the reasoning to address potential claim construction arguments",
  LEGAL3: "Rewrite the reasoning for element 3 to address claim construction arguments",
  DEPLOY: "Add evidence that the shipping firmware actually runs this model",
  VAGUE: "Strengthen the evidence",
  UNDO: "Undo the last change",
  HISTORY: "Show the version history for element 3",
  EXPORT: "Export to Word",
  ACCEPT: "Accept",
  CONCISE: "Make it more concise",
  PLAIN: "Use plain English",
  DEVICE: "Also mention that it runs on the device",
  NOCC: "Remove the claim construction note",
  REJECT: "Reject",
  HELP: "What can you do?",
};

export const COMMAND_GROUPS: { title: string; items: { text: string; hint: string }[] }[] = [
  {
    title: "Refine the chart",
    items: [
      { text: C.ML, hint: "Rewrites element 3 from the engineering whitepaper" },
      { text: C.E2, hint: "Upgrades element 2 to component-level spec evidence" },
      { text: C.E1, hint: "Re-sources element 1 from the spec sheet" },
      { text: C.E4, hint: "Adds the missing [1d] row" },
      { text: C.LEGAL, hint: "Asks which element, then hardens its reasoning" },
      { text: C.VAGUE, hint: "No element named, so the AI asks one question" },
    ],
  },
  {
    title: "While a proposal is open",
    items: [
      { text: C.ACCEPT, hint: "Applies it to the chart" },
      { text: C.CONCISE, hint: "Revises the open proposal" },
      { text: C.PLAIN, hint: "Switches the open proposal’s tone" },
      { text: C.DEVICE, hint: "Element 3 only: adds on-device evidence" },
      { text: C.NOCC, hint: "Drops the claim construction note" },
      { text: "Reject, too long", hint: "Rejects with a reason, then retries" },
    ],
  },
  {
    title: "Edge cases",
    items: [
      { text: C.LITE, hint: "After the element 1 proposal: corrects a wrong citation" },
      { text: C.DEPLOY, hint: "After element 3 is fixed: no evidence found, AI asks for a source" },
      { text: C.UNDO, hint: "Previews a revert, then waits for you to confirm" },
      { text: "Undo element 3", hint: "Shows the row’s versions so you can pick one" },
      { text: C.HISTORY, hint: "Lists every version of the row" },
    ],
  },
  { title: "Finish", items: [{ text: C.EXPORT, hint: "Runs the pre-export check, then downloads .docx" }] },
];

// ---------------------------------------------------------------------------
export interface EngineResult {
  session: Session;
  replies: Message[];
  steps?: string[];
  effect?: { type: "fetchUrl"; url: string } | { type: "export"; override?: string };
}

const now = () => Date.now();
const msg = (role: Message["role"], kind: Message["kind"], f: Partial<Message> = {}): Message => ({ id: uid("m"), role, kind, at: now(), ...f });
const aiText = (text: string, chips?: Chip[]): Message => msg("ai", "text", { text, chips });
const notice = (text: string): Message => msg("system", "notice", { text });
const sendChip = (label: string, send = label, primary = false): Chip => ({ label, send, primary });

const ROW_NAMES: Record<string, string> = {
  e1: "Element 1: wireless module",
  e2: "Element 2: motion sensor",
  e3: "Element 3: machine learning",
  e4: "Element 4: temperature sensors",
};
const rowNum = (id: string) => id.replace("e", "");
const KEY_LABEL: Record<ScenarioKey, string> = {
  e1_lite: "the spec sheet connectivity line",
  e1_pro: "the AT-3200 module evidence",
  e1_legal: "the claim construction reasoning",
  e2_pir: "the §3.2 sensor evidence",
  e2_legal: "the claim construction reasoning",
  e3_ml: "the whitepaper evidence and reasoning",
  e3_legal: "the claim construction reasoning",
  e3_deploy: "the API evidence, which builds on the whitepaper text",
  e4_sensors: "the new row",
  e4_legal: "the claim construction reasoning",
};

const words = (n: number) => ["zero","one","two","three","four","five","six","seven","eight","nine"][n] ?? String(n);

export const defaultMods = (i: Instructions): Mods => ({
  tone: i.tone,
  concise: wantsConcise(i.custom),
  cc: i.flagClaimConstruction,
  onDevice: false,
  fieldData: true,
});
export const wantsConcise = (custom: string) => /\b(concise|brief|short|succinct|tight(er)?)\b/i.test(custom);

// ---------------------------------------------------------------------------
// Session creation and the opening diagnosis
// ---------------------------------------------------------------------------
export function createSession(chart: Chart, docs: EvidenceDoc[], instructions: Instructions): Session {
  const c: Chart = structuredClone(chart);
  for (const r of c.rows) {
    const v = r.versions[0];
    v.citations = quotedPassages(v.evidence)
      .map((q) => findAnchor(docs, q))
      .filter(Boolean) as Citation[];
  }
  const s: Session = {
    chart: c, docs, instructions, messages: [], proposals: {}, activeProposalId: null, pending: null,
    constraints: [], corrections: [], gaps: [], changeLog: [], startedAt: now(),
  };
  s.messages.push(instructionsNotice(instructions, true));
  s.messages.push(opening(s));
  return s;
}

function instructionsNotice(i: Instructions, start = false): Message {
  const parts = [
    i.tone === "formal" ? "formal legal tone" : "plain English",
    i.flagClaimConstruction ? "claim construction risks flagged" : "claim construction flags off",
    "every change needs your approval",
  ];
  if (wantsConcise(i.custom)) parts.splice(1, 0, "concise reasoning");
  return notice(`${start ? "Session started with instructions" : "Session instructions updated"}: ${parts.join(", ")}.${start ? "" : " This applies from the next proposal."}`);
}

function opening(s: Session): Message {
  const { chart, docs } = s;
  if (!chart.isDemoMatter) {
    return aiText(
      `I’ve read ${chart.fileName}: ${plural(visibleRows(chart).length, "row")} and ${plural(docs.length, "evidence document")}.\n\nThis demo build only has refinements wired for the sample matter (US 123,456 v. Acme SmartTherm Pro). You can browse this chart, open its sources and export it. To try the full refinement flow, go back to setup and load the demo set.`,
      [sendChip(C.HELP)]
    );
  }
  const lines: string[] = [];
  const hasWp = !!findAnchor(docs, "gradient-boosted decision tree (GBDT) regressor");
  const hasSpec = !!findAnchor(docs, "The AT-3200 includes a Panasonic EKMC-series");
  const e3 = rowById(chart, "e3");
  if (e3 && current(e3).status === "weak")
    lines.push(`- Element 3 is the weakest row. It rests on a brochure line, and its own reasoning admits implementation details aren’t disclosed. ${hasWp ? "The AT-WP-07 whitepaper in your uploads describes the actual algorithm." : "Nothing in your uploads describes the algorithm yet; the spec sheet points to whitepaper AT-WP-07."}`);
  const e1 = rowById(chart, "e1");
  if (e1 && current(e1).status === "weak") lines.push("- Element 1 is sourced from the product page, which is marketing copy.");
  const e2 = rowById(chart, "e2");
  if (e2) lines.push(`- Element 2 quotes the spec sheet’s one-line overview.${hasSpec ? " The same document has component-level detail in §3.2." : ""}`);
  const un = unmappedElements(chart);
  if (un.length) lines.push(`- ${chart.claimLabel} recites ${words(chart.elements.length)} elements and the chart maps ${words(visibleRows(chart).length)}. ${un.map((u) => u.tag).join(", ")} has no row.`);
  return aiText(
    `I’ve read the chart against ${plural(docs.length, "document")}. Here’s where it stands before we start.\n\n${lines.join("\n")}\n\nI’d start with element 3. Tell me what to change in plain language, or pick one of these.`,
    nextSteps(s)
  );
}

// ---------------------------------------------------------------------------
// Next-step suggestions
// ---------------------------------------------------------------------------
const hasKey = (s: Session, rowId: string, k: ScenarioKey) => {
  const r = rowById(s.chart, rowId);
  return !!r && !current(r).removed && current(r).keys.includes(k);
};

export function nextSteps(s: Session, max = 3): Chip[] {
  if (!s.chart.isDemoMatter) return [sendChip(C.HELP)];
  const out: Chip[] = [];
  if (!hasKey(s, "e3", "e3_ml")) out.push(sendChip(C.ML));
  if (!hasKey(s, "e2", "e2_pir") && !hasKey(s, "e2", "e2_legal")) out.push(sendChip(C.E2));
  if (!hasKey(s, "e1", "e1_pro") && !hasKey(s, "e1", "e1_lite")) out.push(sendChip(C.E1));
  if (unmappedElements(s.chart).length) out.push(sendChip(C.E4));
  if (hasKey(s, "e3", "e3_ml") && !hasKey(s, "e3", "e3_deploy") && !s.gaps.some((g) => g.rowId === "e3" && !g.resolved))
    out.push(sendChip(C.DEPLOY));
  if (!hasKey(s, "e3", "e3_legal")) out.push(sendChip(C.LEGAL3));
  out.push(sendChip(C.EXPORT));
  return out.slice(0, max);
}

// ---------------------------------------------------------------------------
// Intent helpers
// ---------------------------------------------------------------------------
const ROW_PATTERNS: [string, RegExp][] = [
  ["e1", /\b(element|row|item)\s*(#\s*)?(1|one)\b|\b1a\b|\bfirst (element|row)\b|wi-?fi|wireless|communication module/],
  ["e2", /\b(element|row|item)\s*(#\s*)?(2|two)\b|\b1b\b|\bsecond (element|row)\b|motion|occupancy|\bpir\b/],
  ["e3", /\b(element|row|item)\s*(#\s*)?(3|three)\b|\b1c\b|\bthird (element|row)\b|\bml\b|machine learning|algorithm|auto-?schedule|\bmodel\b|\blearn/],
  ["e4", /\b(element|row|item)\s*(#\s*)?(4|four)\b|\b1d\b|\bfourth (element|row)\b|temperature sensors?\b|sensor array|remote sensors?|smartsensor|plurality/],
];
const EXPLICIT: [string, RegExp][] = [
  ["e1", /\b(element|row|item)\s*(#\s*)?(1|one)\b|\b1a\b/],
  ["e2", /\b(element|row|item)\s*(#\s*)?(2|two)\b|\b1b\b/],
  ["e3", /\b(element|row|item)\s*(#\s*)?(3|three)\b|\b1c\b/],
  ["e4", /\b(element|row|item)\s*(#\s*)?(4|four)\b|\b1d\b/],
];

function detectRows(t: string): string[] {
  const ex = EXPLICIT.filter(([, re]) => re.test(t)).map(([id]) => id);
  if (ex.length) return ex;
  return ROW_PATTERNS.filter(([, re]) => re.test(t)).map(([id]) => id);
}

function detectOp(t: string): OpKind | null {
  if (/source code|\bapi\b|firmware|shipping|deployed|actually (runs?|uses?)|developer doc|teardown/.test(t)) return "deploy";
  if (/claim construction|legal language|legally|markman|construction argument|construe|defensib/.test(t)) return "legal";
  if (/\bmissed\b|\bmissing\b|new row|add (a )?row|not (in|on) the chart|doesn'?t map|sensor array/.test(t)) return "add";
  if (/reasoning|vague|\bweak\b|technical detail|more detail|explain|analysis|rationale/.test(t)) return "reasoning";
  if (/evidence|strengthen|stronger|\bsource\b|documentation|\bdocs?\b|support|\bcite\b|proof|improve|better|fix\b/.test(t)) return "strengthen";
  return null;
}

const ACCEPT_RE = /^(ok(ay)?[,.!\s]*)?(accept(ed)?|apply( it)?|approve(d)?|yes|yep|yeah|y|looks good|lgtm|go ahead|do it|ship it|confirm|sounds good|that works)\b|\b(accept( it| this| that)?|apply (it|this|that)|approve (it|this))\b/;
const REJECT_RE = /^(no|nope|nah)\b|\b(reject(ed)?|discard|don'?t apply|scrap (it|that)|not this one|throw (it|that) out)\b/;
const URL_RE = /https?:\/\/[^\s)]+/i;

function reasonFrom(t: string): RejectReason | undefined {
  if (/too long|wordy|shorter|verbose|lengthy/.test(t)) return "too_long";
  if (/vague|generic|not specific|more specific|thin/.test(t)) return "too_vague";
  if (/wrong (element|row)|different element|not that (element|row)/.test(t)) return "wrong_element";
  if (/defensib|legally|won'?t hold|not (legally )?sound|construction/.test(t)) return "not_defensible";
  if (/wrong (evidence|source|citation|doc)|incorrect|bad citation/.test(t)) return "wrong_evidence";
  return undefined;
}

interface ModChange { key: keyof Mods; value: boolean | "formal" | "plain"; label: string }
function modsFrom(t: string): ModChange[] {
  const out: ModChange[] = [];
  if (/concise|shorter|shorten|tighter|tighten|trim|brief|cut (it )?down|condense/.test(t)) out.push({ key: "concise", value: true, label: "shorter" });
  if (/longer|more detail|expand|fuller|less concise|full version/.test(t)) out.push({ key: "concise", value: false, label: "full length" });
  if (/plain( english)?|simpler|simple language|less legal|layman|non-?lawyer/.test(t)) out.push({ key: "tone", value: "plain", label: "plain English" });
  if (/formal|legal tone|more legal|lawyerly/.test(t)) out.push({ key: "tone", value: "formal", label: "formal legal tone" });
  const removing = /\b(remove|drop|without|delete|lose|no)\b/.test(t);
  if (/claim construction|construction note|cc note/.test(t)) out.push({ key: "cc", value: !removing, label: removing ? "claim construction note removed" : "claim construction note added" });
  if (/on[- ]?device|on the device|runs locally|locally|on the thermostat|processor|\bedge\b/.test(t)) out.push({ key: "onDevice", value: !removing, label: removing ? "on-device detail removed" : "on-device processing added" });
  if (/field data|error rate|prediction error|1\.8/.test(t)) out.push({ key: "fieldData", value: !removing, label: removing ? "field data removed" : "field data added" });
  return out;
}

// ---------------------------------------------------------------------------
// Session mutation helpers
// ---------------------------------------------------------------------------
function applyVersion(
  s: Session, row: ChartRow,
  content: Pick<RowVersion, "evidence" | "reasoning" | "source" | "status" | "citations" | "keys"> & { removed?: boolean },
  author: RowVersion["author"], summary: string, action: string,
) {
  s.chart.version += 1;
  const v: RowVersion = {
    v: row.versions.length + 1,
    ...content,
    author, summary, at: now(), chartVersion: s.chart.version,
  };
  row.versions.push(v);
  row.disputed = null;
  row.lastChangedAt = now();
  s.changeLog.push({ id: uid("chg"), chartVersion: s.chart.version, rowId: row.id, tag: row.tag, action, author, at: now() });
}

function makeProposal(s: Session, key: ScenarioKey, mods: Mods, variant?: "missed" | "afterCorrection", revisionOf?: Proposal): EngineResult | { needsFirst: true } {
  const b = build(key, { docs: s.docs, chart: s.chart, constraints: s.constraints, mods, variant });
  if (b.ok === "needsFirst") return { needsFirst: true };
  if (!b.ok) return noEvidenceReply(s, b.noEvidence, b.steps);
  // supersede any open proposal
  if (s.activeProposalId && s.proposals[s.activeProposalId]?.state === "pending") s.proposals[s.activeProposalId].state = "superseded";
  const p: Proposal = { ...b.proposal, id: uid("p"), state: "pending", mods, revision: (revisionOf?.revision ?? 0) + 1 };
  s.proposals[p.id] = p;
  s.activeProposalId = p.id;
  s.pending = null;
  return { session: s, replies: [msg("ai", "proposal", { text: b.intro, proposalId: p.id })], steps: b.steps };
}

function noEvidenceReply(s: Session, ne: NoEvidence, steps: string[], retries = 0): EngineResult {
  s.pending = { type: "noEvidence", key: ne.key, rowId: ne.rowId, retries };
  return {
    session: s,
    steps,
    replies: [msg("ai", "noEvidence", {
      text: `I can’t support element ${rowNum(ne.rowId)} from what you’ve uploaded. I haven’t found ${ne.what}.`,
      data: { ...ne },
    })],
  };
}

const activeProposal = (s: Session) => {
  const p = s.activeProposalId ? s.proposals[s.activeProposalId] : null;
  return p && p.state === "pending" ? p : null;
};

const lastChangedRow = (s: Session) => {
  const last = [...s.changeLog].reverse()[0];
  return last ? rowById(s.chart, last.rowId) : undefined;
};

// ---------------------------------------------------------------------------
// Public: respond to a typed message
// ---------------------------------------------------------------------------
export function respond(prev: Session, raw: string): EngineResult {
  const s: Session = structuredClone(prev);
  const text = raw.trim();
  const t = text.toLowerCase();
  const pend = s.pending;

  // ---- awaiting a URL
  if (pend && (pend.type === "awaitUrl" || pend.type === "noEvidence") && URL_RE.test(text)) {
    const url = text.match(URL_RE)![0].replace(/[.,]+$/, "");
    if (/developer\.acme-home\.example\/api\/v3\/autoschedule/i.test(url)) {
      return { session: s, replies: [], steps: ["Fetching " + url, "Extracting text", "Storing a dated snapshot"], effect: { type: "fetchUrl", url } };
    }
    s.pending = { type: "awaitUrl", key: pend.key, rowId: pend.rowId, retries: pend.retries + 1 };
    return { session: s, replies: [aiText(`I can’t reach ${url} from this demo build; it runs offline with no network access. Upload the page as a PDF instead, or try the bundled demo page: ${DEMO_URL}`)] };
  }

  // ---- undo confirmation
  if (pend?.type === "undo") {
    if (ACCEPT_RE.test(t) || /\b(revert|undo) it\b/.test(t)) return act(s, { type: "confirmUndo" });
    if (REJECT_RE.test(t) || /cancel|keep (it|the current)|never ?mind/.test(t)) return act(s, { type: "cancelUndo" });
  }

  // ---- URL capture approval
  if (pend?.type === "capture") {
    if (ACCEPT_RE.test(t) || /approve|use it|add it/.test(t)) return act(s, { type: "approveCapture" });
    if (REJECT_RE.test(t) || /discard|bin it/.test(t)) return act(s, { type: "discardCapture" });
  }

  // ---- version pick for undo
  if (pend?.type === "pickUndo") {
    const row = rowById(s.chart, pend.rowId)!;
    const vm = t.match(/\bv(?:ersion)?\s*(\d+)\b/);
    if (/original|as uploaded|beginning|first version/.test(t)) return act(s, { type: "pickVersion", rowId: row.id, v: 1 });
    if (vm) return act(s, { type: "pickVersion", rowId: row.id, v: Number(vm[1]) });
  }

  // ---- no-evidence options in words
  if (pend && (pend.type === "noEvidence" || pend.type === "awaitUpload" || pend.type === "awaitUrl")) {
    if (/\bgap\b|mark (it|this)|move on|skip|leave it|defer/.test(t)) return act(s, { type: "noEvidenceOption", option: "gap" });
    if (/\burl\b|\blink\b|web ?page|scrape/.test(t)) return act(s, { type: "noEvidenceOption", option: "url" });
    if (/upload|attach|\bfile\b|document/.test(t) && !detectOp(t)) return act(s, { type: "noEvidenceOption", option: "upload" });
  }

  // ---- reason after a bare reject
  if (pend?.type === "rejectReason") {
    const r = reasonFrom(t);
    if (r) return act(s, { type: "reject", proposalId: pend.proposalId, reason: r });
  }

  // ---- clarify a disputed citation
  if (pend?.type === "disputeWhat") {
    if (/lite|at-?2100|wrong (product|model|variant)|not the pro/.test(t)) return liteCorrection(s);
    if (/wrong (doc|document|file)|doesn'?t support|does not support|not support/.test(t)) return genericDispute(s, pend.rowId);
  }

  // ---- export confirmation in words
  if (pend?.type === "export" && /anyway|go ahead|\byes\b|download|proceed/.test(t)) {
    const issues = exportIssues(s);
    const m = text.match(/(?:because|reason[:\s]|:)\s*(.+)$/i);
    if (issues.length && !m)
      return { session: s, replies: [aiText("Give me a one-line reason for exporting with open items, for example “export anyway because counsel wants a working draft”. It goes into the document.")] };
    return { session: s, replies: [], effect: { type: "export", override: issues.length ? m?.[1]?.trim() : undefined } };
  }

  // ---- clarify which element
  if (pend?.type === "clarify") {
    const rows = detectRows(t);
    const n = t.match(/^\s*(?:element\s*)?([1-4])\s*$/);
    const rowId = rows.length === 1 ? rows[0] : n ? `e${n[1]}` : null;
    if (rowId) { s.pending = null; return runOp(s, pend.op, rowId, t); }
  }

  // ---- disputes (edge case 1)
  if (/(that'?s|this is|it'?s|that is) (the )?(wrong|incorrect|not right)|wrong (citation|source|evidence|model|variant|document|doc|passage|quote|line|product)|incorrect (citation|source|evidence)|smarttherm lite|\blite\b|at-?2100|not the pro\b|cited the wrong|citation is wrong/.test(t))
    return handleDispute(s, t);

  // ---- open proposal: modify / accept / reject
  const ap = activeProposal(s);
  if (ap) {
    const rowsHere = detectRows(t);
    const fresh = (rowsHere.length > 0 && !rowsHere.includes(ap.rowId)) ||
      /^(the ai reasoning|add (technical|evidence)|strengthen the|rewrite the reasoning|ai missed|fix the reasoning|add a row|show the|undo|revert|export)/.test(t);
    if (!fresh) {
      const changes = modsFrom(t);
      const reset = /\b(redo|regenerate)\b|(new|updated) instructions/.test(t);
      const accept = ACCEPT_RE.test(t) && !REJECT_RE.test(t);
      if (reset || (changes.length && (!accept || /\b(but|and|also|instead|though)\b/.test(t))))
        return modifyProposal(s, ap, changes, reset);
      if (accept) return act(s, { type: "accept", proposalId: ap.id });
      if (REJECT_RE.test(t)) return act(s, { type: "reject", proposalId: ap.id, reason: reasonFrom(t) });
    }
  } else if (ACCEPT_RE.test(t) && t.split(" ").length <= 4 && !pend) {
    return { session: s, replies: [aiText("There’s nothing waiting for your review right now.", nextSteps(s))] };
  }

  // ---- undo / revert
  if (/\bundo\b|\brevert\b|roll ?back|put .* back|go back to|restore/.test(t)) return handleUndo(s, t);

  // ---- history
  if (/history|versions|what changed|change log|changelog/.test(t)) return handleHistory(s, t);

  // ---- export
  if (/export|download|word (doc|file)|\.docx|finali[sz]e/.test(t)) return handleExport(s);

  // ---- what next
  if (/what('?s| is)? next|what next|what('?s| is) left|next step|what should i|where (should|do) (i|we) start/.test(t))
    return { session: s, replies: [aiText(nextIntro(s), nextSteps(s))] };

  // ---- refinement operations
  const op = detectOp(t);
  const rows = detectRows(t);
  const verb = /\b(fix|improve|update|rewrite|redo|change|tighten|revise|edit|rework|add|draft)\b/.test(t);
  if (op || (rows.length && verb)) {
    if (!s.chart.isDemoMatter) return { session: s, replies: [notDemo(s)] };
    const o: OpKind = op ?? (rows[0] === "e4" ? "add" : "strengthen");
    if (o === "add" && !rows.length && unmappedElements(s.chart).length) return runOp(s, "add", "e4", t);
    // an unnamed target defaults to the row of the open proposal
    if (!rows.length && ap && o !== "add") return runOp(s, o, ap.rowId, t);
    if (rows.length !== 1) {
      s.pending = { type: "clarify", op: o };
      const opener = rows.length > 1 ? "That could apply to more than one row." : "Which element should I work on?";
      return {
        session: s,
        replies: [aiText(
          o === "legal"
            ? `${opener} Element 3 carries the most claim construction exposure, because of “learns … over time”.`
            : `${opener} Element 3 is the weakest right now.`,
          (["e3", "e1", "e2", ...(rowById(s.chart, "e4") && !current(rowById(s.chart, "e4")!).removed ? ["e4"] : [])] as string[])
            .map((id) => sendChip(ROW_NAMES[id], opText(o, id), id === "e3"))
        )],
      };
    }
    return runOp(s, o, rows[0], t);
  }

  // ---- bare row mention: describe the row
  if (rows.length === 1 && s.chart.isDemoMatter) return describeRow(s, rows[0]);

  // ---- small talk
  if (/^(hi|hello|hey|hiya|howdy|good (morning|afternoon|evening)|yo)\b/.test(t))
    return { session: s, replies: [aiText(s.chart.isDemoMatter
      ? `Hi. We’re working on ${s.chart.patent} against the ${s.chart.product.replace(/\s*\(.*\)/, "")}. ${nextIntro(s)}`
      : "Hi. Your chart is loaded and ready to browse.", nextSteps(s))] };
  if (/^(thanks|thank you|thx|cheers|ty|great|awesome|nice|cool)\b/.test(t))
    return { session: s, replies: [aiText(`Glad that helped. ${nextIntro(s)}`, nextSteps(s))] };
  if (/\bhelp\b|what can you do|how does this work|commands|what do you do|options|capabilit/.test(t)) return help(s);
  if (/who are you|what are you|are you (a|an) (ai|bot|human)/.test(t))
    return { session: s, replies: [aiText("I’m the iLumos refinement assistant for this claim chart. I propose changes to the chart, show you the passage behind every citation, and only change the chart when you approve.", nextSteps(s))] };

  // ---- legal-outcome questions
  if (/will we win|win the case|chances|likelihood|odds|should we sue|settle|damages|royalt|valuation|worth|is (this|it) infring|do they infringe|legal advice/.test(t))
    return { session: s, replies: [aiText("That’s a judgment for counsel. I don’t assess case outcomes, damages or whether infringement will be found. What I can do is make each row’s evidence and reasoning as strong as your documents allow.", nextSteps(s))] };

  // ---- out of scope
  return {
    session: s,
    replies: [aiText(
      "That’s outside what I can help with here. In this session I can strengthen evidence, fix weak reasoning, add missing claim elements, tighten legal language against claim construction arguments, undo changes, and export the chart to Word. Try one of these:",
      [...nextSteps(s), sendChip(C.HELP)]
    )],
  };
}

function opText(op: OpKind, rowId: string): string {
  const n = rowNum(rowId);
  if (op === "legal") return `Rewrite the reasoning for element ${n} to address claim construction arguments`;
  if (op === "reasoning") return `Fix the reasoning for element ${n}`;
  if (op === "add") return C.E4;
  if (op === "deploy") return C.DEPLOY;
  return `Strengthen the evidence for element ${n}`;
}

function nextIntro(s: Session): string {
  const n = nextSteps(s, 1)[0];
  if (!n) return "";
  if (n.send === C.ML) return "Element 3 is still the weakest row. Want to start there?";
  if (n.send === C.EXPORT) return "The rows look solid. When you’re ready, export it.";
  return "Here’s what I’d do next.";
}

function notDemo(s: Session): Message {
  return aiText(`Refinements in this demo build are wired for the sample matter only (US 123,456 v. Acme SmartTherm Pro), and this chart is ${s.chart.fileName}. You can still browse it, open its sources and export it. Load the demo set from setup to try the full flow.`);
}

function help(s: Session): EngineResult {
  return {
    session: s,
    replies: [aiText(
      "Here’s what I can do in this session:\n\n- Strengthen the evidence for a row from your uploaded documents\n- Fix vague or weak reasoning with specific technical analysis\n- Add claim elements the chart is missing\n- Rewrite reasoning to hold up against claim construction arguments\n- Revise an open proposal: shorter, plain English, add or drop a detail\n- Undo any change, and show a row’s version history\n- Export the chart, citations and change log to Word\n\nEvery change comes to you as a proposal first. The full list of demo commands is under the command button next to the message box.",
      nextSteps(s)
    )],
  };
}

function describeRow(s: Session, rowId: string): EngineResult {
  const row = rowById(s.chart, rowId);
  if (!row || current(row).removed) {
    if (rowId === "e4") return { session: s, replies: [aiText("Element 4, [1d], isn’t in the chart yet. Claim 1 recites it, but no row maps it.", [sendChip(C.E4, C.E4, true)])] };
    return { session: s, replies: [aiText("That row isn’t in the chart.")] };
  }
  const cv = current(row);
  const st = cv.status === "weak" ? "rests on marketing copy" : cv.status === "asserted" ? "is analyst-asserted and unverified" : "cites a technical source";
  return {
    session: s,
    replies: [aiText(
      `Element ${rowNum(rowId)} ${row.tag} is on version ${cv.v} and ${st}${row.disputed ? `, and it’s disputed: ${row.disputed.toLowerCase()}` : ""}. What would you like to change?`,
      [sendChip(opText("strengthen", rowId), opText("strengthen", rowId), true), sendChip(opText("legal", rowId)), sendChip(`Show the version history for element ${rowNum(rowId)}`)]
    )],
  };
}

function runOp(s: Session, op: OpKind, rowId: string, t: string): EngineResult {
  const row = rowById(s.chart, rowId);
  const exists = !!row && !current(row).removed;

  // element 4 doesn't exist yet
  if (rowId === "e4" && !exists && op !== "add" && op !== "strengthen")
    return { session: s, replies: [aiText("Element 4 isn’t in the chart yet, so there’s nothing to rewrite. Add the row first.", [sendChip(C.E4, C.E4, true)])] };
  if (rowId === "e4" && exists && (op === "add" || op === "strengthen"))
    return { session: s, replies: [aiText(`Element 4 is already in the chart (version ${current(row!).v}), sourced from spec sheet §3.3. The open question is placement, which rests on the brochure. An installation guide would be the next step up.`, [sendChip(opText("legal", "e4")), ...nextSteps(s, 2)])] };
  if (op === "add" && rowId !== "e4") op = "strengthen";
  if (op === "deploy" && rowId !== "e3") op = "strengthen";

  const key = scenarioFor(rowId, op, s.constraints);
  if (!key) return { session: s, replies: [aiText("I don’t have a refinement for that row in this demo.", nextSteps(s))] };

  // already done?
  if (exists) {
    const cv = current(row!);
    const done = cv.keys.includes(key) || (key === "e1_lite" && cv.keys.includes("e1_pro"));
    if (done) {
      const what: Partial<Record<ScenarioKey, string>> = {
        e3_ml: "Element 3 already cites the AT-WP-07 whitepaper.",
        e2_pir: "Element 2 already cites spec sheet §3.2.",
        e1_pro: "Element 1 already cites the AT-3200 module evidence.",
        e1_lite: "Element 1 already cites the spec sheet.",
        e3_deploy: "Element 3 already cites the API reference.",
      };
      const msgText = what[key] ?? `That change is already in element ${rowNum(rowId)} (version ${cv.v}).`;
      return { session: s, replies: [aiText(`${msgText} I don’t have a stronger source in your uploads; ${key.startsWith("e3") ? "source code review" : "a teardown report"} would be the next step up.`, nextSteps(s))] };
    }
  }

  const variant = op === "add" && /missed/.test(t) ? "missed" : undefined;
  const res = makeProposal(s, key, defaultMods(s.instructions), variant);
  if ("needsFirst" in res) {
    if (key === "e3_deploy")
      return { session: s, replies: [aiText("The API reference builds on the whitepaper rewrite for element 3, and that hasn’t been applied yet. Let’s fix the reasoning first, then I’ll add this on top.", [sendChip(C.ML, C.ML, true)])] };
    return { session: s, replies: [aiText("Element 4 isn’t in the chart yet. Add the row first.", [sendChip(C.E4, C.E4, true)])] };
  }
  return res;
}

function modifyProposal(s: Session, p: Proposal, changes: ModChange[], reset = false): EngineResult {
  let mods: Mods = { ...p.mods };
  const applied: string[] = [];
  const skipped: string[] = [];
  if (reset) { mods = { ...defaultMods(s.instructions), onDevice: p.mods.onDevice }; applied.push("rebuilt with the current session instructions"); }
  for (const ch of changes) {
    if (!p.supports.includes(ch.key)) { skipped.push(ch.label); continue; }
    (mods as unknown as Record<string, unknown>)[ch.key] = ch.value;
    applied.push(ch.label);
  }
  if (!applied.length) {
    const why = changes.some((c) => c.key === "onDevice" || c.key === "fieldData")
      ? `The sources for element ${rowNum(p.rowId)} don’t cover that detail, so I can’t add it without inventing support.`
      : "That proposal is argument rather than evidence, so its length and notes are fixed. I can switch its tone, or you can edit it directly.";
    return { session: s, replies: [aiText(why, [sendChip(C.ACCEPT, C.ACCEPT, true)])] };
  }
  const res = makeProposal(s, p.key, mods, undefined, p);
  if ("needsFirst" in res) return { session: s, replies: [] };
  const np = s.proposals[s.activeProposalId!];
  const delta = np.citations.length - p.citations.length;
  const citeNote = delta > 0 ? `Added ${plural(delta, "citation")} for the new detail.` : delta < 0 ? `Dropped ${plural(-delta, "citation")} that no longer applies.` : "The citations haven’t changed.";
  const intro = `Revised: ${applied.join(", ")}.${skipped.length ? ` I left out ${skipped.join(" and ")}, which this proposal’s sources don’t support.` : ""} ${citeNote}`;
  res.replies[0].text = intro;
  res.steps = ["Applying your revision", "Re-checking citations"];
  return res;
}

// ---------------------------------------------------------------------------
// Edge case 1: disputes
// ---------------------------------------------------------------------------
function handleDispute(s: Session, t: string): EngineResult {
  const rows = detectRows(t.replace(/\bmodel\b/g, ""));
  const ap = activeProposal(s);
  const rowId = /lite|at-?2100|not the pro/.test(t) ? "e1" : rows.length === 1 ? rows[0] : ap?.rowId ?? lastChangedRow(s)?.id ?? null;
  if (!rowId) {
    return { session: s, replies: [aiText("Which element’s evidence is wrong?", ["e1", "e2", "e3"].map((id) => sendChip(ROW_NAMES[id], `That citation is wrong for element ${rowNum(id)}`)))] };
  }
  const liteInPlay = rowId === "e1" && (ap?.key === "e1_lite" || hasKey(s, "e1", "e1_lite"));
  if (rowId === "e1" && !liteInPlay && /lite|at-?2100|not the pro/.test(t))
    return { session: s, replies: [aiText(s.constraints.includes("exclude-lite")
      ? "Already handled. Element 1 is restricted to SmartTherm Pro (AT-3200) lines for this session, and its current citations are all from the Pro sections."
      : "Element 1 doesn’t cite a SmartTherm Lite line right now. Its current evidence is the product page. Want me to re-source it from the spec sheet?", [sendChip(C.E1, C.E1, true)])] };
  if (liteInPlay) {
    if (/lite|at-?2100|not the pro|wrong (product|model|variant)/.test(t)) return liteCorrection(s);
    s.pending = { type: "disputeWhat", rowId };
    return { session: s, replies: [aiText("What’s wrong with it? I’ll use your answer to fix the search, not just this cell.", [
      sendChip("It’s the SmartTherm Lite spec, not the Pro", C.LITE, true),
      sendChip("It’s the wrong document", "It's the wrong document"),
      sendChip("It doesn’t support the claim", "It doesn't support the claim"),
    ])] };
  }
  return genericDispute(s, rowId);
}

function liteCorrection(s: Session): EngineResult {
  const ap = activeProposal(s);
  const wasPending = ap?.key === "e1_lite";
  if (wasPending && ap) ap.state = "rejected";
  const row = rowById(s.chart, "e1")!;
  const applied = current(row).keys.includes("e1_lite");
  if (applied) row.disputed = "Cites a SmartTherm Lite (AT-2100) line for the AT-3200";
  if (!s.constraints.includes("exclude-lite")) s.constraints.push("exclude-lite");
  s.corrections.push({ at: now(), rowId: "e1", kind: "wrong_variant", detail: "Cited a SmartTherm Lite (AT-2100) line as evidence for the AT-3200" });
  s.pending = null;

  const ack = aiText(`You’re right. That line is from the SmartTherm Lite (AT-2100) column of the model comparison, not the Pro. I’ve excluded every Lite line from the search for the rest of this session${applied ? ", and marked element 1 as disputed until a corrected version is accepted" : ""}.`);
  const note = notice("Correction saved to this session: cite SmartTherm Pro (AT-3200) lines only. Logged as a wrong-variant retrieval miss.");
  const res = makeProposal(s, "e1_pro", defaultMods(s.instructions), "afterCorrection");
  if ("needsFirst" in res) return { session: s, replies: [ack, note] };
  res.replies = [ack, note, ...res.replies];
  return res;
}

function genericDispute(s: Session, rowId: string): EngineResult {
  const row = rowById(s.chart, rowId);
  const ap = activeProposal(s);
  if (ap && ap.rowId === rowId) ap.state = "rejected";
  if (row && !current(row).removed) row.disputed = "Analyst disputes the cited evidence";
  s.corrections.push({ at: now(), rowId, kind: "disputed_unresolved", detail: "Analyst disputed evidence; no alternative passage found" });
  s.pending = null;
  return {
    session: s,
    replies: [aiText(
      `Marked element ${rowNum(rowId)} as disputed. I re-checked the cited passages and they say what the cell quotes, so I can’t find a better match in your uploads, and I won’t substitute one I can’t support.\n\nYou can upload the right source and ask again, or edit the cell with your own wording using the pencil on that row. If your edit isn’t backed by a citation, I’ll label it analyst-asserted so it shows up in the pre-export check.`,
      [{ label: "Clear the dispute", action: { type: "clearDispute", rowId } }]
    )],
  };
}

// ---------------------------------------------------------------------------
// Edge case 2: undo
// ---------------------------------------------------------------------------
function handleUndo(s: Session, t: string): EngineResult {
  const rows = detectRows(t);
  const row = rows.length === 1 ? rowById(s.chart, rows[0]) : lastChangedRow(s);
  if (!row) return { session: s, replies: [aiText("Nothing to undo yet. No changes have been applied to the chart.", nextSteps(s))] };
  const vs = row.versions;
  const cv = current(row);
  if (vs.length < 2 && cv.author === "original")
    return { session: s, replies: [aiText(`Element ${rowNum(row.id)} hasn’t changed since upload, so there’s nothing to undo.`, nextSteps(s))] };

  if (vs.length === 1) return undoPreview(s, row, 0); // added row: undo removes it
  if (/original|as uploaded|beginning/.test(t)) return undoPreview(s, row, 1);
  const explicit = rows.length === 1 && !/last|latest|previous|that/.test(t);
  if (explicit && vs.length >= 3) {
    s.pending = { type: "pickUndo", rowId: row.id };
    return {
      session: s,
      replies: [msg("ai", "versionPicker", {
        text: `Element ${rowNum(row.id)} has ${vs.length} versions. Which one should it go back to?`,
        data: { rowId: row.id, versions: vs.slice(0, -1).map((v) => ({ v: v.v, summary: v.summary, author: v.author, at: v.at })).reverse() },
      })],
    };
  }
  return undoPreview(s, row, vs[vs.length - 2].v);
}

function undoPreview(s: Session, row: ChartRow, toV: number): EngineResult {
  const cv = current(row);
  const target = toV === 0 ? null : row.versions.find((v) => v.v === toV)!;
  const lost = cv.keys.filter((k) => !(target?.keys ?? []).includes(k));
  const dependent = lost.length > 1 ? lost.filter((k) => k !== lost[0]).map((k) => KEY_LABEL[k]) : [];
  s.pending = { type: "undo", rowId: row.id, toV };
  return {
    session: s,
    replies: [msg("ai", "undoPreview", {
      text: toV === 0
        ? `This removes element ${rowNum(row.id)}, which was added in this session. Here’s the change before I make it.`
        : `Here’s what element ${rowNum(row.id)} goes back to (version ${toV}). Nothing changes until you confirm.`,
      data: {
        rowId: row.id, toV,
        from: { evidence: cv.evidence, reasoning: cv.reasoning },
        to: target ? { evidence: target.evidence, reasoning: target.reasoning } : null,
        dependent,
      },
    })],
  };
}

function handleHistory(s: Session, t: string): EngineResult {
  const rows = detectRows(t);
  const list = rows.length === 1 ? [rowById(s.chart, rows[0])].filter(Boolean) as ChartRow[] : s.chart.rows;
  return {
    session: s,
    replies: [msg("ai", "history", {
      text: rows.length === 1 ? `Version history for element ${rowNum(rows[0])}:` : "Version history for every row:",
      data: { rows: list.map((r) => ({ id: r.id, tag: r.tag, versions: r.versions.map((v) => ({ v: v.v, summary: v.summary, author: v.author, at: v.at, chartVersion: v.chartVersion, removed: !!v.removed })) })) },
    })],
  };
}

// ---------------------------------------------------------------------------
// Export check
// ---------------------------------------------------------------------------
export function exportIssues(s: Session): { text: string; fix?: string }[] {
  const out: { text: string; fix?: string }[] = [];
  const ap = activeProposal(s);
  if (ap) out.push({ text: `A proposal for element ${rowNum(ap.rowId)} is still waiting for your review.` });
  for (const r of visibleRows(s.chart)) {
    const cv = current(r);
    if (cv.status === "weak") out.push({ text: `Element ${rowNum(r.id)} rests on marketing copy.`, fix: r.id === "e3" ? C.ML : opText("strengthen", r.id) });
    if (cv.status === "asserted") out.push({ text: `Element ${rowNum(r.id)} is analyst-asserted and has no supporting citation.` });
    if (r.disputed) out.push({ text: `Element ${rowNum(r.id)} is disputed: ${r.disputed}.`, fix: r.id === "e1" ? C.E1 : undefined });
  }
  for (const u of unmappedElements(s.chart)) out.push({ text: `Claim element ${u.tag} has no row.`, fix: C.E4 });
  for (const g of s.gaps.filter((g) => !g.resolved)) out.push({ text: `Evidence gap on element ${rowNum(g.rowId)}: ${g.text}.`, fix: g.rowId === "e3" ? C.DEPLOY : undefined });
  return out;
}

function handleExport(s: Session): EngineResult {
  const issues = exportIssues(s);
  s.pending = { type: "export" };
  return {
    session: s,
    steps: ["Checking every row for provenance", "Checking for disputes, gaps and unmapped elements"],
    replies: [msg("ai", "exportCheck", {
      text: issues.length
        ? `Before export: ${plural(issues.length, "item")} would go to counsel unresolved.`
        : "Pre-export check passed. Every row is mapped, every evidence cell has a citation, and nothing is disputed.",
      data: { issues },
    })],
  };
}

// ---------------------------------------------------------------------------
// Public: button actions
// ---------------------------------------------------------------------------
export function act(prev: Session, a: Action): EngineResult {
  const s: Session = structuredClone(prev);
  switch (a.type) {
    case "accept": {
      const p = s.proposals[a.proposalId];
      if (!p || p.state !== "pending") return { session: s, replies: [aiText("That proposal is no longer open. The newest version is the one to review.")] };
      p.state = "accepted";
      s.activeProposalId = null;
      s.pending = null;
      applyProposal(s, p, p.after, "ai", `${p.opLabel}: AI-proposed, analyst-approved`);
      const isNew = p.isNewRow;
      return {
        session: s,
        replies: [aiText(
          isNew
            ? `Added row ${rowNum(p.rowId)} for ${p.newRow?.tag}. The chart is now version ${s.chart.version}.`
            : `Applied to element ${rowNum(p.rowId)}. The chart is now version ${s.chart.version}.${p.key === "e3_deploy" && s.gaps.some((g) => g.rowId === "e3" && g.resolved) ? " The evidence gap on element 3 is closed." : ""}`,
          nextSteps(s)
        )],
      };
    }
    case "edit": {
      const p = s.proposals[a.proposalId];
      if (!p || p.state !== "pending") return { session: s, replies: [] };
      p.state = "edited";
      s.activeProposalId = null;
      s.pending = null;
      applyProposal(s, p, { ...p.after, evidence: a.evidence, reasoning: a.reasoning }, "analyst", "Edited by analyst from an AI proposal");
      return {
        session: s,
        replies: [aiText(`Saved your edit to element ${rowNum(p.rowId)} as analyst-authored. I’ll treat that wording as fixed for the rest of the session. The chart is now version ${s.chart.version}.`, nextSteps(s))],
      };
    }
    case "editRow": {
      const row = rowById(s.chart, a.rowId);
      if (!row) return { session: s, replies: [] };
      const cv = current(row);
      const supported = (a as { supported?: boolean }).supported !== false;
      applyVersion(s, row, {
        evidence: a.evidence, reasoning: a.reasoning, source: cv.source,
        status: supported ? (cv.status === "weak" ? "weak" : "technical") : "asserted",
        citations: cv.citations, keys: cv.keys,
      }, "analyst", supported ? "Edited by analyst" : "Edited by analyst: asserted, unverified", "Analyst edit");
      return {
        session: s,
        replies: [notice(supported
          ? `Element ${rowNum(row.id)} edited by you and saved as version ${current(row).v}.`
          : `Element ${rowNum(row.id)} saved as analyst-asserted. It will show in the pre-export check until a citation backs it.`)],
      };
    }
    case "reject": {
      const p = s.proposals[a.proposalId];
      if (!p) return { session: s, replies: [] };
      if (p.state === "pending") p.state = "rejected";
      s.activeProposalId = null;
      if (!a.reason) {
        s.pending = { type: "rejectReason", proposalId: p.id };
        return {
          session: s,
          replies: [aiText("Set aside. What’s wrong with it? Your answer shapes the next attempt, so it won’t be the same answer again.", [
            { label: "Wrong evidence", action: { type: "reject", proposalId: p.id, reason: "wrong_evidence" } },
            { label: "Too vague", action: { type: "reject", proposalId: p.id, reason: "too_vague" } },
            { label: "Too long", action: { type: "reject", proposalId: p.id, reason: "too_long" } },
            { label: "Wrong element", action: { type: "reject", proposalId: p.id, reason: "wrong_element" } },
            { label: "Not legally defensible", action: { type: "reject", proposalId: p.id, reason: "not_defensible" } },
          ])],
        };
      }
      s.pending = null;
      s.corrections.push({ at: now(), rowId: p.rowId, kind: `rejected:${a.reason}`, detail: `${p.title}, revision ${p.revision}` });
      return retryAfterReject(s, p, a.reason);
    }
    case "confirmUndo": {
      const pend = s.pending;
      if (pend?.type !== "undo") return { session: s, replies: [] };
      const row = rowById(s.chart, pend.rowId)!;
      const cv = current(row);
      const target = pend.toV === 0 ? null : row.versions.find((v) => v.v === pend.toV)!;
      const lost = cv.keys.filter((k) => !(target?.keys ?? []).includes(k));
      applyVersion(s, row, target
        ? { evidence: target.evidence, reasoning: target.reasoning, source: target.source, status: target.status, citations: target.citations, keys: [...target.keys] }
        : { evidence: "", reasoning: "", source: "", status: "missing", citations: [], keys: [], removed: true },
        "revert", target ? `Reverted to version ${pend.toV}` : "Removed: undo of added row", target ? `Revert to v${pend.toV}` : "Remove row");
      if (lost.includes("e3_deploy")) s.gaps.forEach((g) => { if (g.rowId === "e3" && g.resolved) g.resolved = false; });
      s.pending = null;
      return {
        session: s,
        replies: [aiText(
          target
            ? `Reverted element ${rowNum(row.id)} to version ${pend.toV}. History is append-only, so this is saved as version ${current(row).v} and can itself be undone. The chart is now version ${s.chart.version}.`
            : `Removed element ${rowNum(row.id)}. It’s still in the history and can be restored. The chart is now version ${s.chart.version}.`,
          nextSteps(s)
        )],
      };
    }
    case "cancelUndo":
      s.pending = null;
      return { session: s, replies: [aiText("Kept the current version. Nothing changed.")] };
    case "pickVersion": {
      const row = rowById(s.chart, a.rowId);
      if (!row || !row.versions.some((v) => v.v === a.v) || a.v === current(row).v)
        return { session: s, replies: [aiText("That version doesn’t exist for this row. Pick one from the list.")] };
      return undoPreview(s, row, a.v);
    }
    case "noEvidenceOption": {
      const pend = s.pending;
      if (!pend || !("key" in pend)) return { session: s, replies: [aiText("There’s no open evidence request right now.")] };
      if (a.option === "gap") {
        const text = pend.key === "e3_deploy"
          ? "deployment of the Auto-Schedule model on shipping firmware is unverified"
          : `no technical source for element ${rowNum(pend.rowId)}`;
        s.gaps.push({ id: uid("gap"), rowId: pend.rowId, text, at: now(), resolved: false });
        s.pending = null;
        return { session: s, replies: [aiText(`Logged as an evidence gap on element ${rowNum(pend.rowId)}. The session carries on, the gap shows in the pre-export check, and it travels to the Word export as an open item for counsel.`, nextSteps(s))] };
      }
      if (a.option === "url") {
        s.pending = { type: "awaitUrl", key: pend.key, rowId: pend.rowId, retries: pend.retries };
        return { session: s, replies: [aiText(`Paste the URL. I’ll fetch it, show you exactly what I captured with the capture date, and wait for your approval before citing it.\n\nThis demo runs offline, so it can fetch one bundled page: ${DEMO_URL}`)] };
      }
      s.pending = { type: "awaitUpload", key: pend.key, rowId: pend.rowId, retries: pend.retries };
      return {
        session: s,
        replies: [msg("ai", "text", {
          text: `Choose a file. I’ll index it, then check it against element ${rowNum(pend.rowId)}.`,
          data: { uploadPrompt: true, demoFile: pend.key === "e3_deploy" ? DEMO_FILES.heldBack : null },
        })],
      };
    }
    case "uploaded": {
      s.docs.push(...a.docs);
      const notes = a.docs.map((d) => notice(`Indexed ${d.name}: ${plural(d.pages.length, "page")}, classified as ${d.sourceClass === "api" ? "API documentation" : d.sourceClass === "marketing" ? "marketing copy" : "a technical document"}.`));
      const pend = s.pending;
      if (pend && "key" in pend && pend.type !== "capture") return retryAfterNewSource(s, pend.key, pend.rowId, pend.retries, notes, a.docs[0]);
      const followUp = a.docs.some((d) => d.sourceClass === "api") && hasKey(s, "e3", "e3_ml") && !hasKey(s, "e3", "e3_deploy")
        ? [aiText("That looks like API documentation. Want me to check it against element 3’s open question about shipping firmware?", [sendChip(C.DEPLOY, C.DEPLOY, true)])]
        : [];
      return { session: s, replies: [...notes, ...followUp] };
    }
    case "approveCapture": {
      const pend = s.pending;
      if (pend?.type !== "capture") return { session: s, replies: [] };
      s.docs.push(pend.doc);
      return retryAfterNewSource(s, pend.key, pend.rowId, pend.retries, [notice(`Snapshot of ${pend.doc.name} added to sources, captured ${new Date(pend.doc.capturedAt ?? now()).toLocaleString()}.`)], pend.doc);
    }
    case "discardCapture": {
      const pend = s.pending;
      if (pend?.type !== "capture") return { session: s, replies: [] };
      s.pending = { type: "noEvidence", key: pend.key, rowId: pend.rowId, retries: pend.retries };
      return { session: s, replies: [aiText("Discarded. Nothing from that page was kept. Try another route?", [
        { label: "Upload a document", action: { type: "noEvidenceOption", option: "upload" } },
        { label: "Mark as evidence gap", action: { type: "noEvidenceOption", option: "gap" } },
      ])] };
    }
    case "exportDone":
      s.pending = null;
      s.changeLog.push({ id: uid("chg"), chartVersion: s.chart.version, rowId: "-", tag: "-", action: `Exported to Word${a.override ? " with override" : ""}`, author: "analyst", at: now() });
      return {
        session: s,
        replies: [aiText(`Exported ${a.fileName}: ${plural(visibleRows(s.chart).length, "row")}, ${plural(a.citations, "citation")} in the appendix and ${plural(a.changes, "logged change")}.${a.override ? ` Your override reason is recorded in the document: “${a.override}”.` : ""}`)],
      };
    case "instructionsChanged": {
      s.instructions = a.instructions;
      const ap = activeProposal(s);
      return {
        session: s,
        replies: [instructionsNotice(a.instructions), ...(ap ? [aiText("There’s an open proposal written under the old instructions.", [sendChip("Redo the proposal with the new instructions")])] : [])],
      };
    }
    case "clearDispute": {
      const row = rowById(s.chart, a.rowId);
      if (row) row.disputed = null;
      return { session: s, replies: [notice(`Dispute cleared on element ${rowNum(a.rowId)}.`)] };
    }
  }
}

function applyProposal(s: Session, p: Proposal, content: Proposal["after"], author: RowVersion["author"], summary: string) {
  let row = rowById(s.chart, p.rowId);
  if (p.isNewRow && !row) {
    row = { id: p.rowId, tag: p.newRow!.tag, element: p.newRow!.element, versions: [], disputed: null, lastChangedAt: null };
    s.chart.rows.push(row);
  }
  if (!row) return;
  const prevKeys = row.versions.length ? current(row).keys : [];
  const keys = Array.from(new Set([...prevKeys.filter((k) => !(p.key === "e1_pro" && k === "e1_lite")), p.key]));
  applyVersion(s, row, { ...content, citations: p.citations, keys }, author, summary, p.isNewRow && row.versions.length === 0 ? "Add row" : p.opLabel);
  if (p.key === "e3_deploy") s.gaps.forEach((g) => { if (g.rowId === "e3") g.resolved = true; });
}

function retryAfterReject(s: Session, p: Proposal, reason: RejectReason): EngineResult {
  if (reason === "wrong_element") {
    const op: OpKind = p.opLabel.startsWith("Harden") ? "legal" : p.isNewRow ? "add" : "strengthen";
    s.pending = { type: "clarify", op };
    return { session: s, replies: [aiText("Which element did you mean?", ["e1", "e2", "e3"].filter((id) => id !== p.rowId).map((id) => sendChip(ROW_NAMES[id], opText(op, id))))] };
  }
  if (reason === "wrong_evidence") {
    if (p.key === "e1_lite") return liteCorrection(s);
    return genericDispute(s, p.rowId);
  }
  let mods: Mods = { ...p.mods };
  let key: ScenarioKey = p.key;
  let lead = "";
  if (reason === "too_long") { mods.concise = true; lead = "Here’s a shorter version with the same citations."; }
  if (reason === "too_vague") {
    mods = { ...mods, concise: false, fieldData: true, cc: true, onDevice: p.supports.includes("onDevice") ? true : mods.onDevice };
    lead = "Here’s a more specific version. I’ve added every supported detail the sources give me.";
  }
  if (reason === "not_defensible") {
    const legal = scenarioFor(p.rowId, "legal", s.constraints);
    if (legal && legal !== p.key) { key = legal; lead = "Here’s a version written to survive claim construction arguments, not just to describe the evidence."; }
    else { mods = { ...mods, tone: "formal", cc: true }; lead = "Here’s a more formal version with the construction risk addressed."; }
  }
  const res = makeProposal(s, key, mods, undefined, p);
  if ("needsFirst" in res) return { session: s, replies: [aiText("I couldn’t build an alternative for that.")] };
  if (res.replies[0]) res.replies[0].text = lead;
  return res;
}

function retryAfterNewSource(s: Session, key: ScenarioKey, rowId: string, retries: number, lead: Message[], doc: EvidenceDoc): EngineResult {
  const res = makeProposal(s, key, defaultMods(s.instructions));
  if ("needsFirst" in res) {
    s.pending = null;
    return { session: s, replies: [...lead, aiText("That source is in. The API evidence builds on the whitepaper rewrite for element 3, so let’s apply that first.", [sendChip(C.ML, C.ML, true)])] };
  }
  const isProposal = res.replies.some((m) => m.kind === "proposal");
  if (isProposal) { res.replies = [...lead, ...res.replies]; return res; }
  // still nothing (E3.8)
  const nextRetries = retries + 1;
  s.pending = { type: "noEvidence", key, rowId, retries: nextRetries };
  const lines = doc.pages.reduce((n, p) => n + p.lines.length, 0);
  const capped = nextRetries >= 2;
  return {
    session: s,
    steps: res.steps,
    replies: [
      ...lead,
      aiText(
        `That document doesn’t cover it. It’s ${doc.label}, and none of its ${lines} lines establish what element ${rowNum(rowId)} needs.${capped ? " That’s two sources without it. I’d mark this as an evidence gap and move on; counsel will see it in the export." : " Want to try a different source?"}`,
        capped
          ? [{ label: "Mark as evidence gap", primary: true, action: { type: "noEvidenceOption", option: "gap" } }, { label: "Try another document", action: { type: "noEvidenceOption", option: "upload" } }]
          : [{ label: "Upload another document", action: { type: "noEvidenceOption", option: "upload" } }, { label: "Provide a URL", action: { type: "noEvidenceOption", option: "url" } }, { label: "Mark as evidence gap", action: { type: "noEvidenceOption", option: "gap" } }]
      ),
    ],
  };
}

/** Called by the UI once a URL snapshot has been fetched and parsed. */
export function captured(prev: Session, doc: EvidenceDoc): EngineResult {
  const s: Session = structuredClone(prev);
  const pend = s.pending;
  const key = pend && "key" in pend ? pend.key : "e3_deploy";
  const rowId = pend && "rowId" in pend ? pend.rowId : "e3";
  const retries = pend && "retries" in pend ? pend.retries : 0;
  s.pending = { type: "capture", key, rowId, doc, retries };
  return {
    session: s,
    replies: [msg("ai", "capture", {
      text: "Here’s what I captured. Check it before I cite it.",
      data: { url: doc.name, capturedAt: doc.capturedAt, pages: doc.pages.length, preview: doc.pages[0]?.lines.slice(0, 8).map((l) => l.text) ?? [] },
    })],
  };
}
