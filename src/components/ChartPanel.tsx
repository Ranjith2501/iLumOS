import { useEffect, useState } from "react";
import { ChevronRight, FileText, Globe, MessageSquarePlus, Pencil, Plus, Quote } from "lucide-react";
import type { ChartRow, Citation, EvidenceDoc, Session } from "../types";
import { current, unmappedElements, visibleRows } from "../lib/chart";
import { C } from "../lib/engine";
import { citeLabel, dateTimeLabel, plural, timeLabel } from "../lib/util";
import { ClassPill, StatusPill } from "./common";

interface Props {
  s: Session;
  busy: boolean;
  onCite: (c: Citation) => void;
  onOpenDoc: (d: EvidenceDoc) => void;
  onPin: (rowId: string) => void;
  onEditRow: (row: ChartRow) => void;
  onSend: (text: string) => void;
}

type Tab = "chart" | "sources" | "history";
const AUTHOR: Record<string, string> = { original: "Uploaded draft", ai: "AI-proposed, analyst-approved", analyst: "Analyst", revert: "Analyst revert" };

export function ChartPanel({ s, busy, onCite, onOpenDoc, onPin, onEditRow, onSend }: Props) {
  const [tab, setTab] = useState<Tab>("chart");
  const [showChanges, setShowChanges] = useState(true);
  const [, tick] = useState(0);
  const { chart } = s;
  const rows = visibleRows(chart);
  const unmapped = unmappedElements(chart);
  const active = s.activeProposalId ? s.proposals[s.activeProposalId] : null;
  const pendingRow = active?.state === "pending" ? active.rowId : null;

  // re-render once the change flash has played so it can replay on the next change
  useEffect(() => {
    const t = setTimeout(() => tick((n) => n + 1), 2600);
    return () => clearTimeout(t);
  }, [chart.version]);

  return (
    <section className="pane" aria-label="Claim chart">
      <div className="pane__head">
        <div>
          <h2>{chart.patent} v. {chart.product.replace(/\s*\(.*\)/, "")}</h2>
          <p>{chart.claimLabel}, {plural(rows.length, "row")}, chart version {chart.version}</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" className="tab" aria-selected={tab === "chart"} onClick={() => setTab("chart")}>Claim chart</button>
        <button type="button" role="tab" className="tab" aria-selected={tab === "sources"} onClick={() => setTab("sources")}>Sources <span className="tab__count">{s.docs.length}</span></button>
        <button type="button" role="tab" className="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>History <span className="tab__count">{s.changeLog.length}</span></button>
      </div>

      <div className="pane__scroll">
        {tab === "chart" && (
          <>
            <details className="claim-box">
              <summary><ChevronRight />{chart.claimLabel} as asserted</summary>
              <p className="claim-text">
                {chart.preamble && <>{chart.preamble}<br /></>}
                {chart.elements.map((e) => {
                  const missing = unmapped.some((u) => u.tag === e.tag);
                  return <span key={e.tag} className={missing ? "unmapped" : undefined}><b>{e.tag}</b>{e.text}{missing ? " (not mapped)" : ""}<br /></span>;
                })}
              </p>
            </details>

            <div className="pane__tools">
              <label className="check"><input type="checkbox" checked={showChanges} onChange={(e) => setShowChanges(e.target.checked)} /> Show what changed</label>
              <span className="field__hint">Click a row’s chat icon to ask about it</span>
            </div>

            <div className="chart-wrap">
              <table className="chart">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Claim element</th>
                    <th scope="col">Accused product feature (evidence)</th>
                    <th scope="col">Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <Row key={r.id} r={r} n={i + 1} s={s} pending={pendingRow === r.id} showChanges={showChanges}
                      onCite={onCite} onPin={() => onPin(r.id)} onEdit={() => onEditRow(r)} busy={busy} />
                  ))}
                  {unmapped.map((u) => (
                    <tr key={u.tag} className="unmapped-row" data-pending={pendingRow === "e4" && u.tag === "[1d]"}>
                      <td className="c-no"><b>–</b>{u.tag}</td>
                      <td className="c-el"><p className="cell-text">{u.text}</p><div className="cell-flags"><span className="pill pill--missing">Not mapped</span></div></td>
                      <td colSpan={2}>
                        <p className="cell-text">No row maps this element yet.</p>
                        <div className="row-actions"><button type="button" className="btn btn--sm" disabled={busy} onClick={() => onSend(C.E4)}><Plus /> Draft this row</button></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "sources" && (
          <>
            <p className="section-title">Searched for every proposal, strongest source type first</p>
            {s.docs.length === 0 ? <div className="list empty">No evidence documents yet. Attach one from the chat.</div> : (
              <div className="list">
                {s.docs.map((d) => (
                  <div key={d.id} className="list__item">
                    {d.fileType === "url" ? <Globe /> : <FileText />}
                    <div style={{ minWidth: 0 }}>
                      <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</b>
                      <span>{d.name}, {plural(d.pages.length, "page")}, {d.origin === "url" ? `captured ${dateTimeLabel(d.capturedAt ?? d.addedAt)}` : d.origin === "chat" ? "added in chat" : "added at setup"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <ClassPill cls={d.sourceClass} />
                      <button type="button" className="btn btn--sm" onClick={() => onOpenDoc(d)}>Open</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "history" && (
          <>
            <p className="section-title">Change log, newest first. Append-only: reverts are new versions.</p>
            {s.changeLog.length === 0 ? <div className="list empty">No changes yet. Accepted proposals appear here.</div> : (
              <div className="list">
                {[...s.changeLog].reverse().map((e) => (
                  <div key={e.id} className="log-row">
                    <b>v{e.chartVersion}</b>
                    <span>{e.tag === "-" ? "" : e.tag}</span>
                    <div>{e.action}<br /><span>{AUTHOR[e.author]}</span></div>
                    <span>{timeLabel(e.at)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="section-title">Analyst corrections logged for evaluation</p>
            {s.corrections.length === 0 ? <div className="list empty">None yet. Rejections with a reason and citation corrections are recorded here as graded events.</div> : (
              <div className="list">
                {s.corrections.map((c, i) => (
                  <div key={i} className="log-row" style={{ gridTemplateColumns: "56px 1fr auto" }}>
                    <b>{c.rowId.replace("e", "Elem. ")}</b>
                    <div>{c.kind.replace(/[_:]/g, " ")}<br /><span>{c.detail}</span></div>
                    <span>{timeLabel(c.at)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Row({ r, n, s, pending, showChanges, onCite, onPin, onEdit, busy }: {
  r: ChartRow; n: number; s: Session; pending: boolean; showChanges: boolean; busy: boolean;
  onCite: (c: Citation) => void; onPin: () => void; onEdit: () => void;
}) {
  const cv = current(r);
  const prev = r.versions.length > 1 ? r.versions[r.versions.length - 2] : null;
  const changed = cv.v > 1 || cv.author !== "original";
  const flash = !!r.lastChangedAt && Date.now() - r.lastChangedAt < 2500;
  const gap = s.gaps.find((g) => g.rowId === r.id && !g.resolved);
  const showOld = showChanges && prev && !prev.removed && cv.author !== "original";
  return (
    <tr data-pending={pending} data-flash={flash}>
      <td className="c-no"><b>{n}</b>{r.tag}</td>
      <td className="c-el">
        <p className="cell-text">{r.element}</p>
        <div className="cell-flags">
          <StatusPill status={cv.status} />
          {changed && <span className="pill pill--updated">Row v{cv.v}</span>}
          {pending && <span className="pill pill--pending">Proposal open</span>}
          {r.disputed && <span className="pill pill--disputed" title={r.disputed}>Disputed</span>}
          {gap && <span className="pill pill--gap" title={gap.text}>Evidence gap</span>}
        </div>
        <div className="row-actions">
          <button type="button" className="icon-btn" onClick={onPin} disabled={busy} aria-label={`Ask about element ${n}`} title="Ask about this row"><MessageSquarePlus /></button>
          <button type="button" className="icon-btn" onClick={onEdit} disabled={busy} aria-label={`Edit element ${n}`} title="Edit this row yourself"><Pencil /></button>
        </div>
      </td>
      <td className="c-ev">
        {showOld && prev.evidence !== cv.evidence && <p className="cell-old">{prev.evidence}</p>}
        <p className="cell-text">{cv.evidence}</p>
        {cv.source && <p className="cell-source">Source: {cv.source}</p>}
        {cv.citations.length > 0 && (
          <details className="cell-cites">
            <summary><Quote />{plural(cv.citations.length, "citation")}</summary>
            <ul className="cites">
              {cv.citations.map((c, i) => (
                <li key={i}><button type="button" className="cite" data-role={c.role} onClick={() => onCite(c)}><Quote /><span><b>{citeLabel(c)}</b><span>{c.text}</span></span></button></li>
              ))}
            </ul>
          </details>
        )}
      </td>
      <td className="c-re">
        {showOld && prev.reasoning !== cv.reasoning && <p className="cell-old">{prev.reasoning}</p>}
        <p className="cell-text">{cv.reasoning}</p>
      </td>
    </tr>
  );
}
