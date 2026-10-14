import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Pencil, Quote, Scale, X } from "lucide-react";
import type { Citation, Proposal } from "../types";
import { citeLabel } from "../lib/util";

interface Props {
  p: Proposal;
  disabled: boolean;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (evidence: string, reasoning: string) => void;
  onCite: (c: Citation) => void;
}

const STATE_TEXT: Record<Proposal["state"], string> = {
  pending: "Waiting for your review",
  accepted: "Accepted and applied",
  edited: "Applied with your edits",
  rejected: "Rejected",
  superseded: "Replaced by a newer revision",
};

export function ProposalCard({ p, disabled, onAccept, onReject, onEdit, onCite }: Props) {
  const [editing, setEditing] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [ev, setEv] = useState(p.after.evidence);
  const [re, setRe] = useState(p.after.reasoning);
  const pending = p.state === "pending";
  const [collapsed, setCollapsed] = useState(!pending);
  const support = p.citations.filter((c) => c.role === "support");
  const context = p.citations.filter((c) => c.role === "context");

  if (collapsed && !pending) {
    return (
      <div className="card proposal" data-state={p.state}>
        <div className="card__head" style={{ borderBottom: 0 }}>
          <span className="card__title">{p.title}</span>
          <span className={`state-line ${p.state === "accepted" || p.state === "edited" ? "state-line--ok" : ""}`}>
            {(p.state === "accepted" || p.state === "edited") && <CheckCircle2 />}{STATE_TEXT[p.state]}
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCollapsed(false)}>Show</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card proposal" data-state={p.state}>
      <div className="card__head">
        <span className="card__title">{p.title}</span>
        <span className="pill pill--pending" style={pending ? undefined : { opacity: 0.7 }}>{p.opLabel}</span>
        {p.revision > 1 && <span className="card__meta">Revision {p.revision}</span>}
        {!pending && <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCollapsed(true)}>Hide</button>}
      </div>

      <div className="card__body">
        {p.isNewRow && p.newRow && (
          <div>
            <p className="field-label">New row</p>
            <p className="legal-text"><b style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--navy-700)" }}>{p.newRow.tag}</b> {p.newRow.element}</p>
          </div>
        )}

        <div>
          <p className="field-label">
            Proposed evidence
            {p.before && !editing && (
              <button type="button" className="linkish" onClick={() => setShowCurrent((v) => !v)}>{showCurrent ? "Hide current" : "Compare with current"}</button>
            )}
          </p>
          {editing ? <textarea className="edit-area" value={ev} onChange={(e) => setEv(e.target.value)} aria-label="Edit evidence" /> : <p className="legal-text">{p.after.evidence}</p>}
          {showCurrent && p.before && !editing && (
            <div className="compare"><p className="compare__label">Current</p><p className="legal-text legal-text--old">{p.before.evidence}</p></div>
          )}
        </div>

        <div>
          <p className="field-label">Proposed reasoning</p>
          {editing ? <textarea className="edit-area" value={re} onChange={(e) => setRe(e.target.value)} aria-label="Edit reasoning" /> : <p className="legal-text">{p.after.reasoning}</p>}
          {showCurrent && p.before && !editing && (
            <div className="compare"><p className="compare__label">Current</p><p className="legal-text legal-text--old">{p.before.reasoning}</p></div>
          )}
        </div>

        <div>
          <p className="field-label">Sources, click to open the passage</p>
          <ul className="cites">
            {support.map((c, i) => <CiteRow key={i} c={c} onCite={onCite} />)}
            {context.map((c, i) => <CiteRow key={`x${i}`} c={c} onCite={onCite} />)}
          </ul>
        </div>

        {p.ccNote && (
          <div className="callout callout--cc"><Scale /><div><b>Claim construction risk</b>{p.ccNote}</div></div>
        )}
        <div className="callout callout--unverified"><AlertTriangle /><div><b>What I couldn’t verify</b>{p.unverified}</div></div>
      </div>

      <div className="card__foot">
        <span className="confidence">Confidence: <b>{p.confidence}</b>{p.confidenceNote ? `. ${p.confidenceNote.charAt(0).toUpperCase()}${p.confidenceNote.slice(1)}.` : ""}</span>
        <span className="grow" />
        {pending && !editing && (
          <>
            <button type="button" className="btn btn--ghost btn--sm" disabled={disabled} onClick={onReject}><X /> Reject</button>
            <button type="button" className="btn btn--sm" disabled={disabled} onClick={() => setEditing(true)}><Pencil /> Edit</button>
            <button type="button" className="btn btn--primary btn--sm" disabled={disabled} onClick={onAccept}><Check /> Accept</button>
          </>
        )}
        {pending && editing && (
          <>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setEditing(false); setEv(p.after.evidence); setRe(p.after.reasoning); }}>Cancel</button>
            <button type="button" className="btn btn--primary btn--sm" disabled={disabled || (!ev.trim() && !re.trim())} onClick={() => onEdit(ev.trim(), re.trim())}><Check /> Apply my edit</button>
          </>
        )}
        {!pending && (
          <span className={`state-line ${p.state === "accepted" || p.state === "edited" ? "state-line--ok" : ""}`}>
            {(p.state === "accepted" || p.state === "edited") && <CheckCircle2 />}{STATE_TEXT[p.state]}
          </span>
        )}
      </div>
    </div>
  );
}

function CiteRow({ c, onCite }: { c: Citation; onCite: (c: Citation) => void }) {
  return (
    <li>
      <button type="button" className="cite" data-role={c.role} onClick={() => onCite(c)}>
        <Quote />
        <span style={{ fontFamily: "inherit" }}>
          <b>{citeLabel(c)}{c.role === "context" && <em>Context</em>}</b>
          <span>{c.text}</span>
        </span>
      </button>
    </li>
  );
}
