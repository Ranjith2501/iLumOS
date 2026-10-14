import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CheckCircle2, ListChecks, Loader2, Paperclip, SendHorizontal, Settings2, X } from "lucide-react";
import type { Message, Session } from "../types";
import { BrandMark } from "./common";
import { MessageView, type MsgHandlers } from "./MessageView";
import { COMMAND_GROUPS } from "../lib/engine";

interface Props {
  s: Session;
  busy: boolean;
  thinking: { steps: string[]; shown: number } | null;
  draft: string;
  setDraft: (v: string) => void;
  pinnedRow: string | null;
  clearPin: () => void;
  h: MsgHandlers;
  openInstructions: () => void;
}

const LIVE_KINDS = new Set(["noEvidence", "capture", "undoPreview", "versionPicker", "exportCheck"]);

export function ChatPanel({ s, busy, thinking, draft, setDraft, pinnedRow, clearPin, h, openInstructions }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState(false);

  // the last message that carries chips or an interactive card is the only "live" one
  const liveId = useMemo(() => {
    for (let i = s.messages.length - 1; i >= 0; i--) {
      const m: Message = s.messages[i];
      if (m.role === "user") return null;
      if ((m.chips && m.chips.length) || LIVE_KINDS.has(m.kind) || m.data?.uploadPrompt) return m.id;
    }
    return null;
  }, [s.messages]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.messages.length, thinking?.shown]);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [draft]);

  useEffect(() => { if (pinnedRow) input.current?.focus(); }, [pinnedRow]);

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    const full = pinnedRow && !/element\s*\d|\brow\s*\d|\b1[a-d]\b/i.test(text) ? `${text} (element ${pinnedRow.slice(1)})` : text;
    h.send(full);
    setDraft("");
    clearPin();
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    if (e.key === "Escape") setMenu(false);
  };

  return (
    <section className="chat" aria-label="Refinement chat">
      <header className="chat__head">
        <div>
          <h2>Refinement chat</h2>
          <p>{s.instructions.tone === "formal" ? "Formal legal" : "Plain English"}{s.instructions.flagClaimConstruction ? ", claim construction flagged" : ""}, approval required</p>
        </div>
        <button type="button" className="btn btn--sm" onClick={openInstructions}><Settings2 /> Instructions</button>
      </header>

      <div className="chat__scroll" ref={scroller}>
        <div className="msgs" aria-live="polite">
          {s.messages.map((m) => (
            <MessageView key={m.id} m={m} s={s} live={m.id === liveId} busy={busy} h={h} />
          ))}
          {thinking && (
            <div className="msg">
              <span className="msg__avatar"><BrandMark size={26} /></span>
              <div className="thinking" aria-label="Working">
                {thinking.steps.slice(0, Math.max(1, thinking.shown)).map((st, i) => {
                  const done = i < thinking.shown - 1 || thinking.shown > thinking.steps.length;
                  return (
                    <div key={i} className="thinking__step" data-state={done ? "done" : "active"}>
                      {done ? <CheckCircle2 /> : <Loader2 className="spin" />}{st}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="composer">
        {menu && (
          <div className="menu" role="menu">
            {COMMAND_GROUPS.map((g) => (
              <div className="menu__group" key={g.title}>
                <p className="menu__title">{g.title}</p>
                {g.items.map((it) => (
                  <button key={it.text} type="button" role="menuitem" className="menu__item"
                    onClick={() => { setDraft(it.text); setMenu(false); input.current?.focus(); }}>
                    <b>{it.text}</b><span>{it.hint}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        {pinnedRow && (
          <span className="pinned">Asking about element {pinnedRow.slice(1)}<button type="button" onClick={clearPin} aria-label="Unpin row"><X /></button></span>
        )}
        <div className="composer__box">
          <div className="composer__tools">
            <button type="button" className="icon-btn" onClick={h.upload} aria-label="Attach an evidence document" title="Attach an evidence document"><Paperclip /></button>
            <button type="button" className="icon-btn" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label="Demo commands" title="Demo commands"><ListChecks /></button>
          </div>
          <textarea
            ref={input}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder={busy ? "Working…" : "Ask for a change, e.g. “strengthen the evidence for element 2”"}
            aria-label="Message"
          />
          <button type="button" className="btn btn--primary composer__send" onClick={submit} disabled={busy || !draft.trim()} aria-label="Send"><SendHorizontal /></button>
        </div>
        <p className="composer__hint">
          <span>Enter to send, Shift+Enter for a new line</span>
          <span>Nothing changes in the chart until you accept it</span>
        </p>
      </div>
    </section>
  );
}
