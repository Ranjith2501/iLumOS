import { useRef, useState, type DragEvent } from "react";
import { AlertTriangle, Check, Download, FileText, Loader2, Table2, Trash2, UploadCloud } from "lucide-react";
import type { Chart, EvidenceDoc, Instructions, SourceClass } from "../types";
import { DEMO_FILES, fetchDemoFile, parseFile } from "../lib/parse";
import { parseChart, type ChartParseResult } from "../lib/chart";
import { Brand, ClassPill, CLASS_LABEL } from "./common";
import { InstructionsForm } from "./InstructionsForm";
import { plural } from "../lib/util";

interface Props {
  onStart: (chart: Chart, docs: EvidenceDoc[], instructions: Instructions) => void;
}

const STEPS = [
  { t: "Add documents", s: "Claim chart and product evidence" },
  { t: "Set instructions", s: "How the AI should write and flag" },
  { t: "Review and start", s: "Open the refinement workspace" },
];

export function Setup({ onStart }: Props) {
  const [step, setStep] = useState(0);
  const [chart, setChart] = useState<ChartParseResult | null>(null);
  const [mappingOk, setMappingOk] = useState(false);
  const [docs, setDocs] = useState<EvidenceDoc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instr, setInstr] = useState<Instructions>({ tone: "formal", flagClaimConstruction: true, custom: "" });

  const ready0 = !!chart && chart.chart.rows.length > 0 && mappingOk;

  async function addChart(file: File) {
    setError(null); setBusy("chart");
    try {
      const p = await parseFile(file, "setup", "chart");
      if (p.kind !== "chart") throw new Error("That file doesn’t look like a claim chart.");
      const res = parseChart(p.html, p.text, file.name);
      if (!res.chart.rows.length) throw new Error(`Couldn’t find claim chart rows in ${file.name}. ${res.warnings.join(" ")}`);
      setChart(res); setMappingOk(false);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(null); }
  }

  async function addEvidence(files: File[]) {
    setError(null); setBusy("evidence");
    try {
      const out: EvidenceDoc[] = [];
      for (const f of files) {
        const p = await parseFile(f, "setup", "evidence");
        if (p.kind === "evidence") out.push(p.doc);
      }
      setDocs((d) => [...d.filter((x) => !out.some((o) => o.name === x.name)), ...out]);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(null); }
  }

  async function loadDemo() {
    setError(null); setBusy("demo");
    try {
      const c = await fetchDemoFile(DEMO_FILES.chart);
      await addChart(c);
      const ev = await Promise.all(DEMO_FILES.evidence.map(fetchDemoFile));
      await addEvidence(ev);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(null); }
  }

  const reclass = (id: string, cls: SourceClass) => setDocs((d) => d.map((x) => (x.id === id ? { ...x, sourceClass: cls } : x)));

  return (
    <div className="setup">
      <aside className="setup__rail">
        <Brand onDark />
        <div className="setup__intro">
          <h1>Refine a claim chart in conversation</h1>
          <p>Bring the chart you have and the documents behind it. You ask for changes in plain language; every change comes back as a proposal with its source, and only you apply it.</p>
        </div>
        <ol className="steps">
          {STEPS.map((st, i) => {
            const state = i === step ? "current" : i < step ? "done" : "todo";
            const reachable = i < step || (i === 1 && ready0) || (i === 2 && ready0);
            return (
              <li key={st.t} data-state={state}>
                <button type="button" disabled={!reachable || i === step} onClick={() => setStep(i)}>
                  <span className="steps__n">{state === "done" ? <Check /> : i + 1}</span>
                  <span><span className="steps__t">{st.t}</span><span className="steps__s">{st.s}</span></span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="setup__foot">Demo data is fictional.</p>
      </aside>

      <main className="setup__main">
        {step === 0 && (
          <>
            <header className="setup__head">
              <h2>Add your documents</h2>
              <p>Start with the claim chart you want to refine, then add the product documents the evidence should come from. The AI can only cite what you upload here or add later in the chat.</p>
            </header>

            <div className="demo-strip">
              <p><strong>No files handy?</strong> Load the sample matter: US 123,456 v. Acme SmartTherm Pro, with a draft chart and three product documents.</p>
              <div className="demo-strip__actions">
                <button type="button" className="btn btn--navy" onClick={loadDemo} disabled={!!busy}>
                  {busy === "demo" ? <Loader2 className="spin" /> : <UploadCloud />} Load the demo set
                </button>
                <DemoDownloads />
              </div>
            </div>

            <div className="upload-grid">
              <section className="panel">
                <h3 className="panel__title">Claim chart</h3>
                <p className="panel__sub">A Word table with claim element, evidence and reasoning columns.</p>
                <Drop accept=".docx" label="Drop the claim chart here" hint=".docx" busy={busy === "chart"} onFiles={(f) => f[0] && addChart(f[0])} />
                {chart && (
                  <div className="parsed">
                    <p className="parsed__title">{chart.chart.fileName}</p>
                    <p className="parsed__meta">
                      {plural(chart.chart.rows.length, "row")} read, {chart.chart.claimLabel.toLowerCase()} has {plural(chart.chart.elements.length, "element")}
                      {chart.unreadRows ? `, ${plural(chart.unreadRows, "row")} couldn’t be read` : ""}
                    </p>
                    <table className="map-table">
                      <tbody>
                        {chart.mapping.map((m) => (
                          <tr key={m.column}><td>{m.column}</td><td>{m.mappedTo}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    {chart.warnings.map((w) => <p className="warn" key={w}><AlertTriangle />{w}</p>)}
                    <label className="confirm" data-done={mappingOk}>
                      <input type="checkbox" checked={mappingOk} onChange={(e) => setMappingOk(e.target.checked)} />
                      <span>The column mapping is right. <span style={{ color: "var(--ink-3)" }}>A mis-mapped evidence column would affect every later suggestion, so the AI won’t guess it silently.</span></span>
                    </label>
                  </div>
                )}
              </section>

              <section className="panel">
                <h3 className="panel__title">Product evidence</h3>
                <p className="panel__sub">Spec sheets, whitepapers, teardowns, source excerpts, marketing pages.</p>
                <Drop accept=".pdf,.docx,.txt,.md" multiple label="Drop evidence documents here" hint="PDF, Word or text, several at once" busy={busy === "evidence"} onFiles={addEvidence} />
                {docs.length > 0 && (
                  <div className="parsed">
                    {docs.map((d) => (
                      <div className="file-row" key={d.id}>
                        <FileText />
                        <span className="file-row__name"><b title={d.name}>{d.name}</b><span>{plural(d.pages.length, "page")}, labelled “{d.label}”</span></span>
                        <select value={d.sourceClass} onChange={(e) => reclass(d.id, e.target.value as SourceClass)} aria-label={`Source type for ${d.name}`}>
                          {(Object.keys(CLASS_LABEL) as SourceClass[]).map((c) => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}
                        </select>
                        <button type="button" className="icon-btn" aria-label={`Remove ${d.name}`} onClick={() => setDocs((x) => x.filter((y) => y.id !== d.id))}><Trash2 /></button>
                      </div>
                    ))}
                    <p className="field__hint" style={{ marginTop: 8 }}>Source type sets how strongly each document ranks as evidence. Correct it if the guess is wrong.</p>
                  </div>
                )}
              </section>
            </div>
            {error && <p className="error">{error}</p>}

            <nav className="setup__nav">
              <span className="field__hint">{!chart ? "Add a claim chart to continue." : !mappingOk ? "Confirm the column mapping to continue." : docs.length === 0 ? "No evidence documents yet. You can add them later in the chat." : `${plural(docs.length, "evidence document")} ready.`}</span>
              <button type="button" className="btn btn--primary btn--lg" disabled={!ready0} onClick={() => setStep(1)}>Continue</button>
            </nav>
          </>
        )}

        {step === 1 && (
          <>
            <header className="setup__head">
              <h2>Set session instructions</h2>
              <p>These work like a standing brief for the AI in this session. They shape every proposal, and you can change them at any time from the workspace.</p>
            </header>
            <div style={{ display: "grid", gap: 28 }}>
              <InstructionsForm value={instr} onChange={setInstr} />
            </div>
            <nav className="setup__nav">
              <button type="button" className="btn" onClick={() => setStep(0)}>Back</button>
              <button type="button" className="btn btn--primary btn--lg" onClick={() => setStep(2)}>Continue</button>
            </nav>
          </>
        )}

        {step === 2 && chart && (
          <>
            <header className="setup__head">
              <h2>Review and start</h2>
              <p>The AI reads the chart against your documents first and tells you where it’s weakest, so you start the conversation knowing where to aim.</p>
            </header>
            <section className="panel summary">
              <dl>
                <dt>Matter</dt><dd>{chart.chart.patent} v. {chart.chart.product}</dd>
                <dt>Claim chart</dt><dd>{chart.chart.fileName}, {plural(chart.chart.rows.length, "row")}</dd>
                <dt>Evidence</dt>
                <dd style={{ display: "grid", gap: 6 }}>
                  {docs.length === 0 ? "None yet" : docs.map((d) => <span key={d.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>{d.label} <ClassPill cls={d.sourceClass} /></span>)}
                </dd>
                <dt>Reasoning style</dt><dd>{instr.tone === "formal" ? "Formal legal" : "Plain English"}</dd>
                <dt>Claim construction</dt><dd>{instr.flagClaimConstruction ? "Risks flagged on each proposal" : "Not flagged"}</dd>
                <dt>Approval</dt><dd>Every change needs your approval</dd>
                {instr.custom && (<><dt>Additional</dt><dd>{instr.custom}</dd></>)}
              </dl>
            </section>
            <nav className="setup__nav">
              <button type="button" className="btn" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="btn btn--primary btn--lg" onClick={() => onStart(chart.chart, docs, instr)}>
                <Table2 /> Start refining
              </button>
            </nav>
          </>
        )}
      </main>
    </div>
  );
}

function Drop({ accept, label, hint, multiple, busy, onFiles }: { accept: string; label: string; hint: string; multiple?: boolean; busy?: boolean; onFiles: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]); };
  return (
    <div
      className="drop" role="button" tabIndex={0} data-over={over}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
    >
      {busy ? <Loader2 className="spin" /> : <UploadCloud />}
      <strong>{busy ? "Reading…" : label}</strong>
      <span>or click to browse. {hint}</span>
      <input ref={ref} type="file" accept={accept} multiple={multiple} hidden onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
    </div>
  );
}

function DemoDownloads() {
  const [open, setOpen] = useState(false);
  const all = [DEMO_FILES.chart, ...DEMO_FILES.evidence, DEMO_FILES.heldBack];
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}><Download /> Demo files</button>
      {open && (
        <div className="menu" style={{ left: "auto", right: 0, bottom: "auto", top: "calc(100% + 6px)", width: 380 }}>
          <div className="menu__group">
            <p className="menu__title">Download to try uploading yourself</p>
            {all.map((f) => (
              <a key={f} className="menu__item" href={`${import.meta.env.BASE_URL}demo-files/${f}`} download style={{ textDecoration: "none" }}>
                <b>{f}</b>
                <span>{f === DEMO_FILES.heldBack ? "Held back: upload it mid-chat for the no-evidence path" : f.endsWith(".docx") ? "Claim chart" : "Product evidence"}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
