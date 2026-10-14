import type { ReactNode } from "react";
import type { RowStatus, SourceClass } from "../types";

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7" fill="#0B1F3F" stroke="#2A4677" strokeWidth="1.5" />
      <circle cx="16" cy="10.2" r="6.4" fill="#F26B21" opacity="0.22" />
      <circle cx="16" cy="10.2" r="3.3" fill="#F26B21" />
      <rect x="13.6" y="15.6" width="4.8" height="10.4" rx="2.4" fill="#FFFFFF" />
    </svg>
  );
}

export function Brand({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="brand" style={{ color: onDark ? "#fff" : "var(--navy-900)" }}>
      <BrandMark />
      <span>
        <span className="brand__name">iLumos</span>
        <span className="brand__by">by Lumenci</span>
      </span>
    </span>
  );
}

const URL_SPLIT = /(https?:\/\/[^\s)]+)/g;

/** Renders engine text: blank-line paragraphs, "- " lines as a list, URLs as tappable. */
export function RichText({ text, onUrl }: { text: string; onUrl?: (url: string) => void }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string, k: string): ReactNode[] =>
    s.split(URL_SPLIT).map((part, i) =>
      /^https?:\/\//.test(part) ? (
        onUrl ? (
          <button key={k + i} type="button" className="url" onClick={() => onUrl(part.replace(/[.,]+$/, ""))} title="Send this URL">
            {part}
          </button>
        ) : (
          <span key={k + i} className="url">{part}</span>
        )
      ) : (
        <span key={k + i}>{part}</span>
      )
    );
  return (
    <>
      {blocks.map((b, bi) => {
        const lines = b.split("\n");
        if (lines.every((l) => l.startsWith("- ")))
          return <ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.slice(2), `${bi}-${li}-`)}</li>)}</ul>;
        return <p key={bi}>{lines.map((l, li) => <span key={li}>{li > 0 && <br />}{inline(l, `${bi}-${li}-`)}</span>)}</p>;
      })}
    </>
  );
}

export const STATUS_LABEL: Record<RowStatus, string> = {
  technical: "Technical source",
  weak: "Marketing only",
  missing: "No evidence",
  asserted: "Analyst-asserted",
};

export function StatusPill({ status }: { status: RowStatus }) {
  return <span className={`pill pill--${status}`}>{STATUS_LABEL[status]}</span>;
}

export const CLASS_LABEL: Record<SourceClass, string> = {
  api: "API documentation",
  technical: "Technical",
  marketing: "Marketing",
  other: "Other",
};

export function ClassPill({ cls }: { cls: SourceClass }) {
  const kind = cls === "technical" ? "technical" : cls === "marketing" ? "weak" : cls;
  return <span className={`pill pill--${kind}`}>{CLASS_LABEL[cls]}</span>;
}
