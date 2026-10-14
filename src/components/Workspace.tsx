import { useCallback, useRef, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import type { Action, ChartRow, Citation, EvidenceDoc, Message, Session } from "../types";
import { act, captured, respond, type EngineResult } from "../lib/engine";
import { DEMO_FILES, fetchDemoFile, parseFile } from "../lib/parse";
import { exportDocx, downloadBlob } from "../lib/exportDocx";
import { uid } from "../lib/util";
import { Brand } from "./common";
import { ChatPanel } from "./ChatPanel";
import { ChartPanel } from "./ChartPanel";
import { InstructionsDrawer, RowEditor, SourceViewer } from "./Overlays";
import type { MsgHandlers } from "./MessageView";

const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 120) : ms));
const userMsg = (text: string): Message => ({ id: uid("m"), role: "user", kind: "text", text, at: Date.now() });

export function Workspace({ initial, onReset }: { initial: Session; onReset: () => void }) {
  const [s, setS] = useState<Session>(initial);
  const sRef = useRef(s);
  sRef.current = s;
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState<{ steps: string[]; shown: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [pinned, setPinned] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "chart">("chat");
  const [source, setSource] = useState<{ doc: EvidenceDoc; page: number; line: number | null } | null>(null);
  const [editRow, setEditRow] = useState<ChartRow | null>(null);
  const [instrOpen, setInstrOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), 3200); };

  /** Show the user's message, play the engine's work steps, then commit replies and run any effect. */
  const run = useCallback(async (compute: (cur: Session) => EngineResult, echo?: string) => {
    setBusy(true);
    let base = sRef.current;
    if (echo) {
      base = { ...base, messages: [...base.messages, userMsg(echo)] };
      setS(base);
    }
    const res = compute(base);
    if (res.steps?.length) {
      for (let i = 1; i <= res.steps.length + 1; i++) {
        setThinking({ steps: res.steps, shown: i });
        await wait(i > res.steps.length ? 180 : 360);
      }
    } else {
      setThinking({ steps: ["Reading your message"], shown: 1 });
      await wait(320);
    }
    setThinking(null);
    let next: Session = { ...res.session, messages: [...base.messages, ...res.replies] };
    setS(next);
    sRef.current = next;

    try {
      if (res.effect?.type === "fetchUrl") {
        const file = await fetchDemoFile(DEMO_FILES.heldBack);
        const parsed = await parseFile(file, "url", "evidence");
        if (parsed.kind === "evidence") {
          const doc: EvidenceDoc = { ...parsed.doc, name: res.effect.url, fileType: "url", origin: "url", capturedAt: Date.now(), label: "Acme developer docs (web capture)" };
          const c = captured(next, doc);
          next = { ...c.session, messages: [...next.messages, ...c.replies] };
          setS(next);
        }
      }
      if (res.effect?.type === "export") await doExportWith(next, res.effect.override);
    } catch (e) {
      flash((e as Error).message);
    }
    setBusy(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = (text: string) => { if (!busy) run((cur) => respond(cur, text), text); };
  const doAct = (a: Action, echo?: string) => { if (!busy) run((cur) => act(cur, a), echo); };

  async function doExportWith(cur: Session, override?: string) {
    const out = await exportDocx(cur, override);
    downloadBlob(out.blob, out.fileName);
    const r = act(cur, { type: "exportDone", fileName: out.fileName, citations: out.citations, changes: out.changes, override });
    const next = { ...r.session, messages: [...cur.messages, ...r.replies] };
    setS(next);
    sRef.current = next;
  }

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    try {
      const docs: EvidenceDoc[] = [];
      for (const f of files) {
        const p = await parseFile(f, "chat", "evidence");
        if (p.kind === "evidence") docs.push(p.doc);
      }
      run((cur) => act(cur, { type: "uploaded", docs }), `Uploaded ${files.map((f) => f.name).join(", ")}`);
    } catch (e) {
      flash((e as Error).message);
    }
  }

  const h: MsgHandlers = {
    send,
    act: doAct,
    cite: (c: Citation) => {
      const doc = s.docs.find((d) => d.id === c.docId);
      if (doc) setSource({ doc, page: c.page, line: c.line });
    },
    upload: () => fileInput.current?.click(),
    useDemoFile: async (name: string) => {
      try { await uploadFiles([await fetchDemoFile(name)]); } catch (e) { flash((e as Error).message); }
    },
    doExport: (override?: string) => {
      if (busy) return;
      setBusy(true);
      doExportWith(sRef.current, override).catch((e) => flash((e as Error).message)).finally(() => setBusy(false));
    },
  };

  return (
    <div className="ws">
      <header className="topbar">
        <Brand onDark />
        <div className="topbar__matter">
          <b>{s.chart.patent} v. {s.chart.product}</b>
          <span>{s.chart.claimLabel}, refinement session</span>
        </div>
        <div className="topbar__tabs" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "chat"} onClick={() => setView("chat")}>Chat</button>
          <button type="button" aria-pressed={view === "chart"} onClick={() => setView("chart")}>Chart</button>
        </div>
        <span className="topbar__spacer" />
        <span className="topbar__version">Chart <b>v{s.chart.version}</b></span>
        <button type="button" className="btn btn--on-dark btn--sm hide-sm" onClick={() => { if (confirm("Start over? This session’s changes will be lost.")) onReset(); }}><RotateCcw /> New session</button>
        <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => send("Export to Word")}><Download /> Export to Word</button>
      </header>

      <div className="ws__body" data-view={view}>
        <ChatPanel
          s={s} busy={busy} thinking={thinking} draft={draft} setDraft={setDraft}
          pinnedRow={pinned} clearPin={() => setPinned(null)} h={h} openInstructions={() => setInstrOpen(true)}
        />
        <ChartPanel
          s={s} busy={busy}
          onCite={h.cite}
          onOpenDoc={(doc) => setSource({ doc, page: 1, line: null })}
          onPin={(id) => { setPinned(id); setView("chat"); }}
          onEditRow={setEditRow}
          onSend={send}
        />
      </div>

      <input ref={fileInput} type="file" hidden multiple accept=".pdf,.docx,.txt,.md"
        onChange={(e) => { uploadFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />

      {source && <SourceViewer doc={source.doc} page={source.page} line={source.line} onClose={() => setSource(null)} />}
      {editRow && (
        <RowEditor row={editRow} onClose={() => setEditRow(null)}
          onSave={(evidence, reasoning, supported) => { setEditRow(null); doAct({ type: "editRow", rowId: editRow.id, evidence, reasoning, supported }, `Edited ${editRow.tag} directly`); }} />
      )}
      {instrOpen && (
        <InstructionsDrawer value={s.instructions} onClose={() => setInstrOpen(false)}
          onSave={(instructions) => { setInstrOpen(false); doAct({ type: "instructionsChanged", instructions }); }} />
      )}
      {toast && <div className="toast" role="alert">{toast}</div>}
    </div>
  );
}
