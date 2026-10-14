import { useState } from "react";
import {
  AlertTriangle, Check, CircleDot, Download, FileUp, Flag, Globe, Info, Quote, RotateCcw, Undo2,
} from "lucide-react";
import type { Action, Chip, Citation, Message, Session } from "../types";
import { BrandMark, RichText } from "./common";
import { ProposalCard } from "./ProposalCard";
import { citeLabel, dateTimeLabel, timeLabel } from "../lib/util";

export interface MsgHandlers {
  send: (text: string) => void;
  act: (a: Action, echo?: string) => void;
  cite: (c: Citation) => void;
  upload: () => void;
  useDemoFile: (name: string) => void;
  doExport: (override?: string) => void;
}

interface Props {
  m: Message;
  s: Session;
  live: boolean;      // latest interactive message of its kind
  busy: boolean;
  h: MsgHandlers;
}

const AUTHOR: Record<string, string> = { original: "Uploaded draft", ai: "AI-proposed, you approved", analyst: "Your edit", revert: "Revert" };

export function MessageView({ m, s, live, busy, h }: Props) {
  if (m.kind === "notice") {
    return <div className="notice" role="status"><Info /><span>{m.text}</span></div>;
  }
  if (m.role === "user") {
    return (
      <div className="msg msg--user">
        <div className="msg__text">{m.text}</div>
        <div className="msg__time">{timeLabel(m.at)}</div>
      </div>
    );
  }
  const pend = s.pending;
  return (
    <div className="msg">
      <span className="msg__avatar"><BrandMark size={26} /></span>
      <div className="msg__body">
        {m.text && <div className="msg__text"><RichText text={m.text} onUrl={pend?.type === "awaitUrl" ? h.send : undefined} /></div>}

        {m.kind === "proposal" && m.proposalId && s.proposals[m.proposalId] && (
          <ProposalCard
            key={m.proposalId}
            p={s.proposals[m.proposalId]}
            disabled={busy}
            onAccept={() => h.act({ type: "accept", proposalId: m.proposalId! }, "Accept")}
            onReject={() => h.act({ type: "reject", proposalId: m.proposalId! }, "Reject")}
            onEdit={(evidence, reasoning) => h.act({ type: "edit", proposalId: m.proposalId!, evidence, reasoning }, "Apply my edit")}
            onCite={h.cite}
          />
        )}

        {m.kind === "noEvidence" && <NoEvidenceCard m={m} live={live && !!pend && ["noEvidence", "awaitUrl", "awaitUpload"].includes(pend.type)} busy={busy} h={h} />}

        {m.data?.uploadPrompt && (
          <div className="chips">
            <button type="button" className="chip chip--primary" disabled={busy || pend?.type !== "awaitUpload"} onClick={h.upload}><FileUp size={13} style={{ verticalAlign: -2 }} /> Choose a file</button>
            {m.data.demoFile && (
              <button type="button" className="chip" disabled={busy || pend?.type !== "awaitUpload"} onClick={() => h.useDemoFile(m.data.demoFile)}>Use the demo file: {m.data.demoFile}</button>
            )}
          </div>
        )}

        {m.kind === "capture" && (
          <div className="card">
            <div className="card__head"><Globe size={16} /><span className="card__title">Web capture</span><span className="card__meta">{m.data.pages} pages of text</span></div>
            <div className="card__body">
              <div style={{ fontSize: 13 }}>
                <div style={{ wordBreak: "break-all", fontWeight: 500 }}>{m.data.url}</div>
                <div className="card__meta">Captured {dateTimeLabel(m.data.capturedAt)}. A dated snapshot is stored with the session, because a product page can change after it’s cited.</div>
              </div>
              <pre className="capture-preview">{(m.data.preview as string[]).join("\n")}</pre>
            </div>
            <div className="card__foot">
              <span className="grow" />
              <button type="button" className="btn btn--ghost btn--sm" disabled={busy || !live || pend?.type !== "capture"} onClick={() => h.act({ type: "discardCapture" }, "Discard it")}>Discard</button>
              <button type="button" className="btn btn--primary btn--sm" disabled={busy || !live || pend?.type !== "capture"} onClick={() => h.act({ type: "approveCapture" }, "Approve the capture")}><Check /> Approve and use</button>
            </div>
          </div>
        )}

        {m.kind === "undoPreview" && (
          <div className="card">
            <div className="card__head"><Undo2 size={16} /><span className="card__title">Revert preview</span></div>
            <div className="card__body">
              {m.data.to ? (
                <>
                  <div><p className="field-label">Evidence goes back to</p><p className="legal-text">{m.data.to.evidence}</p></div>
                  <div><p className="field-label">Reasoning goes back to</p><p className="legal-text">{m.data.to.reasoning}</p></div>
                  <div className="compare"><p className="compare__label">Current, replaced on confirm</p><p className="legal-text legal-text--old">{m.data.from.reasoning}</p></div>
                </>
              ) : (
                <div className="compare"><p className="compare__label">Removed on confirm</p><p className="legal-text legal-text--old">{m.data.from.evidence}</p></div>
              )}
              {m.data.dependent?.length > 0 && (
                <div className="callout callout--warn"><AlertTriangle /><div><b>Later changes depend on this</b>Reverting also removes {m.data.dependent.join(" and ")}.</div></div>
              )}
            </div>
            <div className="card__foot">
              <span className="field__hint">Saved as a new version, so this can be undone too.</span>
              <span className="grow" />
              <button type="button" className="btn btn--ghost btn--sm" disabled={busy || !live || pend?.type !== "undo"} onClick={() => h.act({ type: "cancelUndo" }, "Keep the current version")}>Keep current</button>
              <button type="button" className="btn btn--primary btn--sm" disabled={busy || !live || pend?.type !== "undo"} onClick={() => h.act({ type: "confirmUndo" }, "Confirm revert")}><RotateCcw /> Confirm revert</button>
            </div>
          </div>
        )}

        {m.kind === "versionPicker" && (
          <div className="card">
            <div className="card__body versions">
              {(m.data.versions as { v: number; summary: string; author: string; at: number }[]).map((v) => (
                <button key={v.v} type="button" className="version-btn" disabled={busy || !live || pend?.type !== "pickUndo"}
                  onClick={() => h.act({ type: "pickVersion", rowId: m.data.rowId, v: v.v }, `Version ${v.v}`)}>
                  <b>v{v.v}</b><span>{v.summary}</span><span>{AUTHOR[v.author]}, {timeLabel(v.at)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {m.kind === "history" && (
          <div className="card">
            <div className="card__body">
              {(m.data.rows as { id: string; tag: string; versions: { v: number; summary: string; author: string; at: number; chartVersion: number; removed: boolean }[] }[]).map((r) => (
                <div key={r.id}>
                  <p className="field-label">Element {r.id.slice(1)} {r.tag}</p>
                  <div className="versions">
                    {[...r.versions].reverse().map((v) => (
                      <div key={v.v} className="version-btn" style={{ cursor: "default" }}>
                        <b>v{v.v}</b><span>{v.summary}{v.removed ? " (removed)" : ""}</span><span>Chart v{v.chartVersion}, {timeLabel(v.at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {m.kind === "exportCheck" && <ExportCard m={m} live={live && pend?.type === "export"} busy={busy} h={h} />}

        {m.chips && m.chips.length > 0 && <Chips chips={m.chips} disabled={busy || !live} h={h} />}
      </div>
    </div>
  );
}

function Chips({ chips, disabled, h }: { chips: Chip[]; disabled: boolean; h: MsgHandlers }) {
  return (
    <div className="chips">
      {chips.map((c, i) => (
        <button key={i} type="button" className={`chip ${c.primary ? "chip--primary" : ""}`} disabled={disabled}
          onClick={() => (c.action ? h.act(c.action, c.label) : h.send(c.send ?? c.label))}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

function NoEvidenceCard({ m, live, busy, h }: { m: Message; live: boolean; busy: boolean; h: MsgHandlers }) {
  const d = m.data;
  const opts: { k: "upload" | "url" | "gap"; icon: JSX.Element; t: string; s: string }[] = [
    { k: "upload", icon: <FileUp />, t: "Upload a document", s: "Spec sheet, teardown, source excerpt or API reference" },
    { k: "url", icon: <Globe />, t: "Provide a URL", s: "I’ll capture the page and show you what I got before citing it" },
    { k: "gap", icon: <Flag />, t: "Mark as evidence gap", s: "Carry on; it’s listed as an open item in the export" },
  ];
  return (
    <div className="card">
      <div className="card__head"><CircleDot size={16} color="var(--amber-700)" /><span className="card__title">No supporting evidence found</span></div>
      <div className="card__body">
        <p className="searched">{d.searched}</p>
        {d.closest?.length > 0 && (
          <div>
            <p className="field-label">Closest matches</p>
            <ul className="cites">
              {(d.closest as Citation[]).map((c, i) => (
                <li key={i}><button type="button" className="cite" data-role="context" onClick={() => h.cite(c)}><Quote /><span><b>{citeLabel(c)}</b><span>{c.text}</span></span></button></li>
              ))}
            </ul>
          </div>
        )}
        <p className="searched">{d.closestNote} {d.need}</p>
        <div className="option-list">
          {opts.map((o) => (
            <button key={o.k} type="button" className="option" disabled={busy || !live} onClick={() => h.act({ type: "noEvidenceOption", option: o.k }, o.t)}>
              <span className="option__icon">{o.icon}</span>
              <span><b>{o.t}</b><span>{o.s}</span></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportCard({ m, live, busy, h }: { m: Message; live: boolean; busy: boolean; h: MsgHandlers }) {
  const issues = m.data.issues as { text: string; fix?: string }[];
  const [reason, setReason] = useState("");
  return (
    <div className="card">
      {issues.length > 0 && (
        <div className="card__body">
          {issues.map((i, k) => (
            <div className="issue" key={k}>
              <AlertTriangle />
              <span className="issue__text">{i.text}</span>
              {i.fix && <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => h.send(i.fix!)}>Fix</button>}
            </div>
          ))}
        </div>
      )}
      <div className="card__foot">
        {issues.length > 0 ? (
          <>
            <input className="reason-input" placeholder="Reason for exporting with open items" value={reason} onChange={(e) => setReason(e.target.value)} disabled={!live || busy} aria-label="Reason for exporting with open items" />
            <button type="button" className="btn btn--sm" disabled={!live || busy || reason.trim().length < 4} onClick={() => h.doExport(reason.trim())}><Download /> Export anyway</button>
          </>
        ) : (
          <>
            <span className="field__hint">Chart, citation appendix and change log in one Word file.</span>
            <span className="grow" />
            <button type="button" className="btn btn--primary btn--sm" disabled={!live || busy} onClick={() => h.doExport()}><Download /> Download .docx</button>
          </>
        )}
      </div>
    </div>
  );
}
