let counter = 0;
export const uid = (prefix = "id") => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

/** Lower-case, unify quotes/dashes, collapse whitespace. Used for anchor matching. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201f]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function dateTimeLabel(ts: number): string {
  return new Date(ts).toLocaleString([], {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function citeLabel(c: { docLabel: string; page: number; line: number; fileType: string }): string {
  if (c.fileType === "docx" || c.fileType === "txt") return `${c.docLabel}, paragraph ${c.line}`;
  return `${c.docLabel}, p. ${c.page}, line ${c.line}`;
}
