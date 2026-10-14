// ---------------------------------------------------------------------------
// Documents and citations
// ---------------------------------------------------------------------------
export type SourceClass = "api" | "technical" | "marketing" | "other";

export interface DocLine {
  n: number;
  text: string;
}

export interface DocPage {
  num: number;
  lines: DocLine[];
}

export interface EvidenceDoc {
  id: string;
  name: string;            // file name or URL
  label: string;           // short human label, e.g. "AT-WP-07 whitepaper"
  fileType: "pdf" | "docx" | "txt" | "url";
  sourceClass: SourceClass;
  pages: DocPage[];
  addedAt: number;
  origin: "setup" | "chat" | "url";
  capturedAt?: number;     // for URL snapshots
}

export interface Citation {
  docId: string;
  docName: string;
  docLabel: string;
  fileType: EvidenceDoc["fileType"];
  page: number;
  line: number;
  text: string;
  role: "support" | "context";
}

// ---------------------------------------------------------------------------
// Claim chart
// ---------------------------------------------------------------------------
export type RowStatus = "technical" | "weak" | "missing" | "asserted";
export type Author = "original" | "ai" | "analyst" | "revert";

export type ScenarioKey =
  | "e1_lite" | "e1_pro" | "e1_legal"
  | "e2_pir" | "e2_legal"
  | "e3_ml" | "e3_legal" | "e3_deploy"
  | "e4_sensors" | "e4_legal";

export interface RowVersion {
  v: number;
  evidence: string;
  reasoning: string;
  source: string;
  status: RowStatus;
  author: Author;
  summary: string;
  at: number;
  citations: Citation[];
  chartVersion: number;
  keys: ScenarioKey[];     // scenarios whose content is incorporated in this version
  removed?: boolean;       // row hidden (e.g. an added row that was undone)
}

export interface ChartRow {
  id: string;              // e1, e2 ...
  tag: string;             // [1a]
  element: string;
  versions: RowVersion[];
  disputed: string | null;
  lastChangedAt: number | null;
}

export interface ClaimElement {
  tag: string;
  text: string;
}

export interface Chart {
  title: string;
  patent: string;
  patentTitle: string;
  product: string;
  claimLabel: string;
  preamble: string;
  elements: ClaimElement[];
  rows: ChartRow[];
  version: number;
  isDemoMatter: boolean;
  fileName: string;
  columns: string[];
}

// ---------------------------------------------------------------------------
// Session instructions ("system prompt")
// ---------------------------------------------------------------------------
export interface Instructions {
  tone: "formal" | "plain";
  flagClaimConstruction: boolean;
  custom: string;
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------
export interface Mods {
  tone: "formal" | "plain";
  concise: boolean;
  cc: boolean;
  onDevice: boolean;
  fieldData: boolean;
}

export interface ProposalContent {
  evidence: string;
  reasoning: string;
  source: string;
  status: RowStatus;
}

export interface Proposal {
  id: string;
  rowId: string;
  key: ScenarioKey;
  title: string;
  opLabel: string;
  isNewRow: boolean;
  newRow?: { tag: string; element: string };
  before: ProposalContent | null;
  after: ProposalContent;
  citations: Citation[];
  confidence: "High" | "Medium" | "Low";
  confidenceNote?: string;
  unverified: string;
  ccNote?: string;
  state: "pending" | "accepted" | "rejected" | "superseded" | "edited";
  mods: Mods;
  revision: number;
  supports: (keyof Mods)[];
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
export type RejectReason = "wrong_evidence" | "too_vague" | "too_long" | "wrong_element" | "not_defensible";

export type Action =
  | { type: "accept"; proposalId: string }
  | { type: "reject"; proposalId: string; reason?: RejectReason }
  | { type: "edit"; proposalId: string; evidence: string; reasoning: string }
  | { type: "editRow"; rowId: string; evidence: string; reasoning: string; supported: boolean }
  | { type: "confirmUndo" }
  | { type: "cancelUndo" }
  | { type: "pickVersion"; rowId: string; v: number }
  | { type: "noEvidenceOption"; option: "upload" | "url" | "gap" }
  | { type: "uploaded"; docs: EvidenceDoc[] }
  | { type: "approveCapture" }
  | { type: "discardCapture" }
  | { type: "exportDone"; fileName: string; citations: number; changes: number; override?: string }
  | { type: "instructionsChanged"; instructions: Instructions }
  | { type: "clearDispute"; rowId: string };

export interface Chip {
  label: string;
  send?: string;
  action?: Action;
  primary?: boolean;
}

export type MessageKind =
  | "text"
  | "proposal"
  | "noEvidence"
  | "capture"
  | "undoPreview"
  | "versionPicker"
  | "history"
  | "exportCheck"
  | "notice"
  | "thinking";

export interface Message {
  id: string;
  role: "ai" | "user" | "system";
  kind: MessageKind;
  text?: string;
  proposalId?: string;
  data?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  chips?: Chip[];
  steps?: string[];
  at: number;
  resolved?: boolean;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
export interface Gap {
  id: string;
  rowId: string;
  text: string;
  at: number;
  resolved: boolean;
}

export interface ChangeEntry {
  id: string;
  chartVersion: number;
  rowId: string;
  tag: string;
  action: string;
  author: Author;
  at: number;
}

export interface Correction {
  at: number;
  rowId: string;
  kind: string;      // graded event type, e.g. "wrong_variant", "rejected:too_long"
  detail: string;
}

export type Pending =
  | { type: "clarify"; op: OpKind }
  | { type: "rejectReason"; proposalId: string }
  | { type: "noEvidence"; key: ScenarioKey; rowId: string; retries: number }
  | { type: "awaitUrl"; key: ScenarioKey; rowId: string; retries: number }
  | { type: "awaitUpload"; key: ScenarioKey; rowId: string; retries: number }
  | { type: "capture"; key: ScenarioKey; rowId: string; doc: EvidenceDoc; retries: number }
  | { type: "undo"; rowId: string; toV: number }
  | { type: "pickUndo"; rowId: string }
  | { type: "disputeWhat"; rowId: string }
  | { type: "export" };

export type OpKind = "strengthen" | "reasoning" | "add" | "legal" | "deploy";

export interface Session {
  chart: Chart;
  docs: EvidenceDoc[];
  instructions: Instructions;
  messages: Message[];
  proposals: Record<string, Proposal>;
  activeProposalId: string | null;
  pending: Pending | null;
  constraints: string[];
  corrections: Correction[];
  gaps: Gap[];
  changeLog: ChangeEntry[];
  startedAt: number;
}
