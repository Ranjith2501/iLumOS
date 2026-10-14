import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ChartRow, EvidenceDoc, Instructions } from "../types";
import { current } from "../lib/chart";
import { ClassPill } from "./common";
import { InstructionsForm } from "./InstructionsForm";

function useEsc(onClose: () => void) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
}

export function SourceViewer({ doc, page, line, onClose }: { doc: EvidenceDoc; page: number; line: number | null; onClose: () => void }) {
  const [pg, setPg] = useState(page);
  const hit = useRef<HTMLDivElement>(null);
  useEsc(onClose);
  useEffect(() => setPg(page), [page, doc.id]);
  useEffect(() => { hit.current?.scrollIntoView({ block: "center" }); }, [pg, line]);
  const p = doc.pages.find((x) => x.num === pg) ?? doc.pages[0];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Source: ${doc.label}`}>
        <div className="drawer__head">
          <div>
            <h3>{doc.label}</h3>
            <p>{doc.name}</p>
            <div style={{ marginTop: 6 }}><ClassPill cls={doc.sourceClass} /></div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close source"><X /></button>
        </div>
        <div className="drawer__pages">
          {doc.pages.map((x) => (
            <button key={x.num} type="button" className={`btn btn--sm ${x.num === pg ? "btn--navy" : ""}`} onClick={() => setPg(x.num)}>
              {doc.fileType === "pdf" || doc.fileType === "url" ? `Page ${x.num}` : "Text"}
            </button>
          ))}
        </div>
        <div className="drawer__body">
          <div className="page-sheet">
            {p?.lines.map((l) => {
              const isHit = pg === page && line === l.n;
              return (
                <div key={l.n} ref={isHit ? hit : undefined} className="src-line" data-hit={isHit}>
                  <i>{l.n}</i><span>{l.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}

export function RowEditor({ row, onSave, onClose }: { row: ChartRow; onSave: (ev: string, re: string, supported: boolean) => void; onClose: () => void }) {
  const cv = current(row);
  const [ev, setEv] = useState(cv.evidence);
  const [re, setRe] = useState(cv.reasoning);
  const [supported, setSupported] = useState(cv.citations.length > 0);
  useEsc(onClose);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Edit ${row.tag}`}>
        <h3>Edit {row.tag} yourself</h3>
        <p>Your wording is saved as analyst-authored and the AI won’t rewrite it unless you ask.</p>
        <label className="field"><span className="field__label">Evidence</span><textarea className="edit-area" value={ev} onChange={(e) => setEv(e.target.value)} /></label>
        <label className="field"><span className="field__label">Reasoning</span><textarea className="edit-area" value={re} onChange={(e) => setRe(e.target.value)} /></label>
        <label className="check">
          <input type="checkbox" checked={supported} disabled={cv.citations.length === 0} onChange={(e) => setSupported(e.target.checked)} />
          The row’s existing citations still back my wording
        </label>
        <div className="modal__foot">
          <span className="field__hint">{supported ? "Saved with its citations." : "Saved as analyst-asserted; it will show in the pre-export check."}</span>
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn--primary" disabled={!ev.trim() && !re.trim()} onClick={() => onSave(ev.trim(), re.trim(), supported)}>Save edit</button>
          </span>
        </div>
      </div>
    </>
  );
}

export function InstructionsDrawer({ value, onSave, onClose }: { value: Instructions; onSave: (v: Instructions) => void; onClose: () => void }) {
  const [v, setV] = useState(value);
  useEsc(onClose);
  const changed = JSON.stringify(v) !== JSON.stringify(value);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Session instructions" style={{ gridTemplateRows: "auto 1fr auto" }}>
        <div className="drawer__head">
          <div><h3>Session instructions</h3><p>Shape every proposal from here on. Open proposals keep the instructions they were written under.</p></div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="drawer__form"><InstructionsForm value={v} onChange={setV} /></div>
        <div className="card__foot" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" disabled={!changed} onClick={() => onSave(v)}>Save instructions</button>
        </div>
      </aside>
    </>
  );
}
